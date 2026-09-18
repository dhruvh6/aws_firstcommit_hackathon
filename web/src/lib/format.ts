/**
 * Date and quantity formatting shared across match, reservation and
 * dashboard screens (S6/S7/S8). OWNER: M1.
 *
 * `MONTHS` is copied from api/src/domain/matching.ts rather than built from
 * `Intl.DateTimeFormat` - `Intl` with `month: 'short'` renders "Sept" for
 * September in `en-GB`/`en-IN`, which disagrees with every "20 Sep" example
 * in docs/06 and docs/03. Keeping both copies literal keeps client and
 * server output byte-identical without a shared runtime dependency.
 */
import { label } from '@dse/shared';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO date ("2026-09-20") -> "20 Sep" (docs/06 § 3 "Dates"). */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

function trimQuantity(value: number): string {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return String(rounded);
}

/** `80, 'KG'` -> "80 kg" (docs/06 § 3 "Quantities") - unit label always adjacent. */
export function formatQuantity(value: number, unit: string): string {
  return `${trimQuantity(value)} ${label('unit', unit) ?? unit}`;
}
