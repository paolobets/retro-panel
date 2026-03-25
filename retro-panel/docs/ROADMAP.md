# Retro Panel Roadmap

## Version Strategy

Retro Panel follows semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR** version for breaking changes (config schema incompatible, API changes)
- **MINOR** version for new features (backward compatible)
- **PATCH** version for bug fixes and performance improvements

---

## v1.0 - Foundation (Released)

**Status**: Released

**Release Goal**: Create a lightweight, stable home automation control panel that works on legacy devices no longer receiving OS updates, requires minimal resources, and provides a solid foundation for future extensions.

### Features Included

**Core Functionality**:
- Lightweight HTTP server (Python + aiohttp)
- Home Assistant Ingress integration
- WebSocket proxy for real-time state updates
- Service call API with whitelist validation
- Responsive layout (mobile-first design)

**Supported Entity Types**:
- **Light** (`light.*`) - turn on/off, toggle, brightness slider
- **Switch** (`switch.*`) - turn on/off, toggle
- **Sensor** (`sensor.*`) - read-only state display with units
- **Binary Sensor** (`binary_sensor.*`) - on/off status indicator

**Configuration**:
- YAML-based options schema
- Flexible panel layout (rows, columns, sizing)
- Service whitelist for security
- Entity customization (name override, icon, visibility)
- Layout customization (tile size, spacing, state label positions)

**Browser Support**:
- legacy devices no longer receiving OS updates Safari
- Legacy devices (iOS 12+)
- Desktop Chrome/Firefox (modern versions)
- Android Chrome
- Fully responsive design
- Touch-optimized UI

**Performance**:
- ~15 KB total JavaScript (uncompressed)
- ~20 KB total CSS (uncompressed)
- ~50 MB RSS memory footprint
- <2 second page load time on 4G
- ~100 messages/second WebSocket throughput

**Security**:
- Token isolation (server-side only)
- Ingress proxy authentication
- Service call whitelist enforcement
- Service data validation
- No direct HA credential exposure

### Definition of Done Criteria (v1.0)

- [ ] All entity types render correctly on legacy mobile Safari
- [ ] WebSocket reconnects automatically without user intervention
- [ ] Service calls succeed with <1 second latency on local network
- [ ] Configuration loads without errors for typical 20-50 entity panels
- [ ] Documentation complete (architecture, API, development, user guide)
- [ ] No console errors in browser dev tools
- [ ] Page load time <2 seconds on 4G network
- [ ] Responsive layout works on 320px width (iPhone SE)
- [ ] Unit tests pass (70%+ coverage on HAClient, API handlers)
- [ ] Tested on real Home Assistant instance with 50+ entities
- [ ] Add-on passes HA's official add-on linting
- [ ] Release notes document all features, known issues, breaking changes

### Known Limitations (v1.0)

- **No Camera Support**: MJPEG streams not supported (planned v1.5)
- **No Climate Control**: Thermostat entities not supported (planned v2.0)
- **No Media Playback**: Media player entities not supported (planned v2.0)
- **Single Panel Only**: Multiple dashboards/pages not supported (planned v1.5)
- **No Authentication**: Relies entirely on HA Ingress authentication
- **No Themes**: Only default light/dark colors (planned v2.0)
- **No History**: No entity state history or charts (planned v2.0)
- **No Automation Triggers**: Cannot create automations (out of scope for this tool)
- **No Custom Entities**: Cannot display custom entity domains (planned future)
- **No Offline Fallback**: Requires internet connection, no local cache (planned future)

---

## v1.4 - Room Sections (Released)

**Status**: Released

**Release Goal**: Introduce room sections for better content organization within rooms, auto-fill configuration grid from entity selection, and enhance the configuration editor UI.

### Completed Features

#### Room Sections Support
- Rooms now contain `sections: [{id, title, items:[]}]` instead of direct `items[]`
- Each section groups related items with a title
- Sections provide visual organization hierarchy
- Sections have unique IDs for targeting and identification
- Backward compatible: v3 rooms with `items[]` auto-migrate to a default section on first load

**Schema Changes**:
- Config version bumped to 4
- Room structure: `rooms[].sections[]` replaces `rooms[].items[]`
- Migration: v3 configs auto-converted to v4 transparently

