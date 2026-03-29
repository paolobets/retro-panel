# Sensor Visual System Group C — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 new sensor layout_types (electrical, signal, gas, speed, water, ph, physical) covering 22 previously unmapped HA device_class values, with level-based coloring for signal/gas/speed/ph and fixed colors for the rest.

**Architecture:** Five independent edits across CSS, JS, Python, and config — same pattern as v2.4.0. tiles.css first (sensor.js references its class names). loader.py uses TDD. _detect_icon() gains an optional device_class param; device_class parsing is moved before icon detection in _parse_entity() to make it available.

**Tech Stack:** Plain CSS, Vanilla JS ES2017 (iOS 12+ safe, IIFE, `var` only), Python 3.11, pytest

---

## File Map

| File | Change |
|------|--------|
| `retro-panel/app/static/css/tiles.css` | Append 18 new `sri-*` classes after the air-quality block |
| `retro-panel/app/static/js/components/sensor.js` | Add 7 keys to INITIAL_BUBBLE_CLASS, 18 classes to ALL_BUBBLE_CLASSES, 7 branches to updateTile() |
| `retro-panel/app/config/loader.py` | Add `_DC_ICON_MAP` dict, extend `_detect_icon()` signature, reorder `_parse_entity()`, add 22 mappings to `_compute_layout_type()` |
| `retro-panel/tests/test_loader_sensor_types_c.py` | New file — 27 TDD tests |
| `retro-panel/app/static/js/config.js` | Add 7 entries to VISUAL_OPTIONS.sensor + 7 labels |
| `retro-panel/app/static/js/renderer.js` | Add 7 layout_types to COMPONENT_MAP, COL_CLASS_MAP, _initComponents() |
| `retro-panel/config.yaml` | Bump version 2.4.0 → 2.5.0 |
| `retro-panel/app/static/index.html` | Cache-buster `?v=240` → `?v=250` |
| `retro-panel/app/static/config.html` | Cache-buster `?v=240` → `?v=250` |

---

## Task 1: tiles.css — 18 new sri-* classes

**Files:**
- Modify: `retro-panel/app/static/css/tiles.css` (after line 320, after `.sri-aq-hazard`)

- [ ] **Step 1: Add 18 new classes**

In `tiles.css`, find the line:
```css
.sri-aq-hazard { background: rgba(248,113,113,0.18); color: #f87171; }
```

Insert the following block immediately after it (before the `.sensor-text` rule):

```css

/* Electrical — fixed indigo */
.sri-electrical { background: rgba(129,140,248,0.18); color: #818cf8; }

/* Signal strength — 4 levels (dBm, higher = better) */
.sri-sig-strong { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-sig-good   { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-sig-fair   { background: rgba(251,146,60,0.18);  color: #fb923c; }
.sri-sig-weak   { background: rgba(248,113,113,0.18); color: #f87171; }

/* Gas concentration — 4 levels (ppm) */
.sri-gas-safe     { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-gas-mod      { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-gas-bad      { background: rgba(251,146,60,0.18);  color: #fb923c; }
.sri-gas-critical { background: rgba(248,113,113,0.18); color: #f87171; }

/* Speed — 4 levels (km/h, Beaufort-simplified) */
.sri-spd-calm   { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-spd-breezy { background: rgba(103,232,249,0.18); color: #67e8f9; }
.sri-spd-windy  { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-spd-storm  { background: rgba(248,113,113,0.18); color: #f87171; }

/* Water — fixed teal */
.sri-water { background: rgba(45,212,191,0.18); color: #2dd4bf; }

/* pH — 3 levels */
.sri-ph-acid     { background: rgba(248,113,113,0.18); color: #f87171; }
.sri-ph-neutral  { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-ph-alkaline { background: rgba(96,165,250,0.18);  color: #60a5fa; }

/* Physical measurements — fixed slate */
.sri-physical { background: rgba(148,163,184,0.18); color: #94a3b8; }
```

- [ ] **Step 2: Verify**

Check that the new classes appear between `.sri-aq-hazard` and `.sensor-text` by reading lines 318–345 of the file.

- [ ] **Step 3: Commit**

