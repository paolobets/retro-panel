/**
 * config-api.js — API helpers for the Retro Panel v1.2 config page.
 * No ES modules — plain functions for iOS 15 safety.
 * All paths are relative (no leading slash) for HA Ingress compatibility.
 */

function cfgFetchPanelConfig() {
  return fetch('api/panel-config').then(function (r) {
    if (!r.ok) { throw new Error('Failed to load config (' + r.status + ')'); }
    return r.json();
  });
}

function cfgFetchEntities() {
  return fetch('api/picker/entities').then(function (r) {
    if (!r.ok) {
      return r.json().then(function (body) {
        throw new Error(body && body.error ? body.error : 'Failed to load entities (' + r.status + ')');
      }, function () {
        throw new Error('Failed to load entities (' + r.status + ')');
      });
    }
    return r.json();
  });
}

function cfgFetchSensors() {
  return fetch('api/picker/entities?domain=sensor').then(function (r) {
    if (!r.ok) { throw new Error('Failed to load sensors (' + r.status + ')'); }
    return r.json();
  });
}

function cfgFetchScenarios() {
  // Fetch scenes, scripts and automations for the scenario picker
  return Promise.all([
    fetch('api/picker/entities?domain=scene').then(function (r) { return r.ok ? r.json() : []; }),
    fetch('api/picker/entities?domain=script').then(function (r) { return r.ok ? r.json() : []; }),
    fetch('api/picker/entities?domain=automation').then(function (r) { return r.ok ? r.json() : []; }),
  ]).then(function (results) {
    return (results[0] || []).concat(results[1] || []).concat(results[2] || []);
  });
}

function cfgFetchHaAreas() {
  return fetch('api/picker/areas').then(function (r) {
    if (!r.ok) {
      return r.json().then(function (body) {
        throw new Error(body && body.error ? body.error : 'Failed to load areas (' + r.status + ')');
      }, function () {
        throw new Error('Failed to load areas (' + r.status + ')');
      });
    }
    return r.json();
  });
}

function cfgFetchCameras() {
  return fetch('api/picker/cameras').then(function (r) {
    if (!r.ok) { throw new Error('Failed to load cameras (' + r.status + ')'); }
    return r.json().then(function (data) {
      return Array.isArray(data) ? data : [];
    });
  });
}

/**
 * Save the full v3 configuration structure.
 * payload: { overview, rooms, scenarios, header_sensors, cameras }
 */
function cfgSaveV3(payload) {
  return fetch('api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).then(function (r) {
    return r.json().then(function (data) {
      if (!r.ok) { throw new Error(data.error || 'Save failed (' + r.status + ')'); }
      return data;
    });
  });
}
