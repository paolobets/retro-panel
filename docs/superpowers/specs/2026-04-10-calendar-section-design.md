# Calendar Section — Design Spec

## Goal

Add a calendar section to Retro Panel that displays events from Home Assistant `calendar.*` entities with month/week/day views, multi-calendar support with filtering, and a bottom sheet for day event details.

## Constraints

- **iOS 12 Safari compatibility** — no CSS grid, no flex gap, no const/let, no arrow functions, IIFE pattern
- **config.html** (modern browsers only) — no iOS 12 restrictions
- Follow existing section patterns (cameras, alarms) for config, API, nav, renderer
- Dark theme, touch-optimized for wall-mounted tablets (44px minimum touch targets)

## Architecture Overview

The calendar section follows the same architecture as cameras/alarms:
- **Config page** — tab to add/remove `calendar.*` entities, assign labels and colors
- **Backend** — new picker endpoint for calendar entities, proxy to HA calendar API for events, config loading/saving
- **Frontend** — new `calendar.js` component with month/week/day views, registered in renderer.js and nav.js

## Config Data Model

```javascript
// In state (config.js)
calendars: [],  // [{entity_id, label, color}]
calendars_section: { title: 'Calendario', icon: 'calendar' }

// nav_order includes 'calendars'
nav_order: ['rooms', 'scenarios', 'cameras', 'alarms', 'calendars']
```

```python
# In loader.py
@dataclass
class CalendarConfig:
    entity_id: str
    label: str = ''
    color: str = ''  # hex color, e.g. '#4a9eff'
```

## Config Page (config.html)

New "Calendari" tab with:
- List of configured calendars (entity_id, label input, color picker)
- "+ Aggiungi Calendario" button opens entity picker filtered to `calendar.*` domain
- Remove button per calendar
- Follows cameras tab pattern

## Backend API

### New endpoints:

**`GET /api/picker/calendars`** — returns list of `calendar.*` entities from HA (Ingress only)

**`GET /api/calendar-events/{entity_id}?start=ISO&end=ISO`** — proxies to HA REST API `/api/calendars/{entity_id}?start=...&end=...`, returns event list. Available on both Ingress and direct port (read-only, no sensitive data).

### HA Calendar Event format (from HA API):
```json
{
  "summary": "Dentista",
  "start": {"dateTime": "2026-04-10T10:30:00+02:00"},
  "end": {"dateTime": "2026-04-10T11:30:00+02:00"},
  "description": "...",
  "location": "..."
}
```
All-day events use `"date"` instead of `"dateTime"`:
```json
{
  "summary": "Compleanno Marco",
  "start": {"date": "2026-04-18"},
  "end": {"date": "2026-04-19"}
}
```

### Config serialization (panel_config.py):
```python
"calendars": [
    {"entity_id": c.entity_id, "label": c.label, "color": c.color}
    for c in config.calendars
],
"calendars_section": {
    "title": config.calendars_section_title,
    "icon": config.calendars_section_icon,
}
```

## Frontend — Calendar Component (calendar.js)

Single IIFE component `window.CalendarComponent` that manages the full calendar page.

### Structure

```
calendar.js (IIFE)
├── State: currentYear, currentMonth, selectedDay, currentView, selectedCals, events cache
├── init(container, calendars, appState) — entry point called by renderer
├── Month view — flex-wrap 7-column grid
├── Week view — flex-based timeline with all-day banner
├── Day view — compact agenda cards
├── Bottom sheet — peek/expand/close for day events
├── Calendar dropdown — multi-select filter
├── View switcher — Month/Week/Day
├── Navigation — prev/next month, "Oggi" button
└── Event fetching — calls /api/calendar-events/ per calendar per visible range
```

