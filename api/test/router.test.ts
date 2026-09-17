/**
 * Scaffold smoke tests. OWNER: M4 (docs/08-TEAM-ROLES.md § 3).
 *
 * The real suites arrive on Day 2:
 *   - api/test/matching.test.ts  - every example in docs/03 § 8 and § 10,
 *     asserted against fixtures/expected-matches.json  (M2)
 *   - api/test/contract.test.ts  - the 10 cases in docs/04 § 5, runnable
 *     against any API_BASE_URL, local or deployed  (M4)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/router.js';

const req = (method: string, path: string) => ({
  method,
  path,
  query: {},
  headers: {},
  body: undefined,
});

test('GET /v1/health returns ok', async () => {
  const res = await handle(req('GET', '/v1/health'));
  assert.equal(res.status, 200);
  assert.equal((res.body as { ok: boolean }).ok, true);
});

test('an unknown route returns 404 ROUTE_NOT_FOUND', async () => {
  const res = await handle(req('GET', '/v1/nope'));
  assert.equal(res.status, 404);
  assert.equal((res.body as { error: { code: string } }).error.code, 'ROUTE_NOT_FOUND');
});

test('the error envelope always carries code, message, field and details', async () => {
  const res = await handle(req('GET', '/v1/nope'));
  const { error } = res.body as { error: Record<string, unknown> };
  assert.deepEqual(Object.keys(error).sort(), ['code', 'details', 'field', 'message']);
});
