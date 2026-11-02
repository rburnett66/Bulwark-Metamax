#!/usr/bin/env bash
# Install headless Blender (the bpy Python module) for agent sessions.  [MM-task_mvzrtapf_1y]
#   bash tools/blender/setup.sh          # install + smoke test
#   bash tools/blender/setup.sh --check  # smoke test only
set -euo pipefail
BPY_VERSION="5.2.3"          # Blender 5.2 LTS — bump here, nowhere else
PY="${PYTHON:-python3}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PYV="$("$PY" -c 'import sys;print(f"{sys.version_info[0]}.{sys.version_info[1]}")')"
if [ "$PYV" != "3.13" ]; then
  echo "bpy $BPY_VERSION needs Python 3.13 (found $PYV at $(command -v "$PY")). Set PYTHON=/path/to/python3.13." >&2
  exit 1
fi

if [ "${1:-}" != "--check" ]; then
  have="$("$PY" -c 'import importlib.metadata as m;print(m.version("bpy"))' 2>/dev/null || true)"
  if [ "$have" = "$BPY_VERSION" ]; then
    echo "bpy $BPY_VERSION already installed"
  else
    echo "installing bpy $BPY_VERSION (~400 MB, about a minute)…"
    "$PY" -m pip install --quiet --break-system-packages "bpy==$BPY_VERSION" 2>/dev/null \
      || "$PY" -m pip install --quiet "bpy==$BPY_VERSION"
  fi
fi

OUT="$(mktemp -d)"
"$PY" "$HERE/smoke.py" "$OUT"
rm -rf "$OUT"
