/**
 * sensor.js — Sensor and binary_sensor read-only tile component
 * ES2017-compatible, iOS 15 Safari safe.
 */

import { createElement } from '../utils/dom.js';
import { getIcon, formatSensorValue, getBinarySensorLabel } from '../utils/format.js';

/**
 * Create a read-only tile for sensor or binary_sensor entities.
 * @param {object} entityConfig  { entity_id, label, icon }
 * @returns {HTMLElement}
 */
export function createTile(entityConfig) {
  const { entity_id, label, icon } = entityConfig;
  const isBinary = entity_id.startsWith('binary_sensor.');

  const tile = createElement('div', 'tile sensor-tile state-off');
  tile.dataset.entityId = entity_id;
  tile.dataset.isBinary = isBinary ? 'true' : 'false';

  const top = createElement('div', 'tile-top');
  const iconEl = createElement('span', 'tile-icon', getIcon(icon));
  top.appendChild(iconEl);

  const bottom = createElement('div', 'tile-bottom');
  const valueEl = createElement('span', 'tile-value', '—');
  const labelEl = createElement('span', 'tile-label', label);
  bottom.appendChild(valueEl);
  bottom.appendChild(labelEl);

  tile.appendChild(top);
  tile.appendChild(bottom);

  return tile;
}

/**
 * Update a sensor tile in-place with new state.
 * @param {HTMLElement} tile
 * @param {{ state: string, attributes: object }} stateObj
 */
export function updateTile(tile, stateObj) {
  const { state, attributes } = stateObj;
  const valueEl = tile.querySelector('.tile-value');
  const isBinary = tile.dataset.isBinary === 'true';

  tile.classList.remove('state-on', 'state-off', 'state-unavailable');

  if (state === 'unavailable' || state === 'unknown') {
    tile.classList.add('state-unavailable');
    valueEl.textContent = 'N/A';
    return;
  }

  if (isBinary) {
    const deviceClass = attributes && attributes.device_class;
    valueEl.textContent = getBinarySensorLabel(state, deviceClass);
    tile.classList.add(state === 'on' ? 'state-on' : 'state-off');
  } else {
    valueEl.textContent = formatSensorValue(state, attributes);
    tile.classList.add('state-on'); // sensors always show as "active"
  }
}
