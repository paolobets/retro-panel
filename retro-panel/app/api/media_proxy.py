"""Media player cover art proxy — fetches entity_picture from HA."""

from __future__ import annotations

import logging
import re

import aiohttp
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

    Fetches the entity state to get entity_picture URL, then proxies
    the image from HA. Returns 404 if no cover art available.
    """
    entity_id: str = request.match_info["entity_id"]
    try:
        ha_client = _validate_media(request, entity_id)
    except web.HTTPException as exc:
        return web.json_response({"error": exc.reason}, status=exc.status_code)

    # Fetch entity state to get entity_picture URL
    try:
        state = await ha_client.get_state(entity_id)
    except Exception as exc:
        logger.warning("Failed to fetch state for %s: %s", entity_id, exc)
        return web.json_response({"error": "Failed to fetch entity state"}, status=502)

    attrs = state.get("attributes", {})
    entity_picture = attrs.get("entity_picture", "")
    if not entity_picture:
        return web.json_response({"error": "No cover art available"}, status=404)

    # Build absolute URL for the image
    ha_url = ha_client._ha_url  # noqa: SLF001
    if entity_picture.startswith("/"):
        image_url = ha_url + entity_picture
    else:
        image_url = ha_url + "/" + entity_picture

    # Proxy the image from HA
    session = ha_client._get_session()  # noqa: SLF001
    try:
        async with session.get(image_url) as resp:
            if resp.status != 200:
                logger.warning("HA returned %s for media cover %s", resp.status, entity_id)
                return web.json_response({"error": "Cover art not available"}, status=404)
            data = await resp.read()
            ct = resp.headers.get("Content-Type", "image/jpeg")
            return web.Response(
                body=data,
                content_type=ct,
                headers={"Cache-Control": "public, max-age=30"},
            )
    except aiohttp.ClientConnectorError as exc:
        logger.warning("Cannot connect to HA for media cover %s: %s", entity_id, exc)
        return web.json_response({"error": "Cannot connect to HA"}, status=502)
    except Exception as exc:
        logger.error("Media cover proxy error for %s: %s", entity_id, exc)
        return web.json_response({"error": "Failed to fetch cover art"}, status=502)
