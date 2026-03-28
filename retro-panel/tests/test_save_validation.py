"""Tests for save handler validation logic in panel_config_save.py."""
from __future__ import annotations
import asyncio
import json
import re
import sys
import os
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

# ---------------------------------------------------------------------------
# Regex under test — replicated here to avoid import path issues with the
# hyphenated 'retro-panel' directory name.
# This must stay in sync with panel_config_save._ENTITY_ID_RE.
# ---------------------------------------------------------------------------
_ENTITY_ID_RE = re.compile(r"^[a-z][a-z0-9_]*\.[a-z0-9_]+$")

# ---------------------------------------------------------------------------
# Import save_config via sys.path manipulation so we can call it directly.
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
from api.panel_config_save import save_config  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_request(body: dict) -> MagicMock:
    """Return a mock aiohttp Request whose .json() coroutine returns *body*."""
    req = MagicMock()
    req.json = AsyncMock(return_value=body)
    # Provide a minimal app dict so the post-save reload path doesn't crash
    req.app = {}
    return req


def _run(coro):
    """Run a coroutine synchronously."""
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


def _minimal_body(**overrides) -> dict:
    """Return the minimal valid v5 body, with optional field overrides."""
    base = {
        "overview": {"title": "Home", "icon": "home", "sections": []},
        "rooms": [],
        "scenarios": [],
        "cameras": [],
        "header_sensors": [],
        "scenarios_section": {"title": "Scenarios", "icon": "palette"},
        "cameras_section": {"title": "Telecamere", "icon": "cctv"},
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Section count limit tests
# ---------------------------------------------------------------------------

def test_too_many_scenario_sections():
    """Body with more than 20 scenario sections returns HTTP 400."""
    # Build 21 scenario sections (limit is _MAX_SECTIONS = 20)
    sections = [
        {"id": f"sec_{i}", "title": f"Section {i}", "items": []}
        for i in range(21)
    ]
    body = _minimal_body(scenarios=sections)
    req = _make_request(body)

    # patch file write so the handler never touches /data/entities.json
    with patch("api.panel_config_save._ENTITIES_FILE") as mock_path:
        mock_path.with_suffix.return_value.write_text = MagicMock()
        mock_path.with_suffix.return_value.replace = MagicMock()
        response = _run(save_config(req))

    assert response.status == 400
    payload = json.loads(response.text)
    assert "scenario" in payload["error"].lower() or "Too many" in payload["error"]


def test_too_many_camera_sections():
    """Body with more than 20 camera sections returns HTTP 400."""
    sections = [
        {"id": f"cam_{i}", "title": f"Cam {i}", "items": []}
        for i in range(21)
    ]
    body = _minimal_body(cameras=sections)
    req = _make_request(body)

    with patch("api.panel_config_save._ENTITIES_FILE") as mock_path:
        mock_path.with_suffix.return_value.write_text = MagicMock()
        mock_path.with_suffix.return_value.replace = MagicMock()
        response = _run(save_config(req))

    assert response.status == 400
    payload = json.loads(response.text)
    assert "camera" in payload["error"].lower() or "Too many" in payload["error"]


# ---------------------------------------------------------------------------
# Entity ID regex tests
# ---------------------------------------------------------------------------

def test_entity_id_with_digit_in_domain_accepted():
    """entity_id like 'input_number.test' must match the regex (digit in domain)."""
    assert _ENTITY_ID_RE.match("input_number.test") is not None


def test_entity_id_zone_home_accepted():
    """'zone.home' must pass the regex — regression check for the old stricter pattern."""
    assert _ENTITY_ID_RE.match("zone.home") is not None


def test_entity_id_leading_digit_rejected():
    """An entity_id whose domain starts with a digit must be rejected."""
    assert _ENTITY_ID_RE.match("1light.kitchen") is None


def test_entity_id_empty_object_part_rejected():
    """An entity_id without the object part (no dot) must be rejected."""
    assert _ENTITY_ID_RE.match("light") is None


def test_entity_id_uppercase_rejected():
    """An entity_id with uppercase letters must be rejected."""
    assert _ENTITY_ID_RE.match("Light.Kitchen") is None
