/**
 * sensor.js — Sensor and binary_sensor read-only tile component
 * Temperature/humidity sensors get a climate tile with large value + fill bar.
 * No ES modules — loaded as regular script. iOS 15 Safari safe.
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

  // CSS color variable for the fill bar tint
  var CLIMATE_COLOR = {
    temperature: '#ef6c00',   // warm orange
    humidity:    '#1e88e5',   // cool blue
  };

  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label = entityConfig.label;
    var icon = entityConfig.icon;
    var isBinary = entity_id.indexOf('binary_sensor.') === 0;

    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    var tile = DOM.createElement('div', 'tile sensor-tile state-off');
    tile.dataset.entityId = entity_id;
    tile.dataset.isBinary = isBinary ? 'true' : 'false';

    var top = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon', FMT.getIcon(icon));
    top.appendChild(iconEl);

    var bottom = DOM.createElement('div', 'tile-bottom');
    var valueEl = DOM.createElement('span', 'tile-value', '\u2014');
    var labelEl = DOM.createElement('span', 'tile-label', label);
    bottom.appendChild(valueEl);
    bottom.appendChild(labelEl);

    tile.appendChild(top);
    tile.appendChild(bottom);

    return tile;
  }

  function updateTile(tile, stateObj) {
    var state = stateObj.state;
    var attributes = stateObj.attributes || {};
    var valueEl = tile.querySelector('.tile-value');
    var isBinary = tile.dataset.isBinary === 'true';

    tile.classList.remove('state-on', 'state-off', 'state-unavailable');

    if (state === 'unavailable' || state === 'unknown') {
      tile.classList.add('state-unavailable');
      valueEl.textContent = 'N/A';
      return;
    }

    if (isBinary) {
      var deviceClass = attributes.device_class;
      valueEl.textContent = window.RP_FMT.getBinarySensorLabel(state, deviceClass);
      tile.classList.add(state === 'on' ? 'state-on' : 'state-off');
    } else {
      // Climate sensor: temperature or humidity gets fill bar + large value
      var dc = attributes.device_class;
      if (dc && CLIMATE_CLASSES[dc]) {
        tile.classList.add('climate-tile', 'state-on');
        var numVal = parseFloat(state);
        if (!isNaN(numVal)) {
          var range = CLIMATE_RANGE[dc];
          var pct = Math.max(0, Math.min(100, ((numVal - range.min) / (range.max - range.min)) * 100));
          tile.style.setProperty('--climate-pct', String(Math.round(pct)));
          tile.style.setProperty('--climate-color', CLIMATE_COLOR[dc]);
        }
        valueEl.textContent = window.RP_FMT.formatSensorValue(state, attributes);
      } else {
        tile.classList.add('state-on');
        valueEl.textContent = window.RP_FMT.formatSensorValue(state, attributes);
      }
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
