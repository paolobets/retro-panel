# Media Player Component — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full-featured media player tiles (wide when playing, compact when idle) with bottom sheet remote control, cover art proxy, and dynamic feature sections.

**Architecture:** New `media.js` component (IIFE, ES5) with `createTile`/`updateTile`. New `media_proxy.py` backend endpoint for cover art. Bottom sheet HTML in `index.html`, CSS in `tiles.css`. Entity added via existing picker, layout_type auto-assigned.

**Tech Stack:** Python 3.11 + aiohttp (backend proxy), Vanilla JS ES5 strict (frontend), Plain CSS with -webkit- prefix (iOS 12)

**Branch:** dev

---

### Task 1: Backend — Add media_player to allowed domains and services

**Files:**
- Modify: `retro-panel/app/api/panel_service.py:23-47`
- Test: `retro-panel/tests/test_media_service.py`

- [ ] **Step 1: Write the failing test**

Create `retro-panel/tests/test_media_service.py`:

```python
"""Tests for media_player domain and service allowlist."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from api.panel_service import _ALLOWED_DOMAINS, _ALLOWED_SERVICES


def test_media_player_in_allowed_domains():
    assert "media_player" in _ALLOWED_DOMAINS


def test_media_player_services_exist():
    assert "media_player" in _ALLOWED_SERVICES


def test_media_player_play_pause_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "media_play" in svc
    assert "media_pause" in svc
    assert "media_stop" in svc


def test_media_player_track_control_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "media_next_track" in svc
    assert "media_previous_track" in svc


def test_media_player_volume_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "volume_set" in svc
    assert "volume_mute" in svc


def test_media_player_source_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "select_source" in svc
    assert "select_sound_mode" in svc


def test_media_player_power_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "turn_on" in svc
    assert "turn_off" in svc


def test_media_player_shuffle_repeat_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "shuffle_set" in svc
    assert "repeat_set" in svc


def test_media_player_grouping_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "join" in svc
    assert "unjoin" in svc


def test_media_player_seek_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "media_seek" in svc
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd retro-panel && python -m pytest tests/test_media_service.py -v`
Expected: FAIL — `"media_player" not in _ALLOWED_DOMAINS`

- [ ] **Step 3: Add media_player to _ALLOWED_DOMAINS and _ALLOWED_SERVICES**

In `retro-panel/app/api/panel_service.py`, change line 23-24:

```python
_ALLOWED_DOMAINS: frozenset[str] = frozenset(
    {"light", "switch", "alarm_control_panel", "input_boolean", "cover", "scene", "script", "automation", "lock", "button", "climate", "media_player"}
)
```

Add to `_ALLOWED_SERVICES` dict (after the `"climate"` entry, before the closing `}`):

```python
    "media_player": frozenset({
        "turn_on", "turn_off",
        "media_play", "media_pause", "media_stop",
        "media_next_track", "media_previous_track",
        "media_seek",
        "volume_set", "volume_mute",
        "select_source", "select_sound_mode",
        "shuffle_set", "repeat_set",
        "join", "unjoin",
    }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd retro-panel && python -m pytest tests/test_media_service.py -v`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add retro-panel/app/api/panel_service.py retro-panel/tests/test_media_service.py
git commit -m "feat(media): add media_player to allowed domains and services"
```

---

### Task 2: Backend — Add media_player to layout_type assignment

**Files:**
- Modify: `retro-panel/app/config/loader.py:406-418`
- Test: `retro-panel/tests/test_media_layout.py`

- [ ] **Step 1: Write the failing test**

Create `retro-panel/tests/test_media_layout.py`:

```python
"""Tests for media_player layout_type assignment."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from config.loader import _compute_layout_type


def test_media_player_gets_media_player_layout():
    assert _compute_layout_type("media_player.sonos_salotto", "", "") == "media_player"


def test_media_player_ignores_visual_type():
    """media_player is domain-locked — visual_type cannot override it."""
    assert _compute_layout_type("media_player.tv_samsung", "", "switch") == "media_player"


def test_media_player_ignores_device_class():
    assert _compute_layout_type("media_player.echo_cucina", "speaker", "") == "media_player"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd retro-panel && python -m pytest tests/test_media_layout.py -v`
Expected: FAIL — returns `"sensor_generic"` instead of `"media_player"`

- [ ] **Step 3: Add media_player to domain-locked block**

In `retro-panel/app/config/loader.py`, after line 418 (`if domain == "button": return "button"`), add:

```python
    if domain == "media_player":
        return "media_player"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd retro-panel && python -m pytest tests/test_media_layout.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Run all existing tests to check for regressions**

Run: `cd retro-panel && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add retro-panel/app/config/loader.py retro-panel/tests/test_media_layout.py
git commit -m "feat(media): add media_player domain-locked layout_type"
```

---

### Task 3: Backend — Media cover art proxy endpoint

**Files:**
- Create: `retro-panel/app/api/media_proxy.py`
- Modify: `retro-panel/app/server.py:528-535`
- Test: `retro-panel/tests/test_media_proxy.py`

- [ ] **Step 1: Write the failing test**

Create `retro-panel/tests/test_media_proxy.py`:

```python
"""Tests for media_proxy entity validation."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from api.media_proxy import _MEDIA_ENTITY_RE, _validate_media


class FakeConfig:
    def __init__(self, ids):
        self.all_entity_ids = set(ids)


class FakeApp:
    def __init__(self, config=None, ha_client=None):
        self._data = {"config": config, "ha_client": ha_client}
    def get(self, key):
        return self._data.get(key)


class FakeRequest:
    def __init__(self, app):
        self.app = app


def test_regex_accepts_valid_media_player():
    assert _MEDIA_ENTITY_RE.match("media_player.sonos_salotto")
    assert _MEDIA_ENTITY_RE.match("media_player.tv_samsung_42")


def test_regex_rejects_invalid():
    assert not _MEDIA_ENTITY_RE.match("light.living_room")
    assert not _MEDIA_ENTITY_RE.match("media_player.")
    assert not _MEDIA_ENTITY_RE.match("media_player.UPPER")
    assert not _MEDIA_ENTITY_RE.match("media_player.has space")


def test_validate_rejects_entity_not_in_whitelist():
    config = FakeConfig(["media_player.other"])
    app = FakeApp(config=config, ha_client=object())
    req = FakeRequest(app)
    import pytest
    from aiohttp.web import HTTPForbidden
    with pytest.raises(HTTPForbidden):
        _validate_media(req, "media_player.not_configured")


def test_validate_accepts_whitelisted_entity():
    config = FakeConfig(["media_player.sonos_salotto"])
    app = FakeApp(config=config, ha_client=object())
    req = FakeRequest(app)
    result = _validate_media(req, "media_player.sonos_salotto")
    assert result is not None  # returns ha_client
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd retro-panel && python -m pytest tests/test_media_proxy.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'api.media_proxy'`

- [ ] **Step 3: Create media_proxy.py**

Create `retro-panel/app/api/media_proxy.py`:

```python
"""Media player cover art proxy — fetches entity_picture from HA."""

from __future__ import annotations

import logging
import re

