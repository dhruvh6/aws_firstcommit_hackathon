# 09 - Integration Plan

**Owner:** M4. Everyone follows it.

Four people writing code on four machines converge exactly as well as their integration
discipline allows. This document is that discipline: how branches work, when we merge, how a
contract changes, and how mocks become the real API without a bad afternoon.

All times **IST**. Adjust the clock times on Day 1 to whatever the team actually agrees, then
commit the change - but keep three checkpoints a day.

---

## 1. Branching

```
main                    always green, always deployable. Amplify auto-deploys from it
 ├── feat/m1-browse-screen
 ├── feat/m2-matching-engine
 ├── feat/m3-dynamo-repo
 └── chore/m4-contract-tests
```

| Rule | Detail |
|---|---|
| Branch naming | `feat|fix|chore/m<N>-<short-slug>` - the owner is visible in the branch name |
| Branch lifetime | **Under one day.** A branch older than 24 h is a merge conflict maturing |
| Merge into `main` | Pull request, CI green, squash merge |
| Review | One approval from any other member. Never self-merge except at a checkpoint, and then say so in the PR |
| Direct pushes to `main` | Only M4, only to unblock a red `main`, and announced |
| Force-push to `main` | Never. It corrupts the shared history the organisers will inspect |
| Rebase | Rebase **your own** branch onto `main` before opening the PR. Never rebase a shared branch |

### Commit messages

```
<scope>: <imperative summary>

feat(web): add filter rail with URL-synced query params
feat(api): implement six-check matching engine
feat(infra): add DynamoDB tables with category-city GSI
fix(api): return 409 INSUFFICIENT_QUANTITY instead of 500 on conditional failure
test(api): cover double-handoff idempotency
docs: record SAM as the deployment choice
```

Scopes: `web`, `api`, `infra`, `shared`, `docs`, `fixtures`, `ci`.

**Commit real work, in real increments.** No padding commits to make the history look busy -
[the rules](../First_Commit_2026_Complete_Rules_Checklist.md) § 5 explicitly warn against it,
and a history of meaningful commits is stronger evidence of four days of genuine work than
volume is. Equally: **push at least twice a day.** Work on one laptop is work the team cannot
integrate, and an evenly distributed four-person history across 17-20 September is exactly
what the organisers look for.

If you used an AI coding assistant on a change, that is allowed and expected - it is
disclosed once in the README's *AI Tools Used* section, not in every commit message.

## 2. Checkpoints

Async by default: post the required line in the team channel by the checkpoint time. Only
**CP0** and **CP3B** need everyone live at once.

| # | When | Who | Required artefact | Gate |
|---|---|---|---|---|
| **CP0** | Day 1, start | all, live 60 min | Contract confirmed out loud, roster committed, scaffold pushed, `npm i` works for all four | Nobody codes before this |
| CP1 | Day 1, 18:00 | async | M2: `shared/src/domain.ts` + `repo/index.ts` on `main`. M4: `fixtures/` on `main`. M1: shell renders. M3: tables deployed | M2 and M4 are on the critical path here |
| CP2 | Day 1, 23:00 | async | M2: create+list listings on `:3001`. M1: eight components + client + mocks. M3: hello-world Lambda URL posted. M4: CI green | **Day-1 gate:** a listing can be created and read somewhere |
| CP3 | Day 2, 13:00 | async | M2: matching engine + § 8 tests passing. M1: `ListingCard` + browse. M3: `dynamo.ts` half done | |
| CP4 | Day 2, 23:00 | async | M2: `/requirements/{id}/matches` correct on fixtures. M1: browse + detail + list-surplus on mocks. M3: dynamo repo passing the same calls as memory. M4: contract suite written | **Day-2 gate:** matching works and is explained |
| CP5 | Day 3, 13:00 | async | M2: reservations + handoff + impact. M3: Amplify live URL posted | |
| **CP3B** | Day 3, 17:00 | all, live 30 min | **The cutover** - § 4 below | The highest-risk half hour of the four days |
| CP6 | Day 3, 23:00 | async | Full flow works on the deployed URL. M4: deployed contract suite green, README complete | **Day-3 gate:** end-to-end on AWS |
| CP7 | Day 4, 12:00 | all, 15 min | **Feature freeze.** Only bug fixes after this | M4 enforces |
| CP8 | Day 4, 17:00 | all | Demo recorded, write-up drafted | |
| CP9 | Day 4, 20:00 | all | **Submitted.** Then re-verify every link | Never leave this to the deadline |

