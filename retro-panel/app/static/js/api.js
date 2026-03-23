/**
 * api.js — Fetch wrapper for Retro Panel backend API
 * All paths are relative so the app works behind HA Ingress.
 * No ES modules — loaded as regular script. iOS 15 Safari safe.
 *
 * Exposes globally: getPanelConfig, getAllStates, getState, callService
 */
(function () {
  'use strict';

  var FETCH_TIMEOUT_MS = 20000; // 20 s — prevents indefinite hangs on iOS Safari

  function ApiError(message, status) {
    this.message = message;
    this.status = status;
    this.name = 'ApiError';
  }
  ApiError.prototype = Object.create(Error.prototype);

  /**
   * Core fetch wrapper with timeout and retry on network error.
   * @param {string} path  Relative API path, e.g. "api/panel-config"
   * @param {object} [options]  fetch options
   * @param {number} [retries]  Number of retries on network error (default 2)
   * @returns {Promise<any>}  Parsed JSON response
   */
  async function apiFetch(path, options, retries) {
    if (options === undefined) options = {};
    if (retries === undefined) retries = 2;

    // Only send Content-Type for requests that have a body (POST, PUT, PATCH).
    // Adding Content-Type to GET requests triggers CORS preflight in some
    // iOS Safari / WKWebView contexts and is semantically incorrect.
    var isBodyRequest = options.method && options.method !== 'GET';
    var headers = Object.assign(
      {},
      isBodyRequest ? { 'Content-Type': 'application/json' } : {},
      options.headers || {}
    );

    var lastError;
    for (var attempt = 0; attempt <= retries; attempt++) {
      var controller = new AbortController();
      var timeoutId = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);
      try {
        var resp = await fetch(path, Object.assign({}, options, {
          headers: headers,
          signal: controller.signal,
        }));
        clearTimeout(timeoutId);

        if (!resp.ok) {
          var msg = 'HTTP ' + resp.status;
          try {
            var body = await resp.json();
            msg = body.error || msg;
          } catch (_) { /* ignore */ }
          throw new ApiError(msg, resp.status);
        }

        return await resp.json();
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
        if (err instanceof ApiError) throw err;
        if (err.name === 'AbortError') {
          lastError = new Error('Request timed out after ' + (FETCH_TIMEOUT_MS / 1000) + 's');
          break; // no retry on timeout
        }
        if (attempt < retries) {
          await new Promise(function (resolve) { setTimeout(resolve, 1000); });
        }
      }
    }
    throw lastError;
  }

  window.getPanelConfig = function () { return apiFetch('api/panel-config'); };
  window.getAllStates   = function () { return apiFetch('api/states'); };
  window.getState       = function (entityId) { return apiFetch('api/state/' + entityId); };
  window.callService    = function (domain, service, data) {
    return apiFetch('api/service/' + domain + '/' + service, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };
  window.getHaAreas = function () { return apiFetch('api/ha-areas'); };
}());
