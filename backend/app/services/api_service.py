from datetime import date, datetime, timedelta
from statistics import fmean

import aiosqlite

from app.db.repositories import forecasts
from app.domain.uncertainty import forecast_bands
from app.models import api
from app.services.accuracy_service import daily_comparison, january_accuracy
from app.services.decision_service import decision_forecasts, hourly_actuals


class MissingDataError(LookupError):
    pass


async def decision(connection: aiosqlite.Connection, day: date) -> api.DecisionResponse:
    selected = await decision_forecasts(connection, day)
    if not selected.series:
        raise MissingDataError("No decision-time forecasts available")
    history = await january_accuracy(connection)
    bands = forecast_bands(selected.series, history.hour_of_day_error)
    if not history.series or any(band.p90_abs_error_mw is None for band in bands):
        raise MissingDataError("Historical error statistics unavailable")
    publication = max(row.publish_time for row in selected.series)
    peak = max(selected.series, key=lambda row: row.generation_mw)
    return api.DecisionResponse(
        decision_date=day, delivery_date=selected.context.delivery_date,
        decision_cutoff=selected.context.cutoff, market_timezone="Europe/London",
        market_reference="EPEX SPOT GB DAA 1 (60')",
        selected_forecast_publish_time=publication,
        forecast_age_minutes=int((selected.context.cutoff - publication).total_seconds()
                                 // 60),
        completeness=api.DecisionCompleteness(
            expected_hours=selected.expected_hours,
            forecast_hours=selected.available_hours,
            missing_hours=selected.missing_hours,
        ),
        summary=api.DecisionSummary(
            average_forecast_mw=fmean(row.generation_mw for row in selected.series),
            peak_forecast_mw=peak.generation_mw, peak_start_time=peak.start_time,
            historical_mae_mw=history.metrics.mae_mw,
            historical_p90_abs_error_mw=history.metrics.p90_abs_error_mw,
        ),
        series=[api.DecisionSeriesPoint.model_validate(row) for row in bands],
    )


async def accuracy(connection: aiosqlite.Connection) -> api.AccuracyResponse:
    result = await january_accuracy(connection)
    if not result.series:
        raise MissingDataError("No matched hourly data available")
    return api.AccuracyResponse(
        period=api.AccuracyPeriod(
            decision_date_from=date(2026, 1, 1), decision_date_to=date(2026, 1, 31),
            decision_cutoff_time="09:20", market_timezone="Europe/London",
        ),
        metrics=api.AccuracyMetrics.model_validate(result.metrics),
        heatmap=[api.HeatmapPoint.model_validate(row) for row in result.series],
        hour_of_day_error=[api.HourOfDayError.model_validate(row)
                           for row in result.hour_of_day_error],
    )


async def comparison(
    connection: aiosqlite.Connection, day: date,
) -> api.ComparisonResponse:
    result = await daily_comparison(connection, day)
    if not result.series:
        raise MissingDataError("No matched hourly data available")
    return api.ComparisonResponse(
        decision_date=day, delivery_date=result.context.delivery_date,
        decision_cutoff=result.context.cutoff,
        completeness=api.ComparisonCompleteness.model_validate(result.completeness),
        metrics=api.AccuracyMetrics.model_validate(result.metrics),
        series=[api.ComparisonPoint.model_validate(row) for row in result.series],
    )


async def evolution(
    connection: aiosqlite.Connection, target: datetime,
) -> api.ForecastEvolutionResponse:
    vintages = await forecasts.for_target(connection, target)
    if not vintages:
        raise MissingDataError("No forecast vintages available for target")
    selected = await decision_forecasts(connection, target.date() - timedelta(days=1))
    forecast = next((row for row in selected.series if row.start_time == target), None)
    if forecast is None:
        raise MissingDataError("No decision-time forecast available for target")
    actuals = await hourly_actuals(connection, selected.context.delivery_date)
    actual = next((row for row in actuals.series if row.start_time == target), None)
    return api.ForecastEvolutionResponse(
        target_time=target, hour=target.hour,
        decision_date=selected.context.decision_date,
        decision_cutoff=selected.context.cutoff,
        actual_mw=actual.generation_mw if actual is not None else None,
        selected_publish_time=forecast.publish_time,
        series=[api.EvolutionSeriesPoint(
            publish_time=row.publish_time, forecast_mw=row.generation_mw,
            is_available_at_decision=row.publish_time <= selected.context.cutoff,
            is_selected_at_decision=row.publish_time == forecast.publish_time,
        ) for row in vintages],
    )
