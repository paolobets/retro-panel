# Media Player Component — Design Spec

**Date:** 2026-04-13
**Branch:** dev
**Version target:** next minor after 2.13.0

## Summary

Full-featured media player component for Retro Panel. Supports Echo, Apple TV, HomePod, Sonos, and Samsung TV. Tile dynamically switches between wide (playing/paused) and compact (idle/off). Bottom sheet provides complete remote control with dynamic sections based on device capabilities.

## Device Targets

- Amazon Echo (speaker/assistant)
- Apple TV (media streaming)
- HomePod (Apple speaker)
- Sonos (multi-room audio)
- Samsung TV (smart TV)

## Tile Design

### Wide Tile (playing / paused / buffering)

Occupies 2 columns in the grid (`tile-col-media-wide`, `flex: 0 0 50%`).

Layout: horizontal flex row.
- **Left:** Cover art 96x96px, border-radius 6px. Loaded via backend proxy (`/api/media_proxy/{entity_id}`). Fallback: gradient background + SVG icon (music note for speakers, TV icon for TVs).
- **Right:** Stacked vertically:
  - Title (media_title, 12px bold, ellipsis overflow)
  - Artist (media_artist, 10px, secondary color)
  - Device name (friendly_name, 10px, tertiary color)
  - Bottom row: mini transport buttons (prev, play/pause, next) + volume percentage

Border color indicates state:
- `--c-on` (green) = playing
- `--c-warning` (orange) = paused/buffering

**Interaction:**
- Tap on mini buttons (prev/play-pause/next) = direct action, no bottom sheet
- Tap anywhere else on tile = opens bottom sheet
- Touch targets: min 44px tap area per iOS guidelines

### Compact Tile (idle / standby / off / unavailable)

Standard 120px tile, 1 column (`tile-col-compact`).

Layout: vertical, centered.
- Icon (28px SVG, domain-appropriate: TV, speaker, music note)
- Device name (11px bold)
- State text (10px, secondary color: "Off", "Idle", "Standby", "Non disponibile")

Styling: reduced opacity (0.7), grey tones, no colored border. Consistent with all other off-state tiles in the panel.

**Interaction:**
- Tap = opens bottom sheet (can power on from there)

### State Switching

Automatic via WebSocket `state_changed` events. `updateTile` handles:
- `playing`, `paused`, `buffering` → wide tile, update cover/title/artist/controls
- `idle`, `standby`, `off`, `unavailable` → compact tile

The switch requires changing the column wrapper class from `tile-col-compact` to `tile-col-media-wide` (or vice versa). This is done in `updateTile` by accessing `tile.parentNode` (the column wrapper).

## Bottom Sheet

Vertical continuous layout, opened from both tile states. Dedicated DOM block `#media-sheet` in `index.html` (separate from light/climate bottom sheets).

### Sections (top to bottom)

All sections are present in the DOM. Visibility controlled by `display:none` based on `supported_features` bitmask and available attributes.

#### 1. Header (always visible)
- Cover art 80x80 (same proxy + fallback)
- Title, artist, device name, state text
- Power button (top right) — visible only if TURN_ON/TURN_OFF supported

#### 2. Progress Bar (if SEEK supported + media_position available)
- Thin bar with thumb indicator
- Current time / total duration labels
- Touch-seekable (touchmove on bar → `media_seek` service call with debounce)
- Position updates from `media_position` + `media_position_updated_at` attributes, interpolated client-side

#### 3. Transport Controls (always visible if any PLAY/PAUSE/NEXT/PREV supported)
- Row: shuffle | prev | play/pause (large, 52px) | next | repeat
- Shuffle button: visible only if SHUFFLE_SET supported, highlighted when active
- Repeat button: visible only if REPEAT_SET supported, cycles off/all/one
- Play/pause: single button, toggles based on current state

#### 4. Volume (if VOLUME_SET supported)
- Mute toggle button (left)
- Horizontal slider (touchmove with debounce, same pattern as light brightness)
- Percentage label (right)
- Service: `volume_set` with `volume_level` (0.0–1.0)
- Mute service: `volume_mute` with `is_volume_muted`

#### 5. Source Selector (if SELECT_SOURCE supported + source_list available)
- Native `<select>` element styled as card — iOS 12 renders as native wheel picker
- Populated from `source_list` attribute
- Current value from `source` attribute
- On change: `select_source` service call

#### 6. Sound Mode (if SELECT_SOUND_MODE supported + sound_mode_list available)
- Same pattern as source selector: native `<select>` styled as card
- Populated from `sound_mode_list` attribute
- Current value from `sound_mode` attribute
- On change: `select_sound_mode` service call

#### 7. Speaker Grouping (if GROUPING supported + group_members available)
- List of all `media_player.*` entities configured in the panel
- Current device shown as "MASTER" (not toggleable)
- Other speakers: checkbox-style toggle to join/unjoin
- Joined speakers (in `group_members`) shown as checked
- Join: `join` service with `group_members` list
- Unjoin: `unjoin` service on the member entity

### Bottom Sheet Close
- Tap on overlay backdrop
- Close button (✕) top-right
- Same pattern as existing bottom sheets

## Backend

### New Endpoint: Media Proxy

**File:** `app/api/media_proxy.py`

`GET /api/media_proxy/{entity_id}`