### Where we actually are - updated 18 September, 03:00

**CP2 was missed.** No listing could be created or read anywhere at Day 1, 23:00: the
`Repo` interface, the in-memory repository and every endpoint beyond `/v1/health` were
unstarted, and nothing was deployed.

Revised sequence, agreed on Day 2:

| When | What | Who |
|---|---|---|
| Day 2, ~10:00 | `api/src/repo/index.ts` - the interface only, no implementation. **This is the whole team's blocker** | M2 |
| Day 2, all day | Tables in code, SAM skeleton, hello-world deployed, invoke URL posted. Blocked on nothing | M3 |
| Day 2, all day | Fetch client, MSW handlers with failure paths, the eight components, the shell | M1 |
| Day 2, all day | Contract suite (done), demo seed script, chase the gates | M4 |
| Day 3 | M2's full PR: memory repo, the P0 endpoints, matching engine, reservations, handoff, impact | M2 |
| **Day 3, 23:00** | **Decision point: if nothing works on AWS by now, switch to the Build It framing** ([08-TEAM-ROLES.md](08-TEAM-ROLES.md) § 10) and record the demo locally. Deciding this on Saturday night is a strategy; discovering it on Sunday evening is a lost submission | all |

Consequences already accepted: the API surface is cut from 19 routes to 11
([04-API-CONTRACT.md](04-API-CONTRACT.md) § 2), and S1 Home and S10 Impact move to last in
M1's order behind the demo path S4 -> S5 -> S6 -> S7 -> S8.

If a gate is missed, the response is to **cut scope, not to extend the day** - drop a P1,
drop a screen, drop the optional charts. Cutting scope on Day 2 is a decision; discovering
on Day 4 that nothing integrates is an accident.

## 3. Contract changes

[02](02-DOMAIN-MODEL.md), [03](03-MATCHING-SPEC.md), [04](04-API-CONTRACT.md) and
[07](07-DESIGN-SYSTEM.md) are frozen. They are frozen because three people are coding
against them simultaneously, not because they are perfect.

**Process** - target turnaround under 30 minutes:

1. Open a GitHub issue labelled `contract`: what you need, why, which endpoints or entities
   move, and who is affected.
2. Post the issue link in the channel with `@` the affected members.
3. M4 decides, and edits the doc in the same PR as the code that depends on it.
4. M4 posts the change in the channel as a one-liner: *"CONTRACT: `Listing.referencePriceInr`
   is now optional-nullable. Affects M1 (PDP), M2 (validator)."*
5. The affected members pull before their next commit.

**Do not**: change a field name in your own code and assume the others will notice; add an
enum value silently ([02](02-DOMAIN-MODEL.md) § 3); change a status code because it felt more
correct; rename anything in `shared/` without an issue.

**Cheap vs expensive changes.** Adding an *optional* response field, an endpoint, or a query
param is cheap - just announce it. Renaming a field, changing a type, changing a status code,
or adding a required request field is expensive and needs the full process.

## 4. The mock-to-real cutover (CP3B)

The single highest-risk transition. Everyone live, 30 minutes, in this order.

**Before the call** - M3 posts the deployed base URL; M4 confirms the deployed contract suite
is green; M1 confirms every screen works on mocks.

**On the call**

1. M1 sets `VITE_USE_MOCKS=false` and `VITE_API_BASE_URL=<deployed>` in `.env.local`, then
   walks the primary flow: browse -> detail -> reserve -> confirm -> handoff -> impact.
