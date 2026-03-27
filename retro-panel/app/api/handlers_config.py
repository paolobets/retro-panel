"""GET /api/panel-config — exposes v4 panel configuration to the frontend."""

from __future__ import annotations

import logging

from aiohttp import web

logger = logging.getLogger(__name__)


def _serialize_item(item) -> dict:
    if item.type == "entity" and item.entity_config is not None:
        ec = item.entity_config
        d = {
            "type": "entity",
            "entity_id": ec.entity_id,
            "label": ec.label,
            "icon": ec.icon,
            "hidden": ec.hidden,
        }
        if ec.visual_type:
            d["visual_type"] = ec.visual_type
        if ec.display_mode:
            d["display_mode"] = ec.display_mode
        if ec.layout_type:
            d["layout_type"] = ec.layout_type
        if ec.device_class:
            d["device_class"] = ec.device_class
        return d
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
    """Return the panel configuration (v4) for the frontend.

    Excludes sensitive fields (ha_url, ha_token).
    """
    config = request.app["config"]

    overview_payload = [s for it in config.overview_items if (s := _serialize_item(it))]

    rooms_payload = []
    for room in config.rooms:
        sections_payload = []
        for section in room.sections:
            sections_payload.append({
                "id": section.id,
                "title": section.title,
                "items": [s for it in section.items if (s := _serialize_item(it))],
            })
        rooms_payload.append({
            "id": room.id,
            "title": room.title,
            "icon": room.icon,
            "hidden": room.hidden,
            "sections": sections_payload,
        })

    scenarios_payload = [
        {"entity_id": sc.entity_id, "title": sc.title, "icon": sc.icon}
        for sc in config.scenarios
    ]

    header_sensors_payload = [
        {"entity_id": hs.entity_id, "icon": hs.icon, "label": hs.label}
        for hs in config.header_sensors
    ]

    cameras_payload = [
        {"entity_id": c.entity_id, "title": c.title, "refresh_interval": c.refresh_interval}
        for c in config.cameras
    ]

    payload = {
        "title": config.title,
        "theme": config.theme,
        "kiosk_mode": config.kiosk_mode,
        "refresh_interval": config.refresh_interval,
        "header_sensors": header_sensors_payload,
        "overview": {"title": config.overview_title, "items": overview_payload},
        "rooms": rooms_payload,
        "scenarios": scenarios_payload,
        "cameras": cameras_payload,
    }

    logger.debug(
        "Panel config requested: overview=%d items, rooms=%d, scenarios=%d, header_sensors=%d, cameras=%d",
        len(overview_payload),
        len(rooms_payload),
        len(scenarios_payload),
        len(header_sensors_payload),
        len(cameras_payload),
    )
    return web.json_response(payload)
