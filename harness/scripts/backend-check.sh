#!/usr/bin/env bash

set -euo pipefail

cd apps/api

npm ci
npm run build

port="${SMOKE_PORT:-3100}"
log_file="$(mktemp)"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -f "$log_file"
}
trap cleanup EXIT

PORT="$port" node dist/index.js >"$log_file" 2>&1 &
server_pid="$!"

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:$port/health" 2>/dev/null | grep -q '"status":"ok"'; then
    echo "Backend smoke test passed"
    exit 0
  fi

  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "Backend server exited during smoke test" >&2
    cat "$log_file" >&2
    exit 1
  fi

  sleep 1
done

echo "Backend smoke test failed: /health did not become healthy" >&2
cat "$log_file" >&2
exit 1
