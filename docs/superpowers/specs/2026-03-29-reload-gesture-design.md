# Long-Press Reload Gesture — Design Spec (v2.6.1)

## Overview

Add a long-press gesture on `#panel-title` that forces a hard reload of the dashboard. Targets iOS 12+ (iPad Air 2) where cache-clearing is laborious. Desktop mouse support included.

---

## Problem

On iPad iOS 12, clearing the browser cache requires navigating to Settings → Safari → Clear History and Website Data — a multi-step process that disrupts kiosk usage. When static assets are stale (e.g., after a version update), there is no in-app way to force a reload.

---

## Solution

Long-press (800ms) on the page title (`h1#panel-title`) triggers a forced reload via a cache-busting URL:

```
window.location.href = window.location.pathname + '?_r=' + Date.now()
```

The timestamp query parameter bypasses the browser cache without affecting any application logic.

---

## Interaction Design

| Phase | Visual |
|-------|--------|
| Press starts | `#panel-title` opacity → 0.4 (immediately) |
| 800ms elapsed | opacity → 1, 150ms pause, then reload |
| Press cancelled (finger moves > 10px or lifts early) | opacity → 1, no reload |

The opacity feedback communicates that a hold is in progress. The 150ms pause before reload gives the user a moment to register that the action completed.

---

## Event Handling

### Touch (iOS/mobile)

| Event | Action |
|-------|--------|
| `touchstart` | Start 800ms timer, set opacity 0.4 |
| `touchend` | Cancel timer, reset opacity |
| `touchmove` | If distance > 10px from start: cancel timer, reset opacity |

### Mouse (desktop)

| Event | Action |
|-------|--------|
| `mousedown` | Start 800ms timer, set opacity 0.4 |
| `mouseup` | Cancel timer, reset opacity |
| `mouseleave` | Cancel timer, reset opacity |

Context menu on long-press is suppressed: `contextmenu` event → `preventDefault()`.

---

## Implementation

### File: `retro-panel/app/static/js/app.js`

A single self-contained block added at the end of the DOMContentLoaded handler (or equivalent init function). No new files, no new modules.

**Constraints (iOS 12 legacy — mandatory):**
- `var` only — no `const`/`let`
- `function` keyword only — no arrow functions
- No optional chaining, no nullish coalescing
- IIFE pattern if isolated, otherwise inline in existing init

### Logic outline

```js
var titleEl = document.getElementById('panel-title');
var holdTimer = null;
var touchStartX = 0;
var touchStartY = 0;

function startHold() {
  titleEl.style.opacity = '0.4';
  holdTimer = setTimeout(function() {
    titleEl.style.opacity = '1';
    setTimeout(function() {
      window.location.href = window.location.pathname + '?_r=' + Date.now();
    }, 150);
  }, 800);
}

function cancelHold() {
  clearTimeout(holdTimer);
  holdTimer = null;
  titleEl.style.opacity = '1';
}

titleEl.addEventListener('touchstart', function(e) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  startHold();
});

titleEl.addEventListener('touchmove', function(e) {
  var dx = e.touches[0].clientX - touchStartX;
  var dy = e.touches[0].clientY - touchStartY;
  if (Math.sqrt(dx * dx + dy * dy) > 10) { cancelHold(); }
});

titleEl.addEventListener('touchend', cancelHold);
titleEl.addEventListener('contextmenu', function(e) { e.preventDefault(); });
titleEl.addEventListener('mousedown', startHold);
titleEl.addEventListener('mouseup', cancelHold);
titleEl.addEventListener('mouseleave', cancelHold);
```

---

## Version Bump

This is a UX-only change with no backend modifications. Version: **2.6.1**

- `retro-panel/config.yaml`: `version: "2.6.1"`
- `retro-panel/app/static/index.html`: all `?v=260` → `?v=261`
- `retro-panel/app/static/config.html`: all `?v=260` → `?v=261`

---

## Testing

Manual only (gesture interaction):

1. Open dashboard in desktop browser → long-press title with mouse → page reloads with `?_r=<timestamp>` in URL
2. Release before 800ms → no reload, opacity resets
3. Hold exactly 800ms → opacity returns to 1, brief pause, then reload
4. On iOS 12 Safari: long-press title → page reloads
5. Swipe on title (touchmove > 10px) → no reload

No automated tests required: no backend changes, no branching logic in JS beyond what is trivially readable.

---

## Out of Scope

- Visual indicator beyond opacity (no spinner, no toast)
- Configurable hold duration
- Any backend changes
- Any change to config.html
