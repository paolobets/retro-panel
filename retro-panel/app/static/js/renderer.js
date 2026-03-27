/**
 * renderer.js — Section rendering module for Retro Panel 2.0
 * IIFE che espone window.RP_Renderer
 *
 * v2.0: uses layout_type-based COMPONENT_MAP and COL_CLASS_MAP.
 * Each tile is wrapped in a .tile-col-* div inside a .tile-row div.
 * The COMPONENT_MAP is resolved lazily in init().
 *
 * No ES modules. iOS 12+ Safari safe.
 * No const/let/arrow functions/import/export.
 *
 * Depends on: utils/dom.js, utils/format.js,
 *             components/light.js, switch.js, sensor.js, alarm.js,
 *             energy.js, scenario.js, camera.js
 */
window.RP_Renderer = (function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // COMPONENT_MAP: layout_type → component object (resolved in init())
  // ---------------------------------------------------------------------------
  var COMPONENT_MAP = {
    'light':              null,
    'switch':             null,
    'sensor_temperature': null,
    'sensor_humidity':    null,
    'sensor_co2':         null,
    'sensor_battery':     null,
    'sensor_energy':      null,
    'sensor_generic':     null,
    'binary_door':        null,
    'binary_motion':      null,
    'binary_standard':    null,
    'alarm':              null,
    'camera':             null,
    'scenario':           null,
    'energy_flow':        null,
  };

  // Column class for each layout_type
  var COL_CLASS_MAP = {
    'light':              'tile-col-compact',
    'switch':             'tile-col-compact',
    'sensor_temperature': 'tile-col-sensor',
    'sensor_humidity':    'tile-col-sensor',
    'sensor_co2':         'tile-col-sensor',
    'sensor_battery':     'tile-col-sensor',
    'sensor_energy':      'tile-col-sensor',
    'sensor_generic':     'tile-col-sensor',
    'binary_door':        'tile-col-sensor',
    'binary_motion':      'tile-col-sensor',
    'binary_standard':    'tile-col-sensor',
    'alarm':              'tile-col-full',
    'camera':             'tile-col-full',
    'scenario':           'tile-col-compact',
    'energy_flow':        'tile-col-full',
  };

  function _initComponents() {
    COMPONENT_MAP['light']              = window.LightComponent    || null;
    COMPONENT_MAP['switch']             = window.SwitchComponent   || null;
    COMPONENT_MAP['sensor_temperature'] = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_humidity']    = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_co2']         = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_battery']     = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_energy']      = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_generic']     = window.SensorComponent   || null;
    COMPONENT_MAP['binary_door']        = window.SensorComponent   || null;
    COMPONENT_MAP['binary_motion']      = window.SensorComponent   || null;
    COMPONENT_MAP['binary_standard']    = window.SensorComponent   || null;
    COMPONENT_MAP['alarm']              = window.AlarmComponent    || null;
    COMPONENT_MAP['camera']             = window.CameraComponent   || null;
    COMPONENT_MAP['scenario']           = window.ScenarioComponent || null;
    COMPONENT_MAP['energy_flow']        = window.EnergyFlowComponent || null;
  }

  // ---------------------------------------------------------------------------
  // Render a single item into a column wrapper, append to a tile-row
  // Returns the inner tile element (stored in tileMap) or null on failure.
  // ---------------------------------------------------------------------------
  function _renderItem(item, tileRow, appState) {
    var DOM = window.RP_DOM;

    if (!item || item.hidden) { return null; }

    // energy_flow is handled separately (has no entity_id)
    if (item.type === 'energy_flow') {
      var efComp = COMPONENT_MAP['energy_flow'];
      if (!efComp) { return null; }
      var efTile = efComp.createTile(item);
      var efCol = DOM.createElement('div', COL_CLASS_MAP['energy_flow'] || 'tile-col-full');
      efCol.appendChild(efTile);
      tileRow.appendChild(efCol);
      appState.energyTiles.push({ tile: efTile, cfg: item });
      efComp.updateTile(efTile, appState.states);
      return efTile;
    }

    if (item.type !== 'entity' || !item.entity_id) { return null; }

    var layoutType = item.layout_type || 'sensor_generic';
    var component = COMPONENT_MAP[layoutType];
    if (!component) {
      console.warn('[renderer] No component for layout_type:', layoutType, item.entity_id);
      component = _makeGenericComponent();
    }

    var colClass = COL_CLASS_MAP[layoutType] || 'tile-col-sensor';
    var col = DOM.createElement('div', colClass);

    var tile;
    try {
      tile = component.createTile(item);
    } catch (err) {
      console.error('[renderer] createTile failed:', item.entity_id, err);
      return null;
    }

    col.appendChild(tile);
    tileRow.appendChild(col);

    appState.tileMap[item.entity_id] = tile;

    var stateObj = appState.states[item.entity_id];
    if (stateObj) {
      try { component.updateTile(tile, stateObj); }
      catch (ue) { console.error('[renderer] updateTile failed:', item.entity_id, ue); }
    }

    return tile;
  }

  // ---------------------------------------------------------------------------
  // Fallback component for unknown layout_types
  // ---------------------------------------------------------------------------
  function _makeGenericComponent() {
    return {
      createTile: function (cfg) {
        var DOM = window.RP_DOM;
        var tile = DOM.createElement('div', 'tile tile-sensor');
        tile.dataset.entityId = cfg.entity_id;
        tile.dataset.layoutType = cfg.layout_type || '';

        var bubble = DOM.createElement('div', 'sensor-icon-bubble sri-ok');
        if (window.RP_FMT) {
          bubble.innerHTML = window.RP_FMT.getIcon(cfg.icon, 20, cfg.entity_id);
        }

        var text = DOM.createElement('div', 'sensor-text');
        var name = DOM.createElement('span', 'sensor-name');
        name.textContent = cfg.label || cfg.entity_id;
        var val = DOM.createElement('span', 'sensor-value');
        val.textContent = '\u2014';
        text.appendChild(name);
        text.appendChild(val);

        tile.appendChild(bubble);
        tile.appendChild(text);
        return tile;
      },
      updateTile: function (tile, stateObj) {
        var state = stateObj ? stateObj.state : 'unavailable';
        tile.classList.remove('is-on', 'is-off', 'is-unavail');
        if (state === 'unavailable' || state === 'unknown') {
          tile.classList.add('is-unavail');
        } else {
          tile.classList.add('is-on');
        }
        var valEl = tile.querySelector('.sensor-value');
        if (valEl) { valEl.textContent = state; }
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Render a list of items into container using tile-row/tile-col layout
  // ---------------------------------------------------------------------------
  function renderItems(container, items, appState) {
    var DOM = window.RP_DOM;

    if (!items || items.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">\u2699</span>'
        + '<p class="empty-state-title">No items configured</p>'
        + '<p class="empty-state-hint">Open Config to add entities to this section.</p>';
      container.appendChild(empty);
      return;
    }

    var row = DOM.createElement('div', 'tile-row');
    container.appendChild(row);

    for (var i = 0; i < items.length; i++) {
      try {
        _renderItem(items[i], row, appState);
      } catch (err) {
        console.error('[renderer] _renderItem failed:', items[i] && items[i].entity_id, err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Render active section
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
      var ovItems = config.overview_items
        || (config.overview && config.overview.items)
        || [];
      var ovTitle = (config.overview && config.overview.title) || null;
      if (ovTitle) {
        var h = document.createElement('h2');
        h.className = 'section-heading';
        h.textContent = ovTitle;
        contentArea.appendChild(h);
      }
      renderItems(contentArea, ovItems, appState);

    } else if (sectionId === 'scenarios') {
      _renderScenariosSection(contentArea, config.scenarios || []);

    } else if (sectionId === 'cameras') {
      _renderCamerasSection(contentArea, config.cameras || []);

    } else if (sectionId.indexOf('room:') === 0) {
      var roomId = sectionId.slice(5);
      var rooms = config.rooms || [];
      var room = null;
      for (var i = 0; i < rooms.length; i++) {
        if (rooms[i].id === roomId) { room = rooms[i]; break; }
      }
      if (room) { _renderRoomSections(contentArea, room, appState); }
    }
  }

  // ---------------------------------------------------------------------------
  // Room sections
  // ---------------------------------------------------------------------------
  function _renderRoomSections(container, room, appState) {
    var DOM = window.RP_DOM;
    var sections = room.sections || [];

    // Legacy: room.items[] without sections
    if (sections.length === 0 && room.items && room.items.length > 0) {
      sections = [{ id: 'sec_default', title: '', items: room.items }];
    }

    if (sections.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">\u2699</span>'
        + '<p class="empty-state-title">No sections configured</p>'
        + '<p class="empty-state-hint">Open Config to add sections to this room.</p>';
      container.appendChild(empty);
      return;
    }

    for (var s = 0; s < sections.length; s++) {
      var section = sections[s];
      var visibleItems = [];
      var items = section.items || [];
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

      container.appendChild(sectionEl);
      renderItems(sectionEl, visibleItems, appState);
    }
  }

  // ---------------------------------------------------------------------------
  // Scenarios section (flat grid)
  // ---------------------------------------------------------------------------
  function _renderScenariosSection(container, scenarios) {
    var DOM = window.RP_DOM;
    var h = DOM.createElement('h2', 'section-heading');
    h.textContent = 'Scenari';
    container.appendChild(h);

    if (!scenarios || scenarios.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">\uD83C\uDFAD</span>'
        + '<p class="empty-state-title">No scenarios configured</p>'
        + '<p class="empty-state-hint">Open Config to add scenes and scripts.</p>';
      container.appendChild(empty);
      return;
    }

    var grid = DOM.createElement('div', 'scenarios-grid');
    for (var i = 0; i < scenarios.length; i++) {
      if (scenarios[i].hidden) { continue; }
      try {
        var tile;
        if (window.ScenarioComponent.createTile) {
          tile = window.ScenarioComponent.createTile(scenarios[i]);
        } else {
          tile = window.ScenarioComponent.createCard(scenarios[i]);
        }
        grid.appendChild(tile);
      } catch (err) {
        console.error('[renderer] scenario tile failed:', err);
      }
    }
    container.appendChild(grid);
  }

  // ---------------------------------------------------------------------------
  // Cameras section (full-width tiles)
  // ---------------------------------------------------------------------------
  function _renderCamerasSection(container, cameras) {
    var DOM = window.RP_DOM;
    var h = DOM.createElement('h2', 'section-heading');
    h.textContent = 'Telecamere';
    container.appendChild(h);

    if (!cameras || cameras.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">\uD83D\uDCF9</span>'
        + '<p class="empty-state-title">No cameras configured</p>'
        + '<p class="empty-state-hint">Open Config to add camera entities.</p>';
      container.appendChild(empty);
      return;
    }

    for (var i = 0; i < cameras.length; i++) {
      if (cameras[i].hidden) { continue; }
      try {
        var tile = window.CameraComponent.createTile(cameras[i]);
        container.appendChild(tile);
      } catch (err) {
        console.error('[renderer] camera tile failed:', cameras[i] && cameras[i].entity_id, err);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  return {
    init: function () { _initComponents(); },
    renderActiveSection: renderActiveSection,
    renderItems: renderItems,
    getComponent: function (layoutType) {
      return COMPONENT_MAP[layoutType] || null;
    },
  };
}());
