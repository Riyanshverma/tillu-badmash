import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from app.db.models import Actual

DAY = date(2026, 1, 16)


def actual(hour, minute, generation, *, day=DAY):
    start = datetime(day.year, day.month, day.day, hour, minute, tzinfo=UTC)
    return Actual(
        start_time=start, settlement_date=day,
        settlement_period=hour * 2 + minute // 30 + 1,
        generation_mw=generation, source_publish_time=start + timedelta(minutes=30),
    )


@pytest.mark.parametrize(
    "first,second,want", [(8600, 8962, 8781), (0, 100, 50), (0, 0, 0)],
)
def test_pair_is_averaged_not_summed(first, second, want):
    from app.domain.actuals import aggregate_hourly_actuals

    result = aggregate_hourly_actuals(
        [actual(12, 30, second), actual(12, 0, first)], DAY,
    )
    assert len(result.series) == 1
    point = result.series[0]
    assert point.generation_mw == want
    assert point.start_time == datetime(2026, 1, 16, 12, tzinfo=UTC)
    assert point.target_date == DAY and point.hour == 12
    assert result.expected_hours == 24 and result.available_hours == 1
    assert result.missing_hours == 23


@pytest.mark.parametrize("available_minute", [0, 30])
def test_missing_half_does_not_create_hourly_value(available_minute):
    from app.domain.actuals import aggregate_hourly_actuals

    result = aggregate_hourly_actuals([actual(12, available_minute, 8600)], DAY)
    assert result.series == []
    assert result.available_hours == 0 and result.missing_hours == 24
    assert datetime(2026, 1, 16, 12, tzinfo=UTC) in result.missing_start_times


def test_complete_unordered_day_returns_24_ordered_hours():
    from app.domain.actuals import aggregate_hourly_actuals

    rows = [actual(h, m, h * 100 + m) for h in range(24) for m in [0, 30]]
    result = aggregate_hourly_actuals(list(reversed(rows)), DAY)
    assert [p.hour for p in result.series] == list(range(24))
    assert [p.generation_mw for p in result.series] == [h * 100 + 15 for h in range(24)]
    assert result.expected_hours == result.available_hours == 24
    assert result.missing_start_times == [] and result.missing_hours == 0


def test_empty_day_reports_missing_hours_in_order():
    from app.domain.actuals import aggregate_hourly_actuals

    result = aggregate_hourly_actuals([], DAY)
    assert result.series == [] and result.missing_hours == 24
    assert [t.hour for t in result.missing_start_times] == list(range(24))
    assert all(t.utcoffset() == timedelta(0) for t in result.missing_start_times)


def test_verified_january16_pair_is_not_the_first_half_hour():
    from app.domain.actuals import aggregate_hourly_actuals
    from app.models.upstream import ElexonFuelhhRawRecord

    path = Path(__file__).parent / "fixtures/fuelhh-wind-2026-01-16-noon.json"
    raw = [
        ElexonFuelhhRawRecord.model_validate(r) for r in json.loads(path.read_text())
    ]
    rows = [Actual(
        start_time=r.startTime, settlement_date=r.settlementDate,
        settlement_period=r.settlementPeriod, source_publish_time=r.publishTime,
        generation_mw=r.generation,
    ) for r in raw]
    result = aggregate_hourly_actuals(rows, DAY)
    assert len(result.series) == 1
    assert result.series[0].start_time == datetime(2026, 1, 16, 12, tzinfo=UTC)
    assert result.series[0].generation_mw == 8766.5


def test_offsets_normalize_to_utc_and_other_dates_are_excluded():
    from app.domain.actuals import aggregate_hourly_actuals

    rows = [actual(12, 0, 8600), actual(12, 30, 8962),
            actual(12, 0, 1, day=date(2026, 1, 17))]
    rows[0].start_time = datetime.fromisoformat("2026-01-16T13:00:00+01:00")
    result = aggregate_hourly_actuals(rows, DAY)
    assert len(result.series) == 1 and result.series[0].generation_mw == 8781


def test_duplicate_half_hour_is_rejected():
    from app.domain.actuals import aggregate_hourly_actuals

    with pytest.raises(ValueError, match="Duplicate"):
        aggregate_hourly_actuals([actual(12, 0, 1), actual(12, 0, 2)], DAY)


@pytest.mark.parametrize("bad_start", [
    datetime(2026, 1, 16, 12),
    datetime(2026, 1, 16, 12, 15, tzinfo=UTC),
    datetime(2026, 1, 16, 12, 0, 1, tzinfo=UTC),
])
def test_invalid_actual_timestamps_cannot_use_local_timezone_or_be_rounded(bad_start):
    from app.domain.actuals import aggregate_hourly_actuals

    row = actual(12, 0, 1)
    row.start_time = bad_start
    with pytest.raises(ValueError):
        aggregate_hourly_actuals([row], DAY)
