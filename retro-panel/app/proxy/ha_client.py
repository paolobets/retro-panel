"""
Async HTTP and WebSocket client for the Home Assistant REST API.
The HA token is kept entirely server-side and never returned to callers.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

import aiohttp

logger = logging.getLogger(__name__)

_REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10)


class HAClient:
    """Async client for the Home Assistant REST and WebSocket APIs.

    The ``ha_token`` is stored internally and is never included in any
    value returned to callers.
    """

    def __init__(self, ha_url: str, ha_token: str) -> None:
        self._ha_url: str = ha_url.rstrip("/")
        self.__ha_token: str = ha_token  # name-mangled; never logged
        self._session: Optional[aiohttp.ClientSession] = None
        self._state_semaphore = asyncio.Semaphore(10)

    def _get_session(self) -> aiohttp.ClientSession:
        """Return the shared ClientSession, creating it lazily on first call."""
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                headers={
                    "Authorization": f"Bearer {self.__ha_token}",
                    "Content-Type": "application/json",
                },
                timeout=_REQUEST_TIMEOUT,
            )
        return self._session

    async def close(self) -> None:
        """Close the underlying aiohttp session gracefully."""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("HAClient session closed")

    async def ping(self) -> bool:
        """Verify connectivity by calling GET /api/ on the HA instance."""
        url = f"{self._ha_url}/api/"
        session = self._get_session()
        try:
            async with session.get(url) as resp:
                if resp.status == 401:
                    raise PermissionError("HA returned 401 Unauthorized")
                return resp.status == 200
        except aiohttp.ClientConnectorError as exc:
            raise ConnectionRefusedError(str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise TimeoutError("Request to HA timed out") from exc

    async def get_state(self, entity_id: str) -> dict[str, Any]:
        """Fetch the current state of a single entity."""
        url = f"{self._ha_url}/api/states/{entity_id}"
        session = self._get_session()
        try:
            async with session.get(url) as resp:
                if resp.status == 401:
                    raise PermissionError("HA returned 401 Unauthorized")
                if resp.status == 404:
                    raise ValueError(f"Entity '{entity_id}' not found in HA")
                resp.raise_for_status()
                data: dict = await resp.json()
                return _sanitize_state(data)
        except aiohttp.ClientConnectorError as exc:
            raise ConnectionRefusedError(str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise TimeoutError(f"Request for entity '{entity_id}' timed out") from exc

    async def _get_state_limited(self, entity_id: str):
        async with self._state_semaphore:
            return await self.get_state(entity_id)

    async def get_states_bulk(self, entity_ids: list[str]) -> list[dict[str, Any]]:
        """Fetch states for multiple entities concurrently."""
        tasks = [self._get_state_limited(eid) for eid in entity_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        output: list[dict[str, Any]] = []
        for eid, result in zip(entity_ids, results):
            if isinstance(result, Exception):
                logger.warning("Failed to fetch state for %s: %s", eid, result)
                output.append({"entity_id": eid, "state": "unavailable", "attributes": {}})
            else:
                output.append(result)
        return output

    async def call_service(
        self,
        domain: str,
        service: str,
        data: dict[str, Any],
    ) -> dict[str, Any]:
        """Call a Home Assistant service."""
        url = f"{self._ha_url}/api/services/{domain}/{service}"
        session = self._get_session()
        try:
            async with session.post(url, json=data) as resp:
                if resp.status == 401:
                    raise PermissionError("HA returned 401 Unauthorized")
                if 400 <= resp.status < 500:
                    body = await resp.text()
                    raise ValueError(f"HA returned {resp.status}: {body}")
                resp.raise_for_status()
                result = await resp.json()
                return {"states": result}
        except aiohttp.ClientConnectorError as exc:
            raise ConnectionRefusedError(str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise TimeoutError(f"Service call {domain}.{service} timed out") from exc

    async def get_camera_proxy(self, entity_id: str) -> tuple[bytes, str]:
        """Fetch camera snapshot from HA. Returns (jpeg_bytes, content_type)."""
        url = f"{self._ha_url}/api/camera_proxy/{entity_id}"
        session = self._get_session()
        try:
            async with session.get(
                url,
                timeout=aiohttp.ClientTimeout(total=8),
            ) as resp:
                if resp.status == 401:
                    raise PermissionError("HA token rejected for camera proxy")
                if resp.status == 404:
                    raise FileNotFoundError(f"Camera entity not found: {entity_id}")
                resp.raise_for_status()
                data = await resp.read()
                ct = resp.headers.get("Content-Type", "image/jpeg")
                return data, ct
        except aiohttp.ClientConnectorError as exc:
            raise ConnectionRefusedError(str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise TimeoutError(f"Camera proxy request for '{entity_id}' timed out") from exc

    def get_camera_stream_request(self, entity_id: str):
        """Return a context manager for the HA MJPEG camera stream.

        Unlike get_camera_proxy(), this does NOT await the full response —
        the caller is responsible for iterating the response chunks.
        No total timeout so the stream can live as long as needed; sock_read
        detects dead connections after 30 s of silence.

        Usage:
            async with ha_client.get_camera_stream_request(entity_id) as resp:
                async for chunk in resp.content.iter_chunked(8192):
                    ...
        """
        url = f"{self._ha_url}/api/camera_proxy_stream/{entity_id}"
        session = self._get_session()
        timeout = aiohttp.ClientTimeout(total=None, sock_read=30)
        return session.get(url, timeout=timeout)

    async def get_camera_hls_url(self, entity_id: str) -> str:
        """Get HA HLS stream URL via WebSocket camera/stream command.

        Returns the raw URL string from HA (e.g.
        'http://homeassistant:8123/api/hls/{token}/playlist.m3u8').
        The caller must extract the token from this URL.

        Raises ValueError if the camera integration doesn't support streaming.
        Raises TimeoutError if the WS request times out.
        """
        ws = await self.ws_connect()
        cmd_id = 95  # distinct from area(98), entity(99), device(97), WSProxy(1,2)
        try:
            await ws.send_json({
                "id": cmd_id,
                "type": "camera/stream",
                "entity_id": entity_id,
            })
            msg = await asyncio.wait_for(ws.receive_json(), timeout=15)
            if not msg.get("success"):
                err = msg.get("error") or {}
                code = err.get("code") or err.get("message") or "unknown"
                raise ValueError(
                    f"HA camera/stream failed for {entity_id!r}: {code}"
                )
            result = msg.get("result") or {}
            url = result.get("url") or ""
            if not url:
                raise ValueError(
                    f"HA camera/stream returned empty URL for {entity_id!r}"
                )
            return url
        except asyncio.TimeoutError as exc:
            raise TimeoutError(
                f"camera/stream WebSocket timed out for {entity_id!r}"
            ) from exc
        finally:
            if not ws.closed:
                await ws.close()

    async def proxy_hls_segment(self, token: str, tail: str) -> tuple[bytes, str]:
        """Fetch one HLS resource (m3u8 playlist or .ts segment) from HA.

        Args:
            token: The HLS stream token obtained from get_camera_hls_url().
            tail:  The path component after the token, e.g. 'master_playlist.m3u8'
                   or 'segment/0001.ts'.

        Returns:
            (body_bytes, content_type_string)

        Raises FileNotFoundError on 404 (token expired or stream stopped).
        Raises PermissionError on 401 (token rejected).
        """
        url = f"{self._ha_url}/api/hls/{token}/{tail}"
        session = self._get_session()
        try:
            async with session.get(
                url, timeout=aiohttp.ClientTimeout(total=10)
            ) as resp:
                if resp.status == 401:
                    raise PermissionError(
                        f"HA rejected HLS segment (401): token={token!r}"
                    )
                if resp.status == 404:
                    raise FileNotFoundError(
                        f"HLS resource not found (404): tail={tail!r}"
                    )
                resp.raise_for_status()
                data = await resp.read()
                ct = resp.headers.get(
                    "Content-Type", "application/octet-stream"
                )
                return data, ct
        except aiohttp.ClientConnectorError as exc:
            raise ConnectionRefusedError(str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise TimeoutError(
                f"HLS segment fetch timed out: tail={tail!r}"
            ) from exc

    async def get_calendar_events(
        self, entity_id: str, start: str, end: str
    ) -> list[dict]:
        """Fetch calendar events from HA REST API."""
        url = f"{self._ha_url}/api/calendars/{entity_id}"
        session = self._get_session()
        try:
            async with session.get(
                url,
                params={"start": start, "end": end},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 401:
                    raise PermissionError("HA token rejected for calendar events")
                if resp.status == 404:
                    raise FileNotFoundError(f"Calendar entity not found: {entity_id}")
                resp.raise_for_status()
                return await resp.json()
        except aiohttp.ClientConnectorError as exc:
            raise ConnectionRefusedError(str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise TimeoutError(f"Calendar events request for '{entity_id}' timed out") from exc

    async def get_all_entity_states(self) -> list[dict[str, Any]]:
        """Fetch ALL entity states from HA (used by the entity picker config page).

        Uses a larger timeout than individual state fetches because the full
        state dump can be sizable on instances with many entities.
        """
        url = f"{self._ha_url}/api/states"
        session = self._get_session()
        timeout = aiohttp.ClientTimeout(total=30)
        try:
            async with session.get(url, timeout=timeout) as resp:
                if resp.status == 401:
                    raise PermissionError("HA returned 401 Unauthorized")
                resp.raise_for_status()
                return await resp.json()
        except aiohttp.ClientConnectorError as exc:
            raise ConnectionRefusedError(str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise TimeoutError("Request for all entity states timed out") from exc

    async def get_area_registry(self) -> list[dict]:
        """Fetch area registry via HA WebSocket API (config/area_registry/list).

        Opens a short-lived WebSocket connection, authenticates, sends the command,
        reads the result, and closes the connection.
        """
        ws = await self.ws_connect()
        cmd_id = 98  # arbitrary id distinct from entity registry (99) and WSProxy (1)
        try:
            await ws.send_json({"id": cmd_id, "type": "config/area_registry/list"})
            msg = await asyncio.wait_for(ws.receive_json(), timeout=15)
            if not msg.get("success"):
                raise ValueError(
                    f"HA area registry list command failed: {msg.get('error')}"
                )
            return msg.get("result") or []
        except asyncio.TimeoutError as exc:
            raise TimeoutError("Area registry WebSocket request timed out") from exc
        finally:
            if not ws.closed:
                await ws.close()

    async def get_entity_registry(self) -> list[dict]:
        """Fetch entity registry via HA WebSocket API (config/entity_registry/list).

        The REST endpoint GET /api/config/entity_registry is NOT a supported list
        operation in Home Assistant — only single-entity GET/POST endpoints exist in
        the REST API. The authoritative way to retrieve all registry entries (including
        hidden_by and disabled_by) is the WebSocket command config/entity_registry/list.

        Opens a short-lived WebSocket connection, authenticates, sends the command,
        reads the result, and closes the connection.
        """
        ws = await self.ws_connect()
        cmd_id = 99  # arbitrary id; WSProxy uses id=1 for its subscription
        try:
            await ws.send_json({"id": cmd_id, "type": "config/entity_registry/list"})
            msg = await asyncio.wait_for(ws.receive_json(), timeout=15)
            if not msg.get("success"):
                raise ValueError(
                    f"HA entity registry list command failed: {msg.get('error')}"
                )
            return msg.get("result") or []
        except asyncio.TimeoutError as exc:
            raise TimeoutError("Entity registry WebSocket request timed out") from exc
        finally:
            if not ws.closed:
                await ws.close()

    async def get_device_registry(self) -> list[dict]:
        """Fetch device registry via HA WebSocket API (config/device_registry/list).

        Opens a short-lived WebSocket connection, authenticates, sends the command,
        reads the result, and closes the connection.
        """
        ws = await self.ws_connect()
        cmd_id = 97  # area=98, entity=99, WSProxy=1
        try:
            await ws.send_json({"id": cmd_id, "type": "config/device_registry/list"})
            msg = await asyncio.wait_for(ws.receive_json(), timeout=15)
            if not msg.get("success"):
                raise ValueError(
                    f"HA device registry list command failed: {msg.get('error')}"
                )
            return msg.get("result") or []
        except asyncio.TimeoutError as exc:
            raise TimeoutError("Device registry WebSocket request timed out") from exc
        finally:
            if not ws.closed:
                await ws.close()

    async def ws_connect(self) -> aiohttp.ClientWebSocketResponse:
        """Open a WebSocket connection to the HA WebSocket API with auth handshake."""
        ws_url = self._ha_url.replace("http://", "ws://").replace("https://", "wss://")
        ws_url = f"{ws_url}/api/websocket"
        session = self._get_session()

        try:
            ws = await session.ws_connect(ws_url, heartbeat=30)

            # Step 1: expect auth_required
            msg = await asyncio.wait_for(ws.receive_json(), timeout=10)
            if msg.get("type") != "auth_required":
                raise ConnectionError(f"Unexpected HA WS message during handshake: {msg}")

            # Step 2: send token
            await ws.send_json({"type": "auth", "access_token": self.__ha_token})

            # Step 3: expect auth_ok
            msg = await asyncio.wait_for(ws.receive_json(), timeout=10)
            if msg.get("type") == "auth_invalid":
                raise PermissionError("HA WebSocket auth rejected (auth_invalid)")
            if msg.get("type") != "auth_ok":
                raise ConnectionError(f"Unexpected HA WS auth response: {msg}")

            logger.info("HA WebSocket authenticated successfully")
            return ws

        except aiohttp.ClientConnectorError as exc:
            raise ConnectionRefusedError(str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise TimeoutError("HA WebSocket handshake timed out") from exc


def _sanitize_state(raw: dict[str, Any]) -> dict[str, Any]:
    """Return only safe fields from an HA state dict."""
    return {
        "entity_id": raw.get("entity_id", ""),
        "state": raw.get("state", "unknown"),
        "attributes": raw.get("attributes", {}),
        "last_changed": raw.get("last_changed", ""),
        "last_updated": raw.get("last_updated", ""),
    }
