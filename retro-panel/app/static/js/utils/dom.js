/**
 * dom.js — Lightweight DOM helper utilities
 * ES2017-compatible, no external dependencies.
 */

/** @param {string} selector @param {Document|Element} parent */
export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

/** @param {string} selector @param {Document|Element} parent @returns {Element[]} */
export function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [text]
 * @returns {HTMLElement}
 */
export function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** @param {Element} el */
export function showElement(el) {
  el.classList.remove('hidden');
}

/** @param {Element} el */
export function hideElement(el) {
  el.classList.add('hidden');
}

/**
 * Add an event listener. Returns the handler for removal if needed.
 * @param {Element|Window|Document} element
 * @param {string} event
 * @param {Function} handler
 */
export function on(element, event, handler) {
  element.addEventListener(event, handler);
  return handler;
}
