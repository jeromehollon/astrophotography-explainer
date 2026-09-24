#!/usr/bin/env bash
# Stage-B precompute: WBPP-faithful masters, per-frame normalization stats, flat-check.
# Run from the repo root (after Stage A has produced frames.json):
#   bash tools/precompute/run_stage_b.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

echo "== 1/3 masters (dark-flats + flats) =="
uv run tools/precompute/masters.py

echo "== 2/3 normalization =="
uv run tools/precompute/normalization.py

echo "== 3/3 flat_check =="
uv run tools/precompute/flat_check.py

echo "done. Outputs in data/derived/precompute/"
