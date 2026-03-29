# Design Spec — Sensor Visual System Group C (v2.5.0)

**Date:** 2026-03-29
**Version target:** v2.5.0
**Status:** Approved

---

## Problem Summary

Dopo il v2.4.0 (8 layout_type per sensori comuni), restano senza mapping visivo ~20 `device_class` HA che compaiono frequentemente nei dashboard:

- Elettrico esteso: voltage, current, frequency, apparent/reactive power, power_factor
- Segnale: signal_strength
- Gas chimici (sensore, non binario): carbon_monoxide, sulphur_dioxide, nitrous_oxide
- Velocità: speed
- Acqua/ambiente: conductivity, precipitation, precipitation_intensity, moisture, volume, volume_flow_rate
- pH: ph
- Fisico generico: weight, distance, volume_storage, duration

## Non incluso

- data_rate, data_size (rimandato)
- Binary sensor improvements (spec separato)
- Nuovi layout_type per luci o switch

---

## Architettura

Stesso pattern di v2.4.0: il `device_class` viene mappato a un `layout_type` da `_compute_layout_type()` in `loader.py`. In `sensor.js → updateTile()` il `layout_type` determina la classe `sri-*` applicata al `.sensor-icon-bubble`.

Per i tipi a **colore fisso** (electrical, water, physical): 1 sola classe CSS.
Per i tipi a **livelli** (signal, gas, speed, ph): 3–4 classi CSS con soglie numeriche.
Caso speciale: `sensor_signal` usa valori dBm negativi — la logica JS è invertita (`numVal > -67` = forte).

I tipi water e physical hanno **icone MDI diverse per device_class**, già gestite da `_detect_icon()` in loader.py.

---

## Layout Types — Specifica Completa

### sensor_electrical — 1 livello fisso

`device_class` mappati: `voltage`, `current`, `apparent_power`, `reactive_power`, `power_factor`, `frequency`

| Classe CSS | Color | Background | Icona MDI |
|---|---|---|---|
| `sri-electrical` | `#818cf8` | `rgba(129,140,248,0.18)` | `flash` (statica) |

### sensor_signal — 4 livelli (dBm, valori negativi — più alto = migliore)

`device_class` mappati: `signal_strength`

| Classe CSS | Soglia dBm | Color | Background |
|---|---|---|---|
| `sri-sig-strong` | > −67 | `#34d399` | `rgba(52,211,153,0.18)` |
| `sri-sig-good` | −67 a −80 | `#fbbf24` | `rgba(251,191,36,0.18)` |
| `sri-sig-fair` | −80 a −90 | `#fb923c` | `rgba(251,146,60,0.18)` |
| `sri-sig-weak` | < −90 | `#f87171` | `rgba(248,113,113,0.18)` |

Icona MDI: `wifi` (statica).
Logica JS: `numVal > -67` → strong, `numVal > -80` → good, `numVal > -90` → fair, altrimenti weak.

### sensor_gas — 4 livelli (ppm)

`device_class` mappati: `carbon_monoxide`, `sulphur_dioxide`, `nitrous_oxide`

Soglie basate su limiti WHO per CO (riferimento più comune). SO₂ e NO a ppm comparabili risultano ugualmente pericolosi.

| Classe CSS | Soglia ppm | Color | Background |
|---|---|---|---|
| `sri-gas-safe`     | < 10  | `#34d399` | `rgba(52,211,153,0.18)` |
| `sri-gas-mod`      | 10–35 | `#fbbf24` | `rgba(251,191,36,0.18)` |
| `sri-gas-bad`      | 35–100| `#fb923c` | `rgba(251,146,60,0.18)` |
| `sri-gas-critical` | > 100 | `#f87171` | `rgba(248,113,113,0.18)` |

Icona MDI: `molecule-co` (statica).

### sensor_speed — 4 livelli (km/h, scala Beaufort semplificata)

`device_class` mappati: `speed`

