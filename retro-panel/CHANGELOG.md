# Retro Panel — Changelog

## [2.9.34] — 2026-04-06

### Fixed
- **Scenari — colore bordo non persistito**: al caricamento della config, `border_color` non veniva copiato nello `state` locale — tutti gli oggetti perdevano il colore al salvataggio successivo; ora `border_color` è incluso nel mapping degli item scenario durante l'init
- **Icona default scenario in config**: rimosso il fallback emoji 🎭 — ora default a stringa vuota così il tile usa il fallback MDI per dominio (palette/script-text/lightning-bolt)

## [2.9.33] — 2026-04-05

### Added
- **Scenari — icona e colore bordo per-item**: ogni scenario/script/automazione nella sezione Config ha ora un pulsante icona (MDI, apre icon picker) e un color picker per il bordo; i valori vengono salvati nei campi `icon` e `border_color` di `ScenarioConfig` e applicati al tile nella dashboard (bordo colorato + icona colorata)
- **Backend**: `ScenarioConfig.border_color` ora incluso nella serializzazione `GET /api/panel-config` e nel salvataggio `POST /api/panel-config`; default icona cambiato da emoji a stringa MDI vuota

### Changed
- **Config UI — scenario rows**: ogni riga mostra pulsante icona (SVG MDI 18px), info (titolo + entity_id), input colore, pulsante clear colore, pulsante rimozione; layout flex allineato

## [2.9.32] — 2026-04-06

### Changed
- **Scenario tile — redesign completo**: layout allineato a switch/light — triple-lock 120px, MDI icon in alto a sinistra (28px), badge dominio in alto a destra ("Scena" / "Script" / "Automazione"), label in basso; flash verde al tap via tint overlay + colore icona
- **Icone default scenari**: da emoji testuali (🎭⭐⚡) a nomi MDI — `palette` (scene), `script-text` (script), `lightning-bolt` (automation); supporto icon picker MDI per configurazione futura
- **Servizio per automazioni**: `automation.trigger` (era `turn_on` per tutti i domini)
- **Grid scenari**: i tile ora usano `.tile-col-compact` (3 per riga tablet, 2 su phone, 4 su landscape) invece di colonne custom non allineate
- **CSS**: rimosso `.scenario-icon/.scenario-title/.scenario-domain`; aggiunto `.scenario-badge` (chip bordo accent); rimossa animazione `scenario-activate` (sostituita da tint overlay)

## [2.9.31] — 2026-04-06

### Fixed
- **Scenari — automazioni mancanti**: `cfgFetchScenarios()` in `config-api.js` ora include `?domain=automation` oltre a `scene` e `script` — le automazioni compaiono nel picker degli scenari
- **Backend picker** `picker_entities.py`: aggiunto `"automation"` a `_ALLOWED_DOMAINS` — la richiesta `GET /api/picker/entities?domain=automation` non ritorna più 400
- **Backend service** `panel_service.py`: aggiunto `"automation"` a `_ALLOWED_DOMAINS` e `_ALLOWED_SERVICES` con servizi `trigger`, `turn_on`, `turn_off` — il pulsante scenario può ora attivare un'automazione senza essere bloccato dalla whitelist

### Changed
- Icona default automazione nel picker: ⚡ (era 🎭 come gli script)

## [2.9.30] — 2026-04-06

### Changed
- **Tab Overview — struttura riorganizzata**: "Ordine navigazione" spostato in prima posizione con proprio titolo e hint descrittivo; sezione "Overview" (nome, icona, editor entità, preview) segue sotto separata da un divisore `<hr>`
- Rimosso l'header inline `.cfg-nav-order-header` (titolo e hint ora gestiti dai tag `<h2>` e `<p class="cfg-hint">` della pagina, coerente con le altre sezioni)
- Microcopy italianizzato: "Section name" → "Nome sezione", "Icon" → "Icona", hint aggiornati

## [2.9.29] — 2026-04-06

### Fixed
- **Sensore Condizionale — layout tile**: usava classi `.sensor-info/.sensor-value/.sensor-label` non presenti in `tiles.css` — il nome e il valore si concatenavano inline senza struttura. Ora usa le stesse classi dei sensori standard: `.info` (colonna), `.name` (label in alto, 11px muted), `.val` (valore in basso, 14px bold)
- **Sensore Condizionale — colore icona**: `bubble.style.color` ora riceve lo stesso `border_color` del tile, allineato al pattern `.s-*` degli altri sensori

## [2.9.28] — 2026-04-06

### Fixed
- **Condizioni case-insensitive**: `_evalRule` in `conditional.js` ora confronta `eq`/`neq`/`contains` dopo `.toLowerCase()` su entrambi i lati — `"on"` matcha `"On"`, `"aperto"` matcha `"Aperto"`, ecc.
- **Validazione condizioni incomplete**: `commitConditionalSensor()` ora rifiuta il salvataggio se una condizione ha entità selezionata ma valore vuoto, con messaggio inline esplicito

