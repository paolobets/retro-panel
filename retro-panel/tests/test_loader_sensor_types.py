"""Tests for new sensor device_class → layout_type mappings (v2.4.0)."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from config.loader import _compute_layout_type


def test_illuminance_maps_to_sensor_illuminance():
    assert _compute_layout_type("sensor.brightness", "illuminance", "") == "sensor_illuminance"


def test_pressure_maps_to_sensor_pressure():
    assert _compute_layout_type("sensor.baro", "pressure", "") == "sensor_pressure"


def test_atmospheric_pressure_maps_to_sensor_pressure():
    assert _compute_layout_type("sensor.baro2", "atmospheric_pressure", "") == "sensor_pressure"


def test_pm25_maps_to_sensor_air_quality():
    assert _compute_layout_type("sensor.pm25", "pm25", "") == "sensor_air_quality"


def test_pm10_maps_to_sensor_air_quality():
    assert _compute_layout_type("sensor.pm10", "pm10", "") == "sensor_air_quality"


def test_aqi_maps_to_sensor_air_quality():
    assert _compute_layout_type("sensor.aqi", "aqi", "") == "sensor_air_quality"


def test_voc_maps_to_sensor_air_quality():
    assert _compute_layout_type("sensor.voc", "volatile_organic_compounds", "") == "sensor_air_quality"


def test_voc_parts_maps_to_sensor_air_quality():
    assert _compute_layout_type("sensor.voc2", "volatile_organic_compounds_parts", "") == "sensor_air_quality"


def test_no2_maps_to_sensor_air_quality():
    assert _compute_layout_type("sensor.no2", "nitrogen_dioxide", "") == "sensor_air_quality"


def test_ozone_maps_to_sensor_air_quality():
    assert _compute_layout_type("sensor.ozone", "ozone", "") == "sensor_air_quality"


def test_visual_type_override_wins_over_new_mappings():
    """visual_type always takes priority over device_class inference."""
    assert _compute_layout_type("sensor.x", "illuminance", "sensor_air_quality") == "sensor_air_quality"
    assert _compute_layout_type("sensor.x", "pm25", "sensor_pressure") == "sensor_pressure"


def test_unknown_device_class_still_falls_back_to_generic():
    assert _compute_layout_type("sensor.x", "unknown_class_xyz", "") == "sensor_generic"
