"""GET /api/picker/areas — HA area registry with entity lists for the config picker.

Uses WebSocket config/area_registry/list + config/entity_registry/list +
config/device_registry/list (for device-level area fallback).
No dependency on the Jinja2 template API.
"""
from __future__ import annotations
import logging
from aiohttp import web

logger = logging.getLogger(__name__)

_EXCLUDED_DOMAINS = frozenset({
    "update", "media_player", "camera", "person", "zone",
    "weather", "number", "select", "button", "input_boolean",
    "input_number", "input_select", "input_text", "input_datetime",
    "automation", "script", "scene", "group", "persistent_notification",
    "system_log", "notify", "tts", "stt",
})


async def get_picker_areas(request: web.Request) -> web.Response:
    ha_client = request.app["ha_client"]

    # Fetch area registry via WebSocket
    try:
        area_list = await ha_client.get_area_registry()
    except Exception as exc:
        logger.error("Failed to fetch HA area registry: %s", exc)
        return web.json_response({"error": f"Cannot reach HA: {exc}"}, status=502)

    # Fetch entity registry via WebSocket (includes area_id + hidden_by/disabled_by)
    entity_registry: list[dict] = []
    try:
        entity_registry = await ha_client.get_entity_registry()
    except Exception as exc:
        logger.warning("Could not fetch entity registry: %s — area entities may include hidden ones", exc)

    # Fetch device registry for device-level area fallback (non-fatal)
    device_registry: list[dict] = []
    try:
        device_registry = await ha_client.get_device_registry()
    except Exception as exc:
        logger.warning("Could not fetch device registry: %s — device-level area assignments ignored", exc)

    # Build area name lookup: area_id → name
    area_names: dict[str, str] = {}
    for area in area_list:
        if not isinstance(area, dict):
            continue
        aid = area.get("area_id") or area.get("id") or ""
        name = area.get("name") or aid
        if aid:
            area_names[aid] = name

    # Build device_id → area_id map for fallback
    device_area_map: dict[str, str] = {}
    for dev in device_registry:
        if not isinstance(dev, dict):
            continue
        did = dev.get("id") or ""
        aid = dev.get("area_id") or ""
        if did and aid:
            device_area_map[did] = aid

    # Build entity-to-area map, excluding hidden/disabled and excluded domains.
    # Entity-level area_id takes precedence; falls back to device-level area_id.
    area_entities: dict[str, list[str]] = {aid: [] for aid in area_names}
    for entry in entity_registry:
        if not isinstance(entry, dict):
            continue
        eid = entry.get("entity_id") or ""
        entity_area = entry.get("area_id")
        area_id = entity_area if entity_area is not None else device_area_map.get(entry.get("device_id") or "", "")
        if not eid or not area_id or area_id not in area_names:
            continue
        if entry.get("hidden_by") or entry.get("disabled_by"):
            continue
        domain = eid.split(".")[0] if "." in eid else ""
        if domain in _EXCLUDED_DOMAINS:
            continue
        area_entities[area_id].append(eid)

    result = [
        {"id": aid, "name": area_names[aid], "entity_ids": area_entities.get(aid, [])}
        for aid in area_names
    ]
    result.sort(key=lambda a: a["name"].lower())
    logger.debug("Returning %d HA areas", len(result))
    return web.json_response(result)
