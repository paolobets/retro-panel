/**
 * camera.js — Camera snapshot tile component
 * Retro Panel v2.9.4
 *
 * Shows snapshot JPEG updated periodically via /api/camera-proxy/{entity_id}.
 * No ES modules — IIFE + window global. iOS 12+ Safari safe.
 * No const/let/=>/?./?? — only var, function declarations, IIFE pattern.
 *
 * Exposes globally: window.CameraComponent = { createTile, updateTile, destroyAll, destroyForEntity }
 */
window.CameraComponent = (function () {
  'use strict';

  var _timers = [];        // Array of { entityId, timerId }
  var _lb = null;          // Lightbox DOM node — lazy initialized on first tap
  var _lbPollTimer = null; // F-03: interval ID for lightbox live refresh
  var _lbEntityId = null;  // F-03: entity currently shown in lightbox

  // ---------------------------------------------------------------------------
  // Lightbox — single overlay reused for all cameras
  // ---------------------------------------------------------------------------
  function _initLightbox() {
    if (_lb) { return; }

    _lb = document.createElement('div');
    _lb.id = 'cam-lightbox';
    _lb.className = 'cam-lb';

    var backdrop = document.createElement('div');
    backdrop.className = 'cam-lb-backdrop';
    backdrop.onclick = _closeLightbox;
    // F-04: reliable close on iOS 12 touch
    backdrop.addEventListener('touchend', function (e) { e.preventDefault(); _closeLightbox(); });

    var content = document.createElement('div');
    content.className = 'cam-lb-content';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'cam-lb-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '\u2715'; // ✕
    closeBtn.onclick = _closeLightbox;
    // F-04: reliable close on iOS 12 touch
    closeBtn.addEventListener('touchend', function (e) { e.preventDefault(); _closeLightbox(); });

    var img = document.createElement('img');
    img.className = 'cam-lb-img';
    img.alt = '';

    var bar = document.createElement('div');
    bar.className = 'cam-lb-bar';

    var nameEl = document.createElement('span');
    nameEl.className = 'cam-lb-name';

    var liveEl = document.createElement('span');
    liveEl.className = 'cam-lb-live';

    var dot = document.createElement('span');
    dot.className = 'cam-lb-dot';

    liveEl.appendChild(dot);
    liveEl.appendChild(document.createTextNode(' Live'));

    bar.appendChild(nameEl);
    bar.appendChild(liveEl);

    content.appendChild(closeBtn);
    content.appendChild(img);
    content.appendChild(bar);

    _lb.appendChild(backdrop);
    _lb.appendChild(content);

    document.body.appendChild(_lb);
  }

  function _openLightbox(entityId, name) {
    _initLightbox();
    var img = _lb.querySelector('.cam-lb-img');
    var nameEl = _lb.querySelector('.cam-lb-name');
    img.src = 'api/camera-proxy/' + entityId + '?_t=' + Date.now();
    img.alt = name;
    nameEl.textContent = name;
    _lb.className = 'cam-lb cam-lb--open';
    // F-03: avvia polling live per il lightbox
    if (_lbPollTimer !== null) { clearInterval(_lbPollTimer); }
    _lbEntityId = entityId;
    _lbPollTimer = setInterval(function () {
      var lbImg = _lb.querySelector('.cam-lb-img');
      lbImg.src = 'api/camera-proxy/' + _lbEntityId + '?_t=' + Date.now();
    }, 10000);
  }

  function _closeLightbox() {
    // F-03: ferma il polling live alla chiusura
    if (_lbPollTimer !== null) {
      clearInterval(_lbPollTimer);
      _lbPollTimer = null;
    }
    _lbEntityId = null;
    if (_lb) { _lb.className = 'cam-lb'; }
  }

  // ---------------------------------------------------------------------------
  // Tile
  // ---------------------------------------------------------------------------
  function createTile(cfg) {
    var DOM = window.RP_DOM;
    var tile = DOM.createElement('div', 'tile tile-camera');
    tile.dataset.entityId = cfg.entity_id;
    tile.dataset.layoutType = 'camera';

    var imgWrap = DOM.createElement('div', 'camera-img-wrap');

    var img = document.createElement('img');
    img.className = 'camera-img';
    img.alt = cfg.title || cfg.entity_id;

    var overlay = DOM.createElement('div', 'camera-overlay');
    var nameEl = DOM.createElement('span', 'camera-name');
    nameEl.textContent = cfg.title || cfg.entity_id;
    overlay.appendChild(nameEl);

    var errorEl = DOM.createElement('div', 'camera-error hidden');
    errorEl.textContent = 'Camera unavailable';

    imgWrap.appendChild(img);
    imgWrap.appendChild(overlay);
    imgWrap.appendChild(errorEl);
    tile.appendChild(imgWrap);

    // Click → open lightbox
    var _entityId = cfg.entity_id;
    var _name = cfg.title || cfg.entity_id;
    tile.onclick = function () {
      _openLightbox(_entityId, _name);
    };

    // Load first snapshot immediately
    _loadSnapshot(img, errorEl, cfg.entity_id);

    // Polling — clamp between 3s and 60s
    var intervalMs = cfg.refresh_interval ? cfg.refresh_interval * 1000 : 10000;
    if (intervalMs < 3000) { intervalMs = 3000; }
    if (intervalMs > 60000) { intervalMs = 60000; }

    var timerId = setInterval(function () {
      _loadSnapshot(img, errorEl, cfg.entity_id);
    }, intervalMs);

    _timers.push({ entityId: cfg.entity_id, timerId: timerId });

    return tile;
  }

  function _loadSnapshot(img, errorEl, entityId) {
    errorEl.classList.add('hidden');
    var newSrc = 'api/camera-proxy/' + entityId + '?t=' + Date.now();
    img.onload = function () {
      errorEl.classList.add('hidden');
    };
    img.onerror = function () {
      errorEl.classList.remove('hidden');
    };
    img.src = newSrc;
  }

  function updateTile(tile, stateObj) {
    if (!stateObj || stateObj.state === 'unavailable') {
      var errorEl = tile.querySelector('.camera-error');
      if (errorEl) { errorEl.classList.remove('hidden'); }
    }
  }

  function destroyAll() {
    for (var i = 0; i < _timers.length; i++) {
      clearInterval(_timers[i].timerId);
    }
    _timers = [];
  }

  function destroyForEntity(entityId) {
    var remaining = [];
    for (var i = 0; i < _timers.length; i++) {
      if (_timers[i].entityId === entityId) {
        clearInterval(_timers[i].timerId);
      } else {
        remaining.push(_timers[i]);
      }
    }
    _timers = remaining;
  }

  return {
    createTile: createTile,
    updateTile: updateTile,
    destroyAll: destroyAll,
    destroyForEntity: destroyForEntity,
  };
}());
