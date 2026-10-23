from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, BeforeValidator, ConfigDict, Field


def require_iso_datetime(value: object) -> datetime:
    if isinstance(value, str):
        return datetime.fromisoformat(value)
    if isinstance(value, datetime):
        return value
    raise ValueError("Expected an ISO datetime string or aware datetime")


UpstreamDateTime = Annotated[AwareDatetime, BeforeValidator(require_iso_datetime)]


class ElexonFuelhhRawRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    dataset: Literal["FUELHH"]
    publishTime: UpstreamDateTime
    startTime: UpstreamDateTime
    settlementDate: date
    settlementPeriod: int = Field(ge=1, le=48, strict=True)
    fuelType: str
    generation: float = Field(ge=0, strict=True, allow_inf_nan=False)


class ElexonWindforRawRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    dataset: Literal["WINDFOR"]
    publishTime: UpstreamDateTime
    startTime: UpstreamDateTime
    generation: float = Field(ge=0, strict=True, allow_inf_nan=False)
