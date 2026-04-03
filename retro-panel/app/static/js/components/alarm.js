/**
 * alarm.js — alarm_control_panel tile + alarm sensor tile
 * Retro Panel v2.9.6
 *
 * No ES modules — IIFE + window globals. iOS 12+ Safari safe.
 * No const/let/=>/?./?? — only var, function declarations, IIFE pattern.
 * No CSS gap — margin-based spacing only.
 *
 * Exposes globally:
 *   window.AlarmComponent      = { createTile, updateTile }
 *   window.AlarmSensorComponent = { createTile, updateTile }
 */

/* ============================================================
   AlarmComponent
   Full alarm_control_panel tile with mode chips, PIN keypad,
   text input, and disarm flow.
   ============================================================ */
window.AlarmComponent = (function () {
  'use strict';

  /* ---- State classification ---- */
  var ARMED_STATES = {
    armed_home:          true,
    armed_away:          true,
    armed_night:         true,
    armed_custom_bypass: true,
    armed_vacation:      true
  };

  var PENDING_STATES = {
    pending:   true,
    arming:    true,
    disarming: true
  };

  /* ---- State → status-bar CSS class + Italian badge label ---- */
  var STATE_INFO = {
    disarmed:            { barClass: 'alarm-bar-disarmed',  badge: '\u25CF DISARMATO' },
    armed_home:          { barClass: 'alarm-bar-armed',     badge: '\u25CF ARMATO \u2014 CASA' },
    armed_away:          { barClass: 'alarm-bar-armed',     badge: '\u25CF ARMATO \u2014 FUORI' },
    armed_night:         { barClass: 'alarm-bar-armed',     badge: '\u25CF ARMATO \u2014 NOTTE' },
    armed_custom_bypass: { barClass: 'alarm-bar-armed',     badge: '\u25CF ARMATO' },
    armed_vacation:      { barClass: 'alarm-bar-armed',     badge: '\u25CF ARMATO \u2014 VACANZA' },
    arming:              { barClass: 'alarm-bar-pending',   badge: '\u25CF INSERIMENTO\u2026' },
    disarming:           { barClass: 'alarm-bar-pending',   badge: '\u25CF DISINSERIMENTO\u2026' },
    pending:             { barClass: 'alarm-bar-pending',   badge: '\u25CF IN ATTESA\u2026' },
    triggered:           { barClass: 'alarm-bar-triggered', badge: '\u25CF ALLARME!' },
    unavailable:         { barClass: 'alarm-bar-disarmed',  badge: '\u25CF NON DISP.' },
    unknown:             { barClass: 'alarm-bar-disarmed',  badge: '\u25CF SCONOSCIUTO' }
  };

  function _getStateInfo(state) {
    return STATE_INFO[state] || { barClass: 'alarm-bar-disarmed', badge: '\u25CF ' + (state || '?') };
  }

  /* ---- Feature bitmask constants ---- */
  var FEAT_ARM_HOME  = 1;
  var FEAT_ARM_AWAY  = 2;
  var FEAT_ARM_NIGHT = 4;

  /* ---- DOM helper ---- */
  function _el(tag, cls, text) {
    var DOM = window.RP_DOM;
    return DOM.createElement(tag, cls, text);
  }

  /* ================================================================
     createTile(cfg)
     cfg: { entity_id, label }
     ================================================================ */
  function createTile(cfg) {
    var entity_id = cfg.entity_id;
    var label     = cfg.label || entity_id;
    var DOM       = window.RP_DOM;

    /* ---- Root tile ---- */
    var tile = DOM.createElement('div', 'tile tile-alarm');
    tile.setAttribute('data-layout-type', 'alarm');
    tile.setAttribute('data-entity-id', entity_id);

    /* ---- Status bar ---- */
    var statusBar = _el('div', 'alarm-status-bar');

    var badge = _el('span', 'alarm-badge', '\u25CF DISARMATO');
    var entityName = _el('span', 'alarm-entity-name', label);

    statusBar.appendChild(badge);
    statusBar.appendChild(entityName);

    /* ---- Body ---- */
    var body = _el('div', 'alarm-body');

    /* -- Disarmed section: mode chips -- */
    var modesSection = _el('div', 'alarm-modes-section');

    var modesLabel = _el('div', 'alarm-modes-label', 'Seleziona modalit\u00e0:');

    var modesRow = _el('div', 'alarm-modes-row');

    var chipHome  = _buildModeChip('home',  '\uD83C\uDFE0 Casa');
    var chipAway  = _buildModeChip('away',  '\uD83D\uDE97 Fuori');
    var chipNight = _buildModeChip('night', '\uD83C\uDF19 Notte');

    modesRow.appendChild(chipHome);
    modesRow.appendChild(chipAway);
    modesRow.appendChild(chipNight);

    modesSection.appendChild(modesLabel);
    modesSection.appendChild(modesRow);

    /* -- Armed section: disarm -- */
    var disarmSection = _el('div', 'alarm-disarm-section');
    var disarmLabel   = _el('div', 'alarm-disarm-label', 'Codice disarmo:');
    var disarmBtn     = _el('button', 'alarm-disarm-btn', 'Disarma');
    disarmBtn.type = 'button';
    disarmSection.appendChild(disarmLabel);
    /* PIN area inserted before disarmBtn in updateTile via DOM order;
       we append disarmBtn after pinArea below */

    /* -- Triggered banner -- */
    var triggeredBanner = _el('div', 'alarm-triggered-banner', '\u26A0\uFE0F Allarme rilevato');

    /* -- PIN area (shared: numeric keypad OR text input) -- */
    var pinArea      = _el('div', 'alarm-pin-area');
    var pinDisplay   = _el('div', 'alarm-pin-display', '');
    var textInput    = _el('input', 'alarm-text-input');
    textInput.type = 'text';
    textInput.setAttribute('autocomplete', 'off');
    textInput.setAttribute('autocorrect', 'off');
    textInput.setAttribute('autocapitalize', 'none');
    textInput.setAttribute('spellcheck', 'false');
    textInput.setAttribute('placeholder', 'Inserisci codice\u2026');
    var keypad       = _el('div', 'alarm-keypad');
    var pinError     = _el('div', 'alarm-pin-error', '');
    var confirmBtn   = _el('button', 'alarm-confirm-btn', 'Conferma');
    confirmBtn.type  = 'button';

    pinArea.appendChild(pinDisplay);
    pinArea.appendChild(textInput);
    pinArea.appendChild(keypad);
    pinArea.appendChild(pinError);
    pinArea.appendChild(confirmBtn);

    /* Build numeric keypad keys */
    var keyLabels = ['1','2','3','4','5','6','7','8','9','\u232B','0',''];
    var i;
    for (i = 0; i < keyLabels.length; i++) {
      var k = keyLabels[i];
      var keyBtn = _el('button', 'alarm-key', k);
      keyBtn.type = 'button';
      if (k === '\u232B') {
        keyBtn.className = 'alarm-key key-delete';
        /* Use closure to bind delete action */
        (function (btn) {
          btn.addEventListener('touchend', function (e) { e.preventDefault(); _deleteDigit(); });
          btn.addEventListener('click',    function ()  { if (!('ontouchstart' in window)) { _deleteDigit(); } });
        }(keyBtn));
      } else if (k === '') {
        keyBtn.style.visibility = 'hidden';
      } else {
        /* Capture digit in closure */
        (function (btn, digit) {
          btn.addEventListener('touchend', function (e) { e.preventDefault(); _addDigit(digit); });
          btn.addEventListener('click',    function ()  { if (!('ontouchstart' in window)) { _addDigit(digit); } });
        }(keyBtn, k));
      }
      keypad.appendChild(keyBtn);
    }

    disarmSection.appendChild(pinArea);
    disarmSection.appendChild(disarmBtn);

    /* Hide all optional sections initially; updateTile() shows what's needed */
    modesSection.style.display   = 'none';
    disarmSection.style.display  = 'none';
    triggeredBanner.style.display= 'none';
    pinArea.style.display        = 'none';

    body.appendChild(modesSection);
    body.appendChild(disarmSection);
    body.appendChild(triggeredBanner);

    tile.appendChild(statusBar);
    tile.appendChild(body);

    /* ---- Internal PIN state ---- */
    var _pin = '';
    var _selectedMode = '';

    function _updatePinDisplay() {
      pinDisplay.textContent = '\u2022'.repeat(_pin.length);
    }

    function _addDigit(digit) {
      if (_pin.length < 8) {
        _pin += digit;
        _updatePinDisplay();
        pinError.textContent = '';
      }
    }

    function _deleteDigit() {
      if (_pin.length > 0) {
        _pin = _pin.slice(0, -1);
        _updatePinDisplay();
      }
    }

    function _clearPin() {
      _pin = '';
      _updatePinDisplay();
      textInput.value = '';
      pinError.textContent = '';
    }

    function _shakePin() {
      pinDisplay.classList.remove('alarm-pin-shake');
      /* Force reflow to restart animation */
      void pinDisplay.offsetWidth;
      pinDisplay.classList.add('alarm-pin-shake');
    }

    function _showError(msg) {
      pinError.textContent = msg;
      _shakePin();
      _clearPin();
    }

    /* ---- Mode chip selection ---- */
    function _selectModeChip(chip) {
      var chips = modesRow.querySelectorAll('.alarm-mode-chip');
      var j;
      for (j = 0; j < chips.length; j++) {
        chips[j].classList.remove('alarm-mode-chip-selected');
      }
      if (chip) {
        chip.classList.add('alarm-mode-chip-selected');
        _selectedMode = chip.getAttribute('data-mode');
      } else {
        _selectedMode = '';
      }
    }

    /* Chip tap handlers */
    function _makeChipHandler(chip) {
      chip.addEventListener('touchend', function (e) {
        e.preventDefault();
        if (chip.classList.contains('alarm-mode-chip-selected')) {
          _selectModeChip(null);
        } else {
          _selectModeChip(chip);
        }
      });
      chip.addEventListener('click', function () {
        if (!('ontouchstart' in window)) {
          if (chip.classList.contains('alarm-mode-chip-selected')) {
            _selectModeChip(null);
          } else {
            _selectModeChip(chip);
          }
        }
      });
    }
    _makeChipHandler(chipHome);
    _makeChipHandler(chipAway);
    _makeChipHandler(chipNight);

    /* ---- Service call helpers ---- */
    function _getPin(codeFormat) {
      if (codeFormat === 'text') {
        return textInput.value;
      }
      return _pin;
    }

    function _callAlarm(service, pinVal) {
      var data = { entity_id: entity_id };
      if (pinVal !== '') { data.code = pinVal; }
      return window.callService('alarm_control_panel', service, data);
    }

    /* Confirm button: depends on current tile state */
    confirmBtn.addEventListener('touchend', function (e) {
      e.preventDefault();
      _handleConfirm();
    });
    confirmBtn.addEventListener('click', function () {
      if (!('ontouchstart' in window)) { _handleConfirm(); }
    });

    function _handleConfirm() {
      var currentState = tile.getAttribute('data-alarm-state') || 'disarmed';
      var codeFormat   = tile.getAttribute('data-code-format') || '';
      var pinVal       = _getPin(codeFormat);

      if (currentState === 'disarmed') {
        /* Arming — need a mode selected */
        var mode = _selectedMode || 'home';
        var armService = 'alarm_arm_' + mode;
        _callAlarm(armService, pinVal)
          .then(function () { _clearPin(); })
          .catch(function (err) {
            console.error('[alarm] arm failed:', err);
            _showError('Operazione fallita. Verificare il codice.');
          });
      } else {
        /* Disarm or cancel triggered */
        _callAlarm('alarm_disarm', pinVal)
          .then(function () { _clearPin(); })
          .catch(function (err) {
            console.error('[alarm] disarm failed:', err);
            _showError('Codice errato o connessione persa.');
          });
      }
    }

    /* Disarm button (armed section, no-code path) */
    disarmBtn.addEventListener('touchend', function (e) {
      e.preventDefault();
      _handleDisarmBtn();
    });
    disarmBtn.addEventListener('click', function () {
      if (!('ontouchstart' in window)) { _handleDisarmBtn(); }
    });

    function _handleDisarmBtn() {
      var codeFormat = tile.getAttribute('data-code-format') || '';
      var pinVal     = _getPin(codeFormat);
      _callAlarm('alarm_disarm', pinVal)
        .then(function () { _clearPin(); })
        .catch(function (err) {
          console.error('[alarm] disarm btn failed:', err);
          _showError('Codice errato o connessione persa.');
        });
    }

    /* ---- Store refs ---- */
    tile._alarm = {
      badge:          badge,
      statusBar:      statusBar,
      entityName:     entityName,
      modesSection:   modesSection,
      modesLabel:     modesLabel,
      modesRow:       modesRow,
      chipHome:       chipHome,
      chipAway:       chipAway,
      chipNight:      chipNight,
      disarmSection:  disarmSection,
      disarmLabel:    disarmLabel,
      disarmBtn:      disarmBtn,
      triggeredBanner:triggeredBanner,
      pinArea:        pinArea,
      pinDisplay:     pinDisplay,
      textInput:      textInput,
      keypad:         keypad,
      pinError:       pinError,
      confirmBtn:     confirmBtn,
      clearPin:       _clearPin
    };

    return tile;
  }

  /* Helper: build a single mode chip */
  function _buildModeChip(mode, text) {
    var chip = _el('button', 'alarm-mode-chip', text);
    chip.type = 'button';
    chip.setAttribute('data-mode', mode);
    return chip;
  }

  /* ================================================================
     updateTile(tile, stateObj)
     ================================================================ */
  function updateTile(tile, stateObj) {
    var r = tile._alarm;
    if (!r) { return; }

    var state      = stateObj.state || 'unknown';
    var attrs      = stateObj.attributes || {};
    var codeFormat = attrs.code_format || null;        /* "number" | "text" | null */
    var codeArm    = attrs.code_arm_required !== false; /* default true */
    var features   = attrs.supported_features || 0;

    var isDisarmed  = (state === 'disarmed');
    var isArmed     = !!ARMED_STATES[state];
    var isPending   = !!PENDING_STATES[state];
    var isTriggered = (state === 'triggered');
    var isUnavail   = (state === 'unavailable' || state === 'unknown');

    /* Store on tile for use in handlers */
    tile.setAttribute('data-alarm-state', state);
    tile.setAttribute('data-code-format', codeFormat || '');

    /* ---- Status bar ---- */
    var info = _getStateInfo(state);
    r.badge.textContent = info.badge;

    r.statusBar.className = 'alarm-status-bar ' + info.barClass;

    /* Pulsing for triggered */
    if (isTriggered) {
      r.statusBar.classList.add('alarm-bar-pulse');
    } else {
      r.statusBar.classList.remove('alarm-bar-pulse');
    }

    /* ---- Mode chips visibility ---- */
    var showHome  = !!(features & FEAT_ARM_HOME);
    var showAway  = !!(features & FEAT_ARM_AWAY);
    var showNight = !!(features & FEAT_ARM_NIGHT);

    _setDisplay(r.chipHome,  showHome  ? '' : 'none');
    _setDisplay(r.chipAway,  showAway  ? '' : 'none');
    _setDisplay(r.chipNight, showNight ? '' : 'none');

    /* ---- Section visibility ---- */
    _setDisplay(r.modesSection,    isDisarmed ? '' : 'none');
    _setDisplay(r.disarmSection,   (isArmed || isPending) ? '' : 'none');
    _setDisplay(r.triggeredBanner, isTriggered ? '' : 'none');

    /* Modes label: only if there are visible chips AND arm requires code or user needs to pick */
    var anyChip = showHome || showAway || showNight;
    _setDisplay(r.modesLabel, anyChip ? '' : 'none');

    /* ---- PIN area ---- */
    /* Show PIN area when:
       - disarmed + (code_arm_required=true OR code_format set)
       - armed/pending + code_format set
       - triggered (always show) */
    var showPin = false;
    if (isDisarmed) {
      showPin = (codeFormat !== null) && codeArm;
    } else if (isArmed || isPending) {
      showPin = (codeFormat !== null);
    } else if (isTriggered) {
      showPin = true;
    }

    _setDisplay(r.pinArea, showPin ? '' : 'none');

    /* ---- Disarm label & button visibility (armed/pending section) ---- */
    _setDisplay(r.disarmLabel, (codeFormat !== null) ? '' : 'none');

    /* ---- Switch keypad vs text input ---- */
    var useKeypad = (codeFormat === 'number' || codeFormat === null);
    _setDisplay(r.keypad,    (showPin && useKeypad)  ? '' : 'none');
    _setDisplay(r.pinDisplay,(showPin && useKeypad)  ? '' : 'none');
    _setDisplay(r.textInput, (showPin && !useKeypad) ? '' : 'none');

    /* ---- Confirm button label ---- */
    if (isDisarmed) {
      r.confirmBtn.textContent = 'Arma';
    } else {
      r.confirmBtn.textContent = 'Disarma';
    }

    /* ---- Unavailable: disable interactions ---- */
    var disabled = isUnavail;
    r.confirmBtn.disabled = disabled;
    r.disarmBtn.disabled  = disabled;
    r.chipHome.disabled   = disabled;
    r.chipAway.disabled   = disabled;
    r.chipNight.disabled  = disabled;
    r.textInput.disabled  = disabled;

    if (disabled) {
      tile.style.opacity = '0.5';
    } else {
      tile.style.opacity = '';
    }
  }

  function _setDisplay(el, val) {
    if (el) { el.style.display = val; }
  }

  return { createTile: createTile, updateTile: updateTile };
}());


