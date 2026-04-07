"""
aiohttp request handlers for HA service call endpoints.

Security controls:
- Domain allowlist: only permitted HA domains can be called.
- Service allowlist: per-domain list of permitted service names.
- Entity whitelist: only configured entities can be targeted.
- Input format validation: entity_id must match domain.object_id format.
- Error detail isolation: internal exceptions are logged server-side only.
"""

from __future__ import annotations

import logging
import re

from aiohttp import web

logger = logging.getLogger(__name__)

# Permitted HA domains — any domain not in this set is rejected at the handler
# before any body parsing or HA communication.
_ALLOWED_DOMAINS: frozenset[str] = frozenset(
    {"light", "switch", "alarm_control_panel", "input_boolean", "cover", "scene", "script", "automation", "lock", "button", "climate"}
)

# Per-domain allowlist of permitted service names.
# This prevents calling dangerous services (e.g. alarm_control_panel/alarm_trigger)
# even if the domain is whitelisted.
_ALLOWED_SERVICES: dict[str, frozenset[str]] = {
    "light": frozenset({"turn_on", "turn_off", "toggle"}),
    "switch": frozenset({"turn_on", "turn_off", "toggle"}),
    "alarm_control_panel": frozenset({
        "alarm_arm_home",
        "alarm_arm_away",
        "alarm_arm_night",
        "alarm_disarm",
    }),
    "input_boolean": frozenset({"turn_on", "turn_off", "toggle"}),
    "cover": frozenset({"open_cover", "close_cover", "stop_cover", "set_cover_position"}),
    "scene": frozenset({"turn_on"}),
    "script": frozenset({"turn_on", "turn_off"}),
    "automation": frozenset({"trigger", "turn_on", "turn_off"}),
    "lock": frozenset({"lock", "unlock"}),
    "button": frozenset({"press"}),
    "climate": frozenset({"set_temperature", "set_hvac_mode", "turn_off"}),
}

# Entity ID must be: lowercase_domain.lowercase_object (e.g. light.living_room)
_ENTITY_ID_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")

# Service name: only lowercase letters and underscores
_SERVICE_RE = re.compile(r"^[a-z_]+$")


async def call_service(request: web.Request) -> web.Response:
    """Proxy a service call to Home Assistant.

    Validation chain (fails fast in order):
    1. Domain must be in _ALLOWED_DOMAINS.
    2. Service must be in _ALLOWED_SERVICES[domain].
    3. Request body must be valid JSON.
    4. entity_id must be present and match the expected format.
    5. entity_id must be in the configured entity list.

    On success: proxies to HA and returns the result.
    On failure: returns a sanitized error (no internal detail).
    """
    config = request.app["config"]
    ha_client = request.app["ha_client"]

    domain: str = request.match_info["domain"]
    service: str = request.match_info["service"]

    # --- 1. Domain validation ---
    if domain not in _ALLOWED_DOMAINS:
        logger.warning("Blocked service call to disallowed domain: %s", domain)
        return web.json_response(
            {"error": "Service domain not permitted."},
            status=400,
        )

    # --- 2. Service name validation ---
    # Check format first (prevents log injection and unexpected characters)
    if not _SERVICE_RE.match(service):
        logger.warning("Blocked service call with invalid service name: %s", service)
        return web.json_response(
            {"error": "Service name contains invalid characters."},
            status=400,
        )
    allowed_services = _ALLOWED_SERVICES.get(domain, frozenset())
    if service not in allowed_services:
        logger.warning("Blocked call to non-whitelisted service: %s.%s", domain, service)
        return web.json_response(
            {"error": "Service not permitted for this domain."},
            status=400,
        )

    # --- 3. Parse body ---
    try:
        body: dict = await request.json()
    except Exception:
        return web.json_response(
            {"error": "Request body must be valid JSON."},
            status=400,
        )

    if not isinstance(body, dict):
        return web.json_response(
            {"error": "Request body must be a JSON object."},
            status=400,
        )

    # --- 4. Entity ID validation ---
    entity_id: str = body.get("entity_id", "")
    if not entity_id:
        return web.json_response(
            {"error": "'entity_id' is required in the request body."},
            status=400,
        )
    if not _ENTITY_ID_RE.match(entity_id):
        logger.warning("Blocked service call with malformed entity_id: %r", entity_id)
        return web.json_response(
            {"error": "Invalid entity_id format."},
            status=400,
        )

    # --- 5. Entity whitelist check ---
    # Use all_entity_ids which includes alarm panels and zone sensors,
    # not just layout entities.
    allowed = set(config.all_entity_ids)
    if entity_id not in allowed:
        logger.warning("Blocked service call for unconfigured entity: %s", entity_id)
        return web.json_response(
            {"error": "Entity not in configured list."},
            status=403,
        )

    logger.info("Service call: %s.%s on %s", domain, service, entity_id)

    # --- Proxy to HA ---
    try:
        result = await ha_client.call_service(domain, service, body)
        return web.json_response(result)
    except ValueError as exc:
        # HA returned a 4xx (e.g. invalid service parameters) — safe to surface briefly
        logger.warning("HA rejected service call %s.%s: %s", domain, service, exc)
        return web.json_response({"error": "HA rejected the service call."}, status=400)
    except (ConnectionRefusedError, TimeoutError):
        logger.error("HA unreachable during service call %s.%s", domain, service)
        return web.json_response(
            {"error": "Home Assistant is unreachable. Try again shortly."},
            status=502,
        )
    except Exception:
        # Log full details server-side; return generic message to client
        logger.exception("Unexpected error during service call %s.%s", domain, service)
        return web.json_response({"error": "Internal server error."}, status=502)
