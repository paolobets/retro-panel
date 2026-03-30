# Kiosk Mode Removal + Theme Auto Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unused `kiosk_mode` option from the entire stack, fix `theme: auto` so it actually follows OS dark/light preference, and update user-facing docs accordingly.

**Architecture:** Pure deletion + one CSS media query addition. No new abstractions. Backend (loader.py + panel_config.py) loses one field; frontend (app.js) loses one line; tokens.css gains a `@media (prefers-color-scheme: light)` block; docs lose the kiosk_mode option entry and gain a Kiosk Mode (HACS) section.

**Tech Stack:** Python 3.11 (dataclass), aiohttp, Vanilla JS (var/function, iOS 12 safe), CSS custom properties.

---

## File Map

| File | Change |
|------|--------|
| `retro-panel/config.yaml` | Remove `kiosk_mode` from options + schema; bump version to 2.7.0 |
| `retro-panel/app/config/loader.py` | Remove `kiosk_mode` field from `PanelConfig` dataclass and parsing |
| `retro-panel/app/api/panel_config.py` | Remove `"kiosk_mode"` from API response dict |
| `retro-panel/app/static/js/app.js` | Remove `if (config.kiosk_mode)` line from `applyConfig` |
| `retro-panel/app/static/css/tokens.css` | Add `@media (prefers-color-scheme: light) { body.theme-auto { ... } }` |
| `retro-panel/app/static/index.html` | 20× `?v=261` → `?v=270` |
| `retro-panel/app/static/config.html` | 5× `?v=261` → `?v=270` |
| `retro-panel/DOCS.md` | Remove kiosk_mode row + section; add HA Kiosk Mode section |
| `retro-panel/docs/INSTALLATION.md` | Remove kiosk_mode option block; update theme description; add Kiosk Mode section |

---

### Task 1: Remove kiosk_mode + fix theme auto + version bump 2.7.0

**Files:**
- Modify: `retro-panel/config.yaml`
- Modify: `retro-panel/app/config/loader.py`
- Modify: `retro-panel/app/api/panel_config.py`
- Modify: `retro-panel/app/static/js/app.js`
- Modify: `retro-panel/app/static/css/tokens.css`
- Modify: `retro-panel/app/static/index.html`
- Modify: `retro-panel/app/static/config.html`

No new tests are required — kiosk_mode has no dedicated tests, and theme auto is CSS-only.

---

- [ ] **Step 1: Remove kiosk_mode from config.yaml and bump version**

Current `retro-panel/config.yaml` options/schema block looks like:

```yaml
options:
  ...
  theme: "dark"
  kiosk_mode: true
  ...
schema:
  ...
  theme: "list(dark|light|auto)"
  kiosk_mode: bool
  ...
```

Make it:

```yaml
options:
  ...
  theme: "dark"
  ...
schema:
  ...
  theme: "list(dark|light|auto)"
  ...
```

Also change `version: "2.6.1"` → `version: "2.7.0"`.

---

- [ ] **Step 2: Remove kiosk_mode from PanelConfig dataclass in loader.py**

In `retro-panel/app/config/loader.py`, the `PanelConfig` dataclass at line ~211 contains:

```python
    kiosk_mode: bool
```

Delete that line entirely. The field order after deletion:

```python
    ha_url: str
    ha_token: str
    title: str
    theme: str
    refresh_interval: int
    header_sensors: List[HeaderSensor] = field(default_factory=list)
    ...
```

---

- [ ] **Step 3: Remove kiosk_mode from _load_options() in loader.py**

In `retro-panel/app/config/loader.py`, the instantiation at line ~759 contains:

```python
        kiosk_mode=bool(raw.get("kiosk_mode", False)),
```

Delete that line. The surrounding lines remain unchanged:

```python
        theme=raw.get("theme", "dark"),
        refresh_interval=refresh_interval,
```

---

- [ ] **Step 4: Remove kiosk_mode from panel_config.py API response**

In `retro-panel/app/api/panel_config.py`, the payload dict at line ~76 contains:

```python
        "kiosk_mode": config.kiosk_mode,
```

Delete that line. Before and after:

```python
        "title": config.title,
        "theme": config.theme,
        "refresh_interval": config.refresh_interval,
```

---

- [ ] **Step 5: Remove kiosk_mode from applyConfig in app.js**

In `retro-panel/app/static/js/app.js`, `applyConfig` at line ~47 contains:

```js
    if (config.kiosk_mode) { document.body.classList.add('kiosk'); }
```

Delete that line. The function body becomes:

