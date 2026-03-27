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

  // v4 data model
  var state = {
    overview:       { items: [] },
    rooms:          [],           // [{id, title, icon, hidden, sections:[{id, title, items:[]}]}]
    scenarios:      [],           // [{entity_id, title, icon}]
    header_sensors: [],           // [{entity_id, icon, label}]
    cameras:        [],           // [{entity_id, title, refresh_interval}]
  };

  var allEntities  = [];   // from /api/entities
  var allSensors   = [];   // from /api/entities?domain=sensor
  var allScenarios = [];   // scenes + scripts
  var haAreaMap    = {};   // area_id -> [entity_id, ...] from /api/ha-areas

  // Entity picker state
  var pickerContext   = null;  // 'overview' | 'room' | 'header'
  var filterDomain    = '';
  var searchText      = '';
  var sensorPickerTarget = null;
  var sensorSearchText   = '';
  var scenarioSearchText = '';

  // Room editor state
  var editingRoomId = null;
  var editingSectionId = null;  // id of the section currently shown in the right panel

  // Energy wizard state
  var energyContext = null;   // 'overview' | 'room'
  var energyItemIdx = null;   // index in the target items array (null = new)
  var wizardStep    = 0;
  var wizardValues  = { 'ef-solar': '', 'ef-batt-soc': '', 'ef-batt-pwr': '', 'ef-grid': '', 'ef-home': '' };

  // Active config tab
  var activeTab = 'overview';

  // ── Visual type data ───────────────────────────────────────────────────────

  var VISUAL_OPTIONS = {
    sensor: [
      { v: 'sensor_temperature', l: 'Temperatura' },
      { v: 'sensor_humidity',    l: 'Umidità' },
      { v: 'sensor_co2',         l: 'CO\u2082' },
      { v: 'sensor_battery',     l: 'Batteria' },
      { v: 'sensor_energy',      l: 'Consumo' },
    ],
    binary_sensor: [
      { v: 'binary_door',      l: 'Porta' },
      { v: 'binary_window',    l: 'Finestra' },
      { v: 'binary_motion',    l: 'Movimento' },
      { v: 'binary_presence',  l: 'Presenza' },
      { v: 'binary_standard',  l: 'Standard' },
    ],
    light: [
      { v: 'light_standard', l: 'Luce standard' },
      { v: 'light_dimmer',   l: 'Luce dimmer' },
      { v: 'light_rgb',      l: 'Luce RGB' },
    ],
  };

  function _getVisualTypeLabel(vt, domain) {
    var LABELS = {
      sensor_temperature: 'Temperatura',
      sensor_humidity:    'Umidità',
      sensor_co2:         'CO\u2082',
      sensor_battery:     'Batteria',
      sensor_energy:      'Consumo',
      binary_door:        'Porta',
      binary_window:      'Finestra',
      binary_motion:      'Movimento',
      binary_presence:    'Presenza',
      binary_standard:    'Standard',
      light_standard:     'Standard',
      light_dimmer:       'Dimmer',
      light_rgb:          'RGB',
    };
    return LABELS[vt] || 'Tipo visivo';
  }

  // ── Visual type picker state ────────────────────────────────────────────────

  var _vtPickerIdx = -1;
  var _vtPickerCtx = '';
  var _vtPickerBtn = null;

  function _openVisualTypePicker(idx, ctx, domain, triggerBtn) {
    _vtPickerIdx = idx;
    _vtPickerCtx = ctx;
    _vtPickerBtn = triggerBtn;

    var items = getItemsForContext(ctx);
    var currentVt = (items[idx] && items[idx].visual_type) || '';
    var opts = VISUAL_OPTIONS[domain] || [];
    var listEl = document.getElementById('visual-type-options');
    if (!listEl) { return; }

    var html = '';
    for (var oi = 0; oi < opts.length; oi++) {
      var opt = opts[oi];
      var isSelected = (opt.v === currentVt);
      html += '<button class="visual-type-option' + (isSelected ? ' selected' : '') + '" type="button" data-vt="' + esc(opt.v) + '">';
      html += '<span class="visual-type-option-label">' + esc(opt.l) + '</span>';
      if (isSelected) { html += '<span class="visual-type-check">&#10003;</span>'; }
      html += '</button>';
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.visual-type-option').forEach(function (optBtn) {
      optBtn.addEventListener('click', function () {
        var vt = this.getAttribute('data-vt');
        var items2 = getItemsForContext(_vtPickerCtx);
        if (items2[_vtPickerIdx]) {
          items2[_vtPickerIdx].visual_type = vt;
          items2[_vtPickerIdx].display_mode = 'auto';
        }
        if (_vtPickerBtn) {
          var labelEl = _vtPickerBtn.querySelector('.item-visual-label');
          if (labelEl) {
            var domain2 = _vtPickerBtn.getAttribute('data-domain');
            labelEl.textContent = _getVisualTypeLabel(vt, domain2);
          }
        }
        _closeVisualTypePicker();
      });
    });

    var overlay = document.getElementById('visual-type-picker');
    if (overlay) { overlay.classList.remove('hidden'); }
  }

  function _closeVisualTypePicker() {
    var overlay = document.getElementById('visual-type-picker');
    if (overlay) { overlay.classList.add('hidden'); }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function qs(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function genId() { return 'room_' + Math.random().toString(36).slice(2, 9); }

  function genSecId() { return 'sec_' + Math.random().toString(36).slice(2, 9); }

  function activeRoomItems() {
    var room = activeRoomObj();
    if (!room) { return []; }
    var sections = room.sections || [];
    if (editingSectionId) {
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].id === editingSectionId) { return sections[i].items; }
      }
    }
    if (sections.length > 0) { return sections[0].items; }
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
    if (pickerContext === 'section')  { return activeRoomItems(); }
    return [];
  }

  // ── Tab navigation ─────────────────────────────────────────────────────────

  function switchTab(tabId) {
    activeTab = tabId;

    var tabs = document.querySelectorAll('.cfg-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabId);
    }

    var sections = ['overview', 'rooms', 'scenarios', 'header', 'cameras'];
    for (var j = 0; j < sections.length; j++) {
      var el = qs('tab-' + sections[j]);
      if (el) { el.classList.toggle('hidden', sections[j] !== tabId); }
    }

    // Refresh cameras list when switching to that tab
    if (tabId === 'cameras') { renderCamerasList(); }

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

    container.innerHTML = items.map((item, i) => {
      const isHidden = !!item.hidden;
      if (item.type === 'energy_flow') {
        return `<div class="selected-row" data-idx="${i}" data-ctx="${esc(context)}">
          <span class="item-drag-handle">&#9776;</span>
          <span class="selected-id selected-id-energy">&#9889; Power Flow Card</span>
          <div class="selected-actions">
            <button class="edit-energy-btn action-btn-sm" type="button" data-idx="${i}" data-ctx="${esc(context)}">Edit</button>
            <button class="remove-btn" type="button" data-idx="${i}" data-ctx="${esc(context)}">&#10005;</button>
          </div>
        </div>`;
      }
      const domain = item.entity_id ? item.entity_id.split('.')[0] : '';
      const showVisualBtn = domain === 'sensor' || domain === 'binary_sensor' || domain === 'light';
      const vtLabel = showVisualBtn ? _getVisualTypeLabel(item.visual_type || '', domain) : '';
      return `<div class="selected-row${isHidden ? ' selected-row--hidden' : ''}" data-idx="${i}" data-ctx="${esc(context)}">
        <span class="item-drag-handle">&#9776;</span>
        <div class="selected-entity-info">
          <span class="selected-id">${esc(item.entity_id)}</span>
          <input type="text" class="item-label-input" placeholder="Display name\u2026" value="${esc(item.label || '')}" data-idx="${i}" data-ctx="${esc(context)}">
          ${showVisualBtn ? `<button class="item-visual-btn" type="button" data-idx="${i}" data-ctx="${esc(context)}" data-domain="${esc(domain)}">
            <span class="item-visual-icon">&#9681;</span>
            <span class="item-visual-label">${esc(vtLabel)}</span>
          </button>` : ''}
        </div>
        <div class="selected-actions">
          <label class="toggle-wrap" title="${isHidden ? 'Hidden' : 'Visible'}">
            <input type="checkbox" class="item-visible-toggle" data-idx="${i}" data-ctx="${esc(context)}"${isHidden ? '' : ' checked'}>
            <span class="toggle-slider"></span>
          </label>
          <button class="remove-btn" type="button" data-idx="${i}" data-ctx="${esc(context)}">&#10005;</button>
        </div>
      </div>`;
    }).join('');

    initItemDragDrop(container, context, items);

    container.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => removeItem(btn.getAttribute('data-ctx'), parseInt(btn.getAttribute('data-idx'), 10)));
    });

    container.querySelectorAll('.item-visible-toggle').forEach(cb => {
      cb.addEventListener('change', () => {
        const its = getItemsForContext(cb.getAttribute('data-ctx'));
        const idx = parseInt(cb.getAttribute('data-idx'), 10);
        if (its[idx]) { its[idx].hidden = !cb.checked; refreshItemsList(cb.getAttribute('data-ctx')); }
      });
    });

    container.querySelectorAll('.edit-energy-btn').forEach(btn => {
      btn.addEventListener('click', () => openEnergyEditor(btn.getAttribute('data-ctx'), parseInt(btn.getAttribute('data-idx'), 10)));
    });

    container.querySelectorAll('.item-label-input').forEach(input => {
      input.addEventListener('change', () => {
        const its = getItemsForContext(input.getAttribute('data-ctx'));
        const idx = parseInt(input.getAttribute('data-idx'), 10);
        if (its[idx]) { its[idx].label = input.value.trim(); }
      });
    });

    container.querySelectorAll('.item-visual-btn').forEach(btn => {
      btn.addEventListener('click', () => _openVisualTypePicker(
        parseInt(btn.getAttribute('data-idx'), 10), btn.getAttribute('data-ctx'), btn.getAttribute('data-domain'), btn
      ));
    });
  }

  function initItemDragDrop(container, ctx, items) {
    let dragIdx = -1;
    let ghostEl = null;
    let startY = 0;
    let rowEls = [];
    let rowRects = [];
    let crossSecTarget = null;

    const sectionsCol = ctx === 'section' ? qs('room-sections-list') : null;
    const getSectionRows = () => sectionsCol ? [...sectionsCol.querySelectorAll('.section-row')] : [];

    const calcTargetIdx = (dy) => {
      const ghostCenter = rowRects[dragIdx].top + dy + rowRects[dragIdx].height / 2;
      return rowRects.reduce((t, rc, i) => ghostCenter > rc.top + rc.height / 2 ? i : t, dragIdx);
    };

    const clearIndicators = () => {
      rowEls.forEach(r => r.classList.remove('selected-row--insert-before', 'selected-row--insert-after'));
      getSectionRows().forEach(r => r.classList.remove('section-row--drop-target'));
      crossSecTarget = null;
    };

    const updateIndicator = (e) => {
      clearIndicators();
      if (sectionsCol) {
        const colRect = sectionsCol.getBoundingClientRect();
        if (e.clientX >= colRect.left && e.clientX <= colRect.right &&
            e.clientY >= colRect.top  && e.clientY <= colRect.bottom) {
          for (const sr of getSectionRows()) {
            const rc = sr.getBoundingClientRect();
            if (e.clientY >= rc.top && e.clientY <= rc.bottom) {
              if (sr.getAttribute('data-id') !== editingSectionId) {
                sr.classList.add('section-row--drop-target');
                crossSecTarget = sr;
              }
              break;
            }
          }
          return;
        }
      }
      // Within-list indicator
      const tIdx = calcTargetIdx(e.clientY - startY);
      if (tIdx < dragIdx) { rowEls[tIdx]?.classList.add('selected-row--insert-before'); }
      else if (tIdx > dragIdx) { rowEls[tIdx]?.classList.add('selected-row--insert-after'); }
    };

    const onDragStart = (e, handle) => {
      const row = handle.parentNode;
      rowEls = [...container.querySelectorAll('.selected-row')];
      dragIdx = rowEls.indexOf(row);
      if (dragIdx < 0) { return; }
      startY = e.clientY;
      rowRects = rowEls.map(r => r.getBoundingClientRect());
      const rect = rowRects[dragIdx];
      ghostEl = row.cloneNode(true);
      ghostEl.classList.add('drag-ghost');
      ghostEl.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;z-index:9999;pointer-events:none;`;
      document.body.appendChild(ghostEl);
      row.classList.add('selected-row--dragging');
      e.preventDefault();
    };

    const onDragMove = (e) => {
      if (dragIdx < 0 || !ghostEl) { return; }
      ghostEl.style.top = `${rowRects[dragIdx].top + (e.clientY - startY)}px`;
      updateIndicator(e);
    };

    const onDragEnd = (e) => {
      if (dragIdx < 0) { return; }
      const targetSecId = crossSecTarget?.getAttribute('data-id') ?? null;
      const targetIdx = calcTargetIdx(e.clientY - startY);

      rowEls.forEach(r => r.classList.remove('selected-row--dragging', 'selected-row--insert-before', 'selected-row--insert-after'));
      getSectionRows().forEach(r => r.classList.remove('section-row--drop-target'));
      ghostEl?.remove();
      ghostEl = null;
      const fromIdx = dragIdx;
      dragIdx = -1;
      crossSecTarget = null;

      if (targetSecId) {
        const [moved] = items.splice(fromIdx, 1);
        const targetSec = activeRoomSections().find(s => s.id === targetSecId);
        if (targetSec) {
          targetSec.items.push(moved);
          selectSection(targetSecId);
        } else {
          items.splice(fromIdx, 0, moved); // rollback
        }
      } else if (targetIdx !== fromIdx) {
        const [moved] = items.splice(fromIdx, 1);
        items.splice(targetIdx, 0, moved);
        refreshItemsList(ctx);
      }
    };

    container.querySelectorAll('.item-drag-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        onDragStart(e, handle);
        const onMove = (e) => onDragMove(e);
        const onUp   = (e) => { onDragEnd(e); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  function getItemsForContext(ctx) {
    if (ctx === 'overview') { return state.overview.items; }
    if (ctx === 'section')  { return activeRoomItems(); }
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
    else if (ctx === 'section') { renderSectionItemsList(); }
  }

  // ── Rooms ──────────────────────────────────────────────────────────────────

  function renderRoomsList() {
    const container = qs('rooms-list');
    if (!container) { return; }

    if (state.rooms.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No rooms configured. Add a room or import from HA Areas.</p>';
      return;
    }

    container.innerHTML = state.rooms.map((room) => {
      const entityCount = (room.sections || [])
        .flatMap(s => s.items || [])
        .filter(it => it.type === 'entity').length;
      const countLabel = `${entityCount} entit${entityCount === 1 ? 'y' : 'ies'}`;
      const visibleAttr = room.hidden ? '' : ' checked';
      return `
        <div class="room-row" data-id="${esc(room.id)}">
          <span class="room-drag-handle">&#9776;</span>
          <div class="room-row-info">
            <span class="room-row-icon">${getRoomEmoji(room.icon)}</span>
            <div>
              <div class="room-row-title">${esc(room.title)}</div>
              <div class="room-row-meta">${countLabel}</div>
            </div>
          </div>
          <div class="room-row-actions">
            <label class="toggle-wrap" title="${room.hidden ? 'Hidden' : 'Visible'}">
              <input type="checkbox" class="room-visible-toggle" data-id="${esc(room.id)}"${visibleAttr}>
              <span class="toggle-slider"></span>
            </label>
            <button class="action-btn-sm room-edit-btn" type="button" data-id="${esc(room.id)}">Edit</button>
          </div>
        </div>`.trim();
    }).join('');

    initRoomDragDrop(container);

    container.querySelectorAll('.room-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => openRoomEditor(btn.getAttribute('data-id')));
    });

    container.querySelectorAll('.room-visible-toggle').forEach(cb => {
      cb.addEventListener('change', () => {
        const room = state.rooms.find(r => r.id === cb.getAttribute('data-id'));
        if (room) { room.hidden = !cb.checked; }
      });
    });
  }

  function initRoomDragDrop(container) {
    let dragIdx = -1;
    let ghostEl = null;
    let startY = 0;
    let rowEls = [];
    let rowRects = [];

    const calcTargetIdx = (dy) => {
      const ghostCenter = rowRects[dragIdx].top + dy + rowRects[dragIdx].height / 2;
      return rowRects.reduce((target, rc, i) =>
        ghostCenter > rc.top + rc.height / 2 ? i : target, dragIdx);
    };

    const updateIndicator = (targetIdx) => {
      rowEls.forEach(r => r.classList.remove('room-row--insert-before', 'room-row--insert-after'));
      if (targetIdx === dragIdx) { return; }
      rowEls[targetIdx].classList.add(targetIdx < dragIdx ? 'room-row--insert-before' : 'room-row--insert-after');
    };

    const onDragStart = (e, handle) => {
      const row = handle.parentNode;
      rowEls = [...container.querySelectorAll('.room-row')];
      dragIdx = rowEls.indexOf(row);
      if (dragIdx < 0) { return; }
      startY = e.clientY;
      rowRects = rowEls.map(r => r.getBoundingClientRect());
      const rect = rowRects[dragIdx];
      ghostEl = row.cloneNode(true);
      ghostEl.className = 'room-row drag-ghost';
      ghostEl.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;z-index:9999;pointer-events:none;`;
      document.body.appendChild(ghostEl);
      row.classList.add('room-row--dragging');
      e.preventDefault();
    };

    const onDragMove = (e) => {
      if (dragIdx < 0 || !ghostEl) { return; }
      e.preventDefault();
      const dy = e.clientY - startY;
      ghostEl.style.top = `${rowRects[dragIdx].top + dy}px`;
      updateIndicator(calcTargetIdx(dy));
    };

    const onDragEnd = (e) => {
      if (dragIdx < 0) { return; }
      const targetIdx = calcTargetIdx(e.clientY - startY);
      rowEls.forEach(r => r.classList.remove('room-row--dragging', 'room-row--insert-before', 'room-row--insert-after'));
      ghostEl?.remove();
      ghostEl = null;
      const fromIdx = dragIdx;
      dragIdx = -1;
      if (targetIdx !== fromIdx) {
        const [moved] = state.rooms.splice(fromIdx, 1);
        state.rooms.splice(targetIdx, 0, moved);
        renderRoomsList();
      }
    };

    container.querySelectorAll('.room-drag-handle').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        onDragStart(e, handle);
        const onMove = (e) => onDragMove(e);
        const onUp = (e) => { onDragEnd(e); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  var ROOM_MDI_MAP = {
    home: 'home', living: 'sofa', bedroom: 'bed',
    kitchen: 'stove', bathroom: 'shower', garden: 'tree',
    garage: 'garage', office: 'laptop', energy: 'lightning-bolt',
    security: 'shield-home', climate: 'thermometer', lights: 'lightbulb',
    dining: 'silverware-fork-knife', laundry: 'washing-machine', balcony: 'floor-plan',
    gym: 'dumbbell', attic: 'warehouse', entry: 'door',
    server: 'desktop-tower', kids: 'toy-brick',
  };

  var ROOM_LABELS = {
    home: 'Home', living: 'Living', bedroom: 'Bedroom', kids: 'Kids',
    kitchen: 'Kitchen', dining: 'Dining', bathroom: 'Bath', laundry: 'Laundry',
    garden: 'Garden', balcony: 'Balcony', garage: 'Garage', entry: 'Entry',
    office: 'Office', gym: 'Gym', attic: 'Attic', server: 'Server',
    energy: 'Energy', security: 'Security', climate: 'Climate', lights: 'Lights',
  };

  function getRoomEmoji(icon) {
    var mdiName = ROOM_MDI_MAP[icon] || 'home';
    return window.RP_MDI ? window.RP_MDI(mdiName, 20) : (icon || '\uD83C\uDFE0');
  }

  function updateIconPreview(iconKey) {
    var preview = qs('room-icon-preview');
    var nameEl = qs('room-icon-name');
    var mdiName = ROOM_MDI_MAP[iconKey] || 'home';
    if (preview && window.RP_MDI) { preview.innerHTML = window.RP_MDI(mdiName, 22); }
    if (nameEl) { nameEl.textContent = ROOM_LABELS[iconKey] || iconKey; }
  }

  function openIconPicker() {
    var dropdown = qs('icon-dropdown');
    var chevron  = qs('room-icon-chevron');
    if (!dropdown) { return; }

    // Toggle: close if already open
    if (!dropdown.classList.contains('hidden')) {
      dropdown.classList.add('hidden');
      if (chevron) { chevron.classList.remove('icon-picker-chevron--open'); }
      return;
    }

    // Build list
    var room = activeRoomObj();
    var currentIcon = (room && room.icon) || 'home';
    var html = '';
    var keys = Object.keys(ROOM_MDI_MAP);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var mdiName = ROOM_MDI_MAP[key];
      var label = ROOM_LABELS[key] || key;
      var isSel = key === currentIcon;
      html += '<div class="icon-dropdown-item' + (isSel ? ' icon-dropdown-item--selected' : '') + '" data-icon="' + key + '">';
      html += '<span class="icon-dropdown-item-icon">' + (window.RP_MDI ? window.RP_MDI(mdiName, 22) : '') + '</span>';
      html += '<span class="icon-dropdown-item-label">' + esc(label) + '</span>';
      if (isSel) { html += '<span class="icon-dropdown-check">&#10003;</span>'; }
      html += '</div>';
    }
    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
    if (chevron) { chevron.classList.add('icon-picker-chevron--open'); }

    // Scroll selected item into view
    var selItem = dropdown.querySelector('.icon-dropdown-item--selected');
    if (selItem) { selItem.scrollIntoView({ block: 'nearest' }); }

    dropdown.querySelectorAll('.icon-dropdown-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var iconKey = this.getAttribute('data-icon');
        var r = activeRoomObj();
        if (r) { r.icon = iconKey; }
        var iconValue = qs('room-icon-value');
        if (iconValue) { iconValue.value = iconKey; }
        updateIconPreview(iconKey);
        renderRoomsList();
        dropdown.classList.add('hidden');
        if (chevron) { chevron.classList.remove('icon-picker-chevron--open'); }
      });
    });
  }

  function addRoom() {
    var newRoom = { id: genId(), title: 'New Room', icon: 'home', hidden: false, sections: [] };
    state.rooms.push(newRoom);
    renderRoomsList();
    openRoomEditor(newRoom.id);
  }

  function openRoomEditor(roomId) {
    editingRoomId = roomId;
    editingSectionId = null;
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
    var iconValue = qs('room-icon-value');
    var editorTitle = qs('room-editor-title');
    if (titleInput) { titleInput.value = room.title; }
    if (iconValue) { iconValue.value = room.icon || 'home'; }
    if (editorTitle) { editorTitle.textContent = room.title; }
    updateIconPreview(room.icon || 'home');

    // Initialize sections — migrate legacy items[] if needed
    if (!room.sections) { room.sections = []; }
    if (room.sections.length === 0 && room.items && room.items.length > 0) {
      room.sections.push({ id: genSecId(), title: '', items: room.items });
      delete room.items;
    }
    // Auto-select first section
    if (room.sections.length > 0) { editingSectionId = room.sections[0].id; }
    renderSectionsList();
    renderSectionDetail();
  }

  function closeRoomEditor() {
    editingRoomId = null;
    editingSectionId = null;
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

  // ── Section CRUD ───────────────────────────────────────────────────────────

  function activeRoomSections() {
    var room = activeRoomObj();
    if (!room) { return []; }
    if (!room.sections) { room.sections = []; }
    return room.sections;
  }

  function addSection() {
    var sections = activeRoomSections();
    var n = sections.length + 1;
    var sec = { id: genSecId(), title: 'Section ' + n, items: [] };
    sections.push(sec);
    renderSectionsList();
    selectSection(sec.id);
  }

  function deleteSection(secId) {
    var room = activeRoomObj();
    if (!room) { return; }
    room.sections = (room.sections || []).filter(function (s) { return s.id !== secId; });
    if (editingSectionId === secId) {
      editingSectionId = room.sections.length > 0 ? room.sections[0].id : null;
    }
    renderSectionsList();
    renderSectionDetail();
  }

  function reorderSection(secId, delta) {
    const sections = activeRoomSections();
    const idx = sections.findIndex(s => s.id === secId);
    if (idx < 0) { return; }
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= sections.length) { return; }
    [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
    renderSectionsList();
  }

  function selectSection(secId) {
    editingSectionId = secId;
    renderSectionsList();
    renderSectionDetail();
  }

  function commitSectionTitle(secId, newTitle) {
    const sec = activeRoomSections().find(s => s.id === secId);
    if (sec) { sec.title = (newTitle || '').trim().slice(0, 64); }
    renderSectionsList();
  }

  function renderSectionsList() {
    const container = qs('room-sections-list');
    if (!container) { return; }
    const sections = activeRoomSections();

    if (sections.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No sections. Click &ldquo;+ Add&rdquo;.</p>';
      return;
    }

    container.innerHTML = sections.map(sec => {
      const isActive = sec.id === editingSectionId;
      const count = (sec.items || []).filter(it => it.type === 'entity').length;
      return `
        <div class="section-row${isActive ? ' section-row--active' : ''}" data-id="${esc(sec.id)}">
          <span class="section-row-drag">&#9776;</span>
          <div class="section-row-info">
            <span class="section-row-title">${esc(sec.title || 'Unnamed')}</span>
            <span class="section-row-count">${count} entit${count === 1 ? 'y' : 'ies'}</span>
          </div>
          <div class="section-row-actions">
            <button class="remove-btn sec-del-btn" type="button" data-id="${esc(sec.id)}">&#10005;</button>
          </div>
        </div>`.trim();
    }).join('');

    initSectionDragDrop(container);

    container.querySelectorAll('.section-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') { return; }
        selectSection(row.getAttribute('data-id'));
      });
    });

    container.querySelectorAll('.sec-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSection(btn.getAttribute('data-id'));
      });
    });

    renderRoomPreview();
  }

  function initSectionDragDrop(container) {
    let dragIdx = -1;
    let ghostEl = null;
    let startY = 0;
    let rowEls = [];
    let rowRects = [];

    const calcTargetIdx = (dy) => {
      const ghostCenter = rowRects[dragIdx].top + dy + rowRects[dragIdx].height / 2;
      return rowRects.reduce((target, rc, i) =>
        ghostCenter > rc.top + rc.height / 2 ? i : target, dragIdx);
    };

    const updateIndicator = (targetIdx) => {
      rowEls.forEach(r => r.classList.remove('section-row--insert-before', 'section-row--insert-after'));
      if (targetIdx === dragIdx) { return; }
      rowEls[targetIdx].classList.add(targetIdx < dragIdx ? 'section-row--insert-before' : 'section-row--insert-after');
    };

    const onDragStart = (e, handle) => {
      const row = handle.parentNode;
      rowEls = [...container.querySelectorAll('.section-row')];
      dragIdx = rowEls.indexOf(row);
      if (dragIdx < 0) { return; }
      startY = e.clientY;
      rowRects = rowEls.map(r => r.getBoundingClientRect());
      const rect = rowRects[dragIdx];
      ghostEl = row.cloneNode(true);
      ghostEl.className = 'section-row drag-ghost';
      ghostEl.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;z-index:9999;pointer-events:none;`;
      document.body.appendChild(ghostEl);
      row.classList.add('section-row--dragging');
      e.preventDefault();
    };

    const onDragMove = (e) => {
      if (dragIdx < 0 || !ghostEl) { return; }
      const dy = e.clientY - startY;
      ghostEl.style.top = `${rowRects[dragIdx].top + dy}px`;
      updateIndicator(calcTargetIdx(dy));
    };

    const onDragEnd = (e) => {
      if (dragIdx < 0) { return; }
      const targetIdx = calcTargetIdx(e.clientY - startY);
      rowEls.forEach(r => r.classList.remove('section-row--dragging', 'section-row--insert-before', 'section-row--insert-after'));
      ghostEl?.remove();
      ghostEl = null;
      const fromIdx = dragIdx;
      dragIdx = -1;
      if (targetIdx !== fromIdx) {
        const sections = activeRoomSections();
        const [moved] = sections.splice(fromIdx, 1);
        sections.splice(targetIdx, 0, moved);
        renderSectionsList();
      }
    };

    container.querySelectorAll('.section-row-drag').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        onDragStart(e, handle);
        const onMove = (e) => onDragMove(e);
        const onUp = (e) => { onDragEnd(e); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  function renderRoomPreview() {
    const box = qs('room-live-preview');
    if (!box) { return; }
    const room = activeRoomObj();
    if (!room || !(room.sections || []).length) {
      box.innerHTML = '<div class="preview-empty-section">No sections configured.</div>';
      return;
    }
    box.innerHTML = room.sections.map(sec => {
      const entities = (sec.items || []).filter(it => it.type === 'entity');
      const chipsHtml = entities.length === 0
        ? '<div class="preview-empty-section">No entities</div>'
        : `<div class="preview-tiles-row">${entities.map(it => {
            const domain = (it.entity_id || '').split('.')[0];
            return `<div class="preview-tile-chip${it.hidden ? ' hidden' : ''}">
              <span class="chip-domain">${domain}</span>${esc(it.label || it.entity_id)}
            </div>`;
          }).join('')}</div>`;
      return `<div class="preview-room-section">
        <div class="preview-section-title">${esc(sec.title || 'Unnamed')} <span style="opacity:.5">(${entities.length})</span></div>
        ${chipsHtml}
      </div>`;
    }).join('');
  }

  function renderSectionDetail() {
    var placeholder = qs('section-detail-placeholder');
    var content = qs('section-detail-content');

    if (!editingSectionId) {
      if (placeholder) { placeholder.classList.remove('hidden'); }
      if (content) { content.classList.add('hidden'); }
      return;
    }

    var sections = activeRoomSections();
    var sec = null;
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].id === editingSectionId) { sec = sections[i]; break; }
    }
    if (!sec) {
      if (placeholder) { placeholder.classList.remove('hidden'); }
      if (content) { content.classList.add('hidden'); }
      return;
    }

    if (placeholder) { placeholder.classList.add('hidden'); }
    if (content) { content.classList.remove('hidden'); }

    var titleInput = qs('section-title-input');
    if (titleInput) { titleInput.value = sec.title; }

    renderSectionItemsList();
  }

  function renderSectionItemsList() {
    var container = qs('section-items-list');
    var countEl = qs('section-items-count');
    if (!container) { return; }
    var items = activeRoomItems();
    if (countEl) { countEl.textContent = String(items.length); }
    renderItemsList(container, items, 'section');
    renderRoomPreview();
  }

  function commitRoomTitle() {
    var room = activeRoomObj();
    if (!room) { return; }
    var titleInput = qs('room-title-input');
    if (!titleInput) { return; }
    var v = (titleInput.value || '').trim();
    if (v) {
      room.title = v.slice(0, 64);
      var editorTitle = qs('room-editor-title');
      if (editorTitle) { editorTitle.textContent = room.title; }
    }
  }

  function commitRoomIcon() {
    var room = activeRoomObj();
    if (!room) { return; }
    room.icon = (qs('room-icon-value') && qs('room-icon-value').value) || 'home';
  }

  function deleteRoom() {
    if (!editingRoomId) { return; }
    state.rooms = state.rooms.filter(function (r) { return r.id !== editingRoomId; });
    closeRoomEditor();
  }

  function renderRoomItemsList() {
    renderSectionItemsList();
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
              sections: [],
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

        // Get or create the target section (active section or first section)
        if (!room.sections || room.sections.length === 0) {
          room.sections = [{ id: genSecId(), title: '', items: [] }];
        }
        var targetSection = room.sections[0];
        if (editingSectionId) {
          for (var si = 0; si < room.sections.length; si++) {
            if (room.sections[si].id === editingSectionId) { targetSection = room.sections[si]; break; }
          }
        }

        var added = 0;
        for (var j = 0; j < area.entity_ids.length; j++) {
          var eid = area.entity_ids[j];
          var exists = false;
          for (var k = 0; k < targetSection.items.length; k++) {
            if (targetSection.items[k].type === 'entity' && targetSection.items[k].entity_id === eid) {
              exists = true; break;
            }
          }
          if (!exists) {
            var autoLabel = '';
            var autoDc = '';
            for (var m = 0; m < allEntities.length; m++) {
              if (allEntities[m].entity_id === eid) {
                autoLabel = allEntities[m].friendly_name || '';
                autoDc = allEntities[m].device_class || '';
                break;
              }
            }
            targetSection.items.push({ type: 'entity', entity_id: eid, label: autoLabel, icon: '', hidden: false, visual_type: '', device_class: autoDc });
            added++;
          }
        }
        renderSectionsList();
        renderSectionDetail();
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

  // ── Cameras ────────────────────────────────────────────────────────────────

  var allCameras = [];        // entity list from /api/entities?domain=camera
  var cameraSearchText = '';  // filter text in the camera picker

  function renderCamerasList() {
    var container = qs('cameras-list');
    if (!container) { return; }

    if (state.cameras.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">Nessuna telecamera configurata.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < state.cameras.length; i++) {
      var c = state.cameras[i];
      var isFirst = (i === 0);
      var isLast  = (i === state.cameras.length - 1);
      html += '<div class="selected-row">';
      html += '<div class="selected-entity-info">';
      html += '<span class="selected-id">' + esc(c.entity_id) + '</span>';
      html += '<input type="text" class="camera-title-input item-label-input" placeholder="Nome display\u2026" maxlength="64"'
        + ' value="' + esc(c.title || '') + '" data-idx="' + i + '">';
      html += '<div class="camera-refresh-row">';
      html += '<label class="camera-refresh-label">Refresh (sec):</label>';
      html += '<input type="number" class="camera-refresh-input" min="3" max="60"'
        + ' value="' + (c.refresh_interval || 10) + '" data-idx="' + i + '">';
      html += '</div>';
      html += '</div>';
      html += '<div class="selected-actions">';
      if (!isFirst) {
        html += '<button class="reorder-btn" type="button" data-action="cam-up" data-idx="' + i + '">\u2191</button>';
      }
      if (!isLast) {
        html += '<button class="reorder-btn" type="button" data-action="cam-down" data-idx="' + i + '">\u2193</button>';
      }
      html += '<button class="remove-btn cam-remove-btn" type="button" data-cam-idx="' + i + '">\u2715</button>';
      html += '</div>';
      html += '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.camera-title-input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        if (state.cameras[idx]) { state.cameras[idx].title = this.value.trim(); }
      });
    });

    container.querySelectorAll('.camera-refresh-input').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var val = parseInt(this.value, 10);
        if (isNaN(val) || val < 3)  { val = 3; }
        if (val > 60)               { val = 60; }
        this.value = val;
        if (state.cameras[idx]) { state.cameras[idx].refresh_interval = val; }
      });
    });

    container.querySelectorAll('.reorder-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx   = parseInt(this.getAttribute('data-idx'), 10);
        var delta = this.getAttribute('data-action') === 'cam-up' ? -1 : 1;
        var newIdx = idx + delta;
        if (newIdx < 0 || newIdx >= state.cameras.length) { return; }
        var tmp = state.cameras[idx]; state.cameras[idx] = state.cameras[newIdx]; state.cameras[newIdx] = tmp;
        renderCamerasList();
      });
    });

    container.querySelectorAll('.cam-remove-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.cameras.splice(parseInt(this.getAttribute('data-cam-idx'), 10), 1);
        renderCamerasList();
      });
    });
  }

  function openCameraPicker() {
    cameraSearchText = '';
    var searchEl = qs('camera-search-input');
    if (searchEl) { searchEl.value = ''; }
    showOverlay('camera-picker');

    if (allCameras.length > 0) {
      renderCameraPickerList();
    } else {
      var listEl = qs('camera-list');
      if (listEl) { listEl.innerHTML = '<p class="cfg-placeholder">Caricamento telecamere\u2026</p>'; }
      cfgFetchCameras()
        .then(function (cameras) {
          allCameras = cameras || [];
          renderCameraPickerList();
        })
        .catch(function (err) {
          var el = qs('camera-list');
          if (el) { el.innerHTML = '<p class="cfg-placeholder">Errore: ' + esc(err.message) + '</p>'; }
        });
    }

    if (searchEl) { setTimeout(function () { searchEl.focus(); }, 100); }
  }

  function renderCameraPickerList() {
    var container = qs('camera-list');
    if (!container) { return; }

    if (allCameras.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">Nessuna telecamera trovata in HA.</p>';
      return;
    }

    var filtered = allCameras.filter(function (e) {
      if (!cameraSearchText) { return true; }
      var hay = (e.entity_id + ' ' + (e.friendly_name || '')).toLowerCase();
      return hay.indexOf(cameraSearchText) !== -1;
    });

    if (filtered.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">Nessun risultato.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var e = filtered[i];
      var already = false;
      for (var j = 0; j < state.cameras.length; j++) {
        if (state.cameras[j].entity_id === e.entity_id) { already = true; break; }
      }
      html += '<div class="entity-row' + (already ? ' entity-row--selected' : '') + '">';
      html += '<span class="entity-domain">camera</span>';
      html += '<span class="entity-info">';
      html += '<span class="entity-name">' + esc(e.friendly_name || e.entity_id) + '</span>';
      html += '<span class="entity-id-label">' + esc(e.entity_id) + '</span>';
      html += '</span>';
      if (already) {
        html += '<span class="entity-check">&#10003;</span>';
      } else {
        html += '<button class="add-btn cam-pick-btn" type="button"'
          + ' data-id="' + esc(e.entity_id) + '"'
          + ' data-name="' + esc(e.friendly_name || '') + '">+</button>';
      }
      html += '</div>';
    }
    container.innerHTML = html;

    container.querySelectorAll('.cam-pick-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var eid  = this.getAttribute('data-id');
        var name = this.getAttribute('data-name');
        state.cameras.push({
          entity_id:        eid,
          title:            name || eid.split('.')[1] || eid,
          refresh_interval: 10,
        });
        renderCameraPickerList();
        renderCamerasList();
      });
    });
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
    var dc = '';
    for (var i = 0; i < allEntities.length; i++) {
      if (allEntities[i].entity_id === entityId) { dc = allEntities[i].device_class || ''; break; }
    }
    items.push({ type: 'entity', entity_id: entityId, label: friendlyName || '', icon: '', hidden: false, visual_type: '', device_class: dc });
    refreshItemsList(pickerContext === 'overview' ? 'overview' : 'section');
    renderEntityList();
  }

  function renderEntityList() {
    var container = qs('entity-list');
    if (!container) { return; }

    // When editing a room whose id matches an HA area, restrict to that area's entities.
    var areaEntityIds = (pickerContext === 'section' && editingRoomId && haAreaMap[editingRoomId])
      ? haAreaMap[editingRoomId]
      : null;

    var filtered = allEntities.filter(function (e) {
      if (filterDomain && e.domain !== filterDomain) { return false; }
      if (searchText) {
        var hay = (e.entity_id + ' ' + (e.friendly_name || '')).toLowerCase();
        if (hay.indexOf(searchText) === -1) { return false; }
      }
      if (areaEntityIds !== null && areaEntityIds.indexOf(e.entity_id) === -1) { return false; }
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
    refreshItemsList(energyContext === 'overview' ? 'overview' : 'section');
  }

  // ── Overlay management ─────────────────────────────────────────────────────

  var OVERLAYS = ['entity-picker', 'sensor-picker', 'scenario-picker', 'energy-editor', 'camera-picker', 'visual-type-picker'];

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
    if (!btn) { return; }
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
    fb.style.backgroundColor = isError ? '#f44336' : '#4caf50';
    fb.classList.remove('hidden');
    clearTimeout(fb._hideTimer);
    fb._hideTimer = setTimeout(function () {
      fb.classList.add('hidden');
      fb.style.backgroundColor = '';
    }, 4000);
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

    // Load HA areas (async, independent) for entity picker area filtering
    cfgFetchHaAreas()
      .then(function (areas) {
        for (var i = 0; i < areas.length; i++) {
          haAreaMap[areas[i].id] = areas[i].entity_ids || [];
        }
      })
      .catch(function (e) { console.warn('[config] ha-areas:', e.message); });

    // Load saved panel config first (critical — reads local entities.json, works offline)
    cfgFetchPanelConfig()
      .then(function (cfg) {
        document.body.className = 'theme-' + (cfg.theme || 'dark');

        // Populate state from saved config
        var ovRaw = cfg.overview || {};
        state.overview = {
          title: ovRaw.title || 'Overview',
          items: ovRaw.items || [],
        };
        state.rooms = (cfg.rooms || []).map(function (r) {
          var sections;
          if (r.sections && r.sections.length > 0) {
            sections = r.sections.map(function (sec) {
              return {
                id:    sec.id    || genSecId(),
                title: sec.title || '',
                items: (sec.items || []).map(function (it) {
                  var copy = {};
                  for (var k in it) { if (Object.prototype.hasOwnProperty.call(it, k)) { copy[k] = it[k]; } }
                  copy.hidden = !!it.hidden;
                  return copy;
                }),
              };
            });
          } else if (r.items && r.items.length > 0) {
            sections = [{
              id: genSecId(),
              title: '',
              items: (r.items || []).map(function (it) {
                var copy = {};
                for (var k in it) { if (Object.prototype.hasOwnProperty.call(it, k)) { copy[k] = it[k]; } }
                copy.hidden = !!it.hidden;
                return copy;
              }),
            }];
          } else {
            sections = [];
          }
          return {
            id:       r.id    || genId(),
            title:    r.title || 'Room',
            icon:     r.icon  || 'home',
            hidden:   !!r.hidden,
            sections: sections,
          };
        });
        state.scenarios      = cfg.scenarios      || [];
        state.header_sensors = cfg.header_sensors || [];
        state.cameras        = cfg.cameras        || [];

        // Render UI immediately with saved data
        var ovTitleInput = qs('overview-title-input');
        if (ovTitleInput) { ovTitleInput.value = state.overview.title; }
        renderOverviewItems();
        renderRoomsList();
        renderScenariosList();
        renderHeaderSensorsList();
        renderCamerasList();

        // Load live entities from HA separately — non-fatal if HA is offline
        cfgFetchEntities()
          .then(function (entities) { allEntities = entities || []; })
          .catch(function (e) {
            console.warn('[config] entities unavailable (HA offline?):', e.message);
            showFeedback('HA offline — entity picker will be empty', true);
          });
      })
      .catch(function (err) {
        showFeedback('Failed to load config: ' + (err.message || 'Network error'), true);
        var body = qs('cfg-body');
        if (body) {
          body.innerHTML = '<p class="cfg-placeholder" style="padding:40px;text-align:center;">'
            + 'Could not load configuration.<br>Check that Home Assistant is reachable.'
            + '<br><br><small>' + esc(err.message || '') + '</small></p>';
        }
      });

    // ── Tab buttons — inject MDI icons and wire clicks ────────────────────
    var TAB_ICONS = { overview: 'home', rooms: 'floor-plan', scenarios: 'palette', header: 'thermometer', cameras: 'cctv' };
    document.querySelectorAll('.cfg-tab').forEach(function (btn) {
      var tab = btn.getAttribute('data-tab');
      if (window.RP_MDI && TAB_ICONS[tab]) {
        var iconSpan = document.createElement('span');
        iconSpan.className = 'cfg-tab-icon';
        iconSpan.innerHTML = window.RP_MDI(TAB_ICONS[tab], 18);
        btn.insertBefore(iconSpan, btn.firstChild);
      }
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

    var roomIconBtn = qs('room-icon-btn');
    if (roomIconBtn) { roomIconBtn.addEventListener('click', function (e) { e.stopPropagation(); openIconPicker(); }); }

    // Close icon dropdown when clicking outside the picker wrap
    document.addEventListener('click', function (e) {
      var dropdown = qs('icon-dropdown');
      var chevron  = qs('room-icon-chevron');
      if (!dropdown || dropdown.classList.contains('hidden')) { return; }
      var wrap = dropdown.parentElement;
      if (wrap && !wrap.contains(e.target)) {
        dropdown.classList.add('hidden');
        if (chevron) { chevron.classList.remove('icon-picker-chevron--open'); }
      }
    });

    var roomAddEntityBtn = qs('room-add-entity-btn');
    if (roomAddEntityBtn) { roomAddEntityBtn.addEventListener('click', function () { openEntityPicker('section'); }); }

    var addSectionBtn = qs('add-section-btn');
    if (addSectionBtn) { addSectionBtn.addEventListener('click', addSection); }

    var sectionTitleInput = qs('section-title-input');
    if (sectionTitleInput) {
      sectionTitleInput.addEventListener('blur', function () {
        if (editingSectionId) { commitSectionTitle(editingSectionId, this.value); }
      });
      sectionTitleInput.addEventListener('keydown', function (e) {
        if (e.keyCode === 13 && editingSectionId) { commitSectionTitle(editingSectionId, this.value); this.blur(); }
      });
    }

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

    // ── Camera buttons ─────────────────────────────────────────────────────
    var addCameraBtn = qs('add-camera-btn');
    if (addCameraBtn) { addCameraBtn.addEventListener('click', openCameraPicker); }

    var camPickerCancelBtn = qs('camera-picker-cancel-btn');
    if (camPickerCancelBtn) { camPickerCancelBtn.addEventListener('click', hideOverlay); }

    var camSearchEl = qs('camera-search-input');
    if (camSearchEl) {
      camSearchEl.addEventListener('input', function () {
        cameraSearchText = this.value.toLowerCase();
        renderCameraPickerList();
      });
    }

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

    // ── Visual type picker controls ────────────────────────────────────────
    var vtCancel = qs('visual-type-cancel');
    if (vtCancel) { vtCancel.addEventListener('click', _closeVisualTypePicker); }

    // ── Save ───────────────────────────────────────────────────────────────
    var saveBtn = qs('save-btn');
    if (saveBtn) { saveBtn.addEventListener('click', save); }
  }

  document.addEventListener('DOMContentLoaded', init);
}());