```bash
cd C:/Work/Sviluppo/retro-panel
git add retro-panel/app/static/css/tiles.css
git commit -m "feat(css): add 18 Group C sensor sri-* classes (electrical, signal, gas, speed, water, ph, physical)"
```

---

## Task 2: sensor.js — 7 new layout_type branches

**Files:**
- Modify: `retro-panel/app/static/js/components/sensor.js`

- [ ] **Step 1: Extend INITIAL_BUBBLE_CLASS**

In `sensor.js`, find the `INITIAL_BUBBLE_CLASS` object (lines 13–27). Add 7 new keys before the closing `};`:

Replace:
```js
    binary_presence:    'sri-ok',
  };
```

With:
```js
    binary_presence:    'sri-ok',
    sensor_electrical:  'sri-electrical',
    sensor_signal:      'sri-sig-strong',
    sensor_gas:         'sri-gas-safe',
    sensor_speed:       'sri-spd-calm',
    sensor_water:       'sri-water',
    sensor_ph:          'sri-ph-neutral',
    sensor_physical:    'sri-physical',
  };
```

- [ ] **Step 2: Extend ALL_BUBBLE_CLASSES**

Find `ALL_BUBBLE_CLASSES` (lines 30–41). Add the 18 new classes. Replace:
```js
    'sri-aq-good', 'sri-aq-mod', 'sri-aq-bad', 'sri-aq-hazard',
  ];
```

With:
```js
    'sri-aq-good', 'sri-aq-mod', 'sri-aq-bad', 'sri-aq-hazard',
    'sri-electrical',
    'sri-sig-strong', 'sri-sig-good', 'sri-sig-fair', 'sri-sig-weak',
    'sri-gas-safe', 'sri-gas-mod', 'sri-gas-bad', 'sri-gas-critical',
    'sri-spd-calm', 'sri-spd-breezy', 'sri-spd-windy', 'sri-spd-storm',
    'sri-water',
    'sri-ph-acid', 'sri-ph-neutral', 'sri-ph-alkaline',
    'sri-physical',
  ];
```

- [ ] **Step 3: Add 7 branches to updateTile()**

Find the end of the regular-sensor if/else chain in `updateTile()`. The last branch currently ends with:
```js
      } else if (layoutType === 'sensor_air_quality') {
        if      (!isNaN(numVal) && numVal < 50)  { sriClass = 'sri-aq-good'; }
        else if (!isNaN(numVal) && numVal < 100) { sriClass = 'sri-aq-mod'; }
        else if (!isNaN(numVal) && numVal < 200) { sriClass = 'sri-aq-bad'; }
        else if (!isNaN(numVal))                 { sriClass = 'sri-aq-hazard'; }
      }
```

Replace that closing `}` with:
```js
      } else if (layoutType === 'sensor_air_quality') {
        if      (!isNaN(numVal) && numVal < 50)  { sriClass = 'sri-aq-good'; }
        else if (!isNaN(numVal) && numVal < 100) { sriClass = 'sri-aq-mod'; }
        else if (!isNaN(numVal) && numVal < 200) { sriClass = 'sri-aq-bad'; }
        else if (!isNaN(numVal))                 { sriClass = 'sri-aq-hazard'; }

      } else if (layoutType === 'sensor_electrical') {
        sriClass = 'sri-electrical';

      } else if (layoutType === 'sensor_signal') {
        if      (!isNaN(numVal) && numVal > -67) { sriClass = 'sri-sig-strong'; }
        else if (!isNaN(numVal) && numVal > -80) { sriClass = 'sri-sig-good'; }
        else if (!isNaN(numVal) && numVal > -90) { sriClass = 'sri-sig-fair'; }
        else if (!isNaN(numVal))                 { sriClass = 'sri-sig-weak'; }

      } else if (layoutType === 'sensor_gas') {
        if      (!isNaN(numVal) && numVal < 10)  { sriClass = 'sri-gas-safe'; }
        else if (!isNaN(numVal) && numVal < 35)  { sriClass = 'sri-gas-mod'; }
        else if (!isNaN(numVal) && numVal < 100) { sriClass = 'sri-gas-bad'; }
        else if (!isNaN(numVal))                 { sriClass = 'sri-gas-critical'; }

      } else if (layoutType === 'sensor_speed') {
        if      (!isNaN(numVal) && numVal < 15) { sriClass = 'sri-spd-calm'; }
        else if (!isNaN(numVal) && numVal < 30) { sriClass = 'sri-spd-breezy'; }
        else if (!isNaN(numVal) && numVal < 60) { sriClass = 'sri-spd-windy'; }
        else if (!isNaN(numVal))                { sriClass = 'sri-spd-storm'; }

      } else if (layoutType === 'sensor_water') {
        sriClass = 'sri-water';

      } else if (layoutType === 'sensor_ph') {
        if      (!isNaN(numVal) && numVal < 6.5) { sriClass = 'sri-ph-acid'; }
        else if (!isNaN(numVal) && numVal < 7.5) { sriClass = 'sri-ph-neutral'; }
        else if (!isNaN(numVal))                 { sriClass = 'sri-ph-alkaline'; }

      } else if (layoutType === 'sensor_physical') {
        sriClass = 'sri-physical';
      }
```

