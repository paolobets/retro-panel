# Binary Sensor Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix architectural bugs in binary sensor classification (loader.py) and rendering (sensor.js), and add four new layout_types: binary_smoke, binary_moisture, binary_lock, binary_vibration.

**Architecture:** `loader.py` becomes the single source of truth for layout_type — `_compute_layout_type()` binary_sensor branch is rewritten to produce the correct type from `device_class`. `sensor.js` `updateTile()` binary block is refactored to read only `tile.dataset.layoutType` with no `device_class` access. config.js and renderer.js register the four new types.

**Tech Stack:** Python 3.11 (pytest for TDD), Vanilla JS ES2017 IIFE pattern (`var` only, iOS 12+ safe), aiohttp

---

## File Map

| File | Change |
|---|---|
| `retro-panel/tests/test_loader_binary_improvements.py` | Create — 15 TDD tests for binary_sensor mappings |
| `retro-panel/app/config/loader.py` | Modify lines 351-357 — rewrite binary_sensor branch |
| `retro-panel/app/static/js/components/sensor.js` | Modify lines 13-34 (INITIAL_BUBBLE_CLASS) + lines 142-172 (updateTile binary block) |
| `retro-panel/app/static/js/config.js` | Modify lines 96-102 (VISUAL_OPTIONS) + lines 128-132 (_getVisualTypeLabel) |
| `retro-panel/app/static/js/renderer.js` | Modify lines 22-52 (COMPONENT_MAP) + lines 55-85 (COL_CLASS_MAP) + lines 87-117 (_initComponents) |
| `retro-panel/config.yaml` | Modify line 2 — version bump to 2.6.0 |
| `retro-panel/app/static/index.html` | Modify 20 occurrences of `?v=250` → `?v=260` |
| `retro-panel/app/static/config.html` | Modify 5 occurrences of `?v=250` → `?v=260` |

---

## Task 1: loader.py — TDD: fix and extend binary_sensor mappings

**Files:**
- Create: `retro-panel/tests/test_loader_binary_improvements.py`
- Modify: `retro-panel/app/config/loader.py` lines 351-357

**Context:** `_compute_layout_type(entity_id, device_class, visual_type)` is a module-level function in `app/config/loader.py`. Current binary_sensor branch (lines 351-357):
```python
if domain == "binary_sensor":
    dc = (device_class or "").lower()
    if dc in ("door", "window"):
        return "binary_door"
    if dc in ("motion", "occupancy"):
        return "binary_motion"
    return "binary_standard"
```

- [ ] **Step 1: Create the test file with all 15 failing tests**

```python
"""Tests for binary_sensor device_class → layout_type mappings (v2.6.0).

Covers: bug fixes (window, occupancy, presence, smoke/gas/CO)
        and new types (binary_moisture, binary_lock, binary_vibration).
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from config.loader import _compute_layout_type


# --- Regressions: types that must still work ---

def test_door_maps_to_binary_door():
    assert _compute_layout_type("binary_sensor.door", "door", "") == "binary_door"

def test_motion_maps_to_binary_motion():
    assert _compute_layout_type("binary_sensor.pir", "motion", "") == "binary_motion"

def test_unknown_dc_maps_to_binary_standard():
    assert _compute_layout_type("binary_sensor.generic", "connectivity", "") == "binary_standard"

def test_empty_dc_maps_to_binary_standard():
    assert _compute_layout_type("binary_sensor.x", "", "") == "binary_standard"


# --- Bug fixes ---

def test_window_maps_to_binary_window():
    assert _compute_layout_type("binary_sensor.window", "window", "") == "binary_window"

def test_occupancy_maps_to_binary_presence():
    assert _compute_layout_type("binary_sensor.occupancy", "occupancy", "") == "binary_presence"

def test_presence_maps_to_binary_presence():
    assert _compute_layout_type("binary_sensor.presence", "presence", "") == "binary_presence"

def test_smoke_maps_to_binary_smoke():
    assert _compute_layout_type("binary_sensor.smoke", "smoke", "") == "binary_smoke"

def test_gas_maps_to_binary_smoke():
    assert _compute_layout_type("binary_sensor.gas", "gas", "") == "binary_smoke"

def test_carbon_monoxide_maps_to_binary_smoke():
    assert _compute_layout_type("binary_sensor.co", "carbon_monoxide", "") == "binary_smoke"


# --- New types ---

def test_moisture_maps_to_binary_moisture():
    assert _compute_layout_type("binary_sensor.leak", "moisture", "") == "binary_moisture"

def test_wet_maps_to_binary_moisture():
    assert _compute_layout_type("binary_sensor.wet", "wet", "") == "binary_moisture"

def test_lock_maps_to_binary_lock():
    assert _compute_layout_type("binary_sensor.lock", "lock", "") == "binary_lock"

def test_vibration_maps_to_binary_vibration():
    assert _compute_layout_type("binary_sensor.vib", "vibration", "") == "binary_vibration"

def test_tamper_maps_to_binary_vibration():
    assert _compute_layout_type("binary_sensor.tamper", "tamper", "") == "binary_vibration"
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd retro-panel && python -m pytest tests/test_loader_binary_improvements.py -v 2>&1 | tail -25
```