import aiohttp
from aiohttp import web

logger = logging.getLogger(__name__)

_MEDIA_ENTITY_RE = re.compile(r"^media_player\.[a-z0-9_]+$")


def _validate_media(request: web.Request, entity_id: str):
    """Validate entity_id format and whitelist. Returns ha_client or raises."""
    if not _MEDIA_ENTITY_RE.match(entity_id):
        raise web.HTTPBadRequest(reason=f"Invalid media_player entity_id: {entity_id!r}")
    config = request.app.get("config")
    if config is None or entity_id not in config.all_entity_ids:
        raise web.HTTPForbidden(reason=f"Media player not in configured whitelist: {entity_id!r}")
    ha_client = request.app.get("ha_client")
    if ha_client is None:
        raise web.HTTPServiceUnavailable(reason="HA client not available")
    return ha_client


async def get_media_cover(request: web.Request) -> web.Response:
    """Proxy media player cover art (entity_picture) from HA.

    GET /api/media-cover/{entity_id}

    Fetches the entity state to get entity_picture URL, then proxies
    the image from HA. Returns 404 if no cover art available.
    """
    entity_id: str = request.match_info["entity_id"]
    try:
        ha_client = _validate_media(request, entity_id)
    except web.HTTPException as exc:
        return web.json_response({"error": exc.reason}, status=exc.status_code)

    # Fetch entity state to get entity_picture URL
    try:
        state = await ha_client.get_state(entity_id)
    except Exception as exc:
        logger.warning("Failed to fetch state for %s: %s", entity_id, exc)
        return web.json_response({"error": "Failed to fetch entity state"}, status=502)

    attrs = state.get("attributes", {})
    entity_picture = attrs.get("entity_picture", "")
    if not entity_picture:
        return web.json_response({"error": "No cover art available"}, status=404)

    # Build absolute URL for the image
    # entity_picture is a relative path like /api/media_player_proxy/media_player.xxx
    ha_url = ha_client._ha_url  # noqa: SLF001 — needed for image proxy
    if entity_picture.startswith("/"):
        image_url = ha_url + entity_picture
    else:
        image_url = ha_url + "/" + entity_picture

    # Proxy the image from HA
    session = ha_client._get_session()  # noqa: SLF001
    try:
        async with session.get(image_url) as resp:
            if resp.status != 200:
                logger.warning("HA returned %s for media cover %s", resp.status, entity_id)
                return web.json_response({"error": "Cover art not available"}, status=404)
            data = await resp.read()
            ct = resp.headers.get("Content-Type", "image/jpeg")
            return web.Response(
                body=data,
                content_type=ct,
                headers={"Cache-Control": "public, max-age=30"},
            )
    except aiohttp.ClientConnectorError as exc:
        logger.warning("Cannot connect to HA for media cover %s: %s", entity_id, exc)
        return web.json_response({"error": "Cannot connect to HA"}, status=502)
    except Exception as exc:
        logger.error("Media cover proxy error for %s: %s", entity_id, exc)
        return web.json_response({"error": "Failed to fetch cover art"}, status=502)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd retro-panel && python -m pytest tests/test_media_proxy.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Register route in server.py**

In `retro-panel/app/server.py`, add the import at the top alongside other api imports, and add the route. Find the camera proxy routes block (around line 528-531) and add after line 531:

```python
    app.router.add_get("/api/media-cover/{entity_id}", get_media_cover)
```

Also add the import at the top of the file where other api imports are:

```python
from api.media_proxy import get_media_cover
```

- [ ] **Step 6: Run all tests**

Run: `cd retro-panel && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add retro-panel/app/api/media_proxy.py retro-panel/app/server.py retro-panel/tests/test_media_proxy.py
git commit -m "feat(media): add cover art proxy endpoint /api/media-cover/{entity_id}"
```

---

### Task 4: Frontend — CSS for media player tiles and bottom sheet

**Files:**
- Modify: `retro-panel/app/static/css/tiles.css`

- [ ] **Step 1: Add media player CSS to tiles.css**

Append at the end of `retro-panel/app/static/css/tiles.css`:

