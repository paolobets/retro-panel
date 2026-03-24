# Retro Panel — Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
