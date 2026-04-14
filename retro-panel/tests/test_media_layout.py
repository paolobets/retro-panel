"""Tests for media_player layout_type assignment."""
from __future__ import annotations
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from config.loader import _compute_layout_type


def test_media_player_gets_media_player_layout():
    assert _compute_layout_type("media_player.sonos_salotto", "", "") == "media_player"


def test_media_player_ignores_visual_type():
    """media_player is domain-locked — visual_type cannot override it."""
    assert _compute_layout_type("media_player.tv_samsung", "", "switch") == "media_player"


def test_media_player_ignores_device_class():
    assert _compute_layout_type("media_player.echo_cucina", "speaker", "") == "media_player"
