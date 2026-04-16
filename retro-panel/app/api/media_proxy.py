"""Media player cover art proxy — fetches entity_picture from HA."""

from __future__ import annotations

import asyncio
import logging
import re

from aiohttp import web

logger = logging.getLogger(__name__)

_MEDIA_ENTITY_RE = re.compile(r"^media_player\.[a-z0-9_]+$")


def _validate_media(request: web.Request, entity_id: str):
    """Validate entity_id format and whitelist. Returns ha_client or raises."""
    if not _MEDIA_ENTITY_RE.match(entity_id):
        raise web.HTTPBadRequest(reason=f"Invalid media_player entity_id: {entity_id!r}")
    config = request.app.get("config")
    if config is None or entity_id not in config.all_entity_ids:
        raise web.HTTPForbidden(reason=f"Media player not in configured whitelist: {entity_id!r}")
    ha_client = request.app.get("ha_client")
    if ha_client is None:
        raise web.HTTPServiceUnavailable(reason="HA client not available")
    return ha_client


async def get_media_cover(request: web.Request) -> web.Response:
    """Proxy media player cover art (entity_picture) from HA.

    GET /api/media-cover/{entity_id}

    Uses HAClient.get_media_cover() which reads entity_picture from state
    and proxies the image. Returns 404 if no cover art available.
    """
    entity_id: str = request.match_info["entity_id"]
    try:
        ha_client = _validate_media(request, entity_id)
    except web.HTTPException as exc:
        return web.json_response({"error": exc.reason}, status=exc.status_code)

    try:
        data, ct = await ha_client.get_media_cover(entity_id)
    except FileNotFoundError as exc:
        logger.info("No cover art for %s: %s", entity_id, exc)
        return web.json_response({"error": "No cover art available"}, status=404)
    except PermissionError as exc:
        logger.error("HA rejected media cover request: %s", exc)
        return web.json_response({"error": str(exc)}, status=403)
    except (ConnectionRefusedError, TimeoutError) as exc:
        logger.warning("Media cover proxy failed for %s: %s", entity_id, exc)
        return web.json_response({"error": "Cannot connect to HA"}, status=502)
    except asyncio.TimeoutError as exc:
        logger.warning("Media cover timed out for %s: %s", entity_id, exc)
        return web.json_response({"error": "Cover art request timed out"}, status=504)
    except Exception as exc:
        logger.error("Media cover proxy error for %s: %s", entity_id, exc)
        return web.json_response({"error": "Failed to fetch cover art"}, status=502)

    return web.Response(
        body=data,
        content_type=ct,
        headers={"Cache-Control": "public, max-age=30"},
    )
