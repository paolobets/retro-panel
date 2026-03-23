"""POST /api/config — saves pages configuration to /data/entities.json and reloads in-memory config."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

from aiohttp import web

logger = logging.getLogger(__name__)

_ENTITY_ID_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
_ENTITIES_FILE = Path("/data/entities.json")

# Safe icon/label lengths
_MAX_LABEL = 64
_MAX_ICON = 32
_MAX_PAGE_TITLE = 64
_MAX_PAGE_ID = 64
_MAX_PAGES = 20
_MAX_ITEMS_PER_PAGE = 100


def _validate_entity_id(eid: str) -> str:
    """Return stripped entity_id or raise ValueError."""
    eid = str(eid or "").strip()
    if not eid:
        raise ValueError("entity_id is empty")
    if not _ENTITY_ID_RE.match(eid):
        raise ValueError(f"Invalid entity_id format: {eid!r}")
    return eid


def _parse_entity_item(raw: dict, idx: int) -> dict:
    entity_id = _validate_entity_id(raw.get("entity_id") or "")
    item: dict = {"type": "entity", "entity_id": entity_id}
    if raw.get("label"):
        item["label"] = str(raw["label"])[:_MAX_LABEL]
    if raw.get("icon"):
        item["icon"] = str(raw["icon"])[:_MAX_ICON]
    return item


def _parse_energy_flow_item(raw: dict) -> dict:
    item: dict = {"type": "energy_flow"}
    for field in ("solar_power", "battery_soc", "battery_power", "grid_power", "home_power"):
        val = str(raw.get(field) or "").strip()
        if val:
            try:
                val = _validate_entity_id(val)
            except ValueError as exc:
                raise ValueError(f"energy_flow.{field}: {exc}") from exc
        item[field] = val
    return item


async def save_config(request: web.Request) -> web.Response:
    """Accept a pages structure, write to /data/entities.json, reload in-memory config."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response({"error": "Invalid JSON body"}, status=400)

    pages_raw = body.get("pages")
    if not isinstance(pages_raw, list):
        return web.json_response({"error": "'pages' must be a list"}, status=400)

    if len(pages_raw) > _MAX_PAGES:
        return web.json_response(
            {"error": f"Too many pages (max {_MAX_PAGES})"}, status=400
        )

    pages: list[dict] = []
    for page_idx, page_raw in enumerate(pages_raw):
        if not isinstance(page_raw, dict):
            return web.json_response(
                {"error": f"Page at index {page_idx} must be an object"}, status=400
            )

        page_id = str(page_raw.get("id") or f"page_{page_idx}").strip()[:_MAX_PAGE_ID]
        page_title = str(page_raw.get("title") or f"Page {page_idx + 1}").strip()[:_MAX_PAGE_TITLE]
        page_icon = str(page_raw.get("icon") or "home").strip()[:_MAX_ICON]

        items_raw = page_raw.get("items")
        if not isinstance(items_raw, list):
            items_raw = []
        if len(items_raw) > _MAX_ITEMS_PER_PAGE:
            return web.json_response(
                {"error": f"Page {page_idx}: too many items (max {_MAX_ITEMS_PER_PAGE})"}, status=400
            )

        items: list[dict] = []
        for item_idx, item_raw in enumerate(items_raw):
            if not isinstance(item_raw, dict):
                continue
            item_type = str(item_raw.get("type") or "entity").strip()
            try:
                if item_type == "entity":
                    items.append(_parse_entity_item(item_raw, item_idx))
                elif item_type == "energy_flow":
                    items.append(_parse_energy_flow_item(item_raw))
                else:
                    logger.warning(
                        "Page %d item %d has unknown type %r, skipping",
                        page_idx, item_idx, item_type,
                    )
            except ValueError as exc:
                return web.json_response(
                    {"error": f"Page {page_idx} item {item_idx}: {exc}"}, status=400
                )

        pages.append({"id": page_id, "title": page_title, "icon": page_icon, "items": items})

    v2_data = {"version": 2, "pages": pages}

    try:
        _ENTITIES_FILE.write_text(
            json.dumps(v2_data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
    except Exception as exc:
        logger.error("Failed to write %s: %s", _ENTITIES_FILE, exc)
        return web.json_response({"error": "Failed to save configuration"}, status=500)

    total_entities = sum(
        1 for p in pages for item in p["items"] if item.get("type") == "entity"
    )
    logger.info(
        "Config saved to %s: %d pages, %d entity items",
        _ENTITIES_FILE, len(pages), total_entities,
    )

    # Reload in-memory config so the panel reflects changes immediately
    try:
        from config.loader import load_config
        request.app["config"] = load_config()
    except Exception as exc:
        logger.warning("Config saved but in-memory reload failed: %s", exc)

    return web.json_response({"ok": True, "pages": len(pages), "entities": total_entities})
