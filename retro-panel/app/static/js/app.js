/**
 * app.js — Main application entry point for Retro Panel v1.2
 *
 * Layout: sidebar nav (Overview, Rooms, Scenarios) + header + content area.
 *
 * Boot sequence:
 * 1. Fetch /api/panel-config (v3: overview, rooms, scenarios, header_sensors)
 * 2. Apply theme, columns, kiosk mode
 * 3. Build sidebar navigation
 * 4. Fetch all entity states
 * 5. Render active section (Overview by default)
 * 6. Hide loading screen
 * 7. Connect WebSocket for live updates
 * 8. Start clock + date
 *
 * No ES modules. iOS 15 Safari safe (WKWebView compatible).
 * Depends on: utils/dom.js, utils/format.js, api.js, ws.js,
 *             components/light.js, switch.js, sensor.js, alarm.js,
 *             energy.js, scenario.js
 */
(function () {
  'use strict';

  var DOM = window.RP_DOM;

  var COMPONENTS = {
    light:               window.LightComponent,
    switch:              window.SwitchComponent,
    sensor:              window.SensorComponent,
    binary_sensor:       window.SensorComponent,
    alarm_control_panel: window.AlarmComponent,
  };

  var ROOM_ICONS = {
    home:     '\uD83C\uDFE0',
    living:   '\uD83D\uDECB',
    bedroom:  '\uD83D\uDECC',
    kitchen:  '\uD83C\uDF73',
    bathroom: '\uD83D\uDEB0',
    garden:   '\uD83C\uDF3F',
    garage:   '\uD83D\uDE97',
    office:   '\uD83D\uDCBB',
    energy:   '\u26A1',
    security: '\uD83D\uDD12',
    climate:  '\uD83C\uDF21',
    lights:   '\uD83D\uDCA1',
  };

  function getRoomIcon(iconName) {
    return ROOM_ICONS[iconName] || ROOM_ICONS['home'];
  }

  // ---------------------------------------------------------------------------
  // Application state
  // ---------------------------------------------------------------------------
  var AppState = {
    config: null,
    states: {},
    wsConnected: false,
    tileMap: {},       // entity_id → tile DOM element
    energyTiles: [],   // [{tile, cfg}]
    activeSectionId: 'overview',  // 'overview' | 'room:id' | 'scenarios'
    sidebarCollapsed: false,
  };

  // ---------------------------------------------------------------------------
  // State update handler (called by WebSocket)
  // ---------------------------------------------------------------------------
  function updateEntityState(entityId, newState) {
    AppState.states[entityId] = newState;

    var tile = AppState.tileMap[entityId];
    if (tile) {
      var domain = entityId.split('.')[0];
      var component = COMPONENTS[domain];
      if (component) { component.updateTile(tile, newState); }
    }

    for (var i = 0; i < AppState.energyTiles.length; i++) {
      var et = AppState.energyTiles[i];
      var cfg = et.cfg;
      if (entityId === cfg.solar_power || entityId === cfg.battery_soc ||
          entityId === cfg.battery_power || entityId === cfg.grid_power ||
          entityId === cfg.home_power) {
        window.EnergyFlowComponent.updateTile(et.tile, AppState.states);
      }
    }

    // Update header sensor chips
    updateHeaderSensorChip(entityId, newState);
  }

  // ---------------------------------------------------------------------------
  // Header sensor chips
  // ---------------------------------------------------------------------------
  function buildHeaderSensors(headerSensors) {
    var container = DOM.qs('#header-sensors');
    if (!container) { return; }
    container.innerHTML = '';

    for (var i = 0; i < headerSensors.length; i++) {
      (function (hs) {
        var chip = DOM.createElement('div', 'header-sensor-chip');
        chip.setAttribute('data-entity', hs.entity_id);

        if (hs.icon) {
          var iconEl = DOM.createElement('span', 'header-sensor-icon');
          iconEl.textContent = hs.icon;
          chip.appendChild(iconEl);
        }

        var valEl = DOM.createElement('span', 'header-sensor-value');
        valEl.textContent = '—';
        chip.appendChild(valEl);

        container.appendChild(chip);

        // Initial value from already-loaded states
        var st = AppState.states[hs.entity_id];
        if (st) { valEl.textContent = formatSensorChipValue(st, hs); }
      })(headerSensors[i]);
    }
  }

  function formatSensorChipValue(stateObj, hs) {
    var val = stateObj.state || '—';
    var attrs = stateObj.attributes || {};
    var unit = attrs.unit_of_measurement || '';
    if (hs.label) { return hs.label + ': ' + val + (unit ? ' ' + unit : ''); }
    return val + (unit ? ' ' + unit : '');
  }

  function updateHeaderSensorChip(entityId, newState) {
    var container = DOM.qs('#header-sensors');
    if (!container) { return; }
    var chip = container.querySelector('[data-entity="' + entityId + '"]');
    if (!chip) { return; }
    var valEl = chip.querySelector('.header-sensor-value');
    if (!valEl) { return; }

    var config = AppState.config;
    var hs = null;
    if (config && config.header_sensors) {
      for (var i = 0; i < config.header_sensors.length; i++) {
        if (config.header_sensors[i].entity_id === entityId) {
          hs = config.header_sensors[i];
          break;
        }
      }
    }
    valEl.textContent = formatSensorChipValue(newState, hs || { entity_id: entityId });
  }

  // ---------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------
  function buildSidebar(config) {
    var nav = DOM.qs('#sidebar-nav');
    if (!nav) { return; }
    nav.innerHTML = '';

    // Overview
    addNavItem(nav, 'overview', '\uD83C\uDFE0', 'Overview');

    // Visible rooms
    var rooms = config.rooms || [];
    for (var i = 0; i < rooms.length; i++) {
      var room = rooms[i];
      if (room.hidden) { continue; }
      addNavItem(nav, 'room:' + room.id, getRoomIcon(room.icon), room.title);
    }

    // Scenarios (only if configured)
    if (config.scenarios && config.scenarios.length > 0) {
      addNavItem(nav, 'scenarios', '\uD83C\uDFAD', 'Scenari');
    }

    // Set active state
    setActiveSidebarItem(AppState.activeSectionId);
  }

  function addNavItem(nav, sectionId, icon, label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sidebar-nav-item';
    btn.setAttribute('data-section', sectionId);

    var iconEl = DOM.createElement('span', 'sidebar-item-icon');
    iconEl.textContent = icon;

    var labelEl = DOM.createElement('span', 'sidebar-item-label');
    labelEl.textContent = label;

    btn.appendChild(iconEl);
    btn.appendChild(labelEl);

    btn.addEventListener('touchend', function (e) {
      e.preventDefault();
      navigateTo(sectionId);
    });
    btn.addEventListener('click', function () {
      if (!('ontouchstart' in window)) { navigateTo(sectionId); }
    });

    nav.appendChild(btn);
  }

  function setActiveSidebarItem(sectionId) {
    var items = document.querySelectorAll('.sidebar-nav-item');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.getAttribute('data-section') === sectionId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    }
  }

  function toggleSidebar() {
    AppState.sidebarCollapsed = !AppState.sidebarCollapsed;
    var sidebar = DOM.qs('#sidebar');
    if (sidebar) {
      if (AppState.sidebarCollapsed) {
        sidebar.classList.add('collapsed');
      } else {
        sidebar.classList.remove('collapsed');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  function navigateTo(sectionId) {
    AppState.activeSectionId = sectionId;
    setActiveSidebarItem(sectionId);
    renderActiveSection();
  }

  // ---------------------------------------------------------------------------
  // Content rendering
  // ---------------------------------------------------------------------------
  function renderActiveSection() {
    var contentArea = DOM.qs('#content-area');
    if (!contentArea) { return; }
    contentArea.innerHTML = '';
    AppState.tileMap = {};
    AppState.energyTiles = [];

    var sectionId = AppState.activeSectionId;
    var config = AppState.config;
    if (!config) { return; }

    if (sectionId === 'overview') {
      renderItemsGrid(contentArea, config.overview ? config.overview.items || [] : [], 'Overview');
    } else if (sectionId === 'scenarios') {
      renderScenariosGrid(contentArea, config.scenarios || []);
    } else if (sectionId.indexOf('room:') === 0) {
      var roomId = sectionId.slice(5);
      var room = null;
      var rooms = config.rooms || [];
      for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].id === roomId) { room = rooms[i]; break; }
      }
      if (room) {
        renderItemsGrid(contentArea, room.items || [], room.title);
      }
    }
  }

  function renderItemsGrid(container, items, heading) {
    if (heading) {
      var h = DOM.createElement('h2', 'section-heading');
      h.textContent = heading;
      container.appendChild(h);
    }

    var grid = DOM.createElement('div', 'tile-grid');
    container.appendChild(grid);

    if (!items || items.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">\u2699</span>'
        + '<p class="empty-state-title">No items configured</p>'
        + '<p class="empty-state-hint">Open Settings to add entities to this section.</p>';
      grid.appendChild(empty);
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
        if (stateObj) { component.updateTile(tile, stateObj); }

        if (domain === 'alarm_control_panel') { tile.classList.add('alarm-tile'); }
        grid.appendChild(tile);

      } else if (item.type === 'energy_flow') {
        var efTile = window.EnergyFlowComponent.createTile(item);
        window.EnergyFlowComponent.updateTile(efTile, AppState.states);
        AppState.energyTiles.push({ tile: efTile, cfg: item });
        grid.appendChild(efTile);
      }
    }
  }

  function renderScenariosGrid(container, scenarios) {
    var h = DOM.createElement('h2', 'section-heading');
    h.textContent = 'Scenari';
    container.appendChild(h);

    if (!scenarios || scenarios.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">\uD83C\uDFAD</span>'
        + '<p class="empty-state-title">No scenarios configured</p>'
        + '<p class="empty-state-hint">Open Settings to add scenes and scripts.</p>';
      container.appendChild(empty);
      return;
    }

    var grid = DOM.createElement('div', 'scenarios-grid');
    for (var i = 0; i < scenarios.length; i++) {
      grid.appendChild(window.ScenarioComponent.createCard(scenarios[i]));
    }
    container.appendChild(grid);
  }

  // ---------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------
  function applyColumns(config) {
    var contentArea = DOM.qs('#content-area');
    if (!contentArea) { return; }
    var portrait = config.columns || 3;
    var landscape = Math.min(portrait + 1, 4);
    contentArea.style.setProperty('--columns', String(portrait));
    contentArea.style.setProperty('--columns-landscape', String(landscape));
  }

  // ---------------------------------------------------------------------------
  // Theme
  // ---------------------------------------------------------------------------
  function applyConfig(config) {
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-auto');
    document.body.classList.add('theme-' + (config.theme || 'dark'));

    if (config.kiosk_mode) { document.body.classList.add('kiosk'); }

    var titleEl = DOM.qs('#panel-title');
    if (titleEl) { titleEl.textContent = config.title || 'Retro Panel'; }
    document.title = config.title || 'Retro Panel';

    applyColumns(config);
  }

  // ---------------------------------------------------------------------------
  // Connection status
  // ---------------------------------------------------------------------------
  function setConnectionStatus(connected) {
    AppState.wsConnected = connected;
    var dot = DOM.qs('#connection-status');
    var banner = DOM.qs('#disconnect-banner');
    if (!dot) { return; }
    if (connected) {
      dot.className = 'status-dot status-connected';
      dot.title = 'Connected';
      if (banner) { DOM.hideElement(banner); }
    } else {
      dot.className = 'status-dot status-disconnected';
      dot.title = 'Disconnected';
      if (banner) { DOM.showElement(banner); }
    }
  }

  function setConnecting() {
    var dot = DOM.qs('#connection-status');
    if (dot) { dot.className = 'status-dot status-connecting'; dot.title = 'Connecting\u2026'; }
  }

  // ---------------------------------------------------------------------------
  // Loading screen
  // ---------------------------------------------------------------------------
  function hideLoadingScreen() {
    var ls = DOM.qs('#loading-screen');
    if (!ls) { return; }
    ls.classList.add('fade-out');
    setTimeout(function () { ls.style.display = 'none'; }, 250);
  }

  function showPanel() {
    var panelEl = DOM.qs('#panel');
    if (panelEl) { panelEl.classList.remove('hidden'); }
  }

  // ---------------------------------------------------------------------------
  // Clock + Date
  // ---------------------------------------------------------------------------
  function startClock() {
    var clockEl = DOM.qs('#panel-clock');
    var dateEl  = DOM.qs('#panel-date');

    var DAYS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function tick() {
      var now = new Date();
      if (clockEl) {
        var h = now.getHours(), m = now.getMinutes();
        clockEl.textContent = (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
      }
      if (dateEl) {
        dateEl.textContent = DAYS[now.getDay()] + ' ' + now.getDate() + ' ' + MONTHS[now.getMonth()];
      }
    }

    tick();
    var msToNextMin = (60 - new Date().getSeconds()) * 1000;
    setTimeout(function () { tick(); setInterval(tick, 60000); }, msToNextMin);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  async function boot() {
    try {
      var config = await window.getPanelConfig();
      AppState.config = config;
      applyConfig(config);

      // Fetch all entity states
      var statesArray = await window.getAllStates();
      statesArray.forEach(function (s) {
        AppState.states[s.entity_id] = { state: s.state, attributes: s.attributes };
      });

      // Build sidebar
      buildSidebar(config);

      // Build header sensor chips
      buildHeaderSensors(config.header_sensors || []);

      // Render default section (overview)
      renderActiveSection();

      showPanel();
      hideLoadingScreen();
      startClock();

      // Sidebar toggle button
      var toggleBtn = DOM.qs('#sidebar-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('touchend', function (e) {
          e.preventDefault();
          toggleSidebar();
        });
        toggleBtn.addEventListener('click', function () {
          if (!('ontouchstart' in window)) { toggleSidebar(); }
        });
      }

      // Connect WebSocket
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
      var ca = DOM.qs('#content-area');
      if (ca) {
        ca.innerHTML = '<div class="empty-state">'
          + '<span class="empty-state-icon">\u26A0</span>'
          + '<p class="empty-state-title">Cannot connect to Home Assistant</p>'
          + '<p class="empty-state-hint">Check add-on logs for details.</p>'
          + '</div>';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Fallback polling
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
      if (!AppState.wsConnected) { scheduleStatePoll(intervalSeconds); }
    }, intervalSeconds * 1000);
  }

  boot();
}());
