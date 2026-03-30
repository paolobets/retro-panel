/**
 * format.js — State labels, unit formatting, icon mapping
 * Exposed globally as window.RP_FMT. No ES modules — loaded as regular script.
 * Icons rendered as inline SVG via window.RP_MDI (defined in mdi-icons.js).
 */
(function () {
  'use strict';

  // Map internal icon names → MDI icon names
  var DOMAIN_ICONS = {
    bulb:        'lightbulb',
    power:       'power',
    toggle:      'toggle-switch',
    shield:      'shield-home',
    thermometer: 'thermometer',
    droplet:     'water',
    door:        'door',
    motion:      'motion-sensor',
    circle:      'circle',
    tv:          'television',
    sun:         'white-balance-sunny',
    battery:     'battery',
    lightning:   'lightning-bolt',
    plug:        'power-plug',
    fan:         'fan',
    lock:        'lock',
    vacuum:      'robot-vacuum',
    camera:      'camera',
    bell:        'bell',
    blinds:      'blinds',
    person:      'account',
    computer:    'laptop',
    heating:     'fire',
    cooling:     'snowflake',
    speaker:     'volume-high',
    water:       'water',
  };

  var _DOMAIN_FALLBACK = {
    light:               'bulb',
    switch:              'power',
    sensor:              'thermometer',
    binary_sensor:       'circle',
    alarm_control_panel: 'shield',
  };

  function getIcon(iconName, size, entityId) {
    var key = iconName;
    if (!key && entityId) {
      var domain = entityId.split('.')[0];
      key = _DOMAIN_FALLBACK[domain] || 'circle';
    }
    var mdiName = DOMAIN_ICONS[key] || key || 'circle';
    if (window.RP_MDI) {
      return window.RP_MDI(mdiName, size || 28);
    }
    return '';
  }

  function formatBrightness(value) {
    var pct = Math.round((Number(value) / 255) * 100);
    return pct + '%';
  }

  var _BINARY_SENSOR_LABELS = {
    door:      ['Open',   'Closed'],
    window:    ['Open',   'Closed'],
    motion:    ['Motion', 'Clear'],
    presence:  ['Home',   'Away'],
    moisture:  ['Wet',    'Dry'],
    smoke:     ['Smoke',  'Clear'],
    lock:      ['Locked', 'Unlocked'],
    vibration: ['Active', 'Clear'],
  };

  function getBinarySensorLabel(state, deviceClass) {
    var isOn = state === 'on';
    var pair = deviceClass && _BINARY_SENSOR_LABELS[deviceClass];
    if (pair) return isOn ? pair[0] : pair[1];
    return isOn ? 'On' : 'Off';
  }

  function formatSensorValue(state, attributes) {
    var unit = attributes && attributes.unit_of_measurement;
    if (unit) return state + ' ' + unit;
    return state;
  }

  var _ALARM_STATE_MAP = {
    disarmed:            { label: 'Disarmed',       cssClass: 'alarm-disarmed'  },
    armed_home:          { label: 'Armed Home',     cssClass: 'alarm-armed'     },
    armed_away:          { label: 'Armed Away',     cssClass: 'alarm-armed'     },
    armed_night:         { label: 'Armed Night',    cssClass: 'alarm-armed'     },
    armed_custom_bypass: { label: 'Armed',          cssClass: 'alarm-armed'     },
    pending:             { label: 'Pending\u2026',  cssClass: 'alarm-pending'   },
    arming:              { label: 'Arming\u2026',   cssClass: 'alarm-pending'   },
    disarming:           { label: 'Disarming\u2026',cssClass: 'alarm-pending'   },
    triggered:           { label: 'TRIGGERED',      cssClass: 'alarm-triggered' },
    unavailable:         { label: 'Unavailable',    cssClass: 'alarm-disarmed'  },
  };

  function getAlarmStateInfo(state) {
    return _ALARM_STATE_MAP[state] || { label: state, cssClass: 'alarm-disarmed' };
  }

  window.RP_FMT = {
    DOMAIN_ICONS: DOMAIN_ICONS,
    getIcon: getIcon,
    formatBrightness: formatBrightness,
    getBinarySensorLabel: getBinarySensorLabel,
    formatSensorValue: formatSensorValue,
    getAlarmStateInfo: getAlarmStateInfo,
  };
}());