### Changed
- **Righe condizione — grid layout**: `.cond-rule-row` passa da `flex-wrap:wrap` a `grid-template-columns: 1fr 68px minmax(72px,1fr) 28px` — ogni regola rimane su una sola riga, operatore e valore sempre allineati
- **Segmented control AND/OR**: i pulsanti AND/OR condividono bordo e border-radius → aspetto "tab" più compatto e riconoscibile
- **Separatore visivo** tra sezione proprietà (entità/icona/colore) e sezione condizioni (`<hr class="cond-section-divider">`)
- **Hint AND/OR**: testo più conciso — "Tutte le condizioni devono essere vere" / "Basta che una condizione sia vera"
- **Titolo overlay**: rimosso ❓ ridondante
- **Tooltip entity button**: `title=` con entity ID completo sul pulsante entità di ogni regola — leggibile al hover senza espandere la colonna
- **Label sezione condizioni**: "Condizioni" → "Condizioni di visibilità" — più descrittivo del contesto

## [2.9.27] — 2026-04-05

### Added
- **Ricerca icone in italiano**: l'icon picker ora comprende termini in italiano (es. "carta", "umido", "tapparella", "energia", "solare") — `_IT_EN_MAP` in `config.js` mappa ~100 termini italiani ai corrispondenti frammenti di nome MDI; `_expandQuery()` espande la query con tutti i termini inglesi associati prima di filtrare i 7.447 icone disponibili
- **Config UI — Sensori Condizionali**: pulsante "+ Add Conditional Sensor" nella sezione Overview del pannello di configurazione (`/config`) — apre un editor modale con: selezione entità principale (via entity picker), etichetta personalizzabile, icona (via icon picker), colore bordo (color picker `<input type="color">` + campo hex), toggle AND/OR per `condition_logic`, lista regole condizione ciascuna con: pulsante selezione entità, operatore (`=`, `≠`, `>`, `<`, `≥`, `≤`, `contiene`), campo valore, rimozione
- **Editor condizioni riutilizza entity picker esistente**: click su "Seleziona entità" nella regola apre il pannello picker standard con tutti i domini (sensor, binary_sensor, input_boolean, ecc.) — chiusura automatica e ritorno all'editor condizionale
- **Sensore Condizionale (`sensor_conditional`)**: nuovo tipo di item per l'Overview — tile sensore visibile solo quando la/le condizioni configurate sono soddisfatte; invisibile (display:none, nessun gap) quando la condizione è falsa
- **`conditional.js`**: componente IIFE `window.SensorConditionalComponent` — `createTile(cfg)` costruisce il tile con icona MDI + valore + label; `updateTile(tile, allStates)` valuta le condizioni sull'intera mappa stati e controlla la visibilità
- **Condizioni composte AND / OR**: `condition_logic: "and"` (default) o `"or"` — operatori supportati: `eq`, `neq`, `gt`, `lt`, `gte`, `lte`, `contains`
- **Colore bordo personalizzabile**: campo `border_color` (hex `#rrggbb`) applicato inline — `tile.style.borderColor`
- **`ConditionalRule` + `ConditionalSensorConfig`** dataclass in `loader.py`
- **`_parse_conditional_sensor()`** in `loader.py`: parsing e validazione item `sensor_conditional` da `entities.json`
- **`AppState.conditionalTiles[]`** in `app.js`: array parallelo a `energyTiles` — tutti i tile condizionali vengono re-valutati ad ogni aggiornamento di stato WebSocket

### Fixed
- **Icon picker chiudeva l'editor condizionale**: selezione di un'icona nell'editor sensore condizionale non chiude più la modale di configurazione — risolto con `setTimeout(..., 0)` che rimanda `showOverlay('conditional-editor')` al tick successivo, dopo che l'icon picker termina il suo `hideOverlay()` sincrono

### Changed
- `loader.py`: `SectionItem.type` ora accetta anche `"sensor_conditional"`; `all_entity_ids` include `entity_id` principale + tutti gli `entity` delle `conditions`
- `panel_config.py`: `_serialize_item()` serializza item `sensor_conditional` → JSON con `conditions[]`
- `panel_config_save.py`: `_parse_item()` deserializza e valida item `sensor_conditional` — valida ogni `entity` come `entity_id`, clampa `border_color` a 16 char, filtra `op` non validi
- `renderer.js`: `sensor_conditional` aggiunto a `COMPONENT_MAP`, `COL_CLASS_MAP` (`tile-col-sensor`), `_initComponents()`; `_renderItem()` gestisce `sensor_conditional` come `energy_flow` (push in `appState.conditionalTiles`, `updateTile` con `allStates`)
- `app.js`: `updateEntityState()` chiama `SensorConditionalComponent.updateTile` su tutti i `conditionalTiles` ad ogni cambio stato
- `index.html`: aggiunto `conditional.js?v=2927`; tutti i cache buster aggiornati a `v=2927`
- `config.yaml`: versione `2.9.26` → `2.9.27`

## [2.9.25] — 2026-04-05

