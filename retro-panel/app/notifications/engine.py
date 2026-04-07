"""
NotificationEngine — bridges HA custom events to NotificationStore and WebSocket broadcast.

Flow: HA `retro_panel_notify` event → handle_notify_event() → store.add() → broadcast(json)
"""
import json
import logging
from typing import Awaitable, Callable

try:
    from notifications.store import NotificationStore  # runtime (app/ on sys.path)
except ModuleNotFoundError:
    from app.notifications.store import NotificationStore  # test runner (project root)

logger = logging.getLogger(__name__)

# Alias italiani (e varianti comuni) → valore canonico inglese
_PRIORITY_ALIASES: dict = {
    'critica':   'critical',
    'critico':   'critical',
    'alta':      'high',
    'alto':      'high',
    'normale':   'normal',
    'bassa':     'info',
    'basso':     'info',
}


def _normalize_priority(raw) -> str:
    """Normalizza priorità: accetta inglese e alias italiani, default 'normal'."""
    if not isinstance(raw, str):
        return 'normal'
    s = raw.strip().lower()
    return _PRIORITY_ALIASES.get(s, s)  # alias italiani → inglese; inglese → invariato


class NotificationEngine:
    def __init__(
        self,
        store: NotificationStore,
        broadcast: Callable[[str], Awaitable[None]],
    ) -> None:
        self._store = store
        self._broadcast = broadcast

    async def handle_notify_event(self, event_data: dict) -> None:
        """Process a HA retro_panel_notify event dict.

        Extracts title, message, priority. Silently skips events with missing or
        empty (whitespace-only) title. On success, persists to store and broadcasts
        a JSON payload to all connected WebSocket clients.
        """
        title = event_data.get("title", "")
        if not isinstance(title, str) or not title.strip():
            logger.debug(
                "NotificationEngine: skipping event with missing/empty title: %r",
                event_data,
            )
            return

        message = event_data.get("message", "")
        priority = _normalize_priority(event_data.get("priority", "normal"))

        notification = await self._store.add(title, message, priority)
        logger.debug(
            "NotificationEngine: notification stored (title=%r, priority=%r)",
            title,
            priority,
        )

        payload = json.dumps({"type": "rp_notification", "notification": notification})
        try:
            await self._broadcast(payload)
        except Exception as exc:
            logger.warning(
                "NotificationEngine: broadcast failed (notification already stored): %s",
                exc,
            )
