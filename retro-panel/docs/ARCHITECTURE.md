# Retro Panel Architecture

## Project Overview

Retro Panel is a Home Assistant Add-on that provides a lightweight, mobile-friendly control panel for Home Assistant. It delivers a simple, nostalgic interface for controlling smart home entities with minimal overhead and maximum compatibility.

**Purpose**: Enable users to create retro-styled control panels for Home Assistant that work seamlessly on older devices and mobile browsers (particularly legacy devices no longer receiving OS updates).

**Target Users**:
- Home Assistant enthusiasts who want a simple, fast control interface
- Users with older devices or slow networks
- Developers building custom HA frontends
- Anyone who values simplicity and fast load times

**Why It Exists**: While Lovelace is feature-rich, it's resource-intensive. Retro Panel fills a niche for users who want a lightweight alternative that prioritizes speed, compatibility, and usability over feature count.

## Technology Stack with Justifications

### Python 3.11 + aiohttp

**Choice**: Python 3.11 with aiohttp ASGI server

**Justifications**:
- **HA Ecosystem**: Home Assistant is Python-based. Using Python keeps the codebase in the same ecosystem, reducing complexity for HA developers and improving integration.
- **aiohttp**: Lightweight async web framework (minimal dependencies) vs. FastAPI (requires Pydantic, uvicorn, multiple deps) or Flask (blocking I/O).
- **Memory Footprint**: aiohttp + Python runtime ~50-80 MB RSS vs. Node.js frameworks ~80-120 MB.
- **Deployment**: Home Assistant add-on environment is optimized for Python; binary dependencies are simpler.
- **WebSocket Support**: Native asyncio + aiohttp WebSocket handling without external libraries.

**Not FastAPI/Flask**:
- FastAPI adds unnecessary complexity for this use case (no OpenAPI docs needed).
- Flask is blocking and requires threading for concurrent requests.
- Both add significant dependency weight.

### Vanilla JavaScript (ES2017)

**Choice**: Plain JavaScript without bundlers, transpilers, or frameworks

**Justifications**:
- **Bundle Size**: No build step means no webpack/rollup overhead. Assets are served directly: ~15 KB JS vs. React ~35 KB + polyfills.
- **Legacy Browser Compatibility**: ES2017 is fully supported in legacy mobile Safari (WebKit). Avoiding Babel transpilation eliminates polyfill bloat.
- **Network**: Every KB matters on slow connections. Direct ES2017 is fastest.
- **Maintenance**: No build pipeline to maintain. File-based modularization using ES6 imports.
- **Developer Experience**: Developers can edit and refresh. No build wait times.

**Why not React/Vue**:
- React requires Babel transpilation (even for ES2017), adding ~40 KB.
- Virtual DOM diffing is overkill for a simple control panel.
- State management complexity not justified for this UI.

### Plain CSS (No preprocessors)

**Choice**: Vanilla CSS with CSS Grid and Flexbox

**Justifications**:
- **Size**: Plain CSS is the smallest possible asset (no compilation overhead).
- **Compatibility**: CSS Grid and Flexbox are native in all target browsers.
- **Maintainability**: Fewer abstraction layers. CSS is straightforward.
- **Browser Dev Tools**: Direct CSS debugging without source maps.

**Why not Tailwind/SASS**:
- Tailwind adds utility class overhead and requires a build process.
- SASS compilation adds build complexity without significant benefit.
- Plain CSS custom properties (variables) provide enough reusability.

**CSS Pattern: Dynamic Tints and Inline Styles**:
- Inline styles take priority over CSS for dynamic colors (e.g., `style="color: rgb(100, 200, 255)"`)
- `.light-tint` overlay div allows smooth opacity transitions without repainting element borders
- Suppressed `::before` pseudo-elements on light/switch tiles to prevent double-tint effect
- Tile value text sized at 15px for legacy device compatibility (small screen optimization)

### Process Management: s6-overlay

**Choice**: s6-overlay for process supervision

**Justifications**:
- **HA Add-on Standard**: Home Assistant add-on framework uses s6-overlay natively.
- **Reliability**: Automatic process restart if server crashes.
- **Logging**: Integrated logging without separate log management.
- **Signals**: Proper shutdown handling via SIGTERM.

### HA Ingress Integration

**Choice**: Access through HA Ingress proxy rather than direct port exposure

