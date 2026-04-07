/**
 * button.js — Button tile component v2.9.32
 *
 * Renders a tappable tile for a HA button entity.
 * Tap fires button.press, shows a brief green flash (1.5 s),
 * then returns to idle.  Stateless — updateTile is a no-op.
 *
 * No ES modules — IIFE + window global. iOS 12+ Safari safe.
 * NO const/let/=>/?./?? — only var, function declarations, IIFE pattern.
 *
 * Exposes globally: window.ButtonComponent = { createTile, updateTile }
 */
window.ButtonComponent = (function () {
  'use strict';

  var COLOR_ON = '#4caf50';

  /* ------------------------------------------------------------------ */
  /* createTile                                                           */
  /* ------------------------------------------------------------------ */
  function createTile(entityConfig) {
    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    var entity_id   = entityConfig.entity_id;
    var label       = entityConfig.label || entityConfig.title || entity_id.split('.').pop();
    var iconName    = entityConfig.icon || 'gesture-tap-button';
    var borderColor = entityConfig.border_color || '';

    /* root tile */
    var tile = DOM.createElement('div', 'tile tile-button');
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'button';

    /* tint overlay — flashes green on press */
    var tint = DOM.createElement('div', 'tile-tint');
    tint.style.background = 'rgba(76,175,80,0.12)';
    tint.style.opacity = '0';
    tile.appendChild(tint);

    /* top row: MDI icon */
    var top    = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon');
    iconEl.innerHTML = FMT.getIcon(iconName, 28, entity_id);

    /* apply border color */
    if (borderColor) {
      tile.style.borderColor = borderColor;
      iconEl.style.color     = borderColor;
    }

    top.appendChild(iconEl);

    /* bottom row: label */
    var bottom  = DOM.createElement('div', 'tile-bottom');
    var labelEl = DOM.createElement('span', 'tile-label', label);
    bottom.appendChild(labelEl);

    tile.appendChild(top);
    tile.appendChild(bottom);

    /* ---- Tap interaction ---- */
    function activate(e) {
      e.preventDefault();
      if (tile.classList.contains('is-on')) { return; }

      /* optimistic visual */
      tile.classList.add('is-on');
      if (tint)   { tint.style.opacity = '1'; }
      if (iconEl) { iconEl.style.color = COLOR_ON; }

      window.callService('button', 'press', { entity_id: entity_id })
        .then(function () {
          setTimeout(function () {
            tile.classList.remove('is-on');
            if (tint)   { tint.style.opacity = '0'; }
            if (iconEl) { iconEl.style.color = ''; }
          }, 1500);
        })
        .catch(function (err) {
          console.warn('[button] Failed to press', entity_id, err.message);
          tile.classList.remove('is-on');
          if (tint)   { tint.style.opacity = '0'; }
          if (iconEl) { iconEl.style.color = ''; }
        });
    }

    tile.addEventListener('touchend', activate);
    tile.addEventListener('click', function (e) {
      if (!('ontouchstart' in window)) { activate(e); }
    });

    return tile;
  }

  /* Buttons have no persistent state — no-op */
  function updateTile(tile, stateObj) { /* intentional no-op */ }

  return {
    createTile: createTile,
    updateTile: updateTile,
  };
}());
