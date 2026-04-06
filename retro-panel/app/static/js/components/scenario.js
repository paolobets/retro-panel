/**
 * scenario.js — Scenario tile component v2.9.32
 *
 * Renders a tappable tile for a HA scene, script or automation.
 * Layout mirrors switch.js: triple-lock 120px, MDI icon top-left,
 * domain badge top-right, label bottom-left.
 * Tap → brief green flash (1.5 s), then returns to idle.
 *
 * No ES modules — IIFE + window global. iOS 12+ Safari safe.
 * NO const/let/=>/?./?? — only var, function declarations, IIFE pattern.
 *
 * Exposes globally: window.ScenarioComponent = { createTile, createCard, updateTile }
 * createCard is an alias for createTile for backward compatibility.
 */
window.ScenarioComponent = (function () {
  'use strict';

  var COLOR_ON = '#4caf50';

  /* Domain → MDI icon default */
  var DOMAIN_ICON = {
    'scene':      'palette',
    'script':     'script-text',
    'automation': 'lightning-bolt',
  };

  /* Domain → service to call on tap */
  var DOMAIN_SERVICE = {
    'scene':      'turn_on',
    'script':     'turn_on',
    'automation': 'trigger',
  };

  /* Domain → badge label */
  var DOMAIN_LABEL = {
    'scene':      'Scena',
    'script':     'Script',
    'automation': 'Automazione',
  };

  /* ------------------------------------------------------------------ */
  /* createTile                                                           */
  /* ------------------------------------------------------------------ */
  function createTile(entityConfig) {
    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    var entity_id   = entityConfig.entity_id;
    var domain      = entity_id.split('.')[0];
    var label       = entityConfig.label || entityConfig.title || entity_id.split('.').pop();
    var iconName    = entityConfig.icon || DOMAIN_ICON[domain] || 'play';
    var borderColor = entityConfig.border_color || '';

    /* root tile — same triple-lock as switch */
    var tile = DOM.createElement('div', 'tile tile-scenario');
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'scenario';

    /* tint overlay — flashes green on activate */
    var tint = DOM.createElement('div', 'tile-tint');
    tint.style.background = 'rgba(76,175,80,0.12)';
    tint.style.opacity = '0';
    tile.appendChild(tint);

    /* top row: MDI icon + domain badge */
    var top    = DOM.createElement('div', 'tile-top');
    var iconEl = DOM.createElement('span', 'tile-icon');
    iconEl.innerHTML = FMT.getIcon(iconName, 28, entity_id);

    /* apply border color */
    if (borderColor) {
      tile.style.borderColor = borderColor;
      iconEl.style.color     = borderColor;
    }

    var badge = DOM.createElement('span', 'scenario-badge');
    badge.textContent = DOMAIN_LABEL[domain] || domain;

    top.appendChild(iconEl);
    top.appendChild(badge);

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

      var service = DOMAIN_SERVICE[domain] || 'turn_on';
      window.callService(domain, service, { entity_id: entity_id })
        .then(function () {
          setTimeout(function () {
            tile.classList.remove('is-on');
            if (tint)   { tint.style.opacity = '0'; }
            if (iconEl) { iconEl.style.color = ''; }
          }, 1500);
        })
        .catch(function (err) {
          console.warn('[scenario] Failed to activate', entity_id, err.message);
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

  /* Scenarios have no persistent state — no-op */
  function updateTile(tile, stateObj) { /* intentional no-op */ }

  return {
    createTile: createTile,
    createCard: createTile,   /* backward compat alias */
    updateTile: updateTile,
  };
}());
