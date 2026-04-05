# Retro Panel Documentation

Welcome to the Retro Panel documentation. This is the **SINGLE SOURCE OF TRUTH** for all Retro Panel development and understanding the project.

## Documentation Index

### For Understanding the Project

1. **[ARCHITECTURE.md](ARCHITECTURE.md)** - Complete technical architecture
   - Project overview and target users
   - Technology stack with full justifications
   - Complete directory structure (annotated)
   - Backend and frontend component architecture
   - Data flow diagrams (page load, service calls, WebSocket, reconnection)
   - Security model and threat mitigation
   - HA integration details
   - Browser compatibility matrix (iOS 12+, Chrome, Firefox, etc.)
   - Configuration schema documentation
   - Entity type reference (15 layout_type variants)

2. **[PROJECT.md](PROJECT.md)** - Project management and decisions
   - Project goals and success criteria
   - Design principles (usability, robustness, compatibility, no over-engineering)
   - Architectural Decision Records (ADR-001 through ADR-005)
   - Hard constraints and non-goals
   - Retrocompatibility policy
   - Release planning and timeline

3. **[ROADMAP.md](ROADMAP.md)** - Feature roadmap and versioning
   - v2.0 Released (2026-03-27) — complete refactor
   - v2.1 Planned (future features)
   - Performance targets
   - Breaking changes policy
   - Release schedule

### For Development

4. **[DEVELOPMENT.md](DEVELOPMENT.md)** - Developer guide
   - Quick start: local development without HA
   - Testing on real Home Assistant instance
   - Browser compatibility rules (CRITICAL - iOS 12+, no const/let/=>)
   - Step-by-step guide to adding new entity types (layout_type system)
   - Configuration schema change procedure
   - WebSocket debugging and common issues
   - Logging best practices