```css
/* ============================================================
   Media Player tiles + bottom sheet
   iOS 12 safe: -webkit-flex, no grid, no gap, no aspect-ratio
   ============================================================ */

/* ---- Wide column (2-col) for active media player ---- */
.tile-col-media-wide {
  width: 50%;
  padding-right: 12px;
  padding-bottom: 12px;
}

/* ---- Wide tile (playing/paused/buffering) ---- */
.tile-media-wide {
  display: -webkit-flex;
  display: flex;
  -webkit-flex-direction: row;
  flex-direction: row;
  background: var(--c-surface-2);
  border-radius: 10px;
  padding: 12px;
  border-left: 3px solid #999;
  min-height: 96px;
}
.tile-media-wide.s-playing { border-left-color: var(--c-on); }
.tile-media-wide.s-paused  { border-left-color: var(--c-warning); }
.tile-media-wide.s-buffering { border-left-color: var(--c-warning); }

/* Cover art */
.media-cover {
  width: 96px;
  height: 96px;
  min-width: 96px;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  margin-right: 10px;
}
.media-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.media-cover-fallback {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
  -webkit-justify-content: center;
  justify-content: center;
  z-index: 0;
}
.media-cover img { position: relative; z-index: 1; }

/* Info area (right of cover) */
.media-info {
  display: -webkit-flex;
  display: flex;
  -webkit-flex-direction: column;
  flex-direction: column;
  -webkit-justify-content: space-between;
  justify-content: space-between;
  -webkit-flex: 1;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.media-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--c-text-pri);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.media-artist {
  font-size: 10px;
  color: var(--c-text-sec);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.media-device {
  font-size: 10px;
  color: var(--c-text-sec);
  opacity: 0.7;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Mini transport row on tile */
.media-transport {
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
  -webkit-justify-content: space-between;
  justify-content: space-between;
  margin-top: 4px;
}
.media-transport-btns {
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
}
.media-btn {
  -webkit-appearance: none;
  appearance: none;
  border: none;
  background: none;
  color: var(--c-text-sec);
  padding: 8px;
  cursor: pointer;
  min-width: 44px;
  min-height: 44px;
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
  -webkit-justify-content: center;
  justify-content: center;
}
.media-btn svg { fill: currentColor; }
.media-btn-play {
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 50%;
  background: var(--c-on);
  color: #fff;
  padding: 0;
}
.media-btn-play svg { fill: #fff; }
.media-vol-pct {
  font-size: 10px;
  color: var(--c-text-sec);
}

/* ---- Compact tile (idle/off) ---- */
.tile-media-compact {
  display: -webkit-flex;
  display: flex;
  -webkit-flex-direction: column;
  flex-direction: column;
  -webkit-align-items: center;
  align-items: center;
  -webkit-justify-content: center;
  justify-content: center;
  text-align: center;
  background: var(--c-surface-2);
  border-radius: 10px;
  padding: 14px;
  height: 120px;
  min-height: 120px;
  max-height: 120px;
  opacity: 0.7;
}
.tile-media-compact .media-compact-icon { color: var(--c-text-sec); margin-bottom: 8px; }
.tile-media-compact .media-compact-name {
  font-size: 11px;
  font-weight: 600;
  color: var(--c-text-pri);
}
.tile-media-compact .media-compact-state {
  font-size: 10px;
  color: var(--c-text-sec);
  margin-top: 2px;
}

/* ---- Media Bottom Sheet ---- */
#media-bs-overlay {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.55);
  z-index: 900;
}
#media-bs-overlay.is-open { display: block; }

#media-bs {
  display: none;
  position: fixed;
  left: 0; right: 0; bottom: 0;
  background: var(--c-surface-3);
  border-radius: 16px 16px 0 0;
  padding: 20px;
  z-index: 901;
  max-height: 85vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
#media-bs.is-open { display: block; }

.mbs-handle {
  width: 40px;
  height: 4px;
  background: var(--c-text-sec);
  border-radius: 2px;
  margin: 0 auto 16px;
  opacity: 0.4;
}

/* Header */
.mbs-header {
  display: -webkit-flex;
  display: flex;
  margin-bottom: 18px;
}
.mbs-cover {
  width: 80px;
  height: 80px;
  min-width: 80px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  margin-right: 14px;
}
.mbs-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  position: relative;
  z-index: 1;
}
.mbs-cover-fallback {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
  -webkit-justify-content: center;
  justify-content: center;
  z-index: 0;
}
.mbs-info {
  -webkit-flex: 1;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.mbs-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text-pri);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.mbs-artist {
  font-size: 12px;
  color: var(--c-text-sec);
  margin-top: 2px;
}
.mbs-device {
  font-size: 11px;
  color: var(--c-text-sec);
  opacity: 0.7;
  margin-top: 4px;
}
.mbs-state {
  font-size: 10px;
  margin-top: 2px;
}
.mbs-state.s-playing { color: var(--c-on); }
.mbs-state.s-paused  { color: var(--c-warning); }
.mbs-power-btn {
  -webkit-appearance: none;
  appearance: none;
  width: 36px;
  height: 36px;
  min-width: 36px;
  border: none;
  border-radius: 50%;
  background: var(--c-surface-2);
  color: var(--c-text-pri);
  cursor: pointer;
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
  -webkit-justify-content: center;
  justify-content: center;
  margin-left: 8px;
}
.mbs-power-btn svg { fill: currentColor; }

/* Section label */
.mbs-section-label {
  font-size: 9px;
  color: var(--c-text-sec);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.mbs-divider {
  height: 1px;
  background: var(--c-surface-2);
  margin-bottom: 16px;
}

/* Progress bar */
.mbs-progress { margin-bottom: 16px; }
.mbs-progress-track {
  height: 4px;
  background: var(--c-surface-2);
  border-radius: 2px;
  position: relative;
}
.mbs-progress-fill {
  height: 100%;
  background: var(--c-on);
  border-radius: 2px;
  width: 0;
}
.mbs-progress-times {
  display: -webkit-flex;
  display: flex;
  -webkit-justify-content: space-between;
  justify-content: space-between;
  font-size: 10px;
  color: var(--c-text-sec);
  margin-top: 5px;
}

/* Transport controls */
.mbs-transport {
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
  -webkit-justify-content: center;
  justify-content: center;
  margin-bottom: 20px;
}
.mbs-transport .media-btn { margin: 0 4px; }
.mbs-transport .media-btn-play {
  width: 52px;
  height: 52px;
  min-width: 52px;
  margin: 0 8px;
}
.mbs-btn-active { color: var(--c-on); }

/* Volume */
.mbs-volume {
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
  margin-bottom: 20px;
}
.mbs-vol-mute {
  -webkit-appearance: none;
  appearance: none;
  width: 32px;
  height: 32px;
  min-width: 32px;
  border: none;
  border-radius: 50%;
  background: var(--c-surface-2);
  color: var(--c-text-sec);
  cursor: pointer;
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
  -webkit-justify-content: center;
  justify-content: center;
  margin-right: 12px;
}
.mbs-vol-mute svg { fill: currentColor; }
.mbs-vol-mute.is-muted { color: var(--c-danger); }
.mbs-vol-slider {
  -webkit-flex: 1;
  flex: 1;
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  background: var(--c-surface-2);
  border-radius: 3px;
  outline: none;
}
.mbs-vol-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--c-on);
  border: 2px solid var(--c-surface-3);
  cursor: pointer;
}
.mbs-vol-pct {
  font-size: 12px;
  color: var(--c-text-sec);
  min-width: 36px;
  text-align: right;
  margin-left: 8px;
}

/* Source / Sound mode selector */
.mbs-select-card {
  background: var(--c-surface-2);
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 20px;
  position: relative;
}
.mbs-select-card select {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  background: none;
  border: none;
  color: var(--c-text-pri);
  font-size: 13px;
  font-family: inherit;
  outline: none;
  cursor: pointer;
  padding-right: 24px;
}
.mbs-select-arrow {
  position: absolute;
  right: 14px;
  top: 50%;
  -webkit-transform: translateY(-50%);
  transform: translateY(-50%);
  pointer-events: none;
}
.mbs-select-arrow svg { fill: var(--c-text-sec); }

/* Grouping */
.mbs-group-list { margin-bottom: 8px; }
.mbs-group-item {
  background: var(--c-surface-2);
  border-radius: 8px;
  padding: 10px 14px;
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
  -webkit-justify-content: space-between;
  justify-content: space-between;
  margin-bottom: 8px;
  cursor: pointer;
}
.mbs-group-item-info {
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: center;
  align-items: center;
}
.mbs-group-item-info svg { margin-right: 10px; }
.mbs-group-item-name { font-size: 12px; color: var(--c-text-pri); }
.mbs-group-master {
  font-size: 10px;
  color: var(--c-on);
  font-weight: 600;
}
.mbs-group-check {
  width: 20px;
  height: 20px;
  border: 2px solid var(--c-text-sec);
  border-radius: 4px;
}
.mbs-group-check.is-joined {
  background: var(--c-on);
  border-color: var(--c-on);
}

/* Close button */
.mbs-close {
  -webkit-appearance: none;
  appearance: none;
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: var(--c-text-sec);
  font-size: 18px;
  cursor: pointer;
  padding: 8px;
  min-width: 44px;
  min-height: 44px;
}
```

- [ ] **Step 2: Commit**

```bash
git add retro-panel/app/static/css/tiles.css
git commit -m "feat(media): add CSS for media player tiles and bottom sheet"
```

---

### Task 5: Frontend — Bottom sheet HTML in index.html

**Files:**
- Modify: `retro-panel/app/static/index.html`

- [ ] **Step 1: Add media bottom sheet HTML and script tag**

In `retro-panel/app/static/index.html`, after the climate bottom sheet closing tag (`</div>` after line 180) and before the toast container (line 182), add:

```html
  <!-- Media player bottom sheet overlay -->
  <div id="media-bs-overlay"></div>

  <!-- Media player bottom sheet -->
  <div id="media-bs">
    <div class="mbs-handle"></div>
    <button class="mbs-close" type="button" aria-label="Close">&#10005;</button>

    <!-- Header: cover + info + power -->
    <div class="mbs-header">
      <div class="mbs-cover">
        <div class="mbs-cover-fallback"></div>
        <img class="mbs-cover-img" src="" alt="">
      </div>
      <div class="mbs-info">
        <div class="mbs-title"></div>
        <div class="mbs-artist"></div>
        <div class="mbs-device"></div>
        <div class="mbs-state"></div>
      </div>
      <button class="mbs-power-btn" type="button" aria-label="Power"></button>
    </div>

    <!-- Progress -->
    <div class="mbs-section mbs-progress-section" style="display:none;">
      <div class="mbs-section-label">Riproduzione</div>
      <div class="mbs-progress">
        <div class="mbs-progress-track"><div class="mbs-progress-fill"></div></div>
        <div class="mbs-progress-times"><span class="mbs-time-cur">0:00</span><span class="mbs-time-dur">0:00</span></div>
      </div>
    </div>

    <!-- Transport -->
    <div class="mbs-section mbs-transport-section">
      <div class="mbs-transport"></div>
    </div>

    <div class="mbs-divider"></div>

    <!-- Volume -->
    <div class="mbs-section mbs-volume-section" style="display:none;">
      <div class="mbs-section-label">Volume</div>
      <div class="mbs-volume">
        <button class="mbs-vol-mute" type="button" aria-label="Mute"></button>
        <input class="mbs-vol-slider" type="range" min="0" max="100" step="1" value="50">
        <span class="mbs-vol-pct">50%</span>
      </div>
      <div class="mbs-divider"></div>
    </div>

    <!-- Source -->
    <div class="mbs-section mbs-source-section" style="display:none;">
      <div class="mbs-section-label">Sorgente</div>
      <div class="mbs-select-card">
        <select class="mbs-source-select"></select>
        <span class="mbs-select-arrow"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg></span>
      </div>
    </div>

    <!-- Sound mode -->
    <div class="mbs-section mbs-soundmode-section" style="display:none;">
      <div class="mbs-section-label">Modalit&agrave; audio</div>
      <div class="mbs-select-card">
        <select class="mbs-soundmode-select"></select>
        <span class="mbs-select-arrow"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg></span>
      </div>
    </div>

    <!-- Grouping -->
    <div class="mbs-section mbs-group-section" style="display:none;">
      <div class="mbs-section-label">Gruppo speaker</div>
      <div class="mbs-group-list"></div>
    </div>
  </div>
```

Also add the script tag for `media.js` in the scripts section. After the `calendar.js` script tag (line 205) and before `conditional.js` (line 206), add:

```html
  <script src="static/js/components/media.js?v=213016"></script>
```

- [ ] **Step 2: Commit**

```bash
git add retro-panel/app/static/index.html
git commit -m "feat(media): add bottom sheet HTML and media.js script tag"
```

---

### Task 6: Frontend — media.js component (tile creation and state display)

**Files:**
- Create: `retro-panel/app/static/js/components/media.js`

- [ ] **Step 1: Create media.js with createTile and updateTile**

Create `retro-panel/app/static/js/components/media.js`:

