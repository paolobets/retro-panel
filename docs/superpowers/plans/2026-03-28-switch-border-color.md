# Switch Border Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add green border to `tile-switch` when ON, matching mockup section 2 (`oggetti_definitivi.html`).

**Architecture:** Single CSS rule in `tiles.css` mirroring the existing light pattern. No JS or Python changes required.

**Tech Stack:** CSS custom properties, existing `is-on` class applied by `switch.js`.

---

### Task 1: Add switch ON border color to tiles.css

**Files:**
- Modify: `retro-panel/app/static/css/tiles.css:166`

**Context:** `tiles.css` line 166 already has:
```css
/* Light ON: amber */
.tile-light.is-on { border-color: var(--c-light-on); }
```

The switch equivalent is missing. `switch.js` already adds the `is-on` class via `tile.classList.add('is-on')` in `updateTile` — no JS change needed.

- [ ] **Step 1: Read the current tiles.css around line 166**

Run:
```bash
grep -n "tile-light.is-on\|tile-switch" retro-panel/app/static/css/tiles.css
```

Expected output includes:
```
166:.tile-light.is-on { border-color: var(--c-light-on); }
...
233:.tile-switch.is-on .tile-icon { color: var(--c-on); }
```

Confirm line 166 is the `.tile-light.is-on` border rule.

- [ ] **Step 2: Add the rule immediately after line 166**

In `retro-panel/app/static/css/tiles.css`, after line 166, insert:

```css
.tile-switch.is-on { border-color: var(--c-on); }
```

The block should look like:
```css
/* Light ON: amber */
.tile-light.is-on { border-color: var(--c-light-on); }
/* Switch ON: green */
.tile-switch.is-on { border-color: var(--c-on); }
```

- [ ] **Step 3: Verify Python tests still pass**

Run:
```bash
cd retro-panel
py -m pytest tests/test_loader_v5.py tests/test_save_validation.py -v
```

Expected: all tests pass (no backend changes, just verifying nothing is broken).

- [ ] **Step 4: Commit**

```bash
git add retro-panel/app/static/css/tiles.css
git commit -m "fix: add green border to switch tile when ON

Mirrors the existing .tile-light.is-on border pattern.
Brings switch tile visual in line with mockup section 2."
```
