# Retro Panel — Changelog

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.1] — 2026-03-28

### Fixed
- Atomic write for `entities.json`: config is no longer corrupted if the container restarts during a save operation
- `refresh_interval` with a non-numeric value in camera config no longer crashes loader or save handler (falls back to 10 seconds)
- Entity ID validation regex now accepts digits in the domain part (e.g. `modbus.sensor1`, `input_number.x`)
- Section count limits (`_MAX_SECTIONS = 20`) now enforced for scenario and camera sections on save (returns HTTP 400 if exceeded)
- v4 `overview.items[]` correctly migrated to a default section when config page is opened (prevented silent data loss when upgrading from v4)
- Optional chaining (`?.`) and nullish coalescing (`??`) replaced with ES2017-compatible equivalents in config.js
- Orphaned `mousemove`/`mouseup` drag event listeners are now cleaned up when a drag is interrupted by a list re-render
- `#disconnect-banner` moved outside `#panel` flex container (correct full-width display on iOS Safari)
- Touch targets for `.bs-close` (bottom sheet close) and `#sidebar-toggle` increased to 44×44 px (Apple HIG minimum)
- Added `font-feature-settings: "tnum"` fallback for `font-variant-numeric: tabular-nums` (iOS 12 compatibility for tabular number display)
- `options.json` JSON parse error now raises a descriptive `ValueError` instead of an unhandled `JSONDecodeError`
- Version field in `entities.json` is now normalised to int before comparison (string `"5"` no longer silently falls to wrong migration path)

### Tests
- Added 3 edge-case tests to `test_loader_v5.py` (invalid refresh_interval, version as string, missing cameras key in v4)
- Added `test_save_validation.py` with 7 tests covering section count limits and entity ID regex
- Added `retro-panel/tests/js/run_es5_check.sh` — automated ES5 compliance check for `renderer.js` and ES2017 compliance for `config.js`
- Added `retro-panel/tests/js/test_config_state.html` — browser-runnable unit tests for config.js pure functions

## [2.0.0] — 2026-03-27

### Breaking Changes

- **Completo refactoring frontend** — tutti i file CSS e JS del frontend sono stati riscritti da zero.
  L'architettura precedente (griglia CSS auto-adattiva) è stata sostituita con un sistema a dimensioni fisse.

### Added

- **`layout_type` system** — il backend ora calcola `layout_type` per ogni entità (`light`, `switch`,
  `sensor_temperature`, `sensor_humidity`, `sensor_co2`, `sensor_battery`, `sensor_energy`,
  `sensor_generic`, `binary_door`, `binary_motion`, `binary_standard`, `alarm`, `camera`, `scenario`).
  Il frontend è un puro renderer: `COMPONENT_MAP[layout_type]` → zero inferenza nel frontend.

- **`device_class`** salvato in `entities.json` dalla Config UI, disponibile per calcolo `layout_type`
  senza richiedere lookup live su HA.

- **Triple-lock tile dimensions** — `.tile-light` e `.tile-switch` hanno `height + min-height + max-height = 120px`.
  Nessun vicino può alterarne le dimensioni. Basato su `mockups/oggetti_definitivi.html`.

- **Flexbox column system** — `.tile-row` + `.tile-col-compact` (33.3%) + `.tile-col-sensor` (50%) +
  `.tile-col-full` (100%). Nessuna CSS grid per i tile, zero row-height stretching.

- **Design system CSS** (`tokens.css`) — variabili `--c-bg`, `--c-surface`, `--c-accent`, `--c-light-on`,
  `--radius`, `--sidebar-w`, `--header-h` con override per tema light.

- **Bottom sheet per luci** (`bottom-sheet.css` + `bottom-sheet.js`) — sostituisce `light-sheet.js`.
  Dimmer, color temperature, hue slider + swatches preset. Si apre con long-press (500ms) su una tile luce.

- **Config UI separata** (`/config`) — accessibile via `webui:` in `config.yaml` → pulsante
  "Open Web UI" nella pagina info dell'add-on in HA.

- **`webui:` in `config.yaml`** — genera il pulsante "Open Web UI" separato dal pannello sidebar.

### Changed

- **`loader.py`** (`EntityConfig`) — aggiunti campi `device_class: str = ""` e `layout_type: str = ""`;
  aggiunta funzione `_compute_layout_type()`.