Expected: multiple FAILED — window/occupancy/presence/smoke/gas/CO/moisture/lock/vibration/tamper tests fail. Regressions (door, motion, unknown, empty) should PASS.

- [ ] **Step 3: Replace the binary_sensor branch in loader.py (lines 351-357)**

Find and replace this exact block:
```python
    if domain == "binary_sensor":
        dc = (device_class or "").lower()
        if dc in ("door", "window"):
            return "binary_door"
        if dc in ("motion", "occupancy"):
            return "binary_motion"
        return "binary_standard"
```

With:
```python
    if domain == "binary_sensor":
        dc = (device_class or "").lower()
        if dc == "door":                              return "binary_door"
        if dc == "window":                            return "binary_window"
        if dc == "motion":                            return "binary_motion"
        if dc in ("occupancy", "presence"):           return "binary_presence"
        if dc in ("smoke", "gas", "carbon_monoxide"): return "binary_smoke"
        if dc in ("moisture", "wet"):                 return "binary_moisture"
        if dc == "lock":                              return "binary_lock"
        if dc in ("vibration", "tamper"):             return "binary_vibration"
        return "binary_standard"
```

- [ ] **Step 4: Run tests — verify all 15 pass**

```bash
cd retro-panel && python -m pytest tests/test_loader_binary_improvements.py -v 2>&1 | tail -20
```

Expected: 15 passed.

- [ ] **Step 5: Run full test suite — verify no regressions**

```bash
cd retro-panel && python -m pytest tests/ -v 2>&1 | tail -20
```

Expected: all tests pass (including existing loader, sensor_types, sensor_types_c tests).

- [ ] **Step 6: Commit**

```bash
cd retro-panel && git add tests/test_loader_binary_improvements.py app/config/loader.py && git commit -m "feat: fix and extend binary_sensor layout_type mappings (v2.6.0)

- window → binary_window (was binary_door)
- occupancy, presence → binary_presence (was binary_motion / unmapped)
- smoke, gas, carbon_monoxide → binary_smoke (was binary_standard)
- new: moisture, wet → binary_moisture
- new: lock → binary_lock
- new: vibration, tamper → binary_vibration

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: sensor.js — INITIAL_BUBBLE_CLASS + updateTile() refactor

**Files:**
- Modify: `retro-panel/app/static/js/components/sensor.js`
  - Lines 13-34: add 6 entries to INITIAL_BUBBLE_CLASS
  - Lines 142-172: replace binary block

**Context:** The IIFE uses `var` only (no const/let). INITIAL_BUBBLE_CLASS is an object literal at module top. The binary block in updateTile() currently has hardcoded `deviceClass` checks (lines 156-161) that must be replaced with `layoutType` checks.

- [ ] **Step 1: Add 5 entries to INITIAL_BUBBLE_CLASS**

The current object ends at line 34 with `sensor_physical: 'sri-physical',`. The 4 existing binary entries are at lines 23-26 (`binary_door`, `binary_motion`, `binary_standard`, `binary_presence`). Add 5 new entries after `binary_presence: 'sri-ok',` (line 26):

```js
    binary_window:    'sri-ok',
    binary_smoke:     'sri-ok',
    binary_moisture:  'sri-ok',
    binary_lock:      'sri-ok',
    binary_vibration: 'sri-ok',
