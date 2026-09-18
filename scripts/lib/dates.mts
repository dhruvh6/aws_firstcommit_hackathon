/**
 * Date helpers shared by the seed scripts. OWNER: M4.
 *
 * The fixtures encode OFFSETS, not absolute dates. Every literal in
 * fixtures/*.json is written relative to FIXTURE_EPOCH, and the API validates
 * `availableFrom >= today` / `requiredBy >= today` (docs/04 § 3) while match
 * check C5 needs `availableUntil >= requiredBy` (docs/03 § 2). Copying the
 * literals on a later date therefore breaks the demo - see fixtures/README.md § 5.
 */

/** The date every fixture literal is written relative to. */
export const FIXTURE_EPOCH = '2026-09-17';

const DAY_MS = 86_400_000;

/** UTC-anchored, so a DST boundary cannot shift a date by a day. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Whole days between two ISO dates, b - a. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

export function addDays(date: string, days: number): string {
  return isoDate(new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS));
}

export function today(): string {
  return isoDate(new Date());
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/**
 * Build a shift function for a run date: every fixture date moves by
 * (runDate - FIXTURE_EPOCH), preserving the relationships the fixtures encode.
 */
export function shifterFor(runDate: string): (date: string) => string {
  const offset = daysBetween(FIXTURE_EPOCH, runDate);
  return (date: string) => addDays(date, offset);
}

export function shiftOffset(runDate: string): number {
  return daysBetween(FIXTURE_EPOCH, runDate);
}
