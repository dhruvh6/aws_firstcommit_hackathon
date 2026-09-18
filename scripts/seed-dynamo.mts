#!/usr/bin/env tsx
/**
 * seed-dynamo.mts - load fixtures/ straight into the DynamoDB tables.
 *
 * OWNER: M4  ·  PRIMARY USER: M3, after a deploy
 *
 * WHY A SEPARATE SEEDER
 * ---------------------
 * `seed-demo.mts` drives the HTTP API and can create listings and
 * requirements, but **there is no POST /businesses** (docs/04 § 2) - a business
 * is reference data, not something the product creates. On the in-memory driver
 * they arrive with the boot seed; on DynamoDB nothing puts them there. That gap
 * is this script.
 *
 * Run this once after `sam deploy`, then `seed-demo.mts` for the demo rows:
 *
 *   npm run seed:dynamo -- --dry-run          # print every item, no AWS calls
 *   npm run seed:dynamo                       # businesses only (the default)
 *   npm run seed:dynamo -- --all              # + listings and requirements
 *   npm run seed:dynamo -- --table-prefix dse- --region ap-south-1
 *   API_BASE_URL=<deployed> npm run seed:demo # then the demo rows over HTTP
 *
 * DERIVED ATTRIBUTES
 * ------------------
 * The repo layer writes `categoryCity` and `impactPartition`; they are never
 * accepted from a client (docs/05 § 5). A raw seeder has to write them too, or
 * `gsi-category-city` finds nothing and every browse and match query comes back
 * empty against a table that visibly contains rows - a confusing failure worth
 * avoiding.
 *
 * Dates are shifted by (today - 2026-09-17), same as seed-demo, because the
 * fixtures encode offsets rather than absolute dates (fixtures/README.md § 5).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { FIXTURE_EPOCH, isIsoDate, shiftOffset, shifterFor, today as todayIso } from './lib/dates.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures');

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n: string): boolean => argv.includes(`--${n}`);
const option = (n: string): string | undefined => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (flag('help')) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]);
  process.exit(0);
}

const DRY_RUN = flag('dry-run');
const ALL = flag('all');
const PREFIX = option('table-prefix') ?? process.env.TABLE_PREFIX ?? 'dse-';
const REGION = option('region') ?? process.env.AWS_REGION ?? 'ap-south-1';
const TODAY = option('today') ?? todayIso();

if (!isIsoDate(TODAY)) {
  console.error(`\n✖ --today must be an ISO date (YYYY-MM-DD), got "${TODAY}"\n`);
  process.exit(1);
}

const shift = shifterFor(TODAY);
const SHIFT = shiftOffset(TODAY);

const table = (name: string): string => `${PREFIX}${name}`;

// ── fixtures ─────────────────────────────────────────────────────────────────
const read = <T>(file: string): T[] => JSON.parse(readFileSync(join(FIXTURES, file), 'utf8')) as T[];

interface Row { [key: string]: unknown }

/** Rows to write, per table, with the derived attributes the repo layer adds. */
function buildPlan(): { table: string; key: string; items: Row[] }[] {
  const businesses = read<Row>('businesses.json');
  const plan: { table: string; key: string; items: Row[] }[] = [
    { table: table('businesses'), key: 'businessId', items: businesses },
  ];
  if (!ALL) return plan;

  const listings = read<Row>('listings.json').map((l) => ({
    ...l,
    availableFrom: shift(l.availableFrom as string),
    availableUntil: shift(l.availableUntil as string),
    // derived - docs/05 § 5
    categoryCity: `${l.category as string}#${l.city as string}`,
  }));

  const requirements = read<Row>('requirements.json').map((r) => ({
    ...r,
    requiredBy: shift(r.requiredBy as string),
    categoryCity: `${r.category as string}#${r.city as string}`,
  }));

  plan.push(
    { table: table('listings'), key: 'listingId', items: listings },
    { table: table('requirements'), key: 'requirementId', items: requirements },
  );
  return plan;
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const plan = buildPlan();

  console.log(`\nDeadStock Exchange - DynamoDB seed`);
  console.log(`  region        ${REGION}`);
  console.log(`  table prefix  ${PREFIX}`);
  console.log(`  today         ${TODAY}`);
  console.log(`  date shift    ${SHIFT >= 0 ? '+' : ''}${SHIFT} days from the ${FIXTURE_EPOCH} fixtures`);
  console.log(`  scope         ${ALL ? 'businesses + listings + requirements' : 'businesses only (pass --all for the rest)'}`);
  if (DRY_RUN) console.log(`  mode          DRY RUN - no AWS calls, no credentials needed`);
  console.log(
    `\n  Reservations and impact records are never seeded: the demo creates the first of each` +
    `\n  live, and ImpactRecord is append-only (docs/02 § 7).`,
  );

  let written = 0;
  let failed = 0;

  if (DRY_RUN) {
    for (const group of plan) {
      console.log(`\n${group.table}  (${group.items.length} items, key ${group.key})`);
      for (const item of group.items) {
        const id = String(item[group.key]);
        const extra = 'availableUntil' in item
          ? `  window ${item.availableFrom as string} -> ${item.availableUntil as string}`
          : 'requiredBy' in item
            ? `  needed by ${item.requiredBy as string}`
            : '';
        const derived = 'categoryCity' in item ? `  categoryCity=${item.categoryCity as string}` : '';
        console.log(`  + ${id.padEnd(16)}${extra}${derived}`);
        written++;
      }
    }
    console.log(`\nPlanned: ${written} items across ${plan.length} table(s). Nothing written.\n`);
    return;
  }

  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), {
    marshallOptions: { removeUndefinedValues: true },
  });

  for (const group of plan) {
    console.log(`\n${group.table}`);
    for (const item of group.items) {
      const id = String(item[group.key]);
      try {
        await doc.send(new PutCommand({ TableName: group.table, Item: item }));
        console.log(`  + ${id}`);
        written++;
      } catch (err) {
        const e = err as { name?: string; message?: string };
        console.log(`  ✖ ${id.padEnd(16)} ${e.name ?? 'Error'}: ${e.message ?? String(err)}`);
        failed++;
      }
    }
  }

  console.log(`\nDone: ${written} written, ${failed} failed\n`);
  if (failed > 0) {
    console.log(
      `  If every item failed with ResourceNotFoundException, the tables are not deployed yet or` +
      `\n  --table-prefix does not match the stack. AccessDeniedException means the IAM user is` +
      `\n  missing dynamodb:PutItem on ${PREFIX}* (docs/05 § 8).\n`,
    );
    process.exitCode = 1;
  }
}

await main();
