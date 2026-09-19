/**
 * Contract test suite - docs/04-API-CONTRACT.md § 5.
 *
 * OWNER: M4. This is M2's checklist: when every case here passes against a
 * running API, the backend is done. Run it against anything:
 *
 *   npm run dev:api                 # in one terminal
 *   npm run test:contract           # in another
 *   API_BASE_URL=https://<api-id>.execute-api.ap-south-1.amazonaws.com/v1 \
 *     npm run test:contract         # against the deployment (the Day-3 gate)
 *
 * The whole suite SKIPS when the API is unreachable, so `npm test` stays green
 * in CI where no server runs. It starts reporting real failures the moment an
 * endpoint exists - which is the point: red here means "not built yet", and
 * green here means Prakriti is done.
 *
 * Scope: the 11 demo-critical routes kept in the 18 September scope cut
 * (docs/04 § 2). Cut routes are deliberately not tested.
 *
 * State flows through the file in order - node:test runs tests in a file
 * sequentially. Case 6 depends on case 4's requirement, and so on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.API_BASE_URL ?? 'http://localhost:3001/v1';
const SUPPLIER = 'biz_001'; // Furniture Workshop A, Andheri East
const BUYER = 'biz_002';    // Decor & Packaging Business B, Bandra West

/**
 * Dates are derived from today, never hardcoded. The API validates
 * `availableFrom >= today` and `requiredBy >= today` (docs/04 § 3), so a
 * literal date in a test is a time bomb: this suite was written with
 * 2026-09-17 and started failing the next morning with a 400 on availableFrom,
 * which looked exactly like a backend bug and was not.
 */
const day = (offset: number): string =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const TODAY = day(0);
const IN_2_DAYS = day(2);
const IN_4_DAYS = day(4);

/** Shared state across the ordered cases. */
const ctx: {
  listingId?: string;
  requirementId?: string;
  reservationId?: string;
  /** Impact totals captured immediately before the handoff, so cases 9 and 10
   *  can assert a DELTA. Absolute totals only hold against a pristine store,
   *  and this suite is meant to run against the deployed API where state
   *  accumulates - asserting `completedExchanges === 1` there reports a false
   *  failure on correct code. */
  impactBefore?: { exchanges: number; kg: number; records: number; woodKg: number };
} = {};

async function readImpactTotals(): Promise<{ exchanges: number; kg: number; records: number; woodKg: number }> {
  const res = await call('GET', '/impact');
  const body = res.body as {
    totals: { completedExchanges: number; quantityReusedByUnit: Record<string, number> };
    meta: { sourceRecordCount: number };
  };
  const byCategory = (res.body as { byCategory?: { category: string; quantityReused: number }[] }).byCategory ?? [];
  return {
    exchanges: body.totals.completedExchanges,
    kg: body.totals.quantityReusedByUnit.KG ?? 0,
    records: body.meta.sourceRecordCount,
    woodKg: byCategory.find((c) => c.category === 'WOOD_OFFCUTS')?.quantityReused ?? 0,
  };
}

interface Res<T = any> { status: number; body: T }

async function call<T = any>(
  method: string,
  path: string,
  opts: { body?: unknown; businessId?: string } = {},
): Promise<Res<T>> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.businessId) headers['x-business-id'] = opts.businessId;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  let body: unknown = undefined;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = text; }
  return { status: res.status, body: body as T };
}

/** Every non-2xx must carry the full envelope - docs/04 § 1. */
function assertErrorEnvelope(res: Res, code: string): void {
  assert.ok(res.body?.error, `expected an error envelope, got ${JSON.stringify(res.body)}`);
  assert.equal(res.body.error.code, code);
  assert.equal(typeof res.body.error.message, 'string');
  assert.deepEqual(Object.keys(res.body.error).sort(), ['code', 'details', 'field', 'message']);
}

/**
 * Probed at module load with a top-level await, NOT in a before() hook: the
 * per-test skip option is evaluated when test() is called, which happens before
 * any hook runs. Probing in a hook makes every case skip unconditionally.
 */