### Added
- **Cover tile (`cover_standard`)**: nuovo componente tapparelle/volets — pulsanti Apri/Stop/Chiudi inline, barra posizione con percentuale (0–100%), stati animati `opening`/`closing` con pulse arancione, `unavailable` con opacità ridotta
- **`cover.js`**: componente IIFE, iOS 12+ safe, var-only, nessun framework — `createTile(entityConfig)` + `updateTile(tile, stateObj)`
- **CSS tapparelle** in `tiles.css`: triple-lock 120px, `.cover-top`, `.cover-btns`, `.cover-btn`, `.cover-pos-wrap`, `.cover-bar-track/.cover-bar-fill`, `.s-open/.s-closed/.s-opening/.s-closing/.s-unavail`, animazione `cover-pulse` con `-webkit-` prefix

### Changed
- `loader.py`: `_compute_layout_type()` ora riconosce dominio `cover` → `"cover_standard"`
- `renderer.js`: `cover_standard` aggiunto a `COMPONENT_MAP`, `COL_CLASS_MAP` (`tile-col-compact`), `_initComponents()`
- `index.html`: aggiunto `cover.js?v=2925`; tutti i cache buster aggiornati a `v=2925`
- `config.yaml`: versione `2.9.24` → `2.9.25`

## [2.9.24] — 2026-04-04

### Added
- **Camera lightbox — MJPEG live streaming**: tap su tile telecamera ora tenta prima lo stream MJPEG (`api/camera-proxy-stream/{entity_id}`); se HA restituisce 404 o nessun frame arriva entro 5 s, cade automaticamente a snapshot polling
- **Badge modalità lightbox**: punto verde + "Live Streaming" in modalità MJPEG; punto ambra + "Snapshot • Xs" in modalità fallback — indica chiaramente la qualità del feed
- **Backend endpoint `GET /api/camera-proxy-stream/{entity_id}`**: tunnel trasparente del flusso `multipart/x-mixed-replace` da HA via `web.StreamResponse` con `aiohttp.ClientTimeout(total=None, sock_read=30)`
- **`ha_client.get_camera_stream_request()`**: metodo che restituisce la `ClientRequest` MJPEG per pipe asincrona al browser

### Changed
- `camera.js`: `_openLightbox` imposta `img.src = 'api/camera-proxy-stream/...'` e avvia un timeout di sicurezza da 5 s; `_closeLightbox` azzera `img.src = ''` per abortire il flusso MJPEG e liberare risorse

