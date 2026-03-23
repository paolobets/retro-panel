"""
Loads and parses /data/options.json injected by HA Supervisor at runtime.
Falls back to ./data/options.json for local development.

Entity layout is stored in /data/entities.json (v2 schema):
  { "version": 2, "pages": [ { "id", "title", "icon", "items": [...] } ] }

Each item is one of:
  { "type": "entity", "entity_id", "label", "icon" }
  { "type": "energy_flow", "solar_power", "battery_soc", "battery_power",
    "grid_power", "home_power" }

v1 flat arrays (plain list of entity dicts) are migrated automatically.
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
    ("cover.", "door"),
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
]

_DOMAIN_FALLBACK: dict[str, str] = {
    "binary_sensor": "circle",
    "sensor": "circle",
}


def _detect_icon(entity_id: str) -> str:
    """Auto-detect an icon name from the entity_id domain and keywords."""
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
    """Configuration for a single entity displayed on the panel."""

    entity_id: str
    label: str
    icon: str
    row: Optional[int] = None
    col: Optional[int] = None


@dataclass
class EnergyFlowConfig:
    """Sensor mappings for the Power Flow Card.

    Each field is an optional HA entity_id for that power/soc sensor.
    Positive grid_power = importing from grid; negative = exporting.
    Positive battery_power = charging; negative = discharging.
    """

    solar_power: str = ""    # W — production from solar panels
    battery_soc: str = ""    # % — battery state of charge
    battery_power: str = ""  # W — charge(+) / discharge(-)
    grid_power: str = ""     # W — import(+) / export(-)
    home_power: str = ""     # W — total home consumption


@dataclass
class PageItem:
    """A single item in a page: either an entity tile or an energy flow card."""

    type: str  # "entity" | "energy_flow"
    entity_config: Optional[EntityConfig] = None
    energy_flow: Optional[EnergyFlowConfig] = None


@dataclass
class PageConfig:
    """Configuration for a single page/tab shown in the bottom navigation bar."""

    id: str
    title: str
    icon: str = "home"
    items: List[PageItem] = field(default_factory=list)


@dataclass
class PanelConfig:
    """Top-level configuration for the Retro Panel add-on."""

    ha_url: str
    ha_token: str
    title: str
    columns: int
    theme: str
    kiosk_mode: bool
    refresh_interval: int
    pages: List[PageConfig] = field(default_factory=list)

    @property
    def entities(self) -> list[EntityConfig]:
        """All entity configs across all pages (legacy property)."""
        result: list[EntityConfig] = []
        for page in self.pages:
            for item in page.items:
                if item.type == "entity" and item.entity_config is not None:
                    result.append(item.entity_config)
        return result

    @property
    def all_entity_ids(self) -> list[str]:
        """All entity_ids referenced anywhere (entities + energy flow sensors)."""
        seen: set[str] = set()
        ids: list[str] = []

        def _add(eid: str) -> None:
            if eid and eid not in seen:
                seen.add(eid)
                ids.append(eid)

        for page in self.pages:
            for item in page.items:
                if item.type == "entity" and item.entity_config is not None:
                    _add(item.entity_config.entity_id)
                elif item.type == "energy_flow" and item.energy_flow is not None:
                    ef = item.energy_flow
                    for eid in (
                        ef.solar_power,
                        ef.battery_soc,
                        ef.battery_power,
                        ef.grid_power,
                        ef.home_power,
                    ):
                        _add(eid)
        return ids


# ---------------------------------------------------------------------------
# Internal parsing helpers
# ---------------------------------------------------------------------------

def _resolve_config_path() -> Path:
    """Return the path to options.json, preferring the HA Supervisor location."""
    supervisor_path = Path("/data/options.json")
    if supervisor_path.exists():
        return supervisor_path
    local_path = Path("./data/options.json")
    if local_path.exists():
        return local_path
    return supervisor_path  # will raise a clear error on read


def _parse_entity(raw: dict) -> EntityConfig:
    """Parse a single entity dict into an EntityConfig."""
    entity_id: str = raw.get("entity_id", "").strip()
    if not entity_id:
        raise ValueError(f"Entity entry is missing 'entity_id': {raw!r}")

    provided_icon: str = raw.get("icon", "").strip()
    icon = provided_icon if provided_icon else _detect_icon(entity_id)

    label: str = (
        raw.get("label", "").strip()
        or entity_id.replace("_", " ").split(".")[-1].title()
    )

    return EntityConfig(
        entity_id=entity_id,
        label=label,
        icon=icon,
        row=raw.get("row"),
        col=raw.get("col"),
    )


def _parse_energy_flow(raw: dict) -> EnergyFlowConfig:
    """Parse energy flow sensor mapping from a raw dict."""
    return EnergyFlowConfig(
        solar_power=str(raw.get("solar_power") or "").strip(),
        battery_soc=str(raw.get("battery_soc") or "").strip(),
        battery_power=str(raw.get("battery_power") or "").strip(),
        grid_power=str(raw.get("grid_power") or "").strip(),
        home_power=str(raw.get("home_power") or "").strip(),
    )


def _parse_page(raw: dict, idx: int) -> PageConfig:
    """Parse a single page dict from the v2 format."""
    page_id = str(raw.get("id") or f"page_{idx}").strip()
    title = str(raw.get("title") or f"Page {idx + 1}").strip()
    icon = str(raw.get("icon") or "home").strip()

    items: list[PageItem] = []
    for item_idx, item_raw in enumerate(raw.get("items") or []):
        item_type = str(item_raw.get("type") or "entity").strip()
        if item_type == "entity":
            try:
                ec = _parse_entity(item_raw)
                items.append(PageItem(type="entity", entity_config=ec))
            except ValueError as exc:
                logger.warning(
                    "Page %r item %d is invalid, skipping: %s", page_id, item_idx, exc
                )
        elif item_type == "energy_flow":
            ef = _parse_energy_flow(item_raw)
            items.append(PageItem(type="energy_flow", energy_flow=ef))
        else:
            logger.warning(
                "Page %r item %d has unknown type %r, skipping", page_id, item_idx, item_type
            )

    return PageConfig(id=page_id, title=title, icon=icon, items=items)


def _migrate_v1_flat(raw_entities: list) -> list[PageConfig]:
    """Migrate v1 flat entity list to a single v2 page."""
    items: list[PageItem] = []
    for idx, ent in enumerate(raw_entities):
        try:
            items.append(PageItem(type="entity", entity_config=_parse_entity(ent)))
        except (ValueError, AttributeError) as exc:
            logger.warning("v1 entity at index %d is invalid, skipping: %s", idx, exc)

    return [PageConfig(id="page_main", title="Home", icon="home", items=items)]


def _load_pages(entities_file: Path, options_fallback: list) -> list[PageConfig]:
    """Load pages from /data/entities.json with v1 migration."""
    if entities_file.exists():
        try:
            raw = json.loads(entities_file.read_text(encoding="utf-8"))
        except Exception as exc:
            logger.warning("Failed to read %s: %s — using empty pages", entities_file, exc)
            return []

        # v2 format: dict with "version" key
        if isinstance(raw, dict) and raw.get("version") == 2:
            pages: list[PageConfig] = []
            for page_idx, page_raw in enumerate(raw.get("pages") or []):
                pages.append(_parse_page(page_raw, page_idx))
            return pages

        # v1 format: plain list
        if isinstance(raw, list):
            logger.info("Migrating v1 entities.json to v2 pages format")
            return _migrate_v1_flat(raw)

        logger.warning("Unrecognised entities.json format, using empty pages")
        return []
    else:
        # Fall back to options.json entities (very old installs)
        if options_fallback:
            logger.info("No entities.json found, migrating entities from options.json")
            return _migrate_v1_flat(options_fallback)
        return []


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
            logger.info(
                "ha_token not set — using SUPERVISOR_TOKEN via Supervisor proxy (%s)", ha_url
            )
        else:
            raise ValueError(
                "'ha_token' is not configured and SUPERVISOR_TOKEN is not available. "
                "Set ha_token in the add-on configuration."
            )
    elif not ha_url:
        ha_url = "http://homeassistant:8123"
        logger.info("ha_url not configured, using internal default: %s", ha_url)

    columns_raw = raw.get("columns", 3)
    try:
        columns = int(columns_raw)
    except (TypeError, ValueError):
        columns = 3

    entities_file = Path("/data/entities.json")
    options_entities = raw.get("entities", [])
    pages = _load_pages(entities_file, options_entities if isinstance(options_entities, list) else [])

    total_entities = sum(
        1 for page in pages for item in page.items if item.type == "entity"
    )

    config = PanelConfig(
        ha_url=ha_url,
        ha_token=ha_token,
        title=raw.get("panel_title", raw.get("title", "Retro Panel")),
        columns=columns,
        theme=raw.get("theme", "dark"),
        kiosk_mode=bool(raw.get("kiosk_mode", False)),
        refresh_interval=int(raw.get("refresh_interval", 30) or 30),
        pages=pages,
    )

    logger.info(
        "Config loaded: title=%r, columns=%d, pages=%d, entities=%d, theme=%r, kiosk=%s",
        config.title,
        config.columns,
        len(config.pages),
        total_entities,
        config.theme,
        config.kiosk_mode,
    )
    return config
