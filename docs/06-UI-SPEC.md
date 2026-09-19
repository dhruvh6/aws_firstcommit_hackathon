# 06 - UI Specification

**Owner:** M1. **Design tokens and primitives:** [07-DESIGN-SYSTEM.md](07-DESIGN-SYSTEM.md).
**Data shapes:** [04-API-CONTRACT.md](04-API-CONTRACT.md).

Every screen below specifies layout, fields, states and acceptance criteria. M1 builds
against MSW mocks from [`../fixtures/`](../fixtures/) and needs no backend to finish any
screen on this list.

---

## 1. Design tension, resolved

The product is an exchange, not a shop. The **interface** is nonetheless a mainstream
marketplace, because buyers already know how to operate one and because Best UI is judged
on design and usability. Each borrowed pattern carries an exchange meaning:

| Marketplace pattern (Flipkart / Amazon) | Here it means |
|---|---|
| Search bar + category tiles | Find surplus material by type |
| Filter rail (price, brand, rating) | Quantity, distance, condition, dimensions, availability window |
| Product grid with cards | Surplus listings with available quantity and distance |
| Product detail page | Listing detail: attributes table, condition, availability countdown |
| Quantity stepper + "Add to cart" | **Partial reservation** - the core differentiating action |
| Checkout / order review | Reservation review: what you are holding, from whom, until when |
| "Your orders" | Reservations, both as buyer and as supplier |
| Seller dashboard | My listings with available / reserved / handed-off split |
| Wishlist / "notify me" | **Requirements** - a standing, matchable statement of demand |
| Relevance sort | Transparent six-check match explanation, never a hidden score |

Two rules keep the borrowing honest:

1. **No commerce theatre.** No prices in the hero, no discount badges, no "only 2 left!"
   urgency, no fake ratings, no star reviews, no cart icon with a counter. Nothing that
   implies a payment the product does not process.
2. **The explanation is the feature.** Wherever a marketplace would show a relevance score,
   this product shows six pass/fail checks in plain words.

## 2. Information architecture

```
/                           Home - marketplace landing
/browse                     Search results & filters      ?category=&q=&sort=...
/listings/:listingId        Listing detail (PDP)
/listings/new               List surplus (supplier form)
/requirements/new           Post a requirement (buyer form)
/requirements/:id/matches   Match results  ← the WOW screen
/reserve                    Reservation review           ?listingId=&requirementId=&qty=
/dashboard                  My listings / requirements / reservations  ?tab=
/reservations/:id           Reservation detail & handoff
/impact                     Impact dashboard
/*                          Not found
```

Ten routes. Anything not on this list is out of scope.

**Build order, revised 18 September.** The demo path comes first:
**S4 -> S5 -> S6 -> S7 -> S8**. S2 Browse and S3 Listing detail next. **S1 Home and S10
Impact are last** - a landing page and charts win nothing if the reservation flow is
broken, and the shot list in [10-DEMO-AND-SUBMISSION.md](10-DEMO-AND-SUBMISSION.md) § 4
only needs S4 through S8 plus a glance at S10.

The nine routes cut in [04-API-CONTRACT.md](04-API-CONTRACT.md) § 2 have **no UI**: no
withdraw button, no cancel-reservation button, no supplier-side matches screen, no photo
upload. Remove those affordances rather than wiring them to endpoints that do not exist.

## 3. Global shell

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ■ DeadStock Exchange   [ Search surplus material…            ] [🔍]                  │  56px, brand-blue
│                                        Acting as ▾ Furniture Workshop A  [+ List Surplus] │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ All materials ▾ │ Browse │ Post a Requirement │ My Dashboard │ Reservations ● 2 │ Impact │  40px, white
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Top bar** (sticky, brand blue): wordmark -> `/`; search input (submits to
`/browse?q=`, `Enter` and icon both work); **business switcher**; primary CTA
`+ List Surplus` (amber, right-aligned).

