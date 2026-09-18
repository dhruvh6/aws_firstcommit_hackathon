# 04 - API Contract  [FROZEN]

**Owner:** M2 implements it, M3 exposes it, M1 codes against it, M4 tests it.
**This is the seam the whole project hangs on.** Read it fully. Do not change it
unilaterally - process in [09-INTEGRATION-PLAN.md](09-INTEGRATION-PLAN.md) § Contract changes.

Entity shapes are **not repeated here**. They live in [02-DOMAIN-MODEL.md](02-DOMAIN-MODEL.md)
and in `shared/src/domain.ts`. This document covers routes, parameters, status codes and
errors only.

---

## 1. Basics

| Item | Value |
|---|---|
| Base URL (deployed) | `https://<api-id>.execute-api.ap-south-1.amazonaws.com/v1` - injected as `VITE_API_BASE_URL` |
| Base URL (local) | `http://localhost:3001/v1` |
| Region | `ap-south-1` (Mumbai) - lowest latency for the demo, and where the story is set |
| Protocol | REST-ish JSON over HTTPS. `Content-Type: application/json` on every request with a body |
| Versioning | `/v1` prefix. A breaking change ships as `/v2`, never as a silent edit |
| Auth | **None in P0.** Every request carries `X-Business-Id: biz_...` identifying the acting business |
| CORS | `Access-Control-Allow-Origin: *` in dev; the Amplify domain in prod. Allowed headers: `content-type, x-business-id` |
| Time | All timestamps ISO 8601 UTC; all dates ISO `YYYY-MM-DD` |

### `X-Business-Id`

Required on **every write** and on any read that is scoped to "me" (`?mine=true`,
reservations, impact). Missing or unknown on a write -> `401 BUSINESS_NOT_IDENTIFIED`.
The server never trusts a `businessId` in a request body for identity; the body field is
ignored if present and the header wins. When Cognito lands (P1), the header is replaced by
a JWT claim and **no route signature changes** - that is why identity is a header and not a
path parameter.

### Response envelopes

```jsonc
// single resource -> the resource object itself
{ "listingId": "lst_001", "title": "...", ... }

// collection
{ "items": [ ... ], "meta": { "count": 12, "nextCursor": "eyJ..." | null, "truncated": false } }

// error - every non-2xx, without exception
{ "error": { "code": "INSUFFICIENT_QUANTITY", "message": "Only 30 kg available", "field": null, "details": { "availableQuantity": 30 } } }
```

`message` is human-readable and **may be shown to the user**. `code` is what the client
branches on - never branch on `message`.

## 2. Route table

| Method | Path | Purpose | Header | Owner | Build |
|---|---|---|---|---|---|
| GET | `/v1/meta/categories` | Category taxonomy, units, attribute schema, enum labels | - | M2 | **P0** |
| GET | `/v1/businesses` | All demo businesses (powers the business switcher) | - | M2 | **P0** |
| GET | `/v1/businesses/{businessId}` | One business | - | M2 | cut |
| POST | `/v1/listings` | Create a surplus listing | yes | M2 | **P0** |
| GET | `/v1/listings` | Browse / search / filter | optional | M2 | **P0** |
| GET | `/v1/listings/{listingId}` | Listing detail | optional | M2 | **P0** |
| POST | `/v1/listings/{listingId}/withdraw` | Supplier closes a listing early | yes | M2 | cut |
| GET | `/v1/listings/{listingId}/matches` | Requirements that need this material | yes | M2 | cut |
| POST | `/v1/requirements` | Post a material requirement (use `?withMatches=true`) | yes | M2 | **P0** |
| GET | `/v1/requirements` | List requirements | optional | M2 | cut |
| GET | `/v1/requirements/{requirementId}` | Requirement detail | optional | M2 | cut |
| POST | `/v1/requirements/{requirementId}/cancel` | Cancel a requirement | yes | M2 | cut |
| GET | `/v1/requirements/{requirementId}/matches` | **The core match endpoint** | yes | M2 | **P0** |
| POST | `/v1/reservations` | Reserve a quantity | yes | M2 | **P0** |
| GET | `/v1/reservations` | My reservations, both sides | yes | M2 | **P0** |
| GET | `/v1/reservations/{reservationId}` | Reservation detail | yes | M2 | cut |
| POST | `/v1/reservations/{reservationId}/handoff` | Supplier confirms transfer | yes | M2 | **P0** |
| POST | `/v1/reservations/{reservationId}/cancel` | Buyer cancels a hold | yes | M2 | cut |
| GET | `/v1/impact` | Impact dashboard aggregates | optional | M2 | **P0** |
| POST | `/v1/uploads/listing-photo` | Presigned S3 PUT | yes | M3 | cut (was P1) |