- **`handlers_config.py`** — `_serialize_item()` include ora `layout_type` e `device_class`.
- **`handlers_config_save.py`** — `_parse_item()` copia `device_class` da raw.
- **`app.js`** — `updateEntityState()` usa `tile.dataset.layoutType` + `RP_Renderer.getComponent()`.
  Rimossa gestione `header_sensors` (non più gestita dalla Config UI).
- **`renderer.js`** — riscritto con `COMPONENT_MAP[layout_type]` e `COL_CLASS_MAP[layout_type]`.
  Ogni tile è avvolta in `.tile-col-*` dentro `.tile-row`.
- **Tutti i componenti JS** — riadattati per usare classi CSS v2.0 (`is-on`/`is-off`/`is-unavail`,
  `tile-light`, `tile-switch`, `tile-sensor`, `tile-alarm`, `tile-scenario`, `tile-camera`).
  `ScenarioComponent` espone ora `createTile` (era `createCard`).

### Removed

- File CSS legacy: `base.css`, `themes.css`, `components.css`, `camera.css` (vecchio `config.css` invariato).
- `light-sheet.js` — sostituito da `bottom-sheet.js`.
- Configurazione `header_sensors` dalla Config UI.

## [1.6.6] — 2026-03-26

### Fixed

- **Crash avvio backend** (`app/config/validator.py`)
  `validate_config()` controllava `config.columns` rimosso in v1.6.5.
  Rimossa la riga di validazione obsoleta.

## [1.6.5] — 2026-03-26

### Changed

- **Layout proporzionale a unità fisse** (`app/static/css/layout.css`, `components.css`, `app/static/js/app.js`)
  Rimossa la configurazione manuale delle colonne. Il sistema ora calcola automaticamente
  le colonne dal viewport (2 su phone <600px, 3 su tablet portrait, 4 su landscape ≥1024px)
  e posiziona le tile con proporzioni fisse:
  - Light / Switch: 2 unità di altezza (`grid-row: span 2`)
  - Sensor-row / Binary sensor: 1 unità (`grid-row: span 1`)
  - 2 sensori sovrapposti = 1 luce/interruttore in altezza
  - Climate tile: 2 unità
  - Alarm: larghezza piena + 4 unità
  Ogni tile mantiene le proprie dimensioni indipendentemente dai vicini.

### Removed

- **Campo `columns` dalla configurazione** (`config.yaml`, `app/config/loader.py`, `app/api/handlers_config.py`)
  Non più necessario: il numero di colonne è determinato automaticamente dal viewport.

## [1.6.4] — 2026-03-26

### Fixed

- **climate-tile schiacciata dai vicini nella grid** (`app/static/css/components.css`)
  `.climate-tile` non aveva `min-height` propria (ereditava solo 120px da `.tile`) e usava
  `align-self: stretch` (default), quindi veniva ridimensionata alla riga calcolata sui tile
  vicini più bassi (es. switch 120px, sensor-row 72px). Fix: aggiunto `min-height: 160px` e
  `align-self: start` — la tile mantiene ora le proprie dimensioni indipendentemente dai vicini.

## [1.6.3] — 2026-03-26

### Fixed

- **visual_type perso al reload** (`app/config/loader.py`, `app/api/handlers_config.py`)
  Root cause: `EntityConfig` dataclass non aveva i campi `visual_type` e `display_mode`;
  `_parse_entity()` li scartava silenziosamente; `_serialize_item()` non li includeva nella
  risposta JSON. Il dato veniva scritto correttamente su disco ma non tornava mai al frontend.
  Fix: aggiunti i campi al dataclass, lettura in `_parse_entity`, emissione condizionale in
  `_serialize_item`.

- **Percentuale climate tile errata con visual_type forzato** (`app/static/js/components/sensor.js`)
  Il ramo `climateForced === 'true'` calcolava `--climate-pct` come valore grezzo 0–100.
  Ora normalizza tramite `CLIMATE_RANGE[forcedDc]` (es. temperatura 15–35 °C → pct corretta).

## [1.6.2] — 2026-03-26

### Added

- **Selezione visual_type per entità** (`app/static/js/config.js`, `config.html`, `config.css`)
  Ogni entità sensor/binary_sensor/light ora ha un pulsante dedicato (accanto a visibilità) che apre
  un picker contestuale con opzioni specifiche per dominio:
  - Sensor: Temperatura, Umidità, CO₂, Batteria, Consumo energetico
  - Binary sensor: Porta, Finestra, Movimento, Presenza, Standard
  - Light: Standard, Dimmer, RGB

