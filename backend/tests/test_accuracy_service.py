import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from app.db.connection import connect_database, initialize_schema
from app.db.models import Actual, Forecast
from app.db.repositories import actuals, forecasts


@pytest.fixture
async def database(tmp_path):
    async with connect_database(tmp_path / "wind.db") as db:
        await initialize_schema(db)
        yield db


async def seed_hour(db, decision, hour, *, forecast=None, actual=None, second=True):
    delivery = decision + timedelta(days=1)
    start = datetime(delivery.year, delivery.month, delivery.day, hour, tzinfo=UTC)
    if forecast is not None:
        for publish, generation in [("09:30", 9999), ("07:30", forecast)]:
            await forecasts.upsert(db, Forecast(
                start_time=start, publish_time=f"{decision}T{publish}:00Z",
                generation_mw=generation,
            ))
    if actual is not None:
        for minute in ([30, 0] if second else [0]):
            timestamp = start + timedelta(minutes=minute)
            await actuals.upsert(db, Actual(
                start_time=timestamp, settlement_date=delivery,
                settlement_period=hour * 2 + minute // 30 + 1,
                generation_mw=actual,
                source_publish_time=timestamp + timedelta(minutes=30),
            ))


async def test_daily_comparison_uses_only_matched_complete_hours(database):
    from app.services.accuracy_service import daily_comparison

    day = date(2026, 1, 15)
    await seed_hour(database, day, 2, forecast=200, actual=90, second=False)
    await seed_hour(database, day, 1, actual=50)
    await seed_hour(database, day, 0, forecast=100, actual=80)
    result = await daily_comparison(database, day)
    assert [p.hour for p in result.series] == [0]
    assert result.series[0].error_mw == 20
    complete = result.completeness
    assert (complete.expected_hours, complete.forecast_hours, complete.actual_hours,
            complete.matched_hours, complete.missing_hours) == (24, 2, 2, 1, 23)
    assert result.metrics.matched_points == 1
    assert result.metrics.mae_mw == 20 and result.metrics.wape_percent == 25


async def test_complete_day_uses_phase4_selection_and_derivation(database):
    from app.services.accuracy_service import daily_comparison

    day = date(2026, 1, 15)
    for hour in reversed(range(24)):
        await seed_hour(
            database, day, hour, forecast=900 if hour % 2 else 1100, actual=1000,
        )
    result = await daily_comparison(database, day)
    assert [p.hour for p in result.series] == list(range(24))
    assert result.completeness.matched_hours == result.metrics.matched_points == 24
    assert result.completeness.missing_hours == 0
    assert result.metrics.mae_mw == result.metrics.rmse_mw == 100
    assert result.metrics.bias_mw == 0 and result.metrics.wape_percent == 10
    assert result.metrics.over_forecast_percent == 50
    assert result.metrics.under_forecast_percent == 50


async def test_captured_noon_anchor_runs_through_selection_aggregation_and_metrics(
    database,
):
    from app.services.accuracy_service import daily_comparison

    root = Path(__file__).parents[2]
    raw_forecasts = json.loads((root / "docs/samples/windfor.sample.json").read_text())
    raw_actuals = json.loads((Path(__file__).parent / "fixtures" /
                             "fuelhh-wind-2026-01-16-noon.json").read_text())
    for row in raw_forecasts:
        await forecasts.upsert(database, Forecast(
            publish_time=row["publishTime"], start_time=row["startTime"],
            generation_mw=row["generation"],
        ))
    for row in raw_actuals:
        await actuals.upsert(database, Actual(
            start_time=row["startTime"], settlement_date=row["settlementDate"],
            settlement_period=row["settlementPeriod"], generation_mw=row["generation"],
            source_publish_time=row["publishTime"],
        ))
    result = await daily_comparison(database, date(2026, 1, 15))
    assert len(result.series) == 1
    row = result.series[0]
    assert row.start_time == datetime(2026, 1, 16, 12, tzinfo=UTC)
    assert (row.forecast_mw, row.actual_mw, row.error_mw) == (7779, 8766.5, -987.5)
    assert row.absolute_error_mw == 987.5 and row.squared_error == 975156.25
    assert result.metrics.bias_mw == -987.5