### Scope cut - 18 September

**Eleven routes marked P0, nine cut.** M2's first delivery moved to Day 3, so the backend
surface was cut to exactly what the demo shot list in
[10-DEMO-AND-SUBMISSION.md](10-DEMO-AND-SUBMISSION.md) § 4 walks through. Roughly 40% less
backend work; the demo loses nothing.

Cut does **not** mean "build it if there's time" - it means the route does not exist, the
UI does not call it, and the write-up does not claim it. A cut route is a one-line
future-work bullet, which costs nothing. A half-built route on Day 4 costs the demo.

Consequences the team must respect:

- **The cut endpoints have no UI.** M1: no withdraw button, no cancel-reservation button, no
  supplier-side "who needs this?" screen, no photo upload. Remove those affordances rather
  than wiring them to nothing.
- **Nothing on the demo path was cut.** List surplus, post requirement, see explained
  matches, reserve a partial quantity, confirm handoff, watch impact update: all P0.
- **The EventBridge sweeper drops to optional.** It is one of the six services in the
  architecture story, so if it is not built, say so plainly in the write-up instead of
  showing it in the diagram. An honest five-service architecture beats a claimed sixth.
- **The contract suite in § 5 covers the eleven P0 routes only** (`api/test/contract.test.ts`).

Reinstating a cut route needs the § 5 suite green on all eleven P0 routes first.

State-changing verbs are `POST /{id}/{action}`, not `PATCH` with a status field. The client
cannot invent a state transition, and each action maps to exactly one server-side
transaction from [02](02-DOMAIN-MODEL.md) § 10.

---

## 3. Endpoints

### `GET /v1/meta/categories`

Static reference data, fetched once at app start and cached. Lets M1 build forms and labels
without hardcoding enums in components.

```json
{
  "items": [
    {
      "code": "WOOD_OFFCUTS",
      "label": "Wood & plywood offcuts",
      "canonicalUnit": "KG",
      "allowedUnits": ["KG"],
      "icon": "wood",
      "attributeFields": [
        { "key": "minPieceSizeCm", "label": "Smallest piece size (cm)", "type": "number", "required": true,  "min": 1, "max": 500 },
        { "key": "maxPieceSizeCm", "label": "Largest piece size (cm)",  "type": "number", "required": true,  "min": 1, "max": 500 },
        { "key": "treated",        "label": "Chemically treated",       "type": "boolean", "required": true },
        { "key": "woodType",       "label": "Wood type",                "type": "text",    "required": false, "maxLength": 40 }
      ],
      "constraintFields": [
        { "key": "minPieceSizeCm", "label": "Minimum usable piece size (cm)", "type": "number", "required": false, "min": 1, "max": 500 },
        { "key": "allowTreated",   "label": "Accept treated material",        "type": "boolean", "required": false },
        { "key": "woodType",       "label": "Required wood type",             "type": "text",    "required": false }
      ]
    }
  ],
  "enumLabels": {
    "condition": { "UNUSED": "Unused", "CLEAN_USABLE": "Clean, usable", "MIXED": "Mixed", "NEEDS_SORTING": "Needs sorting" },
    "unit": { "KG": "kg", "UNITS": "units", "SHEETS": "sheets", "METRES": "m" },
    "handoffMode": { "PICKUP": "Buyer collects", "DROP_OFF": "Supplier delivers", "EITHER": "Either" },
    "listingStatus": { "ACTIVE": "Available", "PARTIALLY_RESERVED": "Partly reserved", "FULLY_RESERVED": "Fully reserved", "COMPLETED": "Completed", "EXPIRED": "Expired", "WITHDRAWN": "Withdrawn" },
    "requirementStatus": { "OPEN": "Open", "PARTIALLY_FULFILLED": "Partly fulfilled", "FULFILLED": "Fulfilled", "EXPIRED": "Expired", "CANCELLED": "Cancelled" },
    "reservationStatus": { "RESERVED": "Reserved", "HANDED_OFF": "Handed off", "CANCELLED": "Cancelled", "EXPIRED": "Expired" }
  }
}
```