**Justifications**:
- **Security**: Ingress proxy validates HA session tokens before forwarding requests.
- **Network**: Works behind NAT/firewalls automatically.
- **Isolation**: Add-on doesn't expose ports to the host network.
- **Authentication**: No separate auth layer needed (piggybacks on HA auth).

## Directory Structure

```
retro-panel/
├── addon/                          # Home Assistant add-on container
│   ├── Dockerfile                  # Multi-arch build configuration
│   ├── config.yaml                 # Add-on metadata
│   ├── options.json                # Default configuration schema
│   ├── run.sh                       # Entry point script
│   └── rootfs/
│       ├── etc/s6-overlay/         # Process supervision config
│       └── etc/services.d/
│           └── retro-panel/        # Service definition
├── app/                            # Backend application
│   ├── server.py                   # Main ASGI server entry point
│   ├── ha_client.py               # Home Assistant REST/WebSocket client
│   ├── ws_proxy.py                # WebSocket bridge (HA → Browser)
│   ├── config_loader.py           # Load and validate options.json
│   ├── service_whitelist.py       # Service call whitelist
│   ├── handlers/
│   │   ├── static.py              # Static file serving
│   │   ├── api.py                 # REST API endpoints
│   │   ├── ws.py                  # WebSocket handler
│   │   └── panel_config.py        # Panel configuration endpoint
│   └── utils/
│       ├── logger.py              # Logging setup
│       └── validators.py          # Input validation
├── frontend/                       # Browser frontend
│   ├── index.html                 # Main HTML document
│   ├── js/
│   │   ├── app.js                 # Application entry point, routing
│   │   ├── api.js                 # REST API client module
│   │   ├── ws.js                  # WebSocket client module
│   │   ├── state.js               # AppState management
│   │   └── components/            # Entity type renderers
│   │       ├── light.js           # Light entity component
│   │       ├── switch.js          # Switch entity component
│   │       ├── cover.js           # Cover entity component (future)
│   │       ├── sensor.js          # Sensor entity component
│   │       ├── binary_sensor.js   # Binary sensor component
│   │       ├── input_boolean.js   # Input boolean (future)
│   │       └── custom.js          # Custom/fallback renderer
│   └── css/
│       ├── reset.css              # Normalize browser defaults
│       ├── layout.css             # Grid/flexbox layouts
│       ├── components.css         # Tile and button styles
│       └── theme.css              # Color scheme variables
├── docs/                          # Documentation
│   ├── ARCHITECTURE.md            # This file
│   ├── DEVELOPMENT.md             # Developer guide
│   ├── API.md                     # Internal API reference
│   ├── PROJECT.md                 # Project goals and decisions
│   └── ROADMAP.md                 # Future features
├── tests/                         # Test suite (future)
│   ├── conftest.py                # Pytest fixtures
│   ├── test_ha_client.py          # HAClient unit tests
│   └── test_api_handlers.py       # API handler tests
├── .github/workflows/             # CI/CD (future)
│   └── build.yml                  # Multi-arch Docker build
├── README.md                      # User-facing README
├── requirements.txt               # Python dependencies
└── .gitignore

```

## Component Architecture

### Backend Architecture

#### HAClient (app/ha_client.py)

Manages all communication with Home Assistant.

**Responsibilities**:
- REST API calls to fetch entity states and call services
- WebSocket connection management with automatic reconnection
- Token management (received from HA Ingress headers)
- Event subscription handling

**Key Methods**:
- `async def connect()` - Establish authenticated WebSocket to HA
- `async def disconnect()` - Clean shutdown
- `async def get_state(entity_id)` - Fetch current state via REST
- `async def get_all_states()` - Fetch all entities' states
- `async def call_service(domain, service, service_data)` - Call HA service
- `async def subscribe_to_events()` - Subscribe to state_changed events
- `on_state_changed(callback)` - Register callback for state updates

**State Tracking**:
- Maintains in-memory cache of all entity states
- Updates cache on WebSocket state_changed events
- Periodically syncs with HA (configurable interval, default 60s)

#### WSProxy (app/ws_proxy.py)

Bridges browser WebSocket connection to Home Assistant WebSocket.

**Responsibilities**:
- Accept browser WebSocket connections
- Forward HA state changes to all connected browsers
- Maintain subscriber list

