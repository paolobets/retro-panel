# Calendar Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a calendar section to Retro Panel with month/week/day views, multi-calendar support, and bottom sheet event detail — fully integrated with HA calendar entities.

**Architecture:** Backend adds CalendarConfig dataclass + picker endpoint + event proxy. Frontend adds CalendarComponent (IIFE, ES5, iOS 12 safe) with three views and bottom sheet. Config page adds Calendari tab. Nav and renderer integrate the new section following the existing alarm/camera pattern.

**Tech Stack:** Python 3.11 + aiohttp (backend), Vanilla JS ES5 (frontend), CSS with -webkit- prefixes (iOS 12)

**IMPORTANT:** All frontend JS for index.html must be iOS 12 safe: only `var`, `function` declarations, IIFE pattern, no arrow functions, no const/let, no optional chaining, no CSS grid, no flex gap. Config page (config.html) has no restrictions.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/config/loader.py` | Modify | CalendarConfig dataclass, _parse_calendar(), PanelConfig fields |
| `app/api/panel_config.py` | Modify | Serialize calendars to frontend JSON |
| `app/api/panel_config_save.py` | Modify | Validate and save calendar config |
| `app/api/picker_calendars.py` | Create | GET /api/picker/calendars endpoint |
| `app/api/calendar_events.py` | Create | GET /api/calendar-events/{entity_id} proxy |
| `app/proxy/ha_client.py` | Modify | Add get_calendar_events() method |
| `app/server.py` | Modify | Register routes, add to _INGRESS_ONLY_PATHS |
| `app/static/js/components/calendar.js` | Create | CalendarComponent IIFE — month/week/day views + bottom sheet |
| `app/static/css/tiles.css` | Modify | .cal-* CSS classes |
| `app/static/js/renderer.js` | Modify | Add calendars section routing |
| `app/static/js/nav.js` | Modify | Add calendars nav item |
| `app/static/js/config.js` | Modify | Add calendars state + tab + loading |
| `app/static/js/config-api.js` | Modify | Add cfgFetchCalendars() |
| `app/static/config.html` | Modify | Add Calendari tab HTML |
| `app/static/index.html` | Modify | Add calendar.js script tag |
| `tests/test_calendar_config.py` | Create | Tests for config load/save/events |

---

### Task 1: Backend — CalendarConfig dataclass and config load/save

**Files:**
- Modify: `retro-panel/app/config/loader.py`
- Modify: `retro-panel/app/api/panel_config.py`
- Modify: `retro-panel/app/api/panel_config_save.py`
- Create: `retro-panel/tests/test_calendar_config.py`

- [ ] **Step 1: Write tests for calendar config**

Create `retro-panel/tests/test_calendar_config.py`:

```python
"""Tests for calendar configuration loading, saving, and serialization."""
from __future__ import annotations
import json
import pytest
from unittest.mock import MagicMock


def test_parse_calendar_valid():
    """Valid calendar entry is parsed correctly."""
    from config.loader import _parse_calendar
    raw = {"entity_id": "calendar.famiglia", "label": "Famiglia", "color": "#4a9eff"}
    result = _parse_calendar(raw)
    assert result is not None
    assert result.entity_id == "calendar.famiglia"
    assert result.label == "Famiglia"
    assert result.color == "#4a9eff"


def test_parse_calendar_invalid_domain():
    """Non-calendar entity_id is rejected."""
    from config.loader import _parse_calendar
    raw = {"entity_id": "sensor.temperature", "label": "Test"}
    result = _parse_calendar(raw)
    assert result is None


def test_parse_calendar_empty():
    """Empty dict returns None."""
    from config.loader import _parse_calendar
    assert _parse_calendar({}) is None
    assert _parse_calendar({"entity_id": ""}) is None


def test_parse_calendar_defaults():
    """Missing label and color get empty defaults."""
    from config.loader import _parse_calendar
    raw = {"entity_id": "calendar.test"}
    result = _parse_calendar(raw)
    assert result is not None
    assert result.label == ""
    assert result.color == ""


def test_panel_config_has_calendar_fields():
    """PanelConfig has calendar-related fields with defaults."""
    from config.loader import PanelConfig
    pc = PanelConfig(
        ha_url="http://localhost:8123",
        ha_token="test",
        title="Home",
        theme="dark",
        refresh_interval=30,
    )
    assert pc.calendars == []
    assert pc.calendars_section_title == "Calendario"
    assert pc.calendars_section_icon == "calendar"
    assert "calendars" in pc.nav_order


