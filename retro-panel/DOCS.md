# Retro Panel — Documentation

Retro Panel is a lightweight kiosk dashboard for Home Assistant, designed for
**wall-mounted tablets and always-on displays**. It targets iOS 15 Safari,
older Android WebView, and any browser from the last decade.

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
| **Columns** | Grid columns: `2`, `3`, or `4` | `3` |
| **Theme** | `dark`, `light`, or `auto` | `dark` |
| **Kiosk Mode** | Disables text selection (recommended) | `true` |
| **Refresh Interval** | REST fallback poll in seconds (5–300) | `30` |

> **Tip:** Leave **HA Token** empty — the add-on automatically uses the
> Supervisor token. Only fill it in if you run the add-on outside Supervisor.

---

## Interface overview

The panel is split into three areas:

```
┌──────────┬──────────────────────────────────┐
│          │  Header: title · date · clock     │
│ Sidebar  │  [sensor chips]                   │
│          ├──────────────────────────────────┤
│ Settings │                                   │
│ ─────── │        Content area               │
│ Overview │   (entity grid / scenario cards)  │
│ 🏠 Room 1│                                   │
│ 🛋 Room 2│                                   │
│ 🎭 Scenes│                                   │
└──────────┴──────────────────────────────────┘
```

### Sidebar

The collapsible left sidebar contains:

- **⚙ Settings** — opens the configuration page.
- **Overview** — the main home screen with your most important devices.
- **Rooms** — one entry per configured room/area (hidden rooms are not listed).
- **Scenarios** — scenes and scripts to activate with a single tap.

Tap the ☰ button at the top to collapse the sidebar (icon-only mode) or
expand it (icon + label mode).

### Header

The header displays:
- Panel title (configured in the HA config tab).
- Current date and live clock (updates every minute).
- Up to 4 **sensor chips** — mini entity-state displays (e.g. temperature,
  garbage collection day). Configure them in **Settings → Header**.
- Connection status dot (green = live WebSocket, grey = polling).

---

## Settings page

Tap **⚙ Settings** in the sidebar to open the configuration page.
It has four tabs:

### Overview tab

Entities shown on the main home screen. These are your most important devices —
the ones you interact with most.

- **+ Add Entities** — opens a searchable entity picker. Filter by domain
  (Lights, Switches, Sensors, Binary, Alarm). Select one or more, then tap **Done**.
- **+ Add Power Flow Card** — opens a 5-step wizard to map your energy sensors
  (Solar, Battery SOC, Battery Power, Grid, Home) to a live power-flow card.
- Use ↑ ↓ arrows to reorder items. Use ✕ to remove.

### Rooms tab

Each room appears as a navigation item in the sidebar.

- **+ Add Room** — create a blank room and give it a title and icon.
- **↻ Import from HA Areas** — automatically creates one room per HA area
  (duplicates are skipped). Room names and icons are inferred from area names.
- **Visibility toggle** — show/hide a room in the sidebar without deleting it.
- **Edit** — open the room editor to add entities, change title/icon, or delete the room.

#### Room editor

Inside a room, tap **Edit** to open its editor:

- Change the room **title** and **icon** (emoji mapped from a list: Home, Living room, Bedroom, etc.).
- **+ Add Entities** — same entity picker as the Overview tab, scoped to this room.
- Use ↑ ↓ / ✕ to reorder or remove entities.
- **Delete this room** — removes the room and all its entities.

> **Note:** Importing from HA Areas creates empty rooms — you need to add
> entities to each room manually. This is intentional: area entities in HA
> include helper entities, media players, and buttons that are not useful in
> a kiosk dashboard.

### Scenarios tab

Scenes and scripts that can be activated with a single tap.

- **+ Add Scenario** — opens a searchable picker for `scene.*` and `script.*` entities.
- Tap a scenario card in the panel to activate it (calls `scene.turn_on` or
  `script.turn_on`). Visual feedback is shown for 1 second after activation.
- Use ↑ ↓ / ✕ to reorder or remove.

### Header tab

