# Retro Panel — Project Rules for Claude

## 1. Flusso di sviluppo obbligatorio (Superpowers)

Ogni nuova feature o modifica non banale segue questo flusso:

1. **Brainstorming** (`superpowers:brainstorming`) — spec approvata dall'utente e committata in `docs/superpowers/specs/`
2. **Piano** (`superpowers:writing-plans`) — piano committato in `docs/superpowers/plans/`
3. **Implementazione** (`superpowers:subagent-driven-development`) — fresh subagent per task, spec review + code quality review dopo ogni task

Non scrivere codice prima che la spec sia approvata. Non iniziare un task senza piano.

**Qualsiasi implementazione (codice, CSS, backend, test, documentazione) deve essere eseguita da agenti specializzati, mai direttamente da Claude nella conversazione principale.** Claude coordina e verifica; gli agenti implementano.

Routing agenti consigliato:
- Backend Python → `backend-developer` o `python-pro`
- Frontend JS/CSS → `frontend-developer` o `javascript-pro`
- Bug analysis → `debugger` (vedi §11)
- Test e debug → `test-debug-reviewer`
- Review qualità → `code-quality-guardian` o `superpowers:code-reviewer`
- Documentazione → `project-doc-guardian`
- Pubblicazione → `git-workflow-deploy-specialist`

## 2. Pipeline obbligatoria prima di ogni `git push`

In ordine:

1. **Aggiorna `retro-panel/config.yaml`** — `version:` deve corrispondere alla versione che si sta rilasciando.
2. **Aggiorna la documentazione** (stesso commit o commit immediatamente precedente):
   - `retro-panel/CHANGELOG.md` — aggiungere entry per ogni versione rilasciata nel push
   - `docs/ROADMAP.md` — aggiornare sezione versione corrente (feature/fix `[x]`) e tabella versioni
   - `docs/ARCHITECTURE.md` / `docs/API.md` — solo se sono stati aggiunti layout_type, componenti o endpoint
3. **Esegui i test** — `py -m pytest tests/ --ignore=tests/test_handlers_entities.py -q` deve passare senza errori.
4. **Verifica il pre-push hook** — `scripts/check_release.sh` verificherà automaticamente versione e cache-buster.
5. **Poi** `git push`.

**Questi step possono essere delegati a un agente** (`project-doc-guardian` o `documentation-engineer`) — non è necessario che Claude li esegua direttamente.

**Conferma utente obbligatoria**: prima di eseguire `git push` presentare sempre un riepilogo delle modifiche e attendere il "ok" esplicito dell'utente. Non pubblicare mai autonomamente.

Per push non banali è preferibile delegare a `git-workflow-deploy-specialist` che gestisce push, verifica CI e conferma il completamento.

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

Prima di ogni `git push` (incluso PATCH), la documentazione pubblica deve essere aggiornata (vedi §2 per la checklist completa):

- `retro-panel/CHANGELOG.md` — **obbligatorio ad ogni push**, entry per ogni versione
- `docs/ROADMAP.md` — marcare `[x]` le feature rilasciate, aggiornare versione stabile corrente
- `docs/ARCHITECTURE.md` — se aggiunti nuovi layout_type, componenti, o endpoint
- `docs/API.md` — se aggiunti o modificati endpoint

**Non fare push senza che CHANGELOG.md e ROADMAP.md riflettano lo stato reale.**

Questo step può essere delegato all'agente `project-doc-guardian`.

## 11. Analisi bug — sempre via agente specializzato

L'analisi di file per individuare bug deve essere eseguita dall'agente `debugger` o dallo specialista appropriato (`python-pro`, `javascript-pro`), non da Claude direttamente nella conversazione principale.

**How to apply:** Quando c'è un bug da investigare, delegare a `debugger`. Claude coordina e interpreta il risultato, ma non analizza il codice da solo.

## 12. Verifica GitHub Actions dopo ogni push

Dopo ogni `git push`, il push non si considera completato finché i workflow GitHub Actions non risultano tutti `completed / success`.

```bash
gh run list --repo paolobets/retro-panel --limit 5
```

Verificare che:
1. Tutti i workflow del commit siano `completed`
2. Nessun workflow sia `failed` o bloccato in `in_progress`

Se un workflow fallisce, investigare e correggere prima di considerare la release conclusa.

## 13. Mockup obbligatorio prima di modifiche grafiche

Qualsiasi modifica all'interfaccia grafica (layout, componenti, colori, dimensioni tile, nuove schermate) segue tre fasi obbligatorie:

1. **Mockup prima del codice** — creare un mockup visivo e presentarlo all'utente
2. **Conferma utente del mockup** — nessun codice frontend scritto prima dell'approvazione
3. **Verifica UI/UX post-implementazione** — l'agente `ux-ui-specialist` esegue una review finale

I mockup approvati vivono in `mockups/` e sono la specifica autoritativa dell'interfaccia. Il codice deve corrispondere al mockup, non viceversa.

**Eccezione**: bug fix puntuali a CSS esistente (es. correzione di una misura sbagliata) non richiedono mockup.

## 14. Coerenza stile — nessuna regressione

Quando si aggiunge un nuovo componente, tile o funzionalità:

1. **Stesso stile visivo** — token CSS `var(--)`, spaziature, pattern touch, breakpoint devono essere coerenti con i componenti esistenti
2. **Nessuna regressione** — non rompere componenti esistenti, non modificare CSS condivisi in modo da alterare tile già funzionanti
3. **Rifacimento completo** — se si decide di rifare un componente esistente (non solo fix), si applica la Regola 13 (mockup → conferma → implementazione → verifica)

Prima di scrivere CSS per un nuovo componente, leggere i token esistenti in `tokens.css` e verificare che le nuove regole non alterino il comportamento di componenti già presenti.
