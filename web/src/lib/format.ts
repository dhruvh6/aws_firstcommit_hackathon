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

/**
 * ISO timestamp -> "14:30" in the viewer's local time zone, zero-padded.
 * Unlike `formatDate` (a date-only string with no time-of-day, always read
 * as UTC midnight), a timestamp has a real instant and must localize -
 * a reservation expiring at 18:39 UTC is 23:39 to a viewer in IST.
 */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** ISO timestamp -> "20 Sep, 14:30", both parts in the viewer's local time zone. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${formatTime(iso)}`;
}

/** `1400` -> "₹1,400" (docs/06 § 13 `estimatedProcurementAvoidedInr`). */
export function formatInr(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}