- **Componente Camera** (`app/static/js/components/camera.js`, `app/static/css/camera.css`)
  Tile camera con snapshot polling, cleanup timer su navigazione, gestione errori.

- **API Camera proxy** (`app/api/handlers_cameras.py`)
  `GET /api/ha-cameras` e `GET /api/camera-proxy/{entity_id}` con validazione regex dominio,
  timeout 8s, `Cache-Control: no-store`.

### Fixed

- **visual_type non salvato dal backend** (`app/api/handlers_config_save.py`)
  `_parse_item` scartava `visual_type` e `display_mode` ad ogni salvataggio config.
  Aggiunti esplicitamente alla lista dei campi copiati.

- **Dashboard non rifletteva visual_type** (`app/static/js/components/sensor.js`, `light.js`, `renderer.js`)
  - `sensor.js createTile`: legge `entityConfig.visual_type`; `sensor_temperature`/`sensor_humidity`
    creano subito una climate-tile con `dataset.climateForced = 'true'`.
  - `sensor.js updateTile`: applica `overrideDc` (sensor) e `overrideBinDc` (binary_sensor) dal
    `visual_type` storato in `tile.dataset.visualType`; `forceRowByVisualType` blocca promozione
    a climate per tipi non-climate.
  - `light.js updateTile`: `light_dimmer` mostra sempre la percentuale luminosità; `light_rgb`
    applica il colore corrente all'icona tramite `colorFromAttributes()`.
  - `renderer.js`: imposta `tile.dataset.visualType = item.visual_type` e
    `tile.dataset.displayMode = item.display_mode` dopo `createTile` in `renderItemsGrid`
    e `renderRoomSections`.

## [1.6.1] — 2026-03-26

### Fixed

- **display_mode non salvato alla creazione entità** (`app/static/js/config.js`)
  Quando un'entità veniva aggiunta (da picker o import area), il campo `display_mode`
  non era incluso nell'oggetto item. Se l'utente non toccava il dropdown, il valore
  non veniva mai persistito nel JSON. Aggiunto `display_mode: 'auto'` esplicitamente
  in entrambi i punti di creazione item.

- **display_mode 'climate' non crea il tile corretto** (`app/static/js/components/sensor.js`)
  `createTile()` ignorava `cfg.display_mode` e creava sempre una `sensor-row-tile`.
  Aggiunto branch in `createTile`: se `display_mode === 'climate'`, viene costruita
  direttamente una `climate-tile` con `dataset.climateForced = 'true'`, senza attendere
  la promozione automatica basata su `device_class`.

- **display_mode 'row' non bloccava la promozione a climate** (`app/static/js/components/sensor.js`)
  `updateTile()` ignorava `display_mode` e promuoveva a climate tile basandosi solo su
  `device_class`. Un sensore temperatura con `display_mode: 'row'` veniva comunque promosso
  a climate tile al primo update. Aggiunto controllo `forcedMode !== 'row'` sulla condizione
  di auto-promozione, e path dedicato per `tile.dataset.climateForced === 'true'`.

---

## [1.6.0] — 2026-03-26

### Refactoring — Frontend completo riscritto

Refactoring totale del frontend per risolvere problemi di stabilità su iPad iOS 12 e
aggiungere la sezione Telecamere. Il backend Python e tutti i componenti JS esistenti
(light, switch, sensor, alarm, energy, scenario, light-sheet) sono stati mantenuti invariati.

#### Architettura JS

- **`app.js`** ridotto da 720 a ~200 righe: contiene solo boot, AppState e WebSocket handler
- **`nav.js`** (nuovo): sidebar state machine — buildSidebar, showRoomsSubmenu, toggleSidebar,
  setActiveSidebarItem. Nessun accesso diretto ad AppState; riceve callback da app.js
- **`renderer.js`** (nuovo): tutte le funzioni di rendering — renderActiveSection, renderItemsGrid,
  renderRoomSections, renderScenariosGrid, renderCamerasGrid, resolveComponent.
  Lazy rendering a blocchi di 10 via `requestAnimationFrame` per performance su grandi liste.
  Tile default generico per domini HA non mappati.

#### CSS

- **`layout.css`** riscritto da zero: breakpoint sidebar spostato da `≤900px/767px` a `≤599px`
  (iPhone). iPad portrait (768px) e landscape (1024px) mostrano ora la sidebar espansa (200px)
  con label visibili. Icone centrate in collapsed mode.
