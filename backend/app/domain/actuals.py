from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from app.db.models import Actual


@dataclass(frozen=True)
class HourlyActual:
    start_time: datetime
    target_date: date
    hour: int
    generation_mw: float


@dataclass(frozen=True)
class HourlyActuals:
    target_date: date
    series: list[HourlyActual]
    missing_start_times: list[datetime]
    expected_hours: int = 24

    @property
    def available_hours(self) -> int:
        return len(self.series)

    @property
    def missing_hours(self) -> int:
        return len(self.missing_start_times)


def aggregate_hourly_actuals(
    records: Sequence[Actual], target_date: date,
) -> HourlyActuals:
    by_start = {}
    for record in records:
        if record.start_time.utcoffset() is None:
            raise ValueError("Actual start_time must be timezone-aware")
        start = record.start_time.astimezone(UTC)
        if start.date() != target_date:
            continue
        if start.minute not in (0, 30) or start.second or start.microsecond:
            raise ValueError("Actual start_time must align to a half-hour")
        if start in by_start:
            raise ValueError(f"Duplicate actual start_time: {start.isoformat()}")
        by_start[start] = record.generation_mw
    series = []
    missing = []
    for hour in range(24):
        start = datetime(target_date.year, target_date.month, target_date.day,
                         hour, tzinfo=UTC)
        second = start + timedelta(minutes=30)
        if start not in by_start or second not in by_start:
            missing.append(start)
            continue
        series.append(HourlyActual(
            start_time=start, target_date=target_date, hour=hour,
            generation_mw=(by_start[start] + by_start[second]) / 2,
        ))
    return HourlyActuals(target_date, series, missing)
