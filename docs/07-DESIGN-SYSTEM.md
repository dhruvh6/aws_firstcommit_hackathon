# 07 - Design System  [FROZEN]

**Owner:** M1. Every contrast ratio in this document was measured, not estimated.
The categorical chart palette was validated with a CVD/contrast validator, not chosen by eye.

The look is **mainstream Indian marketplace** - Flipkart/Amazon density and familiarity -
applied to industrial material. Blue structure, amber action, white cards on a grey page,
tight radii, high information density, no gradients except the home hero.

---

## 1. Colour tokens

`web/src/styles/tokens.css`. Components reference tokens by **role**, never raw hex.

```css
:root {
  color-scheme: light;

  /* brand - structure, navigation, links */
  --brand-900: #0a2a66;
  --brand-700: #0f3d91;   /* top bar, footer accents        white text 10.02:1 */
  --brand-600: #1558c7;   /* primary buttons, links         white text  6.46:1 */
  --brand-500: #2874f0;   /* hover, highlights, focus ring  large text only 4.33:1 */
  --brand-100: #dbeafe;
  --brand-050: #eff6ff;   /* selected filter rows, info panels */

  /* accent - the single call to action */
  --accent-500: #f59e0b;  /* Reserve / Confirm              ink text 8.26:1 */
  --accent-600: #d97706;  /* hover */
  --accent-050: #fffbeb;  /* expiring-soon banner */

  /* ink */
  --ink-900: #111827;     /* body text            on white 17.74:1 */
  --ink-700: #374151;     /* secondary */
  --ink-600: #4b5563;     /* muted, still 7.56:1 - use this, not 500, for real text */
  --ink-500: #6b7280;     /* placeholders, disabled labels only (4.83:1) */
  --ink-300: #d1d5db;     /* borders on white */
  --ink-200: #e5e7eb;     /* dividers */
  --ink-100: #f3f4f6;     /* page background */
  --ink-050: #f9fafb;     /* card hover, table stripe */
  --white:   #ffffff;
  --footer:  #131a22;     /* white text 17.52:1 */

  /* status - fixed roles, never reused as a series colour */
  --ok-700:     #15803d;  /* on white 5.02:1  - match passed, handed off */
  --ok-050:     #f0fdf4;
  --warn-700:   #b45309;  /* on white 5.02:1  - expiring, partly reserved */
  --warn-050:   #fffbeb;
  --danger-700: #b91c1c;  /* on white 6.47:1  - check failed, error */
  --danger-050: #fef2f2;
  --info-700:   #1558c7;
  --neutral-700:#4b5563;  /* expired, withdrawn, cancelled */

  /* elevation */
  --shadow-card:  0 1px 2px rgba(17,24,39,.06), 0 1px 3px rgba(17,24,39,.08);
  --shadow-hover: 0 4px 12px rgba(17,24,39,.10);
  --shadow-rail:  0 2px 8px rgba(17,24,39,.08);

  --focus: var(--brand-500);
  --radius-sm: 4px; --radius-md: 6px; --radius-lg: 8px; --radius-pill: 999px;
}
```

Rules that keep this from unravelling:

1. **Amber is only ever the primary action.** `Reserve`, `Confirm reservation`,
   `Confirm handoff`, `List surplus material`, `Find matching surplus`. Nothing else is
   amber - not chips, not links, not headings. One amber thing per screen, ideally.
2. **`--ink-500` is not a text colour** for content. It is placeholders and disabled labels.
   Real secondary text is `--ink-600`.
3. **Status colours never carry meaning alone.** Always icon + text (§ 5 chips).
4. **Light mode only.** `color-scheme: light` is declared and there is no dark theme in
   scope. Do not add `prefers-color-scheme` rules that flip half the palette - a partially
   dark UI on a judge's dark-mode machine is worse than a consistently light one. Dark-mode
   chart steps are listed in § 8 for the record, unused in P0.

## 2. Type

System font stack - fast, native, and correct for Indic glyphs without a webfont download:

```css
--font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, "Noto Sans", sans-serif;
```

