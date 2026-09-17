# 03 - Matching Engine Specification  [FROZEN]

**Owner:** M2. **Consumed by:** M1 (renders every check), M4 (tests every example here).

The matching engine is **deterministic, rule-based and explainable**. No ML, no model
training, no learned ranking, no opaque relevance score. Given the same inputs it returns
the same output, in the same order, on every machine. That property is what makes it
testable on Day 2 and demonstrable on Day 4.

Implementation lives in `api/src/domain/matching.ts` as **pure functions with no I/O** -
no database calls, no `await`, no clock reads. The current date is passed in as an
argument. This is what lets M2 unit-test the whole engine with zero AWS access, and what
lets M4 write the same assertions without a deployment.

---

## 1. Inputs and outputs

```ts
export interface MatchInput {
  requirement: Requirement;
  listings: SurplusListing[];   // pre-filtered candidate set
  today: string;                // ISO date, injected - never read the clock in here
  includeNearMisses: boolean;
}

export function findMatches(input: MatchInput): Match[];
```

The caller (`api/src/handlers/matches.ts`) supplies candidates already narrowed by
category and city via a DynamoDB GSI query - see [05](05-ARCHITECTURE.md) § Access
patterns. The engine does not assume that narrowing and re-checks category anyway.

## 2. The six checks

Evaluated in this fixed order. **Every match object always carries all six checks**, each
with `passed` and a server-rendered `detail` sentence, whether the match is compatible or
not. The UI never invents wording.

| # | Code | Question | Pass condition |
|---|---|---|---|
| C1 | `CATEGORY_COMPATIBLE` | Is it the same material, measured the same way? | `listing.category === requirement.category` **and** `listing.unit === requirement.unit` |
| C2 | `QUANTITY_AVAILABLE` | Is any usable quantity available? | `listing.availableQuantity > 0` **and** `remainingRequirement > 0` |
| C3 | `ATTRIBUTES_SATISFIED` | Do dimensions/grade meet the buyer's bounds? | Every specified constraint satisfied - § 4 |
| C4 | `CONDITION_ACCEPTED` | Is the condition acceptable to the buyer? | `requirement.acceptedConditions.includes(listing.condition)` |
| C5 | `AVAILABILITY_WINDOW` | Will it still be available when needed? | `listing.availableUntil >= requirement.requiredBy` **and** `listing.availableFrom <= requirement.requiredBy` |
| C6 | `WITHIN_SERVICE_AREA` | Is it close enough to collect? | `distanceKm <= requirement.radiusKm` |

```
compatible === checks.every(c => c.passed)
```

### Hard gate vs explained checks

- **C1 is a gate.** If C1 fails the listing is dropped entirely and never returned, even
  with `includeNearMisses`. Showing a buyer why cardboard did not match their wood
  requirement is noise, not explanation.
- **C2-C6 are explained.** A listing that fails any of these is returned when
  `includeNearMisses` is true, with `compatible: false` and the failing check(s) marked.
  This is deliberate product design: *"3 more listings nearby did not match - here is
  exactly why"* is more useful, and more convincing to a judge, than an empty result.

## 3. Quantity semantics

```ts
remainingRequirement = requirement.requestedQuantity
                     - requirement.fulfilledQuantity
                     - requirement.reservedQuantity;

compatibleQuantity  = min(listing.availableQuantity, remainingRequirement);
```

`compatibleQuantity` is the **recommended reservation quantity**, and the default value of
the quantity stepper on the match card. Partial coverage is a normal, successful match:
a 30 kg listing against a 50 kg requirement is compatible, with `compatibleQuantity: 30`.
It is not a failure and must not be styled as one.

`compatibleQuantity` is `0` only when C2 fails, in which case the match is incompatible.

## 4. Attribute checks (C3), per category

An **absent constraint is not a constraint**: `undefined` passes with detail
`"No <thing> requirement specified"`. Never coerce absent to `0`.

### `WOOD_OFFCUTS`
| Constraint | Pass condition | Rationale |
|---|---|---|
| `minPieceSizeCm` | `listing.attributes.minPieceSizeCm >= constraint` | The *smallest* piece in the lot must still be usable, otherwise the buyer receives unusable fines |
| `allowTreated: false` | `listing.attributes.treated === false` | Treated wood is unsuitable for many secondary uses |
| `woodType` | `listing.attributes.woodType === constraint` (case-insensitive) | Only checked if the buyer named a type |

