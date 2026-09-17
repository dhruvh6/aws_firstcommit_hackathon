# web/src/mocks - OWNER: M1

MSW handlers backed by `fixtures/`, so `npm run dev:web:mock` needs no backend.
This is what lets M1 finish all ten screens without waiting for M2 or M3.

| File | Purpose |
|---|---|
| `handlers.ts` | One handler per endpoint, reading the JSON in `fixtures/` |
| `browser.ts` | `setupWorker(...handlers)`, started from `main.tsx` when `VITE_USE_MOCKS === 'true'` |
| `state.ts` | Mutable in-memory copy of the fixtures so reserve/handoff visibly change quantities in mock mode |

Requirements:
- Mirror the **exact** payload shapes in docs/04 - including `meta` objects and
  the full six-item `checks` array. A mock that is more forgiving than the real
  API turns the Day-3 cutover into a rewrite.
- Mock the failure paths too: `409 INSUFFICIENT_QUANTITY`, `409 INVALID_STATE`,
  `400 VALIDATION_FAILED`. The error states in docs/06 cannot be built otherwise.
- **Keep MSW in the repo after the cutover.** `VITE_USE_MOCKS=true` is the
  offline fallback if AWS misbehaves on Day 4 (docs/09 § 10).
