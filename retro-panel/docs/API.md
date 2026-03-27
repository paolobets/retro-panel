# Retro Panel - Internal API Reference

## Overview

This document describes the internal APIs of Retro Panel v2.0, including:
- Backend REST endpoints
- WebSocket message protocol
- Frontend module APIs
- Component interface (layout_type system)

**Note**: This is for developers modifying Retro Panel itself, not for users configuring it.

---

## Backend REST Endpoints

All endpoints listen on `localhost:7654` (local development) or via HA Ingress in production.

### GET /

**Description**: Serve main application HTML (dashboard at /)

**Request**:
```
GET / HTTP/1.1
Host: localhost:7654
```

**Response**:
```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 5234

<!DOCTYPE html>
<html>
  <head>
    <title>Retro Panel</title>
    ...
  </head>
  <body>
    <div id="app"></div>
    <script src="/static/js/app.js"></script>
  </body>
</html>
```

**Response Schema**:
- Status: 200 (always)
- Body: HTML document with embedded CSS and deferred JS
- Cache: No cache headers (always fresh)

**Error Handling**: No errors possible (static file)

---

### GET /config

**Description**: Serve configuration UI HTML (admin interface)

**Request**:
```
GET /config HTTP/1.1
Host: localhost:7654
```

**Response**: HTML with config editor interface (same HTML as /, router handles client-side)

---

### GET /static/{path}

**Description**: Serve static assets (JS, CSS, images)

**Request**:
```
GET /static/js/app.js HTTP/1.1
Host: localhost:7654
```

**Response**:
```
HTTP/1.1 200 OK
Content-Type: application/javascript
Content-Length: 3421

// JavaScript code
```

**Response Schema**:
- Status: 200 OK (file found) or 404 NOT FOUND
- Content-Type: Determined by file extension
  - `.js` → `application/javascript`
  - `.css` → `text/css`
  - `.png` → `image/png`
  - etc.
- Body: Raw file contents
- Cache: No cache headers

**Error Handling**:
```
GET /static/nonexistent.js HTTP/1.1

HTTP/1.1 404 Not Found
Content-Type: text/plain

File not found: static/nonexistent.js
```

---

### GET /api/panel-config

**Description**: Fetch panel configuration (v2.0 format with overview, rooms, scenarios, cameras)

**Request**:
```
GET /api/panel-config HTTP/1.1
Host: localhost:7654
Accept: application/json
```

**Response** (v2.0):
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "version": 2,
  "overview": {
    "title": "Home",
    "items": [
      {
        "type": "entity",
        "entity_id": "light.living_room",
        "label": "Living Room",
        "icon": "",
        "hidden": false,
        "visual_type": "",
        "device_class": "light",
        "layout_type": "light"
      }
    ]
  },
  "rooms": [
    {
      "id": "room_soggiorno",
      "title": "Soggiorno",
      "icon": "living",
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
              "icon": "",
              "hidden": false,
              "device_class": "light",
              "layout_type": "light"
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
      "hidden": false
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

**Response Schema** (v2.0):
```typescript
{
  version: 2;                       // Schema version (v2.0)
  overview: {
    title: string;                  // "Home" or custom
    items: Array<Entity>;           // Entities on home screen
  };
  rooms: Array<{
    id: string;                     // Room unique identifier
    title: string;                  // Room display name
    icon: string;                   // Icon identifier (e.g., "living")
    hidden: boolean;                // Hide entire room
    sections: Array<{
      id: string;                   // Section unique identifier
      title: string;                // Section title
      items: Array<Entity>;         // Entities in section
    }>;
  }>;
  scenarios: Array<Entity>;         // Scene/script/automation entities
  cameras: Array<{
    entity_id: string;              // Camera entity ID
    label: string;                  // Display name
    hidden: boolean;                // Hide this camera
    refresh_interval: number;       // Refresh rate in seconds
  }>;
}
```

**Entity Item Schema**:
```typescript
{
  type: "entity";                   // Always "entity" in v2.0
  entity_id: string;                // HA entity ID
  label: string;                    // Display name override
  icon: string;                     // Icon override (empty = use HA icon)
  hidden: boolean;                  // Hide this item
  visual_type: string;              // Visual override (empty = computed)
  device_class: string;             // HA device_class from entity
  layout_type: string;              // Computed by backend: light|switch|sensor_temperature|sensor_humidity|... (15 types)
}
```

**Error Handling**:
```
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "Config validation failed",
  "details": "Missing required field: id in rooms[0]"
}
```

**Caching**: No caching (config might change)

**Frequency**: Called once on page load

---

### GET /api/states/all

**Description**: Fetch states of all entities (used on page load)

**Request**:
```
GET /api/states/all HTTP/1.1
Host: localhost:7654
Accept: application/json
```

**Response**:
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "light.bedroom": {
    "entity_id": "light.bedroom",
    "state": "on",
    "last_updated": "2026-03-27T15:30:45.123Z",
    "attributes": {
      "brightness": 200,
      "color_temp": 380,
      "friendly_name": "Bedroom Light",
      "supported_color_modes": ["color_temp", "hs"],
      "device_class": "light"
    }
  },
  ...
}
```

**Response Schema**:
```typescript
{
  [entity_id: string]: {
    entity_id: string;
    state: string;
    last_updated: string;
    attributes: { [key: string]: any };
  };
}
```

**Error Handling**:
```
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "Failed to fetch states from Home Assistant",
  "details": "Connection timeout"
}
```

**Caching**: No caching

**Frequency**: Called once on page load, then uses WebSocket for updates

---

### GET /api/entities

**Description**: Fetch the list of HA entities available for the config-page entity picker.

**Request**:
```
GET /api/entities HTTP/1.1
Host: localhost:7654
Accept: application/json
```

**Optional query parameter**:
- `?domain=<domain>` — restrict to a single allowed domain. Returns 400 if not in allowed set.

**Response**:
```
HTTP/1.1 200 OK
Content-Type: application/json