| Role | Size / line-height | Weight | Notes |
|---|---|---|---|
| Hero (home, impact figure) | 44 / 52 | 700 | Impact hero >= 48px, proportional figures |
| Page title `h1` | 28 / 36 | 700 | One per page |
| Section `h2` | 20 / 28 | 600 | |
| Card title `h3` | 16 / 22 | 600 | Clamp 2 lines |
| Body | 15 / 22 | 400 | |
| Body strong / quantity | 15 / 22 | 600 | |
| Small / meta | 13 / 18 | 400 | `--ink-600` |
| Micro / legal | 12 / 16 | 400 | `--ink-600`, never `--ink-500` |
| Button | 15 / 20 | 600 | Sentence case |
| Table header | 13 / 18 | 600 | Uppercase allowed here only, `letter-spacing: .02em` |

`font-variant-numeric: tabular-nums` on **columns of numbers only** - dashboard tables, axis
ticks. Never on a hero figure or a stat-tile value; tabular digits make large numbers look
loose.

## 3. Space, grid, layout

4px base: `4 8 12 16 20 24 32 40 48 64`.

| Container | Width |
|---|---|
| Page max | 1280px, 24px gutters |
| Filter rail | 280px fixed |
| Result grid | 3 cards >= 1280px, 2 at 768-1023px, 1 below; 16px gap |
| Form column | 720px |
| PDP action box | 320px, sticky at 24px from top |

Card padding 16px; section vertical rhythm 32px; inside a card 12px between blocks.

## 4. Components - build these first

Day 1 for M1 is this list, in this order, in `web/src/components/`. Every screen in
[06](06-UI-SPEC.md) is assembled from them.

| Component | Props / variants | States |
|---|---|---|
| `Button` | `primary` (amber), `secondary` (brand-600 outline), `ghost`, `danger`; `sm`/`md`/`lg`; `fullWidth` | default, hover, active, focus-visible, disabled, loading (spinner replaces label, width held) |
| `Chip` | `neutral`, `ok`, `warn`, `danger`, `info`; optional leading icon; `removable` | default, hover (removable only) |
| `StatusChip` | takes any status enum, maps to colour + label via `labels.ts` | unknown value -> neutral chip with the raw string |
| `Input` / `Select` / `DatePicker` / `Textarea` | label, helper, error, required, prefix/suffix unit | default, focus, error, disabled, readonly |
| `QuantityStepper` | `value`, `min`, `max`, `step`, `unit`, `onChange` | default, at-max (+ disabled, helper shows max), invalid, disabled |
| `TilePicker` | 4 category tiles, icon + label | unselected, selected (brand-600 border + brand-050 fill), focus |
| `ListingCard` | `listing`, `distanceKm?`, `onReserve` | default, hover (lift), partially-reserved (allocation bar), expiring (amber clock), unavailable (60% opacity, no CTA) |
| `MatchCard` | `match`, `onReserve` | compatible (white, brand border, full-size), near-miss (grey border, de-emphasised, collapsed) |
| `CheckList` | `checks: MatchCheck[]` | pass row (check glyph + `--ok-700`), fail row (cross glyph + `--danger-700`) |
| `AllocationBar` | available / reserved / handed-off | three segments, 2px white gap between fills, text readout beneath |
| `StatTile` | label, value, unit, optional delta, optional sparkline | default, loading skeleton, no-data (`—`, not `0`) |
| `EmptyState` | icon, title, body, up to 2 CTAs | - |
| `ErrorState` | `message`, `code`, `onRetry` | - |
| `Skeleton` | `card`, `row`, `text`, `tile` | shimmer, `prefers-reduced-motion` -> static |
| `Toast` | success / error / info, 4 s | stacked, bottom-right, dismissible |
| `Dialog` | title, body, confirm / cancel | focus-trapped, `Esc` closes, focus returns to trigger |
| `Breadcrumb` | items | last item not a link |
| `Tabs` | deep-linked to `?tab=`, count badges | selected, hover, focus |

### Button anatomy

