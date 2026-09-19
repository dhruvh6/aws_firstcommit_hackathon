/**
 * GET /v1/impact - docs/04-API-CONTRACT.md § 3.
 *
 * OWNER: M4 (split from M2's phase-3 work by agreement on 18 September, so the
 * reservation transaction and this aggregation could be written in parallel).
 *
 * The rules this endpoint exists to enforce, from docs/04 § 3 and docs/01 § 10:
 *
 *   1. Every figure aggregates ImpactRecord rows only - handed off, never
 *      merely reserved. A cancelled reservation was never reuse.
 *   2. Quantities are keyed by unit and NEVER summed across units. Kilograms,
 *      units and sheets are not addable, and a single "total material reused"
 *      number would be a lie.
 *   3. estimatedProcurementAvoidedInr appears only where a supplier stated a
 *      reference price, and the key is omitted entirely when none did - so the
 *      UI cannot render an unlabelled zero as if it were a real figure.
 *   4. No CO2e, no "trees saved", no environmental extrapolation, ever.
 *   5. meta.sourceRecordCount is returned so the dashboard can show, in small
 *      print, exactly how many real transactions the numbers came from.
 */
import type {
  ImpactByCategory,
  ImpactDailyPoint,
  ImpactRecord,
  ImpactResponse,
  ImpactTotals,
  MaterialCategory,
  Requirement,
  SurplusListing,
  Unit,
} from '@dse/shared';
import { CATEGORY_UNITS, MATERIAL_CATEGORIES, UNITS } from '@dse/shared';
import { ApiRequestError } from '../errors.js';
import { getRepo } from '../repo/runtime.js';
import type { Handler } from '../router.js';
import { queryValue, requireActingBusiness } from './common.js';

