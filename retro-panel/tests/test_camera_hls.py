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