/* ============================================================
   AlarmSensorComponent
   Compact binary sensor tile for alarm zone dashboard.
   ============================================================ */
window.AlarmSensorComponent = (function () {
  'use strict';

  /* device_class → { icon, ok, alert } */
  var DEVICE_CLASS_MAP = {
    door:      { icon: '\uD83D\uDEAA', ok: 'Chiusa',    alert: 'Aperta'     },
    window:    { icon: '\uD83E\uDE9F', ok: 'Chiusa',    alert: 'Aperta'     },
    motion:    { icon: '\uD83C\uDFC3', ok: 'Libero',    alert: 'Rilevato'   },
    presence:  { icon: '\uD83D\uDC64', ok: 'Assente',   alert: 'Presente'   },
    occupancy: { icon: '\uD83D\uDC65', ok: 'Libero',    alert: 'Occupato'   },
    vibration: { icon: '\uD83D\uDCF3', ok: 'Stabile',   alert: 'Vibrazione' },
    smoke:     { icon: '\uD83D\uDCA8', ok: 'OK',        alert: 'Rilevato'   },
    moisture:  { icon: '\uD83D\uDCA7', ok: 'Asciutto',  alert: 'Umidit\u00e0' }
  };

  var DEFAULT_CLASS_INFO = { icon: '\u25CF', ok: 'OK', alert: 'Attivo' };

  function _getClassInfo(deviceClass) {
    return DEVICE_CLASS_MAP[deviceClass] || DEFAULT_CLASS_INFO;
  }

  /* ================================================================
     createTile(cfg)
     cfg: { entity_id, label, device_class }
     ================================================================ */
  function createTile(cfg) {
    var entity_id    = cfg.entity_id;
    var label        = cfg.label || entity_id;
    var device_class = cfg.device_class || '';
    var DOM          = window.RP_DOM;

    var info = _getClassInfo(device_class);

    var tile = DOM.createElement('div', 'tile tile-alarm-sensor');
    tile.setAttribute('data-layout-type', 'alarm_sensor');
    tile.setAttribute('data-entity-id', entity_id);
    tile.setAttribute('data-device-class', device_class);

    var iconEl  = DOM.createElement('span', 'as-icon', info.icon);
    var infoDiv = DOM.createElement('div',  'as-info');
    var nameEl  = DOM.createElement('span', 'as-name',  label);
    var stateEl = DOM.createElement('span', 'as-state', info.ok);
    var dotEl   = DOM.createElement('span', 'as-dot', '');

    infoDiv.appendChild(nameEl);
    infoDiv.appendChild(stateEl);

    tile.appendChild(iconEl);
    tile.appendChild(infoDiv);
    tile.appendChild(dotEl);

    tile._alarmSensor = {
      iconEl:  iconEl,
      stateEl: stateEl,
      dotEl:   dotEl
    };

    return tile;
  }

  /* ================================================================
     updateTile(tile, stateObj)
     ================================================================ */
  function updateTile(tile, stateObj) {
    var r = tile._alarmSensor;
    if (!r) { return; }

    var state        = stateObj.state || 'unknown';
    var device_class = tile.getAttribute('data-device-class') || '';
    var info         = _getClassInfo(device_class);

    /* Remove all state classes */
    tile.classList.remove('as-alert', 'as-ok', 'as-unavail');
    r.dotEl.classList.remove('as-dot-alert', 'as-dot-ok', 'as-dot-unavail');

    if (state === 'unavailable' || state === 'unknown') {
      tile.classList.add('as-unavail');
      r.dotEl.classList.add('as-dot-unavail');
      r.stateEl.textContent = 'N/D';
    } else if (state === 'on') {
      tile.classList.add('as-alert');
      r.dotEl.classList.add('as-dot-alert');
      r.stateEl.textContent = info.alert;
    } else {
      /* off = ok */
      tile.classList.add('as-ok');
      r.dotEl.classList.add('as-dot-ok');
      r.stateEl.textContent = info.ok;
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
