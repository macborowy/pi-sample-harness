#!/usr/bin/env bash

set -euo pipefail

cd apps/web

npm ci
npm run build

port="${SMOKE_PORT:-4173}"
log_file="$(mktemp)"
page_file="$(mktemp)"

cleanup() {
  if [[ -n "${server_pid:-}" ]]; then
    kill "$server_pid" 2>/dev/null || true
    wait "$server_pid" 2>/dev/null || true
  fi
  rm -f "$log_file" "$page_file"
}
trap cleanup EXIT

npm run preview -- --host 127.0.0.1 --port "$port" --strictPort >"$log_file" 2>&1 &
server_pid="$!"

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:$port/" -o "$page_file" 2>/dev/null; then
    if grep -q '<div id="root"></div>' "$page_file" && grep -q 'type="module"' "$page_file"; then
      echo "Frontend smoke test passed"
      exit 0
    fi

    echo "Frontend smoke test failed: served HTML did not look like the app" >&2
    cat "$page_file" >&2
    exit 1
  fi

  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "Frontend preview server exited during smoke test" >&2
    cat "$log_file" >&2
    exit 1
  fi

  sleep 1
done

echo "Frontend smoke test failed: preview did not serve the app" >&2
cat "$log_file" >&2
exit 1
