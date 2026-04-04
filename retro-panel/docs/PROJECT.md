# Retro Panel - Project Management (v2.0)

## Project Goals

### Primary Goals

**Why Retro Panel Exists**:
Retro Panel addresses a specific gap in the Home Assistant ecosystem. While Lovelace provides a comprehensive, feature-rich dashboard, it comes with significant performance and compatibility trade-offs. Retro Panel fills the niche for users who prioritize speed, simplicity, and device compatibility over feature completeness.

**Target Users**:
1. **Minimalists**: Users who want a simple, distraction-free interface
2. **Mobile Users**: People accessing HA primarily from phones on slower networks
3. **Older Device Users**: Those running Home Assistant on Raspberry Pi 3B+ or older hardware
4. **iOS Users**: Users who need iOS 12+ browser compatibility (older iPhones/iPads)
5. **Network-Constrained**: Users on 3G/4G or unstable connections
6. **Developers**: Those building custom HA interfaces and needing a lightweight foundation

**Success Criteria for Each User Type**:

| User Type | Goal | Success Measure |
|-----------|------|-----------------|
| Minimalists | Simple interface, no bloat | < 20 KB JS, < 20 tiles per page |
| Mobile Users | Fast load on 4G | < 2 second page load |
| Older Hardware | Low resource usage | < 100 MB memory |
| iOS Users | Full support on iOS 12+ | All features work (var/no const/let) |
| Network-Constrained | Works on 3G | Functional with 500 Kbps connection |
| Developers | Easy to extend | Clear component API, good docs |

## Success Criteria (v2.0 Released)

The v2.0 release is **COMPLETE**. All success criteria have been achieved:

### Functional Requirements (DONE)
- [x] All 15 entity types render correctly on iOS 12+
- [x] Service calls complete in < 1 second on local network
- [x] WebSocket automatically reconnects without user action
- [x] Configuration loads for typical 20-50 entity panels
- [x] No critical bugs in iOS 12+ (WebKit)
- [x] Two-URL architecture: `/` (dashboard) and `/config` (admin)

### Performance Requirements (DONE)
- [x] Page load time < 2 seconds on 4G network
- [x] Service call latency < 500 ms (local network)
- [x] WebSocket message delivery < 100 ms
- [x] Memory footprint < 100 MB RSS on Raspberry Pi 3B+
- [x] JavaScript bundle < 20 KB (uncompressed)
- [x] CSS bundle < 25 KB (uncompressed)

### Compatibility Requirements (DONE)
- [x] iOS 12+ WKWebView full support
- [x] iPad Air 2 (iOS 12+) tested and working
- [x] Android Chrome (latest versions)
- [x] Desktop Chrome/Firefox/Safari
- [x] Screen sizes 320px to 2560px width (responsive)
- [x] Touch devices and mouse/keyboard devices

### Quality Requirements (DONE)
- [x] Code coverage 70%+ (unit tests passing)
- [x] No console errors in browser DevTools
- [x] WCAG AA accessibility compliance
- [x] Documentation complete (50,000+ words)
- [x] Configuration schema validated on load
- [x] Error messages are user-friendly and actionable

### Security Requirements (DONE)
- [x] Authentication tokens isolated on server-side
- [x] Service call whitelist enforced
- [x] Service data validated against schema
- [x] No hardcoded credentials
- [x] HTTPS-safe (works behind SSL proxy)
- [x] No sensitive data logged

### Operational Requirements (DONE)
- [x] Passes Home Assistant's official add-on linting
- [x] Runs on Pi 3B+ without memory swaps
- [x] Restarts automatically if process crashes
- [x] Logs are useful for debugging
- [x] Configuration can be updated without restart

---

## Design Principles

These principles guide all development decisions for Retro Panel.

### 1. Usability Over Features

**Principle**: A simple, usable interface with 10 features is better than a complex interface with 100 features.

