"""
Tests for NotificationStore — written FIRST (TDD Red phase).
Uses asyncio.get_event_loop().run_until_complete() for simple pytest compatibility.
"""
import asyncio
import os
import json
import tempfile
from datetime import datetime, timezone, timedelta

from app.notifications.store import NotificationStore


def run(coro):
    """Helper to run async coroutines in sync tests."""
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Test 1: add one notification and get_all returns it with correct fields
# ---------------------------------------------------------------------------
def test_add_and_get():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        notif = run(store.add(title="Allarme cucina", message="Fumo rilevato.", priority="critical"))

        assert notif["title"] == "Allarme cucina"
        assert notif["message"] == "Fumo rilevato."
        assert notif["priority"] == "critical"
        assert notif["read"] is False
        assert notif["id"].startswith("rp-")
        assert "timestamp" in notif
        assert "expires_at" in notif

        all_notifs = run(store.get_all())
        assert len(all_notifs) == 1
        assert all_notifs[0]["id"] == notif["id"]
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 2: FIFO eviction — max_count=3, add 4, oldest is evicted
# ---------------------------------------------------------------------------
def test_fifo_max_100():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=3)
        run(store.load())

        n1 = run(store.add("First", "msg1", "info"))
        n2 = run(store.add("Second", "msg2", "normal"))
        n3 = run(store.add("Third", "msg3", "high"))
        n4 = run(store.add("Fourth", "msg4", "critical"))

        all_notifs = run(store.get_all())
        assert len(all_notifs) == 3

        ids = [n["id"] for n in all_notifs]
        # n1 (oldest) must have been evicted
        assert n1["id"] not in ids
        assert n2["id"] in ids
        assert n3["id"] in ids
        assert n4["id"] in ids
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 3: mark_read — marks the notification as read=True
# ---------------------------------------------------------------------------
def test_mark_read():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        notif = run(store.add("Test", "msg", "normal"))
        assert notif["read"] is False

        result = run(store.mark_read(notif["id"]))
        assert result is True

        all_notifs = run(store.get_all())
        assert all_notifs[0]["read"] is True
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 4: mark_read with unknown id returns False
# ---------------------------------------------------------------------------
def test_mark_read_unknown_id():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        result = run(store.mark_read("rp-nonexistent-id"))
        assert result is False
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 5: mark_all_read — all notifications become read=True
# ---------------------------------------------------------------------------
def test_mark_all_read():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        run(store.add("A", "msg_a", "info"))
        run(store.add("B", "msg_b", "high"))
        run(store.add("C", "msg_c", "critical"))

        run(store.mark_all_read())

        all_notifs = run(store.get_all())
        assert len(all_notifs) == 3
        for n in all_notifs:
            assert n["read"] is True
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 6: delete — removes notification, returns True; second call returns False
# ---------------------------------------------------------------------------
def test_delete():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        notif = run(store.add("Delete me", "msg", "normal"))
        assert len(run(store.get_all())) == 1

        result = run(store.delete(notif["id"]))
        assert result is True
        assert len(run(store.get_all())) == 0

        # Deleting again returns False
        result2 = run(store.delete(notif["id"]))
        assert result2 is False
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 7: TTL purge — expired notification removed, fresh one stays
# ---------------------------------------------------------------------------
def test_ttl_purge():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        # Add a fresh notification (expires 7 days from now)
        fresh = run(store.add("Fresh", "still valid", "normal"))

        # Manually inject an expired notification
        expired_notif = {
            "id": "rp-0000000000000",
            "title": "Expired",
            "message": "This is old.",
            "priority": "info",
            "timestamp": "2020-01-01T00:00:00+00:00",
            "read": False,
            "expires_at": "2020-01-08T00:00:00+00:00",  # clearly in the past
        }
        store._notifications.append(expired_notif)

        assert len(run(store.get_all())) == 2

        removed_count = run(store.purge_expired())
        assert removed_count == 1

        remaining = run(store.get_all())
        assert len(remaining) == 1
        assert remaining[0]["id"] == fresh["id"]
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 8: persistence — store1 saves, store2 loads and sees the notification
# ---------------------------------------------------------------------------
def test_persistence():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store1 = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store1.load())
        notif = run(store1.add("Persisted", "saved to disk", "high"))

        # Create a second store pointing to the same file
        store2 = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store2.load())

        all_notifs = run(store2.get_all())
        assert len(all_notifs) == 1
        assert all_notifs[0]["id"] == notif["id"]
        assert all_notifs[0]["title"] == "Persisted"
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 9: invalid priority defaults to 'normal'
# ---------------------------------------------------------------------------
def test_invalid_priority_defaults_to_normal():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        notif = run(store.add("Bad priority", "msg", "ULTRA_MEGA_CRITICAL"))
        assert notif["priority"] == "normal"
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 10: get_all returns newest first (reversed insertion order)
# ---------------------------------------------------------------------------
def test_get_all_newest_first():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        n1 = run(store.add("First", "msg1", "info"))
        n2 = run(store.add("Second", "msg2", "normal"))
        n3 = run(store.add("Third", "msg3", "high"))

        all_notifs = run(store.get_all())
        assert all_notifs[0]["id"] == n3["id"]
        assert all_notifs[1]["id"] == n2["id"]
        assert all_notifs[2]["id"] == n1["id"]
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 11: has_unread returns True/False based on min_priority threshold
# ---------------------------------------------------------------------------
def test_has_unread():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        run(store.add("Normal notif", "msg", "normal"))

        # 'normal' priority index=1, 'high' min_priority index=2 → False
        assert store.has_unread(min_priority="high") is False
        # 'normal' priority index=1, 'normal' min_priority index=1 → True
        assert store.has_unread(min_priority="normal") is True
        # 'normal' priority index=1, 'info' min_priority index=0 → True
        assert store.has_unread(min_priority="info") is True
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 12: unread_count returns correct count
# ---------------------------------------------------------------------------
def test_unread_count():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        assert store.unread_count() == 0

        n1 = run(store.add("A", "msg", "info"))
        n2 = run(store.add("B", "msg", "high"))
        assert store.unread_count() == 2

        run(store.mark_read(n1["id"]))
        assert store.unread_count() == 1

        run(store.mark_all_read())
        assert store.unread_count() == 0
    finally:
        os.unlink(path)
