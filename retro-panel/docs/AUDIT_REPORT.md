# Retro Panel — Security & Code Audit Report

**Version audited:** 1.0.0
**Audit date:** 2026-03-22
**Post-fix version:** 1.0.1
**Auditor:** Internal review
**Scope:** Full codebase — backend (Python/aiohttp), frontend (Vanilla JS/ES2017), CSS, Docker, HA Add-on config

---

## Executive Summary

Retro Panel v1.0.0 was audited for security vulnerabilities (OWASP Top 10), code correctness, and UI/UX conformance. Two critical functional bugs and eight security issues were identified. All issues were remediated before release of v1.0.1.

**Overall risk at v1.0.0: HIGH** (due to two HIGH-severity findings).
**Overall risk at v1.0.1: LOW** (all findings resolved).

---

## 1. Security Findings

### SEC-001 — Wildcard CORS | Severity: HIGH | Status: FIXED

**File:** `app/server.py`
**Description:** The original CORS middleware set `Access-Control-Allow-Origin: *` on every response, allowing any origin to make authenticated requests to the proxy.
**Impact:** A malicious page open in the same browser could send cross-origin requests to the add-on and execute HA service calls as the authenticated user.
**Fix:** Replaced `aiohttp_cors` wildcard with a custom `security_headers_middleware` that only echoes the `Origin` header back if it matches the configured `ha_url`. All other origins receive no CORS header.

---

### SEC-002 — No service name allowlist | Severity: HIGH | Status: FIXED

**File:** `app/api/handlers_service.py`
**Description:** The `service` URL parameter was passed directly to the HA API without validation. Any string (including `alarm_trigger`, `script.execute`, or other dangerous services) was proxied.
**Impact:** An attacker could call any HA service via the panel proxy, bypassing HA authorization on services the user never intended to expose.
**Fix:** Added `_ALLOWED_SERVICES` dictionary mapping each domain to a `frozenset` of explicitly permitted service names. Requests for unlisted services return HTTP 400.

```python
_ALLOWED_SERVICES = {
    "light":               frozenset({"turn_on", "turn_off", "toggle"}),
    "switch":              frozenset({"turn_on", "turn_off", "toggle"}),
    "alarm_control_panel": frozenset({"alarm_arm_home", "alarm_arm_away",
                                       "alarm_arm_night", "alarm_disarm"}),
    "input_boolean":       frozenset({"turn_on", "turn_off", "toggle"}),
    "cover":               frozenset({"open_cover", "close_cover",
                                       "stop_cover", "set_cover_position"}),
}
```

---

### SEC-003 — Missing security headers | Severity: MEDIUM | Status: FIXED