The full payload for all four categories is committed at
[`../fixtures/meta-categories.json`](../fixtures/meta-categories.json) - M2 serves that
file's content; M1 mocks with the same file. One source, no drift.

---

### `POST /v1/listings`

Request - client sends facts only; every derived field is rejected if present.

```json
{
  "title": "Plywood offcuts, clean and dry",
  "category": "WOOD_OFFCUTS",
  "description": "Weekly production offcuts from furniture assembly. Irregular shapes, clean edges.",
  "totalQuantity": 80,
  "unit": "KG",
  "condition": "CLEAN_USABLE",
  "attributes": { "category": "WOOD_OFFCUTS", "minPieceSizeCm": 15, "maxPieceSizeCm": 40, "treated": false, "woodType": "Plywood" },
  "availableFrom": "2026-09-17",
  "availableUntil": "2026-09-20",
  "handoffMode": "PICKUP",
  "referencePriceInr": 28
}
```

`201` -> the created `SurplusListing`, with `availableQuantity === totalQuantity`,
`reservedQuantity: 0`, `handedOffQuantity: 0`, `status: "ACTIVE"`.

Location is **not** in the body: it is copied from the acting business. One address of
record per business; nothing to keep in sync.

Validation (all server-side; `400 VALIDATION_FAILED` with `field` set to the first offender):

| Field | Rule |
|---|---|
| `title` | required, 3-80 chars |
| `category` | required, one of the four codes |
| `totalQuantity` | required, `> 0`, `<= 100000`, max 2 dp |
| `unit` | required, in the category's `allowedUnits` |
| `condition` | required, valid enum |
| `attributes` | required; `attributes.category` must equal `category`; every `required: true` field present and in range; unknown keys rejected |
| `availableFrom` | required, ISO date, `>= today` |
| `availableUntil` | required, ISO date, `>= availableFrom`, `<= today + 90 days` |
| `handoffMode` | required, valid enum |
| `description` | optional, `<= 500` chars |
| `referencePriceInr` | optional, integer, `0 < p <= 100000` |

---

### `GET /v1/listings`

| Param | Type | Default | Notes |
|---|---|---|---|
| `category` | enum | - | Repeatable: `?category=WOOD_OFFCUTS&category=ACRYLIC_SHEET` |
| `condition` | enum | - | Repeatable |
| `q` | string | - | Case-insensitive substring over `title`, `description`, `businessName` |
| `minQuantity` | number | - | `availableQuantity >= minQuantity` |
| `maxQuantity` | number | - | |
| `city` | string | `Mumbai` | |
| `availableOn` | ISO date | - | Window must cover this date |
| `originBusinessId` | string | header value | Origin for `distanceKm` and `maxDistanceKm` |
| `maxDistanceKm` | number | - | Requires an origin; ignored without one |
| `status` | enum | `ACTIVE,PARTIALLY_RESERVED` | Repeatable. Default hides expired/withdrawn/completed stock |
| `mine` | boolean | `false` | `true` -> only the acting business's listings, and the status default widens to all |
| `sort` | enum | `RECENT` | `RECENT` \| `EXPIRING_SOON` \| `QUANTITY_DESC` \| `DISTANCE_ASC` (needs an origin) |
| `limit` | number | `24` | 1-100 |
| `cursor` | string | - | Opaque; echo back `meta.nextCursor` |

Each item is a `SurplusListing` plus, when an origin is resolvable, `distanceKm`. Filters
are AND-combined; a repeated param is OR-combined within itself. Empty result is `200` with
`items: []` - never `404`.

---

### `POST /v1/requirements`

