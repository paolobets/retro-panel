/**
 * alarm.js — alarm_control_panel tile + alarm sensor tile
 * Retro Panel v2.9.12
 *
 * No ES modules — IIFE + window globals. iOS 12+ Safari safe.
 * No const/let/=>/?./?? — only var, function declarations, IIFE pattern.
 * No CSS gap — margin-based spacing only.
 *
 * Exposes globally:
 *   window.AlarmComponent      = { createTile, updateTile }
 *   window.AlarmSensorComponent = { createTile, updateTile }
 *
 * Fix v2.9.12:
 *   - pinArea moved to body level (was trapped inside hidden disarmSection)
 *   - Chip handlers arm directly when code_format=null (no-code scenario)
 *   - barClass fixed to match CSS s-* naming convention
 *   - Badge split into dot+text elements for per-state color support
 *   - Chip selection uses chip-selected (matches CSS)
 *   - Emoji removed from chip labels
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

  /* ---- Armed state → sub-label shown below entity name ---- */
  var ARMED_MODE_LABELS = {
    armed_home:          'Modalit\u00e0: Casa',
    armed_away:          'Modalit\u00e0: Fuori',
    armed_night:         'Modalit\u00e0: Notte',
    armed_custom_bypass: 'Modalit\u00e0: Personalizzata',
    armed_vacation:      'Modalit\u00e0: Vacanza'
  };

  /*
   * State → status-bar CSS class + badge dot/text classes + Italian label.
   * barClass matches CSS: .alarm-status-bar.s-*
   * dotClass matches CSS: .alarm-badge-dot.dot-*
   * textClass matches CSS: .alarm-badge-text.text-*
   */
  var STATE_INFO = {
    disarmed:            { barClass: 's-disarmed',  dotClass: 'dot-disarmed',  textClass: 'text-disarmed',  label: 'DISARMATO' },
    armed_home:          { barClass: 's-armed',     dotClass: 'dot-armed',     textClass: 'text-armed',     label: 'ARMATO \u2014 CASA' },
    armed_away:          { barClass: 's-armed',     dotClass: 'dot-armed',     textClass: 'text-armed',     label: 'ARMATO \u2014 FUORI' },
    armed_night:         { barClass: 's-armed',     dotClass: 'dot-armed',     textClass: 'text-armed',     label: 'ARMATO \u2014 NOTTE' },
    armed_custom_bypass: { barClass: 's-armed',     dotClass: 'dot-armed',     textClass: 'text-armed',     label: 'ARMATO' },
    armed_vacation:      { barClass: 's-armed',     dotClass: 'dot-armed',     textClass: 'text-armed',     label: 'ARMATO \u2014 VACANZA' },
    arming:              { barClass: 's-pending',   dotClass: 'dot-pending',   textClass: 'text-pending',   label: 'INSERIMENTO\u2026' },
    disarming:           { barClass: 's-pending',   dotClass: 'dot-pending',   textClass: 'text-pending',   label: 'DISINSERIMENTO\u2026' },
    pending:             { barClass: 's-pending',   dotClass: 'dot-pending',   textClass: 'text-pending',   label: 'IN ATTESA\u2026' },
    triggered:           { barClass: 's-triggered', dotClass: 'dot-triggered', textClass: 'text-triggered', label: 'ALLARME!' },
    unavailable:         { barClass: 's-disarmed',  dotClass: 'dot-unavail',   textClass: 'text-unavail',   label: 'NON DISPONIBILE' },
    unknown:             { barClass: 's-disarmed',  dotClass: 'dot-unavail',   textClass: 'text-unavail',   label: 'NON DISPONIBILE' }
  };

  function _getStateInfo(state) {
    return STATE_INFO[state] || { barClass: 's-disarmed', dotClass: 'dot-unavail', textClass: 'text-unavail', label: state || '?' };
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
    var statusBar = _el('div', 'alarm-status-bar s-disarmed');

    /* Entity name: top, centered — primary identifier */
    var entityName = _el('div', 'alarm-entity-name', label);

    /* Sub-label: shown only when armed, displays the active mode ("Modalità: Casa") */
    var entitySub  = _el('div', 'alarm-entity-sub', '');
    entitySub.style.display = 'none';

    /* Badge: dot + text below entity name, separated — shows state */
    var badge     = _el('div', 'alarm-badge');
    var badgeDot  = _el('span', 'alarm-badge-dot dot-disarmed');
    var badgeText = _el('span', 'alarm-badge-text text-disarmed', 'DISARMATO');
    badge.appendChild(badgeDot);
    badge.appendChild(badgeText);

    /* DOM order: name → sub → badge (name at top, state at bottom) */
    statusBar.appendChild(entityName);
    statusBar.appendChild(entitySub);
    statusBar.appendChild(badge);

    /* ---- Body ---- */
    var body = _el('div', 'alarm-body');

    /* -- Disarmed section: mode chips -- */
    var modesSection = _el('div', 'alarm-modes-section');

    /* Label uses alarm-section-lbl (matches CSS) */
    var modesLabel = _el('div', 'alarm-section-lbl', 'Seleziona modalit\u00e0:');

    var modesRow = _el('div', 'alarm-modes-row');

    /* No emoji on chip labels (user request) */
    var chipHome  = _buildModeChip('home',  'Casa');
    var chipAway  = _buildModeChip('away',  'Fuori');
    var chipNight = _buildModeChip('night', 'Notte');

    modesRow.appendChild(chipHome);
    modesRow.appendChild(chipAway);
    modesRow.appendChild(chipNight);

    /* Hint text shown when no code needed — text updated dynamically in updateTile */
    var noCodeHint = _el('div', 'alarm-no-code-hint', 'Tocca per armare');

    modesSection.appendChild(modesLabel);
    modesSection.appendChild(modesRow);
    modesSection.appendChild(noCodeHint);

    /* -- Armed section: direct disarm button (no code needed) -- */
    var disarmSection = _el('div', 'alarm-disarm-section');
    var disarmBtn     = _el('button', 'alarm-confirm-btn btn-direct-disarm', 'Disarma');
    disarmBtn.type = 'button';
    disarmSection.appendChild(disarmBtn);

    /* -- Pending/transition spinner (arming / disarming) -- */
    var pendingSection = _el('div', 'alarm-pending-section');
    var pendingSpinner = _el('div', 'alarm-spinner');
    var pendingMsg     = _el('div', 'alarm-pending-msg', 'In attesa\u2026');
    pendingSection.appendChild(pendingSpinner);
    pendingSection.appendChild(pendingMsg);

    /* -- Triggered banner -- */
    var triggeredBanner = _el('div', 'alarm-triggered-banner', 'Allarme rilevato');

    /* -- PIN area (shared: numeric keypad OR text input).
       Placed directly in body — NOT inside disarmSection.
       This ensures it is visible when isDisarmed (modesSection visible)
       and when isArmed (disarmSection visible). Previously it was trapped
       inside disarmSection which was hidden in disarmed state. -- */
    var pinArea      = _el('div', 'alarm-pin-area');
    var pinDisplay   = _el('div', 'alarm-pin-display', '');
    var textInput    = _el('input', 'alarm-text-input');
    textInput.type = 'text';
    textInput.setAttribute('autocomplete', 'off');
    textInput.setAttribute('autocorrect', 'off');
    textInput.setAttribute('autocapitalize', 'none');
    textInput.setAttribute('spellcheck', 'false');
    textInput.setAttribute('placeholder', 'Inserisci codice\u2026');
    var keypad     = _el('div', 'alarm-keypad');
    var pinError   = _el('div', 'alarm-pin-error', '');
    var confirmBtn = _el('button', 'alarm-confirm-btn btn-arm', 'Arma');
    confirmBtn.type = 'button';

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
        (function (btn) {
          btn.addEventListener('touchend', function (e) { e.preventDefault(); _deleteDigit(); });
          btn.addEventListener('click',    function ()  { if (!('ontouchstart' in window)) { _deleteDigit(); } });
        }(keyBtn));
      } else if (k === '') {
        keyBtn.style.visibility = 'hidden';
      } else {
        (function (btn, digit) {
          btn.addEventListener('touchend', function (e) { e.preventDefault(); _addDigit(digit); });
          btn.addEventListener('click',    function ()  { if (!('ontouchstart' in window)) { _addDigit(digit); } });
        }(keyBtn, k));
      }
      keypad.appendChild(keyBtn);
    }

    /* Hide all optional sections initially; updateTile() shows what's needed */
    modesSection.style.display    = 'none';
    disarmSection.style.display   = 'none';
    pendingSection.style.display  = 'none';
    triggeredBanner.style.display = 'none';
    pinArea.style.display         = 'none';
    noCodeHint.style.display      = 'none';

    body.appendChild(modesSection);
    body.appendChild(disarmSection);
    body.appendChild(pendingSection);
    body.appendChild(triggeredBanner);
    body.appendChild(pinArea);  /* pinArea at body level — independent visibility */

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
        /* chip-selected matches CSS: .alarm-mode-chip.chip-selected */
        chips[j].classList.remove('chip-selected');
      }
      if (chip) {
        chip.classList.add('chip-selected');
        _selectedMode = chip.getAttribute('data-mode');
      } else {
        _selectedMode = '';
      }
    }

    /* Chip tap handlers.
       When code_format is absent and code_arm_required is false: arm directly on tap.
       Otherwise: select chip (user then enters code and presses confirm). */
    function _makeChipHandler(chip) {
      function _doChip() {
        var codeFormat = tile.getAttribute('data-code-format') || '';
        var codeArm    = tile.getAttribute('data-code-arm') === 'true';
        var directArm  = (codeFormat === '') || !codeArm;

        if (directArm) {
          /* No code needed: arm immediately on chip tap */
          var mode = chip.getAttribute('data-mode');
          _selectModeChip(chip);
          _callAlarm('alarm_arm_' + mode, '')
            .then(function () { /* state_changed event will update UI */ })
            .catch(function (err) {
              console.error('[alarm] direct arm failed:', err);
              _selectModeChip(null);
            });
          return;
        }

        /* Code required: toggle chip selection, user will press confirm */
        if (chip.classList.contains('chip-selected')) {
          _selectModeChip(null);
        } else {
          _selectModeChip(chip);
        }
      }

      chip.addEventListener('touchend', function (e) {
        e.preventDefault();
        _doChip();
      });
      chip.addEventListener('click', function () {
        if (!('ontouchstart' in window)) { _doChip(); }
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

    /* Confirm button: depends on current tile state (arm vs disarm) */
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
        var mode = _selectedMode || 'home';
        var armService = 'alarm_arm_' + mode;
        _callAlarm(armService, pinVal)
          .then(function () { _clearPin(); })
          .catch(function (err) {
            console.error('[alarm] arm failed:', err);
            _showError('Operazione fallita. Verificare il codice.');
          });
      } else {
        _callAlarm('alarm_disarm', pinVal)
          .then(function () { _clearPin(); })
          .catch(function (err) {
            console.error('[alarm] disarm failed:', err);
            _showError('Codice errato o connessione persa.');
          });
      }
    }

    /* Disarm button (armed/pending, no-code path) */
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
      badgeDot:       badgeDot,
      badgeText:      badgeText,
      statusBar:      statusBar,
      entityName:     entityName,
      entitySub:      entitySub,
      clearSelection: function () { _selectModeChip(null); },
      modesSection:   modesSection,
      modesLabel:     modesLabel,
      modesRow:       modesRow,
      chipHome:       chipHome,
      chipAway:       chipAway,
      chipNight:      chipNight,
      noCodeHint:     noCodeHint,
      disarmSection:  disarmSection,
      disarmBtn:      disarmBtn,
      pendingSection: pendingSection,
      pendingMsg:     pendingMsg,
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
    var codeFormat = attrs.code_format || null;         /* "number" | "text" | null */
    var codeArm    = attrs.code_arm_required !== false; /* default true */
    var features   = attrs.supported_features || 0;

    var isDisarmed  = (state === 'disarmed');
    var isArmed     = !!ARMED_STATES[state];
    var isPending   = !!PENDING_STATES[state];
    var isTriggered = (state === 'triggered');
    var isUnavail   = (state === 'unavailable' || state === 'unknown');

    /* On state transition, clear stale PIN and chip selection to prevent UI lock */
    var prevState = tile.getAttribute('data-alarm-state') || '';
    if (prevState !== state) {
      r.clearPin();
      r.clearSelection();
    }

    /* Store on tile for use in chip handlers and confirm handler */
    tile.setAttribute('data-alarm-state', state);
    tile.setAttribute('data-code-format', codeFormat || '');
    tile.setAttribute('data-code-arm', codeArm ? 'true' : 'false');

    /* ---- Status bar: gradient background via s-* CSS class ---- */
    var info = _getStateInfo(state);
    r.statusBar.className = 'alarm-status-bar ' + info.barClass;

    /* ---- Badge: dot and text updated independently for color ---- */
    r.badgeDot.className  = 'alarm-badge-dot '  + info.dotClass;
    r.badgeText.className = 'alarm-badge-text ' + info.textClass;
    r.badgeText.textContent = info.label;

    /* ---- Entity sub-label: active armed mode ("Modalità: Casa"), hidden otherwise ---- */
    var subLabel = ARMED_MODE_LABELS[state] || '';
    r.entitySub.textContent = subLabel;
    _setDisplay(r.entitySub, subLabel ? '' : 'none');

    /* ---- Mode chips visibility (based on supported_features bitmask) ---- */
    var showHome  = !!(features & FEAT_ARM_HOME);
    var showAway  = !!(features & FEAT_ARM_AWAY);
    var showNight = !!(features & FEAT_ARM_NIGHT);

    _setDisplay(r.chipHome,  showHome  ? '' : 'none');
    _setDisplay(r.chipAway,  showAway  ? '' : 'none');
    _setDisplay(r.chipNight, showNight ? '' : 'none');

    var anyChip = showHome || showAway || showNight;

    /* arming/disarming = spinner; 'pending' = entry delay, show disarm options */
    var isTransitioning = (state === 'arming' || state === 'disarming');

    /* ---- Section visibility ---- */
    /* modesSection: shown when disarmed (chips to select mode for arming) */
    _setDisplay(r.modesSection, isDisarmed ? '' : 'none');

    /* disarmSection: shown when armed/pending (no code) — only contains disarmBtn.
       When code IS required, pinArea (at body level) provides code entry + confirm. */
    var showDisarmSection = !isTransitioning && (isArmed || isPending) && (codeFormat === null);
    _setDisplay(r.disarmSection, showDisarmSection ? '' : 'none');

    /* pendingSection: spinner shown during arming/disarming transitions */
    _setDisplay(r.pendingSection,  isTransitioning ? '' : 'none');

    /* triggeredBanner: shown when alarm triggered */
    _setDisplay(r.triggeredBanner, isTriggered ? '' : 'none');

    /* Pending section message */
    if (r.pendingMsg) {
      r.pendingMsg.textContent = (state === 'arming') ? 'Inserimento in corso\u2026'
                               : 'Disinserimento in corso\u2026';
    }

    /* modesLabel: show only when chips are available */
    _setDisplay(r.modesLabel, anyChip ? '' : 'none');

    /* noCodeHint: shown when disarmed with chips available.
       Text varies: no-code → "Tocca per armare"; code-required → guide text. */
    var directArmMode = isDisarmed && anyChip && ((codeFormat === null) || !codeArm);
    var needsCodeArm  = isDisarmed && anyChip && !directArmMode;
    _setDisplay(r.noCodeHint, (isDisarmed && anyChip) ? '' : 'none');
    if (directArmMode) {
      r.noCodeHint.textContent = 'Tocca per armare';
    } else if (needsCodeArm) {
      r.noCodeHint.textContent = 'Seleziona modalit\u00e0, poi inserisci il codice';
    }

    /* ---- PIN area (at body level, independent visibility) ----
       Show when:
       - disarmed + code_arm_required=true + code_format set (arm needs code)
       - armed/pending (non-transitioning) + code_format set (disarm needs code)
       - triggered (always show to allow disarm) */
    var showPin = false;
    if (isDisarmed) {
      showPin = (codeFormat !== null) && codeArm;
    } else if (!isTransitioning && (isArmed || isPending)) {
      showPin = (codeFormat !== null);
    } else if (isTriggered) {
      showPin = true;
    }

    _setDisplay(r.pinArea, showPin ? '' : 'none');

    /* ---- Switch keypad vs text input ---- */
    var useKeypad = (codeFormat === 'number' || codeFormat === null);
    _setDisplay(r.keypad,     (showPin && useKeypad)  ? '' : 'none');
    _setDisplay(r.pinDisplay, (showPin && useKeypad)  ? '' : 'none');
    _setDisplay(r.textInput,  (showPin && !useKeypad) ? '' : 'none');

    /* ---- Confirm button label + style ---- */
    if (isDisarmed) {
      r.confirmBtn.textContent = 'Arma';
      r.confirmBtn.className   = 'alarm-confirm-btn btn-arm';
    } else {
      r.confirmBtn.textContent = 'Disarma';
      r.confirmBtn.className   = 'alarm-confirm-btn btn-disarm-danger';
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