- [ ] **Step 4: Commit**

```bash
cd C:/Work/Sviluppo/retro-panel
git add retro-panel/app/static/js/components/sensor.js
git commit -m "feat(sensor.js): add 7 Group C layout_type branches to updateTile() + INITIAL/ALL_BUBBLE_CLASSES"
```

---

## Task 3: loader.py — TDD new mappings + _detect_icon extension

**Files:**
- Create: `retro-panel/tests/test_loader_sensor_types_c.py`
- Modify: `retro-panel/app/config/loader.py`

- [ ] **Step 1: Create the failing tests**

Create `retro-panel/tests/test_loader_sensor_types_c.py`:

```python
"""Tests for sensor Group C device_class → layout_type mappings (v2.5.0)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from config.loader import _compute_layout_type, _detect_icon


# --- sensor_electrical ---

def test_voltage_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.v", "voltage", "") == "sensor_electrical"

def test_current_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.a", "current", "") == "sensor_electrical"

def test_apparent_power_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.va", "apparent_power", "") == "sensor_electrical"

def test_reactive_power_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.var", "reactive_power", "") == "sensor_electrical"

def test_power_factor_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.pf", "power_factor", "") == "sensor_electrical"

def test_frequency_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.hz", "frequency", "") == "sensor_electrical"


# --- sensor_signal ---

def test_signal_strength_maps_to_sensor_signal():
    assert _compute_layout_type("sensor.rssi", "signal_strength", "") == "sensor_signal"


# --- sensor_gas ---

def test_carbon_monoxide_maps_to_sensor_gas():
    assert _compute_layout_type("sensor.co", "carbon_monoxide", "") == "sensor_gas"

def test_sulphur_dioxide_maps_to_sensor_gas():
    assert _compute_layout_type("sensor.so2", "sulphur_dioxide", "") == "sensor_gas"

def test_nitrous_oxide_maps_to_sensor_gas():
    assert _compute_layout_type("sensor.no", "nitrous_oxide", "") == "sensor_gas"


# --- sensor_speed ---

def test_speed_maps_to_sensor_speed():
    assert _compute_layout_type("sensor.wind", "speed", "") == "sensor_speed"


# --- sensor_ph ---

def test_ph_maps_to_sensor_ph():
    assert _compute_layout_type("sensor.ph", "ph", "") == "sensor_ph"


# --- sensor_water ---

def test_conductivity_maps_to_sensor_water():
    assert _compute_layout_type("sensor.cond", "conductivity", "") == "sensor_water"

def test_precipitation_maps_to_sensor_water():
    assert _compute_layout_type("sensor.rain", "precipitation", "") == "sensor_water"

def test_precipitation_intensity_maps_to_sensor_water():
    assert _compute_layout_type("sensor.rain2", "precipitation_intensity", "") == "sensor_water"

def test_moisture_maps_to_sensor_water():
    assert _compute_layout_type("sensor.soil", "moisture", "") == "sensor_water"

def test_volume_maps_to_sensor_water():
    assert _compute_layout_type("sensor.water", "volume", "") == "sensor_water"

def test_volume_flow_rate_maps_to_sensor_water():
    assert _compute_layout_type("sensor.flow", "volume_flow_rate", "") == "sensor_water"


# --- sensor_physical ---

def test_weight_maps_to_sensor_physical():
    assert _compute_layout_type("sensor.kg", "weight", "") == "sensor_physical"

def test_distance_maps_to_sensor_physical():
    assert _compute_layout_type("sensor.dist", "distance", "") == "sensor_physical"

def test_volume_storage_maps_to_sensor_physical():
    assert _compute_layout_type("sensor.tank", "volume_storage", "") == "sensor_physical"

def test_duration_maps_to_sensor_physical():
    assert _compute_layout_type("sensor.timer", "duration", "") == "sensor_physical"


# --- override + fallback ---

def test_visual_type_override_wins_over_group_c_mappings():
    assert _compute_layout_type("sensor.x", "voltage", "sensor_generic") == "sensor_generic"
    assert _compute_layout_type("sensor.x", "speed", "sensor_energy") == "sensor_energy"

def test_unknown_device_class_still_falls_back_to_generic():
    assert _compute_layout_type("sensor.x", "totally_unknown_xyz", "") == "sensor_generic"


# --- _detect_icon with device_class ---

def test_detect_icon_uses_device_class_for_conductivity():
    assert _detect_icon("sensor.x", "conductivity") == "water-opacity"

def test_detect_icon_uses_device_class_for_weight():
    assert _detect_icon("sensor.x", "weight") == "weight-kilogram"

def test_detect_icon_falls_back_to_entity_id_when_dc_not_in_map():
    # "temperature" in entity_id → "thermometer" via keyword map
    assert _detect_icon("sensor.indoor_temperature", "") == "thermometer"
```

