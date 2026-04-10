#!/usr/bin/env bash
# release.sh — automated release for Retro Panel (stable & beta)
#
# Usage:
#   ./scripts/release.sh stable 2.13.0       # stable release
#   ./scripts/release.sh beta 2.13.0-rc1     # beta release
#
# What it does:
#   stable:
#     1. Updates retro-panel/config.yaml version
#     2. Updates cache-buster ?v=XYZ in index.html and config.html
#     3. Updates <meta name="rp-build" content="XYZ"> in index.html
#     4. Adds CHANGELOG.md placeholder section
#     5. Runs check_release.sh to verify consistency
#     6. Runs pytest to verify tests pass
#     7. Commits, tags (vX.Y.Z), pushes
#
#   beta:
#     1. Runs check_release.sh to verify stable is consistent
#     2. Runs pytest to verify tests pass
#     3. Tags (beta-X.Y.Z), pushes tag only
#     (beta config.yaml version is updated by CI bump-beta-version job)

set -euo pipefail

# ── Parse arguments ──────────────────────────────────────────────────────────

usage() {
    echo "Usage: $0 <stable|beta> <version>"
    echo ""
    echo "Examples:"
    echo "  $0 stable 2.13.0"
    echo "  $0 beta 2.13.0-rc1"
    exit 1
}

if [ $# -ne 2 ]; then
    usage
fi

MODE="$1"
VERSION="$2"

if [ "$MODE" != "stable" ] && [ "$MODE" != "beta" ]; then
    echo "ERROR: first argument must be 'stable' or 'beta'"
    usage
fi

# Validate version format
if [ "$MODE" = "stable" ]; then
    if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
        echo "ERROR: stable version must be X.Y.Z format (got: $VERSION)"
        exit 1
    fi
else
    if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+'; then
        echo "ERROR: beta version must start with X.Y.Z (got: $VERSION)"
        exit 1
    fi
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_YAML="$ROOT/retro-panel/config.yaml"
INDEX_HTML="$ROOT/retro-panel/app/static/index.html"
CONFIG_HTML="$ROOT/retro-panel/app/static/config.html"
CHANGELOG="$ROOT/retro-panel/CHANGELOG.md"

# ── Preflight checks ────────────────────────────────────────────────────────

echo ""
echo "┌──────────────────────────────────────────────┐"
echo "│  Retro Panel — Release ($MODE)               │"
echo "└──────────────────────────────────────────────┘"
echo ""

# Check clean working tree
if ! git -C "$ROOT" diff --quiet || ! git -C "$ROOT" diff --cached --quiet; then
    echo "ERROR: working tree is not clean. Commit or stash changes first."
    exit 1
fi

# Check we're on master
BRANCH=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "master" ]; then
    echo "ERROR: must be on master branch (currently on: $BRANCH)"
    exit 1
fi

# Pull latest
echo "  Pulling latest from origin/master..."
git -C "$ROOT" pull --rebase origin master

# Check tag doesn't already exist
if [ "$MODE" = "stable" ]; then
    TAG="v${VERSION}"
else
    TAG="beta-${VERSION}"
fi

if git -C "$ROOT" tag -l "$TAG" | grep -q "$TAG"; then
    echo "ERROR: tag $TAG already exists"
    exit 1
fi

echo "  Version: $VERSION"
echo "  Tag:     $TAG"
echo ""

# ── Stable release ───────────────────────────────────────────────────────────

