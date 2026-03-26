"""Camera endpoints.

GET /api/ha-cameras      — list all camera entities from HA (for the config picker).
GET /api/camera-proxy/{entity_id} — proxy a camera snapshot from HA, whitelist-gated.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re

from aiohttp import web

logger = logging.getLogger(__name__)

_CAMERA_ENTITY_RE = re.compile(r"^camera\.[a-z0-9_]+$")

_CAMERAS_TEMPLATE = (
    "{{ states | selectattr('domain', 'equalto', 'camera')"
    " | map(attribute='entity_id') | list | tojson }}"
)


async def get_ha_cameras(request: web.Request) -> web.Response:
    """Return all camera entities from HA (entity_id + friendly_name)."""
    ha_client = request.app.get("ha_client")
    if ha_client is None:
        return web.json_response({"error": "HA client not available"}, status=503)

    try:
        raw = await ha_client.call_template(_CAMERAS_TEMPLATE)
        entity_ids: list[str] = json.loads(raw)
    except Exception as exc:
        logger.error("Failed to fetch camera entities from HA template API: %s", exc)
        return web.json_response({"error": "Failed to fetch cameras from HA"}, status=502)

    # Fetch friendly_name for each camera entity
    cameras: list[dict] = []
    for eid in entity_ids:
        friendly_name = eid
        try:
            state = await ha_client.get_state(eid)
            friendly_name = (
                state.get("attributes", {}).get("friendly_name") or eid
            )
        except Exception as exc:
            logger.warning("Could not fetch state for camera %s: %s", eid, exc)
        cameras.append({"entity_id": eid, "friendly_name": friendly_name})

    cameras.sort(key=lambda c: c["entity_id"])
    return web.json_response(cameras)


async def get_camera_proxy(request: web.Request) -> web.Response:
    """Proxy a camera snapshot from HA with whitelist validation."""
    # Layer 1: extract entity_id from route
    entity_id: str = request.match_info["entity_id"]

    # Layer 2: regex validation
    if not _CAMERA_ENTITY_RE.match(entity_id):
        return web.json_response(
            {"error": f"Invalid camera entity_id: {entity_id!r}"}, status=400
        )

    # Layer 3: whitelist check against configured cameras
    config = request.app.get("config")
    if config is None or entity_id not in config.all_entity_ids:
        return web.json_response(
            {"error": f"Camera not in configured whitelist: {entity_id!r}"}, status=403
        )

    # Layer 4: fetch from HA
    ha_client = request.app.get("ha_client")
    if ha_client is None:
        return web.json_response({"error": "HA client not available"}, status=503)

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

    # Layer 5: return image with cache-busting headers
    return web.Response(
        body=data,
        content_type=ct,
        headers={"Cache-Control": "no-store, no-cache"},
    )
