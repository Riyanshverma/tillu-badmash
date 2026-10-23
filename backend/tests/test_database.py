from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError


async def test_schema_initializes_idempotently_with_required_indexes(tmp_path):
    from app.db.connection import connect_database, initialize_schema

    async with connect_database(tmp_path / "nested/wind.db") as db:
        await initialize_schema(db)
        await initialize_schema(db)
        tables = await db.execute_fetchall(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
        assert {r["name"] for r in tables} >= {
            "wind_actuals_half_hourly", "wind_forecasts_hourly", "sync_runs"
        }
        for table, expected in [
            (
                "wind_actuals_half_hourly",
                {("settlement_date",), ("settlement_period",)},
            ),
            (
                "wind_forecasts_hourly",
                {("start_time", "publish_time"), ("target_date",),
                 ("target_hour",), ("publish_time",)},
            ),
        ]:
            indexes = await db.execute_fetchall(f"PRAGMA index_list({table})")
            columns = set()
            for index in indexes:
                info = await db.execute_fetchall(f"PRAGMA index_info({index['name']})")
                columns.add(tuple(r["name"] for r in info))
            assert expected <= columns


async def test_connection_commits_and_rolls_back(tmp_path):
    from app.db.connection import connect_database, initialize_schema

    path = tmp_path / "wind.db"
    async with connect_database(path) as db:
        await initialize_schema(db)
        await db.execute(
            "INSERT INTO sync_runs (started_at, status) VALUES (?, ?)",
            ("2026-01-15T00:00:00.000000Z", "running"),
        )
    with pytest.raises(RuntimeError):
        async with connect_database(path) as db:
            await db.execute("DELETE FROM sync_runs")
            raise RuntimeError("abort transaction")
    async with connect_database(path) as db:
        rows = await db.execute_fetchall("SELECT status FROM sync_runs")
        assert [r["status"] for r in rows] == ["running"]


@pytest.fixture
async def database(tmp_path):
    from app.db.connection import connect_database, initialize_schema

    async with connect_database(tmp_path / "wind.db") as db:
        await initialize_schema(db)
        yield db


async def test_schema_initialization_cannot_commit_pending_work(database):
    from app.db.connection import initialize_schema

    await database.execute(
        "INSERT INTO sync_runs (started_at, status) VALUES (?, ?)",
        ("2026-01-15T00:00:00.000000Z", "running"),
    )
    with pytest.raises(ValueError):
        await initialize_schema(database)
    await database.rollback()
    assert await database.execute_fetchall("SELECT * FROM sync_runs") == []


async def test_actuals_keep_native_periods_zero_and_date_order(database):
    from app.db.models import Actual
    from app.db.repositories import actuals

    for start, period, generation in [
        ("2026-01-15T23:30:00Z", 48, 8962),
        ("2026-01-15T00:30:00Z", 2, 8600),
        ("2026-01-15T00:00:00Z", 1, 0),
        ("2026-01-16T00:00:00Z", 1, 777),
    ]:
        await actuals.upsert(database, Actual(
            start_time=start, settlement_date=start[:10], settlement_period=period,
            generation_mw=generation, source_publish_time="2026-01-16T00:00:00Z",
        ))
    rows = await actuals.for_date(database, date(2026, 1, 15))
    assert [r.settlement_period for r in rows] == [1, 2, 48]
    assert [r.generation_mw for r in rows] == [0, 8600, 8962]
    assert rows[0].start_time == datetime(2026, 1, 15, tzinfo=UTC)
    assert await actuals.for_date(database, date(2026, 1, 17)) == []


async def test_actual_upsert_canonicalizes_equivalent_instants_and_persists(tmp_path):
    from app.db.connection import connect_database, initialize_schema
    from app.db.models import Actual
    from app.db.repositories import actuals

    path = tmp_path / "wind.db"
    async with connect_database(path) as db:
        await initialize_schema(db)
        for start, generation in [
            ("2026-01-15T00:00:00Z", 500),
            ("2026-01-15T01:00:00+01:00", 0),
        ]:
            await actuals.upsert(db, Actual(
                start_time=start, settlement_date="2026-01-15", settlement_period=1,
                generation_mw=generation,
                source_publish_time="2026-01-15T01:30:00+01:00",
            ))
    async with connect_database(path) as db:
        rows = await actuals.for_date(db, date(2026, 1, 15))
        assert len(rows) == 1 and rows[0].generation_mw == 0
        assert rows[0].source_publish_time == datetime(2026, 1, 15, 0, 30, tzinfo=UTC)
        stored = await db.execute_fetchall("SELECT * FROM wind_actuals_half_hourly")
        assert stored[0]["start_time"] == "2026-01-15T00:00:00.000000Z"
        assert stored[0]["source_publish_time"] == "2026-01-15T00:30:00.000000Z"


async def test_forecast_vintages_coexist_and_upsert_by_canonical_pair(database):
    from app.db.models import Forecast
    from app.db.repositories import forecasts

    for publish, generation in [
        ("2026-01-15T09:30:00Z", 7802),
        ("2026-01-15T07:30:00Z", 7779),
        ("2026-01-15T02:30:00Z", 9020),
        ("2026-01-15T04:30:00Z", 7903),
        ("2026-01-15T08:30:00+01:00", 0),
    ]:
        await forecasts.upsert(database, Forecast(
            publish_time=publish, start_time="2026-01-16T12:00:00Z",
            generation_mw=generation,
        ))
    rows = await forecasts.for_target(
        database, datetime.fromisoformat("2026-01-16T13:00:00+01:00")
    )
    assert [r.publish_time.hour for r in rows] == [2, 4, 7, 9]
    assert [r.generation_mw for r in rows] == [9020, 7903, 0, 7802]
    stored = await database.execute_fetchall("SELECT * FROM wind_forecasts_hourly")
    assert len(stored) == 4
    assert all(r["start_time"] == "2026-01-16T12:00:00.000000Z" for r in stored)
    assert {r["publish_time"] for r in stored} == {
        f"2026-01-15T{h}:30:00.000000Z" for h in ["02", "04", "07", "09"]
    }
    assert await forecasts.for_target(database, datetime(2026, 1, 17, tzinfo=UTC)) == []


async def test_forecasts_derive_all_utc_target_hours_and_order(database):
    from app.db.models import Forecast
    from app.db.repositories import forecasts

    for hour in reversed(range(24)):
        await forecasts.upsert(database, Forecast(
            publish_time="2026-01-31T07:30:00Z",
            start_time=datetime(2026, 2, 1, hour, tzinfo=UTC), generation_mw=hour,
        ))
    await forecasts.upsert(database, Forecast(
        publish_time="2026-01-31T02:30:00Z",
        start_time="2026-01-31T23:00:00-01:00", generation_mw=100,
    ))
    rows = await forecasts.for_date(database, date(2026, 2, 1))
    assert [r.start_time.hour for r in rows] == [0, *range(24)]
    assert [r.generation_mw for r in rows[:2]] == [100, 0]
    assert await forecasts.for_date(database, date(2026, 1, 31)) == []
    stored = await database.execute_fetchall(
        "SELECT target_date, target_hour FROM wind_forecasts_hourly "
        "ORDER BY target_hour"
    )
    assert [r["target_hour"] for r in stored] == [0, *range(24)]
    assert {r["target_date"] for r in stored} == {"2026-02-01"}


async def test_forecast_publication_order_keeps_fractional_seconds(database):
    from app.db.models import Forecast
    from app.db.repositories import forecasts

    for publish in ["2026-01-15T07:30:00.000001Z", "2026-01-15T07:30:00Z"]:
        await forecasts.upsert(database, Forecast(
            publish_time=publish, start_time="2026-01-16T12:00:00Z", generation_mw=1,
        ))
    rows = await forecasts.for_target(database, datetime(2026, 1, 16, 12, tzinfo=UTC))
    assert [r.publish_time.microsecond for r in rows] == [0, 1]


async def test_sync_run_creation_finish_and_reopen(tmp_path):
    from app.db.connection import connect_database, initialize_schema
    from app.db.repositories import sync_runs

    path = tmp_path / "wind.db"
    async with connect_database(path) as db:
        await initialize_schema(db)
        run_id = await sync_runs.create(db, datetime(2026, 1, 15, tzinfo=UTC))
        run = await sync_runs.get(db, run_id)
        assert run.status == "running" and run.completed_at is None
        assert (run.fuelhh_rows, run.windfor_rows, run.rejected_rows) == (0, 0, 0)
        await sync_runs.finish(
            db, run_id,
            completed_at=datetime.fromisoformat("2026-01-15T01:05:00+01:00"),
            status="failed", fuelhh_rows=48, windfor_rows=584, rejected_rows=2,
            detail="upstream request failed",
        )
    async with connect_database(path) as db:
        run = await sync_runs.get(db, run_id)
        assert run.status == "failed" and run.detail == "upstream request failed"
        assert (run.fuelhh_rows, run.windfor_rows, run.rejected_rows) == (48, 584, 2)
        assert run.completed_at == datetime(2026, 1, 15, 0, 5, tzinfo=UTC)
        assert await sync_runs.get(db, run_id + 1) is None


async def test_sync_finish_rejects_unknown_run(database):
    from app.db.repositories import sync_runs

    with pytest.raises(LookupError):
        await sync_runs.finish(
            database, 999,
            completed_at=datetime(2026, 1, 15, tzinfo=UTC), status="success",
        )


@pytest.mark.parametrize("model_name", ["Actual", "Forecast"])
@pytest.mark.parametrize("bad_generation", [-1, float("inf"), float("nan")])
def test_normalized_records_reject_invalid_generation(model_name, bad_generation):
    from app.db import models

    values = dict(start_time="2026-01-15T00:00:00Z", generation_mw=bad_generation)
    if model_name == "Actual":
        values.update(settlement_date="2026-01-15", settlement_period=1,
                      source_publish_time="2026-01-15T00:30:00Z")
    else:
        values.update(publish_time="2026-01-14T07:30:00Z")
    with pytest.raises(ValidationError):
        getattr(models, model_name)(**values)


@pytest.mark.parametrize("field", ["publish_time", "start_time"])
def test_forecast_rejects_naive_datetimes(field):
    from app.db.models import Forecast

    values = dict(publish_time="2026-01-15T07:30:00Z",
                  start_time="2026-01-16T12:00:00Z", generation_mw=7779)
    values[field] = datetime(2026, 1, 15)
    with pytest.raises(ValidationError):
        Forecast(**values)


async def test_timestamp_query_and_sync_boundaries_reject_naive_datetimes(database):
    from app.db.repositories import forecasts, sync_runs

    with pytest.raises(ValueError):
        await forecasts.for_target(database, datetime(2026, 1, 15))
    with pytest.raises(ValueError):
        await sync_runs.create(database, datetime(2026, 1, 15))


@pytest.mark.parametrize("field", ["start_time", "source_publish_time"])
def test_actual_rejects_naive_datetimes(field):
    from app.db.models import Actual

    values = dict(
        start_time="2026-01-15T00:00:00Z", source_publish_time="2026-01-15T00:30:00Z",
        settlement_date="2026-01-15", settlement_period=1, generation_mw=0,
    )
    values[field] = datetime(2026, 1, 15)
    with pytest.raises(ValidationError):
        Actual(**values)


@pytest.mark.parametrize("invalid", [
    {"fuelhh_rows": -1}, {"windfor_rows": -1}, {"rejected_rows": -1},
    {"completed_at": datetime(2026, 1, 15)}, {"status": ""},
])
async def test_invalid_sync_update_preserves_existing_run(database, invalid):
    from app.db.repositories import sync_runs

    run_id = await sync_runs.create(database, datetime(2026, 1, 15, tzinfo=UTC))
    values = dict(completed_at=datetime(2026, 1, 15, 1, tzinfo=UTC), status="success")
    values.update(invalid)
    with pytest.raises(ValidationError):
        await sync_runs.finish(database, run_id, **values)
    run = await sync_runs.get(database, run_id)
    assert run.status == "running" and run.completed_at is None
    assert (run.fuelhh_rows, run.windfor_rows, run.rejected_rows) == (0, 0, 0)