[
  {
    "entity_id": "light.soggiorno",
    "friendly_name": "Soggiorno",
    "domain": "light",
    "device_class": "",
    "unit": ""
  }
]
```

**Filtering applied server-side**:
1. Only entities in the allowed domains are included.
2. Entities with `hidden_by` or `disabled_by` set in the HA entity registry are excluded.
3. Results are sorted alphabetically by `entity_id`.

**Frequency**: Called on config-page load and when the entity picker is opened.

---

### POST /api/config

**Description**: Update panel configuration (v2.0 format)

**Request**:
```
POST /api/config HTTP/1.1
Host: localhost:7654
Content-Type: application/json

{
  "version": 2,
  "overview": {
    "title": "Home",
    "items": [...]
  },
  "rooms": [...],
  "scenarios": [...],
  "cameras": [...]
}
```

**Response**:
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Configuration updated",
  "version": 2
}
```

**Error Handling**:
```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Config validation failed",
  "details": "Missing required field: title in overview"
}
```

**Frequency**: Called when user saves configuration changes in config editor

---

### POST /api/service/{domain}/{service}

**Description**: Call a Home Assistant service

**Request**:
```
POST /api/service/light/turn_on HTTP/1.1
Host: localhost:7654
Content-Type: application/json

{
  "entity_id": "light.bedroom",
  "brightness": 200,
  "transition": 1
}
```

**Request Schema**:
```typescript
{
  entity_id: string;   // Required: which entity to target
  [key: string]: any;  // Additional service-specific parameters
}
```

**Response**:
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "service": "light/turn_on",
  "entity_id": "light.bedroom",
  "service_data": {
    "entity_id": "light.bedroom",
    "brightness": 200
  }
}
```

**Error Handling - Not in Whitelist**:
```
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Service not allowed",
  "service": "light/invalid_service",
  "reason": "Service not in whitelist"
}
```

**Common Services**:

| Service | Parameters | Example |
|---------|-----------|---------|
| `light/turn_on` | `entity_id`, `brightness?`, `color_temp?` | `{entity_id, brightness: 100}` |
| `light/turn_off` | `entity_id` | `{entity_id}` |
| `light/toggle` | `entity_id` | `{entity_id}` |
| `switch/turn_on` | `entity_id` | `{entity_id}` |
| `switch/turn_off` | `entity_id` | `{entity_id}` |
| `switch/toggle` | `entity_id` | `{entity_id}` |
| `scene/turn_on` | `entity_id` | `{entity_id}` |
| `script/turn_on` | `entity_id` | `{entity_id}` |
| `automation/trigger` | `entity_id` | `{entity_id}` |
| `alarm_control_panel/alarm_arm_home` | `entity_id`, `code?` | `{entity_id, code: "1234"}` |

**Frequency**: Called whenever user interacts with a control

---

### GET /ws

**Description**: WebSocket upgrade endpoint for real-time state updates

**Request**:
```
GET /ws HTTP/1.1
Host: localhost:7654
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13
```

**Upgrade Response**:
```
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

