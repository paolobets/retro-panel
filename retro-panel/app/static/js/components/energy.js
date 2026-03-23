/**
 * energy.js — Power Flow Card component
 * Shows solar production, battery SOC/power, grid import/export, home consumption.
 * All sensors are configured by the user — nothing is hardcoded.
 *
 * No ES modules — loaded as regular script. iOS 15 Safari safe.
 *
 * Exposes globally: window.EnergyFlowComponent = { createTile, updateTile }
 *
 * Config shape (item from panel-config):
 *   { type: "energy_flow",
 *     solar_power, battery_soc, battery_power, grid_power, home_power }
 * Each value is an HA entity_id string (may be empty = sensor not configured).
 */
window.EnergyFlowComponent = (function () {
  'use strict';

  // Format a watt value: 0→"0 W", 1200→"1.2 kW"
  function fmtPower(val) {
    if (val === null || val === undefined || isNaN(val)) { return '—'; }
    var abs = Math.abs(val);
    if (abs >= 1000) {
      return (val / 1000).toFixed(1) + ' kW';
    }
    return Math.round(val) + ' W';
  }

  // Format a percentage (battery SOC)
  function fmtPct(val) {
    if (val === null || val === undefined || isNaN(val)) { return '—'; }
    return Math.round(val) + '%';
  }

  // Build a single energy node element
  function makeNode(cssClass, iconText, valueClass, labelText, subClass) {
    var node = document.createElement('div');
    node.className = 'energy-node ' + cssClass;

    var iconEl = document.createElement('div');
    iconEl.className = 'energy-node-icon';
    iconEl.textContent = iconText;

    var valueEl = document.createElement('div');
    valueEl.className = 'energy-node-value ' + valueClass;
    valueEl.textContent = '—';

    node.appendChild(iconEl);
    node.appendChild(valueEl);

    if (subClass) {
      var subEl = document.createElement('div');
      subEl.className = 'energy-node-sub ' + subClass;
      subEl.textContent = '';
      node.appendChild(subEl);
    }

    var labelEl = document.createElement('div');
    labelEl.className = 'energy-node-label';
    labelEl.textContent = labelText;
    node.appendChild(labelEl);

    return node;
  }

  // Build a horizontal connector element
  function makeConnector(arrowText) {
    var el = document.createElement('div');
    el.className = 'energy-connector';
    el.setAttribute('data-arrow', arrowText || '');
    return el;
  }

  function createTile(itemConfig) {
    var DOM = window.RP_DOM;

    var tile = DOM.createElement('div', 'tile energy-card');

    var titleEl = DOM.createElement('div', 'energy-card-title', 'Power Flow');
    tile.appendChild(titleEl);

    // Solar row (top center)
    var solarRow = DOM.createElement('div', 'energy-solar-row');
    var solarNode = makeNode('solar', '\u2600', 'ef-solar-val', 'Solar', null);
    solarRow.appendChild(solarNode);

    // Vertical connector: solar → home
    var connV = DOM.createElement('div', 'energy-connector-v');
    solarRow.appendChild(connV);
    tile.appendChild(solarRow);

    // Main row: battery — home — grid
    var mainRow = DOM.createElement('div', 'energy-main-row');

    var battNode = makeNode('battery', '\uD83D\uDD0B', 'ef-batt-soc', 'Battery', 'ef-batt-pwr');
    var connLeft = makeConnector('\u2194');   // ↔
    var homeNode = makeNode('home', '\uD83C\uDFE0', 'ef-home-val', 'Home', null);
    var connRight = makeConnector('\u2194');  // ↔
    var gridNode = makeNode('grid', '\u26A1', 'ef-grid-val', 'Grid', null);

    mainRow.appendChild(battNode);
    mainRow.appendChild(connLeft);
    mainRow.appendChild(homeNode);
    mainRow.appendChild(connRight);
    mainRow.appendChild(gridNode);
    tile.appendChild(mainRow);

    // Store references for updateTile
    tile._ef = {
      cfg: itemConfig,
      solarVal:  solarNode.querySelector('.ef-solar-val'),
      connV:     connV,
      battSoc:   battNode.querySelector('.ef-batt-soc'),
      battPwr:   battNode.querySelector('.ef-batt-pwr'),
      connLeft:  connLeft,
      homeVal:   homeNode.querySelector('.ef-home-val'),
      connRight: connRight,
      gridVal:   gridNode.querySelector('.ef-grid-val'),
    };

    return tile;
  }

  function updateTile(tile, states) {
    // states: map of entity_id → {state, attributes}
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

    var solar   = getNum(cfg.solar_power);
    var batSoc  = getNum(cfg.battery_soc);
    var batPwr  = getNum(cfg.battery_power);
    var grid    = getNum(cfg.grid_power);
    var home    = getNum(cfg.home_power);

    // Solar node
    ef.solarVal.textContent = fmtPower(solar);
    var solarActive = solar !== null && solar > 10;
    if (solarActive) {
      ef.connV.classList.add('flow-active');
      ef.connV.setAttribute('data-arrow', '\u2193');
    } else {
      ef.connV.classList.remove('flow-active');
      ef.connV.setAttribute('data-arrow', '');
    }

    // Battery node
    ef.battSoc.textContent = fmtPct(batSoc);
    if (ef.battPwr) {
      if (batPwr !== null) {
        var absP = Math.abs(batPwr);
        ef.battPwr.textContent = fmtPower(absP) + (batPwr > 10 ? ' \u2191' : batPwr < -10 ? ' \u2193' : '');
      } else {
        ef.battPwr.textContent = '';
      }
    }
    // Battery connector direction
    if (batPwr !== null && Math.abs(batPwr) > 10) {
      ef.connLeft.classList.add('flow-active');
      ef.connLeft.setAttribute('data-arrow', batPwr > 0 ? '\u2190' : '\u2192');  // charging←home, discharging→home
    } else {
      ef.connLeft.classList.remove('flow-active');
      ef.connLeft.setAttribute('data-arrow', '\u2194');
    }

    // Home node
    ef.homeVal.textContent = fmtPower(home);

    // Grid connector direction
    if (grid !== null && Math.abs(grid) > 10) {
      ef.connRight.classList.add('flow-active');
      ef.connRight.setAttribute('data-arrow', grid > 0 ? '\u2192' : '\u2190');  // import→home, export←home
    } else {
      ef.connRight.classList.remove('flow-active');
      ef.connRight.setAttribute('data-arrow', '\u2194');
    }

    // Grid node
    if (grid !== null) {
      var absGrid = Math.abs(grid);
      var suffix = grid > 10 ? ' import' : grid < -10 ? ' export' : '';
      ef.gridVal.textContent = fmtPower(absGrid) + suffix;
    } else {
      ef.gridVal.textContent = '—';
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
