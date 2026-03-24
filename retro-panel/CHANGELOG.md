# Retro Panel — Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.1] — 2026-03-24

### Fixed

- **`/api/panel-config` handler v4 compatibility** (`app/api/handlers_config.py`)
  `get_panel_config()` was still serializing `room.items` instead of `room.sections`,
  causing `AttributeError: 'RoomConfig' object has no attribute 'items'` on every
  panel-config request after upgrading to v1.4.0 (v4 schema).
  Handler now iterates `room.sections` and returns `sections: [{id, title, items}]`
  in the rooms payload, matching the v4 data model.

---

## [1.4.0] — 2026-03-24

### Added

- **Room sections** (`app/config/loader.py`, `app/api/handlers_config_save.py`, `app/static/js/app.js`, `app/static/js/config.js`, `app/static/config.html`, `app/static/css/config.css`, `app/static/css/layout.css`)
  Rooms now support named sections. Each section has an id, a title, and its own list of entity items. This replaces the previous flat entity list per room and enables structured page design within a room.
  - **Data model (v4 schema)**: rooms contain `sections: [{id, title, items:[]}]` instead of flat `items[]`. Backward compatibility: v3 rooms with `items[]` are automatically migrated to a single unnamed default section on load.
  - **Room view rendering**: `renderRoomSections()` in `app.js` renders each section with an optional titled header followed by an auto-fill responsive tile grid (`.tile-grid-auto`). Replaces the fixed-column grid for room pages.
  - **Auto-fill grid**: room tiles now use `grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))` instead of fixed columns, adapting naturally to the available width.
  - **Config editor — two-column section editor**: the room editor in `config.html` / `config.js` now shows a two-column layout:
    - Left column: sections list with ↑↓ reorder, delete, and active selection highlight.
    - Right column: section detail — name input, entity list, + Add Entities, Import from area.
    - `+ Add Section` button creates a new empty section and selects it immediately.
    - Entity picker context is now per-section (`editingSectionId`).
  - **Import from area**: entities imported via "Import from area" are added to the currently selected section (or the first section, creating one if none exists).

- **"Retro PANEL" title branding** (`app/static/js/app.js`)
  The panel title in the sidebar header now renders as `Retro` followed by `PANEL` in accent blue (`var(--color-accent)`), applied via `innerHTML` in `applyConfig()`. `document.title` retains the plain text value from config.

### Changed

- **Entities.json schema bumped to v4** (`app/config/loader.py`, `app/api/handlers_config_save.py`)
  The on-disk format version is now `4`. Both the loader and the save handler accept v3 room formats (flat `items[]`) transparently for backward compatibility.
  - `PanelConfig._all_items()` traverses sections within rooms.
  - `PanelConfig.all_entity_ids` covers all entities across all sections.

---

## [1.3.0] — 2026-03-24

### Fixed

- **Entity registry retrieval via WebSocket API** (`app/proxy/ha_client.py`)
  The `get_entity_registry()` method previously used the REST endpoint `GET /api/config/entity_registry`,
  which does not exist as a list operation in Home Assistant. This caused the method to return HTTP 404,
  preventing the filtering of hidden and disabled entities in area imports.

  The method now uses the WebSocket command `config/entity_registry/list`, which is the authoritative
  way to retrieve all registry entries including `hidden_by` and `disabled_by` metadata.
  A short-lived WebSocket connection is established, authenticated, and closed after fetching the registry.
  This fix resolves the issue where entities marked as hidden in HA were incorrectly appearing in imported areas.

### Added

- **Light control bottom sheet** (`app/static/js/components/light-sheet.js`)
  A new global bottom sheet component provides intuitive brightness, color temperature, and RGB color control
  for light entities. Features include:
  - Brightness slider (1–255) with percentage display
  - Color temperature slider (153–500 mired) with Kelvin conversion
  - Hue slider (0–360°) with RGB preset swatches (warm white, white, blue, purple, green, red, orange, pink)
  - Live tile updates as sliders are adjusted
  - Debounced service calls to avoid overwhelming the HA API
  - Visibility toggled based on the light's `supported_features` bitmask
  - Triggered by long-press (500ms) on light tiles

