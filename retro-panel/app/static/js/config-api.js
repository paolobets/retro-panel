/**
 * config-api.js — API helpers for the configuration page.
 *
 * Standalone module: no imports from api.js.
 * All paths are computed relative to the current page so the app
 * works correctly behind HA Supervisor Ingress.
 * ES2017-compatible. No optional chaining, no nullish coalescing.
 */

/**
 * Compute the base path by stripping the trailing "config" or "config.html"
 * segment from window.location.pathname.
 * @returns {string}
 */
function getBasePath() {
  var p = window.location.pathname;
  return p.replace(/\/?(?:config(?:\.html)?)?$/, '') || '/';
}

/**
 * Fetch a JSON API endpoint relative to the add-on base path.
 * @param {string} path  e.g. "api/panel-config"
 * @param {object} [options]  fetch options
 * @returns {Promise<any>}
 */
function apiFetch(path, options) {
  var base = getBasePath();
  var url = base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  return fetch(url, options || {}).then(function(r) {
    if (!r.ok) {
      return r.json().then(function(body) {
        throw new Error(body.error || ('HTTP ' + r.status));
      }, function() {
        throw new Error('HTTP ' + r.status);
      });
    }
    return r.json();
  });
}

/**
 * Fetch current panel configuration from the backend.
 * @returns {Promise<object>}
 */
export function getPanelConfig() {
  return apiFetch('api/panel-config');
}

/**
 * Fetch all HA entity states from the Supervisor proxy.
 * @returns {Promise<Array>}
 */
export function getAllEntities() {
  return apiFetch('api/entities');
}

/**
 * Save updated panel configuration via the Supervisor API.
 * @param {object} payload
 * @returns {Promise<object>}
 */
export function saveConfig(payload) {
  return apiFetch('api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
