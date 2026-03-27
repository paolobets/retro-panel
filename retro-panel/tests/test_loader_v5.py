"""Tests for v5 schema parsing and v4→v5 migration in loader.py."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from config.loader import _load_layout
from pathlib import Path
import json, tempfile, pytest


def _write_entities(tmp_path: Path, data: dict) -> Path:
    f = tmp_path / "entities.json"
    f.write_text(json.dumps(data))
    return f


# ── v4 → v5 migration ──────────────────────────────────────────────────────

def test_v4_overview_items_wrapped_in_single_section(tmp_path):
    """v4 overview.items becomes one RoomSection with id='sec_default'."""
    f = _write_entities(tmp_path, {
        "version": 4,
        "overview": {"title": "Home", "items": [
            {"type": "entity", "entity_id": "light.kitchen", "label": "Kitchen"}
        ]},
        "rooms": [], "scenarios": [], "cameras": [],
    })
    result = _load_layout(f, [])
    ov_sections = result[0]   # overview_sections
    assert len(ov_sections) == 1
    assert ov_sections[0].id == "sec_default"
    assert ov_sections[0].title == ""
    assert len(ov_sections[0].items) == 1
    assert ov_sections[0].items[0].entity_config.entity_id == "light.kitchen"


def test_v4_scenarios_flat_list_wrapped(tmp_path):
    """v4 flat scenarios list becomes one ScenarioSection."""
    f = _write_entities(tmp_path, {
        "version": 4,
        "overview": {"title": "Home", "items": []},
        "rooms": [],
        "scenarios": [
            {"entity_id": "scene.morning", "title": "Morning", "icon": "🌅"}
        ],
        "cameras": [],
    })
    result = _load_layout(f, [])
    sc_sections = result[4]   # scenario_sections
    assert len(sc_sections) == 1
    assert sc_sections[0].id == "sec_default"
    assert sc_sections[0].items[0].entity_id == "scene.morning"


def test_v4_cameras_flat_list_wrapped(tmp_path):
    """v4 flat cameras list becomes one CameraSection."""
    f = _write_entities(tmp_path, {
        "version": 4,
        "overview": {"title": "Home", "items": []},
        "rooms": [], "scenarios": [],
        "cameras": [
            {"entity_id": "camera.front", "title": "Front", "refresh_interval": 5}
        ],
    })
    result = _load_layout(f, [])
    cam_sections = result[6]   # camera_sections
    assert len(cam_sections) == 1
    assert cam_sections[0].items[0].entity_id == "camera.front"
    assert cam_sections[0].items[0].refresh_interval == 5


# ── v5 native parse ─────────────────────────────────────────────────────────

def test_v5_overview_sections_parsed(tmp_path):
    """v5 overview.sections parsed directly."""
    f = _write_entities(tmp_path, {
        "version": 5,
        "overview": {
            "title": "Home", "icon": "home",
            "sections": [
                {"id": "sec_a", "title": "Lights", "items": [
                    {"type": "entity", "entity_id": "light.hall", "label": "Hall"}
                ]},
                {"id": "sec_b", "title": "Sensors", "items": []},
            ]
        },
        "rooms": [], "scenarios": [], "cameras": [],
    })
    result = _load_layout(f, [])
    ov_sections = result[0]
    assert len(ov_sections) == 2
    assert ov_sections[0].id == "sec_a"
    assert ov_sections[0].title == "Lights"
    assert ov_sections[1].id == "sec_b"


def test_v5_scenario_sections_parsed(tmp_path):
    """v5 scenarios as list of sections."""
    f = _write_entities(tmp_path, {
        "version": 5,
        "overview": {"title": "Home", "icon": "home", "sections": []},
        "rooms": [],
        "scenarios": [
            {"id": "sec_m", "title": "Morning", "items": [
                {"entity_id": "scene.good_morning", "title": "Good Morning", "icon": "🌅"}
            ]}
        ],
        "cameras": [],
    })
    result = _load_layout(f, [])
    sc_sections = result[4]
    assert len(sc_sections) == 1
    assert sc_sections[0].title == "Morning"
    assert sc_sections[0].items[0].entity_id == "scene.good_morning"


def test_v5_camera_sections_parsed(tmp_path):
    """v5 cameras as list of sections."""
    f = _write_entities(tmp_path, {
        "version": 5,
        "overview": {"title": "Home", "icon": "home", "sections": []},
        "rooms": [], "scenarios": [],
        "cameras": [
            {"id": "sec_e", "title": "Esterne", "items": [
                {"entity_id": "camera.garden", "title": "Giardino", "refresh_interval": 8}
            ]}
        ],
    })
    result = _load_layout(f, [])
    cam_sections = result[6]
    assert len(cam_sections) == 1
    assert cam_sections[0].title == "Esterne"
    assert cam_sections[0].items[0].refresh_interval == 8
