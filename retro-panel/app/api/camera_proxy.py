"""Camera proxy handlers — snapshot and MJPEG stream, whitelist-gated."""

from __future__ import annotations

import asyncio
import logging
import re

import aiohttp
from aiohttp import web

logger = logging.getLogger(__name__)

_CAMERA_ENTITY_RE = re.compile(r"^camera\.[a-z0-9_]+$")


def _validate_camera(request: web.Request, entity_id: str):
    """Shared validation: regex + whitelist. Returns (config, ha_client) or raises web.HTTPException."""
    if not _CAMERA_ENTITY_RE.match(entity_id):
        raise web.HTTPBadRequest(reason=f"Invalid camera entity_id: {entity_id!r}")
    config = request.app.get("config")
    if config is None or entity_id not in config.all_entity_ids:
        raise web.HTTPForbidden(reason=f"Camera not in configured whitelist: {entity_id!r}")
    ha_client = request.app.get("ha_client")
    if ha_client is None:
        raise web.HTTPServiceUnavailable(reason="HA client not available")
    return ha_client


async def get_camera_proxy(request: web.Request) -> web.Response:
    """Proxy a camera snapshot from HA with whitelist validation."""
    entity_id: str = request.match_info["entity_id"]
    try:
        ha_client = _validate_camera(request, entity_id)
    except web.HTTPException as exc:
        return web.json_response({"error": exc.reason}, status=exc.status_code)

    try:
        data, ct = await ha_client.get_camera_proxy(entity_id)
    except FileNotFoundError as exc:
        logger.warning("Camera entity not found in HA: %s", exc)
        return web.json_response({"error": str(exc)}, status=404)
    except PermissionError as exc:
        logger.error("HA rejected camera proxy request: %s", exc)
        return web.json_response({"error": str(exc)}, status=403)
    except asyncio.TimeoutError as exc:
        logger.warning("Camera proxy timed out for %s: %s", entity_id, exc)
        return web.json_response({"error": "Camera request timed out"}, status=504)
    except Exception as exc:
        logger.error("Camera proxy error for %s: %s", entity_id, exc)
        return web.json_response({"error": "Failed to fetch camera snapshot"}, status=502)

    return web.Response(
        body=data,
        content_type=ct,
        headers={"Cache-Control": "no-store, no-cache"},
    )


async def get_camera_proxy_stream(request: web.Request) -> web.StreamResponse:
    """Proxy an MJPEG stream from HA /api/camera_proxy_stream/{entity_id}.

    Returns 404 JSON when HA doesn't expose a stream for this camera so the
    frontend can silently fall back to snapshot polling.
    """
    entity_id: str = request.match_info["entity_id"]
    try:
        ha_client = _validate_camera(request, entity_id)
    except web.HTTPException as exc:
        return web.json_response({"error": exc.reason}, status=exc.status_code)

    try:
        async with ha_client.get_camera_stream_request(entity_id) as resp:
            if resp.status == 401:
                return web.json_response({"error": "HA token rejected"}, status=403)
            if resp.status == 404:
                # Camera integration doesn't support MJPEG — frontend will fall back
                return web.json_response(
                    {"error": "Stream not available for this camera"}, status=404
                )
            if resp.status != 200:
                logger.warning("HA stream returned %s for %s", resp.status, entity_id)
                return web.json_response(
                    {"error": f"HA returned {resp.status}"}, status=502
                )

            ct = resp.headers.get("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            stream_resp = web.StreamResponse(
                status=200,
                headers={
                    "Content-Type": ct,
                    "Cache-Control": "no-cache, no-store",
                    "X-Accel-Buffering": "no",
                },
            )
            await stream_resp.prepare(request)

            try:
                async for chunk in resp.content.iter_chunked(8192):
                    await stream_resp.write(chunk)
            except (asyncio.CancelledError, ConnectionResetError):
                pass  # client disconnected — close upstream cleanly

            return stream_resp

    except aiohttp.ClientConnectorError as exc:
        logger.warning("Cannot connect to HA for camera stream %s: %s", entity_id, exc)
        return web.json_response({"error": "Cannot connect to HA"}, status=502)
    except asyncio.TimeoutError:
        logger.warning("Camera stream timed out for %s", entity_id)
        return web.json_response({"error": "Camera stream timed out"}, status=504)
    except Exception as exc:
        logger.error("Camera stream proxy error for %s: %s", entity_id, exc)
        return web.json_response({"error": "Failed to stream camera"}, status=502)
