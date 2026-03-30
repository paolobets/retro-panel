# Retro Panel v2.0 Architecture

## Project Overview

Retro Panel v2.0 is a Home Assistant Add-on providing a touch-optimized kiosk dashboard for wall-mounted tablets (primarily iPad with iOS 12+ WKWebView). It separates the dashboard (read-only, `/`) from the config admin UI (`/config`).

The architecture is built around a **layout_type system** where the backend computes a fully self-describing type for every entity, eliminating the need for domain inference on the frontend. This enables clean separation of concerns: the backend handles Home Assistant integration and entity classification, while the frontend focuses on rendering and interaction.

## Technology Stack

### Backend: Python 3.11 + aiohttp

The backend is a lightweight async HTTP server providing:

- **Main server**: `app/server.py` — aiohttp server initialization and route registration
- **Home Assistant client**: `app/proxy/ha_client.py` — HA REST API client for entity states and service calls
- **WebSocket bridge**: `app/proxy/ws_proxy.py` — bi-directional WebSocket proxy between browser and HA
- **Supervisor integration**: `app/proxy/supervisor_client.py` — HA Supervisor token fetching for secure authentication
- **Config endpoints**:
  - `app/api/handlers_config.py` — GET `/api/panel-config` (returns computed layout_type for all entities)
  - `app/api/handlers_config_save.py` — POST `/api/config` (saves user configuration)
- **Entity endpoints**:
  - `app/api/handlers_entities.py` — GET `/api/entities` (domain filtering support)
  - `app/api/handlers_areas.py` — GET `/api/ha-areas` (Home Assistant area structure)
  - `app/api/handlers_cameras.py` — GET `/api/cameras` (camera listing with refresh_interval)
- **State endpoints**:
  - `app/api/handlers_state.py` — GET `/api/states` (current entity states)
- **Service endpoints**:
  - `app/api/handlers_service.py` — POST `/api/services/{domain}/{service}` (service call routing)
- **Configuration loading**: `app/config/loader.py` — loads `panel_config.json` and computes `layout_type` for every entity
- **Validation**: `app/config/validator.py` — validates configuration schema against defined rules

### Frontend: Vanilla JavaScript (iOS 12 WKWebView Safe)

**Zero transpilation policy**: The codebase uses only ES5 features compatible with iOS 12 WKWebView:
- Only `var` declarations (no `const`, `let`)
- Only `function` keyword (no arrow functions `=>`)
- No optional chaining `?.` or nullish coalescing `??`
- No module syntax (`import`/`export`)
- IIFE pattern for scoping: `(function() { 'use strict'; ... }())`
- No `async`/`await` in component files

**No frameworks, no bundlers**: All code is hand-written vanilla JavaScript with explicit global namespace usage.

Two pages:
- `index.html` — Dashboard (read-only kiosk for end users)
- `config.html` — Admin configuration UI (for setup/customization)

### CSS: Vanilla CSS with Design System

**Design tokens**: `app/static/css/tokens.css` defines CSS custom properties:
- Color palette: `--c-bg`, `--c-surface`, `--c-accent`, `--c-text-primary`, `--c-text-secondary`
- Dimensions: `--radius`, `--sidebar-w` (200px), `--header-h` (56px)
- Spacing: `--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`

**Layout system**:
- `app/static/css/layout.css` — sidebar (200px), header (56px), content area, `.hidden` utility
- `app/static/css/tiles.css` — triple-lock tile dimensions, `.tile-row` / `.tile-col-*` flexbox columns, sensor styles, component-specific styles
- `app/static/css/bottom-sheet.css` — overlay + sheet slide-up animation for light controls
- `app/static/css/config.css` — configuration admin UI exclusive styles

**iOS 12 CSS constraints**:
- No `gap:` on `display:flex` (OK on `display:grid`)
- No `inset:` shorthand (use `top`/`right`/`bottom`/`left` individually)
- No `100dvh` dynamic viewport (use `100vh` instead)
- `-webkit-` prefixes included where needed for older Safari versions

## Directory Structure

