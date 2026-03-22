/**
 * app.js — Main application entry point for Retro Panel
 *
 * Boot sequence:
 * 1. Fetch /api/panel-config
 * 2. Apply theme, columns, kiosk mode
 * 3. Fetch all entity states
 * 4. Render tile grid
 * 5. Hide loading screen
 * 6. Connect WebSocket for live updates
 *
 * ES2017-compatible, iOS 15 Safari safe.
 * No top-level await (iOS 15 partial support).
 */

import { getPanelConfig, getAllStates } from './api.js';
import { connectWS } from './ws.js';
import { qs, showElement, hideElement } from './utils/dom.js';

// Component registry: domain → { createTile, updateTile }
import { createTile as createLightTile, updateTile as updateLightTile } from './components/light.js';
import { createTile as createSwitchTile, updateTile as updateSwitchTile } from './components/switch.js';
import { createTile as createSensorTile, updateTile as updateSensorTile } from './components/sensor.js';
import { createTile as createAlarmTile, updateTile as updateAlarmTile } from './components/alarm.js';

const COMPONENTS = {
  light:                 { createTile: createLightTile,  updateTile: updateLightTile  },
  switch:                { createTile: createSwitchTile, updateTile: updateSwitchTile },
  sensor:                { createTile: createSensorTile, updateTile: updateSensorTile },
  binary_sensor:         { createTile: createSensorTile, updateTile: updateSensorTile },
  alarm_control_panel:   { createTile: createAlarmTile,  updateTile: updateAlarmTile  },
};

// ---------------------------------------------------------------------------
// Global application state
// ---------------------------------------------------------------------------
const AppState = {
  config: null,    // PanelConfig from /api/panel-config
  states: {},      // { entity_id: { state, attributes } }
  wsConnected: false,
  tileMap: {},     // { entity_id: HTMLElement }
};

// ---------------------------------------------------------------------------
// State update: called by WebSocket handler
// ---------------------------------------------------------------------------

/**
 * Update entity state and re-render the tile.
 * @param {string} entityId
 * @param {{ state: string, attributes: object }} newState
 */
export function updateEntityState(entityId, newState) {
  AppState.states[entityId] = newState;
  const tile = AppState.tileMap[entityId];
  if (!tile) return;

  const domain = entityId.split('.')[0];
  const component = COMPONENTS[domain];
  if (component) {
    component.updateTile(tile, newState);
  }
}

// ---------------------------------------------------------------------------
// Grid rendering
// ---------------------------------------------------------------------------

function getDomain(entityId) {
  return entityId.split('.')[0];
}

function renderGrid(config, states) {
  const grid = qs('#tile-grid');
  grid.innerHTML = '';
  grid.style.setProperty('--columns', String(config.columns));

  if (config.entities.length === 0) {
    var msg = document.createElement('p');
    msg.className = 'loading-text';
    msg.style.cssText = 'grid-column:1/-1;text-align:center;padding:60px 20px;';
    msg.textContent = config.title + ' — No entities configured. Open Settings (⚙) to add entities.';
    grid.appendChild(msg);
    return;
  }

  config.entities.forEach(function(entityConfig) {
    const domain = getDomain(entityConfig.entity_id);
    const component = COMPONENTS[domain];

    if (!component) {
      console.warn('[app] No component for domain:', domain, entityConfig.entity_id);
      return;
    }

    const tile = component.createTile(entityConfig);
    AppState.tileMap[entityConfig.entity_id] = tile;

    // Apply grid position if specified
    if (entityConfig.row != null && entityConfig.col != null) {
      tile.style.gridRow = entityConfig.row;
      tile.style.gridColumn = entityConfig.col;
    }

    // Apply initial state
    const stateObj = states[entityConfig.entity_id];
    if (stateObj) {
      component.updateTile(tile, stateObj);
    }

    // Alarm tile spans full row
    if (domain === 'alarm_control_panel') {
      tile.classList.add('alarm-tile');
    }

    grid.appendChild(tile);
  });
}

// ---------------------------------------------------------------------------
// Theme and display setup
// ---------------------------------------------------------------------------