```

The INITIAL_BUBBLE_CLASS block should look like this after the change (lines 13-35):
```js
  var INITIAL_BUBBLE_CLASS = {
    sensor_temperature: 'sri-temp-comfort',
    sensor_humidity:    'sri-hum-ideal',
    sensor_co2:         'sri-co2-good',
    sensor_battery:     'sri-bat-full',
    sensor_energy:      'sri-energy',
    sensor_illuminance: 'sri-lux-normal',
    sensor_pressure:    'sri-pressure',
    sensor_air_quality: 'sri-aq-good',
    sensor_generic:     'sri-ok',
    binary_door:        'sri-ok',
    binary_motion:      'sri-ok',
    binary_standard:    'sri-ok',
    binary_presence:   'sri-ok',
    binary_window:     'sri-ok',
    binary_smoke:      'sri-ok',
    binary_moisture:   'sri-ok',
    binary_lock:       'sri-ok',
    binary_vibration:  'sri-ok',
    sensor_electrical:  'sri-electrical',
    sensor_signal:      'sri-sig-strong',
    sensor_gas:         'sri-gas-safe',
    sensor_speed:       'sri-spd-calm',
    sensor_water:       'sri-water',
    sensor_ph:          'sri-ph-neutral',
    sensor_physical:    'sri-physical',
  };
```

- [ ] **Step 2: Replace the binary block in updateTile()**

Find this exact block (lines 152-169):
```js
      if (state === 'on') {
        if (layoutType === 'binary_door' || layoutType === 'binary_motion') {
          tile.classList.add('srt-alert');
          if (bubble) { bubble.classList.add('sri-alert'); }
        } else if (deviceClass === 'smoke' || deviceClass === 'gas' || deviceClass === 'carbon_monoxide') {
          tile.classList.add('srt-critical');
          if (bubble) { bubble.classList.add('sri-critical'); }
        } else if (deviceClass === 'occupancy' || deviceClass === 'presence') {
          tile.classList.add('srt-presence');
          if (bubble) { bubble.classList.add('sri-presence'); }
        } else {
          if (bubble) { bubble.classList.add('sri-ok'); }
        }
        tile.classList.add('is-on');
      } else {
        tile.classList.add('is-off');
        if (bubble) { bubble.classList.add('sri-ok'); }
      }
```

Replace with:
```js
      if (state === 'on') {
        if (layoutType === 'binary_smoke') {
          tile.classList.add('srt-critical');
          if (bubble) { bubble.classList.add('sri-critical'); }
        } else if (layoutType === 'binary_presence') {
          tile.classList.add('srt-presence');
          if (bubble) { bubble.classList.add('sri-presence'); }
        } else {
          // binary_door, binary_window, binary_motion,
          // binary_moisture, binary_lock, binary_vibration, binary_standard
          tile.classList.add('srt-alert');
          if (bubble) { bubble.classList.add('sri-alert'); }
        }
        tile.classList.add('is-on');
      } else {
        tile.classList.add('is-off');
        if (bubble) { bubble.classList.add('sri-ok'); }
      }
```

Also remove the `var deviceClass = attrs.device_class || '';` line (line 143) — it is no longer used in the binary block. The `getBinarySensorLabel` call on line 146 passes `attrs.device_class || ''` directly.

The full updated binary block (lines 140-172) should look like:
```js
    // -----------------------------------------------------------------
    // Binary sensors
    // -----------------------------------------------------------------
    if (layoutType.indexOf('binary_') === 0) {

      if (valueEl) {
        valueEl.textContent = window.RP_FMT.getBinarySensorLabel(state, attrs.device_class || '');
      }

      clearBinaryTileStateClasses(tile);
      if (bubble) { clearBubbleClasses(bubble); }

      if (state === 'on') {
        if (layoutType === 'binary_smoke') {
          tile.classList.add('srt-critical');
          if (bubble) { bubble.classList.add('sri-critical'); }
        } else if (layoutType === 'binary_presence') {
          tile.classList.add('srt-presence');
          if (bubble) { bubble.classList.add('sri-presence'); }
        } else {
          // binary_door, binary_window, binary_motion,
          // binary_moisture, binary_lock, binary_vibration, binary_standard
          tile.classList.add('srt-alert');
          if (bubble) { bubble.classList.add('sri-alert'); }
        }
        tile.classList.add('is-on');
      } else {
        tile.classList.add('is-off');
        if (bubble) { bubble.classList.add('sri-ok'); }
      }

      return;
    }
