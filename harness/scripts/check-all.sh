#!/usr/bin/env bash

set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"

backend_log="$(mktemp)"
frontend_log="$(mktemp)"

cleanup() {
  rm -f "$backend_log" "$frontend_log"
}
trap cleanup EXIT

backend_status=0
frontend_status=0

(
  cd "$repo_root"
  "$script_dir/backend-check.sh"
) >"$backend_log" 2>&1 || backend_status=$?

(
  cd "$repo_root"
  "$script_dir/frontend-check.sh"
) >"$frontend_log" 2>&1 || frontend_status=$?

if [[ "$backend_status" -eq 0 && "$frontend_status" -eq 0 ]]; then
  echo "PASS"
  exit 0
fi

echo "FAIL"

if [[ "$backend_status" -ne 0 ]]; then
  echo "backend-check.sh failed with exit code $backend_status"
  echo "--- backend-check.sh output ---"
  cat "$backend_log"
fi

if [[ "$frontend_status" -ne 0 ]]; then
  echo "frontend-check.sh failed with exit code $frontend_status"
  echo "--- frontend-check.sh output ---"
  cat "$frontend_log"
fi

exit 1
