# Retro Panel v2.0 — Test Guide

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
  "theme": "dark",
  "refresh_interval": 30
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

Run from the project root:

```bash
python -m pytest tests/ -v
```

**Current status**: 22 tests all passing

Key test modules:

| Module | What it tests |
|--------|--------------|
| `test_config_loader.py` | Config parsing, v2 format, missing fields |
| `test_handlers_service.py` | Service whitelist, entity validation |
| `test_handlers_api.py` | Panel config endpoint, state endpoints |
| `test_ha_client.py` | State sanitization, token isolation |
| `test_layout_type.py` | layout_type computation for all 15 types |

### Frontend — JavaScript

No bundler is used. Manual inspection and browser testing is the primary approach.

---

## 3. Manual Functional Tests

### 3.1 Boot sequence (Dashboard at /)

| # | Step | Expected |
|---|------|----------|
| 1 | Open `http://localhost:7654` | Page loads, spinner shows |
| 2 | Wait ~2s on 4G | Spinner fades, tile grid appears |
| 3 | Check browser console | No errors logged |
| 4 | Check header title | Matches `panel_title` from config |

### 3.2 Two-URL Architecture

| # | Step | Expected |
|---|------|----------|
| 1 | Navigate to `/` | Dashboard displayed (read-only) |
| 2 | Navigate to `/config` | Config UI displayed (admin) |
| 3 | Close browser devtools | No console errors in either view |

### 3.3 Light entity tile (layout_type: light)

| # | Step | Expected |
|---|------|----------|
| 1 | Tap a light tile (state: Off) | Tile toggles on, brightness updates |
| 2 | Tap same tile again | Tile toggles off |
| 3 | Long-press light tile (0.5s+) | Bottom sheet slides up |
| 4 | Adjust brightness slider | Brightness changes, tile updates live |
| 5 | Adjust color temp slider | Color temperature changes |
| 6 | Close sheet (tap X or outside) | Sheet slides down, dismissed |

### 3.4 Switch entity tile (layout_type: switch)

| # | Step | Expected |
|---|------|----------|
| 1 | Tap switch tile (state: Off) | Tile toggles on (green) |
| 2 | Tap same tile again | Tile toggles off |
| 3 | Multiple rapid taps | No race conditions, single final state |

### 3.5 Sensor entity tiles (9 variants)

| # | Step | Expected |
|---|------|----------|
| 1 | `sensor_temperature` | Shows numeric value + "°C" |
| 2 | `sensor_humidity` | Shows percentage value |
| 3 | `sensor_co2` | Shows ppm value |
| 4 | `sensor_battery` | Shows percentage |
| 5 | `sensor_energy` | Shows power (W) or energy (kWh) |
| 6 | `sensor_generic` | Shows value + unit of measurement |
| 7 | All sensors | Tile updates when state changes via WS |

### 3.6 Binary sensor tiles (3 variants)

| # | Step | Expected |
|---|------|----------|
| 1 | `binary_door` | Shows "Open" or "Closed" |
| 2 | `binary_motion` | Shows "Motion" or "Clear" |
| 3 | `binary_standard` | Shows "On" or "Off" |

### 3.7 Alarm entity (layout_type: alarm)

| # | Step | Expected |
|---|------|----------|
| 1 | Tap alarm tile | PIN keypad appears |
| 2 | Enter PIN (1-2-3-4) | Numbers appear as dots |
| 3 | Clear PIN (press X) | PIN cleared |
| 4 | Enter PIN and tap "Arm Home" | Service call sent, visual feedback (1s) |
| 5 | Verify in HA logbook | Service call recorded |

### 3.8 Camera entity (layout_type: camera)

| # | Step | Expected |
|---|------|----------|
| 1 | Camera tile visible | MJPEG stream displays |
| 2 | Tap refresh icon | Stream refreshes |
| 3 | Leave open for 30s | Stream continues without stalling |

### 3.9 Scenario entity (layout_type: scenario)

| # | Step | Expected |
|---|------|----------|
| 1 | Tap scenario tile | Service call sent, visual feedback (1s) |
| 2 | Verify in HA logbook | Service called (scene.turn_on, script.turn_on, or automation.trigger) |

### 3.10 Energy Flow Card (layout_type: energy_flow)

| # | Step | Expected |
|---|------|----------|
| 1 | Energy flow tile visible | Shows Solar → Battery → Home + Grid |
| 2 | Change power values in HA | Arrows animate, flow direction changes |
| 3 | Disable one branch | Branch greys out |

### 3.11 Sidebar Navigation

| # | Step | Expected |
|---|------|----------|
| 1 | Click ☰ (collapse) | Sidebar collapses to icons only |
| 2 | Click ☰ again | Sidebar expands to show labels |
| 3 | Click room name | Room section renders in content area |
| 4 | Click "Overview" | Overview section renders |
| 5 | Click "Scenarios" | Scenarios list renders |
| 6 | Click "Cameras" | Cameras list renders |

### 3.12 Config UI at /config (4 tabs)

| # | Step | Expected |
|---|------|----------|
| 1 | Navigate to `/config` | Config page loads |
| 2 | Click "Overview" tab | Shows entities on home screen |
| 3 | Click "+ Add Entities" | Entity picker opens, loads entities from HA |
| 4 | Select an entity | Added to overview |
| 5 | Click "Rooms" tab | Shows rooms list |
| 6 | Click "Scenarios" tab | Shows auto-populated scenario list |
| 7 | Click "Cameras" tab | Shows auto-populated camera list |

### 3.13 WebSocket Connection