- Validates `entity_id` format via regex (same as camera_proxy)
- Validates entity is in configured whitelist (panel entities)
- Fetches entity state from HA to get `entity_picture` URL
- Proxies the image from HA (streams response)
- Cache header: `Cache-Control: max-age=30` (cover changes on track change)
- Returns 404 if `entity_picture` not present or empty
- Rate limited (existing middleware applies)

### Security: Allowed Domains and Services

**File:** `app/api/panel_service.py`

Add `media_player` to `_ALLOWED_DOMAINS` and `_ALLOWED_SERVICES`:

```python
"media_player": frozenset({
    "turn_on",
    "turn_off",
    "media_play",
    "media_pause",
    "media_stop",
    "media_next_track",
    "media_previous_track",
    "media_seek",
    "volume_set",
    "volume_mute",
    "select_source",
    "select_sound_mode",
    "shuffle_set",
    "repeat_set",
    "join",
    "unjoin",
})
```

### Layout Type Assignment

**File:** `app/config/loader.py`

Add `media_player` to the domain-locked block in `_compute_layout_type()`:

```python
if domain == "media_player":
    return "media_player"
```

This goes alongside the other domain-locked types (alarm, camera, lock, climate, etc.). The `_ICON_MAP` already maps `media_player.` to icon `"tv"`.

## Frontend Files

### New: `app/static/js/components/media.js`

IIFE pattern, ES5 strict, only `var` and `function` declarations.

```
window.MediaComponent = (function() {
  'use strict';
  // ... createTile, updateTile, _openSheet, _closeSheet, ...
  return { createTile: createTile, updateTile: updateTile };
}());
```

Dependencies: `window.RP_DOM`, `window.RP_FMT`, `window.RP_API`, `window.RP_MDI`

### Modified: `app/static/js/renderer.js`

Add to `COMPONENT_MAP` init:
```
COMPONENT_MAP['media_player'] = window.MediaComponent || null;
```

Add to `COL_CLASS_MAP`:
```
'media_player': 'tile-col-compact'
```

(Default compact — `updateTile` switches to `tile-col-media-wide` dynamically)

### Modified: `app/static/index.html`

Add `<script>` tag for `media.js` (with cache-buster).

Add bottom sheet HTML block:
```html
<div id="media-sheet-overlay" class="sheet-overlay"></div>
<div id="media-sheet" class="bottom-sheet media-sheet">
  <!-- drag handle, header, sections -->
</div>
```

### Modified: `app/static/css/tiles.css`

New CSS classes:
- `.tile-media-wide` — wide tile flex layout
- `.tile-media-compact` — compact tile (reuses standard tile pattern)
- `.tile-col-media-wide` — column wrapper, `flex: 0 0 50%`
- `.media-cover`, `.media-cover-fallback` — cover art container + gradient fallback
- `.media-info` — title/artist/device stack
- `.media-transport` — button row
- `.media-btn` — individual transport button, 32px with 44px tap area
- `.media-btn-play` — large play/pause, 52px
- `.media-sheet-*` — bottom sheet section styles
- `.media-vol-slider` — volume slider track/thumb
- `.media-source-select` — styled native select
- `.media-group-item` — speaker list item with checkbox

All CSS uses `-webkit-flex` prefix, no grid, no gap (margin on children), no aspect-ratio (padding-top hack where needed).

### Modified: `app/server.py`

Register new route:
```python
app.router.add_get("/api/media_proxy/{entity_id}", media_proxy_handler)
```

## iOS 12 Constraints (reminder)

- **JS:** Only `var`, `function`, IIFE. No const/let/arrow/optional chaining/nullish coalescing.
- **CSS:** `-webkit-flex` everywhere, no grid, no gap, no aspect-ratio. Padding-top hack for ratios.
- **HTML:** No `<dialog>`, no `type="module"`.
- **Touch:** Use `touchend` with `preventDefault()` for tap actions. `touchmove` for sliders.
- **Images:** `<img>` tag with `onerror` fallback handler for cover art proxy failure.

## Configuration

No dedicated config tab. Media player entities are added via the existing entity picker in config.html, placeable in both overview and rooms. The loader auto-assigns `layout_type: "media_player"` based on entity domain.

## HA Supported Features Bitmask (media_player)

Reference values for dynamic section visibility:

| Feature | Bit | Value |
|---------|-----|-------|
| PAUSE | 0 | 1 |
| SEEK | 1 | 2 |
| VOLUME_SET | 2 | 4 |
| VOLUME_MUTE | 3 | 8 |
| PREVIOUS_TRACK | 4 | 16 |
| NEXT_TRACK | 5 | 32 |
| TURN_ON | 7 | 128 |
| TURN_OFF | 8 | 256 |
| PLAY | 14 | 16384 |
| STOP | 12 | 4096 |
| SELECT_SOURCE | 11 | 2048 |
| SELECT_SOUND_MODE | 16 | 65536 |
| SHUFFLE_SET | 15 | 32768 |
| REPEAT_SET | 17 | 131072 |
| GROUPING | 19 | 524288 |

## Out of Scope

- Media browser (browsing/selecting content) — future v2
- Queue management — future v2
- Multi-room zone creation — use HA for setup, panel only join/unjoin existing groups
- TTS announcements — separate feature if needed
