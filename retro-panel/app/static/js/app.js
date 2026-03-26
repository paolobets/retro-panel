/**
 * app.js — Main application entry point for Retro Panel
 *
 * Responsabilità ridotte dopo il refactoring:
 * - AppState
 * - boot() sequence
 * - updateEntityState() (WebSocket + polling)
 * - buildHeaderSensors() / updateHeaderSensorChip()
 * - applyConfig() (theme, columns, title)
 * - startClock()
 * - showPanel() / hideLoadingScreen()
 * - Connection/polling logic
 *
 * Navigation → window.RP_Nav
 * Rendering  → window.RP_Renderer
 * Cameras    → window.CameraComponent
 *
 * No ES modules. iOS 12+ Safari safe (no const/let/arrow/import/export).
 * Depends on: utils/dom.js, api.js, ws.js, nav.js, renderer.js, camera.js,
 *             components/*.js
 */
(function () {
  'use strict';

  var DOM = window.RP_DOM;

  // ---------------------------------------------------------------------------
  // Application state
  // ---------------------------------------------------------------------------
  var AppState = {
    config: null,
    states: {},
    tileMap: {},
    energyTiles: [],
    wsConnected: false,
    sidebarCollapsed: false,
    activeSectionId: 'overview',
  };

  // ---------------------------------------------------------------------------
  // Helper: raccoglie tutti gli item dalla config (overview + rooms)
  // ---------------------------------------------------------------------------
  function _getAllItems(config) {
    var items = [];
    if (!config) { return items; }

    // overview_items (nuovo formato) o overview.items (vecchio formato)
    var ov = config.overview_items || (config.overview && config.overview.items) || [];
    for (var i = 0; i < ov.length; i++) { items.push(ov[i]); }

    var rooms = config.rooms || [];
    for (var r = 0; r < rooms.length; r++) {
      var sections = rooms[r].sections || [];
      for (var s = 0; s < sections.length; s++) {
        var sitems = sections[s].items || [];
        for (var k = 0; k < sitems.length; k++) { items.push(sitems[k]); }
      }
      // legacy: room.items diretti
      var legacyItems = rooms[r].items || [];
      for (var li = 0; li < legacyItems.length; li++) { items.push(legacyItems[li]); }
    }
    return items;
  }

  // ---------------------------------------------------------------------------
  // applyConfig — tema, colonne, titolo
  // ---------------------------------------------------------------------------
  function applyConfig(config) {
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-auto');
    document.body.classList.add('theme-' + (config.theme || 'dark'));

    if (config.kiosk_mode) { document.body.classList.add('kiosk'); }

    var titleEl = DOM.qs('#panel-title');
    if (titleEl) {
      titleEl.innerHTML = 'Retro <span style="color:var(--color-accent)">PANEL</span>';
    }
    document.title = config.title || 'Retro Panel';
    // Colonne: gestite interamente dai media query CSS su --tile-cols
  }

  // ---------------------------------------------------------------------------
  // buildHeaderSensors / updateHeaderSensorChip
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
        valEl.textContent = '\u2014';
        chip.appendChild(valEl);
        container.appendChild(chip);

        // Valore iniziale dagli stati già caricati
        var st = AppState.states[hs.entity_id];
        if (st) { valEl.textContent = _formatSensorChipValue(st, hs); }
      })(headerSensors[i]);
    }
  }

  function _formatSensorChipValue(stateObj, hs) {
    var val = stateObj.state || '\u2014';
    var attrs = stateObj.attributes || {};
    var unit = attrs.unit_of_measurement || '';
    if (hs && hs.label) { return hs.label + ': ' + val + (unit ? ' ' + unit : ''); }
    return val + (unit ? ' ' + unit : '');
  }

  function updateHeaderSensorChip(entityId, newState) {
    var container = DOM.qs('#header-sensors');
    if (!container) { return; }
    var chip = container.querySelector('[data-entity="' + entityId + '"]');
    if (!chip) { return; }
    var valEl = chip.querySelector('.header-sensor-value');
    if (!valEl) { return; }

    var hs = null;
    var config = AppState.config;
    if (config && config.header_sensors) {
      for (var i = 0; i < config.header_sensors.length; i++) {
        if (config.header_sensors[i].entity_id === entityId) {
          hs = config.header_sensors[i];
          break;
        }
      }
    }
    valEl.textContent = _formatSensorChipValue(newState, hs || { entity_id: entityId });
  }

  // ---------------------------------------------------------------------------
  // updateEntityState — chiamato da WebSocket e polling
  // ---------------------------------------------------------------------------
  function updateEntityState(entityId, newState) {
    AppState.states[entityId] = newState;

    var tile = AppState.tileMap[entityId];
    if (tile) {
      // Cerca item config per display_mode
      var allItems = _getAllItems(AppState.config);
      var item = null;
      for (var i = 0; i < allItems.length; i++) {
        if (allItems[i].entity_id === entityId) { item = allItems[i]; break; }
      }

      var component = item
        ? window.RP_Renderer.resolveComponentForItem(item)
        : null;

      // Fallback: prova col domain diretto
      if (!component) {
        var domain = entityId.split('.')[0];
        var domainMap = {
          light: window.LightComponent,
          switch: window.SwitchComponent,
          sensor: window.SensorComponent,
          binary_sensor: window.SensorComponent,
          alarm_control_panel: window.AlarmComponent,
          scene: window.ScenarioComponent,
          script: window.ScenarioComponent,
        };
        component = domainMap[domain] || null;
      }

      if (component) {
        try { component.updateTile(tile, newState); }
        catch (err) { console.error('[app] updateTile failed for', entityId, err); }
      }
    }

    // Energy flow tiles
    for (var j = 0; j < AppState.energyTiles.length; j++) {
      var et = AppState.energyTiles[j];
      var cfg = et.cfg;
      if (entityId === cfg.solar_power  || entityId === cfg.battery_soc  ||
          entityId === cfg.battery_power || entityId === cfg.grid_power  ||
          entityId === cfg.home_power) {
        try { window.EnergyFlowComponent.updateTile(et.tile, AppState.states); }
        catch (err) { console.error('[app] EnergyFlow updateTile failed:', err); }
      }
    }

    // Header sensor chips
    updateHeaderSensorChip(entityId, newState);
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
      if (banner) { banner.classList.add('hidden'); }
    } else {
      dot.className = 'status-dot status-disconnected';
      dot.title = 'Disconnected';
      if (banner) { banner.classList.remove('hidden'); }
    }
  }

  function setConnecting() {
    var dot = DOM.qs('#connection-status');
    if (dot) { dot.className = 'status-dot status-connecting'; dot.title = 'Connecting\u2026'; }
  }

  // ---------------------------------------------------------------------------
  // Loading screen / panel visibility
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
        var h = now.getHours();
        var m = now.getMinutes();
        clockEl.textContent = (h < 10 ? '0' + h : String(h)) + ':' + (m < 10 ? '0' + m : String(m));
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
  // Fallback polling (quando WebSocket non è disponibile)
  // ---------------------------------------------------------------------------
  var pollTimer = null;

  function scheduleStatePoll(intervalSeconds) {
    if (pollTimer) { return; }
    pollTimer = setTimeout(async function () {
      pollTimer = null;
      if (AppState.wsConnected) { return; }
      try {
        var statesArray = await window.getAllStates();
        if (Array.isArray(statesArray)) {
          for (var i = 0; i < statesArray.length; i++) {
            var s = statesArray[i];
            if (s && s.entity_id) {
              updateEntityState(s.entity_id, { state: s.state, attributes: s.attributes });
            }
          }
        }
      } catch (err) {
        console.warn('[app] State poll failed:', err);
      }
      if (!AppState.wsConnected) { scheduleStatePoll(intervalSeconds); }
    }, intervalSeconds * 1000);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  async function boot() {
    try {
      var config = await window.getPanelConfig();
      AppState.config = config;
      applyConfig(config);

      // Inizializza renderer (risolve i componenti a runtime)
      window.RP_Renderer.init();

      // Fetch stati iniziali
      var statesArray = await window.getAllStates();
      if (Array.isArray(statesArray)) {
        for (var i = 0; i < statesArray.length; i++) {
          var s = statesArray[i];
          if (s && s.entity_id) {
            AppState.states[s.entity_id] = { state: s.state, attributes: s.attributes };
          }
        }
      }

      // Inizializza nav — la callback di navigazione aggiorna AppState e ri-renderizza
      window.RP_Nav.init(config, AppState.activeSectionId, function (sectionId) {
        AppState.activeSectionId = sectionId;
        // Distruggi timer camere prima di cambiare sezione
        if (window.CameraComponent) { window.CameraComponent.destroyAll(); }
        window.RP_Renderer.renderActiveSection(AppState);
        window.RP_Nav.setActiveSidebarItem(sectionId);
      });

      // Sidebar toggle
      var toggleBtn = DOM.qs('#sidebar-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('touchend', function (e) {
          e.preventDefault();
          window.RP_Nav.toggleSidebar();
        });
        toggleBtn.addEventListener('click', function () {
          if (!('ontouchstart' in window)) { window.RP_Nav.toggleSidebar(); }
        });
      }

      buildHeaderSensors(config.header_sensors || []);

      // Render sezione iniziale
      window.RP_Renderer.renderActiveSection(AppState);

      showPanel();
      hideLoadingScreen();
      startClock();

      // WebSocket
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

  // Avvia al caricamento
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}());
