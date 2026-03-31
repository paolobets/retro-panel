# Energy Card v2 — Design G + 7-sensor Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing 5-sensor energy flow tile with Design G (semaforo verde/giallo/rosso + surplus + metriche) backed by 7 separate sensor entities and an updated 7-step config wizard.

**Architecture:** Backend `EnergyFlowConfig` dataclass gains 7 fields (splitting battery charge/discharge and grid import/export); `energy.js` is fully rewritten with Design G DOM + state logic; `tiles.css` gets ~80 lines of `.ef-*` CSS; the config wizard is updated to 7 steps; `app.js` trigger condition is expanded to watch all 7 entities.

**Tech Stack:** Python 3.11 dataclasses (backend), Vanilla JS IIFE pattern iOS-12-safe (no const/let/=>/?./??, only var + function), CSS custom properties (`var(--c-*)` from tokens.css, no flex `gap`).

---

## File Map

| File | Change |
|------|--------|
| `retro-panel/tests/test_energy_config.py` | NEW — 6 TDD tests for loader changes |
| `retro-panel/app/config/loader.py` | `EnergyFlowConfig` 7 fields + `_parse_energy_flow` + `all_entity_ids` |
| `retro-panel/app/static/js/components/energy.js` | Full rewrite — Design G |
| `retro-panel/app/static/css/tiles.css` | Append ~80 lines `.ef-*` classes |
| `retro-panel/app/static/js/app.js` | Update energy tile trigger: 7 fields |
| `retro-panel/app/static/js/config.js` | Wizard 7 steps + `commitEnergyCard` + `openEnergyEditor` + `FIELD_LABELS` |
| `retro-panel/app/static/config.html` | 7 step dots + 7 hidden inputs |
| `retro-panel/app/static/index.html` | `?v=285` → `?v=290` (20 occurrences) |
| `retro-panel/config.yaml` | `version: "2.9.0"` |
| `retro-panel/CHANGELOG.md` | Entry v2.9.0 |
| `docs/ROADMAP.md` | v2.9 section + version table row |

**Do NOT touch:** `renderer.js`, `sensor.js`, `loader.py:_compute_layout_type`.

---

## Task 1: TDD — loader.py tests first

**Files:**
- Create: `retro-panel/tests/test_energy_config.py`

> Write all 6 tests BEFORE touching `loader.py`. They must fail first.

- [ ] **Step 1: Write the test file**

```python
"""Tests for EnergyFlowConfig 7-field model (v2.9.0)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from config.loader import (
    _parse_energy_flow, EnergyFlowConfig, PanelConfig,
    RoomSection, SectionItem,
)


def _config_with_ef(ef):
    """Helper: PanelConfig with a single energy_flow item in overview."""
    item = SectionItem(type='energy_flow', energy_flow=ef)
    sec  = RoomSection(id='s1', title='', items=[item])
    return PanelConfig(
        ha_url='http://homeassistant:8123',
        ha_token='',
        title='Test',
        theme='dark',
        refresh_interval=30,
        overview_sections=[sec],
    )


def test_parse_energy_flow_7_fields():
    raw = {
        'solar_power':           'sensor.solar',
        'home_power':            'sensor.home',
        'battery_soc':           'sensor.batt_soc',
        'battery_charge_power':  'sensor.batt_charge',
        'battery_discharge_power': 'sensor.batt_discharge',
        'grid_import':           'sensor.grid_in',
        'grid_export':           'sensor.grid_out',
    }
    ef = _parse_energy_flow(raw)
    assert ef.solar_power            == 'sensor.solar'
    assert ef.home_power             == 'sensor.home'
    assert ef.battery_soc            == 'sensor.batt_soc'
    assert ef.battery_charge_power   == 'sensor.batt_charge'
    assert ef.battery_discharge_power == 'sensor.batt_discharge'
    assert ef.grid_import            == 'sensor.grid_in'
    assert ef.grid_export            == 'sensor.grid_out'


def test_parse_energy_flow_empty_fields_default_to_empty_string():
    ef = _parse_energy_flow({})
    assert ef.solar_power            == ''
    assert ef.home_power             == ''
    assert ef.battery_soc            == ''
    assert ef.battery_charge_power   == ''
    assert ef.battery_discharge_power == ''
    assert ef.grid_import            == ''
    assert ef.grid_export            == ''


def test_parse_energy_flow_backward_compat_old_battery_power_ignored():
    # Old field 'battery_power' must NOT map to any new field automatically.
    # New fields simply stay empty — user must reconfigure via wizard.
    raw = {'battery_power': 'sensor.old_batt', 'solar_power': 'sensor.solar'}
    ef = _parse_energy_flow(raw)
    assert ef.battery_charge_power   == ''
    assert ef.battery_discharge_power == ''
    assert ef.solar_power            == 'sensor.solar'


def test_parse_energy_flow_backward_compat_old_grid_power_ignored():
    raw = {'grid_power': 'sensor.old_grid', 'home_power': 'sensor.home'}
    ef = _parse_energy_flow(raw)
    assert ef.grid_import  == ''
    assert ef.grid_export  == ''
    assert ef.home_power   == 'sensor.home'


def test_entity_ids_collects_all_7_energy_fields():
    ef = EnergyFlowConfig(
        solar_power='sensor.solar',
        home_power='sensor.home',
        battery_soc='sensor.bsoc',
        battery_charge_power='sensor.bcharge',
        battery_discharge_power='sensor.bdischarge',
        grid_import='sensor.gin',
        grid_export='sensor.gout',
    )
    cfg = _config_with_ef(ef)
    ids = cfg.all_entity_ids
    assert 'sensor.solar'       in ids
    assert 'sensor.home'        in ids
    assert 'sensor.bsoc'        in ids
    assert 'sensor.bcharge'     in ids
    assert 'sensor.bdischarge'  in ids
    assert 'sensor.gin'         in ids
    assert 'sensor.gout'        in ids


def test_entity_ids_skips_empty_energy_fields():
    ef = EnergyFlowConfig(solar_power='sensor.solar')  # all others empty
    cfg = _config_with_ef(ef)
    ids = cfg.all_entity_ids
    assert 'sensor.solar' in ids
    assert len(ids) == 1
```

