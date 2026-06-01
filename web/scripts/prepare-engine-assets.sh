#!/usr/bin/env bash
# Build the engine wheel and copy runtime assets into web/public/ for Pyodide.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PUBLIC="$ROOT/web/public"
# Only install `build` if it isn't already importable (avoids failing on
# externally-managed Python installs where it's already present).
python3 -c "import build" 2>/dev/null || python3 -m pip install --quiet build
# Remove any previously-built wheel so a version bump can't leave two behind.
rm -f "$PUBLIC"/capacity_engine-*.whl
( cd "$ROOT/engine" && python3 -m build --wheel --outdir "$PUBLIC" )
cp "$ROOT/server/data/sample_org.json" "$PUBLIC/sample_org.json"
echo "Engine assets ready in $PUBLIC:"
ls "$PUBLIC"/capacity_engine-*.whl "$PUBLIC/sample_org.json"
