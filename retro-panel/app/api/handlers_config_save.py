"""POST /api/config — saves v4 configuration to /data/entities.json."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from aiohttp import web

logger = logging.getLogger(__name__)

_ENTITY_ID_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
_ENTITIES_FILE = Path("/data/entities.json")

_MAX_LABEL = 64
_MAX_ICON = 32
_MAX_TITLE = 64
_MAX_ID = 64
_MAX_ROOMS = 30
_MAX_ITEMS = 100
_MAX_SECTIONS = 20
_MAX_SCENARIOS = 50
_MAX_HEADER_SENSORS = 6
_MAX_CAMERAS = 20

_CAMERA_ENTITY_RE = re.compile(r"^camera\.[a-z0-9_]+$")


def _validate_entity_id(eid: str) -> str:
    eid = str(eid or "").strip()
    if not eid:
        raise ValueError("entity_id is empty")
    if not _ENTITY_ID_RE.match(eid):
        raise ValueError(f"Invalid entity_id format: {eid!r}")
    return eid


def _parse_item(raw: dict, idx: int, context: str) -> dict:
    item_type = str(raw.get("type") or "entity").strip()
    if item_type == "entity":
        entity_id = _validate_entity_id(raw.get("entity_id") or "")
        item: dict = {"type": "entity", "entity_id": entity_id}
        if raw.get("label"):
            item["label"] = str(raw["label"])[:_MAX_LABEL]
        if raw.get("icon"):
            item["icon"] = str(raw["icon"])[:_MAX_ICON]
        if raw.get("hidden"):
            item["hidden"] = True
        return item
    elif item_type == "energy_flow":
        item = {"type": "energy_flow"}
        for f in ("solar_power", "battery_soc", "battery_power", "grid_power", "home_power"):
            val = str(raw.get(f) or "").strip()
            if val:
                try:
                    val = _validate_entity_id(val)
                except ValueError as exc:
                    raise ValueError(f"energy_flow.{f}: {exc}") from exc
            item[f] = val
        return item
    else:
        raise ValueError(f"Unknown item type: {item_type!r}")


def _parse_section_for_save(sec_raw: dict, sec_idx: int, room_id: str) -> dict:
    sec_id = str(sec_raw.get("id") or f"sec_{sec_idx}").strip()[:_MAX_ID]
    sec_title = str(sec_raw.get("title") or "").strip()[:_MAX_TITLE]
    items_raw = sec_raw.get("items") or []
    if not isinstance(items_raw, list):
        items_raw = []
    if len(items_raw) > _MAX_ITEMS:
        raise ValueError(f"Section {sec_idx}: too many items (max {_MAX_ITEMS})")
    sec_items = []
    for item_idx, raw in enumerate(items_raw):
        if not isinstance(raw, dict):
            continue
        sec_items.append(_parse_item(raw, item_idx, f"room[{room_id}]/sec[{sec_id}]"))
    return {"id": sec_id, "title": sec_title, "items": sec_items}


async def save_config(request: web.Request) -> web.Response:
    """Accept v4 structure, write to /data/entities.json, reload in-memory config."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON body"}, status=400)

    # --- overview ---
    overview_raw = body.get("overview") or {}
    overview_title = str(overview_raw.get("title") or "Overview").strip()[:64] or "Overview"
    overview_raw = overview_raw.get("items") or [] if isinstance(overview_raw, dict) else []
    if not isinstance(overview_raw, list):
        overview_raw = []
    overview_items = []
    for idx, raw in enumerate(overview_raw[:_MAX_ITEMS]):
        if not isinstance(raw, dict):
            continue
        try:
            overview_items.append(_parse_item(raw, idx, "overview"))
        except ValueError as exc:
            return web.json_response({"error": f"overview item {idx}: {exc}"}, status=400)

    # --- rooms ---
    rooms_raw = body.get("rooms") or []
    if not isinstance(rooms_raw, list):
        rooms_raw = []
    if len(rooms_raw) > _MAX_ROOMS:
        return web.json_response({"error": f"Too many rooms (max {_MAX_ROOMS})"}, status=400)

    rooms = []
    for room_idx, room_raw in enumerate(rooms_raw):
        if not isinstance(room_raw, dict):
            continue
        room_id = str(room_raw.get("id") or f"room_{room_idx}").strip()[:_MAX_ID]
        room_title = str(room_raw.get("title") or f"Room {room_idx + 1}").strip()[:_MAX_TITLE]
        room_icon = str(room_raw.get("icon") or "home").strip()[:_MAX_ICON]
        room_hidden = bool(room_raw.get("hidden", False))

        # Accept both v4 sections[] and legacy items[] (for backward compat)
        sections_raw = room_raw.get("sections")
        if sections_raw is not None and isinstance(sections_raw, list):
            # v4 format
            if len(sections_raw) > _MAX_SECTIONS:
                return web.json_response(
                    {"error": f"Room {room_idx}: too many sections (max {_MAX_SECTIONS})"}, status=400
                )
            room_sections = []
            for sec_idx, sec_raw in enumerate(sections_raw):
                if not isinstance(sec_raw, dict):
                    continue
                try:
                    room_sections.append(_parse_section_for_save(sec_raw, sec_idx, room_id))
                except ValueError as exc:
                    return web.json_response(
                        {"error": f"room[{room_id}] section {sec_idx}: {exc}"}, status=400
                    )
            rooms.append({
                "id": room_id,
                "title": room_title,
                "icon": room_icon,
                "hidden": room_hidden,
                "sections": room_sections,
            })
        else:
            # Legacy v3 format: flat items[] -> wrap in default section
            items_raw = room_raw.get("items") or []
            if not isinstance(items_raw, list):
                items_raw = []
            room_items = []
            for item_idx, raw in enumerate(items_raw):
                if not isinstance(raw, dict):
                    continue
                try:
                    room_items.append(_parse_item(raw, item_idx, f"room[{room_id}]"))
                except ValueError as exc:
                    return web.json_response(
                        {"error": f"room[{room_id}] item {item_idx}: {exc}"}, status=400
                    )
            rooms.append({
                "id": room_id,
                "title": room_title,
                "icon": room_icon,
                "hidden": room_hidden,
                "sections": [{"id": "sec_default", "title": "", "items": room_items}],
            })

    # --- scenarios ---
    scenarios_raw = body.get("scenarios") or []
    if not isinstance(scenarios_raw, list):
        scenarios_raw = []
    scenarios = []
    for sc_raw in scenarios_raw[:_MAX_SCENARIOS]:
        if not isinstance(sc_raw, dict):
            continue
        try:
            eid = _validate_entity_id(sc_raw.get("entity_id") or "")
        except ValueError:
            continue
        scenarios.append({
            "entity_id": eid,
            "title": str(sc_raw.get("title") or eid.split(".")[-1]).strip()[:_MAX_TITLE],
            "icon": str(sc_raw.get("icon") or "\U0001f3ad").strip()[:_MAX_ICON],
        })

    # --- header_sensors ---
    hs_raw = body.get("header_sensors") or []
    if not isinstance(hs_raw, list):
        hs_raw = []
    header_sensors = []
    for hs in hs_raw[:_MAX_HEADER_SENSORS]:
        if not isinstance(hs, dict):
            continue
        try:
            eid = _validate_entity_id(hs.get("entity_id") or "")
        except ValueError:
            continue
        header_sensors.append({
            "entity_id": eid,
            "icon": str(hs.get("icon") or "").strip()[:_MAX_ICON],
            "label": str(hs.get("label") or "").strip()[:_MAX_LABEL],
        })

    # --- cameras ---
    cameras_raw = body.get("cameras") or []
    if not isinstance(cameras_raw, list):
        cameras_raw = []
    if len(cameras_raw) > _MAX_CAMERAS:
        return web.json_response({"error": f"Too many cameras (max {_MAX_CAMERAS})"}, status=400)
    cameras = []
    for cam_raw in cameras_raw:
        if not isinstance(cam_raw, dict):
            continue
        eid = str(cam_raw.get("entity_id") or "").strip()
        if not eid or not _CAMERA_ENTITY_RE.match(eid) or len(eid) > 64:
            continue
        title = str(cam_raw.get("title") or "").strip()[:_MAX_TITLE]
        try:
            refresh_interval = int(cam_raw.get("refresh_interval", 10))
        except (TypeError, ValueError):
            refresh_interval = 10
        refresh_interval = max(3, min(60, refresh_interval))
        cameras.append({
            "entity_id": eid,
            "title": title,
            "refresh_interval": refresh_interval,
        })

    v4_data = {
        "version": 4,
        "header_sensors": header_sensors,
        "overview": {"title": overview_title, "items": overview_items},
        "rooms": rooms,
        "scenarios": scenarios,
        "cameras": cameras,
    }

    try:
        _ENTITIES_FILE.write_text(
            json.dumps(v4_data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except Exception as exc:
        logger.error("Failed to write %s: %s", _ENTITIES_FILE, exc)
        return web.json_response({"error": "Failed to save configuration"}, status=500)

    total_overview = sum(1 for it in overview_items if it.get("type") == "entity")
    total_sections = sum(len(r.get("sections", [])) for r in rooms)
    logger.info(
        "Config v4 saved: overview=%d entities, rooms=%d, sections=%d, scenarios=%d, header_sensors=%d, cameras=%d",
        total_overview, len(rooms), total_sections, len(scenarios), len(header_sensors), len(cameras),
    )

    # Reload in-memory config and update WS proxy entity filter
    try:
        from config.loader import load_config
        new_config = load_config()
        request.app["config"] = new_config
        ws_proxy = request.app.get("ws_proxy")
        if ws_proxy is not None:
            ws_proxy.update_config(new_config)
    except Exception as exc:
        logger.warning("Config saved but in-memory reload failed: %s", exc)

    return web.json_response({
        "ok": True,
        "overview_entities": total_overview,
        "rooms": len(rooms),
        "scenarios": len(scenarios),
    })
