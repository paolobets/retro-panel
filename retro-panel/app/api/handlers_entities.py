"""GET /api/entities — returns HA entity list for the config page entity picker.

Filters applied server-side:
- Only allowed domains (light, switch, sensor, binary_sensor, alarm_control_panel).
- Entities hidden or disabled in HA are excluded via entity registry cross-reference
  (/api/config/entity_registry). Note: the HA ``states`` Jinja2 variable includes
  hidden entities — ``hidden_by`` / ``disabled_by`` live in the entity registry, not
  in state objects, so the registry must be consulted explicitly.
- Optional ?domain=<domain> query parameter to restrict to a single domain
  (used by the energy card sensor picker to show only sensors).
"""

from __future__ import annotations

import json
import logging

from aiohttp import web

logger = logging.getLogger(__name__)

_ALLOWED_DOMAINS = frozenset({
    "light", "switch", "sensor", "binary_sensor", "alarm_control_panel",
    "scene", "script", "camera",
})

_TEMPLATE = (
    "{% set allowed_domains = ['light','switch','sensor','binary_sensor','alarm_control_panel','scene','script','camera'] %}"
    "{% set ns = namespace(r=[]) %}"
    "{% for state in states %}"
    "{% if state.domain in allowed_domains %}"
    "{% set ns.r = ns.r + [{"
    "'entity_id':state.entity_id,"
    "'friendly_name':state.name,"
    "'domain':state.domain,"
    "'device_class':(state.attributes.get('device_class') or ''),"
    "'unit':(state.attributes.get('unit_of_measurement') or '')"
    "}] %}"
    "{% endif %}"
    "{% endfor %}"
    "{{ ns.r | tojson }}"
)


async def get_all_entities(request: web.Request) -> web.Response:
    """Return HA entities for the config page, with hidden/disabled entities excluded."""
    ha_client = request.app.get("ha_client")
    if ha_client is None:
        return web.json_response({"error": "HA client not available"}, status=503)

    # Optional single-domain filter (e.g. ?domain=sensor for energy picker)
    domain_filter: str = request.rel_url.query.get("domain", "").strip().lower()
    if domain_filter and domain_filter not in _ALLOWED_DOMAINS:
        return web.json_response({"error": f"Unsupported domain: {domain_filter!r}"}, status=400)

    try:
        raw = await ha_client.call_template(_TEMPLATE)
        all_entities: list[dict] = json.loads(raw)
    except Exception as exc:
        logger.error("Failed to fetch entities from HA template API: %s", exc)
        return web.json_response({"error": "Failed to fetch entities from HA"}, status=502)

    # Cross-reference the entity registry to exclude hidden or disabled entities.
    # The HA `states` variable includes hidden entities — hidden_by / disabled_by
    # are registry-only fields and are not reflected in state objects.
    hidden_or_disabled: set[str] = set()
    try:
        registry = await ha_client.get_entity_registry()
        hidden_or_disabled = {
            e["entity_id"] for e in registry
            if isinstance(e, dict)
            and e.get("entity_id")
            and (e.get("hidden_by") or e.get("disabled_by"))
        }
        logger.debug("Entity registry: %d hidden/disabled entries filtered", len(hidden_or_disabled))
    except Exception as exc:
        logger.warning(
            "Could not fetch entity registry for hidden-entity filtering: %s — "
            "hidden entities may appear in the picker",
            exc,
        )

    if hidden_or_disabled:
        all_entities = [e for e in all_entities if e.get("entity_id") not in hidden_or_disabled]

    if domain_filter:
        all_entities = [e for e in all_entities if e.get("domain") == domain_filter]

    all_entities.sort(key=lambda e: e.get("entity_id", ""))
    return web.json_response(all_entities)