---

## WebSocket Message Protocol

### Server → Client Messages

#### State Changed Event

**Format**:
```json
{
  "type": "state_changed",
  "entity_id": "light.bedroom",
  "state": "on",
  "attributes": {
    "brightness": 200,
    "color_temp": 380,
    "friendly_name": "Bedroom Light",
    "device_class": "light"
  }
}
```

**Schema**:
```typescript
{
  type: "state_changed";
  entity_id: string;        // Which entity changed
  state: string;            // New state value
  attributes: {             // Full entity attributes
    [key: string]: any;
  };
}
```

**Frequency**: Sent whenever any entity state changes in Home Assistant

---

#### Connection Status

**Format**:
```json
{
  "type": "connection_status",
  "status": "ok",
  "timestamp": "2026-03-27T15:30:45.123Z"
}
```

**Schema**:
```typescript
{
  type: "connection_status";
  status: "ok" | "reconnecting" | "error";
  timestamp: string;  // ISO 8601
  error?: string;     // Error message if status is "error"
}
```

**Frequency**: Sent after initial connection, then periodically (every 30 seconds) to confirm connection is alive

---

### Client → Server Messages

**Current Implementation**: None (v2.0 is server-push only)

---

## Frontend Module APIs

### app.js Module

Main application entry point, handles routing and component rendering.

#### window.AppState

Central state container.

**Shape**:
```javascript
{
  states: {
    [entityId]: { state: string, attributes: object }
  },
  connectionStatus: "connected" | "reconnecting" | "disconnected",
  tileMap: { [entityId]: HTMLElement }  // DOM elements by entity
}
```

#### window.AppState.updateEntityState(entityId, newState)

**Signature**:
```javascript
function updateEntityState(entityId, newState) {
  AppState.states[entityId] = newState;
  var tile = AppState.tileMap[entityId];
  if (tile) {
    var layoutType = tile.dataset.layoutType || 'sensor_generic';
    var component = window.RP_Renderer.getComponent(layoutType);
    if (component) {
      component.updateTile(tile, newState);
    }
  }
}
```

---

### renderer.js Module

Handles component selection and rendering based on layout_type.

#### window.RP_Renderer.init()

**Description**: Initialize renderer and resolve all components

**Signature**:
```javascript
window.RP_Renderer.init();
```

---

#### window.RP_Renderer.renderActiveSection(appState)

**Description**: Render current section/room to #content-area

**Signature**:
```javascript
window.RP_Renderer.renderActiveSection(appState);
```

---

#### window.RP_Renderer.getComponent(layoutType)

**Description**: Get component module for a layout_type

**Signature**:
```javascript
var component = window.RP_Renderer.getComponent('light');
// Returns { createTile, updateTile } or null
```

**Layout Types** (15 total in v2.0):
```
light                  // light.*
switch                 // switch.*, input_boolean.*
sensor_temperature     // sensor.* with device_class: temperature
sensor_humidity        // sensor.* with device_class: humidity
sensor_co2             // sensor.* with device_class: co2/carbon_dioxide
sensor_battery         // sensor.* with device_class: battery
sensor_energy          // sensor.* with device_class: power/energy
sensor_generic         // sensor.* (other)
binary_door            // binary_sensor.* with device_class: door/window
binary_motion          // binary_sensor.* with device_class: motion/occupancy
binary_standard        // binary_sensor.* (other)
alarm                  // alarm_control_panel.*
camera                 // camera.*
scenario               // scene.*, script.*, automation.*
energy_flow            // (energy card widget)
```

---

### Component Interface (all components)

Each component exports the same interface for consistency.

#### createTile(entityConfig)

**Signature**:
```javascript
function createTile(entityConfig) {
  // entityConfig has:
  // - entity_id (required)
  // - label (display name)
  // - icon (override icon)
  // - layout_type (light, switch, sensor_temperature, etc.)
  // - device_class (HA device class)
  // - visual_type (override)

  var tile = document.createElement('div');
  tile.className = 'tile tile-light';
  tile.dataset.layoutType = entityConfig.layout_type;
  tile.dataset.entityId = entityConfig.entity_id;

  // Create DOM...
  return tile;
}
```

**Requirements**:
- Must set `tile.dataset.layoutType` for app.js to locate component
- Must set `tile.dataset.entityId`
- Must apply `tile-{layout_type}` CSS class
- Must use `entityConfig.label` as display name
- Must return single root element

---

#### updateTile(tile, stateObj)

