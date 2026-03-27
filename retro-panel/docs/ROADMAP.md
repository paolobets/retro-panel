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

## v2.1 - Extended Entity Support (Future)

**Release Goal**: Add support for additional entity types and advanced features.

**Planned Features**:
- [ ] Climate entity support (thermostats)
- [ ] Cover entity support (blinds/doors)
- [ ] Input select entity support
- [ ] Input datetime entity support
- [ ] Extended device class support
- [ ] Improved error handling and user feedback
- [ ] Performance optimizations
- [ ] Additional customization options

**Timeline**: TBD (after v2.0 release stabilizes)

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
| v2.1 | Planned | TBD | After v2.0 stabilizes |
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

**Document Version**: 2.0
**Last Updated**: 2026-03-27
**Maintainer**: Retro Panel Team
