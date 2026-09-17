# 01 - Product Requirements Document

**Product:** DeadStock Exchange
**Version:** 1.0 (Day 1 scope freeze, 17 September 2026)
**Owner:** M4 (with sign-off from all four members)

---

## 1. One-sentence pitch

DeadStock Exchange turns one business's usable surplus into another business's raw material
by matching structured industrial supply and demand before that material loses value or is
discarded.

## 2. Problem

Small and medium manufacturers, workshops and businesses accumulate usable surplus
material - fabric offcuts, wood pieces, acrylic sheets, packaging, cardboard, spare
components, excess production stock - that has no further use inside their own operation.
At the same time, other businesses in the same city buy the same or compatible material new
from suppliers.

The material has economic value. The failure is one of **coordination**: the business that
has it and the business that can use it do not discover each other at the right time, with
enough structured information to transact. So the material is stored until it is in the way,
sold to a scrap dealer at low recovery value, or discarded - while a compatible buyer two
kilometres away raises a purchase order for new stock.

### What users do today

| Current behaviour | Why it fails |
|---|---|
| Store surplus until someone finds a use | Occupies space, degrades, eventually discarded |
| Sell mixed material to a scrap dealer | Recovers a fraction of usable-material value |
| Post in WhatsApp groups, call known contacts | Unstructured, no quantities or dimensions, no record |
| Buy new raw material | Finding compatible local surplus is unreliable, so nobody tries |

The weakness is precise: **supply and demand are fragmented, descriptions are inconsistent,
availability goes stale, and there is no workflow for matching, reserving, collecting and
recording reuse.**

## 3. Users

| User | Role in product | What they want |
|---|---|---|
| **Supplier business** - furniture workshop, garment unit, print shop, packaging unit | Lists surplus | Clear the material, recover value, no wasted trips or haggling |
| **Receiving business** - decor maker, small-batch manufacturer, packaging reseller | Posts requirements, browses, reserves | Compatible material at lower cost, with known dimensions and condition before committing |
| **Operations/admin at either** | Reads dashboard | Knows what is reserved, what is still available, what was actually handed off |

Both sides are the **same account type** with the same business profile. A business can
list and buy. There is no separate seller onboarding in the MVP.

### Primary persona (demo persona)

- **Ravi, Furniture Workshop A, Andheri, Mumbai.** Produces ~80 kg/week of clean, dry,
  untreated plywood offcuts, 15-40 cm. No internal use. Currently stacked behind the unit.
- **Meera, Decor & Packaging Business B, Bandra, Mumbai.** Needs ~50 kg of small wood pieces
  (>= 10 cm) per batch for non-structural products. Currently buys new sheet and cuts it down.

## 4. What the product is - and is not

**It is** a focused B2B workflow for usable surplus material, presented through a familiar
marketplace interface.

**It is not** a general e-commerce marketplace, a consumer resale app, a scrap-dealer
aggregator, or a logistics company.

### The distinction that must survive the build

| Generic marketplace | DeadStock Exchange |
|---|---|
| Seller posts an item and waits | System also captures **buyer requirements** and actively matches supply to demand |
| Product and price discovery | **Material compatibility** - category, quantity, condition, dimensions, availability window |
| Listing sold as a whole | **Partial quantity reservation** is a core workflow, not an edge case |
| Opaque relevance score | **Transparent match explanation** - every check shown as pass or fail |
| Success = a sale | Success = material transferred into another productive use |
| Little impact measurement | Reuse quantity and fulfilled demand recorded automatically |

**Design tension, resolved deliberately.** The interface adopts mainstream marketplace
conventions - search bar, category tiles, filter rail, product grid, product detail page,
quantity stepper, checkout-style confirmation - because buyers already know how to operate
them and because Best UI is judged on design and usability. The *workflow underneath* stays
the requirement-matching exchange described above. Marketplace shell, exchange engine.
See [06-UI-SPEC.md](06-UI-SPEC.md) § Design tension for how each borrowed pattern maps onto
an exchange concept.

## 5. Core workflow (the only one that must work)

```
1. Supplier lists surplus       structured fields: material, quantity, condition,
                                dimensions, location, available-until
2. Buyer states demand          posts a Requirement, or browses/filters listings
3. System matches               deterministic hard-constraint checks, no ML
4. System explains              every check rendered as a pass/fail reason chip
5. Buyer reserves               partial or full quantity; double allocation impossible
6. Supplier confirms handoff    material physically transferred
7. System records impact        inventory decrements, ImpactRecord written, dashboard updates
```

Nothing may be built until this path works end to end. Step ordering is also the build
order - see [09-INTEGRATION-PLAN.md](09-INTEGRATION-PLAN.md).

## 6. MVP feature list (P0 - all four days protect these)

| ID | Feature | Owner | Acceptance |
|---|---|---|---|
| F1 | **Structured surplus listing** - category, quantity + unit, condition, category-specific attributes, location, availability window, optional photo | M1 + M2 | A listing created in the UI appears in browse within one refresh, with all fields persisted |
| F2 | **Material requirement posting** - category, quantity needed, accepted conditions, min/max attributes, radius, required-by date | M1 + M2 | A requirement created in the UI returns a match set on submit |
| F3 | **Rule-based matching** - deterministic compatibility, six hard constraints, ranked | M2 | Given fixture data, the engine returns the documented matches in the documented order |
| F4 | **Match explanation** - per-check pass/fail with human-readable reason | M1 + M2 | Every match card shows all six checks; a near-miss shows which check failed |
| F5 | **Partial reservation** - reserve some or all; available quantity can never go below zero | M2 + M3 | Two concurrent reservations of 50 kg against an 80 kg listing: one succeeds, one fails with `INSUFFICIENT_QUANTITY` |
| F6 | **Handoff confirmation** - supplier confirms transfer, reservation closes | M1 + M2 | Confirming handoff writes an ImpactRecord and moves reserved quantity out of inventory |
| F7 | **Impact dashboard** - quantity reused, listings fulfilled, requirements fulfilled, active surplus | M1 + M2 | Numbers derive only from completed handoffs, and change live during the demo |

