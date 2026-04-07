/**
 * lock.js — Lock entity tile component
 * Retro Panel v2.11.0
 *
 * Design: same visual as mockup (centered SVG padlock, state label,
 * full-width action button) but compact 120px like switch/light tiles.
 *
 * No ES modules — IIFE + window global. iOS 12+ Safari safe.
 * No const/let/=>/?./?? — only var, function declarations.
 *
 * Exposes: window.LockComponent = { createTile, updateTile }
 */
window.LockComponent = (function () {
  'use strict';

  // SVG padlock — locked (closed arc)
  var SVG_LOCKED = '<svg width="32" height="32" viewBox="0 0 48 48" fill="none">'
    + '<rect x="10" y="22" width="28" height="20" rx="4" fill="currentColor" opacity="0.15"/>'
    + '<rect x="10" y="22" width="28" height="20" rx="4" stroke="currentColor" stroke-width="2"/>'
    + '<path d="M16 22V17a8 8 0 0116 0v5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
    + '<circle cx="24" cy="33" r="3" fill="currentColor"/>'
    + '</svg>';

  // SVG padlock — unlocked (open arc)
  var SVG_UNLOCKED = '<svg width="32" height="32" viewBox="0 0 48 48" fill="none">'
    + '<rect x="10" y="22" width="28" height="20" rx="4" fill="currentColor" opacity="0.15"/>'
    + '<rect x="10" y="22" width="28" height="20" rx="4" stroke="currentColor" stroke-width="2"/>'
    + '<path d="M16 22V17a8 8 0 0116 0" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>'
    + '<path d="M32 17h6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'
    + '<circle cx="24" cy="33" r="3" fill="currentColor"/>'
    + '</svg>';

  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label     = entityConfig.label || entityConfig.title || entity_id;

    var DOM = window.RP_DOM;

    // Root tile
    var tile = DOM.createElement('div', 'tile tile-lock');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'lock';

    // Name (top left, small)
    var nameEl = document.createElement('span');
    nameEl.className = 'lock-name';
    nameEl.textContent = label;

    // Center row: SVG icon + state label side by side
    var center = document.createElement('div');
    center.className = 'lock-center';

    var iconWrap = document.createElement('span');
    iconWrap.className = 'lock-icon-wrap';
    iconWrap.innerHTML = SVG_LOCKED;

    var stateEl = document.createElement('span');
    stateEl.className = 'lock-state-label lock-state-locked';
    stateEl.textContent = 'Chiusa';

    center.appendChild(iconWrap);
    center.appendChild(stateEl);

    // Action button (bottom, full-width)
    var actionBtn = document.createElement('button');
    actionBtn.className = 'lock-action-btn btn-unlock';
    actionBtn.type = 'button';
    actionBtn.textContent = 'Sblocca';

    tile.appendChild(nameEl);
    tile.appendChild(center);
    tile.appendChild(actionBtn);

    // Tap handler
    function handleTap() {
      var currentState = tile.dataset.state || 'locked';
      var service = currentState === 'locked' ? 'unlock' : 'lock';
      var next    = service === 'lock' ? 'locked' : 'unlocked';

      updateTile(tile, { state: next, attributes: {} });

      window.callService('lock', service, { entity_id: entity_id })
        .catch(function (err) {
          console.error('[lock] action failed:', err);
          updateTile(tile, { state: currentState, attributes: {} });
        });
    }

    actionBtn.addEventListener('touchend', function (e) {
      e.preventDefault();
      handleTap();
    });
    actionBtn.addEventListener('click', function () {
      if (!('ontouchstart' in window)) { handleTap(); }
    });

    return tile;
  }

  function updateTile(tile, stateObj) {
    var state = stateObj.state;
    tile.dataset.state = state;

    var iconWrap  = tile.querySelector('.lock-icon-wrap');
    var stateEl   = tile.querySelector('.lock-state-label');
    var actionBtn = tile.querySelector('.lock-action-btn');

    tile.classList.remove('is-locked', 'is-unlocked', 'is-unavail');

    if (state === 'locked') {
      tile.classList.add('is-locked');
      if (iconWrap) { iconWrap.innerHTML = SVG_LOCKED; }
      if (stateEl) {
        stateEl.textContent = 'Chiusa';
        stateEl.className = 'lock-state-label lock-state-locked';
      }
      if (actionBtn) {
        actionBtn.textContent = 'Sblocca';
        actionBtn.className = 'lock-action-btn btn-unlock';
        actionBtn.disabled = false;
      }

    } else if (state === 'unlocked') {
      tile.classList.add('is-unlocked');
      if (iconWrap) { iconWrap.innerHTML = SVG_UNLOCKED; }
      if (stateEl) {
        stateEl.textContent = 'Aperta';
        stateEl.className = 'lock-state-label lock-state-unlocked';
      }
      if (actionBtn) {
        actionBtn.textContent = 'Blocca';
        actionBtn.className = 'lock-action-btn btn-lock';
        actionBtn.disabled = false;
      }

    } else {
      tile.classList.add('is-unavail');
      if (iconWrap) { iconWrap.innerHTML = SVG_LOCKED; }
      if (stateEl) {
        stateEl.textContent = 'N/D';
        stateEl.className = 'lock-state-label';
      }
      if (actionBtn) {
        actionBtn.textContent = '\u2014';
        actionBtn.className = 'lock-action-btn';
        actionBtn.disabled = true;
      }
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
