/**
 * media.js — Media Player entity tile component
 * Wide tile (2-col) when playing/paused, compact (120px) when idle/off.
 * Tap on area opens bottom sheet; mini buttons act directly.
 * No ES modules — loaded as regular script. iOS 12+ safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
 *
 * Exposes globally: window.MediaComponent = { createTile, updateTile }
 */
window.MediaComponent = (function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                            */
  /* ------------------------------------------------------------------ */
  var FEAT_PAUSE        = 1;
  var FEAT_SEEK         = 2;
  var FEAT_VOLUME_SET   = 4;
  var FEAT_VOLUME_MUTE  = 8;
  var FEAT_PREV         = 16;
  var FEAT_NEXT         = 32;
  var FEAT_TURN_ON      = 128;
  var FEAT_TURN_OFF     = 256;
  var FEAT_SELECT_SOURCE = 2048;
  var FEAT_STOP         = 4096;
  var FEAT_PLAY         = 16384;
  var FEAT_SHUFFLE      = 32768;
  var FEAT_SELECT_SOUND = 65536;
  var FEAT_REPEAT       = 131072;
  var FEAT_GROUPING     = 524288;

  var ACTIVE_STATES = { playing: 1, paused: 1, buffering: 1 };

  var STATE_TEXT = {
    playing:     'In riproduzione',
    paused:      'In pausa',
    buffering:   'Buffering\u2026',
    idle:        'Idle',
    standby:     'Standby',
    off:         'Off',
    unavailable: 'Non disponibile'
  };

  /* Gradient colors for cover art fallback, by device type keyword */
  var GRADIENTS = [
    { kw: ['tv', 'samsung', 'lg', 'sony'], colors: '#1565c0,#0d47a1' },
    { kw: ['sonos'],                         colors: '#e91e63,#9c27b0' },
    { kw: ['echo', 'alexa'],                 colors: '#00bcd4,#0097a7' },
    { kw: ['homepod', 'apple'],              colors: '#424242,#212121' }
  ];
  var DEFAULT_GRADIENT = '#7b1fa2,#512da8';

  function _gradient(entityId) {
    var lower = entityId.toLowerCase();
    for (var i = 0; i < GRADIENTS.length; i++) {
      for (var k = 0; k < GRADIENTS[i].kw.length; k++) {
        if (lower.indexOf(GRADIENTS[i].kw[k]) !== -1) {
          return GRADIENTS[i].colors;
        }
      }
    }
    return DEFAULT_GRADIENT;
  }

  function _hasFeat(features, flag) {
    return (features & flag) !== 0;
  }

  function _formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    var s = Math.floor(sec);
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  /* SVG icon helpers (inline, 18x18 default) */
  function _svgIcon(path, size) {
    var sz = size || 18;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="currentColor"><path d="' + path + '"/></svg>';
  }
  var ICO_PREV  = 'M6 6h2v12H6zm3.5 6l8.5 6V6z';
  var ICO_NEXT  = 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z';
  var ICO_PLAY  = 'M8 5v14l11-7z';
  var ICO_PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
  var ICO_STOP  = 'M6 6h12v12H6z';
  var ICO_VOL   = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z';
  var ICO_MUTE  = 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';
  var ICO_SHUFFLE = 'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z';
  var ICO_REPEAT = 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z';
  var ICO_POWER  = 'M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0119 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.27 1.08-4.29 2.76-5.57L6.34 5.02A8.94 8.94 0 003 12a9 9 0 0018 0c0-2.74-1.23-5.19-3.17-6.83z';
  var ICO_MUSIC  = 'M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z';
  var ICO_TV     = 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z';
  var ICO_SPEAKER = 'M12 3a9 9 0 00-9 9 9 9 0 009 9 9 9 0 009-9 9 9 0 00-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm0-11a4 4 0 00-4 4 4 4 0 004 4 4 4 0 004-4 4 4 0 00-4-4z';

  function _deviceIcon(entityId) {
    var lower = entityId.toLowerCase();
    if (lower.indexOf('tv') !== -1 || lower.indexOf('samsung') !== -1 || lower.indexOf('apple_tv') !== -1) return ICO_TV;
    if (lower.indexOf('sonos') !== -1 || lower.indexOf('speaker') !== -1 || lower.indexOf('homepod') !== -1) return ICO_SPEAKER;
    return ICO_MUSIC;
  }

  /* ------------------------------------------------------------------ */
  /* Bottom sheet state (singleton — one sheet for all media tiles)      */
  /* ------------------------------------------------------------------ */
  var _bsBuilt = false;
  var _overlay  = null;
  var _sheet    = null;
  var _entityId = null;
  var _debTimer = null;
  var _posTimer = null;
  var _lastAttrs = {};
  var _lastState = 'off';
  var _lastFeatures = 0;

  /* DOM refs (populated in _buildBS) */
  var _els = {};

  function _buildBS() {
    _overlay = document.getElementById('media-bs-overlay');
    _sheet   = document.getElementById('media-bs');
    if (!_overlay || !_sheet) {
      console.error('[MediaComponent] #media-bs-overlay or #media-bs not found');
      return;
    }

    _els.coverImg      = _sheet.querySelector('.mbs-cover-img');
    _els.coverFallback = _sheet.querySelector('.mbs-cover-fallback');
    _els.title         = _sheet.querySelector('.mbs-title');
    _els.artist        = _sheet.querySelector('.mbs-artist');
    _els.device        = _sheet.querySelector('.mbs-device');
    _els.state         = _sheet.querySelector('.mbs-state');
    _els.powerBtn      = _sheet.querySelector('.mbs-power-btn');
    _els.progressSec   = _sheet.querySelector('.mbs-progress-section');
    _els.progressFill  = _sheet.querySelector('.mbs-progress-fill');
    _els.timeCur       = _sheet.querySelector('.mbs-time-cur');
    _els.timeDur       = _sheet.querySelector('.mbs-time-dur');
    _els.transportWrap = _sheet.querySelector('.mbs-transport');
    _els.volumeSec     = _sheet.querySelector('.mbs-volume-section');
    _els.volMute       = _sheet.querySelector('.mbs-vol-mute');
    _els.volSlider     = _sheet.querySelector('.mbs-vol-slider');
    _els.volPct        = _sheet.querySelector('.mbs-vol-pct');
    _els.sourceSec     = _sheet.querySelector('.mbs-source-section');
    _els.sourceSelect  = _sheet.querySelector('.mbs-source-select');
    _els.soundmodeSec  = _sheet.querySelector('.mbs-soundmode-section');
    _els.soundmodeSelect = _sheet.querySelector('.mbs-soundmode-select');
    _els.groupSec      = _sheet.querySelector('.mbs-group-section');
    _els.groupList     = _sheet.querySelector('.mbs-group-list');

    /* Close handlers */
    _overlay.addEventListener('touchend', function (e) { e.preventDefault(); _closeBS(); });
    _overlay.addEventListener('click', _closeBS);
    var closeBtn = _sheet.querySelector('.mbs-close');
    if (closeBtn) {
      closeBtn.addEventListener('touchend', function (e) { e.preventDefault(); _closeBS(); });
      closeBtn.addEventListener('click', _closeBS);
    }

    /* Volume slider */
    if (_els.volSlider) {
      _els.volSlider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      _els.volSlider.addEventListener('input', function () {
        var pct = parseInt(_els.volSlider.value, 10);
        if (_els.volPct) { _els.volPct.textContent = pct + '%'; }
        _debounce(function () {
          window.callService('media_player', 'volume_set', {
            entity_id: _entityId,
            volume_level: pct / 100
          }).catch(function (e) { console.error('[media] volume_set:', e); });
        });
      });
    }

    /* Mute button */
    if (_els.volMute) {
      var doMute = function () {
        var muted = !(_lastAttrs.is_volume_muted || false);
        window.callService('media_player', 'volume_mute', {
          entity_id: _entityId,
          is_volume_muted: muted
        }).catch(function (e) { console.error('[media] volume_mute:', e); });
      };
      _els.volMute.addEventListener('touchend', function (e) { e.preventDefault(); doMute(); });
      _els.volMute.addEventListener('click', function () {
        if (!('ontouchstart' in window)) { doMute(); }
      });
    }

    /* Power button */
    if (_els.powerBtn) {
      var doPower = function () {
        var svc = (_lastState === 'off' || _lastState === 'standby') ? 'turn_on' : 'turn_off';
        window.callService('media_player', svc, { entity_id: _entityId })
          .catch(function (e) { console.error('[media] ' + svc + ':', e); });
      };
      _els.powerBtn.addEventListener('touchend', function (e) { e.preventDefault(); doPower(); });
      _els.powerBtn.addEventListener('click', function () {
        if (!('ontouchstart' in window)) { doPower(); }
      });
    }

    /* Source selector */
    if (_els.sourceSelect) {
      _els.sourceSelect.addEventListener('change', function () {
        window.callService('media_player', 'select_source', {
          entity_id: _entityId,
          source: _els.sourceSelect.value
        }).catch(function (e) { console.error('[media] select_source:', e); });
      });
    }

    /* Sound mode selector */
    if (_els.soundmodeSelect) {
      _els.soundmodeSelect.addEventListener('change', function () {
        window.callService('media_player', 'select_sound_mode', {
          entity_id: _entityId,
          sound_mode: _els.soundmodeSelect.value
        }).catch(function (e) { console.error('[media] select_sound_mode:', e); });
      });
    }

    _bsBuilt = true;
  }

  function _debounce(fn) {
    if (_debTimer) { clearTimeout(_debTimer); }
    _debTimer = setTimeout(fn, 300);
  }

  function _openBS(entityId, stateObj) {
    if (!_bsBuilt) { _buildBS(); }
    if (!_overlay || !_sheet) { return; }

    _entityId = entityId;
    _lastState = stateObj.state || 'off';
    _lastAttrs = stateObj.attributes || {};
    _lastFeatures = _lastAttrs.supported_features || 0;

    _updateBSContent();

    _overlay.classList.add('is-open');
    _sheet.classList.add('is-open');

    _startPositionTimer();
  }

  function _closeBS() {
    if (_overlay) { _overlay.classList.remove('is-open'); }
    if (_sheet)   { _sheet.classList.remove('is-open'); }
    _entityId = null;
    _stopPositionTimer();
    if (_debTimer) { clearTimeout(_debTimer); _debTimer = null; }
  }

  function _startPositionTimer() {
    _stopPositionTimer();
    if (_lastState !== 'playing') { return; }
    _posTimer = setInterval(function () {
      _updateProgress();
    }, 1000);
  }

  function _stopPositionTimer() {
    if (_posTimer) { clearInterval(_posTimer); _posTimer = null; }
  }

  function _updateProgress() {
    if (!_els.progressFill) { return; }
    var pos = _lastAttrs.media_position || 0;
    var updatedAt = _lastAttrs.media_position_updated_at;
    var dur = _lastAttrs.media_duration || 0;

    /* Interpolate position for playing state */
    if (_lastState === 'playing' && updatedAt) {
      var updatedTime = new Date(updatedAt).getTime();
      var elapsed = (Date.now() - updatedTime) / 1000;
      pos = pos + elapsed;
    }
    if (pos > dur && dur > 0) { pos = dur; }

    var pct = (dur > 0) ? Math.min(100, (pos / dur) * 100) : 0;
    _els.progressFill.style.width = pct + '%';
    if (_els.timeCur) { _els.timeCur.textContent = _formatTime(pos); }
    if (_els.timeDur) { _els.timeDur.textContent = _formatTime(dur); }
  }

  function _updateBSContent() {
    var attrs = _lastAttrs;
    var feat = _lastFeatures;

    /* Cover */
    _updateCover(_els.coverImg, _els.coverFallback, _entityId, attrs);

    /* Info */
    if (_els.title)  { _els.title.textContent = attrs.media_title || ''; }
    if (_els.artist) { _els.artist.textContent = attrs.media_artist || ''; }
    if (_els.device) { _els.device.textContent = attrs.friendly_name || _entityId; }
    if (_els.state) {
      _els.state.textContent = STATE_TEXT[_lastState] || _lastState;
      _els.state.className = 'mbs-state';
      if (_lastState === 'playing') { _els.state.className += ' s-playing'; }
      if (_lastState === 'paused')  { _els.state.className += ' s-paused'; }
    }

    /* Power button */
    if (_els.powerBtn) {
      var showPower = _hasFeat(feat, FEAT_TURN_ON) || _hasFeat(feat, FEAT_TURN_OFF);
      _els.powerBtn.style.display = showPower ? '' : 'none';
      _els.powerBtn.innerHTML = _svgIcon(ICO_POWER, 18);
    }

    /* Progress section */
    if (_els.progressSec) {
      var showProgress = _hasFeat(feat, FEAT_SEEK) && attrs.media_duration;
      _els.progressSec.style.display = showProgress ? '' : 'none';
      if (showProgress) { _updateProgress(); }
    }

    /* Transport buttons */
    _renderTransport(feat);

    /* Volume */
    if (_els.volumeSec) {
      var showVol = _hasFeat(feat, FEAT_VOLUME_SET);
      _els.volumeSec.style.display = showVol ? '' : 'none';
      if (showVol) {
        var vol = Math.round((attrs.volume_level || 0) * 100);
        if (_els.volSlider) { _els.volSlider.value = String(vol); }
        if (_els.volPct) { _els.volPct.textContent = vol + '%'; }
        if (_els.volMute) {
          _els.volMute.innerHTML = _svgIcon(attrs.is_volume_muted ? ICO_MUTE : ICO_VOL, 16);
          if (attrs.is_volume_muted) {
            _els.volMute.classList.add('is-muted');
          } else {
            _els.volMute.classList.remove('is-muted');
          }
        }
      }
    }

    /* Source */
    if (_els.sourceSec) {
      var showSource = _hasFeat(feat, FEAT_SELECT_SOURCE) && attrs.source_list && attrs.source_list.length;
      _els.sourceSec.style.display = showSource ? '' : 'none';
      if (showSource) {
        _populateSelect(_els.sourceSelect, attrs.source_list, attrs.source || '');
      }
    }

    /* Sound mode */
    if (_els.soundmodeSec) {
      var showSM = _hasFeat(feat, FEAT_SELECT_SOUND) && attrs.sound_mode_list && attrs.sound_mode_list.length;
      _els.soundmodeSec.style.display = showSM ? '' : 'none';
      if (showSM) {
        _populateSelect(_els.soundmodeSelect, attrs.sound_mode_list, attrs.sound_mode || '');
      }
    }

    /* Grouping */
    if (_els.groupSec) {
      var showGroup = _hasFeat(feat, FEAT_GROUPING);
      _els.groupSec.style.display = showGroup ? '' : 'none';
      if (showGroup) {
        _renderGrouping(attrs);
      }
    }
  }

  function _renderTransport(feat) {
    if (!_els.transportWrap) { return; }
    _els.transportWrap.innerHTML = '';

    function addBtn(cls, icon, size, handler) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'media-btn ' + cls;
      btn.innerHTML = _svgIcon(icon, size || 18);
      btn.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); handler(); });
      btn.addEventListener('click', function (e) { e.stopPropagation(); if (!('ontouchstart' in window)) { handler(); } });
      _els.transportWrap.appendChild(btn);
      return btn;
    }

    /* Shuffle */
    if (_hasFeat(feat, FEAT_SHUFFLE)) {
      var shBtn = addBtn('', ICO_SHUFFLE, 16, function () {
        var next = !(_lastAttrs.shuffle || false);
        window.callService('media_player', 'shuffle_set', { entity_id: _entityId, shuffle: next })
          .catch(function (e) { console.error('[media] shuffle_set:', e); });
      });
      if (_lastAttrs.shuffle) { shBtn.classList.add('mbs-btn-active'); }
    }

    /* Prev */
    if (_hasFeat(feat, FEAT_PREV)) {
      addBtn('', ICO_PREV, 24, function () {
        window.callService('media_player', 'media_previous_track', { entity_id: _entityId })
          .catch(function (e) { console.error('[media] prev:', e); });
      });
    }

    /* Play / Pause */
    if (_hasFeat(feat, FEAT_PLAY) || _hasFeat(feat, FEAT_PAUSE)) {
      var isPlaying = _lastState === 'playing';
      addBtn('media-btn-play', isPlaying ? ICO_PAUSE : ICO_PLAY, 24, function () {
        var svc = (_lastState === 'playing') ? 'media_pause' : 'media_play';
        window.callService('media_player', svc, { entity_id: _entityId })
          .catch(function (e) { console.error('[media] ' + svc + ':', e); });
      });
    }

    /* Next */
    if (_hasFeat(feat, FEAT_NEXT)) {
      addBtn('', ICO_NEXT, 24, function () {
        window.callService('media_player', 'media_next_track', { entity_id: _entityId })
          .catch(function (e) { console.error('[media] next:', e); });
      });
    }

    /* Repeat */
    if (_hasFeat(feat, FEAT_REPEAT)) {
      var repBtn = addBtn('', ICO_REPEAT, 16, function () {
        var modes = ['off', 'all', 'one'];
        var cur = _lastAttrs.repeat || 'off';
        var idx = modes.indexOf(cur);
        var next = modes[(idx + 1) % modes.length];
        window.callService('media_player', 'repeat_set', { entity_id: _entityId, repeat: next })
          .catch(function (e) { console.error('[media] repeat_set:', e); });
      });
      if (_lastAttrs.repeat && _lastAttrs.repeat !== 'off') { repBtn.classList.add('mbs-btn-active'); }
    }
  }

  function _populateSelect(selectEl, list, currentVal) {
    if (!selectEl) { return; }
    selectEl.innerHTML = '';
    for (var i = 0; i < list.length; i++) {
      var opt = document.createElement('option');
      opt.value = list[i];
      opt.textContent = list[i];
      if (list[i] === currentVal) { opt.selected = true; }
      selectEl.appendChild(opt);
    }
  }

  function _renderGrouping(attrs) {
    if (!_els.groupList) { return; }
    _els.groupList.innerHTML = '';
    var members = attrs.group_members || [];
    /* Find all media_player entities in the panel config */
    var allMedia = [];
    var appState = window._RP_AppState;
    if (appState && appState.config && appState.config.entities) {
      var entities = appState.config.entities;
      for (var i = 0; i < entities.length; i++) {
        if (entities[i].entity_id && entities[i].entity_id.indexOf('media_player.') === 0) {
          allMedia.push(entities[i]);
        }
      }
    }
    /* If no config access, just show current group members */
    if (allMedia.length === 0 && members.length > 0) {
      for (var m = 0; m < members.length; m++) {
        allMedia.push({ entity_id: members[m], label: members[m].split('.')[1].replace(/_/g, ' ') });
      }
    }

    for (var j = 0; j < allMedia.length; j++) {
      (function (mp) {
        var isMaster = mp.entity_id === _entityId;
        var isJoined = members.indexOf(mp.entity_id) !== -1;
        var item = document.createElement('div');
        item.className = 'mbs-group-item';

        var info = document.createElement('div');
        info.className = 'mbs-group-item-info';
        info.innerHTML = _svgIcon(ICO_SPEAKER, 18) + '<span class="mbs-group-item-name">' + (mp.label || mp.entity_id.split('.')[1].replace(/_/g, ' ')) + '</span>';
        item.appendChild(info);

        if (isMaster) {
          var badge = document.createElement('span');
          badge.className = 'mbs-group-master';
          badge.textContent = 'MASTER';
          item.appendChild(badge);
        } else {
          var check = document.createElement('div');
          check.className = 'mbs-group-check';
          if (isJoined) { check.classList.add('is-joined'); }
          item.appendChild(check);
          var doToggle = function () {
            if (isJoined) {
              window.callService('media_player', 'unjoin', { entity_id: mp.entity_id })
                .catch(function (e) { console.error('[media] unjoin:', e); });
            } else {
              var newMembers = members.slice();
              newMembers.push(mp.entity_id);
              window.callService('media_player', 'join', { entity_id: _entityId, group_members: newMembers })
                .catch(function (e) { console.error('[media] join:', e); });
            }
          };
          item.addEventListener('touchend', function (e) { e.preventDefault(); doToggle(); });
          item.addEventListener('click', function () { if (!('ontouchstart' in window)) { doToggle(); } });
        }

        _els.groupList.appendChild(item);
      })(allMedia[j]);
    }
  }

  function _updateCover(imgEl, fallbackEl, entityId, attrs) {
    if (!imgEl) { return; }
    var grad = _gradient(entityId);
    if (fallbackEl) {
      fallbackEl.style.background = 'linear-gradient(135deg,' + grad + ')';
      fallbackEl.innerHTML = _svgIcon(_deviceIcon(entityId), 32);
      var svgEl = fallbackEl.querySelector('svg');
      if (svgEl) {
        svgEl.style.opacity = '0.8';
        svgEl.style.fill = '#fff';
      }
    }
    /* Try to load cover via proxy; backend returns 404 if no entity_picture.
       Cache key = title|artist — only re-fetch when the track changes.
       After onerror the failed key is stored so the same track is not
       re-requested on every WebSocket state update (prevents 404 spam). */
    var cacheKey = (attrs.media_title || '') + '|' + (attrs.media_artist || '');
    var newSrc = 'api/media-cover/' + entityId + '?_t=' + encodeURIComponent(cacheKey);
    if (imgEl.dataset.mediaSrc !== newSrc && imgEl.dataset.mediaFailed !== cacheKey) {
      imgEl.dataset.mediaSrc = newSrc;
      imgEl.dataset.mediaFailed = '';
      imgEl.style.display = '';
      imgEl.onerror = function () {
        imgEl.style.display = 'none';
        imgEl.dataset.mediaFailed = cacheKey;
      };
      imgEl.onload = function () {
        imgEl.style.display = '';
        imgEl.dataset.mediaFailed = '';
      };
      imgEl.src = newSrc;
    }
  }

  /* ------------------------------------------------------------------ */
  /* createTile                                                           */
  /* ------------------------------------------------------------------ */
  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label     = entityConfig.label;

    var DOM = window.RP_DOM;

    /* Root tile — starts compact, updateTile switches layout */
    var tile = DOM.createElement('div', 'tile tile-media-compact');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'media_player';

    /* ---- Compact layout elements ---- */
    var compactIcon  = DOM.createElement('div', 'media-compact-icon');
    compactIcon.innerHTML = _svgIcon(_deviceIcon(entity_id), 28);
    var compactName  = DOM.createElement('div', 'media-compact-name', label);
    var compactState = DOM.createElement('div', 'media-compact-state', 'Off');
    tile.appendChild(compactIcon);
    tile.appendChild(compactName);
    tile.appendChild(compactState);

    /* ---- Wide layout elements (hidden initially) ---- */
    var wideWrap = DOM.createElement('div', 'media-wide-wrap');
    wideWrap.style.display = 'none';

    /* Cover */
    var coverWrap = DOM.createElement('div', 'media-cover');
    var coverFallback = DOM.createElement('div', 'media-cover-fallback');
    var coverImg = document.createElement('img');
    coverImg.className = 'media-cover-img';
    coverImg.alt = '';
    coverImg.style.display = 'none';
    coverWrap.appendChild(coverFallback);
    coverWrap.appendChild(coverImg);
    wideWrap.appendChild(coverWrap);

    /* Info area: two children — top block (title/artist/device) + transport */
    var infoArea = DOM.createElement('div', 'media-info');
    var infoTop  = DOM.createElement('div', 'media-info-top');
    var titleEl  = DOM.createElement('div', 'media-title');
    var artistEl = DOM.createElement('div', 'media-artist');
    var deviceEl = DOM.createElement('div', 'media-device', label);

    /* Transport row */
    var transport = DOM.createElement('div', 'media-transport');
    var transBtns = DOM.createElement('div', 'media-transport-btns');
    var volPct    = DOM.createElement('span', 'media-vol-pct');

    /* Prev button */
    var btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = 'media-btn';
    btnPrev.innerHTML = _svgIcon(ICO_PREV, 22);
    btnPrev.setAttribute('aria-label', 'Precedente');

    /* Play/Pause button */
    var btnPlay = document.createElement('button');
    btnPlay.type = 'button';
    btnPlay.className = 'media-btn media-btn-play';
    btnPlay.innerHTML = _svgIcon(ICO_PLAY, 20);
    btnPlay.setAttribute('aria-label', 'Play');

    /* Next button */
    var btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'media-btn';
    btnNext.innerHTML = _svgIcon(ICO_NEXT, 22);
    btnNext.setAttribute('aria-label', 'Successivo');

    transBtns.appendChild(btnPrev);
    transBtns.appendChild(btnPlay);
    transBtns.appendChild(btnNext);
    transport.appendChild(transBtns);
    transport.appendChild(volPct);

    infoTop.appendChild(titleEl);
    infoTop.appendChild(artistEl);
    infoTop.appendChild(deviceEl);
    infoArea.appendChild(infoTop);
    infoArea.appendChild(transport);
    wideWrap.appendChild(infoArea);
    tile.appendChild(wideWrap);

    /* ---- Button event handlers (direct actions, stopPropagation) ---- */
    function bindTransport(btn, svcFn) {
      btn.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); svcFn(); });
      btn.addEventListener('click', function (e) { e.stopPropagation(); if (!('ontouchstart' in window)) { svcFn(); } });
    }

    bindTransport(btnPrev, function () {
      window.callService('media_player', 'media_previous_track', { entity_id: entity_id })
        .catch(function (e) { console.error('[media] prev:', e); });
    });
    bindTransport(btnPlay, function () {
      var st = tile._lastState || 'off';
      var svc = (st === 'playing') ? 'media_pause' : 'media_play';
      window.callService('media_player', svc, { entity_id: entity_id })
        .catch(function (e) { console.error('[media] ' + svc + ':', e); });
    });
    bindTransport(btnNext, function () {
      window.callService('media_player', 'media_next_track', { entity_id: entity_id })
        .catch(function (e) { console.error('[media] next:', e); });
    });

    /* ---- Tile tap → open bottom sheet ---- */
    tile.addEventListener('touchend', function (e) {
      e.preventDefault();
      _openBS(entity_id, { state: tile._lastState || 'off', attributes: tile._lastAttrs || {} });
    });
    tile.addEventListener('click', function () {
      if (!('ontouchstart' in window)) {
        _openBS(entity_id, { state: tile._lastState || 'off', attributes: tile._lastAttrs || {} });
      }
    });

    /* Store refs for updateTile */
    tile._refs = {
      compactIcon: compactIcon, compactName: compactName, compactState: compactState,
      wideWrap: wideWrap, coverImg: coverImg, coverFallback: coverFallback,
      titleEl: titleEl, artistEl: artistEl, deviceEl: deviceEl,
      btnPlay: btnPlay, btnPrev: btnPrev, btnNext: btnNext, volPct: volPct
    };

    return tile;
  }

  /* ------------------------------------------------------------------ */
  /* updateTile                                                           */
  /* ------------------------------------------------------------------ */
  function updateTile(tile, stateObj) {
    var state = stateObj.state || 'off';
    var attrs = stateObj.attributes || {};
    var feat  = attrs.supported_features || 0;

    tile._lastState = state;
    tile._lastAttrs = attrs;

    var refs = tile._refs;
    if (!refs) { return; }

    var isActive = !!ACTIVE_STATES[state];
    var col = tile.parentNode;

    if (isActive) {
      /* Switch to wide layout */
      tile.className = 'tile tile-media-wide';
      if (state === 'playing')  { tile.classList.add('s-playing'); }
      if (state === 'paused')   { tile.classList.add('s-paused'); }
      if (state === 'buffering') { tile.classList.add('s-buffering'); }

      refs.compactIcon.style.display  = 'none';
      refs.compactName.style.display  = 'none';
      refs.compactState.style.display = 'none';
      refs.wideWrap.style.display     = '';

      if (col) { col.className = 'tile-col-media-wide'; }

      /* Update cover */
      _updateCover(refs.coverImg, refs.coverFallback, tile.dataset.entityId, attrs);

      /* Update info */
      refs.titleEl.textContent  = attrs.media_title || '';
      refs.artistEl.textContent = attrs.media_artist || '';

      /* Play/Pause icon */
      refs.btnPlay.innerHTML = _svgIcon(state === 'playing' ? ICO_PAUSE : ICO_PLAY, 20);
      refs.btnPlay.setAttribute('aria-label', state === 'playing' ? 'Pausa' : 'Play');

      /* Show/hide prev/next based on features */
      refs.btnPrev.style.display = _hasFeat(feat, FEAT_PREV) ? '' : 'none';
      refs.btnNext.style.display = _hasFeat(feat, FEAT_NEXT) ? '' : 'none';

      /* Volume percentage */
      var vol = Math.round((attrs.volume_level || 0) * 100);
      refs.volPct.innerHTML = _svgIcon(ICO_VOL, 14) + ' ' + vol + '%';

    } else {
      /* Switch to compact layout */
      tile.className = 'tile tile-media-compact';

      refs.compactIcon.style.display  = '';
      refs.compactName.style.display  = '';
      refs.compactState.style.display = '';
      refs.wideWrap.style.display     = 'none';

      if (col) { col.className = 'tile-col-compact'; }

      refs.compactState.textContent = STATE_TEXT[state] || state;
    }

    /* Update open bottom sheet if it's for this entity */
    if (_entityId === tile.dataset.entityId) {
      _lastState = state;
      _lastAttrs = attrs;
      _lastFeatures = feat;
      _updateBSContent();
      if (state === 'playing') {
        _startPositionTimer();
      } else {
        _stopPositionTimer();
      }
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
