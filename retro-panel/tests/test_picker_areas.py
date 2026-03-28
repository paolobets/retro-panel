"""
Unit tests for picker_areas.get_picker_areas.

Tests the device-level area fallback: entities whose area_id is null on the
entity but set on their device are correctly included in the area's entity list.

Run with:
    py -m pytest tests/test_picker_areas.py -v --asyncio-mode=auto
"""
from __future__ import annotations

import json
import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from api.picker_areas import get_picker_areas  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_request(ha_client) -> MagicMock:
    request = MagicMock()
    request.app = {"ha_client": ha_client}
    return request


def _make_ha_client(
    areas=None,
    entity_registry=None,
    device_registry=None,
    area_error=None,
    entity_error=None,
    device_error=None,
) -> MagicMock:
    client = MagicMock()
    if area_error:
        client.get_area_registry = AsyncMock(side_effect=area_error)
    else:
        client.get_area_registry = AsyncMock(return_value=areas or [])
    if entity_error:
        client.get_entity_registry = AsyncMock(side_effect=entity_error)
    else:
        client.get_entity_registry = AsyncMock(return_value=entity_registry or [])
    if device_error:
        client.get_device_registry = AsyncMock(side_effect=device_error)
    else:
        client.get_device_registry = AsyncMock(return_value=device_registry or [])
    return client


def _body(response) -> list:
    return json.loads(response.text)


def _area(area_id: str, name: str) -> dict:
    """Area registry entry."""
    return {"id": area_id, "name": name}


def _entity(entity_id: str, area_id=None, device_id=None,
            hidden_by=None, disabled_by=None) -> dict:
    """Entity registry entry."""
    return {
        "entity_id": entity_id,
        "area_id": area_id,
        "device_id": device_id,
        "hidden_by": hidden_by,
        "disabled_by": disabled_by,
    }


def _device(device_id: str, area_id: str) -> dict:
    """Device registry entry."""
    return {"id": device_id, "area_id": area_id}


# ---------------------------------------------------------------------------
# 1. Entity with area_id set directly on the entity
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_entity_with_direct_area_id():
    """Entity with area_id set directly → appears in correct area."""
    client = _make_ha_client(
        areas=[_area("soggiorno", "Soggiorno")],
        entity_registry=[_entity("switch.tv", area_id="soggiorno")],
    )
    body = _body(await get_picker_areas(_make_request(client)))
    assert body[0]["entity_ids"] == ["switch.tv"]


# ---------------------------------------------------------------------------
# 2. Entity area via device fallback (the main bug scenario)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_entity_area_via_device_fallback():
    """Entity area_id=null, device has area → entity included via device fallback.

    This is the root cause of the original bug: switch.presa_tv in Soggiorno
    room was not shown because its area_id was null on the entity entry.
    """
    client = _make_ha_client(
        areas=[_area("soggiorno", "Soggiorno")],
        entity_registry=[_entity("switch.presa_tv", area_id=None, device_id="dev_abc")],
        device_registry=[_device("dev_abc", "soggiorno")],
    )
    body = _body(await get_picker_areas(_make_request(client)))
    assert "switch.presa_tv" in body[0]["entity_ids"], (
        "switch.presa_tv must be included via device-level area fallback"
    )


# ---------------------------------------------------------------------------
# 3. Entity with no area on entity or device → excluded
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_entity_no_area_anywhere_excluded():
    """Entity area_id=null and no device area → excluded from all areas."""
    client = _make_ha_client(
        areas=[_area("soggiorno", "Soggiorno")],
        entity_registry=[_entity("switch.orphan", area_id=None, device_id="dev_xyz")],
        device_registry=[_device("dev_xyz", "")],  # device has no area
    )
    body = _body(await get_picker_areas(_make_request(client)))
    assert body[0]["entity_ids"] == []


# ---------------------------------------------------------------------------
# 4. Entity direct area overrides device area (precedence rule)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_entity_direct_area_overrides_device_area():
    """Entity area_id='cucina', device area_id='soggiorno' → entity in cucina only."""
    client = _make_ha_client(
        areas=[_area("cucina", "Cucina"), _area("soggiorno", "Soggiorno")],
        entity_registry=[
            _entity("switch.frigo", area_id="cucina", device_id="dev_frigo"),
        ],
        device_registry=[_device("dev_frigo", "soggiorno")],
    )
    body = _body(await get_picker_areas(_make_request(client)))
    cucina = next(a for a in body if a["id"] == "cucina")
    soggiorno = next(a for a in body if a["id"] == "soggiorno")
    assert "switch.frigo" in cucina["entity_ids"]
    assert "switch.frigo" not in soggiorno["entity_ids"]


