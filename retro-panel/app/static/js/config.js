/**
 * config.js — Settings page logic for Retro Panel v1.2
 *
 * Manages four sections:
 *   overview  — items on the main home screen
 *   rooms     — per-room entity grids
 *   scenarios — scenes/scripts
 *   header    — mini sensor chips in the top bar
 *
 * Plain IIFE — no ES modules. iOS 15 / legacy browser compatible.
 * Depends on config-api.js loaded before this script.
 */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────

  // v3 data model
  var state = {
    overview:       { items: [] },
    rooms:          [],           // [{id, title, icon, hidden, items:[]}]
    scenarios:      [],           // [{entity_id, title, icon}]
    header_sensors: [],           // [{entity_id, icon, label}]
  };

  var allEntities  = [];   // from /api/entities
  var allSensors   = [];   // from /api/entities?domain=sensor
  var allScenarios = [];   // scenes + scripts

  // Entity picker state
  var pickerContext   = null;  // 'overview' | 'room' | 'header'
  var filterDomain    = '';
  var searchText      = '';
  var sensorPickerTarget = null;
  var sensorSearchText   = '';
  var scenarioSearchText = '';

  // Room editor state
  var editingRoomId = null;

  // Energy wizard state
  var energyContext = null;   // 'overview' | 'room'
  var energyItemIdx = null;   // index in the target items array (null = new)
  var wizardStep    = 0;
  var wizardValues  = { 'ef-solar': '', 'ef-batt-soc': '', 'ef-batt-pwr': '', 'ef-grid': '', 'ef-home': '' };

  // Active config tab
  var activeTab = 'overview';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function qs(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function genId() { return 'room_' + Math.random().toString(36).slice(2, 9); }

  function activeRoomItems() {
    for (var i = 0; i < state.rooms.length; i++) {
      if (state.rooms[i].id === editingRoomId) { return state.rooms[i].items; }
    }
    return [];
  }

  function activeRoomObj() {
    for (var i = 0; i < state.rooms.length; i++) {
      if (state.rooms[i].id === editingRoomId) { return state.rooms[i]; }
    }
    return null;
  }

  function contextItems() {
    if (pickerContext === 'overview') { return state.overview.items; }
    if (pickerContext === 'room')     { return activeRoomItems(); }
    return [];
  }

  // ── Tab navigation ─────────────────────────────────────────────────────────

  function switchTab(tabId) {
    activeTab = tabId;

    var tabs = document.querySelectorAll('.cfg-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabId);
    }

    var sections = ['overview', 'rooms', 'scenarios', 'header'];
    for (var j = 0; j < sections.length; j++) {
      var el = qs('tab-' + sections[j]);
      if (el) { el.classList.toggle('hidden', sections[j] !== tabId); }
    }

    // Close room editor when leaving rooms tab
    if (tabId !== 'rooms') { closeRoomEditor(); }
  }

  // ── Overview items ─────────────────────────────────────────────────────────

  function renderOverviewItems() {
    var container = qs('overview-items-list');
    if (!container) { return; }
    renderItemsList(container, state.overview.items, 'overview');
  }

  // ── Generic items list renderer ────────────────────────────────────────────

  function renderItemsList(container, items, context) {
    if (!items || items.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No items yet. Add entities below.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var isHidden = !!item.hidden;
      html += '<div class="selected-row' + (isHidden ? ' selected-row--hidden' : '') + '">';
      if (item.type === 'energy_flow') {
        html += '<span class="selected-id selected-id-energy">&#9889; Power Flow Card</span>';
        html += '<div class="selected-actions">';
        if (i > 0) {
          html += '<button class="reorder-btn" type="button" data-action="up" data-idx="' + i + '" data-ctx="' + esc(context) + '">\u2191</button>';
        }
        if (i < items.length - 1) {
          html += '<button class="reorder-btn" type="button" data-action="down" data-idx="' + i + '" data-ctx="' + esc(context) + '">\u2193</button>';
        }
        html += '<button class="edit-energy-btn action-btn-sm" type="button" data-idx="' + i + '" data-ctx="' + esc(context) + '">Edit</button>';
        html += '<button class="remove-btn" type="button" data-idx="' + i + '" data-ctx="' + esc(context) + '">\u2715</button>';
      } else {
        html += '<span class="selected-id">' + esc(item.entity_id) + '</span>';
        html += '<div class="selected-actions">';
        html += '<button class="item-visibility-btn" type="button" title="' + (isHidden ? 'Show' : 'Hide') + '" data-idx="' + i + '" data-ctx="' + esc(context) + '">' + (isHidden ? '\uD83D\uDC41\uFE0F' : '\uD83D\uDC41') + '</button>';
        if (i > 0) {
          html += '<button class="reorder-btn" type="button" data-action="up" data-idx="' + i + '" data-ctx="' + esc(context) + '">\u2191</button>';
        }
        if (i < items.length - 1) {
          html += '<button class="reorder-btn" type="button" data-action="down" data-idx="' + i + '" data-ctx="' + esc(context) + '">\u2193</button>';
        }
        html += '<button class="remove-btn" type="button" data-idx="' + i + '" data-ctx="' + esc(context) + '">\u2715</button>';
      }
      html += '</div></div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.reorder-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var ctx = this.getAttribute('data-ctx');
        var delta = this.getAttribute('data-action') === 'up' ? -1 : 1;
        reorderItem(ctx, idx, delta);
      });
    });

    container.querySelectorAll('.remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var ctx = this.getAttribute('data-ctx');
        removeItem(ctx, idx);
      });
    });

    container.querySelectorAll('.item-visibility-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var ctx = this.getAttribute('data-ctx');
        var items = getItemsForContext(ctx);
        if (items[idx]) {
          items[idx].hidden = !items[idx].hidden;
          refreshItemsList(ctx);
        }
      });
    });

    container.querySelectorAll('.edit-energy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var ctx = this.getAttribute('data-ctx');
        openEnergyEditor(ctx, idx);
      });
    });
  }

  function getItemsForContext(ctx) {
    if (ctx === 'overview') { return state.overview.items; }
    if (ctx === 'room')     { return activeRoomItems(); }
    return [];
  }

  function reorderItem(ctx, idx, delta) {
    var items = getItemsForContext(ctx);
    var newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= items.length) { return; }
    var tmp = items[idx]; items[idx] = items[newIdx]; items[newIdx] = tmp;
    refreshItemsList(ctx);
  }

  function removeItem(ctx, idx) {
    var items = getItemsForContext(ctx);
    items.splice(idx, 1);
    refreshItemsList(ctx);
    renderEntityList(); // refresh tick marks
  }

  function refreshItemsList(ctx) {
    if (ctx === 'overview') { renderOverviewItems(); }
    else if (ctx === 'room') { renderRoomItemsList(); }
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  function renderRoomsList() {
    var container = qs('rooms-list');
    if (!container) { return; }

    if (state.rooms.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No rooms configured. Add a room or import from HA Areas.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < state.rooms.length; i++) {
      var room = state.rooms[i];
      var entityCount = (room.items || []).filter(function (it) { return it.type === 'entity'; }).length;
      html += '<div class="room-row" data-id="' + esc(room.id) + '">';
      html += '<div class="room-row-info">';
      html += '<span class="room-row-icon">' + getRoomEmoji(room.icon) + '</span>';
      html += '<div>';
      html += '<div class="room-row-title">' + esc(room.title) + '</div>';
      html += '<div class="room-row-meta">' + entityCount + ' entit' + (entityCount === 1 ? 'y' : 'ies') + '</div>';
      html += '</div></div>';
      html += '<div class="room-row-actions">';
      html += '<label class="toggle-wrap" title="' + (room.hidden ? 'Hidden' : 'Visible') + '">';
      html += '<input type="checkbox" class="room-visible-toggle" data-id="' + esc(room.id) + '"' + (room.hidden ? '' : ' checked') + '>';
      html += '<span class="toggle-slider"></span>';
      html += '</label>';
      if (i > 0) {
        html += '<button class="reorder-btn room-reorder-btn" type="button" data-action="up" data-idx="' + i + '">\u2191</button>';
      }
      if (i < state.rooms.length - 1) {
        html += '<button class="reorder-btn room-reorder-btn" type="button" data-action="down" data-idx="' + i + '">\u2193</button>';
      }
      html += '<button class="action-btn-sm room-edit-btn" type="button" data-id="' + esc(room.id) + '">Edit</button>';
      html += '</div>';
      html += '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.room-reorder-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var delta = this.getAttribute('data-action') === 'up' ? -1 : 1;
        var newIdx = idx + delta;
        if (newIdx < 0 || newIdx >= state.rooms.length) { return; }
        var tmp = state.rooms[idx]; state.rooms[idx] = state.rooms[newIdx]; state.rooms[newIdx] = tmp;
        renderRoomsList();
      });
    });

    container.querySelectorAll('.room-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openRoomEditor(this.getAttribute('data-id'));
      });
    });

    container.querySelectorAll('.room-visible-toggle').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var roomId = this.getAttribute('data-id');
        for (var i = 0; i < state.rooms.length; i++) {
          if (state.rooms[i].id === roomId) {
            state.rooms[i].hidden = !this.checked;
            break;
          }
        }
      });
    });
  }

  function getRoomEmoji(icon) {
    var map = {
      home: '\uD83C\uDFE0', living: '\uD83D\uDECB', bedroom: '\uD83D\uDECC',
      kitchen: '\uD83C\uDF73', bathroom: '\uD83D\uDEB0', garden: '\uD83C\uDF3F',
      garage: '\uD83D\uDE97', office: '\uD83D\uDCBB', energy: '\u26A1',
      security: '\uD83D\uDD12', climate: '\uD83C\uDF21', lights: '\uD83D\uDCA1',
    };
    return map[icon] || '\uD83C\uDFE0';
  }

  function addRoom() {
    var newRoom = { id: genId(), title: 'New Room', icon: 'home', hidden: false, items: [] };
    state.rooms.push(newRoom);
    renderRoomsList();
    openRoomEditor(newRoom.id);
  }

  function openRoomEditor(roomId) {
    editingRoomId = roomId;
    var room = activeRoomObj();
    if (!room) { return; }

    var roomsListEl = qs('rooms-list');
    var addWrap = qs('import-areas-btn') && qs('import-areas-btn').parentElement;
    var addRoomBtn = qs('add-room-btn');
    var editor = qs('room-editor');

    if (roomsListEl) { roomsListEl.classList.add('hidden'); }
    if (addWrap) { addWrap.classList.add('hidden'); }
    if (addRoomBtn) { addRoomBtn.classList.add('hidden'); }
    if (editor) { editor.classList.remove('hidden'); }

    // Populate fields
    var titleInput = qs('room-title-input');
    var iconSelect = qs('room-icon-select');
    var editorTitle = qs('room-editor-title');
    if (titleInput) { titleInput.value = room.title; }
    if (iconSelect) { iconSelect.value = room.icon || 'home'; }
    if (editorTitle) { editorTitle.textContent = room.title; }

    renderRoomItemsList();
  }

  function closeRoomEditor() {
    editingRoomId = null;
    var roomsListEl = qs('rooms-list');
    var importBtn = qs('import-areas-btn');
    var addRoomBtn = qs('add-room-btn');
    var editor = qs('room-editor');
    var addWrap = importBtn && importBtn.parentElement;

    if (roomsListEl) { roomsListEl.classList.remove('hidden'); }
    if (addWrap) { addWrap.classList.remove('hidden'); }
    if (addRoomBtn) { addRoomBtn.classList.remove('hidden'); }
    if (editor) { editor.classList.add('hidden'); }
    renderRoomsList();
  }

  function commitRoomTitle() {
    var room = activeRoomObj();
    if (!room) { return; }
    var v = (qs('room-title-input').value || '').trim();
    if (v) {
      room.title = v.slice(0, 64);
      var editorTitle = qs('room-editor-title');
      if (editorTitle) { editorTitle.textContent = room.title; }
    }
  }

  function commitRoomIcon() {
    var room = activeRoomObj();
    if (!room) { return; }
    room.icon = (qs('room-icon-select') && qs('room-icon-select').value) || 'home';
  }

  function deleteRoom() {
    if (!editingRoomId) { return; }
    state.rooms = state.rooms.filter(function (r) { return r.id !== editingRoomId; });
    closeRoomEditor();
  }

  function renderRoomItemsList() {
    var container = qs('room-items-list');
    var countEl = qs('room-items-count');
    if (!container) { return; }
    var items = activeRoomItems();
    if (countEl) { countEl.textContent = String(items.length); }
    renderItemsList(container, items, 'room');
  }

  function importHaAreas() {
    var btn = qs('import-areas-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading\u2026'; }

    cfgFetchHaAreas()
      .then(function (areas) {
        // For each area not already present, add it as a room
        var added = 0;
        for (var i = 0; i < areas.length; i++) {
          var area = areas[i];
          var exists = false;
          for (var j = 0; j < state.rooms.length; j++) {
            if (state.rooms[j].id === area.id) { exists = true; break; }
          }
          if (!exists) {
            state.rooms.push({
              id: area.id,
              title: area.name || area.id,
              icon: guessRoomIcon(area.id, area.name),
              hidden: false,
              items: [], // entities are intentionally NOT auto-imported — user decides
            });
            added++;
          }
        }
        if (btn) { btn.disabled = false; btn.textContent = '\u21BB Import from HA Areas'; }
        renderRoomsList();
        if (added === 0) {
          showFeedback('All HA areas already imported.', false);
        } else {
          showFeedback('Imported ' + added + ' area' + (added > 1 ? 's' : '') + '. Open each room to add entities.', false);
        }
      })
      .catch(function (err) {
        if (btn) { btn.disabled = false; btn.textContent = '\u21BB Import from HA Areas'; }
        showFeedback('Failed to load HA areas: ' + err.message, true);
      });
  }

  function importRoomDevices() {
    var room = activeRoomObj();
    if (!room) { return; }
    var btn = qs('room-import-devices-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Loading\u2026'; }

    cfgFetchHaAreas()
      .then(function (areas) {
        var area = null;
        for (var i = 0; i < areas.length; i++) {
          if (areas[i].id === room.id) { area = areas[i]; break; }
        }
        if (!btn) { return; }
        btn.disabled = false;
        btn.textContent = '\u21BB Import from area';

        if (!area || !area.entity_ids || area.entity_ids.length === 0) {
          showFeedback('No devices found for this area in HA.', false);
          return;
        }

        var added = 0;
        for (var j = 0; j < area.entity_ids.length; j++) {
          var eid = area.entity_ids[j];
          var exists = false;
          for (var k = 0; k < room.items.length; k++) {
            if (room.items[k].type === 'entity' && room.items[k].entity_id === eid) {
              exists = true; break;
            }
          }
          if (!exists) {
            room.items.push({ type: 'entity', entity_id: eid, label: '', icon: '', hidden: false });
            added++;
          }
        }
        renderRoomItemsList();
        showFeedback(added > 0 ? 'Imported ' + added + ' device' + (added > 1 ? 's' : '') + '.' : 'All devices already imported.', false);
      })
      .catch(function (err) {
        if (btn) { btn.disabled = false; btn.textContent = '\u21BB Import from area'; }
        showFeedback('Error: ' + err.message, true);
      });
  }

  function guessRoomIcon(id, name) {
    var s = ((id || '') + ' ' + (name || '')).toLowerCase();
    if (/bedr|camera|letto/.test(s))   { return 'bedroom'; }
    if (/living|soggiorno|salotto/.test(s)) { return 'living'; }
    if (/kitch|cucina/.test(s))        { return 'kitchen'; }
    if (/bath|bagno/.test(s))          { return 'bathroom'; }
    if (/garden|giardino/.test(s))     { return 'garden'; }
    if (/garage|box/.test(s))          { return 'garage'; }
    if (/office|studio/.test(s))       { return 'office'; }
    if (/energy|ener/.test(s))         { return 'energy'; }
    if (/secur|alarm|allarme/.test(s)) { return 'security'; }
    return 'home';
  }

  // ── Scenarios ──────────────────────────────────────────────────────────────

  function renderScenariosList() {
    var container = qs('scenarios-list');
    if (!container) { return; }

    if (state.scenarios.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No scenarios. Click "+ Add Scenario" to choose scenes or scripts from HA.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < state.scenarios.length; i++) {
      var sc = state.scenarios[i];
      html += '<div class="selected-row">';
      html += '<span class="scenario-row-icon">' + esc(sc.icon) + '</span>';
      html += '<div class="scenario-row-info">';
      html += '<span class="scenario-row-title">' + esc(sc.title) + '</span>';
      html += '<span class="scenario-row-id">' + esc(sc.entity_id) + '</span>';
      html += '</div>';
      html += '<div class="selected-actions">';
      if (i > 0) {
        html += '<button class="reorder-btn" type="button" data-action="up" data-idx="' + i + '">\u2191</button>';
      }
      if (i < state.scenarios.length - 1) {
        html += '<button class="reorder-btn" type="button" data-action="down" data-idx="' + i + '">\u2193</button>';
      }
      html += '<button class="remove-btn sc-remove-btn" type="button" data-idx="' + i + '">\u2715</button>';
      html += '</div>';
      html += '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.reorder-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var delta = this.getAttribute('data-action') === 'up' ? -1 : 1;
        var newIdx = idx + delta;
        if (newIdx < 0 || newIdx >= state.scenarios.length) { return; }
        var tmp = state.scenarios[idx]; state.scenarios[idx] = state.scenarios[newIdx]; state.scenarios[newIdx] = tmp;
        renderScenariosList();
      });
    });

    container.querySelectorAll('.sc-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.scenarios.splice(parseInt(this.getAttribute('data-idx'), 10), 1);
        renderScenariosList();
      });
    });
  }

  function openScenarioPicker() {
    scenarioSearchText = '';
    var searchEl = qs('scenario-search-input');
    if (searchEl) { searchEl.value = ''; }
    showOverlay('scenario-picker');
    renderScenarioPickerList();
    if (searchEl) { setTimeout(function () { searchEl.focus(); }, 100); }
  }

  function renderScenarioPickerList() {
    var container = qs('scenario-list');
    if (!container) { return; }

    if (allScenarios.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">Loading scenes and scripts\u2026</p>';
      return;
    }

    var filtered = allScenarios.filter(function (e) {
      if (!scenarioSearchText) { return true; }
      var hay = (e.entity_id + ' ' + (e.friendly_name || '')).toLowerCase();
      return hay.indexOf(scenarioSearchText) !== -1;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No results.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var e = filtered[i];
      var already = false;
      for (var j = 0; j < state.scenarios.length; j++) {
        if (state.scenarios[j].entity_id === e.entity_id) { already = true; break; }
      }
      html += '<div class="entity-row' + (already ? ' entity-row--selected' : '') + '">';
      html += '<span class="entity-domain">' + esc(e.domain) + '</span>';
      html += '<span class="entity-info">';
      html += '<span class="entity-name">' + esc(e.friendly_name || e.entity_id) + '</span>';
      html += '<span class="entity-id-label">' + esc(e.entity_id) + '</span>';
      html += '</span>';
      if (already) {
        html += '<span class="entity-check">&#10003;</span>';
      } else {
        html += '<button class="add-btn sc-pick-btn" type="button"'
          + ' data-id="' + esc(e.entity_id) + '"'
          + ' data-name="' + esc(e.friendly_name || '') + '">+</button>';
      }
      html += '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.sc-pick-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var eid = this.getAttribute('data-id');
        var name = this.getAttribute('data-name');
        state.scenarios.push({
          entity_id: eid,
          title: name || eid.split('.')[1] || eid,
          icon: eid.startsWith('scene.') ? '\uD83C\uDF1F' : '\uD83C\uDFAD',
        });
        renderScenarioPickerList();
        renderScenariosList();
      });
    });
  }

  // ── Header sensors ─────────────────────────────────────────────────────────

  var MAX_HEADER_SENSORS = 4;

  function renderHeaderSensorsList() {
    var container = qs('header-sensors-list');
    var addBtn = qs('add-header-sensor-btn');
    if (!container) { return; }

    if (addBtn) {
      addBtn.disabled = state.header_sensors.length >= MAX_HEADER_SENSORS;
    }

    if (state.header_sensors.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No header sensors. Add up to ' + MAX_HEADER_SENSORS + '.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < state.header_sensors.length; i++) {
      var hs = state.header_sensors[i];
      html += '<div class="hs-row">';
      html += '<div class="hs-main">';
      html += '<span class="hs-entity-id">' + esc(hs.entity_id) + '</span>';
      html += '</div>';
      html += '<div class="hs-fields">';
      html += '<input type="text" class="hs-icon-input field-input-sm" placeholder="icon (emoji)" maxlength="8"'
        + ' data-idx="' + i + '"'
        + ' value="' + esc(hs.icon) + '">';
      html += '<input type="text" class="hs-label-input field-input-sm" placeholder="label (optional)" maxlength="32"'
        + ' data-idx="' + i + '"'
        + ' value="' + esc(hs.label) + '">';
      html += '<button class="remove-btn hs-remove-btn" type="button" data-idx="' + i + '">\u2715</button>';
      html += '</div>';
      html += '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.hs-icon-input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        if (state.header_sensors[idx]) { state.header_sensors[idx].icon = this.value; }
      });
    });

    container.querySelectorAll('.hs-label-input').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        if (state.header_sensors[idx]) { state.header_sensors[idx].label = this.value; }
      });
    });

    container.querySelectorAll('.hs-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.header_sensors.splice(parseInt(this.getAttribute('data-idx'), 10), 1);
        renderHeaderSensorsList();
      });
    });
  }

  function openHeaderSensorPicker() {
    if (state.header_sensors.length >= MAX_HEADER_SENSORS) { return; }
    sensorPickerTarget = '__header';
    sensorSearchText = '';
    var searchEl = qs('sensor-search-input');
    if (searchEl) { searchEl.value = ''; }
    var titleEl = qs('sensor-picker-title');
    if (titleEl) { titleEl.textContent = 'Add header sensors'; }
    var doneBtn = qs('sensor-picker-done-btn');
    if (doneBtn) { doneBtn.classList.remove('hidden'); }
    showOverlay('sensor-picker');
    renderSensorList();
    if (searchEl) { setTimeout(function () { searchEl.focus(); }, 100); }
  }

  // ── Entity picker ──────────────────────────────────────────────────────────

  function openEntityPicker(context) {
    pickerContext = context;
    searchText = '';
    filterDomain = '';
    var searchEl = qs('search-input');
    if (searchEl) { searchEl.value = ''; }
    var filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-domain') === ''); });
    showOverlay('entity-picker');
    renderEntityList();
    if (searchEl) { setTimeout(function () { searchEl.focus(); }, 100); }
  }

  function isEntityInContext(entityId) {
    var items = contextItems();
    for (var i = 0; i < items.length; i++) {
      if (items[i].type === 'entity' && items[i].entity_id === entityId) { return true; }
    }
    return false;
  }

  function addEntityToContext(entityId, friendlyName) {
    var items = contextItems();
    if (!items) { return; }
    if (isEntityInContext(entityId)) { return; }
    items.push({ type: 'entity', entity_id: entityId, label: friendlyName || '', icon: '' });
    refreshItemsList(pickerContext === 'overview' ? 'overview' : 'room');
    renderEntityList();
  }

  function renderEntityList() {
    var container = qs('entity-list');
    if (!container) { return; }

    var filtered = allEntities.filter(function (e) {
      if (filterDomain && e.domain !== filterDomain) { return false; }
      if (searchText) {
        var hay = (e.entity_id + ' ' + (e.friendly_name || '')).toLowerCase();
        if (hay.indexOf(searchText) === -1) { return false; }
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No entities found.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var e = filtered[i];
      var sel = isEntityInContext(e.entity_id);
      html += '<div class="entity-row' + (sel ? ' entity-row--selected' : '') + '">';
      html += '<span class="entity-domain">' + esc(e.domain) + '</span>';
      html += '<span class="entity-info">';
      html += '<span class="entity-name">' + esc(e.friendly_name || e.entity_id) + '</span>';
      html += '<span class="entity-id-label">' + esc(e.entity_id) + '</span>';
      html += '</span>';
      if (sel) {
        html += '<span class="entity-check">&#10003;</span>';
      } else {
        html += '<button class="add-btn" type="button"'
          + ' data-id="' + esc(e.entity_id) + '"'
          + ' data-name="' + esc(e.friendly_name || '') + '">+</button>';
      }
      html += '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.add-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        addEntityToContext(this.getAttribute('data-id'), this.getAttribute('data-name'));
      });
    });
  }

  // ── Sensor picker ──────────────────────────────────────────────────────────

  function openSensorPicker(targetId) {
    sensorPickerTarget = targetId;
    sensorSearchText = '';
    var searchEl = qs('sensor-search-input');
    if (searchEl) { searchEl.value = ''; }
    var titleEl = qs('sensor-picker-title');
    if (titleEl) {
      var FIELD_LABELS = {
        'ef-solar': 'Solar production', 'ef-batt-soc': 'Battery SOC',
        'ef-batt-pwr': 'Battery power', 'ef-grid': 'Grid power', 'ef-home': 'Home consumption',
      };
      var baseId = targetId.replace('__wizard', '');
      titleEl.textContent = 'Select: ' + (FIELD_LABELS[baseId] || targetId);
    }
    showOverlay('sensor-picker');
    renderSensorList();
    if (searchEl) { setTimeout(function () { searchEl.focus(); }, 100); }
  }

  function renderSensorList() {
    var container = qs('sensor-list');
    if (!container) { return; }

    if (allSensors.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">Loading sensors\u2026</p>';
      return;
    }

    var filtered = allSensors.filter(function (e) {
      if (!sensorSearchText) { return true; }
      var hay = (e.entity_id + ' ' + (e.friendly_name || '') + ' ' + (e.device_class || '')).toLowerCase();
      return hay.indexOf(sensorSearchText) !== -1;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No sensors found.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var e = filtered[i];
      var meta = '';
      if (e.device_class) { meta += e.device_class; }
      if (e.unit)         { meta += (meta ? ' \u00B7 ' : '') + e.unit; }

      // Check if already in header sensors (for multi-select mode)
      var alreadyAdded = false;
      if (sensorPickerTarget === '__header') {
        for (var k = 0; k < state.header_sensors.length; k++) {
          if (state.header_sensors[k].entity_id === e.entity_id) { alreadyAdded = true; break; }
        }
      }

      html += '<div class="entity-row' + (alreadyAdded ? ' entity-row--selected' : '') + '">';
      html += '<span class="entity-info">';
      html += '<span class="entity-name">' + esc(e.friendly_name || e.entity_id) + '</span>';
      html += '<span class="entity-id-label">' + esc(e.entity_id);
      if (meta) { html += ' <em class="entity-meta">(' + esc(meta) + ')</em>'; }
      html += '</span></span>';
      if (alreadyAdded) {
        html += '<span class="entity-check">&#10003;</span>';
      } else {
        html += '<button class="add-btn sensor-pick-select" type="button" data-id="' + esc(e.entity_id) + '" data-name="' + esc(e.friendly_name || '') + '">+</button>';
      }
      html += '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.sensor-pick-select').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pickSensor(this.getAttribute('data-id'), this.getAttribute('data-name'));
      });
    });
  }

  function pickSensor(entityId) {
    if (!sensorPickerTarget) { return; }
    var target = sensorPickerTarget;
    sensorPickerTarget = null;

    if (target === '__header') {
      // Multi-select: add without closing
      var alreadyInHeader = false;
      for (var i = 0; i < state.header_sensors.length; i++) {
        if (state.header_sensors[i].entity_id === entityId) { alreadyInHeader = true; break; }
      }
      if (!alreadyInHeader && state.header_sensors.length < MAX_HEADER_SENSORS) {
        var friendlyName = '';
        for (var j = 0; j < allSensors.length; j++) {
          if (allSensors[j].entity_id === entityId) { friendlyName = allSensors[j].friendly_name || ''; break; }
        }
        state.header_sensors.push({ entity_id: entityId, icon: '', label: friendlyName });
        renderHeaderSensorsList();
        // Re-render list to show checkmark; restore target for next pick
        sensorPickerTarget = '__header';
        renderSensorList();
      }
      return;  // stay open — Done button closes
    }

    // Wizard mode
    var wizardSuffix = '__wizard';
    if (target.length > wizardSuffix.length &&
        target.slice(-wizardSuffix.length) === wizardSuffix) {
      var fieldId = target.slice(0, -wizardSuffix.length);
      wizardValues[fieldId] = entityId;
      var inp = qs(fieldId);
      if (inp) { inp.value = entityId; }
      hideOverlay();
      showOverlay('energy-editor');
      renderWizardStep(wizardStep);
      return;
    }

    // Legacy direct input
    var input = qs(target);
    if (input) { input.value = entityId; }
    hideOverlay();
    showOverlay('energy-editor');
  }

  // ── Energy card wizard ─────────────────────────────────────────────────────

  var WIZARD_STEPS = [
    { field: 'ef-solar', title: 'Step 1 of 5 \u2014 Solar Production', icon: '\u2600',
      description: 'Select the sensor measuring solar panel power output (Watts).\n\nExamples:\n\u2022 sensor.solar_power\n\u2022 sensor.pv_power\n\u2022 sensor.zcs_azzurro_power_pv\n\nTip: search \u201cpv\u201d or \u201csolar\u201d.',
      placeholder: 'sensor.solar_power' },
    { field: 'ef-batt-soc', title: 'Step 2 of 5 \u2014 Battery State of Charge', icon: '\uD83D\uDD0B',
      description: 'Select the sensor showing battery charge level (0\u2013100%).\n\nExamples:\n\u2022 sensor.battery_soc\n\u2022 sensor.bms_state_of_charge\n\u2022 sensor.zcs_azzurro_battery_soc\n\nTip: search \u201csoc\u201d.',
      placeholder: 'sensor.battery_soc' },
    { field: 'ef-batt-pwr', title: 'Step 3 of 5 \u2014 Battery Power', icon: '\u26A1',
      description: 'Select the battery charge/discharge power sensor (Watts).\n\nConvention:\n\u2022 Positive (+W) = charging\n\u2022 Negative (\u2212W) = discharging\n\nExamples:\n\u2022 sensor.battery_power\n\u2022 sensor.zcs_azzurro_battery_power',
      placeholder: 'sensor.battery_power' },
    { field: 'ef-grid', title: 'Step 4 of 5 \u2014 Grid Power', icon: '\uD83C\uDFED',
      description: 'Select the grid exchange power sensor (Watts).\n\nConvention:\n\u2022 Positive (+W) = importing from grid\n\u2022 Negative (\u2212W) = exporting to grid\n\nExamples:\n\u2022 sensor.grid_power\n\u2022 sensor.zcs_azzurro_power_grid',
      placeholder: 'sensor.grid_power' },
    { field: 'ef-home', title: 'Step 5 of 5 \u2014 Home Consumption', icon: '\uD83C\uDFE0',
      description: 'Select the total home power consumption sensor (Watts).\n\nExamples:\n\u2022 sensor.home_consumption\n\u2022 sensor.house_load\n\u2022 sensor.zcs_azzurro_power_load\n\nTip: search \u201cload\u201d or \u201cconsumption\u201d.',
      placeholder: 'sensor.home_consumption' },
  ];

  function openEnergyEditor(ctx, itemIdx) {
    energyContext = ctx;
    energyItemIdx = (itemIdx !== undefined && itemIdx !== null) ? itemIdx : null;

    var items = getItemsForContext(ctx);
    var existingItem = (energyItemIdx !== null && items) ? items[energyItemIdx] : null;

    wizardValues = {
      'ef-solar':    (existingItem && existingItem.solar_power)   || '',
      'ef-batt-soc': (existingItem && existingItem.battery_soc)   || '',
      'ef-batt-pwr': (existingItem && existingItem.battery_power) || '',
      'ef-grid':     (existingItem && existingItem.grid_power)    || '',
      'ef-home':     (existingItem && existingItem.home_power)    || '',
    };

    // Sync to legacy inputs
    for (var f in wizardValues) {
      var inp = qs(f);
      if (inp) { inp.value = wizardValues[f]; }
    }

    wizardStep = 0;
    showOverlay('energy-editor');
    renderWizardStep(0);
  }

  function renderWizardStep(step) {
    var stepDef = WIZARD_STEPS[step];
    var body = qs('energy-wizard-body');
    if (!body || !stepDef) { return; }

    var currentVal = wizardValues[stepDef.field] || '';
    var html = '<div class="wizard-step-card">';
    html += '<div class="wizard-step-icon">' + stepDef.icon + '</div>';
    html += '<h3 class="wizard-step-title">' + esc(stepDef.title) + '</h3>';
    html += '<p class="wizard-step-desc">' + esc(stepDef.description).replace(/\n/g, '<br>') + '</p>';
    html += '<div class="wizard-field-row">';
    html += '<div class="wizard-selected-label">';
    if (currentVal) {
      html += '<span class="wizard-selected-value">&#10003; ' + esc(currentVal) + '</span>';
    } else {
      html += '<span class="wizard-selected-empty">No sensor selected (optional)</span>';
    }
    html += '</div>';
    if (currentVal) {
      html += '<button class="clear-sensor-btn" type="button" id="wizard-clear-btn">&#10005;</button>';
    }
    html += '</div>';
    html += '<button class="action-btn" type="button" id="wizard-pick-btn" style="width:100%;margin-top:10px;">&#128269; Search and select sensor</button>';
    html += '</div>';
    body.innerHTML = html;

    var pickBtn = document.getElementById('wizard-pick-btn');
    if (pickBtn) {
      pickBtn.addEventListener('click', function () {
        openSensorPicker(stepDef.field + '__wizard');
      });
    }

    var clearBtn = document.getElementById('wizard-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        wizardValues[stepDef.field] = '';
        var inp = qs(stepDef.field);
        if (inp) { inp.value = ''; }
        renderWizardStep(step);
      });
    }

    // Step indicators
    var indicators = document.querySelectorAll('.wizard-step');
    for (var i = 0; i < indicators.length; i++) {
      var s = indicators[i];
      s.classList.remove('active', 'done');
      var sIdx = parseInt(s.getAttribute('data-step'), 10);
      if (sIdx < step) { s.classList.add('done'); }
      else if (sIdx === step) { s.classList.add('active'); }
    }

    // Nav buttons
    var prevBtn = qs('energy-prev-btn');
    var nextBtn = qs('energy-next-btn');
    var finishBtn = qs('energy-finish-btn');
    if (prevBtn) { step > 0 ? prevBtn.classList.remove('hidden') : prevBtn.classList.add('hidden'); }
    if (nextBtn) { step < WIZARD_STEPS.length - 1 ? nextBtn.classList.remove('hidden') : nextBtn.classList.add('hidden'); }
    if (finishBtn) { step === WIZARD_STEPS.length - 1 ? finishBtn.classList.remove('hidden') : finishBtn.classList.add('hidden'); }
  }

  function commitEnergyCard() {
    for (var f in wizardValues) {
      var inp = qs(f);
      if (inp) { inp.value = wizardValues[f]; }
    }

    var efItem = {
      type: 'energy_flow',
      solar_power:   wizardValues['ef-solar']   || '',
      battery_soc:   wizardValues['ef-batt-soc'] || '',
      battery_power: wizardValues['ef-batt-pwr'] || '',
      grid_power:    wizardValues['ef-grid']    || '',
      home_power:    wizardValues['ef-home']    || '',
    };

    var items = getItemsForContext(energyContext);
    if (energyItemIdx !== null && items) {
      items[energyItemIdx] = efItem;
    } else if (items) {
      items.push(efItem);
    }

    hideOverlay();
    refreshItemsList(energyContext === 'overview' ? 'overview' : 'room');
  }

  // ── Overlay management ─────────────────────────────────────────────────────

  var OVERLAYS = ['entity-picker', 'sensor-picker', 'scenario-picker', 'energy-editor'];

  function showOverlay(id) {
    for (var i = 0; i < OVERLAYS.length; i++) {
      var el = qs(OVERLAYS[i]);
      if (el) { el.classList.toggle('hidden', OVERLAYS[i] !== id); }
    }
  }

  function hideOverlay() {
    for (var i = 0; i < OVERLAYS.length; i++) {
      var el = qs(OVERLAYS[i]);
      if (el) { el.classList.add('hidden'); }
    }
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  function save() {
    // Commit any in-progress room edits
    if (editingRoomId) { commitRoomTitle(); commitRoomIcon(); }

    var btn = qs('save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving\u2026';

    cfgSaveV3(state)
      .then(function () {
        btn.textContent = 'Saved!';
        setTimeout(function () { window.location.href = './'; }, 800);
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Save';
        showFeedback(err.message || 'Save failed', true);
      });
  }

  function showFeedback(msg, isError) {
    var fb = qs('save-feedback');
    if (!fb) { return; }
    fb.textContent = isError ? 'Error: ' + msg : msg;
    fb.style.backgroundColor = isError ? '' : 'var(--color-on)';
    fb.className = '';
    setTimeout(function () { fb.className = 'hidden'; fb.style.backgroundColor = ''; }, 4000);
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    // Load sensors (async, independent)
    cfgFetchSensors()
      .then(function (s) { allSensors = s || []; })
      .catch(function (e) { console.warn('[config] sensors:', e.message); });

    // Load scenarios (async, independent)
    cfgFetchScenarios()
      .then(function (s) { allScenarios = s || []; })
      .catch(function (e) { console.warn('[config] scenarios:', e.message); });

    // Load config + entity list
    Promise.all([cfgFetchPanelConfig(), cfgFetchEntities()])
      .then(function (results) {
        var cfg = results[0];
        var entities = results[1];

        document.body.className = 'theme-' + (cfg.theme || 'dark');

        // Populate state from v3 config
        var ovRaw = cfg.overview || {};
        state.overview = {
          title: ovRaw.title || 'Overview',
          items: ovRaw.items || [],
        };
        state.rooms           = (cfg.rooms || []).map(function (r) {
          return {
            id:     r.id    || genId(),
            title:  r.title || 'Room',
            icon:   r.icon  || 'home',
            hidden: !!r.hidden,
            items:  (r.items || []).map(function (it) {
              return Object.assign({}, it, { hidden: !!it.hidden });
            }),
          };
        });
        state.scenarios       = cfg.scenarios       || [];
        state.header_sensors  = cfg.header_sensors  || [];

        allEntities = entities || [];

        // Populate overview title input
        var ovTitleInput = qs('overview-title-input');
        if (ovTitleInput) { ovTitleInput.value = state.overview.title; }

        renderOverviewItems();
        renderRoomsList();
        renderScenariosList();
        renderHeaderSensorsList();
      })
      .catch(function (err) {
        var el = qs('entity-list');
        if (el) { el.innerHTML = '<p class="cfg-error">Failed to load: ' + esc(err.message) + '</p>'; }
      });

    // ── Tab buttons ────────────────────────────────────────────────────────
    document.querySelectorAll('.cfg-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchTab(this.getAttribute('data-tab'));
      });
    });

    // ── Overview title ─────────────────────────────────────────────────────
    var ovTitleInput = qs('overview-title-input');
    if (ovTitleInput) {
      ovTitleInput.addEventListener('input', function () {
        state.overview.title = this.value.trim() || 'Overview';
      });
    }

    // ── Overview buttons ───────────────────────────────────────────────────
    var ovAddEntityBtn = qs('ov-add-entity-btn');
    if (ovAddEntityBtn) { ovAddEntityBtn.addEventListener('click', function () { openEntityPicker('overview'); }); }

    var ovAddEnergyBtn = qs('ov-add-energy-btn');
    if (ovAddEnergyBtn) { ovAddEnergyBtn.addEventListener('click', function () { openEnergyEditor('overview', null); }); }

    // ── Rooms buttons ──────────────────────────────────────────────────────
    var addRoomBtn = qs('add-room-btn');
    if (addRoomBtn) { addRoomBtn.addEventListener('click', addRoom); }

    var importAreasBtn = qs('import-areas-btn');
    if (importAreasBtn) { importAreasBtn.addEventListener('click', importHaAreas); }

    var roomEditorBackBtn = qs('room-editor-back-btn');
    if (roomEditorBackBtn) { roomEditorBackBtn.addEventListener('click', function () {
      commitRoomTitle(); commitRoomIcon(); closeRoomEditor();
    }); }

    var roomTitleInput = qs('room-title-input');
    if (roomTitleInput) {
      roomTitleInput.addEventListener('blur', commitRoomTitle);
      roomTitleInput.addEventListener('keydown', function (e) { if (e.keyCode === 13) { this.blur(); } });
    }

    var roomIconSelect = qs('room-icon-select');
    if (roomIconSelect) { roomIconSelect.addEventListener('change', commitRoomIcon); }

    var roomAddEntityBtn = qs('room-add-entity-btn');
    if (roomAddEntityBtn) { roomAddEntityBtn.addEventListener('click', function () { openEntityPicker('room'); }); }

    var roomImportDevicesBtn = qs('room-import-devices-btn');
    if (roomImportDevicesBtn) { roomImportDevicesBtn.addEventListener('click', importRoomDevices); }

    var deleteRoomBtn = qs('delete-room-btn');
    if (deleteRoomBtn) { deleteRoomBtn.addEventListener('click', deleteRoom); }

    // ── Scenarios buttons ──────────────────────────────────────────────────
    var addScenarioBtn = qs('add-scenario-btn');
    if (addScenarioBtn) { addScenarioBtn.addEventListener('click', openScenarioPicker); }

    // ── Header sensor buttons ──────────────────────────────────────────────
    var addHeaderBtn = qs('add-header-sensor-btn');
    if (addHeaderBtn) { addHeaderBtn.addEventListener('click', openHeaderSensorPicker); }

    // ── Entity picker controls ─────────────────────────────────────────────
    var pickerCancelBtn = qs('picker-cancel-btn');
    if (pickerCancelBtn) { pickerCancelBtn.addEventListener('click', hideOverlay); }

    var pickerDoneBtn = qs('picker-done-btn');
    if (pickerDoneBtn) { pickerDoneBtn.addEventListener('click', hideOverlay); }

    var searchEl = qs('search-input');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        searchText = this.value.toLowerCase();
        renderEntityList();
      });
    }

    document.querySelectorAll('.filter-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterDomain = this.getAttribute('data-domain');
        document.querySelectorAll('.filter-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
        renderEntityList();
      });
    });

    // ── Sensor picker controls ─────────────────────────────────────────────
    var sensorCancelBtn = qs('sensor-picker-cancel-btn');
    if (sensorCancelBtn) { sensorCancelBtn.addEventListener('click', function () {
      sensorPickerTarget = null;
      var doneBtn = qs('sensor-picker-done-btn');
      if (doneBtn) { doneBtn.classList.add('hidden'); }
      hideOverlay();
    }); }

    var sensorDoneBtn = qs('sensor-picker-done-btn');
    if (sensorDoneBtn) { sensorDoneBtn.addEventListener('click', function () {
      sensorPickerTarget = null;
      this.classList.add('hidden');
      hideOverlay();
    }); }

    var sensorSearchEl = qs('sensor-search-input');
    if (sensorSearchEl) {
      sensorSearchEl.addEventListener('input', function () {
        sensorSearchText = this.value.toLowerCase();
        renderSensorList();
      });
    }

    // ── Scenario picker controls ───────────────────────────────────────────
    var scCancelBtn = qs('scenario-picker-cancel-btn');
    if (scCancelBtn) { scCancelBtn.addEventListener('click', hideOverlay); }

    var scSearchEl = qs('scenario-search-input');
    if (scSearchEl) {
      scSearchEl.addEventListener('input', function () {
        scenarioSearchText = this.value.toLowerCase();
        renderScenarioPickerList();
      });
    }

    // ── Energy wizard controls ─────────────────────────────────────────────
    var energyCancelBtn = qs('energy-cancel-btn');
    if (energyCancelBtn) { energyCancelBtn.addEventListener('click', hideOverlay); }

    var energyPrevBtn = qs('energy-prev-btn');
    if (energyPrevBtn) {
      energyPrevBtn.addEventListener('click', function () {
        if (wizardStep > 0) { wizardStep--; renderWizardStep(wizardStep); }
      });
    }

    var energyNextBtn = qs('energy-next-btn');
    if (energyNextBtn) {
      energyNextBtn.addEventListener('click', function () {
        if (wizardStep < WIZARD_STEPS.length - 1) { wizardStep++; renderWizardStep(wizardStep); }
      });
    }

    var energyFinishBtn = qs('energy-finish-btn');
    if (energyFinishBtn) { energyFinishBtn.addEventListener('click', commitEnergyCard); }

    // ── Save ───────────────────────────────────────────────────────────────
    var saveBtn = qs('save-btn');
    if (saveBtn) { saveBtn.addEventListener('click', save); }
  }

  document.addEventListener('DOMContentLoaded', init);
}());