```javascript
/**
 * media.js — Media Player entity tile component
 * Wide tile (2-col) when playing/paused, compact (120px) when idle/off.
 * Tap on area opens bottom sheet; mini buttons act directly.
 * No ES modules — loaded as regular script. iOS 12+ safe.
 * NO const/let/=>/?./?? — only var, IIFE pattern.
 *
 * Exposes globally: window.MediaComponent = { createTile, updateTile }
 */
window.MediaComponent = (function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /* Constants                                                            */
  /* ------------------------------------------------------------------ */
  var FEAT_PAUSE        = 1;
  var FEAT_SEEK         = 2;
  var FEAT_VOLUME_SET   = 4;
  var FEAT_VOLUME_MUTE  = 8;
  var FEAT_PREV         = 16;
  var FEAT_NEXT         = 32;
  var FEAT_TURN_ON      = 128;
  var FEAT_TURN_OFF     = 256;
  var FEAT_SELECT_SOURCE = 2048;
  var FEAT_STOP         = 4096;
  var FEAT_PLAY         = 16384;
  var FEAT_SHUFFLE      = 32768;
  var FEAT_SELECT_SOUND = 65536;
  var FEAT_REPEAT       = 131072;
  var FEAT_GROUPING     = 524288;

  var ACTIVE_STATES = { playing: 1, paused: 1, buffering: 1 };

  var STATE_TEXT = {
    playing:     'In riproduzione',
    paused:      'In pausa',
    buffering:   'Buffering\u2026',
    idle:        'Idle',
    standby:     'Standby',
    off:         'Off',
    unavailable: 'Non disponibile'
  };

  /* Gradient colors for cover art fallback, by device type keyword */
  var GRADIENTS = [
    { kw: ['tv', 'samsung', 'lg', 'sony'], colors: '#1565c0,#0d47a1' },
    { kw: ['sonos'],                         colors: '#e91e63,#9c27b0' },
    { kw: ['echo', 'alexa'],                 colors: '#00bcd4,#0097a7' },
    { kw: ['homepod', 'apple'],              colors: '#424242,#212121' }
  ];
  var DEFAULT_GRADIENT = '#7b1fa2,#512da8';

  function _gradient(entityId) {
    var lower = entityId.toLowerCase();
    for (var i = 0; i < GRADIENTS.length; i++) {
      for (var k = 0; k < GRADIENTS[i].kw.length; k++) {
        if (lower.indexOf(GRADIENTS[i].kw[k]) !== -1) {
          return GRADIENTS[i].colors;
        }
      }
    }
    return DEFAULT_GRADIENT;
  }

  function _hasFeat(features, flag) {
    return (features & flag) !== 0;
  }

  function _formatTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    var s = Math.floor(sec);
    var m = Math.floor(s / 60);
    var ss = s % 60;
    return m + ':' + (ss < 10 ? '0' : '') + ss;
  }

  /* SVG icon helpers (inline, 18x18 default) */
  function _svgIcon(path, size) {
    var sz = size || 18;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="currentColor"><path d="' + path + '"/></svg>';
  }
  var ICO_PREV  = 'M6 6h2v12H6zm3.5 6l8.5 6V6z';
  var ICO_NEXT  = 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z';
  var ICO_PLAY  = 'M8 5v14l11-7z';
  var ICO_PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
  var ICO_STOP  = 'M6 6h12v12H6z';
  var ICO_VOL   = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z';
  var ICO_MUTE  = 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';
  var ICO_SHUFFLE = 'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z';
  var ICO_REPEAT = 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z';
  var ICO_POWER  = 'M13 3h-2v10h2V3zm4.83 2.17l-1.42 1.42A6.92 6.92 0 0119 12c0 3.87-3.13 7-7 7s-7-3.13-7-7c0-2.27 1.08-4.29 2.76-5.57L6.34 5.02A8.94 8.94 0 003 12a9 9 0 0018 0c0-2.74-1.23-5.19-3.17-6.83z';
  var ICO_MUSIC  = 'M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z';
  var ICO_TV     = 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z';
  var ICO_SPEAKER = 'M12 3a9 9 0 00-9 9 9 9 0 009 9 9 9 0 009-9 9 9 0 00-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm0-11a4 4 0 00-4 4 4 4 0 004 4 4 4 0 004-4 4 4 0 00-4-4z';

  function _deviceIcon(entityId) {
    var lower = entityId.toLowerCase();
    if (lower.indexOf('tv') !== -1 || lower.indexOf('samsung') !== -1 || lower.indexOf('apple_tv') !== -1) return ICO_TV;
    if (lower.indexOf('sonos') !== -1 || lower.indexOf('speaker') !== -1 || lower.indexOf('homepod') !== -1) return ICO_SPEAKER;
    return ICO_MUSIC;
  }

  /* ------------------------------------------------------------------ */
  /* Bottom sheet state (singleton — one sheet for all media tiles)      */
  /* ------------------------------------------------------------------ */
  var _bsBuilt = false;
  var _overlay  = null;
  var _sheet    = null;
  var _entityId = null;
  var _debTimer = null;
  var _posTimer = null;
  var _lastAttrs = {};
  var _lastState = 'off';
  var _lastFeatures = 0;

  /* DOM refs (populated in _buildBS) */
  var _els = {};

  function _buildBS() {
    _overlay = document.getElementById('media-bs-overlay');
    _sheet   = document.getElementById('media-bs');
    if (!_overlay || !_sheet) {
      console.error('[MediaComponent] #media-bs-overlay or #media-bs not found');
      return;
    }

    _els.coverImg      = _sheet.querySelector('.mbs-cover-img');
    _els.coverFallback = _sheet.querySelector('.mbs-cover-fallback');
    _els.title         = _sheet.querySelector('.mbs-title');
    _els.artist        = _sheet.querySelector('.mbs-artist');
    _els.device        = _sheet.querySelector('.mbs-device');
    _els.state         = _sheet.querySelector('.mbs-state');
    _els.powerBtn      = _sheet.querySelector('.mbs-power-btn');
    _els.progressSec   = _sheet.querySelector('.mbs-progress-section');
    _els.progressFill  = _sheet.querySelector('.mbs-progress-fill');
    _els.timeCur       = _sheet.querySelector('.mbs-time-cur');
    _els.timeDur       = _sheet.querySelector('.mbs-time-dur');
    _els.transportWrap = _sheet.querySelector('.mbs-transport');
    _els.volumeSec     = _sheet.querySelector('.mbs-volume-section');
    _els.volMute       = _sheet.querySelector('.mbs-vol-mute');
    _els.volSlider     = _sheet.querySelector('.mbs-vol-slider');
    _els.volPct        = _sheet.querySelector('.mbs-vol-pct');
    _els.sourceSec     = _sheet.querySelector('.mbs-source-section');
    _els.sourceSelect  = _sheet.querySelector('.mbs-source-select');
    _els.soundmodeSec  = _sheet.querySelector('.mbs-soundmode-section');
    _els.soundmodeSelect = _sheet.querySelector('.mbs-soundmode-select');
    _els.groupSec      = _sheet.querySelector('.mbs-group-section');
    _els.groupList     = _sheet.querySelector('.mbs-group-list');

    /* Close handlers */
    _overlay.addEventListener('touchend', function (e) { e.preventDefault(); _closeBS(); });
    _overlay.addEventListener('click', _closeBS);
    var closeBtn = _sheet.querySelector('.mbs-close');
    if (closeBtn) {
      closeBtn.addEventListener('touchend', function (e) { e.preventDefault(); _closeBS(); });
      closeBtn.addEventListener('click', _closeBS);
    }

    /* Volume slider */
    if (_els.volSlider) {
      _els.volSlider.addEventListener('touchstart', function (e) { e.stopPropagation(); }, { passive: true });
      _els.volSlider.addEventListener('input', function () {
        var pct = parseInt(_els.volSlider.value, 10);
        if (_els.volPct) { _els.volPct.textContent = pct + '%'; }
        _debounce(function () {
          window.callService('media_player', 'volume_set', {
            entity_id: _entityId,
            volume_level: pct / 100
          }).catch(function (e) { console.error('[media] volume_set:', e); });
        });
      });
    }

    /* Mute button */
    if (_els.volMute) {
      function doMute() {
        var muted = !(_lastAttrs.is_volume_muted || false);
        window.callService('media_player', 'volume_mute', {
          entity_id: _entityId,
          is_volume_muted: muted
        }).catch(function (e) { console.error('[media] volume_mute:', e); });
      }
      _els.volMute.addEventListener('touchend', function (e) { e.preventDefault(); doMute(); });
      _els.volMute.addEventListener('click', function () {
        if (!('ontouchstart' in window)) { doMute(); }
      });
    }

    /* Power button */
    if (_els.powerBtn) {
      function doPower() {
        var svc = (_lastState === 'off' || _lastState === 'standby') ? 'turn_on' : 'turn_off';
        window.callService('media_player', svc, { entity_id: _entityId })
          .catch(function (e) { console.error('[media] ' + svc + ':', e); });
      }
      _els.powerBtn.addEventListener('touchend', function (e) { e.preventDefault(); doPower(); });
      _els.powerBtn.addEventListener('click', function () {
        if (!('ontouchstart' in window)) { doPower(); }
      });
    }

    /* Source selector */
    if (_els.sourceSelect) {
      _els.sourceSelect.addEventListener('change', function () {
        window.callService('media_player', 'select_source', {
          entity_id: _entityId,
          source: _els.sourceSelect.value
        }).catch(function (e) { console.error('[media] select_source:', e); });
      });
    }

    /* Sound mode selector */
    if (_els.soundmodeSelect) {
      _els.soundmodeSelect.addEventListener('change', function () {
        window.callService('media_player', 'select_sound_mode', {
          entity_id: _entityId,
          sound_mode: _els.soundmodeSelect.value
        }).catch(function (e) { console.error('[media] select_sound_mode:', e); });
      });
    }

    _bsBuilt = true;
  }

  function _debounce(fn) {
    if (_debTimer) { clearTimeout(_debTimer); }
    _debTimer = setTimeout(fn, 300);
  }

  function _openBS(entityId, stateObj) {
    if (!_bsBuilt) { _buildBS(); }
    if (!_overlay || !_sheet) { return; }

    _entityId = entityId;
    _lastState = stateObj.state || 'off';
    _lastAttrs = stateObj.attributes || {};
    _lastFeatures = _lastAttrs.supported_features || 0;

    _updateBSContent();

    _overlay.classList.add('is-open');
    _sheet.classList.add('is-open');

    _startPositionTimer();
  }

  function _closeBS() {
    if (_overlay) { _overlay.classList.remove('is-open'); }
    if (_sheet)   { _sheet.classList.remove('is-open'); }
    _entityId = null;
    _stopPositionTimer();
    if (_debTimer) { clearTimeout(_debTimer); _debTimer = null; }
  }

  function _startPositionTimer() {
    _stopPositionTimer();
    if (_lastState !== 'playing') { return; }
    _posTimer = setInterval(function () {
      _updateProgress();
    }, 1000);
  }

  function _stopPositionTimer() {
    if (_posTimer) { clearInterval(_posTimer); _posTimer = null; }
  }

  function _updateProgress() {
    if (!_els.progressFill) { return; }
    var pos = _lastAttrs.media_position || 0;
    var updatedAt = _lastAttrs.media_position_updated_at;
    var dur = _lastAttrs.media_duration || 0;

    /* Interpolate position for playing state */
    if (_lastState === 'playing' && updatedAt) {
      var updatedTime = new Date(updatedAt).getTime();
      var elapsed = (Date.now() - updatedTime) / 1000;
      pos = pos + elapsed;
    }
    if (pos > dur && dur > 0) { pos = dur; }

    var pct = (dur > 0) ? Math.min(100, (pos / dur) * 100) : 0;
    _els.progressFill.style.width = pct + '%';
    if (_els.timeCur) { _els.timeCur.textContent = _formatTime(pos); }
    if (_els.timeDur) { _els.timeDur.textContent = _formatTime(dur); }
  }

  function _updateBSContent() {
    var attrs = _lastAttrs;
    var feat = _lastFeatures;

    /* Cover */
    _updateCover(_els.coverImg, _els.coverFallback, _entityId, attrs);

    /* Info */
    if (_els.title)  { _els.title.textContent = attrs.media_title || ''; }
    if (_els.artist) { _els.artist.textContent = attrs.media_artist || ''; }
    if (_els.device) { _els.device.textContent = attrs.friendly_name || _entityId; }
    if (_els.state) {
      _els.state.textContent = STATE_TEXT[_lastState] || _lastState;
      _els.state.className = 'mbs-state';
      if (_lastState === 'playing') { _els.state.className += ' s-playing'; }
      if (_lastState === 'paused')  { _els.state.className += ' s-paused'; }
    }

    /* Power button */
    if (_els.powerBtn) {
      var showPower = _hasFeat(feat, FEAT_TURN_ON) || _hasFeat(feat, FEAT_TURN_OFF);
      _els.powerBtn.style.display = showPower ? '' : 'none';
      _els.powerBtn.innerHTML = _svgIcon(ICO_POWER, 18);
    }

    /* Progress section */
    if (_els.progressSec) {
      var showProgress = _hasFeat(feat, FEAT_SEEK) && attrs.media_duration;
      _els.progressSec.style.display = showProgress ? '' : 'none';
      if (showProgress) { _updateProgress(); }
    }

    /* Transport buttons */
    _renderTransport(feat);

    /* Volume */
    if (_els.volumeSec) {
      var showVol = _hasFeat(feat, FEAT_VOLUME_SET);
      _els.volumeSec.style.display = showVol ? '' : 'none';
      if (showVol) {
        var vol = Math.round((attrs.volume_level || 0) * 100);
        if (_els.volSlider) { _els.volSlider.value = String(vol); }
        if (_els.volPct) { _els.volPct.textContent = vol + '%'; }
        if (_els.volMute) {
          _els.volMute.innerHTML = _svgIcon(attrs.is_volume_muted ? ICO_MUTE : ICO_VOL, 16);
          if (attrs.is_volume_muted) {
            _els.volMute.classList.add('is-muted');
          } else {
            _els.volMute.classList.remove('is-muted');
          }
        }
      }
    }

    /* Source */
    if (_els.sourceSec) {
      var showSource = _hasFeat(feat, FEAT_SELECT_SOURCE) && attrs.source_list && attrs.source_list.length;
      _els.sourceSec.style.display = showSource ? '' : 'none';
      if (showSource) {
        _populateSelect(_els.sourceSelect, attrs.source_list, attrs.source || '');
      }
    }

    /* Sound mode */
    if (_els.soundmodeSec) {
      var showSM = _hasFeat(feat, FEAT_SELECT_SOUND) && attrs.sound_mode_list && attrs.sound_mode_list.length;
      _els.soundmodeSec.style.display = showSM ? '' : 'none';
      if (showSM) {
        _populateSelect(_els.soundmodeSelect, attrs.sound_mode_list, attrs.sound_mode || '');
      }
    }

    /* Grouping */
    if (_els.groupSec) {
      var showGroup = _hasFeat(feat, FEAT_GROUPING);
      _els.groupSec.style.display = showGroup ? '' : 'none';
      if (showGroup) {
        _renderGrouping(attrs);
      }
    }
  }

  function _renderTransport(feat) {
    if (!_els.transportWrap) { return; }
    _els.transportWrap.innerHTML = '';

    function addBtn(cls, icon, size, handler) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'media-btn ' + cls;
      btn.innerHTML = _svgIcon(icon, size || 18);
      btn.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); handler(); });
      btn.addEventListener('click', function (e) { e.stopPropagation(); if (!('ontouchstart' in window)) { handler(); } });
      _els.transportWrap.appendChild(btn);
      return btn;
    }

    /* Shuffle */
    if (_hasFeat(feat, FEAT_SHUFFLE)) {
      var shBtn = addBtn('', ICO_SHUFFLE, 16, function () {
        var next = !(_lastAttrs.shuffle || false);
        window.callService('media_player', 'shuffle_set', { entity_id: _entityId, shuffle: next })
          .catch(function (e) { console.error('[media] shuffle_set:', e); });
      });
      if (_lastAttrs.shuffle) { shBtn.classList.add('mbs-btn-active'); }
    }

    /* Prev */
    if (_hasFeat(feat, FEAT_PREV)) {
      addBtn('', ICO_PREV, 24, function () {
        window.callService('media_player', 'media_previous_track', { entity_id: _entityId })
          .catch(function (e) { console.error('[media] prev:', e); });
      });
    }

    /* Play / Pause */
    if (_hasFeat(feat, FEAT_PLAY) || _hasFeat(feat, FEAT_PAUSE)) {
      var isPlaying = _lastState === 'playing';
      addBtn('media-btn-play', isPlaying ? ICO_PAUSE : ICO_PLAY, 24, function () {
        var svc = (_lastState === 'playing') ? 'media_pause' : 'media_play';
        window.callService('media_player', svc, { entity_id: _entityId })
          .catch(function (e) { console.error('[media] ' + svc + ':', e); });
      });
    }

    /* Next */
    if (_hasFeat(feat, FEAT_NEXT)) {
      addBtn('', ICO_NEXT, 24, function () {
        window.callService('media_player', 'media_next_track', { entity_id: _entityId })
          .catch(function (e) { console.error('[media] next:', e); });
      });
    }

    /* Repeat */
    if (_hasFeat(feat, FEAT_REPEAT)) {
      var repBtn = addBtn('', ICO_REPEAT, 16, function () {
        var modes = ['off', 'all', 'one'];
        var cur = _lastAttrs.repeat || 'off';
        var idx = modes.indexOf(cur);
        var next = modes[(idx + 1) % modes.length];
        window.callService('media_player', 'repeat_set', { entity_id: _entityId, repeat: next })
          .catch(function (e) { console.error('[media] repeat_set:', e); });
      });
      if (_lastAttrs.repeat && _lastAttrs.repeat !== 'off') { repBtn.classList.add('mbs-btn-active'); }
    }
  }

  function _populateSelect(selectEl, list, currentVal) {
    if (!selectEl) { return; }
    selectEl.innerHTML = '';
    for (var i = 0; i < list.length; i++) {
      var opt = document.createElement('option');
      opt.value = list[i];
      opt.textContent = list[i];
      if (list[i] === currentVal) { opt.selected = true; }
      selectEl.appendChild(opt);
    }
  }

  function _renderGrouping(attrs) {
    if (!_els.groupList) { return; }
    _els.groupList.innerHTML = '';
    var members = attrs.group_members || [];
    /* Find all media_player entities in the panel config */
    var allMedia = [];
    var appState = window._RP_AppState;
    if (appState && appState.config && appState.config.entities) {
      var entities = appState.config.entities;
      for (var i = 0; i < entities.length; i++) {
        if (entities[i].entity_id && entities[i].entity_id.indexOf('media_player.') === 0) {
          allMedia.push(entities[i]);
        }
      }
    }
    /* If no config access, just show current group members */
    if (allMedia.length === 0 && members.length > 0) {
      for (var m = 0; m < members.length; m++) {
        allMedia.push({ entity_id: members[m], label: members[m].split('.')[1].replace(/_/g, ' ') });
      }
    }

    for (var j = 0; j < allMedia.length; j++) {
      (function (mp) {
        var isMaster = mp.entity_id === _entityId;
        var isJoined = members.indexOf(mp.entity_id) !== -1;
        var item = document.createElement('div');
        item.className = 'mbs-group-item';

        var info = document.createElement('div');
        info.className = 'mbs-group-item-info';
        info.innerHTML = _svgIcon(ICO_SPEAKER, 18) + '<span class="mbs-group-item-name">' + (mp.label || mp.entity_id.split('.')[1].replace(/_/g, ' ')) + '</span>';
        item.appendChild(info);

        if (isMaster) {
          var badge = document.createElement('span');
          badge.className = 'mbs-group-master';
          badge.textContent = 'MASTER';
          item.appendChild(badge);
        } else {
          var check = document.createElement('div');
          check.className = 'mbs-group-check';
          if (isJoined) { check.classList.add('is-joined'); }
          item.appendChild(check);
          function doToggle() {
            if (isJoined) {
              window.callService('media_player', 'unjoin', { entity_id: mp.entity_id })
                .catch(function (e) { console.error('[media] unjoin:', e); });
            } else {
              var newMembers = members.slice();
              newMembers.push(mp.entity_id);
              window.callService('media_player', 'join', { entity_id: _entityId, group_members: newMembers })
                .catch(function (e) { console.error('[media] join:', e); });
            }
          }
          item.addEventListener('touchend', function (e) { e.preventDefault(); doToggle(); });
          item.addEventListener('click', function () { if (!('ontouchstart' in window)) { doToggle(); } });
        }

        _els.groupList.appendChild(item);
      })(allMedia[j]);
    }
  }

  function _updateCover(imgEl, fallbackEl, entityId, attrs) {
    if (!imgEl) { return; }
    var grad = _gradient(entityId);
    if (fallbackEl) {
      fallbackEl.style.background = 'linear-gradient(135deg,' + grad + ')';
      fallbackEl.innerHTML = _svgIcon(_deviceIcon(entityId), 32);
      fallbackEl.querySelector('svg').style.opacity = '0.8';
      fallbackEl.querySelector('svg').style.fill = '#fff';
    }
    var pic = attrs.entity_picture || '';
    if (pic) {
      imgEl.src = 'api/media-cover/' + entityId;
      imgEl.style.display = '';
      imgEl.onerror = function () { imgEl.style.display = 'none'; };
    } else {
      imgEl.style.display = 'none';
      imgEl.src = '';
    }
  }

  /* ------------------------------------------------------------------ */
  /* createTile                                                           */
  /* ------------------------------------------------------------------ */
  function createTile(entityConfig) {
    var entity_id = entityConfig.entity_id;
    var label     = entityConfig.label;
    var icon      = entityConfig.icon;

    var DOM = window.RP_DOM;

    /* Root tile — starts compact, updateTile switches layout */
    var tile = DOM.createElement('div', 'tile tile-media-compact');
    tile.dataset.entityId   = entity_id;
    tile.dataset.layoutType = 'media_player';

    /* ---- Compact layout elements ---- */
    var compactIcon  = DOM.createElement('div', 'media-compact-icon');
    compactIcon.innerHTML = _svgIcon(_deviceIcon(entity_id), 28);
    var compactName  = DOM.createElement('div', 'media-compact-name', label);
    var compactState = DOM.createElement('div', 'media-compact-state', 'Off');
    tile.appendChild(compactIcon);
    tile.appendChild(compactName);
    tile.appendChild(compactState);

    /* ---- Wide layout elements (hidden initially) ---- */
    var wideWrap = DOM.createElement('div', 'media-wide-wrap');
    wideWrap.style.display = 'none';

    /* Cover */
    var coverWrap = DOM.createElement('div', 'media-cover');
    var coverFallback = DOM.createElement('div', 'media-cover-fallback');
    var coverImg = document.createElement('img');
    coverImg.className = 'media-cover-img';
    coverImg.alt = '';
    coverImg.style.display = 'none';
    coverWrap.appendChild(coverFallback);
    coverWrap.appendChild(coverImg);
    wideWrap.appendChild(coverWrap);

    /* Info area */
    var infoArea = DOM.createElement('div', 'media-info');
    var titleEl  = DOM.createElement('div', 'media-title');
    var artistEl = DOM.createElement('div', 'media-artist');
    var deviceEl = DOM.createElement('div', 'media-device', label);

    /* Transport row */
    var transport = DOM.createElement('div', 'media-transport');
    var transBtns = DOM.createElement('div', 'media-transport-btns');
    var volPct    = DOM.createElement('span', 'media-vol-pct');

    /* Prev button */
    var btnPrev = document.createElement('button');
    btnPrev.type = 'button';
    btnPrev.className = 'media-btn';
    btnPrev.innerHTML = _svgIcon(ICO_PREV, 18);
    btnPrev.setAttribute('aria-label', 'Precedente');

    /* Play/Pause button */
    var btnPlay = document.createElement('button');
    btnPlay.type = 'button';
    btnPlay.className = 'media-btn media-btn-play';
    btnPlay.innerHTML = _svgIcon(ICO_PLAY, 16);
    btnPlay.setAttribute('aria-label', 'Play');

    /* Next button */
    var btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'media-btn';
    btnNext.innerHTML = _svgIcon(ICO_NEXT, 18);
    btnNext.setAttribute('aria-label', 'Successivo');

    transBtns.appendChild(btnPrev);
    transBtns.appendChild(btnPlay);
    transBtns.appendChild(btnNext);
    transport.appendChild(transBtns);
    transport.appendChild(volPct);

    infoArea.appendChild(titleEl);
    infoArea.appendChild(artistEl);
    infoArea.appendChild(deviceEl);
    infoArea.appendChild(transport);
    wideWrap.appendChild(infoArea);
    tile.appendChild(wideWrap);

    /* ---- Button event handlers (direct actions, stopPropagation) ---- */
    function bindTransport(btn, svcFn) {
      btn.addEventListener('touchend', function (e) { e.preventDefault(); e.stopPropagation(); svcFn(); });
      btn.addEventListener('click', function (e) { e.stopPropagation(); if (!('ontouchstart' in window)) { svcFn(); } });
    }

    bindTransport(btnPrev, function () {
      window.callService('media_player', 'media_previous_track', { entity_id: entity_id })
        .catch(function (e) { console.error('[media] prev:', e); });
    });
    bindTransport(btnPlay, function () {
      var st = tile._lastState || 'off';
      var svc = (st === 'playing') ? 'media_pause' : 'media_play';
      window.callService('media_player', svc, { entity_id: entity_id })
        .catch(function (e) { console.error('[media] ' + svc + ':', e); });
    });
    bindTransport(btnNext, function () {
      window.callService('media_player', 'media_next_track', { entity_id: entity_id })
        .catch(function (e) { console.error('[media] next:', e); });
    });

    /* ---- Tile tap → open bottom sheet ---- */
    tile.addEventListener('touchend', function (e) {
      e.preventDefault();
      _openBS(entity_id, { state: tile._lastState || 'off', attributes: tile._lastAttrs || {} });
    });
    tile.addEventListener('click', function () {
      if (!('ontouchstart' in window)) {
        _openBS(entity_id, { state: tile._lastState || 'off', attributes: tile._lastAttrs || {} });
      }
    });

    /* Store refs for updateTile */
    tile._refs = {
      compactIcon: compactIcon, compactName: compactName, compactState: compactState,
      wideWrap: wideWrap, coverImg: coverImg, coverFallback: coverFallback,
      titleEl: titleEl, artistEl: artistEl, deviceEl: deviceEl,
      btnPlay: btnPlay, btnPrev: btnPrev, btnNext: btnNext, volPct: volPct
    };

    return tile;
  }

  /* ------------------------------------------------------------------ */
  /* updateTile                                                           */
  /* ------------------------------------------------------------------ */
  function updateTile(tile, stateObj) {
    var state = stateObj.state || 'off';
    var attrs = stateObj.attributes || {};
    var feat  = attrs.supported_features || 0;

    tile._lastState = state;
    tile._lastAttrs = attrs;

    var refs = tile._refs;
    if (!refs) { return; }

    var isActive = !!ACTIVE_STATES[state];
    var col = tile.parentNode;

    if (isActive) {
      /* Switch to wide layout */
      tile.className = 'tile tile-media-wide';
      if (state === 'playing')  { tile.classList.add('s-playing'); }
      if (state === 'paused')   { tile.classList.add('s-paused'); }
      if (state === 'buffering') { tile.classList.add('s-buffering'); }

      refs.compactIcon.style.display  = 'none';
      refs.compactName.style.display  = 'none';
      refs.compactState.style.display = 'none';
      refs.wideWrap.style.display     = '';

      if (col) { col.className = 'tile-col-media-wide'; }

      /* Update cover */
      _updateCover(refs.coverImg, refs.coverFallback, tile.dataset.entityId, attrs);

      /* Update info */
      refs.titleEl.textContent  = attrs.media_title || '';
      refs.artistEl.textContent = attrs.media_artist || '';

      /* Play/Pause icon */
      refs.btnPlay.innerHTML = _svgIcon(state === 'playing' ? ICO_PAUSE : ICO_PLAY, 16);
      refs.btnPlay.setAttribute('aria-label', state === 'playing' ? 'Pausa' : 'Play');

      /* Show/hide prev/next based on features */
      refs.btnPrev.style.display = _hasFeat(feat, FEAT_PREV) ? '' : 'none';
      refs.btnNext.style.display = _hasFeat(feat, FEAT_NEXT) ? '' : 'none';

      /* Volume percentage */
      var vol = Math.round((attrs.volume_level || 0) * 100);
      refs.volPct.innerHTML = _svgIcon(ICO_VOL, 14) + ' ' + vol + '%';

    } else {
      /* Switch to compact layout */
      tile.className = 'tile tile-media-compact';

      refs.compactIcon.style.display  = '';
      refs.compactName.style.display  = '';
      refs.compactState.style.display = '';
      refs.wideWrap.style.display     = 'none';

      if (col) { col.className = 'tile-col-compact'; }

      refs.compactState.textContent = STATE_TEXT[state] || state;
    }

    /* Update open bottom sheet if it's for this entity */
    if (_entityId === tile.dataset.entityId) {
      _lastState = state;
      _lastAttrs = attrs;
      _lastFeatures = feat;
      _updateBSContent();
      if (state === 'playing') {
        _startPositionTimer();
      } else {
        _stopPositionTimer();
      }
    }
  }

  return { createTile: createTile, updateTile: updateTile };
}());
```