### `FABRIC_OFFCUTS`
| Constraint | Pass condition |
|---|---|
| `minPieceLengthCm` | `listing.attributes.minPieceLengthCm >= constraint` |
| `fabricType` | case-insensitive equality |
| `minGsm` / `maxGsm` | `listing.attributes.gsm` within band; **if the listing has no `gsm` and the buyer specified a band, C3 fails** with detail `"Listing does not state GSM"` - unknown is not acceptable when explicitly required |

### `PACKAGING_CARDBOARD`
| Constraint | Pass condition |
|---|---|
| `minPly` | `listing.attributes.ply >= constraint`; missing `ply` with a stated `minPly` fails |
| `allowPrinted: false` | `listing.attributes.printed === false` |

### `ACRYLIC_SHEET`
| Constraint | Pass condition |
|---|---|
| `minThicknessMm` / `maxThicknessMm` | `thicknessMm` within band |
| `minSheetSizeCm` | `listing.attributes.minSheetSizeCm >= constraint` |
| `colour` | case-insensitive equality |

**Rule for the whole of C3:** a stated buyer bound against an unstated listing fact is a
**fail**, not a pass. "We don't know" is not "yes" when someone asked.

## 5. Distance (C6)

Haversine, `R = 6371 km`, on `location` of listing and requirement. Rounded to one
decimal place for display and comparison.

```ts
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}
```

One implementation, server-side only. The UI displays `distanceKm`; it never computes it.

## 6. Ranking

Compatible matches first, then incompatible near-misses. Within each group, by `score`
descending.

```
coverage   = min(1, compatibleQuantity / remainingRequirement)
proximity  = max(0, 1 - distanceKm / requirement.radiusKm)
quality    = 1 - (indexOf(listing.condition) / (CONDITIONS.length - 1))   // UNUSED 1.0 ... NEEDS_SORTING 0.0
urgency    = 1 - min(1, daysUntil(listing.availableUntil, today) / 14)    // expiring sooner ranks higher

score = round4( 0.40 * coverage + 0.30 * proximity + 0.20 * quality + 0.10 * urgency )
```

`urgency` is intentional: material closest to being lost should surface first - that is the
circular-economy objective of the product, not an arbitrary weight.

### Tie-breakers, applied in order

1. `distanceKm` ascending
2. `availableUntil` ascending (earlier expiry first)
3. `listingId` ascending (lexicographic - guarantees a stable, reproducible order)

The third tie-breaker exists so that two machines running the same fixtures produce
byte-identical output. Do not remove it.

### `score` never reaches the UI as a number

The API returns it; the match card must not render it. Per [01](01-PRD.md) § 4, we show an
explanation, not a mysterious percentage. `score` exists to order cards and to be asserted
in tests. M1: do not add a "94% match" badge.

## 7. Reason detail strings

Server-rendered, `<= 90` characters, plain sentences, numbers included. These exact
strings appear on the match card, in the reservation snapshot, and in the demo, so they
are part of the contract.

| Code | Passed | Failed |
|---|---|---|
| `CATEGORY_COMPATIBLE` | `Material category matches: Wood & plywood offcuts (kg)` | *(gated - never returned)* |
| `QUANTITY_AVAILABLE` | `80 kg available, 50 kg needed - 50 kg can be reserved` | `No quantity currently available on this listing` |
| `ATTRIBUTES_SATISFIED` | `Smallest piece 15 cm meets your 10 cm minimum; untreated as required` | `Smallest piece 5 cm is below your 10 cm minimum` |
| `CONDITION_ACCEPTED` | `Condition "Clean, usable" is one you accept` | `Condition "Mixed" is not in your accepted list` |
| `AVAILABILITY_WINDOW` | `Available until 20 Sep, before your 19 Sep deadline` | `Available only until 18 Sep, after your 19 Sep deadline is 1 day short` |
| `WITHIN_SERVICE_AREA` | `6.9 km away, inside your 15 km radius` | `19.8 km away, outside your 15 km radius` |

