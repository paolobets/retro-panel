# Retro Panel — Home Assistant Add-on

[![Release][release-badge]][release-url]
[![License][license-badge]](LICENSE)
[![HA Supervisor][ha-badge]][ha-url]
[![Supports aarch64][aarch64-badge]][aarch64-url]
[![Supports amd64][amd64-badge]][amd64-url]
[![Supports armhf][armhf-badge]][armhf-url]
[![Supports armv7][armv7-badge]][armv7-url]

[release-badge]: https://img.shields.io/github/v/release/paolobets/retro-panel?style=flat-square
[release-url]: https://github.com/paolobets/retro-panel/releases
[license-badge]: https://img.shields.io/github/license/paolobets/retro-panel?style=flat-square
[ha-badge]: https://img.shields.io/badge/Home%20Assistant-2023.1%2B-blue?style=flat-square
[ha-url]: https://www.home-assistant.io/
[aarch64-badge]: https://img.shields.io/badge/aarch64-yes-green?style=flat-square
[amd64-badge]: https://img.shields.io/badge/amd64-yes-green?style=flat-square
[armhf-badge]: https://img.shields.io/badge/armhf-yes-green?style=flat-square
[armv7-badge]: https://img.shields.io/badge/armv7-yes-green?style=flat-square
[aarch64-url]: https://github.com/paolobets/retro-panel
[amd64-url]: https://github.com/paolobets/retro-panel
[armhf-url]: https://github.com/paolobets/retro-panel
[armv7-url]: https://github.com/paolobets/retro-panel

---

**A touch-optimized kiosk dashboard for Home Assistant, built for legacy and older devices.**

Give a second life to an old iPad, Android tablet, Kindle Fire, or any device
that no longer receives OS updates and struggles with the standard Lovelace interface.
Retro Panel is a lightweight, always-on control panel designed to work flawlessly on
**legacy browsers and older devices**, without requiring any modern JavaScript features.

---

## Features

- **Works on old devices** — legacy browsers and older devices that no longer receive OS updates
- **Real-time updates** — WebSocket-powered, with REST fallback if WS drops
- **Touch-optimized** — 56px+ tap targets, zero tap delay, immediate visual feedback
- **Secure** — HA token stays on the server, never reaches the browser
- **Kiosk ready** — "Add to Home Screen" on iOS for full-screen, no browser chrome
- **Configurable grid** — 2, 3 or 4 columns, optional manual tile positioning
- **Themes** — dark, light, or auto (follows device preference)

### Supported entity types

| Entity | What you can do |
|--------|----------------|
| `light` | Toggle on/off · Long-press for brightness slider |
| `switch` | Toggle on/off |
| `sensor` | Read-only value with unit |
| `binary_sensor` | Open/Closed, Motion/Clear, Home/Away, Wet/Dry… |
| `alarm_control_panel` | PIN keypad · Arm Home · Arm Away · Disarm |

---

## Installation

### Step 1 — Add this repository to Home Assistant

In Home Assistant, go to:

**Settings → Add-ons → Add-on Store → ⋮ (top right) → Repositories**

Add the following URL:

```
https://github.com/paolobets/retro-panel
```

### Step 2 — Install the add-on

Refresh the Add-on Store page. **Retro Panel** will appear. Click it, then
click **Install**.

### Step 3 — Configure

Go to the **Configuration** tab and fill in at minimum:

- **HA URL** — your Home Assistant URL (e.g. `http://192.168.1.10:8123`)
- **HA Token** — a Long-Lived Access Token (create one in your HA profile)
- **Entities** — the list of entities to show on the panel

See [DOCS.md](DOCS.md) for a full configuration reference and examples.

### Step 4 — Start and open

Click **Start**, then **Open Web UI**. The panel is accessible via HA Ingress
— no port forwarding needed.

---

## Configuration example

```yaml
ha_url: http://192.168.1.10:8123
ha_token: eyJ0eXAiOiJKV1Q...   # create in HA Profile
panel_title: Casa
columns: 3
theme: dark
refresh_interval: 30
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

---

## Architecture

```
Old tablet (legacy browser / Android)
  ↓  HTTPS via HA Ingress (auth handled by Supervisor)
Home Assistant Supervisor
  ↓  HTTP internal
Retro Panel — Python 3.11 + aiohttp (port 7654)
  ├── Serves static HTML / CSS / ES2017 JS
  ├── Proxies HA REST API  (token stays server-side)
  └── Bridges HA WebSocket → browser WebSocket
        (1 HA connection, fan-out to N browser clients)
```

---

## Security

Retro Panel is designed with a layered security model. The following setup is recommended:

### Backend token (required)

Create a dedicated Home Assistant user for the add-on backend — do **not** use your personal account:

1. In HA: **Settings → People → Add Person** — name it e.g. `Retro Panel`, enable **Allow login**.
2. Set the **Administrator** role.
3. Log in as that user, go to **Profile → Long-Lived Access Tokens → Create Token**.
4. Copy the token and set it as `ha_token` in the add-on configuration.

The token is stored server-side and **never sent to the browser**.

### Kiosk tablet user (recommended)

Use a **separate, non-admin** HA account for the tablet:

1. Create a new HA user (e.g. `Tablet`) without the Administrator role.
2. On the tablet, log in to Home Assistant with that account.
3. The tablet user can view and control entities, but cannot access add-on administration.
4. Keep the tablet on your **local network only** — do not expose it directly to the internet.

### External access

If you access Home Assistant from outside your network:

- Use **Cloudflare Tunnel** or a **VPN** (e.g. WireGuard built into HA) — avoid direct port forwarding.
- Enable **Multi-Factor Authentication (2FA)** for all admin accounts: **Settings → People → [user] → Multi-factor Authentication**.
- The add-on API is only accessible through HA Ingress — it is not reachable without a valid HA session.

### Summary

| Layer | Mechanism | Who configures it |
|-------|-----------|-------------------|
| Network | Cloudflare Tunnel or VPN | You (router/HA) |
| Authentication | HA Ingress (session required) | HA (automatic) |
| Admin protection | 2FA for admin accounts | You (HA settings) |
| Token isolation | LLAT stays server-side | Add-on (by design) |
| Kiosk isolation | Non-admin local-only user | You (HA settings) |

---

## Roadmap

| Version | Status | Content |
|---------|--------|---------|
| **v2.0** | Released | Full frontend/backend refactor, layout_type system, two-URL architecture |
| **v2.9** | Released | Energy Card v2, Camera grid+lightbox, Alarm tile full redesign, Security hardening |
| **v2.9.14** | **Current** | Alarm UX: status hierarchy, WCAG touch targets, direct arm without code |
| **v3.0** | Planned | Plugin system, custom themes, history charts, offline-first |

---

## Documentation

Full documentation is in [`DOCS.md`](DOCS.md):

- Step-by-step configuration
- Entity fields reference
- Icon reference
- Alarm PIN usage
- Kiosk mode / Add to Home Screen
- Troubleshooting

Technical documentation is in [`docs/`](docs/):

| File | Purpose |
|------|---------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flows, security model |
| [API.md](docs/API.md) | Backend endpoints and WebSocket protocol |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Developer guide, adding entity types |
| [TESTING.md](docs/TESTING.md) | Test procedures and security tests |
| [AUDIT_REPORT.md](docs/AUDIT_REPORT.md) | Security audit report (v1.0.1) |

---

## License

MIT — see [LICENSE](LICENSE)
