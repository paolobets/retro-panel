/**
 * format.js — State labels, unit formatting, icon mapping
 * ES2017-compatible, no external dependencies.
 */

/** Map entity domain prefix to Unicode icon */
export const DOMAIN_ICONS = {
  bulb: '💡',
  toggle: '⚡',
  shield: '🛡',
  thermometer: '🌡',
  droplet: '💧',
  door: '🚪',
  motion: '👁',
  circle: '⬤',
  tv: '📺',
};

/**
 * Get a Unicode icon character for a given icon name.
 * @param {string} iconName
 * @returns {string}
 */
export function getIcon(iconName) {
  return DOMAIN_ICONS[iconName] || DOMAIN_ICONS.circle;
}

/**
 * Convert a 0-255 brightness value to a 0-100% string.
 * @param {number|string} value
 * @returns {string}
 */
export function formatBrightness(value) {
  const pct = Math.round((Number(value) / 255) * 100);
  return `${pct}%`;
}

// Maps indexed by device_class; values are [onLabel, offLabel] pairs.
const _BINARY_SENSOR_LABELS = {
  door:      ['Open',   'Closed'],
  window:    ['Open',   'Closed'],
  motion:    ['Motion', 'Clear'],
  presence:  ['Home',   'Away'],
  moisture:  ['Wet',    'Dry'],
  smoke:     ['Smoke',  'Clear'],
  lock:      ['Locked', 'Unlocked'],
  vibration: ['Active', 'Clear'],
};

/**
 * Map binary_sensor state + device_class to a human label.
 * @param {string} state  "on" | "off"
 * @param {string} [deviceClass]
 * @returns {string}
 */
export function getBinarySensorLabel(state, deviceClass) {
  const isOn = state === 'on';
  const pair = deviceClass && _BINARY_SENSOR_LABELS[deviceClass];
  if (pair) return isOn ? pair[0] : pair[1];
  return isOn ? 'On' : 'Off';
}

/**
 * Format a sensor state value with its unit.
 * @param {string} state
 * @param {object} attributes
 * @returns {string}
 */
export function formatSensorValue(state, attributes) {
  const unit = attributes && attributes.unit_of_measurement;
  if (unit) return `${state} ${unit}`;
  return state;
}

const _ALARM_STATE_MAP = {
  disarmed:    { label: 'Disarmed',    cssClass: 'alarm-disarmed' },
  armed_home:  { label: 'Armed Home',  cssClass: 'alarm-armed' },
  armed_away:  { label: 'Armed Away',  cssClass: 'alarm-armed' },
  armed_night: { label: 'Armed Night', cssClass: 'alarm-armed' },
  armed_custom_bypass: { label: 'Armed', cssClass: 'alarm-armed' },
  pending:     { label: 'Pending…',    cssClass: 'alarm-pending' },
  arming:      { label: 'Arming…',     cssClass: 'alarm-pending' },
  disarming:   { label: 'Disarming…',  cssClass: 'alarm-pending' },
  triggered:   { label: 'TRIGGERED',   cssClass: 'alarm-triggered' },
  unavailable: { label: 'Unavailable', cssClass: 'alarm-disarmed' },
};

/**
 * Map an alarm_control_panel state to a display label and CSS class.
 * @param {string} state
 * @returns {{ label: string, cssClass: string }}
 */
export function getAlarmStateInfo(state) {
  return _ALARM_STATE_MAP[state] || { label: state, cssClass: 'alarm-disarmed' };
}