```
Primary   bg --accent-500 · text --ink-900 · h 40px (lg 44) · radius 6 · pad 0 20px · weight 600
          hover bg --accent-600 · active translateY(1px) · disabled --ink-200 bg / --ink-500 text
Secondary bg --white · border 1px --brand-600 · text --brand-600 · hover bg --brand-050
Ghost     text --brand-600 · hover underline
Danger    bg --white · border 1px --danger-700 · text --danger-700
Focus     outline 2px --focus · outline-offset 2px   (never removed)
```

### CheckList - the signature component

```
✓  80 kg available, 50 kg needed — 50 kg can be reserved
✗  Smallest piece 5 cm is below your 10 cm minimum
```

Glyph 16px in a 20px box, 8px gap, text 15/22, rows 8px apart. Pass `--ok-700`, fail
`--danger-700`. **Icon and colour together, always** - it must survive a greyscale
screenshot and a colour-blind viewer. Never truncate a `detail` string; wrap it.

### Status chip mapping

| Status | Chip |
|---|---|
| `ACTIVE`, `UNUSED`, `CLEAN_USABLE`, `OPEN`, `HANDED_OFF` | `ok` |
| `PARTIALLY_RESERVED`, `PARTIALLY_FULFILLED`, `RESERVED`, `MIXED` | `warn` |
| `FULLY_RESERVED`, `FULFILLED`, `COMPLETED` | `info` |
| `EXPIRED`, `WITHDRAWN`, `CANCELLED`, `NEEDS_SORTING` | `neutral` |

The table is exhaustive over `ListingStatus`, `RequirementStatus`,
`ReservationStatus` and `Condition`. **Contract change, 18 September:**
`CLEAN_USABLE` was missing from the original table - M1 spotted the gap while
building `labels.ts` and correctly declined to invent a variant. It maps to `ok`,
because it is an acceptable condition alongside `UNUSED`, and a buyer who
accepted it should not see a warning colour on material that satisfies their
requirement.

### Unknown enum fallback

```ts
label(kind, value) ?? <Chip variant="neutral">{value}</Chip>
```

A value the frontend has never heard of renders as a neutral chip with the raw string. It
never throws, never renders blank. This is what stops a Day-3 enum addition from breaking
M1's screens.

## 5. Iconography

Single set - `lucide-react`, 16px in text, 20px in buttons, 24px in tiles, `strokeWidth 2`.
Fixed mappings: check `Check`, fail `X`, distance `MapPin`, availability `Clock`, quantity
`Package`, supplier `Building2`, requirement `ClipboardList`, reservation `BookmarkCheck`,
handoff `Handshake`, impact `Recycle`, wood `TreePine`, fabric `Scissors`, packaging
`Package2`, acrylic `Layers`. Never two icon libraries.

## 6. Motion

| Interaction | Motion |
|---|---|
| Hover on card | `transform: translateY(-2px)` + shadow, 120 ms ease-out |
| Button press | `translateY(1px)`, 80 ms |
| Dialog / drawer | fade + 8px rise, 160 ms |
| Toast | slide 12px + fade, 160 ms |
| Skeleton | 1.2 s shimmer |
| Match cards appearing | 120 ms stagger, max 3 cards - **subtle** |
| Number change (impact) | 400 ms count-up, once |

Everything inside `@media (prefers-reduced-motion: reduce)` collapses to opacity or nothing.
No parallax, no scroll-jacking, no confetti. The match-card stagger is deliberately small:
the demo needs the result to feel instant, not animated.

## 7. Data visualisation

Applies to `/impact` and any chart anywhere. **Read this section before writing chart code.**

### Procedure (in order - colour comes last)

1. **Pick the form from the data's job.** Category comparison -> horizontal bars. Change over
   time -> line. A single headline -> a stat tile or the hero figure, *not* a chart.
   Composition of one total -> the `AllocationBar`, not a pie.
2. **Assign colour by job**, not by taste: categorical = identity, sequential = magnitude
   (one hue, light -> dark), status = state. Never a rainbow, never a hue at a diverging
   midpoint.
