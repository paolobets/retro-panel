/**
 * renderer.js — Section rendering module for Retro Panel
 * IIFE che espone window.RP_Renderer
 *
 * No ES modules. iOS 12+ Safari safe.
 * Niente const/let/arrow functions/import/export.
 *
 * Depends on: utils/dom.js, utils/format.js,
 *             components/light.js, switch.js, sensor.js, alarm.js,
 *             energy.js, scenario.js, camera.js
 */
window.RP_Renderer = (function () {
  'use strict';

  // Mappa domain → componente JS, risolta a runtime in init()
  var COMPONENTS = {
    light: null,
    switch: null,
    sensor: null,
    binary_sensor: null,
    alarm_control_panel: null,
    scene: null,
    script: null,
  };

  function _getComponents() {
    COMPONENTS.light               = window.LightComponent   || null;
    COMPONENTS.switch              = window.SwitchComponent  || null;
    COMPONENTS.sensor              = window.SensorComponent  || null;
    COMPONENTS.binary_sensor       = window.SensorComponent  || null;
    COMPONENTS.alarm_control_panel = window.AlarmComponent   || null;
    COMPONENTS.scene               = window.ScenarioComponent || null;
    COMPONENTS.script              = window.ScenarioComponent || null;
  }

  // ---------------------------------------------------------------------------
  // Component resolver
  // ---------------------------------------------------------------------------

  function resolveComponentForItem(item) {
    if (!item || !item.entity_id) { return null; }
    var domain = item.entity_id.split('.')[0];
    var dm = item.display_mode || 'auto';

    // display_mode 'row' o 'climate' → sempre SensorComponent
    if (dm === 'row' || dm === 'climate') {
      return window.SensorComponent || null;
    }

    return COMPONENTS[domain] || _resolveDefaultComponent(domain);
  }

  function _resolveDefaultComponent(domain) {
    // Tile generico per domini sconosciuti
    return {
      createTile: function (cfg) {
        var DOM = window.RP_DOM;
        var tile = DOM.createElement('div', 'tile entity-generic state-off');
        tile.dataset.entityId = cfg.entity_id;

        var top = DOM.createElement('div', 'tile-top');
        var iconEl = DOM.createElement('span', 'tile-icon');
        if (window.RP_FMT && window.RP_FMT.getIcon) {
          iconEl.innerHTML = window.RP_FMT.getIcon(cfg.icon, 28, cfg.entity_id);
        } else if (window.RP_MDI) {
          iconEl.innerHTML = window.RP_MDI(domain, 28) || '';
        }
        top.appendChild(iconEl);

        var bottom = DOM.createElement('div', 'tile-bottom');
        var valueEl = DOM.createElement('span', 'tile-value');
        valueEl.textContent = '\u2014';
        var labelEl = DOM.createElement('span', 'tile-label');
        labelEl.textContent = cfg.label || cfg.entity_id;
        bottom.appendChild(valueEl);
        bottom.appendChild(labelEl);

        tile.appendChild(top);
        tile.appendChild(bottom);
        return tile;
      },
      updateTile: function (tile, stateObj) {
        var state = stateObj ? stateObj.state : 'unavailable';
        tile.classList.remove('state-on', 'state-off', 'state-unavailable');
        if (state === 'unavailable' || state === 'unknown') {
          tile.classList.add('state-unavailable');
        } else if (state === 'on') {
          tile.classList.add('state-on');
        } else {
          tile.classList.add('state-off');
        }
        var valueEl = tile.querySelector('.tile-value');
        if (valueEl) { valueEl.textContent = state; }
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Lazy render a blocchi via requestAnimationFrame
  // ---------------------------------------------------------------------------

  function appendTilesInChunks(grid, tiles, idx) {
    var CHUNK = 10;
    var end = idx + CHUNK;
    if (end > tiles.length) { end = tiles.length; }
    for (var i = idx; i < end; i++) {
      grid.appendChild(tiles[i]);
    }
    if (end < tiles.length) {
      requestAnimationFrame(function () {
        appendTilesInChunks(grid, tiles, end);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Render functions
  // ---------------------------------------------------------------------------

  function renderActiveSection(appState) {
    var contentArea = document.getElementById('content-area');
    if (!contentArea) { return; }
    contentArea.innerHTML = '';
    appState.tileMap = {};
    appState.energyTiles = [];

    var sectionId = appState.activeSectionId;
    var config = appState.config;
    if (!config) { return; }

    if (sectionId === 'overview') {
      var ovItems = [];
      if (config.overview_items) {
        ovItems = config.overview_items;
      } else if (config.overview && config.overview.items) {
        ovItems = config.overview.items;
      }
      var ovTitle = (config.overview && config.overview.title) || null;
      renderItemsGrid(contentArea, ovItems, ovTitle, appState);

    } else if (sectionId === 'scenarios') {
      renderScenariosGrid(contentArea, config.scenarios || []);

    } else if (sectionId === 'cameras') {
      renderCamerasGrid(contentArea, config.cameras || []);

    } else if (sectionId.indexOf('room:') === 0) {
      var roomId = sectionId.slice(5);
      var rooms = config.rooms || [];
      var room = null;
      for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].id === roomId) { room = rooms[i]; break; }
      }
      if (room) {
        renderRoomSections(contentArea, room, appState);
      }
    }
  }

  function renderItemsGrid(container, items, heading, appState) {
    var DOM = window.RP_DOM;

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

    var tiles = [];

    for (var i = 0; i < items.length; i++) {
      try {
        var item = items[i];
        if (item.hidden) { continue; }

        if (item.type === 'entity') {
          var domain = item.entity_id.split('.')[0];
          var component = resolveComponentForItem(item);
          if (!component) {
            console.warn('[renderer] No component for domain:', domain, item.entity_id);
            continue;
          }
          var tile = component.createTile(item);
          if (item.visual_type) {
            tile.dataset.visualType = item.visual_type;
          }
          if (item.display_mode && item.display_mode !== 'auto') {
            tile.dataset.displayMode = item.display_mode;
          }
          if (domain === 'alarm_control_panel') { tile.classList.add('alarm-tile'); }

          // CRITICO: appendChild PRIMA di updateTile
          grid.appendChild(tile);
          appState.tileMap[item.entity_id] = tile;
          var stateObj = appState.states[item.entity_id];
          if (stateObj) {
            try { component.updateTile(tile, stateObj); }
            catch (ue) { console.error('[renderer] updateTile failed:', item.entity_id, ue); }
          }
          tiles.push(tile);

        } else if (item.type === 'energy_flow') {
          var efTile = window.EnergyFlowComponent.createTile(item);
          appState.energyTiles.push({ tile: efTile, cfg: item });
          grid.appendChild(efTile);
          window.EnergyFlowComponent.updateTile(efTile, appState.states);
        }
      } catch (err) {
        console.error('[renderer] renderItemsGrid item failed:', items[i] && items[i].entity_id, err);
      }
    }
  }

  function renderRoomSections(container, room, appState) {
    var DOM = window.RP_DOM;
    var sections = room.sections || [];

    // Migration fallback: se no sections ma legacy items[]
    if (sections.length === 0 && room.items && room.items.length > 0) {
      sections = [{ id: 'sec_default', title: '', items: room.items }];
    }

    if (sections.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">\u2699</span>'
        + '<p class="empty-state-title">No sections configured</p>'
        + '<p class="empty-state-hint">Open Settings to add sections and entities to this room.</p>';
      container.appendChild(empty);
      return;
    }

    for (var s = 0; s < sections.length; s++) {
      var section = sections[s];
      var items = section.items || [];

      // Filtra hidden
      var visibleItems = [];
      for (var vi = 0; vi < items.length; vi++) {
        if (!items[vi].hidden) { visibleItems.push(items[vi]); }
      }

      var sectionEl = DOM.createElement('div', 'room-section');

      if (section.title) {
        var sectionHeader = DOM.createElement('div', 'room-section-header');
        var titleEl = DOM.createElement('span', 'room-section-title');
        titleEl.textContent = section.title;
        sectionHeader.appendChild(titleEl);
        var countEl = DOM.createElement('span', 'room-section-count');
        countEl.textContent = String(visibleItems.length);
        sectionHeader.appendChild(countEl);
        var lineEl = DOM.createElement('span', 'room-section-line');
        sectionHeader.appendChild(lineEl);
        sectionEl.appendChild(sectionHeader);
      }

      if (visibleItems.length === 0) {
        var emptySection = DOM.createElement('p', 'room-section-empty');
        emptySection.textContent = 'No entities in this section.';
        sectionEl.appendChild(emptySection);
        container.appendChild(sectionEl);
        continue;
      }

      var grid = DOM.createElement('div', 'tile-grid-auto');
      sectionEl.appendChild(grid);
      container.appendChild(sectionEl);

      for (var j = 0; j < visibleItems.length; j++) {
        var item = visibleItems[j];
        try {
          if (item.type === 'entity') {
            var domain = item.entity_id.split('.')[0];
            var component = resolveComponentForItem(item);
            if (!component) {
              console.warn('[renderer] No component for domain:', domain, item.entity_id);
              continue;
            }
            var tile = component.createTile(item);
            if (item.visual_type) {
              tile.dataset.visualType = item.visual_type;
            }
            if (item.display_mode && item.display_mode !== 'auto') {
              tile.dataset.displayMode = item.display_mode;
            }
            if (domain === 'alarm_control_panel') { tile.classList.add('alarm-tile'); }

            // CRITICO: appendChild PRIMA di updateTile
            grid.appendChild(tile);
            appState.tileMap[item.entity_id] = tile;
            var stateObj = appState.states[item.entity_id];
            if (stateObj) {
              try { component.updateTile(tile, stateObj); }
              catch (ue) { console.error('[renderer] updateTile failed:', item.entity_id, ue); }
            }

          } else if (item.type === 'energy_flow') {
            var efTile = window.EnergyFlowComponent.createTile(item);
            appState.energyTiles.push({ tile: efTile, cfg: item });
            grid.appendChild(efTile);
            window.EnergyFlowComponent.updateTile(efTile, appState.states);
          }
        } catch (err) {
          console.error('[renderer] Failed to render tile:', (item && item.entity_id) || item, err);
        }
      }
    }
  }

  function renderScenariosGrid(container, scenarios) {
    var DOM = window.RP_DOM;
    var h = DOM.createElement('h2', 'section-heading');
    h.textContent = 'Scenari';
    container.appendChild(h);

    if (!scenarios || scenarios.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">'
        + (window.RP_MDI ? window.RP_MDI('palette', 36) : '\uD83C\uDFAD')
        + '</span>'
        + '<p class="empty-state-title">No scenarios configured</p>'
        + '<p class="empty-state-hint">Open Settings to add scenes and scripts.</p>';
      container.appendChild(empty);
      return;
    }

    var grid = DOM.createElement('div', 'scenarios-grid');
    for (var i = 0; i < scenarios.length; i++) {
      try {
        grid.appendChild(window.ScenarioComponent.createCard(scenarios[i]));
      } catch (err) {
        console.error('[renderer] scenario card failed:', err);
      }
    }
    container.appendChild(grid);
  }

  function renderCamerasGrid(container, cameras) {
    var DOM = window.RP_DOM;
    var h = DOM.createElement('h2', 'section-heading');
    h.textContent = 'Telecamere';
    container.appendChild(h);

    if (!cameras || cameras.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">'
        + (window.RP_MDI ? window.RP_MDI('cctv', 36) : '\uD83D\uDCF9')
        + '</span>'
        + '<p class="empty-state-title">No cameras configured</p>'
        + '<p class="empty-state-hint">Open Settings to add camera entities.</p>';
      container.appendChild(empty);
      return;
    }

    var grid = DOM.createElement('div', 'cameras-grid');
    container.appendChild(grid);

    for (var i = 0; i < cameras.length; i++) {
      try {
        var tile = window.CameraComponent.createTile(cameras[i]);
        grid.appendChild(tile);
      } catch (err) {
        console.error('[renderer] camera tile failed:', cameras[i] && cameras[i].entity_id, err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  return {
    init: function () { _getComponents(); },
    renderActiveSection: renderActiveSection,
    renderItemsGrid: renderItemsGrid,
    renderRoomSections: renderRoomSections,
    renderScenariosGrid: renderScenariosGrid,
    renderCamerasGrid: renderCamerasGrid,
    resolveComponentForItem: resolveComponentForItem,
  };
}());