### Fixed
- Chiusura lightbox ora interrompe affidabilmente la connessione MJPEG su iOS 12 (impostando `src` a stringa vuota prima di rimuovere l'overlay)

## [2.9.23] — 2026-04-04

### Fixed
- **Camera hidden toggle — config non si salvava**: `markDirty()` mancava in tutti gli handler della sezione telecamere (toggle visibilità, title input, refresh input, pulsante rimuovi) — il pulsante Salva non si attivava mai
- **Camera hidden — dashboard non aggiornato**: conseguenza diretta del punto precedente; il flag `hidden` non veniva mai scritto in `entities.json`, quindi il renderer del dashboard continuava a mostrare le telecamere nascoste
- **Preview sezione telecamere**: `renderCamerasPreview()` ora mostra le chip con testo barrato + opacità ridotta per le telecamere nascoste, e un badge "N nascosta/e" sul contatore totale
- **Contatore sezioni telecamere**: `renderCamSectionsList()` mostra il conteggio come "X visibili (N nascoste)" invece di contare tutte le voci
- **Loader default `refresh_interval`**: cambiato da 10 s a 3 s in `_parse_camera_section()` per allinearlo al comportamento del frontend

### Tests
- `test_invalid_refresh_interval_falls_back_to_default`: aggiornato da `== 10` a `== 3`

## [2.9.22] — 2026-04-04

### Added
- **Navigazione — drag-and-drop order in /config**: le voci della barra laterale (Overview, Rooms, Scenarios, Cameras, Allarme) sono ora riordinabili trascinando le righe nella scheda Settings; l'ordine viene salvato in `entities.json` e riflesso immediatamente nella sidebar del dashboard

### Changed
- `entities.json` ora persiste il campo `nav_order` (array di nomi di sezione) accanto agli altri dati di configurazione
- `server.py`: `POST /api/config` deserializza e salva `nav_order`; `GET /api/panel-config` lo esporta al frontend
- `app.js`: costruisce la sidebar in base all'ordine ricevuto dall'API invece dell'ordine hardcoded

## [2.9.21] — 2026-04-04

### Added
- **Camera grid — 2 colonne su mobile**: griglia telecamere ora usa 4 colonne su tablet/desktop e 2 colonne su schermi ≤ 600 px
- **Camera pagination**: sezioni telecamere con più di 4 elementi mostrano frecce prev/next per navigare le pagine — evita scroll verticale su kiosk wall-mounted
- **Camera hide toggle in /config**: ogni voce telecamera nella lista di configurazione ha un toggle "Visibile" per nascondere il feed dal dashboard senza rimuovere la configurazione
- **Camera faster refresh**: intervallo predefinito ridotto da 10 s a 3 s per snapshot più reattivi

## [2.9.20] — 2026-04-03

### Added
- **Theme toggle nel header del dashboard**: pulsante sole/luna nell'header permette di cambiare tema (dark/light/auto) direttamente dalla vista kiosk, senza accedere a `/config`

### Changed
- Tema selezionato dall'utente persistito in `localStorage` e applicato all'avvio

## [2.9.19] — 2026-04-03

### Fixed
- **Light theme — variabili CSS non applicate**: il blocco `--color-*` alias era definito in `:root` anziché in `body`; le regole `body.theme-light` non sovrascrivevano correttamente i token — spostato in `body` in `config.css`

## [2.9.18] — 2026-04-03

### Fixed
- **Light theme — FOUC in config.html**: tema iniettato lato server nell'attributo `class` di `<html>` in entrambi `index.html` e `config.html`; elimina il flash di sfondo scuro alla prima paint prima che JS applichi la classe

## [2.9.17] — 2026-04-03

### Fixed
- **Light theme — causa radice**: `element.className = 'theme-light'` sovrascriveva tutte le classi esistenti invece di aggiungere solo il tema; sostituito con `classList.remove/add`; tema ora persistito correttamente in `localStorage`

## [2.9.16] — 2026-04-03

### Fixed
- **Light theme FOUC**: flash di sfondo scuro (`#111`) visibile per ~200 ms all'avvio su light theme; aggiunto `<style>` inline in `<head>` che applica `background` prima del parsing CSS
- **HTML background bleed**: `<html>` non ereditava il colore di sfondo del tema — aggiunta regola CSS `html { background: var(--c-bg) }`

## [2.9.15] — 2026-04-03

### Fixed
- **Light theme — bug di rendering**: colori testo e bordi non si aggiornавano correttamente al cambio tema; fix variabili CSS e selettori theme-light
- **Whitelist HA translations**: aggiunto prefisso `input_boolean.*` alla whitelist dei service call per supportare toggle HA translation entities

## [2.9.14] — 2026-04-03

### Changed
- **Alarm — gerarchia status bar**: nome entità spostato in alto (centrato, 20px), badge stato spostato sotto con `margin-top: 10px` di separazione — lettura più naturale su tablet a muro
- **Alarm — sub-label modalità armata**: aggiunta riga "Modalità: Casa/Fuori/Notte" visibile nello status bar quando l'allarme è armato
- **Alarm — chip più grandi**: `flex: 1` (occupano tutta la larghezza), `min-height: 52px`, `font-size: 14px` — touch target WCAG-compliant per kiosk touch
- **Alarm — hint dinamico**: testo aggiornato in base allo scenario — "Tocca per armare" (senza codice) vs "Seleziona modalità, poi inserisci il codice" (con codice richiesto)
- **Alarm — confirm/disarm button**: `height: 52px`, `font-size: 15px`, transizione con `transform 0.1s` per feedback tattile visivo su press
- **CSS — status bar**: `text-align: center`, `padding: 20px 20px 16px`
- **CSS — entity name**: `font-size: 20px`, `display: block` (era `<span>`)
- **CSS — hint**: `font-size: 12px`, `margin-top: 8px`

## [2.9.13] — 2026-04-03

### Fixed
- **Alarm — service call bloccata con 403 (bug critico)**: `panel_service.py` usava `config.entities` come whitelist per le service call, ma `config.entities` contiene solo le entità dei layout-section — i pannelli `alarm_control_panel` sono in `config.alarms` e venivano bloccati con "Entity not in configured list". Fix: whitelist cambiata a `set(config.all_entity_ids)` che include correttamente alarm panel + zone sensors

### Tests
- Aggiunto `test_alarm_entity_in_all_entity_ids_but_not_in_entities` che documenta che `alarm_control_panel.*` deve essere in `all_entity_ids` (usato dalla whitelist di `panel_service.py`) ma NON in `cfg.entities` (soli layout entities)

## [2.9.12] — 2026-04-03

### Fixed
- **Alarm — pulsanti armo non funzionanti (bug critico)**: `pinArea` (contenente il `confirmBtn`) era dentro `disarmSection`, ma `disarmSection` ha `display:none` quando lo stato è `disarmed` — il pulsante conferma era strutturalmente irraggiungibile. Fix: `pinArea` spostata al livello `body` come elemento indipendente, con visibilità gestita autonomamente tramite la variabile `showPin`
- **Alarm — chip modalità non armavano**: `_makeChipHandler` faceva solo selezione visuale. Fix: quando `code_format=null` o `code_arm_required=false`, il tap sul chip arma direttamente via `callService` senza attendere il pulsante conferma
- **Alarm — status bar gradiente non applicato**: `barClass` in `STATE_INFO` usava nomi `alarm-bar-*` non corrispondenti alle classi CSS `s-*`. Fix: tutti i `barClass` allineati a `s-disarmed`, `s-armed`, `s-pending`, `s-triggered`
- **Alarm — badge dot/text senza colore**: il badge era un singolo `<span>` con testo unicode; CSS prevedeva struttura separata `alarm-badge-dot.dot-*` + `alarm-badge-text.text-*`. Fix: badge ristrutturato con due elementi separati per colori corretti per stato
- **Alarm — chip selezione senza effetto visivo**: `_selectModeChip` aggiungeva classe `alarm-mode-chip-selected` ma CSS definisce `.alarm-mode-chip.chip-selected`. Fix: classe corretta → `chip-selected`

### Changed
- **Alarm — chip labels**: rimossi emoji dai chip modalità (`🏠 Casa` → `Casa`, `🚗 Fuori` → `Fuori`, `🌙 Notte` → `Notte`)
- **Alarm — no-code hint**: aggiunto hint callout con bordo accent-left visibile quando non è richiesto codice per armare
- **Alarm — disarmSection semplificata**: rimossa `disarmLabel` ("Codice disarmo:"); `disarmSection` contiene solo il pulsante "Disarma" e appare solo quando armato senza codice; quando è necessario un codice è `pinArea` a gestire il disarmo via `confirmBtn`
- **CSS — status bar padding**: `padding-top` 16px → 18px (allineato al mockup)
- **CSS — entity name font-size**: 19px → 18px (allineato al mockup)
- **CSS — gradiente stati**: opacità `s-armed` 0.12→0.10, `s-pending` 0.12→0.10, `s-triggered` 0.18→0.16 (allineate al mockup)
- **CSS — alarm-no-code-hint**: stile callout con `border-left`, `background`, `border-radius` (allineato al mockup)
- **CSS — alarm-pin-area**: aggiunto `margin-top: 14px` per spaziatura corretta nel body
- **CSS — spinner doppia definizione**: `.alarm-spinner` era definito due volte; la seconda sovrascriveva (32px/0.8s) quella fedele al mockup (34px/0.75s); rimossa ridefinizione duplicata, unificata a 34px/0.75s/surface-2; `.alarm-pending-section` padding allineata al mockup (20px 0 8px); font-size msg 13px→14px; rimossi `.alarm-arming-view` e `.alarm-arming-msg` legacy

## [2.9.11] — 2026-04-03

### Fixed
- **Alarm — stato sempre "SCONOSCIUTO"**: `all_entity_ids` in `loader.py` non includeva le entità `alarm_control_panel` né i `binary_sensor` di zona → il backend le escludeva dalla whitelist, `getAllStates()` non le restituiva, e il WSProxy filtrava via tutti gli eventi `state_changed` — risultato: il tile non riceveva mai lo stato reale da HA
- **Test**: aggiunti 4 test in `test_alarm_config.py` che verificano che `all_entity_ids` includa alarm panel + zone sensors e deduplichi entità condivise

## [2.9.10] — 2026-04-03

### Fixed
- **Alarm tile — sezioni nascoste**: `renderer.js` chiamava `updateTile()` solo se lo stato HA era già in cache; se l'entità non era ancora arrivata, il tile restava vuoto (solo status bar visibile). Ora `updateTile` viene sempre chiamato con fallback `{state:'unknown'}` se lo stato non è disponibile al momento del render

### Changed
- **Alarm tile — spinner arming/disarming**: aggiunta sezione `alarm-pending-section` con spinner CSS animato e testo "Inserimento in corso…" / "Disinserimento in corso…" durante le transizioni di stato; sostituisce il corpo del tile come da mockup
- **Alarm tile — stile pulsante conferma**: pulsante "Arma" usa `btn-arm` (sfondo accent/blue), pulsante "Disarma" usa `btn-disarm-danger` (sfondo rosso pieno) — allineato al mockup; prima il pulsante non aveva stile applicato

## [2.9.9] — 2026-04-03

### Fixed
- **Alarm config — pulsante Fatto**: aggiunti pulsanti "Fatto" all'alarm entity picker e all'alarm sensor picker; prima era possibile solo premere "Annulla" anche dopo aver aggiunto elementi
- **Alarm tile — sezioni sempre visibili**: modesSection, disarmSection, triggeredBanner e pinArea ora partono nascosti (`display:none`) e vengono mostrati da `updateTile()` in base allo stato reale di HA; prima tutte le sezioni erano visibili contemporaneamente
- **Tema chiaro — valori sensori illeggibili**: rimossi colori hardcoded da `tiles.css` per `.tile-sensor` (`.name`, `.val`, `.unit`, border) — ora usano `var(--c-text-pri)`, `var(--c-text-sec)`, `var(--c-surface-3)` che si adattano al tema
- **Tema chiaro — colori hardcoded in tiles.css**: rimpiazzati `#9ca3af`, `#f9fafb`, `#374151`, `#666`, `#444`, `#888`, `#555`, `#6b7280` con variabili CSS per alarm badges, sensori di zona e stato off dei tile

## [2.9.8] — 2026-04-03

### Fixed
- **Alarm tab — layout e CSS**: aggiunto stile per `.alarm-card`, `.alarm-card-hdr`, `.alarm-sensors-hdr` in config.css; il layout ora usa le classi esistenti (`selected-row`, `selected-entity-info`, `field-row`) come le altre schede
- **Alarm pickers — layout**: aggiunti stili per `#alarm-entity-picker-header`, `#alarm-sensor-picker-header`, search wrap e list in config.css (stessi di camera-picker)
- **Alarm list render**: rewritten to use existing CSS classes — label usa `.field-row`, sensori usano `.selected-row` + `.selected-entity-info` + `.item-label-input` (stesso pattern dei tile nelle camere)

## [2.9.7] — 2026-04-03

### Added
- **Config Alarms tab**: nuovo tab "Alarms" nella pagina Settings con sezione dedicata per configurare pannelli allarme e sensori di zona
- **Alarm entity picker**: picker per selezionare `alarm_control_panel.*` da HA (max 10 allarmi)
- **Sensor zone picker**: picker per aggiungere `binary_sensor.*` a ogni allarme (max 30 sensori per allarme) con selezione device_class (porta/finestra/movimento/presenza/ecc.) e label personalizzata
- **Nav section**: nome e icona della sezione Allarme configurabili da Settings

## [2.9.6] — 2026-04-03

### Added
- **Sezione Allarme**: nuovo tab dedicato "Allarme" nella sidebar (icona shield-home), parallelo a Telecamere
- **Alarm tile dinamico**: legge da HA gli attributi `code_format`, `code_arm_required`, `supported_features` — adatta UI in tempo reale (bitmask ARM_HOME/AWAY/NIGHT/VACATION/CUSTOM/TRIGGER)
- **PIN numerico**: tastiera a 12 tasti (0-9 + canc + invio) con display asterischi e animazione shake su errore
- **Codice alfanumerico**: input text con invio da tastiera virtuale iOS
- **Badge di stato**: dot animato (blink) + testo colorato per ogni stato (disarmed/armed/pending/triggered/arming/unavailable)
- **Mode chips**: chip per ogni modalità supportata (Casa/Fuori/Notte/Vacanza/Personaliz) + chip rosso Disinserisci
- **Banner triggered**: banner rosso pulsante in stato triggered
- **Sensor zone dashboard**: ogni configurazione allarme può includere sensori `binary_sensor.*` — porte, finestre, movimento, presenza, gas, fumo, vibrazione — visualizzati come tile compatte accanto all'allarme
- **AlarmSensorComponent**: icona + nome + stato testuale + dot colorato; aggiornamenti real-time via WebSocket come tutti gli altri tile
- **Backend loader**: dataclass `AlarmConfig` + `AlarmSensorConfig`, `_parse_alarm()` con validazione prefissi; tuple `_load_layout` estesa a 14 elementi
- **API panel_config**: esporta `alarms[]` e `alarms_section` al frontend
- **API panel_config_save**: parsing e salvataggio configurazione allarme + sensori (max 10 allarmi, 30 sensori)

## [2.9.5] — 2026-04-03

### Changed
- **Energy card**: barre colorate per ogni metrica con scala semantica — solare rosso→verde (0–6 kW), casa verde→rosso (0–3.5 kW), batteria rosso→verde (0–100%), rete blu→rosso (prelievo) / blu→verde (immissione)
- **Energy card**: colore batteria SOC dinamico (hsl interpolato) — rimosso overide statico caution/warning
- **Energy card**: label metriche (Casa, Solare, ecc.) da 11px a 12px font-weight 600
- **Energy card**: timestamp "Aggiornato HH:MM:SS" ad ogni refresh WebSocket

## [2.9.4] — 2026-04-03

### Security
- **S-01** IP whitelist per accesso diretto porta 7654: nuovo campo `allowed_direct_ips` in options.json (default `0.0.0.0/0` = aperto); le connessioni via HA Ingress bypassano sempre il controllo
- **S-02/S-03** Picker entities/areas/cameras e `POST /api/config` ora restituiscono 403 se acceduti direttamente senza HA Ingress (`X-Ingress-Path` assente)
- **S-04** Rate limiter servizi: usa `X-Forwarded-For` solo su connessioni Ingress; su porta diretta usa `request.remote` per prevenire spoofing header
- **S-06** CSP: rimosso `'unsafe-inline'` da `script-src` (nessuno script inline nel pannello)
- Alarm control panel: rate limit dedicato 3 tentativi/30s con lockout 60s su porta diretta

### Fixed
- **Energy card**: sensori `unavailable`/`unknown` in HA ora mostrano stato grigio "Dati non disponibili" invece di interpretare il valore come 0
- **Camera lightbox**: polling live 10s durante apertura; chiusura affidabile su iOS 12 via `touchend` su backdrop e pulsante ✕
- **Scenari**: chiamate a `scene.*` e `script.*` non restituiscono più 400 (domini aggiunti alla allowlist servizi)
- **App boot**: rimosso `async/await` e `AbortController` — `api.js` e `app.js` ora usano Promise chain compatibili iOS 12

### Changed
- **UI**: font secondari 10px → 11px (label sensori, energy card, scenari)
- **UI**: swatches colore bottom sheet 36px → 44px (touch target Apple HIG)
- **UI**: pulsante ✕ lightbox camera 38px → 44px; sidebar toggle 40px → 44px
- **UI**: testo italiano ovunque (loading screen, banner riconnessione, bottom sheet)
- **Scenarios grid**: convertito da CSS Grid a flex con negative margin (compatibilità iOS 12)
- **Test**: `test_handlers_entities.py` aggiornato al nuovo modulo `picker_entities` (13 test ora inclusi nella suite)

---

## [2.9.3] — 2026-04-02

### Added
- Porta 7654 esposta per accesso diretto (bypass login HA per browser legacy iOS 12)

## [2.9.2] — 2026-04-02

### Fixed
- Energy semaforo: verde solo se solare > consumo casa (surplus reale); giallo per batteria in uso o solare = consumo; il surplus mostra i kW di scarica batteria quando solare assente

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.9.1] — 2026-04-02

