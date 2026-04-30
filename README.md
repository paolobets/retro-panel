# Retro Panel

[![Release][release-badge]][release-url]
[![License][license-badge]][license-url]
[![HA Supervisor][ha-badge]][ha-url]
[![Supports aarch64][aarch64-badge]][aarch64-url]
[![Supports amd64][amd64-badge]][amd64-url]
[![Supports armhf][armhf-badge]][armhf-url]
[![Supports armv7][armv7-badge]][armv7-url]
[![Ko-fi][kofi-badge]][kofi-url]

[release-badge]: https://img.shields.io/github/v/release/paolobets/retro-panel?style=flat-square
[release-url]: https://github.com/paolobets/retro-panel/releases
[license-badge]: https://img.shields.io/badge/license-Source%20Available-blue?style=flat-square
[license-url]: https://github.com/paolobets/retro-panel/blob/master/LICENSE
[ha-badge]: https://img.shields.io/badge/Home%20Assistant-2023.1%2B-blue?style=flat-square
[ha-url]: https://www.home-assistant.io/
[aarch64-badge]: https://img.shields.io/badge/aarch64-yes-green?style=flat-square
[amd64-badge]: https://img.shields.io/badge/amd64-yes-green?style=flat-square
[armhf-badge]: https://img.shields.io/badge/armhf-yes-green?style=flat-square
[armv7-badge]: https://img.shields.io/badge/armv7-yes-green?style=flat-square
[aarch64-url]: https://github.com/paolobets/retro-panel
[amd64-url]: https://github.com/paolobets/retro-panel
[armhf-url]: https://github.com/paolobets/retro-panel
[armv7-url]: https://github.com/paolobets/retro-panel
[kofi-badge]: https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20beer%20%F0%9F%8D%BA-FF5E5B?style=flat-square&logo=ko-fi&logoColor=white
[kofi-url]: https://ko-fi.com/M4M11XX4MS

> **Trasforma quel tablet che nessuno usa più nel pannello di controllo della tua casa.**
> Una dashboard touch-first per Home Assistant pensata per iPad, Fire e Android datati —
> dove la Lovelace ufficiale rallenta o si pianta, Retro Panel vola.

<p align="center">
  <img src="docs/assets/dashboard-overview.png" alt="Retro Panel — la tua casa in un colpo d'occhio" width="100%"/>
</p>

---

## Perché ti piacerà

🎯 **Una sola schermata, tutta la casa** — luci, tapparelle, clima, energia, sicurezza, media, calendario, telecamere e ora anche chat AI con HIRIS, tutto a portata di pollice.

📱 **Funziona su quel tablet vecchio** — iPad iOS 12, Fire HD del 2018, Android 7… se ha un browser, va. Niente di "più moderno" da aggiornare.

⚡ **Aggiornamenti istantanei** — premi un interruttore in cucina, la dashboard in salotto cambia in tempo reale. WebSocket nativo verso HA.

🎨 **Touch-first vero** — bottoni 44 px, gestures naturali, bottom sheet che non litiga con la tastiera mobile. Niente menu nascosti, niente tap di precisione chirurgica.

🔒 **Sicuro per progetto** — token HA mai esposti al browser, whitelist servizi, rate limiting su PIN dell'allarme. Pensato per essere lasciato sul muro 24/7.

---

## La tua casa, a colpo d'occhio

Il pannello è diviso in due:

- **Sidebar** a sinistra (collassabile) per saltare tra le stanze
- **Griglia di tile** a destra che mostra cosa sta succedendo *adesso*

In alto: orologio, indicatore di connessione e toggle tema (chiaro/scuro/automatico per fascia oraria).

I tile sono tutti **della stessa altezza** (120 px). Quando un media player parte la sua tile diventa larga il doppio per ospitare cover art e controlli — il resto della griglia si riadatta senza sobbalzi.

---

## Cosa puoi controllare

### 💡 Luci e interruttori

<table><tr><td>

```
┌──────────────────────┐   ┌──────────────────────┐
│  💡 Salotto          │   │  💡 Cucina           │
│  Acceso              │   │  Spenta              │
│           ▓▓▓▓▓▓░░░  │   │                      │
│           65%        │   │                      │
└──────────────────────┘   └──────────────────────┘
```

</td></tr></table>

| Gesto | Risultato |
|-------|-----------|
| **Tap** | Toggle on/off (feedback immediato, ottimistico) |
| **Long-press 500 ms** | Bottom sheet: luminosità, temperatura colore, tinta |

