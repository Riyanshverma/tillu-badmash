import json
from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta

import pytest


def point(error, *, hour=0, actual=1000, day=date(2026, 1, 1)):
    from app.domain.comparison import ComparisonPoint

    delivery = day + timedelta(days=1)
    return ComparisonPoint(
        decision_date=day,
        start_time=datetime(
            delivery.year, delivery.month, delivery.day, hour, tzinfo=UTC,
        ),
        forecast_mw=actual + error, actual_mw=actual,
    )


def test_corrected_noon_comparison_preserves_fractional_error():
    row = point(-987.5, hour=12, actual=8766.5, day=date(2026, 1, 15))
    assert row.forecast_mw == 7779
    assert row.delivery_date == date(2026, 1, 16) and row.hour == 12
    assert row.error_mw == -987.5
    assert row.absolute_error_mw == 987.5
    assert row.squared_error == 975156.25


def test_metrics_match_hand_calculation():
    from app.domain.metrics import calculate_metrics

    result = calculate_metrics([point(-100), point(200), point(-300)])
    assert result.matched_points == 3
    assert result.mae_mw == 200
    assert result.rmse_mw == pytest.approx(216.02468994692867)
    assert result.bias_mw == pytest.approx(-66.66666666666667)
    assert result.wape_percent == 20
    assert result.p90_abs_error_mw == 280
    assert result.over_forecast_percent == pytest.approx(100 / 3)
    assert result.under_forecast_percent == pytest.approx(200 / 3)
    json.dumps(asdict(result), allow_nan=False)


@pytest.mark.parametrize("errors,bias", [([100, 200], 150), ([-100, -200], -150)])
def test_bias_keeps_its_sign(errors, bias):
    from app.domain.metrics import calculate_metrics

    assert calculate_metrics([point(e) for e in errors]).bias_mw == bias


def test_zero_errors_are_neither_over_nor_under_forecasts():
    from app.domain.metrics import calculate_metrics

    result = calculate_metrics([point(-100), point(0), point(100)])
    assert result.over_forecast_percent == pytest.approx(100 / 3)
    assert result.under_forecast_percent == pytest.approx(100 / 3)
    assert result.over_forecast_percent + result.under_forecast_percent < 100


def test_wape_preserves_zero_actuals_and_handles_zero_denominator():
    from app.domain.metrics import calculate_metrics

    result = calculate_metrics([point(10, actual=0), point(-10, actual=100)])
    assert result.wape_percent == 20
    zero = calculate_metrics([point(0, actual=0), point(100, actual=0)])
    assert zero.wape_percent is None and zero.matched_points == 2
    assert zero.mae_mw == 50
    json.dumps(asdict(zero), allow_nan=False)


@pytest.mark.parametrize(
    "errors,want", [([50], 50), ([0, 10], 9), ([100, 200, 300], 280)],
)
def test_percentile_uses_linear_interpolation(errors, want):
    from app.domain.metrics import calculate_metrics

    assert calculate_metrics([point(e) for e in errors]).p90_abs_error_mw == want


def test_no_matches_returns_nullable_metrics_without_nan():
    from app.domain.metrics import calculate_metrics

    result = calculate_metrics([])
    assert result.matched_points == 0
    assert all(value is None for key, value in asdict(result).items()
               if key != "matched_points")
    json.dumps(asdict(result), allow_nan=False)


@pytest.mark.parametrize("field", ["forecast_mw", "actual_mw"])
@pytest.mark.parametrize("bad", [-1, float("nan"), float("inf"), float("-inf")])
def test_invalid_comparison_generation_is_rejected(field, bad):
    from app.domain.comparison import ComparisonPoint

    values = dict(decision_date=date(2026, 1, 1),
                  start_time=datetime(2026, 1, 2, tzinfo=UTC),
                  forecast_mw=100, actual_mw=100)
    values[field] = bad
    with pytest.raises(ValueError):
        ComparisonPoint(**values)


def test_unrepresentable_squared_error_fails_instead_of_emitting_infinity():
    with pytest.raises(ValueError):
        point(1e200, actual=0)


@pytest.mark.parametrize("bad_start", [
    datetime(2026, 1, 2), datetime(2026, 1, 2, 0, 30, tzinfo=UTC),
    datetime(2026, 1, 3, tzinfo=UTC),
])
def test_comparison_rejects_naive_offgrid_or_wrong_delivery_date(bad_start):
    from app.domain.comparison import ComparisonPoint

    with pytest.raises(ValueError):
        ComparisonPoint(date(2026, 1, 1), bad_start, 100, 100)


