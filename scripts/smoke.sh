#!/usr/bin/env bash
# One-command happy-path smoke test. OWNER: M4.
# Usage: API_BASE_URL=http://localhost:3001/v1 bash scripts/smoke.sh
#
# Day 2: extend to the full path from docs/04 § 5 -
#   create listing -> post requirement (withMatches) -> assert 1 compatible match
#   -> reserve 50 -> assert available 30 -> reserve 50 again -> assert 409
#   -> handoff -> assert impact 50 kg -> handoff again -> assert 409.
set -euo pipefail

API="${API_BASE_URL:-http://localhost:3001/v1}"

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }

code=$(curl -s -o /tmp/dse-health.json -w '%{http_code}' "$API/health") || fail "cannot reach $API/health"
[ "$code" = "200" ] || fail "health returned $code"
grep -q '"ok":true' /tmp/dse-health.json || fail "health body unexpected: $(cat /tmp/dse-health.json)"

code=$(curl -s -o /dev/null -w '%{http_code}' "$API/definitely-not-a-route")
[ "$code" = "404" ] || fail "unknown route returned $code, expected 404"

echo "SMOKE PASS: $API reachable, health ok, unknown route 404"
