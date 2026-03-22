# Changelog

## [1.0.1] - 2026-03-22

### Security (post-audit fixes)
- **SEC-001 HIGH**: Replaced wildcard CORS `Access-Control-Allow-Origin: *` with restricted origin matching HA URL
- **SEC-002 HIGH**: Added per-domain service name allowlist (prevents calling `alarm_trigger`, etc.)
- **SEC-003 MEDIUM**: Added security headers middleware: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Content-Security-Policy`
- **SEC-004 MEDIUM**: Rate limiter dict now bounded to 5000 IPs with LRU eviction (prevents memory exhaustion)
- **SEC-005 MEDIUM**: Internal exception details no longer returned to clients (logged server-side only)
- **SEC-007 MEDIUM**: Added entity_id format validation (regex `^[a-z_]+\.[a-z0-9_]+$`) to prevent path traversal
- **SEC-012 INFO**: Removed unused `pyyaml` dependency (config uses stdlib JSON)
- **SEC-013 INFO**: Added WebSocket Origin header validation against configured HA URL

## [1.0.0] - 2026-03-22

### Added
- Initial release of Retro Panel
- Support for `light`, `switch`, `alarm_control_panel`, `sensor`, `binary_sensor` entities
- Touch-optimized interface compatible with iOS 15 Safari and legacy browsers
- Real-time state updates via Home Assistant WebSocket API (with fan-out to N clients)
- Secure backend proxy: HA token never exposed to browser
- Dark, light, and auto themes
- Kiosk mode (prevents text selection, optimized for always-on)
- Configurable entity grid (2, 3, or 4 columns)
- Fallback REST polling when WebSocket is unavailable
- Rate limiting: 10 service calls/second per client IP
- Italian and English translations
- Multi-arch Docker images: aarch64, amd64, armhf, armv7
- HA Supervisor Ingress integration
