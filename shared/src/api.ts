/**
 * Request and response types for every endpoint.
 *
 * OWNER: M2  (docs/08-TEAM-ROLES.md § 3)
 * SOURCE: docs/04-API-CONTRACT.md - FROZEN.
 *
 * M1 imports these in web/src/api/client.ts; M2 validates against them.
 *
 * Entity shapes are not redefined here - they live in ./domain.ts, transcribed
 * from docs/02-DOMAIN-MODEL.md. This file covers envelopes, request bodies,
 * response bodies, query parameters and error codes only.
 *
 * Identity is the `X-Business-Id: biz_...` header on every write and on any read
 * scoped to "me" (docs/04 § 1). It is never a body field: the server ignores a
 * `businessId` in a body and the header wins. Location on a new listing is
 * copied from the acting business, which is why no request body carries one.
 */
import type {
  Business,
  Condition,
  HandoffMode,
  ImpactRecord,
  MaterialAttributes,
  AttributeConstraints,
  MaterialCategory,
  Match,
  MatchCheckCode,
  Requirement,
  RequirementStatus,
  Reservation,
  ReservationStatus,
  ListingStatus,
  SupplierMatch,
  SurplusListing,
  Unit,
} from './domain.js';

// ---------------------------------------------------------------------------
// § 1  Envelopes
// ---------------------------------------------------------------------------

// A single resource is returned as the resource object itself - there is no
// wrapper type for it. A collection is `{ items, meta }`; every non-2xx, without
// exception, is `{ error }`.

export interface CollectionMeta {
  count: number;
  /** Opaque cursor for the next page, or null when this is the last page. */
  nextCursor: string | null;
  truncated: boolean;
}

export interface Collection<T> {
  items: T[];
  meta: CollectionMeta;
}

/**
 * The complete § 4 table, and nothing outside it. M1 maps codes to copy; an
 * unlisted code renders the generic error state and is a bug on M2's side.
 */
export type ApiErrorCode =
  // 400
  | 'VALIDATION_FAILED'
  | 'MALFORMED_JSON'
  // 401
  | 'BUSINESS_NOT_IDENTIFIED'
  // 403
  | 'NOT_YOUR_LISTING'
  | 'NOT_YOUR_REQUIREMENT'
  | 'NOT_YOUR_RESERVATION'
  // 404
  | 'LISTING_NOT_FOUND'
  | 'REQUIREMENT_NOT_FOUND'
  | 'RESERVATION_NOT_FOUND'
  | 'BUSINESS_NOT_FOUND'
  | 'ROUTE_NOT_FOUND'
  // 409
  | 'INSUFFICIENT_QUANTITY'
  | 'LISTING_NOT_AVAILABLE'
  | 'INVALID_STATE'
  | 'NOT_COMPATIBLE'
  | 'SELF_RESERVATION'
  // 422
  | 'EXCEEDS_REQUIREMENT'
  // 500
  | 'INTERNAL_ERROR';