**Data Flow**:
1. Browser connects via `/ws` endpoint
2. WSProxy registers callback with HAClient
3. When HA sends state_changed event, forward to all connected browsers
4. Browser disconnects → remove from subscriber list

#### API Handlers (app/handlers/api.py)

Expose REST endpoints for panel operations.

**Endpoints**:
- `GET /api/panel-config` - Panel layout and entity list
- `GET /api/state/{entity_id}` - Get single entity state
- `GET /api/states/all` - Get all entity states (for page load)
- `POST /api/service/{domain}/{service}` - Call HA service

**Service Call Security**:
- All calls validated against service_whitelist
- Only whitelisted domain/service pairs allowed
- Service data validated against config schema

#### ConfigLoader (app/config_loader.py)

Validates and manages add-on configuration.

**Responsibilities**:
- Load options.json from `/data/` directory
- Validate against schema
- Provide typed configuration objects
- Hot-reload on file changes (future)

**Configuration Sections**:
- `ha_url` - HA WebSocket URL
- `ha_token` - HA API token
- `panels` - Panel definitions (rows, cols, entities)
- `service_whitelist` - Allowed service calls
- `layout_config` - Grid sizing, spacing

### Frontend Architecture

#### AppState (frontend/js/state.js)

Central state container for frontend.

**Shape**:
```javascript
{
  entities: {
    [entityId]: {
      state: string,
      attributes: object,
      lastUpdated: timestamp,
      config: entityConfig
    }
  },
  connectionStatus: "connected" | "reconnecting" | "disconnected",
  lastSyncTime: timestamp,
  panelConfig: {
    title: string,
    rows: [
      {
        cols: [
          {
            entity_id: string,
            size: "small" | "medium" | "large",
            ...
          }
        ]
      }
    ]
  }
}
```

**Methods**:
- `updateEntityState(entityId, newState, newAttributes)` - Update entity in state
- `getEntity(entityId)` - Retrieve entity object
- `getPanel()` - Get panel configuration
- `setConnectionStatus(status)` - Update connection indicator
- `subscribe(callback)` - Register state change listener

#### api.js Module

Handles all REST API communication.

**Key Functions**:
```javascript
async function fetchPanelConfig()
  // Returns: { title, rows, [...] }

async function fetchAllStates()
  // Returns: { [entityId]: { state, attributes } }

async function callService(domain, service, serviceData)
  // Throws on validation errors
  // Returns: service response object

function getAbsoluteUrl(path)
  // Convert /api/foo to full HA Ingress URL
```

**Error Handling**:
- Network errors → throw Error
- API errors (4xx/5xx) → throw APIError with details
- Validation errors → throw ValidationError

#### ws.js Module

Manages WebSocket connection to backend.

**Key Functions**:
```javascript
async function connectWS()
  // Establish WebSocket connection
  // Return: WebSocket object

function onStateChanged(handler)
  // Register callback for state updates
  // handler(entityId, state, attributes)

function reconnectWithBackoff()
  // Auto-reconnect with exponential backoff
  // Backoff: 1s, 2s, 4s, 8s, max 30s

function disconnect()
  // Clean WebSocket closure
```

**Message Protocol**:
- Server sends: `{type: "state_changed", entity_id, state, attributes}`
- Server sends: `{type: "connection_status", status: "ok"}`
- All messages are JSON

#### Component Model

Each entity type has a component module (e.g., `js/components/light.js`).

**Component Interface**:
```javascript
export function createTile(config, state) {
  // Create DOM element for this entity
  // config: { entity_id, size, name, ... }
  // state: { state, attributes }
  // Return: HTMLElement

  const tile = document.createElement('div');
  tile.className = 'tile tile-light';
  tile.dataset.entityId = config.entity_id;
  // ... build tile DOM ...
  return tile;
}

export function updateTile(element, state) {
  // Update tile DOM based on new state
  // element: HTMLElement from createTile()
  // state: { state, attributes }

  element.dataset.state = state.state;
  // ... update tile appearance ...
}

export function handleInteraction(entityId, action) {
  // Called when user interacts with tile
  // action: { type: "toggle", "set_brightness": value, ... }
  // Return: Promise
}
```

**Component Registration** (in `app.js`):
```javascript
const COMPONENTS = {
  'light': lightComponent,
  'switch': switchComponent,
  'sensor': sensorComponent,
  // ...
};
```