**File:** `app/server.py`
**Description:** No security headers were set. The panel was embeddable in any iframe and had no Content Security Policy.
**Impact:** Clickjacking via iframe embedding; potential XSS amplification without CSP.
**Fix:** Added to all responses via `security_headers_middleware`:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `no-referrer` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; frame-ancestors 'none';` |

---

### SEC-004 — Unbounded rate limiter memory | Severity: MEDIUM | Status: FIXED

**File:** `app/server.py`
**Description:** The sliding-window rate limiter stored one `deque` per client IP in an unbounded `dict`. An attacker could exhaust server memory by spoofing thousands of unique source IPs.
**Impact:** Denial of service via memory exhaustion on the Raspberry Pi host.
**Fix:** Bounded the dict to `RATE_LIMIT_MAX_IPS = 5000` with LRU eviction using a secondary `collections.deque` to track insertion order. When the limit is reached, the oldest IP entry is evicted before adding the new one.

---

### SEC-005 — Internal exception details leaked to clients | Severity: MEDIUM | Status: FIXED

**Files:** `app/api/handlers_service.py`, `app/api/handlers_state.py`
**Description:** Bare `except` clauses returned `f"Internal error: {exc}"` in the JSON response body.
**Impact:** Stack traces and internal error messages could expose server internals, library versions, file paths, or other reconnaissance information to an attacker.
**Fix:** All `except` clauses now return generic `{"error": "Internal server error."}`. Full exception details are logged server-side only via `logger.exception(...)`.

---

### SEC-007 — No entity_id format validation (path traversal risk) | Severity: MEDIUM | Status: FIXED

**Files:** `app/api/handlers_service.py`, `app/api/handlers_state.py`
**Description:** The `entity_id` path parameter was used directly in URL construction for HA API calls without format validation.
**Impact:** A crafted `entity_id` such as `light/../../../api/config` could potentially traverse paths in the upstream HA URL.
**Fix:** Added regex validation in both handlers before any processing:

```python
_ENTITY_ID_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")
```

Requests with non-matching `entity_id` values return HTTP 400.

---

### SEC-006 — No service call body type validation | Severity: LOW | Status: FIXED

**File:** `app/api/handlers_service.py`
**Description:** The request body was assumed to be a JSON object (`dict`) but no type check was performed. A JSON array or primitive would cause an `AttributeError` on `.get()`.
**Impact:** Malformed requests could produce unhelpful 500 errors; combined with SEC-005, could have leaked internals.
**Fix:** Added explicit `isinstance(body, dict)` check; returns HTTP 400 for non-object bodies.

---

### SEC-012 — Unused pyyaml dependency | Severity: INFO | Status: FIXED

**File:** `app/requirements.txt`
**Description:** `pyyaml` was listed as a dependency but is not used anywhere in the application. The HA Supervisor consumes `config.yaml`; the Python server reads `options.json` using stdlib `json`.
**Impact:** Unnecessary attack surface (any `pyyaml` CVE would affect this add-on); increased Docker image size.
**Fix:** Removed `pyyaml` from `requirements.txt`.

---

### SEC-013 — No WebSocket origin validation | Severity: INFO | Status: FIXED

**File:** `app/server.py`
**Description:** The WebSocket upgrade handler accepted connections from any `Origin` without validation.
**Impact:** Cross-Site WebSocket Hijacking (CSWH): a malicious page could open a WS connection to the panel and receive live state updates.
**Fix:** Added `Origin` header check in `ws_handler()`. Connections from origins other than the configured `ha_url` are rejected with HTTP 403.

---

## 2. Functional Bug Findings

### BUG-001 — Panel grid never displays | Severity: CRITICAL | Status: FIXED

**File:** `app/static/js/app.js` (line 187–188 in v1.0.0)
**Description:** After loading, `panelEl.removeAttribute('hidden')` removed the HTML `hidden` attribute, but the element uses the CSS class `.hidden` (not the attribute). A subsequent `panelEl.style.display = 'flex'` was overridden by `.hidden { display: none !important }` in the stylesheet.
**Impact:** The tile grid was permanently invisible. The add-on was completely non-functional on first boot.

**Root cause:** CSS class `.hidden` has `!important` priority; inline `style.display` cannot override it.

**Fix:**
```javascript
// BEFORE (broken)
panelEl.removeAttribute('hidden');
panelEl.style.display = 'flex';

