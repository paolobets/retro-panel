# Changelog

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
