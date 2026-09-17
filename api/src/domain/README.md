# api/src/domain - OWNER: M2

**Pure functions only.** No database calls, no `await`, no `Date.now()` - the
current date is passed in. This is what lets the whole engine be unit-tested with
zero AWS access, and it is why the matching tests can run on any machine.

| File | Source of truth |
|---|---|
| `matching.ts` | docs/03-MATCHING-SPEC.md - six checks, ranking, tie-breakers, detail strings |
| `quantity.ts` | docs/02-DOMAIN-MODEL.md § 10 - reserve / handoff / cancel arithmetic, 2-dp rounding |
| `status.ts` | docs/02-DOMAIN-MODEL.md § 9 - status derivation for all three entities |
