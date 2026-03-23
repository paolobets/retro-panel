/**
 * format.js — State labels, unit formatting, icon mapping
 * Exposed globally as window.RP_FMT. No ES modules — loaded as regular script.
 */
(function () {
  'use strict';

  var DOMAIN_ICONS = {
    bulb:        '\uD83D\uDCA1',   // 💡 light
    toggle:      '\uD83D\uDD18',   // 🔘 switch
    shield:      '\uD83D\uDEE1',   // 🛡 alarm
    thermometer: '\uD83C\uDF21',   // 🌡 temperature
    droplet:     '\uD83D\uDCA7',   // 💧 humidity
    door:        '\uD83D\uDEAA',   // 🚪 door/cover
    motion:      '\uD83D\uDC41',   // 👁 motion
    circle:      '\u2B24',         // ⬤ generic sensor
    tv:          '\uD83D\uDCFA',   // 📺 media player
    sun:         '\u2600',         // ☀ solar / weather
    battery:     '\uD83D\uDD0B',   // 🔋 battery
    lightning:   '\u26A1',         // ⚡ power / grid / energy
    plug:        '\uD83D\uDD0C',   // 🔌 socket / plug
    fan:         '\uD83C\uDF00',   // 🌀 fan
    lock:        '\uD83D\uDD12',   // 🔒 lock
    vacuum:      '\uD83E\uDD16',   // 🤖 robot vacuum
    camera:      '\uD83D\uDCF7',   // 📷 camera
    bell:        '\uD83D\uDD14',   // 🔔 alert / smoke
    blinds:      '\uD83E\uDE9F',   // 🪟 cover/blinds/window
    person:      '\uD83D\uDEB6',   // 🚶 presence / person
    computer:    '\uD83D\uDCBB',   // 💻 computer
    heating:     '\uD83D\uDD25',   // 🔥 heating
    cooling:     '\u2744',         // ❄ cooling
    speaker:     '\uD83D\uDD0A',   // 🔊 media / speaker
    water:       '\uD83D\uDEBF',   // 🚿 water / shower
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
