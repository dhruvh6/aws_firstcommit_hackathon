# api/src/repo - the seam that lets M2 and M3 work in parallel

| File | Owner | Purpose |
|---|---|---|
| `index.ts` | **M2** | The `Repo` interface (docs/05-ARCHITECTURE.md § 4) + domain error classes. **M3 is blocked on this file and nothing else - push it first.** |
| `memory.ts` | **M2** | In-memory implementation seeded from `fixtures/`. Used by M1, M2, every unit test and local dev |
| `dynamo.ts` | **M3** | DynamoDB implementation. Conditional write for `reserveQuantity`, `TransactWriteItems` for `commitHandoff` |

Selected at runtime by `REPO_DRIVER` (`memory` \| `dynamo`).

`memory.ts` must enforce the same invariants as `dynamo.ts`, including throwing
`InsufficientQuantityError`. If it does not, local tests pass while the
deployment fails - which is the exact Day-4 surprise this design exists to
prevent.
