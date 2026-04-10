"""GET /api/picker/calendars — list calendar entities from HA."""
from __future__ import annotations
import logging
from aiohttp import web

logger = logging.getLogger(__name__)


async def get_picker_calendars(request: web.Request) -> web.Response:
    """Return all calendar.* entities known to HA."""
    ha_client = request.app["ha_client"]
    try:
        entities = await ha_client.get_entity_registry()
    except Exception:
        logger.exception("Failed to fetch entity registry for calendar picker")
        return web.json_response({"error": "Failed to fetch entities"}, status=502)
    calendars = []
    for ent in entities:
        eid = ent.get("entity_id", "")
        if eid.startswith("calendar."):
            calendars.append({
                "entity_id": eid,
                "name": ent.get("name") or ent.get("original_name") or eid,
                "area_id": ent.get("area_id") or "",
            })
    return web.json_response(calendars)
