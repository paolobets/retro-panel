/**
 * dom.js — Lightweight DOM helper utilities
 * Exposed globally as window.RP_DOM. No ES modules — loaded as regular script.
 */
(function () {
  'use strict';

  function qs(selector, parent) {
    return (parent || document).querySelector(selector);
  }

  function createElement(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function showElement(el) { el.classList.remove('hidden'); }
  function hideElement(el) { el.classList.add('hidden'); }

  window.RP_DOM = {
    qs: qs,
    createElement: createElement,
    showElement: showElement,
    hideElement: hideElement,
  };
}());
