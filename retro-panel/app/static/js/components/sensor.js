/**
 * sensor.js — Sensor and binary_sensor read-only tile component
 * No ES modules — loaded as regular script. iOS 15 Safari safe.
 *
 * Exposes globally: window.SensorComponent = { createTile, updateTile }
 */
window.SensorComponent = (function () {
  'use strict';

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
    var attributes = stateObj.attributes;
    var valueEl = tile.querySelector('.tile-value');
    var isBinary = tile.dataset.isBinary === 'true';

    tile.classList.remove('state-on', 'state-off', 'state-unavailable');

    if (state === 'unavailable' || state === 'unknown') {
      tile.classList.add('state-unavailable');
      valueEl.textContent = 'N/A';
      return;
    }

    if (isBinary) {
      var deviceClass = attributes && attributes.device_class;
      valueEl.textContent = window.RP_FMT.getBinarySensorLabel(state, deviceClass);
      tile.classList.add(state === 'on' ? 'state-on' : 'state-off');
    } else {
      valueEl.textContent = window.RP_FMT.formatSensorValue(state, attributes);
      tile.classList.add('state-on');
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
