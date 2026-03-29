"""Tests for binary_sensor device_class → layout_type mappings (v2.6.0).

Covers: bug fixes (window, occupancy, presence, smoke/gas/CO)
        and new types (binary_moisture, binary_lock, binary_vibration).
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from config.loader import _compute_layout_type


# --- Regressions: types that must still work ---

def test_door_maps_to_binary_door():
    assert _compute_layout_type("binary_sensor.door", "door", "") == "binary_door"

def test_motion_maps_to_binary_motion():
    assert _compute_layout_type("binary_sensor.pir", "motion", "") == "binary_motion"

def test_unknown_dc_maps_to_binary_standard():
    assert _compute_layout_type("binary_sensor.generic", "connectivity", "") == "binary_standard"

def test_empty_dc_maps_to_binary_standard():
    assert _compute_layout_type("binary_sensor.x", "", "") == "binary_standard"


# --- Bug fixes ---

def test_window_maps_to_binary_window():
    assert _compute_layout_type("binary_sensor.window", "window", "") == "binary_window"

def test_occupancy_maps_to_binary_presence():
    assert _compute_layout_type("binary_sensor.occupancy", "occupancy", "") == "binary_presence"

def test_presence_maps_to_binary_presence():
    assert _compute_layout_type("binary_sensor.presence", "presence", "") == "binary_presence"

def test_smoke_maps_to_binary_smoke():
    assert _compute_layout_type("binary_sensor.smoke", "smoke", "") == "binary_smoke"

def test_gas_maps_to_binary_smoke():
    assert _compute_layout_type("binary_sensor.gas", "gas", "") == "binary_smoke"

def test_carbon_monoxide_maps_to_binary_smoke():
    assert _compute_layout_type("binary_sensor.co", "carbon_monoxide", "") == "binary_smoke"


# --- New types ---

def test_moisture_maps_to_binary_moisture():
    assert _compute_layout_type("binary_sensor.leak", "moisture", "") == "binary_moisture"

def test_wet_maps_to_binary_moisture():
    assert _compute_layout_type("binary_sensor.wet", "wet", "") == "binary_moisture"

def test_lock_maps_to_binary_lock():
    assert _compute_layout_type("binary_sensor.lock", "lock", "") == "binary_lock"

def test_vibration_maps_to_binary_vibration():
    assert _compute_layout_type("binary_sensor.vib", "vibration", "") == "binary_vibration"

def test_tamper_maps_to_binary_vibration():
    assert _compute_layout_type("binary_sensor.tamper", "tamper", "") == "binary_vibration"
