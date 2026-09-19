/**
 * In-memory Repo implementation used by local development and unit tests.
 *
 * It deliberately enforces the same conditional-write and transaction
 * boundaries expected from DynamoDB. Every value crossing the boundary is
 * cloned so callers cannot mutate stored state without going through Repo.
 */
import { readFileSync, existsSync } from 'node:fs';
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

export interface MemorySeed {
  businesses?: Business[];
  listings?: SurplusListing[];
  requirements?: Requirement[];
  reservations?: Reservation[];
  impactRecords?: ImpactRecord[];
}

export interface MemoryRepoOptions {
  seed?: MemorySeed;
  /** Injectable clock for deterministic tests. */
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

function loadJson<T>(relativePath: string): T {
  const fileName = relativePath.split('/').pop()!;
  const localUrl = new URL(relativePath, import.meta.url);
  if (existsSync(localUrl)) return JSON.parse(readFileSync(localUrl, 'utf8')) as T;
  const bundleUrl = new URL(`./fixtures/${fileName}`, import.meta.url);
  if (existsSync(bundleUrl)) return JSON.parse(readFileSync(bundleUrl, 'utf8')) as T;
  return JSON.parse(readFileSync(localUrl, 'utf8')) as T;
}

export function loadFixtureSeed(): MemorySeed {
  return {
    businesses: loadJson<Business[]>('../../../fixtures/businesses.json'),
    listings: loadJson<SurplusListing[]>('../../../fixtures/listings.json'),
    requirements: loadJson<Requirement[]>('../../../fixtures/requirements.json'),
    reservations: [],
    impactRecords: [],
  };
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
  if (
    listing.status === 'ACTIVE'
    && (listing.reservedQuantity > 0 || listing.handedOffQuantity > 0)
  ) {
    throw new InvariantViolationError(`Listing ${listing.listingId} is active with allocated quantity`);
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
}

function deriveListingStatus(listing: SurplusListing): ListingStatus {
  if (listing.status === 'WITHDRAWN') return 'WITHDRAWN';
  if (approximatelyEqual(listing.handedOffQuantity, listing.totalQuantity)) return 'COMPLETED';
  // EXPIRED is an explicit time-based state set by the sweeper. Releasing an
  // expired reservation must not accidentally make the listing active again.
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

export class MemoryRepo implements Repo {
  readonly #businesses = new Map<string, Business>();
  readonly #listings = new Map<string, SurplusListing>();
  readonly #requirements = new Map<string, Requirement>();
  readonly #reservations = new Map<string, Reservation>();
  readonly #impactRecords = new Map<string, ImpactRecord>();
  readonly #now: () => string;

  constructor(options: MemoryRepoOptions = {}) {
    this.#now = options.now ?? (() => new Date().toISOString());
    this.reset(options.seed ?? loadFixtureSeed());
  }

  /** Replace all state. Intended for local reseeding and isolated tests. */
  reset(seed: MemorySeed = loadFixtureSeed()): void {
    this.#businesses.clear();
    this.#listings.clear();
    this.#requirements.clear();
    this.#reservations.clear();
    this.#impactRecords.clear();

    for (const business of seed.businesses ?? []) {
      if (this.#businesses.has(business.businessId)) {
        throw new EntityAlreadyExistsError('business', business.businessId);
      }
      this.#businesses.set(business.businessId, clone(business));
    }
    for (const listing of seed.listings ?? []) this.#insertListing(listing);
    for (const requirement of seed.requirements ?? []) this.#insertRequirement(requirement);
    for (const reservation of seed.reservations ?? []) this.#insertReservation(reservation);
    for (const impact of seed.impactRecords ?? []) this.#insertImpactRecord(impact);
  }

  async getBusiness(id: string): Promise<Business | null> {
    const business = this.#businesses.get(id);
    return business ? clone(business) : null;
  }

  async listBusinesses(): Promise<Business[]> {
    return clone([...this.#businesses.values()].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async createListing(listing: SurplusListing): Promise<SurplusListing> {
    this.#insertListing(listing);
    return clone(listing);
  }

  async getListing(id: string): Promise<SurplusListing | null> {
    const listing = this.#listings.get(id);
    return listing ? clone(listing) : null;
  }

  async queryListings(filter: ListingFilter): Promise<Page<SurplusListing>> {
    const query = filter.query?.trim().toLocaleLowerCase();
    let rows = [...this.#listings.values()].filter((listing) => {
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

    rows = rows.sort((a, b) => {
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
    const listing = this.#requireListing(listingId);
    if (listing.status !== 'ACTIVE' && listing.status !== 'PARTIALLY_RESERVED') {
      throw new InvalidStateError('listing', listingId, listing.status, 'ACTIVE or PARTIALLY_RESERVED');
    }
    if (listing.availableQuantity < quantity) {
      throw new InsufficientQuantityError(listing.availableQuantity, quantity);
    }
    const updated: SurplusListing = {
      ...listing,
      availableQuantity: roundQuantity(listing.availableQuantity - quantity),
      reservedQuantity: roundQuantity(listing.reservedQuantity + quantity),
      updatedAt: this.#now(),
    };
    updated.status = deriveListingStatus(updated);
    assertListing(updated);
    this.#listings.set(listingId, updated);
    return clone(updated);
  }

  async releaseQuantity(listingId: string, quantity: number): Promise<SurplusListing> {
    assertFiniteQuantity(quantity, 'quantity');
    const listing = this.#requireListing(listingId);
    if (listing.reservedQuantity < quantity) {
      throw new InsufficientQuantityError(listing.reservedQuantity, quantity);
    }
    const updated: SurplusListing = {
      ...listing,
      availableQuantity: roundQuantity(listing.availableQuantity + quantity),
      reservedQuantity: roundQuantity(listing.reservedQuantity - quantity),
      updatedAt: this.#now(),
    };
    updated.status = deriveListingStatus(updated);
    assertListing(updated);
    this.#listings.set(listingId, updated);
    return clone(updated);
  }

  async completeQuantity(listingId: string, quantity: number): Promise<SurplusListing> {
    assertFiniteQuantity(quantity, 'quantity');
    const listing = this.#requireListing(listingId);
    if (listing.reservedQuantity < quantity) {
      throw new InsufficientQuantityError(listing.reservedQuantity, quantity);
    }
    const updated: SurplusListing = {
      ...listing,
      reservedQuantity: roundQuantity(listing.reservedQuantity - quantity),
      handedOffQuantity: roundQuantity(listing.handedOffQuantity + quantity),
      updatedAt: this.#now(),
    };
    updated.status = deriveListingStatus(updated);
    assertListing(updated);
    this.#listings.set(listingId, updated);
    return clone(updated);
  }

  async updateListingStatus(listingId: string, status: ListingStatus): Promise<SurplusListing> {
    const listing = this.#requireListing(listingId);
    const updated = { ...listing, status, updatedAt: this.#now() };
    assertListing(updated);
    this.#listings.set(listingId, updated);
    return clone(updated);
  }

  async createRequirement(requirement: Requirement): Promise<Requirement> {
    this.#insertRequirement(requirement);
    return clone(requirement);
  }

  async getRequirement(id: string): Promise<Requirement | null> {
    const requirement = this.#requirements.get(id);
    return requirement ? clone(requirement) : null;
  }

  async queryRequirements(filter: RequirementFilter): Promise<Page<Requirement>> {
    const rows = [...this.#requirements.values()]
      .filter((requirement) => {
        if (filter.requirementIds && !filter.requirementIds.includes(requirement.requirementId)) return false;
        if (filter.businessId && requirement.businessId !== filter.businessId) return false;
        if (filter.categories && !filter.categories.includes(requirement.category)) return false;
        if (filter.statuses && !filter.statuses.includes(requirement.status)) return false;
        if (filter.city && requirement.city.toLocaleLowerCase() !== filter.city.toLocaleLowerCase()) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.requirementId.localeCompare(b.requirementId));
    return paginate(rows, filter.limit, filter.cursor);
  }

  async updateRequirementQuantities(id: string, delta: QuantityDelta): Promise<Requirement> {
    const requirement = this.#requireRequirement(id);
    const updated: Requirement = {
      ...requirement,
      reservedQuantity: roundQuantity(requirement.reservedQuantity + (delta.reservedDelta ?? 0)),
      fulfilledQuantity: roundQuantity(requirement.fulfilledQuantity + (delta.fulfilledDelta ?? 0)),
      updatedAt: this.#now(),
    };
    updated.status = deriveRequirementStatus(updated);
    assertRequirement(updated);
    this.#requirements.set(id, updated);
    return clone(updated);
  }

  async createReservation(reservation: Reservation): Promise<Reservation> {
    this.#insertReservation(reservation);
    return clone(reservation);
  }

  async getReservation(id: string): Promise<Reservation | null> {
    const reservation = this.#reservations.get(id);
    return reservation ? clone(reservation) : null;
  }

  async queryReservations(filter: ReservationFilter): Promise<Page<Reservation>> {
    const rows = [...this.#reservations.values()]
      .filter((reservation) => {
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
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.reservationId.localeCompare(b.reservationId));
    return paginate(rows, filter.limit, filter.cursor);
  }

  async transitionReservation(
    id: string,
    from: ReservationStatus,
    to: ReservationStatus,
    patch: Partial<Reservation> = {},
  ): Promise<Reservation> {
    const reservation = this.#requireReservation(id);
    if (reservation.status !== from) {
      throw new InvalidStateError('reservation', id, reservation.status, from);
    }
    if (patch.reservationId !== undefined && patch.reservationId !== id) {
      throw new InvariantViolationError('A reservation transition cannot change its id');
    }
    const updated: Reservation = { ...reservation, ...clone(patch), reservationId: id, status: to };
    assertReservation(updated);
    this.#reservations.set(id, updated);
    return clone(updated);
  }

  async createImpactRecord(record: ImpactRecord): Promise<ImpactRecord> {
    this.#insertImpactRecord(record);
    return clone(record);
  }

  async queryImpactRecords(filter: ImpactFilter): Promise<ImpactRecord[]> {
    return clone(
      [...this.#impactRecords.values()]
        .filter((record) => {
          if (filter.businessId && record.supplierBusinessId !== filter.businessId && record.receiverBusinessId !== filter.businessId) return false;
          if (filter.reservationId && record.reservationId !== filter.reservationId) return false;
          if (filter.categories && !filter.categories.includes(record.category)) return false;
          if (filter.from && record.completedAt < filter.from) return false;
          if (filter.to && record.completedAt > filter.to) return false;
          return true;
        })
        .sort((a, b) => a.completedAt.localeCompare(b.completedAt) || a.impactId.localeCompare(b.impactId)),
    );
  }

  async commitHandoff(input: HandoffCommit): Promise<HandoffResult> {
    const reservation = this.#requireReservation(input.reservationId);
    if (reservation.status !== 'RESERVED') {
      throw new InvalidStateError('reservation', reservation.reservationId, reservation.status, 'RESERVED');
    }
    if ([...this.#impactRecords.values()].some((row) => row.reservationId === reservation.reservationId)) {
      throw new DuplicateImpactRecordError(reservation.reservationId);
    }
    if (this.#impactRecords.has(input.impactRecord.impactId)) {
      throw new EntityAlreadyExistsError('impact', input.impactRecord.impactId);
    }
    assertImpactMatchesReservation(input.impactRecord, reservation);

    const listing = this.#requireListing(reservation.listingId);
    if (listing.reservedQuantity < reservation.reservedQuantity) {
      throw new InvariantViolationError(`Listing ${listing.listingId} does not hold the reservation quantity`);
    }
    const requirement = reservation.requirementId
      ? this.#requireRequirement(reservation.requirementId)
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

    // All validation has completed; the following writes form the in-memory transaction.
    this.#reservations.set(nextReservation.reservationId, nextReservation);
    this.#listings.set(nextListing.listingId, nextListing);
    if (nextRequirement) this.#requirements.set(nextRequirement.requirementId, nextRequirement);
    this.#impactRecords.set(input.impactRecord.impactId, clone(input.impactRecord));

    return clone({
      reservation: nextReservation,
      listing: nextListing,
      requirement: nextRequirement,
      impactRecord: input.impactRecord,
    });
  }

  #insertListing(listing: SurplusListing): void {
    if (this.#listings.has(listing.listingId)) {
      throw new EntityAlreadyExistsError('listing', listing.listingId);
    }
    assertListing(listing);
    this.#listings.set(listing.listingId, clone(listing));
  }

  #insertRequirement(requirement: Requirement): void {
    if (this.#requirements.has(requirement.requirementId)) {
      throw new EntityAlreadyExistsError('requirement', requirement.requirementId);
    }
    assertRequirement(requirement);
    this.#requirements.set(requirement.requirementId, clone(requirement));
  }

  #insertReservation(reservation: Reservation): void {
    if (this.#reservations.has(reservation.reservationId)) {
      throw new EntityAlreadyExistsError('reservation', reservation.reservationId);
    }
    assertReservation(reservation);
    this.#reservations.set(reservation.reservationId, clone(reservation));
  }

  #insertImpactRecord(record: ImpactRecord): void {
    if (this.#impactRecords.has(record.impactId)) {
      throw new EntityAlreadyExistsError('impact', record.impactId);
    }
    if ([...this.#impactRecords.values()].some((row) => row.reservationId === record.reservationId)) {
      throw new DuplicateImpactRecordError(record.reservationId);
    }
    assertFiniteQuantity(record.quantityReused, 'impactRecord.quantityReused');
    this.#impactRecords.set(record.impactId, clone(record));
  }

  #requireListing(id: string): SurplusListing {
    const listing = this.#listings.get(id);
    if (!listing) throw new EntityNotFoundError('listing', id);
    return listing;
  }

  #requireRequirement(id: string): Requirement {
    const requirement = this.#requirements.get(id);
    if (!requirement) throw new EntityNotFoundError('requirement', id);
    return requirement;
  }

  #requireReservation(id: string): Reservation {
    const reservation = this.#reservations.get(id);
    if (!reservation) throw new EntityNotFoundError('reservation', id);
    return reservation;
  }
}

export function createMemoryRepo(options?: MemoryRepoOptions): MemoryRepo {
  return new MemoryRepo(options);
}
