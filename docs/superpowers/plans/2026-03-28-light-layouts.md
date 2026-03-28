# Light Layout Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the three light layout types (`light_standard`, `light_dimmer`, `light_rgb`) end-to-end from backend default through renderer dispatch to tile visual and bottom-sheet controls.

**Architecture:** The backend computes `layout_type` from `visual_type` (or domain default). The renderer maps `layout_type` → `LightComponent`. Inside `LightComponent`, `entityConfig.layout_type` controls color source, brightness display, and long-press behaviour. The bottom sheet receives a `mode` param that overrides section/slider logic.

**Tech Stack:** Python 3 (aiohttp backend), Vanilla JS ES2017 (no modules, IIFE pattern, var only), pytest for backend tests.

---

## File Map

| File | What changes |
|---|---|
| `retro-panel/app/config/loader.py` | Line 281: `return "light"` → `return "light_standard"` |
| `retro-panel/app/static/js/renderer.js` | Add `light_standard/dimmer/rgb` to COMPONENT_MAP declaration + `_initComponents()` + COL_CLASS_MAP |
| `retro-panel/app/static/js/components/light.js` | Replace `colorFromAttributes`; update `applyOnState/Off` (border); rewrite `createTile` (dataset, long-press gate); rewrite `updateTile` (mode-aware) |
| `retro-panel/app/static/js/components/bottom-sheet.js` | Add `mode` param to `open()`; replace section+slider block with mode-aware version; update JSDoc header |
| `retro-panel/tests/test_loader_v5.py` | Add 3 tests for `_compute_layout_type` light default and visual_type override |

---

## Task 1 — Backend: default layout_type for light domain

**Files:**
- Modify: `retro-panel/app/config/loader.py:281`
- Test: `retro-panel/tests/test_loader_v5.py`

**Context:**
`_compute_layout_type(entity_id, device_class, visual_type)` in `loader.py` (line 272) currently returns `"light"` for domain `light` when no `visual_type` is set. We change this to `"light_standard"`. The function is private (no `_compute_layout_type` export in `__init__.py`), but tests can import it directly via `from config.loader import _compute_layout_type`.

- [ ] **Step 1: Write the failing tests**

Add to `retro-panel/tests/test_loader_v5.py`:

```python
from config.loader import _compute_layout_type


def test_light_domain_defaults_to_light_standard():
    """light.* without visual_type defaults to light_standard (not legacy 'light')."""
    result = _compute_layout_type("light.kitchen", "", "")
    assert result == "light_standard"


def test_light_domain_with_visual_type_override():
    """visual_type always wins for light domain."""
    assert _compute_layout_type("light.kitchen", "", "light_dimmer") == "light_dimmer"
    assert _compute_layout_type("light.kitchen", "", "light_rgb")    == "light_rgb"


def test_light_legacy_value_still_accepted():
    """An entity that had visual_type='light' explicitly keeps that value."""
    assert _compute_layout_type("light.kitchen", "", "light") == "light"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd retro-panel
py -m pytest tests/test_loader_v5.py::test_light_domain_defaults_to_light_standard tests/test_loader_v5.py::test_light_domain_with_visual_type_override tests/test_loader_v5.py::test_light_legacy_value_still_accepted -v
```

Expected: `test_light_domain_defaults_to_light_standard` FAILS (returns `"light"`, not `"light_standard"`). The other two should already PASS.

- [ ] **Step 3: Change the backend default**

In `retro-panel/app/config/loader.py`, find `_compute_layout_type` (line 272). Change line 281:

```python
# Before (line 281)
    if domain == "light":
        return "light"

# After
    if domain == "light":
        return "light_standard"
```

- [ ] **Step 4: Run the new tests**

```bash
cd retro-panel
py -m pytest tests/test_loader_v5.py::test_light_domain_defaults_to_light_standard tests/test_loader_v5.py::test_light_domain_with_visual_type_override tests/test_loader_v5.py::test_light_legacy_value_still_accepted -v
```

