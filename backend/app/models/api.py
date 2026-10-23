from datetime import date
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, FiniteFloat


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"


MW = Annotated[FiniteFloat, Field(ge=0)]
Hour = Annotated[int, Field(ge=0, le=23)]
Count = Annotated[int, Field(ge=0)]
Percent = Annotated[FiniteFloat, Field(ge=0, le=100)]


class PublicModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, allow_inf_nan=False)


class AccuracyMetrics(PublicModel):
    mae_mw: MW
    rmse_mw: MW
    bias_mw: FiniteFloat
    wape_percent: MW | None
    p90_abs_error_mw: MW
    over_forecast_percent: Percent
    under_forecast_percent: Percent
    matched_points: Count


class DecisionCompleteness(PublicModel):
    expected_hours: Count
    forecast_hours: Count
    missing_hours: Count


class DecisionSummary(PublicModel):
    average_forecast_mw: MW
    peak_forecast_mw: MW
    peak_start_time: AwareDatetime
    historical_mae_mw: MW
    historical_p90_abs_error_mw: MW


class DecisionSeriesPoint(PublicModel):
    start_time: AwareDatetime
    hour: Hour
    forecast_mw: MW
    publish_time: AwareDatetime
    p90_abs_error_mw: MW
    lower_mw: MW
    upper_mw: MW


class DecisionResponse(PublicModel):
    decision_date: date
    delivery_date: date
    decision_cutoff: AwareDatetime
    market_timezone: Literal["Europe/London"]
    market_reference: Literal["EPEX SPOT GB DAA 1 (60')"]
    selected_forecast_publish_time: AwareDatetime
    forecast_age_minutes: Count
    completeness: DecisionCompleteness
    summary: DecisionSummary
    series: list[DecisionSeriesPoint]


class AccuracyPeriod(PublicModel):
    decision_date_from: date
    decision_date_to: date
    decision_cutoff_time: Literal["09:20"]
    market_timezone: Literal["Europe/London"]


class HeatmapPoint(PublicModel):
    decision_date: date
    delivery_date: date
    start_time: AwareDatetime
    hour: Hour
    forecast_mw: MW
    actual_mw: MW
    error_mw: FiniteFloat


class HourOfDayError(PublicModel):
    hour: Hour
    mae_mw: MW
    p90_abs_error_mw: MW


class AccuracyResponse(PublicModel):
    period: AccuracyPeriod
    metrics: AccuracyMetrics
    heatmap: list[HeatmapPoint]
    hour_of_day_error: list[HourOfDayError]


class ComparisonCompleteness(PublicModel):
    expected_hours: Count
    matched_hours: Count
    missing_hours: Count


class ComparisonPoint(PublicModel):
    start_time: AwareDatetime
    hour: Hour
    forecast_mw: MW
    actual_mw: MW
    error_mw: FiniteFloat
    absolute_error_mw: MW


class ComparisonResponse(PublicModel):
    decision_date: date
    delivery_date: date
    decision_cutoff: AwareDatetime
    completeness: ComparisonCompleteness
    metrics: AccuracyMetrics
    series: list[ComparisonPoint]


class EvolutionSeriesPoint(PublicModel):
    publish_time: AwareDatetime
    forecast_mw: MW
    is_available_at_decision: bool
    is_selected_at_decision: bool


class ForecastEvolutionResponse(PublicModel):
    target_time: AwareDatetime
    hour: Hour
    decision_date: date
    decision_cutoff: AwareDatetime
    actual_mw: MW | None
    selected_publish_time: AwareDatetime
    series: list[EvolutionSeriesPoint]
