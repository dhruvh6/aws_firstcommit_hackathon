#!/usr/bin/env tsx
/**
 * seed-demo.ts - put the exchange into the exact state the demo is recorded
 * from, with every date shifted relative to the run date.
 *
 * OWNER: M4  (docs/08-TEAM-ROLES.md § 3)
 *
 * WHY THIS EXISTS
 * ---------------
 * The JSON in fixtures/ is written for 17 September 2026. The API validates
 * `availableFrom >= today` and `requiredBy >= today` (docs/04 § 3), and match
 * check C5 needs `listing.availableUntil >= requirement.requiredBy`
 * (docs/03 § 2). Copy those literals on 20 September and the demo breaks in the
 * worst possible place: a requirement created that day needs
 * `requiredBy >= 20 Sep`, while lst_001 is available only *until* 20 Sep, so the
 * single compatible match disappears mid-recording.
 *
 * The offsets are what the fixtures actually encode, not the absolute dates. So
 * this script reads them, shifts every date by (today - 2026-09-17), and creates
 * the rows over the real HTTP API - which means it works identically against
 * localhost and against the deployed URL.
 *
 * WHAT IT DELIBERATELY DOES NOT SEED
 * ----------------------------------
 * lst_001 (the 80 kg star listing) and req_001 (the 50 kg requirement) are
 * created LIVE on camera at 0:35 and 1:10 of the demo (docs/10 § 4). Seeding
 * them too would put two identical 80 kg listings in the match set and muddy the
 * one screen the whole submission rests on. Pass --include-star for a rehearsal
 * where you want the end state without filming it.
 *
 * USAGE
 *   npm run seed:demo                          # against localhost:3001/v1
 *   npm run seed:demo -- --dry-run             # print the plan, change nothing
 *   npm run seed:demo -- --include-star        # also seed lst_001 and req_001
 *   npm run seed:demo -- --today 2026-09-20    # preview demo-day dates
 *   npm run seed:demo -- --verbose             # also print every POST body
 *   API_BASE_URL=https://xyz.execute-api.ap-south-1.amazonaws.com/v1 \
 *     npm run seed:demo                        # against the deployment
 *
 * Idempotent: a listing or requirement whose title/category already exists for
 * that business is skipped, so running it twice is safe. Exits non-zero on any
 * failure, so it can gate a rehearsal.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FIXTURE_EPOCH, addDays, daysBetween, isIsoDate, shiftOffset, shifterFor, today as todayIso } from './lib/dates.mjs';

// ── types (structural, deliberately loose - fixtures are data, not contract) ──
interface Business { businessId: string; name: string; area: string; city: string }
interface Listing {
  listingId: string; businessId: string; title: string; category: string;
  description?: string; totalQuantity: number; unit: string; condition: string;
  attributes: Record<string, unknown>; availableFrom: string; availableUntil: string;
  handoffMode: string; referencePriceInr?: number; city: string;
}
interface Requirement {
  requirementId: string; businessId: string; category: string; requestedQuantity: number;
  unit: string; acceptedConditions: string[]; constraints: Record<string, unknown>;
  radiusKm: number; requiredBy: string; notes?: string;
}

// ── configuration ────────────────────────────────────────────────────────────
/** Created live on camera - see the header note. */
const STAR_LISTING = 'lst_001';
const STAR_REQUIREMENT = 'req_001';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures');

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (name: string): boolean => argv.includes(`--${name}`);
const option = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (flag('help')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
  process.exit(0);
}

const API = (option('api') ?? process.env.API_BASE_URL ?? 'http://localhost:3001/v1').replace(/\/$/, '');
const DRY_RUN = flag('dry-run');
const VERBOSE = flag('verbose');
const INCLUDE_STAR = flag('include-star');
const TODAY = option('today') ?? todayIso();

if (!isIsoDate(TODAY)) {
  fail(`--today must be an ISO date (YYYY-MM-DD), got "${TODAY}"`);
}