const reachable = await (async () => {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 2000);
    const res = await fetch(`${BASE}/health`, { signal: c.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
})();

if (!reachable) {
  console.log(`\n  [contract] SKIPPING - no API at ${BASE}. Start one with: npm run dev:api\n`);
}

const when = () => ({ skip: reachable ? false : `no API at ${BASE}` });

// ── 1 ───────────────────────────────────────────────────────────────────────
test('1. GET /meta/categories returns the four categories and every enum label', when(), async () => {
  const res = await call('GET', '/meta/categories');
  assert.equal(res.status, 200);
  const codes = res.body.items.map((i: any) => i.code).sort();
  assert.deepEqual(codes, ['ACRYLIC_SHEET', 'FABRIC_OFFCUTS', 'PACKAGING_CARDBOARD', 'WOOD_OFFCUTS']);
  for (const kind of ['condition', 'unit', 'handoffMode', 'listingStatus', 'requirementStatus', 'reservationStatus']) {
    assert.ok(res.body.enumLabels[kind], `enumLabels.${kind} missing`);
  }
  const wood = res.body.items.find((i: any) => i.code === 'WOOD_OFFCUTS');
  assert.ok(Array.isArray(wood.attributeFields) && wood.attributeFields.length > 0);
  assert.ok(Array.isArray(wood.constraintFields) && wood.constraintFields.length > 0);
});

test('1b. GET /businesses returns the six demo businesses', when(), async () => {
  const res = await call('GET', '/businesses');
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 6);
  assert.ok(res.body.items.every((b: any) => b.businessId && b.name && b.location));
  // docs/02 § 4: no contact fields, ever
  for (const b of res.body.items) {
    for (const forbidden of ['phone', 'email', 'contact', 'address', 'contactPerson']) {
      assert.ok(!(forbidden in b), `Business must not carry a ${forbidden} field`);
    }
  }
});

