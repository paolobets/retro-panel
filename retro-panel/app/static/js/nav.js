/**
 * nav.js — Sidebar navigation module for Retro Panel
 * IIFE che espone window.RP_Nav
 *
 * No ES modules. iOS 12+ Safari safe.
 * Niente const/let/arrow functions/import/export.
 *
 * Depends on: utils/dom.js, mdi-icons.js
 */
window.RP_Nav = (function () {
  'use strict';

  var ROOM_ICONS = {
    home:      'home',
    living:    'sofa',
    bedroom:   'bed',
    kitchen:   'stove',
    bathroom:  'shower',
    garden:    'tree',
    garage:    'garage',
    office:    'laptop',
    energy:    'lightning-bolt',
    security:  'shield-home',
    climate:   'thermometer',
    lights:    'lightbulb',
    dining:    'silverware-fork-knife',
    laundry:   'washing-machine',
    balcony:   'tree',
    gym:       'dumbbell',
    attic:     'warehouse',
    entry:     'door',
    server:    'desktop-tower',
    kids:      'toy-brick',
  };

  // Stato interno del modulo
  var _config = null;
  var _sidebarMode = 'main'; // 'main' | 'rooms'
  var _onNavigate = null;    // callback(sectionId) fornito da app.js
  var _sidebarCollapsed = false;

  // ---------------------------------------------------------------------------
  // Helper privati
  // ---------------------------------------------------------------------------

  function _getRoomIcon(iconName) {
    // Support direct MDI name (new style) — fall back to legacy semantic key map
    var paths = window.RP_MDI_PATHS || {};
    var mdiName = paths[iconName] ? iconName : (ROOM_ICONS[iconName] || 'home');
    return window.RP_MDI ? window.RP_MDI(mdiName, 22) : '';
  }

  function _mdi(name, size) {
    return window.RP_MDI ? window.RP_MDI(name, size || 22) : '';
  }

  function addNavItem(nav, sectionId, icon, label) {
    var DOM = window.RP_DOM;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sidebar-nav-item';
    btn.setAttribute('data-section', sectionId);

    var iconEl = DOM.createElement('span', 'sidebar-item-icon');
    iconEl.innerHTML = icon;
    var labelEl = DOM.createElement('span', 'sidebar-item-label');
    labelEl.textContent = label;
    btn.appendChild(iconEl);
    btn.appendChild(labelEl);

    btn.addEventListener('touchend', function (e) {
      e.preventDefault();
      _handleNavClick(sectionId);
    });
    btn.addEventListener('click', function () {
      if (!('ontouchstart' in window)) { _handleNavClick(sectionId); }
    });

    nav.appendChild(btn);
  }

  function addNavAction(nav, id, icon, label, action) {
    var DOM = window.RP_DOM;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'sidebar-nav-item';
    btn.id = id;
    btn.setAttribute('data-section', id);

    var iconEl = DOM.createElement('span', 'sidebar-item-icon');
    iconEl.innerHTML = icon;
    var labelEl = DOM.createElement('span', 'sidebar-item-label');
    labelEl.textContent = label;
    var chevron = DOM.createElement('span', 'sidebar-item-chevron');
    chevron.textContent = '\u203A';
    btn.appendChild(iconEl);
    btn.appendChild(labelEl);
    btn.appendChild(chevron);

    btn.addEventListener('touchend', function (e) {
      e.preventDefault();
      action();
    });
    btn.addEventListener('click', function () {
      if (!('ontouchstart' in window)) { action(); }
    });

    nav.appendChild(btn);
  }

  function _handleNavClick(sectionId) {
    // If in rooms submenu and navigating to a top-level section, revert to main menu
    if (_sidebarMode === 'rooms' && sectionId.indexOf('room:') !== 0) {
      showMainMenu(_config);
    }
    if (_onNavigate) { _onNavigate(sectionId); }
    setActiveSidebarItem(sectionId);
  }

  // ---------------------------------------------------------------------------
  // Funzioni pubbliche
  // ---------------------------------------------------------------------------

  function init(config, initialSection, onNavigate) {
    _config = config;
    _onNavigate = onNavigate;
    buildSidebar(config);
    setActiveSidebarItem(initialSection || 'overview');
  }

  function buildSidebar(config) {
    _sidebarMode = 'main';
    var nav = document.getElementById('sidebar-nav');
    if (!nav) { return; }
    nav.innerHTML = '';

    var ovCfg = config.overview || {};
    var overviewTitle = ovCfg.title || 'Overview';
    var overviewIcon  = ovCfg.icon  || 'home';

    addNavItem(nav, 'overview', _mdi(overviewIcon, 22), overviewTitle);

    // "Rooms" entry: apre il submenu se ci sono stanze, altrimenti è un normale nav item
    var visibleRooms = [];
    var rooms = config.rooms || [];
    for (var i = 0; i < rooms.length; i++) {
      if (!rooms[i].hidden) { visibleRooms.push(rooms[i]); }
    }

    if (visibleRooms.length > 0) {
      addNavAction(nav, 'rooms-menu', _mdi('floor-plan', 22), 'Rooms', function () {
        showRoomsSubmenu(_config);
      });
    }

    // Scenari
    if (config.scenarios && config.scenarios.length > 0) {
      var scSec = config.scenarios_section || {};
      addNavItem(nav, 'scenarios', _mdi(scSec.icon || 'palette', 22), scSec.title || 'Scenari');
    }

    // Telecamere
    if (config.cameras && config.cameras.length > 0) {
      var camSec = config.cameras_section || {};
      addNavItem(nav, 'cameras', _mdi(camSec.icon || 'cctv', 22), camSec.title || 'Cameras');
    }
  }

  function showRoomsSubmenu(config) {
    _sidebarMode = 'rooms';
    var DOM = window.RP_DOM;
    var nav = document.getElementById('sidebar-nav');
    if (!nav) { return; }
    nav.innerHTML = '';

    // Back button
    var backBtn = document.createElement('button');
    backBtn.id = 'sidebar-rooms-back';
    backBtn.type = 'button';
    backBtn.className = 'sidebar-nav-item sidebar-rooms-back-btn';

    var backIcon = DOM.createElement('span', 'sidebar-item-icon');
    backIcon.innerHTML = _mdi('arrow-left', 18) || '\u2190';
    var backLabel = DOM.createElement('span', 'sidebar-item-label');
    backLabel.textContent = 'Back';
    backBtn.appendChild(backIcon);
    backBtn.appendChild(backLabel);

    backBtn.addEventListener('touchend', function (e) {
      e.preventDefault();
      showMainMenu(_config);
    });
    backBtn.addEventListener('click', function () {
      if (!('ontouchstart' in window)) { showMainMenu(_config); }
    });

    nav.appendChild(backBtn);

    // Section header
    var header = DOM.createElement('div', 'sidebar-rooms-header');
    header.textContent = 'Rooms';
    nav.appendChild(header);

    // Lista rooms
    var rooms = config.rooms || [];
    for (var i = 0; i < rooms.length; i++) {
      var room = rooms[i];
      if (room.hidden) { continue; }
      (function (r) {
        addNavItem(nav, 'room:' + r.id, _getRoomIcon(r.icon), r.title);
      })(room);
    }

    setActiveSidebarItem(_currentSectionId());
  }

  function showMainMenu(config) {
    buildSidebar(config || _config);
    setActiveSidebarItem(_currentSectionId());
  }

  function _currentSectionId() {
    // Legge la sezione attiva dall'item attivo nel DOM (fallback: 'overview')
    var active = document.querySelector('.sidebar-nav-item.active');
    if (active) { return active.getAttribute('data-section') || 'overview'; }
    return 'overview';
  }

  function setActiveSidebarItem(sectionId) {
    var items = document.querySelectorAll('.sidebar-nav-item');
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var ds = item.getAttribute('data-section');
      // Attiva 'rooms-menu' se siamo in una room ma il menu è in modalità main
      var isActive = (ds === sectionId)
        || (sectionId && sectionId.indexOf('room:') === 0
            && ds === 'rooms-menu'
            && _sidebarMode === 'main');
      item.classList.toggle('active', !!isActive);
    }
  }

  function toggleSidebar() {
    _sidebarCollapsed = !_sidebarCollapsed;
    var sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('collapsed', _sidebarCollapsed);
    }
    var icon = document.querySelector('#sidebar-toggle .sidebar-toggle-icon');
    if (icon) {
      icon.innerHTML = _sidebarCollapsed ? '\u203A' : '&#9776;';
    }
  }

  function getSidebarMode() {
    return _sidebarMode;
  }

  return {
    init: init,
    buildSidebar: buildSidebar,
    showRoomsSubmenu: showRoomsSubmenu,
    showMainMenu: showMainMenu,
    setActiveSidebarItem: setActiveSidebarItem,
    toggleSidebar: toggleSidebar,
    getSidebarMode: getSidebarMode,
  };
}());
