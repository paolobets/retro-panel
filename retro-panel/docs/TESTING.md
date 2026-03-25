# Retro Panel — Test Guide

## Overview

This guide covers manual and automated testing procedures for the Retro Panel Home Assistant Add-on. All tests must pass before any release.

---

## 1. Environment Setup

### Local development (without HA)

1. Create `data/options.json` in the project root:

```json
{
  "ha_url": "http://homeassistant.local:8123",
  "ha_token": "YOUR_LONG_LIVED_TOKEN",
  "panel_title": "Test Panel",
  "columns": 3,
  "theme": "dark",
  "kiosk_mode": false,
  "refresh_interval": 30,
  "entities": [
    { "entity_id": "light.living_room", "label": "Living Room" },
    { "entity_id": "switch.fan", "label": "Fan" },
    { "entity_id": "sensor.temperature", "label": "Temperature" },
    { "entity_id": "binary_sensor.front_door", "label": "Front Door" },
    { "entity_id": "alarm_control_panel.home_alarm", "label": "Alarm" }
  ]
}
```

2. Install dependencies and start the server:

```bash
cd app
pip install -r requirements.txt
python server.py
```

3. Open `http://localhost:7654` in a browser.

### Docker (local)

```bash
docker build -t retro-panel .
docker run -p 7654:7654 -v $(pwd)/data:/data retro-panel
```

### Home Assistant Add-on

Follow `docs/INSTALLATION.md` to install via the HA Add-on Store.

---

## 2. Unit / Integration Tests

### Backend — Python

Run from the `app/` directory:

```bash
pytest tests/ -v
```

Key test modules (create under `app/tests/` if not present):

| Module | What it tests |
|--------|--------------|
| `test_loader.py` | Config parsing, missing fields, invalid entity_id |
| `test_handlers_service.py` | Service allowlist, entity_id validation, dict type check |
| `test_handlers_state.py` | Entity format validation, entity whitelist |
| `test_ha_client.py` | State sanitization, token isolation |
| `test_rate_limiter.py` | Rate limiting enforcement, IP eviction at 5000 entries |

### Frontend — JavaScript

No bundler is used. Manual inspection is the primary approach. For automated browser tests, use Playwright or Cypress against a running local server.

---

## 3. Manual Functional Tests

### 3.1 Boot sequence

| # | Step | Expected |
|---|------|----------|
| 1 | Open the panel URL | Loading spinner shown |
| 2 | Wait ~1s on LAN | Spinner fades out, tile grid appears |
| 3 | Check browser console | No errors logged |
| 4 | Check panel title | Matches `panel_title` from config |

### 3.2 Light entity tile

| # | Step | Expected |
|---|------|----------|
| 1 | Tap a light tile (state: Off) | Tile turns green, value shows "On" |
| 2 | Tap the same tile again | Tile returns to off state, value shows "Off" |
| 3 | Long-press (hold 0.6s) a light tile | Brightness slider appears |
| 4 | Drag slider to 50% | Value label updates to ~50% |
| 5 | Release slider | Brightness service call sent (verify in HA logbook) |
| 6 | Long-press again | Slider hides |
| 7 | Tap while slider visible | Toggle fires (slider stays visible) |
| 8 | Simulate HA service failure (disconnect) | Tile reverts to previous state |

### 3.3 Switch entity tile

| # | Step | Expected |
|---|------|----------|
| 1 | Tap a switch tile (state: Off) | Tile turns green, value shows "On" |
| 2 | Tap again | Returns to off |
| 3 | Simulate failure | Reverts to previous state |

### 3.4 Sensor / Binary sensor tile

| # | Step | Expected |
|---|------|----------|
| 1 | View a sensor tile | Value shows formatted reading with unit (e.g. "21.5 °C") |
| 2 | View binary_sensor (door, state: on) | Shows "Open" |
| 3 | View binary_sensor (door, state: off) | Shows "Closed" |
| 4 | View binary_sensor (motion, state: on) | Shows "Motion" |
| 5 | Sensor tile | Not interactive (tap does nothing) |

### 3.5 Alarm control panel tile

| # | Step | Expected |
|---|------|----------|
| 1 | View alarm tile (state: disarmed) | "Arm Home" and "Arm Away" shown, "Disarm" hidden |
| 2 | Enter PIN digits | PIN display shows dots (one per digit) |
| 3 | Tap ⌫ | Last dot removed |
| 4 | Tap "Arm Home" | HA receives `alarm_arm_home` with code |
| 5 | Alarm state → armed_away | Only "Disarm" shown |
| 6 | Alarm state → triggered | "Disarm" shown with red/danger style |
| 7 | Tap "Disarm" with correct PIN | Alarm disarmed |
| 8 | Tap "Disarm" with wrong PIN | Error message shown |
| 9 | Alarm tile spans full grid row | Tile full-width regardless of columns setting |

### 3.6 WebSocket real-time updates

| # | Step | Expected |
|---|------|----------|
| 1 | Change a light in HA (via HA UI) | Panel tile updates within ~1s without refresh |
| 2 | Disconnect network briefly | Disconnect banner shown, status dot turns red |
| 3 | Reconnect network | WS reconnects, banner hides, dot turns green |
| 4 | Disconnect for > refresh_interval seconds | REST poll fires, states updated |

### 3.7 Themes

| # | Step | Expected |
|---|------|----------|
| 1 | Set `theme: dark` | Dark background, light text |
| 2 | Set `theme: light` | Light background, dark text |
| 3 | Set `theme: auto`, OS dark | Dark theme applied |
| 4 | Set `theme: auto`, OS light | Light theme applied |

