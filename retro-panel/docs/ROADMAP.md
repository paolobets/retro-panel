# Retro Panel Roadmap

## Version Strategy

Retro Panel follows semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR** version for breaking changes (config schema incompatible, API changes)
- **MINOR** version for new features (backward compatible)
- **PATCH** version for bug fixes and performance improvements

---

## v2.0 - Complete Refactor (Released 2026-03-27)

**Status**: RELEASED

**Release Goal**: Complete frontend/backend refactor with layout_type system, bottom sheet controls, and two-URL architecture. Focus on clean separation between kiosk dashboard and admin configuration.

### Completed Features

**Core Refactor**:
- [x] layout_type system: Backend computes entity type, frontend renders via COMPONENT_MAP
- [x] Two-URL architecture: `/` (dashboard) and `/config` (admin interface)
- [x] Bottom sheet for light controls (brightness, color temperature, hue)
- [x] CSS redesign: tokens.css, layout.css, tiles.css, bottom-sheet.css
- [x] Triple-lock tile dimensions (immutable heights)
- [x] iOS 12 CSS constraints (no gap/inset/100dvh)
- [x] Data structure v2: overview, rooms, scenarios, cameras

**Entity Type Support (15 layout_types)**:
- [x] `light` — toggle, bottom sheet controls
- [x] `switch` — toggle on/off
- [x] `sensor_temperature` — read-only temperature
- [x] `sensor_humidity` — read-only humidity
- [x] `sensor_co2` — read-only CO₂
- [x] `sensor_battery` — read-only battery %
- [x] `sensor_energy` — read-only power/energy
- [x] `sensor_generic` — read-only generic sensor
- [x] `binary_door` — door/window status
- [x] `binary_motion` — motion detector
- [x] `binary_standard` — generic binary sensor
- [x] `alarm` — PIN keypad with arm/disarm
- [x] `camera` — MJPEG live stream
- [x] `scenario` — scene/script/automation trigger
- [x] `energy_flow` — power flow visualization

**Configuration Tabs (4 total)**:
- [x] Overview — entities on home screen
- [x] Rooms — room-based organization with sections
- [x] Scenarios — scene/script/automation shortcuts
- [x] Cameras — camera feed management
- [x] Removed: "Header" tab (no longer exists)

**Breaking Changes**:
- [x] `columns` config option removed (CSS media queries)
- [x] `header_sensors` removed entirely
- [x] `display_mode` field removed from entity config
- [x] `light-sheet.js` replaced by `bottom-sheet.js`
- [x] CSS state classes: `state-on/off/unavailable` → `is-on/is-off/is-unavail`
- [x] Tile classes: `tile entity-light` → `tile tile-light`
- [x] Config format version bumped to 2

**Testing**:
- [x] 22 unit tests all passing
- [x] iOS 12 compatibility verified
- [x] REST polling fallback tested
- [x] WebSocket reconnection tested
- [x] Manual functional testing on real devices

**Documentation**:
- [x] DOCS.md updated (user guide)
- [x] README.md updated (documentation index)
- [x] ARCHITECTURE.md updated (v2.0 design)
- [x] API.md updated (v2.0 endpoints)
- [x] DEVELOPMENT.md updated (layout_type system)
- [x] PROJECT.md updated (v2.0 status)
- [x] INSTALLATION.md updated (two URLs)
- [x] TESTING.md updated (v2.0 test plan)

### v2.0 Definition of Done (COMPLETED)

- [x] All 15 entity layout_types implemented and tested
- [x] Bottom sheet for light control working
- [x] Two-URL architecture functional (`/` and `/config`)
- [x] Configuration tabs: Overview, Rooms, Scenarios, Cameras
- [x] Triple-lock tile dimensions immutable
- [x] iOS 12 CSS constraints enforced (no gap/inset/100dvh)
- [x] All breaking changes documented
- [x] Migration guide provided for v1.x users
- [x] 22 unit tests passing
- [x] Zero console errors on iOS 12+
- [x] Page load < 2 seconds on 4G
- [x] Service calls < 1 second latency
- [x] Memory < 100 MB on Pi 3B+
- [x] Configuration file migrated to v2 format
- [x] Release notes document all changes

