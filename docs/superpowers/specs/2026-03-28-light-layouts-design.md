# Light Layout Types — Design Spec

## Overview

Differentiate light entity rendering into three distinct visual layouts (`light_standard`, `light_dimmer`, `light_rgb`) that map to the mockup sections 1a, 1b, 1c in `mockups/oggetti_definitivi.html`. The config UI already exposes these three options; this spec wires them end-to-end from config selection through to kiosk tile behaviour and bottom-sheet controls.

---

## 1. Layout Types

### 1a. `light_standard` — On/Off only

- Tile icon always yellow (`#FFB700`) when ON; gray (`var(--color-text-secondary)`) when OFF.
- No brightness value in `.tile-value` (always empty).
- Border color: `#FFB700` when ON; `transparent` when OFF.
- Tint overlay: alpha `0.14` (consistent with the dynamic formula `rgba(r,g,b,0.14)` used by `applyOnState`).
- **Tap** = toggle on/off.
- **Long-press** does nothing (no bottom sheet).

### 1b. `light_dimmer` — Brightness + Color temperature

- Tile icon color, border, and tint derive from `color_temp` attribute via `miredToColor()`. When `color_temp` is absent on an ON state, fallback to `COLOR_DEFAULT` (`#FFB700`).
- `.tile-value` shows brightness percentage (e.g. `78%`) in the same color.
- **Tap** = toggle on/off.
- **Long-press (500ms)** opens bottom sheet in `'dimmer'` mode: Brightness slider + Temperature slider. No color/hue section.

### 1c. `light_rgb` — Free color (RGB)

- Tile icon color, border, and tint derive from `rgb_color` attribute. When `rgb_color` is absent on an ON state, fallback to `COLOR_DEFAULT`.
- `.tile-value` shows brightness percentage in the same color.
- **Tap** = toggle on/off.
- **Long-press (500ms)** opens bottom sheet in `'rgb'` mode: Brightness slider + Hue slider + color swatches. No temperature section.

### Legacy `light`

Kept in COMPONENT_MAP for backward compatibility (existing entities without `visual_type` saved). Behaviour identical to current: brightness shown, long-press opens sheet with all sections shown based on `supported_features`.

---

## 2. Default on Import

When a `light.*` entity is added without a `visual_type` override, the backend now defaults to `layout_type = "light_standard"`.

**Migration impact:** `layout_type` is always recomputed from `entities.json` at load time (never persisted). Therefore this change retroactively converts all existing light entities that have no `visual_type` set from legacy `"light"` behaviour to `"light_standard"` behaviour (no brightness display, no bottom sheet). This is intentional. Users who want dimmer or RGB control must set `visual_type` explicitly via the config UI.

Change in `retro-panel/app/config/loader.py`, function `_compute_layout_type()`:

```python
# Before
if domain == "light":
    return "light"

# After
if domain == "light":
    return "light_standard"
```

The old `"light"` value remains supported (backward compat for any entity that has `visual_type = "light"` explicitly saved).

---

## 3. Renderer Changes

The renderer uses a two-step pattern: object declaration (with `null`) + `_initComponents()` assignment. Follow the same pattern for the three new layout types.

**Step 1 — declaration** (add to the `COMPONENT_MAP` and `COL_CLASS_MAP` object literals):

```js
var COMPONENT_MAP = {
  // ... existing entries ...
  'light_standard': null,
  'light_dimmer':   null,
  'light_rgb':      null,
};

var COL_CLASS_MAP = {
  // ... existing entries ...
  'light_standard': 'tile-col-compact',
  'light_dimmer':   'tile-col-compact',
  'light_rgb':      'tile-col-compact',
};
```

**Step 2 — assignment** (add to `_initComponents()`):

```js
COMPONENT_MAP['light_standard'] = window.LightComponent || null;
COMPONENT_MAP['light_dimmer']   = window.LightComponent || null;
COMPONENT_MAP['light_rgb']      = window.LightComponent || null;
```

All three variants share the same `LightComponent`; differentiation happens inside the component via `entityConfig.layout_type`.

---

## 4. `light.js` Changes

### createTile — store light mode, remove old hardcoded layoutType

Replace the existing hardcoded line:
```js
tile.dataset.layoutType = 'light';   // REMOVE this line
```

With:
```js
var layoutType = entityConfig.layout_type || 'light_standard';
tile.dataset.lightMode  = layoutType;
tile.dataset.layoutType = layoutType;   // keep for any external consumers
```

