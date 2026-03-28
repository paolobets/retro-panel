#!/bin/bash
# ES5 compliance check for renderer.js
# Usage: bash retro-panel/tests/js/run_es5_check.sh
set -e
RENDERER="retro-panel/app/static/js/renderer.js"
CONFIG="retro-panel/app/static/js/config.js"

echo "=== Syntax check ==="
node --check "$RENDERER" && echo "✓ renderer.js syntax OK"
node --check "$CONFIG" && echo "✓ config.js syntax OK"

echo ""
echo "=== ES6+ patterns in renderer.js (must be EMPTY) ==="
FAIL=0

check_pattern() {
  local pattern="$1"
  local desc="$2"
  if grep -qP "$pattern" "$RENDERER" 2>/dev/null; then
    echo "✗ FAIL: Found forbidden pattern '$desc' in renderer.js:"
    grep -nP "$pattern" "$RENDERER"
    FAIL=1
  else
    echo "✓ No '$desc' found"
  fi
}

check_pattern "\bconst\b" "const"
check_pattern "\blet\b" "let"
check_pattern "=>" "arrow function =>"
check_pattern "\`" "template literal"
check_pattern "\bclass\b" "class keyword"
check_pattern "\?\." "optional chaining ?."
check_pattern "\?\?" "nullish coalescing ??"
check_pattern "\bimport\b" "import statement"
check_pattern "\bexport\b" "export statement"
check_pattern "\.\.\.[ ]*[a-zA-Z]" "spread/rest operator"
check_pattern "async\s" "async keyword"
check_pattern "\bawait\b" "await keyword"

echo ""
echo "=== ES2020+ patterns in config.js (must be EMPTY after fixes) ==="
if grep -qP "\?\." "$CONFIG" 2>/dev/null; then
  echo "✗ FAIL: Found optional chaining in config.js"
  grep -nP "\?\." "$CONFIG"
  FAIL=1
else
  echo "✓ No optional chaining in config.js"
fi

if grep -qP " \?\? " "$CONFIG" 2>/dev/null; then
  echo "✗ FAIL: Found nullish coalescing in config.js"
  grep -nP " \?\? " "$CONFIG"
  FAIL=1
else
  echo "✓ No nullish coalescing in config.js"
fi

echo ""
if [ $FAIL -eq 0 ]; then
  echo "=== ALL CHECKS PASSED ==="
  exit 0
else
  echo "=== CHECKS FAILED ==="
  exit 1
fi
