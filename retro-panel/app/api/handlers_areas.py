"""GET /api/ha-areas — returns HA area registry with entities per area."""

from __future__ import annotations

import json
import logging

from aiohttp import web

logger = logging.getLogger(__name__)

# Domains excluded from area entity lists (media players, update, etc.)
_EXCLUDED_DOMAINS = frozenset({
    "update", "media_player", "camera", "person", "zone",
    "weather", "number", "select", "button", "input_boolean",
    "input_number", "input_select", "input_text", "input_datetime",
    "automation", "script", "scene", "group", "persistent_notification",
    "system_log", "notify", "tts", "stt",
})

_TEMPLATE = """\
{% set ns = namespace(r=[]) %}
{% for a in areas() %}
{% set ents = area_entities(a) | list %}
{% set ns.r = ns.r + [{'id': a, 'name': area_name(a), 'entity_ids': ents}] %}
{% endfor %}
{{ ns.r | tojson }}"""


async def get_ha_areas(request: web.Request) -> web.Response:
    """Return list of HA areas with their entity ids.

    Each entry: {id, name, entity_ids: [...]}
    Entity ids are filtered:
    - removes excluded domains
    - removes hidden entities (attributes.hidden == true)
    """
    ha_client = request.app["ha_client"]
    try:
        raw = await ha_client.call_template(_TEMPLATE)
        areas = json.loads(raw)
    except Exception as exc:
        logger.error("Failed to fetch HA areas: %s", exc)
        return web.json_response({"error": str(exc)}, status=502)

    # Also get all entity states so we can filter hidden ones
    try:
        all_states = await ha_client.get_all_entity_states()
        hidden_ids: set[str] = {
            s["entity_id"]
            for s in all_states
            if s.get("attributes", {}).get("hidden") is True
        }
    except Exception as exc:
        logger.warning("Could not fetch entity states for hidden filter: %s", exc)
        hidden_ids = set()

    result = []
    for area in areas:
        if not isinstance(area, dict):
            continue
        entity_ids = []
        for eid in area.get("entity_ids") or []:
            domain = eid.split(".")[0] if "." in eid else ""
            if domain in _EXCLUDED_DOMAINS:
                continue
            if eid in hidden_ids:
                continue
            entity_ids.append(eid)
        result.append({
            "id": area.get("id", ""),
            "name": area.get("name", ""),
            "entity_ids": entity_ids,
        })

    logger.debug("Returning %d HA areas", len(result))
    return web.json_response(result)
