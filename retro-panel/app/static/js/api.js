/**
 * api.js — Fetch wrapper for Retro Panel backend API
 * All paths are relative so the app works behind HA Ingress.
 * ES2017-compatible, no external dependencies.
 */

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/**
 * Core fetch wrapper with retry on network error.
 * @param {string} path  Relative API path, e.g. "api/panel-config"
 * @param {object} [options]  fetch options
 * @param {number} [retries]  Number of retries on network error (default 2)
 * @returns {Promise<any>}  Parsed JSON response
 */
async function apiFetch(path, options = {}, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(path, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });

      if (!resp.ok) {
        let message = `HTTP ${resp.status}`;
        try {
          const body = await resp.json();
          message = body.error || message;
        } catch (_) { /* ignore parse error */ }
        throw new ApiError(message, resp.status);
      }

      return await resp.json();
    } catch (err) {
      lastError = err;
      // Only retry on network errors (not 4xx/5xx)
      if (err instanceof ApiError) throw err;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  throw lastError;
}

/**
 * Fetch panel configuration from backend.
 * @returns {Promise<object>}
 */
export async function getPanelConfig() {
  return apiFetch('api/panel-config');
}

/**
 * Fetch states of all configured entities.
 * @returns {Promise<Array>}
 */
export async function getAllStates() {
  return apiFetch('api/states');
}

/**
 * Fetch state of a single entity.
 * @param {string} entityId
 * @returns {Promise<object>}
 */
export async function getState(entityId) {
  return apiFetch(`api/state/${entityId}`);
}

/**
 * Call a Home Assistant service.
 * @param {string} domain  e.g. "light"
 * @param {string} service  e.g. "turn_on"
 * @param {object} data  Service call payload (must include entity_id)
 * @returns {Promise<object>}
 */
export async function callService(domain, service, data) {
  return apiFetch(`api/service/${domain}/${service}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
