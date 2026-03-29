# Retro Panel — Project Rules for Claude

## 1. Flusso di sviluppo obbligatorio (Superpowers)

Ogni nuova feature o modifica non banale segue questo flusso:

1. **Brainstorming** (`superpowers:brainstorming`) — spec approvata dall'utente e committata in `docs/superpowers/specs/`
2. **Piano** (`superpowers:writing-plans`) — piano committato in `docs/superpowers/plans/`
3. **Implementazione** (`superpowers:subagent-driven-development`) — fresh subagent per task, spec review + code quality review dopo ogni task

Non scrivere codice prima che la spec sia approvata. Non iniziare un task senza piano.

## 2. Pipeline obbligatoria prima di ogni `git push`

In ordine:

1. **Aggiorna la documentazione di progetto** — ROADMAP.md, CHANGELOG, PROJECT.md devono riflettere la versione corrente. Se una feature è stata rilasciata, aggiornare lo status in ROADMAP.md (`[ ]` → `[x]`).
2. **Esegui i test** — `py -m pytest tests/ --ignore=tests/test_handlers_entities.py -q` deve passare senza errori.
3. **Verifica il pre-push hook** — `scripts/check_release.sh` verificherà automaticamente versione e cache-buster.
4. **Poi** `git push`.

Non saltare questi step. Il pre-push hook blocca push con versione/cache-buster inconsistenti — se fallisce, correggi il problema, non aggirarlo.

## 3. Vincoli JS — index.html (dispositivi legacy non aggiornati)

Il pannello principale (`/`) gira su dispositivi non più aggiornati (target reale: iPad iOS 12.5.8, WebKit legacy). Vincoli **tassativi**:

- Solo `var` — mai `const` o `let`
- Solo `function` keyword — mai arrow functions `=>`
- Solo regular scripts — mai `type="module"` / ES Modules / `import` / `export`
- Pattern obbligatorio: IIFE + `window.NomeComponente = {...}`
- **Vietato**: optional chaining `?.`, nullish coalescing `??`, `structuredClone()`, `.at()`, `Promise.allSettled`, top-level await, CSS `gap` in Flexbox, `dialog` element, `:has()`, CSS container queries

## 4. Vincoli JS — config.html (solo desktop)

La pagina `/config` è accessibile solo da browser desktop. Non si applicano le restrizioni legacy: si possono usare liberamente `const`/`let`, arrow functions, template literals, optional chaining, Drag & Drop API.

## 5. Architettura: loader.py è l'unica fonte di verità per layout_type

`_compute_layout_type()` in `app/config/loader.py` è il punto unico dove `device_class` → `layout_type`. Il frontend (`sensor.js`, `renderer.js`) legge solo `tile.dataset.layoutType` e non ri-legge `attrs.device_class` per decisioni di rendering.

Ogni nuovo `layout_type` deve essere registrato in:
- `loader.py` `_compute_layout_type()` (backend)
- `sensor.js` `INITIAL_BUBBLE_CLASS` + `updateTile()` (frontend)
- `config.js` `VISUAL_OPTIONS` + `_getVisualTypeLabel` (picker)
- `renderer.js` `COMPONENT_MAP` + `COL_CLASS_MAP` + `_initComponents()` (render engine)

## 6. Versioning e cache-buster

Ad ogni release (anche PATCH):

- `retro-panel/config.yaml`: `version: "X.Y.Z"`
- `retro-panel/app/static/index.html`: tutti i `?v=XYZ` aggiornati (20 occorrenze)
- `retro-panel/app/static/config.html`: tutti i `?v=XYZ` aggiornati (5 occorrenze)
- Cache-buster format: versione senza punti, es. v2.6.0 → `?v=260`

Il pre-push hook `check_release.sh` verifica l'allineamento automaticamente.

## 7. TDD per il backend Python

Ogni modifica a `loader.py`, `validator.py`, o a qualsiasi file in `app/config/` richiede test scritti **prima** dell'implementazione. I test vanno in `retro-panel/tests/` e seguono il pattern del progetto (`sys.path.insert`, import diretto del modulo).

Il file di test deve essere committato **insieme** al codice che implementa.

## 8. Sicurezza — regole non derogabili

- Il token HA non deve mai apparire in risposte HTTP o nel codice frontend
- Il token vive solo in `/data/options.json` (container) e in memoria server-side
- Whitelist servizi: `light`, `switch`, `alarm_control_panel`, `input_boolean`, `cover`
- Non espandere la whitelist senza consenso esplicito dell'utente

## 9. Documentazione: dove leggere prima di modificare

Prima di proporre modifiche architetturali, leggere:

- `docs/ARCHITECTURE.md` — design complessivo e invarianti
- `docs/API.md` — endpoint e protocolli interni
- `docs/ROADMAP.md` — feature previste e versioni pianificate

La policy sul config schema è **solo additive** nelle minor version: nessun campo obbligatorio nuovo senza migration path.

## 10. Aggiornamento documentazione pubblicata su GitHub

Prima di ogni `git push` (incluso tag di release), la documentazione pubblica deve essere aggiornata:

- `docs/ROADMAP.md` — marcare come `[x]` le feature rilasciate nella versione corrente, aggiornare la versione corrente stabile
- `docs/ARCHITECTURE.md` — se sono stati aggiunti nuovi layout_type, componenti, o endpoint
- `docs/API.md` — se sono stati aggiunti o modificati endpoint
- `retro-panel/CHANGELOG.md` (se esiste) — aggiungere entry per la versione

**Non fare push di una release senza che ROADMAP.md rifletta lo stato reale del progetto.**
