"""GET /api/entities — returns HA entity list for the config page entity picker.

Filters applied server-side:
- Only allowed domains (light, switch, sensor, binary_sensor, alarm_control_panel).
- Entities with attributes.hidden == true are excluded (user-hidden via HA YAML/UI).
- Optional ?domain=<domain> query parameter to restrict to a single domain
  (used by the energy card sensor picker to show only sensors).
"""

from __future__ import annotations

import logging

from aiohttp import web

logger = logging.getLogger(__name__)

_ALLOWED_DOMAINS = frozenset({
    "light", "switch", "sensor", "binary_sensor", "alarm_control_panel",
})


async def get_all_entities(request: web.Request) -> web.Response:
    """Return HA entities for the config page, with hidden entities excluded."""
    ha_client = request.app.get("ha_client")
    if ha_client is None:
        return web.json_response({"error": "HA client not available"}, status=503)

    # Optional single-domain filter (e.g. ?domain=sensor for energy picker)
    domain_filter: str = request.rel_url.query.get("domain", "").strip().lower()
    if domain_filter and domain_filter not in _ALLOWED_DOMAINS:
        return web.json_response({"error": f"Unsupported domain: {domain_filter!r}"}, status=400)

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
        if domain_filter and domain != domain_filter:
            continue

        attrs = s.get("attributes") or {}

        # Skip entities explicitly hidden by the user in HA
        if attrs.get("hidden") is True:
            continue

        entities.append({
            "entity_id": entity_id,
            "friendly_name": attrs.get("friendly_name") or entity_id,
            "domain": domain,
            "device_class": attrs.get("device_class") or "",
            "unit": attrs.get("unit_of_measurement") or "",
        })

    entities.sort(key=lambda e: e["entity_id"])
    return web.json_response(entities)
