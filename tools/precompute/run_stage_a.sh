#!/usr/bin/env bash
# Stage-A precompute: frame manifest, geometry verification, star metrics, histograms.
# Run from the repo root:
#   bash tools/precompute/run_stage_a.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

echo "== 1/4 frames_manifest =="
uv run tools/precompute/frames_manifest.py

echo "== 2/4 verify_geometry =="
uv run tools/precompute/verify_geometry.py

echo "== 3/4 star_metrics =="
uv run tools/precompute/star_metrics.py

echo "== 4/4 histograms =="
uv run tools/precompute/histograms.py

echo "done. Outputs in data/derived/precompute/"