## 7. P1 - build only if P0 is stable and tested

- Listing photo upload to S3 (P0 ships with a category placeholder image)
- EventBridge-driven listing expiry and reservation timeout
- Reservation expiry countdown in the UI
- "Notify me" on a requirement
- Amplify Hosting custom domain

## 8. Explicitly out of scope

Out of scope means **out of the repository**, not "maybe on Day 4":

- Payments, payment gateway, escrow, pricing negotiation
- Delivery, logistics, fleet or courier integration
- Chat or messaging between businesses
- Nationwide coverage (MVP is one city, radius-based)
- ML/AI matching, learned ranking, dynamic pricing
- Computer-vision material identification
- Hazardous, chemical, regulated, food-grade or safety-critical material categories
- Carbon or CO2e savings claims
- Verified-business KYC, ratings, reviews, disputes
- Mobile apps (responsive web only)

### Authentication is deliberately out of P0

The MVP uses a **business switcher** in the top bar (pick "acting as Furniture Workshop A")
backed by an `X-Business-Id` header. Reasons: it removes a four-way blocking dependency on
Day 1, it makes the two-sided demo switchable in one click, and Cognito adds no judging
value the matching engine does not already carry. Cognito is specified as a P1 stretch in
[05-ARCHITECTURE.md](05-ARCHITECTURE.md) § Authentication so the swap is a known, contained
change. **This is a stated assumption, and it is disclosed in the write-up and demo.**

## 9. Material taxonomy for the MVP

Four safe, non-hazardous categories only. The full attribute schema is in
[02-DOMAIN-MODEL.md](02-DOMAIN-MODEL.md) § Material taxonomy.

| Category | Code | Unit | Example |
|---|---|---|---|
| Wood & plywood offcuts | `WOOD_OFFCUTS` | kg | Clean, dry, untreated plywood pieces 15-40 cm |
| Fabric offcuts & rolls | `FABRIC_OFFCUTS` | kg | Cotton twill remnants, 1-2 m lengths |
| Packaging & cardboard | `PACKAGING_CARDBOARD` | kg / units | Unused 5-ply cartons, printed on one side |
| Acrylic & plastic sheet | `ACRYLIC_SHEET` | kg / sheets | 3 mm cast acrylic, 30x40 cm, cut-offs |

Anything outside these four codes is rejected by validation. Expanding the taxonomy is a
future-work bullet, not a Day-3 idea.

## 10. Success metrics

Measured from transactions completed **inside the product** - never from broad
environmental estimates.

| Metric | Definition |
|---|---|
| Quantity reused | Sum of `quantityReused` over ImpactRecords (kg / units, per category) |
| Completed exchanges | Count of reservations reaching `HANDED_OFF` |
| Requirement fulfilment rate | Requirements fully or partially fulfilled / total requirements |
| Active surplus remaining | Sum of `availableQuantity` over active listings |
| Time to reservation | Median listing-created to first-reservation |
| Procurement avoided | **Only** where the buyer supplied a reference purchase price; always labelled an estimate |

Demo headline: *"50 kg reused through 1 completed match - 62.5% of this supplier's original
surplus redirected."*

## 11. Non-functional requirements

| Area | Requirement |
|---|---|
| Correctness | `availableQuantity` never negative, under concurrency. Conditional write, not read-then-write |
| Latency | Match response < 1.5 s on fixture-scale data (< 500 listings) |
| Reliability | Every screen handles loading, empty, error and partial-result states - specified per screen in 06 |
| Accessibility | Keyboard-operable primary flow, visible focus ring, form labels, 4.5:1 text contrast |
| Responsiveness | Works at 1440px (demo), 1024px, 768px. Below 768px, browse and reserve must still work |
| Security | No secrets in repo; least-privilege IAM per Lambda; input validated server-side, not only in the form |
| Data | Synthetic businesses and listings only. No real business contact details, no personal data |

## 12. Risks and controls

| Risk | Control | Owner |
|---|---|---|
| Drifts into a generic OLX clone | Requirements, match explanation, partial allocation and impact stay on the critical path and in the demo | M4 |
| Unsafe material matching | Four fixed non-hazardous categories, enforced by validation | M2 |
| Feature creep | § 8 is a hard boundary; P1 needs an explicit checkpoint decision | M4 |
| Unsupportable impact claims | Report direct quantities; label any monetary figure an estimate | M1 |
| Double allocation | DynamoDB conditional update with `availableQuantity >= :qty` | M2 + M3 |
| No real market data | Purpose-built synthetic fixtures; no dependency on external APIs | M4 |
| Integration fails on Day 4 | Frozen contract + fixtures + `Repo` interface + daily checkpoints | all |
| One member blocked/absent | Every task is mock-backed and independently runnable; ownership documented | all |

## 13. Competition alignment

| Judging area | How this project answers it |
|---|---|
| Idea & impact | Named users, a narrow real problem, measured from in-product transactions |
| Built on AWS | API Gateway, Lambda, DynamoDB, S3, EventBridge each with one necessary job ([05](05-ARCHITECTURE.md) § Why each service exists); shown live in the demo |
| Learning | Per-member learning goals in [08](08-TEAM-ROLES.md); ongoing `docs/LEARNING-LOG.md` |
| Execution | One workflow, complete and reliable, over seven half-features |
| Demo video | Scripted in [10](10-DEMO-AND-SUBMISSION.md) with a scripted WOW moment at 1:35 |
