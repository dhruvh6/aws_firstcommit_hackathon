/**
 * MSW handlers, one per route in docs/04-API-CONTRACT.md § 2. OWNER: M1.
 *
 * Reads/writes go through ./state.ts (in-memory, seeded from fixtures/).
 * Matching goes through ./matching.ts, verified against
 * fixtures/expected-matches.json. Every handler mirrors the exact payload
 * shapes M2 will serve - mocks/README.md "a mock that is more forgiving than
 * the real API turns the Day-3 cutover into a rewrite."
 *
 * Path patterns use a leading `*` so they match regardless of
 * VITE_API_BASE_URL's origin (docs/04 § 1 base URL differs local vs deployed;
 * .env.mock still points at http://localhost:3001, which MSW's service
 * worker intercepts the same as same-origin requests).
 */
import { http, HttpResponse } from 'msw';
import type {
  Business,
  ImpactByCategory,
  ImpactTotals,
  ListingStatus,
  MatchCheck,
  Unit,
} from '@dse/shared';
import { CATEGORY_UNITS, MATERIAL_CATEGORIES } from '@dse/shared';
import { apiError } from './errors.js';
import { FIXTURE_META_CATEGORIES } from './fixtures.js';
import {
  addListing,
  addReservation,
  addRequirement,
  getBusinessById,
  getBusinesses,
  getImpactRecords,
  getListingById,
  getListings,
  getRequirementById,
  getRequirements,
  getReservationById,
  getReservations,
  handoffReservation,
} from './state.js';
import { distanceKm, evaluateMatch, findMatchesForRequirement } from './matching.js';
import { MOCK_TODAY } from './today.js';
import { validateCreateListing, validateCreateRequirement } from './validate.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getActingBusiness(request: Request): Business | null {
  const id = request.headers.get('X-Business-Id');
  if (!id) return null;
  return getBusinessById(id) ?? null;
}

function encodeCursor(offset: number): string {
  return btoa(String(offset));
}

function decodeCursor(cursor: string | null): number {
  if (!cursor) return 0;
  try {
    const n = parseInt(atob(cursor), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function paginate<T>(items: T[], url: URL): { page: T[]; nextCursor: string | null } {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 24) || 24));
  const offset = decodeCursor(url.searchParams.get('cursor'));
  const page = items.slice(offset, offset + limit);
  const nextCursor = offset + limit < items.length ? encodeCursor(offset + limit) : null;
  return { page, nextCursor };
}

// ---------------------------------------------------------------------------
// Health - not in docs/04's route table (it's outside the frozen contract),
// but real infra: api/src/router.ts serves it, App.tsx polls it, and
// scripts/smoke.sh asserts `"ok":true`. Mirrored here so the scaffold health
// check in App.tsx reads "reachable" in mock mode instead of 404ing.
// ---------------------------------------------------------------------------

const health = http.get('*/v1/health', () =>
  HttpResponse.json({ ok: true, service: 'deadstock-exchange-api', repoDriver: 'mock', time: new Date().toISOString() }),
);

// ---------------------------------------------------------------------------
// Meta / businesses
// ---------------------------------------------------------------------------

const metaCategories = http.get('*/v1/meta/categories', () => HttpResponse.json(FIXTURE_META_CATEGORIES));

const listBusinesses = http.get('*/v1/businesses', () => {
  const items = getBusinesses();
  return HttpResponse.json({ items, meta: { count: items.length, nextCursor: null, truncated: false } });
});

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

const createListing = http.post('*/v1/listings', async ({ request }) => {
  const business = getActingBusiness(request);
  if (!business) return apiError(401, 'BUSINESS_NOT_IDENTIFIED', 'X-Business-Id is missing or unknown');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'MALFORMED_JSON', 'Body was not valid JSON');
  }

  const result = validateCreateListing(body);
  if (!result.ok) return apiError(400, 'VALIDATION_FAILED', result.message, { field: result.field });
  const v = result.value;

  const listing = addListing({
    businessId: business.businessId,
    businessName: business.name,
    title: v.title,
    category: v.category,
    description: v.description,
    totalQuantity: v.totalQuantity,
    availableQuantity: v.totalQuantity,
    reservedQuantity: 0,
    handedOffQuantity: 0,
    unit: v.unit,
    condition: v.condition,
    attributes: v.attributes,
    area: business.area,
    city: business.city,
    location: business.location,
    availableFrom: v.availableFrom,
    availableUntil: v.availableUntil,
    handoffMode: v.handoffMode,
    photoKey: v.photoKey,
    referencePriceInr: v.referencePriceInr,
  });

  return HttpResponse.json(listing, { status: 201 });
});

