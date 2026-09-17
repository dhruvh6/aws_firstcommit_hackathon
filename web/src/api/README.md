# web/src/api - OWNER: M1

| File | Purpose |
|---|---|
| `client.ts` | One typed function per endpoint in docs/04-API-CONTRACT.md § 2. Reads `VITE_API_BASE_URL`, attaches `X-Business-Id` from `localStorage['dse.actingBusinessId']`, parses the error envelope into a typed `ApiError` carrying `code`, `message`, `field` and `details` |
| `queries.ts` | TanStack Query hooks + query keys. Mutations invalidate only the affected keys |

Rules:
- **Branch on `error.code`, never on `error.message`** (docs/04 § 1).
- An error code outside the docs/04 § 4 table renders the generic error state and
  is filed as a bug against M2 - do not add local handling for invented codes.
- Never compute server-owned values here: status, `compatibleQuantity`,
  `distanceKm`, check wording or any impact figure (docs/02 § 11).
