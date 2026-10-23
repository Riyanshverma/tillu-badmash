from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from math import isfinite

from app.db.models import Forecast
from app.domain.comparison import ComparisonPoint
from app.domain.metrics import calculate_metrics


@dataclass(frozen=True)
class HourOfDayError:
    hour: int
    mae_mw: float
    p90_abs_error_mw: float
    matched_points: int


@dataclass(frozen=True)
class ForecastBand:
    start_time: datetime
    publish_time: datetime
    hour: int
    forecast_mw: float
    p90_abs_error_mw: float | None
    lower_mw: float | None
    upper_mw: float | None


def hour_of_day_statistics(points: Sequence[ComparisonPoint]) -> list[HourOfDayError]:
    groups = defaultdict(list)
    for point in points:
        groups[point.hour].append(point)
    result = []
    for hour, rows in sorted(groups.items()):
        metrics = calculate_metrics(rows)
        result.append(HourOfDayError(
            hour, metrics.mae_mw, metrics.p90_abs_error_mw, len(rows),
        ))
    return result


def forecast_bands(
    forecasts: Sequence[Forecast], statistics: Sequence[HourOfDayError],
) -> list[ForecastBand]:
    by_hour = {row.hour: row.p90_abs_error_mw for row in statistics}
    if len(by_hour) != len(statistics):
        raise ValueError("Duplicate hour-of-day statistics")
    if any(not 0 <= h <= 23 or not isfinite(p90) or p90 < 0
           for h, p90 in by_hour.items()):
        raise ValueError("Hour/P90 statistics must be valid and nonnegative")
    result = []
    for forecast in sorted(forecasts, key=lambda row: row.start_time):
        if not isfinite(forecast.generation_mw) or forecast.generation_mw < 0:
            raise ValueError("Forecast generation must be finite and nonnegative")
        if forecast.start_time.utcoffset() is None:
            raise ValueError("Forecast start_time must be timezone-aware")
        start = forecast.start_time.astimezone(UTC)
        p90 = by_hour.get(start.hour)
        lower = max(0.0, forecast.generation_mw - p90) if p90 is not None else None
        upper = forecast.generation_mw + p90 if p90 is not None else None
        if upper is not None and not isfinite(upper):
            raise ValueError("Band exceeds finite numeric range")
        result.append(ForecastBand(
            start, forecast.publish_time, start.hour, forecast.generation_mw,
            p90, lower, upper,
        ))
    return result
