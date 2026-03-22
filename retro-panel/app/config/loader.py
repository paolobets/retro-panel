"""
Loads and parses /data/options.json injected by HA Supervisor at runtime.
Falls back to ./data/options.json for local development.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

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
class PanelConfig:
    """Top-level configuration for the Retro Panel add-on."""

    ha_url: str
    ha_token: str
    title: str
    columns: int
    theme: str
    kiosk_mode: bool
    refresh_interval: int
    entities: list[EntityConfig] = field(default_factory=list)


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
    """Parse a single entity dict from options.json into an EntityConfig."""
    entity_id: str = raw.get("entity_id", "").strip()
    if not entity_id:
        raise ValueError(f"Entity entry is missing 'entity_id': {raw!r}")

    provided_icon: str = raw.get("icon", "").strip()
    icon = provided_icon if provided_icon else _detect_icon(entity_id)

    label: str = raw.get("label", "").strip() or entity_id.replace("_", " ").split(".")[-1].title()

    return EntityConfig(
        entity_id=entity_id,
        label=label,
        icon=icon,
        row=raw.get("row"),
        col=raw.get("col"),
    )


def load_config() -> PanelConfig:
    """Load and parse the add-on configuration from options.json."""
    config_path = _resolve_config_path()

    try:
        raw_text = config_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise FileNotFoundError(
            f"Configuration file not found at '{config_path}'. "
            "When running outside Home Assistant, create './data/options.json' "
            "with the required fields: ha_url, ha_token, entities."
        ) from None

    raw: dict = json.loads(raw_text)

    ha_url: str = raw.get("ha_url", "").rstrip("/")
    if not ha_url:
        raise ValueError("'ha_url' is required in options.json")

    ha_token: str = raw.get("ha_token", "").strip()
    if not ha_token:
        raise ValueError("'ha_token' is required in options.json")

    columns_raw = raw.get("columns", 3)
    try:
        columns = int(columns_raw)
    except (TypeError, ValueError):
        columns = 3

    raw_entities: list[dict] = raw.get("entities", [])
    entities: list[EntityConfig] = []
    for idx, ent in enumerate(raw_entities):
        try:
            entities.append(_parse_entity(ent))
        except ValueError as exc:
            raise ValueError(f"Entity at index {idx} is invalid: {exc}") from exc

    config = PanelConfig(
        ha_url=ha_url,
        ha_token=ha_token,
        title=raw.get("panel_title", raw.get("title", "Retro Panel")),
        columns=columns,
        theme=raw.get("theme", "dark"),
        kiosk_mode=bool(raw.get("kiosk_mode", False)),
        refresh_interval=int(raw.get("refresh_interval", 30) or 30),
        entities=entities,
    )

    logger.info(
        "Config loaded: title=%r, columns=%d, entities=%d, theme=%r, kiosk=%s",
        config.title,
        config.columns,
        len(config.entities),
        config.theme,
        config.kiosk_mode,
    )
    return config
