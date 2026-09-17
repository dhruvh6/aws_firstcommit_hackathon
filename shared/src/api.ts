/**
 * Request and response types for every endpoint.
 *
 * OWNER: M2  (docs/08-TEAM-ROLES.md § 3)
 * SOURCE: docs/04-API-CONTRACT.md - FROZEN.
 *
 * Transcribe:
 *   - the three envelopes (§ 1): single resource, `{ items, meta }`, `{ error }`
 *   - `ApiErrorCode` - the complete § 4 table, and nothing outside it
 *   - one request type per POST body (§ 3)
 *   - one response type per route, including the three-resource reservation
 *     envelope `{ reservation, listing, requirement }`
 *   - query-parameter types for GET /listings and GET /reservations
 *
 * M1 imports these in web/src/api/client.ts; M2 validates against them.
 */

export {};
