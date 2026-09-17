# scripts - OWNER: M4

| Script | Purpose |
|---|---|
| `seed-local.ts` | Load `fixtures/` into the in-memory repo for a standalone local run |
| `seed-dynamo.ts` | Load `fixtures/` into the real DynamoDB tables (M3 calls this after a deploy) |
| `seed-demo.ts` | Reset to the exact demo state in docs/10 § 3 - **excludes `req_001`**, which is created live on camera. Idempotent and re-runnable |
| `smoke.sh` | One command, full happy path against `API_BASE_URL`, prints a single pass/fail line |
