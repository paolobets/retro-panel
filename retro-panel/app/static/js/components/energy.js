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

  var THRESHOLD = 30; // W — soglia rumore sensore (inverter standby tipico 10-25 W)

  var TEXTS = {
    go:             { main: 'Ottimo momento!',        sub: '\u2600\uFE0F Solare attivo \u00B7 Avvia lavatrice o lavastoviglie' },
    caution:        { main: 'Usa con moderazione',    sub: '\uD83D\uDD0B Batteria in uso \u00B7 Evita carichi pesanti' },
    caution_solar:  { main: 'Bilancio neutro',        sub: '\u2600\uFE0F Solare \u2248 Consumo \u00B7 Batteria in standby' },
    stop:           { main: 'Evita elettrodomestici', sub: '\u26A1 Prelievo rete \u00B7 Costo elevato \u00B7 Aspetta il solare' },
    idle:           { main: 'Nessuna produzione',     sub: 'Notte \u00B7 Tutti i sistemi a riposo' }
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
    var mSolarIco = mk('div', 'ef-metric-icon', '\u2600\uFE0F');
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

    var solar    = getNum(cfg.solar_power)             || 0;
    var home     = getNum(cfg.home_power)              || 0;
    var batSoc   = getNum(cfg.battery_soc);
    var batChg   = getNum(cfg.battery_charge_power)    || 0;
    var batDis   = getNum(cfg.battery_discharge_power) || 0;
    var gridIn   = getNum(cfg.grid_import)             || 0;
    var gridOut  = getNum(cfg.grid_export)             || 0;

    // ── State logic ──────────────────────────────────────────
    // Verde  = solare copre casa con surplus (solar > home + soglia)
    // Giallo = batteria in uso (no rete) oppure solare ≈ consumo casa
    // Rosso  = prelievo dalla rete
    // Idle   = niente produzione, niente rete
    var efState;
    var efTextKey;
    if (gridIn > THRESHOLD) {
      efState   = 'stop';
      efTextKey = 'stop';
    } else if (solar > home + THRESHOLD) {
      efState   = 'go';
      efTextKey = 'go';
    } else if (batDis > THRESHOLD) {
      efState   = 'caution';
      efTextKey = 'caution';        // batteria copre casa, solare assente/insufficiente
    } else if (solar > THRESHOLD) {
      efState   = 'caution';
      efTextKey = 'caution_solar';  // solare ≈ consumo casa, bilancio neutro
    } else {
      efState   = 'idle';
      efTextKey = 'idle';
    }

    tile.classList.remove('ef-state-go', 'ef-state-caution', 'ef-state-stop', 'ef-state-idle');
    tile.classList.add('ef-state-' + efState);

    // ── Action text ──────────────────────────────────────────
    ef.actionMain.textContent = TEXTS[efTextKey].main;
    ef.actionSub.textContent  = TEXTS[efTextKey].sub;

    // ── Surplus area ─────────────────────────────────────────
    var sVal, sUnit, sLbl;
    if (efState === 'go') {
      var diff = solar - home;
      sVal  = (diff >= 0 ? '+' : '') + fmtPower(diff);
      sUnit = 'kW disponibili';
      sLbl  = 'surplus solare';
    } else if (efState === 'caution') {
      if (batDis > THRESHOLD && solar <= THRESHOLD) {
        // Batteria copre casa, solare assente
        sVal  = fmtPower(batDis);
        sUnit = 'scarica';
        sLbl  = 'batteria in uso';
      } else {
        // Solare ≈ consumo, batteria in standby
        sVal  = fmtPct(batSoc);
        sUnit = '';
        sLbl  = 'batteria disponibile';
      }
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
      ef.battVal.textContent  = fmtPct(batSoc);
      ef.battFill.style.width = Math.round(batSoc) + '%';
    } else {
      ef.battVal.textContent  = '\u2014';
      ef.battFill.style.width = '0%';
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
