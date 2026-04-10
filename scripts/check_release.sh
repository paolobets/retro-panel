#!/usr/bin/env bash
# check_release.sh — validate version consistency before release.
#
# Checks:
#   1. config.yaml contains a valid version string (X.Y.Z)
#   2. Every static asset in config.html carries ?v=<version-no-dots>
#      e.g. version "2.3.1" → all assets must have ?v=231
#
# Usage:
#   bash scripts/check_release.sh            # from repo root
#   bash scripts/check_release.sh --verbose  # print every checked asset

set -euo pipefail

VERBOSE=0
for arg in "$@"; do
    [ "$arg" = "--verbose" ] && VERBOSE=1
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_YAML="$ROOT/retro-panel/config.yaml"
CONFIG_HTML="$ROOT/retro-panel/app/static/config.html"

# ── 1. Read add-on version from config.yaml ─────────────────────────────────

if [ ! -f "$CONFIG_YAML" ]; then
    echo "ERROR: retro-panel/config.yaml not found at $CONFIG_YAML"
    exit 1
fi

VERSION=$(grep '^version:' "$CONFIG_YAML" | sed 's/version:[[:space:]]*["'"'"']*\([^"'"'"']*\)["'"'"']*/\1/')
if [ -z "$VERSION" ]; then
    echo "ERROR: could not read 'version' from config.yaml"
    exit 1
fi

# Validate semver format X.Y.Z
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo "ERROR: version '$VERSION' in config.yaml is not in X.Y.Z format"
    exit 1
fi

# Derive cache-buster: remove dots (2.3.1 → 231)
CACHE_VER=$(echo "$VERSION" | tr -d '.')

echo "┌──────────────────────────────────────────────┐"
echo "│  Retro Panel — Release Version Check         │"
echo "└──────────────────────────────────────────────┘"
echo "  config.yaml version : $VERSION"
echo "  Expected cache-buster: ?v=$CACHE_VER"
echo ""

# ── 2. Check static assets in config.html ───────────────────────────────────

if [ ! -f "$CONFIG_HTML" ]; then
    echo "ERROR: config.html not found at $CONFIG_HTML"
    exit 1
fi

# All assets that must carry a cache-buster suffix in config.html.
# Add new entries here whenever a new JS/CSS file is added to config.html.
ASSETS=(
    "static/css/tokens.css"
    "static/css/config.css"
    "static/js/mdi-icons.js"
    "static/js/config-api.js"
    "static/js/config.js"
)

ERRORS=0

for ASSET in "${ASSETS[@]}"; do
    EXPECTED="${ASSET}?v=${CACHE_VER}"

    if grep -qF "$EXPECTED" "$CONFIG_HTML"; then
        [ "$VERBOSE" -eq 1 ] && echo "  ✓  $EXPECTED"
    else
        # Check whether the asset is present with a DIFFERENT version
        if grep -qF "${ASSET}?v=" "$CONFIG_HTML"; then
            FOUND=$(grep -oE "${ASSET//./[.]}\\?v=[0-9]+" "$CONFIG_HTML" | head -1 || echo "?")
            echo "  ✗  $ASSET — found '$FOUND', expected '?v=$CACHE_VER'"
        else
            # Asset may exist without any ?v= suffix (forgot to add it)
            echo "  ✗  $ASSET — missing cache-buster, expected '?v=$CACHE_VER'"
        fi
        ERRORS=$((ERRORS + 1))
    fi
done

# ── 2b. Check static assets in index.html ───────────────────────────────────

INDEX_HTML="$ROOT/retro-panel/app/static/index.html"

if [ ! -f "$INDEX_HTML" ]; then
    echo "ERROR: index.html not found at $INDEX_HTML"
    exit 1
fi

INDEX_ASSETS=(
    "static/css/tokens.css"
    "static/css/layout.css"
    "static/css/tiles.css"
    "static/css/bottom-sheet.css"
    "static/js/mdi-icons.js"
    "static/js/utils/dom.js"
    "static/js/utils/format.js"
    "static/js/api.js"
    "static/js/ws.js"
    "static/js/components/bottom-sheet.js"
    "static/js/components/light.js"
    "static/js/components/switch.js"
    "static/js/components/sensor.js"
    "static/js/components/alarm.js"
    "static/js/components/energy.js"
    "static/js/components/scenario.js"
    "static/js/components/camera.js"
    "static/js/nav.js"
    "static/js/renderer.js"
    "static/js/app.js"
)

for ASSET in "${INDEX_ASSETS[@]}"; do
    EXPECTED="${ASSET}?v=${CACHE_VER}"

    if grep -qF "$EXPECTED" "$INDEX_HTML"; then
        [ "$VERBOSE" -eq 1 ] && echo "  ✓  [index] $EXPECTED"
    else
        if grep -qF "${ASSET}?v=" "$INDEX_HTML"; then
            FOUND=$(grep -oE "${ASSET//./[.]}\\?v=[0-9]+" "$INDEX_HTML" | head -1 || echo "?")
            echo "  ✗  [index] $ASSET — found '$FOUND', expected '?v=$CACHE_VER'"
        else
            echo "  ✗  [index] $ASSET — missing cache-buster, expected '?v=$CACHE_VER'"
        fi
        ERRORS=$((ERRORS + 1))
    fi
done

# ── 2c. Check rp-build meta tag in index.html ──────────────────────────────

EXPECTED_META="<meta name=\"rp-build\" content=\"$CACHE_VER\">"
if grep -qF "content=\"$CACHE_VER\"" "$INDEX_HTML" && grep -qF "rp-build" "$INDEX_HTML"; then
    [ "$VERBOSE" -eq 1 ] && echo "  ✓  [index] rp-build meta content=$CACHE_VER"
else
    FOUND_META=$(grep -oE 'rp-build" content="[0-9]+"' "$INDEX_HTML" | head -1 || echo "?")
    echo "  ✗  [index] rp-build meta — found '$FOUND_META', expected content=\"$CACHE_VER\""
    ERRORS=$((ERRORS + 1))
fi

# ── 3. Result ────────────────────────────────────────────────────────────────

echo ""
if [ "$ERRORS" -eq 0 ]; then
    echo "  All checks passed — version $VERSION, cache-buster ?v=$CACHE_VER"
    exit 0
else
    echo "  FAILED: $ERRORS asset(s) out of sync."
    echo ""
    echo "  Fix options:"
    echo "    A) Bump config.html assets to ?v=$CACHE_VER (you changed config.yaml)"
    echo "    B) Revert config.yaml to match the current cache-buster in config.html"
    echo ""
    echo "  Quick fix command:"
    echo "    sed -i 's/?v=[0-9][0-9]*/?v=${CACHE_VER}/g' retro-panel/app/static/config.html retro-panel/app/static/index.html"
    exit 1
fi