def test_comparison_hour_and_date_are_derived_in_utc():
    from app.domain.comparison import ComparisonPoint

    row = ComparisonPoint(
        date(2026, 1, 1), datetime.fromisoformat("2026-01-02T01:00:00+01:00"), 100, 100,
    )
    assert row.start_time == datetime(2026, 1, 2, tzinfo=UTC)
    assert row.delivery_date == date(2026, 1, 2) and row.hour == 0


def test_metric_overflow_fails_instead_of_emitting_infinity():
    from app.domain.metrics import calculate_metrics

    with pytest.raises(ValueError):
        calculate_metrics([point(0, actual=1e308), point(0, actual=1e308)])


def test_hour_of_day_statistics_group_independently_and_sort():
    from app.domain.uncertainty import hour_of_day_statistics

    rows = [point(-300, hour=0), point(50, hour=23),
            point(100, hour=0, day=date(2026, 1, 2))]
    result = hour_of_day_statistics(rows)
    assert [r.hour for r in result] == [0, 23]
    assert (result[0].mae_mw, result[0].p90_abs_error_mw) == (200, 280)
    assert result[0].matched_points == 2
    assert (result[1].mae_mw, result[1].p90_abs_error_mw) == (50, 50)
    assert hour_of_day_statistics([]) == []


def test_all_target_hours_form_24_groups():
    from app.domain.uncertainty import hour_of_day_statistics

    result = hour_of_day_statistics([point(h, hour=h) for h in reversed(range(24))])
    assert [r.hour for r in result] == list(range(24))
    assert [r.p90_abs_error_mw for r in result] == list(range(24))


@pytest.mark.parametrize("forecast,lower,upper", [(1000, 700, 1300), (100, 0, 400)])
def test_p90_bands_use_matching_hour_and_clip_lower_bound(forecast, lower, upper):
    from app.db.models import Forecast
    from app.domain.uncertainty import forecast_bands, hour_of_day_statistics

    stats = hour_of_day_statistics([point(300, hour=12), point(999, hour=0)])
    rows = [Forecast(start_time="2026-01-16T12:00:00Z",
                     publish_time="2026-01-15T07:30:00Z", generation_mw=forecast)]
    result = forecast_bands(rows, stats)
    assert len(result) == 1 and result[0].hour == 12
    assert result[0].p90_abs_error_mw == 300
    assert (result[0].lower_mw, result[0].upper_mw) == (lower, upper)
    json.dumps(asdict(result[0]), default=str, allow_nan=False)


def test_absent_hour_history_stays_unknown_instead_of_zero():
    from app.db.models import Forecast
    from app.domain.uncertainty import forecast_bands

    rows = [Forecast(start_time="2026-01-16T12:00:00Z",
                     publish_time="2026-01-15T07:30:00Z", generation_mw=1000)]
    result = forecast_bands(rows, [])
    assert result[0].p90_abs_error_mw is None
    assert result[0].lower_mw is None and result[0].upper_mw is None


def test_band_rejects_nonfinite_generation_even_without_history():
    from app.db.models import Forecast
    from app.domain.uncertainty import forecast_bands

    row = Forecast(start_time="2026-01-16T12:00:00Z",
                   publish_time="2026-01-15T07:30:00Z", generation_mw=1000)
    row.generation_mw = float("nan")
    with pytest.raises(ValueError):
        forecast_bands([row], [])


@pytest.mark.parametrize("bad", [-1, float("nan"), float("inf")])
def test_band_rejects_invalid_historical_p90(bad):
    from app.domain.uncertainty import HourOfDayError, forecast_bands

    with pytest.raises(ValueError):
        forecast_bands([], [HourOfDayError(12, 0, bad, 1)])


def test_band_rejects_duplicate_history_hours_and_numeric_overflow():
    from app.db.models import Forecast
    from app.domain.uncertainty import HourOfDayError, forecast_bands

    stat = HourOfDayError(12, 0, 300, 1)
    with pytest.raises(ValueError):
        forecast_bands([], [stat, stat])
    row = Forecast(start_time="2026-01-16T12:00:00Z",
                   publish_time="2026-01-15T07:30:00Z", generation_mw=1e308)
    with pytest.raises(ValueError):
        forecast_bands([row], [HourOfDayError(12, 0, 1e308, 1)])
