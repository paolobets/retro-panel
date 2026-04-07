/**
 * notifications.js — Retro Panel notification manager
 *
 * iOS 12 safe: var only, no arrow functions, no ?. or ??, no const/let.
 *
 * Public API on window.RP_Notifications:
 *   init()               — set up bell, drawer, toast container event listeners
 *   handleIncoming(n)    — called by ws.js on rp_notification; shows toast, updates bell
 *   loadFromServer()     — fetch existing notifications via GET /api/notifications on boot
 */
(function () {
  'use strict';

  // Priority ordered lowest → highest
  var PRIORITY_ORDER = ['info', 'normal', 'high', 'critical'];

  // Toast auto-dismiss durations in ms (0 = persistent until tapped)
  var TOAST_DURATION = { info: 4000, normal: 5000, high: 6000, critical: 0 };

  // --------------------------------------------------------------------------
  // Internal state
  // --------------------------------------------------------------------------
  var _notifications = [];  // newest-first
  var _drawerOpen = false;

  // --------------------------------------------------------------------------
  // DOM helpers
  // --------------------------------------------------------------------------
  function _qs(sel) { return document.querySelector(sel); }

  function _formatTime(isoString) {
    try {
      var d = new Date(isoString);
      var h = d.getHours();
      var m = d.getMinutes();
      return (h < 10 ? '0' + h : String(h)) + ':' + (m < 10 ? '0' + m : String(m));
    } catch (e) {
      return '';
    }
  }

  // --------------------------------------------------------------------------
  // Bell state — color + badge count
  // --------------------------------------------------------------------------
  function _updateBell() {
    var bell = _qs('#notif-bell');
    var badge = _qs('#notif-badge');
    if (!bell) { return; }

    var unreadCount = 0;
    var highestIdx = -1;
    for (var i = 0; i < _notifications.length; i++) {
      var n = _notifications[i];
      if (!n.read) {
        unreadCount++;
        var idx = PRIORITY_ORDER.indexOf(n.priority || 'normal');
        if (idx > highestIdx) { highestIdx = idx; }
      }
    }

    bell.classList.remove('has-unread-info', 'has-unread-normal', 'has-unread-high', 'has-unread-critical');

    if (unreadCount === 0) {
      if (badge) { badge.classList.remove('visible'); badge.textContent = ''; }
      return;
    }

    bell.classList.add('has-unread-' + PRIORITY_ORDER[highestIdx]);

    if (badge) {
      badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      badge.classList.add('visible');
    }
  }

  // --------------------------------------------------------------------------
  // Alert border — fixed overlay above all UI layers
  // --------------------------------------------------------------------------
  function _updateAlertBorder() {
    var hasCritical = false;
    var hasHigh = false;
    for (var i = 0; i < _notifications.length; i++) {
      var n = _notifications[i];
      if (!n.read) {
        if (n.priority === 'critical') { hasCritical = true; }
        else if (n.priority === 'high') { hasHigh = true; }
      }
    }
    var overlay = _qs('#alert-border-overlay');
    if (!overlay) { return; }
    overlay.classList.remove('alert-high', 'alert-critical');
    if (hasCritical) { overlay.classList.add('alert-critical'); }
    else if (hasHigh) { overlay.classList.add('alert-high'); }
  }

  // --------------------------------------------------------------------------
  // Audio notification — Web Audio API beep (iOS 12: webkitAudioContext)
  // Screen wake not possible from browser; audio plays even with screen on.
  // --------------------------------------------------------------------------
  function _playNotifSound(priority) {
    if (priority !== 'high' && priority !== 'critical') { return; }
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) { return; }
    try {
      var ctx = new AudioCtx();
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      // critical: two short beeps at 880 Hz; high: one beep at 660 Hz
      osc.type = 'sine';
      osc.frequency.value = priority === 'critical' ? 880 : 660;
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
      if (priority === 'critical') {
        // Second beep after 0.5 s
        var osc2  = ctx.createOscillator();
        var gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.value = 880;
        gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.55);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.95);
        osc2.start(ctx.currentTime + 0.55);
        osc2.stop(ctx.currentTime + 0.95);
        osc2.onended = function () { try { ctx.close(); } catch (e) {} };
      } else {
        osc.onended = function () { try { ctx.close(); } catch (e) {} };
      }
    } catch (e) {
      // Audio not available or gesture not yet received — silent fail
    }
  }

  // --------------------------------------------------------------------------
  // Drawer rendering
  // --------------------------------------------------------------------------
  function _renderDrawer() {
    var list = _qs('#notif-list');
    var empty = _qs('#notif-empty');
    if (!list) { return; }

    list.innerHTML = '';

    if (_notifications.length === 0) {
      if (empty) { empty.classList.add('visible'); }
      return;
    }
    if (empty) { empty.classList.remove('visible'); }

    for (var i = 0; i < _notifications.length; i++) {
      var n = _notifications[i];
      list.appendChild(_buildNotifItem(n));
    }
  }

  function _buildNotifItem(n) {
    var item = document.createElement('div');
    item.className = 'notif-item' + (n.read ? '' : ' unread');
    item.setAttribute('data-priority', n.priority || 'normal');
    item.setAttribute('data-id', n.id);

    var body = document.createElement('div');
    body.className = 'notif-item-body';

    var titleEl = document.createElement('div');
    titleEl.className = 'notif-item-title';
    titleEl.textContent = n.title || '';

    var msgEl = document.createElement('div');
    msgEl.className = 'notif-item-msg';
    msgEl.textContent = n.message || '';

    var timeEl = document.createElement('div');
    timeEl.className = 'notif-item-time';
    timeEl.textContent = _formatTime(n.timestamp);

    body.appendChild(titleEl);
    body.appendChild(msgEl);
    body.appendChild(timeEl);

    var delBtn = document.createElement('button');
    delBtn.className = 'notif-item-del';
    delBtn.type = 'button';
    delBtn.textContent = '\u00D7';
    delBtn.setAttribute('aria-label', 'Elimina');

    // Use IIFE to capture nId in loop
    (function (nId) {
      delBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        _deleteNotification(nId);
      });
      item.addEventListener('click', function () {
        _markRead(nId);
      });
    }(n.id));

    item.appendChild(body);
    item.appendChild(delBtn);
    return item;
  }

  // --------------------------------------------------------------------------
  // REST calls (XMLHttpRequest — iOS 12 safe)
  // --------------------------------------------------------------------------
  function _markRead(notificationId) {
    // Optimistic update
    for (var i = 0; i < _notifications.length; i++) {
      if (_notifications[i].id === notificationId) {
        _notifications[i].read = true;
        break;
      }
    }
    _renderDrawer();
    _updateBell();
    _updateAlertBorder();

    var xhr = new XMLHttpRequest();
    xhr.open('PATCH', '/api/notifications/' + encodeURIComponent(notificationId), true);
    xhr.send();
  }

  function _markAllRead() {
    for (var i = 0; i < _notifications.length; i++) {
      _notifications[i].read = true;
    }
    _renderDrawer();
    _updateBell();
    _updateAlertBorder();

    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/notifications/read-all', true);
    xhr.send();
  }

  function _deleteNotification(notificationId) {
    var updated = [];
    for (var i = 0; i < _notifications.length; i++) {
      if (_notifications[i].id !== notificationId) {
        updated.push(_notifications[i]);
      }
    }
    _notifications = updated;
    _renderDrawer();
    _updateBell();
    _updateAlertBorder();

    var xhr = new XMLHttpRequest();
    xhr.open('DELETE', '/api/notifications/' + encodeURIComponent(notificationId), true);
    xhr.send();
  }

  // --------------------------------------------------------------------------
  // Toast
  // --------------------------------------------------------------------------
  function _showToast(notification) {
    var container = _qs('#notif-toast-container');
    if (!container) { return; }

    var toast = document.createElement('div');
    toast.className = 'notif-toast';
    toast.setAttribute('data-priority', notification.priority || 'normal');

    var titleEl = document.createElement('div');
    titleEl.className = 'notif-toast-title';
    titleEl.textContent = notification.title || '';

    var msgEl = document.createElement('div');
    msgEl.className = 'notif-toast-msg';
    msgEl.textContent = notification.message || '';

    toast.appendChild(titleEl);
    toast.appendChild(msgEl);

    var priority = notification.priority || 'normal';
    var duration = TOAST_DURATION[priority];
    if (duration === undefined) { duration = 5000; }

    function dismiss() {
      if (toast.parentNode) { toast.parentNode.removeChild(toast); }
    }

    toast.addEventListener('click', function () {
      dismiss();
      _markRead(notification.id);
      _openDrawer();
    });

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  // --------------------------------------------------------------------------
  // Drawer open / close
  // --------------------------------------------------------------------------
  function _openDrawer() {
    var drawer = _qs('#notif-drawer');
    var backdrop = _qs('#notif-backdrop');
    if (!drawer) { return; }
    _renderDrawer();
    drawer.classList.add('open');
    if (backdrop) { backdrop.classList.add('visible'); }
    _drawerOpen = true;
  }

  function _closeDrawer() {
    var drawer = _qs('#notif-drawer');
    var backdrop = _qs('#notif-backdrop');
    if (!drawer) { return; }
    drawer.classList.remove('open');
    if (backdrop) { backdrop.classList.remove('visible'); }
    _drawerOpen = false;
  }

  // --------------------------------------------------------------------------
  // Touch/click binding helper (iOS 12: both touchend + click with guard)
  // --------------------------------------------------------------------------
  function _bindTap(el, fn) {
    if (!el) { return; }
    el.addEventListener('touchend', function (e) { e.preventDefault(); fn(); });
    el.addEventListener('click', function () {
      if (!('ontouchstart' in window)) { fn(); }
    });
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------
  function init() {
    _bindTap(_qs('#notif-bell'), function () {
      if (_drawerOpen) { _closeDrawer(); } else { _openDrawer(); }
    });
    _bindTap(_qs('#notif-drawer-close'), _closeDrawer);
    _bindTap(_qs('#notif-backdrop'), _closeDrawer);
    _bindTap(_qs('#notif-read-all-btn'), _markAllRead);
    _updateBell();
    _updateAlertBorder();
  }

  function handleIncoming(notification) {
    // Prepend (newest first), cap at 100
    _notifications.unshift(notification);
    if (_notifications.length > 100) { _notifications.pop(); }
    _updateBell();
    _updateAlertBorder();
    _playNotifSound(notification.priority);
    _showToast(notification);
    if (_drawerOpen) { _renderDrawer(); }
  }

  function handleSync(notifications) {
    // Replace local state with authoritative list from server (triggered by mutations on another device)
    if (!Array.isArray(notifications)) { return; }
    _notifications = notifications;
    _updateBell();
    _updateAlertBorder();
    if (_drawerOpen) { _renderDrawer(); }
  }

  function loadFromServer() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/notifications', true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) { return; }
      if (xhr.status === 200) {
        try {
          var data = JSON.parse(xhr.responseText);
          if (Array.isArray(data)) {
            _notifications = data;
            _updateBell();
            _updateAlertBorder();
          }
        } catch (e) {
          console.warn('[Notifications] Failed to parse server response:', e);
        }
      }
    };
    xhr.send();
  }

  window.RP_Notifications = {
    init: init,
    handleIncoming: handleIncoming,
    handleSync: handleSync,
    loadFromServer: loadFromServer,
  };

}());
