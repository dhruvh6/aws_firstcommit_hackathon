# 02 - Domain Model  [FROZEN]

**Owner:** M2 (logic) with M3 (storage). **Changes require a contract change** -
process in [09-INTEGRATION-PLAN.md](09-INTEGRATION-PLAN.md) § Contract changes.

This file is the single source of truth for entity shapes, field names, enum values and
state transitions. The TypeScript in this document is copied verbatim into
`shared/src/domain.ts` on Day 1 and imported by both `web/` and `api/`. Field names here
are the field names on the wire, in the database, and in the UI.

---

## 1. Conventions

| Rule | Value |
|---|---|
| IDs | Opaque strings, prefixed by type: `biz_`, `lst_`, `req_`, `rsv_`, `imp_`. Generated with `crypto.randomUUID()`, prefix prepended |
| Timestamps | ISO 8601 UTC strings, e.g. `2026-09-17T09:30:00.000Z`. Never epoch numbers |
| Dates (no time) | ISO date strings, `2026-09-20`. Availability windows are date-granular |
| Quantities | `number`, non-negative, max 2 decimal places. Never strings |
| Enums | `SCREAMING_SNAKE_CASE` string literals. Never numeric enums |
| Money | `number` in INR, integer rupees. Optional everywhere |
| Absent values | Omit the key or use `null`. Never `""`, never `-1`, never `0` as "unset" |
| Casing | `camelCase` on the wire and in DynamoDB attributes |

## 2. Entity overview

```
Business ──┬── SurplusListing ──┐
           │                    ├── Reservation ── ImpactRecord
           └── Requirement ─────┘
                    │
                    └── Match  (computed, not stored)
```

Six entities in the brief; **five are persisted**. `Match` is computed on request and
never written as its own row - the reasons that justified a match are denormalised onto
the `Reservation` at the moment of reservation, which is the only time they need to be
durable. This removes a whole table, a staleness class of bug, and a sync step between
M2 and M3. Documented deviation from the original brief, deliberate.

## 3. Enums

```ts
export const MATERIAL_CATEGORIES = [
  'WOOD_OFFCUTS',
  'FABRIC_OFFCUTS',
  'PACKAGING_CARDBOARD',
  'ACRYLIC_SHEET',
] as const;
export type MaterialCategory = typeof MATERIAL_CATEGORIES[number];

export const UNITS = ['KG', 'UNITS', 'SHEETS', 'METRES'] as const;
export type Unit = typeof UNITS[number];

/** Ordered best -> worst. Comparison is by index, so order is part of the contract. */
export const CONDITIONS = ['UNUSED', 'CLEAN_USABLE', 'MIXED', 'NEEDS_SORTING'] as const;
export type Condition = typeof CONDITIONS[number];

export const LISTING_STATUS = [
  'ACTIVE',            // available, no reservations
  'PARTIALLY_RESERVED',// some quantity reserved, some still available
  'FULLY_RESERVED',    // availableQuantity === 0, nothing handed off yet
  'COMPLETED',         // all quantity handed off
  'EXPIRED',           // availableUntil passed with quantity remaining
  'WITHDRAWN',         // supplier closed it early
] as const;
export type ListingStatus = typeof LISTING_STATUS[number];

export const REQUIREMENT_STATUS = [
  'OPEN',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type RequirementStatus = typeof REQUIREMENT_STATUS[number];

export const RESERVATION_STATUS = [
  'RESERVED',    // buyer holds quantity, awaiting supplier handoff confirmation
  'HANDED_OFF',  // supplier confirmed physical transfer -> terminal, writes ImpactRecord
  'CANCELLED',   // buyer withdrew -> quantity returned to listing
  'EXPIRED',     // hold lapsed -> quantity returned to listing
] as const;
export type ReservationStatus = typeof RESERVATION_STATUS[number];

export const HANDOFF_MODES = ['PICKUP', 'DROP_OFF', 'EITHER'] as const;
export type HandoffMode = typeof HANDOFF_MODES[number];
```