**Implementation Files**:
- `app/config_loader.py` - v3→v4 auto-migration logic
- `frontend/js/config-page.js` - Section UI in config editor
- `docs/ARCHITECTURE.md` - Data model documentation

#### Auto-Fill Configuration Grid
- Config editor now auto-fills available entities from HA entity registry
- Entity picker displays available light, switch, sensor, binary_sensor, climate, cover entities
- Entities hidden or disabled in HA are automatically excluded
- Search/filter available entities
- Select and add entities to sections with one click

**Implementation Files**:
- `app/handlers/panel_config.py` - GET /api/entities endpoint
- `frontend/js/config-page.js` - Entity picker UI component

#### Two-Column Configuration Editor
- Configuration editor redesigned with two-column layout
- Left column: Room/section tree navigator
- Right column: Section item editor
- Drag-and-drop support for reordering items within sections
- Section title inline editor
- Delete sections/items with visual confirmation

**Implementation Files**:
- `frontend/css/config.css` - Two-column layout styles
- `frontend/js/config-page.js` - Editor logic and UX

#### "Retro PANEL" Title
- New title display showing "Retro PANEL" in header
- Custom branding and visual identity
- Consistent across all views
- Retro aesthetic emphasizing panel concept

**Implementation Files**:
- `frontend/index.html` - Title markup
- `frontend/css/layout.css` - Title styling

### v1.4 Definition of Done (COMPLETED)

- [x] Room sections schema implemented (v4 format)
- [x] v3 to v4 auto-migration transparent to users
- [x] Config editor shows two-column layout
- [x] Left panel: room/section tree navigator
- [x] Right panel: item editor with drag-drop reorder
- [x] Auto-fill from entity picker (excludes hidden/disabled)
- [x] Section inline title editor
- [x] "Retro PANEL" title displayed
- [x] All tested on legacy mobile Safari (WebKit)
- [x] Backward compatibility: v1.0-v1.3 configs still work
- [x] Documentation updated with v4 schema
- [x] Release notes document migration path
- [x] Configuration file migration tested

---

## v1.5 - Extension (Current Release)

**Release Goal**: Add commonly-requested entity types, multiple page support, and advanced controls.

**Timeline**: ~8 weeks after v1.0

### Completed Features

#### Light Component Advanced Controls
- Long-press (500ms+) opens bottom sheet modal for detailed control
- Short tap toggles on/off immediately
- Dynamic color tinting via `.light-tint` overlay div
- RGB color support (converted to hex for visual feedback)
- Color temperature support (mireds converted to Kelvin)
- Brightness display as percentage (0-100%)
- Brightness slider (1-255) in bottom sheet
- Color temperature slider (153-500 mireds) in bottom sheet
- Hue slider (0-360°) with 8 color swatch presets in bottom sheet
- Feature-gated controls via `supported_features` bitmask:
  - Bit 1 (BRIGHTNESS): enables brightness slider
  - Bit 2 (COLOR_TEMP): enables color temperature slider
  - Bit 16 (COLOR): enables hue and color swatches
- Live tile color updates while adjusting
- Debounced service calls (300ms) to prevent flooding HA
- Bottom sheet singleton pattern (`window.RP_LightSheet`)
- Lazy DOM construction on first open

**Implementation Files**:
- `app/static/js/components/light.js` - Tile + long-press handler
- `app/static/js/components/light-sheet.js` - Global singleton modal
- `app/static/css/components.css` - `.light-tint`, bottom sheet styles

#### Switch Component Styling Enhancements
- Consistent 120px tile size with light component
- Green theme (`#4caf50`) when ON with inline styles
- `.light-tint` overlay div with green rgba background
- Dynamic color tinting for visual feedback
- No "On/Off" text in tile (empty tile-value)
- Short tap toggles on/off
- iOS 12+ compatible IIFE pattern

**Implementation Files**:
- `app/static/js/components/switch.js` - Enhanced styling and interaction

### New Features

#### Multiple Pages/Panels with Swipe Navigation
- Multiple named panels in config (e.g., "Living Room", "Bedroom", "Kitchen")
- Swipe left/right to navigate between panels
- Indicator dots showing current panel
- Persist current panel in localStorage

**Config Example**:
```json
{
  "panels": [
    {"name": "Living Room", "rows": [...]},
    {"name": "Bedroom", "rows": [...]},
    {"name": "Kitchen", "rows": [...]}
  ]
}
```