| # | Step | Expected |
|---|------|----------|
| 1 | Open browser DevTools | Network tab shows WebSocket at `/ws` |
| 2 | Status shows "101 Switching Protocols" | Connection successful |
| 3 | Change entity in HA | Browser receives `state_changed` message within 100ms |
| 4 | Close WebSocket in DevTools | Connection indicator turns grey |
| 5 | Wait 30s | Connection auto-reconnects (exponential backoff) |
| 6 | Change entity again | Panel updates via REST polling (fallback) |

### 3.14 REST Polling Fallback

| # | Step | Expected |
|---|------|----------|
| 1 | Simulate network issue (block WebSocket) | Connection indicator turns grey |
| 2 | Change entity in HA | Panel updates every `refresh_interval` seconds |
| 3 | DevTools Network tab | See periodic GET /api/states/all requests |

### 3.15 iOS 12 Compatibility Checklist

| # | Step | Expected |
|---|------|----------|
| 1 | Page loads | No white screen hang (< 5 seconds) |
| 2 | All tiles render | No layout broken, text visible |
| 3 | Tap light tile | Toggles instantly, bottom sheet slides up |
| 4 | Long-press light | Brightness slider visible |
| 5 | Adjust slider | Smooth (60 FPS), no lag or jank |
| 6 | Network issues | Reconnects without user action |
| 7 | Console check (F12) | No errors or warnings |

### 3.16 CSS Constraints Verification

| # | Step | Expected |
|---|------|----------|
| 1 | Inspect tile heights | Light/Switch = 120px (triple-lock) |
| 2 | Inspect sensor tiles | Min 72px (triple-lock) |
| 3 | Inspect alarm tile | Min 240px (triple-lock) |
| 4 | Inspect camera tile | Min 160px (triple-lock) |
| 5 | Layout CSS | No `gap:` on flex, no `inset:`, no `100dvh` |
| 6 | Test responsive | Mobile (<599px) and landscape (≥1024px) |

---

## 4. Performance Testing

### Page Load Time (4G simulation)

1. Open DevTools → Network tab
2. Set throttling to "Slow 4G" (1 Mbps)
3. Hard refresh page (Ctrl+Shift+R)
4. **Expected**: < 2 seconds (DOMContentLoaded)

### Service Call Latency

1. Open DevTools → Network tab
2. Tap a light tile
3. **Expected**: POST /api/service/light/turn_on completes in < 500 ms

### Memory Usage

1. Open DevTools → Memory tab
2. Record heap snapshot
3. Interact with tiles for 30s (expand sidebar, navigate rooms, open config)
4. Record another heap snapshot
5. **Expected**: < 50 MB heap increase

### CSS & JS Bundle Sizes

```bash
# Check sizes
wc -c app/static/js/*.js
wc -c app/static/css/*.css
```

**Expected**:
- Total JS: < 20 KB (uncompressed)
- Total CSS: < 25 KB (uncompressed)

---

## 5. Platform-Specific Testing

### iOS Safari (iPad)

1. Connect iPad to Mac via USB
2. Safari → Develop → [Device Name] → [Website]
3. Run manual functional tests (section 3)
4. Check console for errors

### Android Chrome

1. Connect Android device via USB
2. `chrome://inspect`
3. Select device and inspect
4. Run manual functional tests

### Desktop Browsers

Test on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)

---

## 6. layout_type Visual Checklist

All 15 layout_types should render without errors:

- [ ] `light` — Toggle + bottom sheet controls
- [ ] `switch` — Toggle on/off
- [ ] `sensor_temperature` — Temperature display
- [ ] `sensor_humidity` — Humidity display
- [ ] `sensor_co2` — CO₂ display
- [ ] `sensor_battery` — Battery percentage
- [ ] `sensor_energy` — Power/energy display
- [ ] `sensor_generic` — Generic sensor
- [ ] `binary_door` — Door/window status
- [ ] `binary_motion` — Motion detector
- [ ] `binary_standard` — Binary sensor (generic)
- [ ] `alarm` — PIN keypad + arm/disarm
- [ ] `camera` — MJPEG stream
- [ ] `scenario` — Tap-to-activate
- [ ] `energy_flow` — Power flow visualization

---

## 7. Test Data (Sample config.json)

For manual testing, use this sample configuration:

```json
{
  "version": 2,
  "overview": {
    "title": "Home",
    "items": [
      {
        "type": "entity",
        "entity_id": "light.living_room",
        "label": "Living Room",
        "layout_type": "light"
      },
      {
        "type": "entity",
        "entity_id": "switch.fan",
        "label": "Fan",
        "layout_type": "switch"
      },
      {
        "type": "entity",
        "entity_id": "sensor.temperature",
        "label": "Temperature",
        "layout_type": "sensor_temperature"
      }
    ]
  },
  "rooms": [
    {
      "id": "room_bedroom",
      "title": "Bedroom",
      "icon": "bedroom",
      "sections": [
        {
          "id": "sec_lights",
          "title": "Lights",
          "items": [
            {
              "type": "entity",
              "entity_id": "light.bedroom_light",
              "label": "Ceiling",
              "layout_type": "light"
            }
          ]
        }
      ]
    }
  ],
  "scenarios": [
    {
      "type": "entity",
      "entity_id": "scene.bedtime",
      "label": "Bedtime"
    }
  ],
  "cameras": [
    {
      "entity_id": "camera.bedroom",
      "label": "Bedroom Camera"
    }
  ]
}
```

---

**Document Version**: 2.0
**Last Updated**: 2026-03-27
**Maintainer**: Retro Panel Team