### Changed
- Camera tiles: griglia 4 colonne (da full-width) con proporzione 16:9
- Camera tiles: tap su tile apre lightbox fullscreen con snapshot live e pulsante ✕ per chiudere

---

## v2.9.0 — 2026-03-30

### New
- **Energy Card v2 — Design G**: tile semaforo verde/giallo/rosso con stato actionable immediato
  - 🟢 **Verde** (Ottimo momento!): solare attivo, surplus disponibile per elettrodomestici
  - 🟡 **Giallo** (Usa con moderazione): solo batteria, solare spento
  - 🔴 **Rosso** (Evita elettrodomestici): prelievo dalla rete, costo elevato
  - Progress bar: % consumo casa coperto dal solare
  - 4 metriche secondarie: solare, casa, batteria SOC + barra, rete
- **7 entità separabili**: `solar_power`, `home_power`, `battery_soc`, `battery_charge_power`, `battery_discharge_power`, `grid_import`, `grid_export`
- **Wizard a 7 step** aggiornato in /config per associare ogni entità
- Backward compat: config esistenti con `battery_power`/`grid_power` restano validi, i nuovi campi appaiono vuoti (riconfigurare via wizard)

---

## [2.8.5] — 2026-03-30

### Added
- Alarm tile: CSS completo per keypad, PIN display, state badge (disarmed/armed/pending/triggered) e bottoni azione con colori semantici — il tile era HTML senza stili
- Sidebar collapse: `#sidebar.collapsed` CSS — il toggle button ora collassa/espande correttamente la sidebar a 64px icon-only
- Toggle icon sidebar cambia da `☰` a `›` al collapse e viceversa

