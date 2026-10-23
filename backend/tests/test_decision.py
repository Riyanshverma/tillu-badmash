import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from app.db.connection import connect_database, initialize_schema
from app.db.models import Actual, Forecast
from app.db.repositories import actuals, forecasts


def test_january_cutoff_is_london_aware_and_delivery_is_next_day():
    from app.domain.decision import DecisionContext

    context = DecisionContext(date(2026, 1, 15))
    assert context.delivery_date == date(2026, 1, 16)
    assert context.cutoff == datetime(2026, 1, 15, 9, 20, tzinfo=UTC)
    assert context.cutoff.tzinfo.key == "Europe/London"


def test_cutoff_uses_market_zone_not_fixed_utc_offset():
    from app.domain.decision import DecisionContext

    cutoff = DecisionContext(date(2026, 7, 15)).cutoff
    assert (cutoff.hour, cutoff.minute) == (9, 20)
    assert cutoff.utcoffset() == timedelta(hours=1)
    assert cutoff.astimezone(UTC).hour == 8


@pytest.fixture
async def database(tmp_path):
    async with connect_database(tmp_path / "wind.db") as db:
        await initialize_schema(db)
        yield db


async def test_verified_vintages_select_7779_without_lookahead(database):
    from app.services.decision_service import decision_forecasts

    samples = Path(__file__).parents[2] / "docs/samples/windfor.sample.json"
    rows = json.loads(samples.read_text())
    for row in reversed(rows):
        await forecasts.upsert(database, Forecast(
            publish_time=row["publishTime"], start_time=row["startTime"],
            generation_mw=row["generation"],
        ))
    result = await decision_forecasts(database, date(2026, 1, 15))
    assert result.context.delivery_date == date(2026, 1, 16)
    assert len(result.series) == 1
    assert result.series[0].generation_mw == 7779
    assert result.series[0].publish_time == datetime(2026, 1, 15, 7, 30, tzinfo=UTC)
    assert result.expected_hours == 24
    assert result.available_hours == 1 and result.missing_hours == 23


async def test_selection_is_per_target_and_includes_exact_cutoff(database):
    from app.services.decision_service import decision_forecasts

    for start, publish, generation in [
        ("2026-01-16T01:00:00Z", "2026-01-15T12:00:00Z", 999),
        ("2026-01-16T00:00:00Z", "2026-01-15T09:20:00.000001Z", 999),
        ("2026-01-16T01:00:00Z", "2026-01-15T04:30:00Z", 20),
        ("2026-01-16T00:00:00Z", "2026-01-15T10:20:00+01:00", 0),
        ("2026-01-16T02:00:00Z", "2026-01-15T09:30:00Z", 999),
        ("2026-01-16T01:00:00Z", "2026-01-15T08:59:00Z", 21),
        ("2026-01-17T00:00:00Z", "2026-01-15T07:30:00Z", 999),
    ]:
        await forecasts.upsert(database, Forecast(
            start_time=start, publish_time=publish, generation_mw=generation,
        ))
    result = await decision_forecasts(database, date(2026, 1, 15))
    assert [r.start_time.hour for r in result.series] == [0, 1]
    assert [r.generation_mw for r in result.series] == [0, 21]
    assert result.series[0].publish_time == result.context.cutoff
    assert all(r.publish_time <= result.context.cutoff for r in result.series)
    assert result.missing_hours == 22


async def test_no_eligible_vintage_remains_missing(database):
    from app.services.decision_service import decision_forecasts

    await forecasts.upsert(database, Forecast(
        start_time="2026-01-16T12:00:00Z", publish_time="2026-01-15T09:30:00Z",
        generation_mw=7802,
    ))
    result = await decision_forecasts(database, date(2026, 1, 15))
    assert result.series == [] and result.missing_hours == 24


async def test_repository_rejects_naive_cutoff(database):
    with pytest.raises(ValueError):
        await forecasts.at_cutoff(
            database, date(2026, 1, 16), datetime(2026, 1, 15, 9, 20),
        )


async def test_nonhourly_forecast_is_not_reported_as_complete(database):
    from app.services.decision_service import decision_forecasts

    await forecasts.upsert(database, Forecast(
        start_time="2026-01-16T12:30:00Z", publish_time="2026-01-15T07:30:00Z",
        generation_mw=7779,
    ))
    with pytest.raises(ValueError, match="hourly"):
        await decision_forecasts(database, date(2026, 1, 15))


async def test_january_31_selects_february_1_and_aggregates_all_hours(database):
    from app.services.decision_service import decision_forecasts, hourly_actuals

    start = datetime(2026, 2, 1, tzinfo=UTC)
    for hour in reversed(range(24)):
        for publish, generation in [("09:30", 999), ("07:30", hour)]:
            await forecasts.upsert(database, Forecast(
                start_time=start + timedelta(hours=hour),
                publish_time=f"2026-01-31T{publish}:00Z", generation_mw=generation,
            ))
    for period in reversed(range(48)):
        timestamp = start + timedelta(minutes=30 * period)
        await actuals.upsert(database, Actual(
            start_time=timestamp, settlement_date=date(2026, 2, 1),
            settlement_period=period + 1, generation_mw=100,
            source_publish_time=timestamp + timedelta(minutes=30),
        ))
    selection = await decision_forecasts(database, date(2026, 1, 31))
    derived = await hourly_actuals(database, selection.context.delivery_date)
    assert selection.context.cutoff == datetime(2026, 1, 31, 9, 20, tzinfo=UTC)
    assert selection.context.delivery_date == date(2026, 2, 1)
    assert selection.available_hours == derived.available_hours == 24
    assert selection.missing_hours == derived.missing_hours == 0
    assert [r.generation_mw for r in selection.series] == list(range(24))
    assert [r.hour for r in derived.series] == list(range(24))
    assert all(r.generation_mw == 100 for r in derived.series)
