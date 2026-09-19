/**
 * Method + path -> handler. Framework-free on purpose: the same router serves
 * the Lambda entry point (src/index.ts) and the local dev server
 * (src/local/server.ts), so local and deployed behaviour cannot diverge.
 *
 * OWNER: M2  (docs/08-TEAM-ROLES.md § 3)
 * ROUTES: docs/04-API-CONTRACT.md § 2 - all 19 of them. FROZEN.
 */
import type { ApiErrorCode } from '@dse/shared';
import { ApiRequestError } from './errors.js';
import { getBusiness, listBusinesses } from './handlers/businesses.js';
import { createListing, getListing, listListings } from './handlers/listings.js';
import { getListingMatches, getRequirementMatches } from './handlers/matches.js';
import { getImpact } from './handlers/impact.js';
import { getCategories } from './handlers/meta.js';
import {
  createRequirement,
  getRequirement,
  listRequirements,
} from './handlers/requirements.js';
import { EntityNotFoundError, InvalidCursorError } from './repo/index.js';

export interface RouterRequest {
  method: string;
  /** Path with the /v1 prefix, e.g. "/v1/listings/lst_001". */
  path: string;
  query: Record<string, string | string[]>;
  headers: Record<string, string | undefined>;
  body: unknown;
}

export interface RouterResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export type Handler = (
  req: RouterRequest,
  params: Record<string, string>,
) => Promise<RouterResponse> | RouterResponse;

interface Route {
  method: string;
  /** Path template with :params, e.g. "/v1/listings/:listingId". */
  template: string;
  handler: Handler;
}

/** Error envelope from docs/04 § 1. Codes are limited to the § 4 table. */
export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra?: { field?: string; details?: Record<string, unknown> },
): RouterResponse {
  return {
    status,
    body: {
      error: {
        code,
        message,
        field: extra?.field ?? null,
        details: extra?.details ?? null,
      },
    },
  };
}

/**
 * The route table.
 *
 * M2: add the 19 routes from docs/04 § 2 here as the handlers land. Keep them
 * grouped by resource and keep the order stable - the first match wins, so the
 * static `/v1/listings/new`-style paths (none today) would go above the
 * `:param` ones.
 */
const routes: Route[] = [
  {
    method: 'GET',
    template: '/v1/health',
    handler: () => ({
      status: 200,
      body: {
        ok: true,
        service: 'deadstock-exchange-api',
        repoDriver: process.env.REPO_DRIVER ?? 'memory',
        time: new Date().toISOString(),
      },
    }),
  },
  { method: 'GET', template: '/v1/meta/categories', handler: getCategories },
  { method: 'GET', template: '/v1/businesses', handler: listBusinesses },
  { method: 'GET', template: '/v1/businesses/:businessId', handler: getBusiness },
  { method: 'POST', template: '/v1/listings', handler: createListing },
  { method: 'GET', template: '/v1/listings', handler: listListings },
  { method: 'GET', template: '/v1/listings/:listingId/matches', handler: getListingMatches },
  { method: 'GET', template: '/v1/listings/:listingId', handler: getListing },
  // POST   /v1/listings/:listingId/withdraw
  { method: 'POST', template: '/v1/requirements', handler: createRequirement },
  { method: 'GET', template: '/v1/requirements', handler: listRequirements },
  {
    method: 'GET',
    template: '/v1/requirements/:requirementId/matches',
    handler: getRequirementMatches,
  },
  { method: 'GET', template: '/v1/requirements/:requirementId', handler: getRequirement },
  { method: 'GET', template: '/v1/impact', handler: getImpact },
  // POST   /v1/requirements/:requirementId/cancel
  // POST   /v1/reservations                           -> handlers/reservations.ts
  // GET    /v1/reservations
  // GET    /v1/reservations/:reservationId
  // POST   /v1/reservations/:reservationId/handoff
  // POST   /v1/reservations/:reservationId/cancel
  // GET    /v1/impact                                 -> handlers/impact.ts
  // POST   /v1/uploads/listing-photo                  -> handlers/uploads.ts  (P1, M3)
];

function match(template: string, path: string): Record<string, string> | null {
  const t = template.split('/').filter(Boolean);
  const p = path.split('/').filter(Boolean);
  if (t.length !== p.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < t.length; i++) {
    const seg = t[i]!;
    const val = p[i]!;
    if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(val);
    else if (seg !== val) return null;
  }
  return params;
}

export async function handle(req: RouterRequest): Promise<RouterResponse> {
  for (const route of routes) {
    if (route.method !== req.method) continue;
    const params = match(route.template, req.path);
    if (!params) continue;
    try {
      return await route.handler(req, params);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        return apiError(err.status, err.code, err.message, {
          field: err.field ?? undefined,
          details: err.details ?? undefined,
        });
      }
      if (err instanceof InvalidCursorError) {
        return apiError(400, 'VALIDATION_FAILED', 'cursor is invalid.', { field: 'cursor' });
      }
      if (err instanceof EntityNotFoundError) {
        const codes = {
          business: 'BUSINESS_NOT_FOUND',
          listing: 'LISTING_NOT_FOUND',
          requirement: 'REQUIREMENT_NOT_FOUND',
          reservation: 'RESERVATION_NOT_FOUND',
        } as const;
        return apiError(404, codes[err.entity], err.message);
      }
      console.error(JSON.stringify({ level: 'error', path: req.path, err: String(err) }));
      return apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
    }
  }
  return apiError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}`);
}
