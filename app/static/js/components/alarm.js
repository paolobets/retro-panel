/**
 * alarm.js — alarm_control_panel tile component with PIN keypad
 * ES2017-compatible, iOS 15 Safari safe.
 *
 * iOS Safari note: type="tel" with autocomplete="off" gives numeric keyboard
 * without autocomplete interference. Do NOT use type="password".
 */

import { createElement } from '../utils/dom.js';
import { getAlarmStateInfo } from '../utils/format.js';
import { callService } from '../api.js';

const ARMED_STATES = new Set([
  'armed_home', 'armed_away', 'armed_night',
  'armed_custom_bypass', 'armed_vacation',
]);

/**
 * Create an alarm_control_panel tile with PIN keypad.
 * @param {object} entityConfig  { entity_id, label, icon }
 * @returns {HTMLElement}
 */
export function createTile(entityConfig) {
  const { entity_id, label } = entityConfig;

  const tile = createElement('div', 'tile alarm-tile alarm-disarmed');
  tile.dataset.entityId = entity_id;

  // Header row
  const top = createElement('div', 'tile-top');
  const iconEl = createElement('span', 'tile-icon', '🛡');
  const stateText = createElement('span', 'alarm-state-text alarm-state-disarmed', 'Disarmed');
  top.appendChild(iconEl);
  top.appendChild(stateText);

  // Label
  const labelEl = createElement('span', 'tile-label', label);

  // PIN display (dots)
  const pinDisplay = createElement('div', 'alarm-pin-display', '');
  pinDisplay.setAttribute('aria-label', 'PIN entry');

  // Error message
  const errorEl = createElement('div', 'alarm-error', '');

  // Keypad
  const keypad = createElement('div', 'alarm-keypad');

  // Store PIN in closure
  let pin = '';

  function updatePinDisplay() {
    pinDisplay.textContent = '•'.repeat(pin.length) || '';
  }

  function addDigit(digit) {
    if (pin.length < 8) {
      pin += digit;
      updatePinDisplay();
      errorEl.textContent = '';
    }
  }

  function deleteDigit() {
    if (pin.length > 0) {
      pin = pin.slice(0, -1);
      updatePinDisplay();
    }
  }

  function clearPin() {
    pin = '';
    updatePinDisplay();
  }

  // Keypad buttons: 1-9, delete, 0, confirm (handled via action buttons)
  const keyLabels = ['1','2','3','4','5','6','7','8','9','⌫','0',''];
  keyLabels.forEach(function(k) {
    const btn = createElement('button', 'alarm-key', k || '');
    btn.type = 'button';
    if (k === '⌫') {
      btn.classList.add('key-delete');
      btn.addEventListener('touchend', function(e) { e.preventDefault(); deleteDigit(); });
      btn.addEventListener('click', function() { if (!('ontouchstart' in window)) deleteDigit(); });
    } else if (k === '') {
      // Empty placeholder cell
      btn.style.visibility = 'hidden';
    } else {
      btn.addEventListener('touchend', function(e) { e.preventDefault(); addDigit(k); });
      btn.addEventListener('click', function() { if (!('ontouchstart' in window)) addDigit(k); });
    }
    keypad.appendChild(btn);
  });

  // Action buttons container
  const actions = createElement('div', 'alarm-actions');

  // Arm Home
  const btnArmHome = createElement('button', 'alarm-btn alarm-btn-arm-home', 'Arm Home');
  btnArmHome.type = 'button';
  btnArmHome.dataset.action = 'arm_home';

  // Arm Away
  const btnArmAway = createElement('button', 'alarm-btn alarm-btn-arm-away', 'Arm Away');
  btnArmAway.type = 'button';
  btnArmAway.dataset.action = 'arm_away';

  // Disarm
  const btnDisarm = createElement('button', 'alarm-btn alarm-btn-disarm', 'Disarm');
  btnDisarm.type = 'button';
  btnDisarm.dataset.action = 'disarm';

  async function triggerAction(service) {
    const data = { entity_id };
    if (pin) data.code = pin;

    try {
      await callService('alarm_control_panel', `alarm_${service}`, data);
      clearPin();
    } catch (err) {
      console.error('[alarm] Service call failed:', err);
      errorEl.textContent = 'Action failed. Check PIN or HA connection.';
      clearPin();
    }
  }

  [btnArmHome, btnArmAway, btnDisarm].forEach(function(btn) {
    btn.addEventListener('touchend', function(e) {
      e.preventDefault();
      triggerAction(btn.dataset.action);
    });
    btn.addEventListener('click', function() {
      if (!('ontouchstart' in window)) triggerAction(btn.dataset.action);
    });
  });

  actions.appendChild(btnArmHome);
  actions.appendChild(btnArmAway);
  actions.appendChild(btnDisarm);

  tile.appendChild(top);
  tile.appendChild(labelEl);
  tile.appendChild(pinDisplay);
  tile.appendChild(errorEl);
  tile.appendChild(keypad);
  tile.appendChild(actions);

  return tile;
}

/**
 * Update an alarm tile in-place with new state.
 * @param {HTMLElement} tile
 * @param {{ state: string, attributes: object }} stateObj
 */
export function updateTile(tile, stateObj) {
  const { state } = stateObj;
  const stateText = tile.querySelector('.alarm-state-text');
  const btnArmHome = tile.querySelector('[data-action="arm_home"]');
  const btnArmAway = tile.querySelector('[data-action="arm_away"]');
  const btnDisarm  = tile.querySelector('[data-action="disarm"]');

  const { label, cssClass } = getAlarmStateInfo(state);

  // Update tile class
  tile.classList.remove('alarm-disarmed', 'alarm-armed', 'alarm-triggered', 'alarm-pending');
  tile.classList.add(cssClass);

  // Update state text and its color class
  stateText.textContent = label;
  stateText.className = `alarm-state-text alarm-state-${cssClass.replace('alarm-', '')}`;

  // Show/hide buttons based on state
  if (state === 'disarmed') {
    btnArmHome.style.display = '';
    btnArmAway.style.display = '';
    btnDisarm.style.display = 'none';
  } else if (ARMED_STATES.has(state) || state === 'triggered') {
    btnArmHome.style.display = 'none';
    btnArmAway.style.display = 'none';
    btnDisarm.style.display = '';
    if (state === 'triggered') {
      btnDisarm.className = 'alarm-btn alarm-btn-disarm-danger';
    } else {
      btnDisarm.className = 'alarm-btn alarm-btn-disarm';
    }
  } else {
    // pending / arming / disarming
    btnArmHome.style.display = 'none';
    btnArmAway.style.display = 'none';
    btnDisarm.style.display = '';
    btnDisarm.className = 'alarm-btn alarm-btn-disarm';
  }
}