if [ "$MODE" = "stable" ]; then
    # Derive cache-buster: remove dots (2.13.0 → 2130)
    CACHE_VER=$(echo "$VERSION" | tr -d '.')

    # Read current version for sed replacement
    OLD_VERSION=$(grep '^version:' "$CONFIG_YAML" | sed 's/version:[[:space:]]*["'"'"']*\([^"'"'"']*\)["'"'"']*/\1/')
    OLD_CACHE=$(echo "$OLD_VERSION" | tr -d '.')

    echo "  Updating version: $OLD_VERSION → $VERSION"
    echo "  Updating cache-buster: ?v=$OLD_CACHE → ?v=$CACHE_VER"
    echo "  Updating rp-build: $OLD_CACHE → $CACHE_VER"
    echo ""

    # 1. Update config.yaml version
    sed -i "s/^version: .*/version: \"${VERSION}\"/" "$CONFIG_YAML"

    # 2. Update cache-buster in index.html and config.html
    sed -i "s/?v=${OLD_CACHE}/?v=${CACHE_VER}/g" "$INDEX_HTML" "$CONFIG_HTML"

    # 3. Update rp-build meta tag
    sed -i "s/rp-build\" content=\"${OLD_CACHE}\"/rp-build\" content=\"${CACHE_VER}\"/" "$INDEX_HTML"

    # 4. Add CHANGELOG placeholder
    TODAY=$(date +%Y-%m-%d)
    CHANGELOG_ENTRY="## [${VERSION}] — ${TODAY}\n\n### Added\n\n### Fixed\n\n### Changed\n\n---\n"
    sed -i "s/^# Retro Panel — Changelog$/# Retro Panel — Changelog\n\n${CHANGELOG_ENTRY}/" "$CHANGELOG"

    # 5. Run check_release.sh
    echo "  Running release checks..."
    if ! bash "$ROOT/scripts/check_release.sh"; then
        echo ""
        echo "ERROR: check_release.sh failed. Fix issues above before releasing."
        # Revert changes
        git -C "$ROOT" checkout -- .
        exit 1
    fi

    # 6. Run tests
    echo ""
    echo "  Running tests..."
    if ! (cd "$ROOT" && py -m pytest retro-panel/tests/ -q); then
        echo ""
        echo "ERROR: tests failed. Fix before releasing."
        git -C "$ROOT" checkout -- .
        exit 1
    fi

    # 7. Commit, tag, push
    echo ""
    echo "  Committing..."
    git -C "$ROOT" add \
        retro-panel/config.yaml \
        retro-panel/app/static/index.html \
        retro-panel/app/static/config.html \
        retro-panel/CHANGELOG.md

    git -C "$ROOT" commit -m "release(v${VERSION}): bump version, cache-buster, rp-build"

    echo "  Tagging $TAG..."
    git -C "$ROOT" tag "$TAG"

    echo "  Pushing..."
    git -C "$ROOT" push origin master --tags

    echo ""
    echo "  ✅ Stable release $VERSION complete!"
    echo "     Tag: $TAG"
    echo "     CI will build and push Docker images."
    echo ""

# ── Beta release ─────────────────────────────────────────────────────────────

else
    # 1. Update cache-buster for beta (forces browser refresh between beta builds)
    # Beta cache-buster uses version with dots removed + rc suffix stripped to numbers
    BETA_CACHE=$(echo "$VERSION" | tr -d '.' | tr -d '-' | sed 's/rc//')
    OLD_VERSION=$(grep '^version:' "$CONFIG_YAML" | sed 's/version:[[:space:]]*["'"'"']*\([^"'"'"']*\)["'"'"']*/\1/')
    OLD_CACHE=$(echo "$OLD_VERSION" | tr -d '.')

    echo "  Updating beta cache-buster: ?v=$OLD_CACHE → ?v=$BETA_CACHE"
    sed -i "s/?v=${OLD_CACHE}/?v=${BETA_CACHE}/g" "$INDEX_HTML" "$CONFIG_HTML"
    sed -i "s/rp-build\" content=\"${OLD_CACHE}\"/rp-build\" content=\"${BETA_CACHE}\"/" "$INDEX_HTML"

    # 2. Run tests
    echo ""
    echo "  Running tests..."
    if ! (cd "$ROOT" && py -m pytest retro-panel/tests/ -q); then
        echo ""
        echo "ERROR: tests failed. Fix before releasing."
        git -C "$ROOT" checkout -- .
        exit 1
    fi

    # 3. Commit cache-buster change, tag, push
    echo ""
    echo "  Committing cache-buster update..."
    git -C "$ROOT" add \
        retro-panel/app/static/index.html \
        retro-panel/app/static/config.html

    git -C "$ROOT" commit -m "chore(beta): bump cache-buster to ${BETA_CACHE} for beta-${VERSION}"

    echo "  Tagging $TAG..."
    git -C "$ROOT" tag "$TAG"

    echo "  Pushing..."
    git -C "$ROOT" push origin master --tags

    echo ""
    echo "  ✅ Beta release $VERSION complete!"
    echo "     Tag: $TAG"
    echo "     Cache-buster: ?v=$BETA_CACHE"
    echo "     CI will build beta Docker image and bump retro-panel-beta/config.yaml."
    echo ""
fi
