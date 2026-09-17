/**
 * In-memory, per-session mutable store for the mock server. OWNER: M1.
 *
 * Seeded from fixtures/ on module load; reset on page reload (fine per the
 * task - there is no persistence layer in mock mode). Every mutation here is
 * the mock's stand-in for a DynamoDB conditional write (docs/02 § 10).
 */
import type {
  Business,
  ImpactRecord,
  ListingStatus,
  Requirement,
  RequirementStatus,
  Reservation,
  SurplusListing,
} from '@dse/shared';
import { FIXTURE_BUSINESSES, FIXTURE_LISTINGS, FIXTURE_REQUIREMENTS } from './fixtures.js';
import { MOCK_TODAY } from './today.js';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const businesses: Business[] = clone(FIXTURE_BUSINESSES);
const listings: SurplusListing[] = clone(FIXTURE_LISTINGS);
const requirements: Requirement[] = clone(FIXTURE_REQUIREMENTS);
const reservations: Reservation[] = [];
const impactRecords: ImpactRecord[] = [];

let listingSeq = listings.length;
let requirementSeq = requirements.length;
let reservationSeq = 0;
let impactSeq = 0;

function nextId(prefix: string, seq: number): string {
  return `${prefix}_${String(seq).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Status derivation (docs/02 § 5, § 6 invariants - never set by the client)
// ---------------------------------------------------------------------------

export function deriveListingStatus(l: SurplusListing): ListingStatus {
  if (l.status === 'WITHDRAWN') return 'WITHDRAWN';
  if (l.handedOffQuantity >= l.totalQuantity) return 'COMPLETED';
  if (l.availableUntil < MOCK_TODAY && l.availableQuantity > 0) return 'EXPIRED';
  if (l.availableQuantity <= 0) return 'FULLY_RESERVED';
  if (l.reservedQuantity > 0 || l.handedOffQuantity > 0) return 'PARTIALLY_RESERVED';
  return 'ACTIVE';
}

export function deriveRequirementStatus(r: Requirement): RequirementStatus {
  if (r.status === 'CANCELLED') return 'CANCELLED';
  if (r.fulfilledQuantity >= r.requestedQuantity) return 'FULFILLED';
  if (r.requiredBy < MOCK_TODAY) return 'EXPIRED';
  if (r.fulfilledQuantity > 0 || r.reservedQuantity > 0) return 'PARTIALLY_FULFILLED';
  return 'OPEN';
}

function touchListing(l: SurplusListing): void {
  l.status = deriveListingStatus(l);
  l.updatedAt = new Date().toISOString();
}

function touchRequirement(r: Requirement): void {
  r.status = deriveRequirementStatus(r);
  r.updatedAt = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------------------

export function getBusinesses(): Business[] {
  return businesses;
}

export function getBusinessById(businessId: string): Business | undefined {
  return businesses.find((b) => b.businessId === businessId);
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export function getListings(): SurplusListing[] {
  return listings;
}

export function getListingById(listingId: string): SurplusListing | undefined {
  return listings.find((l) => l.listingId === listingId);
}

export function addListing(input: Omit<SurplusListing, 'listingId' | 'createdAt' | 'updatedAt' | 'status'>): SurplusListing {
  listingSeq += 1;
  const now = new Date().toISOString();
  const listing: SurplusListing = { ...input, listingId: nextId('lst', listingSeq), status: 'ACTIVE', createdAt: now, updatedAt: now };
  listing.status = deriveListingStatus(listing);
  listings.push(listing);
  return listing;
}

export function withdrawListing(listing: SurplusListing): void {
  listing.status = 'WITHDRAWN';
  listing.updatedAt = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export function getRequirements(): Requirement[] {
  return requirements;
}

export function getRequirementById(requirementId: string): Requirement | undefined {
  return requirements.find((r) => r.requirementId === requirementId);
}

export function addRequirement(
  input: Omit<Requirement, 'requirementId' | 'createdAt' | 'updatedAt' | 'status' | 'fulfilledQuantity' | 'reservedQuantity'>,
): Requirement {
  requirementSeq += 1;
  const now = new Date().toISOString();
  const requirement: Requirement = {
    ...input,
    requirementId: nextId('req', requirementSeq),
    fulfilledQuantity: 0,
    reservedQuantity: 0,
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
  };
  requirements.push(requirement);
  return requirement;
}

export function cancelRequirement(requirement: Requirement): void {
  requirement.status = 'CANCELLED';
  requirement.updatedAt = new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export function getReservations(): Reservation[] {
  return reservations;
}

export function getReservationById(reservationId: string): Reservation | undefined {
  return reservations.find((r) => r.reservationId === reservationId);
}

/** Reserve: decrements listing.availableQuantity, bumps reservedQuantity on both sides. */
export function addReservation(input: {
  listing: SurplusListing;
  requirement: Requirement | null;
  reservedQuantity: number;
  buyerBusinessId: string;
  buyerBusinessName: string;
  matchReasons: Reservation['matchReasons'];
}): Reservation {
  reservationSeq += 1;
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString(); // demo: +30 min (docs/10 § Seed)

  const reservation: Reservation = {
    reservationId: nextId('rsv', reservationSeq),
    listingId: input.listing.listingId,
    requirementId: input.requirement?.requirementId,
    supplierBusinessId: input.listing.businessId,
    supplierBusinessName: input.listing.businessName,
    buyerBusinessId: input.buyerBusinessId,
    buyerBusinessName: input.buyerBusinessName,
    category: input.listing.category,
    reservedQuantity: input.reservedQuantity,
    unit: input.listing.unit,
    matchReasons: input.matchReasons,
    handoffMode: input.listing.handoffMode,
    status: 'RESERVED',
    createdAt,
    expiresAt,
  };
  reservations.push(reservation);

  input.listing.availableQuantity = round2(input.listing.availableQuantity - input.reservedQuantity);
  input.listing.reservedQuantity = round2(input.listing.reservedQuantity + input.reservedQuantity);
  touchListing(input.listing);

  if (input.requirement) {
    input.requirement.reservedQuantity = round2(input.requirement.reservedQuantity + input.reservedQuantity);
    touchRequirement(input.requirement);
  }

  return reservation;
}

/** Handoff: moves quantity from reserved to handed-off, writes exactly one ImpactRecord. */
export function handoffReservation(
  reservation: Reservation,
  listing: SurplusListing,
  requirement: Requirement | null,
): ImpactRecord {
  const now = new Date().toISOString();
  reservation.status = 'HANDED_OFF';
  reservation.handedOffAt = now;

  listing.reservedQuantity = round2(listing.reservedQuantity - reservation.reservedQuantity);
  listing.handedOffQuantity = round2(listing.handedOffQuantity + reservation.reservedQuantity);
  touchListing(listing);

  if (requirement) {
    requirement.reservedQuantity = round2(requirement.reservedQuantity - reservation.reservedQuantity);
    requirement.fulfilledQuantity = round2(requirement.fulfilledQuantity + reservation.reservedQuantity);
    touchRequirement(requirement);
  }

  impactSeq += 1;
  const impactRecord: ImpactRecord = {
    impactId: nextId('imp', impactSeq),
    reservationId: reservation.reservationId,
    listingId: listing.listingId,
    requirementId: requirement?.requirementId,
    category: listing.category,
    quantityReused: reservation.reservedQuantity,
    unit: listing.unit,
    supplierBusinessId: listing.businessId,
    receiverBusinessId: reservation.buyerBusinessId,
    estimatedProcurementAvoidedInr:
      listing.referencePriceInr !== undefined ? Math.round(listing.referencePriceInr * reservation.reservedQuantity) : undefined,
    completedAt: now,
  };
  impactRecords.push(impactRecord);
  return impactRecord;
}

/** Cancel: returns quantity to the listing. No ImpactRecord, ever. */
export function cancelReservation(reservation: Reservation, listing: SurplusListing, requirement: Requirement | null, reason?: string): void {
  reservation.status = 'CANCELLED';
  reservation.cancelledAt = new Date().toISOString();
  if (reason !== undefined) reservation.cancellationReason = reason;

  listing.availableQuantity = round2(listing.availableQuantity + reservation.reservedQuantity);
  listing.reservedQuantity = round2(listing.reservedQuantity - reservation.reservedQuantity);
  touchListing(listing);

  if (requirement) {
    requirement.reservedQuantity = round2(requirement.reservedQuantity - reservation.reservedQuantity);
    touchRequirement(requirement);
  }
}

// ---------------------------------------------------------------------------
// Impact
// ---------------------------------------------------------------------------

export function getImpactRecords(): ImpactRecord[] {
  return impactRecords;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
