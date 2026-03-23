"""
Retro Panel — main aiohttp server entrypoint.

Starts the async HTTP server, registers all routes, applies middleware,
launches the HA WebSocket proxy background task, and serves static files.

Security model:
- Designed to run behind HA Supervisor Ingress (authenticated reverse proxy).
- Token is never exposed to the frontend; all HA calls are proxied server-side.
- CORS is restricted to the configured HA origin (no wildcard).
- Standard security headers applied on every response.
- Rate limiting on service calls (10 req/s per IP, sliding window with cleanup).
"""

from __future__ import annotations

import asyncio
import collections
import logging
import re
import time
from pathlib import Path
from typing import Callable, Awaitable

import aiohttp
from aiohttp import web

# ---------------------------------------------------------------------------
# Logging — configured before any other import that might log
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Local imports
from config.loader import load_config
from config.validator import validate_config, validate_ha_connection
from proxy.ha_client import HAClient
from proxy.supervisor_client import SupervisorClient
from proxy.ws_proxy import WSProxy
from api.handlers_state import get_state, get_all_states
from api.handlers_service import call_service
from api.handlers_config import get_panel_config
from api.handlers_entities import get_all_entities
from api.handlers_config_save import save_config
from api.handlers_areas import get_ha_areas

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
HOST = "0.0.0.0"   # Required: HA Supervisor Ingress connects to the container
PORT = 7654
STATIC_DIR = Path(__file__).parent / "static"
RATE_LIMIT_MAX = 10        # max service POST calls per window
RATE_LIMIT_WINDOW = 1.0    # window size in seconds
RATE_LIMIT_MAX_IPS = 5000  # cap on tracked IPs to prevent memory exhaustion

# Validate entity_id format: domain.object_id (e.g. light.living_room)
_ENTITY_ID_RE = re.compile(r"^[a-z_]+\.[a-z0-9_]+$")

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

# Sliding-window buckets keyed by client IP.
# Bounded to RATE_LIMIT_MAX_IPS entries; oldest keys evicted when full.
_rate_windows: dict[str, collections.deque] = {}
_rate_keys_order: collections.deque = collections.deque()  # insertion-order LRU tracking


def _get_rate_window(ip: str) -> collections.deque:
    """Return (and lazily create) the rate-limit bucket for an IP.

    Evicts the oldest bucket when the dictionary reaches RATE_LIMIT_MAX_IPS,
    preventing unbounded memory growth from IP spoofing.
    """
    if ip not in _rate_windows:
        if len(_rate_windows) >= RATE_LIMIT_MAX_IPS:
            # Evict the oldest tracked IP
            oldest = _rate_keys_order.popleft()
            _rate_windows.pop(oldest, None)
        _rate_windows[ip] = collections.deque()
        _rate_keys_order.append(ip)
    return _rate_windows[ip]


@web.middleware
async def rate_limit_middleware(
    request: web.Request,
    handler: Callable[[web.Request], Awaitable[web.Response]],
) -> web.Response:
    """Sliding-window rate limiter: max 10 service POST calls per IP per second.

    Only applies to POST /api/service/* routes. All other routes pass through.
    Uses X-Forwarded-For when present (HA Ingress sets this header).
    """
    if request.method == "POST" and request.path.startswith("/api/service/"):
        # Prefer X-Forwarded-For set by HA Ingress proxy; fall back to remote
        ip: str = request.headers.get("X-Forwarded-For", request.remote or "unknown").split(",")[0].strip()
        now = time.monotonic()
        window = _get_rate_window(ip)

        # Evict timestamps outside the current window
        while window and now - window[0] > RATE_LIMIT_WINDOW:
            window.popleft()

        if len(window) >= RATE_LIMIT_MAX:
            logger.warning("Rate limit exceeded for IP %s", ip)
            return web.json_response(
                {"error": "Rate limit exceeded. Try again in 1 second."},
                status=429,
            )

        window.append(now)

    return await handler(request)