```

- [ ] **Step 3: Verify no syntax errors**

```bash
node --check "C:/Work/Sviluppo/retro-panel/retro-panel/app/static/js/components/sensor.js" && echo "OK"
```

Expected: `OK` with no errors.

- [ ] **Step 4: Commit**

```bash
cd retro-panel && git add app/static/js/components/sensor.js && git commit -m "feat: refactor sensor.js binary block to layout_type-driven logic

- Add binary_window/smoke/moisture/lock/vibration to INITIAL_BUBBLE_CLASS
- Remove hardcoded device_class checks from updateTile() binary block
- All visual state now driven by tile.dataset.layoutType

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: config.js + renderer.js + version bump 2.6.0

**Files:**
- Modify: `retro-panel/app/static/js/config.js` lines 96-102 and 128-132
- Modify: `retro-panel/app/static/js/renderer.js` lines 22-52, 55-85, 87-117
- Modify: `retro-panel/config.yaml` line 2
- Modify: `retro-panel/app/static/index.html` (20 occurrences of `?v=250`)
- Modify: `retro-panel/app/static/config.html` (5 occurrences of `?v=250`)

**Context:** config.js VISUAL_OPTIONS.binary_sensor already has binary_window and binary_presence (lines 96-102). `_getVisualTypeLabel` already has those two. renderer.js already has binary_window and binary_presence in all three maps. Only the 4 new types need adding: binary_smoke, binary_moisture, binary_lock, binary_vibration.

- [ ] **Step 1: Add 4 new entries to config.js VISUAL_OPTIONS**

Find this block (lines 96-102):
```js
    binary_sensor: [
      { v: 'binary_door',      l: 'Porta' },
      { v: 'binary_window',    l: 'Finestra' },
      { v: 'binary_motion',    l: 'Movimento' },
      { v: 'binary_presence',  l: 'Presenza' },
      { v: 'binary_standard',  l: 'Standard' },
    ],
```

Replace with:
```js
    binary_sensor: [
      { v: 'binary_door',      l: 'Porta' },
      { v: 'binary_window',    l: 'Finestra' },
      { v: 'binary_motion',    l: 'Movimento' },
      { v: 'binary_presence',  l: 'Presenza' },
      { v: 'binary_smoke',     l: 'Fumo/Gas' },
      { v: 'binary_moisture',  l: 'Umidità/Perdita' },
      { v: 'binary_lock',      l: 'Serratura' },
      { v: 'binary_vibration', l: 'Vibrazione' },
      { v: 'binary_standard',  l: 'Standard' },
    ],
```

- [ ] **Step 2: Add 4 new entries to _getVisualTypeLabel in config.js**

Find this block (lines 128-133):
```js
      binary_door:        'Porta',
      binary_window:      'Finestra',
      binary_motion:      'Movimento',
      binary_presence:    'Presenza',
      binary_standard:    'Standard',
```

Replace with:
```js
      binary_door:        'Porta',
      binary_window:      'Finestra',
      binary_motion:      'Movimento',
      binary_presence:    'Presenza',
      binary_smoke:       'Fumo/Gas',
      binary_moisture:    'Umidità/Perdita',
      binary_lock:        'Serratura',
      binary_vibration:   'Vibrazione',
      binary_standard:    'Standard',
```

- [ ] **Step 3: Add 4 new entries to COMPONENT_MAP in renderer.js**

Find this block (lines 44-48):
```js
    'binary_door':        null,
    'binary_motion':      null,
    'binary_standard':    null,
    'binary_presence':    null,
    'alarm':              null,
```

Replace with:
```js
    'binary_door':        null,
    'binary_window':      null,
    'binary_motion':      null,
    'binary_standard':    null,
    'binary_presence':    null,
    'binary_smoke':       null,
    'binary_moisture':    null,
    'binary_lock':        null,
    'binary_vibration':   null,
    'alarm':              null,
```

binary_window is not yet in COMPONENT_MAP — add it along with the 4 new types.

- [ ] **Step 4: Add 4 new entries to COL_CLASS_MAP in renderer.js**