```json
{
  "category": "WOOD_OFFCUTS",
  "requestedQuantity": 50,
  "unit": "KG",
  "acceptedConditions": ["UNUSED", "CLEAN_USABLE"],
  "constraints": { "category": "WOOD_OFFCUTS", "minPieceSizeCm": 10, "allowTreated": false },
  "radiusKm": 15,
  "requiredBy": "2026-09-19",
  "notes": "For non-structural decor pieces. Irregular shapes are fine."
}
```

`201` -> the created `Requirement` (`status: "OPEN"`, `fulfilledQuantity: 0`,
`reservedQuantity: 0`).

Validation: `requestedQuantity > 0` and `<= 100000`; `acceptedConditions` non-empty with
valid enums; `radiusKm` integer `1..50`; `requiredBy >= today`, `<= today + 90 days`;
`constraints.category === category`; `unit` in the category's `allowedUnits`.

**M1 convenience:** `POST /v1/requirements?withMatches=true` returns
`{ "requirement": {...}, "matches": [...] }` in one round trip, so the buyer submitting the
form lands directly on results. This is the call behind the demo's WOW moment at 1:35 -
one request, match set on screen. Same match payload as below.

---

### `GET /v1/requirements/{requirementId}/matches`  ← the core endpoint

| Param | Type | Default | Notes |
|---|---|---|---|
| `includeNearMisses` | boolean | `true` | Incompatible listings with reasons ([03](03-MATCHING-SPEC.md) § 2) |
| `limit` | number | `20` | Compatible matches; near-misses capped at 10 on top |

```json
{
  "requirement": { "requirementId": "req_001", "...": "..." },
  "items": [
    {
      "listingId": "lst_001",
      "requirementId": "req_001",
      "compatibleQuantity": 50,
      "distanceKm": 6.9,
      "score": 0.7739,
      "compatible": true,
      "checks": [
        { "code": "CATEGORY_COMPATIBLE",  "passed": true,  "detail": "Material category matches: Wood & plywood offcuts (kg)" },
        { "code": "QUANTITY_AVAILABLE",   "passed": true,  "detail": "80 kg available, 50 kg needed - 50 kg can be reserved" },
        { "code": "ATTRIBUTES_SATISFIED", "passed": true,  "detail": "Smallest piece 15 cm meets your 10 cm minimum; untreated as required" },
        { "code": "CONDITION_ACCEPTED",   "passed": true,  "detail": "Condition \"Clean, usable\" is one you accept" },
        { "code": "AVAILABILITY_WINDOW",  "passed": true,  "detail": "Available until 20 Sep, before your 19 Sep deadline" },
        { "code": "WITHIN_SERVICE_AREA",  "passed": true,  "detail": "6.9 km away, inside your 15 km radius" }
      ],
      "listing": { "listingId": "lst_001", "...": "..." }
    }
  ],
  "meta": { "count": 3, "compatibleCount": 1, "nearMissCount": 2, "truncated": false, "evaluatedAt": "2026-09-17T09:31:02.144Z" }
}
```

Guarantees M1 can rely on:

1. `checks` always has **all six**, in the order of [03](03-MATCHING-SPEC.md) § 2.
2. `compatible === checks.every(c => c.passed)`.
3. `listing` is fully embedded - a match card needs no second fetch.
4. Compatible items precede near-misses; within a group, `score` descending.
5. `score` is for ordering and tests. **Do not render it** ([03](03-MATCHING-SPEC.md) § 6).

`403 NOT_YOUR_REQUIREMENT` if the acting business does not own the requirement.

### `GET /v1/listings/{listingId}/matches`

Mirror image: `{ "listing": {...}, "items": [ { ..., "requirement": {...} } ], "meta": {...} }`.
Same six checks, roles swapped, `radiusKm` always from the requirement.
`403 NOT_YOUR_LISTING` if the acting business is not the supplier.

---

### `POST /v1/reservations`

```json
{ "listingId": "lst_001", "requirementId": "req_001", "reservedQuantity": 50 }
```

`requirementId` is optional - omitted for browse-and-reserve without a posted requirement.
The server recomputes the six checks at this moment, **rejects if the listing is no longer
compatible**, and snapshots the passing checks into `matchReasons`. The client's view of
compatibility is never trusted.

