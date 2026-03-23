/**
 * light.js — Light entity tile component
 * Supports toggle and long-press brightness control.
 * No ES modules — loaded as regular script. iOS 15 Safari safe.
 *
 * Exposes globally: window.LightComponent = { createTile, updateTile }
 */
window.LightComponent = (function () {
  'use strict';

  var LONG_PRESS_MS = 500;

  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label = entityConfig.label;
    var icon = entityConfig.icon;

    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    var tile = DOM.createElement('div', 'tile entity-light state-off');
    tile.dataset.entityId = entity_id;

    // Top row: icon + iOS pill toggle
    var top = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon', FMT.getIcon(icon));
    var toggle = DOM.createElement('div', 'tile-toggle');
    toggle.appendChild(DOM.createElement('div', 'tile-toggle-thumb'));
    top.appendChild(iconEl);
    top.appendChild(toggle);

    // Bottom row: value + label
    var bottom = DOM.createElement('div', 'tile-bottom');
    var valueEl = DOM.createElement('span', 'tile-value', 'Off');
    var labelEl = DOM.createElement('span', 'tile-label', label);
    bottom.appendChild(valueEl);
    bottom.appendChild(labelEl);

    // Brightness slider (hidden by default)
    var brightnessContainer = DOM.createElement('div', 'brightness-container hidden');
    var slider = document.createElement('input');
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
    var longPressTimer = null;
    var sliderVisible = false;

    function handleTap() {
      var currentState = tile.dataset.state || 'off';
      var service = currentState === 'on' ? 'turn_off' : 'turn_on';
      var nextState = service === 'turn_on' ? 'on' : 'off';
      // Optimistic update
      updateTile(tile, { state: nextState, attributes: {} });

      window.callService('light', service, { entity_id: entity_id }).catch(function (err) {
        console.error('[light] Service call failed:', err);
        // Revert on failure
        updateTile(tile, { state: currentState, attributes: {} });
      });
    }

    // Long press: show/hide brightness slider.
    // longPressTimer must be set to null BEFORE touchend fires to avoid
    // triggering handleTap() after a long-press.
    function handleLongPress() {
      longPressTimer = null;
      sliderVisible = !sliderVisible;
      if (sliderVisible) {
        brightnessContainer.classList.remove('hidden');
      } else {
        brightnessContainer.classList.add('hidden');
      }
    }

    tile.addEventListener('touchstart', function () {
      longPressTimer = setTimeout(handleLongPress, LONG_PRESS_MS);
    }, { passive: true });

    tile.addEventListener('touchend', function () {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        handleTap();
      }
    });

    tile.addEventListener('touchmove', function () {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }, { passive: true });

    // Mouse fallback for desktop
    tile.addEventListener('click', function () {
      if (!('ontouchstart' in window)) handleTap();
    });

    // Brightness slider: debounced service call
    var sliderDebounce = null;
    slider.addEventListener('input', function () {
      clearTimeout(sliderDebounce);
      var brightness = parseInt(slider.value, 10);
      valueEl.textContent = FMT.formatBrightness(brightness);
      sliderDebounce = setTimeout(function () {
        window.callService('light', 'turn_on', { entity_id: entity_id, brightness: brightness }).catch(function (err) {
          console.error('[light] Brightness call failed:', err);
        });
      }, 300);
    });

    slider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
    slider.addEventListener('click', function (e) { e.stopPropagation(); });

    return tile;
  }

  function updateTile(tile, stateObj) {
    var state = stateObj.state;
    var attributes = stateObj.attributes;
    tile.dataset.state = state;

    var valueEl = tile.querySelector('.tile-value');
    var slider = tile.querySelector('.brightness-slider');

    tile.classList.remove('state-on', 'state-off', 'state-unavailable');

    if (state === 'on') {
      tile.classList.add('state-on');
      var brightness = attributes && attributes.brightness;
      if (brightness !== undefined && brightness !== null) {
        valueEl.textContent = window.RP_FMT.formatBrightness(brightness);
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

  return { createTile: createTile, updateTile: updateTile };
}());