// AFTER (fixed)
panelEl.classList.remove('hidden');
```

---

### BUG-002 — Long-press always triggers light toggle | Severity: CRITICAL | Status: FIXED

**File:** `app/static/js/components/light.js`
**Description:** `setTimeout()` returns a numeric timer ID (e.g. `42`). When the long-press timer fires, `handleLongPress()` did not set `longPressTimer = null`. The expired ID (`42`) remained truthy. The `touchend` event handler checks `if (longPressTimer)` — seeing `42`, it called `handleTap()`, toggling the light on every long-press.
**Impact:** Every long-press to open the brightness slider also toggled the light on/off. The brightness control was unusable.

**Root cause:** `setTimeout()` IDs are truthy even after the timer has fired; the code only set `longPressTimer = null` in the `touchend` path, not in the callback.

**Fix:**
```javascript
function handleLongPress() {
  longPressTimer = null;  // MUST be first — clears before touchend fires
  sliderVisible = !sliderVisible;
  // ...
}
```

---

## 3. Code Quality Findings

### CQ-001 — MAP objects re-created on every function call | Severity: P2 | Status: FIXED

**File:** `app/static/js/utils/format.js`
**Description:** `getBinarySensorLabel()` and `getAlarmStateInfo()` each defined a `const MAP = {...}` inside the function body. This object was re-allocated on every call.
**Fix:** Moved both maps to module-level constants (`_BINARY_SENSOR_LABELS`, `_ALARM_STATE_MAP`).

---

### CQ-002 — Alarm action buttons below 56px min-height | Severity: P2 | Status: FIXED

**File:** `app/static/css/components.css`
**Description:** `.alarm-btn` had `min-height: 48px`, below the 56px standard used by all other interactive elements in the app.
**Fix:** Changed to `min-height: 56px` for consistency and accessibility.

---

### CQ-003 — Strict equality on nullable row/col | Severity: P2 | Status: FIXED

**File:** `app/static/js/app.js`
**Description:** Grid position check used `!== null`, but `entityConfig.row` and `entityConfig.col` are `undefined` when not provided (JavaScript object missing keys). `undefined !== null` is `true`, causing the position to be applied even when no grid position was configured.
**Fix:** Changed to loose equality `!= null`, which correctly catches both `null` and `undefined`.

---

### CQ-004 — refresh_interval int() not guarded against falsy values | Severity: P3 | Status: FIXED

**File:** `app/config/loader.py`
**Description:** `int(raw.get("refresh_interval", 30))` would return `0` if the config contained `"refresh_interval": 0` or `"refresh_interval": null`, causing polling to fire every millisecond.
**Fix:** Changed to `int(raw.get("refresh_interval", 30) or 30)` to default to 30 for falsy values.

---

### CQ-005 — Unused CSS variable in light theme | Severity: P3 | Status: FIXED

**File:** `app/static/css/themes.css`
**Description:** `--color-surface-raised` was defined in the light theme block but not referenced by any CSS rule.
**Fix:** Removed the declaration.

---

## 4. UI/UX Review

### Touch targets

All interactive elements meet or exceed the 56px touch target guideline (WCAG 2.5.5, Apple HIG):

| Element | Min-height | Status |
|---------|-----------|--------|
| Tile (light, switch) | Full tile (~120px) | Pass |
| Brightness slider | System default | Pass |
| Alarm keypad keys | 56px | Pass |
| Alarm action buttons | 56px (fixed in CQ-002) | Pass (after fix) |

### Legacy device (iOS 12+) compatibility

All JavaScript uses ES2017 features or earlier. The following modern features were intentionally avoided:

| Feature | Reason omitted |
|---------|---------------|
| Top-level `await` | Not available in iOS 12 |
| `??=` (logical assignment) | Not available in iOS 12 |
| `structuredClone()` | Not available in iOS 12 |
| `Array.at()` | Not available in iOS 12 |
| CSS container queries | Not available in iOS 12 |
| CSS `:has()` | Not available in iOS 12 |
| `<dialog>` element | Unreliable on legacy devices |

### Tap delay elimination

- `touch-action: manipulation` applied globally
- `-webkit-tap-highlight-color: transparent` applied globally
- No `click` handlers on touch devices (touch events handle interaction)

### Kiosk mode

- `-webkit-user-select: none; user-select: none` applied to all elements in kiosk mode
- `-webkit-touch-callout: none` prevents iOS long-press context menu

---

## 5. Architecture Security Review

### Token isolation

The HA Long-Lived Access Token is:
- Stored only in `options.json` on the host filesystem (HA Supervisor manages permissions)
- Loaded into `PanelConfig.ha_token` (name-mangled as `__ha_token` in `HAClient`)
- Never included in any API response (explicitly excluded in `handlers_config.py`)
- Never logged

### Attack surface

The only externally accessible surface is the aiohttp HTTP server on port 7654 (or via HA Ingress):

| Endpoint | Auth | Notes |
|----------|------|-------|
| `GET /api/config` | None (panel is HA-Ingress protected) | Returns safe config subset, no token |
| `GET /api/states` | None | Returns states for configured entities only |
| `GET /api/state/{id}` | None | Whitelist + format validation |
| `POST /api/service/{domain}/{service}` | None | Allowlist, whitelist, rate-limited |
| `GET /ws` | Origin check | WebSocket upgrade |
| `GET /` | None | Static files only |

Note: HA Ingress provides session-based authentication at the Supervisor level. The add-on itself does not implement authentication, consistent with the HA Add-on security model.

### Data flow security

```
Browser → [HA Supervisor Ingress (auth)] → Retro Panel (port 7654)
                                                 │
                           ┌─────────────────────┤
                           ▼                     ▼
                    REST /api/states      WebSocket /ws
                           │                     │
                           └──────┬──────────────┘
                                  ▼
                           HAClient (token in header)
                                  │
                                  ▼
                    Home Assistant API (port 8123)