| Classe CSS | Soglia km/h | Color | Background |
|---|---|---|---|
| `sri-spd-calm`   | < 15  | `#34d399` | `rgba(52,211,153,0.18)` |
| `sri-spd-breezy` | 15–30 | `#67e8f9` | `rgba(103,232,249,0.18)` |
| `sri-spd-windy`  | 30–60 | `#fbbf24` | `rgba(251,191,36,0.18)` |
| `sri-spd-storm`  | > 60  | `#f87171` | `rgba(248,113,113,0.18)` |

Icona MDI: `weather-windy` (statica).

### sensor_water — 1 livello fisso

`device_class` mappati: `conductivity`, `precipitation`, `precipitation_intensity`, `moisture`, `volume`, `volume_flow_rate`

| Classe CSS | Color | Background |
|---|---|---|
| `sri-water` | `#2dd4bf` | `rgba(45,212,191,0.18)` |

Icone MDI per device_class (gestite da `_detect_icon()` in loader.py):
- `conductivity` → `water-opacity`
- `precipitation` → `weather-rainy`
- `precipitation_intensity` → `weather-pouring`
- `moisture` → `water-percent`
- `volume` → `water-pump`
- `volume_flow_rate` → `pipe`

### sensor_ph — 3 livelli (scala pH 0–14)

`device_class` mappati: `ph`

| Classe CSS | Soglia pH | Color | Background |
|---|---|---|---|
| `sri-ph-acid`     | < 6.5     | `#f87171` | `rgba(248,113,113,0.18)` |
| `sri-ph-neutral`  | 6.5–7.5   | `#34d399` | `rgba(52,211,153,0.18)` |
| `sri-ph-alkaline` | > 7.5     | `#60a5fa` | `rgba(96,165,250,0.18)` |

Icona MDI: `ph` (statica).

### sensor_physical — 1 livello fisso

`device_class` mappati: `weight`, `distance`, `volume_storage`, `duration`

| Classe CSS | Color | Background |
|---|---|---|
| `sri-physical` | `#94a3b8` | `rgba(148,163,184,0.18)` |

Icone MDI per device_class (gestite da `_detect_icon()` in loader.py):
- `weight` → `weight-kilogram`
- `distance` → `ruler`
- `duration` → `timer-sand`
- `volume_storage` → `database`

---

## Modifiche per file

### 1. `retro-panel/app/static/css/tiles.css`

Aggiungere 18 nuove classi `sri-*` dopo il blocco air quality esistente:

```css
/* Electrical — fixed indigo */
.sri-electrical { background: rgba(129,140,248,0.18); color: #818cf8; }

/* Signal strength — 4 levels (dBm, higher = better) */
.sri-sig-strong { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-sig-good   { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-sig-fair   { background: rgba(251,146,60,0.18);  color: #fb923c; }
.sri-sig-weak   { background: rgba(248,113,113,0.18); color: #f87171; }

/* Gas concentration — 4 levels (ppm) */
.sri-gas-safe     { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-gas-mod      { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-gas-bad      { background: rgba(251,146,60,0.18);  color: #fb923c; }
.sri-gas-critical { background: rgba(248,113,113,0.18); color: #f87171; }

/* Speed — 4 levels (km/h) */
.sri-spd-calm   { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-spd-breezy { background: rgba(103,232,249,0.18); color: #67e8f9; }
.sri-spd-windy  { background: rgba(251,191,36,0.18);  color: #fbbf24; }
.sri-spd-storm  { background: rgba(248,113,113,0.18); color: #f87171; }

/* Water — fixed teal */
.sri-water { background: rgba(45,212,191,0.18); color: #2dd4bf; }

/* pH — 3 levels */
.sri-ph-acid     { background: rgba(248,113,113,0.18); color: #f87171; }
.sri-ph-neutral  { background: rgba(52,211,153,0.18);  color: #34d399; }
.sri-ph-alkaline { background: rgba(96,165,250,0.18);  color: #60a5fa; }

/* Physical — fixed slate */
.sri-physical { background: rgba(148,163,184,0.18); color: #94a3b8; }
```

### 2. `retro-panel/app/static/js/components/sensor.js`

