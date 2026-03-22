"""
aiohttp handler for POST /api/config — saves updated panel settings
back to Home Assistant via the Supervisor API (POST /addons/self/options).

Security notes:
- ``ha_url`` and ``ha_token`` are NEVER accepted from the request body;
  they are read from the in-memory config and forwarded unchanged.
- All inputs are validated before forwarding to the Supervisor.
- Credentials are never logged.
"""

from __future__ import annotations

import logging
import re

from aiohttp import web

from config.loader import load_config
from proxy.supervisor_client import SupervisorClient, SupervisorError

logger = logging.getLogger(__name__)

_ENTITY_ID_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
_VALID_THEMES = {"dark", "light", "auto"}
_VALID_COLUMNS = {2, 3, 4}


def _validate(body: dict) -> str | None:
    """Validate the request body. Returns an error message or None."""
    if not isinstance(body.get("panel_title"), str) or not body["panel_title"].strip():
        return "panel_title must be a non-empty string"
    if len(body["panel_title"]) > 100:
        return "panel_title too long (max 100 chars)"

    try:
        cols = int(body.get("columns", 0))
    except (TypeError, ValueError):
        return "columns must be 2, 3, or 4"
    if cols not in _VALID_COLUMNS:
        return "columns must be 2, 3, or 4"

    if body.get("theme") not in _VALID_THEMES:
        return "theme must be dark, light, or auto"

    if not isinstance(body.get("kiosk_mode"), bool):
        return "kiosk_mode must be a boolean"

    try:
        ri = int(body.get("refresh_interval", 0))
        if not (5 <= ri <= 300):
            raise ValueError
    except (TypeError, ValueError):
        return "refresh_interval must be an integer between 5 and 300"

    entities = body.get("entities", [])
    if not isinstance(entities, list):
        return "entities must be a list"
    for ent in entities:
        if not isinstance(ent, dict):
            return "each entity must be an object"
        eid = ent.get("entity_id", "")
        if not _ENTITY_ID_RE.match(eid):
            return f"invalid entity_id: {eid!r}"

    return None


async def save_config(request: web.Request) -> web.Response:
    """Save panel configuration via the Supervisor API.

    Accepts a JSON body with the following fields:
    - ``panel_title`` (str, required)
    - ``columns`` (int: 2, 3, or 4)
    - ``theme`` (str: "dark", "light", or "auto")
    - ``kiosk_mode`` (bool)
    - ``refresh_interval`` (int: 5–300)
    - ``entities`` (list of {entity_id, label?, icon?})

    Credentials (``ha_url``, ``ha_token``) are sourced from the current
    in-memory config and are never read from the request.

    Returns:
        200 {ok: true} on success.
        400 on validation error.
        502 if the Supervisor API fails.
    """
    config = request.app["config"]
    supervisor: SupervisorClient = request.app["supervisor_client"]

    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON body."}, status=400)

    err = _validate(body)
    if err:
        return web.json_response({"error": err}, status=400)

    # Build full options — credentials are NEVER sourced from the request
    new_options = {
        "ha_url": config.ha_url,
        "ha_token": config.ha_token,
        "panel_title": body["panel_title"].strip(),
        "columns": int(body["columns"]),
        "theme": body["theme"],
        "kiosk_mode": bool(body["kiosk_mode"]),
        "refresh_interval": int(body["refresh_interval"]),
        "entities": [
            {
                "entity_id": e["entity_id"],
                **({"label": e["label"]} if e.get("label") else {}),
                **({"icon": e["icon"]} if e.get("icon") else {}),
            }
            for e in body["entities"]
        ],
    }

    try:
        await supervisor.save_options(new_options)
    except SupervisorError as exc:
        logger.error("Failed to save config via Supervisor: %s", exc)
        return web.json_response({"error": "Failed to save configuration."}, status=502)

    # Reload in-memory config so the next panel load reflects new settings
    try:
        request.app["config"] = load_config()
        logger.info(
            "Config reloaded after save: %d entities",
            len(request.app["config"].entities),
        )
    except Exception:
        logger.exception("Config saved to Supervisor but in-memory reload failed")

    return web.json_response({"ok": True})
