import { randomUUID } from 'node:crypto';
import type {
  HandoffResponse,
  ImpactRecord,
  MatchCheck,
  Reservation,
  ReservationEnvelope,
  ReservationsResponse,
  ReservationRole,
  ReservationStatus,
  Requirement,
  SurplusListing,
} from '@dse/shared';
import { RESERVATION_ROLES, RESERVATION_STATUS } from '@dse/shared';
import { findMatches } from '../domain/matching.js';
import { remainingRequirementQuantity } from '../domain/quantity.js';
import { ApiRequestError } from '../errors.js';
import type { ReservationFilter } from '../repo/index.js';
import { getRepo } from '../repo/runtime.js';
import type { Handler, RouterRequest } from '../router.js';
import { enumValue, numberInRange } from '../validation/common.js';
import { validateCreateReservation, validateHandoff } from '../validation/reservations.js';
import { queryValue, queryValues, requireActingBusiness } from './common.js';

const DEFAULT_TTL_MINUTES = 2880;

function reservationTtlMinutes(): number {
  const configured = Number(process.env.RESERVATION_TTL_MINUTES ?? DEFAULT_TTL_MINUTES);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_TTL_MINUTES;
}

function expiresAt(createdAt: string): string {
  return new Date(
    Date.parse(createdAt) + reservationTtlMinutes() * 60_000,
  ).toISOString();
}

function unavailableListing(listing: SurplusListing): never {
  throw new ApiRequestError(
    409,
    'LISTING_NOT_AVAILABLE',
    `Listing ${listing.listingId} is ${listing.status.toLocaleLowerCase()} and cannot be reserved.`,
  );
}

function invalidRequirement(requirement: Requirement): never {
  throw new ApiRequestError(
    409,
    'INVALID_STATE',
    `Requirement ${requirement.requirementId} is ${requirement.status.toLocaleLowerCase()} and cannot be reserved.`,
  );
}

function parseStatuses(req: RouterRequest): ReservationStatus[] | undefined {
  return queryValues(req, 'status')?.map((status) => (
    enumValue(status, 'status', RESERVATION_STATUS)
  ));
}

function parseLimit(req: RouterRequest): number | undefined {
  const raw = queryValue(req, 'limit');
  if (raw === undefined) return undefined;
  if (raw.trim() === '' || !Number.isFinite(Number(raw))) {
    throw new ApiRequestError(400, 'VALIDATION_FAILED', 'limit must be a number.', 'limit');
  }
  return numberInRange(Number(raw), 'limit', 1, 100, { integer: true });
}

export const listReservations: Handler = async (req) => {
  const business = await requireActingBusiness(req);
  const role = enumValue(
    queryValue(req, 'role') ?? 'ALL',
    'role',
    RESERVATION_ROLES,
  ) as ReservationRole;
  const filter: ReservationFilter = {
    statuses: parseStatuses(req),
    limit: parseLimit(req),
    cursor: queryValue(req, 'cursor'),
  };
  if (role === 'BUYER') filter.buyerBusinessId = business.businessId;
  else if (role === 'SUPPLIER') filter.supplierBusinessId = business.businessId;
  else filter.businessId = business.businessId;

  const page = await getRepo().queryReservations(filter);
  const body: ReservationsResponse = {
    items: page.items,
    meta: {
      count: page.items.length,
      nextCursor: page.nextCursor,
      truncated: page.truncated,
    },
  };
  return { status: 200, body };
};