- [ ] **Step 2: Run tests to confirm they all FAIL**

```bash
cd retro-panel
py -m pytest tests/test_energy_config.py -v
```

Expected: 6 failures — `ImportError` or `AttributeError` because `EnergyFlowConfig` still has 5 fields.

---

## Task 2: loader.py — EnergyFlowConfig 7 fields

**Files:**
- Modify: `retro-panel/app/config/loader.py:158-163` (EnergyFlowConfig)
- Modify: `retro-panel/app/config/loader.py:425-432` (_parse_energy_flow)
- Modify: `retro-panel/app/config/loader.py:286-289` (all_entity_ids)

- [ ] **Step 1: Replace `EnergyFlowConfig` dataclass (lines 157–163)**

Find this block:
```python
@dataclass
class EnergyFlowConfig:
    solar_power: str = ""
    battery_soc: str = ""
    battery_power: str = ""
    grid_power: str = ""
    home_power: str = ""
```

Replace with:
```python
@dataclass
class EnergyFlowConfig:
    solar_power: str = ""
    home_power: str = ""
    battery_soc: str = ""
    battery_charge_power: str = ""
    battery_discharge_power: str = ""
    grid_import: str = ""
    grid_export: str = ""
```

- [ ] **Step 2: Replace `_parse_energy_flow` (lines 425–432)**

Find this block:
```python
def _parse_energy_flow(raw: dict) -> EnergyFlowConfig:
    return EnergyFlowConfig(
        solar_power=str(raw.get("solar_power") or "").strip(),
        battery_soc=str(raw.get("battery_soc") or "").strip(),
        battery_power=str(raw.get("battery_power") or "").strip(),
        grid_power=str(raw.get("grid_power") or "").strip(),
        home_power=str(raw.get("home_power") or "").strip(),
    )
```

Replace with:
```python
def _parse_energy_flow(raw: dict) -> EnergyFlowConfig:
    return EnergyFlowConfig(
        solar_power=str(raw.get("solar_power") or "").strip(),
        home_power=str(raw.get("home_power") or "").strip(),
        battery_soc=str(raw.get("battery_soc") or "").strip(),
        battery_charge_power=str(raw.get("battery_charge_power") or "").strip(),
        battery_discharge_power=str(raw.get("battery_discharge_power") or "").strip(),
        grid_import=str(raw.get("grid_import") or "").strip(),
        grid_export=str(raw.get("grid_export") or "").strip(),
    )
```

- [ ] **Step 3: Update `all_entity_ids` (line 288)**

Find this line:
```python
                for eid in (ef.solar_power, ef.battery_soc, ef.battery_power, ef.grid_power, ef.home_power):
```

Replace with:
```python
                for eid in (ef.solar_power, ef.home_power, ef.battery_soc,
                            ef.battery_charge_power, ef.battery_discharge_power,
                            ef.grid_import, ef.grid_export):
```

- [ ] **Step 4: Run tests to confirm all 6 pass**

```bash
cd retro-panel
py -m pytest tests/test_energy_config.py -v
```

Expected output:
```
test_energy_config.py::test_parse_energy_flow_7_fields PASSED
test_energy_config.py::test_parse_energy_flow_empty_fields_default_to_empty_string PASSED
test_energy_config.py::test_parse_energy_flow_backward_compat_old_battery_power_ignored PASSED
test_energy_config.py::test_parse_energy_flow_backward_compat_old_grid_power_ignored PASSED
test_energy_config.py::test_entity_ids_collects_all_7_energy_fields PASSED
test_energy_config.py::test_entity_ids_skips_empty_energy_fields PASSED
6 passed
```

- [ ] **Step 5: Run full test suite**

```bash
cd retro-panel
py -m pytest tests/ --ignore=tests/test_handlers_entities.py -q
```

Expected: all passing, 0 failures.

- [ ] **Step 6: Commit**

```bash
cd retro-panel
git add tests/test_energy_config.py app/config/loader.py
git commit -m "feat(energy): EnergyFlowConfig 7 fields — battery charge/discharge + grid import/export (TDD)"
```

---

## Task 3: energy.js — Design G rewrite

**Files:**
- Modify: `retro-panel/app/static/js/components/energy.js` (full rewrite)

Replace the entire content of `energy.js` with:

- [ ] **Step 1: Rewrite energy.js**

