# Retro Panel — Documentation

Retro Panel is a lightweight kiosk dashboard for Home Assistant, built for
**wall-mounted tablets and always-on displays** that struggle with the standard
Lovelace UI. It targets iOS 15 Safari, old Android WebView, and any browser
from the last decade.

## Prerequisites

Before starting, you need a **Long-Lived Access Token** from Home Assistant:

1. In Home Assistant, click your profile picture (bottom-left).
2. Scroll to **Long-Lived Access Tokens**.
3. Click **Create Token**, give it a name (e.g. `retro-panel`).
4. **Copy the token immediately** — it is shown only once.

## First configuration

After installing the add-on, go to the **Configuration** tab and fill in:

| Option | Description | Example |
|--------|-------------|---------|
| **HA URL** | Your HA instance URL | `http://192.168.1.10:8123` |
| **HA Token** | The token you just created | `eyJ0eXAi...` |
| **Panel Title** | Title shown at the top | `Casa` |
| **Columns** | Grid columns: `2`, `3`, or `4` | `3` |
| **Theme** | `dark`, `light`, or `auto` | `dark` |
| **Kiosk Mode** | Disables text selection (recommended for tablets) | `true` |
| **Refresh Interval** | Fallback poll interval in seconds (5–300) | `30` |
| **Entities** | List of entities to show | see below |

> **Tip:** Use `columns: 3` for an iPad in portrait mode, `columns: 4` for landscape.

## Adding entities

Each entity in the list supports these fields:

| Field | Required | Description |
|-------|----------|-------------|
| `entity_id` | Yes | The HA entity ID (e.g. `light.living_room`) |
| `label` | No | Display name. Auto-detected from entity_id if omitted |
| `icon` | No | Icon name. Auto-detected from domain if omitted |
| `row` | No | Grid row (for manual positioning) |
| `col` | No | Grid column (for manual positioning) |

### Supported entity types

| Domain | Features |
|--------|----------|
| `light` | Toggle on/off, brightness slider (long-press) |
| `switch` | Toggle on/off |
| `sensor` | Read-only value with unit |
| `binary_sensor` | Open/Closed, Motion/Clear, Home/Away, etc. |
| `alarm_control_panel` | PIN keypad, Arm Home, Arm Away, Disarm |

### Configuration example

```yaml
entities:
  - entity_id: light.soggiorno
    label: Soggiorno
  - entity_id: light.cucina
    label: Cucina
  - entity_id: switch.ventilatore
    label: Ventilatore
  - entity_id: sensor.temperatura_soggiorno
    label: Temperatura
  - entity_id: binary_sensor.porta_ingresso
    label: Porta Ingresso
  - entity_id: alarm_control_panel.allarme_casa
    label: Allarme
```

### Available icons

If you want to override the auto-detected icon, use one of:

| Icon name | Symbol | Default for |
|-----------|--------|-------------|
| `bulb` | 💡 | `light.*` |
| `toggle` | ⚡ | `switch.*` |
| `shield` | 🛡 | `alarm_control_panel.*` |
| `thermometer` | 🌡 | sensors with "temperature" |
| `droplet` | 💧 | sensors with "humidity" |
| `door` | 🚪 | sensors with "door" |
| `motion` | 👁 | sensors with "motion" |
| `circle` | ⬤ | default fallback |
| `tv` | 📺 | (manual only) |

## Alarm panel

The alarm tile shows a PIN keypad. To use it:

1. Enter your PIN using the number buttons.
2. Tap **Arm Home**, **Arm Away**, or **Disarm**.

The PIN is never stored — it is sent directly to HA with the service call and
immediately cleared from memory.

> **Note:** If your alarm does not require a PIN, leave the keypad empty and
> tap the action button directly.

## Kiosk mode

When `kiosk_mode` is enabled:

- Text selection is disabled (prevents accidental text highlight on long-press).
- The iOS "Add to Home Screen" meta tags are active — open the panel in Safari,
  tap **Share → Add to Home Screen** to launch it full-screen with no browser UI.

## Opening the panel

After starting the add-on, click **Open Web UI** (the link icon next to the
add-on name in the sidebar). The panel URL is accessible via HA Ingress, so
no extra port forwarding is needed.

To open on a tablet:
1. On the tablet, navigate to `http://[HA-IP]:8123`.
2. Log in with a HA user account.
3. The Retro Panel should appear in the left sidebar.

## Network and WebSocket

Retro Panel keeps a single WebSocket connection to Home Assistant and
broadcasts state changes to all connected browsers in real time. If the
WebSocket drops, the panel automatically retries with exponential backoff
(1s, 2s, 4s, 8s, 16s, 30s) and falls back to REST polling in the meantime.

The **disconnect banner** appears at the top of the page when the connection
is lost and disappears automatically when it reconnects.

## Troubleshooting

### Panel shows "Failed to load"

- Check the **Log** tab — the most common cause is an incorrect `ha_url` or
  an invalid / expired `ha_token`.
- Verify the token by testing it: in your browser console on the HA machine,
  run: `curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/`

### Tiles not updating in real time

- The WebSocket to HA may be blocked by a firewall or proxy.
- Check the **Log** tab for `HA WebSocket auth failed` or
  `HA WebSocket disconnected`.
- REST polling (every `refresh_interval` seconds) will keep states updated
  even without WebSocket.

### Alarm PIN not working

- Verify your alarm is configured with a PIN code in HA.
- Check the HA logbook for the service call result.
- Make sure `alarm_control_panel` is in the allowed service domains.

### Brightness slider does not appear

- Long-press the light tile and hold for at least 500ms without moving your
  finger. A short tap toggles; a long hold shows the slider.

### Entity shows "N/A"

- The entity exists in your configuration but was not found in HA (offline,
  removed, or the entity_id is misspelled). Check the entity_id in
  **Settings → Devices & Services → Entities**.

## Support

- **GitHub Issues:** `https://github.com/YOUR_GITHUB_USERNAME/retro-panel/issues`
- **Home Assistant Community:** search "Retro Panel" in the Add-ons category