Per gli interruttori e gli `input_boolean`: solo il tap, niente long-press.

### 📊 Sensori

<p align="center">
  <img src="docs/assets/tiles-sensors.png" alt="Tile sensori" width="100%"/>
</p>

Il tile cambia *aspetto* in base al tipo di sensore. Niente da configurare: lo capisce dalla `device_class`.

| Categoria | Cosa vedi |
|-----------|-----------|
| 🌡 **Temperatura · Umidità · CO₂** | Bolla colorata che diventa rossa/arancio/verde a seconda dei valori soglia |
| 🔋 **Batteria · Energia · Potenza** | Icona dinamica + valore con unità (W, kWh, %) |
| 📈 **Progresso (%)** | Barra orizzontale a 4 livelli — ottima per cartucce stampante, RAM NAS, riempimento storage |
| 📋 **Stato discreto** | Lavatrice "Centrifuga", asciugatrice "Asciugatura"… il testo che ti aspetti |
| 🕐 **Data e ora** | Tempo relativo amichevole — "3 min fa", "oggi 16:30", "ieri" |
| ⚠️ **Sensori binari** | Porta aperta? Movimento? Fumo? Bordo che pulsa, icona dedicata |

### 🎵 Media Player

<p align="center">
  <img src="docs/assets/tiles-media-player.png" alt="Media player" width="100%"/>
</p>

Telecomando completo per Echo, Sonos, HomePod, Apple TV, Samsung TV, e qualsiasi `media_player` di Home Assistant.

| Stato | Tile |
|-------|------|
| 🎶 **In riproduzione / In pausa** | Tile largo (2 colonne): cover art · titolo · artista · transport · volume |
| 💤 **Idle / Off** | Tile compatto (1 colonna): icona del dispositivo · nome · stato |

Tap sul tile largo apre il **bottom sheet** con: slider del volume, selettore della sorgente, sound mode, shuffle/repeat e raggruppamento di speaker. I controlli mostrati si adattano alle capability dichiarate dal media player.

### 📅 Calendario

<p align="center">
  <img src="docs/assets/calendar.png" alt="Calendario" width="100%"/>
</p>

Vista **mese** o **settimana**, con dropdown multi-calendario per vedere/nascondere fonti diverse (Google, iCloud, lavoro…).

Tap su un evento → si apre il **side panel** con orario, luogo (📍), descrizione e calendario di provenienza.

### ⚡ Flusso energia

<p align="center">
  <img src="docs/assets/energy-card.png" alt="Energy card" width="100%"/>
</p>

Card stile "semaforo" che racconta in tempo reale **da dove arriva la corrente** che stai usando:

- 🟢 **Verde** — surplus solare, stai vendendo energia alla rete
- 🟡 **Giallo** — equilibrio, batteria neutra
- 🔴 **Rosso** — stai prendendo dalla rete

Frecce animate che seguono il flusso reale (sole → casa, batteria → casa, rete → casa, sole → batteria, sole → rete). Barre colorate per produzione, autoconsumo, SOC batteria, import/export.

Testato con **ZCS Azzurro**, **SMA**, **Fronius**, **Huawei SUN2000**.

### 🚨 Allarme antifurto

```
  DISARMATO — scegli modalità          ARMATO FUORI
  ┌──────────────────────────┐         ┌────────────────────────┐
  │ Allarme Casa             │         │ Allarme Casa           │
  │ DISARMATO                │         │ ARMATO — Fuori         │
  │                          │         │                        │
  │ [Casa]  [Fuori]  [Notte] │         │      [ Disarma ]       │
  │                          │         │                        │
  │  1   2   3               │         │  ● Porta ingresso      │
  │  4   5   6  [ Arma ]     │         │  ○ Finestra soggiorno  │
  └──────────────────────────┘         └────────────────────────┘
```

Tre pulsanti rapidi: **Casa**, **Fuori**, **Notte**. Il tastierino PIN compare *solo se il tuo `alarm_control_panel` lo richiede*. Quando armato, vedi i sensori delle zone con stato live.

Il PIN non viene mai memorizzato — viene inviato a Home Assistant e cancellato dalla memoria immediatamente.

### 📷 Telecamere

Griglia 4-colonne con preview live. Tap su una camera → **lightbox a tutto schermo**:

- **MJPEG** ultra-low-latency dove disponibile (controllo PTZ ~1-2 s)
- **HLS** per streaming a lungo (fMP4 supportato)
- **Snapshot polling** automatico come fallback se MJPEG non risponde
- **Controllo PTZ** integrato con D-pad e barra zoom per camere supportate

### 🌗 Tapparelle e tende

```
┌─────────────────────────────┐
│  🪟 Tapparella Cucina        │
│  Aperta al 70%              │
│  ▓▓▓▓▓▓▓░░░                 │
│  [▲]  [■]  [▼]              │
└─────────────────────────────┘
```

Tre pulsanti (apri/stop/chiudi) + barra di posizione corrente. Animazione attiva quando la tapparella si sta muovendo.

### 🌡 Termostato

Temperatura attuale grande, target piccolo sotto. Tap apre un bottom sheet con slider della temperatura, scelta della modalità HVAC (heat/cool/auto/off) e velocità del ventilatore quando supportata.

### 🔐 Serrature smart

Lucchetto SVG che si apre/chiude visivamente. Stato sempre visibile.

### ⏯ Pulsanti e scene

Tap → conferma con flash verde. Per scene/script/automazioni: badge che dice cos'è, icona MDI personalizzabile, bordo colorato per organizzare visivamente.

### 🤖 HIRIS chat — Chat AI nella tua casa *(novità v2.17.0)*

<table><tr><td>

```
┌────────────────────────────────────────┐
│ ╭────╮  Assistente Casa            ›   │
│ │ 🌸 │  Apri chat ›                    │
│ ╰────╯                                 │
└────────────────────────────────────────┘
```

</td></tr></table>

Una **card compatta** sulla dashboard. Tap → si apre la chat a tutto schermo:

```
┌────────────────────────────────────┐
│ 🌸 Assistente Casa             ✕  │
├────────────────────────────────────┤
│                                    │
│         "Accendi le luci"  ╮       │
│              della cucina │       │
│                                    │
│ 🌸  ╭ Fatto, ho acceso 3 luci     │
│     ╰ in cucina.                   │
│                                    │
│         "Quanto consumano?"  ╮    │
│                                    │
│ 🌸  ╭ • • •                        │
│     ╰  (sta pensando…)             │
│                                    │
├────────────────────────────────────┤
│ ┌──────────────────────────┐  ╭─╮ │
│ │ Scrivi un messaggio…     │  │↗│ │
│ └──────────────────────────┘  ╰─╯ │
└────────────────────────────────────┘
```

Funziona con il companion add-on **HIRIS** (vedi sotto):

- 💬 **Conversazione naturale** — "spegni il salotto", "che temperatura c'è in camera?", "metti musica rilassante"
- 🌸 **Avatar HIRIS** accanto a ogni risposta — sai sempre con chi stai parlando
- 🌊 **Indicatore "wave"** mentre l'AI elabora (3 puntini viola animati)
- ⌨️ **Tastiera mobile gestita** — su iOS 12 l'overlay si ridimensiona quando appare la tastiera, l'input non viene mai coperto
- ↩️ **ESC desktop / back hardware Android** chiudono l'overlay senza perdere il thread

Il token di autenticazione per HIRIS resta server-side, non viene mai esposto al browser.

> **Per usarlo:** installa l'add-on [HIRIS](https://github.com/paolobets/hiris) (anche lui gratuito), configura un agente, poi aggiungi un tile `hiris_chat` a una sezione del pannello dalla pagina di configurazione.

---

## Configurazione

C'è un **pannello admin completo** dentro il browser (`/config`), nessun YAML da scrivere a mano. Sei tab:

| Tab | Cosa decidi |
|-----|-------------|
| 🏠 **Panoramica** | Cosa vedi nella home · Card energia · Ordine della navigazione |
| 🛏 **Stanze** | Le tue stanze con sezioni · Importa dalle Aree HA · Icona e nome per entità |
| 🎬 **Scenari** | Gruppi di scene/script/automazioni · Icona MDI per ogni voce · Colore del bordo |
| 📷 **Telecamere** | Camere · Refresh per camera · Mostra/nascondi |
| 🚨 **Allarmi** | Pannelli antifurto · Sensori delle zone per pannello |
| 📅 **Calendari** | Calendari da mostrare · Filtro multi-calendario |
| ⚙️ **Generale** | Token HA · HIRIS URL e token · Tema · Refresh interval |

