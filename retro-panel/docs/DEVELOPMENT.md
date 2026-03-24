# Retro Panel Development Guide

## Quick Start

### Local Development (No HA Required)

**Goal**: Run Retro Panel locally for fast iteration without a full Home Assistant instance.

#### Step 1: Create Test Configuration

Create `data/options.json` (this simulates add-on configuration):

```json
{
  "ha_url": "ws://localhost:8123",
  "ha_token": "test-token-local",
  "panels": [
    {
      "name": "Test Panel",
      "rows": [
        {
          "cols": [
            {
              "entity_id": "light.test_light",
              "size": "medium",
              "name": "Test Light",
              "show_state": true
            }
          ]
        },
        {
          "cols": [
            {
              "entity_id": "switch.test_switch",
              "size": "medium"
            },
            {
              "entity_id": "sensor.test_sensor",
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
    {"domain": "switch", "service": "turn_on"},
    {"domain": "switch", "service": "turn_off"}
  ],
  "layout_config": {
    "tile_size_px": 80,
    "grid_gap_px": 8,
    "show_state_labels": true
  }
}
```

**Important**: Create `data/` directory in project root:
```bash
mkdir -p data
```

#### Step 2: Install Python Dependencies

```bash
python3 -m pip install -r requirements.txt
```

**requirements.txt** should contain:
```
aiohttp==3.9.1
pyyaml==6.0.1
```

#### Step 3: Run Server

```bash
python3 app/server.py
```

**Expected output**:
```
[INFO] Retro Panel starting...
[INFO] Loading config from data/options.json
[INFO] Config loaded: 1 panels, 3 entities
[INFO] Server running on http://localhost:7654
```

#### Step 4: Access Application

Open browser: `http://localhost:7654`

You should see the test panel with three tiles. If you see errors, check:
- `data/options.json` exists and is valid JSON
- No Python errors in terminal
- Browser console (F12) for frontend errors

#### Step 5: Make Changes and Refresh

Edit any file and refresh the browser:
- Change `frontend/js/app.js` → refresh to see changes
- Change `frontend/css/*.css` → refresh (no cache-busting)
- Change `app/server.py` → restart server (Ctrl+C, re-run)

**Note**: Python changes require server restart; frontend changes just need browser refresh.

### Testing Against Real Home Assistant

#### Prerequisites

- Home Assistant running on local network (e.g., `homeassistant.local:8123`)
- Able to SSH into HA host or access filesystem
- Real HA token or service account token

#### Step 1: Prepare HA Token

In Home Assistant, go to Settings → Personal Profile → Tokens, create a long-lived token.

#### Step 2: Copy Add-on to HA

Copy entire `addon/` directory to HA:

**SSH Method**:
```bash
# On HA host at /config/addons_dev/retro_panel/
ssh root@homeassistant.local
cd /config
mkdir -p addons_dev/retro_panel
# Copy addon files there
```

Or use SCP:
```bash
scp -r addon/* root@homeassistant.local:/config/addons_dev/retro_panel/
```

#### Step 3: Install as Local Add-on

In HA Settings → Add-ons → Local Add-ons:
- Click "Create Add-on"
- Navigate to `/config/addons_dev/retro_panel`
- Install should appear

#### Step 4: Configure Add-on

In Retro Panel add-on settings, update options.json with:
```json
{
  "ha_url": "ws://homeassistant:8123",
  "ha_token": "eyJhbGci...",
  "panels": [
    {
      "name": "Living Room",
      "rows": [
        {
          "cols": [
            {
              "entity_id": "light.bedroom",
              "size": "medium"
            }
          ]
        }
      ]
    }
  ],
  "service_whitelist": [
    {"domain": "light", "service": "turn_on"},
    {"domain": "light", "service": "turn_off"}
  ]
}
```

Use actual entity IDs from your HA instance.

#### Step 5: Start and Access

In HA add-on page:
1. Click "Start"
2. Wait for "Started" status
3. Click "Open Web UI" or access via Ingress URL

#### Step 6: View Logs

In add-on page:
- Click "Logs" tab
- Tail output shows real-time debug info
- Check for errors or connection issues

**Common Log Messages**:
```
[INFO] HAClient connecting to Home Assistant...
[INFO] WebSocket connected, subscribing to state_changed
[INFO] Browser connected: 192.168.1.100
[INFO] Service call: light.turn_on({entity_id: "light.bedroom"})
```

**Error Examples**:
```
[ERROR] Failed to authenticate WebSocket: invalid token
[ERROR] Service light.invalid_service not in whitelist
[ERROR] Config validation failed: missing required field 'entity_id'
```