#### Light Component Advanced Interactions

The light component (`js/components/light.js`) implements a two-step interaction model for enhanced UX on touch devices:

**Interaction Patterns**:
1. **Short Tap** (< 500ms): Toggle on/off immediately
2. **Long Press** (500ms+): Opens bottom sheet for advanced controls

**Color Support**:
- **RGB Color** (`rgb_color` attribute): Converted to hex color for tile tint
- **Color Temperature** (`color_temp` in mireds): Converted to Kelvin gradient for visual feedback
- **Dynamic Tint**: `.light-tint` div overlay shows active color with state-dependent opacity

**Bottom Sheet Control Panel** (`js/components/light-sheet.js`):
A modal singleton (`window.RP_LightSheet`) that lazy-loads on first open and provides:
- Brightness slider (1-255 converted to percentage display)
- Color temperature slider (153-500 mireds converted to Kelvin)
- Hue slider (0-360°) with 8 color swatch presets
- Live tile color updates while adjusting
- Service calls debounced to 300ms intervals

**Visual Design**:
- `.light-tint` div (absolute positioned overlay) animates opacity from 0 (off) to 1 (on)
- Inline style takes priority over CSS for dynamic colors
- Green theme (`#4caf50`) for on state with rgba background tint
- iOS 12+ safe IIFE pattern with no optional chaining

**Feature Flags** (via `supported_features` bitmask):
- Bit 1 (BRIGHTNESS=1): Enables brightness slider in bottom sheet
- Bit 2 (COLOR_TEMP=2): Enables color temperature slider
- Bit 16 (COLOR=16): Enables hue and color swatch controls

#### Switch Component Styling

The switch component (`js/components/switch.js`) mirrors the light component structure with simplified controls:
- Short tap toggles on/off (no long-press)
- Green inline styles (`#4caf50`) when ON
- `.light-tint` div with rgba(76,175,80,0.12) background
- Empty tile-value (no "On/Off" text display)
- Consistent 120px tile size with light component

#### app.js Entry Point

Main application orchestration.

**Responsibilities**:
- Load panel configuration via `api.fetchPanelConfig()`
- Fetch initial state via `api.fetchAllStates()`
- Initialize AppState
- Render panel layout
- Connect WebSocket and register state listeners
- Handle user interactions (button taps, etc.)

**Flow**:
1. DOMContentLoaded → call `initApp()`
2. Fetch panel config + initial states (parallel)
3. Render UI using components
4. Connect WebSocket
5. Register state change listener → update UI on changes

## Data Flow Diagrams

### Initial Page Load Sequence

```
Browser                          Backend                    Home Assistant
   |                              |                              |
   |-- GET / ------------------>|                              |
   |                          [Load index.html]                  |
   |<-- 200 OK ---|                              |
   |              [HTML with embedded JS]       |
   |                              |                              |
   |-- GET /api/panel-config ---->|                              |
   |                          [Load options.json]                |
   |<-- panel config <------------|                              |
   |                              |                              |
   |-- GET /api/states/all ------>|                              |
   |                          [HAClient.get_all_states()]        |
   |                              |----- REST API query -------->|
   |                              |<-- all entity states --------|
   |<-- all states <-------------|                              |
   |                              |                              |
   |-- Render UI (sync) --|       |                              |
   |                              |                              |
   |-- GET /ws ------(upgrade)--->|                              |
   |  <---- WebSocket (connected) |                              |
   |       |                      |------ Subscribe events ----->|
   |       |                      |<---- state_changed events ---|
```

### User Taps a Button (Service Call Flow)

```
Browser (User tap on light)        Backend                    Home Assistant
   |                              |                              |
   |-- onClick handler fires      |                              |
   |-- Optimistic update (UI)     |                              |
   |                              |                              |
   |-- POST /api/service/light/turn_on ---|                     |
   |   {entity_id: "light.bedroom"}       |                     |
   |                              |                              |
   |                          [Validate service call]            |
   |                          [Check whitelist]                  |
   |                              |                              |
   |                              |----- REST POST service ----->|
   |                              |<-- service response ---------|
   |                              |                              |
   |                          [HAClient updates state]           |
   |                              |                              |
   |<-- 200 OK <---|              |                              |
   |   {state: "on"}              |                              |
   |                              |                              |
   | [Update optimistic state]    |                              |
   |                              |                              |
   | (Shortly after, WebSocket    |                              |
   |  receives state_changed      |                              |
   |  confirming the state)       |                              |
```

