# Energy Card v2 — Design G + 7-sensor Wizard

## Overview

Redesign completo del componente `energy_flow` di Retro Panel:

1. **Visual Design G** — tile "semaforo" con stato verde/giallo/rosso immediatamente leggibile, testo actionable ("Ottimo momento!" / "Usa con moderazione" / "Evita elettrodomestici"), surplus solare in kW, metriche secondarie compatte.
2. **Modello dati esteso** — 7 entità separate invece di 5: le entità batteria e rete vengono sdoppiate (carica/scarica, prelievo/immissione) poiché l'impianto dell'utente espone sensori separati per i due flussi.
3. **Wizard a 7 step** — aggiornamento dell'editor energy in config.html/config.js.

---

## 1. Modello dati — `EnergyFlowConfig`

### Campi attuali (v1, da deprecare ma mantenere per backward compat)
```
solar_power, battery_soc, battery_power, grid_power, home_power
```

### Nuovi campi (v2, 7 entità)
| Campo | Descrizione | Unità | Segno atteso |
|-------|-------------|-------|-------------|
| `solar_power` | Produzione fotovoltaico | W | sempre ≥ 0 |
| `home_power` | Consumo casa totale | W | sempre ≥ 0 |
| `battery_soc` | State of charge batteria | % | 0–100 |
| `battery_charge_power` | Potenza carica batteria | W | ≥ 0 quando in carica |
| `battery_discharge_power` | Potenza scarica batteria | W | ≥ 0 quando in scarica |
| `grid_import` | Prelievo dalla rete | W | ≥ 0 quando si preleva |
| `grid_export` | Immissione in rete | W | ≥ 0 quando si immette |

### Backward compatibility
`_parse_energy_flow` accetta ancora `battery_power` e `grid_power` (vecchio formato): se presenti e i nuovi campi sono assenti, i nuovi campi restano vuoti — il tile mostrerà `—` per quei valori. Nessuna migrazione automatica: l'utente riconfigura via wizard.

---

## 2. Logica stato semaforo

Il componente calcola uno stato (`go` / `caution` / `stop` / `idle`) in `updateTile`:

```
THRESHOLD = 10  (W — soglia rumore sensore)

se grid_import > THRESHOLD:
    stato = 'stop'    # rosso — prelievo rete
altrimenti se solar > THRESHOLD:
    stato = 'go'      # verde — solare attivo
altrimenti se battery_discharge > THRESHOLD:
    stato = 'caution' # giallo — solo batteria
altrimenti:
    stato = 'idle'    # grigio — notte/tutto spento
```

**Surplus solare** = `solar - home` (mostrato solo se `stato == 'go'`; se negativo = "copre parzialmente").

**Valore `.ef-surplus` per stato:**
| Stato | Valore | Unità | Label |
|-------|--------|-------|-------|
| `go` | `solar - home` (es. `+1.8`) | `kW disponibili` | `surplus solare` |
| `caution` | `battery_soc` (es. `72%`) | `` | `batteria disponibile` |
| `stop` | `grid_import` (es. `0.8`) | `kW prelievo` | `costo in corso` |
| `idle` | `—` | `` | `nessuna produzione` |

**Progress bar width** = `Math.min(100, (solar / Math.max(home, 0.001)) * 100)` → mostra % consumo casa coperta dal solare. 0% di notte, 100% quando solare ≥ consumo.

**Testi per stato:**
| Stato | Titolo | Sottotitolo |
|-------|--------|-------------|
| `go` | Ottimo momento! | ☀️ Solare attivo · Avvia lavatrice o lavastoviglie |
| `caution` | Usa con moderazione | 🔋 Solo batteria · Solare spento · Evita carichi pesanti |
| `stop` | Evita elettrodomestici | ⚡ Prelievo rete · Costo elevato · Aspetta il solare |
| `idle` | Nessuna produzione | Notte · Tutti i sistemi a riposo |

