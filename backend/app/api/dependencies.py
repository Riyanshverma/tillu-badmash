from collections.abc import AsyncIterator
from datetime import UTC, date, datetime
from typing import Annotated

import aiosqlite
from fastapi import Depends, Path, Query, Request
from pydantic import AfterValidator, AwareDatetime, BeforeValidator

from app.db.connection import connect_database
from app.models.upstream import require_iso_datetime

DecisionDate = Annotated[date, Path(ge=date(2026, 1, 1), le=date(2026, 1, 31))]


def validate_target(value: datetime) -> datetime:
    target = value.astimezone(UTC)
    if not date(2026, 1, 2) <= target.date() <= date(2026, 2, 1):
        raise ValueError("Target delivery date must be 2026-01-02 through 2026-02-01")
    if target.minute or target.second or target.microsecond:
        raise ValueError("Target must be on an exact UTC hour")
    return target


TargetTime = Annotated[
    AwareDatetime,
    BeforeValidator(require_iso_datetime), AfterValidator(validate_target),
    Query(description="Hourly delivery target with an explicit timezone offset"),
]


async def database(request: Request) -> AsyncIterator[aiosqlite.Connection]:
    async with connect_database(request.app.state.database_path) as connection:
        # All service queries in a response see the same database snapshot.
        await connection.execute("BEGIN")
        yield connection


Database = Annotated[aiosqlite.Connection, Depends(database)]
