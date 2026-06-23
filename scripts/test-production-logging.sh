#!/usr/bin/env bash
# End-to-end production logging test for Logstack.
# Usage: LOGSTACK_API_KEY=ls_xxx ./scripts/test-production-logging.sh
#
# Optional:
#   LOGSTACK_PROJECT_ID=<uuid>  — query recent logs after ingest
#   LOGSTACK_API_URL            — default https://api.logstack.tech

set -euo pipefail

API_KEY="${1:-${LOGSTACK_API_KEY:-}}"
API_URL="${LOGSTACK_API_URL:-https://api.logstack.tech}"
PROJECT_ID="${LOGSTACK_PROJECT_ID:-}"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ -z "${API_KEY}" ]]; then
  echo "Usage: LOGSTACK_API_KEY=ls_xxx ./scripts/test-production-logging.sh" >&2
  echo "   or: ./scripts/test-production-logging.sh ls_xxx" >&2
  exit 1
fi

echo "==> Health (${API_URL})"
curl -fsS "${API_URL}/health" | python3 -m json.tool
echo

echo "==> Ingest logs via API key"
curl -fsS -X POST "${API_URL}/v1/logs" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"logs\":[
    {\"level\":\"info\",\"message\":\"Production E2E test: curl ingestion\",\"metadata\":{\"source\":\"test-script\",\"stamp\":\"${STAMP}\"}},
    {\"level\":\"error\",\"message\":\"Production E2E test: simulated error\",\"metadata\":{\"source\":\"test-script\",\"stamp\":\"${STAMP}\"}}
  ]}" | python3 -m json.tool
echo

if [[ -z "${PROJECT_ID}" ]]; then
  echo "==> Tip: set LOGSTACK_PROJECT_ID to query logs, or open /logs in the dashboard"
else
  echo "==> Query recent logs"
  curl -fsS "${API_URL}/v1/logs?projectId=${PROJECT_ID}&limit=5" \
    -H "Authorization: Bearer ${API_KEY}" | python3 -m json.tool
fi

echo
echo "==> JS SDK test (console + network)"
(cd packages/logstack-js && node --input-type=module -e "
import { createLogStack } from './dist/index.mjs';
const ls = createLogStack({
  apiKey: '${API_KEY}',
  endpoint: '${API_URL}',
  environment: 'production',
});
await ls.info('Production E2E test: SDK ship', { source: 'test-script', stamp: '${STAMP}' });
await ls.error('Production E2E test: SDK error level', { source: 'test-script' });
await ls.flush();
console.log('SDK flush complete');
")

echo
echo "Done. Open https://www.logstack.tech/logs (or /demo) to verify."