- **`camera.css`** (nuovo): stili per le tile camera snapshot.

#### Sicurezza e compatibilità iOS 12

- Tutti i nuovi file JS verificati: nessun `const`/`let`/arrow function/import/export/`?.`/`??`
- Nessun `gap` su elementi flex, nessun `inset:` shorthand
- `touchend` + `preventDefault()` su tutti i nav items per risposta immediata senza 300ms delay

### Added

- **Sezione Telecamere** — frontend + backend
  - `GET /api/ha-cameras`: lista camera entities da HA
  - `GET /api/camera-proxy/{entity_id}`: proxy JPEG token-side (5 layer sicurezza:
    regex `^camera\.[a-z0-9_]+$`, whitelist config, timeout 8s, `Cache-Control: no-store`)
  - Componente `camera.js`: tile con snapshot polling configurabile (3–60s), spinner loading,
    errore graceful, cleanup timer automatico a ogni navigazione
  - Tab "Telecamere" nella config UI con picker overlay e campi title/refresh_interval

- **Tile default** per entità HA non mappate a nessun componente noto:
  mostra icona MDI auto-detected + label + stato grezzo

- **Sezione Cameras nel data model** (`app/config/loader.py`):
  `CameraConfig(entity_id, title, refresh_interval)` + campo `cameras[]` in `PanelConfig`

---

## [1.5.5] — 2026-03-26

### Fixed

- **Crash Overview — `resolveComponent` senza guardia** (`app/static/js/app.js`)
  `resolveComponent(item)` accedeva a `item.entity_id.split('.')` senza verificare che
  `entity_id` fosse presente. Un singolo item mal-configurato causava un `TypeError` non
  catchato che interrompeva l'intera sequenza di boot, rendendo la dashboard inutilizzabile.
  Aggiunta guardia `if (!item || !item.entity_id) { return null; }`.

- **Overview — `updateTile` chiamato prima di `appendChild`** (`app/static/js/app.js`)
  In `renderItemsGrid`, `component.updateTile(tile, stateObj)` era chiamato prima che
  il tile fosse inserito nel DOM. Su WKWebView/iOS questo causa comportamenti non
  deterministici. L'ordine è ora corretto (`appendChild` prima, `updateTile` dopo),
  allineato a `renderRoomSections`.

- **Overview — nessun try/catch nel loop di rendering** (`app/static/js/app.js`)
  Il loop di `renderItemsGrid` non proteggeva ogni item con try/catch. Un singolo item
  corrotto interrompeva il rendering di tutti gli item successivi. Aggiunto try/catch
  per-item (stesso pattern di `renderRoomSections`).

- **iPad — sidebar sempre collassata in portrait** (`app/static/css/layout.css`)
  Il breakpoint `max-width: 900px` faceva collassare la sidebar anche su iPad portrait
  (768px logici), nascondendo le label dei menu. Breakpoint abbassato a `767px`: iPad
  portrait ora vede la sidebar espansa con label visibili.

- **iPad — icone sidebar non centrate in modalità collassata** (`app/static/css/layout.css`)
  In collapsed mode su schermi ≤767px, il label con `flex:1` spingeva le icone a sinistra.
  Aggiunto `justify-content: center` e padding azzerato sui nav items in collapsed mode.

- **iPad — bottom sheet scroll rigido senza momentum** (`app/static/css/components.css`)
  Il bottom sheet `.rp-bottom-sheet` mancava di `-webkit-overflow-scrolling: touch`.
  Su iOS 12-14 lo scroll interno era rigido e difficile da controllare. Aggiunta la
  proprietà mancante.

- **iPad — bottom sheet overlay chiusura con 300ms di ritardo** (`app/static/js/components/light-sheet.js`)
  L'overlay usava solo `click`, producendo il classico ritardo da click sintetico su
  WKWebView. Aggiunto listener `touchend` con `preventDefault()` per chiusura immediata.

- **iPad — color swatches luce con 300ms di ritardo** (`app/static/js/components/light-sheet.js`)
  I preset colore usavano solo `click`. Stessa causa e stesso fix dell'overlay:
  aggiunto `touchend` con `preventDefault()`; il `click` è mantenuto con guard
  `!('ontouchstart' in window)` per desktop.

---

## [1.5.4] — 2026-03-26

### Fixed

