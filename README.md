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

Day 1 of 4. **Specifications and scaffold only** - no features are implemented yet.
Every document in [`docs/`](docs/) is written to be built against independently, on four
separate machines, with minimal live communication.

What runs today: npm workspaces, the web app shell, the API router with `GET /v1/health`
through the real Lambda handler path, tests, lint, typecheck and CI. What does not exist
yet: all ten screens, all nineteen business routes, the matching engine and the
infrastructure. Owners and day-by-day tasks are in
[docs/08-TEAM-ROLES.md](docs/08-TEAM-ROLES.md).

## Read this first

| If you are... | Start at |
|---|---|
| Any team member | [docs/00-INDEX.md](docs/00-INDEX.md) |
| Looking for your tasks | [docs/08-TEAM-ROLES.md](docs/08-TEAM-ROLES.md) |
| About to write code | [docs/04-API-CONTRACT.md](docs/04-API-CONTRACT.md) - it is frozen |
| About to merge | [docs/09-INTEGRATION-PLAN.md](docs/09-INTEGRATION-PLAN.md) |

## Getting started

```bash
npm i                # root - installs all workspaces
npm run dev          # api on :3001 and web on :5173
npm run dev:web:mock # web only, MSW serves fixtures/ - no backend needed
npm test             # unit tests
npm run typecheck    # tsc across all workspaces
npm run lint
npm run build
npm run smoke        # happy-path check against API_BASE_URL
```

Requires Node 22 or newer (`.nvmrc`). Copy [`.env.example`](.env.example) to `.env` for the
API and `web/.env.example` to `web/.env.local` for the frontend. There are no application
secrets in this project by design - see
[docs/05-ARCHITECTURE.md § 7](docs/05-ARCHITECTURE.md).

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

## Stack

React 19 + TypeScript + Vite + Tailwind CSS (web) / Node 22 TypeScript Lambda behind
API Gateway HTTP API / DynamoDB / S3 / EventBridge / Amplify Hosting.
Full rationale in [docs/05-ARCHITECTURE.md](docs/05-ARCHITECTURE.md).

## Source documents

- [First_Commit_2026_Complete_Rules_Checklist.md](First_Commit_2026_Complete_Rules_Checklist.md) - competition rulebook
- [DeadStock_Exchange_Hackathon_Project_Structure.docx](DeadStock_Exchange_Hackathon_Project_Structure.docx) - original project brief

Where these specs conflict with the **live official rules**, the official rules win.
