/**
 * climate.js — Climate/Thermostat entity tile component
 * Fixed 120px tile, tap opens climate bottom sheet with temp slider + mode buttons.
 * No ES modules — loaded as regular script. iOS 12+ safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
 *
 * Exposes globally: window.ClimateComponent = { createTile, updateTile }
 */
window.ClimateComponent = (function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                            */
  /* ------------------------------------------------------------------ */
  var COLOR_MAP = {
    heat:      '#ff9800',
    cool:      '#2196f3',
    auto:      '#4caf50',
    heat_cool: '#4caf50',
    fan_only:  '#999',
    dry:       '#999'
  };
  var COLOR_OFF = '#999';

  var ACTION_TEXT = {
    heating: 'Riscaldamento\u2026',
    cooling: 'Raffrescamento\u2026',
    idle:    'In attesa',
    off:     'Inattivo',
    drying:  'Deumidificazione\u2026',
    fan:     'Ventilazione\u2026'
  };

  var MODE_LABEL = {
    off:       'Off',
    heat:      'Riscald.',
    cool:      'Raffr.',
    auto:      'Auto',
    heat_cool: 'Auto',
    fan_only:  'Ventil.',
    dry:       'Deumid.'
  };

  /* ------------------------------------------------------------------ */
  /* Mode SVG icons (18x18, inline)                                       */
  /* ------------------------------------------------------------------ */
  function _modeIcon(mode) {
    var s = 'xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"';
    switch (mode) {
      case 'off':
        return '<svg ' + s + '><path d="M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0119 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.27 1.08-4.29 2.76-5.57L6.34 5.02A8.94 8.94 0 003 12a9 9 0 0018 0c0-2.74-1.23-5.19-3.17-6.83z"/></svg>';
      case 'heat':
        return '<svg ' + s + '><path d="M12 2c-1 0-2 .5-2.66 1.33C8.52 4.4 8 5.73 8 7.07 8 9.79 10.21 12 12 12s4-2.21 4-4.93c0-1.34-.52-2.67-1.34-3.74C14 2.5 13 2 12 2zm0 16c-2.76 0-5-1.12-5-2.5S9.24 13 12 13s5 1.12 5 2.5S14.76 18 12 18zm0 4c-3.87 0-7-1.57-7-3.5 0-1.58 2.13-2.9 5-3.35v2.85h4v-2.85c2.87.45 5 1.77 5 3.35 0 1.93-3.13 3.5-7 3.5z"/></svg>';
      case 'cool':
        return '<svg ' + s + '><path d="M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22z"/></svg>';
      case 'auto':
      case 'heat_cool':
        return '<svg ' + s + '><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>';
      case 'fan_only':
        return '<svg ' + s + '><path d="M12 12c0-3-2.5-5-5-5 0 3 2.5 5 5 5zm0 0c3 0 5-2.5 5-5-3 0-5 2.5-5 5zm0 0c0 3 2.5 5 5 5 0-3-2.5-5-5-5zm0 0c-3 0-5 2.5-5 5 3 0 5-2.5 5-5z"/></svg>';
      case 'dry':
        return '<svg ' + s + '><path d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2C20 10.48 17.33 6.55 12 2z"/></svg>';
      default:
        return '<svg ' + s + '><circle cx="12" cy="12" r="6"/></svg>';
    }
  }

  function _modeColor(mode) {
    return COLOR_MAP[mode] || COLOR_OFF;
  }

  function _modeClass(mode) {
    if (mode === 'heat') return 'mode-heat';
    if (mode === 'cool') return 'mode-cool';
    if (mode === 'auto' || mode === 'heat_cool') return 'mode-auto';
    if (mode === 'fan_only') return 'mode-fan';
    if (mode === 'dry') return 'mode-dry';
    return 'mode-off';
  }

  function _formatTemp(val) {
    if (val === null || val === undefined || val === '' || isNaN(val)) return '--';
    var n = parseFloat(val);
    return n % 1 === 0 ? String(n) : n.toFixed(1);
  }

  /* ------------------------------------------------------------------ */
  /* Bottom sheet state                                                   */
  /* ------------------------------------------------------------------ */
  var _bsBuilt   = false;
  var _overlay    = null;
  var _sheet      = null;
  var _titleEl    = null;
  var _currentVal = null;
  var _tempDisplay = null;
  var _slider     = null;
  var _modesWrap  = null;
  var _entityId   = null;
  var _debTimer   = null;
  var _minTemp    = 16;
  var _maxTemp    = 30;
  var _step       = 0.5;
  var _targetTemp = 20;
  var _currentMode = 'off';
  var _hvacModes  = [];

  function _buildBS() {
    _overlay    = document.getElementById('climate-bs-overlay');
    _sheet      = document.getElementById('climate-bs');
    if (!_overlay || !_sheet) {
      console.error('[ClimateComponent] #climate-bs-overlay or #climate-bs not found');
      return;
    }
    _titleEl    = _sheet.querySelector('.cbs-title');
    _currentVal = _sheet.querySelector('.cbs-current-val');
    _tempDisplay = _sheet.querySelector('.cbs-temp-display');
    _slider     = _sheet.querySelector('.cbs-slider');
    _modesWrap  = _sheet.querySelector('.cbs-modes');

    /* close handlers */
    _overlay.addEventListener('touchend', function (e) { e.preventDefault(); _closeBS(); });
    _overlay.addEventListener('click', _closeBS);
    var closeBtn = _sheet.querySelector('.cbs-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', _closeBS);
      closeBtn.addEventListener('touchend', function (e) { e.preventDefault(); _closeBS(); });
    }

    /* minus / plus */
    var minusBtn = _sheet.querySelector('.cbs-temp-minus');
    var plusBtn  = _sheet.querySelector('.cbs-temp-plus');
    if (minusBtn) {
      minusBtn.addEventListener('touchend', function (e) { e.preventDefault(); _adjustTemp(-_step); });
      minusBtn.addEventListener('click', function () {
        if (!('ontouchstart' in window)) { _adjustTemp(-_step); }
      });
    }
    if (plusBtn) {
      plusBtn.addEventListener('touchend', function (e) { e.preventDefault(); _adjustTemp(_step); });
      plusBtn.addEventListener('click', function () {
        if (!('ontouchstart' in window)) { _adjustTemp(_step); }
      });
    }

    /* slider */
    if (_slider) {
      _slider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      _slider.addEventListener('click', function (e) { e.stopPropagation(); });
      _slider.addEventListener('input', _onSliderInput);
    }

    _bsBuilt = true;
  }

  function _adjustTemp(delta) {
    _targetTemp = Math.min(_maxTemp, Math.max(_minTemp, _targetTemp + delta));
    _syncTempUI();
    _debounceService();
  }

  function _onSliderInput() {
    _targetTemp = parseFloat(_slider.value);
    _syncTempUI();
    _debounceService();
  }

  function _syncTempUI() {
    if (_tempDisplay) { _tempDisplay.textContent = _formatTemp(_targetTemp); }
    if (_slider) { _slider.value = String(_targetTemp); }
  }

  function _debounceService() {
    if (_debTimer) { clearTimeout(_debTimer); }
    _debTimer = setTimeout(function () {
      window.callService('climate', 'set_temperature', {
        entity_id: _entityId,
        temperature: _targetTemp
      }).catch(function (e) { console.error('[climate] set_temperature:', e); });
    }, 300);
  }

  function _openBS(entityId, label, attrs, hvacMode) {
    if (!_bsBuilt) { _buildBS(); }
    if (!_overlay || !_sheet) { return; }

    _entityId = entityId;
    if (_titleEl) { _titleEl.textContent = label || entityId; }

    var currentTemp = (attrs && attrs.current_temperature !== undefined && attrs.current_temperature !== null)
      ? _formatTemp(attrs.current_temperature) + '\u00B0C'
      : '--';
    if (_currentVal) { _currentVal.textContent = currentTemp; }

    _minTemp = (attrs && attrs.min_temp !== undefined && attrs.min_temp !== null) ? attrs.min_temp : 16;
    _maxTemp = (attrs && attrs.max_temp !== undefined && attrs.max_temp !== null) ? attrs.max_temp : 30;
    _step    = (attrs && attrs.target_temp_step !== undefined && attrs.target_temp_step !== null) ? attrs.target_temp_step : 0.5;
    _targetTemp = (attrs && attrs.temperature !== undefined && attrs.temperature !== null) ? attrs.temperature : 20;

    if (_slider) {
      _slider.min   = String(_minTemp);
      _slider.max   = String(_maxTemp);
      _slider.step  = String(_step);
      _slider.value = String(_targetTemp);
    }
    _syncTempUI();

    /* Slider: disable when mode is off/fan_only/dry */
    _currentMode = hvacMode || 'off';
    if (_slider) {
      var _disableSlider = (_currentMode === 'off' || _currentMode === 'fan_only' || _currentMode === 'dry');
      _slider.disabled = _disableSlider;
      _slider.style.opacity = _disableSlider ? '0.4' : '1';
    }

    /* Build mode buttons */
    _hvacModes = (attrs && attrs.hvac_modes) ? attrs.hvac_modes : ['off', 'heat', 'cool', 'auto'];
    _renderModeButtons(_currentMode);

    _overlay.classList.add('is-open');
    _sheet.classList.add('is-open');
  }

  function _closeBS() {
    if (_overlay) { _overlay.classList.remove('is-open'); }
    if (_sheet)   { _sheet.classList.remove('is-open'); }
    _entityId = null;
    if (_debTimer) { clearTimeout(_debTimer); _debTimer = null; }
  }

  function _renderModeButtons(activeMode) {
    if (!_modesWrap) { return; }
    _modesWrap.innerHTML = '';
    for (var i = 0; i < _hvacModes.length; i++) {
      (function (m) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'cbs-mode-btn';
        if (m === activeMode) {
          btn.className += ' active-' + _modeClass(m).replace('mode-', '');
        }
        btn.innerHTML = '<span class="cbs-mode-icon">' + _modeIcon(m) + '</span>'
          + (MODE_LABEL[m] || m);

        btn.addEventListener('touchend', function (e) {
          e.preventDefault();
          _selectMode(m);
        });
        btn.addEventListener('click', function () {
          if (!('ontouchstart' in window)) { _selectMode(m); }
        });

        _modesWrap.appendChild(btn);
      })(_hvacModes[i]);
    }
  }

  function _selectMode(mode) {
    _currentMode = mode;
    _renderModeButtons(mode);
    /* Disable slider for modes that don't accept temperature */
    if (_slider) {
      var _dis = (mode === 'off' || mode === 'fan_only' || mode === 'dry');
      _slider.disabled = _dis;
      _slider.style.opacity = _dis ? '0.4' : '1';
    }
    window.callService('climate', 'set_hvac_mode', {
      entity_id: _entityId,
      hvac_mode: mode
    }).catch(function (e) { console.error('[climate] set_hvac_mode:', e); });
  }

  /* ------------------------------------------------------------------ */
  /* createTile                                                           */
  /* ------------------------------------------------------------------ */
  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label     = entityConfig.label;

    var DOM = window.RP_DOM;

    /* root tile */
    var tile = DOM.createElement('div', 'tile tile-climate mode-off');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'climate';

    /* Row 1: name + mode badge */
    var row1 = DOM.createElement('div', 'climate-row1');
    var nameEl = DOM.createElement('span', 'climate-name', label);
    var badge = DOM.createElement('span', 'climate-mode-badge');
    var dot = DOM.createElement('span', 'climate-mode-dot');
    var badgeText = document.createTextNode('OFF');
    badge.appendChild(dot);
    badge.appendChild(badgeText);
    row1.appendChild(nameEl);
    row1.appendChild(badge);

    /* Row 2: current temp + target */
    var row2 = DOM.createElement('div', 'climate-row2');
    var currentWrap = document.createElement('div');
    var currentEl = DOM.createElement('span', 'climate-current', '--');
    var unitEl = DOM.createElement('span', 'climate-unit', '\u00B0C');
    currentWrap.appendChild(currentEl);
    currentWrap.appendChild(unitEl);
    var targetWrap = DOM.createElement('div', 'climate-target');
    var targetLabel = DOM.createElement('span', 'climate-target-label', 'TARGET');
    var targetVal = DOM.createElement('span', 'climate-target-val', '--');
    targetWrap.appendChild(targetLabel);
    targetWrap.appendChild(targetVal);
    row2.appendChild(currentWrap);
    row2.appendChild(targetWrap);

    /* Row 3: action text */
    var row3 = DOM.createElement('div', 'climate-row3', '');

    tile.appendChild(row1);
    tile.appendChild(row2);
    tile.appendChild(row3);

    /* Tap interaction — opens bottom sheet */
    tile.addEventListener('touchend', function (e) {
      e.preventDefault();
      _openBS(entity_id, label, tile._lastAttrs || {}, tile._lastHvacMode || 'off');
    });
    tile.addEventListener('click', function () {
      if (!('ontouchstart' in window)) {
        _openBS(entity_id, label, tile._lastAttrs || {}, tile._lastHvacMode || 'off');
      }
    });

    return tile;
  }

  /* ------------------------------------------------------------------ */
  /* updateTile                                                           */
  /* ------------------------------------------------------------------ */
  function updateTile(tile, stateObj) {
    var state = stateObj.state || 'off';
    var attrs = stateObj.attributes || {};

    tile._lastAttrs = attrs;
    tile._lastHvacMode = state;

    /* mode class */
    tile.classList.remove('mode-heat', 'mode-cool', 'mode-auto', 'mode-off');
    tile.classList.add(_modeClass(state));

    /* Row 1: badge */
    var badge = tile.querySelector('.climate-mode-badge');
    if (badge) {
      /* text node is the second child (after dot) */
      var textNode = badge.lastChild;
      if (textNode) {
        textNode.textContent = (MODE_LABEL[state] || state || 'Off').toUpperCase();
      }
    }

    /* Row 2: current + target */
    var currentEl = tile.querySelector('.climate-current');
    if (currentEl) {
      currentEl.textContent = _formatTemp(attrs.current_temperature);
    }
    var targetVal = tile.querySelector('.climate-target-val');
    if (targetVal) {
      targetVal.textContent = _formatTemp(attrs.temperature);
    }

    /* Row 3: action text */
    var row3 = tile.querySelector('.climate-row3');
    if (row3) {
      var action = attrs.hvac_action || '';
      row3.textContent = ACTION_TEXT[action] || (action ? action : '');
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
