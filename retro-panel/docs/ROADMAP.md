# Retro Panel Roadmap

## Version Strategy

Retro Panel follows semantic versioning (MAJOR.MINOR.PATCH):
- **MAJOR** version for breaking changes (config schema incompatible, API changes)
- **MINOR** version for new features (backward compatible)
- **PATCH** version for bug fixes and performance improvements

---

## v2.0 - Complete Refactor (Released 2026-03-27)

**Status**: RELEASED

**Release Goal**: Complete frontend/backend refactor with layout_type system, bottom sheet controls, and two-URL architecture. Focus on clean separation between kiosk dashboard and admin configuration.

### Completed Features

**Core Refactor**:
- [x] layout_type system: Backend computes entity type, frontend renders via COMPONENT_MAP
- [x] Two-URL architecture: `/` (dashboard) and `/config` (admin interface)
- [x] Bottom sheet for light controls (brightness, color temperature, hue)
- [x] CSS redesign: tokens.css, layout.css, tiles.css, bottom-sheet.css
- [x] Triple-lock tile dimensions (immutable heights)
- [x] iOS 12 CSS constraints (no gap/inset/100dvh)
- [x] Data structure v2: overview, rooms, scenarios, cameras

**Entity Type Support (15 layout_types)**:
- [x] `light` — toggle, bottom sheet controls
- [x] `switch` — toggle on/off
- [x] `sensor_temperature` — read-only temperature
- [x] `sensor_humidity` — read-only humidity
- [x] `sensor_co2` — read-only CO₂
- [x] `sensor_battery` — read-only battery %
- [x] `sensor_energy` — read-only power/energy
- [x] `sensor_generic` — read-only generic sensor
- [x] `binary_door` — door/window status
- [x] `binary_motion` — motion detector
- [x] `binary_standard` — generic binary sensor
- [x] `alarm` — PIN keypad with arm/disarm
- [x] `camera` — MJPEG live stream
- [x] `scenario` — scene/script/automation trigger
- [x] `energy_flow` — power flow visualization

**Configuration Tabs (4 total)**:
- [x] Overview — entities on home screen
- [x] Rooms — room-based organization with sections
- [x] Scenarios — scene/script/automation shortcuts
- [x] Cameras — camera feed management
- [x] Removed: "Header" tab (no longer exists)

**Breaking Changes**:
- [x] `columns` config option removed (CSS media queries)
- [x] `header_sensors` removed entirely
- [x] `display_mode` field removed from entity config
- [x] `light-sheet.js` replaced by `bottom-sheet.js`
- [x] CSS state classes: `state-on/off/unavailable` → `is-on/is-off/is-unavail`
- [x] Tile classes: `tile entity-light` → `tile tile-light`
- [x] Config format version bumped to 2

**Testing**:
- [x] 22 unit tests all passing
- [x] iOS 12 compatibility verified
- [x] REST polling fallback tested
- [x] WebSocket reconnection tested
- [x] Manual functional testing on real devices

**Documentation**:
- [x] DOCS.md updated (user guide)
- [x] README.md updated (documentation index)
- [x] ARCHITECTURE.md updated (v2.0 design)
- [x] API.md updated (v2.0 endpoints)
- [x] DEVELOPMENT.md updated (layout_type system)
- [x] PROJECT.md updated (v2.0 status)
- [x] INSTALLATION.md updated (two URLs)
- [x] TESTING.md updated (v2.0 test plan)

### v2.0 Definition of Done (COMPLETED)

- [x] All 15 entity layout_types implemented and tested
- [x] Bottom sheet for light control working
- [x] Two-URL architecture functional (`/` and `/config`)
- [x] Configuration tabs: Overview, Rooms, Scenarios, Cameras
- [x] Triple-lock tile dimensions immutable
- [x] iOS 12 CSS constraints enforced (no gap/inset/100dvh)
- [x] All breaking changes documented
- [x] Migration guide provided for v1.x users
- [x] 22 unit tests passing
- [x] Zero console errors on iOS 12+
- [x] Page load < 2 seconds on 4G
- [x] Service calls < 1 second latency
- [x] Memory < 100 MB on Pi 3B+
- [x] Configuration file migrated to v2 format
- [x] Release notes document all changes

### Known Limitations (v2.0)

- **No Climate Control**: Thermostat entities not yet supported (v2.1+)
- **No Media Playback**: Media player entities not supported (v2.1+)
- **No Custom Themes**: Only default light/dark colors (future)
- **No History Charts**: No entity state history or charts (future)
- **No Offline Mode**: Requires internet connection (future)

---

## v2.7 - Theme Fix & Kiosk Cleanup (Released 2026-03-30)

**Status**: RELEASED (current stable: v2.7.0)