### Month View
- Row 1: ◀ Month Year ▶ [Oggi]
- Row 2: Calendar dropdown (multi-select) | Mese/Settimana/Giorno buttons
- Grid: 7 columns via flex-wrap (width: 14.2857%), min-height 56px per cell
- Weekend cells slightly darker background (#161626)
- Today cell: blue border
- Event indicators: 1 event = colored dot (10px), 2+ events = count badge only (no dots)
- Tap on day → bottom sheet with events
- Swipe left/right to navigate months

### Week View
- Same Row 1 and Row 2 as month
- Week range label: "Sett. 15 · 6–12 Aprile"
- Header: day names + numbers + event count per day
- All-day events banner row at top
- Time grid: hours 7–22, flex-based (50px time column + 7 equal day columns)
- Events positioned by start time and duration
- Today column highlighted, red "current time" line with dot
- Tap on day header → bottom sheet

### Day View — Compact Agenda
- Same Row 1 and Row 2 as month
- Header: ◀ [Oggi label if today] DayName DD Month (N eventi) ▶
- Agenda cards: rounded cards with color bar, title (16px), time (13px), calendar name
- No 24h timeline, no scroll needed for typical day (fits on screen)
- Empty state: calendar icon + "Nessun evento"

### Bottom Sheet (month/week views)
- Peek mode (38vh) for 1-3 events, auto-expanded for 4+
- Handle area for swipe up/down gesture (wide touch target)
- Close button ✕ in header
- Events sorted: all-day first, then chronological
- Each event: color bar, title, time/all-day, calendar name
- Overlay tap or ✕ to close

### Calendar Dropdown
- Multi-select with checkmarks
- Each item shows: color dot, name, event count for current month
- "Seleziona tutti" option at bottom
- Stays open while toggling (closes on outside click)
- Button shows: selected dots + names (or "Tutti i calendari")

### "Oggi" Button
- Always visible next to month/year
- Dimmed (opacity 35%) when already viewing today
- Click → navigates to current month (month/week) or current day (day view)

### Event Fetching Strategy
- On view change or month navigation, fetch events for visible date range
- Fetch per calendar entity: `GET /api/calendar-events/{entity_id}?start=...&end=...`
- Cache events per calendar per month to avoid redundant fetches
- Refresh on WebSocket `state_changed` for calendar entities (HA fires these when calendar updates)

## CSS

All styles in `tiles.css` under `.cal-*` prefix. iOS 12 safe:
- `-webkit-flex` everywhere
- No `gap` — use margin on children
- No CSS grid — use flex-wrap with percentage widths
- No `aspect-ratio` — use min-height
- `-webkit-transition` and `-webkit-transform` prefixes

## Nav Integration

In `nav.js`, add calendar section after alarms:
```javascript
if (secId === 'calendars') {
  if (config.calendars && config.calendars.length > 0) {
    var calSec = config.calendars_section || {};
    addNavItem(nav, 'calendars', _mdi(calSec.icon || 'calendar', 22), calSec.title || 'Calendario');
  }
}
```

## Renderer Integration

In `renderer.js`, add routing:
```javascript
} else if (sectionId === 'calendars') {
  _renderCalendarSection(contentArea, config, appState);
}
```

`_renderCalendarSection` creates a container div and calls `CalendarComponent.init()`.

## Config Save/Load

### loader.py
- New `CalendarConfig` dataclass
- `_parse_calendar()` function
- Added to `PanelConfig`: `calendars`, `calendars_section_title`, `calendars_section_icon`
- `nav_order` default includes `'calendars'`
- `all_entity_ids` includes calendar entity_ids

### panel_config_save.py
- Validate and save calendars array (entity_id must start with `calendar.`)
- Save label (max 64 chars) and color (hex format)

## Security
- `/api/picker/calendars` — Ingress only (same as other pickers)
- `/api/calendar-events/{entity_id}` — available on direct port (read-only event data, not sensitive)
- Entity whitelist: add `calendar` to allowed service domains

## Testing
- `test_calendar_config.py` — test config load/save with calendar entries
- Test event proxy endpoint
- Test picker endpoint returns only calendar.* entities

## Mockup Reference
Interactive mockup: `.superpowers/brainstorm/414-1775821126/content/calendar-final.html`
