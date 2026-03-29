# Design Spec — Sensor Visual System v2.4.0

**Date:** 2026-03-29
**Version target:** v2.4.0
**Status:** Approved

---

## Problem Summary

Il sistema visivo dei sensori è incompleto:

1. **Soli 5 layout_type** — mancano illuminance, pressure, air_quality
2. **Livelli di colore troppo grossolani** — temperatura ha solo 2 stati (cool/warm), batteria solo 2 (ok/low)
3. **Icona batteria statica** — non cambia con il livello
4. **config.js e loader.py** non conoscono i 3 tipi nuovi → picker vuoto, nessuna auto-mappatura

## Non incluso (rimandato)

- Sensori Gruppo C/D/E (misure fisiche, media, speciali)
- Binary sensor visual improvements
- Nuovi mockup per tipi rimandati (avviene prima dell'implementazione)

---

## Architettura

### Pattern visivo (confermato da UX specialist)

Per **stati normali**: bubble 42×42px con sfondo tintato `rgba(COLOR, 0.18)` + icona `color: COLOR`.
Bordo colorato **solo** per stati che richiedono azione immediata (alert/critical già esistenti, invariati).

```
.tile-sensor
  └── .sensor-icon-bubble  ← background tint + icon color (sri-* class)
  └── .sensor-text
        ├── .sensor-name
        └── .sensor-value
```

La classe `sri-*` viene applicata al `.sensor-icon-bubble` da `sensor.js → updateTile()`.
Il `.tile-sensor` NON riceve classi di colore per stati normali (bordo neutro).

---

## Layout Types — Specifica Completa

### sensor_temperature — 6 livelli

| Classe CSS | Soglia | Background | Color | Label |
|-----------|--------|------------|-------|-------|
| `sri-temp-freeze`  | < 5 °C  | `rgba(96,165,250,0.18)`  | `#60a5fa` | Gelo |
| `sri-temp-cold`    | 5–15 °C | `rgba(147,197,253,0.18)` | `#93c5fd` | Freddo |
| `sri-temp-cool`    | 15–19 °C| `rgba(103,232,249,0.18)` | `#67e8f9` | Fresco |
| `sri-temp-comfort` | 19–24 °C| `rgba(52,211,153,0.18)`  | `#34d399` | Comfort |
| `sri-temp-warm`    | 24–28 °C| `rgba(251,191,36,0.18)`  | `#fbbf24` | Caldo |
| `sri-temp-hot`     | > 28 °C | `rgba(248,113,113,0.18)` | `#f87171` | Molto caldo |

Icona MDI: `thermometer` (statica).

### sensor_humidity — 5 livelli

| Classe CSS | Soglia | Color |
|-----------|--------|-------|
| `sri-hum-dry`   | < 30 %  | `#f87171` |
| `sri-hum-low`   | 30–40 % | `#fb923c` |
| `sri-hum-ideal` | 40–60 % | `#34d399` |
| `sri-hum-high`  | 60–70 % | `#67e8f9` |
| `sri-hum-wet`   | > 70 %  | `#a5b4fc` |

Icona MDI: `water-percent` (statica).

### sensor_co2 — 4 livelli

| Classe CSS | Soglia (ppm) | Color |
|-----------|-------------|-------|
| `sri-co2-good`     | < 800   | `#34d399` |
| `sri-co2-mod`      | 800–1200| `#fbbf24` |
| `sri-co2-bad`      | 1200–2000| `#fb923c`|
| `sri-co2-critical` | > 2000  | `#f87171` |

Icona MDI: `molecule-co2` (statica).

### sensor_battery — 4 livelli + icona dinamica

| Classe CSS | Soglia | Color | Icona MDI |
|-----------|--------|-------|-----------|
| `sri-bat-full` | > 60 % | `#34d399` | `battery` |
| `sri-bat-mid`  | 30–60 %| `#fbbf24` | `battery-low` |
| `sri-bat-low`  | 15–30 %| `#fb923c` | `battery-low` |
| `sri-bat-crit` | < 15 % | `#f87171` | `battery-alert` |

L'icona cambia dinamicamente in `updateTile()` via `bubble.innerHTML = window.RP_FMT.getIcon(iconName, 20, entity_id)`.

### sensor_energy — 1 livello fisso

| Classe CSS | Color | Icona MDI |
|-----------|-------|-----------|
| `sri-energy` | `#c4b5fd` | `lightning-bolt` |

Valore in kW o kWh — nessuna soglia di qualità.

### sensor_illuminance — 4 livelli (NUOVO)

| Classe CSS | Soglia (lx) | Color |
|-----------|------------|-------|
| `sri-lux-dark`   | < 50    | `#60a5fa` |
| `sri-lux-dim`    | 50–300  | `#93c5fd` |
| `sri-lux-normal` | 300–1000| `#fbbf24` |
| `sri-lux-bright` | > 1000  | `#fde68a` |

Icona MDI: `weather-sunny` (statica).

### sensor_pressure — 1 livello fisso (NUOVO)

| Classe CSS | Color | Icona MDI |
|-----------|-------|-----------|
| `sri-pressure` | `#94a3b8` | `gauge` |

### sensor_air_quality — 4 livelli (NUOVO)

Usato da PM2.5, PM10, AQI, VOC, NO₂, O₃. Soglie su valore numerico normalizzato (0–500 AQI scale):

| Classe CSS | Soglia AQI | Color | Icona MDI |
|-----------|-----------|-------|-----------|
| `sri-aq-good`    | < 50    | `#34d399` | `smog` |
| `sri-aq-mod`     | 50–100  | `#fbbf24` | `smog` |
| `sri-aq-bad`     | 100–200 | `#f87171` | `smog` |
| `sri-aq-hazard`  | > 200   | `#c4b5fd` | `smog` |

Per VOC (ppb) e PM raw (µg/m³): se il valore non mappa a un AQI riconoscibile, si usa soglia lineare: <50 good, 50-100 mod, 100-200 bad, >200 hazard.

**Nota:** La scelta dell'icona specifica (smog/leaf/lungs) per aria viene mantenuta fissa su `smog` per semplicità — l'icona HA sovrascrive se presente.

---

## Modifiche per file

### 1. `retro-panel/app/static/css/tiles.css`

**Rimuovere** le classi obsolete a 2 livelli:
```css
/* DA RIMUOVERE */
.sri-temp-warm, .sri-temp-cool
.sri-humidity
.sri-co2
.sri-battery-ok, .sri-battery-low
.sri-energy  ← MANTENERE, aggiornare solo il colore
.sri-ok      ← MANTENERE invariato
```

**Aggiungere** tutte le nuove classi con schema `rgba(R,G,B,0.18)` per background:

```css
/* Temperature */
.sri-temp-freeze  { background: rgba(96,165,250,0.18);  color: #60a5fa; }
.sri-temp-cold    { background: rgba(147,197,253,0.18); color: #93c5fd; }
.sri-temp-cool    { background: rgba(103,232,249,0.18); color: #67e8f9; }
.sri-temp-comfort { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-temp-warm    { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-temp-hot     { background: rgba(248,113,113,0.18); color: #f87171; }

/* Humidity */
.sri-hum-dry    { background: rgba(248,113,113,0.18); color: #f87171; }
.sri-hum-low    { background: rgba(251,146,60,0.18);  color: #fb923c; }
.sri-hum-ideal  { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-hum-high   { background: rgba(103,232,249,0.18); color: #67e8f9; }
.sri-hum-wet    { background: rgba(165,180,252,0.18); color: #a5b4fc; }

/* CO2 */
.sri-co2-good     { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-co2-mod      { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-co2-bad      { background: rgba(251,146,60,0.18);  color: #fb923c; }
.sri-co2-critical { background: rgba(248,113,113,0.18); color: #f87171; }

/* Battery */
.sri-bat-full { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-bat-mid  { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-bat-low  { background: rgba(251,146,60,0.18);  color: #fb923c; }
.sri-bat-crit { background: rgba(248,113,113,0.18); color: #f87171; }

/* Energy (aggiornato da #2196f3 a viola coerente) */
.sri-energy { background: rgba(196,181,253,0.18); color: #c4b5fd; }

/* Illuminance */
.sri-lux-dark   { background: rgba(96,165,250,0.18);  color: #60a5fa; }
.sri-lux-dim    { background: rgba(147,197,253,0.18); color: #93c5fd; }
.sri-lux-normal { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-lux-bright { background: rgba(253,230,138,0.18); color: #fde68a; }

/* Pressure */
.sri-pressure { background: rgba(148,163,184,0.18); color: #94a3b8; }

/* Air quality */
.sri-aq-good   { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-aq-mod    { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-aq-bad    { background: rgba(248,113,113,0.18); color: #f87171; }
.sri-aq-hazard { background: rgba(196,181,253,0.18); color: #c4b5fd; }
```

`ALL_BUBBLE_CLASSES` in sensor.js va aggiornato di conseguenza.

### 2. `retro-panel/app/static/js/components/sensor.js`

**`INITIAL_BUBBLE_CLASS`** — aggiornare con le nuove classi iniziali (stato "neutro/attesa"):
```js
sensor_temperature: 'sri-temp-comfort',
sensor_humidity:    'sri-hum-ideal',
sensor_co2:         'sri-co2-good',
sensor_battery:     'sri-bat-full',
sensor_energy:      'sri-energy',
sensor_illuminance: 'sri-lux-normal',
sensor_pressure:    'sri-pressure',
sensor_air_quality: 'sri-aq-good',
sensor_generic:     'sri-ok',
// binary_* invariati
```

**`ALL_BUBBLE_CLASSES`** — lista completa di tutte le classi sri-* da pulire prima di applicarne una nuova.

**`updateTile()` — logica colore espansa:**

```js
// sensor_temperature
if (numVal < 5)        sriClass = 'sri-temp-freeze';
else if (numVal < 15)  sriClass = 'sri-temp-cold';
else if (numVal < 19)  sriClass = 'sri-temp-cool';
else if (numVal < 24)  sriClass = 'sri-temp-comfort';
else if (numVal < 28)  sriClass = 'sri-temp-warm';
else                   sriClass = 'sri-temp-hot';

// sensor_humidity
if (numVal < 30)       sriClass = 'sri-hum-dry';
else if (numVal < 40)  sriClass = 'sri-hum-low';
else if (numVal < 60)  sriClass = 'sri-hum-ideal';
else if (numVal < 70)  sriClass = 'sri-hum-high';
else                   sriClass = 'sri-hum-wet';

// sensor_co2
if (numVal < 800)      sriClass = 'sri-co2-good';
else if (numVal < 1200) sriClass = 'sri-co2-mod';
else if (numVal < 2000) sriClass = 'sri-co2-bad';
else                   sriClass = 'sri-co2-critical';

// sensor_battery — + dynamic icon
if (numVal > 60)       { sriClass = 'sri-bat-full'; icon = 'battery'; }
else if (numVal > 30)  { sriClass = 'sri-bat-mid';  icon = 'battery-low'; }
else if (numVal > 15)  { sriClass = 'sri-bat-low';  icon = 'battery-low'; }
else                   { sriClass = 'sri-bat-crit'; icon = 'battery-alert'; }
// bubble.innerHTML = window.RP_FMT.getIcon(icon, 20, entity_id)

// sensor_energy
sriClass = 'sri-energy'; // fixed

// sensor_illuminance
if (numVal < 50)       sriClass = 'sri-lux-dark';
else if (numVal < 300) sriClass = 'sri-lux-dim';
else if (numVal < 1000) sriClass = 'sri-lux-normal';
else                   sriClass = 'sri-lux-bright';

// sensor_pressure
sriClass = 'sri-pressure'; // fixed

// sensor_air_quality
if (numVal < 50)       sriClass = 'sri-aq-good';
else if (numVal < 100) sriClass = 'sri-aq-mod';
else if (numVal < 200) sriClass = 'sri-aq-bad';
else                   sriClass = 'sri-aq-hazard';
```

### 3. `retro-panel/app/config/loader.py`

**`_compute_layout_type()` — aggiungere a `_map`:**

```python
"illuminance":                    "sensor_illuminance",
"pressure":                       "sensor_pressure",
"atmospheric_pressure":           "sensor_pressure",
"pm25":                           "sensor_air_quality",
"pm10":                           "sensor_air_quality",
"aqi":                            "sensor_air_quality",
"volatile_organic_compounds":     "sensor_air_quality",
"volatile_organic_compounds_parts": "sensor_air_quality",
"nitrogen_dioxide":               "sensor_air_quality",
"ozone":                          "sensor_air_quality",
```

### 4. `retro-panel/app/static/js/config.js`

**`VISUAL_OPTIONS.sensor`** — aggiungere 3 voci:
```js
{ v: 'sensor_illuminance', l: 'Luminosit\u00e0' },
{ v: 'sensor_pressure',    l: 'Pressione' },
{ v: 'sensor_air_quality', l: 'Qualit\u00e0 aria' },
```

**`_getVisualTypeLabel()`** — aggiungere:
```js
sensor_illuminance: 'Luminosit\u00e0',
sensor_pressure:    'Pressione',
sensor_air_quality: 'Qualit\u00e0 aria',
sensor_generic:     'Generico',
```

### 5. `retro-panel/app/static/js/renderer.js`

**`COMPONENT_MAP` declaration** (con gli altri `null`):
```js
'sensor_illuminance': null,
'sensor_pressure':    null,
'sensor_air_quality': null,
```

**`COL_CLASS_MAP`**:
```js
'sensor_illuminance': 'tile-col-sensor',
'sensor_pressure':    'tile-col-sensor',
'sensor_air_quality': 'tile-col-sensor',
```

**`_initComponents()`**:
```js
COMPONENT_MAP['sensor_illuminance'] = window.SensorComponent || null;
COMPONENT_MAP['sensor_pressure']    = window.SensorComponent || null;
COMPONENT_MAP['sensor_air_quality'] = window.SensorComponent || null;
```

---

## Testing

Ogni tipo di sensore va verificato con valori al limite delle soglie:

- `sensor_temperature`: testare -20, 4.9, 5, 14.9, 15, 18.9, 19, 23.9, 24, 27.9, 28, 40
- `sensor_humidity`: 25, 29.9, 30, 39.9, 40, 59.9, 60, 69.9, 70, 90
- `sensor_co2`: 799, 800, 1199, 1200, 1999, 2000, 2500
- `sensor_battery`: 8, 14.9, 15, 29.9, 30, 59.9, 60, 95
- `sensor_illuminance`: 10, 49.9, 50, 299.9, 300, 999.9, 1000, 5000
- `sensor_air_quality`: 20, 49.9, 50, 99.9, 100, 199.9, 200, 350
- `sensor_pressure`: qualsiasi valore numerico
- `sensor_energy`: qualsiasi valore numerico

Test Python da aggiungere in `tests/test_loader_sensor_types.py`:
- device_class `illuminance` → `sensor_illuminance`
- device_class `pressure` → `sensor_pressure`
- device_class `atmospheric_pressure` → `sensor_pressure`
- device_class `pm25` → `sensor_air_quality`
- device_class `volatile_organic_compounds` → `sensor_air_quality`
- device_class sconosciuto → `sensor_generic`
- visual_type override sempre vince

---

## Versione

`config.yaml`: `2.3.3` → `2.4.0`
Cache-buster: `?v=233` → `?v=240` su tutti gli asset in `index.html` e `config.html`

## Scope

- Nessuna modifica all'architettura server
- Nessuna modifica allo schema entities.json
- Nessuna modifica ai tile di altri domini (light, switch, alarm, camera, scenario)
- iOS 12+ safe: nessun nuovo pattern JS
