"""
aiohttp request handlers for entity state endpoints.

Security controls:
- Entity whitelist: only configured entities are accessible.
- Entity ID format validation: prevents path traversal in URL construction.
- Error detail isolation: internal exceptions logged server-side only.
"""

from __future__ import annotations

import logging
import re

from aiohttp import web

logger = logging.getLogger(__name__)

# Entity ID must be: lowercase_domain.lowercase_object_id
_ENTITY_ID_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")


async def get_state(request: web.Request) -> web.Response:
    """Return the current state of a single configured entity.

    Validates entity_id format and checks against the configured entity
    whitelist before proxying to HA. Only configured entities are accessible.

    Returns:
        200 JSON {entity_id, state, attributes} on success.
        400 if entity_id format is invalid.
        403 if entity is not in the configured list.
        502 if the upstream HA call fails.
    """
    config = request.app["config"]
    ha_client = request.app["ha_client"]

    entity_id: str = request.match_info["entity_id"]

    # Format validation: prevents path traversal and injection
    if not _ENTITY_ID_RE.match(entity_id):
        logger.warning("Rejected request with malformed entity_id: %r", entity_id)
        return web.json_response(
            {"error": "Invalid entity_id format."},
            status=400,
        )

    allowed = set(config.all_entity_ids)
    if entity_id not in allowed:
        logger.warning("Blocked request for unconfigured entity: %s", entity_id)
        return web.json_response(
            {"error": "Entity not in configured list."},
            status=403,
        )

    try:
        state = await ha_client.get_state(entity_id)
        return web.json_response(state)
    except ValueError as exc:
        logger.warning("Entity not found in HA: %s — %s", entity_id, exc)
        return web.json_response({"error": "Entity not found."}, status=404)
    except (ConnectionRefusedError, TimeoutError):
        logger.error("HA unreachable fetching %s", entity_id)
        return web.json_response(
            {"error": "Home Assistant is unreachable. Try again shortly."},
            status=502,
        )
    except Exception:
        logger.exception("Unexpected error fetching state for %s", entity_id)
        return web.json_response({"error": "Internal server error."}, status=502)


async def get_all_states(request: web.Request) -> web.Response:
    """Return states for all configured entities in a single response.

    Intended for the frontend initial load to avoid N sequential requests.
    Entities that fail to load are included with state='unavailable'.

    Supports optional ?ids= query parameter for lazy loading: only the
    requested entity IDs (validated against the whitelist) are fetched.

    Returns:
        200 JSON list of state dicts (one per configured entity).
        502 if all upstream HA calls fail entirely.
    """
    config = request.app["config"]
    ha_client = request.app["ha_client"]

    # Optional ?ids= for lazy loading (only fetch visible entities)
    ids_param = request.rel_url.query.get("ids", "").strip()
    if ids_param:
        requested = [i.strip() for i in ids_param.split(",") if i.strip()]
        allowed = set(config.all_entity_ids)
        entity_ids = [eid for eid in requested if _ENTITY_ID_RE.match(eid) and eid in allowed]
        if not entity_ids:
            return web.json_response([])
    else:
        entity_ids = config.all_entity_ids

    if not entity_ids:
        return web.json_response([])

    try:
        states = await ha_client.get_states_bulk(entity_ids)
        return web.json_response(states)
    except (ConnectionRefusedError, TimeoutError):
        logger.error("HA unreachable fetching all states")
        return web.json_response(
            {"error": "Home Assistant is unreachable. Try again shortly."},
            status=502,
        )
    except Exception:
        logger.exception("Unexpected error fetching all states")
        return web.json_response({"error": "Internal server error."}, status=502)
