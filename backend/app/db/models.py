from datetime import date

from pydantic import AwareDatetime, BaseModel, Field


class Actual(BaseModel):
    start_time: AwareDatetime
    settlement_date: date
    settlement_period: int = Field(ge=1, le=48)
    generation_mw: float = Field(ge=0, allow_inf_nan=False)
    source_publish_time: AwareDatetime


class Forecast(BaseModel):
    publish_time: AwareDatetime
    start_time: AwareDatetime
    generation_mw: float = Field(ge=0, allow_inf_nan=False)


class SyncRun(BaseModel):
    id: int
    started_at: AwareDatetime
    completed_at: AwareDatetime | None = None
    status: str = Field(min_length=1)
    fuelhh_rows: int = Field(default=0, ge=0)
    windfor_rows: int = Field(default=0, ge=0)
    rejected_rows: int = Field(default=0, ge=0)
    detail: str | None = None
