# 10 - Demo, Seed Data & Submission

**Owner:** M4. Source of truth for the rules:
[../First_Commit_2026_Complete_Rules_Checklist.md](../First_Commit_2026_Complete_Rules_Checklist.md).
Where this document and the **live official rules** disagree, the official rules win.

---

## 1. Eligibility - verify on Day 1, per member

Each member ticks their own row. A single unverified member can invalidate the team's entry.
Confirmations are collected in
**[issue #1](https://github.com/dhruvh6/aws_firstcommit_hackathon/issues/1)** - transcribe
them here as they arrive, so the record lives in the repository and not only in a thread.

| Item | M1 | M2 | M3 | M4 |
|---|---|---|---|---|
| University student in India | ☐ | ☐ | ☐ | ☐ |
| 18 or older | ☐ | ☐ | ☐ | ☐ |
| Registered individually for the Bharat Builds Tour | ☐ | ☐ | ☐ | ☐ |
| WeMakeDevs account | ☐ | ☐ | ☐ | ☐ |
| AWS Builder Center profile | ☐ | ☐ | ☐ | ☐ |
| Student status verified on Builder Center | ☐ | ☐ | ☐ | ☐ |
| **Checked in to First Commit specifically** | ☐ | ☐ | ☐ | ☐ |
| On no other team for this stop | ☐ | ☐ | ☐ | ☐ |

One tour registration covers the six tour stops, but each hackathon needs its own check-in.
M4 confirms all four rows are complete at CP1 and says so in the channel.

### How to check in - each person does their own

Verified against the official pages on 17 September 2026.

| # | Step | Where |
|---|---|---|
| 1 | **AWS Builder Center profile.** "Free, no credit card, two minutes to sign up" | builder.aws.com |
| 2 | **Verify your student status.** Required to compete, not just to register | `bit.ly/abc-verify`, linked from the event page |
| 3 | **Register for the Bharat Builds Tour.** One registration covers all six stops | `wemakedevs.org/aws` |
| 4 | **Check in to First Commit itself** - the **"Check in"** button on the event page. This is the step that "enters you in the hackathon online" and is *separate* from tour registration | `wemakedevs.org/aws/first-commit` |

The rules are explicit that this cannot be delegated: *"Every member registers for the tour
with their own account. A captain cannot register the rest of the team."*

**Optional in-person day:** Saturday 19 September, 8 AM - 8 PM, Polaris School of
Technology, Bengaluru. Separate signup at `luma.com/first-commit`; limited seats, confirmed
by email. It does **not** add to the judging score - treat it as mentor access and
workshops, not as points.

### The deadline time is not published yet

As of 17 September the schedule page says: *"The hours are being finalised: the kickoff
call, mentor sessions, and the deadline the clock stops on. They land on this page first,
and everyone registered is told the same day."*

So the CP9 target of Sunday 20:00 in [09-INTEGRATION-PLAN.md](09-INTEGRATION-PLAN.md) § 2 is
**our own target, not the official cutoff**. Two consequences:

1. M4 checks `wemakedevs.org/aws/first-commit/schedule` once a day and posts any change.
   **Checked 18 September, 15:00 IST: still unpublished**, same wording as the day before -
   no kickoff time, no mentor session times, no deadline, and the in-person hours are listed
   as pending on the schedule page even though the overview page says 8 AM - 8 PM. Keep
   checking; until it appears, our own CP9 target stands.
2. Submit something valid **early** and refine it. The rules allow editing a submission up
   to the deadline but not after it, so a valid submission on Saturday night beats aiming at
   an unknown Sunday time.

## 2. Submission - three artefacts

| # | Artefact | Owner | Required content |
|---|---|---|---|
| 1 | **Public GitHub repository** | M4 | Honest 17-20 Sep history, complete README, no secrets |
| 2 | **Demo video, <= 3:00** | M4 | Problem, working product, AWS usage, impact, learning |
| 3 | **Short write-up** | M4 | Problem, what we built, where AWS fits, **AI tools used** |

One submission per team, through the First Commit form, before the deadline. Submit early -
the rules allow editing a submission up to the deadline but not after it. **Target CP9,
Day 4 20:00.**

## 3. Demo seed state

`scripts/seed-demo.mts` puts the exchange into exactly this state. Re-runnable and
idempotent - any bad state is one command from clean. Full data in
[`../fixtures/`](../fixtures/).

```bash
npm run seed:demo                        # against localhost:3001/v1
npm run seed:demo -- --dry-run           # print the plan, change nothing
npm run seed:demo -- --include-star      # also seed lst_001 and req_001 (rehearsal)
npm run seed:demo -- --today 2026-09-20  # preview demo-day dates
npm run seed:demo -- --verbose           # print every POST body
API_BASE_URL=<deployed> npm run seed:demo
```

**Every date is shifted by `today - 2026-09-17`.** The fixtures encode *offsets*, not
absolute dates; the literals are an accident of when they were written. The script also
prints the two dates to type on camera and checks them against match rule C5, so the
compatible match cannot vanish mid-recording (see [../fixtures/README.md](../fixtures/README.md) § 5).

It refuses to guess: it fails with a clear message and a non-zero exit if the API is
unreachable or a business is missing, warns if reservations already exist, and warns if any
listing already in the store has a window ending today or earlier.

### Businesses

| id | Name | Area | Type |
|---|---|---|---|
| `biz_001` | Furniture Workshop A | Andheri East, Mumbai | Furniture manufacturing |
| `biz_002` | Decor & Packaging Business B | Bandra West, Mumbai | Decor products & packaging |
| `biz_003` | Prakash Garment Unit | Dadar, Mumbai | Garment manufacturing |
| `biz_004` | Vega Acrylic Signage | Kurla, Mumbai | Signage & acrylic fabrication |
| `biz_005` | Sunrise Print & Pack | Goregaon, Mumbai | Printing & packaging |
| `biz_006` | Coastal Wood Traders | Vashi, Navi Mumbai | Timber trading |

### Listings

| id | Supplier | Material | Qty | Condition | Key attributes | Until |
|---|---|---|---|---|---|---|
| `lst_001` | `biz_001` | Wood offcuts | 80 kg | Clean, usable | 15-40 cm, untreated | 20 Sep |
| `lst_002` | `biz_005` | Packaging cartons | 400 units | Unused | 5-ply, printed | 30 Sep |
| `lst_003` | `biz_003` | Cotton twill remnants | 120 kg | Clean, usable | 40-150 cm, 240 gsm | 22 Sep |
| `lst_004` | `biz_004` | Cast acrylic cut-offs | 60 sheets | Unused | 3 mm, 30-45 cm, clear | 25 Sep |
| `lst_005` | `biz_001` | Wood offcuts, mixed lot | 25 kg | Mixed | 5-20 cm, treated | 20 Sep |
| `lst_006` | `biz_006` | Wood offcuts | 200 kg | Clean, usable | 20-50 cm, untreated | 25 Sep |

`lst_005` and `lst_006` exist **to be near-misses**: `lst_005` fails piece size, treatment and
condition; `lst_006` fails only distance. They are what makes the explanation panel
convincing on camera - a single green match proves less than a green match beside two
precisely-explained red ones.

### Requirements

| id | Buyer | Needs | Constraints | By |
|---|---|---|---|---|
| `req_001` | `biz_002` | 50 kg wood offcuts | >= 10 cm, untreated, Unused/Clean, 15 km | 19 Sep |
| `req_002` | `biz_002` | 150 units cartons | >= 3-ply, printed acceptable, 25 km | 25 Sep |
| `req_003` | `biz_004` | 40 kg cotton twill | >= 30 cm, 25 km | 24 Sep |
| `req_004` | `biz_005` | 20 sheets acrylic | 2-4 mm, >= 25 cm, 25 km | 28 Sep |

### State at "record" time

- No reservations, no impact records. The video creates the first one live.
- `RESERVATION_TTL_MINUTES=30` so the hold countdown is visibly short on camera.
- Browser: fresh profile, no extensions, 1920x1080, zoom 100%, acting as
  **Furniture Workshop A**.
- **`lst_001` and `req_001` are both created live during the recording** - the seed contains
  `lst_002`-`lst_006` and `req_002`-`req_004` only.

**Why the star listing is not seeded.** Verified by rehearsal on 18 September: seeding
`lst_001` *and* creating the 80 kg listing on camera puts **two identical compatible
listings** in the match set, which muddies the one screen the whole submission rests on.
With `lst_001` left out, the rehearsal produces exactly the documented result:

```
compatible=1  near-misses=2
COMPATIBLE  <created on camera>   qty=50  dist=6.9   fails=-
near-miss   lst_006 clone         qty=50  dist=19.8  fails=[WITHIN_SERVICE_AREA]
near-miss   lst_005 clone         qty=25  dist=6.9   fails=[ATTRIBUTES_SATISFIED, CONDITION_ACCEPTED]
```

One green card with six ticks, two red cards each failing for a different, stated reason.
That is the shot.

## 4. Demo video

Maximum **3:00**. There is no live judging call - what is in the video is the entire
evaluation of the product. A feature that is not demonstrated does not count.

### Shot list

| Time | Beat | On screen | Says |
|---|---|---|---|
| 0:00-0:20 | **Problem** | Split: a workshop's stacked offcuts / a purchase order for new wood | "A Mumbai furniture workshop produces 80 kg of clean plywood offcuts a week. Two kilometres away, a decor business buys new wood for the same purpose. Neither knows about the other." |
| 0:20-0:35 | **Product** | Home screen, dual CTA visible | "DeadStock Exchange connects usable B2B surplus with real material demand." |
| 0:35-1:10 | **Supplier lists** | `/listings/new`, filled live, submit, land on the listing | "The workshop lists it: 80 kg, clean, untreated, 15 to 40 cm, available until the 20th." |
| 1:10-1:35 | **Buyer states demand** | Switch business, `/requirements/new`, submit | "The decor business says what it needs: 50 kg, nothing under 10 cm, untreated, within 15 km, by the 19th." |
| 1:35-1:55 | **WOW - match + explanation** | Match screen; cursor down the six ticks; expand the two near-misses | "One compatible match - and it shows exactly why: category, quantity, size, condition, availability, distance. Two other listings nearby didn't match, and it says why." |
| 1:55-2:15 | **Reserve** | Stepper at 50, confirm, supplier stock 80 -> 30 | "Reserve 50 kg. The supplier's available quantity drops to 30 - no double allocation, guaranteed by a conditional write." |
| 2:15-2:30 | **Handoff + impact** | Switch to supplier, Confirm handoff, then `/impact` | "The supplier confirms the handoff, and 50 kg is recorded as reused - from a completed transaction, not an estimate." |
| 2:30-2:50 | **AWS** | Architecture diagram, then the console: API Gateway routes, Lambda, the DynamoDB item at 30 kg, the EventBridge rule | "React on Amplify, API Gateway to Lambda, DynamoDB for state - the conditional write is what makes over-reservation impossible - S3 for photos, EventBridge expiring stale listings." |
| 2:50-3:00 | **Impact + learning** | Impact dashboard | "50 kg redirected from one match - 62.5% of that supplier's surplus. Four days: our first infrastructure-as-code deployment, our first DynamoDB transaction, and a matching engine that explains itself." |

### Recording rules

1. Record **against the deployed URL**, never localhost, never mocks.
2. 1080p, browser zoom 100%. Text must be readable on a phone.
3. Practise twice before recording. Budget 2:50, not 3:00.
4. No dead air waiting for a load - re-record instead of cutting mid-sentence.
5. Show the **real** DynamoDB item at 30 kg. That single console shot is the strongest
   available evidence that AWS is doing actual work.
6. Clear audio, or clean on-screen captions if audio is not possible.
7. Never narrate a feature that is not on screen.
8. Export, watch it end to end once, confirm the timer reads <= 3:00.

## 5. Write-up template

Mirrors the structure the rules recommend. M4 drafts on Day 3, finalises on Day 4.

```markdown
# DeadStock Exchange

## Problem
Small manufacturers accumulate usable surplus material while nearby businesses buy the same
material new. The material has value; the coordination does not exist.

## Solution
A B2B circular-material exchange: structured surplus listings, buyer requirements,
deterministic explainable matching, partial reservation, handoff confirmation, measured reuse.

## Core workflow
Surplus material -> structured listing -> match -> reservation -> handoff -> measurable reuse.

## Architecture
React SPA on Amplify Hosting -> API Gateway (HTTP API) -> Lambda (Node 22, TypeScript) ->
DynamoDB, with S3 for listing photos and EventBridge for expiry. Region ap-south-1.

## AWS usage - what each service actually does
- **API Gateway** - the single HTTPS entry point for the SPA.
- **Lambda** - validation, the six-check matching engine, the reservation transaction, impact aggregation.
- **DynamoDB** - all state; a conditional write on `availableQuantity` makes double allocation impossible.
- **S3** - listing photographs, uploaded by presigned PUT.
- **EventBridge** - a 5-minute schedule expiring stale listings and releasing lapsed reservations.
- **Amplify Hosting** - builds and serves the SPA; the live URL.

## What we built during First Commit (17-20 September 2026)
Everything in this repository. The repository was created on 17 September and its history is
the four days of the event.

## Learning
<from docs/LEARNING-LOG.md - what was new, what failed first, what we changed and why>

## Tech stack
React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, MSW; Node 22 Lambda; DynamoDB;
AWS SAM; Amplify Hosting.

## Third-party credits
<libraries and licences; all placeholder imagery drawn by us as SVG>

## AI tools used
<e.g. Claude Code, GitHub Copilot, ChatGPT - list every assistant actually used>

## Run it
Live URL: <amplify url>
Local: `npm i && npm run dev` (runs against an in-memory repository seeded from `fixtures/`)
```

## 6. Pre-submission checklist

### Project validity
- [ ] Repository created **during** the event window; no earlier work imported
- [ ] History spans 17-20 September with contributions from all members
- [ ] No padding commits; every commit is real work
- [ ] All external code licensed and credited
- [ ] **AI coding tools disclosed in the README**

### AWS
- [ ] AWS is genuinely used, not decorative
- [ ] Every service has a stated job ([05](05-ARCHITECTURE.md) § 2)
- [ ] Live URL works from a fresh browser profile and one phone
- [ ] AWS usage is visible on camera - console shot included
- [ ] Infrastructure is in `infra/`, not console-only

### Product
- [ ] Primary flow works end to end on the deployed URL
- [ ] Validation errors handled on every form
- [ ] Double reservation returns `409` and shows a real message
- [ ] Double handoff cannot double-count impact
- [ ] No feature in the pitch that does not exist
- [ ] Seed data loaded and verified

### Repository
- [ ] **Public**
- [ ] README: problem, solution, workflow, architecture, AWS usage, learning, stack, credits, AI tools, run instructions, live URL
- [ ] Architecture diagram committed
- [ ] `.env.example` only; no `.env`
- [ ] **Secret scan of the working tree and the full history** - `git log -p | grep -iE 'aws_secret|AKIA|password|BEGIN .*PRIVATE KEY'`
- [ ] No personal data of any real person; all businesses synthetic
- [ ] `npm i && npm run dev` works from a clean clone

### Demo
- [ ] <= 3:00, verified on the exported file
- [ ] Shows the problem, the working product, AWS, impact, learning
- [ ] Recorded against the deployed URL
- [ ] Legible at 1080p; audio or captions clear
- [ ] Nothing narrated that is not shown
- [ ] Link/file works in the form's required format

### Write-up
- [ ] Problem, build, AWS usage, AI tools
- [ ] Learning and challenges included
- [ ] Assumptions stated - including that P0 uses a business switcher rather than
      authentication ([01](01-PRD.md) § 8)

### Submission
- [ ] One submission, correct First Commit form
- [ ] Submitted before the deadline, ideally hours early
- [ ] Every link opened and checked in a fresh browser after submitting
- [ ] Repository still public after final push
- [ ] `v-demo` tag matches what the video shows

## 7. Things that disqualify - read once more before submitting

- Prior work presented as new
- Repository history inconsistent with 17-20 September
- Plagiarism, or unlicensed external work
- Missing attribution
- Late submission
- Code of Conduct violations

All six are avoidable by construction: a fresh repository, honest commits, credited
dependencies and an early submission.

## 8. After submitting

- [ ] Certificates: everyone who submits gets one - so **submit**, do not just register
- [ ] Optionally write a blog post on the build (the event lists blog prizes)
- [ ] Members in the 2027/2028 graduation cohorts: keep registration details and the verified
      Builder Center profile accurate, since the Amazon fast-track consideration draws on them
- [ ] Keep the AWS stack up until results, then tear it down to stop any cost
- [ ] Append the last learning-log entries while the four days are still fresh
