/**
 * Enum value -> human display string.
 *
 * OWNER: M1  (docs/08-TEAM-ROLES.md § 3)
 * SOURCE: docs/04-API-CONTRACT.md § 3 `enumLabels`, mirrored verbatim from
 *         fixtures/meta-categories.json `enumLabels` (and `items[].code`/
 *         `items[].label` for category). Labels are copied as-is, never
 *         reworded.
 *
 * Rules (docs/07-DESIGN-SYSTEM.md § 4):
 *   - Every enum in docs/02 § 3 needs a label map here.
 *   - An unknown value must NOT throw and must NOT render blank: return
 *     undefined and let the caller fall back to a neutral chip showing the raw
 *     string. That fallback is what stops a Day-3 enum addition from breaking
 *     the UI.
 *   - At runtime prefer the labels from GET /v1/meta/categories; this file is
 *     the typed fallback so components never hardcode enum lists.
 *
 * Known gap: docs/07-DESIGN-SYSTEM.md § 4 "Status chip mapping" is FROZEN and
 * does not assign a chip variant to Condition's CLEAN_USABLE value (it lists
 * UNUSED, MIXED and NEEDS_SORTING but not CLEAN_USABLE). Rather than invent
 * one, STATUS_CHIP_VARIANT below is typed only over ListingStatus |
 * RequirementStatus | ReservationStatus, which the table covers exhaustively.
 * Condition is intentionally not part of the chip-variant map - flagged to
 * M1 to raise as a docs issue.
 */

import type {
  Condition,
  Unit,
  HandoffMode,
  ListingStatus,
  RequirementStatus,
  ReservationStatus,
  MaterialCategory,
  MatchCheckCode,
} from './domain.js';

const CONDITION_LABELS: Record<Condition, string> = {
  UNUSED: 'Unused',
  CLEAN_USABLE: 'Clean, usable',
  MIXED: 'Mixed',
  NEEDS_SORTING: 'Needs sorting',
};

const UNIT_LABELS: Record<Unit, string> = {
  KG: 'kg',
  UNITS: 'units',
  SHEETS: 'sheets',
  METRES: 'm',
};

const HANDOFF_MODE_LABELS: Record<HandoffMode, string> = {
  PICKUP: 'Buyer collects',
  DROP_OFF: 'Supplier delivers',
  EITHER: 'Either',
};

const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  ACTIVE: 'Available',
  PARTIALLY_RESERVED: 'Partly reserved',
  FULLY_RESERVED: 'Fully reserved',
  COMPLETED: 'Completed',
  EXPIRED: 'Expired',
  WITHDRAWN: 'Withdrawn',
};

const REQUIREMENT_STATUS_LABELS: Record<RequirementStatus, string> = {
  OPEN: 'Open',
  PARTIALLY_FULFILLED: 'Partly fulfilled',
  FULFILLED: 'Fulfilled',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

const RESERVATION_STATUS_LABELS: Record<ReservationStatus, string> = {
  RESERVED: 'Reserved',
  HANDED_OFF: 'Handed off',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

/** From fixtures/meta-categories.json `items[].code` / `items[].label`. */
const CATEGORY_LABELS: Record<MaterialCategory, string> = {
  WOOD_OFFCUTS: 'Wood & plywood offcuts',
  FABRIC_OFFCUTS: 'Fabric offcuts & rolls',
  PACKAGING_CARDBOARD: 'Packaging & cardboard',
  ACRYLIC_SHEET: 'Acrylic & plastic sheet',
};

const MATCH_CHECK_LABELS: Record<MatchCheckCode, string> = {
  CATEGORY_COMPATIBLE: 'Material category',
  QUANTITY_AVAILABLE: 'Quantity',
  ATTRIBUTES_SATISFIED: 'Dimensions & grade',
  CONDITION_ACCEPTED: 'Condition',
  AVAILABILITY_WINDOW: 'Availability',
  WITHIN_SERVICE_AREA: 'Distance',
};

const LABELS = {
  condition: CONDITION_LABELS,
  unit: UNIT_LABELS,
  handoffMode: HANDOFF_MODE_LABELS,
  listingStatus: LISTING_STATUS_LABELS,
  requirementStatus: REQUIREMENT_STATUS_LABELS,
  reservationStatus: RESERVATION_STATUS_LABELS,
  category: CATEGORY_LABELS,
  matchCheck: MATCH_CHECK_LABELS,
} as const satisfies Record<string, Record<string, string>>;

export type LabelKind = keyof typeof LABELS;

/**
 * Safe enum value -> label lookup. Never throws; returns undefined for a
 * value the frontend has never heard of so the caller can fall back to a
 * neutral chip with the raw string (docs/07-DESIGN-SYSTEM.md § 4 "Unknown
 * enum fallback"): `label(kind, value) ?? <Chip variant="neutral">{value}</Chip>`.
 */
export function label(kind: LabelKind, value: string): string | undefined {
  return (LABELS[kind] as Record<string, string>)[value];
}

export type ChipVariant = 'ok' | 'warn' | 'info' | 'neutral';

/**
 * docs/07-DESIGN-SYSTEM.md § 4 "Status chip mapping". Exhaustive over
 * ListingStatus | RequirementStatus | ReservationStatus only - see the
 * "Known gap" note above for why Condition is excluded.
 */
const STATUS_CHIP_VARIANT: Record<ListingStatus | RequirementStatus | ReservationStatus, ChipVariant> = {
  ACTIVE: 'ok',
  OPEN: 'ok',
  HANDED_OFF: 'ok',

  PARTIALLY_RESERVED: 'warn',
  PARTIALLY_FULFILLED: 'warn',
  RESERVED: 'warn',

  FULLY_RESERVED: 'info',
  FULFILLED: 'info',
  COMPLETED: 'info',

  EXPIRED: 'neutral',
  WITHDRAWN: 'neutral',
  CANCELLED: 'neutral',
};

/**
 * Safe status -> chip variant lookup. Never throws; an unknown value (or a
 * Condition value, which this table doesn't cover) falls back to 'neutral'.
 */
export function statusChipVariant(value: string): ChipVariant {
  return (STATUS_CHIP_VARIANT as Record<string, ChipVariant>)[value] ?? 'neutral';
}
