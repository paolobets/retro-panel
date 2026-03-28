# Switch Tile Border Color — Design Spec

## Overview

Align the `tile-switch` ON state visual with mockup section 2 (`oggetti_definitivi.html`). The switch tile is missing a green border when ON — the only gap between the current implementation and the mockup.

---

## 1. Problem

`tiles.css` line 166 already defines:
```css
.tile-light.is-on { border-color: var(--c-light-on); }
```

The equivalent rule for switches is absent. When a `switch.*` entity is ON, the tile border stays `transparent` despite the toggle pill turning green and the tint appearing. The mockup specifies `border-color: var(--c-on)` when ON.

---

## 2. Fix

Add one CSS rule to `retro-panel/app/static/css/tiles.css`, immediately after the existing `.tile-light.is-on` rule (line 166):

```css
.tile-switch.is-on { border-color: var(--c-on); }
```

`var(--c-on)` = `#4caf50` (green), already used by toggle pill and icon color for switches.

The OFF state already defaults to `transparent` via the base `.tile { border: 1.5px solid transparent; }` rule — no additional rule needed.

---

## 3. Backend Status

Already complete — no changes needed:

| Layer | File | Status |
|---|---|---|
| Entity discovery | `picker_entities.py` | `switch` in `_ALLOWED_DOMAINS` ✅ |
| Area import | `picker_areas.py` | `switch` NOT in `_EXCLUDED_DOMAINS` ✅ |
| Service calls | `panel_service.py` | `switch` with `turn_on/off/toggle` ✅ |
| Layout type | `loader.py` | `switch.*` → `"switch"` ✅ |
| Hidden entities | both pickers | excluded via `hidden_by`/`disabled_by` ✅ |

---

## 4. Files Changed

| File | Change |
|---|---|
| `retro-panel/app/static/css/tiles.css` | Add `.tile-switch.is-on { border-color: var(--c-on); }` |

---

## 5. Constraints

- No JS changes — `switch.js` already adds `is-on` class correctly
- No Python changes — backend fully operational
- CSS variable `--c-on` already defined in the design system

---

## 6. Testing

- Visual: switch tile ON → green border appears, OFF → no border
- Visual: presa/outlet tile (same component) → same behaviour
- Python tests (`pytest retro-panel/tests/`) still pass (no backend changes)