**Never add an enum value without a contract change.** M1 renders a label for every value;
an unknown value must fall back to a raw-string chip rather than crash - see
[07-DESIGN-SYSTEM.md](07-DESIGN-SYSTEM.md) § Unknown enum fallback.

## 4. Business

```ts
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
```

**No contact fields.** No phone, no email, no address line, no contact person - not in the
schema, not in fixtures, not in the UI. Businesses are synthetic; handoff coordination is
out of scope, so contact data has no job here and is a liability if collected. If a handoff
needs a location string, use `area` + `city`.

## 5. SurplusListing

```ts
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
```

### Invariants - enforced server-side, tested by M2

1. `availableQuantity + reservedQuantity + handedOffQuantity === totalQuantity` at all times.
2. `availableQuantity >= 0`. Guaranteed by a conditional write, never by a read-then-write.
3. `totalQuantity > 0` at creation and never mutated afterwards.
4. `availableUntil >= availableFrom`, and `availableUntil >= today` at creation.
5. `status` is **derived**, never set by the client. Derivation table in § 9.
6. `unit` must be legal for `category` (§ 8).

## 6. Requirement

```ts
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
```

### Invariants

1. `fulfilledQuantity + reservedQuantity <= requestedQuantity`.
2. `acceptedConditions.length >= 1`.
3. `radiusKm` in `[1, 50]`.
4. `requiredBy >= today` at creation.
5. `unit` must match the category's canonical unit, and must equal a listing's `unit` for
   a match to be possible (§ [03-MATCHING-SPEC.md](03-MATCHING-SPEC.md) C1).

## 7. Reservation, Match, ImpactRecord

```ts
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
  code: MatchCheckCode;            // see 03 § Reason codes
  passed: boolean;
  detail: string;                  // server-rendered human sentence, <= 90 chars
}

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
  expiresAt: string;               // createdAt + 48h (demo: + 30 min, see 10 § Seed)
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
```

**`matchReasons` is a snapshot, on purpose.** A reservation must always be able to show why
it was made, even after the listing changes. Never re-derive reasons for a past reservation.

**`ImpactRecord` is append-only.** It is written exactly once, inside the handoff
transaction, and never updated or deleted. Every number on the impact dashboard traces
to a row here - that traceability is the defence against inflated impact claims.

## 8. Material taxonomy and attributes

`attributes` (listing) and `constraints` (requirement) are the two sides of the same
category schema. A listing states facts; a requirement states bounds.

```ts
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
```

| Category | Canonical unit | Also allowed | Attribute semantics |
|---|---|---|---|
| `WOOD_OFFCUTS` | `KG` | - | Listing declares the piece-size range present in the lot. Buyer's `minPieceSizeCm` is checked against the listing's `minPieceSizeCm` - the smallest piece must still be usable |
| `FABRIC_OFFCUTS` | `KG` | `METRES` | Same range semantics on length; `gsm` optional both sides |
| `PACKAGING_CARDBOARD` | `UNITS` | `KG` | `minPly` is a floor; `allowPrinted: false` excludes printed stock |
| `ACRYLIC_SHEET` | `SHEETS` | `KG` | `thicknessMm` must fall inside the buyer's band; sheet-size floor as above |

**A constraint that is absent is not a constraint.** `undefined` means "buyer does not
care", and the corresponding check passes with detail `"No dimension requirement specified"`.
Never default an absent constraint to `0` and never treat it as a failure.

**Category never cross-matches.** `WOOD_OFFCUTS` never matches `PACKAGING_CARDBOARD`. There
are no substitute categories in the MVP; the substitution table is future work.

## 9. State machines

### SurplusListing

```
                 reserve (partial)              reserve (remainder)
  ACTIVE ──────────────────────> PARTIALLY_RESERVED ──────────> FULLY_RESERVED
    │  │                               │    ▲                        │
    │  │ withdraw                      │    │ cancel/expire          │ all handed off
    │  ▼                               │    └────────────────────────┤
    │ WITHDRAWN                        │ all reserved handed off     ▼
    │                                  └──────────────────────> COMPLETED
    │ availableUntil < today
    └──────────────────────────> EXPIRED
```