5. **[API.md](API.md)** - Internal API reference
   - Backend REST endpoints (GET /, /static/*, /api/*)
   - WebSocket message protocol (server→client and client→server)
   - Frontend module APIs (api.js, ws.js, app.js)
   - Component interface and lifecycle (layout_type system)
   - Error handling and response schemas
   - Code examples for each API

## Quick Navigation

### I want to...

**Understand what Retro Panel is**
→ Start with [PROJECT.md](PROJECT.md) "Project Goals" section

**Understand how it works**
→ Read [ARCHITECTURE.md](ARCHITECTURE.md) "Overview" and "Data Flow Diagrams"

**Set up local development**
→ Follow [DEVELOPMENT.md](DEVELOPMENT.md) "Local Development (No HA Required)"

**Add a new feature**
→ Use [DEVELOPMENT.md](DEVELOPMENT.md) "Adding a New Entity Type (layout_type)" as template

**Understand the API**
→ Read [API.md](API.md) with examples

**See what's planned**
→ Check [ROADMAP.md](ROADMAP.md) for features and timeline

**Understand design decisions**
→ Review [PROJECT.md](PROJECT.md) "Architectural Decisions (ADRs)"

**Debug an issue**
→ Go to [DEVELOPMENT.md](DEVELOPMENT.md) "Debugging WebSocket Issues"

**Extend Retro Panel safely**
→ Follow browser compatibility rules in [DEVELOPMENT.md](DEVELOPMENT.md) (iOS 12+, var/const, no const/let/=>)

---

## Project Overview (TL;DR)

**What is Retro Panel?**
Retro Panel is a lightweight Home Assistant control panel optimized for:
- iOS 12+ WKWebView (iPad on wall mount)
- Slower networks (3G/4G connections)
- Resource-constrained devices (Raspberry Pi 3B+)
- Simple, fast, distraction-free interface
- Legacy devices no longer receiving OS updates

**Technology Stack**:
- Backend: Python 3.11 + aiohttp (async web server)
- Frontend: Vanilla JavaScript ES2017 (no frameworks, no const/let/arrow functions — var only)
- Styling: Plain CSS with triple-lock tile dimensions
- Integration: Home Assistant Ingress proxy for authentication
- Communication: REST API for service calls, WebSocket for real-time updates

**Key Design Decisions**:
1. Python + aiohttp: Lightweight, HA ecosystem, minimal deps
2. Vanilla JS ES2017 with var-only: 15 KB vs React 35 KB, iOS 12 compatible
3. Plain CSS with fixed tile heights: No build overhead, immutable sizing
4. HA Ingress: Token isolation, security, network flexibility
5. WebSocket bridge: Server-side token storage, scalable
6. layout_type system: Backend-computed entity type, frontend-rendered component

**Current Features** (v2.9.26, 2026-04-04):
- Light, Switch, Sensor (9 variants), Binary Sensor (9 variants), Alarm, Camera, Scenario, Energy Flow
- Two-URL architecture: `/` (dashboard) and `/config` (admin)
- Bottom sheet for light controls (brightness/color temperature/hue)
- Room-based organization with sections; drag-and-drop nav order
- 5 configuration tabs: Overview, Rooms, Scenarios, Cameras, Alarms
- layout_type system for dynamic entity rendering (15+ types)
- Triple-lock tile dimensions (immutable heights)
- iOS 12+ compatible CSS (no gap/inset/100dvh)
- Camera MJPEG live streaming in lightbox with snapshot fallback
- Per-device theme toggle (dark/light/auto) in dashboard header
- IP whitelist, CSP hardening, rate limiting, alarm brute-force protection
- Direct port 7654 for legacy devices that cannot authenticate via HA Ingress

**Success Metrics**:
- Page load < 2 seconds on 4G
- Service calls < 1 second latency
- < 100 MB memory usage
- No transpilation (direct ES2017)

---

## Core Principles

1. **Usability Over Features**: Simple, usable interface > feature-rich complexity
2. **Robustness Over Elegance**: Reliable code > elegant but fragile code
3. **Compatibility Over Modernity**: Works on iOS 12+ > uses ES2025 features
4. **No Over-Engineering**: Build for v2.0 needs only, refactor when pattern is clear

---

## Important Constraints (MUST FOLLOW)

### Legacy Browser Compatibility (Hard Constraint)
- ES2017 maximum (no transpilation)
- **var keyword only (no const/let)**
- **No arrow functions (no =>)**
- **No optional chaining (?.)**
- **No nullish coalescing (??)**
- All vendor prefixes included (-webkit-)
- iOS 12+ minimum target
- Test regularly on real iOS devices

### CSS Constraints (Hard Constraint - v2.0)
- **No gap: on display:flex** (use margin instead)
- **No inset: shorthand** (use top/bottom/left/right)
- **No 100dvh** (use 100vh)
- Triple-lock tile heights (no height: auto)
- Media queries for responsive columns

### Memory Usage (Hard Constraint)
- Add-on: < 100 MB RSS (must run on Pi 3B+)
- Frontend: < 20 MB assets

### Response Time (Hard Constraint)
- Page load: < 2 seconds on 4G
- Service calls: < 1 second response

### Security (Hard Constraint)
- Tokens only on server-side (never in browser)
- All service calls validated against whitelist
- Configuration validated on load

---

## Documentation Structure

Each document is self-contained but cross-referenced:

```
README.md (this file)
  ├─ ARCHITECTURE.md (What it is, how it works)
  ├─ PROJECT.md (Why it exists, design decisions)
  ├─ ROADMAP.md (Where it's going)
  ├─ DEVELOPMENT.md (How to build it)
  └─ API.md (How to talk to it)
```

**Reading Order**:
1. This README to orient yourself
2. PROJECT.md for project goals and design decisions
3. ARCHITECTURE.md for technical deep-dive
4. DEVELOPMENT.md when ready to code
5. API.md for detailed endpoint reference

---

## File Locations

All documentation files are in: **`C:\Work\Sviluppo\retro-panel\retro-panel\docs\`**

```
retro-panel/docs/
├── README.md (this file)
├── ARCHITECTURE.md (13,000+ words)
├── PROJECT.md (7,000+ words)
├── ROADMAP.md (8,000+ words)
├── DEVELOPMENT.md (10,000+ words)
└── API.md (9,000+ words)
```

**Total Documentation**: 50,000+ words covering all aspects of the project

---

## For New Developers

1. **First Time?** Read PROJECT.md "Project Goals" (5 min read)
2. **Technical Overview?** Read ARCHITECTURE.md "Component Architecture" (15 min read)
3. **Want to Code?** Follow DEVELOPMENT.md "Quick Start" (10 min setup)
4. **Adding Features?** Use DEVELOPMENT.md "Adding a New Entity Type (layout_type)" (30 min reference)
5. **Debugging?** Go to DEVELOPMENT.md "Debugging WebSocket Issues" (reference as needed)

---

## Maintenance

**Documentation Owner**: Retro Panel Team

**Update Policy**:
- Update docs in same PR as code changes
- Keep docs synchronized with code
- If code behavior changes, update docs
- Review docs in code review

**How to Update**:
1. Edit the relevant `.md` file
2. Ensure changes are accurate and complete
3. Cross-reference other docs if needed
4. Include in PR with code changes
5. Update "Last Updated" timestamp

---

## Contact & Contribution

This documentation is the single source of truth for Retro Panel development. It should be thorough enough that any developer (or AI agent in future sessions) can understand the entire project without reading any code.

If something is unclear or missing, it should be documented here.

**Document Version**: 2.9.26
**Last Updated**: 2026-04-04
**Total Words**: 50,000+
**Coverage**: v2.9.26 features and architecture

---

## Quick Reference

| Topic | File | Section |
|-------|------|---------|
| Project goals | PROJECT.md | Project Goals |
| Design principles | PROJECT.md | Design Principles |
| Tech stack | ARCHITECTURE.md | Technology Stack |
| Directory structure | ARCHITECTURE.md | Directory Structure |
| Data flow | ARCHITECTURE.md | Data Flow Diagrams |
| Entity types | ARCHITECTURE.md | Entity Types (15 layout_types) |
| Browser support | ARCHITECTURE.md | Browser Compatibility Matrix |
| Local dev setup | DEVELOPMENT.md | Local Development |
| Real HA testing | DEVELOPMENT.md | Testing on Real HA |
| iOS 12 rules | DEVELOPMENT.md | Browser Compatibility Rules |
| Add entity type | DEVELOPMENT.md | Adding a New Entity Type (layout_type) |
| Change config | DEVELOPMENT.md | Configuration Schema Changes |
| Debug WebSocket | DEVELOPMENT.md | Debugging WebSocket Issues |
| v2.0 features | ROADMAP.md | v2.0 - Released |
| v2.1 roadmap | ROADMAP.md | v2.1 - Planned |
| REST endpoints | API.md | Backend REST Endpoints |
| WebSocket protocol | API.md | WebSocket Message Protocol |
| api.js functions | API.md | api.js Module |
| ws.js functions | API.md | ws.js Module |
| Component interface | API.md | Component Interface |
| layout_type system | ARCHITECTURE.md | Entity Type Reference |
| ADRs | PROJECT.md | Architectural Decisions |
