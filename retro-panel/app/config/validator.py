"""
Validates PanelConfig and verifies live connectivity to Home Assistant.
"""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from config.loader import PanelConfig
    from proxy.ha_client import HAClient

logger = logging.getLogger(__name__)

_URL_RE = re.compile(r"^https?://[^\s/$.?#].[^\s]*$", re.IGNORECASE)


def validate_config(config: "PanelConfig") -> tuple[bool, str]:
    """Validate a PanelConfig for required fields and value ranges.

    Returns:
        A ``(valid, error_message)`` tuple. ``error_message`` is empty when valid.
    """
    if not _URL_RE.match(config.ha_url):
        return False, f"'ha_url' is not a valid HTTP/HTTPS URL: {config.ha_url!r}"

    if not config.ha_token:
        return False, "'ha_token' must not be empty"

    if not isinstance(config.entities, list):
        return False, "'entities' must be a list"

    seen_ids: set[str] = set()
    for idx, ent in enumerate(config.entities):
        if not ent.entity_id:
            return False, f"Entity at index {idx} has an empty 'entity_id'"
        if ent.entity_id in seen_ids:
            return False, f"Duplicate entity_id '{ent.entity_id}' at index {idx}"
        seen_ids.add(ent.entity_id)

        if ent.row is not None and (not isinstance(ent.row, int) or ent.row < 0):
            return False, f"Entity '{ent.entity_id}': 'row' must be a non-negative integer"
        if ent.col is not None and (not isinstance(ent.col, int) or ent.col < 0):
            return False, f"Entity '{ent.entity_id}': 'col' must be a non-negative integer"

    if config.refresh_interval < 5:
        return False, f"'refresh_interval' must be >= 5 seconds; got {config.refresh_interval}"

    return True, ""


async def validate_ha_connection(ha_client: "HAClient") -> tuple[bool, str]:
    """Perform a live connectivity check against the HA REST API.

    Returns:
        A ``(valid, error_message)`` tuple. ``error_message`` is empty when valid.
    """
    try:
        result = await ha_client.ping()
        if result:
            logger.info("HA connection validated successfully")
            return True, ""
        return False, "HA API returned an unexpected response on GET /api/"
    except ConnectionRefusedError as exc:
        msg = f"Cannot reach Home Assistant at configured ha_url: {exc}"
        logger.error(msg)
        return False, msg
    except PermissionError:
        msg = "HA token rejected (401 Unauthorized). Check ha_token in options.json."
        logger.error(msg)
        return False, msg
    except TimeoutError:
        msg = "Connection to Home Assistant timed out (10 s). Check ha_url and network."
        logger.error(msg)
        return False, msg
    except Exception as exc:
        msg = f"Unexpected error validating HA connection: {exc}"
        logger.error(msg)
        return False, msg