/** Fixture-scale ceiling; the demo dataset is far below it. */
const SCAN_LIMIT = 100;
/** Guards against an absurd series if a date range is wide. */
const MAX_SERIES_DAYS = 30;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isoDateOf(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function round(value: number, dp = 2): number {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Every unit present with a zero, so the client never indexes undefined. */
function emptyUnitTotals(): Record<Unit, number> {
  return Object.fromEntries(UNITS.map((unit) => [unit, 0])) as Record<Unit, number>;
}

function requireIsoDate(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (!ISO_DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new ApiRequestError(400, 'VALIDATION_FAILED', `${field} must be an ISO date (YYYY-MM-DD).`, field);
  }
  return value;
}

function buildDailySeries(records: ImpactRecord[], from?: string, to?: string): ImpactDailyPoint[] {
  if (records.length === 0) return [];

  const byDate = new Map<string, { quantityReused: number; completedExchanges: number }>();
  for (const record of records) {
    const date = isoDateOf(record.completedAt);
    const point = byDate.get(date) ?? { quantityReused: 0, completedExchanges: 0 };
    // Summed within a day across units only because a single day's demo data is
    // one unit; the per-unit breakdown lives in totals and byCategory.
    point.quantityReused += record.quantityReused;
    point.completedExchanges += 1;
    byDate.set(date, point);
  }

  const dates = [...byDate.keys()].sort();
  const start = from ?? dates[0]!;
  const end = to ?? dates[dates.length - 1]!;

  const series: ImpactDailyPoint[] = [];
  for (let date = start, i = 0; date <= end && i < MAX_SERIES_DAYS; date = addDays(date, 1), i++) {
    const point = byDate.get(date);
    series.push({
      date,
      quantityReused: round(point?.quantityReused ?? 0),
      completedExchanges: point?.completedExchanges ?? 0,
    });
  }
  return series;
}

function buildByCategory(
  records: ImpactRecord[],
  listings: SurplusListing[],
): ImpactByCategory[] {
  const rows: ImpactByCategory[] = [];

  for (const category of MATERIAL_CATEGORIES) {
    const categoryRecords = records.filter((r) => r.category === category);
    const activeSurplus = listings
      .filter((l) => l.category === category && (l.status === 'ACTIVE' || l.status === 'PARTIALLY_RESERVED'))
      .reduce((sum, l) => sum + l.availableQuantity, 0);

    if (categoryRecords.length === 0 && activeSurplus === 0) continue;

    rows.push({
      category: category as MaterialCategory,
      quantityReused: round(categoryRecords.reduce((sum, r) => sum + r.quantityReused, 0)),
      // Records carry their own unit; fall back to the category's canonical one
      // so the row is never unitless.
      unit: categoryRecords[0]?.unit ?? CATEGORY_UNITS[category].canonicalUnit,
      completedExchanges: categoryRecords.length,
      activeSurplus: round(activeSurplus),
    });
  }

  return rows;
}

function countRequirements(requirements: Requirement[]): Pick<
  ImpactTotals,
  'requirementsFulfilledFully' | 'requirementsFulfilledPartially' | 'requirementsOpen' | 'fulfilmentRatePct'
> {
  const fully = requirements.filter((r) => r.status === 'FULFILLED').length;
  const partially = requirements.filter((r) => r.status === 'PARTIALLY_FULFILLED').length;
  const open = requirements.filter((r) => r.status === 'OPEN').length;
  const considered = requirements.length;

  return {
    requirementsFulfilledFully: fully,
    requirementsFulfilledPartially: partially,
    requirementsOpen: open,
    fulfilmentRatePct: considered === 0 ? 0 : Math.round(((fully + partially) / considered) * 100),
  };
}

export const getImpact: Handler = async (req) => {
  const scopeValue = queryValue(req, 'scope') ?? 'PLATFORM';
  if (scopeValue !== 'PLATFORM' && scopeValue !== 'MINE') {
    throw new ApiRequestError(400, 'VALIDATION_FAILED', 'scope must be PLATFORM or MINE.', 'scope');
  }
  const from = requireIsoDate(queryValue(req, 'from'), 'from');
  const to = requireIsoDate(queryValue(req, 'to'), 'to');
  if (from && to && from > to) {
    throw new ApiRequestError(400, 'VALIDATION_FAILED', 'from cannot be after to.', 'from');
  }

  const businessId = scopeValue === 'MINE' ? (await requireActingBusiness(req)).businessId : undefined;
  const repo = getRepo();

  const records = await repo.queryImpactRecords({
    businessId,
    from,
    // completedAt is a full timestamp while `to` is a date, so an inclusive
    // upper bound has to cover the whole day - otherwise every record from the
    // final day silently disappears from the totals.
    to: to ? `${to}T23:59:59.999Z` : undefined,
  });

  const [listingPage, requirementPage, reservationPage] = await Promise.all([
    repo.queryListings({ businessId, limit: SCAN_LIMIT }),
    repo.queryRequirements({ businessId, limit: SCAN_LIMIT }),
    repo.queryReservations({ businessId, limit: SCAN_LIMIT }),
  ]);

  const listings = listingPage.items;
  const listingCreatedAt = new Map(listings.map((l) => [l.listingId, l.createdAt]));

  // Quantities keyed by unit. Never summed across units - rule 2 above.
  const quantityReusedByUnit = emptyUnitTotals();
  for (const record of records) {
    quantityReusedByUnit[record.unit] = round(quantityReusedByUnit[record.unit] + record.quantityReused);
  }

  const activeSurplusByUnit = emptyUnitTotals();
  for (const listing of listings) {
    if (listing.status !== 'ACTIVE' && listing.status !== 'PARTIALLY_RESERVED') continue;
    activeSurplusByUnit[listing.unit] = round(activeSurplusByUnit[listing.unit] + listing.availableQuantity);
  }

  // Median listing-created -> first-reservation, in hours. Only the earliest
  // reservation per listing counts, so a popular listing cannot skew it.
  const firstReservationPerListing = new Map<string, string>();
  for (const reservation of reservationPage.items) {
    const existing = firstReservationPerListing.get(reservation.listingId);
    if (!existing || reservation.createdAt < existing) {
      firstReservationPerListing.set(reservation.listingId, reservation.createdAt);
    }
  }
  const hoursToReservation: number[] = [];
  for (const [listingId, reservedAt] of firstReservationPerListing) {
    const createdAt = listingCreatedAt.get(listingId);
    if (!createdAt) continue;
    const hours = (Date.parse(reservedAt) - Date.parse(createdAt)) / HOUR_MS;
    if (Number.isFinite(hours) && hours >= 0) hoursToReservation.push(hours);
  }

  const priced = records.filter((r) => typeof r.estimatedProcurementAvoidedInr === 'number');
  const estimatedProcurementAvoidedInr = priced.reduce(
    (sum, r) => sum + (r.estimatedProcurementAvoidedInr ?? 0),
    0,
  );

  const totals: ImpactTotals = {
    quantityReusedByUnit,
    completedExchanges: records.length,
    activeSurplusByUnit,
    ...countRequirements(requirementPage.items),
    medianHoursListingToReservation: round(median(hoursToReservation), 1),
    // Rule 3: omit the key entirely rather than report a meaningless zero.
    ...(priced.length > 0 ? { estimatedProcurementAvoidedInr: Math.round(estimatedProcurementAvoidedInr) } : {}),
  };

  const body: ImpactResponse = {
    totals,
    byCategory: buildByCategory(records, listings),
    dailySeries: buildDailySeries(records, from, to),
    meta: {
      sourceRecordCount: records.length,
      generatedAt: new Date().toISOString(),
    },
  };

  return { status: 200, body };
};
