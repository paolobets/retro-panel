"""
Unit tests per handlers_entities.get_all_entities.

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


def _make_ha_client(states: list[dict], registry: list[dict] | Exception) -> MagicMock:
    client = MagicMock()
    client.get_all_entity_states = AsyncMock(return_value=states)
    if isinstance(registry, Exception):
        client.get_entity_registry = AsyncMock(side_effect=registry)
    else:
        client.get_entity_registry = AsyncMock(return_value=registry)
    return client


def _state(entity_id: str, attrs: dict | None = None) -> dict:
    return {"entity_id": entity_id, "state": "on", "attributes": attrs or {}}


def _reg_entry(entity_id: str, hidden_by=None, disabled_by=None) -> dict:
    entry = {"entity_id": entity_id}
    if hidden_by is not None:
        entry["hidden_by"] = hidden_by
    if disabled_by is not None:
        entry["disabled_by"] = disabled_by
    return entry


def _body(response) -> list:
    return json.loads(response.text)


# ---------------------------------------------------------------------------
# Scenari nominali
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_visible_entity_is_included():
    """Entità con hidden_by=null, disabled_by=null deve essere inclusa."""
    client = _make_ha_client(
        states=[_state("light.soggiorno")],
        registry=[_reg_entry("light.soggiorno")],
    )
    body = _body(await get_all_entities(_make_request(client)))
    assert len(body) == 1
    assert body[0]["entity_id"] == "light.soggiorno"


@pytest.mark.asyncio
async def test_hidden_by_user_is_excluded():
    """hidden_by='user' → esclusa."""
    client = _make_ha_client(
        states=[_state("light.nascosta")],
        registry=[_reg_entry("light.nascosta", hidden_by="user")],
    )
    assert _body(await get_all_entities(_make_request(client))) == []


@pytest.mark.asyncio
async def test_hidden_by_integration_is_excluded():
    """hidden_by='integration' → esclusa."""
    client = _make_ha_client(
        states=[_state("sensor.internal")],
        registry=[_reg_entry("sensor.internal", hidden_by="integration")],
    )
    assert _body(await get_all_entities(_make_request(client))) == []


@pytest.mark.asyncio
async def test_disabled_by_user_is_excluded():
    """disabled_by='user' → esclusa."""
    client = _make_ha_client(
        states=[_state("switch.disabilitato")],
        registry=[_reg_entry("switch.disabilitato", disabled_by="user")],
    )
    assert _body(await get_all_entities(_make_request(client))) == []


@pytest.mark.asyncio
async def test_disabled_by_integration_is_excluded():
    """disabled_by='integration' → esclusa."""
    client = _make_ha_client(
        states=[_state("binary_sensor.disabled")],
        registry=[_reg_entry("binary_sensor.disabled", disabled_by="integration")],
    )
    assert _body(await get_all_entities(_make_request(client))) == []


@pytest.mark.asyncio
async def test_registry_unavailable_falls_back_gracefully():
    """Se get_entity_registry() fallisce, le entità visibili appaiono comunque."""
    client = _make_ha_client(
        states=[_state("light.ok")],
        registry=ConnectionRefusedError("HA unreachable"),
    )
    body = _body(await get_all_entities(_make_request(client)))
    assert len(body) == 1
    assert body[0]["entity_id"] == "light.ok"


@pytest.mark.asyncio
async def test_legacy_attribute_hidden_true_is_excluded():
    """attributes.hidden=True (flag YAML legacy) → esclusa."""
    client = _make_ha_client(
        states=[_state("light.legacy", attrs={"hidden": True})],
        registry=[_reg_entry("light.legacy")],
    )
    assert _body(await get_all_entities(_make_request(client))) == []


@pytest.mark.asyncio
async def test_legacy_attribute_hidden_string_is_NOT_excluded():
    """attributes.hidden='true' (stringa) NON viene filtrata — il check usa 'is True'."""
    client = _make_ha_client(
        states=[_state("light.stringa", attrs={"hidden": "true"})],
        registry=[_reg_entry("light.stringa")],
    )
    body = _body(await get_all_entities(_make_request(client)))
    assert len(body) == 1


# ---------------------------------------------------------------------------
# Edge case: registry entry malformata senza entity_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_registry_entry_missing_entity_id_is_skipped():
    """
    Entry di registry senza 'entity_id' deve essere saltata silenziosamente.
    Con il fix (e.get('entity_id')), il set rimane valido per le altre entry.
    L'entità nascosta con entry valida viene comunque esclusa.
    """
    states = [
        _state("light.visibile"),
        _state("light.nascosta"),
    ]
    registry = [
        {"hidden_by": "user"},                          # entry malformata: nessun entity_id
        _reg_entry("light.visibile"),
        _reg_entry("light.nascosta", hidden_by="user"),  # entry valida
    ]
    client = _make_ha_client(states, registry)
    body = _body(await get_all_entities(_make_request(client)))
    entity_ids = [e["entity_id"] for e in body]

    assert "light.visibile" in entity_ids
    assert "light.nascosta" not in entity_ids  # DEVE essere esclusa nonostante entry malformata


# ---------------------------------------------------------------------------
# Edge case: entità non presente nel registry
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_entity_not_in_registry_is_included():
    """Entità senza registry entry (custom component legacy) deve essere inclusa."""
    client = _make_ha_client(
        states=[_state("light.custom")],
        registry=[],
    )
    body = _body(await get_all_entities(_make_request(client)))
    assert len(body) == 1
    assert body[0]["entity_id"] == "light.custom"


# ---------------------------------------------------------------------------
# Domain filter
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_domain_filter_restricts_results():
    """?domain=sensor deve escludere light e switch."""
    client = _make_ha_client(
        states=[
            _state("sensor.temperatura"),
            _state("light.lampadina"),
            _state("switch.presa"),
        ],
        registry=[],
    )
    body = _body(await get_all_entities(_make_request(client, "domain=sensor")))
    assert len(body) == 1
    assert body[0]["entity_id"] == "sensor.temperatura"


@pytest.mark.asyncio
async def test_domain_filter_invalid_returns_400():
    """?domain=media_player (non consentito) deve ritornare 400."""
    client = _make_ha_client([], registry=[])
    response = await get_all_entities(_make_request(client, "domain=media_player"))
    assert response.status == 400


@pytest.mark.asyncio
async def test_disallowed_domain_is_filtered():
    """Domini non in _ALLOWED_DOMAINS vengono ignorati."""
    client = _make_ha_client(
        states=[
            _state("media_player.tv"),
            _state("update.firmware"),
            _state("light.ok"),
        ],
        registry=[],
    )
    body = _body(await get_all_entities(_make_request(client)))
    assert len(body) == 1
    assert body[0]["entity_id"] == "light.ok"


# ---------------------------------------------------------------------------
# Errori HTTP
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_missing_ha_client_returns_503():
    """Se ha_client non è configurato nell'app, deve ritornare 503."""
    request = MagicMock()
    request.app = MagicMock()
    request.app.get = lambda key, default=None: default
    response = await get_all_entities(request)
    assert response.status == 503


@pytest.mark.asyncio
async def test_states_fetch_failure_returns_502():
    """Se get_all_entity_states() fallisce, deve ritornare 502."""
    client = MagicMock()
    client.get_all_entity_states = AsyncMock(side_effect=ConnectionRefusedError("HA down"))
    response = await get_all_entities(_make_request(client))
    assert response.status == 502


# ---------------------------------------------------------------------------
# Ordinamento
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_results_are_sorted_by_entity_id():
    """I risultati devono essere ordinati per entity_id alfabeticamente."""
    client = _make_ha_client(
        states=[
            _state("switch.zebra"),
            _state("light.alfa"),
            _state("sensor.medio"),
        ],
        registry=[],
    )
    body = _body(await get_all_entities(_make_request(client)))
    ids = [e["entity_id"] for e in body]
    assert ids == sorted(ids)
