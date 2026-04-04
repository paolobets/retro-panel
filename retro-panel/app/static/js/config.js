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

  // v5 data model
  var state = {
    overview:          { title: 'Overview', icon: 'home', sections: [] },
    rooms:             [],  // [{id, title, icon, hidden, sections:[{id, title, items:[]}]}]
    scenarios:         [],  // list of sections: [{id, title, items:[]}]
    scenarios_section: { title: 'Scenarios', icon: 'palette' },
    header_sensors:    [],  // [{entity_id, icon, label}]
    cameras:           [],  // list of sections: [{id, title, items:[]}]
    cameras_section:   { title: 'Cameras', icon: 'cctv' },
    alarms:           [],  // list: [{id, entity_id, label, sensors:[{entity_id, label, device_class}]}]
    alarms_section:   { title: 'Allarme', icon: 'shield-home' },
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
  var editingSectionId = null;   // id of the section currently shown in the right panel

  // Section editor state for overview / scenarios / cameras
  var editingOvSectionId  = null;   // active section in overview editor
  var editingScSectionId  = null;   // active section in scenarios editor
  var editingCamSectionId = null;   // active section in cameras editor

  var editingAlarmId        = null;   // alarm id whose sensor sub-list is being edited
  var allAlarmEntities      = [];     // alarm_control_panel entity list from HA
  var allBinarySensors      = [];     // binary_sensor entity list from HA
  var alarmEntitySearchText = '';
  var alarmSensorSearchText = '';

  // Energy wizard state
  var energyContext = null;   // 'overview' | 'room'
  var energyItemIdx = null;   // index in the target items array (null = new)
  var wizardStep    = 0;
  var wizardValues  = {
    'ef-solar': '', 'ef-home': '', 'ef-batt-soc': '',
    'ef-batt-charge': '', 'ef-batt-discharge': '',
    'ef-grid-import': '', 'ef-grid-export': ''
  };

  // Active config tab
  var activeTab = 'overview';

  // Dirty flag — tracks unsaved changes
  var _dirty = false;

  function markDirty() {
    if (_dirty) { return; }
    _dirty = true;
    var btn = qs('save-btn');
    if (btn) { btn.classList.add('save-btn--dirty'); }
  }

  function clearDirty() {
    _dirty = false;
    var btn = qs('save-btn');
    if (btn) { btn.classList.remove('save-btn--dirty'); }
  }

  // ── Visual type data ───────────────────────────────────────────────────────

  var VISUAL_OPTIONS = {
    sensor: [
      { v: 'sensor_temperature', l: 'Temperatura' },
      { v: 'sensor_humidity',    l: 'Umidit\u00e0' },
      { v: 'sensor_co2',         l: 'CO\u2082' },
      { v: 'sensor_battery',     l: 'Batteria' },
      { v: 'sensor_energy',      l: 'Consumo' },
      { v: 'sensor_illuminance', l: 'Luminosit\u00e0' },
      { v: 'sensor_pressure',    l: 'Pressione' },
      { v: 'sensor_air_quality', l: 'Qualit\u00e0 aria' },
      { v: 'sensor_electrical', l: 'Elettrico' },
      { v: 'sensor_signal',     l: 'Segnale' },
      { v: 'sensor_gas',        l: 'Gas' },
      { v: 'sensor_speed',      l: 'Velocit\u00e0' },
      { v: 'sensor_water',      l: 'Acqua' },
      { v: 'sensor_ph',         l: 'pH' },
      { v: 'sensor_physical',   l: 'Fisico' },
    ],
    binary_sensor: [
      { v: 'binary_door',      l: 'Porta' },
      { v: 'binary_window',    l: 'Finestra' },
      { v: 'binary_motion',    l: 'Movimento' },
      { v: 'binary_presence',  l: 'Presenza' },
      { v: 'binary_smoke',     l: 'Fumo/Gas' },
      { v: 'binary_moisture',  l: 'Umidità/Perdita' },
      { v: 'binary_lock',      l: 'Serratura' },
      { v: 'binary_vibration', l: 'Vibrazione' },
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
      sensor_humidity:    'Umidit\u00e0',
      sensor_co2:         'CO\u2082',
      sensor_battery:     'Batteria',
      sensor_energy:      'Consumo',
      sensor_illuminance: 'Luminosit\u00e0',
      sensor_pressure:    'Pressione',
      sensor_air_quality: 'Qualit\u00e0 aria',
      sensor_generic:     'Generico',
      sensor_electrical: 'Elettrico',
      sensor_signal:     'Segnale',
      sensor_gas:        'Gas',
      sensor_speed:      'Velocit\u00e0',
      sensor_water:      'Acqua',
      sensor_ph:         'pH',
      sensor_physical:   'Fisico',
      binary_door:        'Porta',
      binary_window:      'Finestra',
      binary_motion:      'Movimento',
      binary_presence:    'Presenza',
      binary_smoke:       'Fumo/Gas',
      binary_moisture:    'Umidità/Perdita',
      binary_lock:        'Serratura',
      binary_vibration:   'Vibrazione',
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

  function cloneItem(it) {
    var copy = {};
    for (var k in it) { if (Object.prototype.hasOwnProperty.call(it, k)) { copy[k] = it[k]; } }
    copy.hidden = !!it.hidden;
    return copy;
  }

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
    if (pickerContext === 'ov-section')  { return activeOvItems(); }
    if (pickerContext === 'section')     { return activeRoomItems(); }
    return [];
  }

  // ── Tab navigation ─────────────────────────────────────────────────────────

  function switchTab(tabId) {
    activeTab = tabId;

    var tabs = document.querySelectorAll('.cfg-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === tabId);
    }

    var sections = ['overview', 'rooms', 'scenarios', 'header', 'cameras', 'alarms'];
    for (var j = 0; j < sections.length; j++) {
      var el = qs('tab-' + sections[j]);
      if (el) { el.classList.toggle('hidden', sections[j] !== tabId); }
    }

    // Refresh relevant section lists when switching tabs
    if (tabId === 'overview')   { renderOvSectionsList();  renderOvSectionDetail(); }
    if (tabId === 'scenarios')  { renderScSectionsList();  renderScSectionDetail(); }
    if (tabId === 'cameras')    { renderCamSectionsList(); renderCamSectionDetail(); }
    if (tabId === 'alarms')     { renderAlarmsList(); }


    // Close room editor when leaving rooms tab
    if (tabId !== 'rooms') { closeRoomEditor(); }
  }

  // ── Overview items ─────────────────────────────────────────────────────────

  function renderOverviewPreview() {
    var box = qs('overview-live-preview');
    if (!box) { return; }
    var sections = activeOvSections();
    if (!sections.length) {
      box.innerHTML = '<p class="preview-empty-section">No sections yet.</p>';
      return;
    }
    box.innerHTML = sections.map(function(sec) {
      var visItems = (sec.items || []).filter(function(it) { return !it.hidden; });
      var headerHtml = sec.title
        ? '<div class="preview-section-title">' + esc(sec.title) + '</div>'
        : '';
      var chipsHtml = visItems.length === 0
        ? '<p class="preview-empty-section">No entities</p>'
        : '<div class="preview-tiles-row">' + visItems.map(function(it) {
            if (it.type === 'energy_flow') {
              return '<div class="preview-tile-chip"><span class="chip-domain">\u26a1</span>Power Flow</div>';
            }
            var domain = it.entity_id ? it.entity_id.split('.')[0] : '';
            return '<div class="preview-tile-chip"><span class="chip-domain">' + esc(domain) + '</span>' + esc(it.label || it.entity_id || '') + '</div>';
          }).join('') + '</div>';
      return '<div class="preview-room-section">' + headerHtml + chipsHtml + '</div>';
    }).join('');
  }

  function renderOvSectionsList() {
    var container = qs('ov-sections-list');
    if (!container) { return; }
    var sections = activeOvSections();
    if (sections.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No sections. Click &ldquo;+ Add&rdquo;.</p>';
      return;
    }
    container.innerHTML = sections.map(function(sec) {
      var isActive = sec.id === editingOvSectionId;
      var count = (sec.items || []).filter(function(it) { return it.type === 'entity'; }).length;
      return '<div class="section-row' + (isActive ? ' section-row--active' : '') + '" data-id="' + esc(sec.id) + '">'
        + '<span class="section-row-drag">&#9776;</span>'
        + '<div class="section-row-info">'
        + '<span class="section-row-title">' + esc(sec.title || 'Unnamed') + '</span>'
        + '<span class="section-row-count">' + count + ' entit' + (count === 1 ? 'y' : 'ies') + '</span>'
        + '</div>'
        + '<div class="section-row-actions">'
        + '<button class="remove-btn ov-sec-del-btn" type="button" data-id="' + esc(sec.id) + '">\u2715</button>'
        + '</div>'
        + '<span class="section-row-chevron">&#8250;</span>'
        + '</div>';
    }).join('');

    initGenericSectionDragDrop(container, activeOvSections, renderOvSectionsList);

    container.querySelectorAll('.section-row').forEach(function(row) {
      row.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') { return; }
        selectOvSection(row.getAttribute('data-id'));
      });
    });
    container.querySelectorAll('.ov-sec-del-btn').forEach(function (btn) {
      initConfirmableBtn(btn, function () {
        deleteOvSection(btn.getAttribute('data-id'));
      });
    });
    renderOverviewPreview();
  }

  function renderOvSectionDetail() {
    var placeholder = qs('ov-section-detail-placeholder');
    var content = qs('ov-section-detail-content');
    if (!editingOvSectionId) {
      if (placeholder) { placeholder.classList.remove('hidden'); }
      if (content) { content.classList.add('hidden'); }
      return;
    }
    var sec = activeOvSectionObj();
    if (!sec) {
      if (placeholder) { placeholder.classList.remove('hidden'); }
      if (content) { content.classList.add('hidden'); }
      return;
    }
    if (placeholder) { placeholder.classList.add('hidden'); }
    if (content) { content.classList.remove('hidden'); }
    var titleInput = qs('ov-section-title-input');
    if (titleInput) { titleInput.value = sec.title; }
    renderOvSectionItemsList();
  }

  function renderOvSectionItemsList() {
    var container = qs('ov-section-items-list');
    var countEl   = qs('ov-section-items-count');
    if (!container) { return; }
    var items = activeOvItems();
    if (countEl) { countEl.textContent = String(items.length); }
    renderItemsList(container, items, 'ov-section');
    renderOverviewPreview();
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
    let onMove = null;
    let onUp = null;

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
      if (tIdx < dragIdx) { if (rowEls[tIdx]) { rowEls[tIdx].classList.add('selected-row--insert-before'); } }
      else if (tIdx > dragIdx) { if (rowEls[tIdx]) { rowEls[tIdx].classList.add('selected-row--insert-after'); } }
    };

    const onDragStart = (e, handle) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
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
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (dragIdx < 0) { return; }
      const targetSecId = (crossSecTarget && crossSecTarget.getAttribute('data-id') !== null && crossSecTarget.getAttribute('data-id') !== undefined ? crossSecTarget.getAttribute('data-id') : null);
      const targetIdx = calcTargetIdx(e.clientY - startY);

      rowEls.forEach(r => r.classList.remove('selected-row--dragging', 'selected-row--insert-before', 'selected-row--insert-after'));
      getSectionRows().forEach(r => r.classList.remove('section-row--drop-target'));
      if (ghostEl) { ghostEl.remove(); }
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
        onMove = (e) => onDragMove(e);
        onUp   = (e) => onDragEnd(e);
        onDragStart(e, handle);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  function getItemsForContext(ctx) {
    if (ctx === 'ov-section')  { return activeOvItems(); }
    if (ctx === 'section')     { return activeRoomItems(); }
    if (ctx === 'sc-section')  { return activeScItems(); }
    if (ctx === 'cam-section') { return activeCamItems(); }
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
    if (ctx === 'ov-section')  { renderOvSectionItemsList(); }
    else if (ctx === 'section') { renderSectionItemsList(); }
    else if (ctx === 'sc-section')  { renderScSectionItemsList(); }
    else if (ctx === 'cam-section') { renderCamSectionItemsList(); }
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
    let onMove = null;
    let onUp = null;

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
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
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
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (dragIdx < 0) { return; }
      const targetIdx = calcTargetIdx(e.clientY - startY);
      rowEls.forEach(r => r.classList.remove('room-row--dragging', 'room-row--insert-before', 'room-row--insert-after'));
      if (ghostEl) { ghostEl.remove(); }
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
        onMove = (e) => onDragMove(e);
        onUp = (e) => onDragEnd(e);
        onDragStart(e, handle);
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
    // Support direct MDI name (new) and legacy semantic key (old)
    var paths = window.RP_MDI_PATHS || {};
    var mdiName = paths[icon] ? icon : (ROOM_MDI_MAP[icon] || 'home');
    return window.RP_MDI ? window.RP_MDI(mdiName, 20) : (icon || '\uD83C\uDFE0');
  }

  function updateIconPreview(iconKey) {
    var preview = qs('room-icon-preview');
    var nameEl = qs('room-icon-name');
    var paths = window.RP_MDI_PATHS || {};
    var mdiName = paths[iconKey] ? iconKey : (ROOM_MDI_MAP[iconKey] || 'home');
    if (preview && window.RP_MDI) { preview.innerHTML = window.RP_MDI(mdiName, 22); }
    if (nameEl) { nameEl.textContent = iconKey; }
  }

  // ── Shared icon picker modal ────────────────────────────────────────────

  var _iconPickerCallback    = null;
  var _iconPickerCurrentIcon = 'home';
  var _iconPickerFiltered    = [];

  // Recently used ──────────────────────────────────────────────────────────
  var _RP_RECENT_KEY  = 'rp_icon_picker_recent';
  var _recentIcons    = [];

  function _loadRecent() {
    try {
      var s = localStorage.getItem(_RP_RECENT_KEY);
      _recentIcons = s ? JSON.parse(s) : [];
      if (!Array.isArray(_recentIcons)) { _recentIcons = []; }
    } catch (e) { _recentIcons = []; }
  }

  function _saveRecent() {
    try { localStorage.setItem(_RP_RECENT_KEY, JSON.stringify(_recentIcons)); } catch (e) {}
  }

  function _addRecent(name) {
    _recentIcons = _recentIcons.filter(function (n) { return n !== name; });
    _recentIcons.unshift(name);
    if (_recentIcons.length > 20) { _recentIcons = _recentIcons.slice(0, 20); }
    _saveRecent();
  }

  function _renderRecentRow() {
    var section = qs('icon-picker-recent-section');
    var row     = qs('icon-picker-recent-row');
    if (!section || !row) { return; }
    if (_recentIcons.length === 0) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    row.innerHTML = _recentIcons.map(function (name) {
      var isSel = name === _iconPickerCurrentIcon;
      return '<div class="icon-recent-item' + (isSel ? ' icon-recent-item--selected' : '')
        + '" data-name="' + name + '">'
        + (window.RP_MDI ? window.RP_MDI(name, 22) : '')
        + '</div>';
    }).join('');
    row.querySelectorAll('.icon-recent-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var name = this.getAttribute('data-name');
        _addRecent(name);
        if (_iconPickerCallback) { _iconPickerCallback(name); }
        hideOverlay();
        _iconPickerCallback = null;
      });
    });
  }

  // Virtual grid ───────────────────────────────────────────────────────────
  var _VIRT_ROW_H  = 82;  // px — icon(26) + label(12) + padding(16) + gap(4) + border/spare(24)
  var _VIRT_BUF    = 2;   // extra rows above/below visible viewport
  var _VIRT_ITEM_W = 84;  // px per slot — CSS minmax(80px,1fr) + gap(4px); matches .icon-grid-inner

  function _renderVisibleRows(grid) {
    if (_iconPickerFiltered.length === 0) { return; }
    var cw    = grid.clientWidth || 320;
    var ipp   = Math.max(1, Math.floor((cw - 24 + 4) / _VIRT_ITEM_W));   // items per row (subtract 24px inner padding)
    var total = Math.ceil(_iconPickerFiltered.length / ipp);         // total rows
    var st    = grid.scrollTop;
    var vh    = grid.clientHeight || 400;

    var first = Math.max(0, Math.floor(st / _VIRT_ROW_H) - _VIRT_BUF);
    var last  = Math.min(total - 1, Math.ceil((st + vh) / _VIRT_ROW_H) + _VIRT_BUF);
    var topH  = first * _VIRT_ROW_H;
    var botH  = Math.max(0, (total - last - 1) * _VIRT_ROW_H);

    var html = '<div style="height:' + topH + 'px" aria-hidden="true"></div>'
      + '<div class="icon-grid-inner">';
    for (var row = first; row <= last; row++) {
      for (var col = 0; col < ipp; col++) {
        var idx = row * ipp + col;
        if (idx >= _iconPickerFiltered.length) { break; }
        var name  = _iconPickerFiltered[idx];
        var isSel = name === _iconPickerCurrentIcon;
        html += '<div class="icon-grid-item' + (isSel ? ' icon-grid-item--selected' : '')
          + '" data-name="' + name + '">'
          + '<span class="icon-grid-icon">' + (window.RP_MDI ? window.RP_MDI(name, 26) : '') + '</span>'
          + '<span class="icon-grid-label">' + name + '</span>'
          + '</div>';
      }
    }
    html += '</div><div style="height:' + botH + 'px" aria-hidden="true"></div>';

    grid.innerHTML = html;
    grid.querySelectorAll('.icon-grid-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var name = this.getAttribute('data-name');
        _addRecent(name);
        if (_iconPickerCallback) { _iconPickerCallback(name); }
        hideOverlay();
        _iconPickerCallback = null;
      });
    });
  }

  function renderIconPickerGrid(query) {
    var grid      = qs('icon-picker-modal-grid');
    var countEl   = qs('icon-picker-count');
    var recentSec = qs('icon-picker-recent-section');
    if (!grid) { return; }
    var names = window.RP_MDI_NAMES || Object.keys(window.RP_MDI_PATHS || {});
    var q     = query.toLowerCase().trim();
    _iconPickerFiltered = q
      ? names.filter(function (n) { return n.indexOf(q) !== -1; })
      : names;

    // Per spec §2.1: hide recently-used row when a search query is active
    if (recentSec) {
      recentSec.classList.toggle('hidden', q.length > 0 || _recentIcons.length === 0);
    }

    if (_iconPickerFiltered.length === 0) {
      grid.innerHTML = '<p class="icon-picker-empty-msg">No icons match your search.</p>';
      if (countEl) { countEl.textContent = ''; }
      return;
    }
    if (countEl) {
      countEl.textContent = q
        ? (_iconPickerFiltered.length + ' result' + (_iconPickerFiltered.length === 1 ? '' : 's'))
        : (names.length.toLocaleString() + ' icons');
    }
    grid.scrollTop = 0;
    _renderVisibleRows(grid);
  }

  function openIconPickerModal(currentIcon, callback) {
    _iconPickerCurrentIcon = currentIcon || 'home';
    _iconPickerCallback    = callback;
    var searchEl = qs('icon-picker-modal-search');
    if (searchEl) { searchEl.value = ''; }
    _loadRecent();
    showOverlay('icon-picker-modal');
    _renderRecentRow();
    renderIconPickerGrid('');
    if (searchEl) { setTimeout(function () { searchEl.focus(); }, 150); }
  }

  // ── Section icon previews (overview / scenarios / cameras) ────────────────

  function updateSectionIconPreview(section, iconName) {
    var preview = qs(section + '-icon-preview');
    var nameEl  = qs(section + '-icon-name');
    var hidden  = qs(section + '-icon-value');
    if (preview && window.RP_MDI) { preview.innerHTML = window.RP_MDI(iconName, 22); }
    if (nameEl)  { nameEl.textContent = iconName; }
    if (hidden)  { hidden.value = iconName; }
  }

  function openIconPicker() {
    var room = activeRoomObj();
    var currentIcon = (room && room.icon) || 'home';
    openIconPickerModal(currentIcon, function (iconName) {
      markDirty();
      var r = activeRoomObj();
      if (r) { r.icon = iconName; }
      var iconValue = qs('room-icon-value');
      if (iconValue) { iconValue.value = iconName; }
      updateIconPreview(iconName);
      renderRoomsList();
    });
  }

  function addRoom() {
    markDirty();
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

    var listView = qs('rooms-list-view');
    var editor = qs('room-editor');

    if (listView) { listView.classList.add('hidden'); }
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
    var listView = qs('rooms-list-view');
    var editor = qs('room-editor');

    if (listView) { listView.classList.remove('hidden'); }
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

  // ── Overview section accessors ─────────────────────────────────────────────

  function activeOvSections() { return state.overview.sections || []; }
  function activeOvSectionObj() {
    var secs = activeOvSections();
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].id === editingOvSectionId) { return secs[i]; }
    }
    return null;
  }
  function activeOvItems() {
    var sec = activeOvSectionObj();
    return sec ? (sec.items || []) : [];
  }
  function selectOvSection(id) {
    editingOvSectionId = id;
    renderOvSectionsList();
    renderOvSectionDetail();
  }

  // ── Scenarios section accessors ────────────────────────────────────────────

  function activeScSections() { return state.scenarios || []; }
  function activeScSectionObj() {
    var secs = activeScSections();
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].id === editingScSectionId) { return secs[i]; }
    }
    return null;
  }
  function activeScItems() {
    var sec = activeScSectionObj();
    return sec ? (sec.items || []) : [];
  }
  function selectScSection(id) {
    editingScSectionId = id;
    renderScSectionsList();
    renderScSectionDetail();
  }

  // ── Cameras section accessors ──────────────────────────────────────────────

  function activeCamSections() { return state.cameras || []; }
  function activeCamSectionObj() {
    var secs = activeCamSections();
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].id === editingCamSectionId) { return secs[i]; }
    }
    return null;
  }
  function activeCamItems() {
    var sec = activeCamSectionObj();
    return sec ? (sec.items || []) : [];
  }
  function selectCamSection(id) {
    editingCamSectionId = id;
    renderCamSectionsList();
    renderCamSectionDetail();
  }

  function addSection() {
    markDirty();
    var sections = activeRoomSections();
    var n = sections.length + 1;
    var sec = { id: genSecId(), title: 'Section ' + n, items: [] };
    sections.push(sec);
    renderSectionsList();
    selectSection(sec.id);
  }

  function initConfirmableBtn(btn, onConfirm) {
    var timer = null;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (btn.getAttribute('data-confirm') === '1') {
        clearTimeout(timer);
        btn.removeAttribute('data-confirm');
        btn.textContent = '\u2715';
        btn.classList.remove('sec-del-btn--confirm');
        onConfirm();
      } else {
        btn.setAttribute('data-confirm', '1');
        btn.textContent = 'Sure?';
        btn.classList.add('sec-del-btn--confirm');
        timer = setTimeout(function () {
          btn.removeAttribute('data-confirm');
          btn.textContent = '\u2715';
          btn.classList.remove('sec-del-btn--confirm');
        }, 2000);
      }
    });
  }

  function deleteSection(secId) {
    markDirty();
    var room = activeRoomObj();
    if (!room) { return; }
    room.sections = (room.sections || []).filter(function (s) { return s.id !== secId; });
    if (editingSectionId === secId) {
      editingSectionId = room.sections.length > 0 ? room.sections[0].id : null;
    }
    renderSectionsList();
    renderSectionDetail();
  }

  function deleteOvSection(id) {
    markDirty();
    var secs = activeOvSections();
    for (var i = 0; i < secs.length; i++) { if (secs[i].id === id) { secs.splice(i, 1); break; } }
    if (editingOvSectionId === id) { editingOvSectionId = null; }
    renderOvSectionsList();
    renderOvSectionDetail();
    renderOverviewPreview();
  }

  function deleteScSection(id) {
    markDirty();
    var secs = activeScSections();
    for (var i = 0; i < secs.length; i++) { if (secs[i].id === id) { secs.splice(i, 1); break; } }
    if (editingScSectionId === id) { editingScSectionId = null; }
    renderScSectionsList();
    renderScSectionDetail();
    renderScenariosPreview();
  }

  function deleteCamSection(id) {
    markDirty();
    var secs = activeCamSections();
    for (var i = 0; i < secs.length; i++) { if (secs[i].id === id) { secs.splice(i, 1); break; } }
    if (editingCamSectionId === id) { editingCamSectionId = null; }
    renderCamSectionsList();
    renderCamSectionDetail();
    renderCamerasPreview();
  }

  function reorderSection(secId, delta) {
    markDirty();
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
    markDirty();
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
          <span class="section-row-chevron">&#8250;</span>
        </div>`.trim();
    }).join('');

    initSectionDragDrop(container);

    container.querySelectorAll('.section-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') { return; }
        selectSection(row.getAttribute('data-id'));
      });
    });

    container.querySelectorAll('.sec-del-btn').forEach(function (btn) {
      initConfirmableBtn(btn, function () {
        deleteSection(btn.getAttribute('data-id'));
      });
    });

    renderRoomPreview();
  }

  function initGenericSectionDragDrop(container, getSections, onReorder) {
    let dragIdx = -1;
    let ghostEl = null;
    let startY = 0;
    let rowEls = [];
    let rowRects = [];
    let onMove = null;
    let onUp = null;

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
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
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
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (dragIdx < 0) { return; }
      const targetIdx = calcTargetIdx(e.clientY - startY);
      rowEls.forEach(r => r.classList.remove('section-row--dragging', 'section-row--insert-before', 'section-row--insert-after'));
      if (ghostEl) { ghostEl.remove(); }
      ghostEl = null;
      const fromIdx = dragIdx;
      dragIdx = -1;
      if (targetIdx !== fromIdx) {
        const sections = getSections();
        const [moved] = sections.splice(fromIdx, 1);
        sections.splice(targetIdx, 0, moved);
        onReorder();
      }
    };

    container.querySelectorAll('.section-row-drag').forEach(handle => {
      handle.addEventListener('mousedown', (e) => {
        onMove = (e) => onDragMove(e);
        onUp = (e) => onDragEnd(e);
        onDragStart(e, handle);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    });
  }

  function initSectionDragDrop(container) {
    initGenericSectionDragDrop(container, activeRoomSections, renderSectionsList);
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
    markDirty();
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

  function renderScenariosPreview() {
    var box = qs('scenarios-live-preview');
    if (!box) { return; }
    var sections = activeScSections();
    if (!sections.length) {
      box.innerHTML = '<p class="preview-empty-section">No sections yet.</p>';
      return;
    }
    box.innerHTML = sections.map(function(sec) {
      var headerHtml = sec.title
        ? '<div class="preview-section-title">' + esc(sec.title) + '</div>'
        : '';
      var chipsHtml = (sec.items || []).length === 0
        ? '<p class="preview-empty-section">No scenarios</p>'
        : '<div class="preview-tiles-row">' + (sec.items || []).map(function(sc) {
            return '<div class="preview-tile-chip"><span class="chip-domain">' + esc(sc.icon || '\u25b6') + '</span>' + esc(sc.title) + '</div>';
          }).join('') + '</div>';
      return '<div class="preview-room-section">' + headerHtml + chipsHtml + '</div>';
    }).join('');
  }

  function renderScSectionsList() {
    var container = qs('sc-sections-list');
    if (!container) { return; }
    var sections = activeScSections();
    if (sections.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No sections. Click &ldquo;+ Add&rdquo;.</p>';
      return;
    }
    container.innerHTML = sections.map(function(sec) {
      var isActive = sec.id === editingScSectionId;
      var count = (sec.items || []).length;
      return '<div class="section-row' + (isActive ? ' section-row--active' : '') + '" data-id="' + esc(sec.id) + '">'
        + '<span class="section-row-drag">&#9776;</span>'
        + '<div class="section-row-info">'
        + '<span class="section-row-title">' + esc(sec.title || 'Unnamed') + '</span>'
        + '<span class="section-row-count">' + count + ' scenario' + (count === 1 ? '' : 's') + '</span>'
        + '</div>'
        + '<div class="section-row-actions">'
        + '<button class="remove-btn sc-sec-del-btn" type="button" data-id="' + esc(sec.id) + '">\u2715</button>'
        + '</div>'
        + '<span class="section-row-chevron">&#8250;</span>'
        + '</div>';
    }).join('');

    initGenericSectionDragDrop(container, activeScSections, renderScSectionsList);

    container.querySelectorAll('.section-row').forEach(function(row) {
      row.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') { return; }
        selectScSection(row.getAttribute('data-id'));
      });
    });
    container.querySelectorAll('.sc-sec-del-btn').forEach(function (btn) {
      initConfirmableBtn(btn, function () {
        deleteScSection(btn.getAttribute('data-id'));
      });
    });
    renderScenariosPreview();
  }

  function renderScSectionDetail() {
    var placeholder = qs('sc-section-detail-placeholder');
    var content = qs('sc-section-detail-content');
    if (!editingScSectionId) {
      if (placeholder) { placeholder.classList.remove('hidden'); }
      if (content) { content.classList.add('hidden'); }
      return;
    }
    var sec = activeScSectionObj();
    if (!sec) {
      if (placeholder) { placeholder.classList.remove('hidden'); }
      if (content) { content.classList.add('hidden'); }
      return;
    }
    if (placeholder) { placeholder.classList.add('hidden'); }
    if (content) { content.classList.remove('hidden'); }
    var titleInput = qs('sc-section-title-input');
    if (titleInput) { titleInput.value = sec.title; }
    renderScSectionItemsList();
  }

  function renderScSectionItemsList() {
    var container = qs('sc-section-items-list');
    var countEl   = qs('sc-section-items-count');
    if (!container) { return; }
    var items = activeScItems();
    if (countEl) { countEl.textContent = String(items.length); }

    if (items.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No scenarios. Click &ldquo;+ Add Scenario&rdquo;.</p>';
      renderScenariosPreview();
      return;
    }

    container.innerHTML = items.map(function(sc, i) {
      return '<div class="selected-row" data-idx="' + i + '">'
        + '<span class="item-drag-handle">&#9776;</span>'
        + '<span class="scenario-row-icon">' + esc(sc.icon || '') + '</span>'
        + '<div class="scenario-row-info">'
        + '<span class="scenario-row-title">' + esc(sc.title) + '</span>'
        + '<span class="scenario-row-id">' + esc(sc.entity_id) + '</span>'
        + '</div>'
        + '<div class="selected-actions">'
        + '<button class="remove-btn sc-item-remove-btn" type="button" data-idx="' + i + '">\u2715</button>'
        + '</div></div>';
    }).join('');

    initItemDragDrop(container, 'sc-section', items);

    container.querySelectorAll('.sc-item-remove-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeScItems().splice(parseInt(btn.getAttribute('data-idx'), 10), 1);
        renderScSectionItemsList();
      });
    });

    renderScenariosPreview();
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
      var _scItems = activeScItems();
      for (var j = 0; j < _scItems.length; j++) {
        if (_scItems[j].entity_id === e.entity_id) { already = true; break; }
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
        var title = name || eid.split('.')[1] || eid;
        var icon = eid.startsWith('scene.') ? '\uD83C\uDF1F' : '\uD83C\uDFAD';
        var sec = activeScSectionObj();
        if (sec) { sec.items.push({ entity_id: eid, title: title, icon: icon }); }
        renderScenarioPickerList();
        renderScSectionItemsList();
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

  function renderCamerasPreview() {
    var box = qs('cameras-live-preview');
    if (!box) { return; }
    var sections = activeCamSections();
    if (!sections.length) {
      box.innerHTML = '<p class="preview-empty-section">No cameras yet.</p>';
      return;
    }
    box.innerHTML = sections.map(function(sec) {
      var headerHtml = sec.title
        ? '<div class="preview-section-title">' + esc(sec.title) + '</div>'
        : '';
      var chipsHtml = (sec.items || []).length === 0
        ? '<p class="preview-empty-section">No cameras</p>'
        : '<div class="preview-tiles-row">' + (sec.items || []).map(function(c) {
            return '<div class="preview-tile-chip"><span class="chip-domain">cam</span>' + esc(c.title || c.entity_id) + '</div>';
          }).join('') + '</div>';
      return '<div class="preview-room-section">' + headerHtml + chipsHtml + '</div>';
    }).join('');
  }

  function renderCamSectionsList() {
    var container = qs('cam-sections-list');
    if (!container) { return; }
    var sections = activeCamSections();
    if (sections.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No sections. Click &ldquo;+ Add&rdquo;.</p>';
      return;
    }
    container.innerHTML = sections.map(function(sec) {
      var isActive = sec.id === editingCamSectionId;
      var count = (sec.items || []).length;
      return '<div class="section-row' + (isActive ? ' section-row--active' : '') + '" data-id="' + esc(sec.id) + '">'
        + '<span class="section-row-drag">&#9776;</span>'
        + '<div class="section-row-info">'
        + '<span class="section-row-title">' + esc(sec.title || 'Unnamed') + '</span>'
        + '<span class="section-row-count">' + count + ' camera' + (count === 1 ? '' : 's') + '</span>'
        + '</div>'
        + '<div class="section-row-actions">'
        + '<button class="remove-btn cam-sec-del-btn" type="button" data-id="' + esc(sec.id) + '">\u2715</button>'
        + '</div>'
        + '<span class="section-row-chevron">&#8250;</span>'
        + '</div>';
    }).join('');

    initGenericSectionDragDrop(container, activeCamSections, renderCamSectionsList);

    container.querySelectorAll('.section-row').forEach(function(row) {
      row.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') { return; }
        selectCamSection(row.getAttribute('data-id'));
      });
    });
    container.querySelectorAll('.cam-sec-del-btn').forEach(function (btn) {
      initConfirmableBtn(btn, function () {
        deleteCamSection(btn.getAttribute('data-id'));
      });
    });
    renderCamerasPreview();
  }

  function renderCamSectionDetail() {
    var placeholder = qs('cam-section-detail-placeholder');
    var content = qs('cam-section-detail-content');
    if (!editingCamSectionId) {
      if (placeholder) { placeholder.classList.remove('hidden'); }
      if (content) { content.classList.add('hidden'); }
      return;
    }
    var sec = activeCamSectionObj();
    if (!sec) {
      if (placeholder) { placeholder.classList.remove('hidden'); }
      if (content) { content.classList.add('hidden'); }
      return;
    }
    if (placeholder) { placeholder.classList.add('hidden'); }
    if (content) { content.classList.remove('hidden'); }
    var titleInput = qs('cam-section-title-input');
    if (titleInput) { titleInput.value = sec.title; }
    renderCamSectionItemsList();
  }

  function renderCamSectionItemsList() {
    var container = qs('cam-section-items-list');
    var countEl   = qs('cam-section-items-count');
    if (!container) { return; }
    var items = activeCamItems();
    if (countEl) { countEl.textContent = String(items.length); }

    if (items.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">Nessuna telecamera. Clicca &ldquo;+ Aggiungi&rdquo;.</p>';
      renderCamerasPreview();
      return;
    }

    var html = items.map(function(c, i) {
      return '<div class="selected-row" data-idx="' + i + '">'
        + '<span class="item-drag-handle">&#9776;</span>'
        + '<div class="selected-entity-info">'
        + '<span class="selected-id">' + esc(c.entity_id) + '</span>'
        + '<input type="text" class="camera-title-input item-label-input" placeholder="Nome display\u2026" maxlength="64"'
        + ' value="' + esc(c.title || '') + '" data-idx="' + i + '">'
        + '<div class="camera-refresh-row">'
        + '<label class="camera-refresh-label">Refresh (sec):</label>'
        + '<input type="number" class="camera-refresh-input" min="3" max="60"'
        + ' value="' + (c.refresh_interval || 10) + '" data-idx="' + i + '">'
        + '</div></div>'
        + '<div class="selected-actions">'
        + '<button class="remove-btn cam-item-remove-btn" type="button" data-idx="' + i + '">\u2715</button>'
        + '</div></div>';
    }).join('');
    container.innerHTML = html;

    initItemDragDrop(container, 'cam-section', items);

    container.querySelectorAll('.camera-title-input').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var its = activeCamItems();
        if (its[idx]) { its[idx].title = this.value.trim(); }
      });
    });
    container.querySelectorAll('.camera-refresh-input').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        var val = parseInt(this.value, 10);
        if (isNaN(val) || val < 3) { val = 3; }
        if (val > 60) { val = 60; }
        this.value = val;
        var its = activeCamItems();
        if (its[idx]) { its[idx].refresh_interval = val; }
      });
    });
    container.querySelectorAll('.cam-item-remove-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeCamItems().splice(parseInt(btn.getAttribute('data-idx'), 10), 1);
        renderCamSectionItemsList();
      });
    });

    renderCamerasPreview();
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
      if (listEl) { listEl.innerHTML = '<p class="cfg-placeholder">Loading cameras\u2026</p>'; }
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
      var _camItems = activeCamItems();
      for (var j = 0; j < _camItems.length; j++) {
        if (_camItems[j].entity_id === e.entity_id) { already = true; break; }
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
        var sec = activeCamSectionObj();
        if (sec) { sec.items.push({ entity_id: eid, title: '', refresh_interval: 10 }); }
        renderCameraPickerList();
        renderCamSectionItemsList();
      });
    });
  }

  // ── Alarms ─────────────────────────────────────────────────────────────────

  function findAlarmById(id) {
    var al = state.alarms || [];
    for (var i = 0; i < al.length; i++) {
      if (al[i].id === id) { return al[i]; }
    }
    return null;
  }

  function renderAlarmsList() {
    var container = qs('alarms-list');
    if (!container) { return; }
    var alarms = state.alarms || [];
    if (alarms.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">Nessun allarme configurato. Clicca &ldquo;+ Aggiungi Allarme&rdquo;.</p>';
      return;
    }
    var DCS = ['', 'door', 'window', 'motion', 'presence', 'smoke', 'gas', 'moisture', 'vibration'];
    var DC_LABELS = { '': 'Auto', door: 'Porta', window: 'Finestra', motion: 'Movimento',
      presence: 'Presenza', smoke: 'Fumo', gas: 'Gas', moisture: 'Umidit\u00e0', vibration: 'Vibrazione' };
    var html = '';
    for (var i = 0; i < alarms.length; i++) {
      var a = alarms[i];
      var sensors = a.sensors || [];
      html += '<div class="alarm-card" data-id="' + esc(a.id) + '">';

      // ── Header: entity id + remove button ──
      html += '<div class="alarm-card-hdr">';
      html += '<span class="selected-id">' + esc(a.entity_id) + '</span>';
      html += '<button class="remove-btn alarm-del-btn" type="button" data-id="' + esc(a.id) + '">\u2715</button>';
      html += '</div>';

      // ── Label field (reuse .field-row layout) ──
      html += '<div class="field-row">';
      html += '<label class="field-label">Label</label>';
      html += '<input type="text" class="alarm-label-input field-input" placeholder="Nome display\u2026" maxlength="64" value="' + esc(a.label || '') + '" data-id="' + esc(a.id) + '">';
      html += '</div>';

      // ── Sensors sub-section ──
      html += '<div class="alarm-sensors-hdr">';
      html += '<span class="sections-col-label">Sensori zona (' + sensors.length + ')</span>';
      html += '<button class="action-btn-sm alarm-add-sensor-btn" type="button" data-id="' + esc(a.id) + '">+ Sensore</button>';
      html += '</div>';

      if (sensors.length === 0) {
        html += '<p class="cfg-placeholder">Nessun sensore aggiunto.</p>';
      } else {
        for (var j = 0; j < sensors.length; j++) {
          var s = sensors[j];
          html += '<div class="selected-row alarm-sensor-row">';
          html += '<div class="selected-entity-info">';
          html += '<span class="selected-id">' + esc(s.entity_id) + '</span>';
          html += '<input type="text" class="alarm-sensor-label-input item-label-input" placeholder="Label\u2026" maxlength="64" value="' + esc(s.label || '') + '" data-alarm-id="' + esc(a.id) + '" data-idx="' + j + '">';
          html += '</div>';
          html += '<select class="alarm-sensor-dc-select field-select" style="flex:none;width:auto;" data-alarm-id="' + esc(a.id) + '" data-idx="' + j + '">';
          for (var k = 0; k < DCS.length; k++) {
            var dcv = DCS[k];
            html += '<option value="' + esc(dcv) + '"' + (s.device_class === dcv ? ' selected' : '') + '>' + esc(DC_LABELS[dcv]) + '</option>';
          }
          html += '</select>';
          html += '<div class="selected-actions"><button class="remove-btn alarm-sensor-del-btn" type="button" data-alarm-id="' + esc(a.id) + '" data-idx="' + j + '">\u2715</button></div>';
          html += '</div>';
        }
      }

      html += '</div>'; // /alarm-card
    }
    container.innerHTML = html;

    container.querySelectorAll('.alarm-del-btn').forEach(function(btn) {
      initConfirmableBtn(btn, function() {
        var id = btn.getAttribute('data-id');
        state.alarms = (state.alarms || []).filter(function(a) { return a.id !== id; });
        markDirty();
        renderAlarmsList();
      });
    });

    container.querySelectorAll('.alarm-label-input').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var alarm = findAlarmById(this.getAttribute('data-id'));
        if (alarm) { alarm.label = this.value.trim(); markDirty(); }
      });
    });

    container.querySelectorAll('.alarm-add-sensor-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        editingAlarmId = this.getAttribute('data-id');
        openAlarmSensorPicker();
      });
    });

    container.querySelectorAll('.alarm-sensor-label-input').forEach(function(inp) {
      inp.addEventListener('change', function() {
        var alarm = findAlarmById(this.getAttribute('data-alarm-id'));
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        if (alarm && alarm.sensors[idx]) { alarm.sensors[idx].label = this.value.trim(); markDirty(); }
      });
    });

    container.querySelectorAll('.alarm-sensor-dc-select').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var alarm = findAlarmById(this.getAttribute('data-alarm-id'));
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        if (alarm && alarm.sensors[idx]) { alarm.sensors[idx].device_class = this.value; markDirty(); }
      });
    });

    container.querySelectorAll('.alarm-sensor-del-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var alarm = findAlarmById(this.getAttribute('data-alarm-id'));
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        if (alarm) { alarm.sensors.splice(idx, 1); markDirty(); renderAlarmsList(); }
      });
    });
  }

  function openAlarmEntityPicker() {
    alarmEntitySearchText = '';
    var searchEl = qs('alarm-entity-search-input');
    if (searchEl) { searchEl.value = ''; }
    showOverlay('alarm-entity-picker');
    if (allAlarmEntities.length > 0) {
      renderAlarmEntityPickerList();
    } else {
      var listEl = qs('alarm-entity-list');
      if (listEl) { listEl.innerHTML = '<p class="cfg-placeholder">Caricamento\u2026</p>'; }
      fetch('api/picker/entities?domain=alarm_control_panel')
        .then(function(r) { return r.ok ? r.json() : []; })
        .then(function(entities) {
          allAlarmEntities = entities || [];
          renderAlarmEntityPickerList();
        })
        .catch(function() {
          var el = qs('alarm-entity-list');
          if (el) { el.innerHTML = '<p class="cfg-placeholder">Nessun allarme trovato in HA.</p>'; }
        });
    }
    if (searchEl) { setTimeout(function() { searchEl.focus(); }, 100); }
  }

  function renderAlarmEntityPickerList() {
    var container = qs('alarm-entity-list');
    if (!container) { return; }
    if (allAlarmEntities.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">Nessun alarm_control_panel trovato in HA.</p>';
      return;
    }
    var filtered = allAlarmEntities.filter(function(e) {
      if (!alarmEntitySearchText) { return true; }
      var hay = (e.entity_id + ' ' + (e.friendly_name || '')).toLowerCase();
      return hay.indexOf(alarmEntitySearchText) !== -1;
    });
    if (filtered.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">Nessun risultato.</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var e = filtered[i];
      var already = false;
      var al = state.alarms || [];
      for (var j = 0; j < al.length; j++) {
        if (al[j].entity_id === e.entity_id) { already = true; break; }
      }
      html += '<div class="entity-row' + (already ? ' entity-row--selected' : '') + '">';
      html += '<span class="entity-domain">alarm</span>';
      html += '<span class="entity-info"><span class="entity-name">' + esc(e.friendly_name || e.entity_id) + '</span>';
      html += '<span class="entity-id-label">' + esc(e.entity_id) + '</span></span>';
      if (already) {
        html += '<span class="entity-check">&#10003;</span>';
      } else {
        html += '<button class="add-btn alarm-entity-pick-btn" type="button"'
          + ' data-id="' + esc(e.entity_id) + '"'
          + ' data-name="' + esc(e.friendly_name || '') + '">+</button>';
      }
      html += '</div>';
    }
    container.innerHTML = html;
    container.querySelectorAll('.alarm-entity-pick-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if ((state.alarms || []).length >= 10) { return; }
        var eid = this.getAttribute('data-id');
        var name = this.getAttribute('data-name');
        if (!state.alarms) { state.alarms = []; }
        state.alarms.push({ id: genSecId(), entity_id: eid, label: name, sensors: [] });
        markDirty();
        renderAlarmEntityPickerList();
        renderAlarmsList();
      });
    });
  }

  function openAlarmSensorPicker() {
    alarmSensorSearchText = '';
    var searchEl = qs('alarm-sensor-search-input');
    if (searchEl) { searchEl.value = ''; }
    showOverlay('alarm-sensor-picker');
    if (allBinarySensors.length > 0) {
      renderAlarmSensorPickerList();
    } else {
      var listEl = qs('alarm-sensor-list');
      if (listEl) { listEl.innerHTML = '<p class="cfg-placeholder">Caricamento\u2026</p>'; }
      fetch('api/picker/entities?domain=binary_sensor')
        .then(function(r) { return r.ok ? r.json() : []; })
        .then(function(entities) {
          allBinarySensors = entities || [];
          renderAlarmSensorPickerList();
        })
        .catch(function() {
          var el = qs('alarm-sensor-list');
          if (el) { el.innerHTML = '<p class="cfg-placeholder">Nessun binary_sensor trovato.</p>'; }
        });
    }
    if (searchEl) { setTimeout(function() { searchEl.focus(); }, 100); }
  }

  function renderAlarmSensorPickerList() {
    var container = qs('alarm-sensor-list');
    if (!container) { return; }
    var alarm = editingAlarmId ? findAlarmById(editingAlarmId) : null;
    if (!alarm) {
      container.innerHTML = '<p class="cfg-placeholder">Errore: nessun allarme selezionato.</p>';
      return;
    }
    var filtered = allBinarySensors.filter(function(e) {
      if (!alarmSensorSearchText) { return true; }
      var hay = (e.entity_id + ' ' + (e.friendly_name || '') + ' ' + (e.device_class || '')).toLowerCase();
      return hay.indexOf(alarmSensorSearchText) !== -1;
    });
    if (filtered.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">Nessun risultato.</p>';
      return;
    }
    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var e = filtered[i];
      var already = false;
      var sens = alarm.sensors || [];
      for (var j = 0; j < sens.length; j++) {
        if (sens[j].entity_id === e.entity_id) { already = true; break; }
      }
      var meta = e.device_class || '';
      html += '<div class="entity-row' + (already ? ' entity-row--selected' : '') + '">';
      html += '<span class="entity-domain">binary</span>';
      html += '<span class="entity-info"><span class="entity-name">' + esc(e.friendly_name || e.entity_id) + '</span>';
      html += '<span class="entity-id-label">' + esc(e.entity_id);
      if (meta) { html += ' <em class="entity-meta">(' + esc(meta) + ')</em>'; }
      html += '</span></span>';
      if (already) {
        html += '<span class="entity-check">&#10003;</span>';
      } else {
        html += '<button class="add-btn alarm-sensor-pick-btn" type="button"'
          + ' data-id="' + esc(e.entity_id) + '"'
          + ' data-name="' + esc(e.friendly_name || '') + '"'
          + ' data-dc="' + esc(e.device_class || '') + '">+</button>';
      }
      html += '</div>';
    }
    container.innerHTML = html;
    container.querySelectorAll('.alarm-sensor-pick-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var alm = findAlarmById(editingAlarmId);
        if (!alm) { return; }
        if ((alm.sensors || []).length >= 30) { return; }
        if (!alm.sensors) { alm.sensors = []; }
        alm.sensors.push({
          entity_id: this.getAttribute('data-id'),
          label: this.getAttribute('data-name'),
          device_class: this.getAttribute('data-dc') || ''
        });
        markDirty();
        renderAlarmSensorPickerList();
        renderAlarmsList();
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
    refreshItemsList(pickerContext === 'ov-section' ? 'ov-section' : 'section');
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
        'ef-solar':         'Produzione solare',
        'ef-home':          'Consumo casa',
        'ef-batt-soc':      'SOC batteria (%)',
        'ef-batt-charge':   'Carica batteria (W)',
        'ef-batt-discharge':'Scarica batteria (W)',
        'ef-grid-import':   'Prelievo rete (W)',
        'ef-grid-export':   'Immissione rete (W)',
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
    { field: 'ef-solar', title: 'Step 1 di 7 \u2014 Produzione solare', icon: '\u2600\uFE0F',
      description: 'Seleziona il sensore che misura la potenza prodotta dai pannelli fotovoltaici (Watt).\n\nEsempi:\n\u2022 sensor.solar_power\n\u2022 sensor.pv_power\n\u2022 sensor.zcs_azzurro_power_pv\n\nSuggerimento: cerca \u201cpv\u201d o \u201csolar\u201d.',
      placeholder: 'sensor.solar_power' },
    { field: 'ef-home', title: 'Step 2 di 7 \u2014 Consumo casa', icon: '\uD83C\uDFE0',
      description: 'Seleziona il sensore del consumo totale della casa (Watt).\n\nEsempi:\n\u2022 sensor.home_consumption\n\u2022 sensor.house_load\n\u2022 sensor.zcs_azzurro_power_load\n\nSuggerimento: cerca \u201cload\u201d o \u201cconsumption\u201d.',
      placeholder: 'sensor.home_consumption' },
    { field: 'ef-batt-soc', title: 'Step 3 di 7 \u2014 SOC batteria (%)', icon: '\uD83D\uDD0B',
      description: 'Seleziona il sensore che mostra la percentuale di carica della batteria (0\u2013100%).\n\nEsempi:\n\u2022 sensor.battery_soc\n\u2022 sensor.bms_state_of_charge\n\u2022 sensor.zcs_azzurro_battery_soc\n\nSuggerimento: cerca \u201csoc\u201d.',
      placeholder: 'sensor.battery_soc' },
    { field: 'ef-batt-charge', title: 'Step 4 di 7 \u2014 Carica batteria', icon: '\u2B06\uFE0F',
      description: 'Seleziona il sensore della potenza di CARICA della batteria (Watt, sempre positivo quando in carica).\n\nEsempi:\n\u2022 sensor.battery_charge_power\n\u2022 sensor.batt_charge_w\n\nSuggerimento: cerca \u201ccharge\u201d o \u201ccaricat\u201d.',
      placeholder: 'sensor.battery_charge_power' },
    { field: 'ef-batt-discharge', title: 'Step 5 di 7 \u2014 Scarica batteria', icon: '\u2B07\uFE0F',
      description: 'Seleziona il sensore della potenza di SCARICA della batteria (Watt, sempre positivo quando in scarica).\n\nEsempi:\n\u2022 sensor.battery_discharge_power\n\u2022 sensor.batt_discharge_w\n\nSuggerimento: cerca \u201cdischarge\u201d o \u201cscaric\u201d.',
      placeholder: 'sensor.battery_discharge_power' },
    { field: 'ef-grid-import', title: 'Step 6 di 7 \u2014 Prelievo rete', icon: '\u26A1',
      description: 'Seleziona il sensore del PRELIEVO dalla rete (Watt, positivo quando importi dalla rete).\n\nEsempi:\n\u2022 sensor.grid_import\n\u2022 sensor.grid_consumption\n\u2022 sensor.zcs_azzurro_power_grid_in\n\nSuggerimento: cerca \u201cimport\u201d o \u201cprelievo\u201d.',
      placeholder: 'sensor.grid_import' },
    { field: 'ef-grid-export', title: 'Step 7 di 7 \u2014 Immissione rete', icon: '\uD83D\uDD1D',
      description: 'Seleziona il sensore dell\u2019IMMISSIONE in rete (Watt, positivo quando esporti in rete).\n\nEsempi:\n\u2022 sensor.grid_export\n\u2022 sensor.grid_feedin\n\u2022 sensor.zcs_azzurro_power_grid_out\n\nSuggerimento: cerca \u201cexport\u201d o \u201cimmissione\u201d.',
      placeholder: 'sensor.grid_export' },
  ];

  function openEnergyEditor(ctx, itemIdx) {
    energyContext = ctx;
    energyItemIdx = (itemIdx !== undefined && itemIdx !== null) ? itemIdx : null;

    var items = getItemsForContext(ctx);
    var existingItem = (energyItemIdx !== null && items) ? items[energyItemIdx] : null;

    wizardValues = {
      'ef-solar':         (existingItem && existingItem.solar_power)            || '',
      'ef-home':          (existingItem && existingItem.home_power)             || '',
      'ef-batt-soc':      (existingItem && existingItem.battery_soc)            || '',
      'ef-batt-charge':   (existingItem && existingItem.battery_charge_power)   || '',
      'ef-batt-discharge':(existingItem && existingItem.battery_discharge_power)|| '',
      'ef-grid-import':   (existingItem && existingItem.grid_import)            || '',
      'ef-grid-export':   (existingItem && existingItem.grid_export)            || '',
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
      solar_power:            wizardValues['ef-solar']          || '',
      home_power:             wizardValues['ef-home']           || '',
      battery_soc:            wizardValues['ef-batt-soc']       || '',
      battery_charge_power:   wizardValues['ef-batt-charge']    || '',
      battery_discharge_power:wizardValues['ef-batt-discharge'] || '',
      grid_import:            wizardValues['ef-grid-import']    || '',
      grid_export:            wizardValues['ef-grid-export']    || '',
    };

    var items = getItemsForContext(energyContext);
    if (energyItemIdx !== null && items) {
      items[energyItemIdx] = efItem;
    } else if (items) {
      items.push(efItem);
    }

    hideOverlay();
    refreshItemsList(energyContext === 'ov-section' ? 'ov-section' : 'section');
  }

  // ── Overlay management ─────────────────────────────────────────────────────

  var OVERLAYS = ['entity-picker', 'sensor-picker', 'scenario-picker', 'energy-editor', 'camera-picker', 'alarm-entity-picker', 'alarm-sensor-picker', 'visual-type-picker', 'icon-picker-modal'];

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
        clearDirty();
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
        var resolvedTheme = cfg.theme || '';
        try { if (!resolvedTheme) { resolvedTheme = localStorage.getItem('rp_theme') || ''; } } catch (e) {}
        if (resolvedTheme !== 'light' && resolvedTheme !== 'auto') { resolvedTheme = 'dark'; }
        document.body.classList.remove('theme-dark', 'theme-light', 'theme-auto');
        document.body.classList.add('theme-' + resolvedTheme);
        state.theme = resolvedTheme;
        try { localStorage.setItem('rp_theme', resolvedTheme); } catch (e) {}

        // Populate state from saved config
        var ovRaw = cfg.overview || {};
        var ovSections = Array.isArray(ovRaw.sections) ? ovRaw.sections : [];
        // v4 fallback: if no sections but flat items exist, wrap in a default section
        if (ovSections.length === 0 && Array.isArray(ovRaw.items) && ovRaw.items.length > 0) {
          ovSections = [{ id: 'sec_default', title: '', items: ovRaw.items }];
        }
        state.overview = {
          title: ovRaw.title || 'Overview',
          icon:  ovRaw.icon  || 'home',
          sections: ovSections.map(function(s) {
            return { id: s.id || genSecId(), title: s.title || '', items: (s.items || []).map(cloneItem) };
          }),
        };
        var scRaw = cfg.scenarios_section || {};
        state.scenarios_section = {
          title: scRaw.title || 'Scenarios',
          icon:  scRaw.icon  || 'palette',
        };
        var camRaw = cfg.cameras_section || {};
        state.cameras_section = {
          title: camRaw.title || 'Cameras',
          icon:  camRaw.icon  || 'cctv',
        };
        state.rooms = (cfg.rooms || []).map(function (r) {
          var sections;
          if (r.sections && r.sections.length > 0) {
            sections = r.sections.map(function (sec) {
              return {
                id:    sec.id    || genSecId(),
                title: sec.title || '',
                items: (sec.items || []).map(cloneItem),
              };
            });
          } else if (r.items && r.items.length > 0) {
            sections = [{
              id: genSecId(),
              title: '',
              items: (r.items || []).map(cloneItem),
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

        // scenarios: list of sections
        state.scenarios = (cfg.scenarios || []).map(function(sec) {
          return {
            id:    sec.id    || genSecId(),
            title: sec.title || '',
            items: (sec.items || []).map(function(sc) {
              return { entity_id: sc.entity_id, title: sc.title || '', icon: sc.icon || '\uD83C\uDFAD' };
            }),
          };
        });

        // cameras: list of sections
        state.cameras = (cfg.cameras || []).map(function(sec) {
          return {
            id:    sec.id    || genSecId(),
            title: sec.title || '',
            items: (sec.items || []).map(function(c) {
              return { entity_id: c.entity_id, title: c.title || '', refresh_interval: c.refresh_interval || 10 };
            }),
          };
        });

        // alarms: flat list
        var almRaw = cfg.alarms_section || {};
        state.alarms_section = {
          title: almRaw.title || 'Allarme',
          icon:  almRaw.icon  || 'shield-home',
        };
        state.alarms = (cfg.alarms || []).map(function(a) {
          return {
            id:        genSecId(),
            entity_id: a.entity_id || '',
            label:     a.label     || '',
            sensors:   (a.sensors || []).map(function(s) {
              return { entity_id: s.entity_id || '', label: s.label || '', device_class: s.device_class || '' };
            }),
          };
        });

        state.header_sensors      = cfg.header_sensors || [];

        // Render UI immediately with saved data
        var ovTitleInput = qs('overview-title-input');
        if (ovTitleInput) { ovTitleInput.value = state.overview.title; }
        updateSectionIconPreview('overview', state.overview.icon);

        var scTitleInput = qs('scenarios-title-input');
        if (scTitleInput) { scTitleInput.value = state.scenarios_section.title; }
        updateSectionIconPreview('scenarios', state.scenarios_section.icon);

        var camTitleInput = qs('cameras-title-input');
        if (camTitleInput) { camTitleInput.value = state.cameras_section.title; }
        updateSectionIconPreview('cameras', state.cameras_section.icon);

        var almTitleInput = qs('alarms-title-input');
        if (almTitleInput) { almTitleInput.value = state.alarms_section.title; }
        updateSectionIconPreview('alarms', state.alarms_section.icon);

        renderOvSectionsList();
        renderOvSectionDetail();
        renderRoomsList();
        renderScSectionsList();
        renderScSectionDetail();
        renderHeaderSensorsList();
        renderCamSectionsList();
        renderCamSectionDetail();
        renderAlarmsList();

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
    var TAB_ICONS = { overview: 'home', rooms: 'floor-plan', scenarios: 'palette', header: 'thermometer', cameras: 'cctv', alarms: 'shield-home' };
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

    // ── Overview title & icon ──────────────────────────────────────────────
    var ovTitleInput = qs('overview-title-input');
    if (ovTitleInput) {
      ovTitleInput.addEventListener('input', function () {
        markDirty();
        state.overview.title = this.value.trim() || 'Overview';
      });
    }

    var ovIconBtn = qs('overview-icon-btn');
    if (ovIconBtn) {
      ovIconBtn.addEventListener('click', function () {
        openIconPickerModal(state.overview.icon, function (name) {
          markDirty();
          state.overview.icon = name;
          updateSectionIconPreview('overview', name);
        });
      });
    }

    // ── Overview sections buttons ──────────────────────────────────────────
    var ovAddSectionBtn = qs('ov-add-section-btn');
    if (ovAddSectionBtn) {
      ovAddSectionBtn.addEventListener('click', function() {
        markDirty();
        var newSec = { id: genSecId(), title: '', items: [] };
        activeOvSections().push(newSec);
        selectOvSection(newSec.id);
      });
    }

    var ovSectionTitleInput = qs('ov-section-title-input');
    if (ovSectionTitleInput) {
      ovSectionTitleInput.addEventListener('input', function() {
        markDirty();
        var sec = activeOvSectionObj();
        if (sec) { sec.title = this.value.trim(); renderOvSectionsList(); }
      });
    }

    var ovAddEntityBtn = qs('ov-add-entity-btn');
    if (ovAddEntityBtn) {
      ovAddEntityBtn.addEventListener('click', function() { openEntityPicker('ov-section'); });
    }

    var ovAddEnergyBtn = qs('ov-add-energy-btn');
    if (ovAddEnergyBtn) {
      ovAddEnergyBtn.addEventListener('click', function() { openEnergyEditor('ov-section', null); });
    }

    // ── Scenarios sections ─────────────────────────────────────────────────
    var scAddSectionBtn = qs('sc-add-section-btn');
    if (scAddSectionBtn) {
      scAddSectionBtn.addEventListener('click', function() {
        markDirty();
        var newSec = { id: genSecId(), title: '', items: [] };
        activeScSections().push(newSec);
        selectScSection(newSec.id);
      });
    }

    var scSectionTitleInput = qs('sc-section-title-input');
    if (scSectionTitleInput) {
      scSectionTitleInput.addEventListener('input', function() {
        markDirty();
        var sec = activeScSectionObj();
        if (sec) { sec.title = this.value.trim(); renderScSectionsList(); }
      });
    }

    var scAddScenarioBtn = qs('sc-add-scenario-btn');
    if (scAddScenarioBtn) {
      scAddScenarioBtn.addEventListener('click', function() {
        if (!activeScSectionObj()) { return; }
        openScenarioPicker();
      });
    }

    // ── Cameras sections ───────────────────────────────────────────────────
    var camAddSectionBtn = qs('cam-add-section-btn');
    if (camAddSectionBtn) {
      camAddSectionBtn.addEventListener('click', function() {
        markDirty();
        var newSec = { id: genSecId(), title: '', items: [] };
        activeCamSections().push(newSec);
        selectCamSection(newSec.id);
      });
    }

    var camSectionTitleInput = qs('cam-section-title-input');
    if (camSectionTitleInput) {
      camSectionTitleInput.addEventListener('input', function() {
        markDirty();
        var sec = activeCamSectionObj();
        if (sec) { sec.title = this.value.trim(); renderCamSectionsList(); }
      });
    }

    var camAddCameraBtn = qs('cam-add-camera-btn');
    if (camAddCameraBtn) {
      camAddCameraBtn.addEventListener('click', function() {
        if (!activeCamSectionObj()) { return; }
        openCameraPicker();
      });
    }

    // ── Scenarios section title & icon (tab header) ────────────────────────
    var scTitleInput2 = qs('scenarios-title-input');
    if (scTitleInput2) {
      scTitleInput2.addEventListener('input', function () {
        markDirty();
        state.scenarios_section.title = this.value.trim() || 'Scenarios';
      });
    }

    var scIconBtn = qs('scenarios-icon-btn');
    if (scIconBtn) {
      scIconBtn.addEventListener('click', function () {
        openIconPickerModal(state.scenarios_section.icon, function (name) {
          markDirty();
          state.scenarios_section.icon = name;
          updateSectionIconPreview('scenarios', name);
        });
      });
    }

    // ── Cameras section title & icon (tab header) ──────────────────────────
    var camTitleInput2 = qs('cameras-title-input');
    if (camTitleInput2) {
      camTitleInput2.addEventListener('input', function () {
        markDirty();
        state.cameras_section.title = this.value.trim() || 'Cameras';
      });
    }

    var camIconBtn = qs('cameras-icon-btn');
    if (camIconBtn) {
      camIconBtn.addEventListener('click', function () {
        openIconPickerModal(state.cameras_section.icon, function (name) {
          markDirty();
          state.cameras_section.icon = name;
          updateSectionIconPreview('cameras', name);
        });
      });
    }

    // ── Alarms section title & icon ────────────────────────────────────────────
    var almTitleInput2 = qs('alarms-title-input');
    if (almTitleInput2) {
      almTitleInput2.addEventListener('input', function () {
        markDirty();
        state.alarms_section.title = this.value.trim() || 'Allarme';
      });
    }

    var almIconBtn = qs('alarms-icon-btn');
    if (almIconBtn) {
      almIconBtn.addEventListener('click', function () {
        openIconPickerModal(state.alarms_section.icon, function (name) {
          markDirty();
          state.alarms_section.icon = name;
          updateSectionIconPreview('alarms', name);
        });
      });
    }

    // ── Add alarm button ───────────────────────────────────────────────────────
    var addAlarmBtn = qs('add-alarm-btn');
    if (addAlarmBtn) { addAlarmBtn.addEventListener('click', openAlarmEntityPicker); }

    // ── Alarm entity picker controls ───────────────────────────────────────────
    var almEntityCancelBtn = qs('alarm-entity-picker-cancel-btn');
    if (almEntityCancelBtn) { almEntityCancelBtn.addEventListener('click', hideOverlay); }

    var almEntityDoneBtn = qs('alarm-entity-picker-done-btn');
    if (almEntityDoneBtn) { almEntityDoneBtn.addEventListener('click', hideOverlay); }

    var almEntitySearchEl = qs('alarm-entity-search-input');
    if (almEntitySearchEl) {
      almEntitySearchEl.addEventListener('input', function () {
        alarmEntitySearchText = this.value.toLowerCase();
        renderAlarmEntityPickerList();
      });
    }

    // ── Alarm sensor picker controls ───────────────────────────────────────────
    var almSensorCancelBtn = qs('alarm-sensor-picker-cancel-btn');
    if (almSensorCancelBtn) { almSensorCancelBtn.addEventListener('click', function() {
      editingAlarmId = null;
      hideOverlay();
    }); }

    var almSensorDoneBtn = qs('alarm-sensor-picker-done-btn');
    if (almSensorDoneBtn) { almSensorDoneBtn.addEventListener('click', function() {
      editingAlarmId = null;
      hideOverlay();
    }); }

    var almSensorSearchEl = qs('alarm-sensor-search-input');
    if (almSensorSearchEl) {
      almSensorSearchEl.addEventListener('input', function () {
        alarmSensorSearchText = this.value.toLowerCase();
        renderAlarmSensorPickerList();
      });
    }

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
      roomTitleInput.addEventListener('input', function () { markDirty(); });
      roomTitleInput.addEventListener('blur', commitRoomTitle);
      roomTitleInput.addEventListener('keydown', function (e) { if (e.keyCode === 13) { this.blur(); } });
    }

    var roomIconBtn = qs('room-icon-btn');
    if (roomIconBtn) { roomIconBtn.addEventListener('click', function (e) { e.stopPropagation(); openIconPicker(); }); }

    var roomAddEntityBtn = qs('room-add-entity-btn');
    if (roomAddEntityBtn) { roomAddEntityBtn.addEventListener('click', function () { openEntityPicker('section'); }); }

    var addSectionBtn = qs('add-section-btn');
    if (addSectionBtn) { addSectionBtn.addEventListener('click', addSection); }

    var sectionTitleInput = qs('section-title-input');
    if (sectionTitleInput) {
      sectionTitleInput.addEventListener('input', function () {
        if (editingSectionId) { commitSectionTitle(editingSectionId, this.value); }
      });
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

    // ── Icon picker modal ──────────────────────────────────────────────────
    var iconPickerCancelBtn = qs('icon-picker-modal-cancel');
    if (iconPickerCancelBtn) {
      iconPickerCancelBtn.addEventListener('click', function () {
        hideOverlay();
        _iconPickerCallback = null;
      });
    }

    var iconPickerSearch = qs('icon-picker-modal-search');
    if (iconPickerSearch) {
      var _ipSearchTimer = null;
      iconPickerSearch.addEventListener('input', function () {
        clearTimeout(_ipSearchTimer);
        var val = this.value;
        _ipSearchTimer = setTimeout(function () { renderIconPickerGrid(val); }, 80);
      });
    }

    var iconPickerGrid = qs('icon-picker-modal-grid');
    if (iconPickerGrid) {
      var _ipScrollPending = false;
      iconPickerGrid.addEventListener('scroll', function () {
        if (_ipScrollPending) { return; }
        _ipScrollPending = true;
        var self = this;
        requestAnimationFrame(function () {
          _ipScrollPending = false;
          _renderVisibleRows(self);
        });
      });
    }

    // ── Header sensor buttons ──────────────────────────────────────────────
    var addHeaderBtn = qs('add-header-sensor-btn');
    if (addHeaderBtn) { addHeaderBtn.addEventListener('click', openHeaderSensorPicker); }

    // ── Camera picker controls ─────────────────────────────────────────────
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

    // ── Beforeunload warning ───────────────────────────────────────────────
    window.addEventListener('beforeunload', function (e) {
      if (_dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // ── Save ───────────────────────────────────────────────────────────────
    var saveBtn = qs('save-btn');
    if (saveBtn) { saveBtn.addEventListener('click', save); }
  }

  document.addEventListener('DOMContentLoaded', init);

  // ── Test hooks ─────────────────────────────────────────────────────────────
  if (typeof window !== 'undefined' && window.__TEST_MODE__) {
    window.__test__ = {
      esc: esc,
      genSecId: genSecId,
      genId: genId,
      activeOvSections: activeOvSections,
      state: state,
    };
  }
}());
