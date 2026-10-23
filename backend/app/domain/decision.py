from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo


@dataclass(frozen=True)
class DecisionContext:
    decision_date: date

    @property
    def delivery_date(self) -> date:
        return self.decision_date + timedelta(days=1)

    @property
    def cutoff(self) -> datetime:
        return datetime.combine(
            self.decision_date, time(9, 20), tzinfo=ZoneInfo("Europe/London"),
        )
