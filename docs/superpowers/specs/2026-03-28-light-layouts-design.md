# Light Layout Types — Design Spec

## Overview

Differentiate light entity rendering into three distinct visual layouts (`light_standard`, `light_dimmer`, `light_rgb`) that map to the mockup sections 1a, 1b, 1c in `mockups/oggetti_definitivi.html`. The config UI already exposes these three options; this spec wires them end-to-end from config selection through to kiosk tile behaviour and bottom-sheet controls.

---

## 1. Layout Types

### 1a. `light_standard` — On/Off only

- Tile icon always yellow (`#FFB700`) when ON; gray when OFF.
- No brightness value in `.tile-value` (always empty).
- Border color: `#FFB700` when ON; transparent when OFF.
- Tint overlay: `rgba(255,183,0,0.12)` when ON; none when OFF.
- **Tap** = toggle on/off.
- **Long-press** does nothing (no bottom sheet).

### 1b. `light_dimmer` — Brightness + Color temperature

- Tile icon color, border, and tint derive from `color_temp` attribute via `miredToColor()`.
- `.tile-value` shows brightness percentage (e.g. `78%`) in the same color.
- **Tap** = toggle on/off.
- **Long-press (500ms)** opens bottom sheet in `'dimmer'` mode: Brightness slider + Temperature slider. No color/hue section.

### 1c. `light_rgb` — Free color (RGB)

- Tile icon color, border, and tint derive from `rgb_color` attribute.
- `.tile-value` shows brightness percentage in the same color.
- **Tap** = toggle on/off.
- **Long-press (500ms)** opens bottom sheet in `'rgb'` mode: Brightness slider + Hue slider + color swatches. No temperature section.

### Legacy `light`

Kept in COMPONENT_MAP for backward compatibility (existing entities without `visual_type` saved). Behaviour identical to current: brightness shown, long-press opens sheet with all sections shown based on `supported_features`.

---

## 2. Default on Import

When a `light.*` entity is added without a `visual_type` override, the backend now defaults to `layout_type = "light_standard"`.

Change in `retro-panel/app/config/loader.py`, function `_compute_layout_type()`:

```python
# Before
if domain == "light":
    return "light"

# After
if domain == "light":
    return "light_standard"
```

The old `"light"` value remains supported (backward compat).

---

## 3. Renderer Changes

Add entries to `COMPONENT_MAP` and `COL_CLASS_MAP` in `renderer.js`:

```js
// COMPONENT_MAP additions
COMPONENT_MAP['light_standard'] = window.LightComponent || null;
COMPONENT_MAP['light_dimmer']   = window.LightComponent || null;
COMPONENT_MAP['light_rgb']      = window.LightComponent || null;

// COL_CLASS_MAP additions (same compact column as 'light')
COL_CLASS_MAP['light_standard'] = 'tile-col-compact';
COL_CLASS_MAP['light_dimmer']   = 'tile-col-compact';
COL_CLASS_MAP['light_rgb']      = 'tile-col-compact';
```

All three variants share the same `LightComponent`; differentiation happens inside the component via `entityConfig.layout_type`.

---

## 4. `light.js` Changes

### createTile

Store the layout type on the tile dataset:

```js
var layoutType = entityConfig.layout_type || 'light_standard';
tile.dataset.lightMode = layoutType;
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

### applyOnState

Add `tile.style.borderColor = color` to the on-state application. For `light_standard`, pass `color = '#FFB700'` and `brightnessValue = null` (no value shown).

### applyOffState

Add `tile.style.borderColor = 'transparent'`.

### colorFromAttributes — mode-aware

```js
function colorFromAttributes(attrs, mode) {
  if (mode === 'light_standard') { return COLOR_DEFAULT; }  // always yellow
  if (mode === 'light_rgb') {
    // rgb_color only
    if (attrs.rgb_color && attrs.rgb_color.length >= 3) { return rgbToHex(attrs.rgb_color); }
    return COLOR_DEFAULT;
  }
  if (mode === 'light_dimmer') {
    // color_temp only
    if (attrs.color_temp !== undefined && attrs.color_temp !== null) {
      return miredToColor(attrs.color_temp);
    }
    return COLOR_DEFAULT;
  }
  // legacy 'light': existing logic (rgb wins over color_temp)
  if (attrs.rgb_color && attrs.rgb_color.length >= 3) { return rgbToHex(attrs.rgb_color); }
  if (attrs.color_temp !== undefined && attrs.color_temp !== null) {
    return miredToColor(attrs.color_temp);
  }
  return COLOR_DEFAULT;
}
```

### updateTile — mode-aware brightness

`light_standard` never shows brightness:

```js
var mode  = tile.dataset.lightMode || 'light_standard';
var color = colorFromAttributes(attrs, mode);
var bri   = (mode !== 'light_standard' && attrs.brightness !== undefined && attrs.brightness !== null)
  ? (Math.round(attrs.brightness / 255 * 100) + '%')
  : null;
applyOnState(tile, color, bri);
```

---

## 5. `bottom-sheet.js` Changes

Add optional `mode` parameter to `open()`:

```js
function open(entityId, label, attributes, mode) {
```

Section visibility logic:

```js
if (mode === 'dimmer') {
  _briSection.style.display   = '';
  _tempSection.style.display  = '';
  _colorSection.style.display = 'none';
} else if (mode === 'rgb') {
  _briSection.style.display   = '';
  _tempSection.style.display  = 'none';
  _colorSection.style.display = '';
} else {
  // existing supported_features logic (legacy 'light')
  var sf = (attributes && attributes.supported_features) ? attributes.supported_features : 0;
  var hasBri   = (sf & FEAT_BRIGHTNESS) !== 0;
  var hasTemp  = (sf & FEAT_COLOR_TEMP) !== 0;
  var hasColor = (sf & FEAT_COLOR) !== 0;
  _briSection.style.display   = hasBri   ? '' : 'none';
  _tempSection.style.display  = hasTemp  ? '' : 'none';
  _colorSection.style.display = hasColor ? '' : 'none';
  if (!hasBri && !hasTemp && !hasColor) { _briSection.style.display = ''; }
}
```

---

## 6. Files Changed

| File | Change |
|---|---|
| `retro-panel/app/config/loader.py` | Default `"light_standard"` for light domain |
| `retro-panel/app/static/js/renderer.js` | Add 3 new entries to COMPONENT_MAP + COL_CLASS_MAP |
| `retro-panel/app/static/js/components/light.js` | Mode-aware color, border, brightness, long-press |
| `retro-panel/app/static/js/components/bottom-sheet.js` | Add `mode` param, replace feature-detection with mode-based section control |

---

## 7. Constraints

- All JS must be ES2017-safe (no `?.`, `??`, `class`). `light.js` uses `var` and IIFE — no change needed.
- Kiosk files (`app.js`, `nav.js`) are not touched.
- `RP_MDI`, `RP_MDI_PATHS`, `RP_MDI_NAMES` API unchanged.
- Existing `"light"` layout_type continues to work (backward compat).

---

## 8. Testing

- Import a new light entity → default `light_standard` in picker
- `light_standard`: ON shows yellow icon/border/tint, no %, long-press does nothing
- `light_dimmer`: ON shows temperature color, brightness %, long-press opens bri+temp sheet
- `light_rgb`: ON shows rgb color, brightness %, long-press opens bri+hue sheet
- Switch layout type in config → save → kiosk updates on next reload
- Existing light entities (no visual_type) render as `light_standard` after change
- ES5 check passes on `mdi-icons.js`
- Python tests pass: `pytest retro-panel/tests/`