@web.middleware
async def ingress_path_middleware(
    request: web.Request,
    handler: Callable[[web.Request], Awaitable[web.Response]],
) -> web.Response:
    """Strip the HA Ingress path prefix from incoming requests when present.

    HA Supervisor sets X-Ingress-Path to the add-on's ingress base path
    (e.g. /api/hassio_ingress/abc123). The app is mounted at /, so strip it.
    """
    ingress_prefix: str = request.headers.get("X-Ingress-Path", "").rstrip("/")
    if ingress_prefix and request.path.startswith(ingress_prefix):
        stripped = request.path[len(ingress_prefix):] or "/"
        request = request.clone(rel_url=request.rel_url.with_path(stripped))

    return await handler(request)


@web.middleware
async def security_headers_middleware(
    request: web.Request,
    handler: Callable[[web.Request], Awaitable[web.Response]],
) -> web.Response:
    """Add security headers to every response.

    - X-Frame-Options: prevents clickjacking.
    - X-Content-Type-Options: prevents MIME sniffing.
    - Referrer-Policy: prevents HA session tokens from leaking via Referer.
    - Content-Security-Policy: defense-in-depth against XSS.
      'unsafe-inline' is required for the inline style attribute used by
      the grid column CSS variable (--columns).
    - CORS: restricted to the HA instance origin (not wildcard).
      Only applied if the request origin matches the configured HA URL.
    """
    if request.method == "OPTIONS":
        # Preflight: allow the configured HA origin only
        response = web.Response(status=204)
    else:
        response = await handler(request)

    # Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # No referrer sent to external origins
    response.headers["Referrer-Policy"] = "no-referrer"
    # CSP: allow HA Ingress to embed this page in an iframe.
    # X-Frame-Options is intentionally NOT set — it would block the HA Ingress iframe.
    # frame-ancestors uses the HA origin so only the HA instance can embed us.
    ha_url: str = getattr(request.app.get("config"), "ha_url", "")
    frame_ancestors = ha_url.rstrip("/") if ha_url else "'self'"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "connect-src 'self' ws: wss:; "
        f"frame-ancestors {frame_ancestors} 'self';"
    )

    # Restricted CORS: allow the HA origin for local dev (not wildcard)
    origin = request.headers.get("Origin", "")
    ha_url: str = getattr(request.app.get("config"), "ha_url", "")
    if origin and ha_url and origin.rstrip("/") == ha_url.rstrip("/"):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"

    return response


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

async def ws_handler(request: web.Request) -> web.WebSocketResponse:
    """Handle browser WebSocket upgrade requests at GET /ws.

    Validates the Origin header against the HA URL to prevent cross-origin
    WebSocket hijacking. Browser-to-server messages are explicitly discarded
    (the protocol is server-push only).
    """
    # Origin validation: block cross-origin WebSocket connections
    origin = request.headers.get("Origin", "")
    ha_url: str = getattr(request.app.get("config"), "ha_url", "")
    request_host = f"{request.scheme}://{request.host}"

    # Allow: same host (Ingress) OR configured HA URL (for local dev)
    # An empty origin is allowed for non-browser clients (e.g. curl testing)
    if origin and ha_url and origin.rstrip("/") not in (
        ha_url.rstrip("/"),
        request_host.rstrip("/"),
    ):
        logger.warning("Rejected WebSocket from disallowed origin: %s", origin)
        return web.Response(status=403, text="Forbidden: origin not allowed")

    ws_proxy: WSProxy = request.app["ws_proxy"]
    ws = web.WebSocketResponse(heartbeat=30)
    await ws.prepare(request)

    ws_proxy.add_client(ws)
    logger.info("Browser WebSocket connected from %s", request.remote)

    try:
        async for msg in ws:
            # Protocol is server-push only: browser messages are discarded.
            if msg.type == aiohttp.WSMsgType.ERROR:
                logger.debug("Browser WS error: %s", ws.exception())
                break
            # Explicitly ignore TEXT/BINARY from browser (not part of protocol)
    finally:
        ws_proxy.remove_client(ws)
        logger.info("Browser WebSocket disconnected from %s", request.remote)

    return ws


# ---------------------------------------------------------------------------
# Static file / index route
# ---------------------------------------------------------------------------

async def index_handler(request: web.Request) -> web.FileResponse:
    """Serve the main SPA entry point (index.html)."""
    return web.FileResponse(STATIC_DIR / "index.html")