function sortListings<T extends { availableUntil: string; availableQuantity: number; distanceKm?: number; createdAt: string }>(
  items: T[],
  sort: string,
  hasOrigin: boolean,
): T[] {
  const arr = items.slice();
  switch (sort) {
    case 'EXPIRING_SOON':
      return arr.sort((a, b) => (a.availableUntil < b.availableUntil ? -1 : a.availableUntil > b.availableUntil ? 1 : 0));
    case 'QUANTITY_DESC':
      return arr.sort((a, b) => b.availableQuantity - a.availableQuantity);
    case 'DISTANCE_ASC':
      return hasOrigin ? arr.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)) : arr;
    default:
      return arr.sort((a, b) => (b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0));
  }
}

const listListings = http.get('*/v1/listings', ({ request }) => {
  const url = new URL(request.url);
  const actingBusiness = getActingBusiness(request);

  let items = getListings().slice();

  const categories = url.searchParams.getAll('category');
  if (categories.length) items = items.filter((l) => categories.includes(l.category));

  const conditions = url.searchParams.getAll('condition');
  if (conditions.length) items = items.filter((l) => conditions.includes(l.condition));

  const q = url.searchParams.get('q');
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter(
      (l) =>
        l.title.toLowerCase().includes(needle) ||
        (l.description ?? '').toLowerCase().includes(needle) ||
        l.businessName.toLowerCase().includes(needle),
    );
  }

  const minQuantity = url.searchParams.get('minQuantity');
  if (minQuantity !== null) items = items.filter((l) => l.availableQuantity >= Number(minQuantity));
  const maxQuantity = url.searchParams.get('maxQuantity');
  if (maxQuantity !== null) items = items.filter((l) => l.availableQuantity <= Number(maxQuantity));

  const city = url.searchParams.get('city') ?? 'Mumbai';
  items = items.filter((l) => l.city === city);

  const availableOn = url.searchParams.get('availableOn');
  if (availableOn) items = items.filter((l) => l.availableFrom <= availableOn && l.availableUntil >= availableOn);

  const mine = url.searchParams.get('mine') === 'true';
  if (mine) {
    if (!actingBusiness) return apiError(401, 'BUSINESS_NOT_IDENTIFIED', 'X-Business-Id is required for mine=true');
    items = items.filter((l) => l.businessId === actingBusiness.businessId);
  }

  const statusParams = url.searchParams.getAll('status') as ListingStatus[];
  if (statusParams.length) {
    items = items.filter((l) => statusParams.includes(l.status));
  } else if (!mine) {
    const defaultStatuses: ListingStatus[] = ['ACTIVE', 'PARTIALLY_RESERVED'];
    items = items.filter((l) => defaultStatuses.includes(l.status));
  }

  const originBusinessId = url.searchParams.get('originBusinessId') ?? actingBusiness?.businessId;
  const origin = originBusinessId ? getBusinessById(originBusinessId) : undefined;

  const withDistance = items.map((l) => ({
    ...l,
    distanceKm: origin ? distanceKm(l.location, origin.location) : undefined,
  }));

  const maxDistanceKm = url.searchParams.get('maxDistanceKm');
  let filtered = withDistance;
  if (maxDistanceKm !== null && origin) {
    filtered = filtered.filter((l) => (l.distanceKm ?? Infinity) <= Number(maxDistanceKm));
  }

  const sort = url.searchParams.get('sort') ?? 'RECENT';
  filtered = sortListings(filtered, sort, origin !== undefined);

  const { page, nextCursor } = paginate(filtered, url);
  return HttpResponse.json({ items: page, meta: { count: filtered.length, nextCursor, truncated: false } });
});