**Business switcher** - the P0 identity mechanism ([01](01-PRD.md) § 8). A dropdown of
`GET /v1/businesses` showing name, business type and area. Selection persists in
`localStorage` as `dse.actingBusinessId` and is sent as `X-Business-Id` on every request.
Changing it invalidates all cached queries and stays on the current route. It must be
**visibly labelled "Acting as"**, never dressed up as a logged-in user avatar - a judge
should see immediately that authentication is a stated, deliberate omission and not a bug.

**Secondary nav** (white, bottom border): category dropdown + the five destinations above.
`Reservations` carries a count badge of supplier-side `RESERVED` reservations - the "you owe
someone a handoff" signal.

**Footer** (dark): product line, the four category links, "Built for First Commit 2026 -
Ship It", a link to the public repository, and the small print
`Demo data only. Businesses and listings are synthetic.`

**Global behaviours**

| Behaviour | Spec |
|---|---|
| Toasts | Bottom-right, 4 s, success/error/info. Every mutation raises one |
| Route change | Scroll to top; focus moves to `<h1>` |
| Loading | Skeletons that match final layout. **No centred spinners** on data screens |
| Error | Inline error card with the API `message`, a Retry button, and the error `code` in small print |
| Offline / network failure | Full-width amber banner: `Cannot reach the exchange. Retrying…` |
| Unknown enum value | Render the raw string in a neutral chip. Never crash, never blank |
| Dates | `20 Sep` inside the current year; relative for < 48 h (`in 2 days`, `3 hours ago`) |
| Quantities | `80 kg`, `400 units`, `60 sheets` - unit label always adjacent, from `enumLabels.unit` |

---

## 4. S1 - Home  `/`

Purpose: in the first five seconds, make both sides of the exchange obvious.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  HERO  (blue gradient, 260px)                                                        │
│    Turn surplus material into someone else's raw material                            │
│    Wood, fabric, packaging and acrylic surplus from businesses near you              │
│    ┌────────────────────────────────┬─────────────┐                                  │
│    │ What material do you need?     │  Search  🔍 │                                  │
│    └────────────────────────────────┴─────────────┘                                  │
│    [ I have surplus → List Surplus ]   [ I need material → Post a Requirement ]      │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  CATEGORY TILES  (4 across, icon + label + live count)                               │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                                │
│   │ 🪵 Wood  │ │ 🧵 Fabric│ │ 📦 Packg.│ │ ▨ Acrylic│    "305 kg available" each      │
│   └──────────┘ └──────────┘ └──────────┘ └──────────┘                                │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  RAIL 1  Expiring soon — use it before it's lost          [ See all → ]              │
│  RAIL 2  Nearest to you                                    [ See all → ]             │
│  RAIL 3  Recently listed                                   [ See all → ]             │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  HOW IT WORKS   1 List surplus → 2 Post requirement → 3 See why it matches            │
│                 → 4 Reserve what you need → 5 Confirm handoff → 6 Impact recorded     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  IMPACT STRIP   50 kg reused  ·  1 completed exchange  ·  490 units surplus live      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- Rails are horizontally scrollable, 4 cards visible at 1440px, same `ListingCard` as browse.
- Rail queries: `?sort=EXPIRING_SOON&limit=8`, `?sort=DISTANCE_ASC&limit=8`,
  `?sort=RECENT&limit=8`.
- Category counts come from `GET /v1/impact` -> `byCategory[].activeSurplus`.
- The dual hero CTA is load-bearing: it is how a judge learns in two seconds that this is
  two-sided.
- **Empty platform state** (no listings at all): rails collapse to a single card reading
  `No surplus listed yet - be the first`, linking to `/listings/new`.

---

## 5. S2 - Browse  `/browse`

