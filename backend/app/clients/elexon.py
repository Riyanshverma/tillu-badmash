import asyncio
import logging
from datetime import date
from typing import Any

import httpx

logger = logging.getLogger(__name__)
RETRY_STATUSES = {429, 500, 502, 503, 504}


class ElexonClient:
    def __init__(self, http: httpx.AsyncClient):
        self.http = http

    async def fuelhh(self, day: date) -> list[Any]:
        return await self._request("datasets/FUELHH/stream", {
            "settlementDateFrom": day.isoformat(),
            "settlementDateTo": day.isoformat(),
            "fuelType": "WIND",
        })

    async def windfor(self, day: date) -> list[Any]:
        return await self._request("datasets/WINDFOR/stream", {
            "publishDateTimeFrom": f"{day.isoformat()}T00:00:00Z",
            "publishDateTimeTo": f"{day.isoformat()}T23:59:59.999999Z",
        })

    async def _request(self, path: str, params: dict[str, str]) -> list[Any]:
        logger.info("Elexon request path=%s window=%s", path, params)
        for attempt in range(3):
            try:
                response = await self.http.get(
                    path, params=params, timeout=httpx.Timeout(30, connect=10),
                )
                response.raise_for_status()
            except (
                httpx.HTTPStatusError, httpx.TimeoutException, httpx.NetworkError,
            ) as error:
                if (
                    isinstance(error, httpx.HTTPStatusError)
                    and error.response.status_code not in RETRY_STATUSES
                ) or attempt == 2:
                    raise
                logger.warning("Retrying Elexon path=%s attempt=%s: %s",
                               path, attempt + 1, error)
                await asyncio.sleep(0.5 * (attempt + 1))
                continue
            try:
                rows = response.json()
            except ValueError as error:
                raise ValueError(f"Elexon {path} returned malformed JSON") from error
            if not isinstance(rows, list):
                raise ValueError(f"Elexon {path} must return a bare JSON array")
            logger.info("Elexon response path=%s raw_rows=%s", path, len(rows))
            return rows
