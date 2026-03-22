/**
 * ws.js — WebSocket client with automatic reconnection
 * ES2017-compatible, no external dependencies.
 * iOS 15 Safari: WebSocket close event fires reliably.
 */

const BACKOFF = [1000, 2000, 4000, 8000, 16000, 30000];

/**
 * Connect to the backend WebSocket and handle reconnection.
 *
 * @param {function(string, object): void} onStateChanged
 *   Called when a state_changed event is received.
 *   Arguments: (entityId, newState)
 *
 * @param {function(): void} onConnect
 *   Called when WebSocket connects (or reconnects) successfully.
 *
 * @param {function(): void} onDisconnect
 *   Called when WebSocket disconnects unexpectedly.
 *
 * @returns {{ close: function(): void }}  Control object to stop reconnection.
 */
export function connectWS(onStateChanged, onConnect, onDisconnect) {
  let ws = null;
  let attempt = 0;
  let stopped = false;
  let reconnectTimer = null;

  function getWsUrl() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}/ws`;
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

    ws.onopen = function() {
      attempt = 0;  // reset backoff on success
      console.info('[WS] Connected');
      onConnect();
    };

    ws.onmessage = function(event) {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (err) {
        console.warn('[WS] Failed to parse message:', event.data);
        return;
      }

      if (msg.type === 'state_changed' && msg.entity_id && msg.new_state) {
        onStateChanged(msg.entity_id, msg.new_state);
      }
    };

    ws.onclose = function(event) {
      console.info('[WS] Closed (code=%d, clean=%s)', event.code, event.wasClean);
      if (!stopped) {
        onDisconnect();
        scheduleReconnect();
      }
    };

    ws.onerror = function(err) {
      // onerror is always followed by onclose on iOS Safari; let onclose handle it
      console.warn('[WS] Error event');
    };
  }

  function scheduleReconnect() {
    if (stopped) return;
    const delay = BACKOFF[Math.min(attempt, BACKOFF.length - 1)];
    console.info('[WS] Reconnecting in %dms (attempt %d)…', delay, attempt + 1);
    attempt++;
    reconnectTimer = setTimeout(connect, delay);
  }

  connect();

  return {
    close: function() {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
    },
  };
}
