/**
 * switch.js — Switch entity tile component v2.0
 * Fixed 120px tile, green tint when ON, tap to toggle.
 * No ES modules — loaded as regular script. iOS 12+ safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
 *
 * Exposes globally: window.SwitchComponent = { createTile, updateTile }
 */
window.SwitchComponent = (function () {
  'use strict';

  var COLOR_ON = '#4caf50';

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
    var tile = DOM.createElement('div', 'tile tile-switch');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'switch';

    /* tint overlay — always present, opacity controlled via updateTile */
    var tint = DOM.createElement('div', 'tile-tint');
    tint.style.background = 'rgba(76,175,80,0.12)';
    tint.style.opacity = '0';
    tile.appendChild(tint);

    /* top row: icon + toggle */
    var top    = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon');
    iconEl.innerHTML = FMT.getIcon(icon, 28, entity_id);
    var toggle = DOM.createElement('div', 'tile-toggle');
    toggle.appendChild(DOM.createElement('div', 'tile-toggle-thumb'));
    top.appendChild(iconEl);
    top.appendChild(toggle);

    /* bottom row: empty value + label */
    var bottom  = DOM.createElement('div', 'tile-bottom');
    var valueEl = DOM.createElement('span', 'tile-value', '');
    var labelEl = DOM.createElement('span', 'tile-label', label);
    bottom.appendChild(valueEl);
    bottom.appendChild(labelEl);

    tile.appendChild(top);
    tile.appendChild(bottom);

    /* ---- Tap interaction ---- */
    function handleTap() {
      var currentState = tile.dataset.state || 'off';
      var service = currentState === 'on' ? 'turn_off' : 'turn_on';
      var next    = service === 'turn_on' ? 'on' : 'off';
      /* optimistic update */
      updateTile(tile, { state: next, attributes: {} });
      window.callService('switch', service, { entity_id: entity_id })
        .catch(function (err) {
          console.error('[switch] tap failed:', err);
          updateTile(tile, { state: currentState, attributes: {} });
        });
    }

    tile.addEventListener('touchend', function (e) {
      e.preventDefault();
      handleTap();
    });
    tile.addEventListener('click', function () {
      if (!('ontouchstart' in window)) { handleTap(); }
    });

    return tile;
  }

  /* ------------------------------------------------------------------ */
  /* updateTile                                                           */
  /* ------------------------------------------------------------------ */
  function updateTile(tile, stateObj) {
    var state = stateObj.state;

    tile.dataset.state = state;

    var toggle = tile.querySelector('.tile-toggle');
    var thumb  = tile.querySelector('.tile-toggle-thumb');
    var iconEl = tile.querySelector('.tile-icon');
    var tintEl = tile.querySelector('.tile-tint');

    tile.classList.remove('is-on', 'is-off', 'is-unavail');

    if (state === 'on') {
      tile.classList.add('is-on');
      if (toggle) { toggle.style.background = COLOR_ON; }
      if (thumb)  { thumb.style.transform = 'translateX(18px)'; }
      if (iconEl) { iconEl.style.color = COLOR_ON; }
      if (tintEl) { tintEl.style.opacity = '1'; }

    } else if (state === 'unavailable') {
      tile.classList.add('is-unavail');
      if (toggle) { toggle.style.background = ''; }
      if (thumb)  { thumb.style.transform = ''; }
      if (iconEl) { iconEl.style.color = ''; }
      if (tintEl) { tintEl.style.opacity = '0'; }

    } else {
      tile.classList.add('is-off');
      if (toggle) { toggle.style.background = ''; }
      if (thumb)  { thumb.style.transform = ''; }
      if (iconEl) { iconEl.style.color = ''; }
      if (tintEl) { tintEl.style.opacity = '0'; }
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
