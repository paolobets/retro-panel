"""
Unit tests per handlers_areas.get_ha_areas.

Il handler usa:
  - ha_client.call_template() per ottenere le aree con entity_ids da HA
  - ha_client.get_entity_registry() per filtrare entità nascoste/disabilitate

Esegui con:
    pip install pytest pytest-asyncio aiohttp
    pytest tests/test_handlers_areas.py -v --asyncio-mode=auto
"""

from __future__ import annotations

import json
import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from api.handlers_areas import get_ha_areas  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_request(ha_client) -> MagicMock:
    request = MagicMock()
    request.app = {"ha_client": ha_client}
    return request


def _make_ha_client(template_result, registry=None) -> MagicMock:
    client = MagicMock()
    if isinstance(template_result, Exception):
        client.call_template = AsyncMock(side_effect=template_result)
    else:
        client.call_template = AsyncMock(return_value=template_result)
    client.get_entity_registry = AsyncMock(
        return_value=registry if registry is not None else []
    )
    return client


def _area(area_id: str, name: str, entity_ids: list[str]) -> dict:
    return {"id": area_id, "name": name, "entity_ids": entity_ids}


def _body(response) -> list:
    return json.loads(response.text)


# ---------------------------------------------------------------------------
# 1. basic_returns_areas
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_basic_returns_areas():
    """Template restituisce due aree; entrambe devono comparire nella risposta."""
    areas = [
        _area("soggiorno", "Soggiorno", ["light.soggiorno", "switch.tv"]),
        _area("cucina", "Cucina", ["light.cucina"]),
    ]
    client = _make_ha_client(json.dumps(areas))
    body = _body(await get_ha_areas(_make_request(client)))
    ids = [a["id"] for a in body]
    assert "soggiorno" in ids
    assert "cucina" in ids
    assert len(body) == 2


# ---------------------------------------------------------------------------
# 2. excluded_domains_removed
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_excluded_domains_removed():
    """Entità nei domini esclusi (update, media_player, ...) devono essere filtrate."""
    areas = [
        _area("casa", "Casa", [
            "light.lampadina",
            "switch.presa",
            "update.firmware",
            "media_player.tv",
            "camera.ingresso",
        ]),
    ]
    client = _make_ha_client(json.dumps(areas))
    body = _body(await get_ha_areas(_make_request(client)))
    assert len(body) == 1
    entity_ids = body[0]["entity_ids"]
    assert "light.lampadina" in entity_ids
    assert "switch.presa" in entity_ids
    assert "update.firmware" not in entity_ids
    assert "media_player.tv" not in entity_ids
    assert "camera.ingresso" not in entity_ids


# ---------------------------------------------------------------------------
# 3. hidden_entities_excluded — caso principale del bug switch.bagnetto_specchio
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hidden_entities_excluded():
    """Entità con hidden_by nel registro non devono comparire nell'area importata.

    Riproduce il bug segnalato: switch.bagnetto_specchio era nascosta in HA
    (hidden_by='user') ma veniva comunque importata perché il filtro non funzionava.
    """
    areas = [
        _area("bagnetto", "Bagnetto", [
            "light.bagnetto_principale",
            "switch.bagnetto_specchio",   # questa è nascosta in HA
            "sensor.bagnetto_umidita",
        ]),
    ]
    registry = [
        {"entity_id": "light.bagnetto_principale",  "hidden_by": None,   "disabled_by": None},
        {"entity_id": "switch.bagnetto_specchio",    "hidden_by": "user", "disabled_by": None},
        {"entity_id": "sensor.bagnetto_umidita",     "hidden_by": None,   "disabled_by": None},
    ]
    client = _make_ha_client(json.dumps(areas), registry=registry)
    body = _body(await get_ha_areas(_make_request(client)))
    assert len(body) == 1
    entity_ids = body[0]["entity_ids"]
    assert "light.bagnetto_principale" in entity_ids
    assert "sensor.bagnetto_umidita" in entity_ids
    assert "switch.bagnetto_specchio" not in entity_ids, (
        "switch.bagnetto_specchio è nascosta (hidden_by='user') e NON deve comparire"
    )


