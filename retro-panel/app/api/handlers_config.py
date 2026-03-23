"""GET /api/panel-config — exposes v3 panel configuration to the frontend."""

from __future__ import annotations

import logging

from aiohttp import web

logger = logging.getLogger(__name__)


def _serialize_item(item) -> dict:
    if item.type == "entity" and item.entity_config is not None:
        ec = item.entity_config
        return {
            "type": "entity",
            "entity_id": ec.entity_id,
            "label": ec.label,
            "icon": ec.icon,
        }
    elif item.type == "energy_flow" and item.energy_flow is not None:
        ef = item.energy_flow
        return {
            "type": "energy_flow",
            "solar_power": ef.solar_power,
            "battery_soc": ef.battery_soc,
            "battery_power": ef.battery_power,
            "grid_power": ef.grid_power,
            "home_power": ef.home_power,
        }
    return {}


async def get_panel_config(request: web.Request) -> web.Response:
    """Return the panel configuration (v3) for the frontend.

    Excludes sensitive fields (ha_url, ha_token).
    """
    config = request.app["config"]

    overview_payload = [_serialize_item(it) for it in config.overview_items if _serialize_item(it)]

    rooms_payload = []
    for room in config.rooms:
        rooms_payload.append({
            "id": room.id,
            "title": room.title,
            "icon": room.icon,
            "hidden": room.hidden,
            "items": [_serialize_item(it) for it in room.items if _serialize_item(it)],
        })

    scenarios_payload = [
        {"entity_id": sc.entity_id, "title": sc.title, "icon": sc.icon}
        for sc in config.scenarios
    ]

    header_sensors_payload = [
        {"entity_id": hs.entity_id, "icon": hs.icon, "label": hs.label}
        for hs in config.header_sensors
    ]

    payload = {
        "title": config.title,
        "columns": config.columns,
        "theme": config.theme,
        "kiosk_mode": config.kiosk_mode,
        "refresh_interval": config.refresh_interval,
        "header_sensors": header_sensors_payload,
        "overview": {"title": config.overview_title, "items": overview_payload},
        "rooms": rooms_payload,
        "scenarios": scenarios_payload,
    }

    logger.debug(
        "Panel config requested: overview=%d items, rooms=%d, scenarios=%d, header_sensors=%d",
        len(overview_payload),
        len(rooms_payload),
        len(scenarios_payload),
        len(header_sensors_payload),
    )
    return web.json_response(payload)