Expected: all 3 PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd retro-panel
py -m pytest tests/test_loader_v5.py tests/test_save_validation.py -v
```

Expected: all tests in both files pass (the 2 handler import errors are pre-existing and unrelated).

- [ ] **Step 6: Commit**

```bash
cd retro-panel
git add app/config/loader.py tests/test_loader_v5.py
git commit -m "feat: default light layout_type to light_standard"
```

---

## Task 2 — Renderer: register the 3 new layout types

**Files:**
- Modify: `retro-panel/app/static/js/renderer.js:22-57` and `renderer.js:59-75`

**Context:**
`renderer.js` has two structures:
1. `COMPONENT_MAP` object literal (lines 22–38) — keys declared with `null`
2. `COL_CLASS_MAP` object literal (lines 41–57) — keys declared with column class string
3. `_initComponents()` function (lines 59–75) — assigns actual component objects

All three new layout types (`light_standard`, `light_dimmer`, `light_rgb`) map to `window.LightComponent` and `'tile-col-compact'`. There are no automated JS tests; verify by reading the file after editing.

- [ ] **Step 1: Add to COMPONENT_MAP declaration**

In `retro-panel/app/static/js/renderer.js`, in the `COMPONENT_MAP` object literal (after `'light': null,` on approximately line 23), add:

```js
    'light_standard': null,
    'light_dimmer':   null,
    'light_rgb':      null,
```

- [ ] **Step 2: Add to COL_CLASS_MAP declaration**

In the same file, in the `COL_CLASS_MAP` object literal (after `'light': 'tile-col-compact',` on approximately line 42), add:

```js
    'light_standard': 'tile-col-compact',
    'light_dimmer':   'tile-col-compact',
    'light_rgb':      'tile-col-compact',
```

- [ ] **Step 3: Add to `_initComponents()`**

In the same file, in `_initComponents()` (after `COMPONENT_MAP['light'] = window.LightComponent || null;` on approximately line 60), add:

```js
    COMPONENT_MAP['light_standard'] = window.LightComponent || null;
    COMPONENT_MAP['light_dimmer']   = window.LightComponent || null;
    COMPONENT_MAP['light_rgb']      = window.LightComponent || null;
```

- [ ] **Step 4: Verify the file**

Grep to confirm all 3 layout types appear in all 3 locations:

```bash
grep -n "light_standard\|light_dimmer\|light_rgb" retro-panel/app/static/js/renderer.js
```

Expected: 9 lines (3 keys × 3 locations).

- [ ] **Step 5: Commit**

```bash
cd retro-panel
git add app/static/js/renderer.js
git commit -m "feat: register light_standard/dimmer/rgb in renderer COMPONENT_MAP"
```

---

## Task 3 — Light component: mode-aware tile behaviour

**Files:**
- Modify: `retro-panel/app/static/js/components/light.js` (full rewrite of key functions)

**Context — current file structure (light.js):**
```
window.LightComponent = (function () {
  var LONG_PRESS_MS = 500;
  var COLOR_DEFAULT = '#FFB700';

  function miredToColor(mired) { ... }        // lines 19-27
  function rgbToHex(rgb) { ... }              // lines 29-33
  function colorFromAttributes(attrs) { ... } // lines 35-44  ← REPLACE
  function applyOnState(tile, color, bri) { } // lines 49-69  ← ADD border
  function applyOffState(tile) { ... }        // lines 71-83  ← ADD border clear
  function createTile(entityConfig) { ... }   // lines 88-188 ← UPDATE dataset + long-press
  function updateTile(tile, stateObj) { ... } // lines 193-218 ← UPDATE mode-aware
  return { createTile, updateTile };
}());
```

**What to change:**

1. `colorFromAttributes` — add `mode` parameter, branch by mode
2. `applyOnState` — add `tile.style.borderColor = color` as first line
3. `applyOffState` — add `tile.style.borderColor = 'transparent'` as first line
4. `createTile` — replace `tile.dataset.layoutType = 'light'` with mode-aware dataset writes; update `_handleLongPress` to gate on mode
5. `updateTile` — read `tile.dataset.lightMode`, pass mode to `colorFromAttributes`, suppress brightness for `light_standard`

- [ ] **Step 1: Replace `colorFromAttributes`**

Replace lines 35–44 (the entire `colorFromAttributes` function) with:

```js
  function colorFromAttributes(attrs, mode) {
    if (!attrs) { return COLOR_DEFAULT; }
    if (mode === 'light_standard') { return COLOR_DEFAULT; }
    if (mode === 'light_rgb') {
      if (attrs.rgb_color && attrs.rgb_color.length >= 3) { return rgbToHex(attrs.rgb_color); }
      return COLOR_DEFAULT;
    }
    if (mode === 'light_dimmer') {
      if (attrs.color_temp !== undefined && attrs.color_temp !== null) {
        return miredToColor(attrs.color_temp);
      }
      return COLOR_DEFAULT;
    }
    /* legacy 'light': rgb wins over color_temp */
    if (attrs.rgb_color && attrs.rgb_color.length >= 3) { return rgbToHex(attrs.rgb_color); }
    if (attrs.color_temp !== undefined && attrs.color_temp !== null) {
      return miredToColor(attrs.color_temp);
    }
    return COLOR_DEFAULT;
  }
