#!/usr/bin/env bash
# Tail push delivery logs (local go run or production docker).
# Usage:
#   ./scripts/tail-push-logs.sh local
#   ./scripts/tail-push-logs.sh prod ubuntu@18.225.219.208

set -euo pipefail

MODE="${1:-local}"
FILTER='push_trace|direct push|push send failed|deleted stale push token|register_purge|admin notify push'

case "$MODE" in
  local)
    echo "Watching local API stdout for push events (start: go run ./cmd/server in packages/logstack-go)"
    echo "Filter: $FILTER"
    echo "---"
    # Follow the most recent local server terminal if running under Cursor; else stdin.
    if [[ -t 0 ]]; then
      echo "Pipe server logs here, e.g.: cd packages/logstack-go && go run ./cmd/server 2>&1 | ./scripts/tail-push-logs.sh local"
      exit 0
    fi
    grep --line-buffered -E "$FILTER" || true
    ;;
  prod)
    HOST="${2:-renboot}"
    echo "Tailing production API logs on $HOST (Ctrl-C to stop)"
    ssh "$HOST" "docker compose -f ~/logstack/docker-compose.host.yml logs -f api 2>&1" | grep --line-buffered -E "$FILTER" || true
    ;;
  *)
    echo "Usage: $0 {local|prod [ssh-host]}"
    exit 1
    ;;
esac