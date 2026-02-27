#!/bin/bash
set -e

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT}"
MARKER_FILE="${PLUGIN_ROOT}/.deps-installed"
PACKAGE_JSON="${PLUGIN_ROOT}/package.json"
NODE_MODULES="${PLUGIN_ROOT}/node_modules"

# Check if deps need installation
needs_install=false

if [ ! -d "$NODE_MODULES" ]; then
  needs_install=true
elif [ ! -f "$MARKER_FILE" ]; then
  needs_install=true
elif [ "$PACKAGE_JSON" -nt "$MARKER_FILE" ]; then
  needs_install=true
fi

if [ "$needs_install" = true ]; then
  echo "⏳ Installing memory-md dependencies (first run, ~30s)..."
  cd "$PLUGIN_ROOT"
  npm install --silent --no-progress --no-audit 2>&1 | grep -v "^npm WARN" || true
  touch "$MARKER_FILE"
  echo "✅ Dependencies installed. Ready to use."
fi
