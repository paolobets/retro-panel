/**
 * scenario.js — Scenario tile component for Retro Panel v2.0
 *
 * Renders a tappable tile for a HA scene or script.
 * Tapping activates the scene/script via the backend proxy.
 *
 * No ES modules — IIFE + window global. iOS 12+ Safari safe.
 * No const/let/=>/?./?? — only var, function declarations, IIFE pattern.
 *
 * Exposes globally: window.ScenarioComponent = { createTile, createCard, updateTile }
 * createCard is an alias for createTile for backward compatibility.
 */
window.ScenarioComponent = (function () {
  'use strict';

  /**
   * Create a scenario tile element.
   * @param {object} entityConfig  { entity_id, label, title, icon }
   * @returns {HTMLElement}
   */
  function createTile(entityConfig) {
    var DOM = window.RP_DOM;
    var entity_id = entityConfig.entity_id;
    var domain = entity_id.split('.')[0];

    var tile = DOM.createElement('div', 'tile tile-scenario');
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    tile.dataset.entityId = entity_id;
    tile.dataset.layoutType = 'scenario';

    var iconEl = DOM.createElement('div', 'scenario-icon');
    iconEl.textContent = entityConfig.icon || '\uD83C\uDFAD';

    var titleEl = DOM.createElement('div', 'scenario-title');
    titleEl.textContent = entityConfig.label || entityConfig.title || entity_id;

    var domainEl = DOM.createElement('div', 'scenario-domain');
    domainEl.textContent = domain;

    tile.appendChild(iconEl);
    tile.appendChild(titleEl);
    tile.appendChild(domainEl);

    // Activate on tap
    function activate(e) {
      e.preventDefault();
      if (tile.classList.contains('is-on')) { return; }
      tile.classList.add('is-on');

      window.callService(domain, 'turn_on', { entity_id: entity_id })
        .then(function () {
          setTimeout(function () { tile.classList.remove('is-on'); }, 1500);
        })
        .catch(function (err) {
          console.warn('[scenario] Failed to activate', entity_id, err.message);
          tile.classList.remove('is-on');
        });
    }

    tile.addEventListener('touchend', activate);
    tile.addEventListener('click', function (e) {
      if (!('ontouchstart' in window)) { activate(e); }
    });

    return tile;
  }

  // Scenarios don't have meaningful persistent state — no-op
  function updateTile(tile, stateObj) {
    // intentional no-op
  }

  return {
    createTile: createTile,
    createCard: createTile,
    updateTile: updateTile,
  };
}());
