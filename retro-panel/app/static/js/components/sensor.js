/**
 * sensor.js — Sensor and binary_sensor read-only tile component (v2.0)
 * All sensors share a single tile structure: div.tile.tile-sensor.
 * Layout behaviour is driven by backend-computed layout_type on entityConfig.
 * No ES modules — loaded as regular script. iOS 12+ Safari safe.
 *
 * Exposes globally: window.SensorComponent = { createTile, updateTile }
 */
window.SensorComponent = (function () {
  'use strict';

  // Initial icon-bubble class keyed by layout_type (before state is known)
  var INITIAL_BUBBLE_CLASS = {
    sensor_temperature: 'sri-temp-warm',
    sensor_humidity:    'sri-humidity',
    sensor_co2:        'sri-co2',
    sensor_battery:    'sri-battery-ok',
    sensor_energy:     'sri-energy',
    sensor_generic:    'sri-ok',
    binary_door:       'sri-ok',
    binary_motion:     'sri-ok',
    binary_standard:   'sri-ok',
  };

  // All sri-* classes that must be cleared before applying a new one
  var ALL_BUBBLE_CLASSES = [
    'sri-ok',
    'sri-temp-warm',
    'sri-temp-cool',
    'sri-humidity',
    'sri-co2',
    'sri-battery-ok',
    'sri-battery-low',
    'sri-energy',
    'sri-alert',
    'sri-presence',
    'sri-critical',
    'sri-on',
  ];

  // Tile state classes for binary sensors
  var BINARY_TILE_STATE_CLASSES = [
    'srt-alert',
    'srt-presence',
    'srt-critical',
    'is-on',
    'is-off',
  ];

  function clearBubbleClasses(el) {
    for (var i = 0; i < ALL_BUBBLE_CLASSES.length; i++) {
      el.classList.remove(ALL_BUBBLE_CLASSES[i]);
    }
  }

  function clearBinaryTileStateClasses(el) {
    for (var i = 0; i < BINARY_TILE_STATE_CLASSES.length; i++) {
      el.classList.remove(BINARY_TILE_STATE_CLASSES[i]);
    }
  }

  // -----------------------------------------------------------------------
  // createTile(entityConfig)
  // -----------------------------------------------------------------------
  function createTile(entityConfig) {
    var entity_id  = entityConfig.entity_id;
    var label      = entityConfig.label;
    var icon       = entityConfig.icon;
    var layoutType = entityConfig.layout_type || 'sensor_generic';

    var initialBubbleClass = INITIAL_BUBBLE_CLASS[layoutType] || 'sri-ok';

    var tile = document.createElement('div');
    tile.className = 'tile tile-sensor';
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = layoutType;

    var bubble = document.createElement('div');
    bubble.className = 'sensor-icon-bubble ' + initialBubbleClass;
    bubble.innerHTML = window.RP_FMT.getIcon(icon, 20, entity_id);

    var textWrap = document.createElement('div');
    textWrap.className = 'sensor-text';

    var nameEl = document.createElement('span');
    nameEl.className   = 'sensor-name';
    nameEl.textContent = label;

    var valueEl = document.createElement('span');
    valueEl.className   = 'sensor-value';
    valueEl.textContent = '\u2014';

    textWrap.appendChild(nameEl);
    textWrap.appendChild(valueEl);

    tile.appendChild(bubble);
    tile.appendChild(textWrap);

    return tile;
  }

  // -----------------------------------------------------------------------
  // updateTile(tile, stateObj)
  // -----------------------------------------------------------------------
  function updateTile(tile, stateObj) {
    var state      = stateObj.state;
    var attrs      = stateObj.attributes || {};
    var layoutType = tile.dataset.layoutType || 'sensor_generic';

    var valueEl = tile.querySelector('.sensor-value');
    var bubble  = tile.querySelector('.sensor-icon-bubble');

    // Handle unavailable / unknown state
    if (state === 'unavailable' || state === 'unknown') {
      if (valueEl) { valueEl.textContent = 'N/A'; }
      tile.classList.add('is-unavail');
      return;
    }

    // Remove stale unavailability marker on recovery
    tile.classList.remove('is-unavail');

    // -----------------------------------------------------------------
    // Binary sensors
    // -----------------------------------------------------------------
    if (layoutType.indexOf('binary_') === 0) {
      var deviceClass = attrs.device_class || '';

      if (valueEl) {
        valueEl.textContent = window.RP_FMT.getBinarySensorLabel(state, deviceClass);
      }

      clearBinaryTileStateClasses(tile);
      if (bubble) { clearBubbleClasses(bubble); }

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

      return;
    }

    // -----------------------------------------------------------------
    // Regular sensors
    // -----------------------------------------------------------------
    if (valueEl) {
      valueEl.textContent = window.RP_FMT.formatSensorValue(state, attrs);
    }

    if (bubble) {
      clearBubbleClasses(bubble);

      var numVal    = parseFloat(state);
      var sriClass  = 'sri-ok';

      if (layoutType === 'sensor_temperature') {
        sriClass = (!isNaN(numVal) && numVal < 18) ? 'sri-temp-cool' : 'sri-temp-warm';
      } else if (layoutType === 'sensor_humidity') {
        sriClass = 'sri-humidity';
      } else if (layoutType === 'sensor_co2') {
        sriClass = 'sri-co2';
      } else if (layoutType === 'sensor_battery') {
        sriClass = (!isNaN(numVal) && numVal < 20) ? 'sri-battery-low' : 'sri-battery-ok';
      } else if (layoutType === 'sensor_energy') {
        sriClass = 'sri-energy';
      } else {
        sriClass = 'sri-ok';
      }

      bubble.classList.add(sriClass);
    }
  }

  return { createTile: createTile, updateTile: updateTile };

}());
