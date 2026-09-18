# 05 - Architecture

**Owner:** M3 (infrastructure) with M2 (application structure).

---

## 1. System diagram

```
                                 ┌─────────────────────────┐
                                 │   Browser (React SPA)   │
                                 │  Vite + TS + Tailwind   │
                                 └────────────┬────────────┘
                                              │ HTTPS
                              ┌───────────────▼───────────────┐
                              │      Amplify Hosting          │  static SPA + live URL
                              └───────────────┬───────────────┘
                                              │ fetch /v1/*
                              ┌───────────────▼───────────────┐
                              │   Amazon API Gateway (HTTP)   │  routes, CORS, throttling
                              └───────────────┬───────────────┘
                                              │
                              ┌───────────────▼───────────────┐
                              │        AWS Lambda: api        │  validation, matching,
                              │   Node 22, single router fn   │  reservation, impact
                              └──┬─────────────┬──────────────┘
                                 │             │
              ┌──────────────────▼──┐      ┌───▼────────────────┐
              │  Amazon DynamoDB    │      │   Amazon S3        │
              │  5 tables + GSIs    │      │  listing photos    │
              └──────────────────▲──┘      └────────────────────┘
                                 │
                              ┌──┴────────────────────────────┐
                              │  AWS Lambda: sweeper          │
                              │  expire listings/reservations │
                              └──────────────▲────────────────┘
                                             │ rate(5 minutes)
                              ┌──────────────┴────────────────┐
                              │   Amazon EventBridge          │
                              └───────────────────────────────┘
```

Region: **ap-south-1 (Mumbai)**.

## 2. Why each AWS service exists

Every service must answer: *what part of our working user flow does this make possible?*
A service with no answer gets deleted, regardless of how good it looks on a slide.

| Service | Necessary job | What breaks without it |
|---|---|---|
| **API Gateway** (HTTP API) | Single public HTTPS entry point for the SPA; routing, CORS, throttling | No way for the browser to reach the logic |
| **Lambda** (`api`) | Runs validation, the matching engine, the reservation transaction and impact aggregation, with no server to manage | No business logic |
| **DynamoDB** | Stores businesses, listings, requirements, reservations, impact records. **Conditional writes are what make double allocation impossible** - the core correctness property | Two buyers could reserve the same 50 kg |
| **S3** | Stores listing photographs, served directly to the browser (P1) | Listings are text-only |
| **EventBridge** | Scheduled rule invoking the `sweeper` Lambda: expire listings past `availableUntil`, release reservations past `expiresAt` | Expired stock stays bookable and held quantity is never released |
| **Amplify Hosting** | Builds and hosts the SPA, gives the **live URL** the Ship It track requires | No live URL, no Ship It submission |
| **CloudWatch Logs** | Structured logs per request id; how we debug across four machines | Blind debugging on Day 4 |
| **Cognito** | *P1 only.* Real supplier/buyer identity | Nothing - P0 uses the documented business switcher |

Deliberately **not used**: Step Functions (one transaction, not a workflow), OpenSearch
(a GSI query plus substring filter is enough at fixture scale), Bedrock (matching is
deterministic by design - adding an LLM would make the core less explainable), SQS, RDS,
ECS. Adding any of these needs a justification in this table first.

### HTTP API, not REST API

API Gateway **HTTP API** is roughly 70% cheaper, has lower latency, and supports the CORS
and proxy routing we need. We use no request validators, usage plans or API keys, so the
REST API feature set buys nothing here.

### One router Lambda, not one per route

`api` is a single function with an internal router (`api/src/router.ts`). Nineteen separate
functions would mean nineteen IAM roles, nineteen deployments and nineteen cold starts on
demo day, for no benefit at this scale. The handler modules are already split per resource,
so splitting into per-route functions later is mechanical. `sweeper` is separate because it
has a different trigger and different permissions.

## 3. Repository layout

```
aws_firstcommit/
├── docs/                      # these specifications
├── fixtures/                  # shared seed + mock data  (M4 owns)
├── shared/                    # npm workspace: types only, zero runtime deps
│   └── src/
│       ├── domain.ts          # entities & enums, verbatim from docs/02   (M2 owns)
│       ├── api.ts             # request/response types, from docs/04      (M2 owns)
│       └── labels.ts          # enum -> display string maps               (M1 owns)
├── web/                       # React SPA                                 (M1 owns)
│   ├── src/
│   │   ├── api/               # typed fetch client + MSW mock handlers
│   │   ├── components/        # design-system primitives (docs/07)
│   │   ├── features/          # browse, listing, requirement, matches, reservations, impact
│   │   ├── pages/             # one file per screen in docs/06
│   │   └── styles/tokens.css  # design tokens
│   └── .env.example
├── api/                       # Lambda source                             (M2 owns)
│   ├── src/
│   │   ├── index.ts           # Lambda entry (API Gateway proxy)
│   │   ├── router.ts          # method+path -> handler
│   │   ├── handlers/          # listings, requirements, reservations, impact, meta
│   │   ├── domain/            # matching.ts, quantity.ts, status.ts  (pure, no I/O)
│   │   ├── validation/        # per-endpoint validators from docs/04
│   │   ├── repo/              # Repo interface + memory.ts (M2) + dynamo.ts (M3)
│   │   └── local/server.ts    # node:http wrapper for localhost:3001
│   └── test/
├── infra/                     # IaC + deploy scripts                      (M3 owns)
└── scripts/                   # seed-local.ts, seed-dynamo.ts, smoke.sh   (M4 owns)
```

