# Calendar Week View — Design Spec

## Context

The calendar component was rewritten in rc15 with month view + side panel. This spec adds a week view as a second view mode, accessible via a view switcher. The week view shows 7 day columns with event cards stacked vertically (not a time grid).

## Scope

- **Modify:** `retro-panel/app/static/js/components/calendar.js` — add WeekRenderer module, view switcher logic, State/Controller changes
- **Modify:** `retro-panel/app/static/css/tiles.css` — add week view and view switcher CSS
- **NOT touched:** backend, API, nav.js, renderer.js, config.js/config.html, index.html

## Architecture

New `WeekRenderer` sub-module inside the existing IIFE, following the same pattern as `MonthRenderer`. Controller gains `onViewSwitch()` and adapts `onMonthNav()` for week navigation.

### Module Changes

| Module | Change |
|--------|--------|
| State | +`currentView` ('month'\|'week'), +`weekStart` (Date, monday) |
| DataLayer | No changes |
| MonthRenderer | No changes |
| PanelRenderer | No changes (not used in week view) |
| DropdownRenderer | No changes |
| **WeekRenderer** (new) | `build()`, `refresh()`, `_weekEl`, `_headerEl`, `_gridEl` |
| Controller | +`onViewSwitch()`, modify `init()` (add view switcher DOM + events), modify `onMonthNav()` (week-aware), modify `onCalendarFilterChange()` (week-aware), modify `_updateMonthLabel()` (week label), modify `destroy()` (cleanup WeekRenderer refs) |

## View Switcher

### DOM (built by Controller, inserted in `cal-row-controls`)

```html
<div class="cal-view-switcher">
  <div class="cal-view-btn active" data-view="month">Mese</div>
  <div class="cal-view-btn" data-view="week">Settimana</div>
</div>
```

### CSS

```css
.cal-view-switcher {
  display: -webkit-flex; display: flex;
  background: var(--c-surface-2, #1e1e32);
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #333;
  -webkit-flex-shrink: 0;
  flex-shrink: 0;
}
.cal-view-btn {
  padding: 10px 18px;
  font-size: 14px;
  font-weight: 600;
  color: var(--c-text-sec, #888);
  cursor: pointer;
  border: none;
  background: none;
  min-height: 44px;
  -webkit-transition: background 0.1s, color 0.1s;
  transition: background 0.1s, color 0.1s;
}
.cal-view-btn.active {
  background: var(--c-accent, #4a9eff);
  color: #fff;
}
.cal-view-btn:active:not(.active) {
  background: rgba(255, 255, 255, 0.07);
}
```

### Behavior

- Click "Mese" → switch to month view
- Click "Settimana" → switch to week view
- Active button highlighted with accent color
- Touch target 44px minimum

## State Changes

```js
State.currentView = 'month';  // 'month' | 'week'
State.weekStart = null;        // Date object (monday of current week)
```

`State.reset()` sets `currentView = 'month'` and `weekStart = null`.

## Week View

### No Side Panel

Week view does not use the side panel. Events are fully visible in the columns. If panel is open when switching to week, it closes.

### DOM Structure

```html
<div class="cal-week">
  <div class="cal-week-header">
    <div class="cal-week-col-header">
      <div class="cal-week-day-name">LUN</div>
      <div class="cal-week-day-num today">14</div>
    </div>
    <!-- ... 7 columns -->
  </div>
  <div class="cal-week-grid">
    <div class="cal-week-col">
      <div class="cal-event-card">
        <div class="cal-event-bar" style="background:#4a9eff"></div>
        <div class="cal-event-body">
          <div class="cal-event-title">Dentista</div>
          <div class="cal-event-time">10:30 – 11:30</div>
          <div class="cal-event-cal">Famiglia</div>
        </div>
      </div>
      <!-- more cards stacked -->
    </div>
    <div class="cal-week-col">
      <div class="cal-week-empty">Nessun evento</div>
    </div>
    <!-- ... 7 columns -->
  </div>
</div>
```

### Event Cards

Reuse the same `.cal-event-card` CSS class from the side panel. Same HTML structure: color bar (3px), title (14px bold, max 2 lines), time or "Tutto il giorno", calendar name. Cards are stacked vertically in each column.

### Event Ordering per Column

1. All-day events first (sorted by title)
2. Timed events after (sorted by start time)

### Empty Day

When a day has no events (after calendar filter):
```html
<div class="cal-week-empty">Nessun evento</div>
```
Centered text, secondary color, small font (11px).

### Column Header

- Day name abbreviated: LUN, MAR, MER, GIO, VEN, SAB, DOM (10px uppercase)
- Day number below (16px bold)
- Today: day number colored with `var(--c-accent)` via `.today` class
- Weekend: day name in secondary color via `.weekend` class

### Layout

