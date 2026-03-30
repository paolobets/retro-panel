# Retro Panel Development Guide (v2.0)

## Quick Start

### Local Development (No HA Required)

**Goal**: Run Retro Panel locally for fast iteration without a full Home Assistant instance.

#### Step 1: Create Test Configuration

Create `data/options.json` (this simulates add-on configuration):

```json
{
  "ha_url": "http://homeassistant.local:8123",
  "ha_token": "YOUR_LONG_LIVED_TOKEN",
  "panel_title": "Home",
  "theme": "dark",
  "refresh_interval": 30
}
```

**Important**: Create `data/` directory in project root:
```bash
mkdir -p data
```

The panel configuration (rooms, entities, scenarios, cameras) is stored separately in `data/panel_config.json`, managed entirely by the Config UI at `/config`.

#### Step 2: Install Python Dependencies

```bash
pip install -r requirements.txt
```

#### Step 3: Run Server

```bash
python app/server.py
```

**Expected output**:
```
[INFO] Retro Panel starting...
[INFO] Loading config from data/options.json
[INFO] Server running on http://localhost:7654
```

#### Step 4: Access Application

- Dashboard: `http://localhost:7654`
- Config UI: `http://localhost:7654/config`

#### Step 5: Make Changes and Refresh

Edit any file and refresh the browser:
- Change `app/static/js/*.js` → refresh to see changes
- Change `app/static/css/*.css` → refresh (no cache-busting)
- Change `app/server.py` → restart server (Ctrl+C, re-run)

---

### Testing Against Real Home Assistant

#### Prerequisites

- Home Assistant running on local network (e.g., `homeassistant.local:8123`)
- Able to SSH into HA host or access filesystem
- Real HA token or service account token

#### Step 1: Prepare HA Token

In Home Assistant, go to Settings → Personal Profile → Tokens, create a long-lived token.

#### Step 2: Copy Add-on to HA

Copy entire `addon/` directory to HA via SSH or Samba.

#### Step 3: Install as Local Add-on

In HA Settings → Add-ons → Local Add-ons, install from `/config/addons_dev/retro_panel/`.

#### Step 4: Configure Add-on

In Retro Panel add-on settings, update options.json with actual HA URL and token.

#### Step 5: Start and Access

In HA add-on page:
1. Click "Start"
2. Wait for "Started" status
3. Click "Open Web UI"

#### Step 6: View Logs

In add-on page, click "Logs" tab to see real-time debug info.

---

## Browser Compatibility Rules (CRITICAL)

### JavaScript Features - iOS 12+ Only

**REQUIRED for iOS 12 compatibility**:
- **var keyword only (no const/let)**
- **No arrow functions — use function keyword**
- **No optional chaining (?.)**
- **No nullish coalescing (??)**
- **No template literals** (use string concatenation)

**Safe to use**:
- Promises, async/await
- Array methods: .map(), .filter(), .reduce()
- Object methods: .assign(), .entries()
- Fetch API
- WebSocket API
- setTimeout(), setInterval()
- localStorage

**FORBIDDEN**:
- const/let keywords
- Arrow functions (=>)
- Optional chaining (?.)
- Nullish coalescing (??)
- Async generators
- Proxy objects
- BigInt
- eval()

**Example - WRONG**:
```javascript
// BAD - will fail on iOS 12
const arr = [1, 2, 3];
const doubled = arr.map(x => x * 2);
const result = obj?.prop ?? 'default';
```

**Example - CORRECT**:
```javascript
// GOOD - iOS 12 compatible
var arr = [1, 2, 3];
var doubled = arr.map(function(x) { return x * 2; });
var result = obj && obj.prop ? obj.prop : 'default';
```

---

### CSS Features - iOS 12+ Constraints

**FORBIDDEN in v2.0**:
- **No gap: on display:flex** — use margin instead
- **No inset: shorthand** — use top/bottom/left/right individually
- **No 100dvh** — use 100vh