The Flipkart/Amazon search-results screen: left filter rail, right result grid.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Home › Wood & plywood offcuts                                                        │
│ 12 listings · Wood & plywood offcuts · within 15 km        Sort: [ Expiring soon ▾ ] │
├───────────────────┬──────────────────────────────────────────────────────────────────┤
│ FILTERS   (280px) │  ┌────────────┐ ┌────────────┐ ┌────────────┐                    │
│                   │  │  [photo]   │ │  [photo]   │ │  [photo]   │                    │
│ Category          │  │ Plywood    │ │ Cotton     │ │ 5-ply      │                    │
│  ☑ Wood offcuts   │  │ offcuts,   │ │ twill      │ │ cartons,   │                    │
│  ☐ Fabric offcuts │  │ clean/dry  │ │ remnants   │ │ unused     │                    │
│  ☐ Packaging      │  │            │ │            │ │            │                    │
│  ☐ Acrylic sheet  │  │ 80 kg avl  │ │ 120 kg avl │ │ 400 u avl  │                    │
│                   │  │ Clean,     │ │ Clean,     │ │ Unused     │                    │
│ Quantity (kg)     │  │ usable     │ │ usable     │ │            │                    │
│  [min ]–[max ]    │  │ 15–40 cm   │ │ 40–150 cm  │ │ 5-ply      │                    │
│                   │  │ 📍 6.9 km  │ │ 📍 8.2 km  │ │ 📍 4.1 km  │                    │
│ Distance          │  │ ⏳ 20 Sep  │ │ ⏳ 22 Sep  │ │ ⏳ 30 Sep  │                    │
│  ◉ 15 km  ○ 25    │  │ Workshop A │ │ Garment U. │ │ Print&Pack │                    │
│  ○ 50    ○ Any    │  │ [ Reserve ]│ │ [ Reserve ]│ │ [ Reserve ]│                    │
│                   │  └────────────┘ └────────────┘ └────────────┘                    │
│ Condition         │                                                                  │
│  ☑ Unused         │  … 3 per row at 1440px, 12 per page                              │
│  ☑ Clean, usable  │                                                                  │
│  ☐ Mixed          │  ┌──────────────────────────────────────────────────────────┐    │
│  ☐ Needs sorting  │  │ Tell us what you need and we will match it for you       │    │
│                   │  │ [ Post a Requirement → ]                                 │    │
│ Available on      │  └──────────────────────────────────────────────────────────┘    │
│  [ 2026-09-19  ]  │                                                                  │
│                   │                      [ Load more ]                               │
│ [ Clear all ]     │                                                                  │
└───────────────────┴──────────────────────────────────────────────────────────────────┘
```

**Filter behaviour.** Every filter is a URL query param - the URL is the state, so a
filtered view is shareable and the back button works. Changes debounce 300 ms and refetch.
Active filters appear as removable chips above the grid. `Clear all` resets to
`/browse` only. Result count updates in the heading, never silently.

**ListingCard** - the most-reused component in the app. Contents, top to bottom: photo or
category placeholder (4:3); title (2 lines, ellipsis); `availableQuantity` + unit in
semibold; condition chip; the one or two headline attributes for the category
(`15-40 cm`, `5-ply`, `3 mm`); distance with pin icon (omitted when no origin); availability
until, with an amber clock when `<= 2 days`; supplier name; `Reserve` button. A
`PARTIALLY_RESERVED` card additionally shows a thin allocation bar with
`30 of 80 kg still available`.

**States**: skeleton grid of 6 while loading; empty state
`No listings match these filters` with the two nearest relaxations offered as buttons
(`Widen to 25 km`, `Include "Mixed" condition`); error card with Retry.

The "post a requirement" promo card sits after row 2 and is how browse funnels into the
matching engine rather than dead-ending in scrolling.

---

## 6. S3 - Listing detail  `/listings/:listingId`

Amazon's PDP layout: gallery left, facts centre, sticky action box right.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Home › Wood & plywood offcuts › Plywood offcuts, clean and dry                       │
├────────────────────┬────────────────────────────────┬────────────────────────────────┤
│                    │ Plywood offcuts, clean and dry │  ┌──────────────────────────┐  │
│    [ photo 4:3 ]   │ Furniture Workshop A ·         │  │ 80 kg available          │  │
│                    │ Andheri East, Mumbai · 6.9 km  │  │ of 80 kg listed          │  │
│  [thumb][thumb]    │                                │  │                          │  │
│                    │ [Clean, usable] [Buyer collects]│  │ Reserve quantity         │  │
│                    │ [Available until 20 Sep]        │  │  [ − ]  50  [ + ]  kg    │  │
│                    │                                │  │  Max 80 kg               │  │
│                    │ MATERIAL DETAILS               │  │                          │  │
│                    │  Category      Wood & plywood  │  │ Against requirement:     │  │
│                    │  Quantity      80 kg           │  │  [ Wood offcuts 50 kg ▾ ]│  │
│                    │  Piece size    15 – 40 cm      │  │  (optional)              │  │
│                    │  Treated       No              │  │                          │  │
│                    │  Wood type     Plywood         │  │ [   Reserve 50 kg   ]    │  │
│                    │  Condition     Clean, usable   │  │  amber, full width       │  │
│                    │  Window        17 – 20 Sep     │  │                          │  │
│                    │  Handoff       Buyer collects  │  │ Held 48 h for you to     │  │
│                    │                                │  │ collect. No payment is   │  │
│                    │ DESCRIPTION                    │  │ processed here.          │  │
│                    │  Weekly production offcuts…    │  └──────────────────────────┘  │
│                    │                                │  ┌──────────────────────────┐  │
│                    │ ALLOCATION                     │  │ SUPPLIER                 │  │
│                    │  ▓▓▓▓▓▓▓▓░░░░  80 available /  │  │ Furniture Workshop A     │  │
│                    │                0 reserved /    │  │ Furniture manufacturing  │  │
│                    │                0 handed off    │  │ Andheri East, Mumbai     │  │
│                    │                                │  │ 3 active listings        │  │
├────────────────────┴────────────────────────────────┴────────────────────────────────┤
│ SIMILAR SURPLUS IN THIS CATEGORY   [card] [card] [card] [card]                        │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Quantity stepper** - the partial-reservation control. Default `min(available, 50)` or the
  linked requirement's remaining quantity; step 1 (0.5 for kg); clamped to
  `availableQuantity`; typing is allowed and validated on blur. Exceeding the max disables
  the button and shows `Only 80 kg available` beneath it - never a silent clamp.
- **Requirement selector**: the acting business's `OPEN`/`PARTIALLY_FULFILLED` requirements
  in the same category. Choosing one links the reservation and enables the
  `EXCEEDS_REQUIREMENT` guard.
- `Reserve` navigates to `/reserve?listingId=&requirementId=&qty=`. It does **not** reserve
  directly - one confirmation step prevents a mis-click from allocating material.
- **Own listing**: the action box is replaced by `This is your listing` plus
  `View matching requirements` -> `/listings/:id/matches` and `Withdraw listing`.
- **Not reservable** (`EXPIRED` / `WITHDRAWN` / `FULLY_RESERVED`): the box is replaced by a
  status explainer and `Browse similar surplus`. The page still renders fully - a shared
  link must never 404 into a blank screen.
- `404` -> `This listing no longer exists` with a browse CTA.

---

## 7. S4 - List Surplus  `/listings/new`

Single column, 720px, three fieldsets. Supplier-side, so speed matters more than polish:
a workshop owner should finish in under a minute.

```
List your surplus material
────────────────────────────────────────────────
1  WHAT MATERIAL
   Category *        [ 🪵 Wood ][ 🧵 Fabric ][ 📦 Packaging ][ ▨ Acrylic ]   ← tile picker
   Title *           [ Plywood offcuts, clean and dry            ]  3–80 chars
   Description       [                                           ]  ≤ 500
   Photo             [ Drag a photo or browse ]   optional (P1)