async def config_page_handler(request: web.Request) -> web.FileResponse:
    """Serve the entity picker configuration page (config.html)."""
    return web.FileResponse(STATIC_DIR / "config.html")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app(config, ha_client: HAClient, ws_proxy: WSProxy) -> web.Application:
    """Build and configure the aiohttp Application.

    Middleware stack (applied in order):
    1. ingress_path_middleware  — strips HA Ingress prefix
    2. security_headers_middleware — adds security headers + restricted CORS
    3. rate_limit_middleware    — limits service POST calls per IP
    """
    app = web.Application(
        middlewares=[
            ingress_path_middleware,
            security_headers_middleware,
            rate_limit_middleware,
        ]
    )

    app["config"] = config
    app["ha_client"] = ha_client
    app["ws_proxy"] = ws_proxy
    app["supervisor_client"] = SupervisorClient()

    # Routes
    app.router.add_get("/", index_handler)
    app.router.add_get("/config", config_page_handler)
    app.router.add_get("/api/panel-config", get_panel_config)
    app.router.add_get("/api/states", get_all_states)
    app.router.add_get("/api/state/{entity_id:.+}", get_state)
    app.router.add_get("/api/entities", get_all_entities)
    app.router.add_get("/api/ha-areas", get_ha_areas)
    app.router.add_post("/api/config", save_config)
    app.router.add_post("/api/service/{domain}/{service}", call_service)
    app.router.add_get("/ws", ws_handler)

    # Static assets (CSS, JS)
    if STATIC_DIR.exists():
        app.router.add_static("/static/", path=STATIC_DIR, name="static")
    else:
        logger.warning("Static directory not found at %s — /static/ route disabled", STATIC_DIR)

    app.on_startup.append(_on_startup)
    app.on_cleanup.append(_on_cleanup)

    return app


async def _on_startup(app: web.Application) -> None:
    """Launch the WSProxy background task when the server starts."""
    ws_proxy: WSProxy = app["ws_proxy"]
    task = asyncio.create_task(ws_proxy.start(), name="ws-proxy")
    app["ws_proxy_task"] = task
    logger.info("WSProxy background task started")


async def _on_cleanup(app: web.Application) -> None:
    """Cancel background tasks and close the HA client session on shutdown."""
    task: asyncio.Task = app.get("ws_proxy_task")
    if task and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        logger.info("WSProxy background task stopped")

    ha_client: HAClient = app.get("ha_client")
    if ha_client:
        await ha_client.close()

    supervisor_client: SupervisorClient = app.get("supervisor_client")
    if supervisor_client:
        await supervisor_client.close()


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def main() -> None:
    """Load config, validate connectivity, and start the aiohttp server."""
    logger.info("Retro Panel backend starting up…")

    config = load_config()

    valid, error = validate_config(config)
    if not valid:
        logger.critical("Configuration is invalid: %s", error)
        raise SystemExit(1)

    ha_client = HAClient(ha_url=config.ha_url, ha_token=config.ha_token)

    logger.info("Validating Home Assistant connection…")
    conn_ok, conn_err = await validate_ha_connection(ha_client)
    if not conn_ok:
        # Log the error but do NOT exit — the server must start so the UI is reachable.
        # REST endpoints will return 502 until HA is reachable; WS proxy retries with backoff.
        logger.warning(
            "Cannot reach Home Assistant at startup (%s). "
            "The server will start anyway and retry connections in the background.",
            conn_err,
        )

    ws_proxy = WSProxy(ha_client=ha_client, config=config)

    logger.info(
        "Starting Retro Panel — title=%r, entities=%d, port=%d",
        config.title,
        len(config.all_entity_ids),
        PORT,
    )

    app = create_app(config=config, ha_client=ha_client, ws_proxy=ws_proxy)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, HOST, PORT)
    await site.start()

    logger.info("Retro Panel listening on http://%s:%d", HOST, PORT)

    try:
        await asyncio.Event().wait()
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Shutdown signal received")
    finally:
        await runner.cleanup()
        logger.info("Retro Panel shut down cleanly")


if __name__ == "__main__":
    asyncio.run(main())