- [ ] **Step 2: Run tests — confirm they FAIL**

```bash
cd C:/Work/Sviluppo/retro-panel/retro-panel
py -m pytest tests/test_loader_sensor_types_c.py -v
```

Expected: ~25 FAILED (device_class not in _map, _detect_icon doesn't accept 2 args). The override and fallback tests may pass already.

- [ ] **Step 3: Add _DC_ICON_MAP and extend _detect_icon()**

In `loader.py`, after the `_DOMAIN_FALLBACK` dict (line ~84) and before the `_detect_icon` function definition, insert the new dict and replace the function:

Replace:
```python
def _detect_icon(entity_id: str) -> str:
    for prefix, icon in _ICON_MAP:
        if entity_id.startswith(prefix):
            return icon
    lower = entity_id.lower()
    for keyword, icon in _KEYWORD_MAP:
        if keyword in lower:
            return icon
    domain = entity_id.split(".")[0] if "." in entity_id else ""
    return _DOMAIN_FALLBACK.get(domain, "circle")
```

With:
```python
_DC_ICON_MAP: dict[str, str] = {
    "conductivity":            "water-opacity",
    "precipitation":           "weather-rainy",
    "precipitation_intensity": "weather-pouring",
    "moisture":                "water-percent",
    "volume":                  "water-pump",
    "volume_flow_rate":        "pipe",
    "weight":                  "weight-kilogram",
    "distance":                "ruler",
    "duration":                "timer-sand",
    "volume_storage":          "database",
}


def _detect_icon(entity_id: str, device_class: str = "") -> str:
    if device_class and device_class in _DC_ICON_MAP:
        return _DC_ICON_MAP[device_class]
    for prefix, icon in _ICON_MAP:
        if entity_id.startswith(prefix):
            return icon
    lower = entity_id.lower()
    for keyword, icon in _KEYWORD_MAP:
        if keyword in lower:
            return icon
    domain = entity_id.split(".")[0] if "." in entity_id else ""
    return _DOMAIN_FALLBACK.get(domain, "circle")
```

- [ ] **Step 4: Reorder _parse_entity() and update _detect_icon() call**

In `_parse_entity()`, `device_class` is currently parsed AFTER `icon` (line 341), but we now need it earlier. Replace this block inside `_parse_entity()`:

Replace:
```python
    icon = provided_icon if provided_icon else _detect_icon(entity_id)
    label: str = (
        raw.get("label", "").strip()
        or entity_id.replace("_", " ").split(".")[-1].title()
    )
    hidden: bool = bool(raw.get("hidden", False))
    visual_type: str = str(raw.get("visual_type") or "").strip()
    display_mode: str = str(raw.get("display_mode") or "").strip()
    device_class: str = str(raw.get("device_class") or "").strip()
    layout_type: str = _compute_layout_type(entity_id, device_class, visual_type)
```

With:
```python
    device_class: str = str(raw.get("device_class") or "").strip()
    icon = provided_icon if provided_icon else _detect_icon(entity_id, device_class)
    label: str = (
        raw.get("label", "").strip()
        or entity_id.replace("_", " ").split(".")[-1].title()
    )
    hidden: bool = bool(raw.get("hidden", False))
    visual_type: str = str(raw.get("visual_type") or "").strip()
    display_mode: str = str(raw.get("display_mode") or "").strip()
    layout_type: str = _compute_layout_type(entity_id, device_class, visual_type)
```

- [ ] **Step 5: Add 22 new mappings to _compute_layout_type()**

In `_compute_layout_type()`, find the `_map` dict. After the last existing entry (`"ozone": "sensor_air_quality",`), add:

```python
            "voltage":                 "sensor_electrical",
            "current":                 "sensor_electrical",
            "apparent_power":          "sensor_electrical",
            "reactive_power":          "sensor_electrical",
            "power_factor":            "sensor_electrical",
            "frequency":               "sensor_electrical",
            "signal_strength":         "sensor_signal",
            "carbon_monoxide":         "sensor_gas",
            "sulphur_dioxide":         "sensor_gas",
            "nitrous_oxide":           "sensor_gas",
            "speed":                   "sensor_speed",
            "ph":                      "sensor_ph",
            "conductivity":            "sensor_water",
            "precipitation":           "sensor_water",
            "precipitation_intensity": "sensor_water",
            "moisture":                "sensor_water",
            "volume":                  "sensor_water",
            "volume_flow_rate":        "sensor_water",
            "weight":                  "sensor_physical",
            "distance":                "sensor_physical",
            "volume_storage":          "sensor_physical",
            "duration":                "sensor_physical",
```

- [ ] **Step 6: Run new tests — confirm they PASS**

```bash
cd C:/Work/Sviluppo/retro-panel/retro-panel
py -m pytest tests/test_loader_sensor_types_c.py -v
```

Expected: 27 PASSED, 0 failed.

- [ ] **Step 7: Run full test suite — no regressions**

```bash
cd C:/Work/Sviluppo/retro-panel/retro-panel
py -m pytest tests/ -v --ignore=tests/test_handlers_entities.py
```

Expected: all tests PASSED (47 existing + 27 new = 74 total).

- [ ] **Step 8: Commit**

```bash
cd C:/Work/Sviluppo/retro-panel
git add retro-panel/tests/test_loader_sensor_types_c.py retro-panel/app/config/loader.py
git commit -m "feat(loader): Group C — 22 device_class mappings + _DC_ICON_MAP + extend _detect_icon() + 27 tests"
```

---

## Task 4: config.js — Extend sensor visual type picker

**Files:**
- Modify: `retro-panel/app/static/js/config.js`

- [ ] **Step 1: Add 7 entries to VISUAL_OPTIONS.sensor**

In `config.js`, find `VISUAL_OPTIONS.sensor`. After the last entry `{ v: 'sensor_air_quality', l: 'Qualit\u00e0 aria' },`, add:

```js
      { v: 'sensor_electrical', l: 'Elettrico' },
      { v: 'sensor_signal',     l: 'Segnale' },
      { v: 'sensor_gas',        l: 'Gas' },
      { v: 'sensor_speed',      l: 'Velocit\u00e0' },
      { v: 'sensor_water',      l: 'Acqua' },
      { v: 'sensor_ph',         l: 'pH' },
      { v: 'sensor_physical',   l: 'Fisico' },
```

- [ ] **Step 2: Add 7 labels to _getVisualTypeLabel**

In `config.js`, find the `LABELS` object inside `_getVisualTypeLabel`. After `sensor_generic: 'Generico',`, add:

```js
      sensor_electrical: 'Elettrico',
      sensor_signal:     'Segnale',
      sensor_gas:        'Gas',
      sensor_speed:      'Velocit\u00e0',
      sensor_water:      'Acqua',
      sensor_ph:         'pH',
      sensor_physical:   'Fisico',
```

- [ ] **Step 3: Commit**

```bash
cd C:/Work/Sviluppo/retro-panel
git add retro-panel/app/static/js/config.js
git commit -m "feat(config): add Group C sensor types to visual type picker"
```

---

## Task 5: renderer.js + version bump 2.5.0

**Files:**
- Modify: `retro-panel/app/static/js/renderer.js`
- Modify: `retro-panel/retro-panel/config.yaml`
- Modify: `retro-panel/app/static/index.html`
- Modify: `retro-panel/app/static/config.html`

- [ ] **Step 1: Add 7 layout_types to COMPONENT_MAP**

In `renderer.js`, find `COMPONENT_MAP`. After `'sensor_air_quality': null,`, add:

```js
    'sensor_electrical': null,
    'sensor_signal':     null,
    'sensor_gas':        null,
    'sensor_speed':      null,
    'sensor_water':      null,
    'sensor_ph':         null,
    'sensor_physical':   null,
```

- [ ] **Step 2: Add 7 entries to COL_CLASS_MAP**

Find `COL_CLASS_MAP`. After `'sensor_air_quality': 'tile-col-sensor',`, add:

```js
    'sensor_electrical': 'tile-col-sensor',
    'sensor_signal':     'tile-col-sensor',
    'sensor_gas':        'tile-col-sensor',
    'sensor_speed':      'tile-col-sensor',
    'sensor_water':      'tile-col-sensor',
    'sensor_ph':         'tile-col-sensor',
    'sensor_physical':   'tile-col-sensor',
```

- [ ] **Step 3: Add 7 lines to _initComponents()**

Find `_initComponents()`. After `COMPONENT_MAP['sensor_air_quality'] = window.SensorComponent || null;`, add:

```js
    COMPONENT_MAP['sensor_electrical'] = window.SensorComponent || null;
    COMPONENT_MAP['sensor_signal']     = window.SensorComponent || null;
    COMPONENT_MAP['sensor_gas']        = window.SensorComponent || null;
    COMPONENT_MAP['sensor_speed']      = window.SensorComponent || null;
    COMPONENT_MAP['sensor_water']      = window.SensorComponent || null;
    COMPONENT_MAP['sensor_ph']         = window.SensorComponent || null;
    COMPONENT_MAP['sensor_physical']   = window.SensorComponent || null;
```

- [ ] **Step 4: Bump version in config.yaml**

In `retro-panel/config.yaml`, change:

```yaml
version: "2.4.0"
```

To:

```yaml
version: "2.5.0"
```

- [ ] **Step 5: Update cache-buster**

```bash
sed -i 's/?v=240/?v=250/g' C:/Work/Sviluppo/retro-panel/retro-panel/app/static/index.html C:/Work/Sviluppo/retro-panel/retro-panel/app/static/config.html
```

Verify:
```bash
grep -c "?v=250" C:/Work/Sviluppo/retro-panel/retro-panel/app/static/index.html
```

Expected: 16 (same count as before, all updated).

- [ ] **Step 6: Run release check**

```bash
cd C:/Work/Sviluppo/retro-panel
bash scripts/check_release.sh --verbose
```

Expected: all ✓, version 2.5.0, cache-buster `?v=250`. Exit 0.

- [ ] **Step 7: Commit**

```bash
cd C:/Work/Sviluppo/retro-panel
git add retro-panel/app/static/js/renderer.js retro-panel/config.yaml \
        retro-panel/app/static/index.html retro-panel/app/static/config.html
git commit -m "feat(renderer): register 7 Group C sensor layout_types + bump v2.5.0"
```

---

## Final: Full test suite

- [ ] **Run all Python tests**

```bash
cd C:/Work/Sviluppo/retro-panel/retro-panel
py -m pytest tests/ -v --ignore=tests/test_handlers_entities.py
```

Expected: 74 passed, 0 failed.