```javascript
/**
 * energy.js — Energy Flow Card v2 (Design G)
 * Retro Panel v2.9.0
 *
 * Design G: semaforo go/caution/stop/idle + surplus solare + progress bar
 * + 4 metriche secondarie (solar, home, battery SOC, grid).
 *
 * 7 entità configurabili:
 *   solar_power, home_power, battery_soc,
 *   battery_charge_power, battery_discharge_power,
 *   grid_import, grid_export
 *
 * iOS 12 safe: solo var, nessuna arrow function, nessun optional chaining.
 * IIFE + window.EnergyFlowComponent
 */
window.EnergyFlowComponent = (function () {
  'use strict';

  var THRESHOLD = 10; // W — soglia rumore sensore

  var TEXTS = {
    go:      { main: 'Ottimo momento!',        sub: '\u2600 Solare attivo \u00B7 Avvia lavatrice o lavastoviglie' },
    caution: { main: 'Usa con moderazione',    sub: '\uD83D\uDD0B Solo batteria \u00B7 Solare spento \u00B7 Evita carichi pesanti' },
    stop:    { main: 'Evita elettrodomestici', sub: '\u26A1 Prelievo rete \u00B7 Costo elevato \u00B7 Aspetta il solare' },
    idle:    { main: 'Nessuna produzione',     sub: 'Notte \u00B7 Tutti i sistemi a riposo' }
  };

  function fmtPower(val) {
    if (val === null || val === undefined || isNaN(val)) { return '\u2014'; }
    var abs = Math.abs(val);
    if (abs >= 1000) { return (val / 1000).toFixed(1) + ' kW'; }
    return Math.round(val) + ' W';
  }

  function fmtPct(val) {
    if (val === null || val === undefined || isNaN(val)) { return '\u2014'; }
    return Math.round(val) + '%';
  }

  function mk(tag, cls, text) {
    var el = document.createElement(tag);
    if (cls)  { el.className   = cls; }
    if (text) { el.textContent = text; }
    return el;
  }

  function createTile(itemConfig) {
    var tile = mk('div', 'tile');
    tile.dataset.layoutType = 'energy_flow';
    tile.classList.add('ef-state-idle');

    // Hero row
    var hero = mk('div', 'ef-hero');

    // Semaforo
    var semaforo = mk('div', 'ef-semaforo');
    var dotGo      = mk('div', 'ef-dot ef-dot-go');
    var dotCaution = mk('div', 'ef-dot ef-dot-caution');
    var dotStop    = mk('div', 'ef-dot ef-dot-stop');
    semaforo.appendChild(dotGo);
    semaforo.appendChild(dotCaution);
    semaforo.appendChild(dotStop);

    // Action text
    var action     = mk('div', 'ef-action');
    var actionMain = mk('div', 'ef-action-main', TEXTS.idle.main);
    var actionSub  = mk('div', 'ef-action-sub',  TEXTS.idle.sub);
    action.appendChild(actionMain);
    action.appendChild(actionSub);

    // Surplus
    var surplus     = mk('div', 'ef-surplus');
    var surplusVal  = mk('div', 'ef-surplus-val',  '\u2014');
    var surplusUnit = mk('div', 'ef-surplus-unit', '');
    var surplusLbl  = mk('div', 'ef-surplus-lbl',  'nessuna produzione');
    surplus.appendChild(surplusVal);
    surplus.appendChild(surplusUnit);
    surplus.appendChild(surplusLbl);

    hero.appendChild(semaforo);
    hero.appendChild(action);
    hero.appendChild(surplus);
    tile.appendChild(hero);

    // Progress bar
    var progress     = mk('div', 'ef-progress');
    var progressFill = mk('div', 'ef-progress-fill');
    progress.appendChild(progressFill);
    tile.appendChild(progress);

    // Metrics row
    var metrics = mk('div', 'ef-metrics');

    // Solar metric
    var mSolar    = mk('div', 'ef-metric ef-metric-solar');
    var mSolarIco = mk('div', 'ef-metric-icon', '\u2600');
    var mSolarVal = mk('div', 'ef-metric-val',  '\u2014');
    var mSolarLbl = mk('div', 'ef-metric-lbl',  'Solare');
    mSolar.appendChild(mSolarIco);
    mSolar.appendChild(mSolarVal);
    mSolar.appendChild(mSolarLbl);

    // Home metric
    var mHome    = mk('div', 'ef-metric ef-metric-home');
    var mHomeIco = mk('div', 'ef-metric-icon', '\uD83C\uDFE0');
    var mHomeVal = mk('div', 'ef-metric-val',  '\u2014');
    var mHomeLbl = mk('div', 'ef-metric-lbl',  'Casa');
    mHome.appendChild(mHomeIco);
    mHome.appendChild(mHomeVal);
    mHome.appendChild(mHomeLbl);

    // Battery metric (with SOC bar)
    var mBatt    = mk('div', 'ef-metric ef-metric-battery');
    var mBattIco = mk('div', 'ef-metric-icon', '\uD83D\uDD0B');
    var mBattVal = mk('div', 'ef-metric-val',  '\u2014');
    var mBattLbl = mk('div', 'ef-metric-lbl',  'Batteria');
    var battBar  = mk('div', 'ef-batt-bar');
    var battFill = mk('div', 'ef-batt-fill');
    battBar.appendChild(battFill);
    mBatt.appendChild(mBattIco);
    mBatt.appendChild(mBattVal);
    mBatt.appendChild(mBattLbl);
    mBatt.appendChild(battBar);

    // Grid metric
    var mGrid    = mk('div', 'ef-metric ef-metric-grid');
    var mGridIco = mk('div', 'ef-metric-icon', '\u26A1');
    var mGridVal = mk('div', 'ef-metric-val',  '\u2014');
    var mGridLbl = mk('div', 'ef-metric-lbl',  'Rete');
    mGrid.appendChild(mGridIco);
    mGrid.appendChild(mGridVal);
    mGrid.appendChild(mGridLbl);

    metrics.appendChild(mSolar);
    metrics.appendChild(mHome);
    metrics.appendChild(mBatt);
    metrics.appendChild(mGrid);
    tile.appendChild(metrics);

    // Store DOM refs for updateTile
    tile._ef = {
      cfg:          itemConfig,
      actionMain:   actionMain,
      actionSub:    actionSub,
      surplusVal:   surplusVal,
      surplusUnit:  surplusUnit,
      surplusLbl:   surplusLbl,
      progressFill: progressFill,
      solarVal:     mSolarVal,
      homeVal:      mHomeVal,
      battVal:      mBattVal,
      battLbl:      mBattLbl,
      battFill:     battFill,
      gridVal:      mGridVal,
      gridLbl:      mGridLbl,
    };

    return tile;
  }

  function updateTile(tile, states) {
    var ef = tile._ef;
    if (!ef) { return; }
    var cfg = ef.cfg;

    function getNum(entityId) {
      if (!entityId) { return null; }
      var s = states[entityId];
      if (!s) { return null; }
      var n = parseFloat(s.state);
      return isNaN(n) ? null : n;
    }

    var solar    = getNum(cfg.solar_power)            || 0;
    var home     = getNum(cfg.home_power)             || 0;
    var batSoc   = getNum(cfg.battery_soc);
    var batChg   = getNum(cfg.battery_charge_power)   || 0;
    var batDis   = getNum(cfg.battery_discharge_power)|| 0;
    var gridIn   = getNum(cfg.grid_import)            || 0;
    var gridOut  = getNum(cfg.grid_export)            || 0;

    // ── State logic ──────────────────────────────────────────
    var efState;
    if (gridIn > THRESHOLD) {
      efState = 'stop';
    } else if (solar > THRESHOLD) {
      efState = 'go';
    } else if (batDis > THRESHOLD) {
      efState = 'caution';
    } else {
      efState = 'idle';
    }

    tile.classList.remove('ef-state-go', 'ef-state-caution', 'ef-state-stop', 'ef-state-idle');
    tile.classList.add('ef-state-' + efState);

    // ── Action text ──────────────────────────────────────────
    ef.actionMain.textContent = TEXTS[efState].main;
    ef.actionSub.textContent  = TEXTS[efState].sub;

    // ── Surplus area ─────────────────────────────────────────
    var sVal, sUnit, sLbl;
    if (efState === 'go') {
      var diff = solar - home;
      sVal  = (diff >= 0 ? '+' : '') + fmtPower(diff);
      sUnit = 'kW disponibili';
      sLbl  = 'surplus solare';
    } else if (efState === 'caution') {
      sVal  = fmtPct(batSoc);
      sUnit = '';
      sLbl  = 'batteria disponibile';
    } else if (efState === 'stop') {
      sVal  = fmtPower(gridIn);
      sUnit = 'prelievo';
      sLbl  = 'costo in corso';
    } else {
      sVal  = '\u2014';
      sUnit = '';
      sLbl  = 'nessuna produzione';
    }
    ef.surplusVal.textContent  = sVal;
    ef.surplusUnit.textContent = sUnit;
    ef.surplusLbl.textContent  = sLbl;

    // ── Progress bar (% consumo coperto da solare) ───────────
    var pct = solar > 0 ? Math.min(100, (solar / Math.max(home, 0.001)) * 100) : 0;
    ef.progressFill.style.width = Math.round(pct) + '%';

    // ── Metriche ─────────────────────────────────────────────
    ef.solarVal.textContent = solar > THRESHOLD ? fmtPower(solar) : '\u2014';
    ef.homeVal.textContent  = home  > 0         ? fmtPower(home)  : '\u2014';

    // Battery
    if (batSoc !== null) {
      ef.battVal.textContent         = fmtPct(batSoc);
      ef.battFill.style.width        = Math.round(batSoc) + '%';
    } else {
      ef.battVal.textContent         = '\u2014';
      ef.battFill.style.width        = '0%';
    }
    if (batChg > THRESHOLD) {
      ef.battLbl.textContent = '+' + fmtPower(batChg) + ' \u2191';
    } else if (batDis > THRESHOLD) {
      ef.battLbl.textContent = '-' + fmtPower(batDis) + ' \u2193';
    } else {
      ef.battLbl.textContent = 'Batteria';
    }

    // Grid
    if (gridIn > THRESHOLD) {
      ef.gridVal.textContent = fmtPower(gridIn);
      ef.gridLbl.textContent = 'Prelievo';
    } else if (gridOut > THRESHOLD) {
      ef.gridVal.textContent = fmtPower(gridOut);
      ef.gridLbl.textContent = 'Immissione';
    } else {
      ef.gridVal.textContent = '0 W';
      ef.gridLbl.textContent = 'Rete';
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
```

