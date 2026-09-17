# api/src/handlers - OWNER: M2

One module per resource, each exporting handlers wired into `src/router.ts`:

| File | Routes (docs/04 § 2) |
|---|---|
| `meta.ts` | `GET /v1/meta/categories` - serve `fixtures/meta-categories.json` |
| `businesses.ts` | `GET /v1/businesses`, `GET /v1/businesses/:businessId` |
| `listings.ts` | create, browse, detail, withdraw, supplier-side matches |
| `requirements.ts` | create (+`?withMatches=true`), list, detail, cancel, matches |
| `reservations.ts` | create, list, detail, handoff, cancel |
| `impact.ts` | `GET /v1/impact` - aggregate ImpactRecord rows only |
| `uploads.ts` | `POST /v1/uploads/listing-photo` - presigned S3 PUT (P1, M3) |

Handlers do I/O and shape responses. All decision logic belongs in `src/domain/`
so it stays unit-testable without a repository.
