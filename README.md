# DeadStock Exchange

**B2B circular material exchange for industrial surplus.**
One business's dead stock becomes another business's raw material.

Built for **First Commit 2026** (Bharat Builds Tour x WeMakeDevs x AWS Builder Center),
17-20 September 2026. Track: **Ship It** (deployed on AWS, live URL), with **Best UI** as a
secondary target.

## The one workflow

```
SURPLUS MATERIAL -> STRUCTURED LISTING -> MATCH -> RESERVATION -> HANDOFF -> MEASURABLE REUSE
```

A supplier lists surplus material. A buyer posts a material requirement (or browses).
A deterministic matching engine finds compatible listings and **explains why** they match.
The buyer reserves a partial or full quantity. The supplier confirms handoff. Inventory
decrements and reuse impact updates automatically.

## Status

**Day 2 of 4, in progress.** Updated 18 September.

| Area | State |
|---|---|
| Specifications, fixtures, CI, contract suite, seeders | complete |
| Shared domain and API types | complete |
| Backend | **7 of 11 P0 routes**, including the matching engine and the core match endpoint. Reservations, handoff and impact are in progress |
| Frontend | Design tokens, eight components, typed API client and a full MSW mock backend. Screens not yet built |
| Infrastructure | **not yet deployed** - no live URL yet |

The contract suite ([docs/04 § 5](docs/04-API-CONTRACT.md)) is the honest scoreboard:
`npm run test:contract` currently reads **9 passing, 8 failing**, and the 8 failures are
exactly the routes not yet written. Nothing in this README claims a feature the suite has
not seen work.

Owners and day-by-day tasks: [docs/08-TEAM-ROLES.md](docs/08-TEAM-ROLES.md).

## Read this first

| If you are... | Start at |
|---|---|
| Any team member | [docs/00-INDEX.md](docs/00-INDEX.md) |
| Looking for your tasks | [docs/08-TEAM-ROLES.md](docs/08-TEAM-ROLES.md) |
| About to write code | [docs/04-API-CONTRACT.md](docs/04-API-CONTRACT.md) - it is frozen |
| About to merge | [docs/09-INTEGRATION-PLAN.md](docs/09-INTEGRATION-PLAN.md) |

## Problem

Small and medium manufacturers, workshops and print units accumulate usable surplus
material - plywood offcuts, fabric remnants, over-ordered cartons, acrylic cut-offs - that
has no further use inside their own operation. At the same time, other businesses in the
same city buy the same or compatible material new.

The material has value. What is missing is **coordination**: the business that has it and
the business that can use it never discover each other in time, with enough structured
detail to transact. So it gets stored until it is in the way, sold to a scrap dealer at a
fraction of its worth, or discarded - while a compatible buyer two kilometres away raises a
purchase order for new stock.

Today that gap is bridged, badly, by WhatsApp groups and phone calls: no quantities, no
dimensions, no condition, no record, and availability that goes stale within days.

## Solution

A B2B circular-material exchange with a **deterministic, explainable** matching engine.

- A supplier lists surplus against a structured schema - category, quantity, condition,
  category-specific attributes, location, availability window.
- A buyer posts a material **requirement**, or browses.
- Six hard-constraint checks decide compatibility, and the interface shows **all six in
  plain words** rather than a relevance score.
- The buyer reserves **part or all** of a listing; over-reservation is impossible.
- The supplier confirms handoff; inventory decrements and the reuse is recorded.

There is no ML, no learned ranking and no LLM anywhere in the matching path. That is a
design decision, not a shortcut: a supplier deciding whether to hand over 50 kg of material
needs to know *why* it matched, and a rule engine can tell them.

## Core workflow

```
Surplus material -> structured listing -> match -> reservation -> handoff -> measurable reuse
```

## Architecture

```
Browser (React SPA)  ->  Amplify Hosting
        |
        v
Amazon API Gateway (HTTP API)
        |
        v
AWS Lambda  (Node 22, TypeScript, single router function)
    |            |
    v            v
Amazon      Amazon S3
DynamoDB    (listing photos)
    ^
    |
AWS Lambda (sweeper)  <-  Amazon EventBridge (schedule)
```

Region **ap-south-1 (Mumbai)**. Full detail, including the DynamoDB key design and access
patterns, is in [docs/05-ARCHITECTURE.md](docs/05-ARCHITECTURE.md).

## AWS usage - what each service actually does

Every service had to answer one question to earn its place: *what part of our working user
flow does this make possible?*

