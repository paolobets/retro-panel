# Changelog

## [1.2.7] - 2026-03-23

### Fixed
- **Entity registry KeyError on malformed entries** — the set comprehension that builds `hidden_or_disabled` used `e["entity_id"]` (direct access). A registry entry missing the `entity_id` field would raise `KeyError`, caught by the outer `except`, silently zeroing the entire filter set and making all hidden entities visible. Changed to `e.get("entity_id")` with a truthiness guard so malformed entries are skipped individually. Applied to both `handlers_entities.py` and `handlers_areas.py`.

### Changed
- **Unified icon system across the entire app** — config page and dashboard panel now use the same MDI SVG icon set everywhere. Previously the Settings page used emoji (hardcoded HTML entities) while the panel used MDI SVGs.
  - **Tab buttons** (`Overview`, `Rooms`, `Scenarios`, `Header`): emoji replaced by MDI SVG icons injected at runtime via `window.RP_MDI`
  - **Room icon picker**: `<select>` with emoji options replaced by a custom full-screen icon grid overlay (same pattern as entity/sensor pickers). Each icon shows the MDI SVG at 28 px with a text label. Selected icon highlighted with accent border and background tint. 4-column grid on phone, 5-column on wide tablet.
  - `balcony` room icon corrected from `'tree'` (duplicate of garden) to `'floor-plan'`
  - Added `--color-accent-bg` CSS token to `base.css` for consistent tinted backgrounds

### Added
- **Unit test suite** — `tests/test_handlers_entities.py` with 16 pytest-asyncio tests covering all filter scenarios: visible entity, `hidden_by` user/integration, `disabled_by` user/integration, registry unavailable fallback, legacy `attributes.hidden`, malformed registry entry, unregistered entity, domain filter, invalid domain filter, missing HA client, states fetch failure, sort order.

## [1.2.6] - 2026-03-23

### Fixed
- **Tile icons rendered as raw SVG markup** — `DOM.createElement` passes the third argument as `textContent`, which escapes HTML. All tile components (`light.js`, `switch.js`, `sensor.js`) were passing the SVG string from `FMT.getIcon()` as text, causing the raw `<svg>…` markup to appear as visible text on tiles. Fixed by creating the icon element separately and setting its `innerHTML` to the SVG string, matching the existing correct pattern used in the sidebar.
- **All tile icons showing generic circle** — the `icon` field in stored entity items is always `''`, so `FMT.getIcon('')` fell back to the `circle` MDI icon for every entity. Added a `_DOMAIN_FALLBACK` map in `format.js` and updated `getIcon(iconName, size, entityId)` to infer the icon from the entity's domain when `iconName` is empty (light → bulb, switch → toggle, sensor → thermometer, binary_sensor → circle, alarm → shield).
- **Hidden/disabled HA entities visible in entity picker** — `GET /api/entities` only checked `attributes.hidden`, which is a legacy flag rarely used by modern HA. Entities hidden or disabled via the HA UI (`hidden_by` / `disabled_by` in the entity registry) were still returned. Now cross-references `/api/config/entity_registry` using the same pattern as `handlers_areas.py`. Falls back gracefully to attribute-only filtering if the registry endpoint fails.
- **`switch` tiles missing entity-type class** — `switch.js` built tiles with `'tile state-off'` without the `entity-switch` class needed for semantic CSS selectors, making switch tiles unstyled.

### Added
- **Editable entity display name in Settings** — each entity row in the Overview and Room items lists now has an inline text input for a user-friendly display name. The name is stored as `item.label` in the config and shown as the tile label on the dashboard. When importing entities from a HA area, the `friendly_name` from HA is auto-populated as the initial label.

## [1.2.5] - 2026-03-23

### Fixed
- **Add-on update broken on HA Supervisor** — `docker/build-push-action@v6` enables provenance attestation by default, wrapping images in an OCI image index. HA Supervisor's Docker client requests manifests with the Docker v2 schema Accept header, which ghcr.io cannot match against an OCI index, returning `manifest unknown`. Fixed by setting `provenance: false` in the workflow.

## [1.2.4] - 2026-03-23

### Changed
- **Semantic entity colors** — tile colors now vary by entity type instead of using a single generic green for all "ON" states, inspired by Apple Home visual language:
  - **Lights** (`entity-light`): amber `#FFB700` border, icon, toggle, and background tint when ON
  - **Binary sensor alerts** (`entity-sensor` + `sensor-alert`): orange `#FF6B00` icon and border when a motion/door/window/moisture/smoke/vibration sensor is triggered
  - **Climate fill bar colors** moved to CSS tokens (`--color-temp-fill`, `--color-humidity-fill`) — no more hardcoded hex values in JS
