"""
NotificationStore — FIFO queue with TTL, persistence, and priority tracking.

Storage format: JSON array on disk at `path`.
Atomic writes: write to `path + '.tmp'`, then os.replace().
"""
import json
import logging
import os
import time
from datetime import datetime, timezone, timedelta
from typing import List, Optional

logger = logging.getLogger(__name__)


_PRIORITY_ORDER = {"info": 0, "normal": 1, "high": 2, "critical": 3}
_VALID_PRIORITIES = set(_PRIORITY_ORDER.keys())


class NotificationStore:
    def __init__(self, path: str, ttl_days: int = 7, max_count: int = 100) -> None:
        self._path = path
        self._ttl_days = ttl_days
        self._max_count = max_count
        self._notifications: List[dict] = []

    async def load(self) -> None:
        """Load notifications from disk. Call once at startup."""
        if not os.path.exists(self._path):
            self._notifications = []
            return
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                self._notifications = data
            else:
                self._notifications = []
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning("Failed to load notifications from %s: %s", self._path, exc)
            self._notifications = []

    async def add(self, title: str, message: str, priority: str) -> dict:
        """Add a new notification. Evicts oldest if over max_count. Returns new notification dict."""
        if priority not in _VALID_PRIORITIES:
            priority = "normal"

        now = datetime.now(timezone.utc)
        timestamp_ms = int(now.timestamp() * 1000)
        notification_id = f"rp-{timestamp_ms}"

        expires_at = now + timedelta(days=self._ttl_days)

        notif = {
            "id": notification_id,
            "title": title,
            "message": message,
            "priority": priority,
            "timestamp": now.isoformat(),
            "read": False,
            "expires_at": expires_at.isoformat(),
        }

        self._notifications.append(notif)

        # FIFO eviction: remove oldest entries when over max_count
        while len(self._notifications) > self._max_count:
            self._notifications.pop(0)

        await self._save()
        return notif

    async def get_all(self) -> list:
        """Return all notifications, newest first."""
        return list(reversed(self._notifications))

    async def mark_read(self, notification_id: str) -> bool:
        """Mark a notification as read. Returns True if found, False otherwise."""
        for notif in self._notifications:
            if notif["id"] == notification_id:
                notif["read"] = True
                await self._save()
                return True
        return False

    async def mark_all_read(self) -> None:
        """Mark all notifications as read."""
        for notif in self._notifications:
            notif["read"] = True
        await self._save()

    async def delete(self, notification_id: str) -> bool:
        """Delete a notification by id. Returns True if found and removed, False otherwise."""
        for i, notif in enumerate(self._notifications):
            if notif["id"] == notification_id:
                self._notifications.pop(i)
                await self._save()
                return True
        return False

    async def purge_expired(self) -> int:
        """Remove notifications where expires_at < now. Returns count of removed notifications."""
        now = datetime.now(timezone.utc)
        before = len(self._notifications)

        def _parse_dt(n: dict) -> bool:
            """Return True (keep) if expires_at is valid and in the future; False (remove) otherwise."""
            try:
                return datetime.fromisoformat(n["expires_at"]) >= now
            except (KeyError, ValueError):
                logger.warning("Dropping notification %s with missing/malformed expires_at", n.get("id"))
                return False

        self._notifications = [n for n in self._notifications if _parse_dt(n)]

        removed = before - len(self._notifications)
        if removed > 0:
            await self._save()
        return removed

    def has_unread(self, min_priority: str = "high") -> bool:
        """Return True if any unread notification has priority >= min_priority."""
        min_index = _PRIORITY_ORDER.get(min_priority, _PRIORITY_ORDER["high"])
        for notif in self._notifications:
            if not notif["read"]:
                notif_index = _PRIORITY_ORDER.get(notif["priority"], 0)
                if notif_index >= min_index:
                    return True
        return False

    def unread_count(self) -> int:
        """Return the count of unread notifications."""
        return sum(1 for n in self._notifications if not n["read"])

    async def _save(self) -> None:
        """Atomic write: write to .tmp then os.replace()."""
        tmp_path = self._path + ".tmp"
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(self._notifications, f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, self._path)
        except OSError as exc:
            logger.error("Failed to save notifications to %s: %s", self._path, exc)
            raise
