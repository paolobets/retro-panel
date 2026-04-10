# FIX: Visual Type Reset + Alarm Sensors Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Allow users to reset visual_type to "Default (automatico)" in the config picker, and (2) render alarm zone sensors as standard binary_sensor tiles instead of the custom AlarmSensorComponent.

**Architecture:** FIX 1 adds a `{ v: '', l: 'Default (automatico)' }` option to each VISUAL_OPTIONS list in config.js. FIX 2 changes the backend (panel_config.py) to emit `layout_type` for alarm sensors via `_compute_layout_type`, and the frontend (renderer.js) to render them using `_renderItem` (same as all other entities) instead of the dedicated AlarmSensorComponent.

**Tech Stack:** Python (aiohttp backend), Vanilla JS ES5 (iOS 12 safe frontend)

---

### Task 1: FIX 1 — Add "Default (automatico)" option to visual type picker

**Files:**
- Modify: `retro-panel/app/static/js/config.js:100-134` (VISUAL_OPTIONS)
- Modify: `retro-panel/app/static/js/config.js:136-168` (_getVisualTypeLabel)

- [ ] **Step 1: Add default option to each VISUAL_OPTIONS list**

In `config.js`, prepend `{ v: '', l: 'Default (automatico)' }` as the first element of each array in VISUAL_OPTIONS:

```javascript
var VISUAL_OPTIONS = {
  sensor: [
    { v: '', l: 'Default (automatico)' },
    { v: 'sensor_temperature', l: 'Temperatura' },
    // ... rest unchanged
  ],
  binary_sensor: [
    { v: '', l: 'Default (automatico)' },
    { v: 'binary_door',      l: 'Porta' },
    // ... rest unchanged
  ],
  light: [
    { v: '', l: 'Default (automatico)' },
    { v: 'light_standard', l: 'Luce standard' },
    // ... rest unchanged
  ],
};
```

- [ ] **Step 2: Update _getVisualTypeLabel to show "Default" for empty visual_type**

In `config.js`, change the fallback in `_getVisualTypeLabel`:

```javascript
// Before:
return LABELS[vt] || 'Tipo visivo';

// After:
if (!vt) { return 'Default (automatico)'; }
return LABELS[vt] || 'Tipo visivo';
```

- [ ] **Step 3: Verify picker highlights "Default" when visual_type is empty**

The existing picker code at line 190 already checks `opt.v === currentVt`. When `currentVt` is `''` and `opt.v` is `''`, the match works correctly — no change needed.

- [ ] **Step 4: Commit FIX 1**

```bash
git add retro-panel/app/static/js/config.js
git commit -m "fix(config): add 'Default (automatico)' option to visual type picker

Allows resetting visual_type to empty, restoring device_class-based
layout inference instead of being locked to a manual choice."
```

---

### Task 2: FIX 2 — Backend: emit layout_type for alarm sensors

**Files:**
- Modify: `retro-panel/app/api/panel_config.py:141-155` (alarm serialization)
- Reference: `retro-panel/app/config/loader.py:384-469` (_compute_layout_type)

- [ ] **Step 1: Add layout_type to alarm sensor serialization**

In `panel_config.py`, change the alarm sensors serialization to include `layout_type` computed from `_compute_layout_type`. Import the function and add the field:

At the top of `panel_config.py`, add import (if not already present):
```python
from app.config.loader import _compute_layout_type
```

Change the alarm sensor dict (lines ~145-150) from:
```python
"sensors": [
    {
        "entity_id": s.entity_id,
        "label": s.label,
        "device_class": s.device_class,
    }
    for s in a.sensors
],
```

To:
```python
"sensors": [
    {
        "entity_id": s.entity_id,
        "label": s.label,
        "device_class": s.device_class,
        "layout_type": _compute_layout_type(s.entity_id, s.device_class, ""),
    }
    for s in a.sensors
],
```

- [ ] **Step 2: Run existing tests to verify no breakage**

```bash
cd C:\Work\Sviluppo\retro-panel
py -m pytest retro-panel/tests/ -q
```

Expected: all 145 tests pass.

- [ ] **Step 3: Commit FIX 2 backend**

```bash
git add retro-panel/app/api/panel_config.py
git commit -m "fix(api): emit layout_type for alarm zone sensors

Uses _compute_layout_type with device_class so frontend can render
alarm sensors as standard binary_sensor tiles."
```

---

### Task 3: FIX 2 — Frontend: render alarm sensors as standard tiles

