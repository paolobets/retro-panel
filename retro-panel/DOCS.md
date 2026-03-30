# Retro Panel — Documentation

Retro Panel is a lightweight kiosk dashboard for Home Assistant, designed for **wall-mounted tablets and always-on displays**. It targets iOS 12+ WKWebView and older browser environments where JavaScript must use only var, no const/let/arrow functions.

---

## Prerequisites

Before starting, create a **Long-Lived Access Token** in Home Assistant:

1. In Home Assistant, click your profile picture (bottom-left).
2. Scroll to **Long-Lived Access Tokens**.
3. Click **Create Token**, give it a name (e.g. `retro-panel`).
4. **Copy the token immediately** — it is shown only once.

---

## Add-on configuration (HA config tab)

After installing the add-on, go to the **Configuration** tab and fill in:

| Option | Description | Default |
|--------|-------------|---------|
| **HA URL** | Your HA instance URL | `http://homeassistant:8123` |
| **HA Token** | Long-lived access token | auto (SUPERVISOR_TOKEN) |
| **Panel Title** | Title shown in the header | `Home` |
| **Theme** | `dark`, `light`, or `auto` | `dark` |
| **Refresh Interval** | REST fallback poll in seconds (5–300) | `30` |

> **Tip:** Leave **HA Token** empty — the add-on automatically uses the
> Supervisor token. Only fill it in if you run the add-on outside Supervisor.

---

## Interface overview

The panel is split into three areas:

```
┌──────────┬──────────────────────────────────┐
│          │  Header: title · date · clock     │
│ Sidebar  │                                   │
│ Settings │                                   │
│ ─────── │        Content area               │
│ Overview │   (entity grid / rooms / cameras) │
│ 🏠 Room 1│                                   │
│ 🛋 Room 2│                                   │
│ 🎬 Scenarios                                 │
│ 📹 Cameras                                   │
└──────────┴──────────────────────────────────┘
```

### Sidebar

The collapsible left sidebar contains:

- **⚙ Settings** — opens the configuration page (only at `/config` URL).
- **Overview** — the main home screen with your most important devices.
- **Rooms** — one entry per configured room/area (hidden rooms are not listed).
- **Scenarios** — scenes and scripts to activate with a single tap.
- **Cameras** — camera feeds for monitoring.

Tap the ☰ button at the top to collapse the sidebar (icon-only mode) or expand it (icon + label mode).

### Header

The header displays:
- Panel title (configured in the HA config tab).
- Current date and live clock (updates every minute).
- Connection status dot (green = live WebSocket, grey = polling).

---

## Two URLs

Retro Panel uses two distinct URLs:

### Dashboard (`/`)

**Read-only kiosk view** — displays your home automation entities in a clean grid.

- No settings visible in sidebar
- Cannot be edited or configured
- Perfect for wall-mounted tablets and IoT devices
- Full-screen optimized

Access via:
- HA Ingress: Click **Open Web UI** next to Retro Panel add-on
- Direct: `http://[HA-IP]:7654/`

### Config UI (`/config`)

**Admin configuration interface** — manage entities, rooms, scenarios, and cameras.

- Full settings UI with 4 tabs
- Can edit and save configuration
- Password/token protected by HA Ingress
- Opened separately from the kiosk display

Access via:
- Direct link: `http://[HA-IP]:7654/config`
- In add-on page: Click the link icon to open Web UI, then navigate to `/config`

---

## Settings page

Tap **⚙ Settings** in the sidebar to open the configuration page (only at `/config`).
It has four tabs:

### Overview tab

Entities shown on the main home screen. These are your most important devices — the ones you interact with most.

- **+ Add Entities** — opens a searchable entity picker. Filter by domain (Lights, Switches, Sensors, Binary, Alarm). Select one or more, then tap **Done**.
- **+ Add Power Flow Card** — opens a 5-step wizard to map your energy sensors (Solar, Battery SOC, Battery Power, Grid, Home) to a live power-flow card.
- Use ↑ ↓ arrows to reorder items. Use ✕ to remove.

