"""Tests for new device_class mappings added alongside media_player release:
pm1, nitrogen_monoxide, garage_door, enum, date, timestamp."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from config.loader import _compute_layout_type


# ---- Sensor domain -----------------------------------------------------------

def test_pm1_maps_to_sensor_air_quality():
    assert _compute_layout_type("sensor.pm1", "pm1", "") == "sensor_air_quality"


def test_nitrogen_monoxide_maps_to_sensor_gas():
    assert _compute_layout_type("sensor.no_level", "nitrogen_monoxide", "") == "sensor_gas"


def test_enum_maps_to_sensor_enum():
    assert _compute_layout_type("sensor.washer_state", "enum", "") == "sensor_enum"


def test_date_maps_to_sensor_datetime():
    assert _compute_layout_type("sensor.next_bin", "date", "") == "sensor_datetime"


def test_timestamp_maps_to_sensor_datetime():
    assert _compute_layout_type("sensor.last_motion", "timestamp", "") == "sensor_datetime"


# ---- Binary sensor -----------------------------------------------------------

def test_garage_door_binary_maps_to_binary_door():
    assert _compute_layout_type("binary_sensor.garage", "garage_door", "") == "binary_door"