- Added semantic color tokens to `base.css`: `--color-light-on`, `--color-light-on-bg`, `--color-binary-alert`, `--color-temp-fill`, `--color-humidity-fill`

## [1.2.3] - 2026-03-23

### Fixed
- **Empty tile icons in main panel** — `mdi-icons.js` was not included in `index.html`, so `window.RP_MDI` was undefined and all entity tile icons rendered as empty. Added script tag before `format.js`.
- **Area import includes HA-hidden entities** — entities with `hidden_by` or `disabled_by` set in the HA entity registry still appeared in `states` (hidden_by does not suppress state publication) and passed the previous Jinja2 cross-reference filter. `GET /api/ha-areas` now also calls `/api/config/entity_registry` and excludes entities marked hidden or disabled. Falls back gracefully if the registry endpoint is unavailable.
- **`_serialize_item` double-call in panel config endpoint** — each item was serialized twice per list comprehension (once for the filter, once for the value). Fixed using walrus operator.

### Changed
- **MDI icons for room navigation** — sidebar room icons and the rooms list in Settings now use the same MDI SVG icon set as Home Assistant (via `window.RP_MDI`), replacing the previous emoji characters. `mdi-icons.js` is now loaded in both `index.html` and `config.html`. Added `mdi:washing-machine` and `mdi:floor-plan` paths to the icon set. Room icon mapping updated for all 20 room types.
- **Sidebar icon alignment** — `.sidebar-item-icon` and `.room-row-icon` updated to flex-centering so SVG icons align correctly within their containers.

## [1.2.2] - 2026-03-23

### Fixed
- **Per-entity visibility toggle not persisted** — `hidden` field was dropped by `_parse_item()` on save and omitted from `_serialize_item()` on load. Items toggled invisible in Settings reappeared after save. Fixed in backend (save + serialize) and loader dataclass.
- **Entity-registry-hidden devices included in area import** — Jinja2 template now cross-references `area_entities()` against `states` (which excludes disabled/hidden entities from the HA entity registry), replacing the previous `attributes.hidden` attribute-only check.
- **Alarm tile cramped on landscape tablet** — alarm tile now spans full grid width always (`grid-column: 1 / -1`) and uses a two-column layout in landscape orientation (keypad on right, status/PIN/actions on left).

### Added
- **Expanded icon set** — `format.js` adds: sun, battery, lightning, plug, fan, lock, vacuum, camera, bell, blinds, person, computer, heating, cooling, speaker, water. Auto-detection in `loader.py` extended with domains: cover → blinds, fan, lock, vacuum, camera, climate, media_player, person, humidifier; keywords: lock, fan, smoke, vibration, window, blind, plug, socket, presence, occupancy, camera, heating, cooling.
- **More room icons** — added dining, laundry, balcony, gym, attic, entry, server, kids to the room icon picker.

## [1.2.1] - 2026-03-23

### Changed
- Sidebar: Settings icon moved to bottom (icon-only); collapse toggle left-aligned
- Sidebar: Individual rooms replaced by a collapsible "Rooms ›" submenu with back arrow
- Config — Overview: section title now editable (stored as `overview.title` in v3 schema)
- Config — Rooms: reorder arrows (↑↓) per room row; room editor has "Import from area" button
- Config — Items: per-entity visibility toggle (eye icon) hides item in panel without deleting it
- Config — Header sensors: picker is now multi-select (stays open, checkmarks, Done button)

## [1.2.0] - 2026-03-23

### Added
- **Sidebar navigation** — collapsible left sidebar replaces the bottom tab bar. Shows Overview,
  per-room sections, and Scenarios. Settings gear icon at top. Expands (200 px, icon + label)
  or collapses (64 px, icons only) via toggle button. Smooth CSS transition.
- **Overview section** — dedicated home screen for favorite / important devices. Configurable
  from Settings → Overview tab with entity picker and Power Flow Card support.
- **Rooms** — one section per Home Assistant area. Each room has its own entity grid and
  can be hidden from the sidebar individually. Configure entities per room in Settings → Rooms.
- **Scenarios section** — configurable list of HA scenes and scripts. Tap a card to activate.
  Configure from Settings → Scenarios with a searchable scene/script picker.
