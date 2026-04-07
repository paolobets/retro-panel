/**
 * energy.js — Energy Flow Card v2 (Design G)
 * Retro Panel v2.9.4
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

  var THRESHOLD   = 30;   // W — soglia rumore sensore (inverter standby tipico 10-25 W)
  var SOLAR_MAX_W = 6000; // W — picco impianto fotovoltaico (scala barra solare)
  var HOME_MAX_W  = 3500; // W — consumo massimo atteso casa (scala barra consumo)
  var GRID_MAX_W  = 3000; // W — max prelievo/immissione rete (scala barra rete)

  // Interpola hue tra hueFrom e hueTo in base a pct (0.0–1.0)
  // Restituisce stringa 'hsl(H,80%,42%)' — supportato da iOS 12 Safari
  function calcBarColor(pct, hueFrom, hueTo) {
    var hue = Math.round(hueFrom + (hueTo - hueFrom) * pct);
    return 'hsl(' + hue + ',80%,42%)';
  }

  function fmtTime(d) {
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  var TEXTS = {
    go:             { main: 'Ottimo momento!',        sub: '\u2600\uFE0F Solare attivo \u00B7 Avvia lavatrice o lavastoviglie' },
    caution:        { main: 'Usa con moderazione',    sub: '\uD83D\uDD0B Batteria in uso \u00B7 Evita carichi pesanti' },
    caution_solar:  { main: 'Bilancio neutro',        sub: '\u2600\uFE0F Solare \u2248 Consumo \u00B7 Batteria in standby' },
    stop:           { main: 'Evita elettrodomestici', sub: '\u26A1 Prelievo rete \u00B7 Costo elevato \u00B7 Aspetta il solare' },
    idle:           { main: 'Nessuna produzione',     sub: 'Notte \u00B7 Tutti i sistemi a riposo' },
    unavailable:    { main: 'Dati non disponibili',   sub: 'Uno o pi\u00F9 sensori non raggiungibili' }
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
    var mSolar       = mk('div', 'ef-metric ef-metric-solar');
    var mSolarIco    = mk('div', 'ef-metric-icon', '\u2600\uFE0F');
    var mSolarVal    = mk('div', 'ef-metric-val',  '\u2014');
    var mSolarLbl    = mk('div', 'ef-metric-lbl',  'Solare');
    var solarBar     = mk('div', 'ef-metric-bar');
    var solarBarFill = mk('div', 'ef-metric-bar-fill');
    solarBar.appendChild(solarBarFill);
    mSolar.appendChild(mSolarIco);
    mSolar.appendChild(mSolarVal);
    mSolar.appendChild(mSolarLbl);
    mSolar.appendChild(solarBar);

    // Home metric
    var mHome       = mk('div', 'ef-metric ef-metric-home');
    var mHomeIco    = mk('div', 'ef-metric-icon', '\uD83C\uDFE0');
    var mHomeVal    = mk('div', 'ef-metric-val',  '\u2014');
    var mHomeLbl    = mk('div', 'ef-metric-lbl',  'Casa');
    var homeBar     = mk('div', 'ef-metric-bar');
    var homeBarFill = mk('div', 'ef-metric-bar-fill');
    homeBar.appendChild(homeBarFill);
    mHome.appendChild(mHomeIco);
    mHome.appendChild(mHomeVal);
    mHome.appendChild(mHomeLbl);
    mHome.appendChild(homeBar);

    // Battery metric (with SOC bar — colore dinamico via JS)
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
    var mGrid       = mk('div', 'ef-metric ef-metric-grid');
    var mGridIco    = mk('div', 'ef-metric-icon', '\u26A1');
    var mGridVal    = mk('div', 'ef-metric-val',  '\u2014');
    var mGridLbl    = mk('div', 'ef-metric-lbl',  'Rete');
    var gridBar     = mk('div', 'ef-metric-bar');
    var gridBarFill = mk('div', 'ef-metric-bar-fill');
    gridBar.appendChild(gridBarFill);
    mGrid.appendChild(mGridIco);
    mGrid.appendChild(mGridVal);
    mGrid.appendChild(mGridLbl);
    mGrid.appendChild(gridBar);

    metrics.appendChild(mSolar);
    metrics.appendChild(mHome);
    metrics.appendChild(mBatt);
    metrics.appendChild(mGrid);
    tile.appendChild(metrics);

    // Timestamp ultimo aggiornamento
    var lastUpdate = mk('div', 'ef-timestamp', '\u2014');
    tile.appendChild(lastUpdate);

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
      solarBarFill: solarBarFill,
      homeVal:      mHomeVal,
      homeBarFill:  homeBarFill,
      battVal:      mBattVal,
      battLbl:      mBattLbl,
      battFill:     battFill,
      gridVal:      mGridVal,
      gridLbl:      mGridLbl,
      gridBarFill:  gridBarFill,
      lastUpdate:   lastUpdate,
    };

    return tile;
  }

  function updateTile(tile, states) {
    var ef = tile._ef;
    if (!ef) { return; }
    var cfg = ef.cfg;

    var solarMaxW = cfg.solar_max_kw != null ? cfg.solar_max_kw * 1000 : SOLAR_MAX_W;
    var homeMaxW  = cfg.home_max_kw  != null ? cfg.home_max_kw  * 1000 : HOME_MAX_W;
    var gridMaxW  = cfg.grid_max_kw  != null ? cfg.grid_max_kw  * 1000 : GRID_MAX_W;

    // Returns: number = valid reading, null = entity not configured,
    //          undefined = entity configured but unavailable/unknown in HA
    function getNum(entityId) {
      if (!entityId) { return null; }
      var s = states[entityId];
      if (!s) { return null; }
      if (s.state === 'unavailable' || s.state === 'unknown') { return undefined; }
      var n = parseFloat(s.state);
      return isNaN(n) ? null : n;
    }

    var solar_raw  = getNum(cfg.solar_power);
    var home_raw   = getNum(cfg.home_power);
    var batSoc     = getNum(cfg.battery_soc);
    var batChg_raw = getNum(cfg.battery_charge_power);
    var batDis_raw = getNum(cfg.battery_discharge_power);
    var gridIn_raw = getNum(cfg.grid_import);
    var gridOut_raw= getNum(cfg.grid_export);

    // If any configured critical sensor is unavailable, show unavail state
    var criticalUnavail = (solar_raw === undefined || home_raw === undefined ||
                           gridIn_raw === undefined || gridOut_raw === undefined);

    // Coerce undefined/null to 0 only after unavail check
    var solar   = solar_raw   || 0;
    var home    = home_raw    || 0;
    var batChg  = batChg_raw  || 0;
    var batDis  = batDis_raw  || 0;
    var gridIn  = gridIn_raw  || 0;
    var gridOut = gridOut_raw || 0;

    // ── State logic ──────────────────────────────────────────
    // Unavail = uno o più sensori critici offline
    // Verde   = solare copre casa con surplus (solar > home + soglia)
    // Giallo  = batteria in uso (no rete) oppure solare ≈ consumo casa
    // Rosso   = prelievo dalla rete
    // Idle    = niente produzione, niente rete
    var efState;
    var efTextKey;
    if (criticalUnavail) {
      efState   = 'unavail';
      efTextKey = 'unavailable';
    } else if (gridIn > THRESHOLD) {
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

    tile.classList.remove('ef-state-go', 'ef-state-caution', 'ef-state-stop', 'ef-state-idle', 'ef-state-unavail');
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
    // Solar bar: rosso→verde (0→120) in base a solarMaxW
    var solarPct = Math.min(1, solar / solarMaxW);
    ef.solarBarFill.style.width      = Math.round(solarPct * 100) + '%';
    ef.solarBarFill.style.background = calcBarColor(solarPct, 0, 120);

    ef.homeVal.textContent = home > 0 ? fmtPower(home) : '\u2014';
    // Home bar: verde→rosso (120→0) in base a homeMaxW
    var homePct = Math.min(1, home / homeMaxW);
    ef.homeBarFill.style.width      = Math.round(homePct * 100) + '%';
    ef.homeBarFill.style.background = calcBarColor(homePct, 120, 0);

    // Battery (null = not configured, undefined = offline — both show '—')
    if (typeof batSoc === 'number') {
      ef.battVal.textContent       = fmtPct(batSoc);
      ef.battFill.style.width      = Math.round(batSoc) + '%';
      ef.battFill.style.background = calcBarColor(batSoc / 100, 0, 120);
    } else {
      ef.battVal.textContent       = '\u2014';
      ef.battFill.style.width      = '0%';
      ef.battFill.style.background = '';
    }
    if (batChg > THRESHOLD) {
      ef.battLbl.textContent = '+' + fmtPower(batChg) + ' \u2191';
    } else if (batDis > THRESHOLD) {
      ef.battLbl.textContent = '-' + fmtPower(batDis) + ' \u2193';
    } else {
      ef.battLbl.textContent = 'Batteria';
    }

    // Grid bar: prelievo = blu→rosso (210→0), immissione = blu→verde (210→120)
    var gridPct, gridColor;
    if (gridIn > THRESHOLD) {
      ef.gridVal.textContent = fmtPower(gridIn);
      ef.gridLbl.textContent = 'Prelievo';
      gridPct   = Math.min(1, gridIn / gridMaxW);
      gridColor = calcBarColor(gridPct, 210, 0);
    } else if (gridOut > THRESHOLD) {
      ef.gridVal.textContent = fmtPower(gridOut);
      ef.gridLbl.textContent = 'Immissione';
      gridPct   = Math.min(1, gridOut / gridMaxW);
      gridColor = calcBarColor(gridPct, 210, 120);
    } else {
      ef.gridVal.textContent = '0 W';
      ef.gridLbl.textContent = 'Rete';
      gridPct   = 0;
      gridColor = calcBarColor(0, 210, 0);
    }
    ef.gridBarFill.style.width      = Math.round(gridPct * 100) + '%';
    ef.gridBarFill.style.background = gridColor;

    // ── Timestamp ultimo aggiornamento ────────────────────────
    ef.lastUpdate.textContent = 'Aggiornato ' + fmtTime(new Date());
  }

  return { createTile: createTile, updateTile: updateTile };
}());