**Release Goal**: Fix `theme: auto` CSS, remove the non-functional `kiosk_mode` option, and document the HACS kiosk-mode integration.

### Completed Features

- [x] `theme: auto` — aggiunto `@media (prefers-color-scheme: light)` in `tokens.css`; ora segue la preferenza OS
- [x] Rimossa opzione `kiosk_mode` da config, backend, API e frontend
- [x] Documentazione: guida kiosk-mode (HACS) aggiunta in DOCS.md e INSTALLATION.md

---

## v2.8 - Sensor Tile v4 Redesign + Post-Release Fixes (Released 2026-03-30)

**Status**: RELEASED (current stable: v2.8.5)

**Release Goal**: Complete visual redesign of all sensor and binary sensor tiles to match mockup v4. Unified OFF/unavailable state visual treatment across all device types. Post-release stabilization of icons, layout routing, sidebar, and alarm tile.

### Completed Features

- [x] Sensor tiles v4: 22×22px icon-only bubble, `.s-*` state class on tile root
- [x] Unified color pattern: `border-color` + `.bubble { color }` always same hex value
- [x] Separate `.unit` span (10px muted) vs `.val` (14px bold)
- [x] Binary sensor inactive state: `.s-off` → gray `#6b7280` border + icon
- [x] Light/switch OFF state: gray `#6b7280` border + icon (was transparent)
- [x] Critical pulse animation: `s-co2-critical`, `s-smoke-on`, `s-gas-critical`
- [x] All 17 sensor layout_types + 9 binary sensor layout_types covered
- [x] Removed ~50 `sri-*`/`srt-*` CSS classes → replaced by ~65 `.s-*` classes

### Post-Release Fixes (v2.8.1–v2.8.5)

- [x] HA-first icon resolution: `sensor.js` legge `attrs.icon` e `attrs.device_class` dalla risposta live HA — elimina la necessità di configurare manualmente ogni entità
- [x] `_computeLayoutFromDC()` in sensor.js: mirror JS completo di `_compute_layout_type` loader.py
- [x] Icona illuminance: chiave MDI corretta `brightness5` (era `brightness-5`)
- [x] Tile sensore su iPad landscape: 4 per riga a ≥1024px
- [x] Alarm tile CSS completo: keypad, PIN display, state badge, action buttons
- [x] Alarm `layout_type` non più sovrascrivibile da `visual_type` stale per domain-locked types
- [x] Sidebar collapse toggle: `#sidebar.collapsed` CSS + icon `☰/›`
- [x] Fix rooms height: `sidebar-spacer` non compete più con `#sidebar-nav`
- [x] Nav restyling: touch target 44px, active indicator blu, scrollbar sottile

---

## v2.6 - Binary Sensor Improvements & Kiosk UX (Released 2026-03-30)

**Status**: RELEASED

**Release Goal**: Fix architectural bugs in the binary sensor subsystem, add four new binary layout types, and introduce a long-press reload gesture for kiosk deployments.

### Completed Features

**v2.6.0 — Binary Sensor Improvements**:
- [x] `loader.py` is now the single source of truth for `layout_type` — `sensor.js` no longer reads `attrs.device_class` in the render path
- [x] Bug fix: `window` → `binary_window` (was incorrectly `binary_door`)
- [x] Bug fix: `occupancy`/`presence` → `binary_presence` (was `binary_motion`)
- [x] Bug fix: `smoke`/`gas`/`carbon_monoxide` → `binary_smoke` (was `binary_standard`)
- [x] New: `binary_smoke` layout type — critical visual state (`srt-critical`/`sri-critical`)
- [x] New: `binary_moisture` layout type — alert state
- [x] New: `binary_lock` layout type — alert state
- [x] New: `binary_vibration` layout type — alert state
- [x] 15 TDD tests covering all binary sensor mappings

**v2.6.1 — Long-press Reload Gesture**:
- [x] 800ms long-press on `#panel-title` triggers hard reload via `?_r=<timestamp>` cache-buster
- [x] Touch (iOS) + mouse (desktop) support, opacity feedback, drift cancellation
- [x] `touchcancel` guard for WebKit scroll hand-off edge case
- [x] Duplicate listener guard via `dataset.reloadGestureInit`
- [x] `-webkit-user-select: none` on `#panel-title` to prevent text selection

---

## v2.3 - Icon System, Light Subtypes & Stability (Released 2026-03-29)

**Status**: RELEASED

**Release Goal**: Complete MDI icon set, light layout subtypes, area-fallback for device-level areas, and CI pipeline hardening. Followed by a focused bugfix pass (v2.3.2).

### Completed Features

