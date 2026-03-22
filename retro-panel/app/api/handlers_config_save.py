"""POST /api/config — saves entity list via Supervisor API and reloads in-memory config."""

from __future__ import annotations

import logging
import re

from aiohttp import web

logger = logging.getLogger(__name__)

_ENTITY_ID_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")


async def save_config(request: web.Request) -> web.Response:
    """Accept a new entity list, save it via Supervisor, reload in-memory config."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON body"}, status=400)

    entities_raw = body.get("entities")
    if not isinstance(entities_raw, list):
        return web.json_response({"error": "'entities' must be a list"}, status=400)

    entities: list[dict] = []
    for idx, item in enumerate(entities_raw):
        entity_id = str(item.get("entity_id") or "").strip()
        if not entity_id:
            return web.json_response(
                {"error": f"Entity at index {idx} is missing entity_id"}, status=400
            )
        if not _ENTITY_ID_RE.match(entity_id):
            return web.json_response(
                {"error": f"Invalid entity_id format: {entity_id!r}"}, status=400
            )
        ent: dict = {"entity_id": entity_id}
        if item.get("label"):
            ent["label"] = str(item["label"])[:64]
        if item.get("icon"):
            ent["icon"] = str(item["icon"])[:32]
        if item.get("row") is not None:
            ent["row"] = int(item["row"])
        if item.get("col") is not None:
            ent["col"] = int(item["col"])
        entities.append(ent)

    # Build full options from in-memory config — ha_url/ha_token never come from the request
    config = request.app["config"]
    options = {
        "ha_url": config.ha_url,
        "ha_token": config.ha_token,
        "panel_title": config.title,
        "columns": config.columns,
        "theme": config.theme,
        "kiosk_mode": config.kiosk_mode,
        "refresh_interval": config.refresh_interval,
        "entities": entities,
    }

    supervisor_client = request.app.get("supervisor_client")
    if supervisor_client is None:
        return web.json_response({"error": "Supervisor client not available"}, status=503)

    try:
        await supervisor_client.save_options(options)
    except Exception as exc:
        logger.error("Failed to save config via Supervisor: %s", exc)
        return web.json_response({"error": "Failed to save configuration"}, status=502)

    logger.info("Config saved via Supervisor: %d entities", len(entities))

    # Reload in-memory config so /api/panel-config returns updated entities immediately
    try:
        from config.loader import load_config
        request.app["config"] = load_config()
        logger.info("In-memory config reloaded after save")
    except Exception as exc:
        logger.warning("Config saved but in-memory reload failed: %s", exc)

    return web.json_response({"ok": True, "entities": len(entities)})
