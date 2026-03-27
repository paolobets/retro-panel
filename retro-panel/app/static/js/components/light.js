/**
 * light.js — Light entity tile component v2.0
 * Fixed 120px tile, dynamic color from state attributes,
 * long-press opens global bottom sheet (RP_BottomSheet).
 * No ES modules — loaded as regular script. iOS 12+ safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
 *
 * Exposes globally: window.LightComponent = { createTile, updateTile }
 */
window.LightComponent = (function () {
  'use strict';

  var LONG_PRESS_MS  = 500;
  var COLOR_DEFAULT  = '#FFB700';

  /* ------------------------------------------------------------------ */
  /* Color helpers                                                        */
  /* ------------------------------------------------------------------ */
  function miredToColor(mired) {
    if (!mired) { return COLOR_DEFAULT; }
    if (mired <= 170) { return '#89c4f4'; }
    if (mired <= 220) { return '#c8deff'; }
    if (mired <= 280) { return '#FFD77A'; }
    if (mired <= 340) { return COLOR_DEFAULT; }
    if (mired <= 400) { return '#FF9A30'; }
    return '#FF8C00';
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb.length < 3) { return COLOR_DEFAULT; }
    function h(v) { return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2); }
    return '#' + h(rgb[0]) + h(rgb[1]) + h(rgb[2]);
  }

  function colorFromAttributes(attrs) {
    if (!attrs) { return COLOR_DEFAULT; }
    if (attrs.rgb_color && attrs.rgb_color.length >= 3) {
      return rgbToHex(attrs.rgb_color);
    }
    if (attrs.color_temp !== undefined && attrs.color_temp !== null) {
      return miredToColor(attrs.color_temp);
    }
    return COLOR_DEFAULT;
  }

  /* ------------------------------------------------------------------ */
  /* Visual state helpers                                                 */
  /* ------------------------------------------------------------------ */
  function applyOnState(tile, color, brightnessValue) {
    var toggle = tile.querySelector('.tile-toggle');
    var thumb  = tile.querySelector('.tile-toggle-thumb');
    var iconEl = tile.querySelector('.tile-icon');
    var valEl  = tile.querySelector('.tile-value');
    var tintEl = tile.querySelector('.tile-tint');

    if (toggle) { toggle.style.background = color; }
    if (thumb)  { thumb.style.transform = 'translateX(18px)'; }
    if (iconEl) { iconEl.style.color = color; }
    if (valEl) {
      valEl.style.color = color;
      valEl.textContent = (brightnessValue !== null && brightnessValue !== undefined) ? brightnessValue : '';
    }
    if (tintEl) {
      var r = parseInt(color.slice(1, 3), 16) || 255;
      var g = parseInt(color.slice(3, 5), 16) || 183;
      var b = parseInt(color.slice(5, 7), 16) || 0;
      tintEl.style.background = 'rgba(' + r + ',' + g + ',' + b + ',0.14)';
    }
  }

  function applyOffState(tile) {
    var toggle = tile.querySelector('.tile-toggle');
    var thumb  = tile.querySelector('.tile-toggle-thumb');
    var iconEl = tile.querySelector('.tile-icon');
    var valEl  = tile.querySelector('.tile-value');
    var tintEl = tile.querySelector('.tile-tint');

    if (toggle) { toggle.style.background = ''; }
    if (thumb)  { thumb.style.transform = ''; }
    if (iconEl) { iconEl.style.color = ''; }
    if (valEl)  { valEl.textContent = ''; valEl.style.color = ''; }
    if (tintEl) { tintEl.style.background = ''; }
  }

  /* ------------------------------------------------------------------ */
  /* createTile                                                           */
  /* ------------------------------------------------------------------ */
  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label     = entityConfig.label;
    var icon      = entityConfig.icon;

    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    /* root tile */
    var tile = DOM.createElement('div', 'tile tile-light');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'light';

    /* tint overlay */
    var tint = DOM.createElement('div', 'tile-tint');
    tile.appendChild(tint);

    /* top row: icon + toggle */
    var top    = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon');
    iconEl.innerHTML = FMT.getIcon(icon, 28, entity_id);
    var toggle = DOM.createElement('div', 'tile-toggle');
    toggle.appendChild(DOM.createElement('div', 'tile-toggle-thumb'));
    top.appendChild(iconEl);
    top.appendChild(toggle);

    /* bottom row: brightness value + label */
    var bottom  = DOM.createElement('div', 'tile-bottom');
    var valueEl = DOM.createElement('span', 'tile-value', '');
    var labelEl = DOM.createElement('span', 'tile-label', label);
    bottom.appendChild(valueEl);
    bottom.appendChild(labelEl);

    tile.appendChild(top);
    tile.appendChild(bottom);

    /* ---- Long-press interaction ---- */
    var _lpTimer  = null;
    var _hasMoved = false;

    function _clearLP() {
      if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
    }

    function _handleTap() {
      var currentState = tile.dataset.state || 'off';
      var service = currentState === 'on' ? 'turn_off' : 'turn_on';
      var next    = service === 'turn_on' ? 'on' : 'off';
      /* optimistic update */
      updateTile(tile, { state: next, attributes: tile._lastAttrs || {} });
      window.callService('light', service, { entity_id: entity_id })
        .catch(function (err) {
          console.error('[light] tap failed:', err);
          updateTile(tile, { state: currentState, attributes: tile._lastAttrs || {} });
        });
    }

    function _handleLongPress() {
      _lpTimer = null;
      var attrs = tile._lastAttrs || {};
      if (window.RP_BottomSheet) {
        window.RP_BottomSheet.open(entity_id, label, attrs);
      }
    }

    /* touch events */
    tile.addEventListener('touchstart', function () {
      _hasMoved = false;
      _lpTimer  = setTimeout(_handleLongPress, LONG_PRESS_MS);
    }, { passive: true });

    tile.addEventListener('touchmove', function () {
      _hasMoved = true;
      _clearLP();
    }, { passive: true });

    tile.addEventListener('touchend', function () {
      if (_lpTimer) {
        _clearLP();
        if (!_hasMoved) { _handleTap(); }
      }
    });

    tile.addEventListener('touchcancel', _clearLP);

    /* mouse fallback for desktop testing */
    tile.addEventListener('mousedown', function () {
      if ('ontouchstart' in window) { return; }
      _lpTimer = setTimeout(_handleLongPress, LONG_PRESS_MS);
    });
    tile.addEventListener('mouseup', function () {
      if ('ontouchstart' in window) { return; }
      if (_lpTimer) { _clearLP(); _handleTap(); }
    });
    tile.addEventListener('mouseleave', function () {
      if ('ontouchstart' in window) { return; }
      _clearLP();
    });

    return tile;
  }

  /* ------------------------------------------------------------------ */
  /* updateTile                                                           */
  /* ------------------------------------------------------------------ */
  function updateTile(tile, stateObj) {
    var state = stateObj.state;
    var attrs = stateObj.attributes || {};

    tile.dataset.state = state;
    tile._lastAttrs    = attrs;

    tile.classList.remove('is-on', 'is-off', 'is-unavail');

    if (state === 'on') {
      tile.classList.add('is-on');
      var color = colorFromAttributes(attrs);
      var bri = (attrs.brightness !== undefined && attrs.brightness !== null)
        ? (Math.round(attrs.brightness / 255 * 100) + '%')
        : null;
      applyOnState(tile, color, bri);

    } else if (state === 'unavailable') {
      tile.classList.add('is-unavail');
      applyOffState(tile);

    } else {
      tile.classList.add('is-off');
      applyOffState(tile);
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
