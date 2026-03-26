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

  // Binary sensor device classes that indicate presence/occupancy (ON → srt-presence)
  var BINARY_PRESENCE_CLASSES = {
    occupancy: true, presence: true,
  };

  // Binary sensor device classes that indicate critical hazard (ON → srt-critical)
  var BINARY_CRITICAL_CLASSES = {
    smoke: true, gas: true, carbon_monoxide: true,
  };

  // Icon bubble class mapping by device_class (non-binary sensors)
  var SENSOR_ICON_CLASS = {
    temperature:    'sri-temp-warm',
    humidity:       'sri-humidity',
    co2:            'sri-co2',
    carbon_dioxide: 'sri-co2',
    battery:        'sri-battery-low',
    power:          'sri-energy',
    energy:         'sri-energy',
    voltage:        'sri-energy',
    current:        'sri-energy',
    illuminance:    'sri-ok',
    _default:       'sri-ok',
  };

  // Value color class mapping by device_class (non-binary sensors)
  var SENSOR_VALUE_CLASS = {
    temperature:    'srv-temp-warm',
    humidity:       'srv-humid',
    co2:            'srv-co2',
    carbon_dioxide: 'srv-co2',
    power:          'srv-accent',
    energy:         'srv-accent',
    voltage:        'srv-muted',
    current:        'srv-muted',
    illuminance:    'srv-muted',
    _default:       '',
  };

  // All possible sri-* classes — used for cleanup before applying new class
  var ALL_SRI_CLASSES = [
    'sri-on', 'sri-off', 'sri-ok',
    'sri-temp-warm', 'sri-temp-cool',
    'sri-humidity', 'sri-co2', 'sri-battery-low',
    'sri-energy', 'sri-alert', 'sri-presence', 'sri-critical',
  ];

  // All possible srv-* classes — used for cleanup before applying new class
  var ALL_SRV_CLASSES = [
    'srv-temp-warm', 'srv-temp-cool', 'srv-humid', 'srv-co2',
    'srv-danger', 'srv-accent', 'srv-muted', 'srv-alert', 'srv-on',
  ];

  function clearSriClasses(el) {
    for (var i = 0; i < ALL_SRI_CLASSES.length; i++) {
      el.classList.remove(ALL_SRI_CLASSES[i]);
    }
  }

  function clearSrvClasses(el) {
    for (var j = 0; j < ALL_SRV_CLASSES.length; j++) {
      el.classList.remove(ALL_SRV_CLASSES[j]);
    }
  }

  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label = entityConfig.label;
    var icon = entityConfig.icon;
    var isBinary = entity_id.indexOf('binary_sensor.') === 0;
    var displayMode = entityConfig.display_mode || 'auto';
    var visualType = entityConfig.visual_type || '';

    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    // visual_type temperature/humidity → forza climate tile (come display_mode: 'climate')
    var isClimateVisualType = (visualType === 'sensor_temperature' || visualType === 'sensor_humidity');

    // Se display_mode è 'climate' oppure visual_type forza climate, crea direttamente una climate tile
    if (displayMode === 'climate' || isClimateVisualType) {
      var climateTile = DOM.createElement('div', 'tile climate-tile sensor-tile entity-sensor');
      climateTile.dataset.entityId = entity_id;
      climateTile.dataset.isBinary = 'false';
      climateTile.dataset.label = label;
      climateTile.dataset.icon = icon || '';
      climateTile.dataset.displayMode = 'climate';
      climateTile.dataset.climateForced = 'true';
      if (visualType) { climateTile.dataset.visualType = visualType; }

      var cTop = DOM.createElement('div', 'tile-top');
      var cIconEl = DOM.createElement('span', 'tile-icon');
      cIconEl.innerHTML = FMT.getIcon(icon, 28, entity_id);
      cTop.appendChild(cIconEl);

      var cBottom = DOM.createElement('div', 'tile-bottom');
      var cValueEl = DOM.createElement('span', 'tile-value', '\u2014');
      var cLabelEl = DOM.createElement('span', 'tile-label', label);
      cBottom.appendChild(cValueEl);
      cBottom.appendChild(cLabelEl);

      climateTile.appendChild(cTop);
      climateTile.appendChild(cBottom);
      return climateTile;
    }

    // Default: sensor-row-tile (anche per display_mode 'row' e 'auto', e tutti gli altri visual_type)
    var tile = DOM.createElement('div', 'tile sensor-row-tile entity-sensor state-off');
    tile.dataset.entityId = entity_id;
    tile.dataset.isBinary = isBinary ? 'true' : 'false';
    tile.dataset.label = label;
    tile.dataset.icon = icon || '';
    if (displayMode !== 'auto') {
      tile.dataset.displayMode = displayMode;
    }
    if (visualType) {
      tile.dataset.visualType = visualType;
    }

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

    tile.className = 'tile climate-tile sensor-tile entity-sensor';
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
    var forcedMode = tile.dataset.displayMode || 'auto';
    var visualType = tile.dataset.visualType || '';

    tile.classList.remove('state-on', 'state-off', 'state-unavailable');

    var valueSelector = isRowTile ? '.sensor-row-value' : '.tile-value';
    var valueEl = tile.querySelector(valueSelector);

    if (state === 'unavailable' || state === 'unknown') {
      tile.classList.add('state-unavailable');
      if (valueEl) { valueEl.textContent = 'N/A'; }
      return;
    }

    // Path climate forzato (display_mode: 'climate' impostato in createTile)
    if (tile.dataset.climateForced === 'true') {
      tile.classList.add('climate-tile', 'state-on');
      var forcedNumVal = parseFloat(state);
      if (!isNaN(forcedNumVal)) {
        var forcedPct = Math.max(0, Math.min(100, forcedNumVal));
        tile.style.setProperty('--climate-pct', String(Math.round(forcedPct)));
        tile.style.setProperty('--climate-color', 'var(--color-accent)');
      }
      var forcedClimateVal = tile.querySelector('.tile-value');
      if (forcedClimateVal) { forcedClimateVal.textContent = window.RP_FMT.formatSensorValue(state, attributes); }
      return;
    }

    if (!isBinary) {
      var dc = attributes.device_class || '';

      // Override device_class tramite visual_type
      var overrideDc = '';
      if (visualType === 'sensor_temperature')    { overrideDc = 'temperature'; }
      else if (visualType === 'sensor_humidity')  { overrideDc = 'humidity'; }
      else if (visualType === 'sensor_co2')       { overrideDc = 'co2'; }
      else if (visualType === 'sensor_battery')   { overrideDc = 'battery'; }
      else if (visualType === 'sensor_energy')    { overrideDc = 'energy'; }
      if (overrideDc) { dc = overrideDc; }

      // Auto-promozione climate: bloccata se visual_type forza un tipo sensor non-climate
      var forceRowByVisualType = (visualType && visualType.indexOf('sensor_') === 0
        && visualType !== 'sensor_temperature' && visualType !== 'sensor_humidity');

      if (dc && CLIMATE_CLASSES[dc] && forcedMode !== 'row' && !forceRowByVisualType) {
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

      // Override device_class per binary sensor tramite visual_type
      var overrideBinDc = '';
      if (visualType === 'binary_door')           { overrideBinDc = 'door'; }
      else if (visualType === 'binary_window')    { overrideBinDc = 'window'; }
      else if (visualType === 'binary_motion')    { overrideBinDc = 'motion'; }
      else if (visualType === 'binary_presence')  { overrideBinDc = 'occupancy'; }
      else if (visualType === 'binary_standard')  { overrideBinDc = ''; }

      if (overrideBinDc !== '' || visualType === 'binary_standard') {
        deviceClass = overrideBinDc;
      }

      if (rowValueEl) { rowValueEl.textContent = window.RP_FMT.getBinarySensorLabel(state, deviceClass); }
      tile.classList.add(state === 'on' ? 'state-on' : 'state-off');

      // Remove all tile state variants before reapplying
      tile.classList.remove('sensor-alert', 'srt-alert', 'srt-presence', 'srt-critical');
      if (iconWrap) { clearSriClasses(iconWrap); }

      if (state === 'on' && deviceClass) {
        if (BINARY_CRITICAL_CLASSES[deviceClass]) {
          // Critical hazard (smoke, gas, carbon_monoxide) — highest priority
          tile.classList.add('srt-critical');
          if (iconWrap) { iconWrap.classList.add('sri-critical'); }
        } else if (BINARY_PRESENCE_CLASSES[deviceClass]) {
          // Presence / occupancy
          tile.classList.add('srt-presence');
          if (iconWrap) { iconWrap.classList.add('sri-presence'); }
        } else if (BINARY_ALERT_CLASSES[deviceClass]) {
          // Motion, door, window, moisture, vibration
          tile.classList.add('sensor-alert', 'srt-alert');
          if (iconWrap) { iconWrap.classList.add('sri-alert'); }
        } else {
          if (iconWrap) { iconWrap.classList.add('sri-on'); }
        }
      } else {
        if (iconWrap) { iconWrap.classList.add('sri-ok'); }
      }
    } else {
      var dcRow = attributes.device_class || '';

      // Override device_class tramite visual_type (ramo row — dc già usato sopra con diverso scope)
      var overrideDcRow = '';
      if (visualType === 'sensor_temperature')    { overrideDcRow = 'temperature'; }
      else if (visualType === 'sensor_humidity')  { overrideDcRow = 'humidity'; }
      else if (visualType === 'sensor_co2')       { overrideDcRow = 'co2'; }
      else if (visualType === 'sensor_battery')   { overrideDcRow = 'battery'; }
      else if (visualType === 'sensor_energy')    { overrideDcRow = 'energy'; }
      if (overrideDcRow) { dcRow = overrideDcRow; }

      var numericVal = parseFloat(state);

      tile.classList.add('state-on');
      if (rowValueEl) { rowValueEl.textContent = window.RP_FMT.formatSensorValue(state, attributes); }

      // Determine icon class
      var sriClass = SENSOR_ICON_CLASS[dcRow] || SENSOR_ICON_CLASS._default;
      var srvClass = SENSOR_VALUE_CLASS[dcRow] || SENSOR_VALUE_CLASS._default;

      // Temperature warm/cool split at 18 °C
      if (dcRow === 'temperature' && !isNaN(numericVal) && numericVal < 18) {
        sriClass = 'sri-temp-cool';
        srvClass = 'srv-temp-cool';
      }

      // Battery low only below 20 % — otherwise use fallback
      if (dcRow === 'battery') {
        if (isNaN(numericVal) || numericVal >= 20) {
          sriClass = 'sri-ok';
        }
      }

      if (iconWrap) {
        clearSriClasses(iconWrap);
        if (sriClass) { iconWrap.classList.add(sriClass); }
      }
      if (rowValueEl) {
        clearSrvClasses(rowValueEl);
        if (srvClass) { rowValueEl.classList.add(srvClass); }
      }
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
