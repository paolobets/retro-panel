# Kiosk Mode Removal + Theme Auto Fix — Design Spec (v2.7.0)

## Overview

Two independent fixes shipped as a single minor version:

1. **Remove `kiosk_mode`** — the option existed in the config schema but had no CSS effect. The concept of "kiosk" for this project means hiding the HA sidebar/header, which is handled externally via NemesisRE/kiosk-mode (HACS), not inside the add-on.
2. **Fix `theme: auto`** — the class `theme-auto` was applied to `<body>` but no CSS rule consumed it; the page always rendered dark regardless of OS preference.

---

## Part 1: Remove kiosk_mode

### Files Changed

#### `retro-panel/config.yaml`

Remove from `options`:
```yaml
kiosk_mode: true
```

Remove from `schema`:
```yaml
kiosk_mode: bool
```

#### `retro-panel/app/config/loader.py`

Remove field from `PanelConfig` dataclass (line 211):
```python
kiosk_mode: bool
```

Remove from `_load_options()` parsing (line 759):
```python
kiosk_mode=bool(raw.get("kiosk_mode", False)),
```

#### `retro-panel/app/api/panel_config.py`

Remove from API response dict (line 76):
```python
"kiosk_mode": config.kiosk_mode,
```

#### `retro-panel/app/static/js/app.js`

Remove from `applyConfig()` (line 47):
```js
if (config.kiosk_mode) { document.body.classList.add('kiosk'); }
```

### No Test Changes Required

`kiosk_mode` has no dedicated tests. The existing test suite continues to pass.

---

## Part 2: Fix theme auto

### File Changed

#### `retro-panel/app/static/css/tokens.css`

Add at the end of the file:

```css
/* Auto theme: follow OS/browser preference */
@media (prefers-color-scheme: light) {
  body.theme-auto {
    --c-bg:        #f0f2f5;
    --c-surface:   #ffffff;
    --c-surface-2: #e8eaed;
    --c-surface-3: #dde0e5;
    --c-text-pri:  #111111;
    --c-text-sec:  #555555;
  }
}
```

Identical token values to `body.theme-light`. When OS is in dark mode, `body.theme-auto` has no override — the `:root` dark defaults apply. When OS is in light mode, the media query fires and switches tokens.

`body.theme-dark` requires no dedicated CSS rule — the `:root` defaults are dark. The class is applied by `app.js` for semantic clarity but has no CSS counterpart (correct and intentional).

---

## Part 3: Documentation

### `retro-panel/DOCS.md`

1. Remove the **"Kiosk mode"** section (currently at line ~238) which describes the effects of `kiosk_mode: true`.
2. Add a new section **"Nascondere la UI di Home Assistant (Kiosk)"** after the theming section:

```markdown
## Nascondere la UI di Home Assistant (Kiosk)

Retro Panel non gestisce internamente la visibilità della barra laterale di HA.
Per nascondere sidebar e header di HA quando si accede al pannello da un tablet a muro,
si consiglia [kiosk-mode](https://github.com/NemesisRE/kiosk-mode) (HACS).

Una volta installato, aggiungere in `configuration.yaml`:

```yaml
kiosk_mode:
  template_settings:
    - template: "[[[ return location.href.includes('hassio/ingress'); ]]]"
      hide_sidebar: true
      hide_header: true
```

Questo nasconde sidebar e header HA **solo quando si è all'interno di una pagina ingress**,
lasciando la UI di HA normale su tutte le altre voci del menu.
```

### `retro-panel/docs/INSTALLATION.md`

1. Remove the `kiosk_mode` option block (lines ~233–242) from the configuration reference table.
2. Update the `theme` option description to clarify that `auto` follows the OS preference (iOS/Android dark/light mode).
3. Add a new optional section **"Kiosk Mode (opzionale) — Nascondere la UI di HA"** in the iPad/iOS setup area with the same YAML config above.

---

## Version Bump: 2.7.0

- `retro-panel/config.yaml`: `version: "2.7.0"`
- `retro-panel/app/static/index.html`: 20× `?v=261` → `?v=270`
- `retro-panel/app/static/config.html`: 5× `?v=261` → `?v=270`

---

## Testing

### Automated

Run existing test suite — must pass without changes:
```bash
py -m pytest tests/ --ignore=tests/test_handlers_entities.py -q
```

No new tests required: kiosk_mode removal is a pure deletion, theme auto is a CSS-only change with no backend logic.

### Manual

**Theme auto:**
1. Set `theme: auto` in add-on options
2. On a device in **light mode**: dashboard renders with light background (`#f0f2f5`)
3. On a device in **dark mode**: dashboard renders with dark background (`#0f0f0f`)
4. Set `theme: dark`: dark regardless of OS
5. Set `theme: light`: light regardless of OS

**kiosk_mode removal:**
1. Confirm `/panel-config` response no longer contains `kiosk_mode` key
2. Confirm `document.body.classList` never contains `kiosk`

---

## Out of Scope

- Any new CSS for `.kiosk` class — the class is removed entirely
- Hiding the Retro Panel sidebar or header — these are essential navigation elements
- Any changes to the HA ingress configuration