**Safe to use**:
- Grid, Flexbox, transform, transition, animation
- Media queries including prefers-color-scheme
- CSS custom properties (variables)
- box-shadow, border-radius, gradients
- -webkit- vendor prefixes

**Example - WRONG**:
```css
/* BAD - will fail on iOS 12 */
.sheet {
  inset: 0;
  gap: 10px;
  height: 100dvh;
}
```

**Example - CORRECT**:
```css
/* GOOD - iOS 12 compatible */
.sheet {
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 10px;
  height: 100vh;
}
```

---

### Testing on iOS 12

#### Using Safari Developer Tools

**On Mac with Xcode**:
```bash
# Connect iPhone via USB
# In Safari: Develop menu → [Your Device] → [Website]
```

#### Critical Tests Before Commit

1. **Page Load**: Open panel on iPhone, should load in < 5 seconds
2. **Touch Interaction**: Tap a tile, should toggle instantly
3. **WebSocket**: Open DevTools Network tab, verify ws:// connection
4. **Bottom Sheet**: Long-press light tile, brightness slider should appear
5. **Reconnection**: Stop WiFi, watch reconnect automatically

---

## Entity Types and layout_type System (v2.0)

### Backend Computation

The backend computes `layout_type` for each entity based on `domain` and `device_class`:

```python
# Backend determines this automatically
entity_config = {
  "entity_id": "sensor.temperature",
  "device_class": "temperature",
  "layout_type": "sensor_temperature"  # Computed by backend
}
```

### Frontend Rendering

The frontend uses `layout_type` to select the correct component:

```javascript
// In renderer.js
var layoutType = entityConfig.layout_type;  // "sensor_temperature"
var component = window.RP_Renderer.getComponent(layoutType);
var tile = component.createTile(entityConfig);
```

### Layout Type Reference (15 Total)

| layout_type | domain | device_class | Component |
|-------------|--------|-------------|-----------|
| `light` | light | * | LightComponent |
| `switch` | switch, input_boolean | * | SwitchComponent |
| `sensor_temperature` | sensor | temperature | SensorComponent |
| `sensor_humidity` | sensor | humidity | SensorComponent |
| `sensor_co2` | sensor | co2/carbon_dioxide | SensorComponent |
| `sensor_battery` | sensor | battery | SensorComponent |
| `sensor_energy` | sensor | power/energy | SensorComponent |
| `sensor_generic` | sensor | other | SensorComponent |
| `binary_door` | binary_sensor | door/window | SensorComponent |
| `binary_motion` | binary_sensor | motion/occupancy | SensorComponent |
| `binary_standard` | binary_sensor | other | SensorComponent |
| `alarm` | alarm_control_panel | * | AlarmComponent |
| `camera` | camera | * | CameraComponent |
| `scenario` | scene/script/automation | * | ScenarioComponent |
| `energy_flow` | (energy card) | — | EnergyFlowComponent |

---

## Adding a New Entity Type (layout_type Approach)

### Example: Adding `climate` Entity (Thermostat)

#### Step 1: Backend Logic (if needed)

Edit `app/handlers/panel_config.py`, add to `compute_layout_type()`:

```python
def compute_layout_type(domain, device_class):
    if domain == 'climate':
        return 'climate'
    # ... existing types ...
```

#### Step 2: Create Component File

Create `app/static/js/components/climate.js`:

```javascript
(function() {
  function createTile(entityConfig) {
    var tile = document.createElement('div');
    tile.className = 'tile tile-climate';
    tile.dataset.layoutType = 'climate';
    tile.dataset.entityId = entityConfig.entity_id;

    var header = document.createElement('div');
    header.className = 'tile-header';
    header.textContent = entityConfig.label || 'Climate';

    var tempDisplay = document.createElement('div');
    tempDisplay.className = 'climate-temp';
    tempDisplay.innerHTML = '<div class="temp-value">--°</div>';

    var modeSelect = document.createElement('select');
    modeSelect.className = 'climate-mode';
    modeSelect.addEventListener('change', function(e) {
      window.callService('climate', 'set_hvac_mode', {
        entity_id: entityConfig.entity_id,
        hvac_mode: e.target.value
      });
    });

    tile.appendChild(header);
    tile.appendChild(tempDisplay);
    tile.appendChild(modeSelect);

    return tile;
  }

  function updateTile(tile, stateObj) {
    tile.dataset.state = stateObj.state;

    var tempDiv = tile.querySelector('.temp-value');
    if (tempDiv && stateObj.attributes && stateObj.attributes.current_temperature) {
      tempDiv.textContent = Math.round(stateObj.attributes.current_temperature) + '°';
    }

    var modeSelect = tile.querySelector('.climate-mode');
    if (modeSelect) {
      modeSelect.value = stateObj.state;
    }

    tile.classList.toggle('is-on', stateObj.state !== 'off');
    tile.classList.toggle('is-off', stateObj.state === 'off');
  }

  window.ClimateComponent = {
    createTile: createTile,
    updateTile: updateTile
  };
})();
```

#### Step 3: Register Component in app.js

Edit `app/static/js/app.js`, update `COMPONENT_MAP`:

```javascript
var COMPONENT_MAP = {
  'light': window.LightComponent,
  'switch': window.SwitchComponent,
  'sensor_temperature': window.SensorComponent,
  'sensor_humidity': window.SensorComponent,
  'sensor_co2': window.SensorComponent,
  'sensor_battery': window.SensorComponent,
  'sensor_energy': window.SensorComponent,
  'sensor_generic': window.SensorComponent,
  'binary_door': window.SensorComponent,
  'binary_motion': window.SensorComponent,
  'binary_standard': window.SensorComponent,
  'alarm': window.AlarmComponent,
  'camera': window.CameraComponent,
  'scenario': window.ScenarioComponent,
  'energy_flow': window.EnergyFlowComponent,
  'climate': window.ClimateComponent  // Add this
};
```

#### Step 4: Add Styles

Edit `app/static/css/tiles.css`, add at end:

```css
.tile-climate {
  background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
  color: white;
  min-height: 120px;
}

.climate-temp {
  font-size: 24px;
  font-weight: bold;
  margin: 10px 0;
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
```

#### Step 5: Update Service Whitelist (app/server.py)

Add to the validation logic:

```python
SUPPORTED_SERVICES = {
    'light': ['turn_on', 'turn_off', 'toggle'],
    'switch': ['turn_on', 'turn_off', 'toggle'],
    'climate': ['set_hvac_mode', 'set_temperature'],
    # ...
}
```

#### Step 6: Test

1. Add test entity in config:
```json
{
  "entity_id": "climate.bedroom",
  "label": "Bedroom Thermostat",
  "layout_type": "climate"
}
```

2. Refresh browser, verify tile renders
3. Test mode selection
4. Check browser console for errors

#### Step 7: Update Documentation

Add to `docs/ARCHITECTURE.md` Entity Types section.

---

## Debugging WebSocket Issues

### Problem: WebSocket Connection Fails

**Symptom**: Browser console shows WebSocket errors, connection indicator is red.

**Debug Steps**:

1. Check backend logs:
```bash
python app/server.py  # Look for connection errors
```

2. Verify HA token is valid:
- Settings → Personal Profile → Tokens
- Token should not be expired

3. Check browser Network tab:
```
Network → WS → /ws
Should show 101 Switching Protocols
```

### Problem: State Updates Not Arriving

**Symptom**: Panel loads fine, but entity states don't update when changed in HA.

**Debug Steps**:

1. Manually test by changing entity in HA
2. Check browser console for WebSocket messages
3. Verify refresh_interval fallback is working (check Network tab for GET /api/states/all)

### Problem: Browser Can't Reach Backend

**Symptom**: `GET /api/panel-config 404` errors, blank panel.

**Debug Steps**:

1. Verify server is running:
```bash
curl http://localhost:7654/
# Should return index.html
```

2. Check browser console for network errors (F12 → Network tab)

---

**Document Version**: 2.0
**Last Updated**: 2026-03-27
**Maintainer**: Retro Panel Team