---

## 3. Struttura DOM del tile (Design G)

```html
<div class="tile ef-state-go" data-layout-type="energy_flow">
  <div class="ef-hero">
    <div class="ef-semaforo">
      <div class="ef-dot ef-dot-go"></div>
      <div class="ef-dot ef-dot-caution"></div>
      <div class="ef-dot ef-dot-stop"></div>
    </div>
    <div class="ef-action">
      <div class="ef-action-main">Ottimo momento!</div>
      <div class="ef-action-sub">☀️ Solare attivo · Avvia lavatrice o lavastoviglie</div>
    </div>
    <div class="ef-surplus">
      <div class="ef-surplus-val">+1.8</div>
      <div class="ef-surplus-unit">kW disponibili</div>
      <div class="ef-surplus-lbl">surplus solare</div>
    </div>
  </div>
  <div class="ef-progress">
    <div class="ef-progress-fill"></div>
  </div>
  <div class="ef-metrics">
    <div class="ef-metric ef-metric-solar">
      <div class="ef-metric-icon">☀️</div>
      <div class="ef-metric-val">3.1 kW</div>
      <div class="ef-metric-lbl">Solare</div>
    </div>
    <div class="ef-metric ef-metric-home">
      <div class="ef-metric-icon">🏠</div>
      <div class="ef-metric-val">1.3 kW</div>
      <div class="ef-metric-lbl">Casa</div>
    </div>
    <div class="ef-metric ef-metric-battery">
      <div class="ef-metric-icon">🔋</div>
      <div class="ef-metric-val">72%</div>
      <div class="ef-metric-lbl">Batteria</div>
      <div class="ef-batt-bar"><div class="ef-batt-fill"></div></div>
    </div>
    <div class="ef-metric ef-metric-grid">
      <div class="ef-metric-icon">⚡</div>
      <div class="ef-metric-val">0 W</div>
      <div class="ef-metric-lbl">Rete</div>
    </div>
  </div>
</div>
```

**Nota CSS legacy (iOS 12):** nessun `gap`, nessun `const`/`let`, nessuna arrow function nel JS. CSS usa `-webkit-flex` e `calc()`.

---

## 4. CSS — nuove classi in `tiles.css`

Aggiungere alla fine di `tiles.css` (~80 righe):

**Tile root:** `.tile[data-layout-type="energy_flow"]` → `padding: 0; overflow: hidden; cursor: default`

**Stato sul root:** `.ef-state-go`, `.ef-state-caution`, `.ef-state-stop`, `.ef-state-idle` — cambiano colore di testo e barra.

**Semaforo:** `.ef-semaforo` — flex column, 3 dot 12×12px, gap 4px. Dot inattivo = `#2e3347`, attivo con `box-shadow` colorato.

**Hero:** `.ef-hero` — flex row, align-items center, gap 14px, padding 18px 18px 12px.

**Surplus:** `.ef-surplus` — text-align right, margin-left auto.

**Progress bar:** `.ef-progress` — height 4px, background `var(--c-surface-2)`. `.ef-progress-fill` — width dipende dal surplus (calcolato nel JS via `style.width`).

**Metriche:** `.ef-metrics` — flex row, border-top `var(--c-surface-2)`. `.ef-metric` — flex 1, padding 11px 10px, text-align center, border-right.

**Batteria SOC bar:** `.ef-batt-bar` — height 3px, margin-top 4px, background `var(--c-surface-2)`. `.ef-batt-fill` — width = SOC%, color `var(--c-accent)` se `go`, giallo se `caution`.

---

## 5. Wizard a 7 step — config.html + config.js

### config.html

Sostituire il blocco `#energy-wizard-steps` (attuale: 5 step dots + 4 linee) con 7 step dots + 6 linee.

