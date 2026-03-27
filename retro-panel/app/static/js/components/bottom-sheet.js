/**
 * bottom-sheet.js — Global bottom sheet for light brightness/color/temp control.
 * Replaces light-sheet.js. Built once on first open(), reused for any light entity.
 * No ES modules — loaded as regular script. iOS 12+ safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
 *
 * Exposes globally: window.RP_BottomSheet = { open(entityId, label, attrs), close() }
 */
window.RP_BottomSheet = (function () {
  'use strict';

  /* HA supported_features bitmask */
  var FEAT_BRIGHTNESS = 1;
  var FEAT_COLOR_TEMP = 2;
  var FEAT_COLOR      = 16;

  /* DOM refs — null until _build() */
  var _overlay      = null;
  var _sheet        = null;
  var _titleEl      = null;
  var _briSection   = null;
  var _briSlider    = null;
  var _briVal       = null;
  var _tempSection  = null;
  var _tempSlider   = null;
  var _tempVal      = null;
  var _colorSection = null;
  var _hueSlider    = null;
  var _hueDot       = null;

  var _entityId  = null;
  var _debTimer  = null;

  /* ------------------------------------------------------------------ */
  /* Build: wire up pre-existing DOM from index.html                    */
  /* (elements already in HTML; JS just connects refs + event handlers) */
  /* ------------------------------------------------------------------ */
  function _build() {
    _overlay = document.getElementById('bs-overlay');
    _sheet   = document.getElementById('bottom-sheet');

    if (!_overlay || !_sheet) {
      console.error('[RP_BottomSheet] #bs-overlay or #bottom-sheet not found in DOM');
      return;
    }

    /* overlay events */
    _overlay.addEventListener('touchend', function (e) { e.preventDefault(); close(); });
    _overlay.addEventListener('click', close);

    /* wire refs */
    _titleEl     = _sheet.querySelector('.bs-title');
    _briSection  = document.getElementById('bs-section-bri');
    _briSlider   = document.getElementById('bs-bri-slider');
    _briVal      = document.getElementById('bs-bri-val');
    _tempSection = document.getElementById('bs-section-temp');
    _tempSlider  = document.getElementById('bs-temp-slider');
    _tempVal     = document.getElementById('bs-temp-val');
    _colorSection = document.getElementById('bs-section-color');
    _hueSlider   = document.getElementById('bs-hue-slider');
    _hueDot      = _sheet.querySelector('.bs-hue-dot');

    /* close button */
    var closeBtn = _sheet.querySelector('.bs-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
      closeBtn.addEventListener('touchend', function (e) { e.preventDefault(); close(); });
    }

    /* slider events */
    if (_briSlider) {
      _briSlider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      _briSlider.addEventListener('click', function (e) { e.stopPropagation(); });
      _briSlider.addEventListener('input', _onBriInput);
    }
    if (_tempSlider) {
      _tempSlider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      _tempSlider.addEventListener('click', function (e) { e.stopPropagation(); });
      _tempSlider.addEventListener('input', _onTempInput);
    }
    if (_hueSlider) {
      _hueSlider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      _hueSlider.addEventListener('click', function (e) { e.stopPropagation(); });
      _hueSlider.addEventListener('input', _onHueInput);
    }

    /* swatch events */
    var swatchEls = _sheet.querySelectorAll('.bs-swatch');
    for (var si = 0; si < swatchEls.length; si++) {
      (function (sw) {
        var hue = parseInt(sw.getAttribute('data-hue') || '0', 10);
        sw.addEventListener('touchend', function (e) {
          e.preventDefault();
          if (_hueSlider) { _hueSlider.value = String(hue); }
          _onHueInput();
        });
        sw.addEventListener('click', function () {
          if (!('ontouchstart' in window)) {
            if (_hueSlider) { _hueSlider.value = String(hue); }
            _onHueInput();
          }
        });
      })(swatchEls[si]);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Slider handlers                                                      */
  /* ------------------------------------------------------------------ */
  function _onBriInput() {
    var v = parseInt(_briSlider.value, 10);
    var pct = Math.round(v / 255 * 100);
    if (_briVal) { _briVal.textContent = pct + '%'; }
    _updateTileValue(pct + '%');
    _debounce(function () {
      window.callService('light', 'turn_on', { entity_id: _entityId, brightness: v })
        .catch(function (e) { console.error('[bottom-sheet] bri:', e); });
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
        .catch(function (e) { console.error('[bottom-sheet] temp:', e); });
    });
  }

  function _onHueInput() {
    var hue = parseInt(_hueSlider.value, 10);
    if (_hueDot) { _hueDot.style.background = 'hsl(' + hue + ',80%,55%)'; }
    var rgb = _hslToRgb(hue, 0.8, 0.55);
    var col = _rgbToHex(rgb[0], rgb[1], rgb[2]);
    _updateTileColor(col);
    _debounce(function () {
      window.callService('light', 'turn_on', { entity_id: _entityId, rgb_color: rgb })
        .catch(function (e) { console.error('[bottom-sheet] hue:', e); });
    });
  }

  function _debounce(fn) {
    if (_debTimer) { clearTimeout(_debTimer); }
    _debTimer = setTimeout(fn, 300);
  }

  /* ------------------------------------------------------------------ */
  /* Live tile updates                                                    */
  /* ------------------------------------------------------------------ */
  function _findTile() {
    var tiles = document.querySelectorAll('[data-entity-id]');
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i].dataset.entityId === _entityId) { return tiles[i]; }
    }
    return null;
  }

  function _updateTileColor(hex) {
    var tile = _findTile();
    if (!tile) { return; }
    var tog = tile.querySelector('.tile-toggle');
    if (tog) { tog.style.background = hex; }
    var icon = tile.querySelector('.tile-icon');
    if (icon) { icon.style.color = hex; }
    var tint = tile.querySelector('.tile-tint');
    if (tint) {
      var rgb = _hexToRgb(hex);
      if (rgb) {
        tint.style.background = 'rgba(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ',0.14)';
      }
    }
  }

  function _updateTileValue(text) {
    var tile = _findTile();
    if (!tile) { return; }
    var valEl = tile.querySelector('.tile-value');
    if (valEl) { valEl.textContent = text; }
  }

  /* ------------------------------------------------------------------ */
  /* Public API                                                           */
  /* ------------------------------------------------------------------ */
  function open(entityId, label, attributes) {
    if (!_sheet) { _build(); }

    _entityId = entityId;
    if (_titleEl) { _titleEl.textContent = label || entityId; }

    var sf = (attributes && attributes.supported_features) ? attributes.supported_features : 0;
    var hasBri   = (sf & FEAT_BRIGHTNESS) !== 0;
    var hasTemp  = (sf & FEAT_COLOR_TEMP) !== 0;
    var hasColor = (sf & FEAT_COLOR) !== 0;

    /* show/hide sections */
    _briSection.style.display   = hasBri   ? '' : 'none';
    _tempSection.style.display  = hasTemp  ? '' : 'none';
    _colorSection.style.display = hasColor ? '' : 'none';

    /* fallback: if no features detected show brightness */
    if (!hasBri && !hasTemp && !hasColor) {
      _briSection.style.display = '';
    }

    /* sync slider values from current attributes */
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

    /* open via is-open class (CSS uses display:block / translateY(0)) */
    _overlay.classList.add('is-open');
    _sheet.classList.add('is-open');
  }

  function close() {
    if (_overlay) { _overlay.classList.remove('is-open'); }
    if (_sheet)   { _sheet.classList.remove('is-open'); }
    _entityId = null;
    if (_debTimer) { clearTimeout(_debTimer); _debTimer = null; }
  }

  /* ------------------------------------------------------------------ */
  /* Color utilities                                                      */
  /* ------------------------------------------------------------------ */
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
