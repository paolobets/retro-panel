# Retro Panel — User Guide

Retro Panel is a lightweight kiosk dashboard for Home Assistant, designed for **wall-mounted
tablets and always-on displays**. Optimised for iOS 12+ and older devices.

---

## Quick start

### 1. Configure the add-on

Go to the **Configuration** tab in the add-on page:

| Option | Description | Default |
|--------|-------------|---------|
| `ha_url` | Your HA instance URL (e.g. `http://192.168.1.10:8123`) | `http://homeassistant:8123` |
| `ha_token` | Long-Lived Access Token _(leave empty to use Supervisor token)_ | auto |
| `panel_title` | Title shown in the dashboard header | `Home` |
| `theme` | `dark`, `light`, or `auto` (follows device OS preference) | `dark` |
| `refresh_interval` | REST fallback poll interval in seconds (5–300) | `30` |
| `notification_ttl_days` | How many days to keep notifications before they expire (1–365) | `7` |

> **Tip:** Leave `ha_token` empty on Home Assistant OS/Supervised — the add-on automatically
> uses the Supervisor token. Only fill it in if you run the add-on outside Supervisor.

**Creating a Long-Lived Access Token** (only if needed):
1. In HA click your profile picture (bottom-left).
2. Scroll to **Long-Lived Access Tokens** → **Create Token**.
3. Name it (e.g. `retro-panel`) and copy it — it is shown only once.

---

### 2. Start and open

Click **Start**, wait for the green indicator, then click **Open Web UI**.
The panel is served at `http://[HA-IP]:7654` via HA Ingress.

---

### 3. Configure your dashboard

Navigate to **`http://[HA-IP]:7654/config`** to open the admin configuration page.
Use the 5 tabs to set up your dashboard:

| Tab | Purpose |
|-----|---------|
| **Overview** | Main home screen: add entities, power flow card, set navigation order |
| **Rooms** | Create rooms (or import from HA Areas), add entities per section |
| **Scenarios** | Add scenes/scripts/automations, set icon and border colour per item |
| **Cameras** | Add camera feeds, set per-camera refresh interval |
| **Alarms** | Add alarm panels, assign zone sensors per panel |

Click **Save** when done — the dashboard at `/` updates immediately.

---

## Dashboard layout

```
┌─ RETRO PANEL ──────────────── 09:41  ● ─┐
│                                          │
│  Overview   ┌──────┐ ┌──────┐ ┌──────┐  │
│  ─────────  │ 󰔄 ON │ │ 󰒓 OFF│ │21.4°C│  │
│  🏠 Casa    │Soggi.│ │Pompa │ │Temp. │  │
│  🛋 Salotto │      │ │      │ │      │  │
│  🎬 Scene   └──────┘ └──────┘ └──────┘  │
│  📹 Camera  ┌──────┐ ┌──────┐           │
│  🔔 Allarme │ 85%  │ │2.4kW │           │
│             │Batt. │ │Solar │           │
│             └──────┘ └──────┘           │
└──────────────────────────────────────────┘
```

- **Sidebar** — tap ☰ to collapse to icons only
- **Header** — title · date · live clock · connection dot (green = WebSocket, grey = REST polling)
- **Tiles** — fixed 120 px height; icon top-left, state/value top-right, label bottom

---

## Supported entity types

### Lights (`light`)

Tap → toggle on/off.
Long-press (hold ~500 ms) → bottom sheet with **brightness slider**, **colour temperature**
and **hue picker** (shown only for attributes supported by the device).

The brightness percentage appears as a circular arc bubble in the top-right corner.

---

### Switches & input booleans (`switch`, `input_boolean`)

Tap → toggle on/off. Border turns green when ON.
Supports any MDI icon, configurable in `/config`.

---

### Sensors (`sensor`)

Read-only display of the current value and unit.
The visual style and icon adapt to the device class automatically:

| Device class | Display |
|-------------|---------|
| `temperature` | °C / °F value with thermometer icon |
| `humidity` | % value with droplet icon |
| `co2` / `carbon_dioxide` | ppm value with air quality icon |
| `battery` | % value with fill-level bar |
| `energy` / `power` | kW / kWh value |
| `pressure` / `illuminance` / others | value + unit |

---

### Binary sensors (`binary_sensor`)

State-driven icon that changes between active and inactive appearances.
An orange pulsing border indicates an active alert.

| Device class | Active state | Inactive state |
|-------------|-------------|----------------|
| `door` / `window` | APERTO | CHIUSO |
| `motion` / `occupancy` | RILEVATO | CHIARO |
| `smoke` / `gas` | ALLARME | OK |
| `moisture` | BAGNATO | ASCIUTTO |
| `vibration` | VIBRAZIONE | OK |
| `lock` | APERTO | CHIUSO |
| `presence` | IN CASA | ASSENTE |

