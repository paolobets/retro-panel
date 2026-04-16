"""
Async client for the HA Supervisor API.

Requires hassio_api: true in config.yaml so that:
- SUPERVISOR_TOKEN env var is injected by the Supervisor
- The container can reach http://supervisor over the internal network
"""

from __future__ import annotations

import logging
import os

import aiohttp

logger = logging.getLogger(__name__)

_SUPERVISOR_URL = "http://supervisor"


class SupervisorClient:
    def __init__(self) -> None:
        token = os.environ.get("SUPERVISOR_TOKEN", "")
        if not token:
            logger.warning("SUPERVISOR_TOKEN not set — Supervisor API calls will fail")
        self._session = aiohttp.ClientSession(
            headers={"Authorization": f"Bearer {token}"},
            timeout=aiohttp.ClientTimeout(total=15),
        )

    async def get_all_states(self) -> list[dict]:
        """Fetch all entity states from HA Core via the Supervisor proxy."""
        async with self._session.get(f"{_SUPERVISOR_URL}/core/api/states") as resp:
            resp.raise_for_status()
            return await resp.json()

    async def get_addon_version(self) -> str:
        """Fetch the installed version of this add-on from the Supervisor.

        Uses GET /addons/self/info which returns the version as seen by HA
        Supervisor — this is the real installed version (e.g. '2.14.0-rc10'
        for beta, '2.13.0' for stable), regardless of what config.yaml
        is baked into the Docker image.
        """
        try:
            async with self._session.get(f"{_SUPERVISOR_URL}/addons/self/info") as resp:
                resp.raise_for_status()
                data = await resp.json()
                # HA Supervisor wraps in {"result": "ok", "data": {...}}
                info = data.get("data", data)
                return info.get("version", "")
        except Exception as exc:
            logger.warning("Could not fetch addon version from Supervisor: %s", exc)
            return ""

    async def save_options(self, options: dict) -> None:
        """Persist add-on options via the Supervisor API."""
        async with self._session.post(
            f"{_SUPERVISOR_URL}/addons/self/options",
            json={"options": options},
        ) as resp:
            resp.raise_for_status()

    async def close(self) -> None:
        await self._session.close()