def test_calendar_entity_ids_in_all_entity_ids():
    """Calendar entity_ids are included in all_entity_ids."""
    from config.loader import PanelConfig, CalendarConfig
    pc = PanelConfig(
        ha_url="http://localhost:8123",
        ha_token="test",
        title="Home",
        theme="dark",
        refresh_interval=30,
        calendars=[CalendarConfig(entity_id="calendar.famiglia")],
    )
    assert "calendar.famiglia" in pc.all_entity_ids
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:\Work\Sviluppo\retro-panel && py -m pytest retro-panel/tests/test_calendar_config.py -v
```
Expected: FAIL (CalendarConfig and _parse_calendar don't exist yet)

- [ ] **Step 3: Implement CalendarConfig dataclass in loader.py**

In `retro-panel/app/config/loader.py`, add after the AlarmConfig dataclass (around line 264):

```python
@dataclass
class CalendarConfig:
    """A calendar entity with optional display settings."""
    entity_id: str
    label: str = ''
    color: str = ''  # hex color, e.g. '#4a9eff'
```

Add to PanelConfig dataclass (after alarms fields, around line 300):

```python
    calendars: List[CalendarConfig] = field(default_factory=list)
    calendars_section_title: str = 'Calendario'
    calendars_section_icon: str = 'calendar'
```

Update `nav_order` default to include calendars:

```python
    nav_order: List[str] = field(default_factory=lambda: ['rooms', 'scenarios', 'cameras', 'alarms', 'calendars'])
```

Add `_parse_calendar` function (after `_parse_alarm`, around line 730):

```python
def _parse_calendar(raw: dict) -> Optional[CalendarConfig]:
    """Parse a single calendar entry from entities.json v5."""
    eid = str(raw.get('entity_id') or '').strip()
    if not eid or not eid.startswith('calendar.'):
        return None
    return CalendarConfig(
        entity_id=eid,
        label=str(raw.get('label') or '').strip(),
        color=str(raw.get('color') or '').strip(),
    )
```

Add calendar entity_ids to `all_entity_ids` property (in the for-loop section, after alarms):

```python
        for cal in self.calendars:
            _add(cal.entity_id)
```

Add calendar loading in `_load_layout` function (after alarms loading):

```python
        calendars = [c for c in [_parse_calendar(x) for x in (raw.get("calendars") or []) if isinstance(x, dict)] if c]
        cal_sec = raw.get("calendars_section") or {}
```

And include in the returned PanelConfig constructor:

```python
        calendars=calendars,
        calendars_section_title=str(cal_sec.get("title") or "Calendario").strip() or "Calendario",
        calendars_section_icon=str(cal_sec.get("icon") or "calendar").strip() or "calendar",
```

Update `nav_order` filter to accept `'calendars'`:

```python
nav_order_valid = {'rooms', 'scenarios', 'cameras', 'alarms', 'calendars'}
```

- [ ] **Step 4: Add calendar serialization in panel_config.py**

In `retro-panel/app/api/panel_config.py`, add to the payload dict (after alarms_section):

```python
        "calendars": [
            {
                "entity_id": c.entity_id,
                "label": c.label,
                "color": c.color,
            }
            for c in config.calendars
        ],
        "calendars_section": {
            "title": config.calendars_section_title,
            "icon":  config.calendars_section_icon,
        },
```

- [ ] **Step 5: Add calendar save logic in panel_config_save.py**

Add constants at top:

```python
_MAX_CALENDARS = 20
_CALENDAR_ENTITY_RE = re.compile(r'^calendar\.[a-z0-9_]+$')
_COLOR_RE = re.compile(r'^#[0-9a-fA-F]{6}$')
```

Add save section (after alarms save):

```python
    # --- calendars ---
    cal_sec_raw = body.get("calendars_section") or {}
    calendars_section_title = str(cal_sec_raw.get("title") or "Calendario").strip()[:_MAX_TITLE] or "Calendario"
    calendars_section_icon = str(cal_sec_raw.get("icon") or "calendar").strip()[:_MAX_ICON] or "calendar"

    calendars_out = []
    for cal in (body.get("calendars") or [])[:_MAX_CALENDARS]:
        if not isinstance(cal, dict):
            continue
        cal_eid = str(cal.get("entity_id") or "").strip()
        if not cal_eid or not _CALENDAR_ENTITY_RE.match(cal_eid):
            continue
        cal_color = str(cal.get("color") or "").strip()
        if cal_color and not _COLOR_RE.match(cal_color):
            cal_color = ""
        calendars_out.append({
            "entity_id": cal_eid,
            "label": str(cal.get("label") or "").strip()[:_MAX_LABEL],
            "color": cal_color,
        })