**Application**:
- Limit configuration options (< 50 total)
- Default to sensible values (user shouldn't need to tweak)
- UI should be self-explanatory (no help text needed for basic use)
- Progressive disclosure (advanced options hidden)

**Example**: Light brightness control
- Simple: On/Off toggle button
- Better: Toggle + brightness slider (iOS 12 compatible)
- Later: Brightness + color picker + animations

### 2. Robustness Over Elegance

**Principle**: Code that works reliably is more valuable than elegant code that might break.

**Application**:
- Defensive programming (validate all inputs)
- Graceful degradation (if feature unavailable, show fallback)
- No unnecessary optimizations (premature optimization is evil)
- Test error paths, not just happy paths

**Example**: WebSocket reconnection
- Robust: Retry with backoff + fallback to REST polling + state sync on reconnect

### 3. Compatibility Over Modernity

**Principle**: Code that runs on iOS 12+ is worth more than code using latest ES2025 features.

**Application**:
- Target ES2017 (not ES2020+) for broad compatibility
- **var keyword only (no const/let)**
- **No arrow functions (use function keyword)**
- Avoid polyfills and transpilers (they add bloat)
- Test on older devices regularly

**Example**: State management
- Compatible: Simple object + event listeners (lightweight, iOS 12 works)
- Not compatible: Redux + mobx (too heavy, requires transpilation)

### 4. No Over-Engineering Rule

**Principle**: Don't build infrastructure for hypothetical future needs.

**Application**:
- Build for v2.0 requirements only
- If feature is future-planned, hardcode it for now
- Refactor when pattern becomes clear (after 2-3 uses)
- YAGNI: "You Aren't Gonna Need It"

**Example**: Entity rendering
- v1.0: Hard-code light, switch, sensor components
- v1.4: Added rooms and sections
- v2.0: Refactored to layout_type system

---

## Architectural Decisions (ADRs)

Format: Problem → Options → Decision → Rationale

### ADR-001: Why Python + aiohttp Instead of Node.js

**Problem**: Need to build a lightweight web server for Home Assistant add-on.

**Options**:
1. **Python + aiohttp**: Async Python web framework
2. **Node.js + Express**: JavaScript runtime with popular web framework
3. **Go + Echo**: Compiled language with minimal overhead
4. **Python + Flask**: Simpler but blocking (no async)

**Decision**: Python + aiohttp

**Rationale**:
- Home Assistant is Python-based ecosystem
- aiohttp is lightweight (minimal dependencies) vs. Express/FastAPI
- Memory footprint: aiohttp ~50MB vs. Node ~80MB
- Python async/await more familiar to HA developers
- No need for compiled language (Go) - Python is fast enough
- Flask is blocking, so aiohttp is right trade-off

---

### ADR-002: Why Vanilla JavaScript (ES2017) Instead of React

**Problem**: Build interactive frontend for mobile devices with minimal overhead.

**Options**:
1. **Vanilla JavaScript (ES2017)**: No framework, direct DOM manipulation
2. **React**: Industry standard, virtual DOM, declarative
3. **Vue**: Lighter than React, good DX
4. **Svelte**: Compiles to vanilla JS

**Decision**: Vanilla JavaScript (ES2017) with **var keyword only, no const/let/arrow functions**

**Rationale**:
- Smallest bundle size: ~15 KB vs. React ~35-45 KB
- No build process: Simpler for HA developers to modify
- **No transpilation needed: Direct ES2017 → iOS 12 works**
- **var/function keywords ensure iOS 12 compatibility**
- Virtual DOM diffing is overkill for simple control panel
- State is simple (entity states), doesn't need React's complexity

---

### ADR-003: Why layout_type System (v2.0)

**Problem**: Need flexible entity rendering without complex domain inference.

**Options**:
1. **layout_type (backend-computed)**: Backend determines component, frontend renders
2. **Domain-only inference**: Frontend infers from domain (light/switch/etc.)
3. **Plugin system**: User-defined custom components (over-engineered)
4. **Config-specified type**: User manually specifies in config (error-prone)

**Decision**: Backend-computed layout_type field

**Rationale**:
- Backend has full entity context (domain + device_class)
- Frontend simply looks up component: `COMPONENT_MAP[layout_type]`
- Extensible without changes to frontend rendering logic
- 15 layout_types covers all v2.0 entity variants
- Backend can compute intelligently based on HA metadata

---

### ADR-004: Why Two URLs (/ and /config)

**Problem**: Dashboard and configuration UI have different requirements.

**Options**:
1. **Single URL with tabs**: All in one page (complex router)
2. **Two URLs**: Dashboard at /, Config UI at /config (separation)
3. **Separate domains**: Different subdomains (over-engineered)

**Decision**: Two URLs: `/` (dashboard) and `/config` (admin)

**Rationale**:
- Clear separation of concerns: Kiosk vs. Admin
- `/` is read-only, perfect for wall-mounted tablets
- `/config` is admin-only, requires HA authentication
- Simpler router logic on frontend
- Users open `/` for daily use, `/config` for setup only

---

### ADR-005: Why WebSocket Bridge Instead of Client-Direct

**Problem**: Browser needs real-time state updates from Home Assistant.

**Options**:
1. **WebSocket bridge**: Browser → Add-on → HA WebSocket
2. **Client-direct**: Browser WebSocket directly to HA (no app bridge)
3. **REST polling**: Periodic REST requests
4. **Server-sent events**: One-way server push

**Decision**: WebSocket bridge

**Rationale**:
- Security: HA token never exposed to browser
- Isolation: One HA token per add-on instance, not per browser
- Scalability: One HA connection serves multiple browsers
- Simplicity: No need for WebSocket auth in browser
- Reliability: Easier to reconnect if HA connection drops

---

## Constraints and Non-Goals

### Hard Constraints (Must Not Violate)

**Legacy Browser Compatibility**:
- Minimum: iOS 12+ WKWebView
- Minimum: var/function (no const/let/arrow functions)
- Requirement: Zero transpilation, ES2017 maximum
- Requirement: All vendor prefixes included (-webkit-)

**CSS Constraints (v2.0)**:
- **No gap: on display:flex** (use margin instead)
- **No inset: shorthand** (use top/bottom/left/right)
- **No 100dvh** (use 100vh)
- Triple-lock tile heights (immutable)

**Memory Usage**:
- Add-on must run on Raspberry Pi 3B+ (1 GB RAM)
- Max: 100 MB RSS (including Python runtime)
- Max: 20 MB for frontend assets

**Response Time**:
- Page load: < 2 seconds on 4G (1 Mbps)
- Service call: < 1 second response on local network
- WebSocket update: < 100 ms propagation

**Security**:
- Tokens never in browser (localStorage/sessionStorage forbidden)
- All service calls validated against whitelist
- Configuration must be validated on load
- No hardcoded secrets in code

---

## Release Planning

### v2.0 (Released 2026-03-27)

**Complete refactor with layout_type system, bottom sheet, two-URL architecture**

Features:
- 15 layout_types for dynamic entity rendering
- Bottom sheet for light controls
- Two-URL design: `/` (dashboard) and `/config` (admin)
- 4 configuration tabs: Overview, Rooms, Scenarios, Cameras
- Triple-lock tile dimensions (immutable heights)
- iOS 12+ compatible CSS (no gap/inset/100dvh)
- 22 passing unit tests

### v2.9.x (Released 2026-04-04 — Current Stable: v2.9.23)

Iterative improvements to the alarm tile, energy card, and camera grid:

- Energy Card v2: semaforo actionable, 7 entità, barre colorate
- Camera tile: griglia 4 colonne + lightbox fullscreen
- Security: IP whitelist, CSP, rate limit, alarm brute-force protection
- Porta 7654 diretta per dispositivi legacy che non supportano il login HA
- Alarm tile: completo rewrite con fix strutturali, CSS, state sync WS
- Fix critico: whitelist service call ora usa `all_entity_ids` (include alarm panel)
- UX: gerarchia status bar, chip WCAG 52px, hint dinamico armo

### v3.0+ (Planned)

- Plugin system for custom entity types
- Custom theme UI
- History charts and sparklines
- Offline-first with local cache

---

**Document Version**: 2.9.23
**Last Updated**: 2026-04-04
**Status**: v2.9.20 RELEASED