```
retro-panel/
├── config.yaml                    HA add-on manifest (version 2.0.0)
├── build.yaml                     Docker multi-arch build configuration
├── DOCS.md                        User-facing documentation
├── CHANGELOG.md                   Version history and release notes
├── app/
│   ├── server.py                  aiohttp server + route registration
│   ├── requirements.txt           Python dependencies (aiohttp, pyyaml)
│   ├── api/
│   │   ├── handlers_config.py     GET /api/panel-config
│   │   ├── handlers_config_save.py POST /api/config
│   │   ├── handlers_entities.py   GET /api/entities[?domain=...]
│   │   ├── handlers_areas.py      GET /api/ha-areas
│   │   ├── handlers_cameras.py    GET /api/cameras
│   │   ├── handlers_service.py    POST /api/services/{domain}/{service}
│   │   └── handlers_state.py      GET /api/states
│   ├── config/
│   │   ├── loader.py              panel_config.json loader + layout_type computation
│   │   └── validator.py           config schema validation
│   ├── proxy/
│   │   ├── ha_client.py           HA REST API client
│   │   ├── ws_proxy.py            WebSocket bridge (browser ↔ HA)
│   │   └── supervisor_client.py   Supervisor token fetcher
│   ├── data/
│   │   └── options.json.example   Sample add-on options
│   └── static/
│       ├── index.html             Dashboard (read-only kiosk)
│       ├── config.html            Configuration admin UI
│       ├── css/
│       │   ├── tokens.css         Design system variables
│       │   ├── layout.css         Sidebar + header + content structure
│       │   ├── tiles.css          Tile dimensions + column system + component styles
│       │   ├── bottom-sheet.css   Light control bottom sheet overlay
│       │   └── config.css         Configuration UI styles
│       └── js/
│           ├── api.js             callService(), getAllStates(), getPanelConfig() - REST API layer
│           ├── ws.js              connectWS() - WebSocket bridge client
│           ├── app.js             AppState, boot(), updateEntityState() - application lifecycle
│           ├── nav.js             window.RP_Nav — sidebar navigation and section routing
│           ├── renderer.js        window.RP_Renderer — dynamic component rendering
│           ├── config-api.js      Configuration UI API wrappers
│           ├── config.js          Configuration UI application logic
│           ├── mdi-icons.js       Material Design Icons map (entity → icon_class)
│           ├── utils/
│           │   ├── dom.js         window.RP_DOM - DOM manipulation helpers
│           │   └── format.js      window.RP_FMT - formatting utilities (state, temperature, etc.)
│           └── components/
│               ├── alarm.js       window.AlarmComponent (alarm_control_panel tiles)
│               ├── bottom-sheet.js window.RP_BottomSheet (light control overlay)
│               ├── camera.js      window.CameraComponent (camera tiles)
│               ├── energy.js      window.EnergyFlowComponent (energy flow widget)
│               ├── light.js       window.LightComponent (light entity tiles)
│               ├── scenario.js    window.ScenarioComponent (scene/script/automation tiles)
│               ├── sensor.js      window.SensorComponent (all sensor variants)
│               └── switch.js      window.SwitchComponent (switch and input_boolean tiles)
├── tests/
│   ├── test_handlers_areas.py     9 tests for /api/ha-areas endpoint
│   └── test_handlers_entities.py  13 tests for /api/entities endpoint
└── docs/
    ├── README.md                  Documentation index
    ├── ARCHITECTURE.md            (this file) - System design and internals
    ├── API.md                     Internal API reference
    ├── DEVELOPMENT.md             Developer setup and contribution guide
    ├── PROJECT.md                 Project management and ADRs
    ├── ROADMAP.md                 Feature roadmap
    ├── INSTALLATION.md            Installation and configuration guide
    └── TESTING.md                 Testing strategy and runbook
```

## layout_type System (Core v2.0 Concept)

The **layout_type** is the central abstraction of v2.0 architecture. The backend computes a `layout_type` for every entity in `loader.py` based on domain, device_class, and optional user override. The frontend receives entities that are fully self-describing — no domain inference needed on the client side.

This design ensures:
- **Single source of truth**: Entity classification happens once on the backend
- **Clean component dispatch**: Frontend looks up the component by `layout_type` with zero ambiguity
- **Extensibility**: New entity types can be added by adding a `layout_type` and corresponding component
- **User customization**: `visual_type` field allows users to override the automatic classification

### Mapping Reference

