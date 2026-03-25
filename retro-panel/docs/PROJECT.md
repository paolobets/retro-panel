# Retro Panel - Project Management

## Project Goals

### Primary Goals

**Why Retro Panel Exists**:
Retro Panel addresses a specific gap in the Home Assistant ecosystem. While Lovelace provides a comprehensive, feature-rich dashboard, it comes with significant performance and compatibility trade-offs. Retro Panel fills the niche for users who prioritize speed, simplicity, and device compatibility over feature completeness.

**Target Users**:
1. **Minimalists**: Users who want a simple, distraction-free interface
2. **Mobile Users**: People accessing HA primarily from phones on slower networks
3. **Older Device Users**: Those running Home Assistant on Raspberry Pi 3B+ or older hardware
4. **iOS Users**: Users who need legacy browser compatibility (older iPhones/iPads)
5. **Network-Constrained**: Users on 3G/4G or unstable connections
6. **Developers**: Those building custom HA interfaces and needing a lightweight foundation

**Success Criteria for Each User Type**:

| User Type | Goal | Success Measure |
|-----------|------|-----------------|
| Minimalists | Simple interface, no bloat | < 20 KB JS, < 20 tiles per panel |
| Mobile Users | Fast load on 4G | < 2 second page load |
| Older Hardware | Low resource usage | < 100 MB memory |
| iOS Users | Full support on legacy devices | All features work on legacy devices (iOS 12+) |
| Network-Constrained | Works on 3G | Functional with 500 Kbps connection |
| Developers | Easy to extend | Clear component API, good docs |

## Success Criteria (v1.0)

The v1.0 release is considered successful when ALL of the following are true:

### Functional Requirements
- [ ] All entity types (light, switch, sensor, binary_sensor) render correctly
- [ ] Service calls complete in < 1 second on local network
- [ ] WebSocket automatically reconnects without user action
- [ ] Configuration loads for typical 20-50 entity panels
- [ ] No critical bugs in legacy mobile Safari (WebKit)
- [ ] No critical bugs in Chrome/Firefox

### Performance Requirements
- [ ] Page load time < 2 seconds on 4G network (1 Mbps)
- [ ] Service call latency < 500 ms (local network)
- [ ] WebSocket message delivery < 100 ms
- [ ] Memory footprint < 100 MB RSS on Raspberry Pi 3B+
- [ ] JavaScript bundle < 20 KB (uncompressed)
- [ ] CSS bundle < 25 KB (uncompressed)

### Compatibility Requirements
- [ ] legacy mobile Safari (WebKit) on legacy devices
- [ ] iPad Air 2 (iOS 12+)
- [ ] Android Chrome (latest 3 versions)
- [ ] Desktop Chrome/Firefox/Safari (modern versions)
- [ ] Screen sizes 320px to 2560px width (responsive)
- [ ] Touch devices and mouse/keyboard devices

### Quality Requirements
- [ ] All code paths tested (70%+ code coverage)
- [ ] No console errors in browser DevTools
- [ ] WCAG AA accessibility compliance (images have alt text, etc.)
- [ ] Documentation complete (architecture, API, development guide, user guide)
- [ ] Configuration schema validated on load
- [ ] Error messages are user-friendly and actionable

### Security Requirements
- [ ] Authentication tokens isolated on server-side
- [ ] Service call whitelist enforced
- [ ] Service data validated against schema
- [ ] No hardcoded credentials
- [ ] HTTPS-safe (works behind SSL proxy)
- [ ] No sensitive data logged

### Operational Requirements
- [ ] Passes Home Assistant's official add-on linting
- [ ] Runs on Pi 3B+ without memory swaps
- [ ] Restarts automatically if process crashes
- [ ] Logs are useful for debugging
- [ ] Configuration can be updated without restart (future: hot-reload)

## Design Principles

These principles guide all development decisions for Retro Panel.

### 1. Usability Over Features

**Principle**: A simple, usable interface with 10 features is better than a complex interface with 100 features.

