/**
 * camera.js — Camera snapshot tile component
 * Mostra snapshot JPEG aggiornato periodicamente via /api/camera-proxy/{entity_id}
 * No ES modules. iOS 12+ Safari safe (no const/let/arrow/import/export).
 *
 * Espone globalmente: window.CameraComponent = { createTile, updateTile, destroyAll, destroyForEntity }
 */
window.CameraComponent = (function () {
  'use strict';

  var _timers = []; // Array di { entityId, timerId }

  function createTile(cfg) {
    var DOM = window.RP_DOM;
    var tile = DOM.createElement('div', 'tile camera-tile');
    tile.dataset.entityId = cfg.entity_id;

    var imgWrap = DOM.createElement('div', 'camera-img-wrap');

    var img = document.createElement('img');
    img.className = 'camera-img';
    img.alt = cfg.title || cfg.entity_id;

    var spinner = DOM.createElement('div', 'camera-spinner');

    var overlay = DOM.createElement('div', 'camera-overlay');
    var nameEl = DOM.createElement('span', 'camera-name');
    nameEl.textContent = cfg.title || cfg.entity_id;
    overlay.appendChild(nameEl);

    var errorEl = DOM.createElement('div', 'camera-error hidden');
    errorEl.textContent = 'Camera unavailable';

    imgWrap.appendChild(img);
    imgWrap.appendChild(spinner);
    imgWrap.appendChild(overlay);
    imgWrap.appendChild(errorEl);
    tile.appendChild(imgWrap);

    // Carica prima immagine
    _loadSnapshot(img, spinner, errorEl, cfg.entity_id);

    // Polling — clamp tra 3s e 60s
    var intervalMs = cfg.refresh_interval ? cfg.refresh_interval * 1000 : 10000;
    if (intervalMs < 3000) { intervalMs = 3000; }
    if (intervalMs > 60000) { intervalMs = 60000; }

    var timerId = setInterval(function () {
      _loadSnapshot(img, spinner, errorEl, cfg.entity_id);
    }, intervalMs);

    _timers.push({ entityId: cfg.entity_id, timerId: timerId });

    return tile;
  }

  function _loadSnapshot(img, spinner, errorEl, entityId) {
    spinner.classList.remove('hidden');
    errorEl.classList.add('hidden');
    var newSrc = 'api/camera-proxy/' + entityId + '?t=' + Date.now();
    img.onload = function () {
      spinner.classList.add('hidden');
    };
    img.onerror = function () {
      spinner.classList.add('hidden');
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
