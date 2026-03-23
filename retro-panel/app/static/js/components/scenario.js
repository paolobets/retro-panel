/**
 * scenario.js — Scenario tile component for Retro Panel v1.2
 *
 * Renders a tappable card for a HA scene or script.
 * Tapping activates the scene/script via the backend proxy.
 *
 * No ES modules — IIFE + window global. iOS 15 safe.
 */
(function () {
  'use strict';

  var DOM = window.RP_DOM;

  /**
   * Create a scenario card element.
   * @param {object} cfg  { entity_id, title, icon }
   * @returns {HTMLElement}
   */
  function createCard(cfg) {
    var card = DOM.createElement('div', 'scenario-card');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');

    var iconEl = DOM.createElement('div', 'scenario-icon');
    iconEl.textContent = cfg.icon || '\uD83C\uDFAD';

    var titleEl = DOM.createElement('div', 'scenario-title');
    titleEl.textContent = cfg.title || cfg.entity_id;

    var domainEl = DOM.createElement('div', 'scenario-domain');
    domainEl.textContent = cfg.entity_id.split('.')[0];

    card.appendChild(iconEl);
    card.appendChild(titleEl);
    card.appendChild(domainEl);

    // Activate on tap
    function activate(e) {
      e.preventDefault();
      if (card.classList.contains('scenario-activating')) { return; }
      card.classList.add('scenario-activating');

      var domain = cfg.entity_id.split('.')[0];
      var service = domain === 'scene' ? 'turn_on' : 'turn_on';

      window.callService(domain, service, { entity_id: cfg.entity_id })
        .then(function () {
          card.classList.remove('scenario-activating');
          card.classList.add('scenario-done');
          setTimeout(function () { card.classList.remove('scenario-done'); }, 1500);
        })
        .catch(function (err) {
          console.warn('[scenario] Failed to activate', cfg.entity_id, err.message);
          card.classList.remove('scenario-activating');
        });
    }

    card.addEventListener('touchend', activate);
    card.addEventListener('click', function (e) {
      if (!('ontouchstart' in window)) { activate(e); }
    });

    return card;
  }

  window.ScenarioComponent = { createCard: createCard };
}());