---

### Covers (`cover`)

Tap → toggle open/close. A position bar shows the current position percentage
when the `current_position` attribute is available.

---

### Conditional sensor

A sensor tile that shows a custom state or label only when defined conditions are met.
Useful for alerts, reminders and state-dependent readouts.

Configure in the `/config` → Rooms or Overview editor:
- **Icon** and **border colour** — visual identity when active
- **Conditions** — entity, operator (`=` `≠` `contains` `>` `<`), value
- **Condition logic** — AND (all must match) or OR (any must match)

---

### Scenarios (`scene`, `script`, `automation`)

Each scenario appears as a tap-to-activate tile with:
- A **domain badge** (`[Scena]` / `[Script]` / `[Automazione]`)
- A **custom MDI icon** (configurable per item in `/config`)
- A **custom border colour** (configurable per item in `/config`)

Tap → brief green flash for 1.5 seconds, then returns to idle.
Service called: `scene.turn_on` · `script.turn_on` · `automation.trigger`

---

### Energy flow card

Visualises home energy flow in real time using up to 7 sensor entities:

```
  ☀ Solare  ──→──  🔋 Batteria (85%)  ──→──  🏠 Casa
                         │  ↑↓
                     ⚡ Rete
```

Animated arrows reflect live energy direction. Configure in **Settings → Overview** →
**+ Add Power Flow Card**, then step through the 7-sensor wizard.

Compatible inverters tested: ZCS Azzurro · SMA · Fronius · Huawei SUN2000.

---

### Alarm panel (`alarm_control_panel`)

```
  DISARMED                    ARMED AWAY
  ┌──────────────────────┐    ┌──────────────────────┐
  │ Allarme Casa         │    │ Allarme Casa         │
  │ DISARMATO            │    │ ARMATO — Fuori       │
  │                      │    │                      │
  │ [Casa] [Fuori][Notte]│    │     [ Disarma ]      │
  │  1  2  3             │    │  ● Porta ingresso    │
  │  4  5  6  [ Arma ]   │    │  ○ Finestra          │
  └──────────────────────┘    └──────────────────────┘
```

- PIN keypad shown only when required by the alarm entity
- Zone sensors (binary_sensor) listed per alarm panel
- **Arm without code**: tap the mode chip → arms immediately
- **Arm with code**: tap mode chip → enter PIN → tap **Arma**
- **Disarm**: tap **Disarma** (optionally enter PIN first)

The PIN is never stored — sent directly to HA and cleared immediately after each action.

Configure alarm entities in **Settings → Alarms** tab. You can add multiple alarm panels
and assign zone sensors to each one.

---

### Cameras (`camera`)

- Live MJPEG stream when the camera supports it; automatic snapshot fallback otherwise
- Configurable per-camera refresh interval (for snapshot polling)
- Tap any camera card → fullscreen lightbox with MJPEG stream

---

## Light controls (bottom sheet)

1. **Long-press** a light tile (hold ~500 ms without moving).
2. A sheet slides up from the bottom.
3. Available controls depend on the device:

| Control | Shown when |
|---------|------------|
| Brightness slider | `brightness` attribute present |
| Colour temperature | `color_temp` attribute present |
| Colour / hue picker | `hs_color` attribute present |

Tap outside the sheet or the × button to close.

---

## iOS kiosk setup (Add to Home Screen)

1. Open **Safari** and navigate to `http://[HA-IP]:7654`
2. Tap the **Share** button → **Add to Home Screen** → **Add**
3. Open the new icon from your Home Screen

The panel launches full-screen with no browser chrome, perfect for wall mounts.

