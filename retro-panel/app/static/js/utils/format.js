/**
 * format.js — State labels, unit formatting, icon mapping
 * Exposed globally as window.RP_FMT. No ES modules — loaded as regular script.
 */
(function () {
  'use strict';

  var DOMAIN_ICONS = {
    bulb: '\uD83D\uDCA1',
    toggle: '\u26A1',
    shield: '\uD83D\uDEE1',
    thermometer: '\uD83C\uDF21',
    droplet: '\uD83D\uDCA7',
    door: '\uD83D\uDEAA',
    motion: '\uD83D\uDC41',
    circle: '\u2B24',
    tv: '\uD83D\uDCFA',
  };

  function getIcon(iconName) {
    return DOMAIN_ICONS[iconName] || DOMAIN_ICONS.circle;
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
    disarmed:            { label: 'Disarmed',    cssClass: 'alarm-disarmed'  },
    armed_home:          { label: 'Armed Home',  cssClass: 'alarm-armed'     },
    armed_away:          { label: 'Armed Away',  cssClass: 'alarm-armed'     },
    armed_night:         { label: 'Armed Night', cssClass: 'alarm-armed'     },
    armed_custom_bypass: { label: 'Armed',       cssClass: 'alarm-armed'     },
    pending:             { label: 'Pending\u2026',   cssClass: 'alarm-pending'   },
    arming:              { label: 'Arming\u2026',    cssClass: 'alarm-pending'   },
    disarming:           { label: 'Disarming\u2026', cssClass: 'alarm-pending'   },
    triggered:           { label: 'TRIGGERED',   cssClass: 'alarm-triggered' },
    unavailable:         { label: 'Unavailable', cssClass: 'alarm-disarmed'  },
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
