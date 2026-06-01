#!/usr/bin/env bash
# Build the engine wheel and copy runtime assets into web/public/ for Pyodide.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PUBLIC="$ROOT/web/public"
python3 -m pip install --quiet build
( cd "$ROOT/engine" && python3 -m build --wheel --outdir "$PUBLIC" )
cp "$ROOT/server/data/sample_org.json" "$PUBLIC/sample_org.json"
echo "Engine assets ready in $PUBLIC:"
ls "$PUBLIC"/capacity_engine-*.whl "$PUBLIC/sample_org.json"
