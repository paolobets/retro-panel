"""Tests for calendar section parsing in loader.py."""
from __future__ import annotations
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))
from config.loader import (
    CalendarConfig,
    PanelConfig,
    _parse_calendar,
)


# ---------------------------------------------------------------------------
# _parse_calendar tests
# ---------------------------------------------------------------------------

def test_parse_calendar_valid():
    """Valid calendar entry is parsed correctly."""
    raw = {"entity_id": "calendar.family", "label": "Family", "color": "#ff0000"}
    result = _parse_calendar(raw)
    assert result is not None
    assert result.entity_id == "calendar.family"
    assert result.label == "Family"
    assert result.color == "#ff0000"


def test_parse_calendar_invalid_domain():
    """Non-calendar entity is rejected (returns None)."""
    raw = {"entity_id": "sensor.temperature", "label": "Temp"}
    result = _parse_calendar(raw)
    assert result is None


def test_parse_calendar_empty():
    """Empty dict returns None."""
    result = _parse_calendar({})
    assert result is None


def test_parse_calendar_defaults():
    """Missing label/color get empty string defaults."""
    raw = {"entity_id": "calendar.work"}
    result = _parse_calendar(raw)
    assert result is not None
    assert result.entity_id == "calendar.work"
    assert result.label == ""
    assert result.color == ""


# ---------------------------------------------------------------------------
# PanelConfig calendar fields tests
# ---------------------------------------------------------------------------

def _config_with_calendars(calendars):
    """Helper: PanelConfig with given calendar list, no layout sections."""
    return PanelConfig(
        ha_url='http://homeassistant:8123',
        ha_token='',
        title='Test',
        theme='dark',
        refresh_interval=30,
        calendars=calendars,
    )


def test_panel_config_has_calendar_fields():
    """PanelConfig has calendars list, section title/icon defaults, and 'calendars' in nav_order."""
    cfg = PanelConfig(
        ha_url='http://homeassistant:8123',
        ha_token='',
        title='Test',
        theme='dark',
        refresh_interval=30,
    )
    assert hasattr(cfg, 'calendars')
    assert isinstance(cfg.calendars, list)
    assert cfg.calendars_section_title == 'Calendario'
    assert cfg.calendars_section_icon == 'calendar'
    assert 'calendars' in cfg.nav_order


def test_calendar_entity_ids_in_all_entity_ids():
    """Calendar entity_ids are included in the all_entity_ids property."""
    cal1 = CalendarConfig(entity_id="calendar.family", label="Family")
    cal2 = CalendarConfig(entity_id="calendar.work", color="#0000ff")
    cfg = _config_with_calendars([cal1, cal2])
    ids = cfg.all_entity_ids
    assert "calendar.family" in ids
    assert "calendar.work" in ids


# ---------------------------------------------------------------------------
# calendar_events endpoint tests
# ---------------------------------------------------------------------------

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app', 'api'))
from calendar_events import get_calendar_events


def _make_app(mock_events=None, side_effect=None):
    """Build a minimal aiohttp app with the calendar_events route."""
    app = web.Application()
    ha_client = MagicMock()
    if side_effect is not None:
        ha_client.get_calendar_events = AsyncMock(side_effect=side_effect)
    else:
        ha_client.get_calendar_events = AsyncMock(return_value=mock_events or [])
    app["ha_client"] = ha_client
    app.router.add_get("/api/calendar-events/{entity_id}", get_calendar_events)
    return app


@pytest.fixture
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


async def _request(app, path):
    async with TestClient(TestServer(app)) as client:
        return await client.get(path)


def test_calendar_events_returns_json():
    """Valid request returns 200 with event list."""
    events = [
        {
            "summary": "Test Event",
            "start": {"dateTime": "2026-04-10T10:00:00"},
            "end": {"dateTime": "2026-04-10T11:00:00"},
        }
    ]
    app = _make_app(mock_events=events)

    async def run():
        async with TestClient(TestServer(app)) as client:
            resp = await client.get(
                "/api/calendar-events/calendar.test"
                "?start=2026-04-01T00:00:00&end=2026-04-30T23:59:59"
            )
            assert resp.status == 200
            data = await resp.json()
            assert len(data) == 1
            assert data[0]["summary"] == "Test Event"

    asyncio.run(run())


def test_calendar_events_missing_params():
    """Missing start/end query params returns 400."""
    app = _make_app()

    async def run():
        async with TestClient(TestServer(app)) as client:
            resp = await client.get("/api/calendar-events/calendar.test")
            assert resp.status == 400
            data = await resp.json()
            assert "start" in data["error"] or "Missing" in data["error"]

    asyncio.run(run())


def test_calendar_events_invalid_entity_id():
    """Invalid entity_id format returns 400."""
    app = _make_app()

    async def run():
        async with TestClient(TestServer(app)) as client:
            resp = await client.get(
                "/api/calendar-events/sensor.temperature"
                "?start=2026-04-01T00:00:00&end=2026-04-30T23:59:59"
            )
            assert resp.status == 400

    asyncio.run(run())


def test_calendar_events_not_found():
    """FileNotFoundError from ha_client returns 404."""
    app = _make_app(side_effect=FileNotFoundError("Calendar entity not found"))

    async def run():
        async with TestClient(TestServer(app)) as client:
            resp = await client.get(
                "/api/calendar-events/calendar.missing"
                "?start=2026-04-01T00:00:00&end=2026-04-30T23:59:59"
            )
            assert resp.status == 404

    asyncio.run(run())


def test_calendar_events_auth_failure():
    """PermissionError from ha_client returns 403."""
    app = _make_app(side_effect=PermissionError("HA token rejected"))

    async def run():
        async with TestClient(TestServer(app)) as client:
            resp = await client.get(
                "/api/calendar-events/calendar.test"
                "?start=2026-04-01T00:00:00&end=2026-04-30T23:59:59"
            )
            assert resp.status == 403

    asyncio.run(run())
