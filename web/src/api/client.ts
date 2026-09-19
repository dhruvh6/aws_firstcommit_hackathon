/**
 * Typed fetch client - one function per route in docs/04-API-CONTRACT.md § 2.
 *
 * OWNER: M1 (docs/08-TEAM-ROLES.md § 3).
 *
 * Reads VITE_API_BASE_URL, attaches X-Business-Id from
 * localStorage['dse.actingBusinessId'] (docs/06 § 3), and turns every non-2xx
 * response into a typed ApiError. Branch on `error.code`, never `error.message`
 * (docs/04 § 1). No retries, no caching - TanStack Query (queries.ts) owns that.
 */
import type {
  ApiErrorCode,
  ApiErrorResponse,
  BusinessesResponse,
  CreateListingRequest,
  CreateListingResponse,
  CreateRequirementRequest,
  CreateRequirementResponse,
  CreateRequirementWithMatchesResponse,
  CreateReservationRequest,
  CreateReservationResponse,
  HandoffRequest,
  HandoffResponse,
  ImpactQuery,
  ImpactResponse,
  ListingResponse,
  ListingsQuery,
  ListingsResponse,
  MatchesQuery,
  MetaCategoriesResponse,
  RequirementMatchesResponse,
  ReservationsQuery,
  ReservationsResponse,
} from '@dse/shared';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001/v1';

export const ACTING_BUSINESS_ID_KEY = 'dse.actingBusinessId';

/** Client-side-only codes for failures that never reach the server's error table. */
export type ApiClientErrorCode = 'NETWORK_ERROR' | 'INVALID_RESPONSE';

export class ApiError extends Error {
  readonly code: ApiErrorCode | ApiClientErrorCode;
  readonly field: string | null;
  readonly details: Record<string, unknown> | null;
  readonly httpStatus: number | null;

  constructor(params: {
    code: ApiErrorCode | ApiClientErrorCode;
    message: string;
    field?: string | null;
    details?: Record<string, unknown> | null;
    httpStatus: number | null;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.code = params.code;
    this.field = params.field ?? null;
    this.details = params.details ?? null;
    this.httpStatus = params.httpStatus;
  }
}

function getActingBusinessId(): string | null {
  try {
    return localStorage.getItem(ACTING_BUSINESS_ID_KEY);
  } catch {
    return null;
  }
}

function buildQuery(params?: object): string {
  if (!params) return '';
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) usp.append(key, String(item));
    } else {
      usp.append(key, String(value));
    }
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

function isApiErrorResponse(payload: unknown): payload is ApiErrorResponse {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as { error: unknown }).error === 'object' &&
    (payload as { error: unknown }).error !== null
  );
}

interface RequestOptions {
  method: 'GET' | 'POST';
  path: string;
  query?: object;
  body?: unknown;
}

async function request<T>(options: RequestOptions): Promise<T> {
  const url = `${BASE_URL}${options.path}${buildQuery(options.query)}`;
  const headers: Record<string, string> = {};

  const businessId = getActingBusinessId();
  if (businessId) headers['X-Business-Id'] = businessId;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError({
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
      httpStatus: null,
    });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: 'The server returned a response that could not be read.',
      httpStatus: response.status,
    });
  }

  if (!response.ok) {
    if (isApiErrorResponse(payload)) {
      const { code, message, field, details } = payload.error;
      throw new ApiError({ code, message, field, details, httpStatus: response.status });
    }
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: 'The server returned an unexpected error response.',
      httpStatus: response.status,
    });
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Meta / businesses
// ---------------------------------------------------------------------------

export function getMetaCategories(): Promise<MetaCategoriesResponse> {
  return request({ method: 'GET', path: '/meta/categories' });
}

export function getBusinesses(): Promise<BusinessesResponse> {
  return request({ method: 'GET', path: '/businesses' });
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export function createListing(body: CreateListingRequest): Promise<CreateListingResponse> {
  return request({ method: 'POST', path: '/listings', body });
}

export function getListings(query?: ListingsQuery): Promise<ListingsResponse> {
  return request({ method: 'GET', path: '/listings', query });
}

export function getListing(listingId: string): Promise<ListingResponse> {
  return request({ method: 'GET', path: `/listings/${listingId}` });
}

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export function createRequirement(body: CreateRequirementRequest): Promise<CreateRequirementResponse> {
  return request({ method: 'POST', path: '/requirements', body });
}

/**
 * POST /v1/requirements?withMatches=true - the requirement and its match set in
 * one round trip (docs/04 § 3, the demo's 1:35 WOW moment).
 */
export function createRequirementWithMatches(
  body: CreateRequirementRequest,
): Promise<CreateRequirementWithMatchesResponse> {
  return request({ method: 'POST', path: '/requirements', query: { withMatches: true }, body });
}

export function getRequirementMatches(
  requirementId: string,
  query?: MatchesQuery,
): Promise<RequirementMatchesResponse> {
  return request({ method: 'GET', path: `/requirements/${requirementId}/matches`, query });
}

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export function createReservation(body: CreateReservationRequest): Promise<CreateReservationResponse> {
  return request({ method: 'POST', path: '/reservations', body });
}

export function getReservations(query?: ReservationsQuery): Promise<ReservationsResponse> {
  return request({ method: 'GET', path: '/reservations', query });
}

export function handoffReservation(reservationId: string, body?: HandoffRequest): Promise<HandoffResponse> {
  return request({ method: 'POST', path: `/reservations/${reservationId}/handoff`, body });
}

// ---------------------------------------------------------------------------
// Impact
// ---------------------------------------------------------------------------

export function getImpact(query?: ImpactQuery): Promise<ImpactResponse> {
  return request({ method: 'GET', path: '/impact', query });
}