**Files:**
- Modify: `retro-panel/app/static/js/renderer.js:548-571` (_renderAlarmItems sensor grid)

- [ ] **Step 1: Replace AlarmSensorComponent rendering with _renderItem**

In `renderer.js`, replace the sensor grid block (lines 548-571) in `_renderAlarmItems`. Instead of using `COMPONENT_MAP['alarm_sensor']` and a custom `alarm-sensor-grid` div, render each sensor as a standard item using `_renderItem` inside a standard `tile-row`:

Replace this block:
```javascript
// Sensor zone grid (if any)
var sensors = alarmCfg.sensors || [];
if (sensors.length > 0) {
  var sensorComp = COMPONENT_MAP['alarm_sensor'];
  if (sensorComp) {
    var sensorGrid = DOM.createElement('div', 'alarm-sensor-grid');
    for (var j = 0; j < sensors.length; j++) {
      var sensorCfg = sensors[j];
      if (!sensorCfg || !sensorCfg.entity_id) { continue; }
      try {
        var sensorTile = sensorComp.createTile(sensorCfg);
        sensorGrid.appendChild(sensorTile);
        appState.tileMap[sensorCfg.entity_id] = sensorTile;
        var sensorState = appState.states[sensorCfg.entity_id];
        if (sensorState) {
          try { sensorComp.updateTile(sensorTile, sensorState); } catch (ue) { }
        }
      } catch (serr) {
        console.error('[renderer] alarm sensor tile failed:', sensorCfg.entity_id, serr);
      }
    }
    container.appendChild(sensorGrid);
  }
}
```

With:
```javascript
// Sensor zone tiles — rendered as standard binary_sensor items
var sensors = alarmCfg.sensors || [];
if (sensors.length > 0) {
  var sensorRow = DOM.createElement('div', 'tile-row');
  for (var j = 0; j < sensors.length; j++) {
    var sensorCfg = sensors[j];
    if (!sensorCfg || !sensorCfg.entity_id) { continue; }
    // Build a standard item object so _renderItem can handle it
    var sensorItem = {
      type: 'entity',
      entity_id: sensorCfg.entity_id,
      label: sensorCfg.label || '',
      layout_type: sensorCfg.layout_type || 'binary_standard',
      icon: '',
      visual_type: '',
      display_mode: 'auto'
    };
    var tile = _renderItem(sensorItem, sensorRow, appState);
    if (tile) {
      appState.tileMap[sensorCfg.entity_id] = tile;
    }
  }
  container.appendChild(sensorRow);
}
```

- [ ] **Step 2: Run tests**

```bash
cd C:\Work\Sviluppo\retro-panel
py -m pytest retro-panel/tests/ -q
```

Expected: all 145 tests pass.

- [ ] **Step 3: Commit FIX 2 frontend**

```bash
git add retro-panel/app/static/js/renderer.js
git commit -m "fix(renderer): alarm sensors rendered as standard binary tiles

Alarm zone sensors now go through _renderItem with layout_type from
backend, matching the look and behavior of binary_sensor tiles
everywhere else in the dashboard."
```

---

### Task 4: Version bump and release

**Files:**
- Modify: `retro-panel/config.yaml` (version)
- Modify: `retro-panel/app/static/index.html` (cache-buster)
- Modify: `retro-panel/app/static/config.html` (cache-buster)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump version to 2.12.0 in config.yaml**

```yaml
version: "2.12.0"
```

- [ ] **Step 2: Update cache-buster to ?v=2120 in index.html and config.html**

Find all `?v=2111` and replace with `?v=2120` in both files.

- [ ] **Step 3: Update CHANGELOG.md**

Prepend:
```markdown
## [2.12.0] — 2026-04-10

### Fixed
- **Visual type reset:** aggiunta opzione "Default (automatico)" nel picker visual type
  per sensori, binary sensor e luci — permette di tornare all'inferenza automatica da device_class
- **Alarm sensors layout:** i sensori zona dell'allarme vengono ora renderizzati come
  standard binary sensor tiles (stessi componenti, stesse dimensioni, stesso stile del resto
  della dashboard) invece del componente compatto dedicato

---
```

- [ ] **Step 4: Commit release**

```bash
git add retro-panel/config.yaml retro-panel/app/static/index.html retro-panel/app/static/config.html CHANGELOG.md
git commit -m "release(v2.12.0): visual type reset + alarm sensors standard layout"
```

- [ ] **Step 5: Tag and push**

```bash
git tag v2.12.0
git push origin master --tags
```
