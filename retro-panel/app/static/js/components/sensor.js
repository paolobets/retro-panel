/**
 * sensor.js — Sensor and binary_sensor read-only tile component (v2.8.0)
 * v4 design: 22px icon-only bubble, .s-* state class on tile root, unit span.
 * No ES modules — loaded as regular script. iOS 12+ Safari safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
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
    's-door-open', 's-win-open', 's-motion-on', 's-pres-on',
    's-smoke-on', 's-moist-on', 's-lock-open', 's-vib-on', 's-bin-on',
  ];

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
    var state      = stateObj.state;
    var attrs      = stateObj.attributes || {};
    var layoutType = tile.dataset.layoutType || 'sensor_generic';

    var valEl    = tile.querySelector('.val');
    var bubble   = tile.querySelector('.bubble');
    var entityId = tile.dataset.entityId || '';

    // Handle unavailable / unknown
    if (state === 'unavailable' || state === 'unknown') {
      if (valEl) { valEl.textContent = 'N/A'; }
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
    if (batIcon && window.RP_FMT && bubble) {
      bubble.innerHTML = window.RP_FMT.getIcon(batIcon, 20, entityId);
    }
    tile.classList.add(sClass);
  }

  return { createTile: createTile, updateTile: updateTile };

}());
