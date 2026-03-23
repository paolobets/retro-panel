/**
 * config-api.js — Plain-script API helpers for the config page.
 * No ES modules — loaded as regular <script> for iOS 15 safety.
 * All paths are relative (no leading slash) for HA Ingress compatibility.
 */

function cfgFetchPanelConfig() {
  return fetch('api/panel-config').then(function (r) {
    if (!r.ok) { throw new Error('Failed to load config (' + r.status + ')'); }
    return r.json();
  });
}

function cfgFetchEntities() {
  return fetch('api/entities').then(function (r) {
    if (!r.ok) { throw new Error('Failed to load entities (' + r.status + ')'); }
    return r.json();
  });
}

function cfgFetchSensors() {
  return fetch('api/entities?domain=sensor').then(function (r) {
    if (!r.ok) { throw new Error('Failed to load sensors (' + r.status + ')'); }
    return r.json();
  });
}

/**
 * Save the full pages structure.
 * pages: array of { id, title, icon, items: [{type, ...}] }
 */
function cfgSavePages(pages) {
  return fetch('api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pages: pages }),
  }).then(function (r) {
    return r.json().then(function (data) {
      if (!r.ok) { throw new Error(data.error || 'Save failed (' + r.status + ')'); }
      return data;
    });
  });
}