| Service | Its job here |
|---|---|
| **API Gateway** (HTTP API) | The single public HTTPS entry point for the SPA - routing, CORS, throttling |
| **Lambda** (`api`) | Validation, the six-check matching engine, the reservation transaction, impact aggregation |
| **DynamoDB** | All state. **A conditional write on `availableQuantity` is what makes double allocation impossible** - the correctness core of the product |
| **S3** | Listing photographs, uploaded by presigned PUT |
| **EventBridge** | Scheduled sweep expiring stale listings and releasing lapsed reservation holds |
| **Amplify Hosting** | Builds and serves the SPA, and provides the live URL |
| **CloudWatch Logs** | One structured log line per request, including the rejected-reservation path |

Deliberately **not** used: Step Functions (this is one transaction, not a workflow),
OpenSearch (a GSI query plus an in-memory substring filter is correct at this scale),
Bedrock (matching is deterministic by design - an LLM would make the core *less*
explainable). Reasoning in [docs/05 § 2](docs/05-ARCHITECTURE.md).

### The one line of code the product rests on

```
ConditionExpression: availableQuantity >= :q AND #s IN (:active, :partial)
```

Two buyers reserving the same 50 kg at the same moment: one gets `201`, the other gets
`409 INSUFFICIENT_QUANTITY` with the live remaining quantity, and `availableQuantity` can
never go negative. Never read-then-write.

## What we built during First Commit, 17-20 September 2026

Everything in this repository. It was created on 17 September and its history is the four
days of the event - no prior work was imported.

| Area | Built |
|---|---|
| Specifications | Eleven documents in [docs/](docs/): PRD, domain model, matching spec, frozen API contract, architecture, UI spec, design system, roles, integration plan, demo and submission plan |
| Shared types | Entities, enums and state machines shared by frontend and backend |
| Backend | Framework-free router, validators, the six-check matching engine as pure functions, in-memory and DynamoDB repository drivers behind one interface |
| Frontend | Design tokens, component library, typed API client, a full MSW mock backend mirroring the real API |
| Tooling | Contract test suite runnable against localhost or the deployment, demo seeder with run-relative dates, smoke script, CI |

**Scope honesty:** on Day 2 the API surface was deliberately cut from 19 routes to the 11
the demo depends on ([docs/04 § 2](docs/04-API-CONTRACT.md)). Cut means the route does not
exist, the UI does not call it, and this README does not claim it.

## Learning

Kept as we went in [docs/LEARNING-LOG.md](docs/LEARNING-LOG.md), not reconstructed
afterwards. A sample of what the four days actually taught us:

- **A conditional write is a correctness mechanism, not an optimisation.** The first attempt
  at reserving quantity read the row, subtracted in application code and wrote it back. Two
  parallel requests both succeeded and quantity went negative. A single conditional
  `UpdateItem` removes the window entirely, at the cost of the client having to handle `409`
  and refetch.
- **A self-referential CSS custom property fails silently.** `--radius-md: var(--radius-md)`
  is invalid at computed-value time: no build error, no console warning, green CI, and every
  `rounded-*`, `shadow-*` and `font-sans` utility quietly resolving to nothing. Found only by
  reading the *built* CSS rather than the source.
- **Contract-first is what let four people work on four machines.** A frozen API contract, a
  shared fixture set and one repository interface meant the frontend never waited for the
  backend and the backend never waited for AWS. When one member started a day late, nobody
  else was blocked.
- **Test data expires.** Fixtures written for 17 September silently invalidate on the 20th,
  because the API validates dates against today. Caught by a contract test going red against
  correct code; fixed by making the seeder shift every date relative to its run date.
- **Mocks drift from reality in ways that only show up at integration.** A parallel mock of
  the matching engine matched the real one on every field and every ordering - except a month
  abbreviation, because `Intl.DateTimeFormat('en-GB')` renders `Sept` where the spec says
  `Sep`. Found by running both engines side by side on identical input.

## Tech stack

**Frontend** React 19 · TypeScript · Vite 7 · Tailwind CSS 4 · TanStack Query · React Router ·
MSW (mock backend) · lucide-react
**Backend** Node 22 · TypeScript · AWS Lambda · framework-free router · `node:test`
**Data** Amazon DynamoDB (on-demand)
**Infrastructure** AWS SAM · Amplify Hosting
**Tooling** npm workspaces · ESLint 9 · tsx · GitHub Actions

## Run it

**Live URL:** _pending deployment - to be filled before submission_

