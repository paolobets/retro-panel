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
 * No ES modules — loaded as regular script after all dependencies.
 * iOS 15 Safari safe (WKWebView compatible).
 *
 * Depends on (loaded before this file):
 *   utils/dom.js    → window.RP_DOM
 *   utils/format.js → window.RP_FMT
 *   api.js          → window.getPanelConfig, getAllStates, callService
 *   ws.js           → window.connectWS
 *   components/*.js → window.LightComponent, SwitchComponent, SensorComponent, AlarmComponent
 */
(function () {
  'use strict';

  // Component registry: domain → { createTile, updateTile }
  var COMPONENTS = {
    light:               window.LightComponent,
    switch:              window.SwitchComponent,
    sensor:              window.SensorComponent,
    binary_sensor:       window.SensorComponent,
    alarm_control_panel: window.AlarmComponent,
  };

  // ---------------------------------------------------------------------------
  // Global application state
  // ---------------------------------------------------------------------------
  var AppState = {
    config: null,
    states: {},
    wsConnected: false,
    tileMap: {},
  };

  // ---------------------------------------------------------------------------
  // State update: called by WebSocket handler
  // ---------------------------------------------------------------------------
  function updateEntityState(entityId, newState) {
    AppState.states[entityId] = newState;
    var tile = AppState.tileMap[entityId];
    if (!tile) return;

    var domain = entityId.split('.')[0];
    var component = COMPONENTS[domain];
    if (component) {
      component.updateTile(tile, newState);
    }
  }

  // ---------------------------------------------------------------------------
  // Grid rendering
  // ---------------------------------------------------------------------------
  function renderGrid(config, states) {
    var grid = window.RP_DOM.qs('#tile-grid');
    grid.innerHTML = '';
    grid.style.setProperty('--columns', String(config.columns));

    if (!config.entities || config.entities.length === 0) {
      var msg = document.createElement('p');
      msg.className = 'loading-text';
      msg.style.cssText = 'grid-column:1/-1;text-align:center;padding:60px 20px;';
      msg.textContent = (config.title || 'Retro Panel') + ' \u2014 No entities configured. Open Settings (\u2699) to add entities.';
      grid.appendChild(msg);
      return;
    }

    config.entities.forEach(function (entityConfig) {
      var domain = entityConfig.entity_id.split('.')[0];
      var component = COMPONENTS[domain];

      if (!component) {
        console.warn('[app] No component for domain:', domain, entityConfig.entity_id);
        return;
      }

      var tile = component.createTile(entityConfig);
      AppState.tileMap[entityConfig.entity_id] = tile;

      if (entityConfig.row != null && entityConfig.col != null) {
        tile.style.gridRow = entityConfig.row;
        tile.style.gridColumn = entityConfig.col;
      }

      var stateObj = states[entityConfig.entity_id];
      if (stateObj) {
        component.updateTile(tile, stateObj);
      }

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
    var body = document.body;
    body.classList.remove('theme-dark', 'theme-light', 'theme-auto');
    body.classList.add('theme-' + (config.theme || 'dark'));

    if (config.kiosk_mode) {
      body.classList.add('kiosk');
    }

    var titleEl = window.RP_DOM.qs('#panel-title');
    if (titleEl) titleEl.textContent = config.title || 'Retro Panel';
    document.title = config.title || 'Retro Panel';
  }

  // ---------------------------------------------------------------------------
  // Connection status UI
  // ---------------------------------------------------------------------------
  function setConnectionStatus(connected) {
    AppState.wsConnected = connected;
    var dot = window.RP_DOM.qs('#connection-status');
    var banner = window.RP_DOM.qs('#disconnect-banner');

    if (!dot || !banner) return;

    if (connected) {
      dot.className = 'status-dot status-connected';
      dot.title = 'Connected';
      window.RP_DOM.hideElement(banner);
    } else {
      dot.className = 'status-dot status-disconnected';
      dot.title = 'Disconnected';
      window.RP_DOM.showElement(banner);
    }
  }

  function setConnecting() {
    var dot = window.RP_DOM.qs('#connection-status');
    if (dot) {
      dot.className = 'status-dot status-connecting';
      dot.title = 'Connecting\u2026';
    }
  }

  // ---------------------------------------------------------------------------
  // Loading screen helpers
  // ---------------------------------------------------------------------------
  function hideLoadingScreen() {
    var loadingScreen = window.RP_DOM.qs('#loading-screen');
    if (!loadingScreen) return;
    loadingScreen.classList.add('fade-out');
    setTimeout(function () { loadingScreen.style.display = 'none'; }, 250);
  }

  function showPanel() {
    var panelEl = window.RP_DOM.qs('#panel');
    if (panelEl) panelEl.classList.remove('hidden');
  }

  // ---------------------------------------------------------------------------
  // Boot sequence
  // ---------------------------------------------------------------------------
  async function boot() {
    try {
      // 1. Load config
      var config = await window.getPanelConfig();
      AppState.config = config;
      applyConfig(config);

      // 2. Load all states
      var statesArray = await window.getAllStates();
      statesArray.forEach(function (s) {
        AppState.states[s.entity_id] = { state: s.state, attributes: s.attributes };
      });

      // 3. Render grid
      renderGrid(config, AppState.states);

      // 4. Show panel, hide loading
      showPanel();
      hideLoadingScreen();

      // 5. Connect WebSocket
      setConnecting();
      window.connectWS(
        function (entityId, newState) { updateEntityState(entityId, newState); },
        function () { setConnectionStatus(true); },
        function () {
          setConnectionStatus(false);
          scheduleStatePoll(config.refresh_interval || 30);
        }
      );

    } catch (err) {
      console.error('[app] Boot failed:', err);
      showPanel();
      hideLoadingScreen();
      var grid = window.RP_DOM.qs('#tile-grid');
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
  var pollTimer = null;

  function scheduleStatePoll(intervalSeconds) {
    if (pollTimer) return;
    pollTimer = setTimeout(async function () {
      pollTimer = null;
      if (AppState.wsConnected) return;
      try {
        var statesArray = await window.getAllStates();
        statesArray.forEach(function (s) {
          updateEntityState(s.entity_id, { state: s.state, attributes: s.attributes });
        });
      } catch (err) {
        console.warn('[app] State poll failed:', err);
      }
      if (!AppState.wsConnected) {
        scheduleStatePoll(intervalSeconds);
      }
    }, intervalSeconds * 1000);
  }

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  boot();
}());