**Long-press gate**: only `light_dimmer`, `light_rgb`, and legacy `light` open the bottom sheet.

```js
function _handleLongPress() {
  var mode = tile.dataset.lightMode;
  if (mode === 'light_standard') { return; }
  var attrs = tile._lastAttrs || {};
  var bsMode = (mode === 'light_dimmer') ? 'dimmer'
             : (mode === 'light_rgb')    ? 'rgb'
             : null;   // legacy 'light': auto from supported_features
  if (window.RP_BottomSheet) {
    window.RP_BottomSheet.open(entity_id, label, attrs, bsMode);
  }
}
```

### applyOnState — add border color

Add `tile.style.borderColor = color` as the first line inside `applyOnState`. The existing `tintEl` computation already uses `rgba(r,g,b,0.14)` which is correct for all modes.

```js
function applyOnState(tile, color, brightnessValue) {
  tile.style.borderColor = color;   // ADD
  // ... rest unchanged ...
}
```

### applyOffState — clear border color

Add `tile.style.borderColor = 'transparent'` as the first line inside `applyOffState`.

```js
function applyOffState(tile) {
  tile.style.borderColor = 'transparent';   // ADD
  // ... rest unchanged ...
}
```

### colorFromAttributes — mode-aware (replaces current function)

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
  // legacy 'light': rgb wins over color_temp
  if (attrs.rgb_color && attrs.rgb_color.length >= 3) { return rgbToHex(attrs.rgb_color); }
  if (attrs.color_temp !== undefined && attrs.color_temp !== null) {
    return miredToColor(attrs.color_temp);
  }
  return COLOR_DEFAULT;
}
```

Note: the existing call site `colorFromAttributes(attrs)` (no second argument) must be updated to pass `mode`: `colorFromAttributes(attrs, mode)`.

Note: `tile.dataset.lightMode` is written once in `createTile` and persists on the DOM element for the lifetime of the tile. Both `updateTile` (server-push) and the optimistic update inside `_handleTap` correctly read `tile.dataset.lightMode` without needing to re-set it.

### updateTile — mode-aware brightness

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
    var bri   = (mode !== 'light_standard' && attrs.brightness !== undefined && attrs.brightness !== null)
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

---

## 5. `bottom-sheet.js` Changes

Add optional `mode` parameter to `open()`. Also update the module JSDoc header comment at the top of the file (line 7) to reflect the new signature: `open(entityId, label, attrs, mode)`.

```js
function open(entityId, label, attributes, mode) {
```

Replace the section-visibility + slider-sync block with a mode-aware version:

```js
if (mode === 'dimmer') {
  /* sections */
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
  /* sections */
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
  /* slider sync (existing code — unchanged) */
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

---

## 6. Files Changed

| File | Change |
|---|---|
| `retro-panel/app/config/loader.py` | Default `"light_standard"` for light domain |
| `retro-panel/app/static/js/renderer.js` | Add 3 new entries to COMPONENT_MAP (declaration + `_initComponents`) and COL_CLASS_MAP |
| `retro-panel/app/static/js/components/light.js` | Mode-aware color, border, brightness, long-press; replace `colorFromAttributes`; update `applyOnState/Off`; update `updateTile` |
| `retro-panel/app/static/js/components/bottom-sheet.js` | Add `mode` param; replace section-visibility + slider-sync block with mode-aware version |

---

## 7. Constraints

- All JS must be ES2017-safe (no `?.`, `??`, `class`). `light.js` uses `var` and IIFE — no change needed.
- Kiosk files (`app.js`, `nav.js`) are not touched.
- `RP_MDI`, `RP_MDI_PATHS`, `RP_MDI_NAMES` API unchanged.
- Existing `"light"` layout_type continues to work (backward compat).

---

## 8. Testing

- Import a new light entity → config picker defaults to `light_standard`
- `light_standard`: ON shows yellow icon/border/tint, no brightness %, long-press does nothing
- `light_dimmer`: ON shows temperature-based color, brightness %, long-press opens sheet with bri+temp sliders (pre-populated with current state)
- `light_rgb`: ON shows rgb color, brightness %, long-press opens sheet with bri+hue slider and swatches (pre-populated with current state)
- Switch layout type in config → save → kiosk updates on next reload
- Existing light entities (no `visual_type`) now render as `light_standard`
- Python tests pass: `pytest retro-panel/tests/`