**`INITIAL_BUBBLE_CLASS`** — aggiungere 7 nuove chiavi:
```js
sensor_electrical: 'sri-electrical',
sensor_signal:     'sri-sig-strong',
sensor_gas:        'sri-gas-safe',
sensor_speed:      'sri-spd-calm',
sensor_water:      'sri-water',
sensor_ph:         'sri-ph-neutral',
sensor_physical:   'sri-physical',
```

**`ALL_BUBBLE_CLASSES`** — aggiungere le 18 nuove classi:
```js
'sri-electrical',
'sri-sig-strong', 'sri-sig-good', 'sri-sig-fair', 'sri-sig-weak',
'sri-gas-safe', 'sri-gas-mod', 'sri-gas-bad', 'sri-gas-critical',
'sri-spd-calm', 'sri-spd-breezy', 'sri-spd-windy', 'sri-spd-storm',
'sri-water',
'sri-ph-acid', 'sri-ph-neutral', 'sri-ph-alkaline',
'sri-physical',
```

**`updateTile()` — 7 nuovi branch** (aggiungere dopo il branch `sensor_air_quality`):
```js
} else if (layoutType === 'sensor_electrical') {
  sriClass = 'sri-electrical';

} else if (layoutType === 'sensor_signal') {
  if      (!isNaN(numVal) && numVal > -67) { sriClass = 'sri-sig-strong'; }
  else if (!isNaN(numVal) && numVal > -80) { sriClass = 'sri-sig-good'; }
  else if (!isNaN(numVal) && numVal > -90) { sriClass = 'sri-sig-fair'; }
  else if (!isNaN(numVal))                 { sriClass = 'sri-sig-weak'; }

} else if (layoutType === 'sensor_gas') {
  if      (!isNaN(numVal) && numVal < 10)  { sriClass = 'sri-gas-safe'; }
  else if (!isNaN(numVal) && numVal < 35)  { sriClass = 'sri-gas-mod'; }
  else if (!isNaN(numVal) && numVal < 100) { sriClass = 'sri-gas-bad'; }
  else if (!isNaN(numVal))                 { sriClass = 'sri-gas-critical'; }

} else if (layoutType === 'sensor_speed') {
  if      (!isNaN(numVal) && numVal < 15) { sriClass = 'sri-spd-calm'; }
  else if (!isNaN(numVal) && numVal < 30) { sriClass = 'sri-spd-breezy'; }
  else if (!isNaN(numVal) && numVal < 60) { sriClass = 'sri-spd-windy'; }
  else if (!isNaN(numVal))                { sriClass = 'sri-spd-storm'; }

} else if (layoutType === 'sensor_water') {
  sriClass = 'sri-water';

} else if (layoutType === 'sensor_ph') {
  if      (!isNaN(numVal) && numVal < 6.5) { sriClass = 'sri-ph-acid'; }
  else if (!isNaN(numVal) && numVal < 7.5) { sriClass = 'sri-ph-neutral'; }
  else if (!isNaN(numVal))                 { sriClass = 'sri-ph-alkaline'; }

} else if (layoutType === 'sensor_physical') {
  sriClass = 'sri-physical';
}
```

### 3. `retro-panel/app/config/loader.py`

**`_compute_layout_type()` — aggiungere 18 mapping a `_map`:**
```python
"voltage":                  "sensor_electrical",
"current":                  "sensor_electrical",
"apparent_power":           "sensor_electrical",
"reactive_power":           "sensor_electrical",
"power_factor":             "sensor_electrical",
"frequency":                "sensor_electrical",
"signal_strength":          "sensor_signal",
"carbon_monoxide":          "sensor_gas",
"sulphur_dioxide":          "sensor_gas",
"nitrous_oxide":            "sensor_gas",
"speed":                    "sensor_speed",
"ph":                       "sensor_ph",
"conductivity":             "sensor_water",
"precipitation":            "sensor_water",
"precipitation_intensity":  "sensor_water",
"moisture":                 "sensor_water",
"volume":                   "sensor_water",
"volume_flow_rate":         "sensor_water",
"weight":                   "sensor_physical",
"distance":                 "sensor_physical",
"volume_storage":           "sensor_physical",
"duration":                 "sensor_physical",
```