npm workspaces from the root: `npm i` once at the root installs everything.
`shared` is imported as `@dse/shared` by both `web` and `api`.

## 4. Persistence: the `Repo` interface

**This interface is the second seam that makes parallel work possible.** M2 writes all
business logic against it and never needs AWS credentials. M3 implements it against
DynamoDB and never needs to read the matching engine.

```ts
// api/src/repo/index.ts   -- M2 owns the interface, M3 owns dynamo.ts
export interface Repo {
  getBusiness(id: string): Promise<Business | null>;
  listBusinesses(): Promise<Business[]>;

  createListing(l: SurplusListing): Promise<SurplusListing>;
  getListing(id: string): Promise<SurplusListing | null>;
  queryListings(f: ListingFilter): Promise<Page<SurplusListing>>;
  /** Atomic. Throws InsufficientQuantityError if the condition fails. Never read-then-write. */
  reserveQuantity(listingId: string, qty: number): Promise<SurplusListing>;
  releaseQuantity(listingId: string, qty: number): Promise<SurplusListing>;
  completeQuantity(listingId: string, qty: number): Promise<SurplusListing>;
  updateListingStatus(listingId: string, status: ListingStatus): Promise<SurplusListing>;

  createRequirement(r: Requirement): Promise<Requirement>;
  getRequirement(id: string): Promise<Requirement | null>;
  queryRequirements(f: RequirementFilter): Promise<Page<Requirement>>;
  updateRequirementQuantities(id: string, d: QuantityDelta): Promise<Requirement>;

  createReservation(r: Reservation): Promise<Reservation>;
  getReservation(id: string): Promise<Reservation | null>;
  queryReservations(f: ReservationFilter): Promise<Page<Reservation>>;
  /** Conditional on the expected current status. Throws InvalidStateError otherwise. */
  transitionReservation(id: string, from: ReservationStatus, to: ReservationStatus, patch?: Partial<Reservation>): Promise<Reservation>;

  createImpactRecord(i: ImpactRecord): Promise<ImpactRecord>;
  queryImpactRecords(f: ImpactFilter): Promise<ImpactRecord[]>;

  /** All-or-nothing handoff. Dynamo: TransactWriteItems. Memory: sequential + rollback. */
  commitHandoff(input: HandoffCommit): Promise<HandoffResult>;
}
```

Two implementations, selected by `process.env.REPO_DRIVER`:

| Driver | File | Used by | Notes |
|---|---|---|---|
| `memory` | `repo/memory.ts` | M1, M2, all unit tests, local dev | Seeded from `fixtures/` on boot. Default locally |
| `dynamo` | `repo/dynamo.ts` | Deployed Lambda | Default when `REPO_DRIVER` is unset in AWS |

`memory.ts` must enforce the same invariants as `dynamo.ts`, including throwing
`InsufficientQuantityError` - otherwise local tests pass and the deployment fails, which is
exactly the Day-4 surprise this design exists to prevent.

## 5. DynamoDB design

Five tables, on-demand billing, each with the GSIs its access patterns need. Five small
tables beat one clever single-table design here: three people need to reason about them
independently, on a four-day clock, and on-demand pricing makes table count cost-neutral.