- [ ] **Step 2: Commit**

```bash
cd retro-panel
git add app/static/js/components/energy.js
git commit -m "feat(energy): energy.js Design G — semaforo 7-sensor rewrite"
```

---

## Task 4: tiles.css — CSS classi .ef-*

**Files:**
- Modify: `retro-panel/app/static/css/tiles.css` (append at end, after line 625)

- [ ] **Step 1: Append CSS at end of tiles.css**

Add the following block after the last line of `tiles.css`:

```css

/* ================================================================
   Energy Flow Card v2 — Design G
   .ef-state-go / .ef-state-caution / .ef-state-stop / .ef-state-idle
   ================================================================ */

.tile[data-layout-type="energy_flow"] {
  padding: 0;
  overflow: hidden;
  cursor: default;
  min-height: 0;
  height: auto;
  max-height: none;
}

/* ── Hero row ──────────────────────────────────────────────── */
.ef-hero {
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
  padding: 16px 16px 12px;
}

/* ── Semaforo ──────────────────────────────────────────────── */
.ef-semaforo {
  display: -webkit-flex;
  display: flex;
  -webkit-flex-direction: column;
  flex-direction: column;
  -webkit-align-items: center;
  align-items: center;
  margin-right: 14px;
  -webkit-flex-shrink: 0;
  flex-shrink: 0;
}
.ef-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--c-surface-3);
  margin-bottom: 4px;
}
.ef-dot:last-child { margin-bottom: 0; }

.ef-state-go .ef-dot-go {
  background: var(--c-on);
  -webkit-box-shadow: 0 0 8px var(--c-on);
  box-shadow: 0 0 8px var(--c-on);
}
.ef-state-caution .ef-dot-caution {
  background: var(--c-warning);
  -webkit-box-shadow: 0 0 8px var(--c-warning);
  box-shadow: 0 0 8px var(--c-warning);
}
.ef-state-stop .ef-dot-stop {
  background: var(--c-danger);
  -webkit-box-shadow: 0 0 8px var(--c-danger);
  box-shadow: 0 0 8px var(--c-danger);
}

/* ── Action text ───────────────────────────────────────────── */
.ef-action {
  -webkit-flex: 1;
  flex: 1;
}
.ef-action-main {
  font-size: 17px;
  font-weight: 800;
  line-height: 1.2;
  color: var(--c-text-pri);
}
.ef-state-go      .ef-action-main { color: var(--c-on); }
.ef-state-caution .ef-action-main { color: var(--c-warning); }
.ef-state-stop    .ef-action-main { color: var(--c-danger); }
.ef-state-idle    .ef-action-main { color: var(--c-text-sec); }

.ef-action-sub {
  font-size: 12px;
  color: var(--c-text-sec);
  margin-top: 4px;
  line-height: 1.3;
}

/* ── Surplus ───────────────────────────────────────────────── */
.ef-surplus {
  text-align: right;
  margin-left: 12px;
  -webkit-flex-shrink: 0;
  flex-shrink: 0;
}
.ef-surplus-val {
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}
.ef-state-go      .ef-surplus-val { color: var(--c-on); }
.ef-state-caution .ef-surplus-val { color: var(--c-warning); }
.ef-state-stop    .ef-surplus-val { color: var(--c-danger); }
.ef-state-idle    .ef-surplus-val { color: var(--c-text-sec); }

.ef-surplus-unit {
  font-size: 11px;
  color: var(--c-text-sec);
  margin-top: 2px;
}
.ef-surplus-lbl {
  font-size: 10px;
  color: var(--c-text-sec);
  opacity: 0.7;
}

/* ── Progress bar ──────────────────────────────────────────── */
.ef-progress {
  height: 4px;
  background: var(--c-surface-2);
  margin: 0 16px 12px;
}
.ef-progress-fill {
  height: 100%;
  width: 0%;
  background: var(--c-on);
  -webkit-transition: width 0.5s ease;
  transition: width 0.5s ease;
}
.ef-state-caution .ef-progress-fill { background: var(--c-warning); }
.ef-state-stop    .ef-progress-fill { background: var(--c-danger); }

/* ── Metrics row ───────────────────────────────────────────── */
.ef-metrics {
  display: -webkit-flex;
  display: flex;
  border-top: 1px solid var(--c-surface-2);
}
.ef-metric {
  -webkit-flex: 1;
  flex: 1;
  padding: 10px 6px;
  text-align: center;
  border-right: 1px solid var(--c-surface-2);
}
.ef-metric:last-child { border-right: none; }
.ef-metric-icon {
  font-size: 15px;
  margin-bottom: 3px;
}
.ef-metric-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--c-text-pri);
}
.ef-metric-lbl {
  font-size: 10px;
  color: var(--c-text-sec);
  margin-top: 2px;
}

/* ── Battery SOC bar ───────────────────────────────────────── */
.ef-batt-bar {
  height: 3px;
  background: var(--c-surface-3);
  border-radius: 2px;
  margin-top: 4px;
  overflow: hidden;
}
.ef-batt-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--c-accent);
  -webkit-transition: width 0.5s ease;
  transition: width 0.5s ease;
}
.ef-state-caution .ef-batt-fill { background: var(--c-warning); }
```