### Fixed
- Rooms list nella sidebar non prendeva tutta l'altezza disponibile: `sidebar-spacer` (flex:1) competeva con `#sidebar-nav` (flex:1) — ora `flex:0`
- Alarm `layout_type` sovrascrivibile da stale `visual_type` in entities.json: i tipi domain-locked (`alarm_control_panel`, `camera`, `scenario`) ora vengono risolti prima del check `visual_type`
- `rooms-menu` button mancava del `data-section` attribute — stato `.active` ora funziona correttamente
- Navigare a Overview/Scenarios/Cameras dal submenu rooms non tornava al menu principale

### Changed
- Sidebar restyling: touch target minimo 44px, indicatore blu a sinistra su voce attiva, icone centrate 22px, label con `flex:1`, scrollbar sottile 3px
- Sensor tile: 4 per riga su iPad landscape (≥1024px: 25%), 5 per riga a 1440px, 6 per riga a 1800px
- Illuminance sensor usa ora icona `brightness5` (corretta chiave MDI — era `brightness-5` inesistente)

---

## [2.8.2–2.8.4] — 2026-03-30

### Added
- `sensor.js`: approccio HA-first per icona e `layout_type` — `attrs.icon` (strip `mdi:`), `attrs.device_class` → layout, `_ICON_FOR_LAYOUT` come fallback. Risolve icone sbagliate senza dover configurare manualmente ogni entità
- `_computeLayoutFromDC()` in sensor.js: mirror JS di `_compute_layout_type` in loader.py, completo di tutti i device_class sensor e binary_sensor
- Breakpoint desktop ≥1440px e ≥1800px per tile sensori

