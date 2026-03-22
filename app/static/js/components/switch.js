/**
 * switch.js — Switch entity tile component
 * Simple toggle, no brightness control.
 * ES2017-compatible, iOS 15 Safari safe.
 */

import { createElement } from '../utils/dom.js';
import { getIcon } from '../utils/format.js';
import { callService } from '../api.js';

/**
 * Create a tile element for a switch entity.
 * @param {object} entityConfig  { entity_id, label, icon }
 * @returns {HTMLElement}
 */
export function createTile(entityConfig) {
  const { entity_id, label, icon } = entityConfig;

  const tile = createElement('div', 'tile state-off');
  tile.dataset.entityId = entity_id;

  const top = createElement('div', 'tile-top');
  const iconEl = createElement('span', 'tile-icon', getIcon(icon));
  const indicator = createElement('span', 'tile-toggle-indicator');
  top.appendChild(iconEl);
  top.appendChild(indicator);

  const bottom = createElement('div', 'tile-bottom');
  const valueEl = createElement('span', 'tile-value', 'Off');
  const labelEl = createElement('span', 'tile-label', label);
  bottom.appendChild(valueEl);
  bottom.appendChild(labelEl);

  tile.appendChild(top);
  tile.appendChild(bottom);

  // Toggle on tap
  function handleTap() {
    const currentState = tile.dataset.state || 'off';
    const service = currentState === 'on' ? 'turn_off' : 'turn_on';
    callService('switch', service, { entity_id }).catch(err => {
      console.error('[switch] Service call failed:', err);
    });
  }

  tile.addEventListener('touchend', function(e) {
    e.preventDefault();
    handleTap();
  });

  tile.addEventListener('click', function(e) {
    if (!('ontouchstart' in window)) handleTap();
  });

  return tile;
}

/**
 * Update a switch tile in-place with new state.
 * @param {HTMLElement} tile
 * @param {{ state: string, attributes: object }} stateObj
 */
export function updateTile(tile, stateObj) {
  const { state } = stateObj;
  tile.dataset.state = state;

  const valueEl = tile.querySelector('.tile-value');

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
