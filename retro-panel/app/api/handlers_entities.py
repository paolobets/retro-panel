"""GET /api/entities — returns HA entity list for the config page entity picker.

Uses ha_client (the main HA connection) instead of a separate supervisor_client,
so it shares the same authenticated session and URL that the rest of the add-on
already uses successfully.
"""

from __future__ import annotations

import logging

from aiohttp import web

logger = logging.getLogger(__name__)

_ALLOWED_DOMAINS = frozenset({
    "light", "switch", "sensor", "binary_sensor", "alarm_control_panel",
})


async def get_all_entities(request: web.Request) -> web.Response:
    """Return all HA entities in allowed domains, sorted by entity_id."""
    ha_client = request.app.get("ha_client")
    if ha_client is None:
        return web.json_response({"error": "HA client not available"}, status=503)

    try:
        states = await ha_client.get_all_entity_states()
    except Exception as exc:
        logger.error("Failed to fetch entity states from HA: %s", exc)
        return web.json_response({"error": "Failed to fetch entities from HA"}, status=502)

    entities = []
    for s in states:
        entity_id: str = s.get("entity_id", "")
        domain = entity_id.split(".")[0] if "." in entity_id else ""
        if domain not in _ALLOWED_DOMAINS:
            continue
        attrs = s.get("attributes") or {}
        entities.append({
            "entity_id": entity_id,
            "friendly_name": attrs.get("friendly_name") or entity_id,
            "domain": domain,
        })

    entities.sort(key=lambda e: e["entity_id"])
    return web.json_response(entities)
