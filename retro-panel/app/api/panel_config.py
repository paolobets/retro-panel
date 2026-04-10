"""GET /api/panel-config — exposes v5 panel configuration to the frontend."""

from __future__ import annotations

import logging

from aiohttp import web

from app.config.loader import _compute_layout_type

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
            "solar_power":             ef.solar_power,
            "home_power":              ef.home_power,
            "battery_soc":             ef.battery_soc,
            "battery_charge_power":    ef.battery_charge_power,
            "battery_discharge_power": ef.battery_discharge_power,
            "grid_import":             ef.grid_import,
            "grid_export":             ef.grid_export,
            "solar_max_kw":            ef.solar_max_kw,
            "home_max_kw":             ef.home_max_kw,
            "grid_max_kw":             ef.grid_max_kw,
        }
    elif item.type == "sensor_conditional" and item.conditional_sensor is not None:
        cs = item.conditional_sensor
        return {
            "type":             "sensor_conditional",
            "entity_id":        cs.entity_id,
            "label":            cs.label,
            "icon":             cs.icon,
            "border_color":     cs.border_color,
            "condition_logic":  cs.condition_logic,
            "conditions": [
                {"entity": r.entity, "op": r.op, "value": r.value}
                for r in cs.conditions
            ],
        }
    return {}


async def get_panel_config(request: web.Request) -> web.Response:
    """Return the panel configuration (v5) for the frontend.

    Excludes sensitive fields (ha_url, ha_token).
    """
    config = request.app["config"]

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

    header_sensors_payload = [
        {"entity_id": hs.entity_id, "icon": hs.icon, "label": hs.label}
        for hs in config.header_sensors
    ]

    payload = {
        "title": config.title,
        "theme": config.theme,
        "refresh_interval": config.refresh_interval,
        "version": request.app.get("addon_version", ""),
        "header_sensors": header_sensors_payload,
        "overview": {
            "title": config.overview_title,
            "icon": config.overview_icon,
            "sections": [
                {
                    "id": sec.id,
                    "title": sec.title,
                    "items": [s for it in sec.items if (s := _serialize_item(it))],
                }
                for sec in config.overview_sections
            ],
        },
        "rooms": rooms_payload,
        "scenarios": [
            {
                "id": sec.id,
                "title": sec.title,
                "items": [
                    {"entity_id": s.entity_id, "title": s.title, "icon": s.icon, "border_color": s.border_color}
                    for s in sec.items
                ],
            }
            for sec in config.scenario_sections
        ],
        "cameras": [
            {
                "id": sec.id,
                "title": sec.title,
                "items": [
                    {"entity_id": c.entity_id, "title": c.title, "refresh_interval": c.refresh_interval, "hidden": c.hidden}
                    for c in sec.items
                ],
            }
            for sec in config.camera_sections
        ],
        "scenarios_section": {
            "title": config.scenarios_section_title,
            "icon":  config.scenarios_section_icon,
        },
        "cameras_section": {
            "title": config.cameras_section_title,
            "icon":  config.cameras_section_icon,
        },
        "alarms": [
            {
                "entity_id": a.entity_id,
                "label": a.label,
                "sensors": [
                    {
                        "entity_id": s.entity_id,
                        "label": s.label,
                        "device_class": s.device_class,
                        "layout_type": _compute_layout_type(s.entity_id, s.device_class, ""),
                    }
                    for s in a.sensors
                ],
            }
            for a in config.alarms
        ],
        "alarms_section": {
            "title": config.alarms_section_title,
            "icon":  config.alarms_section_icon,
        },
        "nav_order": config.nav_order,
    }

    logger.debug(
        "Panel config requested: overview=%d sections, rooms=%d, scenarios=%d sections, header_sensors=%d, cameras=%d sections, alarms=%d",
        len(payload["overview"]["sections"]),
        len(rooms_payload),
        len(payload["scenarios"]),
        len(header_sensors_payload),
        len(payload["cameras"]),
        len(payload["alarms"]),
    )
    return web.json_response(payload)
