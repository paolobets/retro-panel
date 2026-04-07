"""
Tests for NotificationEngine — written FIRST (TDD Red phase).

NotificationEngine bridges HA custom events → NotificationStore → WebSocket broadcast.
"""
import asyncio
import json
import os
import tempfile

from app.notifications.store import NotificationStore
from app.notifications.engine import NotificationEngine


def run(coro):
    """Helper to run async coroutines in sync tests."""
    return asyncio.run(coro)


# ---------------------------------------------------------------------------
# Test 1: valid event — store receives notification, broadcast called once
# ---------------------------------------------------------------------------
def test_handle_valid_event():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        broadcast_calls = []

        async def fake_broadcast(payload: str) -> None:
            broadcast_calls.append(payload)

        engine = NotificationEngine(store, fake_broadcast)
        run(engine.handle_notify_event({'title': 'Test', 'message': 'Hello', 'priority': 'high'}))

        # Store must have exactly one notification with correct fields
        all_notifs = run(store.get_all())
        assert len(all_notifs) == 1
        assert all_notifs[0]['title'] == 'Test'
        assert all_notifs[0]['priority'] == 'high'

        # Broadcast must have been called exactly once
        assert len(broadcast_calls) == 1

        # Broadcast payload must be valid JSON with the expected structure
        payload = json.loads(broadcast_calls[0])
        assert payload['type'] == 'rp_notification'
        assert 'notification' in payload
        assert payload['notification']['title'] == 'Test'
        assert payload['notification']['priority'] == 'high'
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 2: missing priority key defaults to 'normal'
# ---------------------------------------------------------------------------
def test_handle_event_default_priority():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        broadcast_calls = []

        async def fake_broadcast(payload: str) -> None:
            broadcast_calls.append(payload)

        engine = NotificationEngine(store, fake_broadcast)
        run(engine.handle_notify_event({'title': 'Hi', 'message': 'World'}))

        all_notifs = run(store.get_all())
        assert len(all_notifs) == 1
        assert all_notifs[0]['priority'] == 'normal'

        # Broadcast still called once
        assert len(broadcast_calls) == 1
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 3: missing title — store stays empty, broadcast NOT called
# ---------------------------------------------------------------------------
def test_handle_event_missing_title():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        broadcast_calls = []

        async def fake_broadcast(payload: str) -> None:
            broadcast_calls.append(payload)

        engine = NotificationEngine(store, fake_broadcast)
        run(engine.handle_notify_event({'message': 'No title here'}))

        # Store must be empty
        all_notifs = run(store.get_all())
        assert len(all_notifs) == 0

        # Broadcast must NOT have been called
        assert len(broadcast_calls) == 0
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test 4: alias italiani normalizzati correttamente
# ---------------------------------------------------------------------------
def test_italian_priority_aliases():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    try:
        store = NotificationStore(path=path, ttl_days=7, max_count=100)
        run(store.load())

        async def noop(payload: str) -> None:
            pass

        engine = NotificationEngine(store, noop)

        # 'critica' → 'critical'
        run(engine.handle_notify_event({'title': 'A', 'priority': 'critica'}))
        # 'alta' → 'high'
        run(engine.handle_notify_event({'title': 'B', 'priority': 'alta'}))
        # 'normale' → 'normal'
        run(engine.handle_notify_event({'title': 'C', 'priority': 'normale'}))
        # 'bassa' → 'info'
        run(engine.handle_notify_event({'title': 'D', 'priority': 'bassa'}))

        all_notifs = run(store.get_all())
        by_title = {n['title']: n['priority'] for n in all_notifs}
        assert by_title['A'] == 'critical'
        assert by_title['B'] == 'high'
        assert by_title['C'] == 'normal'
        assert by_title['D'] == 'info'
    finally:
        os.unlink(path)
