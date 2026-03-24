# Retro Panel - Internal API Reference

## Overview

This document describes the internal APIs of Retro Panel, including:
- Backend REST endpoints
- WebSocket message protocol
- Frontend module APIs
- Component interface

**Note**: This is for developers modifying Retro Panel itself, not for users configuring it.

---

## Backend REST Endpoints

All endpoints listen on `localhost:7654` (local development) or via HA Ingress in production.

### GET /

**Description**: Serve main application HTML

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
    <script src="/js/app.js"></script>
  </body>
</html>
```

**Response Schema**:
- Status: 200 (always)
- Body: HTML document with embedded CSS and deferred JS
- Cache: No cache headers (always fresh)

**Error Handling**: No errors possible (static file)

**Caching**: Disabled (development requires fresh content)

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

**Caching**: No caching in v1.0 (all requests fetch fresh)

---

### GET /api/panel-config

**Description**: Fetch panel configuration (layout, entity list, etc.)

**Request**:
```
GET /api/panel-config HTTP/1.1
Host: localhost:7654
Accept: application/json
```

**Response** (v1.4+ with sections):
```
HTTP/1.1 200 OK
Content-Type: application/json
Content-Length: 3156

{
  "version": 4,
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
              "entity_id": "light.ceiling",
              "size": "medium",
              "name": "Ceiling Light",
              "show_state": true,
              "icon": "mdi:ceiling-light",
              "hidden": false
            }
          ]
        }
      ]
    }
  ],
  "layout_config": {
    "tile_size_px": 80,
    "grid_gap_px": 8,
    "show_state_labels": true,
    "state_label_position": "bottom"
  }
}
```

**Response Schema** (v1.4+):
```typescript
{
  version: 4;                      // Schema version
  rooms: Array<{
    id: string;                    // Room unique identifier
    title: string;                 // Room display name
    icon?: string;                 // MDI icon code
    hidden?: boolean;              // Hide entire room
    sections: Array<{
      id: string;                  // Section unique identifier
      title: string;               // Section title (may be empty)
      items: Array<{
        entity_id: string;         // HA entity ID (required)
        size?: "small" | "medium" | "large";  // Tile size
        name?: string;             // Override display name
        show_state?: boolean;      // Show state label
        icon?: string;             // Override entity icon
        hidden?: boolean;          // Hide this item
        // Entity-type-specific options:
        show_brightness?: boolean; // Light only
        confirm_before_toggle?: boolean;  // Switch only
        show_history?: boolean;    // Sensor only (future)
      }>;
    }>;
  }>;
  layout_config: {
    tile_size_px: number;         // Tile size in pixels
    grid_gap_px: number;          // Gap between tiles
    show_state_labels: boolean;   // Global toggle for state labels
    state_label_position: "bottom" | "overlay";  // Where to show state
  };
}
```

**Backward Compatibility**:
- v3 configurations (with `items[]` instead of `sections[]`) are automatically migrated to v4 on first load
- Returned response always uses v4 format with sections
- Old client code expecting legacy format will need update

**Legacy Response** (v1.0-v1.3, deprecated):
```
{
  "panels": [
    {
      "name": "Living Room",
      "icon": "mdi:sofa",
      "rows": [...]
    }
  ],
  "layout_config": {...}
}
```

**Error Handling**:
```
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "Config validation failed",
  "details": "Missing required field: id in rooms[0].sections[0]"
}
```

**Caching**: No caching (config might change)

**Frequency**: Called once on page load

---

### GET /api/state/{entity_id}

**Description**: Fetch current state of a single entity

**Request**:
```
GET /api/state/light.bedroom HTTP/1.1
Host: localhost:7654
Accept: application/json
```

**Response**:
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "entity_id": "light.bedroom",
  "state": "on",
  "last_updated": "2026-03-22T15:30:45.123Z",
  "attributes": {
    "brightness": 200,
    "color_temp": 380,
    "friendly_name": "Bedroom Light",
    "supported_color_modes": ["color_temp", "hs"],
    "min_color_mireds": 153,
    "max_color_mireds": 500
  }
}
```