2  HOW MUCH, WHAT STATE                          ← fields appear per category
   Quantity *        [ 80 ] [ kg ▾ ]
   Condition *       ( ) Unused  (•) Clean, usable  ( ) Mixed  ( ) Needs sorting
   Smallest piece *  [ 15 ] cm        Largest piece * [ 40 ] cm
   Treated *         ( ) Yes  (•) No
   Wood type         [ Plywood ]
   Reference price   [ 28 ] ₹ per kg   optional — used only for an estimated-savings figure

3  WHEN AND HOW
   Available from *  [ 2026-09-17 ]   Available until * [ 2026-09-20 ]
   Handoff *         (•) Buyer collects  ( ) I deliver  ( ) Either
   Pickup location     Andheri East, Mumbai  (from your business profile)

                                            [ Cancel ]  [ List surplus material ]
```

- Section 2's attribute fields are rendered from `meta.categories[].attributeFields` - **no
  hardcoded field lists in components**. A taxonomy change is then a server change only.
- Validation mirrors [04](04-API-CONTRACT.md) `POST /v1/listings` exactly, inline on blur,
  and the server's `field` on `400` focuses that input. Client validation is a convenience;
  the server remains the authority.
- On success: toast `Listing created`, redirect to the new listing detail with a one-time
  banner `Your surplus is live. 2 businesses nearby need this material →` linking to
  `/listings/:id/matches` when `meta.count > 0`.
- Submit disables with a spinner-in-button; double submission is impossible.

---

## 8. S5 - Post a Requirement  `/requirements/new`

Same column layout, deliberately mirroring S4 so the two sides feel like one product.

```
Tell us what material you need
────────────────────────────────────────────────
1  WHAT YOU NEED
   Category *         [ tile picker ]
   Quantity needed *  [ 50 ] [ kg ▾ ]
   Needed by *        [ 2026-09-19 ]