| layout_type | Domain | device_class | Component | Tile Height | Column |
|-------------|--------|-------------|-----------|-------------|--------|
| `light` | light | * | LightComponent | 120px (fixed) | tile-col-compact |
| `switch` | switch, input_boolean | * | SwitchComponent | 120px (fixed) | tile-col-compact |
| `sensor_temperature` | sensor | temperature | SensorComponent | min 72px | tile-col-sensor |
| `sensor_humidity` | sensor | humidity | SensorComponent | min 72px | tile-col-sensor |
| `sensor_co2` | sensor | co2, carbon_dioxide | SensorComponent | min 72px | tile-col-sensor |
| `sensor_battery` | sensor | battery | SensorComponent | min 72px | tile-col-sensor |
| `sensor_energy` | sensor | power, energy | SensorComponent | min 72px | tile-col-sensor |
| `sensor_generic` | sensor | (any other) | SensorComponent | min 72px | tile-col-sensor |
| `binary_door` | binary_sensor | door, window | SensorComponent | min 72px | tile-col-sensor |
| `binary_motion` | binary_sensor | motion, occupancy | SensorComponent | min 72px | tile-col-sensor |
| `binary_standard` | binary_sensor | (any other) | SensorComponent | min 72px | tile-col-sensor |
| `alarm` | alarm_control_panel | * | AlarmComponent | min 240px | tile-col-full |
| `camera` | camera | * | CameraComponent | min 160px | tile-col-full |
| `scenario` | scene, script, automation | * | ScenarioComponent | min 110px | tile-col-compact |
| `energy_flow` | (special widget) | — | EnergyFlowComponent | min 240px | tile-col-full |

### Computation Algorithm

Implemented in `app/config/loader.py`:

```python
def _compute_layout_type(entity_id, device_class, visual_type):
    """
    Compute layout_type for an entity.

    Args:
        entity_id: Full entity ID (e.g. "light.living_room")
        device_class: Optional device_class attribute
        visual_type: Optional user override (highest priority)

    Returns:
        layout_type string or 'sensor_generic' as fallback
    """
    domain = entity_id.split('.')[0]

    # User override takes highest priority
    if visual_type:
        return visual_type

    # Domain-based classification
    if domain == 'light':
        return 'light'

    if domain in ('switch', 'input_boolean'):
        return 'switch'

    if domain == 'sensor':
        dc = device_class or ''
        if dc == 'temperature': return 'sensor_temperature'
        if dc == 'humidity': return 'sensor_humidity'
        if dc in ('co2', 'carbon_dioxide'): return 'sensor_co2'
        if dc == 'battery': return 'sensor_battery'
        if dc in ('power', 'energy'): return 'sensor_energy'
        return 'sensor_generic'

    if domain == 'binary_sensor':
        dc = device_class or ''
        if dc in ('door', 'window'): return 'binary_door'
        if dc in ('motion', 'occupancy'): return 'binary_motion'
        return 'binary_standard'

    if domain == 'alarm_control_panel':
        return 'alarm'

    if domain == 'camera':
        return 'camera'

    if domain in ('scene', 'script', 'automation'):
        return 'scenario'

    # Fallback
    return 'sensor_generic'
```

### Using layout_type in Entity Config

Every entity item in `panel_config.json` includes a `layout_type` field (computed by the backend):

```json
{
  "type": "entity",
  "entity_id": "light.living_room",
  "label": "Living Room",
  "icon": "lightbulb",
  "hidden": false,
  "visual_type": "",
  "device_class": "",
  "layout_type": "light"
}
```

The frontend uses `layout_type` to:
1. Assign column class via `COL_CLASS_MAP[layout_type]`
2. Look up component via `window.RP_Renderer.getComponent(layoutType)`
3. Call the correct `createTile()` and `updateTile()` methods
4. Apply state CSS classes (`is-on`, `is-off`, `is-unavail`)

## Tile Dimension System (Triple-Lock)

The triple-lock CSS pattern prevents any tile from being resized by its neighbors' content. Every tile type has exact or minimum dimensions locked on all three axes: `height`, `min-height`, `max-height`.

### Tile Height Specifications

Defined in `app/static/css/tiles.css`:

```css
.tile-light    { height: 120px; min-height: 120px; max-height: 120px; }
.tile-switch   { height: 120px; min-height: 120px; max-height: 120px; }
.tile-scenario { height: 110px; min-height: 110px; max-height: 110px; }

.tile-sensor   { min-height: 72px; }
.tile-alarm    { min-height: 240px; }
.tile-camera   { min-height: 160px; }

.tile-energy   { min-height: 240px; }
```

**Design intent**:
- Fixed-height tiles (light, switch, scenario) use all three locks for absolute consistency
- Flexible tiles (sensor, alarm, camera, energy) use `min-height` only, allowing content to grow if needed
- This prevents layout jank when tiles load asynchronously or when content updates dynamically

## Column System (Flexbox)

Layout is responsive and touch-friendly across all viewport sizes. The column system uses CSS media queries to adjust grid width without any JavaScript recalculation.

### Column Class Assignment

