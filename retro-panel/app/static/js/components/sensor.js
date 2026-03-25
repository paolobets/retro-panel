/**
 * sensor.js — Sensor and binary_sensor read-only tile component
 * Temperature/humidity sensors get a climate tile with large value + fill bar.
 * All other sensors use a compact sensor-row-tile (icon bubble + name + value).
 * No ES modules — loaded as regular script. iOS 12+ Safari safe.
 *
 * Exposes globally: window.SensorComponent = { createTile, updateTile }
 */
window.SensorComponent = (function () {
  'use strict';

  // Climate device classes that get the big-value + fill bar treatment
  var CLIMATE_CLASSES = { temperature: true, humidity: true };

  // Approximate ranges for the fill bar pct calculation
  var CLIMATE_RANGE = {
    temperature: { min: 0, max: 50 },   // 0–50 °C
    humidity:    { min: 0, max: 100 },   // 0–100 %
  };

  // CSS variable references for the fill bar tint (defined in base.css)
  var CLIMATE_COLOR = {
    temperature: 'var(--color-temp-fill)',
    humidity:    'var(--color-humidity-fill)',
  };

  // Binary sensor device classes that represent an "alert" when ON
  var BINARY_ALERT_CLASSES = {
    door: true, window: true, motion: true,
    moisture: true, smoke: true, vibration: true,
  };

  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label = entityConfig.label;
    var icon = entityConfig.icon;
    var isBinary = entity_id.indexOf('binary_sensor.') === 0;

    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    // All sensors start as sensor-row-tile; climate sensors are promoted on first update
    var tile = DOM.createElement('div', 'tile sensor-row-tile entity-sensor state-off');
    tile.dataset.entityId = entity_id;
    tile.dataset.isBinary = isBinary ? 'true' : 'false';
    tile.dataset.label = label;
    tile.dataset.icon = icon || '';

    var iconWrap = DOM.createElement('div', 'sensor-row-icon');
    iconWrap.innerHTML = FMT.getIcon(icon, 20, entity_id);

    var textWrap = DOM.createElement('div', 'sensor-row-text');
    var nameEl = DOM.createElement('span', 'sensor-row-name', label);
    var valueEl = DOM.createElement('span', 'sensor-row-value', '\u2014');
    textWrap.appendChild(nameEl);
    textWrap.appendChild(valueEl);

    tile.appendChild(iconWrap);
    tile.appendChild(textWrap);

    return tile;
  }

  function rebuildAsClimateTile(tile) {
    // One-time promotion: row tile → climate tile structure
    var entity_id = tile.dataset.entityId;
    var label = tile.dataset.label || entity_id;
    var icon = tile.dataset.icon;

    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    tile.className = 'tile climate-tile sensor-tile entity-sensor state-off';
    tile.innerHTML = '';

    var top = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon');
    iconEl.innerHTML = FMT.getIcon(icon, 28, entity_id);
    top.appendChild(iconEl);

    var bottom = DOM.createElement('div', 'tile-bottom');
    var valueEl = DOM.createElement('span', 'tile-value', '\u2014');
    var labelEl = DOM.createElement('span', 'tile-label', label);
    bottom.appendChild(valueEl);
    bottom.appendChild(labelEl);

    tile.appendChild(top);
    tile.appendChild(bottom);
  }

  function updateTile(tile, stateObj) {
    var state = stateObj.state;
    var attributes = stateObj.attributes || {};
    var isBinary = tile.dataset.isBinary === 'true';
    var isRowTile = tile.classList.contains('sensor-row-tile');

    tile.classList.remove('state-on', 'state-off', 'state-unavailable');

    var valueSelector = isRowTile ? '.sensor-row-value' : '.tile-value';
    var valueEl = tile.querySelector(valueSelector);

    if (state === 'unavailable' || state === 'unknown') {
      tile.classList.add('state-unavailable');
      if (valueEl) { valueEl.textContent = 'N/A'; }
      return;
    }

    if (!isBinary) {
      var dc = attributes.device_class;
      if (dc && CLIMATE_CLASSES[dc]) {
        // Promote to climate tile on first update if still in row layout
        if (isRowTile) {
          rebuildAsClimateTile(tile);
        }
        tile.classList.add('climate-tile', 'state-on');
        var numVal = parseFloat(state);
        if (!isNaN(numVal)) {
          var range = CLIMATE_RANGE[dc];
          var pct = Math.max(0, Math.min(100, ((numVal - range.min) / (range.max - range.min)) * 100));
          tile.style.setProperty('--climate-pct', String(Math.round(pct)));
          tile.style.setProperty('--climate-color', CLIMATE_COLOR[dc]);
        }
        var climateVal = tile.querySelector('.tile-value');
        if (climateVal) { climateVal.textContent = window.RP_FMT.formatSensorValue(state, attributes); }
        return;
      }
    }

    // Row tile update path (generic sensors + binary sensors)
    var rowValueEl = tile.querySelector('.sensor-row-value');
    var iconWrap = tile.querySelector('.sensor-row-icon');

    if (isBinary) {
      var deviceClass = attributes.device_class;
      if (rowValueEl) { rowValueEl.textContent = window.RP_FMT.getBinarySensorLabel(state, deviceClass); }
      tile.classList.add(state === 'on' ? 'state-on' : 'state-off');
      var isAlert = state === 'on' && deviceClass && BINARY_ALERT_CLASSES[deviceClass];
      if (isAlert) {
        tile.classList.add('sensor-alert', 'srt-alert');
        if (iconWrap) {
          iconWrap.classList.add('sri-alert');
          iconWrap.classList.remove('sri-on', 'sri-off');
        }
      } else {
        tile.classList.remove('sensor-alert', 'srt-alert');
        if (iconWrap) {
          iconWrap.classList.remove('sri-alert');
          iconWrap.classList.toggle('sri-on', state === 'on');
          iconWrap.classList.toggle('sri-off', state !== 'on');
        }
      }
    } else {
      tile.classList.add('state-on');
      if (rowValueEl) { rowValueEl.textContent = window.RP_FMT.formatSensorValue(state, attributes); }
      if (iconWrap) {
        iconWrap.classList.add('sri-on');
        iconWrap.classList.remove('sri-off', 'sri-alert');
      }
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
