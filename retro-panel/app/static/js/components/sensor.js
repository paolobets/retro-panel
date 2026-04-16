/**
 * sensor.js — Sensor and binary_sensor read-only tile component (v2.8.2)
 * v4 design: 22px icon-only bubble, .s-* state class on tile root, unit span.
 * No ES modules — loaded as regular script. iOS 12+ Safari safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
 *
 * Layout type and icon are resolved from live HA state (attrs.device_class,
 * attrs.icon) on every updateTile() call, so existing entities work correctly
 * even if device_class was not stored at config time.
 *
 * Exposes globally: window.SensorComponent = { createTile, updateTile }
 */
window.SensorComponent = (function () {
  'use strict';

  // Initial state class applied before the first updateTile() call
  var INITIAL_STATE_CLASS = {
    sensor_temperature: 's-temp-comfort',
    sensor_humidity:    's-hum-ideal',
    sensor_co2:         's-co2-good',
    sensor_battery:     's-bat-full',
    sensor_energy:      's-energy',
    sensor_illuminance: 's-lux-normal',
    sensor_pressure:    's-pressure',
    sensor_air_quality: 's-aq-good',
    sensor_generic:     's-generic',
    sensor_electrical:  's-electrical',
    sensor_signal:      's-sig-strong',
    sensor_gas:         's-gas-safe',
    sensor_speed:       's-spd-calm',
    sensor_water:       's-water',
    sensor_ph:          's-ph-neutral',
    sensor_physical:    's-physical',
    sensor_enum:        's-enum',
    sensor_datetime:    's-datetime',
    sensor_progress:    's-progress',
    binary_door:        's-off',
    binary_motion:      's-off',
    binary_standard:    's-off',
    binary_presence:    's-off',
    binary_window:      's-off',
    binary_smoke:       's-off',
    binary_moisture:    's-off',
    binary_lock:        's-off',
    binary_vibration:   's-off',
  };

  // All s-* classes — cleared before applying a new one
  var ALL_STATE_CLASSES = [
    's-off',
    's-temp-freeze', 's-temp-cold', 's-temp-cool', 's-temp-comfort', 's-temp-warm', 's-temp-hot',
    's-hum-dry', 's-hum-low', 's-hum-ideal', 's-hum-high', 's-hum-wet',
    's-co2-good', 's-co2-mod', 's-co2-bad', 's-co2-critical',
    's-bat-full', 's-bat-mid', 's-bat-low', 's-bat-crit',
    's-energy',
    's-lux-dark', 's-lux-dim', 's-lux-normal', 's-lux-bright',
    's-pressure',
    's-aq-good', 's-aq-mod', 's-aq-bad', 's-aq-hazard',
    's-electrical',
    's-sig-strong', 's-sig-good', 's-sig-fair', 's-sig-weak',
    's-gas-safe', 's-gas-mod', 's-gas-bad', 's-gas-critical',
    's-spd-calm', 's-spd-breezy', 's-spd-windy', 's-spd-storm',
    's-water',
    's-ph-acid', 's-ph-neutral', 's-ph-alkaline',
    's-physical', 's-generic',
    's-enum', 's-datetime',
    's-progress', 's-progress-full', 's-progress-mid', 's-progress-low', 's-progress-crit',
    's-door-open', 's-win-open', 's-motion-on', 's-pres-on',
    's-smoke-on', 's-moist-on', 's-lock-open', 's-vib-on', 's-bin-on',
  ];

  // Default MDI icon per layout_type (used when attrs.icon is not provided)
  var _ICON_FOR_LAYOUT = {
    sensor_temperature: 'thermometer',
    sensor_humidity:    'water-percent',
    sensor_co2:         'molecule-co2',
    sensor_battery:     'battery',
    sensor_energy:      'lightning-bolt',
    sensor_illuminance: 'brightness5',
    sensor_pressure:    'gauge',
    sensor_air_quality: 'air-filter',
    sensor_electrical:  'power-plug',
    sensor_signal:      'signal-cellular-3',
    sensor_gas:         'molecule-co2',
    sensor_speed:       'speedometer',
    sensor_water:       'water',
    sensor_ph:          'flask',
    sensor_physical:    'ruler',
    sensor_enum:        'state-machine',
    sensor_datetime:    'clock-outline',
    sensor_progress:    'gauge',
    binary_door:        'door-open',
    binary_window:      'window-open',
    binary_motion:      'motion-sensor',
    binary_presence:    'home-account',
    binary_smoke:       'smoke-detector',
    binary_moisture:    'water-percent',
    binary_lock:        'lock',
    binary_vibration:   'vibrate',
  };

  // Sensor device_class → layout_type (mirrors loader.py _compute_layout_type)
  var _DC_SENSOR_MAP = {
    'temperature':                      'sensor_temperature',
    'humidity':                         'sensor_humidity',
    'co2':                              'sensor_co2',
    'carbon_dioxide':                   'sensor_co2',
    'battery':                          'sensor_battery',
    'power':                            'sensor_energy',
    'energy':                           'sensor_energy',
    'illuminance':                      'sensor_illuminance',
    'pressure':                         'sensor_pressure',
    'atmospheric_pressure':             'sensor_pressure',
    'pm25':                             'sensor_air_quality',
    'pm10':                             'sensor_air_quality',
    'aqi':                              'sensor_air_quality',
    'volatile_organic_compounds':       'sensor_air_quality',
    'volatile_organic_compounds_parts': 'sensor_air_quality',
    'nitrogen_dioxide':                 'sensor_air_quality',
    'ozone':                            'sensor_air_quality',
    'voltage':                          'sensor_electrical',
    'current':                          'sensor_electrical',
    'apparent_power':                   'sensor_electrical',
    'reactive_power':                   'sensor_electrical',
    'power_factor':                     'sensor_electrical',
    'frequency':                        'sensor_electrical',
    'signal_strength':                  'sensor_signal',
    'carbon_monoxide':                  'sensor_gas',
    'sulphur_dioxide':                  'sensor_gas',
    'nitrous_oxide':                    'sensor_gas',
    'speed':                            'sensor_speed',
    'ph':                               'sensor_ph',
    'conductivity':                     'sensor_water',
    'precipitation':                    'sensor_water',
    'precipitation_intensity':          'sensor_water',
    'moisture':                         'sensor_water',
    'volume':                           'sensor_water',
    'volume_flow_rate':                 'sensor_water',
    'weight':                           'sensor_physical',
    'distance':                         'sensor_physical',
    'volume_storage':                   'sensor_physical',
    'duration':                         'sensor_physical',
    'pm1':                              'sensor_air_quality',
    'nitrogen_monoxide':                'sensor_gas',
    'enum':                             'sensor_enum',
    'date':                             'sensor_datetime',
    'timestamp':                        'sensor_datetime',
  };

  // Derive layout_type from live HA device_class — returns '' if unknown
  function _computeLayoutFromDC(entityId, dc) {
    if (!dc) { return ''; }
    dc = dc.toLowerCase();
    if (entityId && entityId.indexOf('binary_sensor.') === 0) {
      if (dc === 'door' || dc === 'garage_door')                      { return 'binary_door';      }
      if (dc === 'window')                                            { return 'binary_window';    }
      if (dc === 'motion')                                            { return 'binary_motion';    }
      if (dc === 'occupancy' || dc === 'presence')                    { return 'binary_presence';  }
      if (dc === 'smoke' || dc === 'gas' || dc === 'carbon_monoxide') { return 'binary_smoke';     }
      if (dc === 'moisture' || dc === 'wet')                          { return 'binary_moisture';  }
      if (dc === 'lock')                                              { return 'binary_lock';      }
      if (dc === 'vibration' || dc === 'tamper')                      { return 'binary_vibration'; }
      return 'binary_standard';
    }
    return _DC_SENSOR_MAP[dc] || 'sensor_generic';
  }

  function clearStateClasses(el) {
    for (var i = 0; i < ALL_STATE_CLASSES.length; i++) {
      el.classList.remove(ALL_STATE_CLASSES[i]);
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

    var initialClass = INITIAL_STATE_CLASS[layoutType] || 's-generic';

    var tile = document.createElement('div');
    tile.className = 'tile tile-sensor ' + initialClass;
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = layoutType;

    var bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = window.RP_FMT.getIcon(icon, 20, entity_id);

    var info = document.createElement('div');
    info.className = 'info';

    var nameEl = document.createElement('span');
    nameEl.className   = 'name';
    nameEl.textContent = label;

    var valEl = document.createElement('span');
    valEl.className   = 'val';
    valEl.textContent = '\u2014';

    info.appendChild(nameEl);
    info.appendChild(valEl);
    tile.appendChild(bubble);
    tile.appendChild(info);

    return tile;
  }

  // -----------------------------------------------------------------------
  // updateTile(tile, stateObj)
  // -----------------------------------------------------------------------
  function updateTile(tile, stateObj) {
    var state    = stateObj.state;
    var attrs    = stateObj.attributes || {};
    var entityId = tile.dataset.entityId || '';

    var valEl  = tile.querySelector('.val');
    var bubble = tile.querySelector('.bubble');

    // Resolve layout_type: prefer HA live device_class over stored value
    var storedLayout = tile.dataset.layoutType || 'sensor_generic';
    var liveLayout   = _computeLayoutFromDC(entityId, attrs.device_class || '');
    var layoutType   = liveLayout || storedLayout;

    // Persist if HA gave us a more specific type than what was stored
    if (liveLayout && liveLayout !== storedLayout) {
      tile.dataset.layoutType = liveLayout;
    }

    // Handle unavailable / unknown
    if (state === 'unavailable' || state === 'unknown') {
      if (valEl) { valEl.textContent = 'N/A'; }
      clearStateClasses(tile);
      tile.classList.add('is-unavail');
      return;
    }
    tile.classList.remove('is-unavail');

    // -----------------------------------------------------------------
    // Binary sensors
    // -----------------------------------------------------------------
    if (layoutType.indexOf('binary_') === 0) {
      if (valEl) {
        valEl.textContent = window.RP_FMT.getBinarySensorLabel(
          state, attrs.device_class || ''
        );
      }
      clearStateClasses(tile);
      if (state === 'on') {
        if      (layoutType === 'binary_door')      { tile.classList.add('s-door-open'); }
        else if (layoutType === 'binary_window')    { tile.classList.add('s-win-open');  }
        else if (layoutType === 'binary_motion')    { tile.classList.add('s-motion-on'); }
        else if (layoutType === 'binary_presence')  { tile.classList.add('s-pres-on');   }
        else if (layoutType === 'binary_smoke')     { tile.classList.add('s-smoke-on');  }
        else if (layoutType === 'binary_moisture')  { tile.classList.add('s-moist-on');  }
        else if (layoutType === 'binary_lock')      { tile.classList.add('s-lock-open'); }
        else if (layoutType === 'binary_vibration') { tile.classList.add('s-vib-on');    }
        else                                         { tile.classList.add('s-bin-on');    }
      } else {
        tile.classList.add('s-off');
      }
      // Update icon from HA or layout default
      _updateBubbleIcon(bubble, attrs, layoutType, null, entityId);
      return;
    }

    // -----------------------------------------------------------------
    // Runtime upgrade: promote sensor_generic with unit=% to sensor_progress
    // -----------------------------------------------------------------
    if (layoutType === 'sensor_generic') {
      var unitRaw = (attrs.unit_of_measurement || '').trim();
      if (unitRaw === '%') {
        layoutType = 'sensor_progress';
      }
    }

    // -----------------------------------------------------------------
    // sensor_enum — show discrete state (e.g. washer: "rinse", "spin")
    // -----------------------------------------------------------------
    if (layoutType === 'sensor_enum') {
      if (valEl) {
        var enumTxt = (state === null || state === undefined || state === '') ? '\u2014' : String(state);
        // Capitalize first letter for display
        if (enumTxt.length > 0 && enumTxt !== '\u2014') {
          enumTxt = enumTxt.charAt(0).toUpperCase() + enumTxt.slice(1).replace(/_/g, ' ');
        }
        valEl.textContent = enumTxt;
      }
      clearStateClasses(tile);
      tile.classList.add('s-enum');
      _updateBubbleIcon(bubble, attrs, layoutType, null, entityId);
      return;
    }

    // -----------------------------------------------------------------
    // sensor_datetime — format date/timestamp as friendly relative text
    // -----------------------------------------------------------------
    if (layoutType === 'sensor_datetime') {
      if (valEl) {
        valEl.textContent = _formatFriendlyDate(state);
      }
      clearStateClasses(tile);
      tile.classList.add('s-datetime');
      _updateBubbleIcon(bubble, attrs, layoutType, null, entityId);
      return;
    }

    // -----------------------------------------------------------------
    // sensor_progress — % progress bar (cartridge, RAM, storage)
    // -----------------------------------------------------------------
    if (layoutType === 'sensor_progress') {
      var pct = parseFloat(state);
      if (valEl) {
        if (isNaN(pct)) {
          valEl.textContent = '\u2014';
        } else {
          valEl.textContent = '';
          valEl.appendChild(document.createTextNode(Math.round(pct)));
          var unitSpan = document.createElement('span');
          unitSpan.className = 'unit';
          unitSpan.textContent = '%';
          valEl.appendChild(unitSpan);
        }
      }
      _renderProgressBar(tile, pct);
      clearStateClasses(tile);
      var pClass = 's-progress-full';
      if      (!isNaN(pct) && pct <= 10) { pClass = 's-progress-crit'; }
      else if (!isNaN(pct) && pct <= 25) { pClass = 's-progress-low';  }
      else if (!isNaN(pct) && pct <= 50) { pClass = 's-progress-mid';  }
      tile.classList.add('s-progress', pClass);
      _updateBubbleIcon(bubble, attrs, layoutType, null, entityId);
      return;
    }

    // -----------------------------------------------------------------
    // Regular sensors — format value with unit span
    // -----------------------------------------------------------------
    if (valEl) {
      var formatted = window.RP_FMT.formatSensorValue(state, attrs);
      var parts     = formatted.split(/\s+/);
      var num       = parts[0];
      var unit      = parts.slice(1).join(' ');
      if (unit) {
        valEl.innerHTML = num + '<span class="unit">' + unit + '</span>';
      } else {
        valEl.textContent = num;
      }
    }

    var numVal  = parseFloat(state);
    var sClass  = 's-generic';
    var batIcon = null;

    if (layoutType === 'sensor_temperature') {
      if      (!isNaN(numVal) && numVal < 5)  { sClass = 's-temp-freeze'; }
      else if (!isNaN(numVal) && numVal < 15) { sClass = 's-temp-cold';   }
      else if (!isNaN(numVal) && numVal < 19) { sClass = 's-temp-cool';   }
      else if (!isNaN(numVal) && numVal < 24) { sClass = 's-temp-comfort';}
      else if (!isNaN(numVal) && numVal < 28) { sClass = 's-temp-warm';   }
      else if (!isNaN(numVal))                { sClass = 's-temp-hot';    }

    } else if (layoutType === 'sensor_humidity') {
      if      (!isNaN(numVal) && numVal < 30) { sClass = 's-hum-dry';   }
      else if (!isNaN(numVal) && numVal < 40) { sClass = 's-hum-low';   }
      else if (!isNaN(numVal) && numVal < 60) { sClass = 's-hum-ideal'; }
      else if (!isNaN(numVal) && numVal < 70) { sClass = 's-hum-high';  }
      else if (!isNaN(numVal))                { sClass = 's-hum-wet';   }

    } else if (layoutType === 'sensor_co2') {
      if      (!isNaN(numVal) && numVal < 800)  { sClass = 's-co2-good';     }
      else if (!isNaN(numVal) && numVal < 1200) { sClass = 's-co2-mod';      }
      else if (!isNaN(numVal) && numVal < 2000) { sClass = 's-co2-bad';      }
      else if (!isNaN(numVal))                  { sClass = 's-co2-critical'; }

    } else if (layoutType === 'sensor_battery') {
      if      (!isNaN(numVal) && numVal > 60) { sClass = 's-bat-full'; batIcon = 'battery';       }
      else if (!isNaN(numVal) && numVal > 30) { sClass = 's-bat-mid';  batIcon = 'battery-low';   }
      else if (!isNaN(numVal) && numVal > 15) { sClass = 's-bat-low';  batIcon = 'battery-low';   }
      else if (!isNaN(numVal))                { sClass = 's-bat-crit'; batIcon = 'battery-alert'; }
      else                                    { sClass = 's-bat-full'; }

    } else if (layoutType === 'sensor_energy') {
      sClass = 's-energy';

    } else if (layoutType === 'sensor_illuminance') {
      if      (!isNaN(numVal) && numVal < 50)   { sClass = 's-lux-dark';   }
      else if (!isNaN(numVal) && numVal < 300)  { sClass = 's-lux-dim';    }
      else if (!isNaN(numVal) && numVal < 1000) { sClass = 's-lux-normal'; }
      else if (!isNaN(numVal))                  { sClass = 's-lux-bright'; }

    } else if (layoutType === 'sensor_pressure') {
      sClass = 's-pressure';

    } else if (layoutType === 'sensor_air_quality') {
      if      (!isNaN(numVal) && numVal < 50)  { sClass = 's-aq-good';   }
      else if (!isNaN(numVal) && numVal < 100) { sClass = 's-aq-mod';    }
      else if (!isNaN(numVal) && numVal < 200) { sClass = 's-aq-bad';    }
      else if (!isNaN(numVal))                 { sClass = 's-aq-hazard'; }

    } else if (layoutType === 'sensor_electrical') {
      sClass = 's-electrical';

    } else if (layoutType === 'sensor_signal') {
      if      (!isNaN(numVal) && numVal > -67) { sClass = 's-sig-strong'; }
      else if (!isNaN(numVal) && numVal > -80) { sClass = 's-sig-good';   }
      else if (!isNaN(numVal) && numVal > -90) { sClass = 's-sig-fair';   }
      else if (!isNaN(numVal))                 { sClass = 's-sig-weak';   }

    } else if (layoutType === 'sensor_gas') {
      if      (!isNaN(numVal) && numVal < 10)  { sClass = 's-gas-safe';     }
      else if (!isNaN(numVal) && numVal < 35)  { sClass = 's-gas-mod';      }
      else if (!isNaN(numVal) && numVal < 100) { sClass = 's-gas-bad';      }
      else if (!isNaN(numVal))                 { sClass = 's-gas-critical'; }

    } else if (layoutType === 'sensor_speed') {
      if      (!isNaN(numVal) && numVal < 15) { sClass = 's-spd-calm';   }
      else if (!isNaN(numVal) && numVal < 30) { sClass = 's-spd-breezy'; }
      else if (!isNaN(numVal) && numVal < 60) { sClass = 's-spd-windy';  }
      else if (!isNaN(numVal))                { sClass = 's-spd-storm';  }

    } else if (layoutType === 'sensor_water') {
      sClass = 's-water';

    } else if (layoutType === 'sensor_ph') {
      if      (!isNaN(numVal) && numVal < 6.5) { sClass = 's-ph-acid';     }
      else if (!isNaN(numVal) && numVal < 7.5) { sClass = 's-ph-neutral';  }
      else if (!isNaN(numVal))                 { sClass = 's-ph-alkaline'; }

    } else if (layoutType === 'sensor_physical') {
      sClass = 's-physical';
    }

    clearStateClasses(tile);
    tile.classList.add(sClass);
    _updateBubbleIcon(bubble, attrs, layoutType, batIcon, entityId);
  }

  // -----------------------------------------------------------------------
  // Format ISO date/timestamp into friendly relative Italian string.
  // Supports:
  //   - full ISO timestamp  "2026-04-15T14:30:00+00:00"
  //   - date only           "2026-04-15"
  // -----------------------------------------------------------------------
  function _formatFriendlyDate(raw) {
    if (!raw) { return '\u2014'; }
    var d = new Date(raw);
    if (isNaN(d.getTime())) { return String(raw); }
    var now = new Date();
    var diffMs = d.getTime() - now.getTime();
    var absSec = Math.abs(diffMs) / 1000;
    var past   = diffMs < 0;

    if (absSec < 60)    { return past ? 'adesso' : 'tra pochi secondi'; }
    if (absSec < 3600)  {
      var m = Math.round(absSec / 60);
      return past ? m + ' min fa' : 'tra ' + m + ' min';
    }
    if (absSec < 86400) {
      var h = Math.round(absSec / 3600);
      // If same calendar day, show HH:MM
      if (d.toDateString() === now.toDateString()) {
        var hh = ('0' + d.getHours()).slice(-2);
        var mm = ('0' + d.getMinutes()).slice(-2);
        return 'oggi ' + hh + ':' + mm;
      }
      return past ? h + ' h fa' : 'tra ' + h + ' h';
    }
    if (absSec < 7 * 86400) {
      var days = Math.round(absSec / 86400);
      return past ? days + ' g fa' : 'tra ' + days + ' g';
    }
    // Older / further: show dd/mm/yyyy
    var dd = ('0' + d.getDate()).slice(-2);
    var mo = ('0' + (d.getMonth() + 1)).slice(-2);
    var yy = d.getFullYear();
    return dd + '/' + mo + '/' + yy;
  }

  // -----------------------------------------------------------------------
  // Render/update a progress bar inside the tile (for sensor_progress).
  // Creates the bar element on first call; updates the fill width thereafter.
  // -----------------------------------------------------------------------
  function _renderProgressBar(tile, pct) {
    /* Place the bar inside .info (below name+val) so the tile's
       bubble+info flex row is not disrupted by a third full-width child. */
    var info = tile.querySelector('.info');
    if (!info) { return; }
    var bar = info.querySelector('.sensor-progress-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'sensor-progress-bar';
      var fill = document.createElement('div');
      fill.className = 'sensor-progress-fill';
      bar.appendChild(fill);
      info.appendChild(bar);
    }
    var fillEl = bar.querySelector('.sensor-progress-fill');
    if (fillEl) {
      var safePct = isNaN(pct) ? 0 : Math.max(0, Math.min(100, pct));
      fillEl.style.width = safePct + '%';
    }
  }

  // Update bubble icon: HA attrs.icon > batIcon > layout-type default
  function _updateBubbleIcon(bubble, attrs, layoutType, batIcon, entityId) {
    if (!bubble || !window.RP_FMT) { return; }
    var iconName;
    if (attrs.icon) {
      // HA-provided icon (user customization or integration default): strip "mdi:" prefix
      iconName = String(attrs.icon).replace(/^mdi:/, '');
    } else if (batIcon) {
      // Battery level icon (dynamic: battery / battery-low / battery-alert)
      iconName = batIcon;
    } else {
      // Layout-type default icon
      iconName = _ICON_FOR_LAYOUT[layoutType] || '';
    }
    if (iconName) {
      bubble.innerHTML = window.RP_FMT.getIcon(iconName, 20, entityId);
    }
  }

  return { createTile: createTile, updateTile: updateTile };

}());