## Browser Compatibility Rules (CRITICAL)

These rules ensure legacy browser compatibility and must not be violated.

### JavaScript Features - Strict Allowlist

**Safe in legacy mobile Safari (Use Freely)**:
- `async/await`, Promises
- Arrow functions `() => {}`
- Template literals (backticks)
- Destructuring `const {a, b} = obj`
- `const`/`let`
- `import`/`export` (ES6 modules)
- Spread operator `...`
- Array methods: `.map()`, `.filter()`, `.reduce()`
- Object methods: `.assign()`, `.entries()`, `.keys()`
- Fetch API
- WebSocket API
- `setTimeout()`, `setInterval()`
- `localStorage`

**FORBIDDEN (Will Break on legacy devices)**:
- Optional chaining `obj?.prop` — not available on pre-2020 WebKit
- Nullish coalescing `a ?? b` — not available on pre-2020 WebKit
- `??=` `&&=` `||=` logical assignment operators
- `var` keyword (use `const`/`let` only)
- `function` keyword for non-class methods (use arrow functions)
- Async generators
- Proxy objects
- Reflect API
- BigInt
- `eval()`

**Babel/Transpilation**:
- Do NOT use any transpiler
- Do NOT use @babel/preset-env
- Write code that runs directly in ES2017
- No polyfills needed

### CSS Features - Vendor Prefixes

**Always Add -webkit- Prefix**:
```css
/* backdrop-filter */
.glass {
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

/* user-select */
.no-select {
  -webkit-user-select: none;
  user-select: none;
}

/* appearance */
input {
  -webkit-appearance: none;
  appearance: none;
}

/* transform (legacy mobile Safari needs it for performance) */
.smooth {
  -webkit-transform: translate3d(0, 0, 0);
  transform: translate3d(0, 0, 0);
}
```

**CSS Features That Are Safe Without Prefix**:
- Grid, Flexbox, `transform`, `transition`, `animation`
- Media queries including `prefers-color-scheme`
- CSS custom properties (variables)
- `box-shadow`, `border-radius`, `gradients`

### Testing on legacy mobile Safari

#### Using Safari Developer Tools

**On Mac with Xcode**:
```bash
# Connect iPhone via USB
# In Safari: Develop menu → [Your Device] → [Website]
```

**On Windows/Linux**: Use:
- iOS Simulator (requires Mac)
- Remote debugging tools
- BrowserStack iOS testing

#### Critical Tests Before Commit

1. **Page Load**:
   - Open Retro Panel on iPhone
   - Should load in < 5 seconds
   - No white screen hang
   - All tiles visible

2. **Touch Interaction**:
   - Tap a light tile
   - Visual feedback should be instant
   - Service call should complete in < 1 second

3. **WebSocket**:
   - Open DevTools Network tab
   - Verify `ws://` connection established
   - See `state_changed` messages arriving

4. **Brightness Slider** (if implemented):
   - Touch and drag slider
   - Should respond smoothly (60 FPS)
   - No lag or jank

5. **Reconnection**:
   - Stop WiFi
   - Watch connection status indicator change
   - Reconnect WiFi
   - Panel should auto-reconnect and sync state

#### Debugging Console

In Safari DevTools:
1. Connect iPhone
2. Open Console tab
3. Check for errors:
   - `Uncaught SyntaxError: ...` → ES2017 incompatibility
   - `Uncaught TypeError: ...() is not a function` → Missing feature
   - `GET /api/... 404` → API endpoint missing
   - `WebSocket failed` → Connection issue

**Common legacy mobile Safari Errors to Avoid**:
```javascript
// BAD - Will not work in legacy mobile Safari
const obj = new Proxy({}, {});  // Proxy not supported
const bigNum = 1n;               // BigInt not supported
await async function* gen() {}   // Async generators not supported

// GOOD - legacy browser compatible
const handlers = {};
const timeout = 1000;
async function fetchData() {}
```

## Configuration Editor (v1.4+)

### Two-Column Layout

The configuration editor uses a two-column design for managing rooms and sections:

**Left Column**: Room/Section Navigator
- Displays rooms as expandable tree
- Each room shows its sections
- Click to select room or section
- Visual indication of current selection
- Add room and add section buttons

**Right Column**: Item Editor
- Displays items in selected section
- Drag-and-drop reordering support
- Section title inline editor
- Item property editor (entity_id, name, icon, size, hidden)
- Add item button (opens entity picker)
- Delete item/section buttons with confirmation