```

Include in the output dict:

```python
        "calendars": calendars_out,
        "calendars_section": {"title": calendars_section_title, "icon": calendars_section_icon},
```

- [ ] **Step 6: Run tests**

```bash
cd C:\Work\Sviluppo\retro-panel && py -m pytest retro-panel/tests/test_calendar_config.py -v
```
Expected: all 6 pass

- [ ] **Step 7: Run full test suite**

```bash
cd C:\Work\Sviluppo\retro-panel && py -m pytest retro-panel/tests/ -q
```
Expected: all tests pass (145 + 6 new = 151)

- [ ] **Step 8: Commit**

```bash
git add retro-panel/app/config/loader.py retro-panel/app/api/panel_config.py retro-panel/app/api/panel_config_save.py retro-panel/tests/test_calendar_config.py
git commit -m "feat(calendar): add CalendarConfig dataclass, config load/save/serialization

- CalendarConfig with entity_id, label, color
- _parse_calendar() validates calendar.* domain
- panel_config.py serializes calendars to frontend
- panel_config_save.py validates and persists with color regex
- 6 new tests all passing"
```

---

### Task 2: Backend — Calendar picker and event proxy endpoints

**Files:**
- Create: `retro-panel/app/api/picker_calendars.py`
- Create: `retro-panel/app/api/calendar_events.py`
- Modify: `retro-panel/app/proxy/ha_client.py`
- Modify: `retro-panel/app/server.py`
- Modify: `retro-panel/tests/test_calendar_config.py`

- [ ] **Step 1: Add tests for calendar events proxy**

Append to `retro-panel/tests/test_calendar_config.py`:

```python
import aiohttp
from aiohttp import web
from aiohttp.test_utils import AioHTTPTestCase, unittest_run_loop


class TestCalendarEventsProxy(AioHTTPTestCase):
    """Test the /api/calendar-events/ proxy endpoint."""

    async def get_application(self):
        from calendar_events import get_calendar_events
        app = web.Application()
        # Mock ha_client
        ha_client = MagicMock()
        ha_client.get_calendar_events = MagicMock(return_value=[
            {"summary": "Test Event", "start": {"dateTime": "2026-04-10T10:00:00"}, "end": {"dateTime": "2026-04-10T11:00:00"}}
        ])
        app['ha_client'] = ha_client
        app.router.add_get("/api/calendar-events/{entity_id}", get_calendar_events)
        return app

    @unittest_run_loop
    async def test_calendar_events_returns_json(self):
        resp = await self.client.request("GET", "/api/calendar-events/calendar.test?start=2026-04-01T00:00:00&end=2026-04-30T23:59:59")
        assert resp.status == 200
        data = await resp.json()
        assert len(data) == 1
        assert data[0]["summary"] == "Test Event"

    @unittest_run_loop
    async def test_calendar_events_missing_params(self):
        resp = await self.client.request("GET", "/api/calendar-events/calendar.test")
        assert resp.status == 400
