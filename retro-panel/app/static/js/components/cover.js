/**
 * cover.js — Cover/Tapparelle entity tile component v2.9.25
 * Fixed 120px tile, open/close/stop buttons, position bar.
 * States: open (green), closed (gray), opening/closing (orange pulse), unavailable.
 * No ES modules — loaded as regular script. iOS 12+ safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
 *
 * Exposes globally: window.CoverComponent = { createTile, updateTile }
 */
window.CoverComponent = (function () {
  'use strict';

  var COLOR_OPEN    = '#4caf50';
  var COLOR_MOVING  = '#ff9800';

  /* ------------------------------------------------------------------ */
  /* createTile                                                           */
  /* ------------------------------------------------------------------ */
  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label     = entityConfig.label;
    var icon      = entityConfig.icon;

    var DOM = window.RP_DOM;
    var FMT = window.RP_FMT;

    /* root tile */
    var tile = DOM.createElement('div', 'tile tile-cover');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'cover_standard';

    /* top row: icon + buttons */
    var top    = DOM.createElement('div', 'cover-top');
    var iconEl = DOM.createElement('span', 'cover-icon');
    iconEl.innerHTML = FMT.getIcon(icon, 26, entity_id);

    var btns     = DOM.createElement('div', 'cover-btns');
    var btnOpen  = DOM.createElement('button', 'cover-btn cover-btn-open');
    var btnStop  = DOM.createElement('button', 'cover-btn cover-btn-stop');
    var btnClose = DOM.createElement('button', 'cover-btn cover-btn-close');
    btnOpen.innerHTML  = FMT.getIcon('mdi:arrow-up', 18, '');
    btnStop.innerHTML  = FMT.getIcon('mdi:stop', 18, '');
    btnClose.innerHTML = FMT.getIcon('mdi:arrow-down', 18, '');
    btnOpen.setAttribute('aria-label', 'Apri');
    btnStop.setAttribute('aria-label', 'Stop');
    btnClose.setAttribute('aria-label', 'Chiudi');
    btns.appendChild(btnOpen);
    btns.appendChild(btnStop);
    btns.appendChild(btnClose);
    top.appendChild(iconEl);
    top.appendChild(btns);
    tile.appendChild(top);

    /* position bar row */
    var posWrap = DOM.createElement('div', 'cover-pos-wrap');
    var track   = DOM.createElement('div', 'cover-bar-track');
    var fill    = DOM.createElement('div', 'cover-bar-fill');
    var pct     = DOM.createElement('span', 'cover-pos-pct', '—');
    track.appendChild(fill);
    posWrap.appendChild(track);
    posWrap.appendChild(pct);
    tile.appendChild(posWrap);

    /* label */
    var labelEl = DOM.createElement('span', 'cover-label', label);
    tile.appendChild(labelEl);

    /* ---- Button interactions ---- */
    function callCover(service, e) {
      e.stopPropagation();
      e.preventDefault();
      window.callService('cover', service, { entity_id: entity_id })
        .catch(function (err) {
          console.error('[cover] ' + service + ' failed:', err);
        });
    }

    function bindBtn(btn, service) {
      btn.addEventListener('touchend', function (e) { callCover(service, e); });
      btn.addEventListener('click',    function (e) { callCover(service, e); });
    }

    bindBtn(btnOpen,  'open_cover');
    bindBtn(btnStop,  'stop_cover');
    bindBtn(btnClose, 'close_cover');

    return tile;
  }

  /* ------------------------------------------------------------------ */
  /* updateTile                                                           */
  /* ------------------------------------------------------------------ */
  function updateTile(tile, stateObj) {
    var state    = stateObj.state;
    var attrs    = stateObj.attributes || {};
    var position = attrs.current_position;

    tile.dataset.state = state;
    tile.classList.remove('s-open', 's-closed', 's-opening', 's-closing', 's-unavail');

    var iconEl  = tile.querySelector('.cover-icon');
    var fillEl  = tile.querySelector('.cover-bar-fill');
    var pctEl   = tile.querySelector('.cover-pos-pct');
    var posWrap = tile.querySelector('.cover-pos-wrap');

    if (state === 'unavailable') {
      tile.classList.add('s-unavail');
      if (iconEl) { iconEl.style.color = ''; }
      if (fillEl) { fillEl.style.width = '0%'; fillEl.style.background = ''; }
      if (pctEl)  { pctEl.textContent = '—'; }

    } else if (state === 'open') {
      tile.classList.add('s-open');
      if (iconEl) { iconEl.style.color = COLOR_OPEN; }
      if (fillEl) { fillEl.style.background = COLOR_OPEN; }

    } else if (state === 'closed') {
      tile.classList.add('s-closed');
      if (iconEl) { iconEl.style.color = ''; }
      if (fillEl) { fillEl.style.background = ''; }

    } else if (state === 'opening' || state === 'closing') {
      tile.classList.add(state === 'opening' ? 's-opening' : 's-closing');
      if (iconEl) { iconEl.style.color = COLOR_MOVING; }
      if (fillEl) { fillEl.style.background = COLOR_MOVING; }

    } else {
      /* partial or unknown state */
      if (iconEl) { iconEl.style.color = ''; }
      if (fillEl) { fillEl.style.background = ''; }
    }

    /* Position bar */
    if (typeof position === 'number') {
      if (posWrap) { posWrap.style.display = ''; }
      if (fillEl)  { fillEl.style.width = position + '%'; }
      if (pctEl)   { pctEl.textContent = position + '%'; }
    } else {
      if (posWrap) { posWrap.style.display = 'none'; }
      if (pctEl)   { pctEl.textContent = '—'; }
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
