"""
aiohttp request handler that exposes panel configuration to the frontend.
The HA URL and token are explicitly excluded from the response.
"""

from __future__ import annotations

import logging

from aiohttp import web

logger = logging.getLogger(__name__)


async def get_panel_config(request: web.Request) -> web.Response:
    """Return the panel configuration for the frontend.

    Excludes sensitive fields (ha_url, ha_token) from the response.
    """
    config = request.app["config"]

    entities_payload = [
        {
            "entity_id": ent.entity_id,
            "label": ent.label,
            "icon": ent.icon,
            "row": ent.row,
            "col": ent.col,
        }
        for ent in config.entities
    ]

    payload = {
        "title": config.title,
        "columns": config.columns,
        "theme": config.theme,
        "kiosk_mode": config.kiosk_mode,
        "refresh_interval": config.refresh_interval,
        "entities": entities_payload,
    }

    logger.debug("Panel config requested: %d entities", len(entities_payload))
    return web.json_response(payload)