Up to **4 mini sensor chips** displayed in the panel header.

- **+ Add Sensor** — opens a sensor picker (sensor domain only). Select a sensor,
  then optionally set a custom **icon** (emoji) and **label** text.
- If no label is set, the entity_id is used.
- Use ✕ to remove a chip.

---

## Supported entity types

| Domain | Features |
|--------|----------|
| `light` | Toggle on/off · brightness slider (long-press tile) |
| `switch` | Toggle on/off |
| `sensor` | Read-only value with unit |
| `binary_sensor` | State display (Open/Closed, Motion/Clear, etc.) |
| `alarm_control_panel` | PIN keypad · Arm Home · Arm Away · Disarm |
| `scene` / `script` | Tap-to-activate (Scenarios section) |

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

Arrows animate based on the direction of energy flow. If a sensor is not
configured (left empty), that branch is greyed out.

> Compatible inverters tested: ZCS Azzurro, SMA, Fronius, Huawei SUN2000.

---

## Alarm panel

The alarm tile shows a PIN keypad when tapped:

1. Enter your PIN using the number buttons.
2. Tap **Arm Home**, **Arm Away**, or **Disarm**.

The PIN is never stored — it is sent directly to HA and immediately cleared.

> If your alarm does not require a PIN, leave the keypad empty and tap the
> action button directly.

---

## Kiosk mode

When `kiosk_mode: true` (default):

- Text selection is disabled — prevents accidental highlighting on long-press.
- Settings are still accessible via the ⚙ icon in the sidebar.
- iOS "Add to Home Screen" meta tags are active. In Safari, tap
  **Share → Add to Home Screen** to launch the panel full-screen with no browser UI.

---

## Opening the panel

After starting the add-on, click **Open Web UI** (the link icon next to the
add-on name in the HA sidebar). The panel URL is served via HA Ingress — no
extra port forwarding is needed.

To open on a tablet:
1. On the tablet, navigate to `http://[HA-IP]:8123`.
2. Log in with a HA user account.
3. Retro Panel should appear in the left sidebar.

---

## Network and WebSocket

Retro Panel maintains a WebSocket connection to Home Assistant and broadcasts
state changes to all connected browsers in real time. If the WebSocket drops,
the panel retries with exponential backoff (1s → 2s → 4s → 8s → 16s → 30s)
and falls back to REST polling in the meantime.

A **reconnecting banner** appears at the top when the connection is lost and
disappears automatically on reconnect.

---

## Troubleshooting

### Panel shows "Failed to load"

- Check the **Log** tab. The most common causes are an incorrect `ha_url` or
  an invalid / expired `ha_token`.
- Test the token: `curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/`

### Tiles not updating in real time

- The WebSocket to HA may be blocked by a firewall or proxy.
- Check the Log tab for `HA WebSocket auth failed` or `HA WebSocket disconnected`.
- REST polling (every `refresh_interval` seconds) keeps states updated even
  without WebSocket.

### "Import from HA Areas" returns no rooms

- Make sure your entities are assigned to areas in **Settings → Areas**.
- If HA has no areas configured, import will return an empty list.
- You can always add rooms manually with **+ Add Room**.

### Alarm PIN not working

- Verify your alarm is configured with a PIN in HA.
- Check the HA logbook for the service call result.
- Make sure `alarm_control_panel` is in the allowed service domains
  (it is allowed by default).

### Brightness slider does not appear

- Long-press the light tile and hold for at least 500 ms without moving your
  finger. A short tap toggles; a long hold shows the slider.

### Entity shows "N/A"

- The entity_id exists in your configuration but was not found in HA (offline,
  removed, or misspelled). Check in **Settings → Devices & Services → Entities**.

### Settings page: "Failed to load entities"

- The add-on cannot reach the HA REST API. Check `ha_url` and token in the
  Configuration tab.
- On large HA instances (>1000 entities), the first load may take a few seconds.

---

## Support

- **GitHub Issues:** `https://github.com/paolobets/retro-panel/issues`
- **Home Assistant Community:** search "Retro Panel" in the Add-ons category
