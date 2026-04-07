/**
 * camera.js — Camera tile + lightbox component
 * Retro Panel v2.11.0
 *
 * Tile: snapshot polling every N seconds (configurable).
 *
 * Lightbox mode selection (automatic):
 *   1. HLS (iOS/Safari only): GET api/camera-stream/ → <video> element
 *      Badge: blue dot + "HLS Live"
 *   2. MJPEG (Chrome/Firefox): api/camera-proxy-stream/ → <img> element
 *      Falls back on onerror or after 5 s safety timeout.
 *      Badge: green dot + "Live Streaming"
 *   3. Snapshot: api/camera-proxy/ polling at refresh_interval seconds
 *      Badge: amber dot + "Snapshot • Xs"
 *
 * No ES modules — IIFE + window global. iOS 12+ Safari safe.
 * No const/let/=>/?./?? — only var, function declarations, IIFE pattern.
 *
 * Exposes: window.CameraComponent = { createTile, updateTile, destroyAll, destroyForEntity }
 */
window.CameraComponent = (function () {
  'use strict';

  // Detect HLS support: Safari family returns 'maybe' or 'probably'.
  // Chrome/Firefox return '' (empty string) — no native HLS in <video>.
  var _hlsSupported = (function () {
    try {
      var v = document.createElement('video');
      return v.canPlayType('application/vnd.apple.mpegurl') !== '';
    } catch (e) {
      return false;
    }
  }());

  var _timers = [];            // Array of { entityId, timerId } for tile polling
  var _lb = null;              // Lightbox DOM node — lazy initialized on first tap
  var _lbPollTimer = null;     // interval ID for snapshot fallback polling
  var _lbStreamTimeout = null; // timeout to trigger MJPEG fallback if stream never loads
  var _lbEntityId = null;      // entity currently shown in lightbox
  var _lbStreamXhr = null;     // in-flight XHR for /api/camera-stream/ (abort on close)

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

    // <img> element — used for MJPEG and snapshot modes
    var img = document.createElement('img');
    img.className = 'cam-lb-img';
    img.alt = '';

    // <video> element — used for HLS on iOS/Safari
    var video = document.createElement('video');
    video.className = 'cam-lb-video';
    video.setAttribute('muted', '');
    video.muted = true;
    video.setAttribute('playsinline', '');
    video.playsInline = true;
    video.setAttribute('autoplay', '');
    video.autoplay = true;
    video.setAttribute('preload', 'auto');

    // Tap-to-play hint for when iOS blocks autoplay
    var tapHint = document.createElement('div');
    tapHint.className = 'cam-lb-tap-hint';
    tapHint.textContent = '\u25B6 Tocca per avviare';
    tapHint.addEventListener('touchend', function (e) {
      e.preventDefault();
      tapHint.classList.remove('visible');
      video.play();
    });
    tapHint.onclick = function () {
      tapHint.classList.remove('visible');
      video.play();
    };

    // video error / stall → fall back to MJPEG/snapshot
    video.addEventListener('error', function () {
      _tryMjpegFallback(_lbEntityId, _lb ? _lb.querySelector('.cam-lb-img') : null, 2);
    });

    // If video stays paused after 3 s (iOS blocked autoplay), show tap hint
    video.addEventListener('canplay', function () {
      var v = video;
      setTimeout(function () {
        if (v.paused) { tapHint.classList.add('visible'); }
      }, 3000);
    });

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
    content.appendChild(video);
    content.appendChild(tapHint);
    content.appendChild(bar);

    _lb.appendChild(backdrop);
    _lb.appendChild(content);

    document.body.appendChild(_lb);
  }

  // Set badge: 'hls' | 'stream' | 'snapshot'
  function _setLbMode(mode, refreshSec) {
    var dot      = _lb.querySelector('.cam-lb-dot');
    var modeSpan = _lb.querySelector('.cam-lb-mode');
    var liveEl   = _lb.querySelector('.cam-lb-live');
    if (!dot || !modeSpan || !liveEl) { return; }

    dot.className    = 'cam-lb-dot';
    liveEl.className = 'cam-lb-live';

    if (mode === 'hls') {
      dot.className    = 'cam-lb-dot cam-lb-dot--hls';
      liveEl.className = 'cam-lb-live cam-lb-live--hls';
      modeSpan.textContent = 'HLS Live';
    } else if (mode === 'stream') {
      modeSpan.textContent = 'Live Streaming';
    } else {
      dot.className    = 'cam-lb-dot cam-lb-dot--snapshot';
      liveEl.className = 'cam-lb-live cam-lb-live--snapshot';
      modeSpan.textContent = 'Snapshot \u2022 ' + (refreshSec || 2) + 's';
    }
  }

  // Show/hide video vs img
  function _showVideo() {
    var img   = _lb ? _lb.querySelector('.cam-lb-img')   : null;
    var video = _lb ? _lb.querySelector('.cam-lb-video') : null;
    if (img)   { img.classList.add('hidden-for-video'); }
    if (video) { video.classList.add('active'); }
  }

  function _showImg() {
    var img   = _lb ? _lb.querySelector('.cam-lb-img')   : null;
    var video = _lb ? _lb.querySelector('.cam-lb-video') : null;
    if (img)   { img.classList.remove('hidden-for-video'); }
    if (video) { video.classList.remove('active'); }
  }

  // ---------------------------------------------------------------------------
  // HLS playback
  // ---------------------------------------------------------------------------
  function _startHlsPlayback(hlsUrl) {
    var video = _lb ? _lb.querySelector('.cam-lb-video') : null;
    if (!video) { return; }
    _showVideo();
    _setLbMode('hls');
    video.src = hlsUrl;
    video.load();
    video.play();
  }

  // ---------------------------------------------------------------------------
  // MJPEG fallback (for non-HLS browsers or when HLS not supported by camera)
  // ---------------------------------------------------------------------------
  function _tryMjpegFallback(entityId, img, refreshSec) {
    if (!img || !entityId) { return; }
    _showImg();
    _setLbMode('stream');

    img.onerror = function () {
      _startSnapshotFallback(entityId, refreshSec);
    };
    img.onload = function () {
      if (_lbStreamTimeout !== null) { clearTimeout(_lbStreamTimeout); _lbStreamTimeout = null; }
      img.onload = null;
    };
    img.src = 'api/camera-proxy-stream/' + entityId;

    // Safety net: no frame in 5 s → snapshot
    _lbStreamTimeout = setTimeout(function () {
      _lbStreamTimeout = null;
      var lbImg = _lb ? _lb.querySelector('.cam-lb-img') : null;
      if (lbImg && lbImg.src && lbImg.src.indexOf('camera-proxy-stream') !== -1) {
        _startSnapshotFallback(entityId, refreshSec);
      }
    }, 5000);
  }

  // ---------------------------------------------------------------------------
  // Snapshot polling fallback
  // ---------------------------------------------------------------------------
  function _startSnapshotFallback(entityId, refreshSec) {
    var img = _lb ? _lb.querySelector('.cam-lb-img') : null;
    if (!img) { return; }

    if (_lbStreamTimeout !== null) { clearTimeout(_lbStreamTimeout); _lbStreamTimeout = null; }
    if (_lbPollTimer !== null)     { clearInterval(_lbPollTimer);    _lbPollTimer = null; }

    img.onerror = null;
    img.onload  = null;
    _showImg();
    _setLbMode('snapshot', refreshSec);

    img.src = 'api/camera-proxy/' + entityId + '?_t=' + Date.now();

    var intervalMs = Math.max(1000, (refreshSec || 2) * 1000);
    _lbPollTimer = setInterval(function () {
      var lbImg = _lb ? _lb.querySelector('.cam-lb-img') : null;
      if (lbImg) { lbImg.src = 'api/camera-proxy/' + entityId + '?_t=' + Date.now(); }
    }, intervalMs);
  }

  // ---------------------------------------------------------------------------
  // Open lightbox
  // ---------------------------------------------------------------------------
  function _openLightbox(entityId, name, refreshInterval) {
    _initLightbox();

    var img    = _lb.querySelector('.cam-lb-img');
    var video  = _lb.querySelector('.cam-lb-video');
    var nameEl = _lb.querySelector('.cam-lb-name');
    var tap    = _lb.querySelector('.cam-lb-tap-hint');

    nameEl.textContent = name;
    _lb.className = 'cam-lb cam-lb--open';

    // Clear previous state
    if (_lbStreamXhr !== null)      { _lbStreamXhr.abort();       _lbStreamXhr = null; }
    if (_lbPollTimer !== null)      { clearInterval(_lbPollTimer); _lbPollTimer = null; }
    if (_lbStreamTimeout !== null)  { clearTimeout(_lbStreamTimeout); _lbStreamTimeout = null; }

    img.onerror = null;
    img.onload  = null;
    img.src     = '';
    img.classList.remove('hidden-for-video');

    if (video) {
      video.pause();
      video.src = '';
      video.classList.remove('active');
    }
    if (tap) { tap.classList.remove('visible'); }

    _lbEntityId = entityId;
    var _lbRefreshSec = refreshInterval || 2;

    if (_hlsSupported) {
      // iOS/Safari: try HLS first
      _setLbMode('hls');
      var xhr = new XMLHttpRequest();
      _lbStreamXhr = xhr;
      xhr.open('GET', 'api/camera-stream/' + entityId, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) { return; }
        _lbStreamXhr = null;
        if (xhr.status === 200) {
          var data;
          try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
          if (data && data.supported && data.url) {
            _startHlsPlayback(data.url);
            return;
          }
        }
        // HLS not available — fall through to MJPEG/snapshot
        _tryMjpegFallback(entityId, _lb.querySelector('.cam-lb-img'), _lbRefreshSec);
      };
      xhr.timeout = 8000;
      xhr.ontimeout = function () {
        _lbStreamXhr = null;
        _tryMjpegFallback(entityId, _lb.querySelector('.cam-lb-img'), _lbRefreshSec);
      };
      xhr.send();
    } else {
      // Chrome/Firefox: skip HLS, go directly to MJPEG/snapshot flow
      _tryMjpegFallback(entityId, img, _lbRefreshSec);
    }
  }

  // ---------------------------------------------------------------------------
  // Close lightbox
  // ---------------------------------------------------------------------------
  function _closeLightbox() {
    if (_lbStreamXhr !== null)      { _lbStreamXhr.abort();          _lbStreamXhr = null; }
    if (_lbPollTimer !== null)      { clearInterval(_lbPollTimer);    _lbPollTimer = null; }
    if (_lbStreamTimeout !== null)  { clearTimeout(_lbStreamTimeout); _lbStreamTimeout = null; }
    _lbEntityId = null;

    if (_lb) {
      var img   = _lb.querySelector('.cam-lb-img');
      var video = _lb.querySelector('.cam-lb-video');
      var tap   = _lb.querySelector('.cam-lb-tap-hint');

      if (img) {
        img.onerror = null;
        img.onload  = null;
        img.src     = '';
        img.classList.remove('hidden-for-video');
      }
      if (video) {
        video.pause();
        video.src = '';
        video.classList.remove('active');
      }
      if (tap) { tap.classList.remove('visible'); }

      _lb.className = 'cam-lb';
    }
  }

  // ---------------------------------------------------------------------------
  // Tile
  // ---------------------------------------------------------------------------
  function createTile(cfg) {
    var DOM = window.RP_DOM;
    var tile = DOM.createElement('div', 'tile tile-camera');
    tile.dataset.entityId   = cfg.entity_id;
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
    if (_lbPollTimer !== null)     { clearInterval(_lbPollTimer);    _lbPollTimer = null; }
    if (_lbStreamTimeout !== null) { clearTimeout(_lbStreamTimeout); _lbStreamTimeout = null; }
    if (_lbStreamXhr !== null)     { _lbStreamXhr.abort();           _lbStreamXhr = null; }
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
