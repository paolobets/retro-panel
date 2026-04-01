"""
Loads and parses /data/options.json injected by HA Supervisor at runtime.
Falls back to ./data/options.json for local development.

Entity layout is stored in /data/entities.json (v5 schema):
  {
    "version": 5,
    "header_sensors": [{"entity_id", "icon", "label"}],
    "overview": {"title", "icon", "sections": [{"id", "title", "items": [...]}]},
    "rooms": [{"id", "title", "icon", "hidden", "sections": [{"id", "title", "items": [...]}]}],
    "scenarios": [{"id", "title", "items": [{"entity_id", "title", "icon"}]}],
    "cameras": [{"id", "title", "items": [{"entity_id", "title", "refresh_interval"}]}],
    "scenarios_section": {"title", "icon"},
    "cameras_section": {"title", "icon"}
  }

Each item is one of:
  {"type": "entity", "entity_id", "label", "icon"}
  {"type": "energy_flow", "solar_power", "home_power", "battery_soc",
   "battery_charge_power", "battery_discharge_power", "grid_import", "grid_export"}

v4 format is auto-migrated: flat overview.items -> single RoomSection,
  flat scenarios/cameras lists -> single ScenarioSection/CameraSection.
v3 rooms with flat items[] are auto-migrated: wrapped in a single default section.
v2 pages format is auto-migrated: first page -> overview, other pages -> discarded.
v1 flat arrays are migrated to overview items.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger(__name__)

_ICON_MAP: list[tuple[str, str]] = [
    ("light.", "bulb"),
    ("switch.", "power"),
    ("alarm_control_panel.", "shield"),
    ("cover.", "blinds"),
    ("fan.", "fan"),
    ("lock.", "lock"),
    ("vacuum.", "vacuum"),
    ("camera.", "camera"),
    ("climate.", "thermometer"),
    ("media_player.", "tv"),
    ("person.", "person"),
    ("humidifier.", "droplet"),
    ("input_boolean.", "toggle"),
]

_KEYWORD_MAP: list[tuple[str, str]] = [
    ("temperature", "thermometer"),
    ("humidity", "droplet"),
    ("door", "door"),
    ("motion", "motion"),
    ("solar", "sun"),
    ("battery", "battery"),
    ("grid", "lightning"),
    ("power", "lightning"),
    ("energy", "lightning"),
    ("lock", "lock"),
    ("fan", "fan"),
    ("smoke", "bell"),
    ("vibration", "bell"),
    ("window", "blinds"),
    ("blind", "blinds"),
    ("plug", "plug"),
    ("socket", "plug"),
    ("presence", "person"),
    ("occupancy", "person"),
    ("camera", "camera"),
    ("heating", "heating"),
    ("cooling", "cooling"),
]

_DOMAIN_FALLBACK: dict[str, str] = {
    "binary_sensor": "circle",
    "sensor": "circle",
}


_DC_ICON_MAP: dict[str, str] = {
    "conductivity":            "water-opacity",
    "precipitation":           "weather-rainy",
    "precipitation_intensity": "weather-pouring",
    "moisture":                "water-percent",
    "volume":                  "water-pump",
    "volume_flow_rate":        "pipe",
    "weight":                  "weight-kilogram",
    "distance":                "ruler",
    "duration":                "timer-sand",
    "volume_storage":          "database",
}

# Fallback icon per layout_type — used when _detect_icon() can't find a match
# Values are MDI icon names (direct, not internal short names)
_LAYOUT_TYPE_ICON_MAP: dict[str, str] = {
    "sensor_temperature": "thermometer",
    "sensor_humidity":    "water-percent",
    "sensor_co2":         "molecule-co2",
    "sensor_battery":     "battery",
    "sensor_energy":      "lightning-bolt",
    "sensor_illuminance": "brightness-5",
    "sensor_pressure":    "gauge",
    "sensor_air_quality": "air-filter",
    "sensor_electrical":  "power-plug",
    "sensor_signal":      "signal-cellular-3",
    "sensor_gas":         "molecule-co2",
    "sensor_speed":       "speedometer",
    "sensor_water":       "water",
    "sensor_ph":          "flask",
    "sensor_physical":    "ruler",
    "binary_door":        "door-open",
    "binary_window":      "window-open",
    "binary_motion":      "motion-sensor",
    "binary_presence":    "home-account",
    "binary_smoke":       "smoke-detector",
    "binary_moisture":    "water-percent",
    "binary_lock":        "lock",
    "binary_vibration":   "vibrate",
}


def _detect_icon(entity_id: str, device_class: str = "") -> str:
    if device_class and device_class in _DC_ICON_MAP:
        return _DC_ICON_MAP[device_class]
    for prefix, icon in _ICON_MAP:
        if entity_id.startswith(prefix):
            return icon
    lower = entity_id.lower()
    for keyword, icon in _KEYWORD_MAP:
        if keyword in lower:
            return icon
    domain = entity_id.split(".")[0] if "." in entity_id else ""
    return _DOMAIN_FALLBACK.get(domain, "circle")


@dataclass
class EntityConfig:
    entity_id: str
    label: str
    icon: str
    hidden: bool = False
    visual_type: str = ""
    display_mode: str = ""
    device_class: str = ""
    layout_type: str = ""
    row: Optional[int] = None
    col: Optional[int] = None


@dataclass
class EnergyFlowConfig:
    solar_power: str = ""
    home_power: str = ""
    battery_soc: str = ""
    battery_charge_power: str = ""
    battery_discharge_power: str = ""
    grid_import: str = ""
    grid_export: str = ""


@dataclass
class SectionItem:
    """A single item in any section: entity tile or energy flow card."""
    type: str  # "entity" | "energy_flow"
    entity_config: Optional[EntityConfig] = None
    energy_flow: Optional[EnergyFlowConfig] = None


@dataclass
class RoomSection:
    """A named section within a room, containing a list of items."""
    id: str
    title: str
    items: List[SectionItem] = field(default_factory=list)


@dataclass
class ScenarioSection:
    """A named section within the Scenarios tab."""
    id: str
    title: str
    items: List["ScenarioConfig"] = field(default_factory=list)


@dataclass
class CameraSection:
    """A named section within the Cameras tab."""
    id: str
    title: str
    items: List["CameraConfig"] = field(default_factory=list)


@dataclass
class HeaderSensor:
    """Mini sensor displayed in the header bar."""
    entity_id: str
    icon: str = ""
    label: str = ""


@dataclass
class ScenarioConfig:
    """A scene or script that can be activated from the Scenarios section."""
    entity_id: str
    title: str
    icon: str = "\U0001f3ad"  # 🎭


@dataclass
class CameraConfig:
    entity_id: str
    title: str = ""
    refresh_interval: int = 10


@dataclass
class RoomConfig:
    """A room/area with its own entity grid."""
    id: str
    title: str
    icon: str = "home"
    hidden: bool = False
    sections: List[RoomSection] = field(default_factory=list)


@dataclass
class PanelConfig:
    """Top-level configuration for Retro Panel v5."""

    ha_url: str
    ha_token: str
    title: str
    theme: str
    refresh_interval: int
    header_sensors: List[HeaderSensor] = field(default_factory=list)
    overview_sections: List[RoomSection] = field(default_factory=list)
    rooms: List[RoomConfig] = field(default_factory=list)
    scenario_sections: List[ScenarioSection] = field(default_factory=list)
    camera_sections: List[CameraSection] = field(default_factory=list)
    overview_title: str = "Overview"
    overview_icon: str = "home"
    scenarios_section_title: str = "Scenarios"
    scenarios_section_icon: str = "palette"
    cameras_section_title: str = "Telecamere"
    cameras_section_icon: str = "cctv"

    # --------------- backward compat helpers ---------------

    @property
    def entities(self) -> list[EntityConfig]:
        """All EntityConfig across overview + rooms (legacy property)."""
        result: list[EntityConfig] = []
        for item in self._all_items():
            if item.type == "entity" and item.entity_config is not None:
                result.append(item.entity_config)
        return result

    def _all_items(self) -> list[SectionItem]:
        items: list[SectionItem] = []
        for sec in self.overview_sections:
            items.extend(sec.items)
        for room in self.rooms:
            for section in room.sections:
                items.extend(section.items)
        return items

    @property
    def all_entity_ids(self) -> list[str]:
        """All entity_ids referenced anywhere (entities + energy sensors + header sensors)."""
        seen: set[str] = set()
        ids: list[str] = []

        def _add(eid: str) -> None:
            if eid and eid not in seen:
                seen.add(eid)
                ids.append(eid)

        for item in self._all_items():
            if item.type == "entity" and item.entity_config is not None:
                _add(item.entity_config.entity_id)
            elif item.type == "energy_flow" and item.energy_flow is not None:
                ef = item.energy_flow
                for eid in (ef.solar_power, ef.home_power, ef.battery_soc,
                            ef.battery_charge_power, ef.battery_discharge_power,
                            ef.grid_import, ef.grid_export):
                    _add(eid)

        for hs in self.header_sensors:
            _add(hs.entity_id)

        for sec in self.camera_sections:
            for cam in sec.items:
                _add(cam.entity_id)

        return ids


# ---------------------------------------------------------------------------
# Internal parsing helpers
# ---------------------------------------------------------------------------

def _resolve_config_path() -> Path:
    supervisor_path = Path("/data/options.json")
    if supervisor_path.exists():
        return supervisor_path
    local_path = Path("./data/options.json")
    if local_path.exists():
        return local_path
    return supervisor_path


def _compute_layout_type(entity_id: str, device_class: str, visual_type: str) -> str:
    """Compute the frontend layout_type for an entity.

    Domain-locked types (alarm, camera, scenario) always win.
    visual_type user override applies to sensor/binary_sensor/light only.
    Falls back to domain + device_class inference.
    """
    domain = entity_id.split(".")[0] if "." in entity_id else ""
    # Domain-locked layouts — visual_type cannot override these
    if domain == "alarm_control_panel":
        return "alarm"
    if domain == "camera":
        return "camera"
    if domain in ("scene", "script", "automation"):
        return "scenario"
    # User visual_type override (sensor/binary_sensor/light only)
    if visual_type:
        return visual_type
    if domain == "light":
        return "light_standard"
    if domain in ("switch", "input_boolean"):
        return "switch"
    if domain == "sensor":
        dc = (device_class or "").lower()
        _map = {
            "temperature":                    "sensor_temperature",
            "humidity":                       "sensor_humidity",
            "co2":                            "sensor_co2",
            "carbon_dioxide":                 "sensor_co2",
            "battery":                        "sensor_battery",
            "power":                          "sensor_energy",
            "energy":                         "sensor_energy",
            "illuminance":                    "sensor_illuminance",
            "pressure":                       "sensor_pressure",
            "atmospheric_pressure":           "sensor_pressure",
            "pm25":                           "sensor_air_quality",
            "pm10":                           "sensor_air_quality",
            "aqi":                            "sensor_air_quality",
            "volatile_organic_compounds":     "sensor_air_quality",
            "volatile_organic_compounds_parts": "sensor_air_quality",
            "nitrogen_dioxide":               "sensor_air_quality",
            "ozone":                          "sensor_air_quality",
            "voltage":                 "sensor_electrical",
            "current":                 "sensor_electrical",
            "apparent_power":          "sensor_electrical",
            "reactive_power":          "sensor_electrical",
            "power_factor":            "sensor_electrical",
            "frequency":               "sensor_electrical",
            "signal_strength":         "sensor_signal",
            "carbon_monoxide":         "sensor_gas",
            "sulphur_dioxide":         "sensor_gas",
            "nitrous_oxide":           "sensor_gas",
            "speed":                   "sensor_speed",
            "ph":                      "sensor_ph",
            "conductivity":            "sensor_water",
            "precipitation":           "sensor_water",
            "precipitation_intensity": "sensor_water",
            "moisture":                "sensor_water",
            "volume":                  "sensor_water",
            "volume_flow_rate":        "sensor_water",
            "weight":                  "sensor_physical",
            "distance":                "sensor_physical",
            "volume_storage":          "sensor_physical",
            "duration":                "sensor_physical",
        }
        return _map.get(dc, "sensor_generic")
    if domain == "binary_sensor":
        dc = (device_class or "").lower()
        if dc == "door":                              return "binary_door"
        if dc == "window":                            return "binary_window"
        if dc == "motion":                            return "binary_motion"
        if dc in ("occupancy", "presence"):           return "binary_presence"
        if dc in ("smoke", "gas", "carbon_monoxide"): return "binary_smoke"
        if dc in ("moisture", "wet"):                 return "binary_moisture"
        if dc == "lock":                              return "binary_lock"
        if dc in ("vibration", "tamper"):             return "binary_vibration"
        return "binary_standard"
    return "sensor_generic"


def _parse_entity(raw: dict) -> EntityConfig:
    entity_id: str = raw.get("entity_id", "").strip()
    if not entity_id:
        raise ValueError(f"Entity entry is missing 'entity_id': {raw!r}")
    provided_icon: str = raw.get("icon", "").strip()
    # Migrate legacy "toggle" icon for switch/input_boolean to "power"
    if provided_icon == "toggle" and (
        entity_id.startswith("switch.") or entity_id.startswith("input_boolean.")
    ):
        provided_icon = "power"
    device_class: str = str(raw.get("device_class") or "").strip()
    visual_type: str = str(raw.get("visual_type") or "").strip()
    display_mode: str = str(raw.get("display_mode") or "").strip()
    layout_type: str = _compute_layout_type(entity_id, device_class, visual_type)
    if provided_icon:
        icon = provided_icon
    else:
        icon = _detect_icon(entity_id, device_class)
        if icon == "circle":
            icon = _LAYOUT_TYPE_ICON_MAP.get(layout_type, "circle")
    label: str = (
        raw.get("label", "").strip()
        or entity_id.replace("_", " ").split(".")[-1].title()
    )
    hidden: bool = bool(raw.get("hidden", False))
    return EntityConfig(entity_id=entity_id, label=label, icon=icon, hidden=hidden,
                        visual_type=visual_type, display_mode=display_mode,
                        device_class=device_class, layout_type=layout_type)


def _parse_energy_flow(raw: dict) -> EnergyFlowConfig:
    # ── v2.9 field-name migration ────────────────────────────────────────────
    # Pre-v2.9 configs used a single signed 'battery_power' entity (positive =
    # charge, negative = discharge) and a single signed 'grid_power' entity.
    # v2.9 split these into separate unidirectional sensors.  When the old keys
    # are present but the new ones are absent, map the old entity ID to BOTH new
    # fields as a best-effort fallback so the card is not silently broken.
    # Users should reconfigure via the wizard to assign dedicated sensors.
    legacy_batt = str(raw.get("battery_power") or "").strip()
    legacy_grid = str(raw.get("grid_power") or "").strip()

    battery_charge_power = str(raw.get("battery_charge_power") or "").strip()
    battery_discharge_power = str(raw.get("battery_discharge_power") or "").strip()
    grid_import = str(raw.get("grid_import") or "").strip()
    grid_export = str(raw.get("grid_export") or "").strip()

    if legacy_batt:
        if not battery_charge_power:
            battery_charge_power = legacy_batt
            logger.warning(
                "energy_flow: legacy 'battery_power' field detected (%r). "
                "Mapped to 'battery_charge_power' as fallback. "
                "Reconfigure via the Energy wizard to assign dedicated sensors.",
                legacy_batt,
            )
        if not battery_discharge_power:
            battery_discharge_power = legacy_batt
    if legacy_grid:
        if not grid_import:
            grid_import = legacy_grid
            logger.warning(
                "energy_flow: legacy 'grid_power' field detected (%r). "
                "Mapped to 'grid_import' as fallback. "
                "Reconfigure via the Energy wizard to assign dedicated sensors.",
                legacy_grid,
            )
        if not grid_export:
            grid_export = legacy_grid

    return EnergyFlowConfig(
        solar_power=str(raw.get("solar_power") or "").strip(),
        home_power=str(raw.get("home_power") or "").strip(),
        battery_soc=str(raw.get("battery_soc") or "").strip(),
        battery_charge_power=battery_charge_power,
        battery_discharge_power=battery_discharge_power,
        grid_import=grid_import,
        grid_export=grid_export,
    )


def _parse_section_item(raw: dict, idx: int, context: str) -> Optional[SectionItem]:
    """Parse a single item dict. Returns None on unknown/invalid type."""
    item_type = str(raw.get("type") or "entity").strip()
    if item_type == "entity":
        try:
            ec = _parse_entity(raw)
            return SectionItem(type="entity", entity_config=ec)
        except ValueError as exc:
            logger.warning("%s item %d invalid, skipping: %s", context, idx, exc)
            return None
    elif item_type == "energy_flow":
        ef = _parse_energy_flow(raw)
        return SectionItem(type="energy_flow", energy_flow=ef)
    else:
        logger.warning("%s item %d has unknown type %r, skipping", context, idx, item_type)
        return None


def _parse_items(raw_list: list, context: str) -> list[SectionItem]:
    items: list[SectionItem] = []
    for idx, raw in enumerate(raw_list or []):
        if isinstance(raw, dict):
            item = _parse_section_item(raw, idx, context)
            if item is not None:
                items.append(item)
    return items


def _parse_section(raw: dict, idx: int, context: str) -> RoomSection:
    sec_id = str(raw.get("id") or f"sec_{idx}").strip()
    title = str(raw.get("title") or "").strip()
    items = _parse_items(raw.get("items") or [], f"{context}/sec[{sec_id}]")
    return RoomSection(id=sec_id, title=title, items=items)


def _parse_room(raw: dict, idx: int) -> RoomConfig:
    room_id = str(raw.get("id") or f"room_{idx}").strip()
    title = str(raw.get("title") or f"Room {idx + 1}").strip()
    icon = str(raw.get("icon") or "home").strip()
    hidden = bool(raw.get("hidden", False))

    # v4: sections[] key present
    if "sections" in raw and isinstance(raw["sections"], list):
        sections = []
        for sidx, sec_raw in enumerate(raw["sections"]):
            if isinstance(sec_raw, dict):
                sections.append(_parse_section(sec_raw, sidx, f"room[{room_id}]"))
    else:
        # v3 migration: flat items[] -> single default section
        legacy_items = _parse_items(raw.get("items") or [], f"room[{room_id}]")
        sections = [RoomSection(id="sec_default", title="", items=legacy_items)]

    return RoomConfig(id=room_id, title=title, icon=icon, hidden=hidden, sections=sections)


def _parse_header_sensor(raw: dict) -> Optional[HeaderSensor]:
    eid = str(raw.get("entity_id") or "").strip()
    if not eid:
        return None
    return HeaderSensor(
        entity_id=eid,
        icon=str(raw.get("icon") or "").strip(),
        label=str(raw.get("label") or "").strip(),
    )


def _parse_scenario(raw: dict) -> Optional[ScenarioConfig]:
    eid = str(raw.get("entity_id") or "").strip()
    if not eid:
        return None
    return ScenarioConfig(
        entity_id=eid,
        title=str(raw.get("title") or eid.split(".")[-1].replace("_", " ").title()).strip(),
        icon=str(raw.get("icon") or "\U0001f3ad").strip(),
    )


def _parse_overview_section(raw: dict, idx: int) -> RoomSection:
    sec_id = str(raw.get("id") or f"sec_{idx}").strip()
    title = str(raw.get("title") or "").strip()
    items = _parse_items(raw.get("items") or [], f"overview/sec[{sec_id}]")
    return RoomSection(id=sec_id, title=title, items=items)


def _parse_scenario_section(raw: dict, idx: int) -> ScenarioSection:
    sec_id = str(raw.get("id") or f"sc_sec_{idx}").strip()
    title = str(raw.get("title") or "").strip()
    items = [s for s in [_parse_scenario(x) for x in (raw.get("items") or [])] if s]
    return ScenarioSection(id=sec_id, title=title, items=items)


def _parse_camera_section(raw: dict, idx: int) -> CameraSection:
    sec_id = str(raw.get("id") or f"cam_sec_{idx}").strip()
    title = str(raw.get("title") or "").strip()
    cam_items: list[CameraConfig] = []
    for c in (raw.get("items") or []):
        if isinstance(c, dict) and c.get("entity_id"):
            try:
                refresh_interval = int(c.get("refresh_interval") or 10)
            except (ValueError, TypeError):
                refresh_interval = 10
            cam_items.append(CameraConfig(
                entity_id=str(c["entity_id"]).strip(),
                title=str(c.get("title") or "").strip(),
                refresh_interval=refresh_interval,
            ))
    return CameraSection(id=sec_id, title=title, items=cam_items)


def _migrate_v4_to_v5(raw: dict) -> tuple[
    list[RoomSection],       # overview_sections
    list[RoomConfig],        # rooms
    list[ScenarioSection],   # scenario_sections
    list[CameraSection],     # camera_sections
]:
    """Migrate a v3/v4 entities dict to v5 section lists.

    Flat overview.items -> single RoomSection.
    Flat scenarios list -> single ScenarioSection.
    Flat cameras list   -> single CameraSection.
    Room items[]        -> handled by _parse_room (v3 migration logic).
    """
    _ov = raw.get("overview") or {}

    # overview: wrap flat items in single RoomSection
    overview_items_flat = _parse_items(_ov.get("items") or [], "overview")
    overview_sections = [RoomSection(id="sec_default", title="", items=overview_items_flat)] if overview_items_flat else []

    rooms: list[RoomConfig] = []
    for idx, room_raw in enumerate(raw.get("rooms") or []):
        if isinstance(room_raw, dict):
            rooms.append(_parse_room(room_raw, idx))

    # scenarios: parse flat list and wrap in single ScenarioSection
    sc_flat = [s for s in [_parse_scenario(x) for x in (raw.get("scenarios") or []) if isinstance(x, dict)] if s]
    scenario_sections = [ScenarioSection(id="sec_default", title="", items=sc_flat)] if sc_flat else []

    # cameras: parse flat list and wrap in single CameraSection
    cam_flat = raw.get("cameras") or []
    camera_sections = []
    if cam_flat:
        camera_sections = [_parse_camera_section({"id": "sec_default", "title": "", "items": cam_flat}, 0)]

    return overview_sections, rooms, scenario_sections, camera_sections


def _migrate_v1_flat(raw_entities: list) -> list[SectionItem]:
    """Migrate v1 flat entity list to overview items."""
    items: list[SectionItem] = []
    for idx, ent in enumerate(raw_entities):
        try:
            items.append(SectionItem(type="entity", entity_config=_parse_entity(ent)))
        except (ValueError, AttributeError) as exc:
            logger.warning("v1 entity at index %d invalid, skipping: %s", idx, exc)
    return items


def _migrate_v2_pages(pages_raw: list) -> list[SectionItem]:
    """Migrate v2 pages format: take first page items as overview items."""
    if not pages_raw:
        return []
    first = pages_raw[0]
    if not isinstance(first, dict):
        return []
    return _parse_items(first.get("items") or [], "v2-migration")


def _load_layout(entities_file: Path, options_fallback: list) -> tuple[
    list[RoomSection],         # overview_sections       [0]
    str,                       # overview_title           [1]
    str,                       # overview_icon            [2]
    list[RoomConfig],          # rooms                    [3]
    list[ScenarioSection],     # scenario_sections        [4]
    list[HeaderSensor],        # header_sensors           [5]
    list[CameraSection],       # camera_sections          [6]
    str,                       # scenarios_section_title  [7]
    str,                       # scenarios_section_icon   [8]
    str,                       # cameras_section_title    [9]
    str,                       # cameras_section_icon     [10]
]:
    """Load layout from /data/entities.json, migrating older formats."""
    empty = ([], "Overview", "home", [], [], [], [], "Scenarios", "palette", "Telecamere", "cctv")

    if entities_file.exists():
        try:
            raw = json.loads(entities_file.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to read %s: %s — using empty layout", entities_file, exc)
            return empty

        version = raw.get("version") if isinstance(raw, dict) else None
        try:
            version = int(version)
        except (ValueError, TypeError):
            version = 0

        # v5 format (native sections)
        if isinstance(raw, dict) and version == 5:
            _ov = raw.get("overview") or {}
            overview_sections = [
                _parse_overview_section(s, i)
                for i, s in enumerate(_ov.get("sections") or [])
                if isinstance(s, dict)
            ]
            overview_title = str(_ov.get("title") or "Overview").strip() or "Overview"
            overview_icon = str(_ov.get("icon") or "home").strip() or "home"
            rooms: list[RoomConfig] = [
                _parse_room(r, i)
                for i, r in enumerate(raw.get("rooms") or [])
                if isinstance(r, dict)
            ]
            scenario_sections = [
                _parse_scenario_section(s, i)
                for i, s in enumerate(raw.get("scenarios") or [])
                if isinstance(s, dict)
            ]
            header_sensors: list[HeaderSensor] = [
                h for h in [_parse_header_sensor(x) for x in (raw.get("header_sensors") or [])] if h
            ]
            camera_sections = [
                _parse_camera_section(s, i)
                for i, s in enumerate(raw.get("cameras") or [])
                if isinstance(s, dict)
            ]
            sc_sec = raw.get("scenarios_section") or {}
            cam_sec = raw.get("cameras_section") or {}
            return (
                overview_sections, overview_title, overview_icon,
                rooms, scenario_sections, header_sensors, camera_sections,
                str(sc_sec.get("title") or "Scenarios").strip() or "Scenarios",
                str(sc_sec.get("icon") or "palette").strip() or "palette",
                str(cam_sec.get("title") or "Telecamere").strip() or "Telecamere",
                str(cam_sec.get("icon") or "cctv").strip() or "cctv",
            )

        # v3/v4 format — migrate to v5 shape (also handles v3 rooms via _parse_room migration logic)
        if isinstance(raw, dict) and version in (3, 4):
            _ov = raw.get("overview") or {}
            overview_title = str(_ov.get("title") or "Overview").strip() or "Overview"
            overview_icon = "home"

            overview_sections, rooms, scenario_sections, camera_sections = _migrate_v4_to_v5(raw)

            header_sensors = []
            for hs_raw in raw.get("header_sensors") or []:
                if isinstance(hs_raw, dict):
                    hs = _parse_header_sensor(hs_raw)
                    if hs is not None:
                        header_sensors.append(hs)

            sc_sec = raw.get("scenarios_section") or {}
            cam_sec = raw.get("cameras_section") or {}
            scenarios_section_title = str(sc_sec.get("title") or "Scenarios").strip() or "Scenarios"
            scenarios_section_icon = str(sc_sec.get("icon") or "palette").strip() or "palette"
            cameras_section_title = str(cam_sec.get("title") or "Telecamere").strip() or "Telecamere"
            cameras_section_icon = str(cam_sec.get("icon") or "cctv").strip() or "cctv"

            return (
                overview_sections, overview_title, overview_icon,
                rooms, scenario_sections, header_sensors, camera_sections,
                scenarios_section_title, scenarios_section_icon,
                cameras_section_title, cameras_section_icon,
            )

        # v2 format: migrate first page to overview
        if isinstance(raw, dict) and version == 2:
            logger.info("Migrating v2 pages format to v5")
            ov_items = _migrate_v2_pages(raw.get("pages") or [])
            ov_secs = [RoomSection(id="sec_default", title="", items=ov_items)] if ov_items else []
            return (ov_secs, "Overview", "home", [], [], [], [], "Scenarios", "palette", "Telecamere", "cctv")

        # v1 format: plain list
        if isinstance(raw, list):
            logger.info("Migrating v1 flat entities format to v5")
            ov_items = _migrate_v1_flat(raw)
            ov_secs = [RoomSection(id="sec_default", title="", items=ov_items)] if ov_items else []
            return (ov_secs, "Overview", "home", [], [], [], [], "Scenarios", "palette", "Telecamere", "cctv")

        logger.warning("Unrecognised entities.json format, using empty layout")
        return empty

    # Fall back to options.json entities
    if options_fallback:
        logger.info("No entities.json found, migrating from options.json")
        ov_items = _migrate_v1_flat(options_fallback)
        ov_secs = [RoomSection(id="sec_default", title="", items=ov_items)] if ov_items else []
        return (ov_secs, "Overview", "home", [], [], [], [], "Scenarios", "palette", "Telecamere", "cctv")

    return empty


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def load_config() -> PanelConfig:
    """Load and parse the add-on configuration from options.json."""
    config_path = _resolve_config_path()

    try:
        raw_text = config_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise FileNotFoundError(
            f"Configuration file not found at '{config_path}'. "
            "When running outside Home Assistant, create './data/options.json' "
            "with the required fields: ha_url, ha_token."
        ) from None

    try:
        raw: dict = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ValueError(f"options.json contains invalid JSON: {exc}") from exc

    ha_url: str = (raw.get("ha_url") or "").strip().rstrip("/")
    ha_token: str = (raw.get("ha_token") or "").strip()

    if not ha_token:
        ha_token = os.environ.get("SUPERVISOR_TOKEN", "")
        if ha_token:
            if not ha_url:
                ha_url = "http://homeassistant:8123"
            logger.info("ha_token not set — using SUPERVISOR_TOKEN (ha_url=%s)", ha_url)
        else:
            raise ValueError(
                "'ha_token' is not configured and SUPERVISOR_TOKEN is not available."
            )
    elif not ha_url:
        ha_url = "http://homeassistant:8123"
        logger.info("ha_url not configured, using default: %s", ha_url)

    entities_file = Path("/data/entities.json")
    options_entities = raw.get("entities", [])
    (overview_sections, overview_title, overview_icon, rooms, scenario_sections, header_sensors, camera_sections,
     scenarios_section_title, scenarios_section_icon,
     cameras_section_title, cameras_section_icon) = _load_layout(
        entities_file,
        options_entities if isinstance(options_entities, list) else [],
    )

    total_entities = sum(
        1 for sec in overview_sections for it in sec.items if it.type == "entity"
    )
    total_entities += sum(
        1 for room in rooms
        for section in room.sections
        for it in section.items
        if it.type == "entity"
    )

    try:
        refresh_interval = int(raw.get("refresh_interval", 30) or 30)
    except (ValueError, TypeError):
        refresh_interval = 30

    config = PanelConfig(
        ha_url=ha_url,
        ha_token=ha_token,
        title=raw.get("panel_title", raw.get("title", "Retro Panel")),
        theme=raw.get("theme", "dark"),
        refresh_interval=refresh_interval,
        header_sensors=header_sensors,
        overview_sections=overview_sections,
        rooms=rooms,
        scenario_sections=scenario_sections,
        camera_sections=camera_sections,
        overview_title=overview_title,
        overview_icon=overview_icon,
        scenarios_section_title=scenarios_section_title,
        scenarios_section_icon=scenarios_section_icon,
        cameras_section_title=cameras_section_title,
        cameras_section_icon=cameras_section_icon,
    )

    logger.info(
        "Config loaded: title=%r, overview=%d entities, rooms=%d, scenarios=%d, cameras=%d, theme=%r",
        config.title,
        total_entities,
        len(rooms),
        len(scenario_sections),
        len(camera_sections),
        config.theme,
    )
    return config