### Rooms tab

Each room appears as a navigation item in the sidebar.

- **+ Add Room** — create a blank room and give it a title and icon.
- **↻ Import from HA Areas** — automatically creates one room per HA area (duplicates are skipped). Room names and icons are inferred from area names.
- **Visibility toggle** — show/hide a room in the sidebar without deleting it.
- **Edit** — open the room editor to add entities, change title/icon, or delete the room.

#### Room editor

Inside a room, tap **Edit** to open its editor:

- Change the room **title** and **icon** (emoji mapped from a list: Home, Living room, Bedroom, etc.).
- **+ Add Entities** — same entity picker as the Overview tab, scoped to this room.
- Use ↑ ↓ / ✕ to reorder or remove entities.
- **Delete this room** — removes the room and all its entities.

> **Note:** Importing from HA Areas creates empty rooms — you need to add entities to each room manually. This is intentional: area entities in HA include helper entities, media players, and buttons that are not useful in a kiosk dashboard.

### Scenarios tab

Scenes and scripts that can be activated with a single tap.

- **+ Add Scenario** — opens a searchable picker for `scene.*`, `script.*`, and `automation.*` entities.
- Tap a scenario card in the panel to activate it (calls `scene.turn_on`, `script.turn_on`, or `automation.trigger`). Visual feedback is shown for 1 second after activation.
- Use ↑ ↓ / ✕ to reorder or remove.

### Cameras tab

Camera feeds for monitoring and security.

- **+ Add Camera** — opens a searchable picker for `camera.*` entities.
- Each camera displays a live feed (MJPEG stream).
- Use ↑ ↓ to reorder. Use ✕ to remove.
- Tap refresh icon to update the feed manually.

---

## Supported entity types

| Domain | Layout Type | Features |
|--------|------------|----------|
| `light` | `light` | Toggle on/off · brightness slider (bottom sheet) · color temperature |
| `switch` | `switch` | Toggle on/off |
| `input_boolean` | `switch` | Toggle on/off |
| `sensor` (temperature) | `sensor_temperature` | Read-only temperature display |
| `sensor` (humidity) | `sensor_humidity` | Read-only humidity display |
| `sensor` (CO₂) | `sensor_co2` | Read-only CO₂ display |
| `sensor` (battery) | `sensor_battery` | Read-only battery percentage |
| `sensor` (energy/power) | `sensor_energy` | Read-only power/energy display |
| `sensor` (other) | `sensor_generic` | Read-only value with unit |
| `binary_sensor` (door/window) | `binary_door` | Open/Closed status |
| `binary_sensor` (motion/occupancy) | `binary_motion` | Motion detected indicator |
| `binary_sensor` (other) | `binary_standard` | On/Off status |
| `alarm_control_panel` | `alarm` | PIN keypad · Arm Home · Arm Away · Disarm |
| `camera` | `camera` | MJPEG live stream |
| `scene` / `script` / `automation` | `scenario` | Tap-to-activate |
| (Energy flow card) | `energy_flow` | Solar/Battery/Grid/Home power visualization |

---

## Power Flow Card

The Power Flow Card visualises your home energy flow in real time:

```
  ☀ Solar  →  🔋 Battery  →  🏠 Home
                  ↑↓
              ⚡ Grid
```

To configure it:

1. In **Settings → Overview** (or inside a Room), tap **+ Add Power Flow Card**.
2. Step through the 5-screen wizard:
   - **Solar** — production power sensor (W). Positive = producing.
   - **Battery SOC** — state of charge (%). Range 0–100.
   - **Battery Power** — charge/discharge power (W). Positive = charging.
   - **Grid** — import/export power (W). Positive = importing from grid.
   - **Home** — total home consumption (W).
3. Use the 🔍 button on each step to search sensors by entity_id or friendly name.
4. Tap **Confirm** when done.

Arrows animate based on the direction of energy flow. If a sensor is not configured (left empty), that branch is greyed out.