```js
var COL_CLASS_MAP = {
  'light': 'tile-col-compact',
  'switch': 'tile-col-compact',
  'scenario': 'tile-col-compact',
  'sensor_temperature': 'tile-col-sensor',
  'sensor_humidity': 'tile-col-sensor',
  'sensor_co2': 'tile-col-sensor',
  'sensor_battery': 'tile-col-sensor',
  'sensor_energy': 'tile-col-sensor',
  'sensor_generic': 'tile-col-sensor',
  'binary_door': 'tile-col-sensor',
  'binary_motion': 'tile-col-sensor',
  'binary_standard': 'tile-col-sensor',
  'alarm': 'tile-col-full',
  'camera': 'tile-col-full',
  'energy_flow': 'tile-col-full',
};
```

### CSS Media Query Breakpoints

Base styles (iPad portrait, `≥ 600px`):

```css
.tile-row {
  display: flex;
  flex-wrap: wrap;
  margin-right: -12px;
}

.tile-col-compact {
  width: 33.333%;          /* 3 columns */
  padding-right: 12px;
  padding-bottom: 12px;
}

.tile-col-sensor {
  width: 50%;              /* 2 columns */
  padding-right: 8px;
  padding-bottom: 8px;
}

.tile-col-full {
  width: 100%;             /* Full width */
  padding-right: 0;
  padding-bottom: 12px;
}
```

Mobile portrait (`max-width: 599px`):

```css
@media (max-width: 599px) {
  .tile-col-compact {
    width: 50%;            /* 2 columns */
  }

  .tile-col-sensor {
    width: 100%;           /* 1 column */
  }
  /* .tile-col-full stays 100% */
}
```

Landscape tablet (`orientation: landscape` and `min-width: 1024px`):

```css
@media (orientation: landscape) and (min-width: 1024px) {
  .tile-col-compact {
    width: 25%;            /* 4 columns */
  }

  .tile-col-sensor {
    width: 33.333%;        /* 3 columns */
  }
  /* .tile-col-full stays 100% */
}
```

**Flexbox considerations**:
- No `gap:` property used (iOS 12 incompatible on flex)
- Margins and negative container margins used instead for gutters
- `flex-wrap: wrap` ensures responsive reflowing without JavaScript

## Component Architecture

Every renderable entity type has a corresponding component. Components follow a strict interface for consistency and lifecycle management.

### Component Interface

Each component exports two methods on a global window object:

```js
window.XxxComponent = {
  /**
   * Create a new tile element for an entity.
   * Must return an HTMLElement with tile.dataset.layoutType set.
   *
   * @param {Object} entityConfig - Entity configuration
   * @returns {HTMLElement} Tile DOM element
   */
  createTile: function(entityConfig) {
    // Build DOM, attach event listeners
    var tile = document.createElement('div');
    tile.className = 'tile tile-xxx';
    tile.dataset.layoutType = entityConfig.layout_type;
    // ... initialize with current state from AppState.states[entityConfig.entity_id]
    return tile;
  },

  /**
   * Update tile display when entity state changes.
   * Must not recreate the DOM, only mutate existing element.
   *
   * @param {HTMLElement} tile - Tile element to update
   * @param {Object} stateObj - Current state object { state, attributes }
   */
  updateTile: function(tile, stateObj) {
    // Update text, classes, visuals based on stateObj
    tile.classList.toggle('is-on', stateObj.state === 'on');
    tile.classList.toggle('is-off', stateObj.state === 'off');
    tile.classList.toggle('is-unavail', stateObj.state === 'unavailable');
    // ... update display
  },
};
```

### entityConfig Structure

All `entityConfig` objects contain:

```js
{
  entity_id: "light.living_room",      // Full entity ID
  label: "Living Room",                 // Display label
  icon: "lightbulb",                    // MDI icon name (without mdi-)
  layout_type: "light",                 // Computed type (light, switch, sensor_*, etc.)
  device_class: "dimmer",               // Optional device_class
  visual_type: "",                      // Optional user override
  hidden: false                         // Hidden from dashboard
}
```

### State Object Structure

State objects follow the Home Assistant state schema:

```js
{
  state: "on",                          // Current state as string
  attributes: {
    friendly_name: "Living Room",
    brightness: 200,
    color_temp: 350,
    supported_features: 191,
    // ... entity-specific attributes
  }
}
```

### State CSS Classes

All tiles have state classes automatically applied by `app.js` via `updateEntityState()`:

```css
.tile.is-on       { /* Entity is on/active */ }
.tile.is-off      { /* Entity is off/inactive */ }
.tile.is-unavail  { /* Entity state is unavailable or unknown */ }
```