export const createReservation: Handler = async (req) => {
  const buyer = await requireActingBusiness(req);
  const input = validateCreateReservation(req.body);
  const repo = getRepo();
  const listing = await repo.getListing(input.listingId);
  if (!listing) {
    throw new ApiRequestError(
      404,
      'LISTING_NOT_FOUND',
      `Listing ${input.listingId} was not found.`,
    );
  }
  if (listing.businessId === buyer.businessId) {
    throw new ApiRequestError(
      409,
      'SELF_RESERVATION',
      'A business cannot reserve its own listing.',
    );
  }
  if (listing.status !== 'ACTIVE' && listing.status !== 'PARTIALLY_RESERVED') {
    unavailableListing(listing);
  }

  let requirement: Requirement | null = null;
  let matchReasons: MatchCheck[] = [];
  if (input.requirementId !== undefined) {
    requirement = await repo.getRequirement(input.requirementId);
    if (!requirement) {
      throw new ApiRequestError(
        404,
        'REQUIREMENT_NOT_FOUND',
        `Requirement ${input.requirementId} was not found.`,
      );
    }
    if (requirement.businessId !== buyer.businessId) {
      throw new ApiRequestError(
        403,
        'NOT_YOUR_REQUIREMENT',
        'Only the business that posted this requirement can reserve against it.',
      );
    }
    if (
      requirement.status === 'FULFILLED'
      || requirement.status === 'CANCELLED'
      || requirement.status === 'EXPIRED'
    ) invalidRequirement(requirement);

    const remaining = remainingRequirementQuantity(requirement);
    if (input.reservedQuantity > remaining) {
      throw new ApiRequestError(
        422,
        'EXCEEDS_REQUIREMENT',
        `Only ${remaining} ${requirement.unit.toLocaleLowerCase()} remains on this requirement.`,
        null,
        { remainingQuantity: remaining },
      );
    }

    const match = findMatches({
      requirement,
      listings: [listing],
      today: new Date().toISOString().slice(0, 10),
      includeNearMisses: true,
    })[0];
    if (!match) {
      throw new ApiRequestError(
        409,
        'NOT_COMPATIBLE',
        'The listing does not match this requirement.',
        null,
        { failedChecks: ['CATEGORY_COMPATIBLE'] },
      );
    }
    const failedChecks = match.checks
      .filter((check) => !check.passed)
      .map((check) => check.code);
    if (failedChecks.length > 0) {
      throw new ApiRequestError(
        409,
        'NOT_COMPATIBLE',
        'The listing no longer satisfies this requirement.',
        null,
        { failedChecks },
      );
    }
    matchReasons = structuredClone(match.checks);
  }

  if (input.reservedQuantity > listing.availableQuantity) {
    throw new ApiRequestError(
      409,
      'INSUFFICIENT_QUANTITY',
      `Only ${listing.availableQuantity} ${listing.unit.toLocaleLowerCase()} is available.`,
      null,
      { availableQuantity: listing.availableQuantity },
    );
  }

  const createdAt = new Date().toISOString();
  const reservation: Reservation = {
    reservationId: `rsv_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    listingId: listing.listingId,
    supplierBusinessId: listing.businessId,
    supplierBusinessName: listing.businessName,
    buyerBusinessId: buyer.businessId,
    buyerBusinessName: buyer.name,
    category: listing.category,
    reservedQuantity: input.reservedQuantity,
    unit: listing.unit,
    matchReasons,
    handoffMode: listing.handoffMode,
    status: 'RESERVED',
    createdAt,
    expiresAt: expiresAt(createdAt),
  };
  if (requirement) reservation.requirementId = requirement.requirementId;

  let updatedListing: SurplusListing | null = null;
  let updatedRequirement: Requirement | null = requirement;
  let requirementWasUpdated = false;
  try {
    // The repository implementation performs the race-safe conditional write.
    updatedListing = await repo.reserveQuantity(listing.listingId, input.reservedQuantity);
    if (requirement) {
      updatedRequirement = await repo.updateRequirementQuantities(requirement.requirementId, {
        reservedDelta: input.reservedQuantity,
      });
      requirementWasUpdated = true;
    }
    const createdReservation = await repo.createReservation(reservation);
    const body: ReservationEnvelope = {
      reservation: createdReservation,
      listing: updatedListing,
      requirement: updatedRequirement,
    };
    return { status: 201, body };
  } catch (error) {
    // The listing decrement is the only concurrent operation. Compensate if a
    // later write fails so local/Dynamo behavior does not leave orphaned holds.
    if (updatedListing) {
      await repo.releaseQuantity(listing.listingId, input.reservedQuantity).catch(() => undefined);
    }
    if (requirement && requirementWasUpdated) {
      await repo.updateRequirementQuantities(requirement.requirementId, {
        reservedDelta: -input.reservedQuantity,
      }).catch(() => undefined);
    }
    throw error;
  }
};

export const handoffReservation: Handler = async (req, params) => {
  const supplier = await requireActingBusiness(req);
  validateHandoff(req.body);
  const reservationId = params.reservationId!;
  const repo = getRepo();
  const reservation = await repo.getReservation(reservationId);
  if (!reservation) {
    throw new ApiRequestError(
      404,
      'RESERVATION_NOT_FOUND',
      `Reservation ${reservationId} was not found.`,
    );
  }
  if (reservation.supplierBusinessId !== supplier.businessId) {
    throw new ApiRequestError(
      403,
      'NOT_YOUR_RESERVATION',
      'Only the supplier can confirm this handoff.',
    );
  }
  if (reservation.status !== 'RESERVED') {
    throw new ApiRequestError(
      409,
      'INVALID_STATE',
      `Reservation ${reservationId} is ${reservation.status.toLocaleLowerCase()} and cannot be handed off.`,
    );
  }

  const listing = await repo.getListing(reservation.listingId);
  if (!listing) {
    throw new ApiRequestError(
      404,
      'LISTING_NOT_FOUND',
      `Listing ${reservation.listingId} was not found.`,
    );
  }

  const handedOffAt = new Date().toISOString();
  const impactRecord: ImpactRecord = {
    impactId: `imp_${randomUUID().replaceAll('-', '').slice(0, 16)}`,
    reservationId: reservation.reservationId,
    listingId: reservation.listingId,
    category: reservation.category,
    quantityReused: reservation.reservedQuantity,
    unit: reservation.unit,
    supplierBusinessId: reservation.supplierBusinessId,
    receiverBusinessId: reservation.buyerBusinessId,
    completedAt: handedOffAt,
  };
  if (reservation.requirementId !== undefined) {
    impactRecord.requirementId = reservation.requirementId;
  }
  if (listing.referencePriceInr !== undefined) {
    impactRecord.estimatedProcurementAvoidedInr = Math.round(
      listing.referencePriceInr * reservation.reservedQuantity,
    );
  }

  const result = await repo.commitHandoff({
    reservationId: reservation.reservationId,
    handedOffAt,
    impactRecord,
  });
  const body: HandoffResponse = result;
  return { status: 200, body };
};
