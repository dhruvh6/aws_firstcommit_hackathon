/**
 * Entities, enums and state values shared by `web` and `api`.
 *
 * OWNER: M2  (docs/08-TEAM-ROLES.md § 3)
 * SOURCE: docs/02-DOMAIN-MODEL.md §§ 3-8 - transcribed verbatim, it is FROZEN.
 *         MatchCheckCode comes from docs/03-MATCHING-SPEC.md § 2.
 *
 * Field names here are the field names on the wire, in DynamoDB and in the UI.
 * Do not rename anything without a contract change (docs/09 § 3).
 *
 * Conventions (docs/02 § 1): IDs are opaque prefixed strings; timestamps are ISO
 * 8601 UTC strings and dates are ISO `YYYY-MM-DD` strings, never epoch numbers;
 * quantities are numbers with at most 2 decimals; absent values are omitted or
 * `null`, never `""`, `-1` or `0`.
 */

// ---------------------------------------------------------------------------
// § 3  Enums
// ---------------------------------------------------------------------------

export const MATERIAL_CATEGORIES = [
  'WOOD_OFFCUTS',
  'FABRIC_OFFCUTS',
  'PACKAGING_CARDBOARD',
  'ACRYLIC_SHEET',
] as const;
export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export const UNITS = ['KG', 'UNITS', 'SHEETS', 'METRES'] as const;
export type Unit = (typeof UNITS)[number];