- **Sidebar frozen on iPad — WebSocket path** (`app/static/js/app.js`)
  `updateEntityState()` called `component.updateTile()` without a try/catch. On
  Safari/WKWebView an uncaught exception in a WebSocket `message` handler
  blocks subsequent touch events exactly like an uncaught exception in a
  `touchend` handler. The call is now wrapped in try/catch with a console.error
  fallback, eliminating the remaining freeze vector after v1.5.3.
  Same protection added around `EnergyFlowComponent.updateTile()` in the same
  handler.

### Added

- **Per-entity display mode** (`app/static/js/app.js`, `app/static/js/config.js`)
  Each entity in the config editor now shows a "Visualizzazione" dropdown with
  four options:
  - **Automatico** (default) — component chosen by domain, same behaviour as before
  - **Riga compatta** — forces `SensorComponent` row layout (icon + name + value)
  - **Riquadro standard** — forces native domain component (tile layout)
  - **Clima (valore grande)** — forces `SensorComponent` climate/fill-bar layout

  The selected value is stored as `display_mode` on the item object and
  persisted to `entities.json`. `resolveComponent(item)` in `app.js` reads
  `item.display_mode` and overrides the automatic domain → component lookup
  when the value is not `'auto'`.

---

## [1.5.3] — 2026-03-26

### Fixed

- **Sidebar bloccata su iPad con stanze a sezioni** (`app/static/js/app.js`)
  Su Safari iOS/WKWebView un'eccezione non catturata in `renderRoomSections()` —
  scatenata da `updateTile()` chiamato su nodi non ancora nel DOM — propagava
  fino al `touchend` handler della sidebar bloccando tutti gli eventi touch
  successivi. Fix: `renderActiveSection()` avvolto in `try/catch` in
  `navigateTo()`; loop tile avvolto in `try/catch` per-item; `appendChild(tile)`
  spostato prima di `updateTile()` così il nodo è nel DOM al momento del rebuild.

- **Allineamento visivo al mockup approvato** (`app/static/css/components.css`)
  Corrette tutte le discrepanze tra implementazione e mockup `oggetti_definitivi.html`:
  - Padding base tile 16px → **12px** (sistemico su tutti i componenti)
  - Toggle pill 44×26px → **38×22px**; thumb 20px → **16px**; translateX 18→**16px**
  - Alarm tile `min-height` 200px → **240px**
  - Bottoni allarme: "Casa" arancione→**blu accent**; "Disarma" verde→**blu accent**
  - `alarm-pin-display`: aggiunto `background-color`, `border-radius`, `padding 6px 12px`
  - `srt-alert` border-color: colore pieno → **rgba(255,107,0,0.32)** (semitrasparente)
  - Rimossa opacity ridotta su icona OFF (0.40), label luce OFF (0.55), toggle OFF (0.5)
    — non previste dal mockup; icona usa solo cambio colore via JS
  - Switch label OFF: corretta a **opacity 0.6** (valore mockup)
  - `alarm-key` min-height 56→**52px**; delete key font-size 18→**16px**
  - `sensor-row-value`: aggiunto `letter-spacing: -0.02em`
  - `sensor-row-name`: aggiunto `line-height: 1.2`

---

## [1.5.2] — 2026-03-26

### Fixed

- **Sensor row tile — allineamento mockup** (`app/static/css/components.css`, `app/static/js/components/sensor.js`)
  Il componente `sensor-row-tile` non corrispondeva al mockup approvato (`oggetti_definitivi.html`):
  - `grid-column: 1/-1` rimosso: le tile occupano celle normali nella griglia (non più full-width)
  - `min-height` 56px → 72px, `padding` 10px 14px → 13px 16px
  - Icona `border-radius` 50% → 11px (rettangolo arrotondato, non cerchio)
  - Icona dimensioni 38px → 42px
  - Bordo base `1px solid rgba(255,255,255,0.07)` aggiunto (tile visibili anche senza stato attivo)
  - Aggiunte 9 classi semantiche icona: `sri-temp-warm/cool`, `sri-humidity`, `sri-co2`,
    `sri-battery-low`, `sri-energy`, `sri-ok`, `sri-presence`, `sri-critical`
  - Aggiunte 9 classi semantiche valore: `srv-temp-warm/cool`, `srv-humid`, `srv-co2`,
    `srv-danger`, `srv-accent`, `srv-muted`, `srv-alert`, `srv-on`
  - Aggiunte varianti tile `srt-presence` (verde) e `srt-critical` (rosso pulsante)
  - `sensor.js`: logica colori aggiornata con mapping `device_class` → `sri-*`/`srv-*`,
    warm/cool automatico a soglia 18°C, battery-low sotto 20%, gerarchia
    critical > presence > alert per binary sensor