### Known Limitations (v2.0)

- **No Climate Control**: Thermostat entities not yet supported (v2.1+)
- **No Media Playback**: Media player entities not supported (v2.1+)
- **No Custom Themes**: Only default light/dark colors (future)
- **No History Charts**: No entity state history or charts (future)
- **No Offline Mode**: Requires internet connection (future)

---

## v2.7 - Theme Fix & Kiosk Cleanup (Released 2026-03-30)

**Status**: RELEASED (current stable: v2.7.0)

**Release Goal**: Fix `theme: auto` CSS, remove the non-functional `kiosk_mode` option, and document the HACS kiosk-mode integration.

### Completed Features

- [x] `theme: auto` — aggiunto `@media (prefers-color-scheme: light)` in `tokens.css`; ora segue la preferenza OS
- [x] Rimossa opzione `kiosk_mode` da config, backend, API e frontend
- [x] Documentazione: guida kiosk-mode (HACS) aggiunta in DOCS.md e INSTALLATION.md

---

## v2.6 - Binary Sensor Improvements & Kiosk UX (Released 2026-03-30)

**Status**: RELEASED

**Release Goal**: Fix architectural bugs in the binary sensor subsystem, add four new binary layout types, and introduce a long-press reload gesture for kiosk deployments.

### Completed Features

**v2.6.0 — Binary Sensor Improvements**:
- [x] `loader.py` is now the single source of truth for `layout_type` — `sensor.js` no longer reads `attrs.device_class` in the render path
- [x] Bug fix: `window` → `binary_window` (was incorrectly `binary_door`)
- [x] Bug fix: `occupancy`/`presence` → `binary_presence` (was `binary_motion`)
- [x] Bug fix: `smoke`/`gas`/`carbon_monoxide` → `binary_smoke` (was `binary_standard`)
- [x] New: `binary_smoke` layout type — critical visual state (`srt-critical`/`sri-critical`)
- [x] New: `binary_moisture` layout type — alert state
- [x] New: `binary_lock` layout type — alert state
- [x] New: `binary_vibration` layout type — alert state
- [x] 15 TDD tests covering all binary sensor mappings

**v2.6.1 — Long-press Reload Gesture**:
- [x] 800ms long-press on `#panel-title` triggers hard reload via `?_r=<timestamp>` cache-buster
- [x] Touch (iOS) + mouse (desktop) support, opacity feedback, drift cancellation
- [x] `touchcancel` guard for WebKit scroll hand-off edge case
- [x] Duplicate listener guard via `dataset.reloadGestureInit`
- [x] `-webkit-user-select: none` on `#panel-title` to prevent text selection

---

## v2.3 - Icon System, Light Subtypes & Stability (Released 2026-03-29)

**Status**: RELEASED

**Release Goal**: Complete MDI icon set, light layout subtypes, area-fallback for device-level areas, and CI pipeline hardening. Followed by a focused bugfix pass (v2.3.2).

### Completed Features

- [x] Full MDI icon set (~7 447 icons) via `@mdi/js` — replaces previous 124-icon subset
- [x] Icon picker rewritten: virtual scroll, recently-used row, debounced search, result count
- [x] Light layout subtypes: `light_standard`, `light_dimmer`, `light_rgb`, `light_legacy`
- [x] Mode-aware tile and bottom sheet variant per light subtype
- [x] `picker_areas`: area resolved at device level when entity has no direct area assignment
- [x] Switch default icon changed to `power` (⏻)
- [x] Cache-buster `?v=231` on all static assets in `config.html`
- [x] CI: `scripts/check_release.sh` + `.githooks/pre-push` hook
- [x] Bug audit: critical/high severity fixes — backend, drag listeners, CSS layout (v2.3.2)
- [x] Cloudflare tag handling corrected in release pipeline (v2.3.2)

