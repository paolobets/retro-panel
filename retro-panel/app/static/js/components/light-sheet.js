/**
 * light-sheet.js — Global bottom sheet for light brightness/color control.
 * Created once, reused for any light entity.
 * No ES modules — loaded as regular script. iOS 12 safe.
 *
 * Exposes globally: window.RP_LightSheet = { open, close }
 */
window.RP_LightSheet = (function () {
  'use strict';

  /* HA supported_features bitmask */
  var FEAT_BRIGHTNESS  = 1;
  var FEAT_COLOR_TEMP  = 2;
  var FEAT_COLOR       = 16;

  var _overlay  = null;
  var _sheet    = null;
  var _titleEl  = null;
  var _briSection  = null;
  var _briSlider   = null;
  var _briVal      = null;
  var _tempSection = null;
  var _tempSlider  = null;
  var _tempVal     = null;
  var _colorSection = null;
  var _hueSlider    = null;
  var _hueDot       = null;

  var _entityId   = null;
  var _label      = null;
  var _debTimer   = null;

  /* ---- Build DOM once ---- */
  function _build() {
    /* overlay */
    _overlay = document.createElement('div');
    _overlay.className = 'rp-bs-overlay hidden';
    _overlay.addEventListener('click', close);

    /* sheet */
    _sheet = document.createElement('div');
    _sheet.className = 'rp-bottom-sheet hidden';

    /* header */
    var header = document.createElement('div');
    header.className = 'rp-bs-header';
    _titleEl = document.createElement('span');
    _titleEl.className = 'rp-bs-title';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'rp-bs-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="3" x2="15" y2="15"/><line x1="15" y1="3" x2="3" y2="15"/></svg>';
    closeBtn.addEventListener('click', close);
    header.appendChild(_titleEl);
    header.appendChild(closeBtn);

    /* body */
    var body = document.createElement('div');
    body.className = 'rp-bs-body';

    /* --- Brightness section --- */
    _briSection = _makeSection();
    var briRow = _makeRow('Luminosità', '');
    _briVal = briRow.querySelector('.rp-bs-val');
    _briSlider = document.createElement('input');
    _briSlider.type = 'range';
    _briSlider.className = 'rp-bs-slider';
    _briSlider.min = '1'; _briSlider.max = '255'; _briSlider.value = '255';
    _briSlider.style.background = 'linear-gradient(to right, #333, #FFB700)';
    _briSlider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
    _briSlider.addEventListener('click', function (e) { e.stopPropagation(); });
    _briSlider.addEventListener('input', _onBriInput);
    _briSection.appendChild(briRow);
    _briSection.appendChild(_briSlider);

    /* --- Color temp section --- */
    _tempSection = _makeSection();
    var tempRow = _makeRow('Temperatura colore', '');
    _tempVal = tempRow.querySelector('.rp-bs-val');
    _tempSlider = document.createElement('input');
    _tempSlider.type = 'range';
    _tempSlider.className = 'rp-bs-slider';
    _tempSlider.min = '153'; _tempSlider.max = '500'; _tempSlider.value = '300';
    _tempSlider.style.background = 'linear-gradient(to right, #b3d9ff, #fff 40%, #ff8c00)';
    _tempSlider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
    _tempSlider.addEventListener('click', function (e) { e.stopPropagation(); });
    _tempSlider.addEventListener('input', _onTempInput);
    _tempSection.appendChild(tempRow);
    _tempSection.appendChild(_tempSlider);

    /* --- Color (RGB/hue) section --- */
    _colorSection = _makeSection();
    var hueRow = _makeRow('Colore', '');
    _hueDot = document.createElement('span');
    _hueDot.className = 'rp-bs-hue-dot';
    _hueDot.style.background = 'hsl(0,80%,55%)';
    hueRow.querySelector('.rp-bs-val').appendChild(_hueDot);
    _hueSlider = document.createElement('input');
    _hueSlider.type = 'range';
    _hueSlider.className = 'rp-bs-slider';
    _hueSlider.min = '0'; _hueSlider.max = '360'; _hueSlider.value = '0';
    _hueSlider.style.background = [
      'linear-gradient(to right,',
      'hsl(0,100%,55%),hsl(30,100%,55%),hsl(60,100%,55%),',
      'hsl(90,100%,55%),hsl(120,100%,55%),hsl(150,100%,55%),',
      'hsl(180,100%,55%),hsl(210,100%,55%),hsl(240,100%,55%),',
      'hsl(270,100%,55%),hsl(300,100%,55%),hsl(330,100%,55%),',
      'hsl(360,100%,55%))'
    ].join('');
    _hueSlider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
    _hueSlider.addEventListener('click', function (e) { e.stopPropagation(); });
    _hueSlider.addEventListener('input', _onHueInput);

    /* swatch presets */
    var swatchWrap = document.createElement('div');
    swatchWrap.className = 'rp-bs-swatches';
    var swatches = [
      { color: '#fffaf0', hue: 50,  label: 'Bianco caldo' },
      { color: '#ffffff', hue: 0,   label: 'Bianco' },
      { color: '#2196f3', hue: 210, label: 'Blu' },
      { color: '#845EC2', hue: 270, label: 'Viola' },
      { color: '#4caf50', hue: 120, label: 'Verde' },
      { color: '#f44336', hue: 0,   label: 'Rosso' },
      { color: '#ff9800', hue: 30,  label: 'Arancio' },
      { color: '#e91e63', hue: 330, label: 'Rosa' }
    ];
    for (var si = 0; si < swatches.length; si++) {
      (function (sw) {
        var el = document.createElement('div');
        el.className = 'rp-bs-swatch';
        el.style.background = sw.color;
        el.title = sw.label;
        el.addEventListener('click', function () {
          _hueSlider.value = sw.hue;
          _onHueInput();
        });
        swatchWrap.appendChild(el);
      })(swatches[si]);
    }
    _colorSection.appendChild(hueRow);
    _colorSection.appendChild(_hueSlider);
    _colorSection.appendChild(swatchWrap);

    body.appendChild(_briSection);
    body.appendChild(_tempSection);
    body.appendChild(_colorSection);

    _sheet.appendChild(header);
    _sheet.appendChild(body);

    document.body.appendChild(_overlay);
    document.body.appendChild(_sheet);
  }

  function _makeSection() {
    var s = document.createElement('div');
    s.className = 'rp-bs-section';
    return s;
  }

  function _makeRow(labelText, valText) {
    var row = document.createElement('div');
    row.className = 'rp-bs-row';
    var lbl = document.createElement('span');
    lbl.className = 'rp-bs-label';
    lbl.textContent = labelText;
    var val = document.createElement('span');
    val.className = 'rp-bs-val';
    val.textContent = valText;
    row.appendChild(lbl);
    row.appendChild(val);
    return row;
  }

  /* ---- Slider handlers ---- */
  function _onBriInput() {
    var v = parseInt(_briSlider.value, 10);
    var pct = Math.round(v / 255 * 100);
    if (_briVal) { _briVal.textContent = pct + '%'; }
    /* update tile value display */
    _updateTileValue(pct + '%');
    _debounce(function () {
      window.callService('light', 'turn_on', { entity_id: _entityId, brightness: v })
        .catch(function (e) { console.error('[light-sheet] bri:', e); });
    });
  }

  function _onTempInput() {
    var mired = parseInt(_tempSlider.value, 10);
    var kelvin = Math.round(1000000 / mired);
    if (_tempVal) { _tempVal.textContent = kelvin + 'K'; }
    var col = _miredToColor(mired);
    _updateTileColor(col);
    _debounce(function () {
      window.callService('light', 'turn_on', { entity_id: _entityId, color_temp: mired })
        .catch(function (e) { console.error('[light-sheet] temp:', e); });
    });
  }

  function _onHueInput() {
    var hue = parseInt(_hueSlider.value, 10);
    if (_hueDot) { _hueDot.style.background = 'hsl(' + hue + ',80%,55%)'; }
    /* convert hsl → rgb for HA */
    var rgb = _hslToRgb(hue, 0.8, 0.55);
    var col = _rgbToHex(rgb[0], rgb[1], rgb[2]);
    _updateTileColor(col);
    _debounce(function () {
      window.callService('light', 'turn_on', {
        entity_id: _entityId,
        rgb_color: rgb
      }).catch(function (e) { console.error('[light-sheet] hue:', e); });
    });
  }

  function _debounce(fn) {
    if (_debTimer) { clearTimeout(_debTimer); }
    _debTimer = setTimeout(fn, 300);
  }

  /* ---- Update tile while sheet is open ---- */
  function _updateTileColor(hex) {
    /* find active tile by entity_id */
    var tiles = document.querySelectorAll('[data-entity-id]');
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i].dataset.entityId === _entityId) {
        var tile = tiles[i];
        tile.style.borderColor = hex;
        var tog = tile.querySelector('.tile-toggle');
        if (tog) { tog.style.background = hex; }
        var icon = tile.querySelector('.tile-icon');
        if (icon) { icon.style.color = hex; }
        var valEl = tile.querySelector('.tile-value');
        if (valEl) { valEl.style.color = hex; }
        var tint = tile.querySelector('.light-tint');
        if (tint) {
          var rgb2 = _hexToRgb(hex);
          if (rgb2) {
            tint.style.background = 'rgba(' + rgb2.r + ',' + rgb2.g + ',' + rgb2.b + ',0.14)';
          }
        }
        break;
      }
    }
  }

  function _updateTileValue(text) {
    var tiles = document.querySelectorAll('[data-entity-id]');
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i].dataset.entityId === _entityId) {
        var valEl = tiles[i].querySelector('.tile-value');
        if (valEl) { valEl.textContent = text; }
        break;
      }
    }
  }

  /* ---- Public API ---- */
  function open(entityId, label, attributes) {
    if (!_sheet) { _build(); }
    _entityId = entityId;
    _label    = label;
    if (_titleEl) { _titleEl.textContent = label || entityId; }

    var sf = (attributes && attributes.supported_features) ? attributes.supported_features : 0;
    var hasBri  = (sf & FEAT_BRIGHTNESS) !== 0;
    var hasTemp = (sf & FEAT_COLOR_TEMP) !== 0;
    var hasColor = (sf & FEAT_COLOR) !== 0;

    /* show/hide sections */
    _briSection.style.display  = hasBri  ? '' : 'none';
    _tempSection.style.display = hasTemp ? '' : 'none';
    _colorSection.style.display = hasColor ? '' : 'none';

    /* if no supported features detected, show brightness as default */
    if (!hasBri && !hasTemp && !hasColor) {
      _briSection.style.display = '';
    }

    /* sync slider values from current state */
    if (hasBri && attributes && attributes.brightness !== undefined && attributes.brightness !== null) {
      _briSlider.value = String(attributes.brightness);
      var pct = Math.round(attributes.brightness / 255 * 100);
      if (_briVal) { _briVal.textContent = pct + '%'; }
    }
    if (hasTemp && attributes && attributes.color_temp !== undefined && attributes.color_temp !== null) {
      _tempSlider.value = String(attributes.color_temp);
      var kelvin = Math.round(1000000 / attributes.color_temp);
      if (_tempVal) { _tempVal.textContent = kelvin + 'K'; }
    }
    if (hasColor && attributes && attributes.hs_color) {
      var hue = Math.round(attributes.hs_color[0]);
      _hueSlider.value = String(hue);
      if (_hueDot) { _hueDot.style.background = 'hsl(' + hue + ',80%,55%)'; }
    }

    _overlay.classList.remove('hidden');
    _sheet.classList.remove('hidden');
  }

  function close() {
    if (_overlay) { _overlay.classList.add('hidden'); }
    if (_sheet)   { _sheet.classList.add('hidden'); }
    _entityId = null;
    if (_debTimer) { clearTimeout(_debTimer); _debTimer = null; }
  }

  /* ---- Color utilities ---- */
  function _miredToColor(mired) {
    if (mired <= 170) { return '#89c4f4'; }
    if (mired <= 220) { return '#c8deff'; }
    if (mired <= 280) { return '#FFD77A'; }
    if (mired <= 340) { return '#FFB700'; }
    if (mired <= 400) { return '#FF9A30'; }
    return '#FF8C00';
  }

  function _hslToRgb(h, s, l) {
    var a = s * Math.min(l, 1 - l);
    function f(n) {
      var k = (n + h / 30) % 12;
      return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    }
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  function _rgbToHex(r, g, b) {
    function h(v) { return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2); }
    return '#' + h(r) + h(g) + h(b);
  }

  function _hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  return { open: open, close: close };
}());
