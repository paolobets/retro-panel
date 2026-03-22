"""
Maintains a single persistent WebSocket connection to Home Assistant and
fans out state_changed events to all connected browser clients.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING, Optional

import aiohttp

if TYPE_CHECKING:
    from config.loader import PanelConfig
    from proxy.ha_client import HAClient

logger = logging.getLogger(__name__)

_BACKOFF_SEQUENCE = [1, 2, 4, 8, 16, 30]
_SUBSCRIBE_ID = 1


class WSProxy:
    """Fan-out proxy between one HA WebSocket connection and N browser clients."""

    def __init__(self, ha_client: "HAClient", config: "PanelConfig") -> None:
        self._ha_client = ha_client
        self._config = config
        self._entity_ids: frozenset[str] = frozenset(e.entity_id for e in config.entities)
        self._clients: set[aiohttp.web.WebSocketResponse] = set()
        self._running: bool = False
        self._ha_ws: Optional[aiohttp.ClientWebSocketResponse] = None

    def add_client(self, ws: "aiohttp.web.WebSocketResponse") -> None:
        """Register a new browser WebSocket client."""
        self._clients.add(ws)
        logger.info("Browser WS client added. Total clients: %d", len(self._clients))

    def remove_client(self, ws: "aiohttp.web.WebSocketResponse") -> None:
        """Unregister a browser WebSocket client."""
        self._clients.discard(ws)
        logger.info("Browser WS client removed. Total clients: %d", len(self._clients))

    async def start(self) -> None:
        """Entry point for the background asyncio task.

        Connects to HA WebSocket with exponential backoff reconnection.
        """
        self._running = True
        attempt = 0

        while self._running:
            try:
                logger.info("Connecting to HA WebSocket (attempt %d)…", attempt + 1)
                self._ha_ws = await self._ha_client.ws_connect()
                attempt = 0  # reset backoff on successful connect

                await self._subscribe_state_changed()
                await self._read_loop()

            except PermissionError as exc:
                logger.error("HA WebSocket auth failed — will not retry: %s", exc)
                self._running = False
                return

            except (ConnectionRefusedError, TimeoutError, aiohttp.ClientError, OSError) as exc:
                delay = _BACKOFF_SEQUENCE[min(attempt, len(_BACKOFF_SEQUENCE) - 1)]
                logger.warning(
                    "HA WebSocket disconnected (%s). Reconnecting in %d s…", exc, delay
                )
                attempt += 1
                await asyncio.sleep(delay)

            except asyncio.CancelledError:
                logger.info("WSProxy task cancelled — shutting down")
                self._running = False
                return

            except Exception as exc:
                delay = _BACKOFF_SEQUENCE[min(attempt, len(_BACKOFF_SEQUENCE) - 1)]
                logger.exception("Unexpected WSProxy error (%s). Reconnecting in %d s…", exc, delay)
                attempt += 1
                await asyncio.sleep(delay)

            finally:
                if self._ha_ws and not self._ha_ws.closed:
                    await self._ha_ws.close()
                    self._ha_ws = None

    async def _subscribe_state_changed(self) -> None:
        """Send the subscribe_events command to HA after authentication."""
        await self._ha_ws.send_json(
            {
                "id": _SUBSCRIBE_ID,
                "type": "subscribe_events",
                "event_type": "state_changed",
            }
        )
        logger.info("Subscribed to HA state_changed events")

    async def _read_loop(self) -> None:
        """Continuously read messages from HA and fan out relevant ones."""
        async for msg in self._ha_ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                await self._handle_ha_message(msg.data)
            elif msg.type == aiohttp.WSMsgType.ERROR:
                logger.warning("HA WebSocket error frame received")
                break
            elif msg.type in (aiohttp.WSMsgType.CLOSE, aiohttp.WSMsgType.CLOSING):
                logger.info("HA WebSocket closed by remote")
                break

    async def _handle_ha_message(self, raw: str) -> None:
        """Parse an HA message and fan out state changes to browser clients."""
        try:
            payload: dict = json.loads(raw)
        except json.JSONDecodeError:
            logger.debug("Received non-JSON WS message from HA; ignoring")
            return

        if payload.get("type") != "event":
            return

        event_data: dict = payload.get("event", {}).get("data", {})
        entity_id: str = event_data.get("entity_id", "")

        if entity_id not in self._entity_ids:
            return

        new_state: dict = event_data.get("new_state") or {}
        client_msg = json.dumps(
            {
                "type": "state_changed",
                "entity_id": entity_id,
                "new_state": {
                    "state": new_state.get("state", "unknown"),
                    "attributes": new_state.get("attributes", {}),
                    "last_changed": new_state.get("last_changed", ""),
                },
            }
        )

        await self._broadcast(client_msg)

    async def _broadcast(self, message: str) -> None:
        """Send a text message to all connected browser WebSocket clients."""
        if not self._clients:
            return

        dead: set = set()
        for ws in list(self._clients):
            try:
                if not ws.closed:
                    await ws.send_str(message)
            except (ConnectionResetError, RuntimeError) as exc:
                logger.debug("Failed to send to client, removing: %s", exc)
                dead.add(ws)

        for ws in dead:
            self._clients.discard(ws)
