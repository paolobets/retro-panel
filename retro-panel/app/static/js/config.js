/**
 * config.js — Page manager logic for Retro Panel config page.
 *
 * State shape:
 *   pages = [
 *     { id, title, icon, items: [
 *       { type: 'entity', entity_id, label, icon }
 *       { type: 'energy_flow', solar_power, battery_soc, battery_power, grid_power, home_power }
 *     ]}
 *   ]
 *
 * Plain IIFE — no ES modules. iOS 15 / legacy browser compatible.
 * Depends on config-api.js loaded before this script.
 */
(function () {
  'use strict';

  // ---- Application state ----
  var pages = [];
  var activePageIdx = 0;
  var allEntities = [];       // from /api/entities
  var filterDomain = '';
  var searchText = '';
  var energyEditIdx = null;   // index in items of the energy card being edited (null = adding new)

  // ---- Helpers ----

  function qs(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function genId() {
    return 'page_' + Math.random().toString(36).slice(2, 9);
  }

  function activePage() {
    return pages[activePageIdx] || null;
  }

  // ---- Page tab rendering ----

  function renderPageTabs() {
    var container = qs('page-tabs');
    if (!container) { return; }
    container.innerHTML = '';

    for (var i = 0; i < pages.length; i++) {
      (function (idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'page-tab-btn' + (idx === activePageIdx ? ' active' : '');
        btn.textContent = pages[idx].title || 'Page ' + (idx + 1);
        btn.addEventListener('click', function () { selectPage(idx); });
        container.appendChild(btn);
      })(i);
    }
  }

  function selectPage(idx) {
    activePageIdx = idx;
    showSection('page-editor');
    renderPageTabs();
    renderPageEditor();
  }

  // ---- Page editor rendering ----

  function renderPageEditor() {
    var page = activePage();
    if (!page) { return; }

    var titleInput = qs('page-title-input');
    var iconSelect = qs('page-icon-select');
    if (titleInput) { titleInput.value = page.title; }
    if (iconSelect) { iconSelect.value = page.icon || 'home'; }

    renderItemsList();
  }

  function renderItemsList() {
    var page = activePage();
    var container = qs('items-list');
    var countEl = qs('items-count');
    if (!container || !page) { return; }

    var items = page.items || [];
    if (countEl) { countEl.textContent = String(items.length); }

    if (items.length === 0) {
      container.innerHTML = '<p class="cfg-placeholder">No items yet. Add entities or an Energy Card below.</p>';
      return;
    }

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      html += '<div class="selected-row">';
      if (item.type === 'energy_flow') {
        html += '<span class="selected-id selected-id-energy">\u26A1 Power Flow Card</span>';
        html += '<div class="selected-actions">';
        if (i > 0) {
          html += '<button class="reorder-btn" type="button" data-action="up" data-idx="' + i + '">\u2191</button>';
        }
        if (i < items.length - 1) {
          html += '<button class="reorder-btn" type="button" data-action="down" data-idx="' + i + '">\u2193</button>';
        }
        html += '<button class="edit-energy-btn action-btn-sm" type="button" data-idx="' + i + '">Edit</button>';
        html += '<button class="remove-btn" type="button" data-idx="' + i + '">\u2715</button>';
      } else {
        html += '<span class="selected-id">' + esc(item.entity_id) + '</span>';
        html += '<div class="selected-actions">';
        if (i > 0) {
          html += '<button class="reorder-btn" type="button" data-action="up" data-idx="' + i + '">\u2191</button>';
        }
        if (i < items.length - 1) {
          html += '<button class="reorder-btn" type="button" data-action="down" data-idx="' + i + '">\u2193</button>';
        }
        html += '<button class="remove-btn" type="button" data-idx="' + i + '">\u2715</button>';
      }
      html += '</div>';
      html += '</div>';
    }
    container.innerHTML = html;

    // Bind reorder
    var reorderBtns = container.querySelectorAll('.reorder-btn');
    for (var j = 0; j < reorderBtns.length; j++) {
      reorderBtns[j].addEventListener('click', function () {
        var idx = parseInt(this.getAttribute('data-idx'), 10);
        reorderItem(idx, this.getAttribute('data-action') === 'up' ? -1 : 1);
      });
    }

    // Bind remove
    var removeBtns = container.querySelectorAll('.remove-btn');
    for (var k = 0; k < removeBtns.length; k++) {
      removeBtns[k].addEventListener('click', function () {
        removeItem(parseInt(this.getAttribute('data-idx'), 10));
      });
    }

    // Bind energy card edit
    var editBtns = container.querySelectorAll('.edit-energy-btn');
    for (var m = 0; m < editBtns.length; m++) {
      editBtns[m].addEventListener('click', function () {
        openEnergyEditor(parseInt(this.getAttribute('data-idx'), 10));
      });
    }
  }

  // ---- Page mutations ----

  function addPage() {
    var newPage = { id: genId(), title: 'New Page', icon: 'home', items: [] };
    pages.push(newPage);
    selectPage(pages.length - 1);
  }

  function deletePage() {
    if (pages.length <= 1) {
      showError('You must have at least one page.');
      return;
    }
    pages.splice(activePageIdx, 1);
    activePageIdx = Math.max(0, activePageIdx - 1);
    renderPageTabs();
    if (pages.length === 0) {
      showSection(null);
    } else {
      renderPageEditor();
    }
  }

  function commitPageTitle() {
    var page = activePage();
    if (!page) { return; }
    var v = (qs('page-title-input').value || '').trim();
    if (v) {
      page.title = v.slice(0, 64);
      renderPageTabs();
    }
  }

  function commitPageIcon() {
    var page = activePage();
    if (!page) { return; }
    page.icon = qs('page-icon-select').value || 'home';
  }

  // ---- Item mutations ----

  function reorderItem(idx, delta) {
    var page = activePage();
    if (!page) { return; }
    var items = page.items;
    var newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= items.length) { return; }
    var tmp = items[idx];
    items[idx] = items[newIdx];
    items[newIdx] = tmp;
    renderItemsList();
  }

  function removeItem(idx) {
    var page = activePage();
    if (!page) { return; }
    page.items.splice(idx, 1);
    renderItemsList();
    renderEntityList(); // refresh tick marks
  }

  // ---- Entity picker ----

  function isEntityOnPage(entityId) {
    var page = activePage();
    if (!page) { return false; }
    for (var i = 0; i < page.items.length; i++) {
      if (page.items[i].type === 'entity' && page.items[i].entity_id === entityId) {
        return true;
      }
    }
    return false;
  }

  function addEntityToPage(entityId, friendlyName) {
    var page = activePage();
    if (!page) { return; }
    if (isEntityOnPage(entityId)) { return; }
    page.items.push({
      type: 'entity',
      entity_id: entityId,
      label: friendlyName || '',
      icon: '',
    });
    renderItemsList();
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
      var sel = isEntityOnPage(e.entity_id);
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
        addEntityToPage(this.getAttribute('data-id'), this.getAttribute('data-name'));
      });
    }
  }

  // ---- Section visibility ----

  function showSection(id) {
    var sections = ['page-editor', 'entity-picker', 'energy-editor'];
    for (var i = 0; i < sections.length; i++) {
      var el = qs(sections[i]);
      if (el) {
        if (id && sections[i] === id) {
          el.classList.remove('hidden');
        } else {
          el.classList.add('hidden');
        }
      }
    }
  }

  // ---- Energy card editor ----

  function openEnergyEditor(itemIdx) {
    energyEditIdx = itemIdx;
    var page = activePage();
    var item = (itemIdx !== null && page) ? page.items[itemIdx] : null;

    // Populate fields
    qs('ef-solar').value    = (item && item.solar_power)   || '';
    qs('ef-batt-soc').value = (item && item.battery_soc)   || '';
    qs('ef-batt-pwr').value = (item && item.battery_power) || '';
    qs('ef-grid').value     = (item && item.grid_power)    || '';
    qs('ef-home').value     = (item && item.home_power)    || '';

    showSection('energy-editor');
  }

  function commitEnergyCard() {
    var item = {
      type: 'energy_flow',
      solar_power:    (qs('ef-solar').value    || '').trim(),
      battery_soc:    (qs('ef-batt-soc').value || '').trim(),
      battery_power:  (qs('ef-batt-pwr').value || '').trim(),
      grid_power:     (qs('ef-grid').value     || '').trim(),
      home_power:     (qs('ef-home').value     || '').trim(),
    };

    var page = activePage();
    if (!page) { return; }

    if (energyEditIdx !== null) {
      page.items[energyEditIdx] = item;
    } else {
      page.items.push(item);
    }
    energyEditIdx = null;

    showSection('page-editor');
    renderItemsList();
  }

  // ---- Save ----

  function save() {
    // Commit any in-progress edits
    commitPageTitle();
    commitPageIcon();

    var btn = qs('save-btn');
    btn.disabled = true;
    btn.textContent = 'Saving\u2026';

    cfgSavePages(pages)
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

  // ---- Init ----

  function init() {
    Promise.all([cfgFetchPanelConfig(), cfgFetchEntities()])
      .then(function (results) {
        var panelCfg = results[0];
        var entities = results[1];

        // Apply theme
        document.body.className = 'theme-' + (panelCfg.theme || 'dark');

        // Build pages from config
        if (panelCfg.pages && panelCfg.pages.length > 0) {
          pages = panelCfg.pages.map(function (p) {
            return {
              id:    p.id    || genId(),
              title: p.title || 'Page',
              icon:  p.icon  || 'home',
              items: (p.items || []).map(function (item) {
                if (item.type === 'energy_flow') {
                  return {
                    type: 'energy_flow',
                    solar_power:   item.solar_power   || '',
                    battery_soc:   item.battery_soc   || '',
                    battery_power: item.battery_power || '',
                    grid_power:    item.grid_power    || '',
                    home_power:    item.home_power    || '',
                  };
                }
                return {
                  type:      'entity',
                  entity_id: item.entity_id,
                  label:     item.label || '',
                  icon:      item.icon  || '',
                };
              }),
            };
          });
        } else {
          // No pages configured yet — start with one empty page
          pages = [{ id: genId(), title: 'Home', icon: 'home', items: [] }];
        }

        allEntities = entities || [];

        renderPageTabs();
        selectPage(0);
      })
      .catch(function (err) {
        var el = qs('entity-list');
        if (el) {
          el.innerHTML = '<p class="cfg-error">Failed to load: ' + esc(err.message) + '</p>';
        }
      });

    // Add Page button
    var addPageBtn = qs('add-page-btn');
    if (addPageBtn) { addPageBtn.addEventListener('click', addPage); }

    // Delete Page button
    var delPageBtn = qs('delete-page-btn');
    if (delPageBtn) { delPageBtn.addEventListener('click', deletePage); }

    // Page title: commit on blur and Enter
    var titleInput = qs('page-title-input');
    if (titleInput) {
      titleInput.addEventListener('blur', commitPageTitle);
      titleInput.addEventListener('keydown', function (e) {
        if (e.keyCode === 13) { this.blur(); }
      });
    }

    // Page icon: commit on change
    var iconSelect = qs('page-icon-select');
    if (iconSelect) { iconSelect.addEventListener('change', commitPageIcon); }

    // Add entity button
    var addEntityBtn = qs('add-entity-btn');
    if (addEntityBtn) {
      addEntityBtn.addEventListener('click', function () {
        showSection('entity-picker');
        renderEntityList();
      });
    }

    // Entity picker done
    var pickerDoneBtn = qs('picker-done-btn');
    if (pickerDoneBtn) {
      pickerDoneBtn.addEventListener('click', function () {
        showSection('page-editor');
      });
    }

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

    // Add Energy Card button
    var addEnergyBtn = qs('add-energy-btn');
    if (addEnergyBtn) {
      addEnergyBtn.addEventListener('click', function () {
        energyEditIdx = null;
        openEnergyEditor(null);
      });
    }

    // Energy done
    var energyDoneBtn = qs('energy-done-btn');
    if (energyDoneBtn) { energyDoneBtn.addEventListener('click', commitEnergyCard); }

    // Save
    var saveBtn = qs('save-btn');
    if (saveBtn) { saveBtn.addEventListener('click', save); }
  }

  document.addEventListener('DOMContentLoaded', init);
}());