**`_detect_icon()` — aggiungere parametro opzionale `device_class` e dict di lookup:**

La funzione attuale firma è `_detect_icon(entity_id: str)`. Va estesa a `_detect_icon(entity_id: str, device_class: str = "")`.
Se `device_class` è presente, viene consultato prima il dict `_DC_ICON_MAP`. Fallback invariato.

```python
_DC_ICON_MAP: dict[str, str] = {
    "conductivity":            "water-opacity",
    "precipitation":           "weather-rainy",
    "precipitation_intensity": "weather-pouring",
    "moisture":                "water-percent",
    "volume":                  "water-pump",
    "volume_flow_rate":        "pipe",
    "weight":                  "weight-kilogram",
    "distance":                "ruler",
    "duration":                "timer-sand",
    "volume_storage":          "database",
}

def _detect_icon(entity_id: str, device_class: str = "") -> str:
    if device_class and device_class in _DC_ICON_MAP:
        return _DC_ICON_MAP[device_class]
    # ... existing logic unchanged ...
```

Il chiamante `_parse_entity()` passa già `device_class` in scope — aggiornare la chiamata a `_detect_icon(entity_id, device_class)`.
Tutti gli altri chiamanti che non passano `device_class` continuano a funzionare (parametro opzionale).

### 4. `retro-panel/tests/test_loader_sensor_types_c.py`

Nuovo file con ~25 test TDD che coprono tutti i nuovi mapping. Esempio:
```python
def test_voltage_maps_to_sensor_electrical():
    assert _compute_layout_type("sensor.v", "voltage", "") == "sensor_electrical"

def test_signal_strength_maps_to_sensor_signal():
    assert _compute_layout_type("sensor.rssi", "signal_strength", "") == "sensor_signal"

def test_carbon_monoxide_maps_to_sensor_gas():
    assert _compute_layout_type("sensor.co", "carbon_monoxide", "") == "sensor_gas"
# ... etc per tutti i 22 device_class
```

### 5. `retro-panel/app/static/js/config.js`

Aggiungere a `VISUAL_OPTIONS.sensor`:
```js
{ v: 'sensor_electrical', l: 'Elettrico' },
{ v: 'sensor_signal',     l: 'Segnale' },
{ v: 'sensor_gas',        l: 'Gas' },
{ v: 'sensor_speed',      l: 'Velocit\u00e0' },
{ v: 'sensor_water',      l: 'Acqua' },
{ v: 'sensor_ph',         l: 'pH' },
{ v: 'sensor_physical',   l: 'Fisico' },
```

Aggiungere a `_getVisualTypeLabel` LABELS:
```js
sensor_electrical: 'Elettrico',
sensor_signal:     'Segnale',
sensor_gas:        'Gas',
sensor_speed:      'Velocit\u00e0',
sensor_water:      'Acqua',
sensor_ph:         'pH',
sensor_physical:   'Fisico',
```

### 6. `retro-panel/app/static/js/renderer.js`

Aggiungere a `COMPONENT_MAP` (valore `null`), `COL_CLASS_MAP` (valore `'tile-col-sensor'`), e `_initComponents()` (valore `window.SensorComponent || null`):
```
sensor_electrical, sensor_signal, sensor_gas,
sensor_speed, sensor_water, sensor_ph, sensor_physical
```

### 7. `retro-panel/config.yaml`

```yaml
version: "2.5.0"
```

### 8. `retro-panel/app/static/index.html` e `config.html`

Sostituire `?v=240` → `?v=250` su tutti gli asset.

---

## Piano di task (5 task)

1. **tiles.css** — 18 nuove classi `sri-*`
2. **sensor.js** — aggiornare INITIAL_BUBBLE_CLASS, ALL_BUBBLE_CLASSES, updateTile() (7 branch)
3. **loader.py** — TDD: test file con ~25 test, poi 22 mapping + icone in `_detect_icon()`
4. **config.js** — 7 voci VISUAL_OPTIONS + 7 label
5. **renderer.js** + version bump 2.5.0 + cache-buster `?v=250`
