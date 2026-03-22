# Retro Panel

Touch-optimized kiosk dashboard for Home Assistant, compatible with iOS 15 Safari and legacy browsers.

## What it does

Retro Panel is a Home Assistant Add-on that provides a lightweight, always-on control panel for wall-mounted tablets and kiosk displays. It works on older devices that struggle with the standard Lovelace interface.

## Key features

- Works on iOS 15 Safari, old Android browsers
- Real-time updates via WebSocket (with REST polling fallback)
- Touch-optimized: 56px+ targets, no tap delay, immediate visual feedback
- HA token never exposed to the browser
- Supports: lights, switches, alarm panel, sensors
- Dark / light / auto themes
- Configurable grid (2, 3, or 4 columns)

## Quick start

### Local development
```bash
cd app
cp data/options.json.example data/options.json
# Edit options.json: set ha_url and ha_token
pip3 install -r requirements.txt
python3 server.py
# Open http://localhost:7654
```

### Install in Home Assistant
1. Copy the `retro-panel/` folder to `/addons/` on your HA host
2. HA → Settings → Add-ons → Store → Reload
3. Install "Retro Panel" → configure → start

## Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `ha_url` | HA instance URL | `http://homeassistant.local:8123` |
| `ha_token` | Long-lived access token | (required) |
| `panel_title` | Title shown at top | `Home` |
| `columns` | Grid columns: 2, 3, or 4 | `3` |
| `theme` | `dark`, `light`, or `auto` | `dark` |
| `kiosk_mode` | Prevents text selection | `true` |
| `refresh_interval` | Fallback poll interval (s) | `30` |
| `entities` | List of entities to show | `[]` |

## Documentation

All documentation is in [`docs/`](docs/):

| File | Purpose |
|------|---------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flows, security model |
| [PROJECT.md](docs/PROJECT.md) | Goals, design decisions (ADRs), constraints |
| [ROADMAP.md](docs/ROADMAP.md) | v1.0 → v1.5 → v2.0 feature roadmap |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Developer guide, adding entity types |
| [API.md](docs/API.md) | Backend endpoints, WebSocket protocol |

> **Before any new development**: read `docs/ARCHITECTURE.md` and `docs/API.md` to avoid breaking changes.

## Architecture in brief

```
iPad (iOS 15 Safari)
  ↓ HTTPS via HA Ingress
HA Supervisor (authenticates session)
  ↓ HTTP internal
Retro Panel (Python/aiohttp, port 7654)
  ├── serves static HTML/CSS/JS
  ├── proxies HA REST API (token stays server-side)
  └── bridges HA WebSocket → browser WebSocket
        (1 HA connection, N browser clients)
```

## Roadmap

- **v1.0** (current): light, switch, alarm, sensor entities
- **v1.5**: camera, cover, input_boolean, multiple pages, auto-layout
- **v2.0**: climate, media_player, panel PIN lock, history sparklines

## License

MIT
