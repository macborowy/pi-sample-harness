#!/usr/bin/env bash

set -euo pipefail

echo "=== Harness validation ==="

echo "[1/1] Checking git diff..."
git diff --check

echo
echo "=== ALL CHECKS PASSED ==="