`201` -> `{ "reservation": Reservation, "listing": SurplusListing, "requirement": Requirement | null }`

All three affected resources come back in one response, so the UI updates the supplier's
remaining stock (80 -> 30) without a refetch. This is the 1:55 demo beat.

Errors:

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_FAILED` | `reservedQuantity <= 0`, more than 2 dp, missing `listingId` |
| 404 | `LISTING_NOT_FOUND` / `REQUIREMENT_NOT_FOUND` | unknown id |
| 409 | `INSUFFICIENT_QUANTITY` | `reservedQuantity > availableQuantity`; `details.availableQuantity` carries the live value |
| 409 | `LISTING_NOT_AVAILABLE` | listing `EXPIRED`, `WITHDRAWN`, `COMPLETED` or `FULLY_RESERVED` |
| 409 | `INVALID_STATE` | requirement `FULFILLED`, `CANCELLED` or `EXPIRED` |
| 409 | `NOT_COMPATIBLE` | a hard check now fails; `details.failedChecks` lists the codes |
| 409 | `SELF_RESERVATION` | buyer and supplier are the same business |
| 422 | `EXCEEDS_REQUIREMENT` | `reservedQuantity > remainingRequirement` when a requirement is linked |

### `POST /v1/reservations/{reservationId}/handoff`

Body: `{ "note": "Collected by buyer's van, 2 trips" }` (optional, `<= 200` chars).
Supplier only - `403 NOT_YOUR_RESERVATION` otherwise.

`200` -> `{ "reservation": Reservation, "listing": SurplusListing, "requirement": Requirement | null, "impactRecord": ImpactRecord }`

The transaction is [02](02-DOMAIN-MODEL.md) § 10. On a reservation that is already
`HANDED_OFF`, return `409 INVALID_STATE` and change nothing - never write a second
ImpactRecord. **The demo will double-click this button.**

### `POST /v1/reservations/{reservationId}/cancel`

Body: `{ "reason": "Buyer no longer needs the material" }` (optional). Buyer or supplier may
cancel a `RESERVED` reservation. Quantity returns to the listing; **no ImpactRecord is
written, ever**. `200` with the same three-resource envelope (no `impactRecord`).

### `GET /v1/reservations`

| Param | Default | Notes |
|---|---|---|
| `role` | `ALL` | `BUYER` \| `SUPPLIER` \| `ALL` - which side the acting business is on |
| `status` | all | Repeatable |
| `limit` / `cursor` | `24` | |

Returns reservations where the acting business is buyer or supplier. Supplier-side
`RESERVED` rows are the "Incoming reservations - confirm handoff" queue on the dashboard.

---

### `GET /v1/impact`

| Param | Default | Notes |
|---|---|---|
| `scope` | `PLATFORM` | `PLATFORM` \| `MINE` (`MINE` needs the header) |
| `from` / `to` | all time | ISO dates on `completedAt` |

```json
{
  "totals": {
    "quantityReusedByUnit": { "KG": 50, "UNITS": 0, "SHEETS": 0, "METRES": 0 },
    "completedExchanges": 1,
    "activeSurplusByUnit": { "KG": 30, "UNITS": 400, "SHEETS": 60, "METRES": 0 },
    "requirementsFulfilledFully": 0,
    "requirementsFulfilledPartially": 1,
    "requirementsOpen": 3,
    "fulfilmentRatePct": 25,
    "medianHoursListingToReservation": 1.4,
    "estimatedProcurementAvoidedInr": 1400
  },
  "byCategory": [
    { "category": "WOOD_OFFCUTS", "quantityReused": 50, "unit": "KG", "completedExchanges": 1, "activeSurplus": 30 }
  ],
  "dailySeries": [
    { "date": "2026-09-17", "quantityReused": 0,  "completedExchanges": 0 },
    { "date": "2026-09-18", "quantityReused": 50, "completedExchanges": 1 }
  ],
  "meta": { "sourceRecordCount": 1, "generatedAt": "2026-09-18T11:02:00.000Z" }
}
```

Rules that keep this number honest:

1. Every figure aggregates **ImpactRecord rows only** - handed off, never merely reserved.
2. `quantityReusedByUnit` is keyed by unit. **Never sum kg with units or sheets** into one
   number. M1: never render a single "total material reused" figure across units.
3. `estimatedProcurementAvoidedInr` appears only where a `referencePriceInr` existed, and
   the UI must label it "estimated". Omitted entirely when zero records carry a price.
4. No CO2e, no "trees saved", no environmental extrapolation - server or client.
5. `meta.sourceRecordCount` is displayed in small print on the impact page, so a judge can
   see the numbers come from real transactions.

---

### `POST /v1/uploads/listing-photo`  (P1)

`{ "contentType": "image/jpeg", "sizeBytes": 482911 }` -> `201`
`{ "uploadUrl": "https://...", "photoKey": "listings/2026/09/uuid.jpg", "expiresInSeconds": 300 }`

Client PUTs the bytes straight to S3, then sends `photoKey` when creating the listing.
`image/jpeg`, `image/png`, `image/webp` only; `<= 5 MB`; presigned URL valid 5 minutes.
Until this ships, `photoKey` is absent and the UI renders a category placeholder.

## 4. Error codes - complete list

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_FAILED` | Body or query failed validation; `field` names the offender |
| 400 | `MALFORMED_JSON` | Body was not valid JSON |
| 401 | `BUSINESS_NOT_IDENTIFIED` | `X-Business-Id` missing or unknown on a route that needs it |
| 403 | `NOT_YOUR_LISTING` / `NOT_YOUR_REQUIREMENT` / `NOT_YOUR_RESERVATION` | Acting business is not the owner |
| 404 | `LISTING_NOT_FOUND` / `REQUIREMENT_NOT_FOUND` / `RESERVATION_NOT_FOUND` / `BUSINESS_NOT_FOUND` | Unknown id |
| 404 | `ROUTE_NOT_FOUND` | No such route |
| 409 | `INSUFFICIENT_QUANTITY` | Conditional write failed on available quantity |
| 409 | `LISTING_NOT_AVAILABLE` | Listing not in a reservable state |
| 409 | `INVALID_STATE` | Illegal state transition (includes a double handoff) |
| 409 | `NOT_COMPATIBLE` | Server-side re-check failed at reservation time |
| 409 | `SELF_RESERVATION` | Same business on both sides |
| 422 | `EXCEEDS_REQUIREMENT` | Reservation larger than the remaining requirement |
| 500 | `INTERNAL_ERROR` | Unhandled - log the request id, return a generic message |