**Response Schema**:
```typescript
{
  entity_id: string;        // HA entity ID
  state: string;            // Current state ("on", "off", numeric, etc.)
  last_updated: string;     // ISO 8601 timestamp
  attributes: {
    [key: string]: any;     // Entity-specific attributes
    friendly_name?: string;
    icon?: string;
    unit_of_measurement?: string;
    // Light-specific:
    brightness?: number;    // 0-255
    color_temp?: number;    // Mireds
    rgb_color?: [number, number, number];
    hs_color?: [number, number];
    xy_color?: [number, number];
    // Binary sensor-specific:
    device_class?: string;  // "motion", "window", "door", etc.
  };
}
```

**Error Handling**:
```
GET /api/state/nonexistent.entity HTTP/1.1

HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "Entity not found",
  "entity_id": "nonexistent.entity"
}
```

**Caching**: No caching (state changes frequently)

**Frequency**: Rarely called (use WebSocket for real-time updates)

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
    "last_updated": "2026-03-22T15:30:45.123Z",
    "attributes": {...}
  },
  "light.living_room": {
    "entity_id": "light.living_room",
    "state": "off",
    "last_updated": "2026-03-22T15:29:12.456Z",
    "attributes": {...}
  },
  "switch.fan": {...},
  "sensor.temperature": {...},
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
- `?domain=<domain>` — restrict to a single allowed domain (e.g. `sensor`). Returns 400 if the domain is not in the allowed set (`light`, `switch`, `sensor`, `binary_sensor`, `alarm_control_panel`).

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
2. Entities with `hidden_by` or `disabled_by` set in the HA entity registry are excluded (cross-referenced via `GET /api/config/entity_registry`). If the registry call fails, the filter is skipped and a warning is logged (graceful fallback).
3. Results are sorted alphabetically by `entity_id`.

**Error responses**:

| Status | Condition |
|--------|-----------|
| 400 | `?domain=` value is not in the allowed set |
| 502 | HA template API call failed or returned invalid JSON |
| 503 | HA client not available |

**Frequency**: Called on config-page load and when the entity picker is opened.

---

### POST /api/config

**Description**: Update panel configuration with new rooms and sections structure (v1.4+)

**Request**:
```
POST /api/config HTTP/1.1
Host: localhost:7654
Content-Type: application/json

{
  "version": 4,
  "rooms": [
    {
      "id": "living_room",
      "title": "Living Room",
      "icon": "mdi:sofa",
      "sections": [
        {
          "id": "sec_lights",
          "title": "Lights",
          "items": [
            {
              "entity_id": "light.ceiling",
              "name": "Ceiling Light",
              "icon": "mdi:bulb"
            }
          ]
        }
      ]
    }
  ],
  "layout_config": {
    "tile_size_px": 80,
    "grid_gap_px": 8,
    "show_state_labels": true
  }
}
```

**Request Schema**:
```typescript
{
  version: 4;                      // Must be 4 for v1.4+
  rooms: Array<{
    id: string;                    // Unique room identifier
    title: string;                 // Room display name
    icon?: string;                 // MDI icon code
    hidden?: boolean;              // Hide room
    sections: Array<{
      id: string;                  // Unique section identifier
      title: string;               // Section title (can be empty)
      items: Array<{
        entity_id: string;         // HA entity ID (required)
        name?: string;             // Display name override
        icon?: string;             // Icon override
        size?: string;             // Tile size
        hidden?: boolean;          // Hide item
      }>;
    }>;
  }>;
  layout_config: object;           // Layout settings
}
```

**Response**:
```
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "Configuration updated",
  "version": 4
}
```

