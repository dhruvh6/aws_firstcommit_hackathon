# 00 - Index: Start Here

**Everyone reads this file and [08-TEAM-ROLES.md](08-TEAM-ROLES.md) before writing any code.**

## Why these docs exist

Four people, four machines, four days, and almost no live communication. That combination
fails in one specific way: two people build halves of the same feature against two different
mental models, and the halves do not fit on Day 4.

The fix is to move all the coordination into writing **now**, before anyone codes.
These documents are the shared mental model. If the code and the docs disagree during
build, the docs win until someone files a contract change (process in
[09-INTEGRATION-PLAN.md](09-INTEGRATION-PLAN.md)).

## The document set

| # | Document | Owns the answer to | Frozen? |
|---|---|---|---|
| 01 | [PRD](01-PRD.md) | What are we building, for whom, and what is out of scope? | Scope frozen Day 1 |
| 02 | [Domain Model](02-DOMAIN-MODEL.md) | What are the entities, fields, enums and state machines? | **Frozen** |
| 03 | [Matching Spec](03-MATCHING-SPEC.md) | How does a match get decided and explained? | **Frozen** |
| 04 | [API Contract](04-API-CONTRACT.md) | Exact request/response shape of every endpoint | **Frozen** |
| 05 | [Architecture](05-ARCHITECTURE.md) | AWS services, repo layout, local dev, deploy | Stable |
| 06 | [UI Spec](06-UI-SPEC.md) | Every screen, layout, component and state | Stable |
| 07 | [Design System](07-DESIGN-SYSTEM.md) | Colour, type, spacing, component tokens, chart rules | **Frozen** |
| 08 | [Team & Roles](08-TEAM-ROLES.md) | Who owns which files and which tasks | Day 1 |
| 09 | [Integration Plan](09-INTEGRATION-PLAN.md) | Branching, checkpoints, mock-to-real cutover | Day 1 |
| 10 | [Demo & Submission](10-DEMO-AND-SUBMISSION.md) | Seed data, demo script, submission checklist | Day 3-4 |

"**Frozen**" means: do not change it unilaterally. It is the seam where your work meets
someone else's. Changing it silently is how the project breaks.

## Reading order by role

| Role | Read in this order |
|---|---|
| **M1 - Frontend / Product** | 01 -> 06 -> 07 -> 04 -> 03 -> 02 |
| **M2 - Backend / Logic** | 01 -> 02 -> 03 -> 04 -> 05 |
| **M3 - AWS / Infrastructure** | 01 -> 05 -> 02 -> 04 |
| **M4 - Integration / QA / Docs** | all of them, 01 through 10 |

Everyone reads 01, 04 and 08 in full. Skimming 04 is the single most expensive mistake
available to this team.

## The three artefacts that make independent work possible

1. **[04-API-CONTRACT.md](04-API-CONTRACT.md)** - the frozen HTTP contract. M1 codes
   against it without a running backend; M2 implements it without a running frontend.
2. **[../fixtures/](../fixtures/)** - shared seed data in the exact shape of the contract.
   M1 mocks with it, M2 unit-tests with it, M3 loads it into DynamoDB, M4 demos with it.
   Same numbers on all four machines, so screenshots and test output are comparable.
3. **The `Repo` interface** ([05-ARCHITECTURE.md](05-ARCHITECTURE.md) § Persistence) -
   M2 writes business logic against an in-memory implementation and never needs AWS
   credentials; M3 writes the DynamoDB implementation and never needs to read the
   matching engine.

## Ground rules

1. **Never edit a file you do not own.** Ownership table: [08-TEAM-ROLES.md](08-TEAM-ROLES.md)
   § File ownership. Need a change in someone else's file? Open an issue, do not push.
2. **Commit and push at least twice a day**, even if incomplete. Work sitting on one
   laptop is work the team cannot integrate.
3. **Meet the checkpoints** in [09-INTEGRATION-PLAN.md](09-INTEGRATION-PLAN.md), not the
   perfect version of your task.
4. **Keep a learning log.** Append to `docs/LEARNING-LOG.md` as you go - "Learning" is an
   official judging category and reconstructing it on Day 4 produces obviously fake notes.
5. **No secrets in Git, ever.** Not in a comment, not in a test, not "temporarily".
