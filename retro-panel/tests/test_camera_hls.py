# tests/test_camera_hls.py
"""Unit tests for camera HLS backend support."""
import asyncio
import json
import os
import sys
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# get_camera_hls_url
# ---------------------------------------------------------------------------

def _make_ha_client():
    from proxy.ha_client import HAClient
    return HAClient(ha_url='http://ha.test:8123', ha_token='fake-token')


def test_get_camera_hls_url_success():
    """Returns token extracted from HA WS camera/stream response URL."""
    client = _make_ha_client()

    mock_ws = AsyncMock()
    mock_ws.closed = False
    mock_ws.receive_json = AsyncMock(side_effect=[
        {
            'id': 95, 'type': 'result', 'success': True,
            'result': {'url': 'http://ha.test:8123/api/hls/ABC123TOKEN/playlist.m3u8'}
        }
    ])
    mock_ws.send_json = AsyncMock()
    mock_ws.close = AsyncMock()

    with patch.object(client, 'ws_connect', new=MagicMock(return_value=_async_ctx(mock_ws))):
        url = asyncio.run(client.get_camera_hls_url('camera.front'))

    assert url == 'http://ha.test:8123/api/hls/ABC123TOKEN/playlist.m3u8'


def test_get_camera_hls_url_not_supported():
    """Raises ValueError when camera integration doesn't support streaming."""
    client = _make_ha_client()

    mock_ws = AsyncMock()
    mock_ws.closed = False
    mock_ws.receive_json = AsyncMock(side_effect=[
        {
            'id': 95, 'type': 'result', 'success': False,
            'error': {'code': 'not_supported', 'message': 'Camera does not support streaming'}
        }
    ])
    mock_ws.send_json = AsyncMock()
    mock_ws.close = AsyncMock()

    with patch.object(client, 'ws_connect', new=MagicMock(return_value=_async_ctx(mock_ws))):
        with pytest.raises(ValueError, match='not_supported'):
            asyncio.run(client.get_camera_hls_url('camera.front'))


def test_get_camera_hls_url_empty_result():
    """Raises ValueError when HA returns success but empty URL."""
    client = _make_ha_client()

    mock_ws = AsyncMock()
    mock_ws.closed = False
    mock_ws.receive_json = AsyncMock(side_effect=[
        {'id': 95, 'type': 'result', 'success': True, 'result': {'url': ''}}
    ])
    mock_ws.send_json = AsyncMock()
    mock_ws.close = AsyncMock()

    with patch.object(client, 'ws_connect', new=MagicMock(return_value=_async_ctx(mock_ws))):
        with pytest.raises(ValueError, match='empty'):
            asyncio.run(client.get_camera_hls_url('camera.front'))


# ---------------------------------------------------------------------------
# proxy_hls_segment
# ---------------------------------------------------------------------------

def test_proxy_hls_segment_success():
    """Proxies m3u8 content and returns (bytes, content_type)."""
    client = _make_ha_client()

    mock_response = AsyncMock()
    mock_response.status = 200
    mock_response.read = AsyncMock(return_value=b'#EXTM3U\nplaylist.m3u8\n')
    mock_response.headers = {'Content-Type': 'application/vnd.apple.mpegurl'}
    mock_response.raise_for_status = MagicMock()  # sync method, not async
    mock_response.__aenter__ = AsyncMock(return_value=mock_response)
    mock_response.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.get = MagicMock(return_value=mock_response)

    with patch.object(client, '_get_session', return_value=mock_session):
        data, ct = asyncio.run(
            client.proxy_hls_segment('ABC123TOKEN', 'master_playlist.m3u8')
        )

    assert data == b'#EXTM3U\nplaylist.m3u8\n'
    assert 'mpegurl' in ct
    # Verify URL built correctly
    call_url = mock_session.get.call_args[0][0]
    assert call_url == 'http://ha.test:8123/api/hls/ABC123TOKEN/master_playlist.m3u8'


def test_proxy_hls_segment_not_found():
    """Raises FileNotFoundError on 404 from HA."""
    client = _make_ha_client()

    mock_response = AsyncMock()
    mock_response.status = 404
    mock_response.__aenter__ = AsyncMock(return_value=mock_response)
    mock_response.__aexit__ = AsyncMock(return_value=False)

    mock_session = MagicMock()
    mock_session.get = MagicMock(return_value=mock_response)

    with patch.object(client, '_get_session', return_value=mock_session):
        with pytest.raises(FileNotFoundError):
            asyncio.run(
                client.proxy_hls_segment('ABC123TOKEN', 'segment/001.ts')
            )


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _async_ctx(value):
    """Wraps a value so it can be used as `await client.ws_connect()`."""
    async def _coro():
        return value
    return _coro()


# ---------------------------------------------------------------------------
# HTTP handler tests — camera_proxy.py
# ---------------------------------------------------------------------------
import time as _time