```

---

## 6. Dependency Audit

| Package | Version | CVEs (at audit date) | Notes |
|---------|---------|---------------------|-------|
| `aiohttp` | 3.9.5 | None known | Latest stable |
| `pyyaml` | — | Removed | Was unused (SEC-012) |
| Python stdlib | 3.11 | None relevant | `json`, `re`, `collections` |

---

## 7. Summary Table

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| BUG-001 | Panel grid never displays | CRITICAL | Fixed in v1.0.1 |
| BUG-002 | Long-press triggers light toggle | CRITICAL | Fixed in v1.0.1 |
| SEC-001 | Wildcard CORS | HIGH | Fixed in v1.0.1 |
| SEC-002 | No service name allowlist | HIGH | Fixed in v1.0.1 |
| SEC-003 | Missing security headers | MEDIUM | Fixed in v1.0.1 |
| SEC-004 | Unbounded rate limiter memory | MEDIUM | Fixed in v1.0.1 |
| SEC-005 | Internal error details leaked | MEDIUM | Fixed in v1.0.1 |
| SEC-006 | No request body type check | LOW | Fixed in v1.0.1 |
| SEC-007 | No entity_id format validation | MEDIUM | Fixed in v1.0.1 |
| SEC-012 | Unused pyyaml dependency | INFO | Fixed in v1.0.1 |
| SEC-013 | No WebSocket origin validation | INFO | Fixed in v1.0.1 |
| CQ-001 | MAP objects re-created per call | P2 | Fixed in v1.0.1 |
| CQ-002 | Alarm buttons below 56px target | P2 | Fixed in v1.0.1 |
| CQ-003 | Strict null check on row/col | P2 | Fixed in v1.0.1 |
| CQ-004 | refresh_interval falsy not guarded | P3 | Fixed in v1.0.1 |
| CQ-005 | Unused CSS variable | P3 | Fixed in v1.0.1 |

**All 16 findings resolved in v1.0.1.**

---

## 8. Recommendations for Future Releases

1. **Add authentication at panel level** if the add-on is ever exposed without HA Ingress (e.g. direct port forwarding). Currently the security model relies entirely on HA Ingress.
2. **Pin aiohttp** to a specific patch version in CI and auto-update via Dependabot/Renovate.
3. **Add automated browser tests** (Playwright) targeting iOS 15 Safari viewport to prevent regressions on touch behavior.
4. **Rate limit WebSocket connections** (currently only REST service calls are rate-limited).
5. **Add CSP nonce** for `style-src` to remove `'unsafe-inline'` once the CSS architecture supports it.