# ---------------------------------------------------------------------------
# 5. Hidden entity excluded
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hidden_entity_excluded():
    """Entity with hidden_by set → excluded even if it has a valid area."""
    client = _make_ha_client(
        areas=[_area("bagnetto", "Bagnetto")],
        entity_registry=[
            _entity("light.bagnetto_ok", area_id="bagnetto"),
            _entity("switch.bagnetto_hidden", area_id="bagnetto", hidden_by="user"),
        ],
    )
    body = _body(await get_picker_areas(_make_request(client)))
    eids = body[0]["entity_ids"]
    assert "light.bagnetto_ok" in eids
    assert "switch.bagnetto_hidden" not in eids


# ---------------------------------------------------------------------------
# 6. Disabled entity excluded
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_disabled_entity_excluded():
    """Entity with disabled_by set → excluded even if it has a valid area."""
    client = _make_ha_client(
        areas=[_area("garage", "Garage")],
        entity_registry=[
            _entity("light.garage_ok", area_id="garage"),
            _entity("sensor.garage_disabled", area_id="garage", disabled_by="integration"),
        ],
    )
    body = _body(await get_picker_areas(_make_request(client)))
    eids = body[0]["entity_ids"]
    assert "light.garage_ok" in eids
    assert "sensor.garage_disabled" not in eids


# ---------------------------------------------------------------------------
# 7. Excluded domains filtered
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_excluded_domain_filtered():
    """input_boolean, media_player, update → excluded from area entity lists."""
    client = _make_ha_client(
        areas=[_area("casa", "Casa")],
        entity_registry=[
            _entity("light.lampadina", area_id="casa"),
            _entity("switch.presa", area_id="casa"),
            _entity("input_boolean.helper", area_id="casa"),
            _entity("media_player.tv", area_id="casa"),
            _entity("update.firmware", area_id="casa"),
        ],
    )
    body = _body(await get_picker_areas(_make_request(client)))
    eids = body[0]["entity_ids"]
    assert "light.lampadina" in eids
    assert "switch.presa" in eids
    assert "input_boolean.helper" not in eids
    assert "media_player.tv" not in eids
    assert "update.firmware" not in eids


# ---------------------------------------------------------------------------
# 8. Device registry failure → graceful degradation
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_device_registry_failure_graceful():
    """get_device_registry() raises → direct-area entities still shown, no crash.

    Entities with a direct area_id still appear. Entities relying on device
    fallback are absent (device map is empty), but the handler returns 200.
    """
    client = _make_ha_client(
        areas=[_area("soggiorno", "Soggiorno")],
        entity_registry=[
            _entity("light.direct", area_id="soggiorno"),
            _entity("switch.via_device", area_id=None, device_id="dev_x"),
        ],
        device_error=ConnectionRefusedError("HA down"),
    )
    response = await get_picker_areas(_make_request(client))
    assert response.status == 200
    eids = _body(response)[0]["entity_ids"]
    assert "light.direct" in eids
    assert "switch.via_device" not in eids  # device map empty, no fallback


# ---------------------------------------------------------------------------
# 9. Entity registry failure → areas returned with empty entity_ids lists
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_entity_registry_failure_graceful():
    """get_entity_registry() raises → areas returned with empty entity_ids lists."""
    client = _make_ha_client(
        areas=[_area("sala", "Sala")],
        entity_error=ConnectionRefusedError("HA down"),
    )
    response = await get_picker_areas(_make_request(client))
    assert response.status == 200
    body = _body(response)
    assert len(body) == 1
    assert body[0]["entity_ids"] == []


# ---------------------------------------------------------------------------
# 10. No areas → empty list with 200
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_areas_returns_empty_list():
    """Area registry returns empty list → response is [] with status 200."""
    client = _make_ha_client(areas=[])
    response = await get_picker_areas(_make_request(client))
    assert response.status == 200
    assert _body(response) == []


# ---------------------------------------------------------------------------
# 11. Area registry failure → 502
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_area_registry_failure_returns_502():
    """get_area_registry() raises → response must be 502."""
    client = _make_ha_client(area_error=ConnectionRefusedError("HA down"))
    response = await get_picker_areas(_make_request(client))
    assert response.status == 502