// ── date shifting (shared with seed-dynamo, see scripts/lib/dates.mts) ───────
const SHIFT = shiftOffset(TODAY);
const shift = shifterFor(TODAY);

// ── HTTP ─────────────────────────────────────────────────────────────────────
/** The error envelope every non-2xx response carries (docs/04 § 1). */
interface ErrorEnvelope {
  error: { code: string; message: string; field: string | null; details: unknown };
}
interface Collection<T> { items?: T[]; meta?: unknown }

interface ApiResult<T = unknown> { status: number; body: T }

async function api<T = any>(
  method: string,
  path: string,
  opts: { body?: unknown; businessId?: string } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.businessId) headers['x-business-id'] = opts.businessId;

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (err) {
    fail(`cannot reach ${API}${path} - ${String(err)}\n   Start the API with: npm run dev:api`);
  }
  const text = await res!.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = text; }
  return { status: res!.status, body: body as T };
}

/** Pull the message out of an error envelope (docs/04 § 1) for a readable log line. */
function describe(res: ApiResult): string {
  const e = (res.body as Partial<ErrorEnvelope> | undefined)?.error;
  return e ? `${res.status} ${e.code}${e.field ? ` [${e.field}]` : ''}: ${e.message}` : `${res.status}`;
}

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

// ── reporting ────────────────────────────────────────────────────────────────
type Outcome = 'created' | 'skipped' | 'failed';
const log: { kind: string; label: string; outcome: Outcome; detail: string }[] = [];
const record = (kind: string, label: string, outcome: Outcome, detail = ''): void => {
  log.push({ kind, label, outcome, detail });
  const mark = outcome === 'created' ? '+' : outcome === 'skipped' ? '=' : '✖';
  console.log(`  ${mark} ${kind.padEnd(11)} ${label.padEnd(38)} ${detail}`);
};

/**
 * Report listings already in the store whose availability window has expired or
 * expires today. A window that ends before the demo's requiredBy makes check C5
 * fail, which is how a near-miss - or worse, the compatible match - silently
 * vanishes from the match screen mid-recording.
 */
