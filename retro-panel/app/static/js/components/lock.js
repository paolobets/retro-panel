/**
 * lock.js — Lock entity tile component v1.0
 * Fixed 120px tile, green when locked, orange when unlocked, tap to toggle.
 * No ES modules — loaded as regular script. iOS 12+ safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
 *
 * Exposes globally: window.LockComponent = { createTile, updateTile }
 */
window.LockComponent = (function () {
  'use strict';

  var COLOR_LOCKED   = '#4caf50';
  var COLOR_UNLOCKED = '#ff9800';

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
    var tile = DOM.createElement('div', 'tile tile-lock');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'lock';

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
      var currentState = tile.dataset.state || 'locked';
      var service = currentState === 'locked' ? 'unlock' : 'lock';
      var next    = service === 'lock' ? 'locked' : 'unlocked';
      /* optimistic update */
      updateTile(tile, { state: next, attributes: {} });
      window.callService('lock', service, { entity_id: entity_id })
        .catch(function (err) {
          console.error('[lock] tap failed:', err);
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
    var labelEl = tile.querySelector('.tile-label');

    tile.classList.remove('is-locked', 'is-unlocked', 'is-unavail');

    if (state === 'locked') {
      tile.classList.add('is-locked');
      if (toggle) { toggle.style.background = COLOR_LOCKED; }
      if (thumb)  { thumb.style.transform = ''; }
      if (iconEl) { iconEl.style.color = COLOR_LOCKED; }
      if (tintEl) { tintEl.style.background = 'rgba(76,175,80,0.12)'; tintEl.style.opacity = '1'; }
      if (labelEl) { labelEl.textContent = 'Bloccato'; }

    } else if (state === 'unlocked') {
      tile.classList.add('is-unlocked');
      if (toggle) { toggle.style.background = COLOR_UNLOCKED; }
      if (thumb)  { thumb.style.transform = 'translateX(18px)'; }
      if (iconEl) { iconEl.style.color = COLOR_UNLOCKED; }
      if (tintEl) { tintEl.style.background = 'rgba(255,152,0,0.12)'; tintEl.style.opacity = '1'; }
      if (labelEl) { labelEl.textContent = 'Sbloccato'; }

    } else if (state === 'unavailable') {
      tile.classList.add('is-unavail');
      if (toggle) { toggle.style.background = ''; }
      if (thumb)  { thumb.style.transform = ''; }
      if (iconEl) { iconEl.style.color = ''; }
      if (tintEl) { tintEl.style.opacity = '0'; }

    } else {
      /* unknown or other states — treat as unlocked-ish but dimmed */
      if (toggle) { toggle.style.background = ''; }
      if (thumb)  { thumb.style.transform = ''; }
      if (iconEl) { iconEl.style.color = ''; }
      if (tintEl) { tintEl.style.opacity = '0'; }
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
