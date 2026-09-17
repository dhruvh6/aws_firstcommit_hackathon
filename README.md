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

Day 1 of 4. **This repository currently contains specifications only** - no application
code yet. Every document in [`docs/`](docs/) is written to be built against independently,
on four separate machines, with minimal live communication.

## Read this first

| If you are... | Start at |
|---|---|
| Any team member | [docs/00-INDEX.md](docs/00-INDEX.md) |
| Looking for your tasks | [docs/08-TEAM-ROLES.md](docs/08-TEAM-ROLES.md) |
| About to write code | [docs/04-API-CONTRACT.md](docs/04-API-CONTRACT.md) - it is frozen |
| About to merge | [docs/09-INTEGRATION-PLAN.md](docs/09-INTEGRATION-PLAN.md) |

## Planned stack

React 19 + TypeScript + Vite + Tailwind CSS (web) / Node 22 TypeScript Lambda behind
API Gateway HTTP API / DynamoDB / S3 / EventBridge / Amplify Hosting.
Full rationale in [docs/05-ARCHITECTURE.md](docs/05-ARCHITECTURE.md).

## Source documents

- [First_Commit_2026_Complete_Rules_Checklist.md](First_Commit_2026_Complete_Rules_Checklist.md) - competition rulebook
- [DeadStock_Exchange_Hackathon_Project_Structure.docx](DeadStock_Exchange_Hackathon_Project_Structure.docx) - original project brief

Where these specs conflict with the **live official rules**, the official rules win.