```

- [ ] **Step 2: Add get_calendar_events to ha_client.py**

In `retro-panel/app/proxy/ha_client.py`, add method to HAClient class:

```python
    async def get_calendar_events(
        self, entity_id: str, start: str, end: str
    ) -> list[dict]:
        """Fetch calendar events from HA REST API.

        Args:
            entity_id: Calendar entity (e.g. 'calendar.famiglia')
            start: ISO datetime start bound
            end: ISO datetime end bound

        Returns:
            List of event dicts with summary, start, end, description, location.
        """
        url = f"{self._ha_url}/api/calendars/{entity_id}"
        session = self._get_session()
        try:
            async with session.get(
                url,
                params={"start": start, "end": end},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 401:
                    raise PermissionError("HA token rejected for calendar events")
                if resp.status == 404:
                    raise FileNotFoundError(f"Calendar entity not found: {entity_id}")
                resp.raise_for_status()
                return await resp.json()
        except aiohttp.ClientConnectorError as exc:
            raise ConnectionRefusedError(str(exc)) from exc
        except asyncio.TimeoutError as exc:
            raise TimeoutError(f"Calendar events request for '{entity_id}' timed out") from exc
```

- [ ] **Step 3: Create picker_calendars.py**

Create `retro-panel/app/api/picker_calendars.py`:

```python
"""GET /api/picker/calendars — list calendar entities from HA."""
from __future__ import annotations

import logging

from aiohttp import web

logger = logging.getLogger(__name__)


async def get_picker_calendars(request: web.Request) -> web.Response:
    """Return all calendar.* entities known to HA."""
    ha_client = request.app["ha_client"]
    try:
        entities = await ha_client.get_entity_registry()
    except Exception:
        logger.exception("Failed to fetch entity registry for calendar picker")
        return web.json_response({"error": "Failed to fetch entities"}, status=502)

    calendars = []
    for ent in entities:
        eid = ent.get("entity_id", "")
        if eid.startswith("calendar."):
            calendars.append({
                "entity_id": eid,
                "name": ent.get("name") or ent.get("original_name") or eid,
                "area_id": ent.get("area_id") or "",
            })
    return web.json_response(calendars)
```

- [ ] **Step 4: Create calendar_events.py**

Create `retro-panel/app/api/calendar_events.py`:

```python
"""GET /api/calendar-events/{entity_id} — proxy calendar events from HA."""
from __future__ import annotations

import logging
import re

from aiohttp import web

logger = logging.getLogger(__name__)

_CALENDAR_RE = re.compile(r'^calendar\.[a-z0-9_]+$')


async def get_calendar_events(request: web.Request) -> web.Response:
    """Proxy calendar event list from HA REST API."""
    entity_id = request.match_info["entity_id"]
    if not _CALENDAR_RE.match(entity_id):
        return web.json_response({"error": "Invalid calendar entity_id"}, status=400)

    start = request.query.get("start")
    end = request.query.get("end")
    if not start or not end:
        return web.json_response(
            {"error": "Missing required query params: start, end"}, status=400
        )

    ha_client = request.app["ha_client"]
    try:
        events = await ha_client.get_calendar_events(entity_id, start, end)
        return web.json_response(events)
    except FileNotFoundError:
        return web.json_response({"error": f"Calendar not found: {entity_id}"}, status=404)
    except PermissionError:
        return web.json_response({"error": "HA authentication failed"}, status=403)
    except (ConnectionRefusedError, TimeoutError) as exc:
        logger.warning("Calendar events proxy failed for %s: %s", entity_id, exc)
        return web.json_response({"error": "HA connection failed"}, status=502)
```

- [ ] **Step 5: Register routes in server.py**

Add imports at the top of server.py (with the other api imports):

```python
from api.picker_calendars import get_picker_calendars
from api.calendar_events import get_calendar_events
```

Add to `_INGRESS_ONLY_PATHS`:

```python
    "/api/picker/calendars",
```

Add routes (after picker/cameras route):

```python
    app.router.add_get("/api/picker/calendars", get_picker_calendars)
    app.router.add_get("/api/calendar-events/{entity_id}", get_calendar_events)
```

- [ ] **Step 6: Run tests**

```bash
cd C:\Work\Sviluppo\retro-panel && py -m pytest retro-panel/tests/test_calendar_config.py -v
```
Expected: all tests pass

- [ ] **Step 7: Run full suite**

```bash
cd C:\Work\Sviluppo\retro-panel && py -m pytest retro-panel/tests/ -q
```
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add retro-panel/app/api/picker_calendars.py retro-panel/app/api/calendar_events.py retro-panel/app/proxy/ha_client.py retro-panel/app/server.py retro-panel/tests/test_calendar_config.py
git commit -m "feat(calendar): add picker and event proxy API endpoints

- GET /api/picker/calendars — returns calendar.* entities (Ingress only)
- GET /api/calendar-events/{entity_id}?start=&end= — proxies HA calendar API
- HAClient.get_calendar_events() method
- Tests for event proxy endpoint"
```

---

### Task 3: Frontend — Calendar CSS

**Files:**
- Modify: `retro-panel/app/static/css/tiles.css`

- [ ] **Step 1: Add all .cal-* CSS classes to tiles.css**

Append to the end of `retro-panel/app/static/css/tiles.css`. All rules use `-webkit-flex` and avoid CSS grid and flex gap. Copy CSS directly from the approved mockup (`calendar-final.html`) but adapted to use CSS custom properties from the design system where applicable (`--c-surface-2`, `--c-text-pri`, `--c-text-sec`, `--c-accent`).

The CSS should include all classes for:
- `.cal-page` — flex column container
- `.cal-row-month` — month/year header with nav arrows
- `.cal-row-controls` — dropdown + view switcher
- `.cal-dropdown-*` — dropdown button, menu, items
- `.cal-view-switcher`, `.cal-view-btn` — M/S/G buttons
- `.cal-weekdays`, `.cal-weekday` — day name headers
- `.cal-days`, `.cal-day-wrap`, `.cal-day` — month grid cells
- `.cal-day-dot`, `.cal-day-count` — event indicators
- `.cal-week-*` — week view header, body, cells, events, now-line
- `.cal-day-agenda`, `.cal-day-card` — day view agenda cards
- `.cal-sheet-*` — bottom sheet (overlay, handle, header, body, events)
- `.cal-btn-oggi` — today button

All prefixed with `cal-` to avoid conflicts. iOS 12 safe: `-webkit-flex`, no `gap`, no `grid`, `-webkit-transform`, `-webkit-transition`.

- [ ] **Step 2: Commit**

```bash
git add retro-panel/app/static/css/tiles.css
git commit -m "feat(calendar): add .cal-* CSS classes for calendar component

iOS 12 safe: -webkit-flex, no grid, no gap, -webkit- prefixes.
Month grid, week timeline, day agenda, dropdown, bottom sheet."
```

---

### Task 4: Frontend — CalendarComponent (month view + bottom sheet)

**Files:**
- Create: `retro-panel/app/static/js/components/calendar.js`

- [ ] **Step 1: Create calendar.js with IIFE skeleton and month view**

Create `retro-panel/app/static/js/components/calendar.js`. This is the largest file — the IIFE contains:

```javascript
window.CalendarComponent = (function() {
  'use strict';

  // State
  var _container = null;
  var _calendars = [];  // [{entity_id, label, color}]
  var _appState = null;
  var _currentYear = 0;
  var _currentMonth = 0;  // 0-indexed
  var _selectedDay = null;
  var _currentView = 'month';  // month | week | day
  var _selectedCals = [];  // entity_ids of selected calendars
  var _eventsCache = {};  // key: 'YYYY-MM' → [{cal, title, date, start, end, allDay}]

  // Constants
  var MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  var DAYS_IT = ['LUN','MAR','MER','GIO','VEN','SAB','DOM'];
  var DAYS_FULL = ['Luned\u00ec','Marted\u00ec','Mercoled\u00ec','Gioved\u00ec','Venerd\u00ec','Sabato','Domenica'];
  var DEFAULT_COLORS = ['#4a9eff','#4caf50','#ff9800','#e91e63','#9c27b0','#00bcd4','#ff5722','#607d8b'];

  // ... helper functions (pad, dateStr, getCalColor, getCalName, etc.)
  // ... init(container, calendars, appState) — builds DOM structure
  // ... renderHeader() — month/year row with nav + Oggi button
  // ... renderControls() — dropdown + view switcher
  // ... renderMonth() — flex-wrap grid with day cells
  // ... openSheet(day) — bottom sheet with events
  // ... closeSheet()
  // ... fetchEvents(year, month) — calls /api/calendar-events/ per calendar
  // ... event handlers for nav, dropdown, view switch, day click, swipe, sheet gestures

  return {
    init: init
  };
}());
```

The component must be written entirely in ES5 with `var`, `function` declarations, no arrow functions, no const/let. Follow the exact mockup layout and behavior from `calendar-final.html`.

Key behaviors:
- `init(container, calendars, appState)` creates the full DOM structure and starts event fetching
- Month grid uses flex-wrap with `width: 14.2857%` per cell
- Day click opens bottom sheet via `openSheet(day)`
- Bottom sheet has peek (38vh) / expanded (85vh) / closed states
- Sheet handle + header area both respond to touch/mouse swipe gestures
- Sheet has ✕ close button
- Calendar dropdown stays open during multi-select, closes on outside click
- "Oggi" button always visible, dimmed when already on today
- Swipe left/right on month grid navigates months
- Event fetching: on month change, for each selected calendar, call `fetch('api/calendar-events/' + entityId + '?start=' + startISO + '&end=' + endISO')` and cache results

- [ ] **Step 2: Commit**

```bash
git add retro-panel/app/static/js/components/calendar.js
git commit -m "feat(calendar): add CalendarComponent with month view and bottom sheet

IIFE pattern, ES5 only, iOS 12 safe.
Month grid, event indicators, multi-calendar dropdown,
bottom sheet with peek/expand/close, Oggi button, swipe navigation."
```

---

### Task 5: Frontend — CalendarComponent week and day views

**Files:**
- Modify: `retro-panel/app/static/js/components/calendar.js`

- [ ] **Step 1: Add week view to CalendarComponent**

Add `renderWeek()` function that builds:
- Week range label ("Sett. N · DD–DD Mese")
- Header row with day names, numbers, event counts
- All-day events banner row
- Time grid (hours 7–22) with positioned events
- Today column highlight + red current-time line
- Tap on day header opens bottom sheet

- [ ] **Step 2: Add day view to CalendarComponent**

Add `renderDay()` function that builds:
- Header with ◀ DayName DD Month ▶ and "Oggi" label when applicable
- Compact agenda cards (no 24h timeline)
- All-day events at top, timed events sorted chronologically
- Empty state with icon and message
- Prev/next day navigation

- [ ] **Step 3: Add view switcher logic**

Wire the M/S/G buttons to switch `_currentView` and call the appropriate render function.

- [ ] **Step 4: Commit**

```bash
git add retro-panel/app/static/js/components/calendar.js
git commit -m "feat(calendar): add week and day views to CalendarComponent

Week: range label, all-day banner, time grid, current-time line.
Day: compact agenda cards, no scroll needed, Oggi label."
```

---

### Task 6: Frontend — Nav + Renderer integration

**Files:**
- Modify: `retro-panel/app/static/js/nav.js`
- Modify: `retro-panel/app/static/js/renderer.js`
- Modify: `retro-panel/app/static/index.html`

- [ ] **Step 1: Add calendar nav item in nav.js**

In `nav.js`, inside the `for` loop over `navOrder` (after the alarms `else if` block), add:

```javascript
      } else if (secId === 'calendars') {
        if (config.calendars && config.calendars.length > 0) {
          var calSec = config.calendars_section || {};
          addNavItem(nav, 'calendars', _mdi(calSec.icon || 'calendar', 22), calSec.title || 'Calendario');
        }
      }
```

Update the default navOrder fallback to include calendars:

```javascript
    var navOrder = config.nav_order || ['rooms', 'scenarios', 'cameras', 'alarms', 'calendars'];
```

- [ ] **Step 2: Add calendar section routing in renderer.js**

In `renderer.js`, in the `renderActiveSection` function, add before the `room:` check:

```javascript
    } else if (sectionId === 'calendars') {
      var calComp = window.CalendarComponent;
      if (calComp) {
        calComp.init(contentArea, config.calendars || [], appState);
      } else {
        var emptyDiv = DOM.createElement('div', 'empty-state');
        emptyDiv.innerHTML = '<span class="empty-state-icon">\uD83D\uDCC5</span>'
          + '<p class="empty-state-title">Calendario non disponibile</p>';
        contentArea.appendChild(emptyDiv);
      }
```

- [ ] **Step 3: Add calendar.js script tag in index.html**

In `retro-panel/app/static/index.html`, add after the climate.js script tag:

```html
  <script src="static/js/components/calendar.js?v=XXXX"></script>
```

(Use current cache-buster version)

- [ ] **Step 4: Commit**

```bash
git add retro-panel/app/static/js/nav.js retro-panel/app/static/js/renderer.js retro-panel/app/static/index.html
git commit -m "feat(calendar): integrate CalendarComponent in nav and renderer

- Nav shows Calendario section when calendars configured
- Renderer routes 'calendars' sectionId to CalendarComponent.init()
- calendar.js script tag added to index.html"
```

---

### Task 7: Config page — Calendari tab

**Files:**
- Modify: `retro-panel/app/static/js/config.js`
- Modify: `retro-panel/app/static/js/config-api.js`
- Modify: `retro-panel/app/static/config.html`

- [ ] **Step 1: Add cfgFetchCalendars to config-api.js**

Add function:

```javascript
function cfgFetchCalendars() {
  return fetch('api/picker/calendars').then(function (r) {
    if (!r.ok) { throw new Error('Failed to load calendars (' + r.status + ')'); }
    return r.json().then(function (data) {
      return Array.isArray(data) ? data : [];
    });
  });
}
```

- [ ] **Step 2: Add calendars to config.js state object**

In `config.js`, add to the `state` object:

```javascript
    calendars:           [],  // [{entity_id, label, color}]
    calendars_section:   { title: 'Calendario', icon: 'calendar' },
```

- [ ] **Step 3: Add calendars to nav_order filter**

In config.js, update the nav_order filter to accept 'calendars':

```javascript
.filter(function(s) { return ['rooms','scenarios','cameras','alarms','calendars'].indexOf(s) !== -1; })
```

And the default:

```javascript
: ['rooms', 'scenarios', 'cameras', 'alarms', 'calendars'];
```

- [ ] **Step 4: Add config loading for calendars**

In the config load section, add:

```javascript
        // calendars
        var calSecRaw = cfg.calendars_section || {};
        state.calendars_section = {
          title: calSecRaw.title || 'Calendario',
          icon:  calSecRaw.icon  || 'calendar',
        };
        state.calendars = (cfg.calendars || []).map(function(c) {
          return {
            entity_id: c.entity_id || '',
            label:     c.label     || '',
            color:     c.color     || '',
          };
        });
```

- [ ] **Step 5: Add Calendari tab to config.html**

Add a tab button in the tab bar and the corresponding content section. Follow the alarms tab pattern: list of configured calendars with entity_id display, label input, color input, and remove button. An "+ Aggiungi Calendario" button opens a picker overlay.

- [ ] **Step 6: Add renderCalendarsList function to config.js**

Follow the alarm tab pattern: renders the list of configured calendars with:
- Entity ID display
- Label input field
- Color picker (simple input type="color" — config.html runs on modern browsers)
- Remove button
- Add button that opens calendar entity picker (using cfgFetchCalendars)

- [ ] **Step 7: Add calendar entity picker overlay to config.html and config.js**

Follow the alarm entity picker pattern:
- Overlay with search input
- List of available calendar.* entities with "+" add button
- Already-added entities shown disabled

- [ ] **Step 8: Commit**

```bash
git add retro-panel/app/static/js/config.js retro-panel/app/static/js/config-api.js retro-panel/app/static/config.html
git commit -m "feat(calendar): add Calendari tab to config page

- cfgFetchCalendars() API helper
- State object with calendars array
- Config loading for calendars
- Calendari tab with entity list, label, color picker
- Calendar entity picker overlay"
```

---

### Task 8: Beta release and testing

**Files:**
- Modify: `retro-panel/CHANGELOG.md`

- [ ] **Step 1: Run full test suite**

```bash
cd C:\Work\Sviluppo\retro-panel && py -m pytest retro-panel/tests/ -q
```
Expected: all tests pass

- [ ] **Step 2: Update CHANGELOG**

Add entry for the calendar feature.

- [ ] **Step 3: Commit changelog**

```bash
git add retro-panel/CHANGELOG.md
git commit -m "docs: add calendar section to CHANGELOG"
```

- [ ] **Step 4: Beta release**

```bash
cd C:\Work\Sviluppo\retro-panel && ./scripts/release.sh beta 2.13.0-rc1
```

- [ ] **Step 5: Test on HA**

On Home Assistant:
1. Update "Retro Panel Beta" add-on
2. Go to Config (via Ingress) → Calendari tab
3. Add calendar entities
4. Go to dashboard on :7655
5. Verify month/week/day views work
6. Verify bottom sheet opens on day tap
7. Verify multi-calendar dropdown filters events
8. Verify "Oggi" button works
