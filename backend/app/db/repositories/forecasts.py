from datetime import UTC, date, datetime

import aiosqlite

from app.db.connection import utc_text
from app.db.models import Forecast


async def upsert(connection: aiosqlite.Connection, record: Forecast) -> None:
    start = record.start_time.astimezone(UTC)
    await connection.execute(
        """
        INSERT INTO wind_forecasts_hourly
            (publish_time, start_time, target_date, target_hour, generation_mw)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT (publish_time, start_time) DO UPDATE SET
            target_date = excluded.target_date,
            target_hour = excluded.target_hour,
            generation_mw = excluded.generation_mw
        """,
        (utc_text(record.publish_time), utc_text(start), start.date().isoformat(),
         start.hour, record.generation_mw),
    )


async def for_date(
    connection: aiosqlite.Connection, target_date: date,
) -> list[Forecast]:
    rows = await connection.execute_fetchall(
        """
        SELECT * FROM wind_forecasts_hourly
        WHERE target_date = ? ORDER BY start_time, publish_time
        """,
        (target_date.isoformat(),),
    )
    return [Forecast.model_validate(dict(row)) for row in rows]


async def for_target(
    connection: aiosqlite.Connection, start_time: datetime,
) -> list[Forecast]:
    rows = await connection.execute_fetchall(
        """
        SELECT * FROM wind_forecasts_hourly
        WHERE start_time = ? ORDER BY publish_time
        """,
        (utc_text(start_time),),
    )
    return [Forecast.model_validate(dict(row)) for row in rows]