### Fixed
- Icone sensori Aqara (umidità, illuminanza, temperatura) mostravano cerchi: risolto con chain HA-first in `updateTile()`
- `_DC_ICON_MAP` in loader.py ritornava nomi MDI diretti non presenti in `DOMAIN_ICONS` — `format.js` ora usa `DOMAIN_ICONS[key] || key || 'circle'`

---

## [2.8.0] — 2026-03-30

### Changed
- Sensor e binary sensor tile redesign v4: bubble 22×22px senza background, classe `.s-*` sul tile root controlla simultaneamente bordo e colore icona, span `.unit` separato per l'unità di misura
- Stato inattivo (binary off) usa ora `.s-off` — bordo e icona grigi `#6b7280` uniformi
- Luci e switch in stato OFF mostrano ora bordo e icona grigi `#6b7280` (era bordo trasparente)
- Rimossi ~50 classi CSS `sri-*` / `srt-*` rimpiazzate da ~65 classi `.s-*` con pattern unificato

### Fixed
- `binary_smoke`, `s-co2-critical`, `s-gas-critical` mantengono l'animazione `critical-pulse`
- Tile sensore che tornano da `unavailable` ora puliscono correttamente le classi stato precedenti

---

## [2.7.0] — 2026-03-30

### Changed
- `theme: auto` ora segue correttamente la preferenza del sistema operativo (`prefers-color-scheme: light`) — in precedenza il pannello restava sempre dark
- Rimossa l'opzione `kiosk_mode` dalla configurazione add-on: non aveva effetti visivi e il kiosk su HA si gestisce esternamente con [kiosk-mode](https://github.com/NemesisRE/kiosk-mode) (HACS)

### Docs
- Aggiunta guida per nascondere sidebar/header HA con kiosk-mode (HACS) in DOCS.md e INSTALLATION.md