Find this block (lines 77-81):
```js
    'binary_door':        'tile-col-sensor',
    'binary_motion':      'tile-col-sensor',
    'binary_standard':    'tile-col-sensor',
    'binary_presence':    'tile-col-sensor',
    'alarm':              'tile-col-full',
```

Replace with:
```js
    'binary_door':        'tile-col-sensor',
    'binary_window':      'tile-col-sensor',
    'binary_motion':      'tile-col-sensor',
    'binary_standard':    'tile-col-sensor',
    'binary_presence':    'tile-col-sensor',
    'binary_smoke':       'tile-col-sensor',
    'binary_moisture':    'tile-col-sensor',
    'binary_lock':        'tile-col-sensor',
    'binary_vibration':   'tile-col-sensor',
    'alarm':              'tile-col-full',
```

binary_window is not yet in COL_CLASS_MAP — add it along with the 4 new types.

- [ ] **Step 5: Add 4 new entries to _initComponents() in renderer.js**

Find this block (lines 109-113):
```js
    COMPONENT_MAP['binary_door']        = window.SensorComponent   || null;
    COMPONENT_MAP['binary_motion']      = window.SensorComponent   || null;
    COMPONENT_MAP['binary_standard']    = window.SensorComponent   || null;
    COMPONENT_MAP['binary_presence']    = window.SensorComponent   || null;
    COMPONENT_MAP['alarm']              = window.AlarmComponent    || null;
```

Replace with:
```js
    COMPONENT_MAP['binary_door']        = window.SensorComponent   || null;
    COMPONENT_MAP['binary_window']      = window.SensorComponent   || null;
    COMPONENT_MAP['binary_motion']      = window.SensorComponent   || null;
    COMPONENT_MAP['binary_standard']    = window.SensorComponent   || null;
    COMPONENT_MAP['binary_presence']    = window.SensorComponent   || null;
    COMPONENT_MAP['binary_smoke']       = window.SensorComponent   || null;
    COMPONENT_MAP['binary_moisture']    = window.SensorComponent   || null;
    COMPONENT_MAP['binary_lock']        = window.SensorComponent   || null;
    COMPONENT_MAP['binary_vibration']   = window.SensorComponent   || null;
    COMPONENT_MAP['alarm']              = window.AlarmComponent    || null;
```

binary_window is not yet in _initComponents() — add it along with the 4 new types.

- [ ] **Step 6: Verify renderer.js and config.js have no syntax errors**

```bash
node --check "C:/Work/Sviluppo/retro-panel/retro-panel/app/static/js/renderer.js" && echo "renderer OK" && node --check "C:/Work/Sviluppo/retro-panel/retro-panel/app/static/js/config.js" && echo "config OK"
```

Expected: `renderer OK` and `config OK`.

- [ ] **Step 7: Bump version in config.yaml**

Find:
```yaml
version: "2.5.0"
```

Replace with:
```yaml
version: "2.6.0"
```

- [ ] **Step 8: Update cache-buster in index.html (20 occurrences)**

Replace all `?v=250` with `?v=260` in `retro-panel/app/static/index.html`.

Verify the count after:
```bash
grep -c "v=260" "C:/Work/Sviluppo/retro-panel/retro-panel/app/static/index.html"
```

Expected: `20`

- [ ] **Step 9: Update cache-buster in config.html (5 occurrences)**

Replace all `?v=250` with `?v=260` in `retro-panel/app/static/config.html`.

Verify the count after:
```bash
grep -c "v=260" "C:/Work/Sviluppo/retro-panel/retro-panel/app/static/config.html"
```

Expected: `5`

- [ ] **Step 10: Run full test suite one final time**

```bash
cd retro-panel && python -m pytest tests/ -v 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
cd retro-panel && git add app/static/js/config.js app/static/js/renderer.js config.yaml app/static/index.html app/static/config.html && git commit -m "feat: register binary_smoke/moisture/lock/vibration + bump v2.6.0

- config.js: 4 new entries in VISUAL_OPTIONS and _getVisualTypeLabel
- renderer.js: 4 new entries in COMPONENT_MAP, COL_CLASS_MAP, _initComponents
- version: 2.5.0 → 2.6.0, cache-buster ?v=250 → ?v=260

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