- [ ] **Step 2: Commit**

```bash
cd retro-panel
git add app/static/css/tiles.css
git commit -m "feat(energy): tiles.css Design G — .ef-* semaforo + metrics CSS"
```

---

## Task 5: app.js — aggiornare trigger update

**Files:**
- Modify: `retro-panel/app/static/js/app.js:79-81`

- [ ] **Step 1: Replace the 5-field condition (lines 79–81)**

Find this block:
```javascript
      if (entityId === cfg.solar_power  || entityId === cfg.battery_soc  ||
          entityId === cfg.battery_power || entityId === cfg.grid_power  ||
          entityId === cfg.home_power) {
```

Replace with:
```javascript
      if (entityId === cfg.solar_power            || entityId === cfg.home_power          ||
          entityId === cfg.battery_soc             || entityId === cfg.battery_charge_power ||
          entityId === cfg.battery_discharge_power || entityId === cfg.grid_import          ||
          entityId === cfg.grid_export) {
```

- [ ] **Step 2: Commit**

```bash
cd retro-panel
git add app/static/js/app.js
git commit -m "feat(energy): app.js — expand energy tile update trigger to 7 fields"
```

---

## Task 6: config.html + config.js — wizard 7 step

**Files:**
- Modify: `retro-panel/app/static/config.html:507-534`
- Modify: `retro-panel/app/static/js/config.js:55` (wizardValues)
- Modify: `retro-panel/app/static/js/config.js:2071-2073` (FIELD_LABELS)
- Modify: `retro-panel/app/static/js/config.js:2188-2204` (WIZARD_STEPS)
- Modify: `retro-panel/app/static/js/config.js:2213-2219` (openEnergyEditor)
- Modify: `retro-panel/app/static/js/config.js:2300-2307` (commitEnergyCard)