def _make_app_with_mocks(entity_id='camera.test', hls_url=None, hls_error=None,
                          segment_data=None, segment_ct='application/vnd.apple.mpegurl',
                          segment_error=None):
    """Create a minimal aiohttp Application with mocked ha_client and config."""
    import aiohttp
    from aiohttp import web

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))
    from api.camera_proxy import get_camera_stream_info, get_camera_hls_proxy

    # Minimal config mock
    class FakeConfig:
        all_entity_ids = {entity_id}

    # ha_client mock
    ha_client = MagicMock()
    if hls_error:
        ha_client.get_camera_hls_url = AsyncMock(side_effect=hls_error)
    else:
        ha_client.get_camera_hls_url = AsyncMock(return_value=hls_url or
            f'http://ha.test:8123/api/hls/TESTTOKEN/playlist.m3u8')
    if segment_error:
        ha_client.proxy_hls_segment = AsyncMock(side_effect=segment_error)
    else:
        ha_client.proxy_hls_segment = AsyncMock(
            return_value=(segment_data or b'#EXTM3U', segment_ct)
        )

    app = web.Application()
    app['config'] = FakeConfig()
    app['ha_client'] = ha_client
    app.router.add_get('/api/camera-stream/{entity_id}', get_camera_stream_info)
    app.router.add_get('/api/camera-hls/{entity_id}/{tail:.*}', get_camera_hls_proxy)
    return app


def test_camera_stream_info_supported():
    """GET /api/camera-stream/camera.test returns supported=true and proxied URL."""
    from aiohttp.test_utils import TestClient, TestServer, loop_context

    # Clear module cache before test
    import api.camera_proxy as cp
    cp._hls_token_cache.clear()

    app = _make_app_with_mocks(hls_url='http://ha.test:8123/api/hls/MYTOKEN123/playlist.m3u8')
    with loop_context() as loop:
        client = TestClient(TestServer(app), loop=loop)
        loop.run_until_complete(client.start_server())
        resp = loop.run_until_complete(client.get('/api/camera-stream/camera.test'))
        assert resp.status == 200
        data = loop.run_until_complete(resp.json())
        assert data['supported'] is True
        assert 'api/camera-hls/camera.test/master_playlist.m3u8' in data['url']
        # Token must be cached
        assert 'camera.test' in cp._hls_token_cache
        assert cp._hls_token_cache['camera.test'][0] == 'MYTOKEN123'
        loop.run_until_complete(client.close())


def test_camera_stream_info_not_supported():
    """GET /api/camera-stream/camera.test returns supported=false when camera lacks stream."""
    from aiohttp.test_utils import TestClient, TestServer, loop_context
    import api.camera_proxy as cp
    cp._hls_token_cache.clear()

    app = _make_app_with_mocks(hls_error=ValueError('not_supported'))
    with loop_context() as loop:
        client = TestClient(TestServer(app), loop=loop)
        loop.run_until_complete(client.start_server())
        resp = loop.run_until_complete(client.get('/api/camera-stream/camera.test'))
        assert resp.status == 200
        data = loop.run_until_complete(resp.json())
        assert data['supported'] is False
        loop.run_until_complete(client.close())


def test_camera_stream_info_forbidden():
    """GET /api/camera-stream/camera.unknown returns 403 for non-whitelisted entity."""
    from aiohttp.test_utils import TestClient, TestServer, loop_context
    app = _make_app_with_mocks(entity_id='camera.test')
    with loop_context() as loop:
        client = TestClient(TestServer(app), loop=loop)
        loop.run_until_complete(client.start_server())
        resp = loop.run_until_complete(client.get('/api/camera-stream/camera.unknown'))
        assert resp.status == 403
        loop.run_until_complete(client.close())


def test_camera_hls_proxy_serves_segment():
    """GET /api/camera-hls/camera.test/master_playlist.m3u8 proxies correctly."""
    from aiohttp.test_utils import TestClient, TestServer, loop_context
    import api.camera_proxy as cp
    cp._hls_token_cache['camera.test'] = ('CACHEDTOKEN', _time.time() + 200)

    app = _make_app_with_mocks(
        segment_data=b'#EXTM3U\nplaylist.m3u8\n',
        segment_ct='application/vnd.apple.mpegurl',
    )
    with loop_context() as loop:
        client = TestClient(TestServer(app), loop=loop)
        loop.run_until_complete(client.start_server())
        resp = loop.run_until_complete(
            client.get('/api/camera-hls/camera.test/master_playlist.m3u8')
        )
        assert resp.status == 200
        body = loop.run_until_complete(resp.read())
        assert b'#EXTM3U' in body
        # Verify proxy_hls_segment was called with correct token + tail
        ha = app['ha_client']
        ha.proxy_hls_segment.assert_called_once_with('CACHEDTOKEN', 'master_playlist.m3u8')
        loop.run_until_complete(client.close())


def test_camera_hls_proxy_refreshes_expired_token():
    """Proxy refreshes token when current one is expired (simulated by FileNotFoundError)."""
    from aiohttp.test_utils import TestClient, TestServer, loop_context
    import api.camera_proxy as cp

    # Plant an expired token
    cp._hls_token_cache['camera.test'] = ('EXPIREDTOKEN', _time.time() - 1)

    app = _make_app_with_mocks(
        hls_url='http://ha.test:8123/api/hls/FRESHTOKEN/playlist.m3u8',
        segment_data=b'data',
        segment_ct='video/mp2t',
    )
    with loop_context() as loop:
        client = TestClient(TestServer(app), loop=loop)
        loop.run_until_complete(client.start_server())
        resp = loop.run_until_complete(
            client.get('/api/camera-hls/camera.test/segment/001.ts')
        )
        assert resp.status == 200
        # Verify new token was fetched and used
        assert cp._hls_token_cache['camera.test'][0] == 'FRESHTOKEN'
        loop.run_until_complete(client.close())