- [ ] **Step 2: Commit**

```bash
git add retro-panel/app/static/js/components/media.js
git commit -m "feat(media): add media.js component — tile + bottom sheet logic"
```

---

### Task 7: Frontend — Register in renderer.js

**Files:**
- Modify: `retro-panel/app/static/js/renderer.js`

- [ ] **Step 1: Add to COMPONENT_MAP and COL_CLASS_MAP**

In `retro-panel/app/static/js/renderer.js`:

1. Add to the `COMPONENT_MAP` object (around line 22, after `'climate': null`):

```javascript
    'media_player':       null,
```

2. Add to `COL_CLASS_MAP` (around line 66, after the climate entry):

```javascript
    'media_player':       'tile-col-compact',
```

3. Add to the `init()` function (around line 149, after the `climate` assignment):

```javascript
    COMPONENT_MAP['media_player']       = window.MediaComponent         || null;
```

- [ ] **Step 2: Commit**

```bash
git add retro-panel/app/static/js/renderer.js
git commit -m "feat(media): register MediaComponent in renderer COMPONENT_MAP"
```

---

### Task 8: Smoke test and version bump

**Files:**
- Multiple files via release script

- [ ] **Step 1: Run all backend tests**

Run: `cd retro-panel && python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 2: Build Docker image locally to check for import errors**

Run: `cd retro-panel && docker build -t retro-panel-test -f retro-panel/Dockerfile retro-panel/`
Expected: Build succeeds

- [ ] **Step 3: Release beta for tablet testing**

Run: `cd retro-panel && ./scripts/release.sh beta 2.14.0-rc1`

This will:
- Update config.yaml version
- Update cache-busters in index.html and config.html
- Update rp-build meta tag
- Update CHANGELOG
- Run check + tests
- Commit, tag, push

- [ ] **Step 4: Test on iPad iOS 12**

Manual testing checklist:
1. Open `http://[HA_IP]:7655` on iPad
2. Add a `media_player.*` entity via config (on desktop browser)
3. Verify compact tile appears when device is off/idle
4. Start playing music on Sonos → tile should switch to wide
5. Tap mini play/pause button → direct action
6. Tap tile area (not buttons) → bottom sheet opens
7. Test volume slider in bottom sheet
8. Test source selector if available
9. Stop playback → tile should switch back to compact
10. Verify no JS errors in Safari console