async def test_full_january_fixture_has_744_heatmap_rows_and_24_groups(database):
    from app.services.accuracy_service import january_accuracy

    for offset in range(31):
        day = date(2026, 1, 1) + timedelta(days=offset)
        for hour in reversed(range(24)):
            await seed_hour(database, day, hour, forecast=1000 + hour - 12, actual=1000)
    result = await january_accuracy(database)
    assert len(result.series) == result.metrics.matched_points == 744
    assert result.completeness.expected_hours == 744
    assert result.completeness.matched_hours == 744
    assert result.completeness.missing_hours == 0
    assert result.metrics.mae_mw == 6 and result.metrics.bias_mw == -0.5
    assert result.metrics.wape_percent == pytest.approx(0.6)
    assert result.metrics.p90_abs_error_mw == 11
    assert len(result.hour_of_day_error) == 24
    assert [r.hour for r in result.hour_of_day_error] == list(range(24))
    assert all(r.matched_points == 31 for r in result.hour_of_day_error)
    assert [r.p90_abs_error_mw for r in result.hour_of_day_error] == [
        abs(h - 12) for h in range(24)
    ]
    assert result.series[0].decision_date == date(2026, 1, 1)
    assert result.series[-1].decision_date == date(2026, 1, 31)
    assert result.series[-1].delivery_date == date(2026, 2, 1)


async def test_empty_january_reports_missing_points_without_zero_metrics(database):
    from app.services.accuracy_service import january_accuracy

    result = await january_accuracy(database)
    assert result.series == [] and result.hour_of_day_error == []
    assert result.completeness.expected_hours == 744
    assert result.completeness.missing_hours == 744
    assert result.completeness.forecast_hours == result.completeness.actual_hours == 0
    assert result.metrics.matched_points == 0 and result.metrics.mae_mw is None


async def test_partial_january_weights_matched_points_not_daily_averages(database):
    from app.services.accuracy_service import january_accuracy

    await seed_hour(database, date(2026, 1, 1), 0, forecast=900, actual=1000)
    await seed_hour(database, date(2026, 1, 2), 0, forecast=1200, actual=1000)
    await seed_hour(database, date(2026, 1, 2), 1, forecast=1300, actual=1000)
    result = await january_accuracy(database)
    assert result.metrics.matched_points == 3
    assert result.completeness.matched_hours == 3
    assert result.completeness.missing_hours == 741
    assert result.metrics.mae_mw == 200
    assert result.metrics.bias_mw == pytest.approx(133.33333333333333)
    assert [(r.hour, r.matched_points) for r in result.hour_of_day_error] == [
        (0, 2), (1, 1),
    ]


def test_alignment_is_by_timestamp_not_input_position():
    from app.domain.actuals import HourlyActual
    from app.domain.comparison import match_hourly
    from app.domain.decision import DecisionContext

    selected = [Forecast(start_time=f"2026-01-16T{h:02d}:00:00Z",
                         publish_time="2026-01-15T07:30:00Z", generation_mw=100 + h)
                for h in [1, 0]]
    derived = [HourlyActual(
        datetime(2026, 1, 16, h, tzinfo=UTC), date(2026, 1, 16), h, 100,
    ) for h in [0, 1]]
    result = match_hourly(DecisionContext(date(2026, 1, 15)), selected, derived)
    assert [r.hour for r in result] == [0, 1]
    assert [r.error_mw for r in result] == [0, 1]
    with pytest.raises(ValueError, match="Duplicate"):
        match_hourly(DecisionContext(date(2026, 1, 15)), selected + selected, derived)
    with pytest.raises(ValueError, match="Duplicate"):
        match_hourly(DecisionContext(date(2026, 1, 15)), selected, derived + derived)
