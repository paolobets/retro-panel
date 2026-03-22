/**
 * config.js — Configuration page logic for Retro Panel.
 *
 * Responsibilities:
 * - Load current config from /api/panel-config
 * - Load all available HA entities from /api/entities
 * - Render panel settings form, entity picker, and selected entity list
 * - Save updated config to /api/config (POST)
 *
 * Compatibility:
 * - ES2017 only. No optional chaining (?.), no nullish coalescing (??),
 *   no Array.at(), no structuredClone(), no Object.hasOwn().
 * - Works on iOS 15 Safari.
 * - No top-level await; all async work is inside boot().
 */

import { getPanelConfig, getAllEntities, saveConfig } from './config-api.js';

// ── State ──────────────────────────────────────────────────────────────────
var state = {
  allEntities: [],       // [{entity_id, friendly_name, domain}]
  selectedEntities: [],  // [{entity_id, label, icon}]
  filterDomain: 'all',
  searchQuery: '',
};

// ── DOM helpers ────────────────────────────────────────────────────────────
function qs(sel) {
  return document.querySelector(sel);
}

function showStatus(msg, type) {
  var el = qs('#save-status');
  el.textContent = msg;
  el.className = 'visible ' + type;
  setTimeout(function() { el.className = ''; }, 4000);
}

function applyTheme(theme) {
  var body = document.body;
  body.classList.remove('theme-dark', 'theme-light', 'theme-auto');
  if (theme === 'auto') {
    var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    body.classList.add(mq && mq.matches ? 'theme-dark' : 'theme-light');
  } else {
    body.classList.add('theme-' + (theme || 'dark'));
  }
}

// ── Domain filter pills ────────────────────────────────────────────────────

// Canonical display order for domain filter pills
var ALL_DOMAINS = [
  'light', 'switch', 'sensor', 'binary_sensor',
  'alarm_control_panel', 'cover', 'input_boolean',
  'climate', 'media_player', 'fan', 'lock',
  'automation', 'script', 'scene', 'person', 'device_tracker',
];

function renderDomainFilters() {
  var container = qs('#domain-filters');
  var pills = [{ id: 'all', label: 'All' }];

  // Only show domains that are present in the fetched entity list
  var present = {};
  state.allEntities.forEach(function(e) { present[e.domain] = true; });
  ALL_DOMAINS.forEach(function(d) {
    if (present[d]) {
      pills.push({ id: d, label: d.replace(/_/g, ' ') });
    }
  });

  container.innerHTML = '';
  pills.forEach(function(p) {
    var btn = document.createElement('button');
    btn.className = 'filter-pill' + (state.filterDomain === p.id ? ' active' : '');
    btn.textContent = p.label;
    btn.addEventListener('click', function() {
      state.filterDomain = p.id;
      renderDomainFilters();
      renderEntityPicker();
    });
    container.appendChild(btn);
  });
}

