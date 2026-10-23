from datetime import datetime

import aiosqlite

from app.db.connection import utc_text
from app.db.models import SyncRun


async def create(connection: aiosqlite.Connection, started_at: datetime) -> int:
    async with connection.execute(
        "INSERT INTO sync_runs (started_at, status) VALUES (?, 'running')",
        (utc_text(started_at),),
    ) as cursor:
        return cursor.lastrowid


async def get(connection: aiosqlite.Connection, run_id: int) -> SyncRun | None:
    rows = await connection.execute_fetchall(
        "SELECT * FROM sync_runs WHERE id = ?", (run_id,),
    )
    return SyncRun.model_validate(dict(rows[0])) if rows else None


async def finish(
    connection: aiosqlite.Connection,
    run_id: int,
    *,
    completed_at: datetime,
    status: str,
    fuelhh_rows: int = 0,
    windfor_rows: int = 0,
    rejected_rows: int = 0,
    detail: str | None = None,
) -> None:
    existing = await get(connection, run_id)
    if existing is None:
        raise LookupError(f"Sync run {run_id} does not exist")
    run = SyncRun(
        id=run_id, started_at=existing.started_at, completed_at=completed_at,
        status=status, fuelhh_rows=fuelhh_rows, windfor_rows=windfor_rows,
        rejected_rows=rejected_rows, detail=detail,
    )
    await connection.execute(
        """
        UPDATE sync_runs SET completed_at = ?, status = ?, fuelhh_rows = ?,
            windfor_rows = ?, rejected_rows = ?, detail = ?
        WHERE id = ?
        """,
        (utc_text(run.completed_at), run.status, run.fuelhh_rows, run.windfor_rows,
         run.rejected_rows, run.detail, run.id),
    )
