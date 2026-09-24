#!/usr/bin/env bash
# Stage-C precompute: runtime pixel files (b1 + b2/b4/b8 pyramid) and manifest.json.
# Run from the repo root (after Stages A and B):
#   bash tools/precompute/run_stage_c.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

echo "== 1/1 runtime =="
uv run tools/precompute/runtime.py --workers 6

echo "done. Outputs in data/derived/runtime/"