### Component Life Cycle

1. **Create phase**: `component.createTile(entityConfig)` called once on initial render
2. **Store phase**: Result stored in `AppState.tileMap[entity_id]` and inserted into DOM
3. **Update phase**: `component.updateTile(tile, stateObj)` called on every state change
4. **Lifecycle**: Tile element persists; component methods called repeatedly with new state

### Available Components

**LightComponent** (`app/static/js/components/light.js`):
- Tile height: 120px (fixed)
- Brightness slider in bottom sheet (if supported)
- Color temperature control (if supported)
- Hue/color swatches (if supported)
- State: on/off

**SwitchComponent** (`app/static/js/components/switch.js`):
- Tile height: 120px (fixed)
- Toggle on/off via tap
- Supports `input_boolean` as well as `switch` domain

**SensorComponent** (`app/static/js/components/sensor.js`):
- Tile height: min 72px (flexible)
- Displays state + formatted unit
- Variants: temperature, humidity, co2, battery, energy, generic
- Icon color varies by type and state

**AlarmComponent** (`app/static/js/components/alarm.js`):
- Tile height: min 240px (flexible)
- State indicators (armed, disarmed, triggered, pending)
- Arm/disarm buttons if user role permits
- State transitions with visual feedback

**CameraComponent** (`app/static/js/components/camera.js`):
- Tile height: min 160px (flexible)
- Image refresh at configured interval (`refresh_interval` from panel_config)
- MJPEG stream support
- Tap to open full view in overlay

**ScenarioComponent** (`app/static/js/components/scenario.js`):
- Tile height: min 110px (flexible)
- Tap to activate scene/script/automation
- Feedback on activation (loading state)
- Last triggered timestamp

**EnergyFlowComponent** (`app/static/js/components/energy.js`):
- Tile height: min 240px (flexible)
- Special widget not tied to single entity
- Displays energy flow diagram (grid, home, battery, solar)
- Requires special configuration

## Renderer (window.RP_Renderer)

The renderer is the view layer responsible for creating tiles, managing the component map, and rendering sections. It bridges the AppState model to the DOM.

### Renderer API

```js
window.RP_Renderer = {
  /**
   * Initialize renderer and resolve component map from window globals.
   * Must be called once after all component files are loaded.
   */
  init: function() {
    // Map layout_type → component global
    // Validate all components are loaded
  },

  /**
   * Render the currently active section into #content-area.
   *
   * @param {Object} appState - Current application state
   */
  renderActiveSection: function(appState) {
    var contentArea = document.getElementById('content-area');
    contentArea.innerHTML = '';

    switch(appState.activeSectionId) {
      case 'overview':
        // Render overview items
        break;
      case 'scenarios':
        // Render scenarios grid
        break;
      case 'cameras':
        // Render cameras list
        break;
      default:
        // room:room_id section
        if (appState.activeSectionId.indexOf('room:') === 0) {
          // Render room and its subsections
        }
    }
  },

  /**
   * Render an array of items into a container.
   *
   * @param {HTMLElement} container - Destination container
   * @param {Array} items - Entity/scenario/camera items from config
   * @param {Object} appState - Current application state
   */
  renderItems: function(container, items, appState) {
    var row = document.createElement('div');
    row.className = 'tile-row';

    items.forEach(function(item) {
      if (item.hidden) return;
      var component = window.RP_Renderer.getComponent(item.layout_type);
      if (!component) return;

      var tile = component.createTile(item);
      var colClass = COL_CLASS_MAP[item.layout_type];

      var wrapper = document.createElement('div');
      wrapper.className = 'tile-col ' + colClass;
      wrapper.appendChild(tile);
      row.appendChild(wrapper);

      // Store for later updates
      appState.tileMap[item.entity_id] = tile;
    });

    container.appendChild(row);
  },

  /**
   * Retrieve component for a layout_type.
   *
   * @param {string} layoutType - layout_type to look up
   * @returns {Object|null} Component object or null if not found
   */
  getComponent: function(layoutType) {
    return COMPONENT_MAP[layoutType] || null;
  },
};
```

### Section Types

**overview**:
- First section in navigation
- Displays items from `config.overview.items`
- Typically contains most-used lights and controls

**room:room_id**:
- One section per room in `config.rooms[]`
- Loops through `room.sections[]` and renders subsections
- Each subsection (e.g., lights, climate) has own `.tile-row`

**scenarios**:
- Displays items from `config.scenarios[]`
- Grid of runnable scenes/scripts/automations

