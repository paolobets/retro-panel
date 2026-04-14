"""Tests for media_proxy entity validation."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from api.media_proxy import _MEDIA_ENTITY_RE, _validate_media


class FakeConfig:
    def __init__(self, ids):
        self.all_entity_ids = set(ids)


class FakeApp:
    def __init__(self, config=None, ha_client=None):
        self._data = {"config": config, "ha_client": ha_client}
    def get(self, key):
        return self._data.get(key)


class FakeRequest:
    def __init__(self, app):
        self.app = app


def test_regex_accepts_valid_media_player():
    assert _MEDIA_ENTITY_RE.match("media_player.sonos_salotto")
    assert _MEDIA_ENTITY_RE.match("media_player.tv_samsung_42")


def test_regex_rejects_invalid():
    assert not _MEDIA_ENTITY_RE.match("light.living_room")
    assert not _MEDIA_ENTITY_RE.match("media_player.")
    assert not _MEDIA_ENTITY_RE.match("media_player.UPPER")
    assert not _MEDIA_ENTITY_RE.match("media_player.has space")


def test_validate_rejects_entity_not_in_whitelist():
    config = FakeConfig(["media_player.other"])
    app = FakeApp(config=config, ha_client=object())
    req = FakeRequest(app)
    import pytest
    from aiohttp.web import HTTPForbidden
    with pytest.raises(HTTPForbidden):
        _validate_media(req, "media_player.not_configured")


def test_validate_accepts_whitelisted_entity():
    config = FakeConfig(["media_player.sonos_salotto"])
    app = FakeApp(config=config, ha_client=object())
    req = FakeRequest(app)
    result = _validate_media(req, "media_player.sonos_salotto")
    assert result is not None