When several constraints fail inside C3, report them in one sentence, semicolon-separated,
truncated at 90 characters with an ellipsis. One check, one chip, one sentence.

## 8. Worked examples - these are the Day 2 unit tests

All inputs come from [`../fixtures/`](../fixtures/), and the expected output - including every
score component - is committed as [`../fixtures/expected-matches.json`](../fixtures/expected-matches.json).
M2 writes these as tests; M4 verifies
them against the deployed API. If the deployed API disagrees with this table, the API is
wrong.

### Requirement `req_001` (the demo requirement)

`biz_002` Decor & Packaging Business B, Bandra West - `WOOD_OFFCUTS`, 50 kg,
accepts `UNUSED` and `CLEAN_USABLE`, `minPieceSizeCm: 10`, `allowTreated: false`,
`radiusKm: 15`, `requiredBy: 2026-09-19`. `today = 2026-09-17`.

| Listing | Result | Detail |
|---|---|---|
| `lst_001` 80 kg clean untreated offcuts 15-40 cm, Andheri East, until 20 Sep | **COMPATIBLE**, `compatibleQuantity: 50`, `distanceKm: 6.9` | all six pass; rank 1 |
| `lst_005` 25 kg mixed treated offcuts 5-20 cm, Andheri East, until 20 Sep | near-miss | C3 fails (5 cm < 10 cm, treated), C4 fails (`MIXED` not accepted) |
| `lst_006` 200 kg clean untreated offcuts 20-50 cm, Vashi, until 25 Sep | near-miss | C6 fails (19.8 km > 15 km); C2-C5 pass |
| `lst_002` cardboard, `lst_003` fabric, `lst_004` acrylic | **not returned** | C1 gate |

Expected: `matches.length === 1` with `includeNearMisses: false`; `3` with it true,
ordered `lst_001`, `lst_006`, `lst_005` (both near-misses score below any compatible
match; `lst_006` outranks `lst_005` on coverage and quality).

### After reserving 50 kg of `lst_001`

`lst_001.availableQuantity` becomes 30, `req_001.reservedQuantity` becomes 50, so
`remainingRequirement` becomes 0. Re-running the match:

- `lst_001` -> **C2 fails**: `remainingRequirement === 0`. Detail:
  `No quantity currently available on this listing` is wrong here - use the
  requirement-side wording `Your requirement is fully covered by existing reservations`.
- Requirement status is `PARTIALLY_FULFILLED`, and the Matches screen shows the
  "requirement covered" empty state, not a zero-result error.

This is the exact sequence in the demo at 1:55, so it must behave precisely this way.

## 9. Supplier-side matching (reverse direction)

`GET /listings/{listingId}/matches` answers *"who needs what I have?"* using the **same six
checks with the roles swapped**. One shared implementation, two entry points - do not fork
the logic.

- Candidate set: `OPEN` and `PARTIALLY_FULFILLED` requirements in the same category and city
- `radiusKm` always comes from the **requirement**, never the listing
- Ranking uses the same formula; `coverage` is computed per requirement
- Returns `Match[]` with `requirement` embedded instead of `listing` (see
  [04](04-API-CONTRACT.md) for the exact payload)

## 10. Edge cases - the ones that will actually happen

| Case | Required behaviour |
|---|---|
| No candidate listings at all | `200` with `matches: []`. Never `404` |
| Buyer's own listing matches their requirement | Excluded. `listing.businessId === requirement.businessId` is dropped silently at candidate selection, before C1 |
| Listing expires between match and reserve | Reserve returns `409 LISTING_NOT_AVAILABLE`; the UI refreshes the match set |
| Requirement already `FULFILLED` | `409 INVALID_STATE`; no matching performed |
| Quantities with decimals | Compare rounded to 2 dp; `49.995` needed against `50` available passes |
| `radiusKm` not set | Cannot happen - required field, validated `1..50` |
| Two listings identical in every respect | Tie-breaker 3 (`listingId`) orders them deterministically |
| `availableFrom` in the future, before `requiredBy` | C5 passes - the window is checked against the deadline, not against today |
| More than 50 matches | Return the top 50 compatible; append at most 10 near-misses. `meta.truncated: true` |
