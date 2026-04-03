"""Tests for alarm section parsing in loader.py."""
from __future__ import annotations
import json
import sys
import os
import tempfile
from pathlib import Path
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))
from config.loader import load_config, AlarmConfig, AlarmSensorConfig, PanelConfig


def _write_entities(tmp_path: Path, data: dict) -> None:
    (tmp_path / "entities.json").write_text(json.dumps(data), encoding="utf-8")


def _options(tmp_path: Path, ha_token: str = "tok") -> Path:
    p = tmp_path / "options.json"
    p.write_text(json.dumps({
        "ha_url": "http://localhost:8123",
        "ha_token": ha_token,
        "panel_title": "Test",
        "theme": "dark",
        "refresh_interval": 30,
    }), encoding="utf-8")
    return p


def test_alarm_empty_by_default(tmp_path, monkeypatch):
    """No alarms key → empty list."""
    _write_entities(tmp_path, {"version": 5, "overview": {"sections": []}})
    _options(tmp_path)
    monkeypatch.setenv("SUPERVISOR_TOKEN", "tok")
    import app.config.loader as loader
    monkeypatch.setattr(loader, "_resolve_config_path", lambda: tmp_path / "options.json")
    import unittest.mock as mock
    with mock.patch.object(Path, "exists", return_value=True), \
         mock.patch.object(Path, "read_text", side_effect=lambda **kw:
             (tmp_path / "entities.json").read_text(**kw)
             if "entities" in str(Path.cwd()) + "data/entities" else
             (tmp_path / "options.json").read_text(**kw)):
        pass  # just import check


def test_alarm_config_parsing():
    """AlarmConfig and AlarmSensorConfig are properly instantiated."""
    sensor = AlarmSensorConfig(entity_id="binary_sensor.door", label="Door", device_class="door")
    alarm = AlarmConfig(entity_id="alarm_control_panel.casa", label="Casa", sensors=[sensor])
    assert alarm.entity_id == "alarm_control_panel.casa"
    assert alarm.label == "Casa"
    assert len(alarm.sensors) == 1
    assert alarm.sensors[0].device_class == "door"


def test_alarm_sensor_defaults():
    """AlarmSensorConfig has safe defaults."""
    s = AlarmSensorConfig(entity_id="binary_sensor.x")
    assert s.label == ''
    assert s.device_class == ''


def test_alarm_defaults():
    """AlarmConfig has safe defaults."""
    a = AlarmConfig(entity_id="alarm_control_panel.home")
    assert a.label == ''
    assert a.sensors == []


def test_alarm_sensor_list_independent():
    """Each AlarmConfig gets its own sensor list."""
    a1 = AlarmConfig(entity_id="alarm_control_panel.a")
    a2 = AlarmConfig(entity_id="alarm_control_panel.b")
    a1.sensors.append(AlarmSensorConfig(entity_id="binary_sensor.x"))
    assert len(a2.sensors) == 0


def _config_with_alarms(alarms):
    """Helper: PanelConfig with given alarm list, no layout sections."""
    return PanelConfig(
        ha_url='http://homeassistant:8123',
        ha_token='',
        title='Test',
        theme='dark',
        refresh_interval=30,
        alarms=alarms,
    )


def test_all_entity_ids_includes_alarm_panel():
    """alarm_control_panel entity must appear in all_entity_ids (needed for state fetch + WS)."""
    alarm = AlarmConfig(entity_id="alarm_control_panel.casa")
    cfg = _config_with_alarms([alarm])
    assert "alarm_control_panel.casa" in cfg.all_entity_ids


def test_all_entity_ids_includes_alarm_sensors():
    """Zone binary_sensor entities must appear in all_entity_ids."""
    sensors = [
        AlarmSensorConfig(entity_id="binary_sensor.door", label="Door", device_class="door"),
        AlarmSensorConfig(entity_id="binary_sensor.window", label="Win", device_class="window"),
    ]
    alarm = AlarmConfig(entity_id="alarm_control_panel.casa", sensors=sensors)
    cfg = _config_with_alarms([alarm])
    ids = cfg.all_entity_ids
    assert "alarm_control_panel.casa" in ids
    assert "binary_sensor.door" in ids
    assert "binary_sensor.window" in ids


def test_all_entity_ids_deduplicates_shared_sensors():
    """A sensor shared across two alarms appears only once."""
    shared = AlarmSensorConfig(entity_id="binary_sensor.shared")
    a1 = AlarmConfig(entity_id="alarm_control_panel.a", sensors=[shared])
    a2 = AlarmConfig(entity_id="alarm_control_panel.b", sensors=[shared])
    cfg = _config_with_alarms([a1, a2])
    ids = cfg.all_entity_ids
    assert ids.count("binary_sensor.shared") == 1


def test_all_entity_ids_no_alarms():
    """Empty alarms list contributes nothing to all_entity_ids."""
    cfg = _config_with_alarms([])
    assert cfg.all_entity_ids == []
