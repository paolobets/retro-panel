/**
 * switch.js — Switch entity tile component.
 * Fixed 120px tile, green tint when ON, no On/Off text.
 * No ES modules — loaded as regular script. iOS 12 safe.
 *
 * Exposes globally: window.SwitchComponent = { createTile, updateTile }
 */
window.SwitchComponent = (function () {
  'use strict';

  var COLOR_ON = '#4caf50';

  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label     = entityConfig.label;
    var icon      = entityConfig.icon;

    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    var tile = DOM.createElement('div', 'tile entity-switch state-off');
    tile.dataset.entityId = entity_id;

    /* Tint overlay (same pattern as light) */
    var tint = DOM.createElement('div', 'light-tint');
    tint.style.background = 'rgba(76,175,80,0.12)';
    tile.appendChild(tint);

    /* Top row */
    var top    = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon');
    iconEl.innerHTML = FMT.getIcon(icon, 28, entity_id);
    var toggle = DOM.createElement('div', 'tile-toggle');
    toggle.appendChild(DOM.createElement('div', 'tile-toggle-thumb'));
    top.appendChild(iconEl);
    top.appendChild(toggle);

    /* Bottom row: no value text, only label */
    var bottom  = DOM.createElement('div', 'tile-bottom');
    var valueEl = DOM.createElement('span', 'tile-value', '');
    var labelEl = DOM.createElement('span', 'tile-label', label);
    bottom.appendChild(valueEl);
    bottom.appendChild(labelEl);

    tile.appendChild(top);
    tile.appendChild(bottom);

    /* ---- Interaction ---- */
    function handleTap() {
      var currentState = tile.dataset.state || 'off';
      var service  = currentState === 'on' ? 'turn_off' : 'turn_on';
      var next     = service === 'turn_on' ? 'on' : 'off';
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

  function updateTile(tile, stateObj) {
    var state = stateObj.state;
    tile.dataset.state = state;

    var toggle   = tile.querySelector('.tile-toggle');
    var thumb    = tile.querySelector('.tile-toggle-thumb');
    var iconEl   = tile.querySelector('.tile-icon');
    var tintEl   = tile.querySelector('.light-tint');

    tile.classList.remove('state-on', 'state-off', 'state-unavailable');

    if (state === 'on') {
      tile.classList.add('state-on');
      tile.style.borderColor = COLOR_ON;
      if (toggle) { toggle.style.background = COLOR_ON; }
      if (thumb)  { thumb.style.transform = 'translateX(18px)'; }
      if (iconEl) { iconEl.style.color = COLOR_ON; }
      if (tintEl) { tintEl.style.opacity = '1'; }

    } else if (state === 'unavailable') {
      tile.classList.add('state-unavailable');
      tile.style.borderColor = '';
      if (toggle) { toggle.style.background = ''; }
      if (thumb)  { thumb.style.transform = ''; }
      if (iconEl) { iconEl.style.color = ''; }
      if (tintEl) { tintEl.style.opacity = '0'; }

    } else {
      tile.classList.add('state-off');
      tile.style.borderColor = 'transparent';
      if (toggle) { toggle.style.background = ''; }
      if (thumb)  { thumb.style.transform = ''; }
      if (iconEl) { iconEl.style.color = ''; }
      if (tintEl) { tintEl.style.opacity = '0'; }
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
