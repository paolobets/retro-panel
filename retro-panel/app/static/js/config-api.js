/**
 * config-api.js — Plain-script API helpers for the config page.
 * No ES modules — loaded as regular <script> for iOS 15 safety.
 * All paths are relative (no leading slash) for HA Ingress compatibility.
 */

function cfgFetchPanelConfig() {
  return fetch('api/panel-config').then(function(r) {
    if (!r.ok) { throw new Error('Failed to load config (' + r.status + ')'); }
    return r.json();
  });
}

function cfgFetchEntities() {
  return fetch('api/entities').then(function(r) {
    if (!r.ok) { throw new Error('Failed to load entities (' + r.status + ')'); }
    return r.json();
  });
}

function cfgSaveConfig(entities) {
  return fetch('api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entities: entities }),
  }).then(function(r) {
    return r.json().then(function(data) {
      if (!r.ok) { throw new Error(data.error || 'Save failed (' + r.status + ')'); }
      return data;
    });
  });
}
