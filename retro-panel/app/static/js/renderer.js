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
    'light_standard':     null,
    'light_dimmer':       null,
    'light_rgb':          null,
    'switch':             null,
    'lock':               null,
    'sensor_temperature': null,
    'sensor_humidity':    null,
    'sensor_co2':         null,
    'sensor_battery':     null,
    'sensor_energy':      null,
    'sensor_generic':     null,
    'sensor_illuminance': null,
    'sensor_pressure':    null,
    'sensor_air_quality': null,
    'sensor_electrical': null,
    'sensor_signal':     null,
    'sensor_gas':        null,
    'sensor_speed':      null,
    'sensor_water':      null,
    'sensor_ph':         null,
    'sensor_physical':   null,
    'binary_door':        null,
    'binary_window':      null,
    'binary_motion':      null,
    'binary_standard':    null,
    'binary_presence':    null,
    'binary_smoke':       null,
    'binary_moisture':    null,
    'binary_lock':        null,
    'binary_vibration':   null,
    'alarm':              null,
    'alarm_sensor':       null,
    'camera':             null,
    'scenario':           null,
    'button':             null,
    'energy_flow':        null,
    'cover_standard':     null,
    'sensor_conditional': null,
    'climate':    null,
  };

  // Column class for each layout_type
  var COL_CLASS_MAP = {
    'light':              'tile-col-compact',
    'light_standard':     'tile-col-compact',
    'light_dimmer':       'tile-col-compact',
    'light_rgb':          'tile-col-compact',
    'switch':             'tile-col-compact',
    'lock':               'tile-col-compact',
    'sensor_temperature': 'tile-col-sensor',
    'sensor_humidity':    'tile-col-sensor',
    'sensor_co2':         'tile-col-sensor',
    'sensor_battery':     'tile-col-sensor',
    'sensor_energy':      'tile-col-sensor',
    'sensor_generic':     'tile-col-sensor',
    'sensor_illuminance': 'tile-col-sensor',
    'sensor_pressure':    'tile-col-sensor',
    'sensor_air_quality': 'tile-col-sensor',
    'sensor_electrical': 'tile-col-sensor',
    'sensor_signal':     'tile-col-sensor',
    'sensor_gas':        'tile-col-sensor',
    'sensor_speed':      'tile-col-sensor',
    'sensor_water':      'tile-col-sensor',
    'sensor_ph':         'tile-col-sensor',
    'sensor_physical':   'tile-col-sensor',
    'binary_door':        'tile-col-sensor',
    'binary_window':      'tile-col-sensor',
    'binary_motion':      'tile-col-sensor',
    'binary_standard':    'tile-col-sensor',
    'binary_presence':    'tile-col-sensor',
    'binary_smoke':       'tile-col-sensor',
    'binary_moisture':    'tile-col-sensor',
    'binary_lock':        'tile-col-sensor',
    'binary_vibration':   'tile-col-sensor',
    'alarm':              'tile-col-full',
    'alarm_sensor':       'tile-col-alarm-sensor',
    'camera':             'tile-col-full',
    'scenario':           'tile-col-compact',
    'button':             'tile-col-compact',
    'energy_flow':        'tile-col-full',
    'cover_standard':     'tile-col-compact',
    'sensor_conditional': 'tile-col-sensor',
    'climate':    'tile-col-compact',
  };

  function _initComponents() {
    COMPONENT_MAP['light']              = window.LightComponent    || null;
    COMPONENT_MAP['light_standard']     = window.LightComponent    || null;
    COMPONENT_MAP['light_dimmer']       = window.LightComponent    || null;
    COMPONENT_MAP['light_rgb']          = window.LightComponent    || null;
    COMPONENT_MAP['switch']             = window.SwitchComponent   || null;
    COMPONENT_MAP['lock']               = window.LockComponent     || null;
    COMPONENT_MAP['sensor_temperature'] = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_humidity']    = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_co2']         = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_battery']     = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_energy']      = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_generic']     = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_illuminance'] = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_pressure']    = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_air_quality'] = window.SensorComponent   || null;
    COMPONENT_MAP['sensor_electrical'] = window.SensorComponent || null;
    COMPONENT_MAP['sensor_signal']     = window.SensorComponent || null;
    COMPONENT_MAP['sensor_gas']        = window.SensorComponent || null;
    COMPONENT_MAP['sensor_speed']      = window.SensorComponent || null;
    COMPONENT_MAP['sensor_water']      = window.SensorComponent || null;
    COMPONENT_MAP['sensor_ph']         = window.SensorComponent || null;
    COMPONENT_MAP['sensor_physical']   = window.SensorComponent || null;
    COMPONENT_MAP['binary_door']        = window.SensorComponent   || null;
    COMPONENT_MAP['binary_window']      = window.SensorComponent   || null;
    COMPONENT_MAP['binary_motion']      = window.SensorComponent   || null;
    COMPONENT_MAP['binary_standard']    = window.SensorComponent   || null;
    COMPONENT_MAP['binary_presence']    = window.SensorComponent   || null;
    COMPONENT_MAP['binary_smoke']       = window.SensorComponent   || null;
    COMPONENT_MAP['binary_moisture']    = window.SensorComponent   || null;
    COMPONENT_MAP['binary_lock']        = window.SensorComponent   || null;
    COMPONENT_MAP['binary_vibration']   = window.SensorComponent   || null;
    COMPONENT_MAP['alarm']              = window.AlarmComponent    || null;
    COMPONENT_MAP['alarm_sensor']       = window.AlarmSensorComponent || null;
    COMPONENT_MAP['camera']             = window.CameraComponent   || null;
    COMPONENT_MAP['scenario']           = window.ScenarioComponent || null;
    COMPONENT_MAP['button']             = window.ButtonComponent   || null;
    COMPONENT_MAP['energy_flow']        = window.EnergyFlowComponent || null;
    COMPONENT_MAP['cover_standard']     = window.CoverComponent              || null;
    COMPONENT_MAP['sensor_conditional'] = window.SensorConditionalComponent  || null;
    COMPONENT_MAP['climate']            = window.ClimateComponent  || null;
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

    // sensor_conditional is handled separately (visibility driven by conditions on other entities)
    if (item.type === 'sensor_conditional') {
      var scComp = COMPONENT_MAP['sensor_conditional'];
      if (!scComp) { return null; }
      var scTile = scComp.createTile(item);
      var scCol = DOM.createElement('div', COL_CLASS_MAP['sensor_conditional'] || 'tile-col-sensor');
      scCol.appendChild(scTile);
      tileRow.appendChild(scCol);
      appState.conditionalTiles.push({ tile: scTile, cfg: item });
      scComp.updateTile(scTile, appState.states);
      return scTile;
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
        var tile = DOM.createElement('div', 'tile tile-sensor s-generic');
        tile.dataset.entityId   = cfg.entity_id;
        tile.dataset.layoutType = cfg.layout_type || '';

        var bubble = DOM.createElement('div', 'bubble');
        if (window.RP_FMT) {
          bubble.innerHTML = window.RP_FMT.getIcon(cfg.icon, 20, cfg.entity_id);
        }

        var info = DOM.createElement('div', 'info');
        var name = DOM.createElement('span', 'name');
        name.textContent = cfg.label || cfg.entity_id;
        var val = DOM.createElement('span', 'val');
        val.textContent = '\u2014';
        info.appendChild(name);
        info.appendChild(val);

        tile.appendChild(bubble);
        tile.appendChild(info);
        return tile;
      },
      updateTile: function (tile, stateObj) {
        var state = stateObj ? stateObj.state : 'unavailable';
        tile.classList.remove('is-unavail');
        if (state === 'unavailable' || state === 'unknown') {
          tile.classList.add('is-unavail');
        }
        var valEl = tile.querySelector('.val');
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
    if (window.CameraComponent) { window.CameraComponent.destroyAll(); }
    contentArea.innerHTML = '';
    appState.tileMap = {};
    appState.energyTiles = [];
    appState.conditionalTiles = [];

    var sectionId = appState.activeSectionId;
    var config = appState.config;
    if (!config) { return; }

    if (sectionId === 'overview') {
      _renderGenericSections(
        contentArea,
        config.overview && config.overview.sections,
        renderItems,
        appState,
        '\uD83C\uDFE0',
        'No sections configured'
      );

    } else if (sectionId === 'scenarios') {
      _renderGenericSections(
        contentArea,
        config.scenarios,
        _renderScenarioItems,
        appState,
        '\uD83C\uDFAD',
        'No scenarios configured'
      );

    } else if (sectionId === 'cameras') {
      _renderGenericSections(
        contentArea,
        config.cameras,
        _renderCameraItems,
        appState,
        '\uD83D\uDCF9',
        'No cameras configured'
      );

    } else if (sectionId === 'alarms') {
      var alarmSec = config.alarms_section || {};
      _renderAlarmSection(contentArea, config.alarms, alarmSec, appState);

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
  // Scenario items (grid of tiles, no heading) — used by _renderGenericSections
  // ---------------------------------------------------------------------------
  function _renderScenarioItems(container, items) {
    if (!items || items.length === 0) { return; }

    var grid = window.RP_DOM.createElement('div', 'scenarios-grid');
    for (var i = 0; i < items.length; i++) {
      if (items[i].hidden) { continue; }
      try {
        if (!window.ScenarioComponent) { continue; }
        var tile = window.ScenarioComponent.createTile(items[i]);
        /* wrap in compact column — same as switch/light tiles */
        var col = window.RP_DOM.createElement('div', 'tile-col-compact');
        col.appendChild(tile);
        grid.appendChild(col);
      } catch (err) {
        console.error('[renderer] scenario tile failed:', err);
      }
    }
    container.appendChild(grid);
  }

  // ---------------------------------------------------------------------------
  // Camera items — 2-column grid, 4 cameras per page, with pagination
  // ---------------------------------------------------------------------------
  function _renderCameraItems(container, items) {
    if (!items || items.length === 0) { return; }

    var CAMS_PER_PAGE = 4;
    var DOM = window.RP_DOM;

    // Filter hidden
    var visible = [];
    for (var k = 0; k < items.length; k++) {
      if (!items[k].hidden) { visible.push(items[k]); }
    }
    if (visible.length === 0) { return; }

    var totalPages = Math.ceil(visible.length / CAMS_PER_PAGE);
    var currentPage = 0;

    var grid = DOM.createElement('div', 'cameras-grid');
    container.appendChild(grid);

    // Pagination bar (only rendered when needed)
    var prevBtn = null;
    var nextBtn = null;
    var pageInfo = null;
    if (totalPages > 1) {
      var paginationEl = DOM.createElement('div', 'cam-pagination');
      prevBtn = document.createElement('button');
      prevBtn.type = 'button';
      prevBtn.className = 'cam-page-btn';
      prevBtn.innerHTML = '&#8592;';  // ←
      nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'cam-page-btn';
      nextBtn.innerHTML = '&#8594;';  // →
      pageInfo = document.createElement('span');
      pageInfo.className = 'cam-page-info';
      paginationEl.appendChild(prevBtn);
      paginationEl.appendChild(pageInfo);
      paginationEl.appendChild(nextBtn);
      container.appendChild(paginationEl);
    }

    function _renderPage(page) {
      // Destroy timers for cameras currently in the grid
      var oldTiles = grid.querySelectorAll('.tile-camera');
      if (window.CameraComponent) {
        for (var t = 0; t < oldTiles.length; t++) {
          var eid = oldTiles[t].dataset.entityId;
          if (eid) { window.CameraComponent.destroyForEntity(eid); }
        }
      }
      grid.innerHTML = '';

      var start = page * CAMS_PER_PAGE;
      var end = Math.min(start + CAMS_PER_PAGE, visible.length);
      for (var i = start; i < end; i++) {
        try {
          if (!window.CameraComponent) { continue; }
          var tile = window.CameraComponent.createTile(visible[i]);
          var col = DOM.createElement('div', 'cam-col');
          col.appendChild(tile);
          grid.appendChild(col);
        } catch (err) {
          console.error('[renderer] camera tile failed:', visible[i] && visible[i].entity_id, err);
        }
      }

      currentPage = page;
      if (prevBtn) { prevBtn.disabled = (page === 0); }
      if (nextBtn) { nextBtn.disabled = (page >= totalPages - 1); }
      if (pageInfo) { pageInfo.textContent = (page + 1) + ' / ' + totalPages; }
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        if (currentPage > 0) { _renderPage(currentPage - 1); }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        if (currentPage < totalPages - 1) { _renderPage(currentPage + 1); }
      });
    }

    _renderPage(0);
  }

  // ---------------------------------------------------------------------------
  // Alarm items — renders alarm control panel + sensor zone grid
  // ---------------------------------------------------------------------------
  function _renderAlarmItems(container, alarms, appState) {
    if (!alarms || alarms.length === 0) { return; }
    var DOM = window.RP_DOM;

    for (var i = 0; i < alarms.length; i++) {
      var alarmCfg = alarms[i];
      if (!alarmCfg || !alarmCfg.entity_id) { continue; }

      // Alarm control panel tile
      var alarmComp = COMPONENT_MAP['alarm'];
      if (alarmComp) {
        try {
          var alarmTile = alarmComp.createTile(alarmCfg);
          var alarmCol = DOM.createElement('div', 'tile-col-full');
          alarmCol.appendChild(alarmTile);
          container.appendChild(alarmCol);
          appState.tileMap[alarmCfg.entity_id] = alarmTile;
          /* Always call updateTile — fallback to 'unknown' so sections are
             correctly shown/hidden even if HA state hasn't arrived yet */
          var alarmState = appState.states[alarmCfg.entity_id]
                        || { state: 'unknown', attributes: {} };
          try { alarmComp.updateTile(alarmTile, alarmState); } catch (ue) { }
        } catch (err) {
          console.error('[renderer] alarm tile failed:', alarmCfg.entity_id, err);
        }
      }

      // Sensor zone tiles — rendered as standard binary_sensor items
      var sensors = alarmCfg.sensors || [];
      if (sensors.length > 0) {
        var sensorRow = DOM.createElement('div', 'tile-row');
        for (var j = 0; j < sensors.length; j++) {
          var sensorCfg = sensors[j];
          if (!sensorCfg || !sensorCfg.entity_id) { continue; }
          // Build a standard item object so _renderItem can handle it
          var sensorItem = {
            type: 'entity',
            entity_id: sensorCfg.entity_id,
            label: sensorCfg.label || '',
            layout_type: sensorCfg.layout_type || 'binary_standard',
            icon: '',
            visual_type: '',
            display_mode: 'auto'
          };
          var tile = _renderItem(sensorItem, sensorRow, appState);
          if (tile) {
            appState.tileMap[sensorCfg.entity_id] = tile;
          }
        }
        container.appendChild(sensorRow);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Alarm section — entry point for the 'alarms' section
  // ---------------------------------------------------------------------------
  function _renderAlarmSection(container, alarms, sectionCfg, appState) {
    var DOM = window.RP_DOM;
    if (!alarms || alarms.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">\uD83D\uDEE1\uFE0F</span>'
        + '<p class="empty-state-title">Nessun allarme configurato</p>'
        + '<p class="empty-state-hint">Apri Config per aggiungere un allarme.</p>';
      container.appendChild(empty);
      return;
    }
    _renderAlarmItems(container, alarms, appState);
  }

  // ---------------------------------------------------------------------------
  // Generic sections helper — renders an array of {title, items[]} sections
  // ---------------------------------------------------------------------------
  function _renderGenericSections(container, sections, renderItemsFn, appState, emptyIcon, emptyMsg) {
    var DOM = window.RP_DOM;

    if (!sections || sections.length === 0) {
      var empty = DOM.createElement('div', 'empty-state');
      empty.innerHTML = '<span class="empty-state-icon">' + (emptyIcon || '\u2699') + '</span>'
        + '<p class="empty-state-title">' + (emptyMsg || 'No sections configured') + '</p>'
        + '<p class="empty-state-hint">Open Config to add sections.</p>';
      container.appendChild(empty);
      return;
    }

    for (var s = 0; s < sections.length; s++) {
      var section = sections[s];
      var items = section.items || [];
      var sectionEl = DOM.createElement('div', 'room-section');

      if (section.title) {
        var sectionHeader = DOM.createElement('div', 'room-section-header');
        var titleEl = DOM.createElement('span', 'room-section-title');
        titleEl.textContent = section.title;
        sectionHeader.appendChild(titleEl);
        var countEl = DOM.createElement('span', 'room-section-count');
        var visCount = 0;
        for (var vi = 0; vi < items.length; vi++) {
          if (!items[vi].hidden) { visCount++; }
        }
        countEl.textContent = String(visCount);
        sectionHeader.appendChild(countEl);
        var lineEl = DOM.createElement('span', 'room-section-line');
        sectionHeader.appendChild(lineEl);
        sectionEl.appendChild(sectionHeader);
      }

      container.appendChild(sectionEl);
      renderItemsFn(sectionEl, items, appState);
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
