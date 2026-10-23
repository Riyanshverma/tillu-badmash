from datetime import date

import aiosqlite

from app.db.connection import utc_text
from app.db.models import Actual


async def upsert(connection: aiosqlite.Connection, record: Actual) -> None:
    await connection.execute(
        """
        INSERT INTO wind_actuals_half_hourly
            (start_time, settlement_date, settlement_period,
             generation_mw, source_publish_time)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (start_time) DO UPDATE SET
            settlement_date = excluded.settlement_date,
            settlement_period = excluded.settlement_period,
            generation_mw = excluded.generation_mw,
            source_publish_time = excluded.source_publish_time
        """,
        (utc_text(record.start_time), record.settlement_date.isoformat(),
         record.settlement_period, record.generation_mw,
         utc_text(record.source_publish_time)),
    )


async def for_date(
    connection: aiosqlite.Connection, settlement_date: date,
) -> list[Actual]:
    rows = await connection.execute_fetchall(
        """
        SELECT * FROM wind_actuals_half_hourly
        WHERE settlement_date = ? ORDER BY start_time
        """,
        (settlement_date.isoformat(),),
    )
    return [Actual.model_validate(dict(row)) for row in rows]
