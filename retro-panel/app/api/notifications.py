"""
aiohttp request handlers for notification endpoints.

Handlers:
- GET  /api/notifications           → get_notifications(request)
- POST /api/notify                  → post_notify(request)
- PATCH /api/notifications/{id}     → patch_notification_read(request)
- POST /api/notifications/read-all  → post_read_all(request)
- DELETE /api/notifications/{id}    → delete_notification(request)
"""

from __future__ import annotations

import asyncio
import json
import logging

from aiohttp import web

logger = logging.getLogger(__name__)


async def _broadcast_sync(request: web.Request, store) -> None:
    """Broadcast updated notification list to all WS clients after a mutation."""
    broadcast = request.app.get("ws_broadcast")
    if broadcast is None:
        return
    notifications = await store.get_all()
    msg = json.dumps({"type": "rp_notification_update", "notifications": notifications})
    asyncio.ensure_future(broadcast(msg))


async def get_notifications(request: web.Request) -> web.Response:
    """Return all notifications.

    If notification_store is not available, returns empty list with 200.
    Otherwise returns all notifications (newest first) from the store.

    Returns:
        200 JSON list of notification dicts.
    """
    store = request.app.get("notification_store")

    if store is None:
        return web.json_response([], status=200)

    notifications = await store.get_all()
    return web.json_response(notifications)


async def post_notify(request: web.Request) -> web.Response:
    """Create a new notification via the notification engine.

    Accepts a JSON body with title, message, and optional priority fields.
    If notification_engine is not available, returns 503.
    If body is not valid JSON, returns 400.
    On success, the notification is stored and broadcasted to WebSocket clients.

    Returns:
        201 JSON {'ok': True} on success.
        400 if JSON body is invalid.
        503 if notification_engine is not available.
    """
    engine = request.app.get("notification_engine")

    if engine is None:
        return web.json_response(
            {"error": "Notification engine not available."},
            status=503,
        )

    try:
        body = await request.json()
    except ValueError:
        logger.warning("post_notify: invalid JSON body")
        return web.json_response(
            {"error": "Invalid JSON body."},
            status=400,
        )

    await engine.handle_notify_event(body)
    return web.json_response({"ok": True}, status=201)


async def patch_notification_read(request: web.Request) -> web.Response:
    """Mark a single notification as read.

    Looks up the notification by id in the store and updates read status.
    If store is not available, returns 503.
    If notification not found, returns 404.

    Returns:
        200 JSON {'ok': True} on success.
        404 if notification not found.
        503 if notification_store is not available.
    """
    store = request.app.get("notification_store")

    if store is None:
        return web.json_response(
            {"error": "Notification store not available."},
            status=503,
        )

    notification_id = request.match_info.get("id", "")
    ok = await store.mark_read(notification_id)

    if not ok:
        return web.json_response({"error": "Not found."}, status=404)

    await _broadcast_sync(request, store)
    return web.json_response({"ok": True}, status=200)


async def post_read_all(request: web.Request) -> web.Response:
    """Mark all notifications as read.

    If store is not available, returns 503.

    Returns:
        200 JSON {'ok': True} on success.
        503 if notification_store is not available.
    """
    store = request.app.get("notification_store")

    if store is None:
        return web.json_response(
            {"error": "Notification store not available."},
            status=503,
        )

    await store.mark_all_read()
    await _broadcast_sync(request, store)
    return web.json_response({"ok": True}, status=200)


async def delete_notification(request: web.Request) -> web.Response:
    """Delete a single notification.

    Looks up the notification by id in the store and deletes it.
    If store is not available, returns 503.
    If notification not found, returns 404.

    Returns:
        200 JSON {'ok': True} on success.
        404 if notification not found.
        503 if notification_store is not available.
    """
    store = request.app.get("notification_store")

    if store is None:
        return web.json_response(
            {"error": "Notification store not available."},
            status=503,
        )

    notification_id = request.match_info.get("id", "")
    ok = await store.delete(notification_id)

    if not ok:
        return web.json_response({"error": "Not found."}, status=404)

    await _broadcast_sync(request, store)
    return web.json_response({"ok": True}, status=200)