2  WHAT WILL WORK FOR YOU
   Acceptable condition *   ☑ Unused  ☑ Clean, usable  ☐ Mixed  ☐ Needs sorting
   Minimum usable piece     [ 10 ] cm        "Pieces smaller than this are no use to us"
   Accept treated material  ( ) Yes  (•) No
   Required wood type       [            ]   optional
   Notes                    [ For non-structural decor pieces… ]  ≤ 500

3  HOW FAR YOU WILL TRAVEL
   Search radius *    ◉ 15 km   ○ 25 km   ○ 50 km
   From                 Bandra West, Mumbai  (your business profile)

                                    [ Cancel ]  [ Find matching surplus → ]
```

- Constraint fields come from `meta.categories[].constraintFields`. Every one is optional and
  each carries the helper text *"Leave blank if you don't mind"* - the absent-constraint
  semantics of [03](03-MATCHING-SPEC.md) § 4 made visible.
- Submit calls `POST /v1/requirements?withMatches=true` and routes straight to
  `/requirements/:id/matches` with the match set **already in the cache**. No second spinner
  between submit and results. **This single behaviour is the demo's WOW moment; build it
  exactly this way.**
- If `matches` is empty: land on the matches screen's empty state, never on a blank page.

---

## 9. S6 - Match results  `/requirements/:id/matches`  ← the WOW screen

The most important screen in the product. It must be legible in a three-minute video at
1080p, which means large type, generous spacing, and no dense tables.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ← My requirements                                                                    │
│ Wood & plywood offcuts · 50 kg needed by 19 Sep · within 15 km · Open                │
│ Reserved 0 kg · Fulfilled 0 kg · Remaining 50 kg                                     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  ✓ 1 compatible match found                                                          │
│ ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│ │  [photo]   Plywood offcuts, clean and dry            ┌──────────────────────┐    │ │
│ │  4:3       Furniture Workshop A · Andheri East · 6.9 km │ RESERVE           │    │ │
│ │            80 kg available · Clean, usable · until 20 Sep│  [−] 50 [+] kg    │    │ │
│ │                                                       │ [ Reserve 50 kg ]   │    │ │
│ │  WHY THIS MATCHES                                     └──────────────────────┘    │ │
│ │   ✓ Material category matches: Wood & plywood offcuts (kg)                        │ │
│ │   ✓ 80 kg available, 50 kg needed — 50 kg can be reserved                          │ │
│ │   ✓ Smallest piece 15 cm meets your 10 cm minimum; untreated as required           │ │
│ │   ✓ Condition "Clean, usable" is one you accept                                   │ │
│ │   ✓ Available until 20 Sep, before your 19 Sep deadline                            │ │
│ │   ✓ 6.9 km away, inside your 15 km radius                                          │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  2 nearby listings did not match                          [ Show reasons ▾ ]         │
│ ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│ │  Wood offcuts, mixed lot — Furniture Workshop A · 6.9 km        NOT COMPATIBLE   │ │
│ │   ✓ Material category matches      ✓ 25 kg available                             │ │
│ │   ✗ Smallest piece 5 cm is below your 10 cm minimum                              │ │
│ │   ✗ Condition "Mixed" is not in your accepted list                               │ │
│ │   ✓ Available until 20 Sep …      ✓ 6.9 km away …                                │ │
│ │                        [ Relax condition to include "Mixed" ]                    │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

**Non-negotiables on this screen**

1. All six checks render, always, in `checks[]` order - pass and fail alike. A compatible
   match showing six ticks is the proof the matching engine is real.
2. Pass is a check glyph **plus** green text; fail is a cross glyph **plus** red text. Never
   colour alone - both a colour-blind judge and a greyscale screenshot must read correctly.
3. `detail` strings are rendered verbatim from the API. **Never reworded client-side.**
4. `score` is never displayed. No percentage, no "94% match", no stars.
5. Near-misses are collapsed by default under a count, expandable, visually de-emphasised
   (grey border, no photo emphasis) - present but never competing with the real match.
6. Each near-miss should point at the most useful next action. **Corrected 18 September:**
   this originally said the button "edits the requirement and refetches", which the API
   cannot do - `/v1/requirements` supports POST and GET only, and no update endpoint was
   ever specified or cut. The implementable form is a link to S5 prefilled with the relaxed
   constraint, which needs no new endpoint. The empty state's "Post a different
   requirement" action already covers the common case; prefilling is optional polish.

**States**: skeleton of one large card plus two small ones; empty
`No compatible surplus right now` with `Widen radius`, `Relax condition`, `Browse all wood
offcuts`; requirement fully covered ->
`Your requirement is fully covered by existing reservations` with a link to the reservation
(the post-reservation state from [03](03-MATCHING-SPEC.md) § 8); `403` -> `This requirement
belongs to another business` plus a switcher hint.

---

## 10. S7 - Reservation review  `/reserve`

The checkout-review analogue: one screen, one decision, no surprises.

```
Review your reservation
┌────────────────────────────────────────────────┬───────────────────────────────┐
│ MATERIAL                                       │ SUMMARY                       │
│  Plywood offcuts, clean and dry                │  Reserving      50 kg         │
│  Furniture Workshop A · Andheri East · 6.9 km  │  Of available   80 kg         │
│  Clean, usable · 15–40 cm · untreated          │  Supplier keeps 30 kg         │
│                                                │  Handoff        Buyer collects│
│ QUANTITY                                       │  Hold expires   19 Sep, 14:30 │
│  [ − ]   50   [ + ]  kg        Max 80 kg       │  Payment        None          │
│                                                │                               │
│ AGAINST REQUIREMENT                            │  [ Confirm reservation ]      │
│  Wood offcuts · 50 kg by 19 Sep                │   amber, full width           │
│  Remaining after this: 0 kg                    │  [ Back to listing ]          │
│                                                │                               │
│ WHY THIS MATCHES                               │  No money changes hands in    │
│  ✓ … all six checks, read-only …               │  DeadStock Exchange. You are  │
│                                                │  holding material for pickup. │
└────────────────────────────────────────────────┴───────────────────────────────┘
```

- The six checks repeat read-only: the buyer confirms **with the reasons in front of them**,
  and those exact strings are snapshotted into `matchReasons`.
- `Confirm` -> `POST /v1/reservations`. On `201`, go to `/reservations/:id` with toast
  `50 kg reserved. Furniture Workshop A will confirm handoff.`
- Error handling, per code - this is where the concurrency story is told:

| Code | UI |
|---|---|
| `INSUFFICIENT_QUANTITY` | Inline red banner `Only 30 kg is still available - someone reserved part of this listing.` Stepper max updates from `details.availableQuantity`. Button re-enables |
| `LISTING_NOT_AVAILABLE` | `This listing is no longer available` + browse CTA |
| `NOT_COMPATIBLE` | Re-render checks with the now-failing ones marked; explain that the listing changed |
| `EXCEEDS_REQUIREMENT` | Inline under the stepper: `Your requirement only needs 30 more kg` |
| `SELF_RESERVATION` | `You cannot reserve your own listing` + switcher hint |

- "Payment: None" and the closing note are required copy. They are how the screen stays an
  exchange rather than pretending to be a shop.

---

## 11. S8 - My Dashboard  `/dashboard`

Four tabs, deep-linked via `?tab=`. The seller-central analogue, for both roles.

```
My Dashboard — Furniture Workshop A
[ My Listings (3) ] [ My Requirements (1) ] [ Incoming ● 2 ] [ My Reservations (1) ]