---

## v2.1 - Extended Entity Support (Released 2026-03-28)

**Status**: RELEASED

**Release Goal**: Add support for additional entity types and advanced features.

### Completed Features

- [x] Atomic write for `entities.json` (no corruption on container restart during save)
- [x] Camera `refresh_interval` validation — non-numeric value falls back to 10 s
- [x] Entity ID validation regex accepts digits in domain part
- [x] Section count limits enforced on save (HTTP 400 if exceeded)
- [x] v4 `overview.items[]` migration to default section on config page open
- [x] ES2017-compatible equivalents replace optional chaining / nullish coalescing in `config.js`
- [x] Orphaned drag event listeners cleaned up on list re-render
- [x] `#disconnect-banner` moved outside `#panel` flex container (correct full-width on iOS Safari)
- [x] Touch targets for `.bs-close` and `#sidebar-toggle` increased to 44×44 px (Apple HIG)

**Timeline**: Released 2026-03-28

---

## v3.0+ (Long-term Vision)

**Planned Features**:
- [ ] Plugin system for custom entity types
- [ ] Theme customization UI
- [ ] Offline-first design with local cache
- [ ] Multi-user access control
- [ ] Entity history and charts
- [ ] Custom automations and scenes
- [ ] Voice control integration
- [ ] Mobile app (native iOS/Android)

---

## Performance Targets (All Versions)

These targets apply to v2.0 and all future releases:

**Page Load Time**:
- < 2 seconds on 4G (1 Mbps)
- < 500 ms on WiFi (10 Mbps)
- < 100 ms on LAN (100 Mbps)

**Service Call Latency**:
- < 500 ms local network
- < 2 seconds on 4G

**Memory Usage**:
- < 100 MB RSS on Pi 3B+ (v2.0)
- < 50 MB frontend assets

**Bundle Size**:
- < 20 KB JavaScript (uncompressed)
- < 25 KB CSS (uncompressed)
- No external dependencies for frontend

---

## Breaking Changes Policy

**Policy**: Breaking changes only in MAJOR versions (v1→v2, v2→v3, etc.)

**For Breaking Changes**:
1. Document thoroughly in BREAKING_CHANGES.md
2. Provide migration guide with examples
3. Auto-migrate old config format if possible
4. Announce 1-2 releases ahead of time
5. Support old format for at least 1 release

**Example**: v2.0 config migration
- v1.4 format: `rooms[].items[]` (deprecated)
- v2.0 format: `rooms[].sections[].items[]` (new)
- Auto-migration: On first load, v1.4 configs converted to v2.0

---

## Release Schedule

| Version | Status | Release Date | Timeline |
|---------|--------|-------------|----------|
| v2.0 | Released | 2026-03-27 | Completed |
| v2.1 | Released | 2026-03-28 | Completed |
| v2.2 | Released | 2026-03-28 | Completed |
| v2.3.0 | Released | 2026-03-28 | Completed |
| v2.3.1 | Released | 2026-03-28 | Completed |
| v2.3.2 | Released | 2026-03-29 | Completed |
| v2.6.0 | Released | 2026-03-30 | Completed |
| v2.6.1 | Released | 2026-03-30 | Completed |
| v2.7.0 | Released | 2026-03-30 | Completed — current stable |
| v3.0 | Planned | TBD | 2026 H2 (estimated) |

---

## Completed Releases (Historical)

### v1.0 - Foundation (Released)
- Core light, switch, sensor, binary_sensor support
- Basic WebSocket and REST API
- Simple grid layout

### v1.4 - Room Sections (Released)
- Room sections for organization
- Config editor UI redesign
- Entity picker with auto-fill
- Migration from v1.3 to v4 schema

### v1.5 - Extension (Released)
- Advanced light controls (brightness, color temp)
- Multiple pages/panels support
- Cover and Input Boolean entities
- Wake Lock API

---

**Document Version**: 2.3.2
**Last Updated**: 2026-03-29
**Maintainer**: Retro Panel Team