**cameras**:
- Displays items from `config.cameras[]`
- List of camera feeds with refresh intervals

## App State and Boot

### AppState Object

Global application state singleton:

```js
var AppState = {
  config: null,              // Full panel_config from GET /api/panel-config
  states: {},                // Map: { entity_id: { state, attributes } }
  tileMap: {},               // Map: { entity_id: HTMLElement tile }
  energyTiles: [],           // Array: [{ tile: HTMLElement, cfg: config }]
  wsConnected: false,        // WebSocket connection status
  activeSectionId: 'overview', // Currently displayed section
};
```

### Boot Sequence (app.js)

Application initialization follows a strict sequence to ensure all dependencies are satisfied:

```
1. getPanelConfig()
   └─ applyConfig() — set theme, title, favicon

2. window.RP_Renderer.init()
   └─ Validate all components loaded in window

3. getAllStates()
   └─ Populate AppState.states with current HA entities

4. window.RP_Nav.init()
   └─ Build sidebar navigation from config.rooms

5. window.RP_Renderer.renderActiveSection(AppState)
   └─ Render initial overview section

6. showPanel() / hideLoadingScreen()
   └─ Fade out loader, show dashboard

7. connectWS()
   └─ Establish WebSocket to HA
   └─ If WebSocket unavailable, schedule fallback REST polling
```

### State Update Flow

When an entity state changes (via WebSocket or polling):

```
WebSocket message / REST response
  ↓
updateEntityState(entity_id, newStateObj)
  ↓
AppState.states[entity_id] = newStateObj
  ↓
Component lookup via AppState.tileMap[entity_id].dataset.layoutType
  ↓
component.updateTile(tile, newStateObj)
  ↓
DOM mutation (classes, text, styles updated)
```

### Connection Management

WebSocket connection with automatic fallback:

```
connectWS()
  ↓
Try WebSocket connection
  ├─ Success: setConnectionStatus(true) → cancel polling
  ├─ Failure: setConnectionStatus(false) → startStatePoll(interval)
  │            └─ Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s max
  └─ Disconnect: auto-reconnect with backoff
```

## Bottom Sheet (Light Controls)

Light brightness, color temperature, and color adjustment interface. Implemented as a singleton modal overlay that slides up from the bottom.

### RP_BottomSheet API

```js
window.RP_BottomSheet = {
  /**
   * Open the bottom sheet for a light entity.
   *
   * @param {string} entityId - Entity ID of the light
   * @param {string} label - Display label
   * @param {Object} attributes - State attributes (brightness, color_temp, rgb_color, etc.)
   */
  open: function(entityId, label, attributes) {
    // Show overlay
    // Populate sliders from attributes
    // Set up event listeners for changes
  },

  /**
   * Close the bottom sheet.
   */
  close: function() {
    // Hide overlay
    // Unbind event listeners
  },
};
```

### Implementation Details

Pre-built DOM structure in `index.html`:

```html
<div id="bs-overlay"></div>
<div id="bottom-sheet">
  <div class="bs-header">
    <h2 id="bs-label"></h2>
    <button id="bs-close">×</button>
  </div>
  <div class="bs-content">
    <!-- Sliders built dynamically on first open() -->
  </div>
</div>
```

### Feature Gates (supported_features Bitmask)

Controls are conditionally shown based on `state.attributes.supported_features`:

- **Bit 1 (BRIGHTNESS = 1)**: Brightness slider (0–255 or 0–100)
- **Bit 2 (COLOR_TEMP = 2)**: Color temperature slider (mirek or Kelvin)
- **Bit 16 (COLOR = 16)**: RGB color picker with predefined swatches

Example:
```js
var attrs = stateObj.attributes;
var hasColor = (attrs.supported_features & 16) !== 0;
if (hasColor) {
  // Show color controls
}
```

### Lifecycle

1. **First open**: `_build()` creates all DOM elements and attaches listeners
2. **Subsequent opens**: Reuse pre-built DOM, update slider values from `attributes`
3. **Close**: Hide overlay, do not destroy DOM
4. **Service calls**: On slider change, call `callService('light', 'turn_on', params)`

## Config Data Model (panel_config.json)

The configuration file defines the dashboard layout, sections, and entity associations.

### Complete Config Structure

