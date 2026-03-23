/**
 * alarm.js — alarm_control_panel tile component with PIN keypad
 * No ES modules — loaded as regular script. iOS 15 Safari safe.
 *
 * iOS Safari note: type="tel" with autocomplete="off" gives numeric keyboard
 * without autocomplete interference. Do NOT use type="password".
 *
 * Exposes globally: window.AlarmComponent = { createTile, updateTile }
 */
window.AlarmComponent = (function () {
  'use strict';

  var ARMED_STATES = {
    armed_home: true,
    armed_away: true,
    armed_night: true,
    armed_custom_bypass: true,
    armed_vacation: true,
  };

  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label = entityConfig.label;

    var DOM = window.RP_DOM;

    var tile = DOM.createElement('div', 'tile alarm-tile alarm-disarmed');
    tile.dataset.entityId = entity_id;

    // Header row
    var top = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon', '\uD83D\uDEE1');
    var stateText = DOM.createElement('span', 'alarm-state-text alarm-state-disarmed', 'Disarmed');
    top.appendChild(iconEl);
    top.appendChild(stateText);

    var labelEl = DOM.createElement('span', 'tile-label', label);

    // PIN display (dots)
    var pinDisplay = DOM.createElement('div', 'alarm-pin-display', '');
    pinDisplay.setAttribute('aria-label', 'PIN entry');

    // Error message
    var errorEl = DOM.createElement('div', 'alarm-error', '');

    // Keypad
    var keypad = DOM.createElement('div', 'alarm-keypad');

    var pin = '';

    function updatePinDisplay() {
      pinDisplay.textContent = '\u2022'.repeat(pin.length) || '';
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

    var keyLabels = ['1','2','3','4','5','6','7','8','9','\u232B','0',''];
    keyLabels.forEach(function (k) {
      var btn = DOM.createElement('button', 'alarm-key', k || '');
      btn.type = 'button';
      if (k === '\u232B') {
        btn.classList.add('key-delete');
        btn.addEventListener('touchend', function (e) { e.preventDefault(); deleteDigit(); });
        btn.addEventListener('click', function () { if (!('ontouchstart' in window)) deleteDigit(); });
      } else if (k === '') {
        btn.style.visibility = 'hidden';
      } else {
        btn.addEventListener('touchend', function (e) { e.preventDefault(); addDigit(k); });
        btn.addEventListener('click', function () { if (!('ontouchstart' in window)) addDigit(k); });
      }
      keypad.appendChild(btn);
    });

    // Action buttons
    var actions = DOM.createElement('div', 'alarm-actions');

    var btnArmHome = DOM.createElement('button', 'alarm-btn alarm-btn-arm-home', 'Arm Home');
    btnArmHome.type = 'button';
    btnArmHome.dataset.action = 'arm_home';

    var btnArmAway = DOM.createElement('button', 'alarm-btn alarm-btn-arm-away', 'Arm Away');
    btnArmAway.type = 'button';
    btnArmAway.dataset.action = 'arm_away';

    var btnDisarm = DOM.createElement('button', 'alarm-btn alarm-btn-disarm', 'Disarm');
    btnDisarm.type = 'button';
    btnDisarm.dataset.action = 'disarm';

    function triggerAction(service) {
      var data = { entity_id: entity_id };
      if (pin) data.code = pin;
      return window.callService('alarm_control_panel', 'alarm_' + service, data)
        .then(function () { clearPin(); })
        .catch(function (err) {
          console.error('[alarm] Service call failed:', err);
          errorEl.textContent = 'Action failed. Check PIN or HA connection.';
          clearPin();
        });
    }

    [btnArmHome, btnArmAway, btnDisarm].forEach(function (btn) {
      btn.addEventListener('touchend', function (e) {
        e.preventDefault();
        triggerAction(btn.dataset.action);
      });
      btn.addEventListener('click', function () {
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

  function updateTile(tile, stateObj) {
    var state = stateObj.state;
    var stateText = tile.querySelector('.alarm-state-text');
    var btnArmHome = tile.querySelector('[data-action="arm_home"]');
    var btnArmAway = tile.querySelector('[data-action="arm_away"]');
    var btnDisarm  = tile.querySelector('[data-action="disarm"]');

    var info = window.RP_FMT.getAlarmStateInfo(state);

    tile.classList.remove('alarm-disarmed', 'alarm-armed', 'alarm-triggered', 'alarm-pending');
    tile.classList.add(info.cssClass);

    stateText.textContent = info.label;
    stateText.className = 'alarm-state-text alarm-state-' + info.cssClass.replace('alarm-', '');

    if (state === 'disarmed') {
      btnArmHome.style.display = '';
      btnArmAway.style.display = '';
      btnDisarm.style.display = 'none';
    } else if (ARMED_STATES[state] || state === 'triggered') {
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

  return { createTile: createTile, updateTile: updateTile };
}());