// ── 2, 3 ───────────────────────────────────────────────────────────────────
test('2. POST /listings creates lst_001-shaped surplus with availableQuantity 80', when(), async () => {
  const res = await call('POST', '/listings', {
    businessId: SUPPLIER,
    body: {
      title: 'Plywood offcuts, clean and dry',
      category: 'WOOD_OFFCUTS',
      description: 'Weekly production offcuts from furniture assembly.',
      totalQuantity: 80,
      unit: 'KG',
      condition: 'CLEAN_USABLE',
      attributes: { category: 'WOOD_OFFCUTS', minPieceSizeCm: 15, maxPieceSizeCm: 40, treated: false, woodType: 'Plywood' },
      availableFrom: TODAY,
      availableUntil: IN_4_DAYS,
      handoffMode: 'PICKUP',
      referencePriceInr: 28,
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.availableQuantity, 80);
  assert.equal(res.body.reservedQuantity, 0);
  assert.equal(res.body.handedOffQuantity, 0);
  assert.equal(res.body.status, 'ACTIVE');
  assert.equal(res.body.businessId, SUPPLIER, 'identity comes from the header, not the body');
  assert.ok(res.body.location, 'location is copied from the acting business');
  ctx.listingId = res.body.listingId;
});

test('3. POST /listings with a negative quantity is 400 VALIDATION_FAILED on totalQuantity', when(), async () => {
  const res = await call('POST', '/listings', {
    businessId: SUPPLIER,
    body: {
      title: 'Bad listing', category: 'WOOD_OFFCUTS', totalQuantity: -5, unit: 'KG',
      condition: 'CLEAN_USABLE',
      attributes: { category: 'WOOD_OFFCUTS', minPieceSizeCm: 15, maxPieceSizeCm: 40, treated: false },
      availableFrom: TODAY, availableUntil: IN_4_DAYS, handoffMode: 'PICKUP',
    },
  });
  assert.equal(res.status, 400);
  assertErrorEnvelope(res, 'VALIDATION_FAILED');
  assert.equal(res.body.error.field, 'totalQuantity');
});

test('3b. a write without X-Business-Id is 401 BUSINESS_NOT_IDENTIFIED', when(), async () => {
  const res = await call('POST', '/listings', { body: { title: 'x' } });
  assert.equal(res.status, 401);
  assertErrorEnvelope(res, 'BUSINESS_NOT_IDENTIFIED');
});

test('3c. GET /listings and GET /listings/{id} return the new listing', when(), async () => {
  const list = await call('GET', '/listings?category=WOOD_OFFCUTS', { businessId: BUYER });
  assert.equal(list.status, 200);
  assert.ok(list.body.items.some((l: any) => l.listingId === ctx.listingId));
  assert.ok(list.body.meta && 'nextCursor' in list.body.meta);

  const one = await call('GET', `/listings/${ctx.listingId}`, { businessId: BUYER });
  assert.equal(one.status, 200);
  assert.equal(one.body.listingId, ctx.listingId);

  const missing = await call('GET', '/listings/lst_does_not_exist', { businessId: BUYER });
  assert.equal(missing.status, 404);
  assertErrorEnvelope(missing, 'LISTING_NOT_FOUND');
});

// ── 4 ───────────────────────────────────────────────────────────────────────
test('4. POST /requirements?withMatches=true returns the requirement and one compatible match', when(), async () => {
  const res = await call('POST', '/requirements?withMatches=true', {
    businessId: BUYER,
    body: {
      category: 'WOOD_OFFCUTS',
      requestedQuantity: 50,
      unit: 'KG',
      acceptedConditions: ['UNUSED', 'CLEAN_USABLE'],
      constraints: { category: 'WOOD_OFFCUTS', minPieceSizeCm: 10, allowTreated: false },
      radiusKm: 15,
      requiredBy: IN_2_DAYS,
      notes: 'For non-structural decor pieces.',
    },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.requirement.status, 'OPEN');
  ctx.requirementId = res.body.requirement.requirementId;

  const compatible = res.body.matches.filter((m: any) => m.compatible);
  assert.ok(compatible.length >= 1, 'expected at least one compatible match');

  /**
   * Do NOT assume the listing this suite just created ranks first. With the
   * fixtures seeded there are several compatible wood listings, and ranking is
   * by score (docs/03 § 6) - a seeded listing that expires sooner legitimately
   * outranks a fresh one on `urgency`. Assert that ours is present and that the
   * top match is well-formed, not that they are the same row.
   */
  const ours = compatible.find((m: any) => m.listingId === ctx.listingId);
  assert.ok(ours, 'the listing created in case 2 should be a compatible match');
  assert.equal(ours.compatibleQuantity, 50);
  assert.equal(ours.distanceKm, 6.9, 'Andheri East -> Bandra West is 6.9 km');

  const top = compatible[0];

  // docs/04 § 3: all six checks, always, in docs/03 § 2 order
  assert.deepEqual(top.checks.map((c: any) => c.code), [
    'CATEGORY_COMPATIBLE', 'QUANTITY_AVAILABLE', 'ATTRIBUTES_SATISFIED',
    'CONDITION_ACCEPTED', 'AVAILABILITY_WINDOW', 'WITHIN_SERVICE_AREA',
  ]);
  assert.ok(top.checks.every((c: any) => c.passed === true));
  assert.ok(top.checks.every((c: any) => typeof c.detail === 'string' && c.detail.length > 0 && c.detail.length <= 90));
  assert.ok(top.listing, 'the listing is embedded so a match card needs no second fetch');
});

// ── 5 ───────────────────────────────────────────────────────────────────────
test('5. GET /requirements/{id}/matches explains the near-misses', when(), async () => {
  const res = await call('GET', `/requirements/${ctx.requirementId}/matches?includeNearMisses=true`, { businessId: BUYER });
  assert.equal(res.status, 200);
  /**
   * Counts are >= rather than ==: case 2 of this suite adds its own compatible
   * wood listing, so the pristine fixture figures (1 compatible, 2 near-misses)
   * do not hold once the suite has run. What must hold is that the seeded
   * near-misses are still there and still explained.
   */
  assert.ok(res.body.meta.compatibleCount >= 1, 'at least the seeded lst_001 is compatible');
  assert.ok(
    res.body.meta.nearMissCount >= 2,
    'lst_005 fails size/treatment/condition and lst_006 fails distance - both must be returned and explained',
  );

  // compatible first, then near-misses (docs/04 § 3 guarantee 4)
  const flags = res.body.items.map((m: any) => m.compatible);
  assert.deepEqual(flags, [...flags].sort((a, b) => Number(b) - Number(a)));

  // every item carries all six checks, compatible or not
  for (const m of res.body.items) {
    assert.equal(m.checks.length, 6);
    assert.equal(m.compatible, m.checks.every((c: any) => c.passed));
  }

  // the category gate drops other materials entirely (docs/03 § 2)
  assert.ok(res.body.items.every((m: any) => m.listing.category === 'WOOD_OFFCUTS'));

  const distanceMiss = res.body.items.find(
    (m: any) => !m.compatible && m.checks.some((c: any) => c.code === 'WITHIN_SERVICE_AREA' && !c.passed),
  );
  assert.ok(distanceMiss, 'expected a listing rejected on distance');
  assert.equal(distanceMiss.distanceKm, 19.8, 'Vashi -> Bandra West is 19.8 km');

  const attributeMiss = res.body.items.find(
    (m: any) => !m.compatible && m.checks.some((c: any) => c.code === 'ATTRIBUTES_SATISFIED' && !c.passed),
  );
  assert.ok(attributeMiss, 'expected a listing rejected on dimensions - the second red card in the demo');
  const conditionCheck = attributeMiss.checks.find((c: any) => c.code === 'CONDITION_ACCEPTED');
  assert.equal(conditionCheck.passed, false, 'lst_005 is MIXED, which the requirement does not accept');

  assert.ok(!res.body.items.some((m: any) => m.listing.businessId === BUYER), 'never match a business to itself');
});

// ── 6, 7 ───────────────────────────────────────────────────────────────────
test('6. POST /reservations for 50 kg leaves 30 kg available and PARTIALLY_RESERVED', when(), async () => {
  const res = await call('POST', '/reservations', {
    businessId: BUYER,
    body: { listingId: ctx.listingId, requirementId: ctx.requirementId, reservedQuantity: 50 },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.reservation.status, 'RESERVED');
  assert.equal(res.body.reservation.reservedQuantity, 50);
  assert.equal(res.body.listing.availableQuantity, 30, 'the 80 -> 30 beat in the demo');
  assert.equal(res.body.listing.reservedQuantity, 50);
  assert.equal(res.body.listing.status, 'PARTIALLY_RESERVED');
  assert.equal(res.body.requirement.reservedQuantity, 50);
  assert.equal(res.body.requirement.status, 'PARTIALLY_FULFILLED');
  assert.equal(res.body.reservation.matchReasons.length, 6, 'the reasons are snapshotted at reservation time');
  ctx.reservationId = res.body.reservation.reservationId;
});

test('7. a second 50 kg reservation is 409 INSUFFICIENT_QUANTITY with the live quantity', when(), async () => {
  const res = await call('POST', '/reservations', {
    businessId: BUYER,
    body: { listingId: ctx.listingId, reservedQuantity: 50 },
  });
  assert.equal(res.status, 409);
  assertErrorEnvelope(res, 'INSUFFICIENT_QUANTITY');
  assert.equal(res.body.error.details.availableQuantity, 30, 'the UI refreshes its stepper from this');
});

test('7b. reserving your own listing is 409 SELF_RESERVATION', when(), async () => {
  const res = await call('POST', '/reservations', {
    businessId: SUPPLIER,
    body: { listingId: ctx.listingId, reservedQuantity: 1 },
  });
  assert.equal(res.status, 409);
  assertErrorEnvelope(res, 'SELF_RESERVATION');
});

test('7c. GET /reservations shows the supplier their handoff queue', when(), async () => {
  const res = await call('GET', '/reservations?role=SUPPLIER', { businessId: SUPPLIER });
  assert.equal(res.status, 200);
  assert.ok(res.body.items.some((r: any) => r.reservationId === ctx.reservationId));
});

// ── 8, 9 ───────────────────────────────────────────────────────────────────
test('8. POST /reservations/{id}/handoff records the reuse', when(), async () => {
  ctx.impactBefore = await readImpactTotals();

  const res = await call('POST', `/reservations/${ctx.reservationId}/handoff`, {
    businessId: SUPPLIER,
    body: { note: 'Collected by buyer' },
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.reservation.status, 'HANDED_OFF');
  assert.equal(res.body.listing.handedOffQuantity, 50);
  assert.equal(res.body.listing.reservedQuantity, 0);
  assert.equal(res.body.listing.availableQuantity, 30, 'handoff moves reserved -> handed off, it does not restore stock');
  assert.equal(res.body.requirement.fulfilledQuantity, 50);
  assert.equal(res.body.requirement.status, 'FULFILLED');
  assert.ok(res.body.impactRecord, 'an ImpactRecord is written inside the handoff transaction');
  assert.equal(res.body.impactRecord.quantityReused, 50);
});

test('9. handing off twice is 409 INVALID_STATE and never double-counts', when(), async () => {
  const res = await call('POST', `/reservations/${ctx.reservationId}/handoff`, { businessId: SUPPLIER, body: {} });
  assert.equal(res.status, 409);
  assertErrorEnvelope(res, 'INVALID_STATE');

  const after = await readImpactTotals();
  assert.equal(
    after.exchanges,
    ctx.impactBefore!.exchanges + 1,
    'the second handoff must not add an exchange - the demo will double-click this button',
  );
});

test('9b. only the supplier can confirm the handoff', when(), async () => {
  const res = await call('POST', `/reservations/${ctx.reservationId}/handoff`, { businessId: BUYER, body: {} });
  assert.ok([403, 409].includes(res.status), `expected 403 or 409, got ${res.status}`);
});

// ── 10 ──────────────────────────────────────────────────────────────────────
test('10. GET /impact reports 50 kg from one traceable record', when(), async () => {
  const res = await call('GET', '/impact');
  assert.equal(res.status, 200);

  // Deltas, not absolutes: this suite also runs against the deployed API, where
  // earlier runs and the demo itself leave records behind.
  const after = await readImpactTotals();
  assert.equal(after.kg, ctx.impactBefore!.kg + 50, 'the handoff added exactly 50 kg');
  assert.equal(after.exchanges, ctx.impactBefore!.exchanges + 1, 'exactly one new exchange');
  assert.equal(
    after.records,
    ctx.impactBefore!.records + 1,
    'exactly one new ImpactRecord - every figure traces to a row',
  );

  // docs/04 § 3: never sum across units, never extrapolate
  assert.equal(typeof res.body.totals.quantityReusedByUnit, 'object');
  assert.ok(!('quantityReused' in res.body.totals), 'no single cross-unit total - kg, units and sheets are not addable');
  for (const banned of ['co2e', 'co2', 'carbonSavedKg', 'treesSaved']) {
    assert.ok(!(banned in res.body.totals), `impact must not report ${banned}`);
  }

  const wood = res.body.byCategory.find((c: any) => c.category === 'WOOD_OFFCUTS');
  assert.ok(wood, 'the wood category row must be present');
  assert.equal(
    wood.quantityReused,
    ctx.impactBefore!.woodKg + 50,
    'the handoff added exactly 50 kg to the wood category',
  );
});

// ── envelope + routing ─────────────────────────────────────────────────────
test('11. an unknown route is 404 ROUTE_NOT_FOUND with the standard envelope', when(), async () => {
  const res = await call('GET', '/definitely-not-a-route');
  assert.equal(res.status, 404);
  assertErrorEnvelope(res, 'ROUTE_NOT_FOUND');
});
