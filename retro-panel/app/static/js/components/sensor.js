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

  // Initial icon-bubble class keyed by layout_type (shown before first state update)
  var INITIAL_BUBBLE_CLASS = {
    sensor_temperature: 'sri-temp-comfort',
    sensor_humidity:    'sri-hum-ideal',
    sensor_co2:         'sri-co2-good',
    sensor_battery:     'sri-bat-full',
    sensor_energy:      'sri-energy',
    sensor_illuminance: 'sri-lux-normal',
    sensor_pressure:    'sri-pressure',
    sensor_air_quality: 'sri-aq-good',
    sensor_generic:     'sri-ok',
    binary_door:        'sri-ok',
    binary_motion:      'sri-ok',
    binary_standard:    'sri-ok',
    binary_presence:    'sri-ok',
    sensor_electrical:  'sri-electrical',
    sensor_signal:      'sri-sig-strong',
    sensor_gas:         'sri-gas-safe',
    sensor_speed:       'sri-spd-calm',
    sensor_water:       'sri-water',
    sensor_ph:          'sri-ph-neutral',
    sensor_physical:    'sri-physical',
  };

  // All sri-* classes — cleared before applying a new one
  var ALL_BUBBLE_CLASSES = [
    'sri-ok', 'sri-alert', 'sri-presence', 'sri-critical',
    'sri-temp-freeze', 'sri-temp-cold', 'sri-temp-cool',
    'sri-temp-comfort', 'sri-temp-warm', 'sri-temp-hot',
    'sri-hum-dry', 'sri-hum-low', 'sri-hum-ideal', 'sri-hum-high', 'sri-hum-wet',
    'sri-co2-good', 'sri-co2-mod', 'sri-co2-bad', 'sri-co2-critical',
    'sri-bat-full', 'sri-bat-mid', 'sri-bat-low', 'sri-bat-crit',
    'sri-energy',
    'sri-lux-dark', 'sri-lux-dim', 'sri-lux-normal', 'sri-lux-bright',
    'sri-pressure',
    'sri-aq-good', 'sri-aq-mod', 'sri-aq-bad', 'sri-aq-hazard',
    'sri-electrical',
    'sri-sig-strong', 'sri-sig-good', 'sri-sig-fair', 'sri-sig-weak',
    'sri-gas-safe', 'sri-gas-mod', 'sri-gas-bad', 'sri-gas-critical',
    'sri-spd-calm', 'sri-spd-breezy', 'sri-spd-windy', 'sri-spd-storm',
    'sri-water',
    'sri-ph-acid', 'sri-ph-neutral', 'sri-ph-alkaline',
    'sri-physical',
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
      var numVal     = parseFloat(state);
      var sriClass   = 'sri-ok';
      var batIcon    = null;
      var entityId   = tile.dataset.entityId || '';

      if (layoutType === 'sensor_temperature') {
        if      (!isNaN(numVal) && numVal < 5)  { sriClass = 'sri-temp-freeze'; }
        else if (!isNaN(numVal) && numVal < 15) { sriClass = 'sri-temp-cold'; }
        else if (!isNaN(numVal) && numVal < 19) { sriClass = 'sri-temp-cool'; }
        else if (!isNaN(numVal) && numVal < 24) { sriClass = 'sri-temp-comfort'; }
        else if (!isNaN(numVal) && numVal < 28) { sriClass = 'sri-temp-warm'; }
        else if (!isNaN(numVal))                { sriClass = 'sri-temp-hot'; }

      } else if (layoutType === 'sensor_humidity') {
        if      (!isNaN(numVal) && numVal < 30) { sriClass = 'sri-hum-dry'; }
        else if (!isNaN(numVal) && numVal < 40) { sriClass = 'sri-hum-low'; }
        else if (!isNaN(numVal) && numVal < 60) { sriClass = 'sri-hum-ideal'; }
        else if (!isNaN(numVal) && numVal < 70) { sriClass = 'sri-hum-high'; }
        else if (!isNaN(numVal))                { sriClass = 'sri-hum-wet'; }

      } else if (layoutType === 'sensor_co2') {
        if      (!isNaN(numVal) && numVal < 800)  { sriClass = 'sri-co2-good'; }
        else if (!isNaN(numVal) && numVal < 1200) { sriClass = 'sri-co2-mod'; }
        else if (!isNaN(numVal) && numVal < 2000) { sriClass = 'sri-co2-bad'; }
        else if (!isNaN(numVal))                  { sriClass = 'sri-co2-critical'; }

      } else if (layoutType === 'sensor_battery') {
        if      (!isNaN(numVal) && numVal > 60) { sriClass = 'sri-bat-full'; batIcon = 'battery'; }
        else if (!isNaN(numVal) && numVal > 30) { sriClass = 'sri-bat-mid';  batIcon = 'battery-low'; }
        else if (!isNaN(numVal) && numVal > 15) { sriClass = 'sri-bat-low';  batIcon = 'battery-low'; }
        else if (!isNaN(numVal))                { sriClass = 'sri-bat-crit'; batIcon = 'battery-alert'; }
        else                                    { sriClass = 'sri-bat-full'; }

      } else if (layoutType === 'sensor_energy') {
        sriClass = 'sri-energy';

      } else if (layoutType === 'sensor_illuminance') {
        if      (!isNaN(numVal) && numVal < 50)   { sriClass = 'sri-lux-dark'; }
        else if (!isNaN(numVal) && numVal < 300)  { sriClass = 'sri-lux-dim'; }
        else if (!isNaN(numVal) && numVal < 1000) { sriClass = 'sri-lux-normal'; }
        else if (!isNaN(numVal))                  { sriClass = 'sri-lux-bright'; }

      } else if (layoutType === 'sensor_pressure') {
        sriClass = 'sri-pressure';

      } else if (layoutType === 'sensor_air_quality') {
        if      (!isNaN(numVal) && numVal < 50)  { sriClass = 'sri-aq-good'; }
        else if (!isNaN(numVal) && numVal < 100) { sriClass = 'sri-aq-mod'; }
        else if (!isNaN(numVal) && numVal < 200) { sriClass = 'sri-aq-bad'; }
        else if (!isNaN(numVal))                 { sriClass = 'sri-aq-hazard'; }

      } else if (layoutType === 'sensor_electrical') {
        sriClass = 'sri-electrical';

      } else if (layoutType === 'sensor_signal') {
        if      (!isNaN(numVal) && numVal > -67) { sriClass = 'sri-sig-strong'; }
        else if (!isNaN(numVal) && numVal > -80) { sriClass = 'sri-sig-good'; }
        else if (!isNaN(numVal) && numVal > -90) { sriClass = 'sri-sig-fair'; }
        else if (!isNaN(numVal))                 { sriClass = 'sri-sig-weak'; }

      } else if (layoutType === 'sensor_gas') {
        if      (!isNaN(numVal) && numVal < 10)  { sriClass = 'sri-gas-safe'; }
        else if (!isNaN(numVal) && numVal < 35)  { sriClass = 'sri-gas-mod'; }
        else if (!isNaN(numVal) && numVal < 100) { sriClass = 'sri-gas-bad'; }
        else if (!isNaN(numVal))                 { sriClass = 'sri-gas-critical'; }

      } else if (layoutType === 'sensor_speed') {
        if      (!isNaN(numVal) && numVal < 15) { sriClass = 'sri-spd-calm'; }
        else if (!isNaN(numVal) && numVal < 30) { sriClass = 'sri-spd-breezy'; }
        else if (!isNaN(numVal) && numVal < 60) { sriClass = 'sri-spd-windy'; }
        else if (!isNaN(numVal))                { sriClass = 'sri-spd-storm'; }

      } else if (layoutType === 'sensor_water') {
        sriClass = 'sri-water';

      } else if (layoutType === 'sensor_ph') {
        if      (!isNaN(numVal) && numVal < 6.5) { sriClass = 'sri-ph-acid'; }
        else if (!isNaN(numVal) && numVal < 7.5) { sriClass = 'sri-ph-neutral'; }
        else if (!isNaN(numVal))                 { sriClass = 'sri-ph-alkaline'; }

      } else if (layoutType === 'sensor_physical') {
        sriClass = 'sri-physical';
      }

      clearBubbleClasses(bubble);
      if (batIcon && window.RP_FMT) {
        bubble.innerHTML = window.RP_FMT.getIcon(batIcon, 20, entityId);
      }
      bubble.classList.add(sriClass);
    }
  }

  return { createTile: createTile, updateTile: updateTile };

}());