- **Header sensor chips** — up to 4 mini entity-state chips displayed in the top bar
  (e.g. temperature, garbage collection). Configure from Settings → Header.
- **Import rooms from HA areas** — one-click import of all Home Assistant areas as rooms
  via Jinja2 template API (`GET /api/ha-areas`).
- **v3 entities.json schema** — new layout format:
  `{ "version": 3, "header_sensors": [...], "overview": {"items": [...]}, "rooms": [...], "scenarios": [...] }`.

### Changed
- **Settings page redesigned** — four-tab layout (Overview, Rooms, Scenarios, Header) replaces
  the old page-manager UI. Room editor opens inline with back navigation.
- **Config API v3** — `GET /api/panel-config` returns v3 structure; `POST /api/config` accepts
  `{ overview, rooms, scenarios, header_sensors }`.

### Migration
- **v2 → v3**: first page items become Overview items; additional pages are discarded.
  Rooms/Scenarios/Header start empty — import from HA areas to recreate rooms quickly.
- **v1 → v3**: flat entity list becomes Overview items.

## [1.1.3] - 2026-03-23

### Added
- **Energy card setup wizard** — step-by-step 5-screen wizard guides user through mapping
  each sensor role (Solar, Battery SOC, Battery Power, Grid, Home) with clear descriptions,
  sign conventions (positive = charging/importing), and example entity_id names for popular
  inverters (ZCS Azzurro, SMA, Fronius). Integrated sensor picker 🔍 on each step.
  Breadcrumb step indicator (●●●●●) highlights current and completed steps.

### Fixed
- **WebSocket state updates broken after config save** — `WSProxy._entity_ids` was computed
  once at startup using only `entity`-type items. Newly added entities (and all energy flow
  sensors) silently received no real-time updates until the add-on restarted. Added
  `WSProxy.update_config()` called from `POST /api/config` to refresh the filter immediately.
- **Energy flow sensors excluded from WS filter** — `config.entities` only returned
  entity-type items; energy sensor entity_ids were never subscribed. Fixed via
  `config.all_entity_ids` which includes all 5 energy flow sensor fields.

## [1.1.2] - 2026-03-23

### Added
- **Sensor picker for Power Flow Card** — each sensor role (Solar, Battery SOC/Power,
  Grid, Home) now has a 🔍 button that opens a searchable sensor list instead of
  requiring manual entity_id typing. Shows device_class and unit for easy identification.
  A ✕ button clears the field. Inputs are read-only to prevent typos.
- **Hidden entity filter** — `/api/entities` now skips entities with
  `attributes.hidden == true` (user-hidden via HA YAML or UI). Keeps the picker
  clean by showing only visible, actionable entities.
- `/api/entities?domain=sensor` query parameter — returns only sensor-domain entities,
  used by the energy card sensor picker to avoid showing lights/switches/etc.

## [1.1.1] - 2026-03-23

### Fixed
- **Settings gear icon hidden in kiosk mode** — removed erroneous CSS rule
  `.kiosk #config-link { display: none; }` that was hiding the ⚙ button whenever
  `kiosk_mode: true` (the default). The gear is now always accessible.

## [1.1.0] - 2026-03-23

### Added
- **Multi-page navigation** — bottom tab bar with configurable pages per house area
  (e.g. Casa, Camera da letto, Energia). Add/rename/delete/reorder pages via Settings.
- **Power Flow Card** — fully configurable energy dashboard card showing solar production,
  battery SOC & charge/discharge power, grid import/export, and home consumption.
  Map any HA sensor to each role (works with ZCS Azzurro, SMA, Fronius, etc.).
  Bidirectional arrows update in real-time based on power flow direction.
- **iOS-style pill toggle** — 44×26px slide-to-toggle indicator replaces the old 14px dot
  on light and switch tiles; thumb slides on state change.
- **Climate sensor tiles** — temperature and humidity sensors now display a large 40px value
  with a proportional fill bar (warm orange for temperature, blue for humidity).
- **Live clock** in the panel header (HH:MM, syncs to minute boundary).
- **Orientation-responsive columns** — portrait uses configured columns (2/3/4), landscape
  automatically adds one column (max 4) via CSS media query + JS CSS custom property.

### Changed
- `/data/entities.json` schema upgraded to **v2** (`{ "version": 2, "pages": [...] }`).
  Existing v1 flat arrays are auto-migrated to a single "Home" page on first load.
