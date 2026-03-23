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
{% set active_ids = states | map(attribute='entity_id') | list %}
{% set ns = namespace(r=[]) %}
{% for a in areas() %}
{% set ents = area_entities(a) | select('in', active_ids) | list %}
{% set ns.r = ns.r + [{'id': a, 'name': area_name(a), 'entity_ids': ents}] %}
{% endfor %}
{{ ns.r | tojson }}"""


async def get_ha_areas(request: web.Request) -> web.Response:
    """Return list of HA areas with their entity ids.

    Each entry: {id, name, entity_ids: [...]}
    Entity ids are filtered:
    - removes excluded domains
    - removes entities hidden or disabled in the HA entity registry
      (cross-referenced via /api/config/entity_registry; falls back to
      state-presence check only if the registry call fails)
    """
    ha_client = request.app["ha_client"]
    try:
        raw = await ha_client.call_template(_TEMPLATE)
        areas = json.loads(raw)
    except Exception as exc:
        logger.error("Failed to fetch HA areas: %s", exc)
        return web.json_response({"error": str(exc)}, status=502)

    # Build set of entity_ids that are hidden or disabled in the entity registry.
    # This filters entities that HA marks as hidden_by / disabled_by (they can
    # still appear in states even when hidden, so template cross-referencing alone
    # is not sufficient).
    hidden_or_disabled: set[str] = set()
    try:
        registry = await ha_client.get_entity_registry()
        hidden_or_disabled = {
            e["entity_id"] for e in registry
            if isinstance(e, dict)
            and e.get("entity_id")
            and (e.get("hidden_by") or e.get("disabled_by"))
        }
        logger.debug(
            "Entity registry loaded: %d hidden/disabled entries", len(hidden_or_disabled)
        )
    except Exception as exc:
        logger.warning(
            "Could not fetch entity registry for hidden-entity filtering: %s — "
            "falling back to state-presence filter only",
            exc,
        )

    result = []
    for area in areas:
        if not isinstance(area, dict):
            continue
        entity_ids = []
        for eid in area.get("entity_ids") or []:
            domain = eid.split(".")[0] if "." in eid else ""
            if domain in _EXCLUDED_DOMAINS:
                continue
            if eid in hidden_or_disabled:
                continue
            entity_ids.append(eid)
        result.append({
            "id": area.get("id", ""),
            "name": area.get("name", ""),
            "entity_ids": entity_ids,
        })

    logger.debug("Returning %d HA areas", len(result))
    return web.json_response(result)