- 7 equal-width columns via `flex: 1`
- Columns separated by `border-left: 1px solid var(--c-surface-2)` (first column excluded)
- Minimum column height: 120px
- Column padding: 4px
- Column spacing: `margin-left: 2px; margin-right: 2px` (no gap)

### Scroll

- `.cal-week` container has `overflow-y: auto` + `-webkit-overflow-scrolling: touch`
- All 7 columns scroll together (global scroll, not per-column)
- Week header stays above grid (not sticky — avoids iOS 12 position:sticky issues)

### CSS

```css
.cal-week {
  -webkit-flex: 1 1 auto;
  flex: 1 1 auto;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: none;
}
.cal-week.cal-week-active {
  display: block;
}

.cal-week-header {
  display: -webkit-flex;
  display: flex;
  border-bottom: 1px solid var(--c-surface-2, #333);
  padding-bottom: 8px;
  margin-bottom: 8px;
}
.cal-week-col-header {
  -webkit-flex: 1;
  flex: 1;
  text-align: center;
  margin-left: 2px;
  margin-right: 2px;
}
.cal-week-day-name {
  font-size: 10px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
}
.cal-week-day-name.weekend {
  color: var(--c-text-sec, #555);
}
.cal-week-day-num {
  font-size: 16px;
  font-weight: 700;
  color: var(--c-text-pri, #e0e0e0);
}
.cal-week-day-num.today {
  color: var(--c-accent, #4a9eff);
}

.cal-week-grid {
  display: -webkit-flex;
  display: flex;
  -webkit-align-items: flex-start;
  align-items: flex-start;
}
.cal-week-col {
  -webkit-flex: 1;
  flex: 1;
  margin-left: 2px;
  margin-right: 2px;
  min-height: 120px;
  padding: 4px;
  border-left: 1px solid var(--c-surface-2, #333);
}
.cal-week-col:first-child {
  border-left: none;
}

.cal-week-empty {
  text-align: center;
  color: var(--c-text-sec, #555);
  font-size: 11px;
  padding: 16px 4px;
}
```

## Navigation

### Arrows (◀ ▶) in Week View

- Previous: `State.weekStart` -= 7 days
- Next: `State.weekStart` += 7 days
- Navigation uses same `Controller.onMonthNav()` with view-aware logic
- `State.year`/`State.month` are NOT updated during week navigation — they are only used by month view. `State.weekStart` is self-sufficient for week rendering and data fetching.

### "Oggi" Button in Week View

- Navigates to the week containing today
- Dimmed when already viewing current week

### Header Label in Week View

Replaces "Aprile 2026" in the nav header with week label:
- Single month: `Sett. 16 · 14–20 Aprile`
- Cross-month: `Sett. 18 · 28 Apr – 4 Mag`
- Week number is ISO week (Monday = start)

## View Transitions

### Month → Week

1. User clicks "Settimana" in view switcher
2. If `State.selectedDay` exists → `weekStart` = Monday of that day's week
3. If no selected day → `weekStart` = Monday of current week (today)
4. If panel is open → close panel
5. `.cal-body` (containing month grid + panel) hides, `.cal-week` shows
6. Fetch events for months covered by the week (1 or 2 months if cross-month)
7. WeekRenderer.refresh()

### Week → Month

1. User clicks "Mese" in view switcher
2. `State.year`/`State.month` update to the month of `State.weekStart`
3. `.cal-week` hides, `.cal-body` shows
4. MonthRenderer.build() + fetch if needed

## Data Layer

No changes to DataLayer. Week view reuses existing infrastructure:
- Cache keyed by `entity_id + YYYY-MM` — same
- `DataLayer.getEventsForDay(year, month, day, selectedCalIds)` called 7 times (once per day)
- If week crosses month boundary, Controller calls `DataLayer.fetchMonth()` for both months
- `DataLayer.countEventsForCal()` still used by dropdown (shows current month counts)

## Dropdown in Week View

Works identically to month view:
- Filter changes call `Controller.onCalendarFilterChange()`
- Controller calls `WeekRenderer.refresh()` if current view is 'week'

## WeekRenderer API

```
WeekRenderer
  ├── build(container)  — creates header + grid structure
  ├── refresh()         — populates columns with event cards
  ├── _weekEl           — week container ref
  ├── _headerEl         — header row ref
  └── _gridEl           — grid row ref
```

`build()` creates the static DOM structure. `refresh()` fills the columns with event cards using `DataLayer.getEventsForDay()` for each day of the week.

## iOS 12 Compliance

Same rules as month view refactor:
- CSS: `-webkit-flex` everywhere, no gap, no grid, no vh, `-webkit-overflow-scrolling: touch`
- JS: only `var`/`function`, no const/let/arrow/template literals/optional chaining
- `escapeHtml()` on all user data in innerHTML (event titles, calendar names)

## Estimated File Growth

- `calendar.js`: 685 → ~870 lines (+185 for WeekRenderer + Controller changes)
- `tiles.css`: +~80 lines for week view + view switcher CSS
