/**
 * Method + path -> handler. Framework-free on purpose: the same router serves
 * the Lambda entry point (src/index.ts) and the local dev server
 * (src/local/server.ts), so local and deployed behaviour cannot diverge.
 *
 * OWNER: M2  (docs/08-TEAM-ROLES.md § 3)
 * ROUTES: docs/04-API-CONTRACT.md § 2 - all 19 of them. FROZEN.
 */

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
  code: string,
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
  // GET    /v1/meta/categories                        -> handlers/meta.ts
  // GET    /v1/businesses                             -> handlers/businesses.ts
  // GET    /v1/businesses/:businessId
  // POST   /v1/listings                               -> handlers/listings.ts
  // GET    /v1/listings
  // GET    /v1/listings/:listingId
  // POST   /v1/listings/:listingId/withdraw
  // GET    /v1/listings/:listingId/matches
  // POST   /v1/requirements                           -> handlers/requirements.ts
  // GET    /v1/requirements
  // GET    /v1/requirements/:requirementId
  // POST   /v1/requirements/:requirementId/cancel
  // GET    /v1/requirements/:requirementId/matches
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
      // M2: map domain errors (InsufficientQuantityError, InvalidStateError, …)
      // to their codes from docs/04 § 4 before this catch-all.
      console.error(JSON.stringify({ level: 'error', path: req.path, err: String(err) }));
      return apiError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
    }
  }
  return apiError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}`);
}
