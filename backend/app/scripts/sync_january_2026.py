import asyncio
import sys
from datetime import date

import httpx

from app.clients.elexon import ElexonClient
from app.core.config import Settings
from app.core.logging import configure_logging
from app.services.ingestion import sync_data


async def _run() -> None:
    settings = Settings()
    configure_logging(settings.log_level)
    async with httpx.AsyncClient(
        base_url=settings.elexon_base_url.rstrip("/") + "/",
    ) as http:
        run = await sync_data(
            ElexonClient(http), settings.database_path,
            actual_from=date(2026, 1, 2), actual_to=date(2026, 2, 1),
            publication_from=date(2026, 1, 1), publication_to=date(2026, 1, 31),
        )
    print(f"Sync {run.id}: {run.status}; fuelhh_rows={run.fuelhh_rows}; "
          f"windfor_rows={run.windfor_rows}; rejected_rows={run.rejected_rows}")


def main() -> int:
    try:
        asyncio.run(_run())
    except Exception as error:
        print(f"Sync failed: {type(error).__name__}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