### config.html

- [ ] **Step 1: Replace the 5-step wizard dots block (lines 507–517)**

Find:
```html
    <!-- Step indicators -->
    <div id="energy-wizard-steps">
      <div class="wizard-step active" data-step="0">1</div>
      <div class="wizard-step-line"></div>
      <div class="wizard-step" data-step="1">2</div>
      <div class="wizard-step-line"></div>
      <div class="wizard-step" data-step="2">3</div>
      <div class="wizard-step-line"></div>
      <div class="wizard-step" data-step="3">4</div>
      <div class="wizard-step-line"></div>
      <div class="wizard-step" data-step="4">5</div>
    </div>
```

Replace with:
```html
    <!-- Step indicators -->
    <div id="energy-wizard-steps">
      <div class="wizard-step active" data-step="0">1</div>
      <div class="wizard-step-line"></div>
      <div class="wizard-step" data-step="1">2</div>
      <div class="wizard-step-line"></div>
      <div class="wizard-step" data-step="2">3</div>
      <div class="wizard-step-line"></div>
      <div class="wizard-step" data-step="3">4</div>
      <div class="wizard-step-line"></div>
      <div class="wizard-step" data-step="4">5</div>
      <div class="wizard-step-line"></div>
      <div class="wizard-step" data-step="5">6</div>
      <div class="wizard-step-line"></div>
      <div class="wizard-step" data-step="6">7</div>
    </div>
```

- [ ] **Step 2: Replace the 5 hidden inputs (lines 528–534)**

Find:
```html
    <!-- Legacy inputs (hidden, synced by JS) -->
    <div class="hidden">
      <input id="ef-solar" type="text" readonly>
      <input id="ef-batt-soc" type="text" readonly>
      <input id="ef-batt-pwr" type="text" readonly>
      <input id="ef-grid" type="text" readonly>
      <input id="ef-home" type="text" readonly>
    </div>
```

Replace with:
```html
    <!-- Hidden inputs (synced by JS) -->
    <div class="hidden">
      <input id="ef-solar"         type="text" readonly>
      <input id="ef-home"          type="text" readonly>
      <input id="ef-batt-soc"      type="text" readonly>
      <input id="ef-batt-charge"   type="text" readonly>
      <input id="ef-batt-discharge" type="text" readonly>
      <input id="ef-grid-import"   type="text" readonly>
      <input id="ef-grid-export"   type="text" readonly>
    </div>
```

### config.js

- [ ] **Step 3: Replace `wizardValues` initialization (line 55)**

Find:
```javascript
  var wizardValues  = { 'ef-solar': '', 'ef-batt-soc': '', 'ef-batt-pwr': '', 'ef-grid': '', 'ef-home': '' };
```

Replace with:
```javascript
  var wizardValues  = {
    'ef-solar': '', 'ef-home': '', 'ef-batt-soc': '',
    'ef-batt-charge': '', 'ef-batt-discharge': '',
    'ef-grid-import': '', 'ef-grid-export': ''
  };
```

- [ ] **Step 4: Update `FIELD_LABELS` in `openSensorPicker` (lines 2071–2073)**

Find:
```javascript
      var FIELD_LABELS = {
        'ef-solar': 'Solar production', 'ef-batt-soc': 'Battery SOC',
        'ef-batt-pwr': 'Battery power', 'ef-grid': 'Grid power', 'ef-home': 'Home consumption',
      };
```

Replace with:
```javascript
      var FIELD_LABELS = {
        'ef-solar':         'Produzione solare',
        'ef-home':          'Consumo casa',
        'ef-batt-soc':      'SOC batteria (%)',
        'ef-batt-charge':   'Carica batteria (W)',
        'ef-batt-discharge':'Scarica batteria (W)',
        'ef-grid-import':   'Prelievo rete (W)',
        'ef-grid-export':   'Immissione rete (W)',
      };
```

- [ ] **Step 5: Replace `WIZARD_STEPS` array (lines 2188–2204)**

Find:
```javascript
  var WIZARD_STEPS = [
    { field: 'ef-solar', title: 'Step 1 of 5 \u2014 Solar Production', icon: '\u2600',
      description: 'Select the sensor measuring solar panel power output (Watts).\n\nExamples:\n\u2022 sensor.solar_power\n\u2022 sensor.pv_power\n\u2022 sensor.zcs_azzurro_power_pv\n\nTip: search \u201cpv\u201d or \u201csolar\u201d.',
      placeholder: 'sensor.solar_power' },
    { field: 'ef-batt-soc', title: 'Step 2 of 5 \u2014 Battery State of Charge', icon: '\uD83D\uDD0B',
      description: 'Select the sensor showing battery charge level (0\u2013100%).\n\nExamples:\n\u2022 sensor.battery_soc\n\u2022 sensor.bms_state_of_charge\n\u2022 sensor.zcs_azzurro_battery_soc\n\nTip: search \u201csoc\u201d.',
      placeholder: 'sensor.battery_soc' },
    { field: 'ef-batt-pwr', title: 'Step 3 of 5 \u2014 Battery Power', icon: '\u26A1',
      description: 'Select the battery charge/discharge power sensor (Watts).\n\nConvention:\n\u2022 Positive (+W) = charging\n\u2022 Negative (\u2212W) = discharging\n\nExamples:\n\u2022 sensor.battery_power\n\u2022 sensor.zcs_azzurro_battery_power',
      placeholder: 'sensor.battery_power' },
    { field: 'ef-grid', title: 'Step 4 of 5 \u2014 Grid Power', icon: '\uD83C\uDFED',
      description: 'Select the grid exchange power sensor (Watts).\n\nConvention:\n\u2022 Positive (+W) = importing from grid\n\u2022 Negative (\u2212W) = exporting to grid\n\nExamples:\n\u2022 sensor.grid_power\n\u2022 sensor.zcs_azzurro_power_grid',
      placeholder: 'sensor.grid_power' },
    { field: 'ef-home', title: 'Step 5 of 5 \u2014 Home Consumption', icon: '\uD83C\uDFE0',
      description: 'Select the total home power consumption sensor (Watts).\n\nExamples:\n\u2022 sensor.home_consumption\n\u2022 sensor.house_load\n\u2022 sensor.zcs_azzurro_power_load\n\nTip: search \u201cload\u201d or \u201cconsumption\u201d.',
      placeholder: 'sensor.home_consumption' },
  ];
```