---

## [1.5.1] — 2026-03-26

### Fixed

- **WebSocket 403 behind HA Ingress** (`app/server.py`)
  The `ws_handler` was rejecting all WebSocket connections made through the HA
  Supervisor Ingress proxy. The browser sends its HA dashboard origin
  (e.g. `http://192.168.x.x:8123`) which does not match the container's
  internal `ha_url` (`http://homeassistant:8123`) or its bind address, causing
  the Origin check to return 403 on every WS upgrade.
  Fix: the Origin check is now skipped entirely when the `X-Ingress-Path`
  header is present (set by the Supervisor on every Ingress request, proving
  the connection is already authenticated).

- **Climate sensor tile `state-off` class leak** (`app/static/js/components/sensor.js`)
  `rebuildAsClimateTile()` set `className` including `state-off`, which was
  never removed after the tile transitioned to active state. The tile then
  carried both `state-off` and `state-on` simultaneously, breaking the
  fill-bar visual. Fix: `state-off` removed from the initial class list
  assigned during promotion.

- **Sensor row tile green overlay on `state-on`** (`app/static/css/components.css`)
  The generic `.tile.state-on::before` green overlay was applied to
  sensor-row-tiles because they correctly receive `state-on` for active
  generic sensors. Sensor row tiles convey state via the icon bubble color
  (`sri-on` / `sri-alert`) not the fill overlay. Added
  `.tile.sensor-row-tile.state-on::before { display: none; }` to suppress it.

---

## [1.5.0] — 2026-03-25

### Added

- **Sensor row tile** (`app/static/js/components/sensor.js`, `app/static/css/components.css`)
  Generic sensors (non-temperature/humidity) now render as compact horizontal rows — iOS Home App-style.
  Each row shows a circular icon bubble + entity name + current value in a full-width grid cell.
  Temperature and humidity sensors retain the existing `climate-tile` fill-bar layout.
  - Icon bubble gains `.sri-on` (blue tint) or `.sri-alert` (orange tint) based on state.
  - Binary sensors with alert device classes (door, window, motion, moisture, smoke, vibration) apply `.srt-alert` highlighting when ON.
  - Climate tiles are promoted on first `updateTile` call when `device_class` is known (temperature/humidity).

- **Room section count badge** (`app/static/css/layout.css`, `app/static/js/app.js`)
  Section headers now display a small pill badge with the count of visible entities in that section.
  A flex-1 divider line fills the remaining header space, providing clear visual separation.
  Classes: `.room-section-count` (badge), `.room-section-line` (divider).

- **Responsive sidebar** (`app/static/css/layout.css`)
  Sidebar auto-collapses to icon-only mode (64px) on screens ≤900px (portrait iPad, phones).
  No JavaScript change needed — pure CSS media query. At ≥901px (landscape iPad, desktop) the sidebar
  is expanded by default and can be toggled with the ☰ button as before.

### Fixed

- **iOS 12 CSS compatibility** (`app/static/css/layout.css`, `app/static/css/components.css`, `app/static/css/config.css`)
  All `inset: 0` shorthand properties replaced with explicit `top/right/bottom/left: 0` (supported from iOS 14.5+ only).
  All `gap` properties on flex containers replaced with `> * + *` margin selectors (flex `gap` requires iOS 14.5+; grid `gap` was already supported from iOS 12 and was left unchanged).
  Added `height: -webkit-fill-available` fallback between `100vh` and `100dvh` for correct full-screen rendering on iOS < 15.4.
  Affected rules: `#loading-screen`, `.loading-content`, `#disconnect-banner`, `#panel`, `.sidebar-settings`, `#sidebar-rooms-back`, `.sidebar-nav-item`, `#panel-header`, `#header-info`, `#header-sensors`, `.header-sensor-chip`, `.empty-state`, `.light-tint`, `.tile.state-on::before`, `.tile.entity-sensor.sensor-alert::before`, `.scenario-card`, `.scenario-card.scenario-done::before`, `.rp-bs-overlay`, `.alarm-actions`, `.tab-btn`, and 16 rules in `config.css`.

### Changed

