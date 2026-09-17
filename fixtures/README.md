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
5. Dates sit inside 17-30 September 2026. If the demo slips a day, update `availableUntil`
   and `requiredBy` here - in one place, not in four.