- `/api/panel-config` now returns a `pages` array instead of a flat `entities` array.
- `/api/config` (POST) now accepts `{ "pages": [...] }` instead of `{ "entities": [...] }`.
- Config page redesigned: page manager with tabs, per-page item list, entity picker modal,
  and energy card configurator with sensor role mapping inputs.
- ON state tile overlay increased from 6% to 10% opacity; OFF opacity reduced from 0.75 to 0.60.

## [1.0.14] - 2026-03-23

### Fixed
- **iPad / WKWebView: panel stuck on loading spinner forever** — converted all
  frontend JS from ES modules (`type="module"` + `import`/`export`) to regular
  ordered `<script>` tags with IIFE-namespaced globals. iOS Safari in the HA
  companion app (WKWebView) silently fails to execute ES module graphs in
  cross-origin iframes, causing `boot()` to never run and the loading screen to
  never disappear. Regular scripts are universally compatible.
- **Config page 502 "Failed to load entities"** — the entity picker now uses
  `ha_client.get_all_entity_states()` instead of the separate `supervisor_client`.
  The main HA client already has the correct authenticated session; a second
  client caused spurious connection failures. The new method also uses a 30 s
  timeout (vs 15 s) to handle large HA instances with many entities.
- **fetch() hanging indefinitely on iOS** — added `AbortController` with 20 s
  timeout to every `apiFetch` call so a hung network request always resolves
  (with an error) instead of blocking the boot sequence forever.
- **Content-Type on GET requests** — removed `Content-Type: application/json`
  header from GET calls; it is semantically incorrect and can trigger unneeded
  CORS preflight in certain iOS Safari / WKWebView contexts.

## [1.0.13] - 2026-03-22

### Fixed
- **Blank page / "connection refused" on iOS Safari (iPad Air 2)**: Removed
  `X-Frame-Options: DENY` and changed CSP `frame-ancestors` from `'none'` to
  the configured HA origin. HA Ingress loads the add-on UI in an `<iframe>` —
  the previous headers were blocking it, causing a blank page on desktop and
  "connection refused" on iOS Safari.
- **Static assets returning 404**: CSS and JS paths in `index.html` and
  `config.html` were relative (`css/base.css`, `js/app.js`) and resolved to
  `/css/…` / `/js/…` which are not served. Changed to `static/css/…` and
  `static/js/…` so they hit the `/static/` route correctly through Ingress.

## [1.0.12] - 2026-03-22

### Fixed
- **Backend no longer crashes on startup** if HA is unreachable — server starts anyway,
  the panel UI is reachable, error shown in tile grid instead of connection refused.
- **Entities removed from HA config schema** — saved in `/data/entities.json` instead of
  `options.json`, so they survive saves from the HA config tab and are never lost.
- Panel shows title + error message instead of blank page if API calls fail.

## [1.0.11] - 2026-03-22

### Fixed
- SUPERVISOR_TOKEN is not a valid HA Core token — route all calls through the
  Supervisor proxy (`http://supervisor/core`) when token is auto-detected.
  Previously the add-on crashed with 401 Unauthorized on startup.
- `ha_url` schema marked optional (`url?`) — auto-set to Supervisor proxy when not configured.

## [1.0.10] - 2026-03-22

### Added
- **Entity picker** web page (`/config`) — gear icon (⚙) in the panel header opens
  a search/filter UI to browse all HA entities and build the entity list visually
- Domain filter pills (Lights, Switches, Sensors, Binary, Alarm) and live text search
- Up/Down reorder and remove buttons for the selected entity list
- Save writes directly via Supervisor API; panel-config reloads in-memory immediately

### Changed
- **Token auto-detection**: `ha_token` is now optional — if left empty the add-on
  automatically uses the `SUPERVISOR_TOKEN` injected by HA Supervisor (`hassio_api: true`)
- **URL auto-detection**: `ha_url` defaults to `http://homeassistant:8123` if left empty
- Empty panel now shows the configured title + a "Open Settings" hint instead of a blank page

## [1.0.9] - 2026-03-22

### Fixed
- Default `ha_url` changed from `http://homeassistant.local:8123` to `http://homeassistant:8123`.
  The `.local` mDNS hostname does not resolve inside Docker add-on containers;
  `homeassistant` is the correct internal hostname set up by HA Supervisor.

## [1.0.8] - 2026-03-22

### Fixed
- **BUG CRITICO**: `entity_id: entity` nel schema causava silent skip dell'add-on da parte di
  HA Supervisor (tipo non supportato) — l'add-on spariva dalla lista degli installabili.
  Ripristinato `entity_id: str`.
