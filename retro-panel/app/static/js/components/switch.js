/**
 * switch.js — Switch entity tile component
 * Simple toggle, no brightness control.
 * No ES modules — loaded as regular script. iOS 15 Safari safe.
 *
 * Exposes globally: window.SwitchComponent = { createTile, updateTile }
 */
window.SwitchComponent = (function () {
  'use strict';

  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label = entityConfig.label;
    var icon = entityConfig.icon;

    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    var tile = DOM.createElement('div', 'tile entity-switch state-off');
    tile.dataset.entityId = entity_id;

    var top = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon');
    iconEl.innerHTML = FMT.getIcon(icon, 28, entity_id);
    var toggle = DOM.createElement('div', 'tile-toggle');
    toggle.appendChild(DOM.createElement('div', 'tile-toggle-thumb'));
    top.appendChild(iconEl);
    top.appendChild(toggle);

    var bottom = DOM.createElement('div', 'tile-bottom');
    var valueEl = DOM.createElement('span', 'tile-value', 'Off');
    var labelEl = DOM.createElement('span', 'tile-label', label);
    bottom.appendChild(valueEl);
    bottom.appendChild(labelEl);

    tile.appendChild(top);
    tile.appendChild(bottom);

    function handleTap() {
      var currentState = tile.dataset.state || 'off';
      var service = currentState === 'on' ? 'turn_off' : 'turn_on';
      var nextState = service === 'turn_on' ? 'on' : 'off';
      // Optimistic update
      updateTile(tile, { state: nextState, attributes: {} });

      window.callService('switch', service, { entity_id: entity_id }).catch(function (err) {
        console.error('[switch] Service call failed:', err);
        updateTile(tile, { state: currentState, attributes: {} });
      });
    }

    tile.addEventListener('touchend', function (e) {
      e.preventDefault();
      handleTap();
    });

    tile.addEventListener('click', function () {
      if (!('ontouchstart' in window)) handleTap();
    });

    return tile;
  }

  function updateTile(tile, stateObj) {
    var state = stateObj.state;
    tile.dataset.state = state;

    var valueEl = tile.querySelector('.tile-value');
    tile.classList.remove('state-on', 'state-off', 'state-unavailable');

    if (state === 'on') {
      tile.classList.add('state-on');
      valueEl.textContent = 'On';
    } else if (state === 'unavailable') {
      tile.classList.add('state-unavailable');
      valueEl.textContent = 'N/A';
    } else {
      tile.classList.add('state-off');
      valueEl.textContent = 'Off';
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