Sostituire i 5 `<input hidden>` con 7:
```html
<input id="ef-solar"         type="text" readonly>
<input id="ef-home"          type="text" readonly>
<input id="ef-batt-soc"      type="text" readonly>
<input id="ef-batt-charge"   type="text" readonly>
<input id="ef-batt-discharge" type="text" readonly>
<input id="ef-grid-import"   type="text" readonly>
<input id="ef-grid-export"   type="text" readonly>
```

### config.js

**`wizardValues`** (riga ~55): aggiornare a 7 chiavi.

**`WIZARD_STEPS`** (riga ~2188): sostituire con 7 step:
```
Step 1/7 — ☀️ Produzione solare    → ef-solar
Step 2/7 — 🏠 Consumo casa         → ef-home
Step 3/7 — 🔋 SOC batteria (%)     → ef-batt-soc
Step 4/7 — ⬆️ Carica batteria      → ef-batt-charge
Step 5/7 — ⬇️ Scarica batteria     → ef-batt-discharge
Step 6/7 — ⬇️ Prelievo rete        → ef-grid-import
Step 7/7 — ⬆️ Immissione rete      → ef-grid-export
```

**`commitEnergyCard`**: costruire oggetto con 7 campi.

**`showEnergyEditor`** (lettura item esistente): leggere 7 campi.

---

## 6. app.js — trigger update energia

Riga ~79: il confronto `entityId === cfg.battery_power || entityId === cfg.grid_power` va aggiornato con i 7 campi:
```js
entityId === cfg.solar_power ||
entityId === cfg.home_power ||
entityId === cfg.battery_soc ||
entityId === cfg.battery_charge_power ||
entityId === cfg.battery_discharge_power ||
entityId === cfg.grid_import ||
entityId === cfg.grid_export
```

---

## 7. loader.py — `entity_ids` collection (riga ~286)

Il metodo che raccoglie tutti gli entity_id per la subscription WS deve iterare sui 7 campi del nuovo `EnergyFlowConfig`, non sui 5 vecchi.

---

## 8. Test (TDD — scritti prima dell'implementazione)

File: `retro-panel/tests/test_energy_config.py`

```python
# test_parse_energy_flow_7_fields
# test_parse_energy_flow_empty_fields_default_to_empty_string
# test_parse_energy_flow_backward_compat_ignores_old_battery_power
# test_parse_energy_flow_backward_compat_ignores_old_grid_power
# test_entity_ids_collects_all_7_energy_fields
# test_entity_ids_skips_empty_energy_fields
```

---

## 9. Versioning

- Versione: **v2.9.0** (nuova feature, minor bump)
- Cache-buster: `?v=290`
- Occorrenze `index.html`: ~20, `config.html`: ~5
- CHANGELOG e ROADMAP aggiornati nello stesso commit

---

## 10. File da modificare

| File | Tipo modifica |
|------|--------------|
| `retro-panel/app/config/loader.py` | `EnergyFlowConfig` 7 campi + `_parse_energy_flow` + `entity_ids` |
| `retro-panel/app/static/js/components/energy.js` | Riscrittura completa — Design G |
| `retro-panel/app/static/css/tiles.css` | ~80 righe nuove classi `.ef-*` |
| `retro-panel/app/static/js/app.js` | Trigger update: 7 campi energy |
| `retro-panel/app/static/js/config.js` | Wizard 7 step + commitEnergyCard |
| `retro-panel/app/static/config.html` | 7 step dots + 7 hidden inputs |
| `retro-panel/app/static/index.html` | Cache-buster bump `?v=290` |
| `retro-panel/tests/test_energy_config.py` | NUOVO — 6 test TDD |
| `retro-panel/config.yaml` | `version: "2.9.0"` |
| `retro-panel/CHANGELOG.md` | Entry v2.9.0 |
| `docs/ROADMAP.md` | v2.9 sezione + tabella versioni |

**Non toccare:** `renderer.js` (già gestisce `energy_flow` correttamente), `sensor.js`, `loader.py` `_compute_layout_type`.
