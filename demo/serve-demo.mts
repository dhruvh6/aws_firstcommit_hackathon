/**
 * Recording harness: the real API, seeded exactly as scripts/seed-demo.mts
 * seeds a deployed store - fixtures with lst_001 and req_001 removed, because
 * both are created live on camera, and every date shifted relative to today so
 * nothing is stale.
 */
import { readFileSync } from 'node:fs';
import { createMemoryRepo } from '/Users/dhruv/projects/aws_firstcommit/api/src/repo/memory.js';
import { configureRepo } from '/Users/dhruv/projects/aws_firstcommit/api/src/repo/runtime.js';

const R = '/Users/dhruv/projects/aws_firstcommit';
const read = (f: string) => JSON.parse(readFileSync(`${R}/fixtures/${f}`, 'utf8'));

const EPOCH = '2026-09-17';
const DAY = 86_400_000;
const today = new Date().toISOString().slice(0, 10);
const offset = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${EPOCH}T00:00:00Z`)) / DAY);
const shift = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + offset * DAY).toISOString().slice(0, 10);

const listings = read('listings.json')
  .filter((l: any) => l.listingId !== 'lst_001')
  .map((l: any) => ({ ...l, availableFrom: shift(l.availableFrom), availableUntil: shift(l.availableUntil) }));

const requirements = read('requirements.json')
  .filter((r: any) => r.requirementId !== 'req_001')
  .map((r: any) => ({ ...r, requiredBy: shift(r.requiredBy) }));

configureRepo(createMemoryRepo({ seed: { businesses: read('businesses.json'), listings, requirements } }));
console.log(`[demo-store] ${listings.length} listings, ${requirements.length} requirements, dates shifted ${offset >= 0 ? '+' : ''}${offset} days`);
process.env.PORT = '3001';
await import(`${R}/api/src/local/server.js`);