### Entity Picker

The auto-fill entity picker displays available entities from Home Assistant:

**Features**:
- Fetches from `GET /api/entities` endpoint
- Automatically excludes hidden and disabled entities
- Shows entity_id, friendly_name, domain, device_class
- Search/filter capability
- Click to add entity to selected section
- Domain filtering (light, switch, sensor, binary_sensor, climate, cover)

**Backend Implementation** (`app/handlers/panel_config.py`):
- Calls `GET /api/config/entity_registry` to get hidden/disabled status
- Filters against allowed domains
- Returns sorted list

**Frontend Implementation** (`frontend/js/config-page.js`):
- Modal dialog with search input
- Displays entity list with icons and names
- Click handler adds selected entity to section

### Configuration File Format (v1.4)

The config editor works with schema v4 format:

```json
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
              "name": "Ceiling Light",
              "icon": "mdi:bulb",
              "size": "medium",
              "hidden": false
            }
          ]
        }
      ]
    }
  ],
  "layout_config": {...}
}
```

**Key Differences from v1.0-v1.3**:
- `rooms` array replaces `panels` array
- Room structure simplified (no nested rows/cols)
- `sections` provide organizational grouping
- Each section has `id`, `title`, and `items`
- Flat item structure (no rows/cols grid layout)

---

## Adding a New Entity Type

### Complete Example: Adding `climate` Entity

#### Step 1: Create Component File

Create `frontend/js/components/climate.js`:

```javascript
/**
 * Climate (thermostat) entity component
 * Supports temperature setpoint, mode selection
 */

export function createTile(config, state) {
  const tile = document.createElement('div');
  tile.className = 'tile tile-climate';
  tile.dataset.entityId = config.entity_id;

  const header = document.createElement('div');
  header.className = 'tile-header';
  header.textContent = config.name || 'Climate';

  const tempDisplay = document.createElement('div');
  tempDisplay.className = 'climate-display';
  tempDisplay.innerHTML = `
    <div class="current-temp">${state.attributes.current_temperature || '-'}°</div>
    <div class="target-temp">${state.attributes.temperature || '-'}°</div>
  `;

  const modeSelect = document.createElement('select');
  modeSelect.className = 'climate-mode';
  const modes = state.attributes.hvac_modes || ['off', 'heat', 'cool'];
  modes.forEach(mode => {
    const option = document.createElement('option');
    option.value = mode;
    option.textContent = mode.toUpperCase();
    if (mode === state.state) option.selected = true;
    modeSelect.appendChild(option);
  });
  modeSelect.addEventListener('change', (e) => {
    handleInteraction(config.entity_id, {
      type: 'set_hvac_mode',
      mode: e.target.value
    });
  });

  tile.appendChild(header);
  tile.appendChild(tempDisplay);
  tile.appendChild(modeSelect);

  return tile;
}

export function updateTile(element, state) {
  element.dataset.state = state.state;

  const tempDisplay = element.querySelector('.climate-display');
  if (tempDisplay) {
    tempDisplay.innerHTML = `
      <div class="current-temp">${state.attributes.current_temperature || '-'}°</div>
      <div class="target-temp">${state.attributes.temperature || '-'}°</div>
    `;
  }

  const modeSelect = element.querySelector('.climate-mode');
  if (modeSelect) {
    modeSelect.value = state.state;
  }
}

export function handleInteraction(entityId, action) {
  if (action.type === 'set_hvac_mode') {
    return api.callService('climate', 'set_hvac_mode', {
      entity_id: entityId,
      hvac_mode: action.mode
    });
  }
  return Promise.reject(new Error(`Unknown action: ${action.type}`));
}
```

#### Step 2: Register Component in app.js

Edit `frontend/js/app.js`:

```javascript
import * as climateComponent from './components/climate.js';

const COMPONENTS = {
  'light': lightComponent,
  'switch': switchComponent,
  'sensor': sensorComponent,
  'binary_sensor': binarySensorComponent,
  'climate': climateComponent,  // Add this line
  // ... other components
};
```

#### Step 3: Add Styles

Edit `frontend/css/components.css`, add at end:

```css
.tile-climate {
  background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
  color: white;
}

.climate-display {
  display: flex;
  justify-content: space-around;
  margin: 10px 0;
  font-size: 18px;
  font-weight: bold;
}

.current-temp {
  opacity: 0.7;
  font-size: 14px;
}

.target-temp {
  color: #ffe;
}

.climate-mode {
  width: 100%;
  padding: 5px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
}

.climate-mode option {
  background: #333;
  color: white;
}
```