**Never invent a code outside this table.** M1 maps codes to copy; an unlisted code renders
the generic error state and is a bug on M2's side. Every 4xx must be actionable by the user;
if it is not, it is a 500.

## 5. Contract test suite

M4 owns `api/test/contract.http` (or `contract.test.ts`) covering, in order:

1. `GET /meta/categories` -> 4 categories, every enum label present
2. `POST /listings` with fixture `lst_001` body -> `201`, `availableQuantity === 80`
3. `POST /listings` with `totalQuantity: -5` -> `400 VALIDATION_FAILED`, `field: "totalQuantity"`
4. `POST /requirements?withMatches=true` with `req_001` body -> `201`, `matches[0].listingId === "lst_001"`, six checks all `passed`
5. `GET /requirements/req_001/matches?includeNearMisses=true` -> `compatibleCount: 1`, `nearMissCount: 2`
6. `POST /reservations` 50 kg -> `201`, `listing.availableQuantity === 30`, `listing.status === "PARTIALLY_RESERVED"`
7. `POST /reservations` another 50 kg -> `409 INSUFFICIENT_QUANTITY`, `details.availableQuantity === 30`
8. `POST /reservations/{id}/handoff` -> `200`, impact record written, `listing.handedOffQuantity === 50`
9. Same handoff again -> `409 INVALID_STATE`, and `GET /impact` still reports `completedExchanges: 1`
10. `GET /impact` -> `quantityReusedByUnit.KG === 50`, `sourceRecordCount === 1`

This suite is the Day-3 integration gate. It must pass against the **deployed** API, not
only locally, before the demo is recorded.