> Compatible inverters tested: ZCS Azzurro, SMA, Fronius, Huawei SUN2000.

---

## Alarm panel

The alarm tile shows a PIN keypad when tapped:

1. Enter your PIN using the number buttons.
2. Tap **Arm Home**, **Arm Away**, or **Disarm**.

The PIN is never stored — it is sent directly to HA and immediately cleared.

> If your alarm does not require a PIN, leave the keypad empty and tap the action button directly.

---

## Light controls

When you tap a light tile, it toggles on/off instantly. For brightness and color control:

1. **Long-press** (hold for ~500ms) the light tile.
2. A bottom sheet slides up from the bottom of the screen.
3. Use the **brightness slider** to adjust brightness.
4. Use the **color temperature slider** to adjust warm/cool tone (if supported).
5. Use the **color picker** for hue selection (if supported).
6. Tap outside the sheet or the X button to close.

---

## Nascondere la UI di Home Assistant (Kiosk)

Retro Panel non gestisce la visibilità della barra laterale di HA.
Per nascondere sidebar e header di HA su un tablet a muro, usa
[kiosk-mode](https://github.com/NemesisRE/kiosk-mode) (installabile via HACS).

Una volta installato, aggiungi in `configuration.yaml`:

```yaml
kiosk_mode:
  template_settings:
    - template: "[[[ return location.href.includes('hassio/ingress'); ]]]"
      hide_sidebar: true
      hide_header: true
```

Questo nasconde sidebar e header HA **solo quando sei all'interno di una pagina ingress**,
lasciando la UI di HA normale su tutte le altre voci del menu.

---

## Opening the panel

After starting the add-on, click **Open Web UI** (the link icon next to the add-on name in the HA sidebar). The panel URL is served via HA Ingress — no extra port forwarding is needed.

To open on a tablet:
1. On the tablet, navigate to `http://[HA-IP]:8123`.
2. Log in with a HA user account.
3. Retro Panel should appear in the left sidebar.

---

## Network and WebSocket

Retro Panel maintains a WebSocket connection to Home Assistant and broadcasts state changes to all connected browsers in real time. If the WebSocket drops, the panel retries with exponential backoff (1s → 2s → 4s → 8s → 16s → 30s) and falls back to REST polling in the meantime.

A **reconnecting banner** appears at the top when the connection is lost and disappears automatically on reconnect.

---

## Troubleshooting

### Panel shows "Failed to load"

- Check the **Log** tab. The most common causes are an incorrect `ha_url` or an invalid / expired `ha_token`.
- Test the token: `curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/`

### Tiles not updating in real time

- The WebSocket to HA may be blocked by a firewall or proxy.
- Check the Log tab for `HA WebSocket auth failed` or `HA WebSocket disconnected`.
- REST polling (every `refresh_interval` seconds) keeps states updated even without WebSocket.

### "Import from HA Areas" returns no rooms

- Make sure your entities are assigned to areas in **Settings → Areas**.
- If HA has no areas configured, import will return an empty list.
- You can always add rooms manually with **+ Add Room**.

### Alarm PIN not working

- Verify your alarm is configured with a PIN in HA.
- Check the HA logbook for the service call result.
- Make sure `alarm_control_panel` is in the allowed service domains (it is allowed by default).

### Brightness slider does not appear

- Long-press the light tile and hold for at least 500 ms without moving your finger. A short tap toggles; a long hold shows the bottom sheet.

### Entity shows "N/A"

- The entity_id exists in your configuration but was not found in HA (offline, removed, or misspelled). Check in **Settings → Devices & Services → Entities**.

### Settings page: "Failed to load entities"

- The add-on cannot reach the HA REST API. Check `ha_url` and token in the Configuration tab.
- On large HA instances (>1000 entities), the first load may take a few seconds.

---

## Support

- **GitHub Issues:** `https://github.com/paolobets/retro-panel/issues`
- **Home Assistant Community:** search "Retro Panel" in the Add-ons category

---

**Document Version**: 2.0
**Last Updated**: 2026-03-27
