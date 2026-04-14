"""
Unit tests per picker_entities.get_picker_entities.

Il handler usa ha_client.get_all_entity_states() che restituisce una lista
di dict in formato HA states. I test qui mockano get_all_entity_states con AsyncMock.

Esegui con:
    pip install pytest pytest-asyncio aiohttp
    pytest tests/test_handlers_entities.py -v --asyncio-mode=auto
"""

from __future__ import annotations

import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from api.picker_entities import get_picker_entities  # noqa: E402
import json


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_request(ha_client, query_string: str = "") -> MagicMock:
    request = MagicMock()
    request.app = {"ha_client": ha_client}
    params: dict[str, str] = {}
    if query_string:
        for pair in query_string.split("&"):
            k, _, v = pair.partition("=")
            params[k] = v
    request.rel_url.query.get = lambda key, default="": params.get(key, default)
    return request


def _make_ha_client(states: list, registry=None) -> MagicMock:
    """Build a mock ha_client whose get_all_entity_states returns `states`.

    Pass an Exception instance as `states` to simulate a failing call.
    ``registry`` is the list returned by get_entity_registry (default: empty list).
    """
    client = MagicMock()
    if isinstance(states, Exception):
        client.get_all_entity_states = AsyncMock(side_effect=states)
    else:
        client.get_all_entity_states = AsyncMock(return_value=states)
    client.get_entity_registry = AsyncMock(return_value=registry if registry is not None else [])
    return client


def _state(
    entity_id: str,
    friendly_name: str = "",
    device_class: str = "",
    unit: str = "",
) -> dict:
    """Build a HA state dict as get_all_entity_states would return."""
    return {
        "entity_id": entity_id,
        "state": "on",
        "attributes": {
            "friendly_name": friendly_name or entity_id,
            "device_class": device_class,
            "unit_of_measurement": unit,
        },
    }


def _body(response) -> list:
    return json.loads(response.text)


# ---------------------------------------------------------------------------
# 1. basic_returns_allowed_domains
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_basic_returns_allowed_domains():
    """get_all_entity_states restituisce entità di tutti i domini consentiti; tutte devono comparire."""
    states = [
        _state("light.soggiorno"),
        _state("switch.presa"),
        _state("sensor.temperatura"),
        _state("binary_sensor.porta"),
        _state("alarm_control_panel.casa"),
    ]
    client = _make_ha_client(states)
    body = _body(await get_picker_entities(_make_request(client)))
    ids = [e["entity_id"] for e in body]
    assert "light.soggiorno" in ids
    assert "switch.presa" in ids
    assert "sensor.temperatura" in ids
    assert "binary_sensor.porta" in ids
    assert "alarm_control_panel.casa" in ids
    assert len(body) == 5


# ---------------------------------------------------------------------------
# 2. filters_by_domain_query_param
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_filters_by_domain_query_param():
    """?domain=sensor con risposta mista deve ritornare solo i sensor."""
    states = [
        _state("sensor.temperatura"),
        _state("light.lampadina"),
        _state("switch.presa"),
    ]
    client = _make_ha_client(states)
    body = _body(await get_picker_entities(_make_request(client, "domain=sensor")))
    assert len(body) == 1
    assert body[0]["entity_id"] == "sensor.temperatura"


# ---------------------------------------------------------------------------
# 3. unknown_domain_query_param_returns_400
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unknown_domain_query_param_returns_400():
    """?domain=foo (non consentito) deve ritornare 400 prima di chiamare get_all_entity_states."""
    client = _make_ha_client([])
    response = await get_picker_entities(_make_request(client, "domain=foo"))
    assert response.status == 400
    # get_all_entity_states NON deve essere stato invocato
    client.get_all_entity_states.assert_not_called()


# ---------------------------------------------------------------------------
# 4. sorts_by_entity_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sorts_by_entity_id():
    """Il risultato deve essere ordinato alfabeticamente per entity_id."""
    states = [
        _state("switch.zebra"),
        _state("light.alfa"),
        _state("sensor.medio"),
    ]
    client = _make_ha_client(states)
    body = _body(await get_picker_entities(_make_request(client)))
    ids = [e["entity_id"] for e in body]
    assert ids == sorted(ids)


# ---------------------------------------------------------------------------
# 5. empty_result
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_result():
    """get_all_entity_states restituisce lista vuota; risposta è lista vuota con status 200."""
    client = _make_ha_client([])
    response = await get_picker_entities(_make_request(client))
    assert response.status == 200
    assert _body(response) == []


# ---------------------------------------------------------------------------
# 6. ha_unreachable_returns_502
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_ha_unreachable_returns_502():
    """Se get_all_entity_states solleva Exception, la risposta deve essere 502."""
    client = _make_ha_client(ConnectionRefusedError("HA down"))
    response = await get_picker_entities(_make_request(client))
    assert response.status == 502