# ---------------------------------------------------------------------------
# 4. disabled_entities_excluded
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_disabled_entities_excluded():
    """Entità con disabled_by nel registro non devono comparire nell'area."""
    areas = [
        _area("garage", "Garage", [
            "light.garage_led",
            "sensor.garage_disabled",
        ]),
    ]
    registry = [
        {"entity_id": "light.garage_led",        "hidden_by": None,          "disabled_by": None},
        {"entity_id": "sensor.garage_disabled",  "hidden_by": None,          "disabled_by": "integration"},
    ]
    client = _make_ha_client(json.dumps(areas), registry=registry)
    body = _body(await get_ha_areas(_make_request(client)))
    entity_ids = body[0]["entity_ids"]
    assert "light.garage_led" in entity_ids
    assert "sensor.garage_disabled" not in entity_ids


# ---------------------------------------------------------------------------
# 5. hidden_by_integration_excluded
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hidden_by_integration_excluded():
    """Entità nascoste dall'integrazione (hidden_by='integration') devono essere escluse."""
    areas = [
        _area("studio", "Studio", ["switch.study_visible", "switch.study_hidden_integration"]),
    ]
    registry = [
        {"entity_id": "switch.study_visible",           "hidden_by": None,          "disabled_by": None},
        {"entity_id": "switch.study_hidden_integration","hidden_by": "integration", "disabled_by": None},
    ]
    client = _make_ha_client(json.dumps(areas), registry=registry)
    body = _body(await get_ha_areas(_make_request(client)))
    entity_ids = body[0]["entity_ids"]
    assert "switch.study_visible" in entity_ids
    assert "switch.study_hidden_integration" not in entity_ids


# ---------------------------------------------------------------------------
# 6. registry_failure_fallback
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_registry_failure_fallback():
    """Se get_entity_registry fallisce, le entità vengono restituite in modalità degradata."""
    areas = [
        _area("sala", "Sala", ["light.sala", "switch.sala"]),
    ]
    client = _make_ha_client(json.dumps(areas))
    client.get_entity_registry = AsyncMock(side_effect=ConnectionRefusedError("HA down"))
    body = _body(await get_ha_areas(_make_request(client)))
    # Fallback: tutte le entità non-escluse per dominio sono restituite
    entity_ids = body[0]["entity_ids"]
    assert "light.sala" in entity_ids
    assert "switch.sala" in entity_ids


# ---------------------------------------------------------------------------
# 7. template_failure_returns_502
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_template_failure_returns_502():
    """Se call_template fallisce, la risposta deve essere 502."""
    client = _make_ha_client(ConnectionRefusedError("HA down"))
    response = await get_ha_areas(_make_request(client))
    assert response.status == 502


# ---------------------------------------------------------------------------
# 8. empty_areas
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_areas():
    """Template restituisce lista vuota; risposta deve essere lista vuota con status 200."""
    client = _make_ha_client(json.dumps([]))
    response = await get_ha_areas(_make_request(client))
    assert response.status == 200
    assert _body(response) == []


# ---------------------------------------------------------------------------
# 9. area_with_no_entities_after_filter
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_area_with_no_entities_after_filter():
    """Area in cui tutte le entità sono nascoste deve restituire entity_ids vuoto."""
    areas = [
        _area("deposito", "Deposito", ["switch.deposito_hidden"]),
    ]
    registry = [
        {"entity_id": "switch.deposito_hidden", "hidden_by": "user", "disabled_by": None},
    ]
    client = _make_ha_client(json.dumps(areas), registry=registry)
    body = _body(await get_ha_areas(_make_request(client)))
    assert len(body) == 1
    assert body[0]["entity_ids"] == []