- [x] Full MDI icon set (~7 447 icons) via `@mdi/js` — replaces previous 124-icon subset
- [x] Icon picker rewritten: virtual scroll, recently-used row, debounced search, result count
- [x] Light layout subtypes: `light_standard`, `light_dimmer`, `light_rgb`, `light_legacy`
- [x] Mode-aware tile and bottom sheet variant per light subtype
- [x] `picker_areas`: area resolved at device level when entity has no direct area assignment
- [x] Switch default icon changed to `power` (⏻)
- [x] Cache-buster `?v=231` on all static assets in `config.html`
- [x] CI: `scripts/check_release.sh` + `.githooks/pre-push` hook
- [x] Bug audit: critical/high severity fixes — backend, drag listeners, CSS layout (v2.3.2)
- [x] Cloudflare tag handling corrected in release pipeline (v2.3.2)

---

## v2.1 - Extended Entity Support (Released 2026-03-28)

**Status**: RELEASED

**Release Goal**: Add support for additional entity types and advanced features.

### Completed Features

- [x] Atomic write for `entities.json` (no corruption on container restart during save)
- [x] Camera `refresh_interval` validation — non-numeric value falls back to 10 s
- [x] Entity ID validation regex accepts digits in domain part
- [x] Section count limits enforced on save (HTTP 400 if exceeded)
- [x] v4 `overview.items[]` migration to default section on config page open
- [x] ES2017-compatible equivalents replace optional chaining / nullish coalescing in `config.js`
- [x] Orphaned drag event listeners cleaned up on list re-render
- [x] `#disconnect-banner` moved outside `#panel` flex container (correct full-width on iOS Safari)
- [x] Touch targets for `.bs-close` and `#sidebar-toggle` increased to 44×44 px (Apple HIG)

**Timeline**: Released 2026-03-28

---

## v2.9 - Energy Card v2 + Alarm Tile (Released 2026-03-30 → 2026-04-03)

**Status**: RELEASED (current stable: v2.9.14)

### v2.9.0 — Energy Card v2 (2026-03-30)

- [x] Energy Card v2 — Design G: semaforo go/caution/stop/idle
- [x] 7 entità: solar, home, battery_soc, battery_charge, battery_discharge, grid_import, grid_export
- [x] Wizard a 7 step in /config
- [x] Progress bar: % consumo solare
- [x] Metriche secondarie: SOC batteria + barra, grid prelievo/immissione
- [x] iOS 12 safe (var, no arrow functions, no gap)

### v2.9.1 — Camera Tile Grid + Lightbox (2026-04-02)

- [x] Griglia camera: 4 colonne su tablet/desktop, 2 colonne su phone
- [x] Lightbox fullscreen: tap su tile → overlay con snapshot + nome + dot live
- [x] iOS 12 safe: aspect-ratio 16:9 via padding-top 56.25% hack, no CSS grid

### v2.9.2 — Energy Semaforo Fix (2026-04-02)

- [x] Verde solo se solar > home + 30W (surplus solare reale)
- [x] Giallo batteria: batteria copre casa, nessun prelievo rete
- [x] Giallo solare≈casa: solare ≈ consumo, batteria in standby

### v2.9.3 — Porta 7654 Diretta (2026-04-02)

- [x] Porta 7654 esposta direttamente per accesso bypass HA login
- [x] `allowed_direct_ips` CIDR whitelist in options
- [x] Necessario per dispositivi legacy che non supportano il login HA moderno

### v2.9.4 — Security Hardening (2026-04-03)

- [x] IP whitelist CIDR per porta diretta
- [x] CSP: no unsafe-inline su script-src
- [x] Rate limiting: max 10 service call/sec per IP
- [x] Alarm brute-force: 3 tentativi/30s, lockout 60s
- [x] Touch target 44px su tutti i controlli interattivi

### v2.9.5 — Energy Barre Colorate (2026-04-03)

- [x] Barre colorate semantiche per sensori energy/power
- [x] Label 12px/600, timestamp aggiornamento

### v2.9.6–v2.9.9 — Alarm Tab Config + Bug Fix (2026-04-03)

- [x] Tab Allarmi in /config: picker entity + sensori zona
- [x] Fix layout alarm tab: classi CSS corrette
- [x] Tile allarme dinamico: code_format, supported_features, PIN tastiera
- [x] Fix: pulsante Fatto in pickers, sezioni visibili all'avvio, tema chiaro

### v2.9.10–v2.9.11 — Alarm State Sync (2026-04-03)

- [x] Fix tile alarm: spinner arming/disarming, stile pulsanti arm/disarm
- [x] all_entity_ids include alarm panel + zone sensors (fix stato sempre SCONOSCIUTO)
- [x] WebSocket state_changed filtra correttamente entità allarme

### v2.9.12 — Alarm Tile Rewrite — Bug Critici (2026-04-03)