#### Step 4: Update Service Whitelist (app/service_whitelist.py)

Add to the validation logic:

```python
SUPPORTED_SERVICES = {
    'light': ['turn_on', 'turn_off', 'toggle'],
    'switch': ['turn_on', 'turn_off', 'toggle'],
    'climate': ['set_hvac_mode', 'set_temperature'],  # Add this
    # ... others
}
```

#### Step 5: Update Configuration Schema (addon/options.json)

Add climate-specific options:

```json
{
  "properties": {
    "panels": {
      "items": {
        "properties": {
          "rows": {
            "items": {
              "properties": {
                "cols": {
                  "items": {
                    "properties": {
                      "entity_id": {
                        "type": "string",
                        "description": "HA entity ID (e.g., climate.bedroom)"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

#### Step 6: Test

1. Create test entity in config:
```json
{
  "entity_id": "climate.test",
  "size": "medium",
  "name": "Thermostat"
}
```

2. Add to service whitelist:
```json
{"domain": "climate", "service": "set_hvac_mode"}
```

3. Refresh browser, verify tile renders
4. Test mode selection
5. Check browser console for errors

#### Step 7: Document

Update `docs/ARCHITECTURE.md` Entity Types section:

```markdown
### Climate Entity

**HA Entity Domain**: `climate.*`

**Supported Attributes**:
- `state`: current HVAC mode ("off", "heat", "cool", etc.)
- `current_temperature`: current room temperature
- `temperature`: target setpoint temperature
- `hvac_modes`: list of available modes

**Service Calls**:
- `climate/set_hvac_mode` → `{entity_id, hvac_mode}`
- `climate/set_temperature` → `{entity_id, temperature}`