| Table | PK | SK | GSI |
|---|---|---|---|
| `dse-businesses` | `businessId` | - | - |
| `dse-listings` | `listingId` | - | `gsi-category-city`: PK `categoryCity` (`WOOD_OFFCUTS#Mumbai`), SK `availableUntil`<br>`gsi-business`: PK `businessId`, SK `createdAt` |
| `dse-requirements` | `requirementId` | - | `gsi-category-city`: PK `categoryCity`, SK `requiredBy`<br>`gsi-business`: PK `businessId`, SK `createdAt` |
| `dse-reservations` | `reservationId` | - | `gsi-buyer`: PK `buyerBusinessId`, SK `createdAt`<br>`gsi-supplier`: PK `supplierBusinessId`, SK `createdAt`<br>`gsi-status`: PK `status`, SK `expiresAt` (the sweeper's query) |
| `dse-impact` | `impactId` | - | `gsi-completed`: PK `impactPartition` (constant `ALL`), SK `completedAt` |

`categoryCity` and `impactPartition` are **derived attributes written by the repo layer**,
never accepted from a client. Keep `impactPartition` constant at demo scale; the comment in
`dynamo.ts` should note it would shard by month in production.

### Access patterns

| # | Pattern | Query |
|---|---|---|
| 1 | Browse listings by category in a city | `gsi-category-city`, PK `<cat>#<city>`, filter on status/quantity |
| 2 | Candidate listings for a requirement | Same as 1, then the engine applies all six checks |
| 3 | My listings | `gsi-business` on `dse-listings` |
| 4 | Candidate requirements for a listing | `gsi-category-city` on `dse-requirements` |
| 5 | My reservations (either side) | `gsi-buyer` + `gsi-supplier`, merged and sorted by `createdAt` |
| 6 | Reservations to expire | `gsi-status`, PK `RESERVED`, SK `expiresAt < now` |
| 7 | Impact aggregation | `gsi-completed`, PK `ALL`, SK between `from` and `to` |
| 8 | Listing / requirement / reservation by id | `GetItem` on the base table |

Text search (`?q=`) is an in-memory filter over the queried page. At fixture scale that is
correct and instant; OpenSearch would be a service with no job.

### The conditional write

```ts
await ddb.send(new UpdateItemCommand({
  TableName: LISTINGS,
  Key: { listingId: { S: listingId } },
  UpdateExpression: 'SET availableQuantity = availableQuantity - :q, reservedQuantity = reservedQuantity + :q, updatedAt = :now',
  ConditionExpression: 'availableQuantity >= :q AND #s IN (:active, :partial)',
  ExpressionAttributeNames: { '#s': 'status' },
  ExpressionAttributeValues: { ':q': { N: String(qty) }, ':now': { S: nowIso },
    ':active': { S: 'ACTIVE' }, ':partial': { S: 'PARTIALLY_RESERVED' } },
  ReturnValues: 'ALL_NEW',
}));
// ConditionalCheckFailedException -> InsufficientQuantityError -> 409 INSUFFICIENT_QUANTITY
```

Handoff uses `TransactWriteItems` across reservation, listing, requirement and impact, with
the impact item under `attribute_not_exists(impactId)` keyed on the reservation id, so a
retry cannot double-count. If the transaction is cancelled, return `409` and write nothing.

## 6. Local development

Nobody is blocked on a deployment at any point.

```bash
npm i                    # root, installs all workspaces

npm run dev:api          # api  -> http://localhost:3001  (REPO_DRIVER=memory, fixtures loaded)
npm run dev:web          # web  -> http://localhost:5173
npm run dev              # both, concurrently
npm run dev:web:mock     # web only, MSW intercepts /v1/* - zero backend needed
npm test                 # unit tests (domain + repo/memory)
npm run test:contract    # docs/04 § 5 suite against API_BASE_URL (default localhost)
```

| Member | Normal loop | Needs AWS? |
|---|---|---|
| M1 | `dev:web:mock`, then `dev` once M2's endpoints land | No |
| M2 | `dev:api` + `npm test` | No |
| M3 | `infra` deploy + `test:contract` against the deployed URL | Yes |
| M4 | `dev` + `test:contract` against both local and deployed | Read-only |

`api/src/local/server.ts` is a thin `node:http` wrapper that translates a request into the
same API-Gateway-shaped event the Lambda receives, then calls the identical router. **No
Express, and no second code path** - local and deployed behaviour cannot diverge.

## 7. Environments and configuration

| Variable | Where | Example | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | web build | `https://abc123.execute-api.ap-south-1.amazonaws.com/v1` | Amplify env var; `.env.local` for dev |
| `VITE_USE_MOCKS` | web build | `true` | Turns on MSW |
| `REPO_DRIVER` | Lambda / local | `dynamo` / `memory` | |
| `TABLE_PREFIX` | Lambda | `dse-` | |
| `PHOTO_BUCKET` | Lambda | `dse-listing-photos-<acct>` | P1 |
| `RESERVATION_TTL_MINUTES` | Lambda | `2880` (30 for the demo) | Hold duration |
| `ALLOWED_ORIGIN` | Lambda | Amplify URL | CORS in prod |
| `LOG_LEVEL` | Lambda | `info` | |

Two environments only: **local** (memory driver) and **prod** (one AWS account). A staging
environment would cost a day of M3's time and buy nothing in four days.

### Secrets

There are no application secrets. No API keys, no database passwords, no JWT signing keys -
DynamoDB access is IAM-role-based and there is no third-party API. **So there is nothing to
commit, and any credential appearing in this repo is by definition a mistake.**

- `.env.example` with placeholders is committed; `.env*` is git-ignored.
- AWS access on M3's machine comes from a named CLI profile, never from a file in the repo.
- If a credential is ever committed: rotate it first, then rewrite history, then tell the
  team. In that order.

## 8. IAM - least privilege

| Function | Permissions |
|---|---|
| `api` | `dynamodb:GetItem,PutItem,UpdateItem,Query,TransactWriteItems` on the five tables and their indexes **only**; `s3:PutObject` on `PHOTO_BUCKET/listings/*` (presign); `logs:*` on its own log group |
| `sweeper` | `dynamodb:Query,UpdateItem,TransactWriteItems` on listings + reservations + requirements; `logs:*` |

No `dynamodb:*`, no `Resource: "*"`, no `AdministratorAccess` on a function role. The photo
bucket blocks public ACLs; reads go through CloudFront or a presigned GET.

## 9. Deployment

M3 picks **one** of these on Day 1 and records the choice here. Default recommendation:
**AWS SAM**, because the SAM CLI is an AWS open-source tool the event itself highlights, the
template is short, and `sam local invoke` gives M3 a way to test the handler without a
deploy.

| Option | Pros | Cons |
|---|---|---|
| **AWS SAM** (recommended) | One template for API + Lambda + tables + schedule; `sam local`; event-highlighted tooling | New syntax to learn on Day 1 |
| AWS CDK (TypeScript) | Same language as the app | Bootstrap + synth time; more moving parts |
| Console by hand | Fastest first deploy | Not reproducible, nothing in Git, judges cannot see the infrastructure |

Console-only infrastructure is not acceptable: `infra/` must describe the stack in code, or
the architecture claim in the write-up has nothing behind it.

### Deployment status - 18 September

| Item | Value |
|---|---|
| API base URL | `https://m99973ijbb.execute-api.ap-south-1.amazonaws.com/v1` |
| Region | `ap-south-1` |
| Tables provisioned | `dse-businesses`, `dse-listings`, `dse-requirements`, `dse-reservations`, `dse-impact` |
| Frontend | not yet deployed - Amplify not connected |
| **Driver** | **`REPO_DRIVER=memory`** |

**The deployment is not yet demo-ready, and the reason is the driver.** With the in-memory
repository, each Lambda container keeps its own copy of state seeded from `fixtures/`.
Measured on 18 September: one listing created, then 20 simultaneous reads returned
**11 responses showing 5 listings** (fresh containers, the new row invisible), 3 showing 8
(the warm container), and 6 `503`s. A single-user sequential flow was consistent 10/10,
because every request hit the same warm container - but any cold start between takes resets
it, and a listing created on camera disappears.

Two consequences:

1. **Do not record against this URL until `repo/dynamo.ts` lands and `REPO_DRIVER` flips to
   `dynamo`.** The five tables exist and nothing reads or writes them, so the DynamoDB claim
   in the write-up is not yet true either.
2. The `503`s under concurrency are separate from the driver - most likely a Lambda
   concurrent-execution quota on a new account. Harmless for a single-user demo, but check
   Service Quotas before a judge clicks around.

```bash
cd infra && sam build && sam deploy --guided     # first time
sam deploy                                        # thereafter
npm run seed:dynamo                                # loads fixtures/ into the tables
```

Frontend: Amplify Hosting connected to `main`, build `npm run build -w web`, output
`web/dist`, SPA rewrite `/<*>` -> `/index.html`, with `VITE_API_BASE_URL` set in the Amplify
console. Every push to `main` redeploys - which is also why `main` must stay green.

## 10. Observability

- One structured JSON log line per request: `requestId`, `method`, `path`, `businessId`,
  `status`, `durationMs`, and `errorCode` when applicable.
- Log the `ConditionalCheckFailedException` path explicitly - during the demo we must be able
  to prove a rejected double reservation actually happened.
- **Never log** request bodies wholesale; log field names on validation failure, not values.

## 11. Cost

On-demand DynamoDB, Lambda and HTTP API at fixture scale sit inside the AWS Free Tier;
Amplify Hosting build minutes and S3 storage for a handful of photos are cents. Expected
total for the hackathon: **effectively zero, well under ₹100 even with mistakes.** The
design choices that keep it there: on-demand billing (no provisioned capacity left running),
no NAT gateway, no VPC, no always-on compute, no OpenSearch domain (the single most common
way a student hackathon produces a surprise bill).

## 12. Authentication - the P1 swap

When Cognito is added: a Hosted UI user pool, one user per business with `custom:businessId`
in the token, a JWT authorizer on the HTTP API, and `resolveActingBusiness()` reading the
claim instead of the header. **Exactly one function changes.** No route signatures, no
payloads, no frontend page structure - only the fetch client's header logic. That is the
whole reason identity was put in a header on Day 1.