2. Every failure is called out loud as **shape**, **status** or **missing**:
   - **Shape** - field name, nesting or type differs from [04](04-API-CONTRACT.md). The side
     that deviates from the doc fixes it. The doc is the referee.
   - **Status** - wrong code or wrong error `code`. M2 fixes.
   - **Missing** - endpoint not deployed yet. M3 redeploys; M1 stays on mocks for that screen only.
3. M4 writes each failure as an issue with the exact request and response. No "it didn't
   work" - paste the payload.
4. Fix live if it takes under five minutes; otherwise ship it as an issue and move on.

**After the call:** M1 commits the switch, MSW stays in the repo behind `VITE_USE_MOCKS` (it
is the offline fallback if AWS misbehaves on Day 4), and the demo is only ever recorded
against the real API.

## 5. Merge order when several PRs are open

`shared/` first, then `api/`, then `web/`, then `infra/`, then `docs/`. Types before the code
that imports them; the API before the UI that calls it. Anyone merging out of order owns the
resulting broken `main`.

`main` is red -> **stop merging.** Whoever broke it fixes it or reverts within 15 minutes.
A revert is not a failure; a red `main` for an hour across four machines is.

## 6. CI (GitHub Actions, on push and PR)

```yaml
# .github/workflows/ci.yml  (M4 owns)
npm ci
npm run typecheck          # tsc --noEmit, all workspaces
npm run lint               # eslint
npm test                   # unit: api/domain + repo/memory
npm run build              # web + api
```

Under three minutes, or people start ignoring it. No deploy step in CI - Amplify handles the
frontend, and M3 deploys the backend deliberately. An automated backend deploy on a red
afternoon is how a working demo becomes a broken one.

## 7. Conflict rules

| Situation | Resolution |
|---|---|
| Two people edited the same file | Should be impossible - see [08](08-TEAM-ROLES.md) § 3. If it happened, the owner's version wins, the other re-applies |
| `package-lock.json` conflict | Take `main`'s version, re-run `npm i`, commit the result |
| Code disagrees with the doc | **The doc wins** until a contract change lands |
| Two people disagree on a product call | M4 decides in under five minutes. Recorded in the issue. Move on |
| Something is ambiguous in a doc | Ask M4; M4 edits the doc, not just the channel reply |

## 8. Definition of done

**A task** is done when: it works on your machine; it is pushed to a branch; its PR is CI-green
and merged to `main`; states and errors are handled, not just the happy path; and no secret,
no `console.log` of a payload, and no commented-out block went with it.

**The project** is done when: the primary flow works on the deployed URL from a fresh browser
profile; the contract suite is green against the deployment; the README carries problem,
solution, architecture, AWS usage, learning, credits and **AI tools used**; the demo video is
under three minutes and shows the working product *and* AWS; the repository is public with an
honest 17-20 September history; and the submission form is filled with working links.

## 9. Day 4 freeze rules

After CP7 (Day 4, 12:00):

**Allowed** - fixing a crash on the demo path; fixing wrong data; copy and label corrections;
seeding demo data; README and write-up; recording and re-recording the demo.

**Not allowed** - new endpoints, new screens, new libraries, refactors, renaming anything in
`shared/`, "quick" P1 items, touching IAM or the deploy pipeline after the last verified deploy.

If something is broken and cannot be fixed safely, **cut it from the demo** rather than
risking the build. A missing feature costs one line in the write-up. A broken live URL costs
the track.

## 10. Backup and recovery

- `main` on GitHub is the only source of truth. Nothing lives only on a laptop.
- M4 keeps a tagged `v-demo` commit at the exact state the video was recorded from, so the
  repository always matches the video.
- M3 keeps `infra/` reproducible: a clean-checkout deploy is verified on Day 4, which is also
  the proof the stack is not console-built.
- The seed script is re-runnable and idempotent: any bad demo state is one command from clean.
- If AWS fails on Day 4: `VITE_USE_MOCKS=true` plus `REPO_DRIVER=memory` still gives a working
  local product to demo, and the submission moves to the Build It framing
  ([08](08-TEAM-ROLES.md) § 10). Decide by 17:00, not at 23:00.