export interface ApiErrorPayload {
  /** What the client branches on. Never branch on `message`. */
  code: ApiErrorCode;
  /** Human-readable, and may be shown to the user. */
  message: string;
  /** For VALIDATION_FAILED, the first offending field. Null otherwise. */
  field: string | null;
  /**
   * Code-specific extras. Known members:
   *   INSUFFICIENT_QUANTITY -> { availableQuantity: number }
   *   NOT_COMPATIBLE        -> { failedChecks: MatchCheckCode[] }
   */
  details: Record<string, unknown> | null;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

export interface InsufficientQuantityDetails {
  availableQuantity: number;
}

export interface NotCompatibleDetails {
  failedChecks: MatchCheckCode[];
}

// ---------------------------------------------------------------------------
// GET /v1/meta/categories
// ---------------------------------------------------------------------------

/**
 * One form field in a category's attribute or constraint schema. M1 builds the
 * dynamic listing and requirement forms from these, so nothing hardcodes enums
 * in components.
 */
export interface MetaField {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'text';
  required: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  helper?: string;
}

export interface CategoryMeta {
  code: MaterialCategory;
  label: string;
  canonicalUnit: Unit;
  allowedUnits: Unit[];
  /** Icon slug, e.g. "wood" - resolved to an asset by the web app. */
  icon: string;
  /** Fields a supplier fills in, producing `SurplusListing.attributes`. */
  attributeFields: MetaField[];
  /** Fields a buyer fills in, producing `Requirement.constraints`. */
  constraintFields: MetaField[];
}

/**
 * Enum value -> display string, served with the taxonomy. At runtime prefer
 * these over shared/src/labels.ts, which is the typed fallback.
 */
export interface EnumLabels {
  condition: Record<Condition, string>;
  unit: Record<Unit, string>;
  handoffMode: Record<HandoffMode, string>;
  listingStatus: Record<ListingStatus, string>;
  requirementStatus: Record<RequirementStatus, string>;
  reservationStatus: Record<ReservationStatus, string>;
  /** Short chip labels for the six match checks. */
  matchCheck: Record<MatchCheckCode, string>;
}

/** Body of fixtures/meta-categories.json - M2 serves it, M1 mocks it. */
export interface MetaCategoriesResponse {
  items: CategoryMeta[];
  enumLabels: EnumLabels;
}

// ---------------------------------------------------------------------------
// Businesses
// ---------------------------------------------------------------------------

/** GET /v1/businesses - powers the business switcher. */
export type BusinessesResponse = Collection<Business>;

/** GET /v1/businesses/{businessId} */
export type BusinessResponse = Business;

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/** POST /v1/listings - facts only; every derived field is rejected if present. */
export interface CreateListingRequest {
  title: string;                    // 3-80 chars
  category: MaterialCategory;
  description?: string;             // <= 500 chars
  totalQuantity: number;            // > 0, <= 100000, max 2 dp
  unit: Unit;                       // in the category's allowedUnits
  condition: Condition;
  attributes: MaterialAttributes;   // attributes.category must equal category
  availableFrom: string;            // ISO date, >= today
  availableUntil: string;           // ISO date, >= availableFrom, <= today + 90 days
  handoffMode: HandoffMode;
  referencePriceInr?: number;       // integer, 0 < p <= 100000
  photoKey?: string;                // from POST /v1/uploads/listing-photo (P1)
}

/**
 * 201 -> the created listing, with availableQuantity === totalQuantity,
 * reservedQuantity 0, handedOffQuantity 0, status "ACTIVE".
 */
export type CreateListingResponse = SurplusListing;

/** A listing in a collection, carrying `distanceKm` when an origin is resolvable. */
export type ListingListItem = SurplusListing & { distanceKm?: number };

export type ListingResponse = ListingListItem;

export const LISTING_SORTS = ['RECENT', 'EXPIRING_SOON', 'QUANTITY_DESC', 'DISTANCE_ASC'] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

/**
 * GET /v1/listings query parameters, in client-facing (pre-serialisation) form:
 * arrays serialise to repeated params, `?category=WOOD_OFFCUTS&category=ACRYLIC_SHEET`.
 * Filters are AND-combined; a repeated param is OR-combined within itself.
 * An empty result is 200 with `items: []`, never 404.
 */
export interface ListingsQuery {
  category?: MaterialCategory[];
  condition?: Condition[];
  /** Case-insensitive substring over title, description and businessName. */
  q?: string;
  minQuantity?: number;             // availableQuantity >= minQuantity
  maxQuantity?: number;
  city?: string;                    // default "Mumbai"
  availableOn?: string;             // ISO date the window must cover
  /** Origin for distanceKm and maxDistanceKm. Defaults to the header business. */
  originBusinessId?: string;
  /** Requires an origin; ignored without one. */
  maxDistanceKm?: number;
  /** Default ACTIVE + PARTIALLY_RESERVED, which hides expired/withdrawn/completed stock. */
  status?: ListingStatus[];
  /** true -> only the acting business's listings, and the status default widens to all. */
  mine?: boolean;
  sort?: ListingSort;               // default RECENT; DISTANCE_ASC needs an origin
  limit?: number;                   // default 24, 1-100
  cursor?: string;                  // echo back meta.nextCursor
}

export type ListingsResponse = Collection<ListingListItem>;

/** POST /v1/listings/{listingId}/withdraw - no body. 200 -> the updated listing. */
export type WithdrawListingResponse = SurplusListing;

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

/** POST /v1/requirements */
export interface CreateRequirementRequest {
  category: MaterialCategory;
  requestedQuantity: number;          // > 0, <= 100000
  unit: Unit;                         // in the category's allowedUnits
  acceptedConditions: Condition[];    // non-empty, valid enums
  constraints: AttributeConstraints;  // constraints.category must equal category
  radiusKm: number;                   // integer 1..50
  requiredBy: string;                 // ISO date, >= today, <= today + 90 days
  notes?: string;                     // <= 500 chars
}

/** 201 -> the created requirement (status OPEN, fulfilledQuantity 0, reservedQuantity 0). */
export type CreateRequirementResponse = Requirement;

/**
 * POST /v1/requirements?withMatches=true - requirement and its match set in one
 * round trip, so the buyer submitting the form lands directly on results. This
 * is the call behind the demo's WOW moment at 1:35.
 */
export interface CreateRequirementWithMatchesResponse {
  requirement: Requirement;
  matches: Match[];
}

/**
 * GET /v1/requirements. docs/04 § 2 lists the route but gives it no parameter
 * table, so unlike every other type in this file these four are NOT frozen -
 * they mirror the GET /v1/listings parameters of the same name. Confirm with M4
 * before M1 relies on any of them.
 */
export interface RequirementsQuery {
  /** true -> only the acting business's requirements. */
  mine?: boolean;
  status?: RequirementStatus[];
  category?: MaterialCategory[];
  city?: string;
  limit?: number;                     // default 24
  cursor?: string;
}

export type RequirementsResponse = Collection<Requirement>;

export type RequirementResponse = Requirement;

/** POST /v1/requirements/{requirementId}/cancel - no body. 200 -> the updated requirement. */
export type CancelRequirementResponse = Requirement;

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export interface MatchesQuery {
  /** Default true - incompatible listings are returned with their reasons. */
  includeNearMisses?: boolean;
  /** Compatible matches, default 20. Near-misses are capped at 10 on top. */
  limit?: number;
}

export interface MatchMeta {
  count: number;
  compatibleCount: number;
  nearMissCount: number;
  truncated: boolean;
  /** ISO timestamp the match set was computed at. */
  evaluatedAt: string;
}

/**
 * GET /v1/requirements/{requirementId}/matches - the core endpoint.
 *
 * Guarantees M1 can rely on (docs/04 § 3):
 *   1. `checks` always has all six, in the order of docs/03 § 2.
 *   2. compatible === checks.every(c => c.passed).
 *   3. `listing` is fully embedded - a match card needs no second fetch.
 *   4. Compatible items precede near-misses; within a group, score descending.
 *   5. `score` is for ordering and tests. Do not render it.
 *
 * 403 NOT_YOUR_REQUIREMENT if the acting business does not own the requirement.
 */
export interface RequirementMatchesResponse {
  requirement: Requirement;
  items: Match[];
  meta: MatchMeta;
}

/**
 * GET /v1/listings/{listingId}/matches - the mirror image. Same six checks,
 * roles swapped, `radiusKm` always from the requirement.
 * 403 NOT_YOUR_LISTING if the acting business is not the supplier.
 */
export interface ListingMatchesResponse {
  listing: SurplusListing;
  items: SupplierMatch[];
  meta: MatchMeta;
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

/**
 * POST /v1/reservations
 *
 * The server recomputes the six checks at this moment, rejects if the listing is
 * no longer compatible (409 NOT_COMPATIBLE, with details.failedChecks), and
 * snapshots the passing checks into `matchReasons`. The client's view of
 * compatibility is never trusted.
 */
export interface CreateReservationRequest {
  listingId: string;
  /** Omitted for browse-and-reserve without a posted requirement. */
  requirementId?: string;
  reservedQuantity: number;           // > 0, max 2 dp
}

/**
 * The three-resource envelope. All three affected resources come back in one
 * response, so the UI updates the supplier's remaining stock (80 -> 30) without a
 * refetch. This is the 1:55 demo beat.
 */
export interface ReservationEnvelope {
  reservation: Reservation;
  listing: SurplusListing;
  requirement: Requirement | null;
}

export type CreateReservationResponse = ReservationEnvelope;

/** POST /v1/reservations/{reservationId}/handoff - supplier only. */
export interface HandoffRequest {
  note?: string;                      // <= 200 chars
}

/**
 * 200 -> the three-resource envelope plus the ImpactRecord written inside the
 * handoff transaction. A second handoff returns 409 INVALID_STATE and changes
 * nothing - never a second ImpactRecord. The demo will double-click this button.
 */
export type HandoffResponse = ReservationEnvelope & { impactRecord: ImpactRecord };

/** POST /v1/reservations/{reservationId}/cancel - buyer or supplier, RESERVED only. */
export interface CancelReservationRequest {
  reason?: string;
}

/** 200 -> the same three-resource envelope, with no impactRecord. Ever. */
export type CancelReservationResponse = ReservationEnvelope;

export const RESERVATION_ROLES = ['BUYER', 'SUPPLIER', 'ALL'] as const;
export type ReservationRole = (typeof RESERVATION_ROLES)[number];

/**
 * GET /v1/reservations - reservations where the acting business is buyer or
 * supplier. Supplier-side RESERVED rows are the "Incoming reservations - confirm
 * handoff" queue on the dashboard.
 */
export interface ReservationsQuery {
  /** Which side the acting business is on. Default ALL. */
  role?: ReservationRole;
  status?: ReservationStatus[];
  limit?: number;                     // default 24
  cursor?: string;
}

export type ReservationsResponse = Collection<Reservation>;

export type ReservationResponse = Reservation;

// ---------------------------------------------------------------------------
// GET /v1/impact
// ---------------------------------------------------------------------------

export const IMPACT_SCOPES = ['PLATFORM', 'MINE'] as const;
export type ImpactScope = (typeof IMPACT_SCOPES)[number];

export interface ImpactQuery {
  /** Default PLATFORM. MINE needs the X-Business-Id header. */
  scope?: ImpactScope;
  from?: string;                      // ISO date on completedAt
  to?: string;                        // ISO date on completedAt
}

export interface ImpactTotals {
  /**
   * Keyed by unit. Never sum kg with units or sheets into one number, and never
   * render a single "total material reused" figure across units.
   */
  quantityReusedByUnit: Record<Unit, number>;
  completedExchanges: number;
  activeSurplusByUnit: Record<Unit, number>;
  requirementsFulfilledFully: number;
  requirementsFulfilledPartially: number;
  requirementsOpen: number;
  fulfilmentRatePct: number;
  medianHoursListingToReservation: number;
  /**
   * Only where a referencePriceInr existed, and the UI must label it
   * "estimated". Omitted entirely when no record carries a price.
   */
  estimatedProcurementAvoidedInr?: number;
}

export interface ImpactByCategory {
  category: MaterialCategory;
  quantityReused: number;
  unit: Unit;
  completedExchanges: number;
  activeSurplus: number;
}

export interface ImpactDailyPoint {
  date: string;                       // ISO date
  quantityReused: number;
  completedExchanges: number;
}

/**
 * Every figure aggregates ImpactRecord rows only - handed off, never merely
 * reserved. No CO2e, no "trees saved", no environmental extrapolation.
 * `meta.sourceRecordCount` is displayed in small print so a judge can see the
 * numbers come from real transactions.
 */
export interface ImpactResponse {
  totals: ImpactTotals;
  byCategory: ImpactByCategory[];
  dailySeries: ImpactDailyPoint[];
  meta: {
    sourceRecordCount: number;
    generatedAt: string;
  };
}

// ---------------------------------------------------------------------------
// POST /v1/uploads/listing-photo  (P1, M3)
// ---------------------------------------------------------------------------

/** image/jpeg, image/png, image/webp only; <= 5 MB. */
export interface UploadListingPhotoRequest {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
}

/**
 * 201 -> the client PUTs the bytes straight to S3, then sends `photoKey` when
 * creating the listing. Presigned URL valid 5 minutes.
 */
export interface UploadListingPhotoResponse {
  uploadUrl: string;
  photoKey: string;
  expiresInSeconds: number;
}