**Implementation**:
- Add `swipe.js` module for touch gesture detection
- Modify `app.js` to render multiple panel containers
- CSS transitions for smooth panel swiping
- Update state.js to track current active panel

#### Cover Entity Support
- Garage doors, blinds, window covers
- Open/Close/Stop buttons
- Position slider for variable-position covers
- State display (opening, closing, open, closed)

**Service Calls Supported**:
- `cover/open_cover`
- `cover/close_cover`
- `cover/stop_cover`
- `cover/set_cover_position`

**Component**: `frontend/js/components/cover.js`

#### Input Boolean Entity Support
- Toggle controls for input_boolean entities
- User-friendly switching interface
- Confirmation dialogs (configurable)

**Service Calls Supported**:
- `input_boolean/turn_on`
- `input_boolean/turn_off`
- `input_boolean/toggle`

**Component**: `frontend/js/components/input_boolean.js`

#### Input Select Entity Support
- Dropdown or button group for selecting options
- Display current selection
- Scroll through options on small screens

**Service Calls Supported**:
- `input_select/select_option`

**Component**: `frontend/js/components/input_select.js`

#### Auto-Layout (No Manual Row/Col Config)
- Auto-arrange entities in a responsive grid
- Configurable columns per row (default: 2 columns on mobile, 4 on desktop)
- No need to manually define rows and columns

**Config Example** (simplified):
```json
{
  "panel": {
    "name": "Quick Access",
    "entities": ["light.bedroom", "light.living_room", "switch.fan"],
    "columns": 2
  }
}
```

**Implementation**:
- New layout engine in CSS Grid
- Calculate tiles based on `columns` config and screen size
- Backward compatible with existing row/col format

#### Wake Lock API Attempt
- Keep device screen on while Retro Panel is open
- Request wake lock when app loads
- Release on page unload
- Graceful fallback if not supported

**Implementation**:
```javascript
if (navigator.wakeLock) {
  navigator.wakeLock.request('screen').catch(() => {
    // Fallback: device will lock normally
  });
}
```

#### Camera MJPEG Proxy
- Stream MJPEG from camera entities
- Lightweight image proxy in Python backend
- Display camera snapshot in panel
- Optional fullscreen view

**Implementation**:
- `app/handlers/camera_proxy.py` - HTTP proxy for MJPEG streams
- `frontend/js/components/camera.js` - Image tile component
- Authentication forwarded to HA
- Stream URL: `GET /api/proxy/camera/{entity_id}`

### API Changes (Backward Compatible)

**Configuration Schema v1.5**:
- Existing `rows`/`cols` format still supported
- New `entities` list with `columns` auto-layout option
- New `camera` entity type section

**Entity Config Additions**:
- Cover: `supported_features` hint for UI
- Input Boolean: `confirm_before_action` boolean
- Input Select: `option_buttons` boolean (show as buttons vs dropdown)

### Version 1.5 Definition of Done

