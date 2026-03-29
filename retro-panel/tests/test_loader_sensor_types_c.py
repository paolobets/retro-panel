"""Tests for sensor Group C device_class → layout_type mappings (v2.5.0)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from config.loader import _compute_layout_type, _detect_icon


# --- sensor_electrical ---

def test_voltage_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.v", "voltage", "") == "sensor_electrical"

def test_current_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.a", "current", "") == "sensor_electrical"

def test_apparent_power_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.va", "apparent_power", "") == "sensor_electrical"

def test_reactive_power_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.var", "reactive_power", "") == "sensor_electrical"

def test_power_factor_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.pf", "power_factor", "") == "sensor_electrical"

def test_frequency_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.hz", "frequency", "") == "sensor_electrical"


# --- sensor_signal ---

def test_signal_strength_maps_to_sensor_signal():
    assert _compute_layout_type("sensor.rssi", "signal_strength", "") == "sensor_signal"


# --- sensor_gas ---

def test_carbon_monoxide_maps_to_sensor_gas():
    assert _compute_layout_type("sensor.co", "carbon_monoxide", "") == "sensor_gas"

def test_sulphur_dioxide_maps_to_sensor_gas():
    assert _compute_layout_type("sensor.so2", "sulphur_dioxide", "") == "sensor_gas"

def test_nitrous_oxide_maps_to_sensor_gas():
    assert _compute_layout_type("sensor.no", "nitrous_oxide", "") == "sensor_gas"


# --- sensor_speed ---

def test_speed_maps_to_sensor_speed():
    assert _compute_layout_type("sensor.wind", "speed", "") == "sensor_speed"


# --- sensor_ph ---

def test_ph_maps_to_sensor_ph():
    assert _compute_layout_type("sensor.ph", "ph", "") == "sensor_ph"


# --- sensor_water ---

def test_conductivity_maps_to_sensor_water():
    assert _compute_layout_type("sensor.cond", "conductivity", "") == "sensor_water"

def test_precipitation_maps_to_sensor_water():
    assert _compute_layout_type("sensor.rain", "precipitation", "") == "sensor_water"

def test_precipitation_intensity_maps_to_sensor_water():
    assert _compute_layout_type("sensor.rain2", "precipitation_intensity", "") == "sensor_water"

def test_moisture_maps_to_sensor_water():
    assert _compute_layout_type("sensor.soil", "moisture", "") == "sensor_water"

def test_volume_maps_to_sensor_water():
    assert _compute_layout_type("sensor.water", "volume", "") == "sensor_water"

def test_volume_flow_rate_maps_to_sensor_water():
    assert _compute_layout_type("sensor.flow", "volume_flow_rate", "") == "sensor_water"


# --- sensor_physical ---

def test_weight_maps_to_sensor_physical():
    assert _compute_layout_type("sensor.kg", "weight", "") == "sensor_physical"

def test_distance_maps_to_sensor_physical():
    assert _compute_layout_type("sensor.dist", "distance", "") == "sensor_physical"

def test_volume_storage_maps_to_sensor_physical():
    assert _compute_layout_type("sensor.tank", "volume_storage", "") == "sensor_physical"

def test_duration_maps_to_sensor_physical():
    assert _compute_layout_type("sensor.timer", "duration", "") == "sensor_physical"


# --- override + fallback ---

def test_visual_type_override_wins_over_group_c_mappings():
    assert _compute_layout_type("sensor.x", "voltage", "sensor_generic") == "sensor_generic"
    assert _compute_layout_type("sensor.x", "speed", "sensor_energy") == "sensor_energy"

def test_unknown_device_class_still_falls_back_to_generic():
    assert _compute_layout_type("sensor.x", "totally_unknown_xyz", "") == "sensor_generic"


# --- _detect_icon with device_class ---

def test_detect_icon_uses_device_class_for_conductivity():
    assert _detect_icon("sensor.x", "conductivity") == "water-opacity"

def test_detect_icon_uses_device_class_for_weight():
    assert _detect_icon("sensor.x", "weight") == "weight-kilogram"

def test_detect_icon_falls_back_to_entity_id_when_dc_not_in_map():
    # "temperature" in entity_id → "thermometer" via keyword map
    assert _detect_icon("sensor.indoor_temperature", "") == "thermometer"