const getListing = http.get('*/v1/listings/:listingId', ({ request, params }) => {
  const listing = getListingById(String(params.listingId));
  if (!listing) return apiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
  const actingBusiness = getActingBusiness(request);
  if (!actingBusiness) return HttpResponse.json(listing);
  return HttpResponse.json({ ...listing, distanceKm: distanceKm(listing.location, actingBusiness.location) });
});

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

const createRequirement = http.post('*/v1/requirements', async ({ request }) => {
  const business = getActingBusiness(request);
  if (!business) return apiError(401, 'BUSINESS_NOT_IDENTIFIED', 'X-Business-Id is missing or unknown');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'MALFORMED_JSON', 'Body was not valid JSON');
  }

  const result = validateCreateRequirement(body);
  if (!result.ok) return apiError(400, 'VALIDATION_FAILED', result.message, { field: result.field });
  const v = result.value;

  const requirement = addRequirement({
    businessId: business.businessId,
    businessName: business.name,
    category: v.category,
    requestedQuantity: v.requestedQuantity,
    unit: v.unit,
    acceptedConditions: v.acceptedConditions,
    constraints: v.constraints,
    area: business.area,
    city: business.city,
    location: business.location,
    radiusKm: v.radiusKm,
    requiredBy: v.requiredBy,
    notes: v.notes,
  });

  const url = new URL(request.url);
  if (url.searchParams.get('withMatches') === 'true') {
    const matchResult = findMatchesForRequirement({
      requirement,
      listings: getListings(),
      today: MOCK_TODAY,
      includeNearMisses: true,
      limit: 20,
    });
    return HttpResponse.json({ requirement, matches: [...matchResult.compatible, ...matchResult.nearMisses] }, { status: 201 });
  }

  return HttpResponse.json(requirement, { status: 201 });
});

