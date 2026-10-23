from dataclasses import dataclass
from datetime import date, timedelta

import aiosqlite

from app.domain.comparison import ComparisonPoint, match_hourly
from app.domain.decision import DecisionContext
from app.domain.metrics import AccuracyMetrics, calculate_metrics
from app.domain.uncertainty import HourOfDayError, hour_of_day_statistics
from app.services.decision_service import decision_forecasts, hourly_actuals


@dataclass(frozen=True)
class ComparisonCompleteness:
    expected_hours: int
    forecast_hours: int
    actual_hours: int
    matched_hours: int

    @property
    def missing_hours(self) -> int:
        return self.expected_hours - self.matched_hours


@dataclass(frozen=True)
class DailyComparison:
    context: DecisionContext
    series: list[ComparisonPoint]
    metrics: AccuracyMetrics
    completeness: ComparisonCompleteness


@dataclass(frozen=True)
class JanuaryAccuracy:
    series: list[ComparisonPoint]
    metrics: AccuracyMetrics
    hour_of_day_error: list[HourOfDayError]
    completeness: ComparisonCompleteness


async def daily_comparison(
    connection: aiosqlite.Connection, decision_date: date,
) -> DailyComparison:
    selected = await decision_forecasts(connection, decision_date)
    actual = await hourly_actuals(connection, selected.context.delivery_date)
    series = match_hourly(selected.context, selected.series, actual.series)
    return DailyComparison(
        selected.context, series, calculate_metrics(series),
        ComparisonCompleteness(selected.expected_hours, selected.available_hours,
                               actual.available_hours, len(series)),
    )


async def january_accuracy(connection: aiosqlite.Connection) -> JanuaryAccuracy:
    series = []
    expected = forecast_count = actual_count = 0
    for offset in range(31):
        daily = await daily_comparison(
            connection, date(2026, 1, 1) + timedelta(days=offset),
        )
        series.extend(daily.series)
        expected += daily.completeness.expected_hours
        forecast_count += daily.completeness.forecast_hours
        actual_count += daily.completeness.actual_hours
    return JanuaryAccuracy(
        series, calculate_metrics(series), hour_of_day_statistics(series),
        ComparisonCompleteness(expected, forecast_count, actual_count, len(series)),
    )
