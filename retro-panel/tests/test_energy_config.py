"""Tests for EnergyFlowConfig 7-field model (v2.9.0)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from config.loader import (
    _parse_energy_flow, EnergyFlowConfig, PanelConfig,
    RoomSection, SectionItem,
)


def _config_with_ef(ef):
    """Helper: PanelConfig with a single energy_flow item in overview."""
    item = SectionItem(type='energy_flow', energy_flow=ef)
    sec  = RoomSection(id='s1', title='', items=[item])
    return PanelConfig(
        ha_url='http://homeassistant:8123',
        ha_token='',
        title='Test',
        theme='dark',
        refresh_interval=30,
        overview_sections=[sec],
    )


def test_parse_energy_flow_7_fields():
    raw = {
        'solar_power':           'sensor.solar',
        'home_power':            'sensor.home',
        'battery_soc':           'sensor.batt_soc',
        'battery_charge_power':  'sensor.batt_charge',
        'battery_discharge_power': 'sensor.batt_discharge',
        'grid_import':           'sensor.grid_in',
        'grid_export':           'sensor.grid_out',
    }
    ef = _parse_energy_flow(raw)
    assert ef.solar_power            == 'sensor.solar'
    assert ef.home_power             == 'sensor.home'
    assert ef.battery_soc            == 'sensor.batt_soc'
    assert ef.battery_charge_power   == 'sensor.batt_charge'
    assert ef.battery_discharge_power == 'sensor.batt_discharge'
    assert ef.grid_import            == 'sensor.grid_in'
    assert ef.grid_export            == 'sensor.grid_out'


def test_parse_energy_flow_empty_fields_default_to_empty_string():
    ef = _parse_energy_flow({})
    assert ef.solar_power            == ''
    assert ef.home_power             == ''
    assert ef.battery_soc            == ''
    assert ef.battery_charge_power   == ''
    assert ef.battery_discharge_power == ''
    assert ef.grid_import            == ''
    assert ef.grid_export            == ''


def test_parse_energy_flow_backward_compat_old_battery_power_ignored():
    # Old field 'battery_power' must NOT map to any new field automatically.
    # New fields simply stay empty — user must reconfigure via wizard.
    raw = {'battery_power': 'sensor.old_batt', 'solar_power': 'sensor.solar'}
    ef = _parse_energy_flow(raw)
    assert ef.battery_charge_power   == ''
    assert ef.battery_discharge_power == ''
    assert ef.solar_power            == 'sensor.solar'


def test_parse_energy_flow_backward_compat_old_grid_power_ignored():
    raw = {'grid_power': 'sensor.old_grid', 'home_power': 'sensor.home'}
    ef = _parse_energy_flow(raw)
    assert ef.grid_import  == ''
    assert ef.grid_export  == ''
    assert ef.home_power   == 'sensor.home'


def test_entity_ids_collects_all_7_energy_fields():
    ef = EnergyFlowConfig(
        solar_power='sensor.solar',
        home_power='sensor.home',
        battery_soc='sensor.bsoc',
        battery_charge_power='sensor.bcharge',
        battery_discharge_power='sensor.bdischarge',
        grid_import='sensor.gin',
        grid_export='sensor.gout',
    )
    cfg = _config_with_ef(ef)
    ids = cfg.all_entity_ids
    assert 'sensor.solar'       in ids
    assert 'sensor.home'        in ids
    assert 'sensor.bsoc'        in ids
    assert 'sensor.bcharge'     in ids
    assert 'sensor.bdischarge'  in ids
    assert 'sensor.gin'         in ids
    assert 'sensor.gout'        in ids


def test_entity_ids_skips_empty_energy_fields():
    ef = EnergyFlowConfig(solar_power='sensor.solar')  # all others empty
    cfg = _config_with_ef(ef)
    ids = cfg.all_entity_ids
    assert 'sensor.solar' in ids
    assert len(ids) == 1