/** Ordered best -> worst. Comparison is by index, so order is part of the contract. */
export const CONDITIONS = ['UNUSED', 'CLEAN_USABLE', 'MIXED', 'NEEDS_SORTING'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const LISTING_STATUS = [
  'ACTIVE',            // available, no reservations
  'PARTIALLY_RESERVED',// some quantity reserved, some still available
  'FULLY_RESERVED',    // availableQuantity === 0, nothing handed off yet
  'COMPLETED',         // all quantity handed off
  'EXPIRED',           // availableUntil passed with quantity remaining
  'WITHDRAWN',         // supplier closed it early
] as const;
export type ListingStatus = (typeof LISTING_STATUS)[number];

export const REQUIREMENT_STATUS = [
  'OPEN',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type RequirementStatus = (typeof REQUIREMENT_STATUS)[number];

export const RESERVATION_STATUS = [
  'RESERVED',    // buyer holds quantity, awaiting supplier handoff confirmation
  'HANDED_OFF',  // supplier confirmed physical transfer -> terminal, writes ImpactRecord
  'CANCELLED',   // buyer withdrew -> quantity returned to listing
  'EXPIRED',     // hold lapsed -> quantity returned to listing
] as const;
export type ReservationStatus = (typeof RESERVATION_STATUS)[number];

export const HANDOFF_MODES = ['PICKUP', 'DROP_OFF', 'EITHER'] as const;
export type HandoffMode = (typeof HANDOFF_MODES)[number];

/**
 * The six match checks, in the fixed evaluation order of docs/03 § 2.
 * Order is part of the contract: `Match.checks` always carries all six, in this
 * order, and M1 renders one chip per entry.
 */
export const MATCH_CHECK_CODES = [
  'CATEGORY_COMPATIBLE',  // C1 - hard gate: same category and same unit
  'QUANTITY_AVAILABLE',   // C2 - availableQuantity > 0 and remainingRequirement > 0
  'ATTRIBUTES_SATISFIED', // C3 - every stated constraint satisfied (docs/03 § 4)
  'CONDITION_ACCEPTED',   // C4 - listing condition is in acceptedConditions
  'AVAILABILITY_WINDOW',  // C5 - window covers requiredBy
  'WITHIN_SERVICE_AREA',  // C6 - distanceKm <= radiusKm
] as const;
export type MatchCheckCode = (typeof MATCH_CHECK_CODES)[number];

// § 3: never add an enum value without a contract change. M1 renders a label for
// every value; an unknown value falls back to a raw-string chip rather than
// crashing - docs/07-DESIGN-SYSTEM.md § Unknown enum fallback.

// ---------------------------------------------------------------------------
// § 4  Business
// ---------------------------------------------------------------------------

/**
 * No contact fields, by design. No phone, no email, no address line, no contact
 * person - not in the schema, not in fixtures, not in the UI (docs/02 § 4).
 * If a handoff needs a location string, use `area` + `city`.
 */
export interface Business {
  businessId: string;        // "biz_..."
  name: string;              // "Furniture Workshop A"
  businessType: string;      // free text, e.g. "Furniture manufacturing"
  area: string;              // "Andheri East"
  city: string;              // "Mumbai"
  location: GeoPoint;        // used for distance checks
  createdAt: string;
}

export interface GeoPoint { lat: number; lon: number; }

// ---------------------------------------------------------------------------
// § 5  SurplusListing
// ---------------------------------------------------------------------------

export interface SurplusListing {
  listingId: string;               // "lst_..."
  businessId: string;              // supplier
  businessName: string;            // denormalised for list rendering
  title: string;                   // "Plywood offcuts, clean and dry" (max 80 chars)
  category: MaterialCategory;
  description?: string;            // max 500 chars
  totalQuantity: number;           // as originally listed, immutable after creation
  availableQuantity: number;       // totalQuantity - sum(active reservations) - handed off
  reservedQuantity: number;        // sum of RESERVED reservations
  handedOffQuantity: number;       // sum of HANDED_OFF reservations
  unit: Unit;
  condition: Condition;
  attributes: MaterialAttributes;  // category-specific, see § 8
  area: string;
  city: string;
  location: GeoPoint;
  availableFrom: string;           // ISO date
  availableUntil: string;          // ISO date, inclusive
  handoffMode: HandoffMode;
  photoKey?: string;               // S3 object key, P1. Absent -> category placeholder
  referencePriceInr?: number;      // optional supplier-stated value per unit
  status: ListingStatus;
  createdAt: string;
  updatedAt: string;
}

// Invariants, enforced server-side (docs/02 § 5):
//   1. availableQuantity + reservedQuantity + handedOffQuantity === totalQuantity
//   2. availableQuantity >= 0, guaranteed by a conditional write
//   3. totalQuantity > 0 at creation, never mutated afterwards
//   4. availableUntil >= availableFrom, and >= today at creation
//   5. status is derived server-side, never set by the client (§ 9)
//   6. unit must be legal for category (§ 8)

// ---------------------------------------------------------------------------
// § 6  Requirement
// ---------------------------------------------------------------------------

export interface Requirement {
  requirementId: string;           // "req_..."
  businessId: string;              // buyer
  businessName: string;
  category: MaterialCategory;
  requestedQuantity: number;
  fulfilledQuantity: number;       // sum of HANDED_OFF reservations against it
  reservedQuantity: number;        // sum of RESERVED reservations against it
  unit: Unit;
  acceptedConditions: Condition[]; // non-empty
  constraints: AttributeConstraints; // category-specific, see § 8
  area: string;
  city: string;
  location: GeoPoint;
  radiusKm: number;                // 1..50
  requiredBy: string;              // ISO date - material must be available on/before this
  notes?: string;                  // max 500 chars
  status: RequirementStatus;
  createdAt: string;
  updatedAt: string;
}

// Invariants (docs/02 § 6):
//   1. fulfilledQuantity + reservedQuantity <= requestedQuantity
//   2. acceptedConditions.length >= 1
//   3. radiusKm in [1, 50]
//   4. requiredBy >= today at creation
//   5. unit matches the category's canonical unit, and must equal a listing's
//      unit for a match to be possible (docs/03 C1)

// ---------------------------------------------------------------------------
// § 7  Match, MatchCheck, Reservation, ImpactRecord
// ---------------------------------------------------------------------------

/** Computed on demand by the matching engine. Never persisted as a row. */
export interface Match {
  listingId: string;
  requirementId: string;
  compatibleQuantity: number;      // min(availableQuantity, remaining requirement)
  distanceKm: number;              // rounded to 1 dp
  score: number;                   // ranking only; never shown as a number in the UI
  compatible: boolean;             // true only if every hard check passed
  checks: MatchCheck[];            // always all six, in fixed order
  listing: SurplusListing;         // embedded so the card renders from one payload
}

export interface MatchCheck {
  code: MatchCheckCode;            // see docs/03 § Reason codes
  passed: boolean;
  detail: string;                  // server-rendered human sentence, <= 90 chars
}

/**
 * Supplier-side match, `GET /v1/listings/{listingId}/matches` (docs/03 § 9).
 * The same six checks with the roles swapped and one shared implementation -
 * the requirement is embedded instead of the listing, and `radiusKm` always
 * comes from the requirement.
 */
export type SupplierMatch = Omit<Match, 'listing'> & { requirement: Requirement };

export interface Reservation {
  reservationId: string;           // "rsv_..."
  listingId: string;
  requirementId?: string;          // absent for a direct browse-and-reserve
  supplierBusinessId: string;
  supplierBusinessName: string;
  buyerBusinessId: string;
  buyerBusinessName: string;
  category: MaterialCategory;
  reservedQuantity: number;        // > 0
  unit: Unit;
  matchReasons: MatchCheck[];      // frozen snapshot at reservation time
  handoffMode: HandoffMode;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string;               // createdAt + 48h (demo: + 30 min, see docs/10 § Seed)
  handedOffAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface ImpactRecord {
  impactId: string;                // "imp_..."
  reservationId: string;           // one-to-one with a HANDED_OFF reservation
  listingId: string;
  requirementId?: string;
  category: MaterialCategory;
  quantityReused: number;
  unit: Unit;
  supplierBusinessId: string;
  receiverBusinessId: string;
  estimatedProcurementAvoidedInr?: number; // only if a reference price existed
  completedAt: string;
}

// `matchReasons` is a snapshot on purpose: a reservation must always be able to
// show why it was made, even after the listing changes. Never re-derive reasons
// for a past reservation.
//
// ImpactRecord is append-only. Written exactly once, inside the handoff
// transaction, never updated or deleted.

// ---------------------------------------------------------------------------
// § 8  Material taxonomy and attributes
// ---------------------------------------------------------------------------

/**
 * `attributes` (listing) and `constraints` (requirement) are the two sides of
 * the same category schema: a listing states facts, a requirement states bounds.
 *
 * A constraint that is absent is not a constraint. `undefined` means "buyer does
 * not care" and the check passes with detail "No dimension requirement
 * specified". Never default an absent constraint to `0`, and never treat it as a
 * failure. Conversely, a stated buyer bound against an unstated listing fact is
 * a fail, not a pass (docs/03 § 4).
 *
 * Category never cross-matches: WOOD_OFFCUTS never matches PACKAGING_CARDBOARD.
 */
export type MaterialAttributes =
  | { category: 'WOOD_OFFCUTS';        minPieceSizeCm: number; maxPieceSizeCm: number; treated: boolean; woodType?: string; }
  | { category: 'FABRIC_OFFCUTS';      minPieceLengthCm: number; maxPieceLengthCm: number; fabricType?: string; gsm?: number; }
  | { category: 'PACKAGING_CARDBOARD'; ply?: number; printed: boolean; flatDimensionsCm?: string; }
  | { category: 'ACRYLIC_SHEET';       thicknessMm: number; minSheetSizeCm: number; maxSheetSizeCm: number; colour?: string; };

export type AttributeConstraints =
  | { category: 'WOOD_OFFCUTS';        minPieceSizeCm?: number; allowTreated?: boolean; woodType?: string; }
  | { category: 'FABRIC_OFFCUTS';      minPieceLengthCm?: number; fabricType?: string; minGsm?: number; maxGsm?: number; }
  | { category: 'PACKAGING_CARDBOARD'; minPly?: number; allowPrinted?: boolean; }
  | { category: 'ACRYLIC_SHEET';       minThicknessMm?: number; maxThicknessMm?: number; minSheetSizeCm?: number; colour?: string; };

/** Attributes/constraints narrowed to one category - `MaterialAttributes` for 'WOOD_OFFCUTS' etc. */
export type AttributesFor<C extends MaterialCategory> = Extract<MaterialAttributes, { category: C }>;
export type ConstraintsFor<C extends MaterialCategory> = Extract<AttributeConstraints, { category: C }>;

/**
 * Canonical unit per category, and the units a listing or requirement may use
 * (docs/02 § 8 table). `GET /v1/meta/categories` serves the same values from
 * fixtures/meta-categories.json; this map is the typed fallback so nothing
 * hardcodes the taxonomy inline.
 */
export const CATEGORY_UNITS: Record<MaterialCategory, { canonicalUnit: Unit; allowedUnits: readonly Unit[] }> = {
  WOOD_OFFCUTS:        { canonicalUnit: 'KG',     allowedUnits: ['KG'] },
  FABRIC_OFFCUTS:      { canonicalUnit: 'KG',     allowedUnits: ['KG', 'METRES'] },
  PACKAGING_CARDBOARD: { canonicalUnit: 'UNITS',  allowedUnits: ['UNITS', 'KG'] },
  ACRYLIC_SHEET:       { canonicalUnit: 'SHEETS', allowedUnits: ['SHEETS', 'KG'] },
};