### WebSocket State Update Flow

```
Home Assistant                     Backend                    Browser
   |                              |                              |
   |-- state_changed event ------>|                              |
   |   (e.g., light turned on)    |                              |
   |                              |                              |
   |                          [HAClient receives event]          |
   |                          [Update internal cache]            |
   |                          [Notify WSProxy]                   |
   |                              |                              |
   |                              |-- WebSocket frame: state_changed -->|
   |                              |     {entity_id, state, attributes} |
   |                              |                              |
   |                              |  [Browser JS receives]       |
   |                              |  [Update AppState]           |
   |                              |  [Find tile DOM element]     |
   |                              |  [Call component.updateTile()]|
   |                              |  [Update visual appearance]  |
```

### WebSocket Reconnection Flow

```
Browser                          Backend                    Home Assistant
   |                              |                              |
   |-- Connection lost ---|       |                              |
   |                              |                              |
   |-- Retry loop:                |                              |
   |   wait 1s                    |                              |
   |-- GET /ws --(upgrade)------->|                              |
   |                          [Connection accepted]              |
   |<---- WebSocket (connected) --|                              |
   |                              |                              |
   |-- Request full state sync    |                              |
   |   POST /api/states/all       |                              |
   |                              |----- REST query ------------>|
   |                              |<-- all states ------------|  |
   |<-- merged states ---|        |                              |
   |                              |                              |
   |-- Reconnect successful       |                              |
   |-- Resume normal operation    |                              |
```

## Security Model

### Token Isolation

**Design**: Authentication tokens are never sent to the browser.

**Implementation**:
- HA Ingress proxy extracts token from session cookie
- Token passed to backend via `X-HA-Access` header (internal only)
- Backend uses token exclusively on server-side
- Frontend never has access to raw token
- No token stored in localStorage or sessionStorage

**Benefit**: If frontend is compromised, attacker cannot impersonate user to HA.

### Ingress Proxy Authentication

**Design**: All requests go through HA Ingress proxy before reaching add-on.

**Flow**:
1. User logs into Home Assistant (gets session cookie)
2. User accesses add-on via Ingress URL: `http://homeassistant.local:8123/api/hassio_ingress/{slug}`
3. HA Ingress proxy verifies session cookie
4. If valid, proxy forwards request to add-on (backend) with `X-HA-Access` header
5. If invalid, proxy returns 401 Unauthorized

**Security**:
- Only authenticated HA users can reach the add-on
- No network exposure (add-on listens only on internal Docker network)

### Service Call Whitelist

**Design**: Only explicitly whitelisted services can be called.

**Configuration** (in options.json):
```json
{
  "service_whitelist": [
    {"domain": "light", "service": "turn_on"},
    {"domain": "light", "service": "turn_off"},
    {"domain": "light", "service": "toggle"},
    {"domain": "switch", "service": "turn_on"},
    {"domain": "switch", "service": "turn_off"}
  ]
}
```

**Validation**:
1. User clicks button → browser sends `POST /api/service/light/turn_on`
2. Backend checks if `{domain: "light", service: "turn_on"}` exists in whitelist
3. If not found, return 403 Forbidden
4. If found, proceed with service call

**Service Data Validation**:
- Schema defined in options.json for each whitelisted service
- Backend validates all service_data against schema
- Rejects unexpected keys or wrong types

### Rate Limiting

**Design**: Prevent abuse via excessive requests.

**Implementation** (future):
- Per-IP rate limit: 100 requests per minute
- Per-entity rate limit: 10 service calls per minute
- Exponential backoff for repeated failures
- Connection limit: max 10 concurrent WebSocket connections

**Current**: No rate limiting in v1.0 (trusted local network assumed).

## HA Integration

### REST API Usage

**Endpoints Called**:

| Endpoint | Purpose | Called When | Frequency |
|----------|---------|-------------|-----------|
| `GET /api/states` | Fetch all entities | Page load, full sync | On demand |
| `GET /api/states/{entity_id}` | Get single entity | Tile click (to verify state) | Rarely |
| `POST /api/services/{domain}/{service}` | Call service | User interaction | On demand |
| `GET /api/config/entity_registry` | Fetch entity registry | Entity picker load | On demand |