```bash
git clone https://github.com/dhruvh6/aws_firstcommit_hackathon.git
cd aws_firstcommit_hackathon
npm i                    # Node 22 or newer

npm run dev              # api on :3001 and web on :5173
npm run dev:web:mock     # frontend only, MSW serves fixtures - no backend needed
```

No credentials or AWS account are needed to run it locally: the API defaults to an
in-memory repository seeded from [fixtures/](fixtures/). **There are no application secrets
in this project at all** - DynamoDB access is IAM-role-based and there is no third-party
API, so nothing sensitive exists to leak ([docs/05 § 7](docs/05-ARCHITECTURE.md)).

Copy [`.env.example`](.env.example) to `.env` for the API and `web/.env.example` to
`web/.env.local` for the frontend if you want to override defaults; neither is required for
a local run.

```bash
npm test                 # unit tests
npm run test:contract    # contract suite; add API_BASE_URL=<url> to run it against a deployment
npm run seed:demo        # load the demo state, with all dates shifted to today
npm run seed:dynamo      # load reference data into deployed DynamoDB tables
npm run smoke            # one-command happy-path check
npm run typecheck && npm run lint && npm run build
```

## Layout

```
docs/       the specifications - read docs/00-INDEX.md first
fixtures/   shared demo data and the matching test oracle (M4)
shared/     types shared by web and api (M2, plus labels.ts by M1)
api/        Lambda source: router, handlers, pure domain logic, repo drivers (M2, M3)
web/        React SPA (M1)
infra/      infrastructure as code (M3)
scripts/    seeding and smoke scripts (M4)
```

## Third-party credits

All runtime and build dependencies are open source under permissive licences, used
unmodified via npm:

| Package | Licence |
|---|---|
| react, react-dom, react-router-dom | MIT |
| @tanstack/react-query | MIT |
| tailwindcss, @tailwindcss/vite | MIT |
| vite, @vitejs/plugin-react | MIT |
| msw | MIT |
| eslint, typescript-eslint, concurrently, tsx | MIT |
| lucide-react | ISC |
| typescript | Apache-2.0 |
| @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb | Apache-2.0 |
| @types/aws-lambda | MIT |

No third-party code was copied into this repository. **No stock or AI-generated imagery is
used**: category placeholders are flat SVGs drawn for this project
([docs/07 § 8](docs/07-DESIGN-SYSTEM.md)), which also keeps every asset licence-clean.

All businesses, listings and requirements in [fixtures/](fixtures/) are **synthetic**. No
real business data and no personal data of any individual appears anywhere in this
repository - the schema has no contact fields at all, by design
([docs/02 § 4](docs/02-DOMAIN-MODEL.md)).

## AI tools used

Disclosed per the competition rules. **Each team member must confirm their own row before
submission** - this table is not complete until they do.

| Member | Role | AI tools used |
|---|---|---|
| M4 - integration, QA, docs | specifications, contract tests, seeders, reviews | **Claude Code (Claude Opus 5)** - used for specification drafting, test authoring, tooling scripts and code review. Commits it co-authored carry a `Co-Authored-By` trailer |
| M1 - frontend | _to be confirmed_ | _to be confirmed_ |
| M2 - backend | _to be confirmed_ | _to be confirmed_ |
| M3 - infrastructure | _to be confirmed_ | _to be confirmed_ |

AI assistance does not change the fact that this is the team's own competition project,
built inside the event window. Every AI-assisted change went through the same review as any
other: a pull request, green CI, and a human approval.

## Demo

Three-minute walkthrough: a workshop lists 80 kg of plywood offcuts; a decor business posts
a 50 kg requirement; the exchange returns one compatible match with all six checks shown and
two nearby listings explained as near-misses; the buyer reserves 50 kg and the supplier's
available stock drops to 30; the supplier confirms handoff and the impact dashboard records
50 kg reused.

Shot list and the exact recording state: [docs/10-DEMO-AND-SUBMISSION.md](docs/10-DEMO-AND-SUBMISSION.md).

## Source documents

- [First_Commit_2026_Complete_Rules_Checklist.md](First_Commit_2026_Complete_Rules_Checklist.md) - competition rulebook
- [DeadStock_Exchange_Hackathon_Project_Structure.docx](DeadStock_Exchange_Hackathon_Project_Structure.docx) - original project brief

Where these specifications conflict with the **live official rules**, the official rules win.

## Licence

MIT - see [LICENSE](LICENSE).
