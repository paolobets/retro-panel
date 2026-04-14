"""Tests for media_player domain and service allowlist."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from api.panel_service import _ALLOWED_DOMAINS, _ALLOWED_SERVICES


def test_media_player_in_allowed_domains():
    assert "media_player" in _ALLOWED_DOMAINS


def test_media_player_services_exist():
    assert "media_player" in _ALLOWED_SERVICES


def test_media_player_play_pause_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "media_play" in svc
    assert "media_pause" in svc
    assert "media_stop" in svc


def test_media_player_track_control_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "media_next_track" in svc
    assert "media_previous_track" in svc


def test_media_player_volume_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "volume_set" in svc
    assert "volume_mute" in svc


def test_media_player_source_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "select_source" in svc
    assert "select_sound_mode" in svc


def test_media_player_power_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "turn_on" in svc
    assert "turn_off" in svc


def test_media_player_shuffle_repeat_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "shuffle_set" in svc
    assert "repeat_set" in svc


def test_media_player_grouping_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "join" in svc
    assert "unjoin" in svc


def test_media_player_seek_allowed():
    svc = _ALLOWED_SERVICES["media_player"]
    assert "media_seek" in svc