---

## [2.6.1] — 2026-03-30

### Added
- Long-press gesture (800ms) on the panel title forces a hard reload via a cache-busting URL (`?_r=<timestamp>`) — useful on iOS kiosk where clearing the browser cache is not practical
- Touch and mouse support: `touchstart`/`touchend`/`touchmove`/`touchcancel` + `mousedown`/`mouseup`/`mouseleave`
- Visual feedback: title dims to 40% opacity during hold, restores before reload
- `#panel-title` receives `-webkit-user-select: none` to prevent accidental text selection on long-press

---

## [2.6.0] — 2026-03-30

### Added
- Four new binary sensor layout types: `binary_smoke` (smoke/gas/CO — critical alert), `binary_moisture` (moisture/wet — alert), `binary_lock` (lock — alert), `binary_vibration` (vibration/tamper — alert)
- `binary_window` and `binary_presence` layout types now fully registered end-to-end

### Fixed
- `window` device_class was incorrectly mapped to `binary_door` — now correctly maps to `binary_window`
- `occupancy` and `presence` device_classes were mapped to `binary_motion` — now correctly map to `binary_presence`
- `smoke`, `gas`, `carbon_monoxide` device_classes were mapped to `binary_standard` — now map to `binary_smoke`
- `sensor.js` no longer reads `attrs.device_class` in the binary render path — `loader.py` is now the sole source of truth for `layout_type` mapping

---

## [2.3.3] — 2026-03-29

### Fixed
- Cache-buster `?v=233` aggiunto a tutti i 20 asset statici di `index.html` (CSS + JS) — browser e Cloudflare ora invalidano correttamente la cache ad ogni release
- `binary_presence` registrato nel `COMPONENT_MAP` e `COL_CLASS_MAP` di `renderer.js` (mappato su `SensorComponent`) — tile presenza non erano visibili
- Migrazione automatica icona `toggle` → `power` per entità `switch.*` e `input_boolean.*` esistenti in `entities.json`
- Esteso `check_release.sh` per verificare i cache-buster anche in `index.html` (pre-push hook ora copre entrambe le pagine)

---

## [2.3.2] — 2026-03-29

### Fixed
- Backend, drag listeners, and CSS layout: applied all critical/high severity bugfixes identified in last audit (commit `ced1721`)
- Cloudflare tag handling: correct pipeline behaviour for Cloudflare-tagged releases
- Pre-push pipeline: release version consistency check enforced via `check_release.sh` + `.githooks/pre-push` hook (commit `c54dfb0`)

---

## [2.3.1] — 2026-03-28

### Added
- Light layout types: `light_standard`, `light_dimmer`, `light_rgb`, `light_legacy` — mode-aware tile rendering and bottom sheet variant per subtype
- CI: `scripts/check_release.sh` release version consistency check script
- CI: `.githooks/pre-push` hook that runs `check_release.sh` before every push

### Changed
- `picker_areas`: area fallback now resolves at device level (reads `area_id` from the device, not the entity) when entity has no direct area assignment
- Switch default icon changed from `toggle` to `power` (⏻) for clearer semantics

### Fixed
- Icon picker virtual scroll: guard against empty list on initial render
- Icon picker virtual scroll: incorrect `padding-bottom` (`ipp`) calculation corrected
- Icon picker virtual scroll: `requestAnimationFrame` throttle applied to scroll handler to prevent layout thrashing
- Cache-buster `?v=231` appended to all static assets referenced in `config.html`

---

## [2.3.0] — 2026-03-28

### Added
- Full MDI icon set (~7 447 icons) replaces the previous 124-icon subset
- Icon picker: recently-used row (localStorage, max 20, most-recent first)
- Icon picker: virtual scrolling — only visible rows rendered for smooth performance
- Icon picker: result count label and debounced search (80 ms)
- `scripts/generate-mdi-icons.js` — Node.js script to regenerate icons from @mdi/js

---

## [2.2.0] — 2026-03-28

### Fixed
- C1: Config — dirty flag on unsaved changes; `beforeunload` warning prevents accidental navigation
- C2: Config — two-step confirm (first click → "Sure?", 2 s auto-reset) before section deletion
- C3: Config — all Italian strings translated to English ("Telecamere" → "Cameras", placeholders, hints)
- C4: Config — `.section-row:hover` background highlight + right chevron for clarity
- C5: Config — room section title input fires real-time list update on every keystroke
- C6: Config — `#save-feedback` base CSS color changed from danger red to neutral
- D1: Kiosk — tiles show grayscale filter (`content-stale` class) when WebSocket is disconnected
- D2: Kiosk — section heading font-size increased from 11 px to 12 px for legibility
- D3: Kiosk — `.banner-dot` CSS defined (blinking red indicator on disconnect banner)
- D4: Kiosk — scenario tile shows press-effect animation + accent border on activation tap
- E3: Backend — invalid scenario entity IDs now return HTTP 400 (consistent with rooms)
- E5: Renderer — removed dead functions `_renderScenariosSection` and `_renderCamerasSection`

### Tests
- Added `test_scenario_invalid_entity_id_rejected` and `test_scenario_valid_entity_id_accepted`

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