```js
  function applyConfig(config) {
    document.body.classList.remove('theme-dark', 'theme-light', 'theme-auto');
    document.body.classList.add('theme-' + (config.theme || 'dark'));

    var titleEl = DOM.qs('#panel-title');
    if (titleEl) {
      titleEl.innerHTML = 'Retro <span style="color:var(--c-accent)">PANEL</span>';
    }
    document.title = config.title || 'Retro Panel';
    // Reload gesture: long-press title to force hard reload
    initReloadGesture();
    // Colonne: gestite interamente dai media query CSS su --tile-cols
  }
```

---

- [ ] **Step 6: Add theme-auto media query to tokens.css**

In `retro-panel/app/static/css/tokens.css`, append at the very end of the file:

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

The full file after this addition ends with:

```css
/* Light theme */
body.theme-light {
  --c-bg:        #f0f2f5;
  --c-surface:   #ffffff;
  --c-surface-2: #e8eaed;
  --c-surface-3: #dde0e5;
  --c-text-pri:  #111111;
  --c-text-sec:  #555555;
}

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

---

- [ ] **Step 7: Update cache-buster in index.html**

In `retro-panel/app/static/index.html`, replace all 20 occurrences of `?v=261` with `?v=270`.

Verify:
```bash
grep -c "?v=270" retro-panel/app/static/index.html
```
Expected: `20`

---

- [ ] **Step 8: Update cache-buster in config.html**

In `retro-panel/app/static/config.html`, replace all 5 occurrences of `?v=261` with `?v=270`.

Verify:
```bash
grep -c "?v=270" retro-panel/app/static/config.html
```
Expected: `5`

---

- [ ] **Step 9: Run the test suite**

```bash
cd retro-panel && py -m pytest tests/ --ignore=tests/test_handlers_entities.py -q
```

Expected: `89 passed` (no new tests, no regressions).

---

- [ ] **Step 10: Run the pre-push release check**

```bash
cd C:\Work\Sviluppo\retro-panel && bash scripts/check_release.sh
```

Expected output:
```
config.yaml version : 2.7.0
Expected cache-buster: ?v=270
All checks passed — version 2.7.0, cache-buster ?v=270
```

---

- [ ] **Step 11: Commit**

```bash
git add retro-panel/config.yaml \
        retro-panel/app/config/loader.py \
        retro-panel/app/api/panel_config.py \
        retro-panel/app/static/js/app.js \
        retro-panel/app/static/css/tokens.css \
        retro-panel/app/static/index.html \
        retro-panel/app/static/config.html
git commit -m "feat: remove kiosk_mode, fix theme auto (v2.7.0)"
```

---

### Task 2: Update documentation

**Files:**
- Modify: `retro-panel/DOCS.md`
- Modify: `retro-panel/docs/INSTALLATION.md`

No tests required for documentation changes.

---

- [ ] **Step 1: Remove kiosk_mode row from the options table in DOCS.md**

In `retro-panel/DOCS.md` around line 28, the options table contains:

```markdown
| **Kiosk Mode** | Disables text selection (recommended) | `true` |
```

Delete that row entirely.

---

- [ ] **Step 2: Remove the "Kiosk mode" section from DOCS.md**

In `retro-panel/DOCS.md` around line 236, the section reads:

```markdown
## Kiosk mode

When `kiosk_mode: true` (default):

- Text selection is disabled — prevents accidental highlighting on long-press.
- Settings are still accessible via the ⚙ icon in the sidebar (only on `/config` URL).
- iOS "Add to Home Screen" meta tags are active. In Safari, tap **Share → Add to Home Screen** to launch the panel full-screen with no browser UI.

---
```

Replace it with a new section about hiding the HA UI using kiosk-mode (HACS):

```markdown
## Nascondere la UI di Home Assistant (Kiosk)

