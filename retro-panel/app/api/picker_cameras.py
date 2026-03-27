"""GET /api/picker/cameras — camera entity list for the config page picker.

Uses GET /api/states filtered to camera domain.
No dependency on the Jinja2 template API.
"""
from __future__ import annotations
import logging
from aiohttp import web

logger = logging.getLogger(__name__)


async def get_picker_cameras(request: web.Request) -> web.Response:
    ha_client = request.app.get("ha_client")
    if ha_client is None:
        return web.json_response({"error": "HA client not available"}, status=503)

    try:
        all_states = await ha_client.get_all_entity_states()
    except Exception as exc:
        logger.error("Failed to fetch entity states from HA: %s", exc)
        return web.json_response({"error": f"Cannot reach HA: {exc}"}, status=502)

    cameras = []
    for s in all_states:
        eid = s.get("entity_id", "")
        if not eid.startswith("camera."):
            continue
        attrs = s.get("attributes") or {}
        cameras.append({
            "entity_id": eid,
            "friendly_name": attrs.get("friendly_name") or eid,
        })

    cameras.sort(key=lambda c: c["entity_id"])
    return web.json_response(cameras)
