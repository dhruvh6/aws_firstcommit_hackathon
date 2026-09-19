# Demo Recording Script

**Target: 2:50. Hard limit 3:00.** Subtitles: [`../demo/subtitles.srt`](../demo/subtitles.srt).

Every value you type is in this file. Do not improvise numbers on camera - the dates in
particular are load-bearing (see § Dates).

---

## 1. Before you press record

| | |
|---|---|
| Resolution | 1920x1080, browser zoom **100%** |
| Browser | Fresh profile, no extensions, no bookmarks bar, **no other tabs** |
| Crop | Record the browser **content area only** - no OS chrome, no dock, no tab strip. Everything below is designed to read at 1080p |
| Notifications | Do Not Disturb on |
| Acting business | Start as **Furniture Workshop A** |

**Seed the data first** (see § Clean state), then open the app and leave it on Home.

### Dates - the one thing that will silently break the demo

Run this and use exactly what it prints:

```bash
API_BASE_URL=<live api> npm run seed:demo -- --dry-run
```

For **19 September** it prints:

```
supplier lists  80 kg, available 2026-09-19 -> 2026-09-22
buyer needs     50 kg, needed by 2026-09-21, within 15 km
```

If you pick a "needed by" **after** the listing's availability window, match check C5 fails
and the compatible match **disappears mid-take**. That is the single easiest way to ruin a
recording.

---

## 2. Shot list

### 0:00-0:18 - The problem
**Screen:** Home, top of page.
**Do:** Nothing. Let the hero sit still while you talk.

> A furniture workshop in Mumbai produces eighty kilos of clean plywood offcuts every week.
> Two kilometres away, a decor business buys new wood for the same purpose. Neither knows
> the other exists. The material has value - what is missing is coordination.

### 0:18-0:30 - What it is
**Screen:** Slow scroll down Home - category tiles, then a rail.
**Do:** One smooth scroll. Stop on the rails.

> DeadStock Exchange turns one business's surplus into another's raw material. Structured
> listings, real quantities, real dimensions - not a photo and a phone number.

### 0:30-1:05 - Supplier lists surplus
**Screen:** `+ List Surplus`.
**Type:** Wood & plywood offcuts · "Plywood offcuts, clean and dry" · **80** kg ·
Clean, usable · smallest **15** cm · largest **40** cm · treated **No** ·
**2026-09-19 → 2026-09-22** · Buyer collects.
**Do:** Submit. Land on the listing.

> The workshop lists it in under a minute. Category, quantity, condition, and the
> dimensions that decide whether anyone can actually use it.

### 1:05-1:25 - Buyer states demand
**Screen:** Business switcher → **Decor & Packaging Business B** → `Post a Requirement`.
**Type:** Wood & plywood offcuts · **50** kg · accept **Unused** and **Clean, usable** ·
minimum usable piece **10** cm · accept treated **No** · **15 km** ·
needed by **2026-09-21**.
**Do:** Submit.

> Now the other side. The decor business says what it needs - fifty kilos, nothing under
> ten centimetres, untreated, within fifteen kilometres.

### 1:25-1:50 - THE MOMENT: match + explanation
**Screen:** Lands straight on match results. **No loading spinner** - the cache was primed.
**Do:** Cursor slowly down the six green checks. Then expand "did not match".

> One compatible match, and it shows exactly why: category, quantity, minimum size,
> condition, availability window, distance. Six checks, in plain words. Two other listings
> nearby did not match - and it tells you which check each one failed. No relevance score,
> no black box.

**This is the most important twenty-five seconds in the video. Do not rush the checks.**

### 1:50-2:10 - Partial reservation
**Screen:** Reserve 50 kg → review page → Confirm.
**Do:** Show the stepper at 50, point at "Supplier keeps 30 kg", confirm.

> Reserve fifty of the eighty. Partial reservation is the normal case, not an edge case.
> The supplier keeps thirty. A conditional write in DynamoDB makes over-reservation
> impossible - two buyers cannot take the same fifty kilos.

### 2:10-2:25 - Handoff and impact
**Screen:** Switch to **Furniture Workshop A** → Dashboard → Incoming → Confirm handoff →
then Impact.
**Do:** Confirm in the dialog, then navigate to Impact.

> The supplier confirms the material physically changed hands. Only then is it recorded as
> reuse - fifty kilos, from a completed transaction, not an estimate.

### 2:25-2:45 - AWS
**Screen:** Architecture diagram, then the AWS console: API Gateway routes → Lambda →
**the DynamoDB item showing availableQuantity 30**.
**Do:** Land on the DynamoDB item and hold for two seconds.

> React on Amplify, API Gateway to Lambda, DynamoDB for state. That conditional write is
> what makes over-reservation impossible. Here is the row - thirty kilos remaining, written
> by the reservation you just watched.

**The DynamoDB item is the strongest evidence in the video that AWS is doing real work.**

### 2:45-2:55 - Close
**Screen:** Impact page.

> Fifty kilos redirected from one match. Four days: our first infrastructure-as-code
> deployment, our first DynamoDB transaction, and a matching engine that explains itself.

---

## 3. Novelties to make sure land

If something has to be cut, cut scrolling - never these:

1. **Six checks in plain words** (1:25). No competitor shows *why* a match failed.
2. **Partial reservation** (1:50). 50 of 80, supplier keeps 30.
3. **The conditional write** (1:50 + 2:25). Over-reservation is impossible by construction.
4. **Impact from completed handoffs only** (2:10). Not estimates, not CO2e claims.
5. **Requirements as first-class objects** (1:05). The system matches demand to supply, it
   does not just list goods.

---

## 4. Clean state

The contract suite leaves probe listings behind, so reset before the real take.

**Local (easiest, resets every restart):** stop and restart `npm run dev` - the in-memory
driver reseeds from `fixtures/` on boot.

**Deployed:** `npm run reset:dynamo` then `API_BASE_URL=<live> npm run seed:demo`.

Either way, **`lst_001` and `req_001` are created live on camera**, so the seed deliberately
leaves them out.

---

## 5. Which build to record

| Option | Use when |
|---|---|
| **Amplify URL** | Best - it is the Ship It artefact. Use it if Amplify is live |
| **Local frontend against the live API** | Acceptable. The AWS console segment still proves the backend is real |
| Fully local | Last resort - the AWS segment then has to carry the whole Ship It claim |

---

## 6. After recording

- [ ] Watch it end to end once, with sound
- [ ] Timer reads **<= 3:00**
- [ ] Text readable when the video is scaled to phone size
- [ ] Nothing narrated that is not on screen
- [ ] Subtitles synced (`demo/subtitles.srt`)
- [ ] Exported and the link opens in a private window
