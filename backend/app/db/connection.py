from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path

import aiosqlite


@asynccontextmanager
async def connect_database(path: Path) -> AsyncIterator[aiosqlite.Connection]:
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(path) as connection:
        connection.row_factory = aiosqlite.Row
        try:
            yield connection
            await connection.commit()
        except BaseException:
            await connection.rollback()
            raise


async def initialize_schema(connection: aiosqlite.Connection) -> None:
    if connection.in_transaction:
        raise ValueError("Initialize schema before starting a transaction")
    await connection.executescript(Path(__file__).with_name("schema.sql").read_text())


def utc_text(value: datetime) -> str:
    if value.utcoffset() is None:
        raise ValueError("Datetime must be timezone-aware")
    return (
        value.astimezone(UTC).isoformat(timespec="microseconds").replace("+00:00", "Z")
    )