```

- [ ] **Step 2: Update `applyOnState` — add border**

In `applyOnState` (line 49), add `tile.style.borderColor = color;` as the **first** statement inside the function body, before the `var toggle = ...` line:

```js
  function applyOnState(tile, color, brightnessValue) {
    tile.style.borderColor = color;                  // ADD THIS LINE
    var toggle = tile.querySelector('.tile-toggle');
    // ... rest unchanged ...
```

- [ ] **Step 3: Update `applyOffState` — clear border**

In `applyOffState` (line 71), add `tile.style.borderColor = 'transparent';` as the **first** statement:

```js
  function applyOffState(tile) {
    tile.style.borderColor = 'transparent';          // ADD THIS LINE
    var toggle = tile.querySelector('.tile-toggle');
    // ... rest unchanged ...
```

- [ ] **Step 4: Update `createTile` — dataset + long-press gate**

In `createTile` (line 88), find this line (line 99):
```js
    tile.dataset.layoutType = 'light';
```

Replace it with:
```js
    var layoutType          = entityConfig.layout_type || 'light_standard';
    tile.dataset.lightMode  = layoutType;
    tile.dataset.layoutType = layoutType;
```

Then find `_handleLongPress` (line 145) and replace its entire body:

```js
    function _handleLongPress() {
      _lpTimer = null;
      var mode = tile.dataset.lightMode;
      if (mode === 'light_standard') { return; }
      var attrs  = tile._lastAttrs || {};
      var bsMode = (mode === 'light_dimmer') ? 'dimmer'
                 : (mode === 'light_rgb')    ? 'rgb'
                 : null;
      if (window.RP_BottomSheet) {
        window.RP_BottomSheet.open(entity_id, label, attrs, bsMode);
      }
    }
```

- [ ] **Step 5: Rewrite `updateTile` — mode-aware brightness**

Replace the entire `updateTile` function (lines 193–218) with:

```js
  function updateTile(tile, stateObj) {
    var state = stateObj.state;
    var attrs = stateObj.attributes || {};
    var mode  = tile.dataset.lightMode || 'light_standard';

    tile.dataset.state = state;
    tile._lastAttrs    = attrs;

    tile.classList.remove('is-on', 'is-off', 'is-unavail');

    if (state === 'on') {
      tile.classList.add('is-on');
      var color = colorFromAttributes(attrs, mode);
      var bri   = (mode !== 'light_standard' &&
                   attrs.brightness !== undefined && attrs.brightness !== null)
        ? (Math.round(attrs.brightness / 255 * 100) + '%')
        : null;
      applyOnState(tile, color, bri);

    } else if (state === 'unavailable') {
      tile.classList.add('is-unavail');
      applyOffState(tile);

    } else {
      tile.classList.add('is-off');
      applyOffState(tile);
    }
  }
```

- [ ] **Step 6: Verify no old references remain**

```bash
grep -n "layoutType = 'light'" retro-panel/app/static/js/components/light.js
```

Expected: 0 matches (the hardcoded `'light'` string is gone).

```bash
grep -n "colorFromAttributes" retro-panel/app/static/js/components/light.js
```

Expected: 2 matches — the function definition and the call in `updateTile`, both with 2 args.

- [ ] **Step 7: Commit**

```bash
cd retro-panel
git add app/static/js/components/light.js
git commit -m "feat: mode-aware light tile (standard/dimmer/rgb/legacy)"
```

---

## Task 4 — Bottom sheet: mode-driven section and slider control

**Files:**
- Modify: `retro-panel/app/static/js/components/bottom-sheet.js`

**Context — current `open()` function (lines 187–228):**
The function currently:
1. Reads `supported_features` bitmask from `attributes`
2. Uses bitwise AND against `FEAT_BRIGHTNESS`, `FEAT_COLOR_TEMP`, `FEAT_COLOR` to decide which sections to show
3. Syncs slider values from attributes

We add a 4th `mode` parameter. When `mode === 'dimmer'`, force bri+temp sections and sync those sliders. When `mode === 'rgb'`, force bri+color sections and sync those sliders. When `mode` is `null`/`undefined`, keep existing `supported_features` logic unchanged.

The section-visibility + slider-sync block is lines 193–223 in the current file. The `open()` function signature is on line 187.

- [ ] **Step 1: Update JSDoc header comment**

At line 7, find:
```
 * Exposes globally: window.RP_BottomSheet = { open(entityId, label, attrs), close() }
```

Change to:
```
 * Exposes globally: window.RP_BottomSheet = { open(entityId, label, attrs, mode), close() }
```

- [ ] **Step 2: Update `open()` signature**

At line 187, change:
```js
  function open(entityId, label, attributes) {
```
To:
```js
  function open(entityId, label, attributes, mode) {
```

- [ ] **Step 3: Replace the section-visibility + slider-sync block**

The block to replace starts after `if (_titleEl) { _titleEl.textContent = label || entityId; }` (line 191) and ends before the `/* open via is-open class */` comment (line 225).

The current block (lines 193–223):
```js
    var sf = (attributes && attributes.supported_features) ? attributes.supported_features : 0;
    var hasBri   = (sf & FEAT_BRIGHTNESS) !== 0;
    var hasTemp  = (sf & FEAT_COLOR_TEMP) !== 0;
    var hasColor = (sf & FEAT_COLOR) !== 0;

    /* show/hide sections */
    _briSection.style.display   = hasBri   ? '' : 'none';
    _tempSection.style.display  = hasTemp  ? '' : 'none';
    _colorSection.style.display = hasColor ? '' : 'none';

    /* fallback: if no features detected show brightness */
    if (!hasBri && !hasTemp && !hasColor) {
      _briSection.style.display = '';
    }

    /* sync slider values from current attributes */
    if (hasBri && attributes && attributes.brightness !== undefined && attributes.brightness !== null) {
      _briSlider.value = String(attributes.brightness);
      var pct = Math.round(attributes.brightness / 255 * 100);
      if (_briVal) { _briVal.textContent = pct + '%'; }
    }
    if (hasTemp && attributes && attributes.color_temp !== undefined && attributes.color_temp !== null) {
      _tempSlider.value = String(attributes.color_temp);
      var kelvin = Math.round(1000000 / attributes.color_temp);
      if (_tempVal) { _tempVal.textContent = kelvin + 'K'; }
    }
    if (hasColor && attributes && attributes.hs_color) {
      var hue = Math.round(attributes.hs_color[0]);
      _hueSlider.value = String(hue);
      if (_hueDot) { _hueDot.style.background = 'hsl(' + hue + ',80%,55%)'; }
    }
```

Replace with:

```js
    if (mode === 'dimmer') {
      /* sections: brightness + temperature only */
      _briSection.style.display   = '';
      _tempSection.style.display  = '';
      _colorSection.style.display = 'none';
      /* slider sync */
      if (_briSlider && attributes && attributes.brightness !== undefined && attributes.brightness !== null) {
        _briSlider.value = String(attributes.brightness);
        var pctD = Math.round(attributes.brightness / 255 * 100);
        if (_briVal) { _briVal.textContent = pctD + '%'; }
      }
      if (_tempSlider && attributes && attributes.color_temp !== undefined && attributes.color_temp !== null) {
        _tempSlider.value = String(attributes.color_temp);
        var kelvinD = Math.round(1000000 / attributes.color_temp);
        if (_tempVal) { _tempVal.textContent = kelvinD + 'K'; }
      }
    } else if (mode === 'rgb') {
      /* sections: brightness + color only */
      _briSection.style.display   = '';
      _tempSection.style.display  = 'none';
      _colorSection.style.display = '';
      /* slider sync */
      if (_briSlider && attributes && attributes.brightness !== undefined && attributes.brightness !== null) {
        _briSlider.value = String(attributes.brightness);
        var pctR = Math.round(attributes.brightness / 255 * 100);
        if (_briVal) { _briVal.textContent = pctR + '%'; }
      }
      if (_hueSlider && attributes && attributes.hs_color) {
        var hueR = Math.round(attributes.hs_color[0]);
        _hueSlider.value = String(hueR);
        if (_hueDot) { _hueDot.style.background = 'hsl(' + hueR + ',80%,55%)'; }
      }
    } else {
      /* legacy 'light': existing supported_features logic */
      var sf     = (attributes && attributes.supported_features) ? attributes.supported_features : 0;
      var hasBri   = (sf & FEAT_BRIGHTNESS) !== 0;
      var hasTemp  = (sf & FEAT_COLOR_TEMP) !== 0;
      var hasColor = (sf & FEAT_COLOR) !== 0;
      _briSection.style.display   = hasBri   ? '' : 'none';
      _tempSection.style.display  = hasTemp  ? '' : 'none';
      _colorSection.style.display = hasColor ? '' : 'none';
      if (!hasBri && !hasTemp && !hasColor) { _briSection.style.display = ''; }
      /* slider sync */
      if (hasBri && attributes && attributes.brightness !== undefined && attributes.brightness !== null) {
        _briSlider.value = String(attributes.brightness);
        var pct = Math.round(attributes.brightness / 255 * 100);
        if (_briVal) { _briVal.textContent = pct + '%'; }
      }
      if (hasTemp && attributes && attributes.color_temp !== undefined && attributes.color_temp !== null) {
        _tempSlider.value = String(attributes.color_temp);
        var kelvin = Math.round(1000000 / attributes.color_temp);
        if (_tempVal) { _tempVal.textContent = kelvin + 'K'; }
      }
      if (hasColor && attributes && attributes.hs_color) {
        var hue = Math.round(attributes.hs_color[0]);
        _hueSlider.value = String(hue);
        if (_hueDot) { _hueDot.style.background = 'hsl(' + hue + ',80%,55%)'; }
      }
    }
```

- [ ] **Step 4: Verify**

```bash
grep -n "function open\|mode === " retro-panel/app/static/js/components/bottom-sheet.js
```

Expected: 1 match for `function open` (with 4 params) and 2 matches for `mode ===` (`'dimmer'` and `'rgb'`).

- [ ] **Step 5: Run Python tests (regression guard)**

```bash
cd retro-panel
py -m pytest tests/test_loader_v5.py tests/test_save_validation.py -q
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
cd retro-panel
git add app/static/js/components/bottom-sheet.js
git commit -m "feat: mode-aware bottom sheet (dimmer/rgb/legacy)"
```

---

## Final Verification

After all 4 tasks:

```bash
cd retro-panel
py -m pytest tests/test_loader_v5.py tests/test_save_validation.py -v
```

Expected: 21+ tests passing (18 existing + 3 new light layout_type tests).

```bash
grep -c "light_standard\|light_dimmer\|light_rgb" app/static/js/renderer.js
```

Expected: 9 (3 keys × 3 locations).
