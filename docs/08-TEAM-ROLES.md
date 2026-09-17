# 08 - Team, Roles & Independent Task Assignment

Four people, four machines, four days, minimal live communication. This document exists so
that **no task on it requires another member's code to start, and no two tasks touch the
same file.**

---

## 1. Roster

Slots were assigned on Day 1, 17 September. All four members have push access to the
repository; `main` is protected, so everyone - including M4 - works on a branch and merges
through a pull request with green CI. Eligibility confirmations are collected in
**[issue #1](https://github.com/dhruvh6/aws_firstcommit_hackathon/issues/1)** and
transcribed into [10-DEMO-AND-SUBMISSION.md](10-DEMO-AND-SUBMISSION.md) § 1 as they arrive -
**this is the one open item that can still invalidate the team's entry.** No contact details in the repository - GitHub handles only; coordination happens
in the team channel, not in Git.

| Slot | Name | GitHub handle | Role | Primary directories |
|---|---|---|---|---|
| **M1** | Vedika | `@vedipanj115` | Frontend / Product | `web/`, `shared/src/labels.ts` |
| **M2** | Prakriti | `@PrakritiGhanekar` | Backend / Domain logic | `api/` (except `repo/dynamo.ts`), `shared/src/domain.ts`, `shared/src/api.ts` |
| **M3** | Siddhi | `@Siddhi-S-Thakur` | AWS / Infrastructure | `infra/`, `api/src/repo/dynamo.ts`, Amplify + deploy config |
| **M4** | - | `@dhruvh6` | Integration / QA / Docs + contract gatekeeper | `docs/`, `fixtures/`, `scripts/`, `api/test/`, `README.md` |

**M4 is taken by whoever wrote these specifications.** They already hold the contract in
their head, and M4 is the role that arbitrates it.

Two considerations that outrank preference when assigning the rest: **M3 is the
highest-risk slot** - no live URL means no Ship It submission - so it goes to whoever has
already deployed something; and **M2 is the least forgiving** - quantity arithmetic under
concurrency - so it goes to the strongest backend person rather than whoever is free.

Everyone must be able to explain the whole project - roles divide *work*, not understanding.
A judge may ask any member anything, and "that was someone else's part" is a bad answer in a
five-person team of four.

## 2. Why the work splits cleanly

Three artefacts remove every blocking dependency:

| Artefact | Removes the dependency |
|---|---|
| [04-API-CONTRACT.md](04-API-CONTRACT.md) + MSW mocks | M1 builds all ten screens with no backend running |
| The `Repo` interface ([05](05-ARCHITECTURE.md) § 4) | M2 writes all logic with no AWS account; M3 writes storage without reading the matching engine |
| [`../fixtures/`](../fixtures/) | All four members work on identical data, so screenshots and test output are comparable |

Stated plainly: **M1 never waits for M2. M2 never waits for M3. M3 never waits for M1.**
M4 integrates continuously, from Day 1, not on Day 4.

## 3. File ownership - the anti-merge-conflict rule

**Never edit a file you do not own.** Need a change in someone else's file? Open a GitHub
issue with the label `contract` or `request`, and keep working on something else.

| Path | Owner | Others may |
|---|---|---|
| `web/**` | M1 | read |
| `shared/src/labels.ts` | M1 | read |
| `shared/src/domain.ts`, `shared/src/api.ts` | M2 | read; request changes via issue |
| `api/src/handlers/**`, `api/src/domain/**`, `api/src/validation/**`, `api/src/router.ts`, `api/src/repo/index.ts`, `api/src/repo/memory.ts`, `api/src/local/**` | M2 | read |
| `api/src/repo/dynamo.ts`, `api/src/index.ts` | M3 | read |
| `infra/**`, Amplify settings | M3 | read |
| `api/test/**`, `scripts/**`, `fixtures/**`, `docs/**`, `README.md` | M4 | read; propose via PR |
| `package.json` (root), `tsconfig.base.json`, `.gitignore`, CI | M4 | request changes |
| `web/package.json` | M1 | |
| `api/package.json` | M2 | |

Root config is single-owner on purpose: `package.json` is the file four people conflict on
most often, and a conflict there breaks everyone's install at once.

## 4. Day 1 - the only shared hour

Do this together on a call, once, before splitting up. Roughly 60 minutes.

1. **Everyone reads** [00-INDEX.md](00-INDEX.md), [01-PRD.md](01-PRD.md),
   [04-API-CONTRACT.md](04-API-CONTRACT.md), and this file. (25 min)
2. **Confirm the contract out loud.** Anyone who disagrees with an entity, a field, an
   endpoint or an enum says so **now**. After this hour, changes cost a contract-change
   round trip. (15 min)
3. **M4 pushes the scaffold** - workspaces, `tsconfig`, empty directories, `fixtures/`,
   CI - and everyone runs `npm i` and confirms `npm run dev` starts. (10 min)
4. **Confirm the roster table** above and eligibility items in
   [10-DEMO-AND-SUBMISSION.md](10-DEMO-AND-SUBMISSION.md) § 1. (10 min)

After this hour, communication drops to the four daily checkpoints in
[09-INTEGRATION-PLAN.md](09-INTEGRATION-PLAN.md).

---

## 5. M1 - Frontend / Product  (Vedika)

**Owns:** every pixel. **Unblocked by:** MSW mocks + fixtures. **Never touches:** `api/`, `infra/`.

### Day 1
- [ ] `web/` scaffold: Vite + React + TS + Tailwind, React Router, TanStack Query
- [ ] `styles/tokens.css` - every token from [07](07-DESIGN-SYSTEM.md) § 1
- [ ] Typed fetch client `web/src/api/client.ts`: base URL from env, `X-Business-Id` header,
      error envelope -> typed `ApiError`, one function per endpoint in [04](04-API-CONTRACT.md)
- [ ] MSW handlers for **all** endpoints, backed by `fixtures/` (`VITE_USE_MOCKS=true`)
- [ ] `shared/src/labels.ts` - every enum -> display string
- [ ] Global shell: top bar, business switcher (localStorage), secondary nav, footer, toasts
- [ ] Components: `Button`, `Chip`, `StatusChip`, `Input`, `Select`, `Skeleton`, `EmptyState`,
      `ErrorState`
- **Done when:** `npm run dev:web:mock` renders the shell, the switcher changes the acting
  business, and the eight components appear on a scratch `/dev` page.

### Day 2
- [ ] `ListingCard`, `QuantityStepper`, `TilePicker`, `AllocationBar`, `CheckList`, `MatchCard`
- [ ] S2 Browse - filter rail, URL-as-state, sort, load-more, all four states
- [ ] S3 Listing detail - gallery, attribute table, sticky action box, stepper, own-listing
      and not-reservable variants
- [ ] S4 List Surplus - dynamic attribute fields from `meta`, inline validation
- **Done when:** browse -> detail -> stepper -> "Reserve" navigates correctly on mocks.

### Day 3
- [ ] S5 Post a Requirement, submitting with `?withMatches=true`
- [ ] **S6 Match results** - the WOW screen. Six checks always, near-misses collapsed,
      relaxation buttons. Budget the most time here
- [ ] S7 Reservation review, with every error code from [04](04-API-CONTRACT.md) mapped to copy
- [ ] S8 Dashboard - four tabs, incoming-reservation cards, handoff dialog
- [ ] S9 Reservation detail with snapshotted reasons
- [ ] **Cut over from mocks to the real API** at checkpoint 3B
- **Done when:** the full flow works end to end against M3's deployed URL.

### Day 4
- [ ] S1 Home - hero, category tiles, three rails, impact strip
- [ ] S10 Impact - hero figure, four stat tiles, two charts, data table, per
      [07](07-DESIGN-SYSTEM.md) § 7
- [ ] Responsive pass at 1440 / 1024 / 768 / 390
- [ ] Accessibility pass: keyboard walk of the whole primary flow, focus rings, labels
- [ ] Polish: skeletons match geometry, no layout shift, zero console errors
- **Done when:** [07](07-DESIGN-SYSTEM.md) § 9 passes on all ten screens.

**Learning log entries to expect:** URL-as-filter-state, MSW-first development against a
frozen contract, building a validated chart palette instead of picking colours.

---

## 6. M2 - Backend / Domain logic  (Prakriti)

**Owns:** correctness. **Unblocked by:** the in-memory repo. **Never touches:** `web/`, `infra/`, `repo/dynamo.ts`.

### Day 1
- [ ] `shared/src/domain.ts` - entities and enums verbatim from [02](02-DOMAIN-MODEL.md).
      **Push this first; M1 and M3 both import it**
- [ ] `shared/src/api.ts` - request/response types from [04](04-API-CONTRACT.md)
- [ ] `api/` scaffold, `router.ts`, `index.ts` handoff point, `local/server.ts` on :3001
- [ ] `repo/index.ts` - the `Repo` interface. **Push before Day 1 checkpoint 2; M3 is
      blocked on this one file and nothing else**
- [ ] `repo/memory.ts` seeded from `fixtures/`, enforcing the same invariants and throwing
      `InsufficientQuantityError`
- [ ] `GET /meta/categories`, `GET /businesses`, `POST /listings`, `GET /listings`,
      `GET /listings/{id}`
- **Done when:** `curl localhost:3001/v1/listings` returns fixture listings and a POST
  with `totalQuantity: -5` returns `400 VALIDATION_FAILED` with `field`.

### Day 2
- [ ] `domain/matching.ts` - all six checks, ranking, tie-breakers, detail strings,
      **pure, `today` injected**
- [ ] Unit tests for every worked example in [03](03-MATCHING-SPEC.md) § 8 and every edge
      case in § 10
- [ ] `POST /requirements` (+ `?withMatches=true`), `GET /requirements`,
      `GET /requirements/{id}`, `GET /requirements/{id}/matches`
- [ ] `GET /listings/{id}/matches` - the same engine, roles swapped, no forked logic
- **Done when:** `req_001` returns exactly one compatible match and two explained
  near-misses, in the documented order, with all six checks on every item.

### Day 3
- [ ] `domain/quantity.ts` + `domain/status.ts` - the transaction sequences and status
      derivation from [02](02-DOMAIN-MODEL.md) §§ 9-10
- [ ] `POST /reservations` with server-side re-check and `matchReasons` snapshot
- [ ] `POST /reservations/{id}/handoff` - all-or-nothing, ImpactRecord keyed on
      `reservationId`, idempotent-safe against a double click
- [ ] `POST /reservations/{id}/cancel`, `GET /reservations`
- [ ] `POST /listings/{id}/withdraw`, `POST /requirements/{id}/cancel`
- [ ] `GET /impact` aggregation - ImpactRecord rows only, never sum across units
- [ ] `sweeper` handler: expire listings and release lapsed reservations
- [ ] Concurrency test: two 50 kg reservations against 80 kg -> exactly one `409`
- **Done when:** [04](04-API-CONTRACT.md) § 5 passes end to end against `localhost`.

### Day 4
- [ ] Structured logging with `requestId`, `businessId`, `status`, `durationMs`, `errorCode`
- [ ] Every error path returns a code from the § 4 table - no bare 500s on user input
- [ ] Performance check: match response < 1.5 s on the seeded dataset
- [ ] Support M4's demo dry runs; fix only bugs, add no features
- **Done when:** the contract suite passes against the **deployed** API.

**Learning log entries to expect:** conditional writes as a correctness mechanism, keeping
domain logic pure and I/O at the edges, designing explainable rules instead of a score.

---

## 7. M3 - AWS / Infrastructure  (Siddhi)

**Owns:** the live URL. **Unblocked by:** the `Repo` interface. **Never touches:** `web/src/`, `api/src/domain/`, `api/src/handlers/`.

### Day 1
- [ ] AWS account ready, `ap-south-1`, budget alert at ₹500 - **first task, before any resource**
- [ ] Choose SAM or CDK, record it in [05](05-ARCHITECTURE.md) § 9, commit `infra/` skeleton
- [ ] Create the five DynamoDB tables and their GSIs exactly as [05](05-ARCHITECTURE.md) § 5
      specifies - **in code, not in the console**
- [ ] `api/src/index.ts` - API Gateway proxy event -> `router.ts` (M2's signature)
- [ ] Deploy a hello-world Lambda behind the HTTP API with CORS, and share the invoke URL
- **Done when:** `curl <invoke-url>/v1/meta/categories` returns 200 from a real deployment.

### Day 2
- [ ] `repo/dynamo.ts` implementing the whole `Repo` interface
- [ ] `reserveQuantity` as a single conditional `UpdateItem`, mapping
      `ConditionalCheckFailedException` -> `InsufficientQuantityError`
- [ ] `commitHandoff` as `TransactWriteItems` across reservation + listing + requirement +
      impact, impact guarded by `attribute_not_exists`
- [ ] Least-privilege IAM per [05](05-ARCHITECTURE.md) § 8 - no `dynamodb:*`, no `Resource: "*"`
- [ ] `npm run seed:dynamo` loading `fixtures/` into the real tables
- **Done when:** the same contract calls behave identically on `REPO_DRIVER=memory` and
  `REPO_DRIVER=dynamo`.

### Day 3
- [ ] Amplify Hosting connected to `main`: build `npm run build -w web`, output `web/dist`,
      SPA rewrite, `VITE_API_BASE_URL` set
- [ ] EventBridge `rate(5 minutes)` -> `sweeper`; verify an expired listing flips to `EXPIRED`
- [ ] S3 photo bucket + presigned upload route (**P1** - only if P0 is green)
- [ ] CloudWatch log group check; confirm the conditional-failure path is visible in logs
- [ ] Architecture diagram exported to `docs/assets/architecture.png` for README + demo
- **Done when:** the live Amplify URL loads the SPA and completes a real reservation against
  DynamoDB.

### Day 4
- [ ] Redeploy from a clean checkout - prove the stack is reproducible from Git
- [ ] Re-seed to demo state on M4's signal (and again after the dry run)
- [ ] Verify the live URL in a fresh browser profile, incognito, and on one phone
- [ ] Screen-record the AWS console tour for the demo's 2:30 beat: API Gateway routes,
      Lambda, DynamoDB items, EventBridge rule
- [ ] Confirm the final cost in Billing and note it in the write-up
- **Done when:** the live URL works from a device that has never opened it.

**Learning log entries to expect:** first infrastructure-as-code deployment, DynamoDB GSI
design from access patterns, `TransactWriteItems`, scoping IAM to a single table.

---

## 8. M4 - Integration / QA / Docs + contract gatekeeper

**Owns:** the submission. **Unblocked by:** everything is already written down.
**Never touches:** feature code in `web/src` or `api/src/handlers`.

### Day 1
- [ ] Create the **public** GitHub repository, push these docs as the first commits
- [ ] Root scaffold: npm workspaces, `tsconfig.base.json`, `.gitignore`, `.env.example`,
      `README.md`
- [ ] Branch protection on `main` as far as the plan allows: PR required, CI must pass
- [ ] CI (GitHub Actions): `npm ci`, typecheck, lint, `npm test`, build both workspaces
- [ ] **Write `fixtures/`** - 6 businesses, 6 listings, 4 requirements,
      `meta-categories.json` - matching [03](03-MATCHING-SPEC.md) § 8 exactly
- [ ] `docs/LEARNING-LOG.md` and remind everyone to append daily
- **Done when:** CI is green on `main` and all three others have run `npm i` successfully.

### Day 2
- [ ] `api/test/contract.test.ts` - all ten cases from [04](04-API-CONTRACT.md) § 5,
      runnable against any `API_BASE_URL`
- [ ] `scripts/smoke.sh` - one command, exercises the full happy path, prints a pass/fail line
- [ ] Run the contract suite against `localhost` and file precise issues for failures
- [ ] Review every PR for contract drift - field names, enum values, status codes
- [ ] Start the README's problem/solution/architecture sections
- **Done when:** the contract suite runs green locally and issues exist for every gap.

### Day 3
- [ ] Run the contract suite against the **deployed** API; drive the mock-to-real cutover
- [ ] `scripts/seed-demo.ts` - resets to the exact demo state ([10](10-DEMO-AND-SUBMISSION.md) § 3)
- [ ] Edge-case sweep: empty input, invalid input, expired listing, double reservation,
      double handoff, browser refresh mid-flow, fresh session, slow network (throttled)
- [ ] Secret scan of the working tree **and** full history; verify `.gitignore` coverage
- [ ] Finish the README: problem, solution, workflow, architecture, AWS usage, what we built
      during the event, learning, tech stack, third-party credits, **AI tools used**, run
      instructions, live URL
- **Done when:** the deployed API passes the contract suite and the README is complete.

### Day 4
- [ ] **Feature freeze at the published time.** Enforce it - this is M4's call to make
- [ ] Full test pass from a clean clone on a clean browser profile
- [ ] Dry run the demo twice; time it; cut anything that pushes past 2:50
- [ ] Record and edit the demo video (<= 3:00), verify audio and legibility at 1080p
- [ ] Write the submission write-up: problem, build, AWS usage, AI tools
- [ ] Submit through the First Commit form **early**, then re-verify every link
- [ ] Final pass of [10](10-DEMO-AND-SUBMISSION.md) § 5 pre-submission checklist
- **Done when:** the submission exists, is valid, and every link opens in a fresh browser.

**Learning log entries to expect:** contract-first integration across four machines,
writing a contract test suite that runs against local and deployed targets, freezing scope.

---

## 9. Dependency map - the only four places work meets

```
Day 1  M2 ──shared/src/domain.ts──────────────> M1, M3      (needed within hours, push first)
Day 1  M2 ──api/src/repo/index.ts────────────> M3           (M3's only blocker)
Day 1  M4 ──fixtures/ + meta-categories.json─> M1, M2       (mocks and seeds)
Day 3  M3 ──deployed API base URL────────────> M1           (the mock-to-real cutover)
```

Four edges, all one-directional, all on Day 1 except the cutover. Anything else that feels
like a dependency is a contract question - ask M4, do not wait.

## 10. If a member goes dark

Online hackathon, patchy internet, real life. Plan for it instead of panicking.

**Status as of Day 1:** a working AWS account is confirmed available (M4's account; M3 gets
an IAM user on it, with a budget alert set before any resource is created). **Ship It is
therefore the track**, and the Build It fallback below is a contingency only - not a plan,
and not a consolation prize.

| Missing | Immediate effect | Recovery |
|---|---|---|
| M1 | No UI progress | M4 takes S6 + S7 (the demo path). Home and Impact are cut |
| M2 | No new endpoints | M1 stays on mocks; M4 + M3 implement `POST /reservations` and handoff from [02](02-DOMAIN-MODEL.md) § 10 |
| M3 | No live URL | Ship the **Build It** fallback: `REPO_DRIVER=memory` locally, demo recorded on localhost with SAM CLI + DynamoDB Local shown. Track changes, submission stays valid |
| M4 | No integration | M2 runs the contract suite; M1 records the demo; **submit early regardless** |

The Build It fallback is why M2's logic never depends on DynamoDB-specific behaviour. It is
a real contingency, not a consolation prize - the track is chosen by what is finished.

## 11. Learning log

`docs/LEARNING-LOG.md`, appended daily by each member. Four lines are enough:

```markdown
## 2026-09-18 - M2
- Learned: DynamoDB ConditionExpression makes over-reservation impossible without a lock.
- Failed first: read-then-write; two parallel curl requests both succeeded and quantity went to -20.
- Changed: single conditional UpdateItem, ConditionalCheckFailedException mapped to 409.
- Trade-off: the client must handle 409 and refetch, rather than the server queueing.
```

Learning is an official judging category. Written daily it is specific and credible;
reconstructed on Day 4 it reads exactly like what it is.
