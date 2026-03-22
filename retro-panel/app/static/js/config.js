/**
 * config.js — Entity picker logic for the Retro Panel config page.
 *
 * Plain IIFE (no ES modules) for iOS 15 / legacy browser compatibility.
 * Depends on config-api.js loaded before this script.
 */
(function () {
  'use strict';

  var allEntities = [];  // full list from /api/entities
  var selected = [];     // [{entity_id, label}] — ordered list being built
  var filterDomain = '';
  var searchText = '';

  // ---- Helpers ----

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isSelected(entityId) {
    for (var i = 0; i < selected.length; i++) {
      if (selected[i].entity_id === entityId) { return true; }
    }
    return false;
  }

  function qs(id) { return document.getElementById(id); }

  // ---- Render: available entity list ----

  function renderEntityList() {
    var container = qs('entity-list');
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
      var sel = isSelected(e.entity_id);
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
          + ' data-name="' + esc(e.friendly_name || '') + '"'
          + '>+</button>';
      }
      html += '</div>';
    }
    container.innerHTML = html;

    var addBtns = container.querySelectorAll('.add-btn');
    for (var j = 0; j < addBtns.length; j++) {
      addBtns[j].addEventListener('click', function () {
        addEntity(this.getAttribute('data-id'), this.getAttribute('data-name'));
      });
    }
  }

  // ---- Render: selected entity list ----

  function renderSelected() {
    var container = qs('selected-list');
    var countEl = qs('selected-count');
    if (countEl) { countEl.textContent = String(selected.length); }

    if (selected.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No entities selected. Add from the list above.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < selected.length; i++) {
      var e = selected[i];
      html += '<div class="selected-row">';
      html += '<span class="selected-id">' + esc(e.entity_id) + '</span>';
      html += '<div class="selected-actions">';
      if (i > 0) {
        html += '<button class="reorder-btn" type="button" data-action="up" data-idx="' + i + '">&#8593;</button>';
      }
      if (i < selected.length - 1) {
        html += '<button class="reorder-btn" type="button" data-action="down" data-idx="' + i + '">&#8595;</button>';
      }
      html += '<button class="remove-btn" type="button" data-idx="' + i + '">&#10005;</button>';
      html += '</div>';
      html += '</div>';
    }
    container.innerHTML = html;

    var reorderBtns = container.querySelectorAll('.reorder-btn');
    for (var j = 0; j < reorderBtns.length; j++) {
      reorderBtns[j].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        reorder(idx, this.getAttribute('data-action') === 'up' ? -1 : 1);
      });
    }

    var removeBtns = container.querySelectorAll('.remove-btn');
    for (var k = 0; k < removeBtns.length; k++) {
      removeBtns[k].addEventListener('click', function () {
        removeEntity(parseInt(this.getAttribute('data-idx'), 10));
      });
    }
  }

  // ---- Mutations ----

  function addEntity(entityId, friendlyName) {
    if (isSelected(entityId)) { return; }
    selected.push({ entity_id: entityId, label: friendlyName || '' });
    renderEntityList();
    renderSelected();
    var sel = qs('selected-section');
    if (sel) { sel.scrollIntoView({ behavior: 'smooth' }); }
  }

  function removeEntity(idx) {
    selected.splice(idx, 1);
    renderEntityList();
    renderSelected();
  }

  function reorder(idx, delta) {
    var newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= selected.length) { return; }
    var tmp = selected[idx];
    selected[idx] = selected[newIdx];
    selected[newIdx] = tmp;
    renderSelected();
  }

  // ---- Save ----

  function saveAndRedirect() {
    var btn = qs('save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    var payload = selected.map(function (e) {
      return { entity_id: e.entity_id, label: e.label || '' };
    });

    cfgSaveConfig(payload)
      .then(function () {
        btn.textContent = 'Saved!';
        setTimeout(function () {
          window.location.href = './';
        }, 800);
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Save';
        showError(err.message || 'Save failed');
      });
  }

  function showError(msg) {
    var fb = qs('save-feedback');
    if (!fb) { return; }
    fb.textContent = 'Error: ' + msg;
    fb.className = '';
    setTimeout(function () { fb.className = 'hidden'; }, 5000);
  }

  // ---- getElementById shorthand used in render (fix: use document.getElementById not qs) ----
  // NOTE: qs() above uses getElementById — redefine to avoid confusion with the DOM util
  function qs(id) { return document.getElementById(id); }

  // ---- Init ----

  function init() {
    Promise.all([cfgFetchPanelConfig(), cfgFetchEntities()])
      .then(function (results) {
        var panelCfg = results[0];
        var entities = results[1];

        // Apply theme to match the main panel
        document.body.className = 'theme-' + (panelCfg.theme || 'dark');

        // Pre-populate selected from current panel config
        selected = (panelCfg.entities || []).map(function (e) {
          return { entity_id: e.entity_id, label: e.label || '' };
        });

        allEntities = entities || [];

        renderEntityList();
        renderSelected();
      })
      .catch(function (err) {
        var el = qs('entity-list');
        if (el) {
          el.innerHTML = '<p class="cfg-error">Failed to load: ' + esc(err.message) + '</p>';
        }
      });

    // Search
    var searchEl = qs('search-input');
    if (searchEl) {
      searchEl.addEventListener('input', function () {
        searchText = this.value.toLowerCase();
        renderEntityList();
      });
    }

    // Domain filter pills
    var filterBtns = document.querySelectorAll('.filter-btn');
    for (var i = 0; i < filterBtns.length; i++) {
      filterBtns[i].addEventListener('click', function () {
        filterDomain = this.getAttribute('data-domain');
        var btns = document.querySelectorAll('.filter-btn');
        for (var j = 0; j < btns.length; j++) { btns[j].classList.remove('active'); }
        this.classList.add('active');
        renderEntityList();
      });
    }

    // Save
    var saveBtn = qs('save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveAndRedirect);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
}());