function applyConfig(config) {
  const body = document.body;

  // Apply theme class
  body.classList.remove('theme-dark', 'theme-light', 'theme-auto');
  body.classList.add(`theme-${config.theme || 'dark'}`);

  // Kiosk mode
  if (config.kiosk_mode) {
    body.classList.add('kiosk');
  }

  // Config link is always visible — needed to access settings even in kiosk mode

  // Panel title
  const titleEl = qs('#panel-title');
  if (titleEl) titleEl.textContent = config.title || 'Retro Panel';
  document.title = config.title || 'Retro Panel';
}

// ---------------------------------------------------------------------------
// Connection status UI
// ---------------------------------------------------------------------------

function setConnectionStatus(connected) {
  AppState.wsConnected = connected;
  const dot = qs('#connection-status');
  const banner = qs('#disconnect-banner');

  if (!dot || !banner) return;

  if (connected) {
    dot.className = 'status-dot status-connected';
    dot.title = 'Connected';
    hideElement(banner);
  } else {
    dot.className = 'status-dot status-disconnected';
    dot.title = 'Disconnected';
    showElement(banner);
  }
}

function setConnecting() {
  const dot = qs('#connection-status');
  if (dot) {
    dot.className = 'status-dot status-connecting';
    dot.title = 'Connecting…';
  }
}

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------

async function boot() {
  try {
    // 1. Load config
    const config = await getPanelConfig();
    AppState.config = config;
    applyConfig(config);

    // 2. Load all states
    const statesArray = await getAllStates();
    statesArray.forEach(function(s) {
      AppState.states[s.entity_id] = { state: s.state, attributes: s.attributes };
    });

    // 3. Render grid
    renderGrid(config, AppState.states);

    // 4. Show panel, hide loading (fade-out animation).
    // IMPORTANT: use classList.remove('hidden') — the .hidden class uses
    // display:none !important which would override an inline style.display.
    const loadingScreen = qs('#loading-screen');
    loadingScreen.classList.add('fade-out');
    const panelEl = qs('#panel');
    panelEl.classList.remove('hidden');
    setTimeout(function() { loadingScreen.style.display = 'none'; }, 250);

    // 5. Connect WebSocket
    setConnecting();
    connectWS(
      // onStateChanged
      function(entityId, newState) {
        updateEntityState(entityId, newState);
      },
      // onConnect
      function() {
        setConnectionStatus(true);
      },
      // onDisconnect
      function() {
        setConnectionStatus(false);
        // Fallback: refresh all states after disconnect
        scheduleStatePoll(config.refresh_interval || 30);
      }
    );

  } catch (err) {
    console.error('[app] Boot failed:', err);
    // Show panel so at least the title and gear icon are visible
    const panelEl = qs('#panel');
    if (panelEl) panelEl.classList.remove('hidden');
    const loadingScreen = qs('#loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    const grid = qs('#tile-grid');
    if (grid) {
      var errMsg = document.createElement('p');
      errMsg.className = 'loading-text';
      errMsg.style.cssText = 'grid-column:1/-1;text-align:center;padding:60px 20px;';
      errMsg.textContent = 'Cannot connect to Home Assistant. Check add-on logs.';
      grid.appendChild(errMsg);
    }
  }
}

// ---------------------------------------------------------------------------
// Fallback polling when WebSocket is unavailable
// ---------------------------------------------------------------------------

let pollTimer = null;

function scheduleStatePoll(intervalSeconds) {
  if (pollTimer) return; // already scheduled
  pollTimer = setTimeout(async function() {
    pollTimer = null;
    if (AppState.wsConnected) return; // WS reconnected, no need to poll
    try {
      const statesArray = await getAllStates();
      statesArray.forEach(function(s) {
        updateEntityState(s.entity_id, { state: s.state, attributes: s.attributes });
      });
    } catch (err) {
      console.warn('[app] State poll failed:', err);
    }
    // Keep polling while disconnected
    if (!AppState.wsConnected) {
      scheduleStatePoll(intervalSeconds);
    }
  }, intervalSeconds * 1000);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
boot();