> **Note — entity registry usage**: The HA `states` variable in Jinja2 templates
> does **not** carry `hidden_by` / `disabled_by` metadata; those fields live
> exclusively in the entity registry. Any handler that must exclude hidden or
> disabled entities (`handlers_entities.py`, `handlers_areas.py`) must call
> `/api/config/entity_registry` explicitly. If the call fails, the policy is to
> proceed without the filter and log a warning (graceful degradation).

**Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Token Source**: Extracted from `X-HA-Access` header (from Ingress proxy).

### WebSocket API Usage

**Connection**:
- Target: HA WebSocket endpoint (via HAClient)
- URL: `ws://homeassistant:8123/api/websocket` (internal Docker network)
- Port: 8123 (HA internal port)

**Authentication Sequence**:
```
Client                              HA Server
  |                                  |
  |-- WebSocket connect ----------->|
  |<-- {type: "auth_required"} ------|
  |                                  |
  |-- {type: "auth",                 |
  |    access_token: "eyJ..."}  --->|
  |                                  |
  |<-- {type: "auth_ok"} ------------|
```

**Subscription**:
```javascript
{
  "type": "subscribe_events",
  "event_type": "state_changed"
}
```

**Incoming Events**:
```javascript
{
  "type": "event",
  "event": {
    "event_type": "state_changed",
    "data": {
      "entity_id": "light.bedroom",
      "old_state": {state: "off", attributes: {...}},
      "new_state": {state: "on", attributes: {...}}
    }
  }
}
```

### Ingress Proxy Behavior

**Request Path Transformation**:
- Browser requests: `http://homeassistant.local:8123/api/hassio_ingress/{slug}/api/service/light/on`
- Ingress proxy strips prefix: `/api/service/light/on`
- Proxy forwards to add-on backend

**Header Injection**:
- Ingress proxy adds: `X-HA-Access: {token}`
- Backend extracts token from this header

**CORS Handling**:
- Browser makes same-origin requests (all URLs under Ingress prefix)
- No CORS headers needed (same origin)

## Browser Compatibility Matrix

### legacy mobile Safari (WebKit)

| Feature | Status | Notes |
|---------|--------|-------|
| ES2017 syntax (async/await, arrow functions) | ✓ | Native support |
| Fetch API | ✓ | Native support |
| WebSocket API | ✓ | Native support |
| CSS Grid | ✓ | Full support, no prefix needed |
| CSS Flexbox | ✓ | Full support |
| CSS Custom Properties (variables) | ✓ | No IE11 support needed |
| CSS backdrop-filter | ✓ | Requires `-webkit-` prefix |
| localStorage | ✓ | Full support |
| CSS Grid auto-fill/auto-fit | ✓ | Native support |
| ES6 Modules (import/export) | ✓ | Supported in same-origin scripts |
| Intersection Observer | ✓ | For lazy loading (future) |
| Media Queries | ✓ | Full support including prefers-color-scheme |
| Touch Events | ✓ | Native support for touchstart/touchend |
| Service Workers | ✓ | For offline support (future) |

| Feature | Status | Notes |
|---------|--------|-------|
| Babel transpilation | ✗ | Avoid - adds bloat, unnecessary in legacy mobile Safari |
| CSS-in-JS libraries | ✗ | Avoid - extra bytes, not needed |
| Async generators | ✗ | Use Promise chains instead |
| Optional chaining (?.) | ✗ | AVOID — not available on legacy WebKit (pre-2020 devices) |
| Nullish coalescing (??) | ✗ | AVOID — not available on legacy WebKit (pre-2020 devices) |

### CSS Compatibility Notes

| CSS Feature | legacy mobile Safari | Prefix Required |
|-------------|--------|-----------------|
| backdrop-filter | ✓ | `-webkit-backdrop-filter` |
| user-select | ✓ | `-webkit-user-select` |
| appearance | ✓ | `-webkit-appearance` |
| transform | ✓ | Not needed |
| transition | ✓ | Not needed |
| box-shadow | ✓ | Not needed |
| border-radius | ✓ | Not needed |

### Device Testing

**Minimum Devices**:
- iPhone 6S or newer (A9 chip, 2015+)
- iPad Air 2 or newer (A8X chip, 2014+)
- any device with a legacy WebKit browser