- **Documentation cleanup** — all "iOS 15" / "iPadOS 15+" references updated to "legacy devices (iOS 12+)" across `DOCS.md`, `CHANGELOG.md`, `docs/AUDIT_REPORT.md`, `docs/ROADMAP.md`, `docs/PROJECT.md`, `config.yaml`, and `app/static/js/app.js`.
  Deleted `docs/CHANGELOG.md` (outdated duplicate — root `CHANGELOG.md` is authoritative).

---

## [1.4.1] — 2026-03-24

### Fixed

- **`/api/panel-config` handler v4 compatibility** (`app/api/handlers_config.py`)
  `get_panel_config()` was still serializing `room.items` instead of `room.sections`,
  causing `AttributeError: 'RoomConfig' object has no attribute 'items'` on every
  panel-config request after upgrading to v1.4.0 (v4 schema).
  Handler now iterates `room.sections` and returns `sections: [{id, title, items}]`
  in the rooms payload, matching the v4 data model.

---

## [1.4.0] — 2026-03-24

### Added

- **Room sections** (`app/config/loader.py`, `app/api/handlers_config_save.py`, `app/static/js/app.js`, `app/static/js/config.js`, `app/static/config.html`, `app/static/css/config.css`, `app/static/css/layout.css`)
  Rooms now support named sections. Each section has an id, a title, and its own list of entity items. This replaces the previous flat entity list per room and enables structured page design within a room.
  - **Data model (v4 schema)**: rooms contain `sections: [{id, title, items:[]}]` instead of flat `items[]`. Backward compatibility: v3 rooms with `items[]` are automatically migrated to a single unnamed default section on load.
  - **Room view rendering**: `renderRoomSections()` in `app.js` renders each section with an optional titled header followed by an auto-fill responsive tile grid (`.tile-grid-auto`). Replaces the fixed-column grid for room pages.
  - **Auto-fill grid**: room tiles now use `grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))` instead of fixed columns, adapting naturally to the available width.
  - **Config editor — two-column section editor**: the room editor in `config.html` / `config.js` now shows a two-column layout:
    - Left column: sections list with ↑↓ reorder, delete, and active selection highlight.
    - Right column: section detail — name input, entity list, + Add Entities, Import from area.
    - `+ Add Section` button creates a new empty section and selects it immediately.
    - Entity picker context is now per-section (`editingSectionId`).
  - **Import from area**: entities imported via "Import from area" are added to the currently selected section (or the first section, creating one if none exists).

- **"Retro PANEL" title branding** (`app/static/js/app.js`)
  The panel title in the sidebar header now renders as `Retro` followed by `PANEL` in accent blue (`var(--color-accent)`), applied via `innerHTML` in `applyConfig()`. `document.title` retains the plain text value from config.

### Changed

- **Entities.json schema bumped to v4** (`app/config/loader.py`, `app/api/handlers_config_save.py`)
  The on-disk format version is now `4`. Both the loader and the save handler accept v3 room formats (flat `items[]`) transparently for backward compatibility.
  - `PanelConfig._all_items()` traverses sections within rooms.
  - `PanelConfig.all_entity_ids` covers all entities across all sections.

---

## [1.3.0] — 2026-03-24

### Fixed

- **Entity registry retrieval via WebSocket API** (`app/proxy/ha_client.py`)
  The `get_entity_registry()` method previously used the REST endpoint `GET /api/config/entity_registry`,
  which does not exist as a list operation in Home Assistant. This caused the method to return HTTP 404,
  preventing the filtering of hidden and disabled entities in area imports.

  The method now uses the WebSocket command `config/entity_registry/list`, which is the authoritative
  way to retrieve all registry entries including `hidden_by` and `disabled_by` metadata.
  A short-lived WebSocket connection is established, authenticated, and closed after fetching the registry.
  This fix resolves the issue where entities marked as hidden in HA were incorrectly appearing in imported areas.

### Added

- **Light control bottom sheet** (`app/static/js/components/light-sheet.js`)
  A new global bottom sheet component provides intuitive brightness, color temperature, and RGB color control
  for light entities. Features include:
  - Brightness slider (1–255) with percentage display
  - Color temperature slider (153–500 mired) with Kelvin conversion
  - Hue slider (0–360°) with RGB preset swatches (warm white, white, blue, purple, green, red, orange, pink)
  - Live tile updates as sliders are adjusted
  - Debounced service calls to avoid overwhelming the HA API
  - Visibility toggled based on the light's `supported_features` bitmask
  - Triggered by long-press (500ms) on light tiles

