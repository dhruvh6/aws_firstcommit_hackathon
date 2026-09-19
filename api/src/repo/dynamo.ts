/**
 * DynamoDB Repo implementation - OWNER: M3 (docs/08-TEAM-ROLES.md § 7).
 *
 * Implements the full Repo interface against the five DynamoDB tables:
 * - Businesses:     ${TABLE_PREFIX}businesses
 * - Listings:       ${TABLE_PREFIX}listings
 * - Requirements:   ${TABLE_PREFIX}requirements
 * - Reservations:   ${TABLE_PREFIX}reservations
 * - Impact:         ${TABLE_PREFIX}impact
 *
 * Conditional writes guarantee race-free reservations without double-counting.
 * All-or-nothing handoff uses TransactWriteItems across reservation + listing +
 * requirement + impact (docs/05-ARCHITECTURE.md § 5).
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type {
  Business,
  ImpactRecord,
  ListingStatus,
  Requirement,
  RequirementStatus,
  Reservation,
  ReservationStatus,
  SurplusListing,
} from '@dse/shared';
import { CATEGORY_UNITS } from '@dse/shared';
import { distanceKm } from '../domain/distance.js';
import {
  DuplicateImpactRecordError,
  EntityAlreadyExistsError,
  EntityNotFoundError,
  InsufficientQuantityError,
  InvalidStateError,
  InvalidCursorError,
  InvariantViolationError,
  type HandoffCommit,
  type HandoffResult,
  type ImpactFilter,
  type ListingFilter,
  type Page,
  type QuantityDelta,
  type Repo,
  type RequirementFilter,
  type ReservationFilter,
} from './index.js';

export interface DynamoRepoOptions {
  client?: DynamoDBClient;
  docClient?: DynamoDBDocumentClient;
  tablePrefix?: string;
  region?: string;
  now?: () => string;
}

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

const clone = <T>(value: T): T => structuredClone(value);

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function approximatelyEqual(a: number, b: number): boolean {
  return Math.abs(roundQuantity(a) - roundQuantity(b)) < 0.001;
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { offset?: unknown };
    if (!Number.isInteger(parsed.offset) || Number(parsed.offset) < 0) throw new Error('invalid offset');
    return Number(parsed.offset);
  } catch {
    throw new InvalidCursorError();
  }
}

function paginate<T>(rows: T[], limitInput?: number, cursor?: string): Page<T> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limitInput ?? DEFAULT_LIMIT)));
  const offset = decodeCursor(cursor);
  const items = rows.slice(offset, offset + limit);
  const nextOffset = offset + items.length;
  const truncated = nextOffset < rows.length;
  return {
    items: clone(items),
    nextCursor: truncated ? encodeCursor(nextOffset) : null,
    truncated,
  };
}

function assertFiniteQuantity(quantity: number, label: string, allowZero = false): void {
  if (!Number.isFinite(quantity) || (allowZero ? quantity < 0 : quantity <= 0)) {
    throw new InvariantViolationError(`${label} must be ${allowZero ? 'non-negative' : 'positive'}`);
  }
  if (!approximatelyEqual(quantity, roundQuantity(quantity))) {
    throw new InvariantViolationError(`${label} must have at most two decimal places`);
  }
}

function deriveListingStatus(listing: SurplusListing): ListingStatus {
  if (listing.status === 'WITHDRAWN') return 'WITHDRAWN';
  if (listing.status === 'EXPIRED' && listing.availableQuantity > 0) return 'EXPIRED';
  if (approximatelyEqual(listing.availableQuantity, 0)) return 'FULLY_RESERVED';
  if (listing.reservedQuantity > 0 || listing.handedOffQuantity > 0) return 'PARTIALLY_RESERVED';
  return 'ACTIVE';
}

function deriveRequirementStatus(requirement: Requirement): RequirementStatus {
  if (requirement.status === 'CANCELLED' || requirement.status === 'EXPIRED') return requirement.status;
  if (requirement.fulfilledQuantity >= requirement.requestedQuantity) return 'FULFILLED';
  if (requirement.reservedQuantity > 0 || requirement.fulfilledQuantity > 0) {
    return 'PARTIALLY_FULFILLED';
  }
  return 'OPEN';
}

function assertListing(listing: SurplusListing): void {
  assertFiniteQuantity(listing.totalQuantity, 'listing.totalQuantity');
  assertFiniteQuantity(listing.availableQuantity, 'listing.availableQuantity', true);
  assertFiniteQuantity(listing.reservedQuantity, 'listing.reservedQuantity', true);
  assertFiniteQuantity(listing.handedOffQuantity, 'listing.handedOffQuantity', true);
  const sum = roundQuantity(
    listing.availableQuantity + listing.reservedQuantity + listing.handedOffQuantity,
  );
  if (!approximatelyEqual(sum, listing.totalQuantity)) {
    throw new InvariantViolationError(
      `Listing ${listing.listingId} quantities sum to ${sum}, expected ${listing.totalQuantity}`,
    );
  }
  if (listing.attributes.category !== listing.category) {
    throw new InvariantViolationError(`Listing ${listing.listingId} attributes do not match its category`);
  }
  if (!CATEGORY_UNITS[listing.category].allowedUnits.includes(listing.unit)) {
    throw new InvariantViolationError(`Listing ${listing.listingId} uses an invalid unit`);
  }
  if (listing.availableUntil < listing.availableFrom) {
    throw new InvariantViolationError(`Listing ${listing.listingId} has an invalid availability window`);
  }
  if (listing.status === 'COMPLETED' && !approximatelyEqual(listing.handedOffQuantity, listing.totalQuantity)) {
    throw new InvariantViolationError(`Listing ${listing.listingId} is completed before all quantity was handed off`);
  }
  if (listing.status === 'FULLY_RESERVED' && !approximatelyEqual(listing.availableQuantity, 0)) {
    throw new InvariantViolationError(`Listing ${listing.listingId} is fully reserved with quantity available`);
  }
}

function assertRequirement(requirement: Requirement): void {
  assertFiniteQuantity(requirement.requestedQuantity, 'requirement.requestedQuantity');
  assertFiniteQuantity(requirement.reservedQuantity, 'requirement.reservedQuantity', true);
  assertFiniteQuantity(requirement.fulfilledQuantity, 'requirement.fulfilledQuantity', true);
  const covered = roundQuantity(requirement.reservedQuantity + requirement.fulfilledQuantity);
  if (covered > requirement.requestedQuantity) {
    throw new InvariantViolationError(
      `Requirement ${requirement.requirementId} covers ${covered}, above ${requirement.requestedQuantity}`,
    );
  }
  if (requirement.acceptedConditions.length === 0) {
    throw new InvariantViolationError(`Requirement ${requirement.requirementId} accepts no conditions`);
  }
  if (requirement.radiusKm < 1 || requirement.radiusKm > 50) {
    throw new InvariantViolationError(`Requirement ${requirement.requirementId} has an invalid radius`);
  }
  if (requirement.constraints.category !== requirement.category) {
    throw new InvariantViolationError(`Requirement ${requirement.requirementId} constraints do not match its category`);
  }
  if (!CATEGORY_UNITS[requirement.category].allowedUnits.includes(requirement.unit)) {
    throw new InvariantViolationError(`Requirement ${requirement.requirementId} uses an invalid unit`);
  }
}

function assertReservation(reservation: Reservation): void {
  assertFiniteQuantity(reservation.reservedQuantity, 'reservation.reservedQuantity');
  if (reservation.buyerBusinessId === reservation.supplierBusinessId) {
    throw new InvariantViolationError(
      `Reservation ${reservation.reservationId} has identical buyer and supplier ${reservation.buyerBusinessId}`,
    );
  }
  if (!CATEGORY_UNITS[reservation.category].allowedUnits.includes(reservation.unit)) {
    throw new InvariantViolationError(`Reservation ${reservation.reservationId} uses an invalid unit`);
  }
}

function assertImpactMatchesReservation(record: ImpactRecord, reservation: Reservation): void {
  const sameRequirement = record.requirementId === reservation.requirementId;
  if (
    record.reservationId !== reservation.reservationId
    || record.listingId !== reservation.listingId
    || !sameRequirement
    || record.category !== reservation.category
    || !approximatelyEqual(record.quantityReused, reservation.reservedQuantity)
    || record.unit !== reservation.unit
    || record.supplierBusinessId !== reservation.supplierBusinessId
    || record.receiverBusinessId !== reservation.buyerBusinessId
  ) {
    throw new InvariantViolationError(
      `Impact record ${record.impactId} does not match reservation ${reservation.reservationId}`,
    );
  }
}

export class DynamoRepo implements Repo {
  readonly #doc: DynamoDBDocumentClient;
  readonly #tables: {
    businesses: string;
    listings: string;
    requirements: string;
    reservations: string;
    impact: string;
  };
  readonly #now: () => string;

  constructor(options: DynamoRepoOptions = {}) {
    const prefix = options.tablePrefix ?? process.env.TABLE_PREFIX ?? 'dse-';
    const region = options.region ?? process.env.AWS_REGION ?? 'ap-south-1';
    const client = options.client ?? new DynamoDBClient({ region });
    this.#doc = options.docClient ?? DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    });
    this.#tables = {
      businesses: `${prefix}businesses`,
      listings: `${prefix}listings`,
      requirements: `${prefix}requirements`,
      reservations: `${prefix}reservations`,
      impact: `${prefix}impact`,
    };
    this.#now = options.now ?? (() => new Date().toISOString());
  }

  // ── Businesses ─────────────────────────────────────────────────────────────
  async getBusiness(id: string): Promise<Business | null> {
    const res = await this.#doc.send(
      new GetCommand({
        TableName: this.#tables.businesses,
        Key: { businessId: id },
      }),
    );
    return res.Item ? (res.Item as Business) : null;
  }

  async listBusinesses(): Promise<Business[]> {
    const res = await this.#doc.send(
      new ScanCommand({
        TableName: this.#tables.businesses,
      }),
    );
    const items = (res.Items ?? []) as Business[];
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ── Listings ───────────────────────────────────────────────────────────────
  async createListing(listing: SurplusListing): Promise<SurplusListing> {
    assertListing(listing);
    // Derived attribute for gsi-category-city (docs/05 § 5)
    const item = {
      ...listing,
      categoryCity: `${listing.category}#${listing.city}`,
    };
    try {
      await this.#doc.send(
        new PutCommand({
          TableName: this.#tables.listings,
          Item: item,
          ConditionExpression: 'attribute_not_exists(listingId)',
        }),
      );
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        throw new EntityAlreadyExistsError('listing', listing.listingId);
      }
      throw err;
    }
    return clone(listing);
  }

  async getListing(id: string): Promise<SurplusListing | null> {
    const res = await this.#doc.send(
      new GetCommand({
        TableName: this.#tables.listings,
        Key: { listingId: id },
      }),
    );
    if (!res.Item) return null;
    const { categoryCity: _catCity, ...listing } = res.Item as SurplusListing & { categoryCity?: string };
    return listing as SurplusListing;
  }

  async queryListings(filter: ListingFilter): Promise<Page<SurplusListing>> {
    let rows: SurplusListing[] = [];

    if (filter.categories?.length === 1 && filter.city) {
      const categoryCity = `${filter.categories[0]}#${filter.city}`;
      const res = await this.#doc.send(
        new QueryCommand({
          TableName: this.#tables.listings,
          IndexName: 'gsi-category-city',
          KeyConditionExpression: 'categoryCity = :cc',
          ExpressionAttributeValues: { ':cc': categoryCity },
        }),
      );
      rows = (res.Items ?? []) as SurplusListing[];
    } else if (filter.businessId) {
      const res = await this.#doc.send(
        new QueryCommand({
          TableName: this.#tables.listings,
          IndexName: 'gsi-supplier',
          KeyConditionExpression: 'businessId = :bid',
          ExpressionAttributeValues: { ':bid': filter.businessId },
        }),
      );
      rows = (res.Items ?? []) as SurplusListing[];
    } else {
      const res = await this.#doc.send(
        new ScanCommand({
          TableName: this.#tables.listings,
        }),
      );
      rows = (res.Items ?? []) as SurplusListing[];
    }

    const query = filter.query?.trim().toLocaleLowerCase();
    rows = rows.filter((listing) => {
      if (filter.listingIds && !filter.listingIds.includes(listing.listingId)) return false;
      if (filter.businessId && listing.businessId !== filter.businessId) return false;
      if (filter.categories && !filter.categories.includes(listing.category)) return false;
      if (filter.conditions && !filter.conditions.includes(listing.condition)) return false;
      if (filter.statuses && !filter.statuses.includes(listing.status)) return false;
      if (filter.city && listing.city.toLocaleLowerCase() !== filter.city.toLocaleLowerCase()) return false;
      if (filter.minAvailableQuantity !== undefined && listing.availableQuantity < filter.minAvailableQuantity) return false;
      if (filter.maxAvailableQuantity !== undefined && listing.availableQuantity > filter.maxAvailableQuantity) return false;
      if (
        filter.availableOn
        && !(listing.availableFrom <= filter.availableOn && listing.availableUntil >= filter.availableOn)
      ) return false;
      if (
        filter.origin
        && filter.maxDistanceKm !== undefined
        && distanceKm(filter.origin, listing.location) > filter.maxDistanceKm
      ) return false;
      if (query) {
        const haystack = `${listing.title}\n${listing.description ?? ''}\n${listing.businessName}`.toLocaleLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      if (filter.sort === 'EXPIRING_SOON') {
        return a.availableUntil.localeCompare(b.availableUntil) || a.listingId.localeCompare(b.listingId);
      }
      if (filter.sort === 'QUANTITY_DESC') {
        return b.availableQuantity - a.availableQuantity || a.listingId.localeCompare(b.listingId);
      }
      if (filter.sort === 'DISTANCE_ASC' && filter.origin) {
        return distanceKm(filter.origin, a.location) - distanceKm(filter.origin, b.location)
          || a.listingId.localeCompare(b.listingId);
      }
      return b.createdAt.localeCompare(a.createdAt) || a.listingId.localeCompare(b.listingId);
    });

    return paginate(rows, filter.limit, filter.cursor);
  }

  async reserveQuantity(listingId: string, quantity: number): Promise<SurplusListing> {
    assertFiniteQuantity(quantity, 'quantity');
    const listing = await this.#requireListing(listingId);
    if (listing.status !== 'ACTIVE' && listing.status !== 'PARTIALLY_RESERVED') {
      throw new InvalidStateError('listing', listingId, listing.status, 'ACTIVE or PARTIALLY_RESERVED');
    }
    if (listing.availableQuantity < quantity) {
      throw new InsufficientQuantityError(listing.availableQuantity, quantity);
    }

    const newAvailable = roundQuantity(listing.availableQuantity - quantity);
    const newReserved = roundQuantity(listing.reservedQuantity + quantity);
    const now = this.#now();
    const tentative: SurplusListing = {
      ...listing,
      availableQuantity: newAvailable,
      reservedQuantity: newReserved,
      updatedAt: now,
    };
    const newStatus = deriveListingStatus(tentative);
    tentative.status = newStatus;
    assertListing(tentative);

    try {
      await this.#doc.send(
        new UpdateCommand({
          TableName: this.#tables.listings,
          Key: { listingId },
          UpdateExpression: 'SET availableQuantity = :newAvail, reservedQuantity = :newRes, updatedAt = :now, #s = :newStatus',
          ConditionExpression: 'availableQuantity = :currAvail AND #s = :currStatus',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':newAvail': newAvailable,
            ':newRes': newReserved,
            ':now': now,
            ':newStatus': newStatus,
            ':currAvail': listing.availableQuantity,
            ':currStatus': listing.status,
          },
        }),
      );
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        const latest = await this.#requireListing(listingId);
        if (latest.status !== 'ACTIVE' && latest.status !== 'PARTIALLY_RESERVED') {
          throw new InvalidStateError('listing', listingId, latest.status, 'ACTIVE or PARTIALLY_RESERVED');
        }
        throw new InsufficientQuantityError(latest.availableQuantity, quantity);
      }
      throw err;
    }

    return clone(tentative);
  }

  async releaseQuantity(listingId: string, quantity: number): Promise<SurplusListing> {
    assertFiniteQuantity(quantity, 'quantity');
    const listing = await this.#requireListing(listingId);
    if (listing.reservedQuantity < quantity) {
      throw new InsufficientQuantityError(listing.reservedQuantity, quantity);
    }

    const newAvailable = roundQuantity(listing.availableQuantity + quantity);
    const newReserved = roundQuantity(listing.reservedQuantity - quantity);
    const now = this.#now();
    const tentative: SurplusListing = {
      ...listing,
      availableQuantity: newAvailable,
      reservedQuantity: newReserved,
      updatedAt: now,
    };
    const newStatus = deriveListingStatus(tentative);
    tentative.status = newStatus;
    assertListing(tentative);

    await this.#doc.send(
      new UpdateCommand({
        TableName: this.#tables.listings,
        Key: { listingId },
        UpdateExpression: 'SET availableQuantity = :newAvail, reservedQuantity = :newRes, updatedAt = :now, #s = :newStatus',
        ConditionExpression: 'reservedQuantity >= :qty',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':newAvail': newAvailable,
          ':newRes': newReserved,
          ':now': now,
          ':newStatus': newStatus,
          ':qty': quantity,
        },
      }),
    );

    return clone(tentative);
  }

  async completeQuantity(listingId: string, quantity: number): Promise<SurplusListing> {
    assertFiniteQuantity(quantity, 'quantity');
    const listing = await this.#requireListing(listingId);
    if (listing.reservedQuantity < quantity) {
      throw new InsufficientQuantityError(listing.reservedQuantity, quantity);
    }

    const newReserved = roundQuantity(listing.reservedQuantity - quantity);
    const newHandedOff = roundQuantity(listing.handedOffQuantity + quantity);
    const now = this.#now();
    const tentative: SurplusListing = {
      ...listing,
      reservedQuantity: newReserved,
      handedOffQuantity: newHandedOff,
      updatedAt: now,
    };
    const newStatus = deriveListingStatus(tentative);
    tentative.status = newStatus;
    assertListing(tentative);

    await this.#doc.send(
      new UpdateCommand({
        TableName: this.#tables.listings,
        Key: { listingId },
        UpdateExpression: 'SET reservedQuantity = :newRes, handedOffQuantity = :newHo, updatedAt = :now, #s = :newStatus',
        ConditionExpression: 'reservedQuantity >= :qty',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':newRes': newReserved,
          ':newHo': newHandedOff,
          ':now': now,
          ':newStatus': newStatus,
          ':qty': quantity,
        },
      }),
    );

    return clone(tentative);
  }

  async updateListingStatus(listingId: string, status: ListingStatus): Promise<SurplusListing> {
    const listing = await this.#requireListing(listingId);
    const now = this.#now();
    const updated = { ...listing, status, updatedAt: now };
    assertListing(updated);

    await this.#doc.send(
      new UpdateCommand({
        TableName: this.#tables.listings,
        Key: { listingId },
        UpdateExpression: 'SET #s = :status, updatedAt = :now',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':status': status, ':now': now },
      }),
    );

    return clone(updated);
  }

  // ── Requirements ───────────────────────────────────────────────────────────
  async createRequirement(requirement: Requirement): Promise<Requirement> {
    assertRequirement(requirement);
    const item = {
      ...requirement,
      categoryCity: `${requirement.category}#${requirement.city}`,
    };
    try {
      await this.#doc.send(
        new PutCommand({
          TableName: this.#tables.requirements,
          Item: item,
          ConditionExpression: 'attribute_not_exists(requirementId)',
        }),
      );
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        throw new EntityAlreadyExistsError('requirement', requirement.requirementId);
      }
      throw err;
    }
    return clone(requirement);
  }

  async getRequirement(id: string): Promise<Requirement | null> {
    const res = await this.#doc.send(
      new GetCommand({
        TableName: this.#tables.requirements,
        Key: { requirementId: id },
      }),
    );
    if (!res.Item) return null;
    const { categoryCity: _catCity, ...req } = res.Item as Requirement & { categoryCity?: string };
    return req as Requirement;
  }

  async queryRequirements(filter: RequirementFilter): Promise<Page<Requirement>> {
    let rows: Requirement[] = [];

    if (filter.categories?.length === 1 && filter.city) {
      const categoryCity = `${filter.categories[0]}#${filter.city}`;
      const res = await this.#doc.send(
        new QueryCommand({
          TableName: this.#tables.requirements,
          IndexName: 'gsi-category-city',
          KeyConditionExpression: 'categoryCity = :cc',
          ExpressionAttributeValues: { ':cc': categoryCity },
        }),
      );
      rows = (res.Items ?? []) as Requirement[];
    } else if (filter.businessId) {
      const res = await this.#doc.send(
        new QueryCommand({
          TableName: this.#tables.requirements,
          IndexName: 'gsi-buyer',
          KeyConditionExpression: 'businessId = :bid',
          ExpressionAttributeValues: { ':bid': filter.businessId },
        }),
      );
      rows = (res.Items ?? []) as Requirement[];
    } else {
      const res = await this.#doc.send(
        new ScanCommand({
          TableName: this.#tables.requirements,
        }),
      );
      rows = (res.Items ?? []) as Requirement[];
    }

    rows = rows.filter((requirement) => {
      if (filter.requirementIds && !filter.requirementIds.includes(requirement.requirementId)) return false;
      if (filter.businessId && requirement.businessId !== filter.businessId) return false;
      if (filter.categories && !filter.categories.includes(requirement.category)) return false;
      if (filter.statuses && !filter.statuses.includes(requirement.status)) return false;
      if (filter.city && requirement.city.toLocaleLowerCase() !== filter.city.toLocaleLowerCase()) return false;
      return true;
    });

    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.requirementId.localeCompare(b.requirementId));
    return paginate(rows, filter.limit, filter.cursor);
  }

  async updateRequirementQuantities(id: string, delta: QuantityDelta): Promise<Requirement> {
    const requirement = await this.#requireRequirement(id);
    const newReserved = roundQuantity(requirement.reservedQuantity + (delta.reservedDelta ?? 0));
    const newFulfilled = roundQuantity(requirement.fulfilledQuantity + (delta.fulfilledDelta ?? 0));
    const now = this.#now();
    const updated: Requirement = {
      ...requirement,
      reservedQuantity: newReserved,
      fulfilledQuantity: newFulfilled,
      updatedAt: now,
    };
    updated.status = deriveRequirementStatus(updated);
    assertRequirement(updated);

    await this.#doc.send(
      new UpdateCommand({
        TableName: this.#tables.requirements,
        Key: { requirementId: id },
        UpdateExpression: 'SET reservedQuantity = :res, fulfilledQuantity = :ful, updatedAt = :now, #s = :status',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':res': newReserved,
          ':ful': newFulfilled,
          ':now': now,
          ':status': updated.status,
        },
      }),
    );

    return clone(updated);
  }

  // ── Reservations ───────────────────────────────────────────────────────────
  async createReservation(reservation: Reservation): Promise<Reservation> {
    assertReservation(reservation);
    try {
      await this.#doc.send(
        new PutCommand({
          TableName: this.#tables.reservations,
          Item: reservation,
          ConditionExpression: 'attribute_not_exists(reservationId)',
        }),
      );
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        throw new EntityAlreadyExistsError('reservation', reservation.reservationId);
      }
      throw err;
    }
    return clone(reservation);
  }

  async getReservation(id: string): Promise<Reservation | null> {
    const res = await this.#doc.send(
      new GetCommand({
        TableName: this.#tables.reservations,
        Key: { reservationId: id },
      }),
    );
    return res.Item ? (res.Item as Reservation) : null;
  }

  async queryReservations(filter: ReservationFilter): Promise<Page<Reservation>> {
    let rows: Reservation[] = [];

    if (filter.buyerBusinessId) {
      const res = await this.#doc.send(
        new QueryCommand({
          TableName: this.#tables.reservations,
          IndexName: 'gsi-buyer',
          KeyConditionExpression: 'buyerBusinessId = :bid',
          ExpressionAttributeValues: { ':bid': filter.buyerBusinessId },
        }),
      );
      rows = (res.Items ?? []) as Reservation[];
    } else if (filter.supplierBusinessId) {
      const res = await this.#doc.send(
        new QueryCommand({
          TableName: this.#tables.reservations,
          IndexName: 'gsi-supplier',
          KeyConditionExpression: 'supplierBusinessId = :sid',
          ExpressionAttributeValues: { ':sid': filter.supplierBusinessId },
        }),
      );
      rows = (res.Items ?? []) as Reservation[];
    } else if (filter.statuses?.length === 1) {
      const res = await this.#doc.send(
        new QueryCommand({
          TableName: this.#tables.reservations,
          IndexName: 'gsi-status',
          KeyConditionExpression: '#s = :st',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':st': filter.statuses[0] },
        }),
      );
      rows = (res.Items ?? []) as Reservation[];
    } else if (filter.businessId) {
      const [buyerRes, supplierRes] = await Promise.all([
        this.#doc.send(
          new QueryCommand({
            TableName: this.#tables.reservations,
            IndexName: 'gsi-buyer',
            KeyConditionExpression: 'buyerBusinessId = :bid',
            ExpressionAttributeValues: { ':bid': filter.businessId },
          }),
        ),
        this.#doc.send(
          new QueryCommand({
            TableName: this.#tables.reservations,
            IndexName: 'gsi-supplier',
            KeyConditionExpression: 'supplierBusinessId = :sid',
            ExpressionAttributeValues: { ':sid': filter.businessId },
          }),
        ),
      ]);
      const map = new Map<string, Reservation>();
      for (const item of (buyerRes.Items ?? []) as Reservation[]) map.set(item.reservationId, item);
      for (const item of (supplierRes.Items ?? []) as Reservation[]) map.set(item.reservationId, item);
      rows = [...map.values()];
    } else {
      const res = await this.#doc.send(
        new ScanCommand({
          TableName: this.#tables.reservations,
        }),
      );
      rows = (res.Items ?? []) as Reservation[];
    }

    rows = rows.filter((reservation) => {
      if (filter.reservationIds && !filter.reservationIds.includes(reservation.reservationId)) return false;
      if (filter.buyerBusinessId && reservation.buyerBusinessId !== filter.buyerBusinessId) return false;
      if (filter.supplierBusinessId && reservation.supplierBusinessId !== filter.supplierBusinessId) return false;
      if (
        filter.businessId
        && reservation.buyerBusinessId !== filter.businessId
        && reservation.supplierBusinessId !== filter.businessId
      ) return false;
      if (filter.listingId && reservation.listingId !== filter.listingId) return false;
      if (filter.requirementId && reservation.requirementId !== filter.requirementId) return false;
      if (filter.statuses && !filter.statuses.includes(reservation.status)) return false;
      return true;
    });

    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.reservationId.localeCompare(b.reservationId));
    return paginate(rows, filter.limit, filter.cursor);
  }

  async transitionReservation(
    id: string,
    from: ReservationStatus,
    to: ReservationStatus,
    patch: Partial<Reservation> = {},
  ): Promise<Reservation> {
    const reservation = await this.#requireReservation(id);
    if (reservation.status !== from) {
      throw new InvalidStateError('reservation', id, reservation.status, from);
    }
    if (patch.reservationId !== undefined && patch.reservationId !== id) {
      throw new InvariantViolationError('A reservation transition cannot change its id');
    }
    const updated: Reservation = { ...reservation, ...clone(patch), reservationId: id, status: to };
    assertReservation(updated);

    try {
      await this.#doc.send(
        new PutCommand({
          TableName: this.#tables.reservations,
          Item: updated,
          ConditionExpression: '#s = :from',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: { ':from': from },
        }),
      );
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        const latest = await this.#requireReservation(id);
        throw new InvalidStateError('reservation', id, latest.status, from);
      }
      throw err;
    }

    return clone(updated);
  }

  // ── Impact ─────────────────────────────────────────────────────────────────
  async createImpactRecord(record: ImpactRecord): Promise<ImpactRecord> {
    const existing = await this.queryImpactRecords({ reservationId: record.reservationId });
    if (existing.length > 0) {
      throw new DuplicateImpactRecordError(record.reservationId);
    }
    assertFiniteQuantity(record.quantityReused, 'impactRecord.quantityReused');
    const item = {
      ...record,
      // Constant partition key for gsi-completed (docs/05 § 5). At scale would shard by month.
      impactPartition: 'ALL',
    };
    try {
      await this.#doc.send(
        new PutCommand({
          TableName: this.#tables.impact,
          Item: item,
          ConditionExpression: 'attribute_not_exists(impactId)',
        }),
      );
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
        throw new EntityAlreadyExistsError('impact', record.impactId);
      }
      throw err;
    }
    return clone(record);
  }

  async queryImpactRecords(filter: ImpactFilter): Promise<ImpactRecord[]> {
    let rows: ImpactRecord[] = [];
    try {
      const res = await this.#doc.send(
        new QueryCommand({
          TableName: this.#tables.impact,
          IndexName: 'gsi-completed',
          KeyConditionExpression: 'impactPartition = :all',
          ExpressionAttributeValues: { ':all': 'ALL' },
        }),
      );
      rows = (res.Items ?? []) as ImpactRecord[];
    } catch {
      // Fallback to scan if index not yet hydrated
      const res = await this.#doc.send(
        new ScanCommand({
          TableName: this.#tables.impact,
        }),
      );
      rows = (res.Items ?? []) as ImpactRecord[];
    }

    return rows
      .filter((record) => {
        if (filter.businessId && record.supplierBusinessId !== filter.businessId && record.receiverBusinessId !== filter.businessId) return false;
        if (filter.reservationId && record.reservationId !== filter.reservationId) return false;
        if (filter.categories && !filter.categories.includes(record.category)) return false;
        if (filter.from && record.completedAt < filter.from) return false;
        if (filter.to && record.completedAt > filter.to) return false;
        return true;
      })
      .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.impactId.localeCompare(b.impactId));
  }

  // ── Atomic Handoff ─────────────────────────────────────────────────────────
  async commitHandoff(input: HandoffCommit): Promise<HandoffResult> {
    const reservation = await this.#requireReservation(input.reservationId);
    if (reservation.status !== 'RESERVED') {
      throw new InvalidStateError('reservation', reservation.reservationId, reservation.status, 'RESERVED');
    }

    const existingImpact = await this.queryImpactRecords({ reservationId: reservation.reservationId });
    if (existingImpact.length > 0) {
      throw new DuplicateImpactRecordError(reservation.reservationId);
    }

    const impactCheck = await this.#doc.send(
      new GetCommand({
        TableName: this.#tables.impact,
        Key: { impactId: input.impactRecord.impactId },
      }),
    );
    if (impactCheck.Item) {
      throw new EntityAlreadyExistsError('impact', input.impactRecord.impactId);
    }

    assertImpactMatchesReservation(input.impactRecord, reservation);

    const listing = await this.#requireListing(reservation.listingId);
    if (listing.reservedQuantity < reservation.reservedQuantity) {
      throw new InvariantViolationError(`Listing ${listing.listingId} does not hold the reservation quantity`);
    }

    const requirement = reservation.requirementId
      ? await this.#requireRequirement(reservation.requirementId)
      : null;
    if (requirement && requirement.reservedQuantity < reservation.reservedQuantity) {
      throw new InvariantViolationError(
        `Requirement ${requirement.requirementId} does not hold the reservation quantity`,
      );
    }

    const nextReservation: Reservation = {
      ...reservation,
      status: 'HANDED_OFF',
      handedOffAt: input.handedOffAt,
    };
    const nextListing: SurplusListing = {
      ...listing,
      reservedQuantity: roundQuantity(listing.reservedQuantity - reservation.reservedQuantity),
      handedOffQuantity: roundQuantity(listing.handedOffQuantity + reservation.reservedQuantity),
      updatedAt: input.handedOffAt,
    };
    nextListing.status = deriveListingStatus(nextListing);

    const nextRequirement: Requirement | null = requirement
      ? {
          ...requirement,
          reservedQuantity: roundQuantity(requirement.reservedQuantity - reservation.reservedQuantity),
          fulfilledQuantity: roundQuantity(requirement.fulfilledQuantity + reservation.reservedQuantity),
          updatedAt: input.handedOffAt,
        }
      : null;
    if (nextRequirement) nextRequirement.status = deriveRequirementStatus(nextRequirement);

    assertReservation(nextReservation);
    assertListing(nextListing);
    if (nextRequirement) assertRequirement(nextRequirement);

    const transactItems: any[] = [
      // 1. Update Reservation
      {
        Update: {
          TableName: this.#tables.reservations,
          Key: { reservationId: nextReservation.reservationId },
          UpdateExpression: 'SET #s = :handedOff, handedOffAt = :at',
          ConditionExpression: '#s = :reserved',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':handedOff': 'HANDED_OFF',
            ':reserved': 'RESERVED',
            ':at': input.handedOffAt,
          },
        },
      },
      // 2. Update Listing
      {
        Update: {
          TableName: this.#tables.listings,
          Key: { listingId: nextListing.listingId },
          UpdateExpression: 'SET reservedQuantity = :res, handedOffQuantity = :ho, updatedAt = :at, #s = :st',
          ConditionExpression: 'reservedQuantity >= :qty',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':res': nextListing.reservedQuantity,
            ':ho': nextListing.handedOffQuantity,
            ':at': input.handedOffAt,
            ':st': nextListing.status,
            ':qty': reservation.reservedQuantity,
          },
        },
      },
      // 3. Put ImpactRecord
      {
        Put: {
          TableName: this.#tables.impact,
          Item: {
            ...input.impactRecord,
            impactPartition: 'ALL',
          },
          ConditionExpression: 'attribute_not_exists(impactId)',
        },
      },
    ];

    // 4. Update Requirement if applicable
    if (nextRequirement) {
      transactItems.push({
        Update: {
          TableName: this.#tables.requirements,
          Key: { requirementId: nextRequirement.requirementId },
          UpdateExpression: 'SET reservedQuantity = :res, fulfilledQuantity = :ful, updatedAt = :at, #s = :st',
          ConditionExpression: 'reservedQuantity >= :qty',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':res': nextRequirement.reservedQuantity,
            ':ful': nextRequirement.fulfilledQuantity,
            ':at': input.handedOffAt,
            ':st': nextRequirement.status,
            ':qty': reservation.reservedQuantity,
          },
        },
      });
    }

    try {
      await this.#doc.send(new TransactWriteCommand({ TransactItems: transactItems }));
    } catch (err: unknown) {
      if ((err as { name?: string }).name === 'TransactionCanceledException') {
        const checkRes = await this.#requireReservation(input.reservationId);
        if (checkRes.status !== 'RESERVED') {
          throw new InvalidStateError('reservation', checkRes.reservationId, checkRes.status, 'RESERVED');
        }
        const checkImp = await this.queryImpactRecords({ reservationId: reservation.reservationId });
        if (checkImp.length > 0) {
          throw new DuplicateImpactRecordError(reservation.reservationId);
        }
        throw new InvariantViolationError('TransactWrite failed due to concurrency conflict');
      }
      throw err;
    }

    return clone({
      reservation: nextReservation,
      listing: nextListing,
      requirement: nextRequirement,
      impactRecord: input.impactRecord,
    });
  }

  // ── Private helpers ────────────────────────────────────────────────────────
  async #requireListing(id: string): Promise<SurplusListing> {
    const listing = await this.getListing(id);
    if (!listing) throw new EntityNotFoundError('listing', id);
    return listing;
  }

  async #requireRequirement(id: string): Promise<Requirement> {
    const requirement = await this.getRequirement(id);
    if (!requirement) throw new EntityNotFoundError('requirement', id);
    return requirement;
  }

  async #requireReservation(id: string): Promise<Reservation> {
    const reservation = await this.getReservation(id);
    if (!reservation) throw new EntityNotFoundError('reservation', id);
    return reservation;
  }
}

export function createDynamoRepo(options?: DynamoRepoOptions): DynamoRepo {
  return new DynamoRepo(options);
}
