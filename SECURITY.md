# Security Policy

## Supported Versions

Retro Panel is distributed as a Home Assistant add-on. Only the **latest stable release** receives security fixes. Beta versions (`-rcN`) are pre-release and may be superseded at any time.

| Version | Supported |
| ------- | --------- |
| Latest stable (see [Releases](https://github.com/paolobets/retro-panel/releases)) | ✅ |
| Current beta channel | Best effort |
| Older stable versions | ❌ |

## Reporting a Vulnerability

**Please do NOT open public GitHub issues for security vulnerabilities.**

Report privately:

- **Email:** paolo.bets@gmail.com
- **Subject prefix:** `[RETRO PANEL SECURITY]`
- Include: affected version (`2.18.0`, beta `2.18.0-rc35`, etc.), reproduction steps, impact, and any logs (redact tokens / camera URLs / `X-Hassio-Key`).

Acknowledgement within **5 business days**. Coordinated disclosure: a fix is released before public details.

## In scope

- The Retro Panel add-on backend (Python / aiohttp).
- The Retro Panel frontend (vanilla JS kiosk dashboard).
- Auth / ingress handling and CIDR validation (`X-Ingress-Path` spoofing class).
- Camera proxy, notify endpoint, calendar enumeration, CSRF surface.

## Out of scope

- Vulnerabilities in Home Assistant Core or Supervisor → report upstream.
- Vulnerabilities in third-party cameras / MQTT brokers / HA integrations consumed via API → report upstream.
- Issues requiring an attacker who is already a Home Assistant administrator.

## Hardening notes

- The default network binding may be `0.0.0.0/0` for kiosk convenience — restrict via firewall when exposing beyond LAN.
- Keep API tokens stored in HA secrets, not in the panel config UI.
- The kiosk frontend is designed for trusted LAN tablets; **do not** expose `:7654` to the public internet.
