from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from math import isfinite

from app.db.models import Forecast
from app.domain.actuals import HourlyActual
from app.domain.decision import DecisionContext


@dataclass(frozen=True)
class ComparisonPoint:
    decision_date: date
    start_time: datetime
    forecast_mw: float
    actual_mw: float

    def __post_init__(self) -> None:
        if self.start_time.utcoffset() is None:
            raise ValueError("Comparison start_time must be timezone-aware")
        start = self.start_time.astimezone(UTC)
        if start.minute or start.second or start.microsecond:
            raise ValueError("Comparison start_time must be hourly")
        if start.date() != DecisionContext(self.decision_date).delivery_date:
            raise ValueError("Comparison target must be on the delivery date")
        object.__setattr__(self, "start_time", start)
        if any(not isfinite(v) or v < 0 for v in (self.forecast_mw, self.actual_mw)):
            raise ValueError("Comparison generation must be finite and nonnegative")
        if not isfinite(self.squared_error):
            raise ValueError("Squared error exceeds finite numeric range")

    @property
    def delivery_date(self) -> date:
        return self.start_time.date()

    @property
    def hour(self) -> int:
        return self.start_time.hour

    @property
    def error_mw(self) -> float:
        return self.forecast_mw - self.actual_mw

    @property
    def absolute_error_mw(self) -> float:
        return abs(self.error_mw)

    @property
    def squared_error(self) -> float:
        return self.error_mw * self.error_mw


def match_hourly(
    context: DecisionContext,
    forecasts: Sequence[Forecast],
    actuals: Sequence[HourlyActual],
) -> list[ComparisonPoint]:
    for row in (*forecasts, *actuals):
        if row.start_time.utcoffset() is None:
            raise ValueError("Comparison input timestamps must be timezone-aware")
    by_forecast = {row.start_time: row for row in forecasts}
    by_actual = {row.start_time: row for row in actuals}
    if len(by_forecast) != len(forecasts) or len(by_actual) != len(actuals):
        raise ValueError("Duplicate hourly comparison input")
    return [ComparisonPoint(
        context.decision_date, start, by_forecast[start].generation_mw,
        by_actual[start].generation_mw,
    ) for start in sorted(by_forecast.keys() & by_actual.keys())]
