/**
 * camera.js — Camera tile + lightbox component
 * Retro Panel v2.9.4
 *
 * Tile: snapshot polling every N seconds (configurable).
 * Lightbox: tries MJPEG stream first (api/camera-proxy-stream/); if HA
 *   returns 404 or the connection errors within 5 s, falls back to snapshot
 *   polling at the same interval configured for the tile.
 *
 * Status badge:
 *   • MJPEG active  → green dot + "Live Streaming"
 *   • Snapshot mode → amber dot + "Snapshot • Xs"
 *
 * No ES modules — IIFE + window global. iOS 12+ Safari safe.
 * No const/let/=>/?./?? — only var, function declarations, IIFE pattern.
 *
 * Exposes: window.CameraComponent = { createTile, updateTile, destroyAll, destroyForEntity }
 */
window.CameraComponent = (function () {
  'use strict';

  var _timers = [];            // Array of { entityId, timerId } for tile polling
  var _lb = null;              // Lightbox DOM node — lazy initialized on first tap
  var _lbPollTimer = null;     // interval ID for snapshot fallback polling
  var _lbStreamTimeout = null; // timeout to trigger fallback if stream never loads
  var _lbEntityId = null;      // entity currently shown in lightbox

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
    backdrop.addEventListener('touchend', function (e) { e.preventDefault(); _closeLightbox(); });

    var content = document.createElement('div');
    content.className = 'cam-lb-content';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'cam-lb-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '\u2715'; // ✕
    closeBtn.onclick = _closeLightbox;
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

    var modeSpan = document.createElement('span');
    modeSpan.className = 'cam-lb-mode';
    modeSpan.textContent = 'Live Streaming';

    liveEl.appendChild(dot);
    liveEl.appendChild(modeSpan);

    bar.appendChild(nameEl);
    bar.appendChild(liveEl);

    content.appendChild(closeBtn);
    content.appendChild(img);
    content.appendChild(bar);

    _lb.appendChild(backdrop);
    _lb.appendChild(content);

    document.body.appendChild(_lb);
  }

  // Update the badge: 'stream' = green + "Live Streaming",
  //                   'snapshot' = amber + "Snapshot • Xs"
  function _setLbMode(mode, refreshSec) {
    var dot     = _lb.querySelector('.cam-lb-dot');
    var modeSpan = _lb.querySelector('.cam-lb-mode');
    var liveEl  = _lb.querySelector('.cam-lb-live');
    if (!dot || !modeSpan || !liveEl) { return; }
    if (mode === 'stream') {
      dot.className      = 'cam-lb-dot';
      liveEl.className   = 'cam-lb-live';
      modeSpan.textContent = 'Live Streaming';
    } else {
      dot.className      = 'cam-lb-dot cam-lb-dot--snapshot';
      liveEl.className   = 'cam-lb-live cam-lb-live--snapshot';
      modeSpan.textContent = 'Snapshot \u2022 ' + (refreshSec || 2) + 's';
    }
  }

  function _openLightbox(entityId, name, refreshInterval) {
    _initLightbox();
    var img    = _lb.querySelector('.cam-lb-img');
    var nameEl = _lb.querySelector('.cam-lb-name');
    img.alt        = name;
    nameEl.textContent = name;
    _lb.className  = 'cam-lb cam-lb--open';

    // Clear any previous timers
    if (_lbPollTimer !== null)     { clearInterval(_lbPollTimer);  _lbPollTimer = null; }
    if (_lbStreamTimeout !== null) { clearTimeout(_lbStreamTimeout); _lbStreamTimeout = null; }
    img.onerror = null;
    img.onload  = null;
    img.src     = '';   // abort previous connection

    _lbEntityId = entityId;
    var _lbRefreshSec = refreshInterval || 2;

    // Optimistically show "Live Streaming" and attempt MJPEG stream
    _setLbMode('stream');

    img.onerror = function () {
      _startSnapshotFallback(_lbRefreshSec);
    };
    img.onload = function () {
      // First frame arrived — stream is healthy. Cancel the safety timeout.
      if (_lbStreamTimeout !== null) { clearTimeout(_lbStreamTimeout); _lbStreamTimeout = null; }
      img.onload = null; // don't re-fire on subsequent MJPEG frames
    };

    img.src = 'api/camera-proxy-stream/' + entityId;

    // Safety net: if no frame arrives within 5 s, fall back to snapshots
    _lbStreamTimeout = setTimeout(function () {
      _lbStreamTimeout = null;
      var lbImg = _lb ? _lb.querySelector('.cam-lb-img') : null;
      // If the img is still pointing at the stream URL, it hasn't loaded
      if (lbImg && lbImg.src && lbImg.src.indexOf('camera-proxy-stream') !== -1) {
        _startSnapshotFallback(_lbRefreshSec);
      }
    }, 5000);
  }

  function _startSnapshotFallback(refreshSec) {
    var img = _lb ? _lb.querySelector('.cam-lb-img') : null;
    if (!img) { return; }

    // Cancel safety timeout if still pending
    if (_lbStreamTimeout !== null) { clearTimeout(_lbStreamTimeout); _lbStreamTimeout = null; }
    // Stop any existing poll
    if (_lbPollTimer !== null) { clearInterval(_lbPollTimer); _lbPollTimer = null; }

    img.onerror = null;
    img.onload  = null;

    _setLbMode('snapshot', refreshSec);

    // Load first snapshot
    img.src = 'api/camera-proxy/' + _lbEntityId + '?_t=' + Date.now();

    // Start periodic refresh
    var intervalMs = Math.max(1000, (refreshSec || 2) * 1000);
    _lbPollTimer = setInterval(function () {
      var lbImg = _lb ? _lb.querySelector('.cam-lb-img') : null;
      if (lbImg) { lbImg.src = 'api/camera-proxy/' + _lbEntityId + '?_t=' + Date.now(); }
    }, intervalMs);
  }

  function _closeLightbox() {
    if (_lbPollTimer !== null)     { clearInterval(_lbPollTimer);    _lbPollTimer = null; }
    if (_lbStreamTimeout !== null) { clearTimeout(_lbStreamTimeout); _lbStreamTimeout = null; }
    _lbEntityId = null;
    if (_lb) {
      var img = _lb.querySelector('.cam-lb-img');
      if (img) {
        img.onerror = null;
        img.onload  = null;
        img.src     = ''; // abort MJPEG stream / stop snapshot load
      }
      _lb.className = 'cam-lb';
    }
  }

  // ---------------------------------------------------------------------------
  // Tile
  // ---------------------------------------------------------------------------
  function createTile(cfg) {
    var DOM = window.RP_DOM;
    var tile = DOM.createElement('div', 'tile tile-camera');
    tile.dataset.entityId  = cfg.entity_id;
    tile.dataset.layoutType = 'camera';

    var imgWrap = DOM.createElement('div', 'camera-img-wrap');

    var img = document.createElement('img');
    img.className = 'camera-img';
    img.alt = cfg.title || cfg.entity_id;

    var overlay = DOM.createElement('div', 'camera-overlay');
    var nameEl  = DOM.createElement('span', 'camera-name');
    nameEl.textContent = cfg.title || cfg.entity_id;
    overlay.appendChild(nameEl);

    var errorEl = DOM.createElement('div', 'camera-error hidden');
    errorEl.textContent = 'Camera unavailable';

    imgWrap.appendChild(img);
    imgWrap.appendChild(overlay);
    imgWrap.appendChild(errorEl);
    tile.appendChild(imgWrap);

    var _entityId = cfg.entity_id;
    var _name     = cfg.title || cfg.entity_id;
    var _ri       = cfg.refresh_interval || 2;

    tile.onclick = function () {
      _openLightbox(_entityId, _name, _ri);
    };

    // Load first snapshot immediately
    _loadSnapshot(img, errorEl, cfg.entity_id);

    // Tile polling — default 3 s, clamp 1–60 s
    var intervalMs = cfg.refresh_interval ? cfg.refresh_interval * 1000 : 3000;
    if (intervalMs < 1000)  { intervalMs = 1000; }
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
    img.onload  = function () { errorEl.classList.add('hidden'); };
    img.onerror = function () { errorEl.classList.remove('hidden'); };
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
    // Also stop lightbox if open
    if (_lbPollTimer !== null)     { clearInterval(_lbPollTimer);    _lbPollTimer = null; }
    if (_lbStreamTimeout !== null) { clearTimeout(_lbStreamTimeout); _lbStreamTimeout = null; }
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
    createTile:       createTile,
    updateTile:       updateTile,
    destroyAll:       destroyAll,
    destroyForEntity: destroyForEntity,
  };
}());