**Hide the HA sidebar and header** using [kiosk-mode](https://github.com/NemesisRE/kiosk-mode)
(installable via HACS). Add to your HA dashboard YAML:

```yaml
kiosk_mode:
  hide_sidebar: '[[[ location.href.includes("hassio/ingress") ]]]'
  hide_header:  '[[[ location.href.includes("hassio/ingress") ]]]'
```

---

## Two URLs

| URL | Purpose |
|-----|---------|
| `http://[HA-IP]:7654/` | **Dashboard** — read-only kiosk for the wall tablet |
| `http://[HA-IP]:7654/config` | **Config UI** — admin interface, requires HA session |

The config UI is also accessible via HA Ingress (`/hassio/ingress/retro_panel/config`).

---

## Real-time updates

Retro Panel maintains a WebSocket connection to Home Assistant and pushes state changes to all
connected browsers in real time. If the WebSocket drops, the panel:
1. Shows a **reconnecting banner** at the top
2. Retries with exponential backoff: 1 s → 2 s → 4 s → 8 s → 16 s → 30 s
3. Falls back to **REST polling** every `refresh_interval` seconds in the meantime

The banner disappears automatically on reconnect.

---

## Notifications

Retro Panel v2.10.0 introduces a push notification system. HA automations can send prioritised
messages to every connected tablet — displayed as a bell indicator, a slide-in drawer, a
top-right toast and (for high/critical alerts) a coloured border around the entire screen.

---

### How it works

1. A Home Assistant automation fires a **`retro_panel_notify`** custom event.
2. The Retro Panel backend receives the event via its live WebSocket connection to HA.
3. The notification is persisted in `/data/notifications.json` (max 100, FIFO).
4. All connected browser clients receive a real-time push and display the notification
   immediately — without page reload.

---

### Sending a notification from HA

Use the `event.fire` service (or the newer `fire_event` action) in any automation or script:

```yaml
service: event.fire
data:
  event_type: retro_panel_notify
  event_data:
    title: "Allarme cucina"
    message: "Il sensore fumo ha rilevato fumo."
    priority: critical
```

| Field | Required | Values | Description |
|-------|----------|--------|-------------|
| `title` | **Yes** | any string | Short heading shown in the bell drawer and toast |
| `message` | No | any string | Body text (optional but recommended) |
| `priority` | No | `info` · `normal` · `high` · `critical` | Controls colour and auto-dismiss behaviour; defaults to `normal` |

---

### Priority levels

| Priority | Colour | Toast auto-dismiss | Bell colour | Body border |
|----------|--------|--------------------|-------------|-------------|
| `info` | Blue | After 4 s | Blue | None |
| `normal` | Green | After 5 s | Green | None |
| `high` | Orange | After 6 s | Orange | Solid orange |
| `critical` | Red | **Never** — tap to dismiss | Red | Pulsing red |

The alert body border (for `high` and `critical`) disappears automatically once all
unread high/critical notifications are marked as read.

---

### The bell icon

The bell button sits in the sidebar, just below the ☰ toggle.

- **Badge**: shows the count of unread notifications; hidden when there are none.
- **Colour**: reflects the highest-priority unread notification (red > orange > green > blue).
- **Tap the bell** → opens the notification drawer.

---

### Notification drawer

The drawer slides in from the left and lists all notifications, **newest first**.

| Action | Effect |
|--------|--------|
| Tap a notification | Marks it as read; alert border updates if no more high/critical unread |
| Tap **×** on a row | Deletes that notification from the list and from the server |
| Tap **Segna tutte lette** | Marks every notification as read in one action |
| Tap the backdrop or **✕** | Closes the drawer |

Unread notifications have a coloured left border matching their priority.

---

### Notification persistence and expiry

- Notifications are saved to `/data/notifications.json` and survive an add-on restart.
- The last **100** notifications are kept; older ones are evicted automatically (FIFO).
- Each notification expires after `notification_ttl_days` days (default: 7).
  Expired notifications are removed at startup and on clean shutdown.
- To change the TTL go to the **Configuration** tab and set `notification_ttl_days`.

---

### Example automation — smoke alarm

```yaml
alias: "Notifica fumo cucina"
trigger:
  - platform: state
    entity_id: binary_sensor.fumo_cucina
    to: "on"
action:
  - service: event.fire
    data:
      event_type: retro_panel_notify
      event_data:
        title: "⚠ Fumo rilevato"
        message: "Sensore cucina attivato — verificare immediatamente."
        priority: critical
```

### Example automation — door left open

```yaml
alias: "Porta aperta da 5 minuti"
trigger:
  - platform: state
    entity_id: binary_sensor.porta_ingresso
    to: "on"
    for: "00:05:00"
action:
  - service: event.fire
    data:
      event_type: retro_panel_notify
      event_data:
        title: "Porta aperta"
        message: "La porta di ingresso è aperta da oltre 5 minuti."
        priority: high
```

---

### Script HA riutilizzabile

Invece di ripetere l'evento `retro_panel_notify` in ogni automazione, conviene creare uno
**script centralizzato** da chiamare con `service: script.retropanel_notify` ovunque serva.

#### Variante A — tramite evento HA (consigliata, nessuna configurazione extra)

```yaml
# scripts.yaml (oppure inline in configuration.yaml sotto scripts:)
retropanel_notify:
  alias: "Retro Panel — Invia notifica"
  description: "Invia una notifica push a tutti i tablet Retro Panel connessi."
  fields:
    title:
      description: "Titolo della notifica"
      required: true
      selector:
        text:
      example: "Allarme cucina"
    message:
      description: "Corpo del messaggio (opzionale)"
      required: false
      selector:
        text:
      example: "Il sensore fumo è attivo"
    priority:
      description: "Priorità: info | normal | high | critical"
      required: false
      default: "normal"
      selector:
        select:
          options: ["info", "normal", "high", "critical"]
  sequence:
    - event: retro_panel_notify
      event_data:
        title: "{{ title }}"
        message: "{{ message | default('') }}"
        priority: "{{ priority | default('normal') }}"
```

Chiamata dall'automazione:

```yaml
action:
  - service: script.retropanel_notify
    data:
      title: "Porta aperta"
      message: "Porta di ingresso aperta da più di 5 minuti."
      priority: high
```

#### Variante B — tramite REST API (utile per test manuali e strumenti esterni)

Aggiungi in `configuration.yaml`:

```yaml
rest_command:
  retropanel_notify:
    url: "http://homeassistant:7654/api/notify"
    method: POST
    headers:
      Content-Type: application/json
    payload: >
      {"title": "{{ title }}",
       "message": "{{ message | default('') }}",
       "priority": "{{ priority | default('normal') }}"}
```

Poi crea lo script che lo espone con i campi tipizzati:

```yaml
retropanel_notify:
  alias: "Retro Panel — Invia notifica (REST)"
  fields:
    title:
      required: true
    message:
      required: false
      default: ""
    priority:
      required: false
      default: "normal"
  sequence:
    - service: rest_command.retropanel_notify
      data:
        title: "{{ title }}"
        message: "{{ message }}"
        priority: "{{ priority }}"
```

Con questa variante puoi testare anche da terminale senza aprire HA:

```bash
curl -X POST http://[HA-IP]:7654/api/notify \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","message":"Funziona!","priority":"high"}'
```

#### Quale scegliere

| | Variante A (evento) | Variante B (REST) |
|---|---|---|
| Configurazione extra | Nessuna | `rest_command` in `configuration.yaml` |
| Test manuale via curl | No | Sì |
| Node-RED / AppDaemon | `fire_event` nativo | HTTP request |
| Percorso dati | WebSocket HA → backend | HTTP → backend |

Per la maggior parte degli utenti la **Variante A** è sufficiente e più semplice.

---

### Troubleshooting notifications

**Bell not appearing**
- Make sure you are running v2.10.0 or later (check the **Info** tab of the add-on).
- Hard-refresh the dashboard: clear browser cache or append `?v=2100` to the URL.

**Notification not arriving**
- Check the add-on **Log** tab for `retro_panel_notify` lines.
- Verify the automation actually fires in the HA logbook.
- Confirm the event name is exactly `retro_panel_notify` (no typos, no spaces).

**Alert border not clearing**
- Open the bell drawer and mark the high/critical notification as read (tap the row).
- If no such notification appears, it may have already expired — tap **Segna tutte lette** anyway.

---

## Troubleshooting

### Panel shows "Failed to load"

1. Check the **Log** tab — look for connection or token errors.
2. Verify `ha_url` (use `http://homeassistant:8123` or the HA IP address, not HTTPS).
3. Test the token: `curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/`
4. Restart the add-on.

### Tiles not updating in real time

- The WebSocket may be blocked by a firewall or proxy.
- Check the Log tab for `HA WebSocket auth failed` or `HA WebSocket disconnected`.
- REST polling keeps states updated even without WebSocket.

### "Import from HA Areas" returns nothing

- Make sure entities are assigned to areas in **Settings → Areas**.
- If no areas are configured, import returns an empty list — add rooms manually.

### Alarm PIN not working

- Verify your alarm is configured with a PIN in HA.
- Check the HA logbook for the service call result.

### Brightness slider does not appear

- Long-press and **hold for at least 500 ms** without moving your finger.
  A short tap toggles; a held press shows the bottom sheet.

### Entity shows "N/A"

- The entity_id is in your config but not found in HA (offline, removed, or misspelled).
  Check in **Settings → Devices & Services → Entities**.

### Settings page: "Failed to load entities"

- The add-on cannot reach the HA REST API. Check `ha_url` and token.
- On large HA instances (>1000 entities), the first load may take a few seconds.

---

## Support

- **GitHub Issues:** https://github.com/paolobets/retro-panel/issues
- **GitHub Discussions:** https://github.com/paolobets/retro-panel/discussions

---

**Version**: 2.10.0 · **Last updated**: 2026-04-07
