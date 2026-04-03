/**
 * api.js — Fetch wrapper for Retro Panel backend API
 * All paths are relative so the app works behind HA Ingress.
 * No ES modules — loaded as regular script. iOS 12 Safari safe.
 * No async/await, no AbortController (not reliable on iOS 12.0).
 *
 * Exposes globally: getPanelConfig, getAllStates, getStates, getState, callService
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
   * Returns a Promise that rejects after ms milliseconds.
   * Used instead of AbortController (not available on iOS 12.0).
   */
  function withTimeout(promise, ms) {
    var timeoutPromise = new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('Request timed out after ' + (ms / 1000) + 's'));
      }, ms);
    });
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Core fetch wrapper with timeout and retry on network error.
   * @param {string} path     Relative API path, e.g. "api/panel-config"
   * @param {object} options  fetch options
   * @param {number} retries  Number of retries on network error (default 2)
   * @returns {Promise<any>}  Parsed JSON response
   */
  function apiFetch(path, options, retries) {
    if (options === undefined) { options = {}; }
    if (retries === undefined) { retries = 2; }

    var isBodyRequest = options.method && options.method !== 'GET';
    var headers = Object.assign(
      {},
      isBodyRequest ? { 'Content-Type': 'application/json' } : {},
      options.headers || {}
    );

    function attempt(n) {
      return withTimeout(
        fetch(path, Object.assign({}, options, { headers: headers })),
        FETCH_TIMEOUT_MS
      ).then(function (resp) {
        if (!resp.ok) {
          return resp.json().catch(function () { return null; }).then(function (body) {
            var msg = (body && body.error) ? body.error : 'HTTP ' + resp.status;
            throw new ApiError(msg, resp.status);
          });
        }
        return resp.json();
      }).catch(function (err) {
        if (err instanceof ApiError) { throw err; }
        if (n < retries) {
          return new Promise(function (resolve) {
            setTimeout(resolve, 1000);
          }).then(function () {
            return attempt(n + 1);
          });
        }
        throw err;
      });
    }

    return attempt(0);
  }

  window.getPanelConfig = function () { return apiFetch('api/panel-config'); };
  window.getAllStates   = function () { return apiFetch('api/states'); };
  window.getStates      = function (entityIds) {
    if (!entityIds || entityIds.length === 0) { return Promise.resolve([]); }
    return apiFetch('api/states?ids=' + entityIds.join(','));
  };
  window.getState       = function (entityId) { return apiFetch('api/state/' + entityId); };
  window.callService    = function (domain, service, data) {
    return apiFetch('api/service/' + domain + '/' + service, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };
  window.getHaAreas = function () { return apiFetch('api/picker/areas'); };
}());