**Application**:
- Limit configuration options (< 50 total in v1.0)
- Default to sensible values (user shouldn't need to tweak)
- UI should be self-explanatory (no help text needed for basic use)
- Progressive disclosure (advanced options hidden)

**Example**: Light brightness control
- Simple: On/Off toggle button
- Better: Toggle + brightness slider (legacy browser compatible)
- Over-engineered: Brightness slider + RGB color picker + animation profiles (v2.0+)

### 2. Robustness Over Elegance

**Principle**: Code that works reliably is more valuable than elegant code that might break.

**Application**:
- Defensive programming (validate all inputs)
- Graceful degradation (if feature unavailable, show fallback)
- No unnecessary optimizations (premature optimization is evil)
- Test error paths, not just happy paths

**Example**: WebSocket reconnection
- Elegant: Single retry with exponential backoff
- Robust: Retry with backoff + fallback to REST polling + state sync on reconnect + error logging

### 3. Compatibility Over Modernity

**Principle**: Code that runs on legacy mobile Safari is worth more than code using latest ES2025 features.

**Application**:
- Target ES2017 (not ES2020+) for broad compatibility
- Avoid polyfills and transpilers (they add bloat)
- Test on older devices regularly
- Avoid CSS/JS features that need vendor prefixes (design without them when possible)

**Example**: State management
- Modern: Redux + mobx + signals (too heavy)
- Compatible: Simple object + event listeners (lightweight, legacy mobile Safari works)

### 4. No Over-Engineering Rule

**Principle**: Don't build infrastructure for hypothetical future needs.

**Application**:
- Build for v1.0 requirements only
- If feature is future-planned, hardcode it for now
- Refactor when pattern becomes clear (after 2-3 uses)
- YAGNI: "You Aren't Gonna Need It"

**Example**: Entity rendering
- Not needed in v1.0: Plugin system for custom entity types
- Build in v1.0: Hard-code light, switch, sensor components
- Build in v2.0: Plugin system once pattern is clear

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

**Trade-offs Accepted**:
- Go would be slightly more memory-efficient, but adds build complexity
- Node.js would be faster, but adds resource overhead
- Python is good enough for this use case

### ADR-002: Why Vanilla JavaScript Instead of React

**Problem**: Build interactive frontend for mobile devices with minimal overhead.

**Options**:
1. **Vanilla JavaScript (ES2017)**: No framework, direct DOM manipulation
2. **React**: Industry standard, virtual DOM, declarative
3. **Vue**: Lighter than React, good DX
4. **Svelte**: Compiles to vanilla JS

**Decision**: Vanilla JavaScript (ES2017)

**Rationale**:
- Smallest bundle size: ~15 KB vs. React ~35-45 KB
- No build process: Simpler for HA developers to modify
- No transpilation needed: Direct ES2017 → legacy mobile Safari works
- Virtual DOM diffing is overkill for simple control panel
- State is simple (entity states), doesn't need React's complexity

**Trade-offs Accepted**:
- Slightly more verbose than React (no JSX, manual DOM)
- No strong typing (no TypeScript in v1.0)
- If codebase grows, might need refactoring (acceptable for v1-2)

### ADR-003: Why HA Ingress Instead of Direct Port Exposure

**Problem**: Expose add-on UI safely to Home Assistant users.

**Options**:
1. **HA Ingress proxy**: Access through HA's proxy with session-based auth
2. **Direct port exposure**: Add-on listens on port, exposed to network
3. **Reverse proxy**: Set up separate reverse proxy with OAuth

**Decision**: HA Ingress proxy

**Rationale**:
- Security: Ingress proxy validates session token before forwarding
- Simplicity: No additional auth layer needed
- Network: Works behind NAT/firewalls automatically
- Standard: All HA add-ons use Ingress
- Token isolation: Token never sent to browser (server-side only)

**Trade-offs Accepted**:
- Ingress adds small latency overhead (negligible)
- Can't access add-on without HA (expected for HA ecosystem)

### ADR-004: Why WebSocket Bridge Instead of Client-Direct WebSocket

**Problem**: Browser needs real-time state updates from Home Assistant.

**Options**:
1. **WebSocket bridge (app/ws_proxy.py)**: Browser → Add-on → HA WebSocket
2. **Client-direct**: Browser WebSocket directly to HA (no app bridge)
3. **REST polling**: Periodic REST requests instead of WebSocket
4. **Server-sent events**: One-way server push

**Decision**: WebSocket bridge

**Rationale**:
- Security: HA token never exposed to browser (token lives on server)
- Isolation: One HA token per add-on instance, not per browser
- Scalability: One HA connection serves multiple browsers
- Simplicity: No need for WebSocket auth in browser
- Reliability: Easier to reconnect if HA connection drops

**Trade-offs Accepted**:
- Slight latency overhead (negligible for control panel)
- More complex than direct client WebSocket
- Uses slightly more server resources (one WS per browser, not ideal for 100+ concurrent users - not a concern for HA)

### ADR-005: Why REST for Service Calls Instead of WebSocket

**Problem**: Send service calls to Home Assistant (e.g., "turn on light").

**Options**:
1. **REST API**: POST to `/api/services/{domain}/{service}`
2. **WebSocket**: Send service calls over WebSocket connection
3. **Queue system**: Queue calls and process asynchronously

**Decision**: REST API

**Rationale**:
- HA WebSocket is optimized for state subscriptions, not RPC
- REST is standard for service calls (HA official)
- Simpler to implement and understand
- Easier to add response handling
- Built-in timeout handling

**Trade-offs Accepted**:
- REST is slightly heavier than WebSocket for single calls
- Need to handle REST connection separately from WebSocket
- For v1 it's acceptable (service calls are infrequent, not high-volume)

---

## Constraints and Non-Goals

### Hard Constraints (Must Not Violate)

**Legacy Browser Compatibility**:
- Minimum: iPhone 6S (A9 chip)
- Minimum: legacy WebKit
- Requirement: Zero transpilation, ES2017 maximum
- Requirement: All vendor prefixes included

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

### Non-Goals (Out of Scope)

**Authentication** (v1.0):
- Retro Panel is not responsible for user authentication
- Relies entirely on HA Ingress authentication
- Future: PIN lock (v2.0) for optional secondary auth

**Replacement for Lovelace**:
- Not trying to feature-parity with Lovelace
- Intentionally simpler and lighter
- Different design philosophy (compatibility over features)

**Multi-Dashboard/Multiple Instances** (v1.0):
- v1.0 supports single panel only
- Multiple pages planned for v1.5
- Multi-instance support planned for v2.0+

**Climate Control** (v1.0):
- Thermostat entities not supported until v2.0
- Requires complex control logic (heat, cool, auto modes)
- Planned: v2.0

**Media Playback** (v1.0):
- Media player entities not supported until v2.0
- Requires album art display, playback controls
- Planned: v2.0

**Customization Via UI** (v1.0):
- No visual config builder in v1.0
- Users edit YAML manually
- Planned: Simple web UI config editor (v2.0)

**Offline Support** (v1.0):
- Requires internet connection
- No local caching of state
- Planned: Service worker + offline fallback (v2.0+)

**Accessibility Advanced Features** (v1.0):
- WCAG AA compliance basic level
- Screen reader support basic
- Keyboard navigation basic
- Planned: Advanced accessibility in v2.0

## Retrocompatibility Policy

### Configuration Schema

**Additive Changes Only in Minor Versions**:
- v1.0 → v1.5: Can add new optional fields
- v1.5 → v1.6: Can add new optional fields
- Existing configs continue to work unchanged

**Example**:
```json
// v1.0 config
{
  "panels": [{"name": "Main", "rows": [...]}]
}

// v1.5 adds "auto_layout" option
{
  "panels": [{"name": "Main", "entities": [...], "columns": 2}]
  // Old format still works too
}
```

**Breaking Changes Require Major Version**:
- v1.x → v2.0: Can remove fields, rename fields, change structure
- Must provide migration guide
- Must update documentation

**Example**:
```
v1.x supports:
{
  "panels": [{...}]
}

v2.0 changes to:
{
  "dashboards": [{...}]  // Renamed field
}

Migration path provided in release notes:
> Rename "panels" to "dashboards" in your configuration
```

### Entity Component API Stability

**After v1.0, Component API is Stable**:
- `createTile(config, state)` → returns HTMLElement
- `updateTile(element, state)` → mutates element
- `handleInteraction(entityId, action)` → returns Promise

These signatures will not change in minor versions (v1.x, v2.x).

**New Options Added in Minor Versions**:
- v1.5: Add `config.show_brightness` (optional)
- v1.6: Add `config.animation_style` (optional)
- Component must handle missing options gracefully

**Component Changes in Major Versions**:
- v3.0: Could change API if needed, with migration guide

### Deprecation Process

**Timeline for Deprecation**:
1. Feature marked as "deprecated" in v1.x release
2. Works unchanged in v1.x
3. Removed in v2.0
4. Migration guide provided at step 1

**Example**:
```
v1.5 Release Notes:
> "The 'service_data_schema' option is deprecated.
>  Use 'service_data_validation' instead (functionally identical).
>  This will be removed in v2.0. See migration guide."

v1.6 Release Notes:
> "Both 'service_data_schema' and 'service_data_validation' work.
>  Prepare now for v2.0 where old name will be removed."

v2.0 Release Notes:
> "BREAKING: Removed 'service_data_schema'.
>  Use 'service_data_validation' instead. Update your configs."
```

## Release Planning

### Version 1.0 (Current)

**Target Date**: Q2 2026

**Key Milestones**:
- Week 1-2: Core API and component architecture
- Week 3-4: Entity type components (light, switch, sensor, binary_sensor)
- Week 5: WebSocket and real-time updates
- Week 6: legacy mobile Safari testing and fixes
- Week 7: Documentation and polish
- Week 8: Testing with real HA instance
- Week 9: Add-on linting and submission

**Success Criteria**: All defined in "Success Criteria (v1.0)" section above

### Version 1.5 (Planned)

**Target Date**: Q3 2026 (8 weeks after v1.0)

**Focus**: Multi-page support, more entity types, quality of life improvements

**Key Features**:
- Multiple pages/panels with swipe navigation
- Cover entities (garage, blinds)
- Input boolean, input select
- Auto-layout (no manual row/col config)
- Camera MJPEG proxy
- Wake Lock API attempt

### Version 2.0 (Planned)

**Target Date**: Q4 2026 / Q1 2027 (12+ weeks after v1.5)

**Focus**: Advanced features, polish, CI/CD

**Key Features**:
- Climate entity (thermostat)
- Media player entity
- Panel PIN lock (SQLite)
- History sparklines
- Dark/light theme auto-switch
- GitHub Actions CI/CD

---

**Document Version**: 1.0
**Last Updated**: 2026-03-22
**Maintainer**: Retro Panel Team
