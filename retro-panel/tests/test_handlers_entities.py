"""
Unit tests per handlers_entities.get_all_entities.

Il handler usa ha_client.call_template() che restituisce una stringa JSON.
I test qui mockano call_template con AsyncMock.

Esegui con:
    pip install pytest pytest-asyncio aiohttp
    pytest tests/test_handlers_entities.py -v --asyncio-mode=auto
"""

from __future__ import annotations

import json
import sys
import os
import pytest
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from api.handlers_entities import get_all_entities  # noqa: E402


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


def _make_ha_client(template_result) -> MagicMock:
    """Build a mock ha_client whose call_template returns template_result.

    Pass an Exception instance to simulate a failing call.
    """
    client = MagicMock()
    if isinstance(template_result, Exception):
        client.call_template = AsyncMock(side_effect=template_result)
    else:
        client.call_template = AsyncMock(return_value=template_result)
    return client


def _entity(
    entity_id: str,
    friendly_name: str = "",
    domain: str | None = None,
    device_class: str = "",
    unit: str = "",
) -> dict:
    """Build a template-result entity dict as HA would produce it."""
    if domain is None:
        domain = entity_id.split(".")[0]
    return {
        "entity_id": entity_id,
        "friendly_name": friendly_name or entity_id,
        "domain": domain,
        "device_class": device_class,
        "unit": unit,
    }


def _body(response) -> list:
    return json.loads(response.text)


# ---------------------------------------------------------------------------
# 1. basic_returns_allowed_domains
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_basic_returns_allowed_domains():
    """call_template restituisce entita di tutti i 5 domini consentiti; tutte devono comparire."""
    entities = [
        _entity("light.soggiorno"),
        _entity("switch.presa"),
        _entity("sensor.temperatura"),
        _entity("binary_sensor.porta"),
        _entity("alarm_control_panel.casa"),
    ]
    client = _make_ha_client(json.dumps(entities))
    body = _body(await get_all_entities(_make_request(client)))
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
    entities = [
        _entity("sensor.temperatura"),
        _entity("light.lampadina"),
        _entity("switch.presa"),
    ]
    client = _make_ha_client(json.dumps(entities))
    body = _body(await get_all_entities(_make_request(client, "domain=sensor")))
    assert len(body) == 1
    assert body[0]["entity_id"] == "sensor.temperatura"


# ---------------------------------------------------------------------------
# 3. unknown_domain_query_param_returns_400
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unknown_domain_query_param_returns_400():
    """?domain=foo (non consentito) deve ritornare 400 prima di chiamare call_template."""
    client = _make_ha_client(json.dumps([]))
    response = await get_all_entities(_make_request(client, "domain=foo"))
    assert response.status == 400
    # call_template NON deve essere stato invocato
    client.call_template.assert_not_called()


# ---------------------------------------------------------------------------
# 4. sorts_by_entity_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sorts_by_entity_id():
    """Il risultato deve essere ordinato alfabeticamente per entity_id."""
    entities = [
        _entity("switch.zebra"),
        _entity("light.alfa"),
        _entity("sensor.medio"),
    ]
    client = _make_ha_client(json.dumps(entities))
    body = _body(await get_all_entities(_make_request(client)))
    ids = [e["entity_id"] for e in body]
    assert ids == sorted(ids)


# ---------------------------------------------------------------------------
# 5. empty_result
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_empty_result():
    """call_template restituisce lista vuota; risposta e lista vuota con status 200."""
    client = _make_ha_client(json.dumps([]))
    response = await get_all_entities(_make_request(client))
    assert response.status == 200
    assert _body(response) == []


# ---------------------------------------------------------------------------
# 6. template_call_fails_returns_502
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_template_call_fails_returns_502():
    """Se call_template solleva Exception, la risposta deve essere 502."""
    client = _make_ha_client(ConnectionRefusedError("HA down"))
    response = await get_all_entities(_make_request(client))
    assert response.status == 502


# ---------------------------------------------------------------------------
# 7. json_parse_fails_returns_502
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_json_parse_fails_returns_502():
    """Se call_template restituisce JSON non valido, la risposta deve essere 502."""
    client = _make_ha_client("this is not valid json {{")
    response = await get_all_entities(_make_request(client))
    assert response.status == 502


# ---------------------------------------------------------------------------
# 8. no_ha_client_returns_503
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_ha_client_returns_503():
    """Se ha_client e None nell'app, deve ritornare 503."""
    request = MagicMock()
    request.app = MagicMock()
    request.app.get = lambda key, default=None: default
    response = await get_all_entities(request)
    assert response.status == 503


# ---------------------------------------------------------------------------
# 9. friendly_name_and_fields_preserved
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_friendly_name_and_fields_preserved():
    """friendly_name, device_class e unit devono essere passati attraverso invariati."""
    entities = [
        {
            "entity_id": "sensor.potenza",
            "friendly_name": "Potenza Attuale",
            "domain": "sensor",
            "device_class": "power",
            "unit": "W",
        }
    ]
    client = _make_ha_client(json.dumps(entities))
    body = _body(await get_all_entities(_make_request(client)))
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
    """?domain=sensor con risposta template mista: solo sensor entities vengono restituite."""
    entities = [
        _entity("sensor.a"),
        _entity("sensor.b"),
        _entity("light.c"),
        _entity("binary_sensor.d"),
        _entity("alarm_control_panel.e"),
    ]
    client = _make_ha_client(json.dumps(entities))
    body = _body(await get_all_entities(_make_request(client, "domain=sensor")))
    ids = [e["entity_id"] for e in body]
    assert set(ids) == {"sensor.a", "sensor.b"}
    assert "light.c" not in ids
    assert "binary_sensor.d" not in ids
