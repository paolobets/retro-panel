"""GET /api/picker/entities — entity list for the config page picker.

Uses GET /api/states (full dump) and filters server-side.
No dependency on the Jinja2 template API.
"""
from __future__ import annotations
import logging
from aiohttp import web

logger = logging.getLogger(__name__)

_ALLOWED_DOMAINS = frozenset({
    "light", "switch", "sensor", "binary_sensor", "alarm_control_panel",
    "scene", "script", "camera",
})


async def get_picker_entities(request: web.Request) -> web.Response:
    ha_client = request.app.get("ha_client")
    if ha_client is None:
        return web.json_response({"error": "HA client not available"}, status=503)

    domain_filter: str = request.rel_url.query.get("domain", "").strip().lower()
    if domain_filter and domain_filter not in _ALLOWED_DOMAINS:
        return web.json_response({"error": f"Unsupported domain: {domain_filter!r}"}, status=400)

    # Fetch all states from HA — no template API needed
    try:
        all_states = await ha_client.get_all_entity_states()
    except Exception as exc:
        logger.error("Failed to fetch entity states from HA: %s", exc)
        return web.json_response({"error": f"Cannot reach HA: {exc}"}, status=502)

    # Filter to allowed domains
    entities = []
    for s in all_states:
        eid = s.get("entity_id", "")
        domain = eid.split(".")[0] if "." in eid else ""
        if domain not in _ALLOWED_DOMAINS:
            continue
        attrs = s.get("attributes") or {}
        entities.append({
            "entity_id": eid,
            "friendly_name": attrs.get("friendly_name") or eid,
            "domain": domain,
            "device_class": attrs.get("device_class") or "",
            "unit": attrs.get("unit_of_measurement") or "",
        })

    # Cross-reference entity registry to exclude hidden/disabled entities
    hidden_or_disabled: set[str] = set()
    try:
        registry = await ha_client.get_entity_registry()
        hidden_or_disabled = {
            e["entity_id"] for e in registry
            if isinstance(e, dict)
            and e.get("entity_id")
            and (e.get("hidden_by") or e.get("disabled_by"))
        }
    except Exception as exc:
        logger.warning("Could not fetch entity registry: %s — hidden entities may appear", exc)

    if hidden_or_disabled:
        entities = [e for e in entities if e["entity_id"] not in hidden_or_disabled]

    if domain_filter:
        entities = [e for e in entities if e["domain"] == domain_filter]

    entities.sort(key=lambda e: e["entity_id"])
    return web.json_response(entities)
