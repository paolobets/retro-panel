"""
aiohttp request handler that exposes panel configuration to the frontend.
The HA URL and token are explicitly excluded from the response.
"""

from __future__ import annotations

import logging

from aiohttp import web

logger = logging.getLogger(__name__)


async def get_panel_config(request: web.Request) -> web.Response:
    """Return the panel configuration (pages structure) for the frontend.

    Excludes sensitive fields (ha_url, ha_token) from the response.
    """
    config = request.app["config"]

    pages_payload = []
    for page in config.pages:
        items = []
        for item in page.items:
            if item.type == "entity" and item.entity_config is not None:
                ec = item.entity_config
                items.append({
                    "type": "entity",
                    "entity_id": ec.entity_id,
                    "label": ec.label,
                    "icon": ec.icon,
                })
            elif item.type == "energy_flow" and item.energy_flow is not None:
                ef = item.energy_flow
                items.append({
                    "type": "energy_flow",
                    "solar_power": ef.solar_power,
                    "battery_soc": ef.battery_soc,
                    "battery_power": ef.battery_power,
                    "grid_power": ef.grid_power,
                    "home_power": ef.home_power,
                })
        pages_payload.append({
            "id": page.id,
            "title": page.title,
            "icon": page.icon,
            "items": items,
        })

    payload = {
        "title": config.title,
        "columns": config.columns,
        "theme": config.theme,
        "kiosk_mode": config.kiosk_mode,
        "refresh_interval": config.refresh_interval,
        "pages": pages_payload,
    }

    total_entities = sum(len([i for i in p["items"] if i["type"] == "entity"]) for p in pages_payload)
    logger.debug("Panel config requested: %d pages, %d entities", len(pages_payload), total_entities)
    return web.json_response(payload)
