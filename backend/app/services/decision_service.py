import logging
from dataclasses import dataclass
from datetime import date

import aiosqlite

from app.db.models import Forecast
from app.db.repositories import actuals, forecasts
from app.domain.actuals import HourlyActuals, aggregate_hourly_actuals
from app.domain.decision import DecisionContext

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DecisionForecasts:
    context: DecisionContext
    series: list[Forecast]
    expected_hours: int = 24

    @property
    def available_hours(self) -> int:
        return len(self.series)

    @property
    def missing_hours(self) -> int:
        return self.expected_hours - self.available_hours


async def hourly_actuals(
    connection: aiosqlite.Connection, target_date: date,
) -> HourlyActuals:
    result = aggregate_hourly_actuals(
        await actuals.for_date(connection, target_date), target_date,
    )
    logger.info("Hourly actuals date=%s available=%s expected=%s missing=%s",
                target_date, result.available_hours, result.expected_hours,
                result.missing_hours)
    return result


async def decision_forecasts(
    connection: aiosqlite.Connection, decision_date: date,
) -> DecisionForecasts:
    context = DecisionContext(decision_date)
    series = await forecasts.at_cutoff(
        connection, context.delivery_date, context.cutoff,
    )
    if any(r.start_time.minute or r.start_time.second or r.start_time.microsecond
           for r in series):
        raise ValueError("Forecast start_time must align to an hourly target")
    result = DecisionForecasts(context, series)
    logger.info("Decision date=%s cutoff=%s available=%s expected=%s missing=%s",
                decision_date, context.cutoff.isoformat(), result.available_hours,
                result.expected_hours, result.missing_hours)
    return result
