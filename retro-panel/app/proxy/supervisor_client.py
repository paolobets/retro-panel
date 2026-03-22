"""
Async client for the HA Supervisor API.

Used to:
- Fetch all entity states via the Supervisor proxy (GET /core/api/states)
- Persist add-on options (POST /addons/self/options)

Requires ``hassio_api: true`` in config.yaml so that the Supervisor injects
the SUPERVISOR_TOKEN environment variable into the container.
"""

from __future__ import annotations

import logging
import os

import aiohttp

logger = logging.getLogger(__name__)

SUPERVISOR_URL = "http://supervisor"


class SupervisorError(Exception):
    """Raised when the Supervisor API returns an error or is unreachable."""


class SupervisorClient:
    """Async HTTP client for the Home Assistant Supervisor API."""

    def __init__(self) -> None:
        self._token: str = os.environ.get("SUPERVISOR_TOKEN", "")
        self._session: aiohttp.ClientSession | None = None

    def _headers(self) -> dict[str, str]:
        if not self._token:
            raise SupervisorError(
                "SUPERVISOR_TOKEN not set — is hassio_api: true in config.yaml?"
            )
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def get_all_states(self) -> list[dict]:
        """Fetch all HA entity states via the Supervisor proxy."""
        headers = self._headers()
        session = await self._get_session()
        try:
            async with session.get(
                f"{SUPERVISOR_URL}/core/api/states",
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise SupervisorError(
                        f"Supervisor returned {resp.status}: {text[:200]}"
                    )
                return await resp.json()
        except aiohttp.ClientError as exc:
            raise SupervisorError(f"Supervisor unreachable: {exc}") from exc

    async def save_options(self, options: dict) -> None:
        """Persist add-on options via the Supervisor API."""
        headers = self._headers()
        session = await self._get_session()
        try:
            async with session.post(
                f"{SUPERVISOR_URL}/addons/self/options",
                headers=headers,
                json={"options": options},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise SupervisorError(
                        f"Supervisor returned {resp.status}: {text[:200]}"
                    )
        except aiohttp.ClientError as exc:
            raise SupervisorError(f"Supervisor unreachable: {exc}") from exc

    async def close(self) -> None:
        """Close the underlying aiohttp session gracefully."""
        if self._session and not self._session.closed:
            await self._session.close()
            logger.info("SupervisorClient session closed")
