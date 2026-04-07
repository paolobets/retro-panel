"""Camera proxy handlers — snapshot and MJPEG stream, whitelist-gated."""

from __future__ import annotations

import asyncio
import logging
import re
import time as _time

import aiohttp
from aiohttp import web

logger = logging.getLogger(__name__)

# Token cache: entity_id -> (token_str, expires_at_float)
# HA HLS tokens are valid ~5 min; we refresh at 4 min (240 s).
_HLS_TOKEN_TTL = 240.0
_hls_token_cache: dict = {}

_CAMERA_ENTITY_RE = re.compile(r"^camera\.[a-z0-9_]+$")
_HLS_TAIL_RE = re.compile(r"^[a-zA-Z0-9_/\-]+\.(m3u8|ts)$")


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


def _extract_token(hls_url: str) -> str:
    """Extract the stream token from an HA HLS URL.

    HA returns absolute URLs like:
      http://homeassistant:8123/api/hls/{token}/playlist.m3u8
    """
    m = re.search(r'/api/hls/([^/]+)/', hls_url)
    if not m:
        raise ValueError(f"Cannot extract HLS token from URL: {hls_url!r}")
    return m.group(1)


async def _get_fresh_token(entity_id: str, ha_client) -> str:
    """Fetch a new token from HA, update cache, and return it."""
    hls_url = await ha_client.get_camera_hls_url(entity_id)
    token = _extract_token(hls_url)
    _hls_token_cache[entity_id] = (token, _time.time() + _HLS_TOKEN_TTL)
    logger.info("HLS token refreshed for %s (token=%s…)", entity_id, token[:8])
    return token


async def get_camera_stream_info(request: web.Request) -> web.Response:
    """GET /api/camera-stream/{entity_id}

    Returns:
        {"supported": true,  "url": "api/camera-hls/{entity_id}/master_playlist.m3u8"}
        {"supported": false, "reason": "..."}

    The returned URL is relative (no leading slash) so it resolves correctly
    under HA Ingress path prefixes.
    """
    entity_id: str = request.match_info["entity_id"]
    try:
        ha_client = _validate_camera(request, entity_id)
    except web.HTTPException as exc:
        return web.json_response({"error": exc.reason}, status=exc.status_code)

    # Use cached token if still fresh
    cached = _hls_token_cache.get(entity_id)
    if cached and cached[1] > _time.time():
        return web.json_response({
            "supported": True,
            "url": f"api/camera-hls/{entity_id}/master_playlist.m3u8",
        })

    try:
        await _get_fresh_token(entity_id, ha_client)
    except ValueError as exc:
        logger.info("Camera %s does not support HLS: %s", entity_id, exc)
        return web.json_response({"supported": False, "reason": str(exc)})
    except (TimeoutError, ConnectionRefusedError) as exc:
        logger.warning("Failed to get HLS token for %s: %s", entity_id, exc)
        return web.json_response({"supported": False, "reason": "Failed to reach HA stream"})
    except Exception as exc:
        logger.warning("Failed to get HLS token for %s: %s", entity_id, exc)
        return web.json_response({"supported": False, "reason": "Failed to reach HA stream"})

    return web.json_response({
        "supported": True,
        "url": f"api/camera-hls/{entity_id}/master_playlist.m3u8",
    })


async def get_camera_hls_proxy(request: web.Request) -> web.Response:
    """GET /api/camera-hls/{entity_id}/{tail:.*}

    Proxies any HLS resource (m3u8 playlist or .ts segment) to HA.
    Automatically refreshes the token if it is expired or HA returns 404.
    """
    entity_id: str = request.match_info["entity_id"]
    tail: str = request.match_info["tail"]

    # Block path traversal and non-HLS file requests
    if ".." in tail or not _HLS_TAIL_RE.match(tail):
        return web.Response(status=400, text="Invalid HLS path")

    try:
        ha_client = _validate_camera(request, entity_id)
    except web.HTTPException as exc:
        return web.json_response({"error": exc.reason}, status=exc.status_code)

    # Ensure we have a fresh token
    cached = _hls_token_cache.get(entity_id)
    if not cached or cached[1] <= _time.time():
        try:
            token = await _get_fresh_token(entity_id, ha_client)
        except Exception as exc:
            logger.warning("HLS token refresh failed for %s: %s", entity_id, exc)
            return web.Response(status=502, text="Failed to refresh HLS token")
    else:
        token = cached[0]

    try:
        data, ct = await ha_client.proxy_hls_segment(token, tail)
        return web.Response(
            body=data,
            content_type=ct,
            headers={"Cache-Control": "no-cache, no-store"},
        )
    except FileNotFoundError:
        # Token may have expired mid-stream — try once with a fresh token
        logger.info("HLS 404 for %s/%s — refreshing token and retrying", entity_id, tail)
        try:
            token = await _get_fresh_token(entity_id, ha_client)
            data, ct = await ha_client.proxy_hls_segment(token, tail)
            return web.Response(
                body=data,
                content_type=ct,
                headers={"Cache-Control": "no-cache, no-store"},
            )
        except Exception as exc:
            logger.warning("HLS retry failed for %s/%s: %s", entity_id, tail, exc)
            return web.Response(status=404, text="HLS resource not found")
    except PermissionError as exc:
        logger.error("HLS permission error for %s: %s", entity_id, exc)
        return web.Response(status=403, text="HA rejected HLS request")
    except (TimeoutError, ConnectionRefusedError) as exc:
        logger.warning("HLS proxy error for %s/%s: %s", entity_id, tail, exc)
        return web.Response(status=502, text="HLS proxy error")
    except Exception as exc:
        logger.error("Unexpected HLS proxy error for %s/%s: %s", entity_id, tail, exc)
        return web.Response(status=502, text="HLS proxy error")