const getRequirementMatches = http.get('*/v1/requirements/:requirementId/matches', ({ request, params }) => {
  const business = getActingBusiness(request);
  if (!business) return apiError(401, 'BUSINESS_NOT_IDENTIFIED', 'X-Business-Id is missing or unknown');
  const requirement = getRequirementById(String(params.requirementId));
  if (!requirement) return apiError(404, 'REQUIREMENT_NOT_FOUND', 'Requirement not found');
  if (requirement.businessId !== business.businessId) {
    return apiError(403, 'NOT_YOUR_REQUIREMENT', 'You do not own this requirement');
  }

  const url = new URL(request.url);
  const includeNearMisses = url.searchParams.get('includeNearMisses') !== 'false';
  const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20);

  const result = findMatchesForRequirement({ requirement, listings: getListings(), today: MOCK_TODAY, includeNearMisses, limit });
  const items = [...result.compatible, ...result.nearMisses];
  return HttpResponse.json({
    requirement,
    items,
    meta: {
      count: items.length,
      compatibleCount: result.compatibleCountTotal,
      nearMissCount: result.nearMissCountTotal,
      truncated: result.truncated,
      evaluatedAt: new Date().toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

function validateCreateReservationBody(
  body: unknown,
): { ok: true; listingId: string; requirementId?: string; reservedQuantity: number } | { ok: false; field: string; message: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, field: 'listingId', message: 'Request body must be an object' };
  const b = body as Record<string, unknown>;
  if (typeof b.listingId !== 'string' || !b.listingId) return { ok: false, field: 'listingId', message: 'listingId is required' };
  if (typeof b.reservedQuantity !== 'number' || !(b.reservedQuantity > 0) || round2(b.reservedQuantity) !== b.reservedQuantity) {
    return { ok: false, field: 'reservedQuantity', message: 'reservedQuantity must be > 0, max 2 decimal places' };
  }
  const requirementId = typeof b.requirementId === 'string' ? b.requirementId : undefined;
  return { ok: true, listingId: b.listingId, requirementId, reservedQuantity: b.reservedQuantity };
}

const createReservation = http.post('*/v1/reservations', async ({ request }) => {
  const buyer = getActingBusiness(request);
  if (!buyer) return apiError(401, 'BUSINESS_NOT_IDENTIFIED', 'X-Business-Id is missing or unknown');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, 'MALFORMED_JSON', 'Body was not valid JSON');
  }

  const parsed = validateCreateReservationBody(body);
  if (!parsed.ok) return apiError(400, 'VALIDATION_FAILED', parsed.message, { field: parsed.field });

  const listing = getListingById(parsed.listingId);
  if (!listing) return apiError(404, 'LISTING_NOT_FOUND', 'Listing not found');

  const requirement = parsed.requirementId ? getRequirementById(parsed.requirementId) : undefined;
  if (parsed.requirementId && !requirement) return apiError(404, 'REQUIREMENT_NOT_FOUND', 'Requirement not found');

  if (listing.businessId === buyer.businessId) {
    return apiError(409, 'SELF_RESERVATION', 'You cannot reserve your own listing');
  }

  if (listing.status !== 'ACTIVE' && listing.status !== 'PARTIALLY_RESERVED') {
    return apiError(409, 'LISTING_NOT_AVAILABLE', `Listing is ${listing.status.toLowerCase()} and cannot be reserved`);
  }

  if (requirement && (requirement.status === 'FULFILLED' || requirement.status === 'CANCELLED' || requirement.status === 'EXPIRED')) {
    return apiError(409, 'INVALID_STATE', `Requirement is ${requirement.status.toLowerCase()}`);
  }

  let matchReasons: MatchCheck[] = [];
  if (requirement) {
    const evaluated = evaluateMatch(listing, requirement, MOCK_TODAY);
    // Every hard check but quantity - INSUFFICIENT_QUANTITY/EXCEEDS_REQUIREMENT
    // below own the quantity story, so C2 is excluded from NOT_COMPATIBLE.
    if (!evaluated) {
      return apiError(409, 'NOT_COMPATIBLE', 'This listing no longer matches your requirement', {
        details: { failedChecks: ['CATEGORY_COMPATIBLE'] },
      });
    }
    const failedChecks = evaluated.checks.filter((c) => c.code !== 'QUANTITY_AVAILABLE' && !c.passed).map((c) => c.code);
    if (failedChecks.length > 0) {
      return apiError(409, 'NOT_COMPATIBLE', 'This listing no longer matches your requirement', { details: { failedChecks } });
    }
    matchReasons = evaluated.checks;
  }

  if (parsed.reservedQuantity > listing.availableQuantity) {
    return apiError(409, 'INSUFFICIENT_QUANTITY', `Only ${listing.availableQuantity} ${listing.unit.toLowerCase()} available`, {
      details: { availableQuantity: listing.availableQuantity },
    });
  }

  if (requirement) {
    const remaining = round2(requirement.requestedQuantity - requirement.fulfilledQuantity - requirement.reservedQuantity);
    if (parsed.reservedQuantity > remaining) {
      return apiError(422, 'EXCEEDS_REQUIREMENT', `Only ${remaining} ${requirement.unit.toLowerCase()} remaining on this requirement`, {
        details: { remainingRequirement: remaining },
      });
    }
  }

  const reservation = addReservation({
    listing,
    requirement: requirement ?? null,
    reservedQuantity: parsed.reservedQuantity,
    buyerBusinessId: buyer.businessId,
    buyerBusinessName: buyer.name,
    matchReasons,
  });

  return HttpResponse.json({ reservation, listing, requirement: requirement ?? null }, { status: 201 });
});

const listReservations = http.get('*/v1/reservations', ({ request }) => {
  const business = getActingBusiness(request);
  if (!business) return apiError(401, 'BUSINESS_NOT_IDENTIFIED', 'X-Business-Id is missing or unknown');

  const url = new URL(request.url);
  const role = url.searchParams.get('role') ?? 'ALL';
  let items = getReservations().filter((r) => {
    if (role === 'BUYER') return r.buyerBusinessId === business.businessId;
    if (role === 'SUPPLIER') return r.supplierBusinessId === business.businessId;
    return r.buyerBusinessId === business.businessId || r.supplierBusinessId === business.businessId;
  });

  const statuses = url.searchParams.getAll('status');
  if (statuses.length) items = items.filter((r) => statuses.includes(r.status));

  items = items.slice().sort((a, b) => (b.createdAt < a.createdAt ? -1 : b.createdAt > a.createdAt ? 1 : 0));

  const { page, nextCursor } = paginate(items, url);
  return HttpResponse.json({ items: page, meta: { count: items.length, nextCursor, truncated: false } });
});

const handoff = http.post('*/v1/reservations/:reservationId/handoff', async ({ request, params }) => {
  const business = getActingBusiness(request);
  if (!business) return apiError(401, 'BUSINESS_NOT_IDENTIFIED', 'X-Business-Id is missing or unknown');
  const reservation = getReservationById(String(params.reservationId));
  if (!reservation) return apiError(404, 'RESERVATION_NOT_FOUND', 'Reservation not found');
  if (reservation.supplierBusinessId !== business.businessId) {
    return apiError(403, 'NOT_YOUR_RESERVATION', 'Only the supplier can confirm handoff');
  }

  const raw = await request.text();
  if (raw) {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return apiError(400, 'MALFORMED_JSON', 'Body was not valid JSON');
    }
    const note = (body as Record<string, unknown>).note;
    if (note !== undefined && (typeof note !== 'string' || note.length > 200)) {
      return apiError(400, 'VALIDATION_FAILED', 'note must be <= 200 characters', { field: 'note' });
    }
  }

  // Idempotency guard - a second handoff on a HANDED_OFF reservation must
  // change nothing and never write a second ImpactRecord (docs/04 § 3).
  if (reservation.status !== 'RESERVED') {
    return apiError(409, 'INVALID_STATE', `Reservation is already ${reservation.status.toLowerCase()}`);
  }

  const listing = getListingById(reservation.listingId);
  if (!listing) return apiError(404, 'LISTING_NOT_FOUND', 'Listing not found');
  const requirement = reservation.requirementId ? getRequirementById(reservation.requirementId) ?? null : null;
  const impactRecord = handoffReservation(reservation, listing, requirement);

  return HttpResponse.json({ reservation, listing, requirement, impactRecord });
});