- [x] Fix strutturale: pinArea spostata fuori da disarmSection (era dentro display:none)
- [x] Fix: chip modalità ora arma direttamente via callService (non solo selezione visuale)
- [x] Fix CSS: barClass allineata a `s-*` (era `alarm-bar-*` non esistenti)
- [x] Fix CSS: chip-selected invece di alarm-mode-chip-selected
- [x] Fix: badge ristrutturato con dot + text separati

### v2.9.13 — Fix 403 Service Call (2026-04-03)

- [x] Fix critico: panel_service.py usava config.entities invece di config.all_entity_ids
- [x] Ogni chiamata arm/disarm riceveva 403 silenziosamente
- [x] Test documentazione invariante: alarm in all_entity_ids ma non in entities

### v2.9.14 — Alarm UX Redesign (2026-04-03)

- [x] Status bar: entity name in alto centrato (20px), badge stato sotto separato
- [x] Sub-label modalità armata: "Modalità: Casa/Fuori/Notte" quando armato
- [x] Mode chips: flex:1 full-width, min-height 52px, font 14px — WCAG-compliant
- [x] Hint dinamico: "Tocca per armare" vs "Seleziona modalità, poi inserisci il codice"
- [x] Confirm/disarm button: height 52px, font 15px, transform 0.1s feedback tattile

### v2.9.24 — Lightbox MJPEG streaming con fallback a snapshot (2026-04-04)

- [x] **Lightbox**: al click su una camera tenta MJPEG stream (`/api/camera-proxy-stream/{id}`)
- [x] **Badge**: verde + "Live Streaming" se MJPEG attivo; amber + "Snapshot • Xs" se fallback
- [x] **Fallback automatico**: se HA risponde 404/errore o nessun frame in 5 s → snapshot polling trasparente
- [x] **Chiusura pulita**: `img.src = ''` alla chiusura del lightbox interrompe lo stream e rilascia la connessione
- [x] **Backend** `ha_client.py`: aggiunto `get_camera_stream_request()` (no total timeout, sock_read 30 s)
- [x] **Backend** `camera_proxy.py`: nuovo handler `get_camera_proxy_stream` con `web.StreamResponse`, proxy MJPEG chunked
- [x] **Backend** `server.py`: rotta `GET /api/camera-proxy-stream/{entity_id}` registrata
- [x] **Tile**: rimane snapshot polling (invariato), solo il lightbox usa lo stream

### v2.9.23 — Fix camera hidden toggle: markDirty, preview, loader default (2026-04-04)

- [x] **Bug fix**: toggle visibilità telecamera non marcava la config come sporca → `markDirty()` aggiunto a toggle, title, refresh e remove handler
- [x] **Bug fix**: `renderCamerasPreview()` mostrava le telecamere nascoste come visibili — ora barrate+semitrasparenti con contatore "N nascosta/e"
- [x] **Bug fix**: conteggio sezione camera mostrava il totale invece delle sole telecamere visibili
- [x] **Bug fix**: `loader.py` usava `or 10` come default per `refresh_interval` invece di `or 3` coerente con save e UI

### v2.9.22 — Drag-and-drop navigation order in /config (2026-04-04)

- [x] Config → Overview tab: nuova card **"Navigation Order"** con lista drag-and-drop
- [x] **Overview bloccato** in prima posizione (locked, non riordinabile)
- [x] Rooms, Scenarios, Cameras, Alarms liberamente riordinabili tramite drag-and-drop
- [x] Persiste in `nav_order` in `entities.json` v5 e propagato via API
- [x] Dashboard rispetta l'ordine al caricamento (`nav.js` legge `config.nav_order`)
- [x] Backend: `PanelConfig.nav_order`, `_parse_nav_order()`, serializzato in `panel_config.py` e validato in `panel_config_save.py`
- [x] Camera: aggiunto campo `hidden` nel loader e save (fix mancante v2.9.21)

### v2.9.21 — Camera grid 2-col, pagination, faster refresh, hide toggle (2026-04-04)

- [x] Camera grid: 4 colonne → **2 colonne** (tile più grandi); 1 colonna su telefono portrait
- [x] **Paginazione**: 4 telecamere per pagina, bottoni ← → con contatore "X / N"; timer delle cam fuori schermo distrutti al cambio pagina
- [x] Refresh tile: default **3s** (era 10s), min 1s, max 60s
- [x] Refresh lightbox: **2s** (era 10s) per una visione ingrandita più fluida
- [x] Config: aggiunto **toggle visibilità** (show/hide) per ogni telecamera, coerente con il pattern delle altre sezioni
- [x] Config: min refresh abbassato a 1s, default 3s

### v2.9.20 — Per-device theme toggle in dashboard header (2026-04-04)

