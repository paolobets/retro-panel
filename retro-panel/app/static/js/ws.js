/**
 * ws.js — WebSocket client with automatic reconnection
 * No ES modules — loaded as regular script. iOS 15 Safari safe.
 *
 * Exposes globally: connectWS
 */
(function () {
  'use strict';

  var BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000];

  /**
   * Connect to the backend WebSocket and handle reconnection.
   *
   * @param {function(string, object): void} onStateChanged
   * @param {function(): void} onConnect
   * @param {function(): void} onDisconnect
   * @param {function(object): void} [onNotification] — called with notification object on rp_notification
   * @param {function(Array): void} [onNotificationSync] — called with full notification array on rp_notification_update
   * @returns {{ close: function(): void }}
   */
  function connectWS(onStateChanged, onConnect, onDisconnect, onNotification, onNotificationSync) {
    var ws = null;
    var attempt = 0;
    var stopped = false;
    var reconnectTimer = null;

    function getWsUrl() {
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      // Preserve HA Ingress path prefix so the WS request reaches our handler.
      var base = location.pathname.replace(/\/+$/, '');
      return proto + '//' + location.host + base + '/ws';
    }

    function connect() {
      if (stopped) return;

      try {
        ws = new WebSocket(getWsUrl());
      } catch (err) {
        console.error('[WS] Failed to create WebSocket:', err);
        scheduleReconnect();
        return;
      }

      ws.onopen = function () {
        attempt = 0;
        console.info('[WS] Connected');
        onConnect();
      };

      ws.onmessage = function (event) {
        var msg;
        try {
          msg = JSON.parse(event.data);
        } catch (err) {
          console.warn('[WS] Failed to parse message:', event.data);
          return;
        }
        if (msg.type === 'state_changed' && msg.entity_id && msg.new_state) {
          onStateChanged(msg.entity_id, msg.new_state);
        } else if (msg.type === 'rp_notification' && msg.notification) {
          if (typeof onNotification === 'function') {
            onNotification(msg.notification);
          }
        } else if (msg.type === 'rp_notification_update' && msg.notifications) {
          if (typeof onNotificationSync === 'function') {
            onNotificationSync(msg.notifications);
          }
        } else if (msg.type === 'rp_version' && msg.version) {
          // Auto-reload when add-on version changes after a *stable* update.
          // Compare server version (major.minor.patch only, strip -rc/-beta
          // suffixes) against rp-build meta. Beta versions skip the check
          // because rp-build only tracks stable releases and the mismatch
          // would cause an infinite reload loop.
          var rawVer = msg.version + '';
          var stableVer = rawVer.split('-')[0]; // "2.14.0-rc11" → "2.14.0"
          var serverNum = stableVer.replace(/\./g, ''); // "2140"
          var isBeta = rawVer.indexOf('-') !== -1;
          var pageNum = '';
          try {
            var metaEl = document.querySelector('meta[name="rp-build"]');
            if (metaEl) { pageNum = metaEl.getAttribute('content') || ''; }
          } catch (e) {}
          if (!isBeta && pageNum && serverNum && pageNum !== serverNum) {
            console.info('[WS] Version mismatch (page=%s server=%s) \u2014 reloading\u2026', pageNum, serverNum);
            setTimeout(function () { location.reload(); }, 800);
          }
        }
      };

      ws.onclose = function (event) {
        console.info('[WS] Closed (code=%d, clean=%s)', event.code, event.wasClean);
        if (!stopped) {
          onDisconnect();
          scheduleReconnect();
        }
      };

      ws.onerror = function () {
        // onerror is always followed by onclose on iOS Safari; let onclose handle it
        console.warn('[WS] Error event');
      };
    }

    function scheduleReconnect() {
      if (stopped) return;
      var delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
      console.info('[WS] Reconnecting in %dms (attempt %d)\u2026', delay, attempt + 1);
      attempt++;
      reconnectTimer = setTimeout(connect, delay);
    }

    connect();

    return {
      close: function () {
        stopped = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        if (ws) ws.close();
      },
    };
  }

  window.connectWS = connectWS;
}());