Status is derived after every quantity change, in this order - first match wins:

| Condition | Status |
|---|---|
| Supplier withdrew | `WITHDRAWN` |
| `handedOffQuantity === totalQuantity` | `COMPLETED` |
| `availableUntil < today` and `availableQuantity > 0` | `EXPIRED` |
| `availableQuantity === 0` | `FULLY_RESERVED` |
| `reservedQuantity > 0` or `handedOffQuantity > 0` | `PARTIALLY_RESERVED` |
| otherwise | `ACTIVE` |

### Requirement

```
  OPEN ──reserve(partial)──> PARTIALLY_FULFILLED ──handoff completes total──> FULFILLED
   │                                   │
   │ cancel                            │ requiredBy passed
   ▼                                   ▼
  CANCELLED                         EXPIRED
```

`FULFILLED` requires `fulfilledQuantity >= requestedQuantity` - handed off, not merely
reserved. A reservation moves a requirement to `PARTIALLY_FULFILLED` at most.

### Reservation

```
  RESERVED ──supplier confirms──> HANDED_OFF   (terminal, writes ImpactRecord)
     │  │
     │  └──buyer cancels──> CANCELLED   (quantity returned to listing)
     │
     └─────expiresAt passed──> EXPIRED  (quantity returned to listing)
```

Only `RESERVED` is a legal source state. Confirming an already-terminal reservation returns
`409 INVALID_STATE` and changes nothing - this endpoint must be idempotent-safe, because the
demo will double-click it.

## 10. Quantity mechanics - the correctness core

This section is the highest-risk logic in the product. Read it twice.

### Reserve `q` against listing `L`

Atomically, in one DynamoDB conditional update:

```
CONDITION  availableQuantity >= q  AND  status IN (ACTIVE, PARTIALLY_RESERVED)
SET        availableQuantity = availableQuantity - q
           reservedQuantity  = reservedQuantity  + q
```

Condition fails -> `409 INSUFFICIENT_QUANTITY`, with current `availableQuantity` in the
error body so the UI can refresh the stepper instead of guessing.

**Never** read `availableQuantity`, subtract in application code, then write. Two buyers on
Day-4 demo day will hit that window.

### Confirm handoff of reservation `R`

One transaction, all-or-nothing:

```
1. Reservation:   status RESERVED -> HANDED_OFF, set handedOffAt   (conditional on RESERVED)
2. Listing:       reservedQuantity -= q ; handedOffQuantity += q ; re-derive status
3. Requirement:   reservedQuantity -= q ; fulfilledQuantity += q ; re-derive status  (if linked)
4. ImpactRecord:  create, keyed on reservationId so a retry cannot double-count
```

### Cancel or expire reservation `R`

```
1. Reservation:   status RESERVED -> CANCELLED | EXPIRED           (conditional on RESERVED)
2. Listing:       reservedQuantity -= q ; availableQuantity += q ; re-derive status
3. Requirement:   reservedQuantity -= q ; re-derive status         (if linked)
```

No ImpactRecord. Cancelled material was never reused, and must never appear in impact.

### Rounding

Quantities carry at most 2 decimals. Round **once**, at input validation, with
`Math.round(x * 100) / 100`. Never round inside arithmetic - that is how invariant 1 drifts.

## 11. Derived values the client must not compute

| Value | Why server-owned |
|---|---|
| `status` (all three entities) | Derivation must be identical everywhere; UI would drift |
| `compatibleQuantity` | Depends on live `availableQuantity` |
| `checks[].detail` | Wording must match between card, reservation snapshot and demo |
| `distanceKm` | One haversine implementation, server-side |
| Every impact number | Must trace to ImpactRecord rows |

The client computes only presentation: percentage bars, relative dates, compaction
(`12.9K`), and label lookups for enum values.
