/**
 * app.js — Main application entry point for Retro Panel v1.1
 *
 * Boot sequence:
 * 1. Fetch /api/panel-config (returns pages)
 * 2. Apply theme, columns, kiosk mode
 * 3. Fetch all entity states
 * 4. Render tab bar + first page
 * 5. Hide loading screen
 * 6. Connect WebSocket for live updates
 * 7. Start clock
 *
 * No ES modules — loaded as regular script after all dependencies.
 * iOS 15 Safari safe (WKWebView compatible).
 *
 * Depends on (loaded before this file):
 *   utils/dom.js    → window.RP_DOM
 *   utils/format.js → window.RP_FMT
 *   api.js          → window.getPanelConfig, getAllStates, callService
 *   ws.js           → window.connectWS
 *   components/*.js → LightComponent, SwitchComponent, SensorComponent,
 *                     AlarmComponent, EnergyFlowComponent
 */
(function () {
  'use strict';

  // Entity domain → component
  var COMPONENTS = {
    light:               window.LightComponent,
    switch:              window.SwitchComponent,
    sensor:              window.SensorComponent,
    binary_sensor:       window.SensorComponent,
    alarm_control_panel: window.AlarmComponent,
  };

  // Page icon map: icon name → emoji/character
  var PAGE_ICONS = {
    home:        '\uD83C\uDFE0',
    bedroom:     '\uD83D\uDECC',
    kitchen:     '\uD83C\uDF73',
    garden:      '\uD83C\uDF3F',
    garage:      '\uD83D\uDE97',
    energy:      '\u26A1',
    security:    '\uD83D\uDD12',
    climate:     '\uD83C\uDF21',
    living:      '\uD83D\uDECB',
    office:      '\uD83D\uDCBB',
    bathroom:    '\uD83D\uDEB0',
    lights:      '\uD83D\uDCA1',
  };

  function getPageIcon(iconName) {
    return PAGE_ICONS[iconName] || PAGE_ICONS['home'];
  }

  // ---------------------------------------------------------------------------
  // Global application state
  // ---------------------------------------------------------------------------
  var AppState = {
    config: null,
    states: {},
    wsConnected: false,
    tileMap: {},        // entity_id → tile DOM element
    energyTiles: [],    // [{tile, cfg}] — tiles that need state map updates
    currentPageIdx: 0,
    pages: [],          // from config.pages
  };

  // ---------------------------------------------------------------------------
  // State update handler — called by WebSocket
  // ---------------------------------------------------------------------------
  function updateEntityState(entityId, newState) {
    AppState.states[entityId] = newState;

    // Update entity tile if present
    var tile = AppState.tileMap[entityId];
    if (tile) {
      var domain = entityId.split('.')[0];
      var component = COMPONENTS[domain];
      if (component) {
        component.updateTile(tile, newState);
      }
    }

    // Update all energy flow cards that reference this entity
    for (var i = 0; i < AppState.energyTiles.length; i++) {
      var et = AppState.energyTiles[i];
      var cfg = et.cfg;
      if (entityId === cfg.solar_power || entityId === cfg.battery_soc ||
          entityId === cfg.battery_power || entityId === cfg.grid_power ||
          entityId === cfg.home_power) {
        window.EnergyFlowComponent.updateTile(et.tile, AppState.states);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Columns: respect orientation
  // ---------------------------------------------------------------------------
  function applyColumns(config) {
    var grid = window.RP_DOM.qs('#tile-grid');
    if (!grid) { return; }
    var portrait = config.columns || 3;
    var landscape = Math.min(portrait + 1, 4);
    grid.style.setProperty('--columns', String(portrait));
    grid.style.setProperty('--columns-landscape', String(landscape));
  }

  // ---------------------------------------------------------------------------
  // Tab bar rendering
  // ---------------------------------------------------------------------------
  function renderTabBar(pages, activeIdx) {
    var tabBar = window.RP_DOM.qs('#tab-bar');
    if (!tabBar) { return; }
    tabBar.innerHTML = '';

    // Only show tab bar if there are 2+ pages
    if (!pages || pages.length <= 1) {
      tabBar.style.display = 'none';
      return;
    }

    tabBar.style.display = '';

    for (var i = 0; i < pages.length; i++) {
      (function (pageIdx) {
        var page = pages[pageIdx];
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tab-btn' + (pageIdx === activeIdx ? ' active' : '');

        var iconEl = document.createElement('span');
        iconEl.className = 'tab-btn-icon';
        iconEl.textContent = getPageIcon(page.icon);

        var labelEl = document.createElement('span');
        labelEl.textContent = page.title;

        btn.appendChild(iconEl);
        btn.appendChild(labelEl);

        btn.addEventListener('touchend', function (e) {
          e.preventDefault();
          switchPage(pageIdx);
        });
        btn.addEventListener('click', function () {
          if (!('ontouchstart' in window)) { switchPage(pageIdx); }
        });

        tabBar.appendChild(btn);
      })(i);
    }
  }

  // ---------------------------------------------------------------------------
  // Page switching
  // ---------------------------------------------------------------------------
  function switchPage(idx) {
    if (idx === AppState.currentPageIdx) { return; }
    AppState.currentPageIdx = idx;
    renderPageGrid(AppState.pages[idx]);
    renderTabBar(AppState.pages, idx);
  }

  // ---------------------------------------------------------------------------
  // Grid rendering for a single page
  // ---------------------------------------------------------------------------
  function renderPageGrid(page) {
    var grid = window.RP_DOM.qs('#tile-grid');
    if (!grid) { return; }
    grid.innerHTML = '';
    AppState.tileMap = {};
    AppState.energyTiles = [];

    var items = (page && page.items) || [];

    if (items.length === 0) {
      var msg = document.createElement('p');
      msg.className = 'loading-text';
      msg.style.cssText = 'grid-column:1/-1;text-align:center;padding:60px 20px;';
      msg.textContent = 'No items on this page. Open Settings (\u2699) to configure.';
      grid.appendChild(msg);
      return;
    }

    for (var i = 0; i < items.length; i++) {
      var item = items[i];

      if (item.type === 'entity') {
        var domain = item.entity_id.split('.')[0];
        var component = COMPONENTS[domain];
        if (!component) {
          console.warn('[app] No component for domain:', domain, item.entity_id);
          continue;
        }
        var tile = component.createTile(item);
        AppState.tileMap[item.entity_id] = tile;

        var stateObj = AppState.states[item.entity_id];
        if (stateObj) {
          component.updateTile(tile, stateObj);
        }

        if (domain === 'alarm_control_panel') {
          tile.classList.add('alarm-tile');
        }

        grid.appendChild(tile);

      } else if (item.type === 'energy_flow') {
        var efTile = window.EnergyFlowComponent.createTile(item);
        // Initial state update with all current states
        window.EnergyFlowComponent.updateTile(efTile, AppState.states);
        AppState.energyTiles.push({ tile: efTile, cfg: item });
        grid.appendChild(efTile);
      }
    }
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
    if (titleEl) { titleEl.textContent = config.title || 'Retro Panel'; }
    document.title = config.title || 'Retro Panel';

    applyColumns(config);
  }

  // ---------------------------------------------------------------------------
  // Connection status UI
  // ---------------------------------------------------------------------------
  function setConnectionStatus(connected) {
    AppState.wsConnected = connected;
    var dot = window.RP_DOM.qs('#connection-status');
    var banner = window.RP_DOM.qs('#disconnect-banner');
    if (!dot || !banner) { return; }

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
    if (!loadingScreen) { return; }
    loadingScreen.classList.add('fade-out');
    setTimeout(function () { loadingScreen.style.display = 'none'; }, 250);
  }

  function showPanel() {
    var panelEl = window.RP_DOM.qs('#panel');
    if (panelEl) { panelEl.classList.remove('hidden'); }
  }

  // ---------------------------------------------------------------------------
  // Live clock
  // ---------------------------------------------------------------------------
  function startClock() {
    var clockEl = window.RP_DOM.qs('#panel-clock');
    if (!clockEl) { return; }

    function tick() {
      var now = new Date();
      var h = now.getHours();
      var m = now.getMinutes();
      clockEl.textContent = (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
    }

    tick();
    // Sync to next minute boundary
    var msToNextMin = (60 - new Date().getSeconds()) * 1000;
    setTimeout(function () {
      tick();
      setInterval(tick, 60000);
    }, msToNextMin);
  }

  // ---------------------------------------------------------------------------
  // Boot sequence
  // ---------------------------------------------------------------------------
  async function boot() {
    try {
      // 1. Load config
      var config = await window.getPanelConfig();
      AppState.config = config;
      AppState.pages = config.pages || [];
      applyConfig(config);

      // 2. Load all entity states (now includes energy flow sensors)
      var statesArray = await window.getAllStates();
      statesArray.forEach(function (s) {
        AppState.states[s.entity_id] = { state: s.state, attributes: s.attributes };
      });

      // 3. Render tab bar
      renderTabBar(AppState.pages, 0);

      // 4. Render first page
      if (AppState.pages.length > 0) {
        renderPageGrid(AppState.pages[0]);
      } else {
        var grid = window.RP_DOM.qs('#tile-grid');
        if (grid) {
          var msg = document.createElement('p');
          msg.className = 'loading-text';
          msg.style.cssText = 'grid-column:1/-1;text-align:center;padding:60px 20px;';
          msg.textContent = config.title + ' \u2014 No pages configured. Open Settings (\u2699) to add pages and entities.';
          grid.appendChild(msg);
        }
      }

      // 5. Show panel, hide loading
      showPanel();
      hideLoadingScreen();

      // 6. Start clock
      startClock();

      // 7. Connect WebSocket
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
    if (pollTimer) { return; }
    pollTimer = setTimeout(async function () {
      pollTimer = null;
      if (AppState.wsConnected) { return; }
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