- [x] **Theme toggle button** in dashboard header, between sensor chips and connection status dot
- [x] Icon: `weather-sunny` (dark mode → click to switch to light) / `weather-night` (light mode → click to switch to dark) — MDI icons via `window.RP_MDI`, consistent with the rest of the app
- [x] Purely client-side: `localStorage.setItem('rp_theme', ...)` — per-device preference, no backend changes
- [x] FOUC prevention script added to `index.html` (mirrors `config.html`): reads localStorage before first paint
- [x] `applyConfig()` in `app.js` calls `initThemeToggle()` to sync icon with server-side default on first load

### v2.9.19 — CSS cascade fix: alias block :root → body (2026-04-04)

- [x] Fix **vera causa radice** del tema scuro in /config: il blocco `--color-*` in `config.css` era su `:root` invece di `body` — gli alias `var(--c-surface)` ecc. risolvevano contro lo scope di `:root` (sempre scuro), ignorando completamente l'override `body.theme-light`; spostando il blocco su `body` gli alias ereditano il valore corretto da `body.theme-light`
- [x] Tutti gli elementi che usano `var(--color-surface)`, `var(--color-surface-2)`, `var(--color-text-primary)` ecc. ora diventano chiari con `body.theme-light`

### v2.9.18 — Server-side theme injection (2026-04-04)

- [x] Fix definitivo: `server.py` inietta il tema corretto direttamente nell'HTML prima di servire `index.html` e `config.html` — `class="theme-dark"` viene sostituito con `class="theme-{theme}"` lato server, eliminando ogni dipendenza da localStorage, script sincroni e race condition JavaScript
- [x] Sia il dashboard che la pagina /config ricevono il tema corretto all'arrivo del primo byte, senza alcun FOUC

### v2.9.17 — Light Theme root cause fix (2026-04-04)

- [x] Fix critico: `config.js` usava `document.body.className = 'theme-dark'` sovrascrivendo la classe corretta impostata dallo script inline — tutte le aree (section list, detail, preview) tornавano scure dopo il caricamento dell'API
- [x] Fix: il tema ora viene letto prima da `cfg.theme`, poi da `localStorage.rp_theme` come fallback; usa `classList.remove/add` invece di `className =`
- [x] Fix: `panel_config_save.py` ora include `theme` in `v5_data` → il tema viene persistito in `entities.json` e non si resetta a 'dark' ad ogni salvataggio

### v2.9.16 — Light Theme FOUC + html bg fix (2026-04-03)

- [x] Fix: `html, body` rule separata — `<html>` non ha mai la classe `theme-light`, il suo sfondo scuro traspariva sotto il body quando il contenuto era corto (tab Cameras/Alarms vuoti). Fix: regola separata con `min-height: 100vh` su `body`
- [x] Fix: FOUC completo — `app.js` ora salva il tema in `localStorage.rp_theme` quando il dashboard lo riceve dall'API; lo script sincrono in /config trovava null al primo accesso e non applicava il tema corretto prima del paint

### v2.9.15 — Light Theme Bug Fixes + Whitelist UI (2026-04-03)