── My Listings ─────────────────────────────────────────────────────────────────────
 Material                 Available  Reserved  Handed off  Until    Status      Actions
 Plywood offcuts, clean      30 kg     50 kg      0 kg     20 Sep   Partly res. View · Matches · Withdraw
   ▓▓▓▓░░░░░░  bar: available / reserved / handed off
 Wood offcuts, mixed lot     25 kg      0 kg      0 kg     20 Sep   Available   View · Matches · Withdraw

── Incoming reservations (supplier) ────────────────────────────────────────────────
 ┌────────────────────────────────────────────────────────────────────────────────┐
 │ 50 kg  Plywood offcuts → Decor & Packaging Business B · Bandra West · 6.9 km   │
 │ Reserved 17 Sep 14:30 · Hold expires 19 Sep 14:30 · Buyer collects            │
 │                                   [ Confirm handoff ]  [ View ]  [ Cancel ]   │
 └────────────────────────────────────────────────────────────────────────────────┘
```

- `My Listings`: the allocation bar is the key visual - three segments with a 2px surface
  gap between fills, plus a text readout. Never a bare percentage.
- `My Requirements`: quantity requested / reserved / fulfilled, status, `View matches` with
  the live compatible count.
- `Incoming`: supplier-side `RESERVED` rows. `Confirm handoff` is the amber primary and
  opens a confirmation dialog (`Confirm that 50 kg was physically handed over to Decor &
  Packaging Business B. This records the reuse and cannot be undone.` -> `Confirm handoff` /
  `Not yet`). Optimistic UI is **forbidden here** - wait for the `200` and its four updated
  resources, then update in place.
- `My Reservations`: buyer-side rows with hold countdown and `Cancel`.
- Every tab has its own empty state with the relevant CTA. Tab counts come from the same
  queries that populate the tables - no extra endpoint.

---

## 12. S9 - Reservation detail  `/reservations/:id`

```
Reservation rsv_001                                               [ RESERVED ]
┌────────────────────────────────────────────┬─────────────────────────────────┐
│ 50 kg · Wood & plywood offcuts             │ TIMELINE                        │
│ Plywood offcuts, clean and dry             │  ● Reserved   17 Sep 14:30      │
│ From Furniture Workshop A · Andheri East   │  ○ Handoff    awaiting supplier │
│ To   Decor & Packaging Business B · Bandra │  ○ Impact     on handoff        │
│ Buyer collects · Hold expires in 1 day 4 h │                                 │
│                                            │ [ Confirm handoff ]  (supplier) │
│ WHY THIS MATCHED  (recorded at reservation)│ [ Cancel reservation ]          │
│  ✓ … six snapshotted checks …              │                                 │
└────────────────────────────────────────────┴─────────────────────────────────┘
```

After handoff: status chip `HANDED_OFF`, timeline complete, action buttons replaced by a
green confirmation panel - `50 kg recorded as reused on 18 Sep` with a link to `/impact`.
`matchReasons` renders from the reservation's snapshot, never refetched from the matching
engine - that distinction is in the spec because it will be tempting to reuse the component.

---

## 13. S10 - Impact  `/impact`

Charts and tiles follow the visualisation rules in
[07-DESIGN-SYSTEM.md](07-DESIGN-SYSTEM.md) § Data visualisation. **Read that section before
writing any chart code.**

```
Impact                                  [ Platform | My business ]   [ All time ▾ ]

        ┌───────────────────────────────────────────────┐
        │                50 kg                          │   hero figure, ≥48px
        │        material reused through the exchange    │
        └───────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 1            │ │ 25%          │ │ 30 kg        │ │ ₹1,400       │