// ---------------------------------------------------------------------------
// Impact
// ---------------------------------------------------------------------------

const getImpact = http.get('*/v1/impact', ({ request }) => {
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope') ?? 'PLATFORM';
  const business = getActingBusiness(request);
  if (scope === 'MINE' && !business) {
    return apiError(401, 'BUSINESS_NOT_IDENTIFIED', 'X-Business-Id is required for scope=MINE');
  }

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let records = getImpactRecords().slice();
  if (scope === 'MINE' && business) {
    records = records.filter((r) => r.supplierBusinessId === business.businessId || r.receiverBusinessId === business.businessId);
  }
  if (from) records = records.filter((r) => r.completedAt.slice(0, 10) >= from);
  if (to) records = records.filter((r) => r.completedAt.slice(0, 10) <= to);

  const quantityReusedByUnit: Record<Unit, number> = { KG: 0, UNITS: 0, SHEETS: 0, METRES: 0 };
  for (const r of records) quantityReusedByUnit[r.unit] = round2(quantityReusedByUnit[r.unit] + r.quantityReused);

  const pricedRecords = records.filter((r) => r.estimatedProcurementAvoidedInr !== undefined);
  const estimatedProcurementAvoidedInr = pricedRecords.length
    ? Math.round(pricedRecords.reduce((sum, r) => sum + (r.estimatedProcurementAvoidedInr ?? 0), 0))
    : undefined;

  let activeListings = getListings().filter((l) => l.status === 'ACTIVE' || l.status === 'PARTIALLY_RESERVED');
  if (scope === 'MINE' && business) activeListings = activeListings.filter((l) => l.businessId === business.businessId);
  const activeSurplusByUnit: Record<Unit, number> = { KG: 0, UNITS: 0, SHEETS: 0, METRES: 0 };
  for (const l of activeListings) activeSurplusByUnit[l.unit] = round2(activeSurplusByUnit[l.unit] + l.availableQuantity);

  let scopedRequirements = getRequirements();
  if (scope === 'MINE' && business) scopedRequirements = scopedRequirements.filter((r) => r.businessId === business.businessId);
  const requirementsFulfilledFully = scopedRequirements.filter((r) => r.status === 'FULFILLED').length;
  const requirementsFulfilledPartially = scopedRequirements.filter((r) => r.status === 'PARTIALLY_FULFILLED').length;
  const requirementsOpen = scopedRequirements.filter((r) => r.status === 'OPEN').length;
  const denominator = requirementsFulfilledFully + requirementsFulfilledPartially + requirementsOpen;
  const fulfilmentRatePct = denominator > 0 ? Math.round(((requirementsFulfilledFully + requirementsFulfilledPartially) / denominator) * 100) : 0;

  const hoursDiffs = records
    .map((r) => {
      const reservation = getReservations().find((rv) => rv.reservationId === r.reservationId);
      const listing = getListingById(r.listingId);
      if (!reservation || !listing) return null;
      return (Date.parse(reservation.createdAt) - Date.parse(listing.createdAt)) / 3_600_000;
    })
    .filter((h): h is number => h !== null)
    .sort((a, b) => a - b);
  let medianHoursListingToReservation = 0;
  if (hoursDiffs.length > 0) {
    const mid = Math.floor((hoursDiffs.length - 1) / 2);
    medianHoursListingToReservation =
      hoursDiffs.length % 2 === 1
        ? round2(hoursDiffs[mid] as number)
        : round2(((hoursDiffs[mid] as number) + (hoursDiffs[mid + 1] as number)) / 2);
  }

  // Mirrors api/src/handlers/impact.ts's buildByCategory: every category is
  // considered regardless of whether it has a completed record, and is only
  // dropped when it has neither a record nor any active surplus.
  const byCategory: ImpactByCategory[] = [];
  for (const category of MATERIAL_CATEGORIES) {
    const categoryRecords = records.filter((r) => r.category === category);
    const activeSurplus = round2(
      activeListings.filter((l) => l.category === category).reduce((sum, l) => sum + l.availableQuantity, 0),
    );
    if (categoryRecords.length === 0 && activeSurplus === 0) continue;
    byCategory.push({
      category,
      quantityReused: round2(categoryRecords.reduce((sum, r) => sum + r.quantityReused, 0)),
      unit: categoryRecords[0]?.unit ?? CATEGORY_UNITS[category].canonicalUnit,
      completedExchanges: categoryRecords.length,
      activeSurplus,
    });
  }

  const dailyMap = new Map<string, { date: string; quantityReused: number; completedExchanges: number }>();
  for (const r of records) {
    const date = r.completedAt.slice(0, 10);
    const entry = dailyMap.get(date) ?? { date, quantityReused: 0, completedExchanges: 0 };
    entry.quantityReused = round2(entry.quantityReused + r.quantityReused);
    entry.completedExchanges += 1;
    dailyMap.set(date, entry);
  }
  const dailySeries = Array.from(dailyMap.values()).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const totals: ImpactTotals = {
    quantityReusedByUnit,
    completedExchanges: records.length,
    activeSurplusByUnit,
    requirementsFulfilledFully,
    requirementsFulfilledPartially,
    requirementsOpen,
    fulfilmentRatePct,
    medianHoursListingToReservation,
    ...(estimatedProcurementAvoidedInr !== undefined ? { estimatedProcurementAvoidedInr } : {}),
  };

  return HttpResponse.json({
    totals,
    byCategory,
    dailySeries,
    meta: { sourceRecordCount: records.length, generatedAt: new Date().toISOString() },
  });
});

// ---------------------------------------------------------------------------
// Fallback - anything under /v1 not matched above (docs/04 § 4 ROUTE_NOT_FOUND)
// ---------------------------------------------------------------------------

const routeNotFound = http.all('*/v1/*', () => apiError(404, 'ROUTE_NOT_FOUND', 'No such route'));

export const handlers = [
  health,
  metaCategories,
  listBusinesses,
  createListing,
  listListings,
  getListing,
  createRequirement,
  getRequirementMatches,
  createReservation,
  listReservations,
  handoff,
  getImpact,
  routeNotFound,
];
