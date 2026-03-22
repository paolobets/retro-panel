"""
aiohttp handler that returns all available HA entity states
for the configuration page entity picker.

Uses the Supervisor API (SupervisorClient) rather than the direct HAClient
so that the add-on does not need to know the HA URL/token for this endpoint.
Requires ``hassio_api: true`` in config.yaml.
"""

from __future__ import annotations

import logging

from aiohttp import web

from proxy.supervisor_client import SupervisorClient, SupervisorError

logger = logging.getLogger(__name__)

# Domains exposed in the config-page entity picker
SUPPORTED_DOMAINS = {
    "light",
    "switch",
    "sensor",
    "binary_sensor",
    "alarm_control_panel",
    "cover",
    "input_boolean",
    "climate",
    "media_player",
    "fan",
    "lock",
    "automation",
    "script",
    "scene",
    "person",
    "device_tracker",
}


async def get_all_entities(request: web.Request) -> web.Response:
    """Return a sorted list of all HA entities from the Supervisor proxy.

    Only entities whose domain is in SUPPORTED_DOMAINS are included.
    Each entry contains ``entity_id``, ``friendly_name``, and ``domain``.

    Returns:
        200 JSON list on success.
        502 if the Supervisor API is unreachable or returns an error.
    """
    supervisor: SupervisorClient = request.app["supervisor_client"]
    try:
        raw_states = await supervisor.get_all_states()
    except SupervisorError as exc:
        logger.error("Failed to fetch entities from Supervisor: %s", exc)
        return web.json_response({"error": str(exc)}, status=502)

    entities = []
    for s in raw_states:
        eid = s.get("entity_id", "")
        if not eid or "." not in eid:
            continue
        domain = eid.split(".")[0]
        if domain not in SUPPORTED_DOMAINS:
            continue
        friendly_name = s.get("attributes", {}).get("friendly_name") or eid
        entities.append(
            {
                "entity_id": eid,
                "friendly_name": str(friendly_name),
                "domain": domain,
            }
        )

    entities.sort(key=lambda e: (e["domain"], e["entity_id"]))
    logger.debug("Returning %d entities for config picker", len(entities))
    return web.json_response(entities)