```json
{
  "version": 2,
  "overview": {
    "title": "Home",
    "items": [
      {
        "type": "entity",
        "entity_id": "light.living_room",
        "label": "Living Room",
        "icon": "lightbulb",
        "hidden": false,
        "visual_type": "",
        "device_class": "",
        "layout_type": "light"
      }
    ]
  },
  "rooms": [
    {
      "id": "room_soggiorno",
      "title": "Soggiorno",
      "icon": "sofa",
      "hidden": false,
      "sections": [
        {
          "id": "sec_lights",
          "title": "Lights",
          "items": [
            {
              "type": "entity",
              "entity_id": "light.sofa",
              "label": "Sofa",
              "icon": "lightbulb",
              "hidden": false,
              "visual_type": "",
              "device_class": "",
              "layout_type": "light"
            }
          ]
        },
        {
          "id": "sec_climate",
          "title": "Climate",
          "items": [
            {
              "type": "entity",
              "entity_id": "sensor.living_room_temp",
              "label": "Temperature",
              "icon": "thermometer",
              "hidden": false,
              "visual_type": "",
              "device_class": "temperature",
              "layout_type": "sensor_temperature"
            }
          ]
        }
      ]
    }
  ],
  "scenarios": [
    {
      "type": "entity",
      "entity_id": "scene.evening",
      "label": "Evening",
      "hidden": false,
      "layout_type": "scenario"
    }
  ],
  "cameras": [
    {
      "entity_id": "camera.front_door",
      "label": "Front Door",
      "hidden": false,
      "refresh_interval": 10
    }
  ]
}
```

### Field Definitions

**Top-level**:
- `version` (int): Schema version (currently 2)

**overview**:
- `title` (string): Section title in header
- `items` (array): Entity items to display

**rooms[]**:
- `id` (string): Unique room identifier (used in nav)
- `title` (string): Room display name
- `icon` (string): MDI icon name
- `hidden` (bool): Exclude from navigation
- `sections[]`: Subsections within room

**sections[]**:
- `id` (string): Unique section identifier
- `title` (string): Section display name
- `items` (array): Entity items

**items** (entity):
- `type` (string): Always "entity"
- `entity_id` (string): Full Home Assistant entity ID
- `label` (string): Display label
- `icon` (string): MDI icon name
- `hidden` (bool): Hide from view
- `visual_type` (string): User override for layout_type (optional)
- `device_class` (string): Device class (optional, computed from HA if empty)
- `layout_type` (string): Computed layout_type (set by backend)

**cameras[]**:
- `entity_id` (string): camera.* entity ID
- `label` (string): Display label
- `hidden` (bool): Hide from view
- `refresh_interval` (int): Polling interval in seconds (default 10)

## Data Flow Diagrams

### Page Load

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ GET /
       ├────────────────────────────┐
       │                            │
       ├─ GET /api/panel-config     │
       │   │                        │
       │   └─ loader.py             │
       │       ├─ Load config file  │
       │       ├─ Compute layout_type
       │       └─ Return JSON        │
       │                            │
       ├─ GET /api/states           │
       │   │                        │
       │   └─ ha_client.py          │
       │       └─ HA REST /api/states
       │           └─ Return states │
       │                            │
       └─ WS /ws                    │
           │                        │
           └─ ws_proxy.py           │
               ├─ HA WebSocket      │
               ├─ state_changed     │
               │ messages           │
               └─ Browser WS stream │
       ┌───────────────────────────┘
       │
       ├─ app.js:boot()
       │   ├─ getPanelConfig()
       │   ├─ getAllStates()
       │   ├─ RP_Renderer.init()
       │   ├─ RP_Nav.init()
       │   ├─ RP_Renderer.renderActiveSection()
       │   └─ connectWS()
       │
       └─ Dashboard visible
```

### Service Call (Toggle Light)

```
┌─────────────────────┐
│  User taps light    │
└──────┬──────────────┘
       │
       ├─ Light component tap handler
       │
       └─ callService('light', 'turn_on', {entity_id: ...})
           │
           └─ POST /api/services/light/turn_on
               │
               ├─ handlers_service.py
               │   ├─ Whitelist check
               │   └─ ha_client.py
               │       └─ HA REST /api/services/light/turn_on
               │           │
               │           └─ HA broadcasts state_changed event
               │
               └─ ws_proxy.py receives state_changed
                   │
                   └─ Browser WebSocket message
                       │
                       └─ app.js:updateEntityState()
                           │
                           └─ AppState.tileMap lookup
                               │
                               └─ component.updateTile()
                                   │
                                   └─ DOM class + text update