Replace with:
```javascript
  var WIZARD_STEPS = [
    { field: 'ef-solar', title: 'Step 1 di 7 \u2014 Produzione solare', icon: '\u2600',
      description: 'Seleziona il sensore che misura la potenza prodotta dai pannelli fotovoltaici (Watt).\n\nEsempi:\n\u2022 sensor.solar_power\n\u2022 sensor.pv_power\n\u2022 sensor.zcs_azzurro_power_pv\n\nSuggerimento: cerca \u201cpv\u201d o \u201csolar\u201d.',
      placeholder: 'sensor.solar_power' },
    { field: 'ef-home', title: 'Step 2 di 7 \u2014 Consumo casa', icon: '\uD83C\uDFE0',
      description: 'Seleziona il sensore del consumo totale della casa (Watt).\n\nEsempi:\n\u2022 sensor.home_consumption\n\u2022 sensor.house_load\n\u2022 sensor.zcs_azzurro_power_load\n\nSuggerimento: cerca \u201cload\u201d o \u201cconsumption\u201d.',
      placeholder: 'sensor.home_consumption' },
    { field: 'ef-batt-soc', title: 'Step 3 di 7 \u2014 SOC batteria (%)', icon: '\uD83D\uDD0B',
      description: 'Seleziona il sensore che mostra la percentuale di carica della batteria (0\u2013100%).\n\nEsempi:\n\u2022 sensor.battery_soc\n\u2022 sensor.bms_state_of_charge\n\u2022 sensor.zcs_azzurro_battery_soc\n\nSuggerimento: cerca \u201csoc\u201d.',
      placeholder: 'sensor.battery_soc' },
    { field: 'ef-batt-charge', title: 'Step 4 di 7 \u2014 Carica batteria', icon: '\u2B06\uFE0F',
      description: 'Seleziona il sensore della potenza di CARICA della batteria (Watt, sempre positivo quando in carica).\n\nEsempi:\n\u2022 sensor.battery_charge_power\n\u2022 sensor.batt_charge_w\n\nSuggerimento: cerca \u201ccharge\u201d o \u201ccaricat\u201d.',
      placeholder: 'sensor.battery_charge_power' },
    { field: 'ef-batt-discharge', title: 'Step 5 di 7 \u2014 Scarica batteria', icon: '\u2B07\uFE0F',
      description: 'Seleziona il sensore della potenza di SCARICA della batteria (Watt, sempre positivo quando in scarica).\n\nEsempi:\n\u2022 sensor.battery_discharge_power\n\u2022 sensor.batt_discharge_w\n\nSuggerimento: cerca \u201cdischarge\u201d o \u201cscaric\u201d.',
      placeholder: 'sensor.battery_discharge_power' },
    { field: 'ef-grid-import', title: 'Step 6 di 7 \u2014 Prelievo rete', icon: '\u26A1',
      description: 'Seleziona il sensore del PRELIEVO dalla rete (Watt, positivo quando importi dalla rete).\n\nEsempi:\n\u2022 sensor.grid_import\n\u2022 sensor.grid_consumption\n\u2022 sensor.zcs_azzurro_power_grid_in\n\nSuggerimento: cerca \u201cimport\u201d o \u201cprelievo\u201d.',
      placeholder: 'sensor.grid_import' },
    { field: 'ef-grid-export', title: 'Step 7 di 7 \u2014 Immissione rete', icon: '\uD83D\uDD1D',
      description: 'Seleziona il sensore dell\u2019IMMISSIONE in rete (Watt, positivo quando esporti in rete).\n\nEsempi:\n\u2022 sensor.grid_export\n\u2022 sensor.grid_feedin\n\u2022 sensor.zcs_azzurro_power_grid_out\n\nSuggerimento: cerca \u201cexport\u201d o \u201cimmissione\u201d.',
      placeholder: 'sensor.grid_export' },
  ];
```

- [ ] **Step 6: Update `openEnergyEditor` wizardValues initialization (lines 2213–2219)**

Find:
```javascript
    wizardValues = {
      'ef-solar':    (existingItem && existingItem.solar_power)   || '',
      'ef-batt-soc': (existingItem && existingItem.battery_soc)   || '',
      'ef-batt-pwr': (existingItem && existingItem.battery_power) || '',
      'ef-grid':     (existingItem && existingItem.grid_power)    || '',
      'ef-home':     (existingItem && existingItem.home_power)    || '',
    };
```

