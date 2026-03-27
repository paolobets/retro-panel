"""
Loads and parses /data/options.json injected by HA Supervisor at runtime.
Falls back to ./data/options.json for local development.

Entity layout is stored in /data/entities.json (v4 schema):
  {
    "version": 4,
    "header_sensors": [{"entity_id", "icon", "label"}],
    "overview": {"items": [...]},
    "rooms": [{"id", "title", "icon", "hidden", "sections": [{"id", "title", "items": [...]}]}],
    "scenarios": [{"entity_id", "title", "icon"}]
  }

Each item is one of:
  {"type": "entity", "entity_id", "label", "icon"}
  {"type": "energy_flow", "solar_power", "battery_soc", "battery_power",
   "grid_power", "home_power"}

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
    ("switch.", "toggle"),
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


def _detect_icon(entity_id: str) -> str:
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
    battery_soc: str = ""
    battery_power: str = ""
    grid_power: str = ""
    home_power: str = ""


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
    """Top-level configuration for Retro Panel v4."""

    ha_url: str
    ha_token: str
    title: str
    theme: str
    kiosk_mode: bool
    refresh_interval: int
    header_sensors: List[HeaderSensor] = field(default_factory=list)
    overview_items: List[SectionItem] = field(default_factory=list)
    rooms: List[RoomConfig] = field(default_factory=list)
    scenarios: List[ScenarioConfig] = field(default_factory=list)
    cameras: List[CameraConfig] = field(default_factory=list)
    overview_title: str = "Overview"

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
        items: list[SectionItem] = list(self.overview_items)
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
                for eid in (ef.solar_power, ef.battery_soc, ef.battery_power, ef.grid_power, ef.home_power):
                    _add(eid)

        for hs in self.header_sensors:
            _add(hs.entity_id)

        for cam in self.cameras:
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

    visual_type (user override) always wins.
    Falls back to domain + device_class inference.
    """
    if visual_type:
        return visual_type
    domain = entity_id.split(".")[0] if "." in entity_id else ""
    if domain == "light":
        return "light"
    if domain in ("switch", "input_boolean"):
        return "switch"
    if domain == "alarm_control_panel":
        return "alarm"
    if domain == "camera":
        return "camera"
    if domain in ("scene", "script", "automation"):
        return "scenario"
    if domain == "sensor":
        dc = (device_class or "").lower()
        _map = {
            "temperature": "sensor_temperature",
            "humidity": "sensor_humidity",
            "co2": "sensor_co2",
            "carbon_dioxide": "sensor_co2",
            "battery": "sensor_battery",
            "power": "sensor_energy",
            "energy": "sensor_energy",
        }
        return _map.get(dc, "sensor_generic")
    if domain == "binary_sensor":
        dc = (device_class or "").lower()
        if dc in ("door", "window"):
            return "binary_door"
        if dc in ("motion", "occupancy"):
            return "binary_motion"
        return "binary_standard"
    return "sensor_generic"


def _parse_entity(raw: dict) -> EntityConfig:
    entity_id: str = raw.get("entity_id", "").strip()
    if not entity_id:
        raise ValueError(f"Entity entry is missing 'entity_id': {raw!r}")
    provided_icon: str = raw.get("icon", "").strip()
    icon = provided_icon if provided_icon else _detect_icon(entity_id)
    label: str = (
        raw.get("label", "").strip()
        or entity_id.replace("_", " ").split(".")[-1].title()
    )
    hidden: bool = bool(raw.get("hidden", False))
    visual_type: str = str(raw.get("visual_type") or "").strip()
    display_mode: str = str(raw.get("display_mode") or "").strip()
    device_class: str = str(raw.get("device_class") or "").strip()
    layout_type: str = _compute_layout_type(entity_id, device_class, visual_type)
    return EntityConfig(entity_id=entity_id, label=label, icon=icon, hidden=hidden,
                        visual_type=visual_type, display_mode=display_mode,
                        device_class=device_class, layout_type=layout_type)