**Light & Switch Component Enhancements** (COMPLETED):
- [x] Light component long-press opens bottom sheet modal
- [x] Light component supports RGB color tinting
- [x] Light component supports color temperature (mireds → Kelvin)
- [x] Light component brightness slider in bottom sheet (1-255 → percentage)
- [x] Light component hue slider with 8 color presets
- [x] Light component feature-gated controls via `supported_features` bitmask
- [x] Light component live tile updates while adjusting
- [x] Light component debounced service calls (300ms)
- [x] Switch component green theme when ON (#4caf50)
- [x] Switch and light use `.light-tint` overlay for smooth transitions
- [x] All tested on legacy mobile Safari (WebKit)
- [x] No optional chaining or nullish coalescing (iOS 12+ safe)

**Remaining Features**:
- [ ] Multiple Pages/Panels with Swipe Navigation
- [ ] Cover Entity Support (garage doors, blinds)
- [ ] Input Boolean Entity Support
- [ ] Input Select Entity Support
- [ ] Auto-Layout (no manual row/col config)
- [ ] Wake Lock API
- [ ] Camera MJPEG Proxy
- [ ] All new entity types tested on legacy mobile Safari (WebKit)
- [ ] Swipe navigation works smoothly (60 FPS animations)
- [ ] Multiple panels load without lag
- [ ] Camera MJPEG proxy handles 500 Kbps streams without buffering
- [ ] Auto-layout produces responsive grid on all screen sizes
- [ ] Wake Lock API attempt succeeds or fails gracefully
- [ ] Backward compatibility: all v1.0 configs work unchanged
- [ ] Documentation updated with new entity types and examples
- [ ] Unit tests added for new components (60%+ coverage)
- [ ] Performance: no regression from v1.0

---

## v2.0 - Advanced (Future Release)

**Release Goal**: Add climate control, media player support, persistence, and visual polish with automation and theming.

**Timeline**: 12+ weeks after v1.5

### New Features

#### Climate Entity (Thermostat)
- Temperature display with target setter
- Mode selector (heat, cool, auto, off)
- Humidity display
- Setpoint slider or +/- buttons
- Away mode support

**Service Calls**:
- `climate/set_temperature`
- `climate/set_hvac_mode`
- `climate/set_fan_mode`

**Component**: `frontend/js/components/climate.js`

#### Media Player Entity
- Play/pause/stop controls
- Volume slider
- Track display (title, artist, album)
- Input source selector
- Shuffle/repeat toggle

**Service Calls**:
- `media_player/media_play`
- `media_player/media_pause`
- `media_player/media_stop`
- `media_player/volume_set`
- `media_player/select_source`
- `media_player/toggle_shuffle`

**Component**: `frontend/js/components/media_player.js`

#### Panel PIN Lock
- Optional 4-digit PIN protection for panel
- SQLite database for PIN storage (encrypted)
- Customizable lock timeout
- Lock on page load or after inactivity

**Backend**:
- `app/database.py` - SQLite integration
- `app/handlers/auth.py` - PIN validation endpoint
- `POST /api/auth/unlock` - Unlock with PIN

**Frontend**:
- `frontend/js/components/lock_screen.js` - PIN entry UI
- `frontend/js/security.js` - Lock/unlock state management

#### History Sparklines
- Inline SVG sparklines showing entity state history
- Last 24 hours of state data
- Hover tooltip with state values
- Visual trend indicator (up/down)

**Backend**:
- `GET /api/history/{entity_id}?hours=24` - Fetch history
- Store last 1000 data points per entity in memory

**Frontend**:
- `frontend/js/sparkline.js` - SVG rendering
- Component update includes sparkline rendering

#### Dark/Light Auto-Switch from sun.sun Entity
- Check `sun.sun` entity state on load
- Switch theme based on sunrise/sunset
- Sync with system settings (prefers-color-scheme)
- Manual override option (saved to localStorage)

**Implementation**:
- New CSS theme variables file
- `frontend/js/theme.js` - Theme manager
- Watch for sun state changes via WebSocket
- Update CSS variables dynamically

#### GitHub Actions CI/CD - Multi-Arch Docker Builds
- Automated Docker builds on push to main branch
- Build for multiple architectures: amd64, arm64, armv7
- Push to GitHub Container Registry (ghcr.io)
- Automated version tagging

**.github/workflows/build.yml**:
```yaml
on:
  push:
    branches: [main]
    tags: [v*]
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        platform: [linux/amd64, linux/arm64, linux/arm/v7]
    steps:
      - uses: actions/checkout@v3
      - uses: docker/setup-buildx-action@v2
      - uses: docker/build-push-action@v4
        with:
          context: ./addon
          platforms: ${{ matrix.platform }}
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

### API Changes (Backward Compatible)

**New Endpoints**:
- `GET /api/history/{entity_id}` - Entity history
- `POST /api/auth/unlock` - PIN unlock
- `GET /api/theme` - Current theme preference
- `POST /api/theme` - Set theme preference

**Configuration Schema Additions**:
- `pin_enabled` (boolean)
- `pin_timeout_minutes` (integer)
- `theme` ("auto", "light", "dark")
- `history_enabled` (boolean)

### Version 2.0 Definition of Done

- [ ] Climate control works with real thermostat in HA
- [ ] Media player displays metadata and controls
- [ ] PIN lock prevents unauthorized access (PIN in secure storage)
- [ ] Sparklines render performantly (< 50ms per chart)
- [ ] Theme switching instant without flicker
- [ ] GitHub Actions builds successfully for all architectures
- [ ] All v1.5 features still work (backward compatible)
- [ ] Documentation complete with new features
- [ ] Performance benchmarks meet targets:
  - Page load: < 2s
  - Service call response: < 1s
  - WebSocket message delivery: < 100ms
  - Memory usage: < 150 MB RSS
- [ ] Unit tests: 70%+ code coverage
- [ ] Integration tests with real HA instance
- [ ] Public release on Home Assistant add-on registry

---

## Future Considerations (Post v2.0)

### Multi-Home Assistant Instance Support
- Connect to multiple HA instances
- Unified dashboard across homes
- Instance selector in UI
- Per-instance configuration

### Custom Themes via Config
- Define custom color palettes in options.json
- Theme preset library
- Brand color customization
- Font family selection

### Plugin System for Custom Entity Types
- Allow developers to create custom components
- Load plugins from URLs or local files
- Component SDK with standard interface
- Community plugin registry

### Voice Control Integration
- WebSpeech API for voice commands
- Natural language understanding
- "Turn on living room light"
- Offline voice recognition (future)

### Advanced Automation Builder
- Create simple automations through UI
- Trigger on time, state change, etc.
- Actions: turn on/off, set brightness, etc.
- Save to Home Assistant automations

### Offline Support with Service Workers
- Cache app shell
- Offline state display (last known state)
- Queue service calls for replay when online
- Progressive Web App (PWA) install

### Gesture-Based Controls
- Swipe up/down for brightness
- Double-tap for favorite state
- Long-press for advanced options
- Custom gesture mapping

### Analytics and Usage Tracking
- Track which entities are most used
- Device and browser statistics
- Feature usage heatmaps
- Privacy-respecting telemetry (opt-in)

### Accessibility Improvements
- Keyboard navigation support
- Screen reader optimizations
- WCAG AA compliance audit
- High contrast mode

### Machine Learning Integration
- Predict user actions (ML model on device)
- Smart suggestions
- Automations based on patterns
- Privacy-first approach (no cloud)

---

## Performance Targets

| Metric | Target | v1.0 Status | v1.5 Target | v2.0 Target |
|--------|--------|-------------|-------------|-------------|
| Page Load Time | < 2s | ~1.5s | ~1.5s | < 2s |
| Service Call Latency | < 1s | ~300ms | < 500ms | < 500ms |
| WebSocket Message Delay | < 100ms | ~50ms | < 100ms | < 100ms |
| Memory Footprint | < 150 MB | ~80 MB | ~100 MB | < 150 MB |
| Bundle Size (JS) | < 50 KB | ~15 KB | ~25 KB | < 40 KB |
| Bundle Size (CSS) | < 30 KB | ~20 KB | ~25 KB | < 30 KB |

## Release Schedule

- **v1.0**: 2026 Q2 (Released)
- **v1.4**: 2026 Q2 (Released)
- **v1.5**: 2026 Q3 (In Development)
- **v2.0**: 2026 Q4 / 2027 Q1 (Planning)
- **Future**: Ongoing based on community feedback

## Breaking Changes Policy

Retro Panel commits to:
1. **Major versions only**: Breaking changes only in MAJOR version bumps
2. **Migration guides**: Every breaking change includes a migration guide in release notes
3. **Deprecation warnings**: Features marked for removal get one minor version of warnings
4. **Config validation**: Helpful error messages for old config formats
5. **Backward compatibility window**: Support previous major version for 2 releases

**Example**:
- v1.0 introduces feature X
- v1.5 adds new feature Y (compatible)
- v2.0 removes feature X (MAJOR change) with migration guide

---

**Document Version**: 1.2
**Last Updated**: 2026-03-24
**Maintainer**: Retro Panel Team

**Recent Updates (v1.2)**:
- Added v1.4 section as Released
- Documented Room Sections feature (v4 schema with sections[])
- Documented auto-migration from v3 to v4 (items[] → default section)
- Documented Auto-Fill Configuration Grid (entity picker from HA registry)
- Documented Two-Column Configuration Editor (left: tree, right: editor)
- Documented "Retro PANEL" title branding
- Updated v1.4 Definition of Done - all items completed
- Updated Release Schedule to show v1.0 and v1.4 as Released
- v1.5 now listed as In Development
