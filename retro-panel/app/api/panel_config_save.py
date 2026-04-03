"""POST /api/config — saves v5 configuration to /data/entities.json."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from aiohttp import web

logger = logging.getLogger(__name__)

_ENTITY_ID_RE = re.compile(r"^[a-z][a-z0-9_]*\.[a-z0-9_]+$")
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
_MAX_ALARMS = 10
_MAX_ALARM_SENSORS = 30
_ALARM_ENTITY_RE = re.compile(r'^alarm_control_panel\.[a-z0-9_]+$')
_ALARM_SENSOR_RE = re.compile(r'^binary_sensor\.[a-z0-9_]+$')

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
        if raw.get("visual_type"):
            item["visual_type"] = str(raw["visual_type"])[:32]
        if raw.get("display_mode"):
            item["display_mode"] = str(raw["display_mode"])[:32]
        if raw.get("device_class"):
            item["device_class"] = str(raw["device_class"])[:64]
        return item
    elif item_type == "energy_flow":
        item = {"type": "energy_flow"}
        for f in ("solar_power", "home_power", "battery_soc",
                  "battery_charge_power", "battery_discharge_power",
                  "grid_import", "grid_export"):
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


def _parse_items_from_body(items_raw: list) -> list:
    """Parse and validate a list of entity/energy_flow items from the request body."""
    if not isinstance(items_raw, list):
        items_raw = []
    result = []
    for idx, raw in enumerate(items_raw[:_MAX_ITEMS]):
        if not isinstance(raw, dict):
            continue
        result.append(_parse_item(raw, idx, ""))
    return result


async def save_config(request: web.Request) -> web.Response:
    """Accept v5 structure, write to /data/entities.json, reload in-memory config."""
    try:
        body = await request.json()
    except Exception as exc:
        logger.warning("save_config: invalid JSON body: %s", exc)
        return web.json_response({"error": "Invalid JSON body"}, status=400)

    # --- overview ---
    ov_raw = body.get("overview") or {}
    overview_title = str(ov_raw.get("title") or "Overview").strip()[:64] or "Overview"
    overview_icon = str(ov_raw.get("icon") or "home").strip()[:_MAX_ICON] or "home"

    overview_sections = []
    for sec_raw in (ov_raw.get("sections") or []):
        if not isinstance(sec_raw, dict):
            continue
        sec_id = str(sec_raw.get("id") or "").strip()[:_MAX_ID]
        if not sec_id:
            continue
        sec_title = str(sec_raw.get("title") or "").strip()[:_MAX_TITLE]
        try:
            sec_items = _parse_items_from_body(sec_raw.get("items") or [])
        except ValueError as exc:
            return web.json_response({"error": f"overview section [{sec_id}]: {exc}"}, status=400)
        overview_sections.append({"id": sec_id, "title": sec_title, "items": sec_items})

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
    if len(scenarios_raw) > _MAX_SECTIONS:
        return web.json_response({"error": f"Too many scenario sections (max {_MAX_SECTIONS})"}, status=400)
    scenario_sections = []
    for sec_raw in scenarios_raw:
        if not isinstance(sec_raw, dict):
            continue
        sec_id = str(sec_raw.get("id") or "").strip()[:_MAX_ID]
        if not sec_id:
            continue
        sec_title = str(sec_raw.get("title") or "").strip()[:_MAX_TITLE]
        items = []
        for sc in (sec_raw.get("items") or []):
            if not isinstance(sc, dict):
                continue
            try:
                eid = _validate_entity_id(sc.get("entity_id") or "")
            except ValueError as exc:
                return web.json_response(
                    {"error": f"scenario section [{sec_id}]: {exc}"}, status=400
                )
            items.append({
                "entity_id": eid,
                "title": str(sc.get("title") or "").strip()[:_MAX_TITLE],
                "icon": str(sc.get("icon") or "\U0001F3AD").strip()[:_MAX_ICON],
            })
        scenario_sections.append({"id": sec_id, "title": sec_title, "items": items})

    # --- scenarios_section (container metadata) ---
    sc_sec_raw = body.get("scenarios_section") or {}
    scenarios_section = {
        "title": str(sc_sec_raw.get("title") or "Scenarios").strip()[:_MAX_TITLE] or "Scenarios",
        "icon": str(sc_sec_raw.get("icon") or "palette").strip()[:_MAX_ICON] or "palette",
    }

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
    if len(cameras_raw) > _MAX_SECTIONS:
        return web.json_response({"error": f"Too many camera sections (max {_MAX_SECTIONS})"}, status=400)
    camera_sections = []
    for sec_raw in cameras_raw:
        if not isinstance(sec_raw, dict):
            continue
        sec_id = str(sec_raw.get("id") or "").strip()[:_MAX_ID]
        if not sec_id:
            continue
        sec_title = str(sec_raw.get("title") or "").strip()[:_MAX_TITLE]
        items = []
        for c in (sec_raw.get("items") or []):
            if not isinstance(c, dict):
                continue
            eid = str(c.get("entity_id") or "").strip()
            if not eid:
                continue
            if not _CAMERA_ENTITY_RE.match(eid):
                continue
            try:
                ri = int(c.get("refresh_interval") or 10)
            except (ValueError, TypeError):
                ri = 10
            if ri < 3: ri = 3
            if ri > 60: ri = 60
            items.append({
                "entity_id": eid,
                "title": str(c.get("title") or "").strip()[:_MAX_TITLE],
                "refresh_interval": ri,
            })
        camera_sections.append({"id": sec_id, "title": sec_title, "items": items})

    # --- cameras_section (container metadata) ---
    cam_sec_raw = body.get("cameras_section") or {}
    cameras_section = {
        "title": str(cam_sec_raw.get("title") or "Cameras").strip()[:_MAX_TITLE] or "Cameras",
        "icon": str(cam_sec_raw.get("icon") or "cctv").strip()[:_MAX_ICON] or "cctv",
    }

    # --- alarms ---
    alm_sec_raw = body.get("alarms_section") or {}
    alarms_section_title = str(alm_sec_raw.get("title") or "Allarme").strip()[:_MAX_TITLE] or "Allarme"
    alarms_section_icon = str(alm_sec_raw.get("icon") or "shield-home").strip()[:_MAX_ICON] or "shield-home"

    alarms_out = []
    for alm in (body.get("alarms") or [])[:_MAX_ALARMS]:
        if not isinstance(alm, dict):
            continue
        alm_eid = str(alm.get("entity_id") or "").strip()
        if not alm_eid or not _ALARM_ENTITY_RE.match(alm_eid):
            continue
        sensors_out = []
        for s in (alm.get("sensors") or [])[:_MAX_ALARM_SENSORS]:
            if not isinstance(s, dict):
                continue
            s_eid = str(s.get("entity_id") or "").strip()
            if not s_eid or not _ALARM_SENSOR_RE.match(s_eid):
                continue
            sensors_out.append({
                "entity_id": s_eid,
                "label": str(s.get("label") or "").strip()[:_MAX_LABEL],
                "device_class": str(s.get("device_class") or "").strip()[:32],
            })
        alarms_out.append({
            "entity_id": alm_eid,
            "label": str(alm.get("label") or "").strip()[:_MAX_LABEL],
            "sensors": sensors_out,
        })

    v5_data = {
        "version": 5,
        "header_sensors": header_sensors,
        "overview": {
            "title": overview_title,
            "icon": overview_icon,
            "sections": overview_sections,
        },
        "rooms": rooms,
        "scenarios": scenario_sections,
        "scenarios_section": scenarios_section,
        "cameras": camera_sections,
        "cameras_section": cameras_section,
        "alarms": alarms_out,
        "alarms_section": {"title": alarms_section_title, "icon": alarms_section_icon},
    }

    try:
        tmp = _ENTITIES_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(v5_data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(_ENTITIES_FILE)
    except Exception as exc:
        logger.error("Failed to write %s: %s", _ENTITIES_FILE, exc)
        return web.json_response({"error": "Failed to save configuration"}, status=500)

    total_overview_sections = len(overview_sections)
    total_room_sections = sum(len(r.get("sections", [])) for r in rooms)
    logger.info(
        "Config v5 saved: overview=%d sections, rooms=%d, room_sections=%d, scenario_sections=%d, header_sensors=%d, camera_sections=%d",
        total_overview_sections, len(rooms), total_room_sections, len(scenario_sections), len(header_sensors), len(camera_sections),
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
        "overview_sections": total_overview_sections,
        "rooms": len(rooms),
        "scenario_sections": len(scenario_sections),
        "camera_sections": len(camera_sections),
    })