### 3.8 Kiosk mode

| # | Step | Expected |
|---|------|----------|
| 1 | Set `kiosk_mode: true` | Text selection disabled on long-press |
| 2 | Attempt to select text | Cursor shows prohibited style, no selection |

### 3.9 Grid layout

| # | Step | Expected |
|---|------|----------|
| 1 | Set `columns: 2` | Grid shows 2 columns |
| 2 | Set `columns: 3` | Grid shows 3 columns |
| 3 | Set `columns: 4` | Grid shows 4 columns |
| 4 | Entity with `row`/`col` set | Tile placed at specified grid position |

---

## 4. Touch / Mobile Tests

These tests **must** be performed on a real iOS device (or Safari simulator).

| # | Test | Expected |
|---|------|----------|
| 1 | Tap tile | No 300ms delay |
| 2 | Tap tile | No blue tap highlight |
| 3 | Scroll page (if taller than viewport) | Tiles not accidentally activated |
| 4 | Long-press tile | Slider appears without triggering toggle |
| 5 | Drag brightness slider | Does not scroll page |
| 6 | All tap targets | ≥ 56px height |
| 7 | Alarm keypad keys | ≥ 48px, no accidental double-tap |
| 8 | Text readability | No overflow, no truncation |

---

## 5. Security Tests

### 5.1 CORS

```bash
# Should NOT return CORS header (wrong origin)
curl -H "Origin: https://evil.com" http://localhost:7654/api/states -v 2>&1 | grep -i access-control

# Should return CORS header (correct HA origin)
curl -H "Origin: http://homeassistant.local:8123" http://localhost:7654/api/states -v 2>&1 | grep -i access-control
```

### 5.2 Security headers

```bash
curl -I http://localhost:7654/
# Expected headers:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Referrer-Policy: no-referrer
# Content-Security-Policy: default-src 'self'; ...
```

### 5.3 Service allowlist

```bash
# Should return 400
curl -X POST http://localhost:7654/api/service/light/alarm_trigger \
  -H "Content-Type: application/json" -d '{"entity_id":"light.test"}'

# Should return 403 (entity not in config)
curl -X POST http://localhost:7654/api/service/light/turn_on \
  -H "Content-Type: application/json" -d '{"entity_id":"light.not_configured"}'
```

### 5.4 Entity ID validation

```bash
# Should return 400 (path traversal attempt)
curl http://localhost:7654/api/state/light/../../../etc/passwd

# Should return 400 (invalid format)
curl http://localhost:7654/api/state/LIGHT.ROOM
```

### 5.5 Rate limiting

```bash
# Send 12 rapid requests — 11th and 12th should return 429
for i in $(seq 1 12); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:7654/api/service/light/turn_on \
    -H "Content-Type: application/json" -d '{"entity_id":"light.living_room"}'
done
```

### 5.6 HA token isolation

```bash
# Verify token is NOT in any API response
curl http://localhost:7654/api/config | grep -i token
# Expected: no match
```

### 5.7 Error detail isolation

```bash
# Trigger a 502 by pointing ha_url at an unreachable host
curl http://localhost:7654/api/states
# Response body must NOT contain stack traces or Python exception text
```

---

## 6. Performance Tests

| Metric | Target | How to measure |
|--------|--------|---------------|
| First tile render | < 2s on LAN | Chrome DevTools Network → DOMContentLoaded |
| WebSocket connect | < 1s after page load | WS frame in DevTools Network tab |
| State update latency | < 500ms | Change entity in HA, watch tile update |
| Memory (browser) | < 50 MB after 1 hour | Chrome Task Manager |
| Memory (server) | < 100 MB RSS | `docker stats` |

---

## 7. Configuration Edge Cases

| Case | Expected behavior |
|------|------------------|
| Empty `entities: []` | Empty grid, no errors |
| Unknown domain (e.g. `media_player.tv`) | Warning logged, tile skipped |
| Entity not found in HA | Tile shows "N/A" (unavailable) |
| Missing `ha_url` in options.json | Server refuses to start with clear error |
| `columns` not in (2, 3, 4) | Defaults to 3 |
| `refresh_interval: 0` or null | Defaults to 30 |
| Very long entity label | Label truncates with ellipsis, no layout break |

---

## 8. Regression Tests (Post-Fix Verification)

These tests verify the two critical bugs found during code review are fixed.

### BUG-001: Panel never displays (app.js)

1. Open the panel URL
2. Verify the tile grid appears after loading
3. Verify no `display: none` on `#panel` after boot (check via DevTools Elements)

Previously: `removeAttribute('hidden')` + `style.display = 'flex'` — overridden by `.hidden { display: none !important }`.

### BUG-002: Long-press always triggers toggle (light.js)

1. Long-press a light tile for > 500ms
2. Verify the brightness slider appears
3. Verify the light state does NOT toggle (HA logbook should show no service call)
4. Tap the tile normally
5. Verify the light toggles correctly

Previously: expired `longPressTimer` ID remained truthy, causing `touchend` to call `handleTap()` after every long-press.

---

## 9. Acceptance Criteria

All of the following must pass before a release is tagged:

- [ ] All manual functional tests pass on desktop (Chrome, Firefox, Safari)
- [ ] All touch tests pass on iOS 12+ Safari (real device or simulator)
- [ ] All security tests pass
- [ ] Panel loads in < 2s on LAN
- [ ] No console errors on load or interaction
- [ ] BUG-001 and BUG-002 regression tests pass
- [ ] Docker image builds successfully for aarch64, amd64, armhf, armv7
- [ ] Add-on installs and starts in Home Assistant without errors