async function reportStaleWindows(fixtureListings: Listing[]): Promise<void> {
  const cities = [...new Set(fixtureListings.map((l) => l.city))];
  const seen = new Map<string, { listingId: string; availableUntil: string; title: string }>();

  for (const city of cities) {
    const res = await api<Collection<{ listingId: string; title: string; availableUntil: string }>>(
      'GET', `/listings?limit=100&city=${encodeURIComponent(city)}`, { businessId: 'biz_001' },
    );
    if (res.status !== 200) continue;
    for (const l of res.body.items ?? []) seen.set(l.listingId, l);
  }

  const tomorrow = addDays(TODAY, 1);
  const stale = [...seen.values()].filter((l) => daysBetween(l.availableUntil, tomorrow) > 0);
  if (stale.length === 0) return;

  console.log(`\n  ! ${stale.length} listing(s) already in the store expire today or earlier:`);
  for (const l of stale) console.log(`      ${l.listingId.padEnd(22)} until ${l.availableUntil}  ${l.title}`);
  console.log(
    `    This script cannot fix them - there is no endpoint to move a window, and the driver` +
    `\n    seeds fixtures/ verbatim at boot. Shift the dates in the seeding layer, or restart` +
    `\n    against a clean store after bumping fixtures/. See fixtures/README.md § 5.`,
  );
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const listings: Listing[] = JSON.parse(readFileSync(join(FIXTURES, 'listings.json'), 'utf8'));
  const requirements: Requirement[] = JSON.parse(readFileSync(join(FIXTURES, 'requirements.json'), 'utf8'));

  console.log(`\nDeadStock Exchange - demo seed`);
  console.log(`  api          ${API}`);
  console.log(`  today        ${TODAY}`);
  console.log(`  date shift   ${SHIFT >= 0 ? '+' : ''}${SHIFT} days from the ${FIXTURE_EPOCH} fixtures`);
  console.log(`  star rows    ${INCLUDE_STAR ? 'INCLUDED (rehearsal)' : `excluded - ${STAR_LISTING} and ${STAR_REQUIREMENT} are created live on camera`}`);
  if (DRY_RUN) console.log(`  mode         DRY RUN - nothing will be written`);

  if (SHIFT < 0) {
    console.log(`\n  ! --today is before the fixture epoch, so dates shift backwards and may be rejected as past.`);
  }

  // 1. businesses must already exist: there is no POST /businesses by design
  //    (docs/04 § 2). The memory driver seeds them from fixtures at boot; on
  //    DynamoDB, M3's `npm run seed:dynamo` loads them.
  const biz = await api<Collection<Business>>('GET', '/businesses');
  if (biz.status !== 200) fail(`GET /businesses returned ${describe(biz)}`);
  const businesses = new Map((biz.body.items ?? []).map((b) => [b.businessId, b]));
  console.log(`\n  ${businesses.size} businesses present`);
  if (businesses.size === 0) {
    fail('no businesses - seed them first (memory driver seeds from fixtures at boot; on DynamoDB run npm run seed:dynamo)');
  }

  // 2. warn if the exchange is not in a clean recording state
  const reservations = await api<Collection<unknown>>('GET', '/reservations?role=ALL', { businessId: 'biz_001' });
  if (reservations.status === 200 && reservations.body.items?.length) {
    console.log(
      `\n  ! ${reservations.body.items.length} reservation(s) already exist. docs/10 § 3 wants a clean slate for` +
      `\n    recording: restart the API (memory driver) or clear the tables (DynamoDB) before filming.`,
    );
  }

  // 3. pre-flight: catch stale windows on rows seeded by the driver, not by us.
  //    The memory driver loads fixtures/ verbatim at boot, dates included, and
  //    there is no endpoint to correct a window afterwards - so this is a
  //    warning, and the fix belongs in the seeding layer.
  await reportStaleWindows(listings);

  // 4. listings
  console.log(`\nListings`);
  for (const l of listings) {
    const label = `${l.listingId} ${l.title}`;
    if (l.listingId === STAR_LISTING && !INCLUDE_STAR) {
      record('listing', label, 'skipped', 'created live on camera at 0:35');
      continue;
    }
    if (!businesses.has(l.businessId)) {
      record('listing', label, 'failed', `unknown business ${l.businessId}`);
      continue;
    }

    /**
     * `city` must be sent explicitly. GET /listings defaults to city=Mumbai
     * (docs/04 § 3), so a Navi Mumbai row such as lst_006 is invisible to an
     * unqualified query - which made an earlier version of this script report
     * it as missing and try to create a duplicate every run.
     */
    const existing = await api<Collection<{ title: string; category: string }>>(
      'GET', `/listings?mine=true&limit=100&city=${encodeURIComponent(l.city)}`,
      { businessId: l.businessId },
    );
    if (existing.status === 200 &&
        existing.body.items?.some((x) => x.title === l.title && x.category === l.category)) {
      record('listing', label, 'skipped', 'already present');
      continue;
    }

    const body = {
      title: l.title,
      category: l.category,
      ...(l.description ? { description: l.description } : {}),
      totalQuantity: l.totalQuantity,
      unit: l.unit,
      condition: l.condition,
      attributes: l.attributes,
      availableFrom: shift(l.availableFrom),
      availableUntil: shift(l.availableUntil),
      handoffMode: l.handoffMode,
      ...(l.referencePriceInr ? { referencePriceInr: l.referencePriceInr } : {}),
    };

    if (VERBOSE) console.log(`      POST /listings ${JSON.stringify(body)}`);
    if (DRY_RUN) {
      record('listing', label, 'created', `would create, window ${body.availableFrom} -> ${body.availableUntil}`);
      continue;
    }
    const res = await api<{ listingId: string }>('POST', '/listings', { body, businessId: l.businessId });
    if (res.status === 201) {
      record('listing', label, 'created', `${res.body.listingId}  window ${body.availableFrom} -> ${body.availableUntil}`);
    } else {
      record('listing', label, 'failed', describe(res));
    }
  }

  // 5. requirements
  console.log(`\nRequirements`);
  for (const r of requirements) {
    const label = `${r.requirementId} ${r.category} ${r.requestedQuantity}${r.unit === 'KG' ? 'kg' : ''}`;
    if (r.requirementId === STAR_REQUIREMENT && !INCLUDE_STAR) {
      record('requirement', label, 'skipped', 'created live on camera at 1:10');
      continue;
    }
    if (!businesses.has(r.businessId)) {
      record('requirement', label, 'failed', `unknown business ${r.businessId}`);
      continue;
    }

    const existing = await api<Collection<{ category: string; requestedQuantity: number }>>(
      'GET', '/requirements?mine=true&limit=100', { businessId: r.businessId },
    );
    if (existing.status === 200 &&
        existing.body.items?.some((x) => x.category === r.category && x.requestedQuantity === r.requestedQuantity)) {
      record('requirement', label, 'skipped', 'already present');
      continue;
    }

    const body = {
      category: r.category,
      requestedQuantity: r.requestedQuantity,
      unit: r.unit,
      acceptedConditions: r.acceptedConditions,
      constraints: r.constraints,
      radiusKm: r.radiusKm,
      requiredBy: shift(r.requiredBy),
      ...(r.notes ? { notes: r.notes } : {}),
    };

    if (VERBOSE) console.log(`      POST /requirements ${JSON.stringify(body)}`);
    if (DRY_RUN) {
      record('requirement', label, 'created', `would create, needed by ${body.requiredBy}`);
      continue;
    }
    const res = await api<{ requirementId: string }>('POST', '/requirements', { body, businessId: r.businessId });
    if (res.status === 201) {
      record('requirement', label, 'created', `${res.body.requirementId}  needed by ${body.requiredBy}`);
    } else {
      record('requirement', label, 'failed', describe(res));
    }
  }

  // 6. the values to type on camera, derived from the same shift
  if (!INCLUDE_STAR) {
    const star = listings.find((l) => l.listingId === STAR_LISTING)!;
    const req = requirements.find((r) => r.requirementId === STAR_REQUIREMENT)!;
    const listingUntil = shift(star.availableUntil);
    const requiredBy = shift(req.requiredBy);

    console.log(`\nType these on camera (already shifted - do NOT use the fixture dates)`);
    console.log(`  0:35 supplier lists  ${star.totalQuantity} kg ${star.category}, available ${TODAY} -> ${listingUntil}`);
    console.log(`  1:10 buyer needs     ${req.requestedQuantity} kg, needed by ${requiredBy}, within ${req.radiusKm} km`);

    // C5: listing.availableFrom <= requiredBy <= listing.availableUntil (docs/03 § 2)
    if (daysBetween(requiredBy, listingUntil) < 0) {
      console.log(
        `\n  ✖ These dates would FAIL check C5: the buyer needs it by ${requiredBy} but the listing` +
        `\n    is only available until ${listingUntil}, so the compatible match vanishes on camera.` +
        `\n    Fix the offsets in fixtures/ before filming.`,
      );
      process.exitCode = 1;
    } else {
      console.log(`  C5 check             ok - ${requiredBy} falls inside ${TODAY} -> ${listingUntil}`);
    }
  }

  // 7. summary
  const counts = { created: 0, skipped: 0, failed: 0 };
  for (const e of log) counts[e.outcome]++;
  console.log(
    `\n${DRY_RUN ? 'Planned' : 'Done'}: ${counts.created} created, ${counts.skipped} skipped, ${counts.failed} failed\n`,
  );
  if (counts.failed > 0) process.exitCode = 1;
}

await main();
