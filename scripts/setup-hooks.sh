#!/usr/bin/env bash
# setup-hooks.sh — configure git to use the versioned hooks in .githooks/.
#
# Run once after cloning the repo:
#   bash scripts/setup-hooks.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

git -C "$ROOT" config core.hooksPath .githooks
chmod +x "$ROOT/.githooks/pre-push"
chmod +x "$ROOT/scripts/check_release.sh"

echo "Git hooks configured — .githooks/pre-push will run before every push."