- [x] Fix: toast "Saved" invisibile in light mode (#save-feedback aveva `color:#fff` su sfondo `--c-surface` bianco → ora sfondo fisso #1e1e1e)
- [x] Fix: FOUC (flash contenuto scuro) alla riapertura di /config in light mode → script sincrono legge `localStorage.rp_theme` e applica classe prima del paint
- [x] Fix: bubble sensori quasi invisibili in light mode — 18 overrides `body.theme-light` in tiles.css con versioni sature/scure degli stessi hue (giallo, blu, ciano, lavanda, viola, teal)
- [x] Whitelist UI: aggiunti `translations/en.yaml` e `translations/it.yaml` con titolo "White List — Accesso Diretto (porta 7654)" e testo esplicativo completo (IP singolo, rete /24, tutti, blocco totale)

---

## v2.9.25 — Cover / Tapparelle Tile (Planned)

**Status**: PLANNED — next patch

**Release Goal**: Aggiungere supporto per entità `cover.*` (tapparelle, tende, porte garage). Tipo di entità tra i più comuni nelle case italiane, attualmente non supportato.

### Specifiche

**Tile**:
- Tre pulsanti: ▲ Apri / ■ Stop / ▼ Chiudi — chiamate `cover.open_cover`, `cover.stop_cover`, `cover.close_cover`
- Progress bar orizzontale che mostra `attributes.current_position` (0–100 %)
- Stato visivo: `is-open` (verde), `is-closed` (grigio), `is-opening`/`is-closing` (animazione freccia)
- Stato `unavailable` gestito come tutti gli altri tile

**Backend**:
- Nuovo `layout_type`: `cover`
- `_parse_layout_type()` in `loader.py`: dominio `cover` → `cover`
- Whitelist service call: `cover.open_cover`, `cover.stop_cover`, `cover.close_cover`, `cover.set_cover_position`

**Frontend**:
- Nuovo componente `cover.js` (IIFE, var-only, iOS 12 safe)
- `COMPONENT_MAP['cover']` in `renderer.js`
- CSS in `tiles.css`: progress bar posizione, stati animati apertura/chiusura

**Config**:
- Aggiungibile da picker entità nella tab Overview e Rooms
- Nessuna configurazione aggiuntiva richiesta (funziona out-of-the-box)

---

## v2.9.26 — Sensore Condizionale (Planned)

**Status**: PLANNED

**Release Goal**: Nuovo tipo di tile che appare nell'overview (o in una room) **solo quando una condizione su un'entità HA è vera**. Permette di mostrare informazioni contestuali che emergono solo quando rilevanti — es. "Carta domani" solo il giorno prima della raccolta.

### Concept

Un sensore condizionale è un tile invisibile per default che diventa visibile in tempo reale (via WebSocket) quando la condizione definita dall'utente è soddisfatta. Mostra il valore del sensore monitorato con icona e colore bordo personalizzati.

**Esempio d'uso**:
- `condition_entity: sensor.raccolta_rifiuti` + `condition_value: "Domani"` → mostra il nome del rifiuto e l'icona cestino
- `condition_entity: binary_sensor.porta_garage` + `condition_value: "on"` → mostra "Garage aperto" in rosso
- `condition_entity: sensor.temperatura_est` + `condition_operator: "gt"` + `condition_value: "28"` → mostra avviso caldo

### Schema configurazione

```yaml
layout_type: sensor_conditional
entity_id: sensor.raccolta_rifiuti       # entità di cui mostrare il valore
condition_entity: sensor.raccolta_rifiuti # entità su cui valutare la condizione (può coincidere)
condition_operator: eq                    # eq | neq | gt | lt | gte | lte | contains
condition_value: "Domani"                 # valore stringa o numero da confrontare
label: "Raccolta carta"                   # label tile (opzionale — fallback a friendly_name)
icon: "trash-can"                         # icona MDI (opzionale — fallback a icona HA)
border_color: warning                     # token semantico colore bordo (vedi sotto)
```

### Sistema colori bordo

Il campo `border_color` accetta un **token semantico** che viene risolto a variabile CSS dal tema corrente.
I token disponibili corrispondono ai token già definiti in `tokens.css`:

| Token | CSS var | Valore dark | Valore light | Uso tipico |
|-------|---------|-------------|--------------|------------|
| `accent` | `--c-accent` | `#2196f3` | `#2196f3` | info, neutra |
| `on` | `--c-on` | `#4caf50` | `#4caf50` | condizione positiva |
| `warning` | `--c-warning` | `#ff9800` | `#ff9800` | attenzione |
| `danger` | `--c-danger` | `#f44336` | `#f44336` | emergenza, rosso |
| `alert` | `--c-binary-alert` | `#FF6B00` | `#FF6B00` | allerta arancione |
| `neutral` | `--c-text-sec` | `#999999` | `#555555` | generico, si adatta al tema |

Il tile usa il token per `border-color` e per il colore dell'icona/bolla — **nessun hardcode di hex**, tutto via variabili CSS: funziona correttamente su tema dark, light e auto senza CSS aggiuntivo.

### Comportamento runtime

- **Visibilità reattiva**: il tile è sempre nel DOM ma con `display:none`; ogni aggiornamento WebSocket (`state_changed`) ricalcola la condizione e mostra/nasconde il tile immediatamente
- **Nessun reload**: la comparsa/scomparsa è istantanea senza ricaricare la pagina
- **Confronto**: il `condition_operator` confronta sempre come stringa (`eq`, `neq`, `contains`) oppure come float se entrambi i valori sono numerici (`gt`, `lt`, `gte`, `lte`)
- **Condizione non soddisfatta**: tile nascosto, nessuno spazio occupato nel layout (rimosso dal flusso con `display:none`)

### Implementazione

**Backend** (`loader.py`):
- Nuovo tipo `ConditionalSensorConfig` con campi `condition_entity`, `condition_operator`, `condition_value`, `icon`, `border_color`
- `layout_type = 'sensor_conditional'`
- `all_entity_ids` include sia `entity_id` che `condition_entity` (entrambi devono ricevere aggiornamenti WS)

**Frontend** (`sensor_conditional.js`):
- `createTile(cfg)`: crea tile con classe CSS `tile-sensor-conditional`, nascosto di default
- `updateTile(tile, stateObj, allStates)`: riceve tutti gli stati, evalua la condizione, mostra/nasconde
- `_evalCondition(condState, operator, value)`: logica di confronto string/numeric
- Colore bordo: `tile.style.borderColor = 'var(--c-' + cfg.border_color + ')'`

**Config `/config`**:
- Aggiungibile da picker entità (filtra tutti i domini sensor/binary_sensor)
- Form dedicato con: entity picker per condizione, operator dropdown, value input, icon picker, color picker (palette 6 token)

---

## v2.9.27 — Climate / Termostato Tile (Planned)

**Status**: PLANNED

**Release Goal**: Supporto per entità `climate.*` — termostati, split, caldaie. Molto comune nelle abitazioni.

### Specifiche

**Tile**:
- Temperatura attuale (grande, `current_temperature`)
- Set point target (`temperature`) con pulsanti − / + (step 0.5°C)
- Badge modalità: `heat` / `cool` / `auto` / `off`
- Stato visivo: caldo (arancione), freddo (blu), auto (verde), off (grigio)

**Bottom sheet** (tap su tile):
- Slider temperatura set point (range da `min_temp` a `max_temp` di HA)
- Chip modalità selezionabili (solo quelle supportate da `hvac_modes`)
- Pulsante Off

**Backend**:
- Nuovo `layout_type`: `climate`
- Whitelist: `climate.set_temperature`, `climate.set_hvac_mode`, `climate.turn_off`

---

## v2.10 — Kiosk UX (Planned)

**Status**: PLANNED — minor version

**Release Goal**: Tre miglioramenti UX specifici per display wall-mounted e tablet always-on.

### v2.10.1 — Screensaver / Screen Timeout

- Dopo N minuti di inattività (nessun tap/click): l'overlay screensaver copre il pannello con sfondo nero e orologio digitale centrato
- Qualsiasi tap rimuove lo screensaver immediatamente
- N configurabile in `/config` (default 5 min, disabilitabile)
- Implementazione puramente client-side (CSS overlay + JS `setTimeout` reset su `touchstart`/`mousedown`)
- Nessuna interazione con HA, nessuna modifica backend

### v2.10.2 — Badge "N accesi" in sidebar rooms

- Ogni voce room nella sidebar mostra un badge numerico piccolo (es. `3`) quando almeno un'entità della room è nello stato `on`/`open`/`armed`
- Il badge scompare quando tutto è off/closed/disarmed
- Aggiornato in tempo reale via WebSocket (zero polling)
- Colore: `--c-warning` se almeno una entità è in stato alert, `--c-on` altrimenti

### v2.10.3 — Toast notifiche state change

- Popup toast in basso a destra (3 s, poi svanisce) per eventi configurati dall'utente
- Esempi: "Porta ingresso aperta", "Allarme inserito", "Garage aperto"
- L'utente seleziona in `/config` quali entità generano toast e per quale transizione di stato
- Colori: `--c-danger` per alert, `--c-on` per positive, `--c-text-sec` per neutral
- Massimo 3 toast sovrapposti; i più vecchi scivolano fuori

---

## v3.0 — Theme UI + Assistente Vocale (Long-term)

**Status**: LONG-TERM — nessuna data

**Release Goal**: Due feature di valore per gli utenti più avanzati, che non rientrano nella filosofia "kiosk minimalista" ma aggiungono personalizzazione e accessibilità.

### v3.0.1 — Theme Customization UI

- Pagina `/config` → tab "Tema": palette colori per `--c-accent`, `--c-on`, `--c-danger`, `--c-warning`
- Color picker inline (nessuna dipendenza esterna, SVG wheel o palette 12 colori predefiniti)
- Anteprima live del cambio tema
- Salvato come overrides CSS in `entities.json`, applicato server-side via `<style>` inline

### v3.0.2 — Gestione Notifiche

Centro notifiche integrato nel dashboard per aggregare e visualizzare eventi importanti da HA.

**Notification Center** (overlay laterale o drawer):
- Icona campanella nell'header con badge numerico (N notifiche non lette)
- Tap sull'icona apre un panel laterale con lista notifiche in ordine cronologico
- Ogni notifica: icona entità + titolo + stato + timestamp relativo ("3 min fa")
- Swipe / pulsante ✕ per segnare come letta e rimuovere dalla lista

**Sorgenti notifiche**:
- Entità marcate come "alert" in `/config` (stessa lista dei toast v2.10.3)
- HA `persistent_notification.*` forwarded via WebSocket
- Transizioni di stato critiche (allarme armato/scattato, porta aperta da > N minuti)

**Configurazione in `/config`**:
- Tab "Notifiche": lista regole — ogni regola ha: entità, condizione trigger, messaggio custom, livello (info/warning/danger), se genera anche toast o solo si accumula nel center
- Max 50 notifiche in storia; le più vecchie vengono eliminate automaticamente

**Persistenza**:
- Le notifiche sono accumulate in memoria (non persistite su disco) — si azzerano al riavvio del pannello
- Opzionale (v3.0.x): persistenza in `entities.json` con TTL configurabile

**Backend**:
- Nuovo evento WebSocket `rp_notification` emesso dal server quando una regola scatta
- `notification_engine.py`: valuta le regole su ogni `state_changed` da HA, emette eventi al frontend

### v3.0.3 — Assistente Vocale (Wake Word locale)

- Integrazione con [Piper](https://github.com/rhasspy/piper) o HA Assist via WebSocket
- Wake word rilevabile lato HA (non nel browser — troppo pesante per iOS 12)
- Dashboard mostra overlay "In ascolto…" quando HA segnala intent attivo
- Comandi: accendere/spegnere entità, impostare temperature, attivare scenari
- Richiede HA 2024.x+ con Assist pipeline configurata

---

## Performance Targets (All Versions)

These targets apply to v2.0 and all future releases:

**Page Load Time**:
- < 2 seconds on 4G (1 Mbps)
- < 500 ms on WiFi (10 Mbps)
- < 100 ms on LAN (100 Mbps)

**Service Call Latency**:
- < 500 ms local network
- < 2 seconds on 4G

**Memory Usage**:
- < 100 MB RSS on Pi 3B+ (v2.0)
- < 50 MB frontend assets

**Bundle Size**:
- < 20 KB JavaScript (uncompressed)
- < 25 KB CSS (uncompressed)
- No external dependencies for frontend

---

## Breaking Changes Policy

**Policy**: Breaking changes only in MAJOR versions (v1→v2, v2→v3, etc.)

**For Breaking Changes**:
1. Document thoroughly in BREAKING_CHANGES.md
2. Provide migration guide with examples
3. Auto-migrate old config format if possible
4. Announce 1-2 releases ahead of time
5. Support old format for at least 1 release

**Example**: v2.0 config migration
- v1.4 format: `rooms[].items[]` (deprecated)
- v2.0 format: `rooms[].sections[].items[]` (new)
- Auto-migration: On first load, v1.4 configs converted to v2.0

---

## Release Schedule

| Version | Status | Release Date | Timeline |
|---------|--------|-------------|----------|
| v2.0 | Released | 2026-03-27 | Completed |
| v2.1 | Released | 2026-03-28 | Completed |
| v2.2 | Released | 2026-03-28 | Completed |
| v2.3.0 | Released | 2026-03-28 | Completed |
| v2.3.1 | Released | 2026-03-28 | Completed |
| v2.3.2 | Released | 2026-03-29 | Completed |
| v2.6.0 | Released | 2026-03-30 | Completed |
| v2.6.1 | Released | 2026-03-30 | Completed |
| v2.7.0 | Released | 2026-03-30 | Completed |
| v2.8.0 | Released | 2026-03-30 | Completed |
| v2.8.1–2.8.5 | Released | 2026-03-30 | Post-release fixes |
| v2.9.0 | Released | 2026-03-30 | Completed |
| v2.9.1 | Released | 2026-04-02 | Completed |
| v2.9.2 | Released | 2026-04-02 | Completed |
| v2.9.3 | Released | 2026-04-02 | Completed |
| v2.9.4–2.9.9 | Released | 2026-04-03 | Completed |
| v2.9.10–2.9.11 | Released | 2026-04-03 | Completed |
| v2.9.12 | Released | 2026-04-03 | Completed |
| v2.9.13 | Released | 2026-04-03 | Completed |
| v2.9.14 | Released | 2026-04-03 | Completed |
| v2.9.15 | Released | 2026-04-03 | Completed |
| v2.9.16 | Released | 2026-04-03 | Completed |
| v2.9.17 | Released | 2026-04-04 | Completed |
| v2.9.18 | Released | 2026-04-04 | Completed |
| v2.9.19 | Released | 2026-04-04 | Completed |
| v2.9.20 | Released | 2026-04-04 | Completed |
| v2.9.21 | Released | 2026-04-04 | Completed |
| v2.9.22 | Released | 2026-04-04 | Completed |
| v2.9.23 | Released | 2026-04-04 | Completed |
| v2.9.24 | Released | 2026-04-04 | **Current stable** |
| v3.0 | Planned | TBD | 2026 H2 (estimated) |

---

## Completed Releases (Historical)

### v1.0 - Foundation (Released)
- Core light, switch, sensor, binary_sensor support
- Basic WebSocket and REST API
- Simple grid layout

### v1.4 - Room Sections (Released)
- Room sections for organization
- Config editor UI redesign
- Entity picker with auto-fill
- Migration from v1.3 to v4 schema

### v1.5 - Extension (Released)
- Advanced light controls (brightness, color temp)
- Multiple pages/panels support
- Cover and Input Boolean entities
- Wake Lock API

---

**Document Version**: 2.9.14
**Last Updated**: 2026-04-03
**Maintainer**: Retro Panel Team
