/**
 * light.js — Light entity tile component
 * Supports toggle and long-press brightness control.
 * ES2017-compatible, iOS 15 Safari safe.
 */

import { createElement } from '../utils/dom.js';
import { getIcon, formatBrightness } from '../utils/format.js';
import { callService } from '../api.js';

const LONG_PRESS_MS = 500;

/**
 * Create a tile element for a light entity.
 * @param {object} entityConfig  { entity_id, label, icon }
 * @returns {HTMLElement}
 */
export function createTile(entityConfig) {
  const { entity_id, label, icon } = entityConfig;

  const tile = createElement('div', 'tile state-off');
  tile.dataset.entityId = entity_id;

  // Top row: icon + state indicator
  const top = createElement('div', 'tile-top');
  const iconEl = createElement('span', 'tile-icon', getIcon(icon));
  const indicator = createElement('span', 'tile-toggle-indicator');
  top.appendChild(iconEl);
  top.appendChild(indicator);

  // Bottom row: value + label
  const bottom = createElement('div', 'tile-bottom');
  const valueEl = createElement('span', 'tile-value', 'Off');
  const labelEl = createElement('span', 'tile-label', label);
  bottom.appendChild(valueEl);
  bottom.appendChild(labelEl);

  // Brightness slider (hidden by default)
  const brightnessContainer = createElement('div', 'brightness-container hidden');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.className = 'brightness-slider';
  slider.min = '1';
  slider.max = '255';
  slider.value = '255';
  brightnessContainer.appendChild(slider);

  tile.appendChild(top);
  tile.appendChild(bottom);
  tile.appendChild(brightnessContainer);

  // --- Interaction ---
  let longPressTimer = null;
  let sliderVisible = false;

  // Toggle on tap (short press)
  function handleTap() {
    const currentState = tile.dataset.state || 'off';
    const service = currentState === 'on' ? 'turn_off' : 'turn_on';
    // Optimistic update
    const nextState = service === 'turn_on' ? 'on' : 'off';
    updateTile(tile, { state: nextState, attributes: {} });

    callService('light', service, { entity_id }).catch(err => {
      console.error('[light] Service call failed:', err);
      // Revert on failure
      updateTile(tile, { state: currentState, attributes: {} });
    });
  }

  // Long press: show/hide brightness slider.
  // IMPORTANT: longPressTimer must be set to null here before the touchend
  // fires, otherwise touchend sees a truthy (expired) timer ID and calls
  // handleTap() — causing every long-press to also toggle the light.
  function handleLongPress() {
    longPressTimer = null;  // clear BEFORE touchend fires
    sliderVisible = !sliderVisible;
    if (sliderVisible) {
      brightnessContainer.classList.remove('hidden');
    } else {
      brightnessContainer.classList.add('hidden');
    }
  }

  tile.addEventListener('touchstart', function(e) {
    longPressTimer = setTimeout(handleLongPress, LONG_PRESS_MS);
  }, { passive: true });

  tile.addEventListener('touchend', function(e) {
    if (longPressTimer) {
      // Timer still pending = short tap (long-press did not fire yet)
      clearTimeout(longPressTimer);
      longPressTimer = null;
      handleTap();
    }
    // If longPressTimer is null here, long-press already fired — do not toggle
  });

  tile.addEventListener('touchmove', function() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }, { passive: true });

  // Mouse fallback for desktop testing
  tile.addEventListener('click', function(e) {
    if (!('ontouchstart' in window)) handleTap();
  });

  // Brightness slider: debounced service call
  let sliderDebounce = null;
  slider.addEventListener('input', function() {
    clearTimeout(sliderDebounce);
    const brightness = parseInt(slider.value, 10);
    valueEl.textContent = formatBrightness(brightness);
    sliderDebounce = setTimeout(function() {
      callService('light', 'turn_on', { entity_id, brightness }).catch(err => {
        console.error('[light] Brightness call failed:', err);
      });
    }, 300);
  });

  // Prevent tile tap when sliding
  slider.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: true });
  slider.addEventListener('click', function(e) { e.stopPropagation(); });

  return tile;
}

/**
 * Update a light tile in-place with new state.
 * @param {HTMLElement} tile
 * @param {{ state: string, attributes: object }} stateObj
 */
export function updateTile(tile, stateObj) {
  const { state, attributes } = stateObj;
  tile.dataset.state = state;

  const valueEl = tile.querySelector('.tile-value');
  const slider = tile.querySelector('.brightness-slider');

  tile.classList.remove('state-on', 'state-off', 'state-unavailable');

  if (state === 'on') {
    tile.classList.add('state-on');
    const brightness = attributes && attributes.brightness;
    if (brightness !== undefined && brightness !== null) {
      valueEl.textContent = formatBrightness(brightness);
      if (slider) slider.value = String(Math.round(brightness));
    } else {
      valueEl.textContent = 'On';
    }
  } else if (state === 'unavailable') {
    tile.classList.add('state-unavailable');
    valueEl.textContent = 'N/A';
  } else {
    tile.classList.add('state-off');
    valueEl.textContent = 'Off';
  }
}