L'**icon picker integrato** ti dà accesso a **7.400+ icone Material Design** con ricerca in italiano: digita "tapparella", "umido" o "riscaldamento" e trovi quello che cerchi.

---

## Installazione

### 1. Aggiungi questo repository a Home Assistant

**Impostazioni → Add-on → Add-on Store → ⋮ in alto a destra → Repository**

Incolla:

```
https://github.com/paolobets/retro-panel
```

Aggiorna lo store, trova **Retro Panel**, clicca **Installa**.

### 2. Configurazione minima

Vai sulla tab **Configurazione** dell'add-on:

| Opzione | Cosa metti | Default |
|---------|-----------|---------|
| `ha_url` | URL della tua HA | `http://homeassistant:8123` |
| `ha_token` | Long-Lived Access Token (lascia vuoto su HA OS/Supervised) | auto |
| `panel_title` | Titolo nell'header | `Home` |
| `theme` | `dark` · `light` · `auto` | `dark` |
| `refresh_interval` | Polling REST in secondi (5-300) | `30` |
| `hiris_url` | URL HIRIS (se installato) | `http://hiris:8099` |
| `hiris_internal_token` | Token interno HIRIS | _vuoto_ |

### 3. Avvia

Premi **Avvia**, poi **Apri Web UI**. La dashboard è su `/`, l'admin su `/config`.

### 4. Mettilo a tutto schermo sull'iPad

1. Apri **Safari** → `http://[IP-HA]:7654`
2. **Condividi → Aggiungi a Home → Aggiungi**
3. Apri l'icona dalla home → schermo intero, niente barre del browser

Per nascondere anche la sidebar di Home Assistant in modalità Ingress, installa
[kiosk-mode](https://github.com/NemesisRE/kiosk-mode) (HACS) e aggiungi al `configuration.yaml`:

```yaml
kiosk_mode:
  hide_sidebar: '[[[ location.href.includes("hassio/ingress") ]]]'
  hide_header:  '[[[ location.href.includes("hassio/ingress") ]]]'
```

---

## Sicurezza

Pensato per essere lasciato sul muro 24 ore su 24:

| Layer | Cosa fa |
|-------|---------|
| **Rete** | Funziona dietro Cloudflare Tunnel o WireGuard — evita port-forwarding diretto |
| **Autenticazione** | HA Ingress: serve una sessione HA valida. Niente login da bypassare |
| **Token isolation** | Il Long-Lived Token sta sul server, non viene mai mandato al browser |
| **Service whitelist** | Tutte le service call vengono validate contro un'allowlist hard-coded |
| **Rate limiting** | Protezione brute-force su PIN allarme ed endpoint di configurazione |
| **HIRIS token** | Stessa logica: il token è server-side, mai esposto |

Suggerito: usa un **account HA dedicato non-admin** per il tablet del kiosk e attiva **2FA** sugli account amministratori.

---

## Requirements

| | Minimo |
|-|--------|
| Home Assistant | 2023.1 (OS o Supervised) |
| Architettura | aarch64 · amd64 · armhf · armv7 |
| Browser | iOS 12+ Safari · Chrome 70+ · Firefox 65+ · Android WebView 7+ |
| RAM host | ~50 MB RSS (Raspberry Pi 3B+ va bene) |

---

## Roadmap

| Versione | Stato | Highlights |
|----------|-------|------------|
| **v2.9** | Released | Card energia · griglia camere/lightbox · allarme rifatto · security hardening |
| **v2.10** | Released | Notifiche push: campanella, drawer, toast, alert border · evento `retro_panel_notify` |
| **v2.13** | Released | Calendario con vista mese+settimana e side panel eventi |
| **v2.14** | Released | Media player avanzato · sensori enum/datetime/progress · Supervisor version API |
| **v2.16** | Released | Camera wizard v2 entity-based · PTZ lightbox · MJPEG low-latency · auto-recovery stream |
| **v2.17** | **Current** | 🌸 Integrazione HIRIS (chat AI) · tile compact + overlay refresh · gestione tastiera mobile fix definitivo |
| **v3.0** | Planned | Sistema plugin · temi custom · grafici storici · offline-first |

---

## Sostieni il progetto

Se Retro Panel ha salvato il tuo iPad dal cassetto, offrimi una birra! 🍺

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/M4M11XX4MS)

---

## Licenza

**Source Available** — uso personale come HA add-on permesso. Redistribuzione, modifica e uso commerciale non permessi. Vedi [LICENSE](LICENSE) per i termini completi.