**Signature**:
```javascript
function updateTile(tile, stateObj) {
  // stateObj has: { state, attributes }
  tile.dataset.state = stateObj.state;

  // Update DOM based on new state
  var stateDiv = tile.querySelector('.tile-state');
  stateDiv.textContent = stateObj.state;

  // Update CSS state classes
  tile.classList.toggle('is-on', stateObj.state === 'on');
  tile.classList.toggle('is-off', stateObj.state === 'off');
  tile.classList.toggle('is-unavail', stateObj.state === 'unavailable');
}
```

**Requirements**:
- Must update appearance to reflect new state
- Should set `tile.dataset.state`
- Should update CSS state classes (`is-on`, `is-off`, `is-unavail`)
- Should be fast (< 50ms)
- Should not recreate DOM, only mutate

---

### bottom-sheet.js Module

Floating sheet UI for light controls (brightness, color temp, hue).

#### window.RP_BottomSheet.open(entityId, label, attributes)

**Signature**:
```javascript
window.RP_BottomSheet.open(
  entityId,      // "light.bedroom"
  label,         // "Bedroom Light"
  attributes     // { brightness, color_temp, ... }
);
```

**Behavior**:
- Opens sheet from bottom with animation
- Displays brightness slider (if brightness attribute exists)
- Displays color temperature slider (if color_temp attribute exists)
- Displays hue/saturation picker (if hs_color attribute exists)
- On slider change: calls `api.callService('light', 'turn_on', {...})`
- On close: animated slide-down and removal from DOM

**Example**:
```javascript
window.RP_BottomSheet.open(
  'light.bedroom',
  'Bedroom Light',
  {
    brightness: 200,
    color_temp: 380,
    supported_color_modes: ['color_temp', 'hs']
  }
);
```

---

#### window.RP_BottomSheet.close()

**Signature**:
```javascript
window.RP_BottomSheet.close();
```

**Behavior**: Closes sheet with animation

---

### nav.js Module

Sidebar navigation management.

#### window.RP_Nav.selectSection(sectionId)

**Signature**:
```javascript
window.RP_Nav.selectSection('room_living', 'sec_lights');
```

**Behavior**: Updates sidebar highlight, renders section content

---

### api.js Module

Handles all HTTP REST API communication.

#### window.callService(domain, service, serviceData)

**Signature**:
```javascript
async function callService(domain, service, serviceData) {
  // Returns Promise
}
```

**Example**:
```javascript
await window.callService('light', 'turn_on', {
  entity_id: 'light.bedroom',
  brightness: 200
});
```

---

#### window.getAllStates()

**Signature**:
```javascript
async function getAllStates() {
  // Returns { [entityId]: { state, attributes } }
}
```

---

#### window.getPanelConfig()

**Signature**:
```javascript
async function getPanelConfig() {
  // Returns { version, overview, rooms, scenarios, cameras }
}
```

---

## CSS Design System (v2.0)

### CSS Files

```
app/static/css/
├── tokens.css       — CSS variables: --c-bg, --c-surface, --c-accent, etc.
├── layout.css       — sidebar 200px, header 56px, content-area, .hidden class
├── tiles.css        — triple-lock tile dimensions, .tile-row/.tile-col-* flexbox
└── bottom-sheet.css — overlay + sheet transform animation
```

### Tile Dimensions (Triple-Lock - Immutable)

```css
.tile-light  { height: 120px; min-height: 120px; max-height: 120px; }
.tile-switch { height: 120px; min-height: 120px; max-height: 120px; }
.tile-sensor { min-height: 72px; }
.tile-alarm  { min-height: 240px; }
.tile-camera { min-height: 160px; }
.tile-scenario { min-height: 110px; }
```

### Column System

```css
.tile-row { display: flex; flex-wrap: wrap; }
.tile-col-compact { width: 33.333%; }  /* light, switch, scenario */
.tile-col-sensor  { width: 50%; }      /* all sensor variants, binary */
.tile-col-full    { width: 100%; }     /* alarm, camera, energy_flow */

/* @media (max-width: 599px): compact→50%, sensor→100% */
/* @media landscape ≥1024px: compact→25%, sensor→33.333% */
```

### State Classes

```css
.is-on       { /* entity is on/active */ }
.is-off      { /* entity is off */ }
.is-unavail  { /* entity is unavailable/unknown */ }
```

---

**Document Version**: 2.0
**Last Updated**: 2026-03-27
**Maintainer**: Retro Panel Team