**Network Conditions Tested**:
- 3G: ~400 Kbps, 100ms latency
- 4G: ~10 Mbps, 30ms latency
- WiFi: 50+ Mbps, <10ms latency

## Data Model (v4 Schema)

### Room Structure with Sections

Starting in v1.4, rooms support a **sections** array that groups related items. This allows for logical organization of items within a room.

**Schema v4 Features**:
- Each room contains `sections: [{id, title, items:[]}]` instead of direct `items[]`
- Sections provide organizational hierarchy
- Backward compatibility: v3 rooms with `items[]` are auto-migrated to a default section

**Auto-Migration from v3 to v4**:
When loading a configuration with v3 format (rooms containing `items[]` directly), the system automatically migrates to v4:
- Creates a single section with `id: "sec_default"` and `title: ""` (empty)
- All `items[]` from v3 are moved into this default section
- Migration happens transparently on first load
- Original config file is not modified

**Schema v4 Example**:
```json
{
  "version": 4,
  "header_sensors": [
    {
      "entity_id": "sensor.temperature",
      "icon": "mdi:thermometer",
      "label": "Temp"
    }
  ],
  "overview": {
    "title": "Overview",
    "items": [
      {
        "type": "entity",
        "entity_id": "light.main",
        "label": "Main Light",
        "icon": "mdi:bulb"
      }
    ]
  },
  "rooms": [
    {
      "id": "living_room",
      "title": "Living Room",
      "icon": "mdi:sofa",
      "hidden": false,
      "sections": [
        {
          "id": "sec_lights",
          "title": "Lights",
          "items": [
            {
              "type": "entity",
              "entity_id": "light.ceiling",
              "label": "Ceiling Light",
              "icon": "mdi:bulb",
              "hidden": false
            },
            {
              "type": "entity",
              "entity_id": "light.table",
              "label": "Table Lamp"
            }
          ]
        },
        {
          "id": "sec_climate",
          "title": "Climate",
          "items": [
            {
              "type": "entity",
              "entity_id": "climate.thermostat",
              "label": "Thermostat"
            }
          ]
        }
      ]
    }
  ],
  "scenarios": []
}
```

## Configuration Schema

### options.json Structure (Legacy v1.0-v1.3 Format)

```json
{
  "ha_url": "ws://homeassistant:8123",
  "ha_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",

  "panels": [
    {
      "name": "Living Room",
      "icon": "mdi:sofa",
      "rows": [
        {
          "cols": [
            {
              "entity_id": "light.living_room",
              "size": "medium",
              "name": "Main Light",
              "show_state": true
            }
          ]
        },
        {
          "cols": [
            {
              "entity_id": "light.lamp",
              "size": "small"
            },
            {
              "entity_id": "switch.fan",
              "size": "small"
            }
          ]
        }
      ]
    }
  ],

  "service_whitelist": [
    {"domain": "light", "service": "turn_on"},
    {"domain": "light", "service": "turn_off"},
    {"domain": "light", "service": "toggle"},
    {"domain": "light", "service": "turn_on", "service_data_schema": {
      "brightness": "integer(0-255)"
    }},
    {"domain": "switch", "service": "turn_on"},
    {"domain": "switch", "service": "turn_off"},
    {"domain": "switch", "service": "toggle"}
  ],

  "layout_config": {
    "tile_size_px": 80,
    "grid_gap_px": 8,
    "show_state_labels": true,
    "state_label_position": "bottom"
  }
}
```

### Entity Configuration Options

**Common Options** (all entity types):
- `entity_id` (string, required) - HA entity ID
- `name` (string) - Display name (defaults to entity friendly_name from HA)
- `size` (string) - "small", "medium", or "large"
- `show_state` (boolean) - Display state label on tile
- `icon` (string) - MDI icon code (overrides entity icon)
- `hidden` (boolean) - Hide this tile

**Light-Specific Options**:
- `show_brightness` (boolean) - Show brightness slider
- `brightness_control` (string) - "slider" or "buttons"
- `show_color_picker` (boolean) - Show color selection (future)

**Switch-Specific Options**:
- `confirm_before_toggle` (boolean) - Show confirmation dialog

**Sensor-Specific Options**:
- `show_history` (boolean) - Show sparkline history (future)
- `precision` (integer) - Decimal places for display

## Entity Types

### Light Entity