def _parse_energy_flow(raw: dict) -> EnergyFlowConfig:
    return EnergyFlowConfig(
        solar_power=str(raw.get("solar_power") or "").strip(),
        battery_soc=str(raw.get("battery_soc") or "").strip(),
        battery_power=str(raw.get("battery_power") or "").strip(),
        grid_power=str(raw.get("grid_power") or "").strip(),
        home_power=str(raw.get("home_power") or "").strip(),
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
    list[SectionItem],     # overview_items
    str,                   # overview_title
    list[RoomConfig],      # rooms
    list[ScenarioConfig],  # scenarios
    list[HeaderSensor],    # header_sensors
    list[CameraConfig],    # cameras
]:
    """Load layout from /data/entities.json, migrating older formats."""
    empty = ([], "Overview", [], [], [], [])

    if entities_file.exists():
        try:
            raw = json.loads(entities_file.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to read %s: %s — using empty layout", entities_file, exc)
            return empty

        # v4 format (also handles v3 rooms via _parse_room migration logic)
        if isinstance(raw, dict) and raw.get("version") in (3, 4):
            overview_items = _parse_items(
                (raw.get("overview") or {}).get("items") or [], "overview"
            )
            overview_title = str((raw.get("overview") or {}).get("title") or "Overview").strip() or "Overview"
            rooms: list[RoomConfig] = []
            for idx, room_raw in enumerate(raw.get("rooms") or []):
                if isinstance(room_raw, dict):
                    rooms.append(_parse_room(room_raw, idx))
            scenarios: list[ScenarioConfig] = []
            for s_raw in raw.get("scenarios") or []:
                if isinstance(s_raw, dict):
                    sc = _parse_scenario(s_raw)
                    if sc is not None:
                        scenarios.append(sc)
            header_sensors: list[HeaderSensor] = []
            for hs_raw in raw.get("header_sensors") or []:
                if isinstance(hs_raw, dict):
                    hs = _parse_header_sensor(hs_raw)
                    if hs is not None:
                        header_sensors.append(hs)
            raw_cameras = raw.get("cameras", [])
            cameras: list[CameraConfig] = []
            for c in raw_cameras:
                if isinstance(c, dict) and c.get("entity_id"):
                    cameras.append(CameraConfig(
                        entity_id=c["entity_id"],
                        title=c.get("title", ""),
                        refresh_interval=int(c.get("refresh_interval", 10)),
                    ))
            return overview_items, overview_title, rooms, scenarios, header_sensors, cameras

        # v2 format: migrate first page to overview
        if isinstance(raw, dict) and raw.get("version") == 2:
            logger.info("Migrating v2 pages format to v4")
            overview_items = _migrate_v2_pages(raw.get("pages") or [])
            return overview_items, "Overview", [], [], [], []

        # v1 format: plain list
        if isinstance(raw, list):
            logger.info("Migrating v1 flat entities format to v4")
            return _migrate_v1_flat(raw), "Overview", [], [], [], []

        logger.warning("Unrecognised entities.json format, using empty layout")
        return empty

    # Fall back to options.json entities
    if options_fallback:
        logger.info("No entities.json found, migrating from options.json")
        return _migrate_v1_flat(options_fallback), "Overview", [], [], [], []

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

    raw: dict = json.loads(raw_text)

    ha_url: str = (raw.get("ha_url") or "").strip().rstrip("/")
    ha_token: str = (raw.get("ha_token") or "").strip()

    if not ha_token:
        ha_token = os.environ.get("SUPERVISOR_TOKEN", "")
        if ha_token:
            ha_url = "http://supervisor/core"
            logger.info("ha_token not set — using SUPERVISOR_TOKEN via Supervisor proxy (%s)", ha_url)
        else:
            raise ValueError(
                "'ha_token' is not configured and SUPERVISOR_TOKEN is not available."
            )
    elif not ha_url:
        ha_url = "http://homeassistant:8123"
        logger.info("ha_url not configured, using default: %s", ha_url)

    entities_file = Path("/data/entities.json")
    options_entities = raw.get("entities", [])
    overview_items, overview_title, rooms, scenarios, header_sensors, cameras = _load_layout(
        entities_file,
        options_entities if isinstance(options_entities, list) else [],
    )

    total_entities = sum(1 for it in overview_items if it.type == "entity")
    total_entities += sum(
        1 for room in rooms
        for section in room.sections
        for it in section.items
        if it.type == "entity"
    )

    config = PanelConfig(
        ha_url=ha_url,
        ha_token=ha_token,
        title=raw.get("panel_title", raw.get("title", "Retro Panel")),
        theme=raw.get("theme", "dark"),
        kiosk_mode=bool(raw.get("kiosk_mode", False)),
        refresh_interval=int(raw.get("refresh_interval", 30) or 30),
        header_sensors=header_sensors,
        overview_items=overview_items,
        rooms=rooms,
        scenarios=scenarios,
        cameras=cameras,
        overview_title=overview_title,
    )

    logger.info(
        "Config loaded: title=%r, overview=%d entities, rooms=%d, scenarios=%d, cameras=%d, theme=%r",
        config.title,
        total_entities,
        len(rooms),
        len(scenarios),
        len(cameras),
        config.theme,
    )
    return config
