import logging
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from pydantic import ValidationError

from app.clients.elexon import ElexonClient
from app.db.connection import connect_database, initialize_schema
from app.db.models import Actual, Forecast, SyncRun
from app.db.repositories import actuals, forecasts, sync_runs
from app.models.upstream import ElexonFuelhhRawRecord, ElexonWindforRawRecord

logger = logging.getLogger(__name__)


class RejectedRowsError(ValueError):
    def __init__(self, window: str, rejected_rows: int):
        self.rejected_rows = rejected_rows
        super().__init__(f"{window}: rejected {rejected_rows} upstream rows")


def _validate_rows(rows, model, window):
    records = []
    rejected = 0
    for index, row in enumerate(rows):
        try:
            records.append(model.model_validate(row))
        except ValidationError as error:
            rejected += 1
            logger.error("Invalid upstream window=%s row=%s errors=%s",
                         window, index, error.errors(include_input=False))
    logger.info("Validated window=%s raw=%s validated=%s rejected=%s",
                window, len(rows), len(records), rejected)
    if rejected:
        raise RejectedRowsError(window, rejected)
    return records


async def sync_data(
    client: ElexonClient,
    database_path: Path,
    *,
    actual_from: date,
    actual_to: date,
    publication_from: date,
    publication_to: date,
) -> SyncRun:
    if actual_from > actual_to or publication_from > publication_to:
        raise ValueError("Sync date ranges must not be inverted")
    async with connect_database(database_path) as db:
        await initialize_schema(db)
        run_id = await sync_runs.create(db, datetime.now(UTC))
    logger.info("Sync started run_id=%s actuals=%s..%s publications=%s..%s",
                run_id, actual_from, actual_to, publication_from, publication_to)
    try:
        # shortcut: stage this pilot in memory; stream batches if coverage grows.
        actual_records = []
        for offset in range((actual_to - actual_from).days + 1):
            day = actual_from + timedelta(days=offset)
            records = _validate_rows(
                await client.fuelhh(day), ElexonFuelhhRawRecord, f"FUELHH {day}",
            )
            actual_records.extend(
                Actual(
                    start_time=r.startTime, settlement_date=r.settlementDate,
                    settlement_period=r.settlementPeriod, generation_mw=r.generation,
                    source_publish_time=r.publishTime,
                ) for r in records if r.fuelType == "WIND"
            )
            logger.info("FUELHH day=%s filtered_nonwind=%s",
                        day, sum(r.fuelType != "WIND" for r in records))
        forecast_records = []
        for offset in range((publication_to - publication_from).days + 1):
            day = publication_from + timedelta(days=offset)
            records = _validate_rows(
                await client.windfor(day), ElexonWindforRawRecord, f"WINDFOR {day}",
            )
            forecast_records.extend(
                Forecast(publish_time=r.publishTime, start_time=r.startTime,
                         generation_mw=r.generation) for r in records
            )
        async with connect_database(database_path) as db:
            for record in actual_records:
                await actuals.upsert(db, record)
            for record in forecast_records:
                await forecasts.upsert(db, record)
            await sync_runs.finish(
                db, run_id, completed_at=datetime.now(UTC), status="success",
                fuelhh_rows=len(actual_records), windfor_rows=len(forecast_records),
                detail="Counts are processed records (upserts), not new row counts",
            )
            result = await sync_runs.get(db, run_id)
    except BaseException as error:
        logger.exception("Sync failed run_id=%s", run_id)
        async with connect_database(database_path) as db:
            await sync_runs.finish(
                db, run_id, completed_at=datetime.now(UTC), status="failed",
                rejected_rows=getattr(error, "rejected_rows", 0),
                detail=f"{type(error).__name__}: {error}"[:2000],
            )
        raise
    logger.info("Sync completed run_id=%s fuelhh_rows=%s windfor_rows=%s",
                run_id, result.fuelhh_rows, result.windfor_rows)
    return result