```

### WebSocket Reconnection

```
┌─────────────────────┐
│  WS connection lost │
└──────┬──────────────┘
       │
       ├─ ws.js:onClose()
       │   │
       │   └─ setConnectionStatus(false)
       │       │
       │       └─ Schedule stat poll
       │           │
       │           ├─ Interval 1s
       │           │   ├─ getAllStates() retry
       │           │   └─ connectWS() retry
       │           │
       │           ├─ Exponential backoff
       │           │   └─ 1s → 2s → 4s → 8s → 16s → 30s
       │           │
       │           └─ On connection success
       │               ├─ setConnectionStatus(true)
       │               ├─ Cancel polling
       │               └─ Resume normal operation
       │
       └─ Dashboard stays responsive
           (REST polling provides updates)
```

## Security Model

### Token Isolation

- **Server-side only**: HA long-lived token stored in server memory, never sent to browser
- **Supervisor token**: Fetched from HA Supervisor via environment variable `SUPERVISOR_TOKEN`
- **No localStorage/sessionStorage**: Sensitive data never written to client storage

### Ingress Proxy

- Home Assistant Supervisor acts as authentication gateway
- Only authenticated HA users can access `/`
- `/config` requires HA Ingress session with admin role
- Token is validated on every request in middleware

### Service Call Validation

`handlers_service.py` validates every service call against a whitelist:

```python
ALLOWED_SERVICES = {
    'light': ['turn_on', 'turn_off', 'toggle'],
    'switch': ['turn_on', 'turn_off', 'toggle'],
    'scene': ['turn_on'],
    'script': ['turn_on'],
    'alarm_control_panel': ['arm_away', 'arm_home', 'disarm'],
    # ... etc
}
```

Attempts to call unlisted service/domain combinations are rejected with 403 Forbidden.

### CORS Policy

Custom CORS middleware:
- Echoes `Origin` header only if it matches `ha_url` configuration
- Credentials required for cross-origin requests
- Preflight requests validated

### Config Endpoint Protection

GET `/api/panel-config` and POST `/api/config`:
- Require valid HA Ingress session
- Admin role check before allowing config modification
- Configuration file validated against schema

### WebSocket Security

- WebSocket connection authenticated via HA token
- Message filtering: only state_changed events forwarded to browser
- Service calls require matching entity domain validation

## Browser Compatibility Matrix

### iOS Safari (Primary Target)

| Platform | Version | Support | Notes |
|----------|---------|---------|-------|
| iOS | 12.x | Full | WKWebView, ES5 only |
| iOS | 13–14.x | Full | WKWebView |
| iOS | 15+ | Full | WKWebView, preferred |

**iOS 12 constraints** (enforced for maximum compatibility):
- No `const`/`let` (use `var`)
- No arrow functions `=>` (use `function`)
- No optional chaining `?.` or nullish coalescing `??`
- No `async`/`await` in component files
- No module syntax (`import`/`export`)
- IIFE pattern: `(function() { 'use strict'; ... }())`

**iOS 12 CSS constraints** (enforced):
- No `gap:` on `display:flex` (use margins instead)
- No `inset:` shorthand (use `top`/`right`/`bottom`/`left`)
- No `100dvh` (use `100vh`)
- Require `-webkit-` prefixes for flexbox: `-webkit-flex`

### Other Platforms

| Browser | Version | Support |
|---------|---------|---------|
| Chrome Android | Last 3 versions | Full |
| Chrome Desktop | Last 3 versions | Full |
| Firefox Desktop | Last 3 versions | Full |
| Safari Desktop | Last 3 versions | Full |

All modern browsers support ES5 and modern CSS.

## Add-on Configuration (config.yaml Options)

Configuration options exposed in Home Assistant add-on config panel and stored in `options.json`:

| Option | Type | Default | Range | Description |
|--------|------|---------|-------|-------------|
| `ha_url` | url | `http://homeassistant:8123` | — | Home Assistant instance URL |
| `ha_token` | password | `""` | — | Long-lived token (auto-fetched from SUPERVISOR_TOKEN if empty) |
| `panel_title` | string | `"Home"` | 1–50 chars | Dashboard title in header |
| `theme` | select | `"dark"` | dark, light, auto | Color theme (auto = system preference) |
| `refresh_interval` | integer | `30` | 5–300 | REST fallback poll interval in seconds |

**Notes**:
- `columns` option was removed in v2.0 — column layout is entirely CSS-based with media queries
- `ha_token` is optional; if empty, the server fetches the token from `SUPERVISOR_TOKEN` environment variable
- Theme auto mode uses CSS `prefers-color-scheme` media query
- Refresh interval is fallback only; WebSocket is preferred when available

---

**Last Updated**: 2026-03-27
**Version**: 2.0