- Default `columns` corretto da intero `3` a stringa `"3"` per coerenza con il tipo `list(2|3|4)`.

## [1.0.7] - 2026-03-22

### Fixed
- Restore Documentation tab (DOCS.md updated to reflect entity picker workflow)

### Changed
- No functional changes — version bump to trigger HA update notification

## [1.0.6] - 2026-03-22

### Changed
- **Entity picker in HA config tab**: `entity_id` schema type changed from `str` to `entity`,
  enabling the native Home Assistant entity picker dropdown in the add-on configuration tab
- Removed web-based configuration page (`/config`) and all related backend code
  (`handlers_entities`, `handlers_config_save`, `supervisor_client`)
- Removed `hassio_api: true` — Supervisor API no longer required
- Removed gear icon from panel header (configuration is now done via the HA add-on config tab)

## [1.0.4] - 2026-03-22

### Added
- **Configuration page** (`/config`) — web-based entity picker served by the add-on itself:
  - Browse ALL Home Assistant entities with live search and domain filter pills
  - Select entities with checkboxes; up/down arrows to reorder
  - Edit label and icon for each selected entity
  - Panel settings (title, columns, theme, kiosk mode, refresh interval)
  - Save button writes config via Supervisor API, reloads instantly
- `hassio_api: true` — grants Supervisor token for config save and entity list
- Gear icon (⚙) in panel header links to config page; hidden in kiosk mode
- `SupervisorClient` async proxy for Supervisor API (`get_all_states`, `save_options`)

## [1.0.3] - 2026-03-22

### Fixed
- Remove `init-retropanel` oneshot s6 service: in s6-overlay v3, `up`
  files for oneshot services are executed via execlineb which ignores
  the shebang — `bashio::log.info` was being exec'd as a program name,
  causing exit 127 and preventing the container from starting

## [1.0.2] - 2026-03-22

### Fixed
- Remove `apparmor.txt`: HA Supervisor auto-applies the file even without `apparmor: true`,
  blocking `/init` (s6-overlay entrypoint) and preventing the add-on from starting
- Fix CI pipeline: migrate from deprecated `home-assistant/builder` action to
  `docker/build-push-action@v6`, fix branch trigger (`main` → `master`), add
  `packages: write` permission, update base image to Python 3.12-alpine3.21
- Add `image:` field to config.yaml so Supervisor pulls pre-built image from ghcr.io
  instead of attempting a local build (which always fails on HA OS)
- Remove deprecated/invalid config.yaml fields flagged by addon linter
- Drop deprecated armhf/armv7 architectures (removed in HA 2025.12)
- Add `.gitattributes` to enforce LF line endings on rootfs scripts

## [1.0.1] - 2026-03-22

### Security (post-audit fixes)
- **SEC-001 HIGH**: Replaced wildcard CORS `Access-Control-Allow-Origin: *` with restricted origin matching HA URL
- **SEC-002 HIGH**: Added per-domain service name allowlist (prevents calling `alarm_trigger`, etc.)
- **SEC-003 MEDIUM**: Added security headers middleware: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy`
- **SEC-004 MEDIUM**: Rate limiter dict now bounded to 5000 IPs with LRU eviction (prevents memory exhaustion)
- **SEC-005 MEDIUM**: Internal exception details no longer returned to clients (logged server-side only)
- **SEC-007 MEDIUM**: Added entity_id format validation (regex `^[a-z_]+\.[a-z0-9_]+$`) to prevent path traversal
- **SEC-012 INFO**: Removed unused `pyyaml` dependency (config uses stdlib JSON)
- **SEC-013 INFO**: Added WebSocket Origin header validation against configured HA URL

## [1.0.0] - 2026-03-22

### Added
- Initial release of Retro Panel
- Support for `light`, `switch`, `alarm_control_panel`, `sensor`, `binary_sensor` entities
- Touch-optimized interface compatible with iOS 15 Safari and legacy browsers
- Real-time state updates via Home Assistant WebSocket API (with fan-out to N clients)
- Secure backend proxy: HA token never exposed to browser
- Dark, light, and auto themes
- Kiosk mode (prevents text selection, optimized for always-on)
- Configurable entity grid (2, 3, or 4 columns)
- Fallback REST polling when WebSocket is unavailable
- Rate limiting: 10 service calls/second per client IP
- Italian and English translations
- Multi-arch Docker images: aarch64, amd64, armhf, armv7
- HA Supervisor Ingress integration
