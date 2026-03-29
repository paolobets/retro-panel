# Binary Sensor Improvements — Design Spec (v2.6.0)

## Overview

Fix architectural bugs in the binary sensor subsystem and add four new layout_types. The current implementation has a split-responsibility anti-pattern: `loader.py` classifies entities into layout_types but gets some mappings wrong, while `sensor.js` re-reads `attrs.device_class` at render time to compensate — creating two divergent sources of truth.

**Goal:** `loader.py` is the single source of truth for layout_type. `sensor.js` reads only `tile.dataset.layoutType` — no `device_class` access in the binary render path.

---

## Bugs Fixed

| Bug | Current | Correct |
|-----|---------|---------|
| window mapped to wrong type | `binary_door` | `binary_window` |
| occupancy mapped to wrong type | `binary_motion` | `binary_presence` |
| presence not mapped | `binary_standard` | `binary_presence` |
| smoke/gas/CO mapped to wrong type | `binary_standard` | `binary_smoke` |
| sensor.js checks `device_class` for smoke/CO | hardcoded device_class check | layout_type check |
| sensor.js checks `device_class` for occupancy/presence | hardcoded device_class check | layout_type check |

---

## New Layout Types

| layout_type | device_classes | Visual on `on` |
|---|---|---|
| `binary_smoke` | smoke, gas, carbon_monoxide | srt-critical + sri-critical |
| `binary_moisture` | moisture, wet | srt-alert + sri-alert |
| `binary_lock` | lock | srt-alert + sri-alert |
| `binary_vibration` | vibration, tamper | srt-alert + sri-alert |

---

## Architecture

### Single Source of Truth

`_compute_layout_type()` in `loader.py` is the only place that maps `device_class → layout_type`. `sensor.js` trusts `tile.dataset.layoutType` and never re-reads `attrs.device_class` for visual decisions (the label function `getBinarySensorLabel` may still use `device_class` from live HA state — that is acceptable and unchanged).

### Visual States

Binary sensor tiles have three "on" states and one "off" state:

| State | Tile class | Bubble class | Usage |
|---|---|---|---|
| Critical | srt-critical | sri-critical | binary_smoke |
| Presence | srt-presence | sri-presence | binary_presence |
| Alert | srt-alert | sri-alert | all other types when on |
| Off | is-off | sri-ok | all types when off |

No new CSS classes are required — all `srt-*` and `sri-*` binary classes already exist.

---

## File Changes

### 1. `retro-panel/app/config/loader.py`

`_compute_layout_type()` — replace the `binary_sensor` branch:

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

### 2. `retro-panel/app/static/js/components/sensor.js`

**INITIAL_BUBBLE_CLASS** — add 6 new entries:

```js
binary_window:    'sri-ok',
binary_presence:  'sri-ok',
binary_smoke:     'sri-ok',
binary_moisture:  'sri-ok',
binary_lock:      'sri-ok',
binary_vibration: 'sri-ok',
```

**updateTile() binary block** — replace the current `if (state === 'on')` branch (which checks `device_class`) with layout_type-driven logic:

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

### 3. `retro-panel/app/static/js/config.js`

Add 4 entries to `VISUAL_OPTIONS.binary_sensor` (after `binary_standard`):

```js
{ v: 'binary_smoke',     l: 'Fumo/Gas' },
{ v: 'binary_moisture',  l: 'Umidità/Perdita' },
{ v: 'binary_lock',      l: 'Serratura' },
{ v: 'binary_vibration', l: 'Vibrazione' },
```

Add 4 entries to `_getVisualTypeLabel`:

```js
'binary_smoke':     'Fumo/Gas',
'binary_moisture':  'Umidità/Perdita',
'binary_lock':      'Serratura',
'binary_vibration': 'Vibrazione',
```

### 4. `retro-panel/app/static/js/renderer.js`

Add `binary_smoke`, `binary_moisture`, `binary_lock`, `binary_vibration` to:
- `COMPONENT_MAP` → `SensorComponent`
- `COL_CLASS_MAP` → `'col-sensor'`
- `_initComponents()` subscriptions

### 5. Version bump

- `retro-panel/config.yaml`: `version: "2.6.0"`
- `retro-panel/app/static/index.html`: all `?v=250` → `?v=260`
- `retro-panel/app/static/config.html`: all `?v=250` → `?v=260`

---

## Testing

### loader.py — `tests/test_loader_binary_improvements.py`

One test per mapping (new + fixed), covering:

| Test | device_class | expected layout_type |
|---|---|---|
| door (regression) | door | binary_door |
| window fix | window | binary_window |
| motion (regression) | motion | binary_motion |
| occupancy fix | occupancy | binary_presence |
| presence new | presence | binary_presence |
| smoke new | smoke | binary_smoke |
| gas new | gas | binary_smoke |
| carbon_monoxide new | carbon_monoxide | binary_smoke |
| moisture new | moisture | binary_moisture |
| wet new | wet | binary_moisture |
| lock new | lock | binary_lock |
| vibration new | vibration | binary_vibration |
| tamper new | tamper | binary_vibration |
| unknown fallback (regression) | connectivity | binary_standard |
| no device_class fallback | (empty) | binary_standard |

No new tests required for sensor.js, config.js, or renderer.js — these are pure registration changes with no branching logic.

---

## Out of Scope

- Labels returned by `getBinarySensorLabel()` — already device_class driven from live HA attributes, correct behavior, unchanged
- Binary sensor icons — set at `createTile()` from `entityConfig.icon` via `_detect_icon()`, unchanged
- New CSS classes — not needed, all required `srt-*`/`sri-*` classes exist
