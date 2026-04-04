/**
 * app.js — Main application entry point for Retro Panel
 *
 * Responsabilità ridotte dopo il refactoring:
 * - AppState
 * - boot() sequence
 * - updateEntityState() (WebSocket + polling)
 * - Connection/status management
 * - applyConfig() (theme, columns, title)
 * - startClock()
 * - showPanel() / hideLoadingScreen()
 * - Connection/polling logic
 *
 * Navigation → window.RP_Nav
 * Rendering  → window.RP_Renderer
 * Cameras    → window.CameraComponent
 *
 * No ES modules. iOS 12 Safari safe.
 * No async/await, no AbortController.
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
  // Theme toggle
  // ---------------------------------------------------------------------------
  function _updateThemeBtn() {
    var btn = DOM.qs('#theme-btn');
    if (!btn || !window.RP_MDI) { return; }
    var iconName = document.body.classList.contains('theme-light') ? 'weather-night' : 'weather-sunny';
    btn.innerHTML = window.RP_MDI(iconName, 18);
  }

  function initThemeToggle() {
    var btn = DOM.qs('#theme-btn');
    if (!btn || btn.dataset.themeInit) { return; }
    btn.dataset.themeInit = '1';
    _updateThemeBtn();
    function doToggle() {
      var next = document.body.classList.contains('theme-light') ? 'dark' : 'light';
      document.body.classList.remove('theme-dark', 'theme-light', 'theme-auto');
      document.body.classList.add('theme-' + next);
      try { localStorage.setItem('rp_theme', next); } catch (e) {}
      _updateThemeBtn();
    }
    btn.addEventListener('touchend', function (e) { e.preventDefault(); doToggle(); });
    btn.addEventListener('click', function () { if (!('ontouchstart' in window)) { doToggle(); } });
  }

  // ---------------------------------------------------------------------------
  // applyConfig — tema, colonne, titolo
  // ---------------------------------------------------------------------------
  function applyConfig(config) {
    var resolvedTheme = config.theme || 'dark';
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-auto');
    document.body.classList.add('theme-' + resolvedTheme);
    try { localStorage.setItem('rp_theme', resolvedTheme); } catch (e) {}
    initThemeToggle();

    var titleEl = DOM.qs('#panel-title');
    if (titleEl) {
      titleEl.innerHTML = 'Retro <span style="color:var(--c-accent)">PANEL</span>';
    }
    document.title = config.title || 'Retro Panel';
    // Reload gesture: long-press title to force hard reload
    initReloadGesture();
    // Colonne: gestite interamente dai media query CSS su --tile-cols
  }

  // ---------------------------------------------------------------------------
  // updateEntityState — chiamato da WebSocket e polling
  // ---------------------------------------------------------------------------
  function updateEntityState(entityId, newState) {
    AppState.states[entityId] = newState;

    var tile = AppState.tileMap[entityId];
    if (tile) {
      // v2.0: ogni tile porta data-layout-type; il renderer risolve il componente
      var layoutType = tile.dataset.layoutType || 'sensor_generic';
      var component = window.RP_Renderer.getComponent(layoutType);

      if (component) {
        try { component.updateTile(tile, newState); }
        catch (err) { console.error('[app] updateTile failed for', entityId, err); }
      }
    }

    // Energy flow tiles
    for (var j = 0; j < AppState.energyTiles.length; j++) {
      var et = AppState.energyTiles[j];
      var cfg = et.cfg;
      if (entityId === cfg.solar_power            || entityId === cfg.home_power          ||
          entityId === cfg.battery_soc             || entityId === cfg.battery_charge_power ||
          entityId === cfg.battery_discharge_power || entityId === cfg.grid_import          ||
          entityId === cfg.grid_export) {
        try { window.EnergyFlowComponent.updateTile(et.tile, AppState.states); }
        catch (err) { console.error('[app] EnergyFlow updateTile failed:', err); }
      }
    }

  }

  // ---------------------------------------------------------------------------
  // Connection status
  // ---------------------------------------------------------------------------
  function setConnectionStatus(connected) {
    AppState.wsConnected = connected;
    var dot = DOM.qs('#connection-status');
    var banner = DOM.qs('#disconnect-banner');
    var contentArea = DOM.qs('#content-area');
    if (!dot) { return; }
    if (connected) {
      dot.className = 'status-dot status-connected';
      dot.title = 'Connesso';
      if (banner) { banner.classList.add('hidden'); }
      if (contentArea) { contentArea.classList.remove('content-stale'); }
      // Annulla eventuale poll residuo alla riconnessione
      if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    } else {
      dot.className = 'status-dot status-disconnected';
      dot.title = 'Disconnesso';
      if (banner) { banner.classList.remove('hidden'); }
      if (contentArea) { contentArea.classList.add('content-stale'); }
    }
  }

  function setConnecting() {
    var dot = DOM.qs('#connection-status');
    if (dot) { dot.className = 'status-dot status-connecting'; dot.title = 'Connessione\u2026'; }
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

    var DAYS   = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    var MONTHS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu',
                  'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

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
    pollTimer = setTimeout(function () {
      pollTimer = null;
      if (AppState.wsConnected) { return; }
      window.getAllStates().then(function (statesArray) {
        if (Array.isArray(statesArray)) {
          for (var i = 0; i < statesArray.length; i++) {
            var s = statesArray[i];
            if (s && s.entity_id) {
              updateEntityState(s.entity_id, { state: s.state, attributes: s.attributes });
            }
          }
        }
      }, function (err) {
        console.warn('[app] State poll failed:', err);
      }).then(function () {
        if (!AppState.wsConnected) { scheduleStatePoll(intervalSeconds); }
      });
    }, intervalSeconds * 1000);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  function boot() {
    window.getPanelConfig().then(function (config) {
      AppState.config = config;
      applyConfig(config);

      // Inizializza renderer (risolve i componenti a runtime)
      window.RP_Renderer.init();

      // Fetch stati iniziali
      return window.getAllStates().then(function (statesArray) {
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
          // Lazy-load states for the newly visible section entities
          if (window.getStates && window.RP_Nav.getSectionEntityIds) {
            var sectionIds = window.RP_Nav.getSectionEntityIds(sectionId);
            if (sectionIds && sectionIds.length > 0) {
              window.getStates(sectionIds).then(function (arr) {
                if (Array.isArray(arr)) {
                  for (var i = 0; i < arr.length; i++) {
                    var s = arr[i];
                    if (s && s.entity_id) {
                      updateEntityState(s.entity_id, { state: s.state, attributes: s.attributes });
                    }
                  }
                }
              }).catch(function (err) {
                console.warn('[app] Section state refresh failed:', err);
              });
            }
          }
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
      });

    }).catch(function (err) {
      console.error('[app] Boot failed:', err);
      showPanel();
      hideLoadingScreen();
      var ca = DOM.qs('#content-area');
      if (ca) {
        ca.innerHTML = '<div class="empty-state">'
          + '<span class="empty-state-icon">\u26A0</span>'
          + '<p class="empty-state-title">Impossibile connettersi a Home Assistant</p>'
          + '<p class="empty-state-hint">Controlla i log del componente aggiuntivo.</p>'
          + '</div>';
      }
    });
  }

  // ---------------------------------------------------------------------------
  // initReloadGesture — long-press #panel-title forces a hard reload
  // ---------------------------------------------------------------------------
  function initReloadGesture() {
    var titleEl = document.getElementById('panel-title');
    if (!titleEl) { return; }
    if (titleEl.dataset.reloadGestureInit) { return; }
    titleEl.dataset.reloadGestureInit = '1';

    var holdTimer = null;
    var touchStartX = 0;
    var touchStartY = 0;

    function startHold() {
      titleEl.style.opacity = '0.4';
      holdTimer = setTimeout(function () {
        titleEl.style.opacity = '1';
        setTimeout(function () {
          window.location.href = window.location.pathname + '?_r=' + Date.now();
        }, 150);
      }, 800);
    }

    function cancelHold() {
      clearTimeout(holdTimer);
      holdTimer = null;
      titleEl.style.opacity = '1';
    }

    titleEl.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      startHold();
    });

    titleEl.addEventListener('touchmove', function (e) {
      var dx = e.touches[0].clientX - touchStartX;
      var dy = e.touches[0].clientY - touchStartY;
      if (Math.sqrt(dx * dx + dy * dy) > 10) { cancelHold(); }
    });

    titleEl.addEventListener('touchend', cancelHold);
    titleEl.addEventListener('touchcancel', cancelHold);

    titleEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    titleEl.addEventListener('mousedown', startHold);
    titleEl.addEventListener('mouseup', cancelHold);
    titleEl.addEventListener('mouseleave', cancelHold);
  }

  // Avvia al caricamento
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}());
