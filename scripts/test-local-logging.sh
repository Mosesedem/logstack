#!/usr/bin/env bash
# End-to-end local logging test for Logstack.
# Usage: ./scripts/test-local-logging.sh [API_KEY]
#
# Prerequisites:
#   - Go API running: cd packages/logstack-go && go run ./cmd/server  (port 8082)
#   - API key from Projects page (copy when created)

set -euo pipefail

API_KEY="${1:-${LOGSTACK_API_KEY:-}}"
API_URL="${LOGSTACK_API_URL:-http://localhost:8082}"
PROJECT_ID="${LOGSTACK_PROJECT_ID:-}"

if [[ -z "${API_KEY}" ]]; then
  echo "Usage: LOGSTACK_API_KEY=ls_xxx ./scripts/test-local-logging.sh" >&2
  echo "   or: ./scripts/test-local-logging.sh ls_xxx" >&2
  exit 1
fi

echo "==> Health"
curl -fsS "${API_URL}/health" | python3 -m json.tool
echo

echo "==> Ingest logs via API key"
curl -fsS -X POST "${API_URL}/v1/logs" \
  -H "Authorization: Bearer ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"logs":[
    {"level":"info","message":"E2E test: curl ingestion","metadata":{"source":"test-script"}},
    {"level":"error","message":"E2E test: error for alert rules","metadata":{"source":"test-script"}}
  ]}' | python3 -m json.tool
echo

if [[ -z "${PROJECT_ID}" ]]; then
  echo "==> Tip: set LOGSTACK_PROJECT_ID to query logs, or check the /logs page in the dashboard"
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
  environment: 'development',
});
await ls.info('E2E test: SDK console + ship', { source: 'test-script' });
await ls.error('E2E test: SDK error level');
await ls.flush();
console.log('SDK flush complete');
")

echo
echo "Done. Open http://localhost:3000/logs to see live stream."