- **Light tile long-press interaction** (`app/static/js/components/light.js`)
  Light tiles now support long-press (500ms hold) to open the bottom sheet for detailed control.
  Regular tap still toggles on/off. Motion detection prevents accidental long-press triggering.
  Touch-friendly implementation with mouse fallback for desktop testing.

- **Enhanced light and switch tile styling** (`app/static/js/components/light.js`, `app/static/js/components/switch.js`, `app/static/css/components.css`)
  - Light tiles display dynamic colors derived from RGB or color temperature attributes
  - Brightness percentage shown in tile value area when light is on
  - Switch tiles show fixed green color when on
  - Both entity types use `.light-tint` overlay with calculated RGBA background for visual feedback
  - Hover/active state transitions optimized for touch devices

### Changed

- **Icon rendering improvements** (`app/static/js/utils/format.js`, `app/static/js/mdi-icons.js`)
  SVG icons are now rendered with `currentColor` fill, allowing CSS color properties to control appearance.
  This enables dynamic icon coloring based on entity state without inline style manipulation.

- **HTML structure** (`app/static/index.html`)
  Light sheet component script (`light-sheet.js`) is now loaded before light tile component,
  ensuring the global `RP_LightSheet` object is available when light tiles initialize.

### Tests

- **New test suite for area handlers** (`tests/test_handlers_areas.py`)
  Nine comprehensive tests covering the `handlers_areas.get_ha_areas()` endpoint:
  - `test_basic_returns_areas`: Verifies multiple areas are returned correctly
  - `test_excluded_domains_removed`: Confirms unsupported domains (update, media_player, camera) are filtered
  - `test_hidden_entities_excluded`: Reproduces and validates fix for the registry bug (switch.bagnetto_specchio case)
  - `test_disabled_entities_excluded`: Ensures `disabled_by` entities are filtered
  - `test_hidden_by_integration_excluded`: Tests `hidden_by='integration'` filtering
  - `test_registry_failure_fallback`: Verifies graceful degradation when registry fetch fails
  - `test_template_failure_returns_502`: Confirms correct HTTP status on HA template API failure
  - `test_empty_areas`: Validates handling of empty area lists
  - `test_area_with_no_entities_after_filter`: Tests areas that become empty after entity filtering
  - Total: **9 tests**, all passing.

---

## [1.2.9] — 2026-03-24

### Fixed

- **Entity registry filter in `/api/entities`** (`app/api/handlers_entities.py`)
  The module comment incorrectly stated that the Jinja2 `states` variable excluded
  entities marked as hidden. In reality, `hidden_by` and `disabled_by` are fields
  of the HA entity registry (`/api/config/entity_registry`), not of state objects.
  The handler now cross-references the entity registry — the same pattern already
  used by `handlers_areas.py` — to exclude any entity whose `hidden_by` or
  `disabled_by` field is set. If the registry call fails, entities are still
  returned (graceful fallback) and a warning is logged.

### Added

- **Area-aware entity picker** (`app/static/js/config.js`)
  A new `haAreaMap` (area_id → [entity_ids]) is loaded from `/api/ha-areas` at
  page init. When the entity picker is opened from a room editor whose room ID
  matches a HA area ID, `renderEntityList()` pre-filters the list to show only
  entities belonging to that area.

- **Inline icon dropdown** (`app/static/js/config.js`, `config.html`, `config.css`)
  The full-screen overlay icon picker (`<section id="icon-picker" class="cfg-overlay">`)
  has been replaced with a compact inline dropdown:
  - `position: absolute` below the trigger button; `max-height: 264px`, scrollable.
  - Each row: SVG icon (22px) + human-readable label + checkmark when selected.
  - Trigger button arrow rotates when the dropdown is open.
  - Click outside closes the dropdown automatically.
  - Legacy browser compatible (no ES modules, no flex gap, no `<dialog>`).

### Tests

- Mock `_make_ha_client` updated to accept a `registry` parameter wired to
  `get_entity_registry`. Three new test cases added:
  - `test_hidden_entities_excluded_via_registry`
  - `test_disabled_entities_excluded_via_registry`
  - `test_registry_failure_falls_back_gracefully`
  - Total: **13 tests**, all passing.

---

**Document Version**: 1.1.0
**Last Updated**: 2026-03-26
