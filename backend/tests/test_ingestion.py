import asyncio
import json
import sqlite3
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import httpx
import pytest

SAMPLES = Path(__file__).parents[2] / "docs/samples"
DAY = date(2026, 1, 15)


@pytest.fixture
def payloads():
    return {
        "FUELHH": json.loads((SAMPLES / "fuelhh-wind.sample.json").read_text()),
        "WINDFOR": json.loads((SAMPLES / "windfor.sample.json").read_text()),
    }


async def run_sync(path, handler, *, actual_to=DAY):
    from app.clients.elexon import ElexonClient
    from app.services.ingestion import sync_data

    async with httpx.AsyncClient(
        base_url="https://elexon.test/bmrs/api/v1/",
        transport=httpx.MockTransport(handler),
    ) as http:
        return await sync_data(
            ElexonClient(http), path, actual_from=DAY, actual_to=actual_to,
            publication_from=DAY, publication_to=DAY,
        )


def sample_handler(payloads):
    def handler(request):
        dataset = "FUELHH" if "FUELHH" in request.url.path else "WINDFOR"
        return httpx.Response(200, json=payloads[dataset])
    return handler


async def test_sample_ingestion_is_persistent_and_idempotent(tmp_path, payloads):
    from app.db.connection import connect_database
    from app.db.repositories import actuals, forecasts, sync_runs

    path = tmp_path / "wind.db"
    for _ in range(2):
        run = await run_sync(path, sample_handler(payloads))
        assert run.status == "success"
        assert (run.fuelhh_rows, run.windfor_rows, run.rejected_rows) == (5, 8, 0)
        assert run.completed_at >= run.started_at
    async with connect_database(path) as db:
        actual = await actuals.for_date(db, DAY)
        assert len(actual) == 5
        assert actual[0].generation_mw == 14602
        assert actual[0].settlement_period == 1
        assert actual[0].source_publish_time == datetime(2026, 1, 15, 0, 30, tzinfo=UTC)
        assert actual[1].start_time - actual[0].start_time == timedelta(minutes=30)
        vintages = await forecasts.for_target(
            db, datetime(2026, 1, 16, 12, tzinfo=UTC)
        )
        assert len(vintages) == 8
        assert [r.generation_mw for r in vintages[:4]] == [9020, 7903, 7779, 7802]
        stored = await db.execute_fetchall("SELECT * FROM wind_forecasts_hourly")
        assert len(stored) == 8
        assert {(r["target_date"], r["target_hour"]) for r in stored} == {
            ("2026-01-16", 12)
        }
        runs = await db.execute_fetchall("SELECT id FROM sync_runs")
        assert len(runs) == 2
        assert (await sync_runs.get(db, run.id)).status == "success"


async def test_nonwind_is_filtered_and_zero_is_preserved(tmp_path, payloads):
    from app.db.connection import connect_database
    from app.db.repositories import actuals

    payloads["FUELHH"][0]["generation"] = 0
    payloads["FUELHH"].append(payloads["FUELHH"][0] | {
        "fuelType": "CCGT", "generation": 9000,
    })
    path = tmp_path / "wind.db"
    run = await run_sync(path, sample_handler(payloads))
    assert run.fuelhh_rows == 5 and run.rejected_rows == 0
    async with connect_database(path) as db:
        assert (await actuals.for_date(db, DAY))[0].generation_mw == 0


async def test_validation_failure_records_rejections_and_preserves_data(
    tmp_path, payloads, caplog,
):
    from app.db.connection import connect_database
    from app.db.repositories import actuals

    path = tmp_path / "wind.db"
    await run_sync(path, sample_handler(payloads))
    payloads["FUELHH"][0]["generation"] = 0
    payloads["WINDFOR"] += [payloads["WINDFOR"][0] | {"generation": -1}, {}]
    with pytest.raises(ValueError, match="rejected"):
        await run_sync(path, sample_handler(payloads))
    async with connect_database(path) as db:
        assert (await actuals.for_date(db, DAY))[0].generation_mw == 14602
        runs = await db.execute_fetchall("SELECT * FROM sync_runs ORDER BY id")
        assert [r["status"] for r in runs] == ["success", "failed"]
        assert runs[-1]["rejected_rows"] == 2
        assert runs[-1]["fuelhh_rows"] == runs[-1]["windfor_rows"] == 0
        assert runs[-1]["completed_at"] is not None
        assert "rejected" in runs[-1]["detail"]
    assert "WINDFOR" in caplog.text and "row=" in caplog.text


async def test_mid_fetch_http_failure_is_recorded_without_partial_data(
    tmp_path, payloads,
):
    from app.db.connection import connect_database

    def handler(request):
        if request.url.params.get("settlementDateFrom") == "2026-01-16":
            return httpx.Response(400, json={"detail": "bad request"})
        return httpx.Response(200, json=payloads["FUELHH"])

    path = tmp_path / "wind.db"
    with pytest.raises(httpx.HTTPStatusError):
        await run_sync(path, handler, actual_to=date(2026, 1, 16))
    async with connect_database(path) as db:
        assert await db.execute_fetchall("SELECT * FROM wind_actuals_half_hourly") == []
        run = (await db.execute_fetchall("SELECT * FROM sync_runs"))[0]
        assert run["status"] == "failed" and run["fuelhh_rows"] == 0
        assert "400" in run["detail"]


async def test_database_failure_rolls_back_all_data_writes(tmp_path, payloads):
    from app.db.connection import connect_database
    from app.db.repositories import actuals

    path = tmp_path / "wind.db"
    await run_sync(path, sample_handler(payloads))
    async with connect_database(path) as db:
        await db.execute("""
            CREATE TRIGGER fail_forecast BEFORE INSERT ON wind_forecasts_hourly
            BEGIN SELECT RAISE(ABORT, 'simulated persistence failure'); END
        """)
    payloads["FUELHH"][0]["generation"] = 0
    with pytest.raises(sqlite3.IntegrityError):
        await run_sync(path, sample_handler(payloads))
    async with connect_database(path) as db:
        assert (await actuals.for_date(db, DAY))[0].generation_mw == 14602
        run = (await db.execute_fetchall("SELECT * FROM sync_runs ORDER BY id DESC"))[0]
        assert run["status"] == "failed"
        assert run["fuelhh_rows"] == run["windfor_rows"] == 0
        assert "persistence failure" in run["detail"]


async def test_empty_windows_are_valid(tmp_path):
    run = await run_sync(tmp_path / "wind.db", lambda _: httpx.Response(200, json=[]))
    assert run.status == "success"
    assert (run.fuelhh_rows, run.windfor_rows, run.rejected_rows) == (0, 0, 0)


async def test_cancelled_sync_is_recorded_and_propagated(tmp_path):
    from app.db.connection import connect_database

    def handler(request):
        raise asyncio.CancelledError()

    path = tmp_path / "wind.db"
    with pytest.raises(asyncio.CancelledError):
        await run_sync(path, handler)
    async with connect_database(path) as db:
        run = (await db.execute_fetchall("SELECT * FROM sync_runs"))[0]
        assert run["status"] == "failed" and "CancelledError" in run["detail"]
