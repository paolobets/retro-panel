"""GET /api/calendar-events/{entity_id} — proxy calendar events from HA."""
from __future__ import annotations
import logging
import re
from aiohttp import web

logger = logging.getLogger(__name__)
_CALENDAR_RE = re.compile(r'^calendar\.[a-z0-9_]+$')


async def get_calendar_events(request: web.Request) -> web.Response:
    """Proxy calendar event list from HA REST API."""
    entity_id = request.match_info["entity_id"]
    if not _CALENDAR_RE.match(entity_id):
        return web.json_response({"error": "Invalid calendar entity_id"}, status=400)
    start = request.query.get("start")
    end = request.query.get("end")
    if not start or not end:
        return web.json_response({"error": "Missing required query params: start, end"}, status=400)
    ha_client = request.app["ha_client"]
    try:
        events = await ha_client.get_calendar_events(entity_id, start, end)
        return web.json_response(events)
    except FileNotFoundError:
        return web.json_response({"error": f"Calendar not found: {entity_id}"}, status=404)
    except PermissionError:
        return web.json_response({"error": "HA authentication failed"}, status=403)
    except (ConnectionRefusedError, TimeoutError) as exc:
        logger.warning("Calendar events proxy failed for %s: %s", entity_id, exc)
        return web.json_response({"error": "HA connection failed"}, status=502)