3. Apply mark specs (below).
4. Add the hover layer.
5. Accessibility pass: legend for >= 2 series, direct labels for <= 4, data-table toggle.
6. Render it and look at it.

### Categorical palette - validated, use in this fixed order

| Slot | Hue | Hex | Use |
|---|---|---|---|
| 1 | blue | `#2a78d6` | first series - wood |
| 2 | orange | `#eb6834` | second series - fabric |
| 3 | aqua | `#1baf7a` | third series - packaging |
| 4 | yellow | `#eda100` | fourth series - acrylic (adjacent-pair use only) |

Validator result for slots 1-3 on a light surface, all pairs: lightness band PASS, chroma
floor PASS, CVD separation PASS (worst ΔE 9.2, deutan), normal-vision floor PASS (worst
ΔE 24.0), contrast WARN on `#1baf7a` (2.74:1). The WARN is **discharged by the mandatory
direct labels and the data-table toggle** - it is not dismissable, so those are required,
not optional.

Assign slots **in fixed order and never cycle them**. Colour follows the entity, so wood is
always slot 1 even when a filter removes other categories. With all four categories on
screen, yellow sits beside orange - acceptable for adjacent bars, which is why the
by-category chart is bars and not a scatter.

Sequential (a single magnitude ramp, if ever needed): blue `#cde2fb -> #0d366b`.
Dark-mode steps, recorded but unused in P0: `#3987e5 #d95926 #199e70 #c98500` on surface
`#1a1a19`.

### Mark specs

- Bars: thin, 4px rounded **data-end only**, anchored to the baseline, >= 2px gap between
  adjacent bars.
- Lines: 2px; markers >= 8px; 2px surface ring where marks overlap.
- Grid: 1px `--ink-200`, horizontal only. Axis line `--ink-300`. Both recessive.
- Labels: **selective** direct labels at data ends - never a number on every point.
- Text wears text tokens (`--ink-900` / `--ink-600`), **never the series colour**. A small
  colour swatch beside the label carries identity.

### Interaction

Crosshair + tooltip on the line chart; per-mark tooltip on bars. Tooltip shows category,
value with unit, and date where relevant. Hit targets larger than the mark. Filters
(`Platform | My business`, date range) sit in one row above the charts.

### Anti-patterns - these are bugs, not preferences

| Never | Instead |
|---|---|
| Dual y-axes | Two charts, or index to a common base |
| Pie or donut | Horizontal bars, or the `AllocationBar` |
| 3D, shadowed or gradient-filled bars | Flat fills |
| A number on every data point | Selective direct labels |
| Summing kg + units + sheets | One chart per unit, or a unit selector |
| A chart for a single number | Stat tile or hero figure |
| Colour as the only encoding | Icon + label + colour |
| Truncated bar baseline | Bars always start at zero |
| Generated 9th hue | Fold into "Other" or facet |
| CO2e / trees-saved estimates | Only measured quantities ([04](04-API-CONTRACT.md) § `/impact`) |

## 8. Placeholder imagery

Four flat SVG category placeholders at 4:3 in `web/src/assets/placeholders/`: a tinted
background from the category's slot colour at 12% opacity with the category icon centred at
30% opacity. No stock photography, no AI-generated product photos, no unlicensed images -
[the rules](../First_Commit_2026_Complete_Rules_Checklist.md) require every asset to be
licensed and credited, and four SVGs we draw ourselves remove that problem entirely.

## 9. Definition of done - any screen

- [ ] Loading, empty, error and success states all implemented
- [ ] Keyboard-operable; focus ring visible everywhere
- [ ] Responsive at 1440 / 1024 / 768 / 390
- [ ] Tokens only - no hex literals in component files
- [ ] No hardcoded enum lists (labels come from `labels.ts` / `meta`)
- [ ] Unknown enum values degrade to a neutral chip
- [ ] Copy follows [06](06-UI-SPEC.md) § Copy rules
- [ ] Numbers always show their unit
- [ ] Zero console errors or React key warnings