- **Light tile long-press interaction** (`app/static/js/components/light.js`)
  Light tiles now support long-press (500ms hold) to open the bottom sheet for detailed control.
  Regular tap still toggles on/off. Motion detection prevents accidental long-press triggering.
  Touch-friendly implementation with mouse fallback for desktop testing.

- **Enhanced light and switch tile styling** (`app/static/js/components/light.js`, `app/static/js/components/switch.js`, `app/static/css/components.css`)
  - Light tiles display dynamic colors derived from RGB or color temperature attributes
  - Brightness percentage shown in tile value area when light is on
  - Switch tiles show fixed green color when on
  - Both entity types use `.light-tint` overlay with calculated RGBA background for visual feedback
  - Hover/active state transitions optimized for touch devices

### Changed

- **Icon rendering improvements** (`app/static/js/utils/format.js`, `app/static/js/mdi-icons.js`)
  SVG icons are now rendered with `currentColor` fill, allowing CSS color properties to control appearance.
  This enables dynamic icon coloring based on entity state without inline style manipulation.

- **HTML structure** (`app/static/index.html`)
  Light sheet component script (`light-sheet.js`) is now loaded before light tile component,
  ensuring the global `RP_LightSheet` object is available when light tiles initialize.

### Tests

- **New test suite for area handlers** (`tests/test_handlers_areas.py`)
  Nine comprehensive tests covering the `handlers_areas.get_ha_areas()` endpoint:
  - `test_basic_returns_areas`: Verifies multiple areas are returned correctly
  - `test_excluded_domains_removed`: Confirms unsupported domains (update, media_player, camera) are filtered
  - `test_hidden_entities_excluded`: Reproduces and validates fix for the registry bug (switch.bagnetto_specchio case)
  - `test_disabled_entities_excluded`: Ensures `disabled_by` entities are filtered
  - `test_hidden_by_integration_excluded`: Tests `hidden_by='integration'` filtering
  - `test_registry_failure_fallback`: Verifies graceful degradation when registry fetch fails
  - `test_template_failure_returns_502`: Confirms correct HTTP status on HA template API failure
  - `test_empty_areas`: Validates handling of empty area lists
  - `test_area_with_no_entities_after_filter`: Tests areas that become empty after entity filtering
  - Total: **9 tests**, all passing.

---

## [1.2.9] — 2026-03-24

### Fixed

- **Entity registry filter in `/api/entities`** (`app/api/handlers_entities.py`)
  The module comment incorrectly stated that the Jinja2 `states` variable excluded
  entities marked as hidden. In reality, `hidden_by` and `disabled_by` are fields
  of the HA entity registry (`/api/config/entity_registry`), not of state objects.
  The handler now cross-references the entity registry — the same pattern already
  used by `handlers_areas.py` — to exclude any entity whose `hidden_by` or
  `disabled_by` field is set. If the registry call fails, entities are still
  returned (graceful fallback) and a warning is logged.

### Added

- **Area-aware entity picker** (`app/static/js/config.js`)
  A new `haAreaMap` (area_id → [entity_ids]) is loaded from `/api/ha-areas` at
  page init. When the entity picker is opened from a room editor whose room ID
  matches a HA area ID, `renderEntityList()` pre-filters the list to show only
  entities belonging to that area.

- **Inline icon dropdown** (`app/static/js/config.js`, `config.html`, `config.css`)
  The full-screen overlay icon picker (`<section id="icon-picker" class="cfg-overlay">`)
  has been replaced with a compact inline dropdown:
  - `position: absolute` below the trigger button; `max-height: 264px`, scrollable.
  - Each row: SVG icon (22px) + human-readable label + checkmark when selected.
  - Trigger button arrow rotates when the dropdown is open.
  - Click outside closes the dropdown automatically.
  - iOS 15 Safari compatible (no ES modules, no flex gap, no `<dialog>`).

### Tests

- Mock `_make_ha_client` updated to accept a `registry` parameter wired to
  `get_entity_registry`. Three new test cases added:
  - `test_hidden_entities_excluded_via_registry`
  - `test_disabled_entities_excluded_via_registry`
  - `test_registry_failure_falls_back_gracefully`
  - Total: **13 tests**, all passing.

---

**Document Version**: 1.0.0
**Last Updated**: 2026-03-24