│ completed    │ │ of require-  │ │ surplus      │ │ procurement  │
│ exchanges    │ │ ments filled │ │ still live   │ │ avoided (est)│
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

┌────────────────────────────────────┐ ┌────────────────────────────────────┐
│ Material reused by category        │ │ Cumulative material reused         │
│  horizontal bars, kg, direct-      │ │  line, 4 daily points,             │
│  labelled at the data end          │ │  crosshair + tooltip               │
└────────────────────────────────────┘ └────────────────────────────────────┘

Completed exchanges
 Date     Material              Quantity  From → To                    Requirement
 18 Sep   Wood & plywood        50 kg     Workshop A → Business B      Wood offcuts 50 kg
 Every figure above derives from 1 completed handoff record.   [ Show data table ]
```

Hard rules:

1. **Exactly one hero figure** on the page.
2. **Never sum across units.** Separate tiles or a unit selector - kg, units and sheets are
   not addable. A single "total material reused" number across units is a lie.
3. `estimatedProcurementAvoidedInr` is labelled `(est)` with a tooltip:
   `Based on reference prices stated by suppliers. Estimate only.` Hidden entirely when the
   API omits it.
4. **No CO2e, no "trees saved", no environmental extrapolation.** Not even greyed out.
5. The `Show data table` toggle and the source-record line are required: they are how a
   judge verifies the dashboard is not decorative.
6. Numbers must move during the demo. Confirming a handoff at 2:15 changes this page at 2:30.

---

## 14. Cross-cutting requirements

### Responsive

| Breakpoint | Behaviour |
|---|---|
| >= 1280px | Demo target. 3-up grid, filter rail visible, PDP action box sticky |
| 1024-1279px | 3-up grid, narrower rail |
| 768-1023px | 2-up grid; filters collapse into a `Filters (3)` drawer button |
| < 768px | 1-up; PDP action box becomes a bottom sticky bar with quantity + Reserve; dashboard tables become stacked cards |

Browse, listing detail and reserve must work at 390px. Impact charts may degrade to the
data table below 768px.

### Accessibility

- Whole primary flow keyboard-operable: browse -> listing -> stepper -> reserve -> confirm.
- Visible focus ring (2px, `--focus`), never `outline: none`.
- Every input has a `<label>`; errors linked with `aria-describedby`; the submit error
  summary is `role="alert"`.
- Match checks: icon + text, never colour alone. Status chips include text.
- Body text >= 4.5:1; chips and large text >= 3:1.
- Charts: series direct-labelled, plus the data-table toggle.
- One `<h1>` per page; landmarks `header`/`nav`/`main`/`footer`.

### Performance

Route-level code splitting; images `loading="lazy"` with fixed aspect boxes (no layout
shift); server data cached by TanStack Query with 30 s stale time; mutations invalidate only
the affected keys. Skeletons match final geometry so nothing jumps.

### Copy rules

- Sentence case everywhere. No ALL-CAPS buttons.
- Say "reserve", "hold", "handoff", "surplus", "requirement". Never "buy", "order", "cart",
  "checkout", "deal", "price drop".
- Numbers always carry their unit.
- Error copy states what happened and what to do next.
- No exclamation marks in system copy. One in the empty states is enough for the whole app.