**Tile Rendering**:
- Display current and target temperature
- Mode selector dropdown
- Updates when temperature changes via WebSocket
```

## Configuration Schema Changes

### Procedure for Adding Configuration Options

#### Step 1: Design Schema

**New Feature**: Color picker for light tiles

**Decision**: Add `show_color_picker` boolean to light entity config

#### Step 2: Update addon/options.json

```json
{
  "type": "object",
  "properties": {
    "panels": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "rows": {
            "type": "array",
            "items": {
              "properties": {
                "cols": {
                  "items": {
                    "properties": {
                      "show_color_picker": {
                        "type": "boolean",
                        "default": false,
                        "description": "Show color picker for light entities"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

#### Step 3: Update app/config_loader.py

Add validation:

```python
def validate_entity_config(config):
    # Existing validations...

    if 'show_color_picker' in config:
        if not isinstance(config['show_color_picker'], bool):
            raise ValueError('show_color_picker must be boolean')
```

#### Step 4: Update Frontend

In `frontend/js/components/light.js`:

```javascript
export function createTile(config, state) {
  const tile = document.createElement('div');

  // ... existing code ...

  if (config.show_color_picker && state.attributes.hs_color) {
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.value = hslToHex(state.attributes.hs_color);
    tile.appendChild(colorPicker);
  }

  return tile;
}
```

#### Step 5: Backward Compatibility

**Rule**: Old configs must still work

Test with v1.0 config that doesn't have `show_color_picker`:
- Should load without error
- Should not display color picker
- Should work exactly as before

#### Step 6: Document

Add to `docs/ARCHITECTURE.md`:

```markdown
**Light-Specific Options** (v1.5+):
- `show_color_picker` (boolean, default: false) - Show color picker control
```

Add migration note to `ROADMAP.md`:
```markdown
**v1.5 Configuration Changes** (backward compatible):
- New `show_color_picker` option for light entities (optional)
- Old configs without this option work unchanged
- Set to `true` to enable color selection
```

## Debugging WebSocket Issues

### Common Problems and Solutions

#### Problem: WebSocket Connection Fails

**Symptom**: Browser console shows WebSocket errors, connection indicator is red.

**Debug Steps**:

1. Check backend logs:
```bash
# If running locally:
python3 app/server.py

# If running in HA:
# Settings → Add-ons → Retro Panel → Logs
```

2. Verify HAClient can connect to HA:
```python
# In app/ha_client.py, add debug logging:
logger.info(f"Connecting to HA at {self.ha_url}")
logger.info(f"Using token: {self.token[:20]}...")
```

3. Check network in browser DevTools:
```
Network tab → WS → /ws → Check Headers
Request URL: ws://localhost:8123/api/websocket (if local)
Upgrade: websocket
Connection: Upgrade
```

4. Verify HA token is valid:
- Settings → Personal Profile → Tokens
- Token should not be expired
- Correct token passed in config

#### Problem: State Updates Not Arriving

**Symptom**: Panel loads fine, but entity states don't update when changed in HA.

**Debug Steps**:

1. Check WSProxy is listening:
```python
# In app/ws_proxy.py, add logging:
logger.info(f"Browser connected, total subscribers: {len(self.subscribers)}")
logger.info(f"State change event received: {entity_id}")
```

2. Verify subscription to state_changed events:
```python
# In HAClient, check event subscription:
await self.subscribe_to_events()  # Should return subscription ID
```

3. Manually test HAClient:
```python
# Create test script:
import asyncio
from app.ha_client import HAClient

async def test():
    client = HAClient(
        ha_url="ws://homeassistant:8123",
        token="your-token"
    )
    await client.connect()
    states = await client.get_all_states()
    print(f"Got {len(states)} states")
    await client.disconnect()

asyncio.run(test())
```

#### Problem: Browser Can't Reach Backend

**Symptom**: `GET /api/panel-config 404` errors, blank panel.

**Debug Steps**:

1. Verify server is running:
```bash
curl http://localhost:7654/
# Should return index.html
```

2. Check CORS (if not using Ingress):
```python
# In app/server.py, ensure CORS headers:
resp.headers['Access-Control-Allow-Origin'] = '*'
resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
```

3. Verify Ingress prefix in browser requests:
```javascript
// In frontend/js/api.js
function getAbsoluteUrl(path) {
  // Check if window.location includes Ingress path
  // Example: http://homeassistant.local:8123/api/hassio_ingress/abc123/
  const base = window.location.origin;
  return base + path;
}
```

4. Check browser console for network errors:
```
F12 → Network tab → filter "api"
Should see GET requests to:
- /api/panel-config
- /api/states/all
- /ws (WebSocket upgrade)
```

#### Problem: WebSocket Reconnection Loop

**Symptom**: WebSocket keeps disconnecting and reconnecting every few seconds.

**Debug Steps**:

1. Check reconnection backoff in `frontend/js/ws.js`:
```javascript
const backoffDelays = [1000, 2000, 4000, 8000, 30000];
// Should increase delays, not rapid retries
```

2. Check HA WebSocket doesn't timeout:
```python
# In app/ha_client.py
RECONNECT_INTERVAL = 60  # seconds
MAX_RECONNECT_BACKOFF = 30000  # ms
```

3. Check for circular errors in logs:
```
[ERROR] Connection failed
[ERROR] Reconnecting in 1s
[ERROR] Connection failed
[ERROR] Reconnecting in 1s
# This loop indicates auth failure or network issue
```

4. Verify no message parsing errors:
```python
# In app/ws_proxy.py
try:
    msg = json.loads(raw_msg)
except json.JSONDecodeError as e:
    logger.error(f"Failed to parse WS message: {e}")
    # Don't crash, just log
```

### Logging Best Practices

#### Enable Debug Logging

In `app/utils/logger.py`:

```python
import logging

logger = logging.getLogger('retro_panel')

# For development:
logger.setLevel(logging.DEBUG)

# Format:
formatter = logging.Formatter(
    '[%(levelname)s] %(asctime)s - %(name)s - %(message)s'
)
```

#### Add Logging Strategically

```python
# In HAClient.connect():
logger.debug(f"Connecting to {self.ha_url}")
logger.debug(f"Auth token: {self.token[:20]}...")

# In service call:
logger.info(f"Service call: {domain}/{service} with {service_data}")

# In WebSocket receive:
logger.debug(f"WS message type: {msg.get('type')}")
```

#### View Logs in Real-Time

**Local Development**:
```bash
python3 app/server.py 2>&1 | grep -i error
# or
python3 app/server.py 2>&1 | tail -f
```

**HA Add-on**:
- HA Settings → Add-ons → Retro Panel → Logs
- Use "Follow logs" checkbox

---

**Document Version**: 1.1
**Last Updated**: 2026-03-24
**Maintainer**: Retro Panel Team

**Recent Updates (v1.1)**:
- Added "Configuration Editor (v1.4+)" section describing two-column layout
- Documented Left Column: Room/Section Navigator with tree display
- Documented Right Column: Item Editor with drag-drop and inline editing
- Documented Entity Picker with auto-fill from HA registry
- Documented backend implementation (GET /api/entities endpoint)
- Documented Configuration File Format (v1.4 schema with rooms/sections)
- Documented key differences from v1.0-v1.3 (rooms vs panels, sections vs rows/cols)