Retro Panel non gestisce la visibilità della barra laterale di HA.
Per nascondere sidebar e header di HA su un tablet a muro, usa
[kiosk-mode](https://github.com/NemesisRE/kiosk-mode) (installabile via HACS).

Una volta installato, aggiungi in `configuration.yaml`:

```yaml
kiosk_mode:
  template_settings:
    - template: "[[[ return location.href.includes('hassio/ingress'); ]]]"
      hide_sidebar: true
      hide_header: true
```

Questo nasconde sidebar e header HA **solo quando sei all'interno di una pagina ingress**,
lasciando la UI di HA normale su tutte le altre voci del menu.

---
```

---

- [ ] **Step 3: Remove the kiosk_mode option block from INSTALLATION.md**

In `retro-panel/docs/INSTALLATION.md` around line 233, the block reads:

```markdown
#### `kiosk_mode` (optional)
**Description**: Enables kiosk mode for wall-mounted displays.

**Default**: `true` (enabled)

**Effects when enabled**:
- Text selection is disabled (prevents accidental highlighting on long-press)
- Perfect for touch-only displays where accidental text selection is annoying
- Settings are still accessible via the ⚙ icon in the sidebar (at `/config` URL)

**Disable if**: You want to enable text selection on the display (e.g., for debugging)
```

Delete the entire block. The `#### refresh_interval (optional)` block that follows remains unchanged.

---

- [ ] **Step 4: Update the theme option description in INSTALLATION.md**

In `retro-panel/docs/INSTALLATION.md`, find the `theme` option description. It currently says:

```markdown
- `auto`: Automatically switches based on device's system settings (iOS/Android)
```

Replace with:

```markdown
- `auto`: Follows the OS dark/light preference (`prefers-color-scheme`). On iOS, this reflects the system appearance set in Settings → Display & Brightness.
```

---

- [ ] **Step 5: Add Kiosk Mode section to INSTALLATION.md**

In `retro-panel/docs/INSTALLATION.md`, find the `## iPad and iOS 12+ Kiosk Setup` section (around line 308). Insert the following new section **immediately before** that heading:

```markdown
## Kiosk Mode — Nascondere la UI di HA (opzionale)

Se usi Retro Panel su un tablet a muro e vuoi nascondere la barra laterale e l'header
di Home Assistant, puoi usare [kiosk-mode](https://github.com/NemesisRE/kiosk-mode)
(installabile via HACS).

Una volta installato, aggiungi in `configuration.yaml`:

```yaml
kiosk_mode:
  template_settings:
    - template: "[[[ return location.href.includes('hassio/ingress'); ]]]"
      hide_sidebar: true
      hide_header: true
```

Questo attiva il kiosk solo sulla pagina ingress di Retro Panel (e di qualsiasi altro
add-on con ingress), lasciando la UI di HA normale sulle altre pagine.

> **Nota**: Per limitarlo al solo Retro Panel, sostituisci `hassio/ingress` con lo slug
> specifico dell'add-on (visibile nell'URL quando apri il pannello da HA).

---

```

---

- [ ] **Step 6: Update CHANGELOG and ROADMAP**

In `retro-panel/CHANGELOG.md`, add at the top (after the header block, before the `## [2.6.1]` entry):

```markdown
## [2.7.0] — 2026-03-30

### Changed
- `theme: auto` ora segue correttamente la preferenza del sistema operativo (`prefers-color-scheme: light`) — in precedenza il pannello restava sempre dark
- Rimossa l'opzione `kiosk_mode` dalla configurazione add-on: non aveva effetti visivi e il kiosk su HA si gestisce esternamente con [kiosk-mode](https://github.com/NemesisRE/kiosk-mode) (HACS)

### Docs
- Aggiunta guida per nascondere sidebar/header HA con kiosk-mode (HACS) in DOCS.md e INSTALLATION.md

---

```

In `retro-panel/docs/ROADMAP.md`, add the v2.7.0 section after the v2.6 section:

```markdown
## v2.7 - Theme Fix & Kiosk Cleanup (Released 2026-03-30)

**Status**: RELEASED (current stable: v2.7.0)

**Release Goal**: Fix `theme: auto` CSS, remove the non-functional `kiosk_mode` option, and document the HACS kiosk-mode integration.

### Completed Features

- [x] `theme: auto` — aggiunto `@media (prefers-color-scheme: light)` in `tokens.css`; ora segue la preferenza OS
- [x] Rimossa opzione `kiosk_mode` da config, backend, API e frontend
- [x] Documentazione: guida kiosk-mode (HACS) aggiunta in DOCS.md e INSTALLATION.md

---
```

Also update the release schedule table: change the v2.6.1 row from `current stable` and add v2.7.0:

```markdown
| v2.6.1 | Released | 2026-03-30 | Completed |
| v2.7.0 | Released | 2026-03-30 | Completed — current stable |
```

---

- [ ] **Step 7: Commit**

```bash
git add retro-panel/DOCS.md \
        retro-panel/docs/INSTALLATION.md \
        retro-panel/CHANGELOG.md \
        retro-panel/docs/ROADMAP.md
git commit -m "docs: remove kiosk_mode, add HACS kiosk-mode guide, update theme auto description (v2.7.0)"
```

---

### Post-Implementation Checklist (before git push)

Per CLAUDE.md §2:

- [ ] Run `py -m pytest tests/ --ignore=tests/test_handlers_entities.py -q` — must pass
- [ ] Run `bash scripts/check_release.sh` — must show version 2.7.0 and cache-buster ?v=270
- [ ] `git push`
- [ ] Create GitHub release tag v2.7.0
