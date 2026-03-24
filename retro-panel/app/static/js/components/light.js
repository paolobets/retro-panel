/**
 * light.js — Light entity tile component
 * Style C: fixed 120px tile, dynamic color from state attributes,
 * long-press opens global bottom sheet.
 * No ES modules — loaded as regular script. iOS 12 safe.
 *
 * Exposes globally: window.LightComponent = { createTile, updateTile }
 */
window.LightComponent = (function () {
  'use strict';

  var LONG_PRESS_MS = 500;

  /* Default color when light is ON without color info */
  var COLOR_DEFAULT = '#FFB700';

  /* Map color_temp mired → hex for tile coloring */
  function miredToColor(mired) {
    if (!mired) { return COLOR_DEFAULT; }
    if (mired <= 170) { return '#89c4f4'; }
    if (mired <= 220) { return '#c8deff'; }
    if (mired <= 280) { return '#FFD77A'; }
    if (mired <= 340) { return COLOR_DEFAULT; }
    if (mired <= 400) { return '#FF9A30'; }
    return '#FF8C00';
  }

  /* Convert rgb_color [r,g,b] array → hex string */
  function rgbToHex(rgb) {
    if (!rgb || rgb.length < 3) { return COLOR_DEFAULT; }
    function h(v) { return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2); }
    return '#' + h(rgb[0]) + h(rgb[1]) + h(rgb[2]);
  }

  /* Derive display color from HA state attributes */
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

  /* Apply ON visual state to tile using color */
  function applyOnState(tile, color, brightnessValue) {
    var toggle   = tile.querySelector('.tile-toggle');
    var thumb    = tile.querySelector('.tile-toggle-thumb');
    var iconEl   = tile.querySelector('.tile-icon');
    var valEl    = tile.querySelector('.tile-value');
    var tintEl   = tile.querySelector('.light-tint');

    tile.style.borderColor = color;
    if (toggle) { toggle.style.background = color; }
    if (thumb)  { thumb.style.transform = 'translateX(18px)'; }
    if (iconEl) { iconEl.style.color = color; }

    if (valEl) {
      valEl.style.color = color;
      valEl.textContent = brightnessValue !== null && brightnessValue !== undefined
        ? brightnessValue
        : '';
    }
    if (tintEl) {
      var r = parseInt(color.slice(1,3), 16) || 255;
      var g = parseInt(color.slice(3,5), 16) || 183;
      var b = parseInt(color.slice(5,7), 16) || 0;
      tintEl.style.background = 'rgba(' + r + ',' + g + ',' + b + ',0.14)';
    }
  }

  /* Apply OFF visual state */
  function applyOffState(tile) {
    var toggle   = tile.querySelector('.tile-toggle');
    var thumb    = tile.querySelector('.tile-toggle-thumb');
    var iconEl   = tile.querySelector('.tile-icon');
    var valEl    = tile.querySelector('.tile-value');

    tile.style.borderColor = 'transparent';
    if (toggle) { toggle.style.background = ''; }
    if (thumb)  { thumb.style.transform = ''; }
    if (iconEl) { iconEl.style.color = ''; }
    if (valEl)  { valEl.textContent = ''; valEl.style.color = ''; }
  }

  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label     = entityConfig.label;
    var icon      = entityConfig.icon;

    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    var tile = DOM.createElement('div', 'tile entity-light state-off');
    tile.dataset.entityId = entity_id;

    /* Tint overlay (color set via inline style) */
    var tint = DOM.createElement('div', 'light-tint');
    tile.appendChild(tint);

    /* Top row: icon + toggle */
    var top    = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon');
    iconEl.innerHTML = FMT.getIcon(icon, 28, entity_id);
    var toggle = DOM.createElement('div', 'tile-toggle');
    toggle.appendChild(DOM.createElement('div', 'tile-toggle-thumb'));
    top.appendChild(iconEl);
    top.appendChild(toggle);

    /* Bottom row: brightness value + label */
    var bottom  = DOM.createElement('div', 'tile-bottom');
    var valueEl = DOM.createElement('span', 'tile-value', '');
    var labelEl = DOM.createElement('span', 'tile-label', label);
    bottom.appendChild(valueEl);
    bottom.appendChild(labelEl);

    tile.appendChild(top);
    tile.appendChild(bottom);

    /* ---- Interaction: long-press engine ---- */
    var _lpTimer = null;
    var _hasMoved = false;

    function _clearLP() {
      if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
    }

    function _handleTap() {
      var currentState = tile.dataset.state || 'off';
      var service  = currentState === 'on' ? 'turn_off' : 'turn_on';
      var next     = service === 'turn_on' ? 'on' : 'off';
      /* optimistic */
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
      if (window.RP_LightSheet) {
        window.RP_LightSheet.open(entity_id, label, attrs);
      }
    }

    tile.addEventListener('touchstart', function () {
      _hasMoved = false;
      _lpTimer = setTimeout(_handleLongPress, LONG_PRESS_MS);
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

    /* Mouse fallback for desktop testing */
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

  function updateTile(tile, stateObj) {
    var state  = stateObj.state;
    var attrs  = stateObj.attributes || {};
    tile.dataset.state = state;
    tile._lastAttrs = attrs;

    tile.classList.remove('state-on', 'state-off', 'state-unavailable');

    if (state === 'on') {
      tile.classList.add('state-on');
      var color = colorFromAttributes(attrs);
      var bri   = (attrs.brightness !== undefined && attrs.brightness !== null)
        ? (Math.round(attrs.brightness / 255 * 100) + '%')
        : null;
      applyOnState(tile, color, bri);

    } else if (state === 'unavailable') {
      tile.classList.add('state-unavailable');
      applyOffState(tile);

    } else {
      tile.classList.add('state-off');
      applyOffState(tile);
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