# ---------------------------------------------------------------------------
# 7. unknown_domains_filtered_out
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unknown_domains_filtered_out():
    """Entità di domini non consentiti (es. climate) non devono comparire.
    media_player è ora consentito."""
    states = [
        _state("light.ok"),
        _state("climate.termostato"),
        _state("media_player.tv"),
        _state("sensor.temperatura"),
    ]
    client = _make_ha_client(states)
    body = _body(await get_picker_entities(_make_request(client)))
    ids = [e["entity_id"] for e in body]
    assert "light.ok" in ids
    assert "sensor.temperatura" in ids
    assert "media_player.tv" in ids
    assert "climate.termostato" not in ids


# ---------------------------------------------------------------------------
# 8. no_ha_client_returns_503
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_ha_client_returns_503():
    """Se ha_client è None nell'app, deve ritornare 503."""
    request = MagicMock()
    request.app = MagicMock()
    request.app.get = lambda key, default=None: default
    response = await get_picker_entities(request)
    assert response.status == 503


# ---------------------------------------------------------------------------
# 9. friendly_name_and_fields_preserved
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_friendly_name_and_fields_preserved():
    """friendly_name, device_class e unit devono essere passati attraverso invariati."""
    states = [
        _state("sensor.potenza", friendly_name="Potenza Attuale", device_class="power", unit="W"),
    ]
    client = _make_ha_client(states)
    body = _body(await get_picker_entities(_make_request(client)))
    assert len(body) == 1
    e = body[0]
    assert e["friendly_name"] == "Potenza Attuale"
    assert e["device_class"] == "power"
    assert e["unit"] == "W"
    assert e["entity_id"] == "sensor.potenza"


# ---------------------------------------------------------------------------
# 10. domain_filter_sensor_only
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_domain_filter_sensor_only():
    """?domain=sensor con risposta mista: solo sensor entities vengono restituite."""
    states = [
        _state("sensor.a"),
        _state("sensor.b"),
        _state("light.c"),
        _state("binary_sensor.d"),
        _state("alarm_control_panel.e"),
    ]
    client = _make_ha_client(states)
    body = _body(await get_picker_entities(_make_request(client, "domain=sensor")))
    ids = [e["entity_id"] for e in body]
    assert set(ids) == {"sensor.a", "sensor.b"}
    assert "light.c" not in ids
    assert "binary_sensor.d" not in ids


# ---------------------------------------------------------------------------
# 11. hidden_entities_excluded_via_registry
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_hidden_entities_excluded_via_registry():
    """Entità con hidden_by nel registro non devono comparire nella risposta."""
    states = [
        _state("light.visibile"),
        _state("light.nascosta"),
        _state("sensor.temperatura"),
    ]
    registry = [
        {"entity_id": "light.nascosta",     "hidden_by": "user", "disabled_by": None},
        {"entity_id": "light.visibile",     "hidden_by": None,   "disabled_by": None},
        {"entity_id": "sensor.temperatura", "hidden_by": None,   "disabled_by": None},
    ]
    client = _make_ha_client(states, registry=registry)
    body = _body(await get_picker_entities(_make_request(client)))
    ids = [e["entity_id"] for e in body]
    assert "light.visibile" in ids
    assert "sensor.temperatura" in ids
    assert "light.nascosta" not in ids


# ---------------------------------------------------------------------------
# 12. disabled_entities_excluded_via_registry
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_disabled_entities_excluded_via_registry():
    """Entità con disabled_by nel registro non devono comparire nella risposta."""
    states = [
        _state("switch.abilitato"),
        _state("switch.disabilitato"),
    ]
    registry = [
        {"entity_id": "switch.abilitato",    "hidden_by": None, "disabled_by": None},
        {"entity_id": "switch.disabilitato", "hidden_by": None, "disabled_by": "integration"},
    ]
    client = _make_ha_client(states, registry=registry)
    body = _body(await get_picker_entities(_make_request(client)))
    ids = [e["entity_id"] for e in body]
    assert "switch.abilitato" in ids
    assert "switch.disabilitato" not in ids


# ---------------------------------------------------------------------------
# 13. registry_failure_falls_back_gracefully
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_registry_failure_falls_back_gracefully():
    """Se get_entity_registry fallisce, le entità vengono comunque restituite (degraded mode)."""
    states = [_state("light.a"), _state("sensor.b")]
    client = _make_ha_client(states)
    client.get_entity_registry = AsyncMock(side_effect=ConnectionRefusedError("HA down"))
    body = _body(await get_picker_entities(_make_request(client)))
    ids = [e["entity_id"] for e in body]
    # Fallback: tutte le entità sono restituite anche senza filtro registry
    assert "light.a" in ids
    assert "sensor.b" in ids