**HA Entity Domain**: `light.*`

**Supported Attributes**:
- `state`: "on" or "off"
- `brightness`: 0-255
- `color_temp`: color temperature in mireds (153-500)
- `xy_color`: [x, y] coordinates
- `rgb_color`: [r, g, b] 0-255
- `hs_color`: [h, s] (0-360, 0-100)
- `supported_features`: bitmask indicating available controls (BRIGHTNESS=1, COLOR_TEMP=2, COLOR=16)

**Service Calls**:
- `light/turn_on` → `{entity_id, brightness?, color_temp?, rgb_color?, hs_color?, ...}`
- `light/turn_off` → `{entity_id}`
- `light/toggle` → `{entity_id}`

**Tile Rendering**:
- 120px tile with dynamic background tint
- Short tap: toggle on/off
- Long press (500ms+): open bottom sheet for advanced controls
- Brightness shown as "XX%" in tile-value (empty when OFF)
- `.light-tint` div overlay shows dynamic color based on:
  - RGB color converted to hex
  - Color temp (mireds) converted to Kelvin gradient
- Bottom sheet sections shown based on `supported_features`:
  - BRIGHTNESS (bit 1): brightness slider
  - COLOR_TEMP (bit 2): color temperature slider
  - COLOR (bit 16): hue slider + 8 color presets
- Live tile color updates while adjusting sliders
- Service calls debounced to 300ms to avoid flooding HA

### Switch Entity

**HA Entity Domain**: `switch.*`

**Supported Attributes**:
- `state`: "on" or "off"
- `icon`: MDI icon code

**Service Calls**:
- `switch/turn_on` → `{entity_id}`
- `switch/turn_off` → `{entity_id}`
- `switch/turn_toggle` → `{entity_id}`

**Tile Rendering**:
- Toggle button with on/off state
- Icon and name
- Simple binary visual (on = highlighted, off = greyed)

### Sensor Entity

**HA Entity Domain**: `sensor.*`

**Supported Attributes**:
- `state`: string (numeric or text)
- `unit_of_measurement`: "°C", "%", etc.
- `icon`: MDI icon code

**Service Calls**: None (read-only)

**Tile Rendering**:
- Read-only display
- State value + unit
- Icon
- No interactive elements

### Binary Sensor Entity

**HA Entity Domain**: `binary_sensor.*`

**Supported Attributes**:
- `state`: "on" or "off"
- `device_class`: "motion", "window", "door", etc.

**Service Calls**: None (read-only)

**Tile Rendering**:
- Status indicator showing on/off
- Device class icon (motion → motion detector icon)
- Updated in real-time via WebSocket

### Cover Entity

**HA Entity Domain**: `cover.*` (future)

**Supported Attributes**:
- `state`: "open", "closed", or "opening" / "closing"
- `current_position`: 0-100
- `supported_features`: determines available actions

**Service Calls**:
- `cover/open_cover`
- `cover/close_cover`
- `cover/stop_cover`
- `cover/set_cover_position` → `{entity_id, position}`

**Tile Rendering** (future):
- Open/Close/Stop buttons
- Position slider if position attribute present
- State label (opening, closing, etc.)

### Input Boolean Entity

**HA Entity Domain**: `input_boolean.*` (future)

**Supported Attributes**:
- `state`: "on" or "off"

**Service Calls**:
- `input_boolean/turn_on`
- `input_boolean/turn_off`
- `input_boolean/toggle`

**Tile Rendering** (future):
- Toggle button similar to switch
- User-defined friendly name

### Input Select Entity

**HA Entity Domain**: `input_select.*` (future)

**Supported Attributes**:
- `state`: current option
- `options`: list of available options

**Service Calls**:
- `input_select/select_option` → `{entity_id, option}`

**Tile Rendering** (future):
- Dropdown or button group showing options
- Current selection highlighted

---

**Document Version**: 1.3
**Last Updated**: 2026-03-24
**Maintainer**: Retro Panel Team

**Recent Updates (v1.3)**:
- Added Data Model (v4 Schema) section documenting room sections structure
- Documented backward compatibility: v3 rooms with `items[]` auto-migrate to v4
- Added schema v4 example with sections, header_sensors, overview, and scenarios
- Updated Configuration Schema section to note legacy format is from v1.0-v1.3
- Clarified version bumping from v3 to v4 with section introduction
