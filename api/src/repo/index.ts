/**
 * Storage contract shared by the local in-memory driver and DynamoDB driver.
 *
 * OWNER: M2. M3 implements this interface in repo/dynamo.ts.
 * Business logic must depend on this interface, never on a concrete database.
 */
import type {
  Business,
  Condition,
  GeoPoint,
  ImpactRecord,
  ListingStatus,
  MaterialCategory,
  Requirement,
  RequirementStatus,
  Reservation,
  ReservationStatus,
  SurplusListing,
} from '@dse/shared';

export interface PageRequest {
  /** Maximum rows to return. Callers validate the public API's 1..100 range. */
  limit?: number;
  /** Opaque cursor returned by the previous page. */
  cursor?: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  truncated: boolean;
}

export interface ListingFilter extends PageRequest {
  listingIds?: string[];
  businessId?: string;
  categories?: MaterialCategory[];
  conditions?: Condition[];
  statuses?: ListingStatus[];
  city?: string;
  query?: string;
  minAvailableQuantity?: number;
  maxAvailableQuantity?: number;
  availableOn?: string;
  origin?: GeoPoint;
  maxDistanceKm?: number;
  sort?: 'RECENT' | 'EXPIRING_SOON' | 'QUANTITY_DESC' | 'DISTANCE_ASC';
}

export interface RequirementFilter extends PageRequest {
  requirementIds?: string[];
  businessId?: string;
  categories?: MaterialCategory[];
  statuses?: RequirementStatus[];
  city?: string;
}

export interface ReservationFilter extends PageRequest {
  reservationIds?: string[];
  buyerBusinessId?: string;
  supplierBusinessId?: string;
  /** Match either the buyer or supplier side. */
  businessId?: string;
  listingId?: string;
  requirementId?: string;
  statuses?: ReservationStatus[];
}

export interface ImpactFilter {
  businessId?: string;
  reservationId?: string;
  categories?: MaterialCategory[];
  from?: string;
  to?: string;
}

/** Signed deltas applied atomically to a requirement's counters. */
export interface QuantityDelta {
  reservedDelta?: number;
  fulfilledDelta?: number;
}

export interface HandoffCommit {
  reservationId: string;
  handedOffAt: string;
  impactRecord: ImpactRecord;
}

export interface HandoffResult {
  reservation: Reservation;
  listing: SurplusListing;
  requirement: Requirement | null;
  impactRecord: ImpactRecord;
}

export interface Repo {
  getBusiness(id: string): Promise<Business | null>;
  listBusinesses(): Promise<Business[]>;

  createListing(listing: SurplusListing): Promise<SurplusListing>;
  getListing(id: string): Promise<SurplusListing | null>;
  queryListings(filter: ListingFilter): Promise<Page<SurplusListing>>;
  /** Atomic. Throws InsufficientQuantityError when the condition fails. */
  reserveQuantity(listingId: string, quantity: number): Promise<SurplusListing>;
  releaseQuantity(listingId: string, quantity: number): Promise<SurplusListing>;
  completeQuantity(listingId: string, quantity: number): Promise<SurplusListing>;
  updateListingStatus(listingId: string, status: ListingStatus): Promise<SurplusListing>;

  createRequirement(requirement: Requirement): Promise<Requirement>;
  getRequirement(id: string): Promise<Requirement | null>;
  queryRequirements(filter: RequirementFilter): Promise<Page<Requirement>>;
  updateRequirementQuantities(id: string, delta: QuantityDelta): Promise<Requirement>;

  createReservation(reservation: Reservation): Promise<Reservation>;
  getReservation(id: string): Promise<Reservation | null>;
  queryReservations(filter: ReservationFilter): Promise<Page<Reservation>>;
  transitionReservation(
    id: string,
    from: ReservationStatus,
    to: ReservationStatus,
    patch?: Partial<Reservation>,
  ): Promise<Reservation>;

  createImpactRecord(record: ImpactRecord): Promise<ImpactRecord>;
  queryImpactRecords(filter: ImpactFilter): Promise<ImpactRecord[]>;

  /** All-or-nothing transition across reservation, listing, requirement and impact. */
  commitHandoff(input: HandoffCommit): Promise<HandoffResult>;
}

export class RepoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class EntityNotFoundError extends RepoError {
  constructor(
    public readonly entity: 'business' | 'listing' | 'requirement' | 'reservation',
    public readonly id: string,
  ) {
    super(`${entity} ${id} was not found`);
  }
}

export class EntityAlreadyExistsError extends RepoError {
  constructor(
    public readonly entity: 'business' | 'listing' | 'requirement' | 'reservation' | 'impact',
    public readonly id: string,
  ) {
    super(`${entity} ${id} already exists`);
  }
}

export class InsufficientQuantityError extends RepoError {
  constructor(
    public readonly availableQuantity: number,
    public readonly requestedQuantity: number,
  ) {
    super(`Only ${availableQuantity} is available; ${requestedQuantity} was requested`);
  }
}

export class InvalidStateError extends RepoError {
  constructor(
    public readonly entity: 'listing' | 'requirement' | 'reservation',
    public readonly id: string,
    public readonly currentState: string,
    public readonly expectedState?: string,
  ) {
    super(
      expectedState
        ? `${entity} ${id} is ${currentState}; expected ${expectedState}`
        : `${entity} ${id} is in invalid state ${currentState}`,
    );
  }
}

export class InvariantViolationError extends RepoError {}

export class InvalidCursorError extends RepoError {
  constructor() {
    super('Invalid repository cursor');
  }
}

export class DuplicateImpactRecordError extends RepoError {
  constructor(public readonly reservationId: string) {
    super(`An impact record already exists for reservation ${reservationId}`);
  }
}