Replace with:
```javascript
    wizardValues = {
      'ef-solar':         (existingItem && existingItem.solar_power)            || '',
      'ef-home':          (existingItem && existingItem.home_power)             || '',
      'ef-batt-soc':      (existingItem && existingItem.battery_soc)            || '',
      'ef-batt-charge':   (existingItem && existingItem.battery_charge_power)   || '',
      'ef-batt-discharge':(existingItem && existingItem.battery_discharge_power)|| '',
      'ef-grid-import':   (existingItem && existingItem.grid_import)            || '',
      'ef-grid-export':   (existingItem && existingItem.grid_export)            || '',
    };
```

- [ ] **Step 7: Update `commitEnergyCard` (lines 2300–2307)**

Find:
```javascript
    var efItem = {
      type: 'energy_flow',
      solar_power:   wizardValues['ef-solar']   || '',
      battery_soc:   wizardValues['ef-batt-soc'] || '',
      battery_power: wizardValues['ef-batt-pwr'] || '',
      grid_power:    wizardValues['ef-grid']    || '',
      home_power:    wizardValues['ef-home']    || '',
    };
```

Replace with:
```javascript
    var efItem = {
      type: 'energy_flow',
      solar_power:            wizardValues['ef-solar']          || '',
      home_power:             wizardValues['ef-home']           || '',
      battery_soc:            wizardValues['ef-batt-soc']       || '',
      battery_charge_power:   wizardValues['ef-batt-charge']    || '',
      battery_discharge_power:wizardValues['ef-batt-discharge'] || '',
      grid_import:            wizardValues['ef-grid-import']    || '',
      grid_export:            wizardValues['ef-grid-export']    || '',
    };
```

- [ ] **Step 8: Commit**

```bash
cd retro-panel
git add app/static/config.html app/static/js/config.js
git commit -m "feat(energy): wizard 7 step — battery charge/discharge + grid import/export"
```

---

## Task 7: Version bump v2.9.0 + docs

**Files:**
- Modify: `retro-panel/config.yaml`
- Modify: `retro-panel/app/static/index.html` (20 occurrences `?v=285` → `?v=290`)
- Modify: `retro-panel/app/static/config.html` (5 occurrences `?v=285` → `?v=290`)
- Modify: `retro-panel/CHANGELOG.md`
- Modify: `docs/ROADMAP.md`

- [ ] **Step 1: Bump config.yaml**

In `retro-panel/config.yaml`, change:
```yaml
version: "2.8.5"
```
to:
```yaml
version: "2.9.0"
```

- [ ] **Step 2: Bump cache-busters in index.html (20 occurrences)**

```bash
cd retro-panel
sed -i 's/?v=285/?v=290/g' app/static/index.html
grep -c "v=290" app/static/index.html
```

Expected: `20`

- [ ] **Step 3: Bump cache-busters in config.html (5 occurrences)**

```bash
cd retro-panel
sed -i 's/?v=285/?v=290/g' app/static/config.html
grep -c "v=290" app/static/config.html
```

Expected: `5`

- [ ] **Step 4: Add CHANGELOG entry**

At the top of `retro-panel/CHANGELOG.md`, add:

```markdown
## v2.9.0 — 2026-03-30

### New
- **Energy Card v2 — Design G**: tile semaforo verde/giallo/rosso con stato actionable immediato
  - 🟢 **Verde** (Ottimo momento!): solare attivo, surplus disponibile per elettrodomestici
  - 🟡 **Giallo** (Usa con moderazione): solo batteria, solare spento
  - 🔴 **Rosso** (Evita elettrodomestici): prelievo dalla rete, costo elevato
  - Progress bar: % consumo casa coperto dal solare
  - 4 metriche secondarie: solare, casa, batteria SOC + barra, rete
- **7 entità separabili**: `solar_power`, `home_power`, `battery_soc`, `battery_charge_power`, `battery_discharge_power`, `grid_import`, `grid_export`
- **Wizard a 7 step** aggiornato in /config per associare ogni entità
- Backward compat: config esistenti con `battery_power`/`grid_power` restano validi, i nuovi campi appaiono vuoti (riconfigurare via wizard)

```

- [ ] **Step 5: Update ROADMAP.md**

Add a new section before `## v3.0+ (Long-term Vision)`:

```markdown
## v2.9 - Energy Card v2 (Released 2026-03-30)

**Status**: RELEASED (current stable: v2.9.0)

**Release Goal**: Redesign completo del tile energy_flow con Design G (semaforo actionable) e supporto a 7 entità separate.

### Completed Features

- [x] Energy Card v2 — Design G: semaforo go/caution/stop/idle
- [x] 7 entità: solar, home, battery_soc, battery_charge, battery_discharge, grid_import, grid_export
- [x] Wizard a 7 step in /config
- [x] Progress bar: % consumo solare
- [x] Metriche secondarie: SOC batteria + barra, grid prelievo/immissione
- [x] iOS 12 safe (var, no arrow functions, no gap)

---
```

Also update the version table in ROADMAP.md — add after the `v2.8.1–2.8.5` row:

```markdown
| v2.9.0 | Released | 2026-03-30 | Completed |
```

And update "Document Version" and "Last Updated" at the bottom of ROADMAP.md:
```
**Document Version**: 2.9.0
**Last Updated**: 2026-03-30
```

- [ ] **Step 6: Run full test suite one final time**

```bash
cd retro-panel
py -m pytest tests/ --ignore=tests/test_handlers_entities.py -q
```

Expected: all passing.

- [ ] **Step 7: Commit**

```bash
cd retro-panel
git add config.yaml app/static/index.html app/static/config.html CHANGELOG.md
git add ../docs/ROADMAP.md
git commit -m "chore(release): bump v2.9.0 — energy card v2 Design G"
```