// ── Entity picker ──────────────────────────────────────────────────────────
function renderEntityPicker() {
  var container = qs('#entity-list');
  var q = state.searchQuery.toLowerCase();

  var filtered = state.allEntities.filter(function(e) {
    if (state.filterDomain !== 'all' && e.domain !== state.filterDomain) return false;
    if (q) {
      var inId   = e.entity_id.indexOf(q) !== -1;
      var inName = e.friendly_name.toLowerCase().indexOf(q) !== -1;
      if (!inId && !inName) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="entity-list-empty">No entities found</div>';
    return;
  }

  container.innerHTML = '';
  filtered.forEach(function(entity) {
    var isSelected = state.selectedEntities.some(function(s) {
      return s.entity_id === entity.entity_id;
    });

    var row = document.createElement('div');
    row.className = 'entity-row';

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = isSelected;
    // Stop the row click handler from double-firing when the checkbox itself is clicked
    cb.addEventListener('click', function(ev) { ev.stopPropagation(); });
    cb.addEventListener('change', function() {
      if (cb.checked) {
        addEntity(entity);
      } else {
        removeEntity(entity.entity_id);
      }
      renderSelectedList();
    });

    var info = document.createElement('div');
    info.className = 'entity-row-info';

    var nameDiv = document.createElement('div');
    nameDiv.className = 'entity-friendly-name';
    nameDiv.textContent = entity.friendly_name;

    var idDiv = document.createElement('div');
    idDiv.className = 'entity-id-label';
    idDiv.textContent = entity.entity_id;

    info.appendChild(nameDiv);
    info.appendChild(idDiv);

    var badge = document.createElement('span');
    badge.className = 'entity-domain-badge';
    badge.textContent = entity.domain;

    row.appendChild(cb);
    row.appendChild(info);
    row.appendChild(badge);

    // Clicking anywhere on the row (except the checkbox itself) toggles selection
    row.addEventListener('click', function() {
      cb.checked = !cb.checked;
      if (cb.checked) {
        addEntity(entity);
      } else {
        removeEntity(entity.entity_id);
      }
      renderSelectedList();
    });

    container.appendChild(row);
  });
}

function addEntity(entity) {
  var already = state.selectedEntities.some(function(s) {
    return s.entity_id === entity.entity_id;
  });
  if (already) return;
  state.selectedEntities.push({
    entity_id: entity.entity_id,
    label: entity.friendly_name,
    icon: '',
  });
}

function removeEntity(entityId) {
  state.selectedEntities = state.selectedEntities.filter(function(s) {
    return s.entity_id !== entityId;
  });
}

// ── Selected entities list ─────────────────────────────────────────────────
function renderSelectedList() {
  var container = qs('#selected-list');
  var countEl = qs('#selected-count');
  countEl.textContent = String(state.selectedEntities.length);

  if (state.selectedEntities.length === 0) {
    container.innerHTML = '<div class="selected-empty">No entities selected. Add them from the list above.</div>';
    return;
  }

  container.innerHTML = '';
  state.selectedEntities.forEach(function(ent, idx) {
    var row = document.createElement('div');
    row.className = 'selected-row';

    // Up / down reorder buttons
    var orderBtns = document.createElement('div');
    orderBtns.className = 'selected-order-btns';

    var btnUp = document.createElement('button');
    btnUp.className = 'btn-order';
    btnUp.textContent = '\u25B2';
    btnUp.disabled = (idx === 0);
    btnUp.addEventListener('click', function() {
      var tmp = state.selectedEntities[idx];
      state.selectedEntities[idx] = state.selectedEntities[idx - 1];
      state.selectedEntities[idx - 1] = tmp;
      renderSelectedList();
    });

    var btnDown = document.createElement('button');
    btnDown.className = 'btn-order';
    btnDown.textContent = '\u25BC';
    btnDown.disabled = (idx === state.selectedEntities.length - 1);
    btnDown.addEventListener('click', function() {
      var tmp = state.selectedEntities[idx];
      state.selectedEntities[idx] = state.selectedEntities[idx + 1];
      state.selectedEntities[idx + 1] = tmp;
      renderSelectedList();
    });

    orderBtns.appendChild(btnUp);
    orderBtns.appendChild(btnDown);

    // Entity ID label (read-only)
    var eidSpan = document.createElement('span');
    eidSpan.className = 'selected-entity-id';
    eidSpan.title = ent.entity_id;
    eidSpan.textContent = ent.entity_id;

    // Label input (captures closure over idx; re-read from state on input)
    var labelInput = document.createElement('input');
    labelInput.type = 'text';
    labelInput.className = 'selected-label-input';
    labelInput.placeholder = 'Label';
    labelInput.value = ent.label || '';
    (function(i) {
      labelInput.addEventListener('input', function() {
        state.selectedEntities[i].label = labelInput.value;
      });
    }(idx));

    // Icon input
    var iconInput = document.createElement('input');
    iconInput.type = 'text';
    iconInput.className = 'selected-icon-input';
    iconInput.placeholder = 'icon';
    iconInput.title = 'Icon name (e.g. bulb, thermometer)';
    iconInput.value = ent.icon || '';
    (function(i) {
      iconInput.addEventListener('input', function() {
        state.selectedEntities[i].icon = iconInput.value;
      });
    }(idx));

    // Remove button
    var btnRemove = document.createElement('button');
    btnRemove.className = 'btn-remove';
    btnRemove.textContent = '\u2715';
    btnRemove.title = 'Remove';
    (function(entityId) {
      btnRemove.addEventListener('click', function() {
        removeEntity(entityId);
        renderEntityPicker();   // sync picker checkboxes
        renderSelectedList();
      });
    }(ent.entity_id));

    row.appendChild(orderBtns);
    row.appendChild(eidSpan);
    row.appendChild(labelInput);
    row.appendChild(iconInput);
    row.appendChild(btnRemove);
    container.appendChild(row);
  });
}

// ── Save ───────────────────────────────────────────────────────────────────
async function handleSave() {
  var btn = qs('#save-btn');
  btn.disabled = true;

  var titleVal = qs('#cfg-title').value.trim();
  var payload = {
    panel_title: titleVal || 'Home',
    columns: parseInt(qs('#cfg-columns').value, 10),
    theme: qs('#cfg-theme').value,
    kiosk_mode: qs('#cfg-kiosk').checked,
    refresh_interval: parseInt(qs('#cfg-refresh').value, 10) || 30,
    entities: state.selectedEntities.map(function(e) {
      var out = { entity_id: e.entity_id };
      // Only include label when it differs from the bare entity_id
      if (e.label && e.label !== e.entity_id) out.label = e.label;
      if (e.icon) out.icon = e.icon;
      return out;
    }),
  };

  try {
    await saveConfig(payload);
    showStatus('Saved! Returning to panel\u2026', 'success');
    setTimeout(function() { window.location.href = '.'; }, 1500);
  } catch (err) {
    showStatus('Save failed: ' + ((err && err.message) || 'Unknown error'), 'error');
    btn.disabled = false;
  }
}

// ── Boot ───────────────────────────────────────────────────────────────────
async function boot() {
  try {
    // Load config and entity list in parallel
    var results = await Promise.all([getPanelConfig(), getAllEntities()]);
    var cfg = results[0];
    var entities = results[1];

    // Apply theme immediately so the page looks correct before paint
    applyTheme(cfg.theme || 'dark');

    // Populate settings form.
    // NOTE: /api/panel-config returns "title" (mapped from panel_title in options.json)
    qs('#cfg-title').value = cfg.title || '';
    qs('#cfg-columns').value = String(cfg.columns || 3);
    qs('#cfg-theme').value = cfg.theme || 'dark';
    qs('#cfg-kiosk').checked = !!(cfg.kiosk_mode);
    qs('#cfg-refresh').value = String(cfg.refresh_interval || 30);

    // Populate selected entities from the current configuration
    var configured = (cfg.entities && Array.isArray(cfg.entities)) ? cfg.entities : [];
    configured.forEach(function(e) {
      state.selectedEntities.push({
        entity_id: e.entity_id,
        label: e.label || '',
        icon: e.icon || '',
      });
    });

    // All available entities for the picker
    state.allEntities = Array.isArray(entities) ? entities : [];

    // Wire up search input
    qs('#entity-search').addEventListener('input', function(ev) {
      state.searchQuery = ev.target.value;
      renderEntityPicker();
    });

    // Wire up save button
    qs('#save-btn').addEventListener('click', handleSave);

    // Render everything
    renderDomainFilters();
    renderEntityPicker();
    renderSelectedList();

    // Reveal page
    qs('#cfg-loading').style.display = 'none';
    qs('#cfg-main').style.display = '';

  } catch (err) {
    qs('#cfg-loading').textContent =
      'Failed to load configuration: ' + ((err && err.message) ? err.message : String(err));
  }
}

document.addEventListener('DOMContentLoaded', function() { boot(); });