**Error Handling**:
```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Config validation failed",
  "details": "Missing required field: id in rooms[0].sections[0]"
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

**Response Schema** (success):
```typescript
{
  success: true;
  service: string;      // "{domain}/{service}"
  entity_id: string;    // Target entity
  service_data: object; // Data sent to HA
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

**Error Handling - Invalid Service Data**:
```
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Invalid service data",
  "service": "light/turn_on",
  "reason": "brightness must be 0-255, got 999"
}
```

**Error Handling - HA Error**:
```
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "Service call failed",
  "service": "light/turn_on",
  "ha_error": "Entity does not exist"
}
```

**Service Whitelist Validation**:
- Backend checks if `{domain, service}` exists in `service_whitelist`
- Returns 403 if not found
- Service data validated against schema (if provided)
- Returns 400 if validation fails

**Common Services**:

| Service | Parameters | Example |
|---------|-----------|---------|
| `light/turn_on` | `entity_id`, `brightness?`, `color_temp?` | `{entity_id, brightness: 100}` |
| `light/turn_off` | `entity_id` | `{entity_id}` |
| `light/toggle` | `entity_id` | `{entity_id}` |
| `switch/turn_on` | `entity_id` | `{entity_id}` |
| `switch/turn_off` | `entity_id` | `{entity_id}` |
| `switch/toggle` | `entity_id` | `{entity_id}` |
| `cover/open_cover` | `entity_id` | `{entity_id}` |
| `cover/close_cover` | `entity_id` | `{entity_id}` |
| `cover/set_cover_position` | `entity_id`, `position` | `{entity_id, position: 50}` |

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

**Connection Established**: WebSocket is now open and can receive messages

**Message Format**: All messages are JSON

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
    "friendly_name": "Bedroom Light"
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

**Example Sequence**:
```
1. Browser: GET /ws (upgrade to WebSocket)
2. Backend: Accept connection, register browser as subscriber
3. Home Assistant: Sends state_changed event (light turned on)
4. Backend: Receives event, broadcasts to all connected browsers
5. Browser: Receives {type: "state_changed", entity_id: "light.bedroom", state: "on", ...}
6. JavaScript: Calls updateEntityState("light.bedroom", "on", {...})
7. Browser: Updates tile visual appearance
```

#### Connection Status

**Format**:
```json
{
  "type": "connection_status",
  "status": "ok",
  "timestamp": "2026-03-22T15:30:45.123Z"
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

**Use Cases**:
- Initial confirmation: `status: "ok"` sent right after connection
- Heartbeat: Periodic `status: "ok"` to detect stale connections
- Error notification: `status: "error"` if HA connection lost

### Client → Server Messages

**Current Implementation**: None (v1.0 is server-push only)

**Future** (v2.0+): Could support client sending messages for actions like:
```json
{
  "type": "subscribe_entity",
  "entity_id": "light.bedroom"
}
```

---

## Frontend Module APIs

### api.js Module

Handles all HTTP REST API communication.

#### fetchPanelConfig()

**Signature**:
```javascript
async function fetchPanelConfig() → Promise<PanelConfig>
```

**Description**: Fetch panel layout and configuration

**Returns**:
```javascript
{
  panels: [
    {
      name: "Living Room",
      icon: "mdi:sofa",
      rows: [...]
    }
  ],
  layout_config: {...}
}
```

**Throws**:
- `Error` if network error (no response)
- `APIError` if server returns 4xx/5xx

**Example**:
```javascript
try {
  const config = await api.fetchPanelConfig();
  console.log(`Loaded ${config.panels.length} panels`);
} catch (err) {
  console.error('Failed to load config:', err.message);
}
```

#### fetchAllStates()

**Signature**:
```javascript
async function fetchAllStates() → Promise<EntityStates>
```

**Description**: Fetch current state of all entities

**Returns**:
```javascript
{
  "light.bedroom": {
    entity_id: "light.bedroom",
    state: "on",
    attributes: {...}
  },
  "switch.fan": {...},
  ...
}
```

**Throws**:
- `Error` if network error
- `APIError` if server returns 4xx/5xx

**Example**:
```javascript
const states = await api.fetchAllStates();
states.forEach((entityId, state) => {
  console.log(`${entityId}: ${state.state}`);
});
```

#### callService(domain, service, serviceData)

**Signature**:
```javascript
async function callService(
  domain: string,
  service: string,
  serviceData: object
) → Promise<ServiceResponse>
```

**Description**: Call a Home Assistant service

**Parameters**:
- `domain` (string): Service domain (e.g., "light", "switch")
- `service` (string): Service name (e.g., "turn_on", "turn_off")
- `serviceData` (object): Service parameters (must include `entity_id`)

**Returns**:
```javascript
{
  success: true,
  service: "light/turn_on",
  entity_id: "light.bedroom",
  service_data: {...}
}
```

**Throws**:
- `Error` if network error
- `ValidationError` if `serviceData` invalid
- `APIError` if service not in whitelist or HA returns error

**Example**:
```javascript
try {
  const result = await api.callService('light', 'turn_on', {
    entity_id: 'light.bedroom',
    brightness: 200
  });
  console.log('Service called successfully');
} catch (err) {
  if (err instanceof ValidationError) {
    console.error('Invalid service data:', err.message);
  } else if (err instanceof APIError) {
    console.error('API error:', err.message);
  } else {
    console.error('Network error:', err.message);
  }
}
```

#### getAbsoluteUrl(path)

**Signature**:
```javascript
function getAbsoluteUrl(path: string) → string
```

**Description**: Convert relative path to absolute URL (handles Ingress prefix)

**Parameters**:
- `path` (string): Relative path (e.g., "/api/panel-config")

**Returns**: Absolute URL (e.g., "http://localhost:7654/api/panel-config")

**Notes**:
- In local dev: `http://localhost:7654/api/panel-config`
- In HA Ingress: `http://homeassistant.local:8123/api/hassio_ingress/{slug}/api/panel-config`
- Automatically handles both cases

**Example**:
```javascript
const url = getAbsoluteUrl('/api/states/all');
// Returns correct URL depending on deployment context
```

---

### ws.js Module

Manages WebSocket connection to backend.

#### connectWS()

**Signature**:
```javascript
async function connectWS() → Promise<WebSocket>
```

**Description**: Establish WebSocket connection to server

**Returns**: Native WebSocket object

**Throws**:
- `Error` if connection fails

**Behavior**:
1. Creates WebSocket connection to `/ws` endpoint
2. Waits for `open` event
3. Registers message handlers
4. Returns WebSocket object

**Example**:
```javascript
try {
  const ws = await connectWS();
  console.log('WebSocket connected');
} catch (err) {
  console.error('Failed to connect:', err.message);
}
```

#### onStateChanged(handler)

**Signature**:
```javascript
function onStateChanged(
  handler: (entityId: string, state: string, attributes: object) => void
) → void
```

**Description**: Register callback for state change events

**Parameters**:
- `handler` (function): Called when any entity state changes
  - `entityId` (string): Which entity changed (e.g., "light.bedroom")
  - `state` (string): New state value (e.g., "on")
  - `attributes` (object): Full entity attributes

**Example**:
```javascript
ws.onStateChanged((entityId, state, attributes) => {
  console.log(`${entityId} changed to ${state}`);
  updateEntityUI(entityId, state, attributes);
});
```

#### reconnectWithBackoff()

**Signature**:
```javascript
async function reconnectWithBackoff() → Promise<WebSocket>
```

**Description**: Reconnect with exponential backoff

**Behavior**:
1. Initial delay: 1 second
2. If fails, wait 2 seconds, retry
3. Double delay each attempt: 1s, 2s, 4s, 8s, 30s (capped)
4. Max 30 second delay between retries
5. Continue retrying indefinitely

**Returns**: Connected WebSocket object

**Example**:
```javascript
const ws = await reconnectWithBackoff();
console.log('Reconnected successfully');
```

#### disconnect()

**Signature**:
```javascript
function disconnect() → void
```

**Description**: Clean WebSocket closure

**Behavior**:
1. Close WebSocket connection gracefully
2. Remove all event listeners
3. Clean up resources

**Example**:
```javascript
ws.disconnect();
```

---

### state.js Module (AppState)

Central state container for application.

#### State Shape

```javascript
{
  entities: {
    [entityId]: {
      state: string,           // Current state
      attributes: object,      // HA attributes
      lastUpdated: timestamp,  // Unix milliseconds
      config: entityConfig     // Panel config for this entity
    }
  },
  connectionStatus: "connected" | "reconnecting" | "disconnected",
  lastSyncTime: timestamp,
  panelConfig: {
    title: string,
    rows: Array,
    ...
  }
}
```

#### updateEntityState(entityId, newState, newAttributes)

**Signature**:
```javascript
function updateEntityState(
  entityId: string,
  newState: string,
  newAttributes: object
) → void
```

**Description**: Update entity state in AppState

**Side Effects**:
- Updates AppState object
- Calls all registered subscribers
- Updates `lastUpdated` timestamp

**Example**:
```javascript
state.updateEntityState('light.bedroom', 'on', {
  brightness: 200,
  color_temp: 380
});
```

#### getEntity(entityId)

**Signature**:
```javascript
function getEntity(entityId: string) → Entity | null
```

**Description**: Retrieve entity object from state

**Returns**: Entity object or null if not found

**Example**:
```javascript
const entity = state.getEntity('light.bedroom');
if (entity) {
  console.log(entity.state);  // "on" or "off"
}
```

#### getPanel()

**Signature**:
```javascript
function getPanel() → PanelConfig
```

**Description**: Get panel configuration

**Example**:
```javascript
const panelConfig = state.getPanel();
console.log(panelConfig.rows);
```

#### setConnectionStatus(status)

**Signature**:
```javascript
function setConnectionStatus(
  status: "connected" | "reconnecting" | "disconnected"
) → void
```

**Description**: Update connection status indicator

**Side Effects**:
- Updates AppState.connectionStatus
- Calls all registered subscribers
- UI updates to show connection indicator

**Example**:
```javascript
state.setConnectionStatus('reconnecting');
```

#### subscribe(callback)

**Signature**:
```javascript
function subscribe(
  callback: (updatedState: AppState) => void
) → () => void  // Returns unsubscribe function
```

**Description**: Register listener for state changes

**Returns**: Unsubscribe function (call to remove listener)

**Example**:
```javascript
const unsubscribe = state.subscribe((appState) => {
  console.log('State updated:', appState);
  renderUI(appState);
});

// Later, remove listener:
unsubscribe();
```

---

## Component Interface

Each entity type has a component module defining how to render and interact with that entity.

### Component Module Exports

#### createTile(config, state)

**Signature**:
```javascript
export function createTile(
  config: EntityConfig,
  state: EntityState
) → HTMLElement
```

**Description**: Create DOM element for this entity type

**Parameters**:
- `config` (object): Entity configuration from panel config
  ```javascript
  {
    entity_id: "light.bedroom",
    size: "medium",
    name: "Bedroom Light",
    show_state: true,
    icon: "mdi:ceiling-light"
    // Entity-type-specific options
  }
  ```

- `state` (object): Current entity state from HA
  ```javascript
  {
    state: "on",
    attributes: {
      brightness: 200,
      color_temp: 380,
      friendly_name: "Bedroom Light"
    }
  }
  ```

**Returns**: HTMLElement (should be a single root element, e.g., `<div class="tile">`)

**Requirements**:
- Must set `element.dataset.entityId = config.entity_id`
- Must apply appropriate CSS classes (e.g., `tile`, `tile-light`)
- Should use `config.icon` if provided, else entity's icon
- Should use `config.name` if provided, else `state.attributes.friendly_name`
- Visual appearance should match `state.state` value

**Example**:
```javascript
export function createTile(config, state) {
  const tile = document.createElement('div');
  tile.className = 'tile tile-light';
  tile.dataset.entityId = config.entity_id;

  tile.innerHTML = `
    <div class="tile-name">${config.name}</div>
    <div class="tile-state">${state.state}</div>
  `;

  // Add event listeners for interactions
  tile.addEventListener('click', () => {
    handleInteraction(config.entity_id, { type: 'toggle' });
  });

  return tile;
}
```

#### updateTile(element, state)

**Signature**:
```javascript
export function updateTile(
  element: HTMLElement,
  state: EntityState
) → void
```

**Description**: Update tile DOM based on new state

**Parameters**:
- `element` (HTMLElement): Element returned from `createTile()`
- `state` (object): New entity state

**Requirements**:
- Must update appearance to reflect new state
- Should update `element.dataset.state = state.state`
- Should be fast (< 50ms)
- Should not recreate DOM, only mutate

**Example**:
```javascript
export function updateTile(element, state) {
  element.dataset.state = state.state;
  const stateDiv = element.querySelector('.tile-state');
  stateDiv.textContent = state.state;

  // Update styling
  element.classList.toggle('is-on', state.state === 'on');
  element.classList.toggle('is-off', state.state === 'off');
}
```

#### handleInteraction(entityId, action)

**Signature**:
```javascript
export function handleInteraction(
  entityId: string,
  action: InteractionAction
) → Promise<void>
```

**Description**: Handle user interaction with tile

**Parameters**:
- `entityId` (string): Which entity was interacted with
- `action` (object): What action the user initiated
  ```javascript
  {
    type: "toggle",  // or "set_brightness", "set_color", etc.
    value?: number,  // Optional value (e.g., brightness level)
  }
  ```

**Returns**: Promise that resolves when service call completes

**Requirements**:
- Must call `api.callService()` to execute action in HA
- Should not update UI directly (wait for WebSocket confirmation)
- Should handle and log errors
- Should not throw (catch errors internally)

**Example**:
```javascript
export function handleInteraction(entityId, action) {
  if (action.type === 'toggle') {
    return api.callService('light', 'toggle', {
      entity_id: entityId
    }).catch(err => {
      console.error('Service call failed:', err);
    });
  }
  return Promise.reject(new Error(`Unknown action: ${action.type}`));
}
```

### Component Registration

In `frontend/js/app.js`:

```javascript
import * as lightComponent from './components/light.js';
import * as switchComponent from './components/switch.js';
import * as sensorComponent from './components/sensor.js';

const COMPONENTS = {
  'light': lightComponent,
  'switch': switchComponent,
  'sensor': sensorComponent,
  'binary_sensor': binarySensorComponent,
  // Add new entity types here
};

function getComponent(entityId) {
  const domain = entityId.split('.')[0];
  return COMPONENTS[domain] || COMPONENTS['custom'];
}
```

### Component Lifecycle

```
1. Config loaded via fetchPanelConfig()
2. States loaded via fetchAllStates()
3. For each entity in config:
   a. Get component via getComponent(entity_id)
   b. Call component.createTile(config, state)
   c. Append to DOM
4. WebSocket connects
5. When state changes:
   a. AppState.updateEntityState() called
   b. Find DOM element for entity
   c. Call component.updateTile(element, newState)
6. When user taps tile:
   a. Click/touch event fires
   b. Call component.handleInteraction(entityId, action)
   c. Action calls api.callService()
   d. Service response received
   e. WebSocket sends state_changed
   f. updateTile() called again
```

---

**Document Version**: 1.2
**Last Updated**: 2026-03-24
**Maintainer**: Retro Panel Team

**Recent Updates (v1.2)**:
- Updated GET /api/panel-config to document v1.4 response with version: 4 and rooms.sections structure
- Added backward compatibility note: v3 configs auto-migrate to v4
- Documented legacy response format (v1.0-v1.3) as deprecated
- Added new POST /api/config endpoint for saving configuration with v4 schema
- Updated response schema documentation to show rooms with id, title, sections array
- Updated error handling examples to reference v4 schema fields
- Documented section ID requirement and section title (may be empty)
- Clarified auto-migration behavior on first load
