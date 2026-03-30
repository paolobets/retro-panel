# Long-Press Reload Gesture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an 800ms long-press gesture on `#panel-title` that forces a hard reload via a cache-busting URL, then bump the version to 2.6.1.

**Architecture:** A self-contained block added inside the existing IIFE in `app.js`, after the `applyConfig` function. Touch and mouse events are wired on `#panel-title`. No new files, no backend changes. The reload URL appends `?_r=<timestamp>` to bypass the browser cache.

**Tech Stack:** Vanilla JS (var + function, iOS 12 safe), aiohttp backend (unchanged), YAML config.

---

## File Map

| File | Change |
|------|--------|
| `retro-panel/app/static/js/app.js` | Add `initReloadGesture()` function + call it from `applyConfig` |
| `retro-panel/config.yaml` | `version: "2.6.0"` → `"2.6.1"` |
| `retro-panel/app/static/index.html` | 20× `?v=260` → `?v=261` |
| `retro-panel/app/static/config.html` | 5× `?v=260` → `?v=261` |

---

### Task 1: Long-Press Gesture in app.js + Version Bump

**Files:**
- Modify: `retro-panel/app/static/js/app.js`
- Modify: `retro-panel/config.yaml`
- Modify: `retro-panel/app/static/index.html`
- Modify: `retro-panel/app/static/config.html`

No automated tests are required for this task — the spec explicitly excludes them (gesture interaction only, no branching logic, no backend changes). Manual verification steps are provided at the end.

---

- [ ] **Step 1: Read the current end of app.js**

Open `retro-panel/app/static/js/app.js` and locate the bottom of the file. The IIFE closes with:

```js
  // Avvia al caricamento
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

}());
```

The new `initReloadGesture` function goes **before** the `// Avvia al caricamento` comment.

---

- [ ] **Step 2: Add `initReloadGesture` function to app.js**

Insert the following block immediately **before** the `// Avvia al caricamento` comment (i.e., between the last existing function and the boot wiring):

```js
  // ---------------------------------------------------------------------------
  // initReloadGesture — long-press #panel-title forces a hard reload
  // ---------------------------------------------------------------------------
  function initReloadGesture() {
    var titleEl = document.getElementById('panel-title');
    if (!titleEl) { return; }

    var holdTimer = null;
    var touchStartX = 0;
    var touchStartY = 0;

    function startHold() {
      titleEl.style.opacity = '0.4';
      holdTimer = setTimeout(function () {
        titleEl.style.opacity = '1';
        setTimeout(function () {
          window.location.href = window.location.pathname + '?_r=' + Date.now();
        }, 150);
      }, 800);
    }

    function cancelHold() {
      clearTimeout(holdTimer);
      holdTimer = null;
      titleEl.style.opacity = '1';
    }

    titleEl.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      startHold();
    });

    titleEl.addEventListener('touchmove', function (e) {
      var dx = e.touches[0].clientX - touchStartX;
      var dy = e.touches[0].clientY - touchStartY;
      if (Math.sqrt(dx * dx + dy * dy) > 10) { cancelHold(); }
    });

    titleEl.addEventListener('touchend', cancelHold);

    titleEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    titleEl.addEventListener('mousedown', startHold);
    titleEl.addEventListener('mouseup', cancelHold);
    titleEl.addEventListener('mouseleave', cancelHold);
  }
```

---

- [ ] **Step 3: Call `initReloadGesture` from `applyConfig`**

In `applyConfig`, after the `document.title` line, add:

```js
    // Reload gesture: long-press title to force hard reload
    initReloadGesture();
```

The full end of `applyConfig` should look like:

```js
    document.title = config.title || 'Retro Panel';
    // Reload gesture: long-press title to force hard reload
    initReloadGesture();
    // Colonne: gestite interamente dai media query CSS su --tile-cols
  }
```

---

- [ ] **Step 4: Bump version in config.yaml**

In `retro-panel/config.yaml`, change:

```yaml
version: "2.6.0"
```

to:

```yaml
version: "2.6.1"
```

---

- [ ] **Step 5: Update cache-buster in index.html**

In `retro-panel/app/static/index.html`, replace all 20 occurrences of `?v=260` with `?v=261`.

Run to verify:

```bash
grep -c "?v=261" retro-panel/app/static/index.html
```

Expected output: `20`

---

- [ ] **Step 6: Update cache-buster in config.html**

In `retro-panel/app/static/config.html`, replace all 5 occurrences of `?v=260` with `?v=261`.

Run to verify:

```bash
grep -c "?v=261" retro-panel/app/static/config.html
```

Expected output: `5`

---

- [ ] **Step 7: Run the test suite**

```bash
cd retro-panel && py -m pytest tests/ --ignore=tests/test_handlers_entities.py -q
```

Expected: all tests pass (currently 89 passed). No new tests were added (spec excludes automated tests for this task).

---

- [ ] **Step 8: Manual verification (desktop)**

Open the dashboard in a desktop browser. Open DevTools → Network tab.

1. Click and hold on the title "Retro PANEL" for less than 800ms → release. Confirm: title opacity briefly dims then returns to 1; no reload occurs.
2. Click and hold on the title for more than 800ms. Confirm: opacity dims → returns to 1 → page reloads with `?_r=<timestamp>` visible in the URL bar.

---

- [ ] **Step 9: Commit**

```bash
git add retro-panel/app/static/js/app.js \
        retro-panel/config.yaml \
        retro-panel/app/static/index.html \
        retro-panel/app/static/config.html
git commit -m "feat: add long-press reload gesture on panel title (v2.6.1)"
```

---

### Post-Implementation Checklist (before git push)

Per CLAUDE.md §2:

- [ ] Update `docs/ROADMAP.md` — mark long-press reload as released in v2.6.1, update stable version reference
- [ ] Run `py -m pytest tests/ --ignore=tests/test_handlers_entities.py -q` — must pass
- [ ] Confirm `scripts/check_release.sh` passes (version + cache-buster alignment)
- [ ] `git push`
