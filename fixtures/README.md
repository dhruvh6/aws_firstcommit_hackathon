# Fixtures

Shared demo and test data. **Owner: M4.** Nobody else edits these files - open an issue.

This directory is one of the three artefacts that let four people work independently
(see [../docs/00-INDEX.md](../docs/00-INDEX.md)). All four members use the same numbers, so
screenshots, test output and demo state are comparable across machines.

| File | Used by | Purpose |
|---|---|---|
| `businesses.json` | all | 6 synthetic businesses. Powers the business switcher |
| `listings.json` | all | 6 surplus listings across the 4 categories |
| `requirements.json` | all | 4 material requirements |
| `meta-categories.json` | M1, M2 | Exact body of `GET /v1/meta/categories`. M2 serves it, M1 mocks it |
| `expected-matches.json` | M2, M4 | Test oracle for [../docs/03-MATCHING-SPEC.md](../docs/03-MATCHING-SPEC.md) § 8 |

## How each member uses it

- **M1** - MSW handlers read these files, so `npm run dev:web:mock` needs no backend.
- **M2** - `repo/memory.ts` seeds from them on boot; unit tests assert `expected-matches.json`.
- **M3** - `npm run seed:dynamo` loads them into the real tables.
- **M4** - `scripts/seed-demo.ts` resets to demo state; the contract suite asserts against them.

## Rules

1. **No real data.** Every business is invented. No contact details, no identity numbers, no
   personal data of any real person - not in these files, not in the schema
   ([../docs/02-DOMAIN-MODEL.md](../docs/02-DOMAIN-MODEL.md) § 4).
2. **`lst_005` and `lst_006` must stay as they are.** They exist to fail specific checks -
   `lst_005` on piece size, treatment and condition; `lst_006` on distance only. They are
   what makes the match-explanation panel convincing in the demo.
3. **Coordinates are real Mumbai-area points**, so `distanceKm` values are genuine:
   Andheri East -> Bandra West is 6.9 km, Vashi -> Bandra West is 19.8 km. Changing a
   coordinate invalidates `expected-matches.json`.
4. **`req_001` is excluded from the demo seed.** It is created live on camera at 1:10, so the
   match is genuinely computed during the recording. It stays in `requirements.json` because
   the tests need it.
5. **The dates in these files rot, and they rot before demo day.** Everything is written
   for 17 September. The API validates `availableFrom >= today` and `requiredBy >= today`
   (docs/04 § 3), and match check C5 needs `listing.availableUntil >= requirement.requiredBy`
   (docs/03 § 2). So:

   | Row | Field | Goes stale | Consequence |
   |---|---|---|---|
   | `req_001` | `requiredBy: 2026-09-19` | **20 Sep** | Cannot be created - `400` on `requiredBy`. It is created live on camera, so this breaks the demo |
   | `lst_001` | `availableUntil: 2026-09-20` | **21 Sep** | The demo's star listing stops matching |
   | `lst_005` | `availableUntil: 2026-09-20` | 21 Sep | The near-miss disappears from the explanation panel |

   The sharpest edge: **recording on 20 September**, a requirement created that day needs
   `requiredBy >= 2026-09-20`, and `lst_001` is only available *until* 2026-09-20. Pick
   `requiredBy: 2026-09-21` and C5 fails - the compatible match vanishes mid-demo.

   **Fix: `scripts/seed-demo.ts` shifts every date relative to the run date** rather than
   copying these literals - `availableFrom = today`, `availableUntil = today + 3`,
   `requiredBy = today + 1`. The relative offsets, not the absolute dates, are what these
   files really encode. Until that script exists, bump the literals by hand before any demo
   rehearsal and re-check `expected-matches.json`, whose `score` values depend on
   `availableUntil` through the `urgency` term.

6. Tests must **inject `today`** rather than read the clock, and assert `compatible`,
   `checks[].passed`, `compatibleQuantity`, `distanceKm` and result order - all
   date-independent - rather than bare `score` values, which are not.
