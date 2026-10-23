import json
from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.db.connection import connect_database, initialize_schema
from app.db.models import Actual, Forecast
from app.db.repositories import actuals, forecasts
from app.main import create_app
from app.services.accuracy_service import january_accuracy


@pytest.fixture
async def api(tmp_path):
    path = tmp_path / "api.db"
    application = create_app(Settings(_env_file=None, database_path=path))
    async with application.router.lifespan_context(application):
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=application), base_url="http://test",
        ) as client:
            yield client, path


async def seed(path, days=(15,), *, zero_actual=False):
    async with connect_database(path) as db:
        await initialize_schema(db)
        for day in days:
            decision = date(2026, 1, day)
            delivery = decision + timedelta(days=1)
            for hour in reversed(range(24)):
                start = datetime.combine(delivery, datetime.min.time(), UTC)
                start += timedelta(hours=hour)
                for clock, generation in [("09:30", 7802), ("07:30", 7779),
                                          ("04:30", 7903), ("02:30", 9020)]:
                    await forecasts.upsert(db, Forecast(
                        start_time=start, publish_time=f"{decision}T{clock}:00Z",
                        generation_mw=generation,
                    ))
                for minute, generation in [(0, 8781), (30, 8752)]:
                    await actuals.upsert(db, Actual(
                        start_time=start + timedelta(minutes=minute),
                        settlement_date=delivery,
                        settlement_period=hour * 2 + minute // 30 + 1,
                        generation_mw=0 if zero_actual else generation,
                        source_publish_time=start + timedelta(hours=1),
                    ))


def validate(response, model_name):
    from app.models import api as models

    assert response.status_code == 200, response.text
    model = getattr(models, model_name).model_validate_json(response.content)
    assert model.model_dump(mode="json") == response.json()
    json.loads(response.text, parse_constant=lambda value: pytest.fail(value))
    return response.json()


@pytest.mark.parametrize("day", [15, 31])
async def test_decision_contract_and_boundary(api, day):
    client, path = api
    await seed(path, (day,))
    body = validate(await client.get(f"/api/v1/decisions/2026-01-{day}"),
                    "DecisionResponse")
    assert body["decision_date"] == f"2026-01-{day}"
    assert body["delivery_date"] == str(date(2026, 1, day) + timedelta(days=1))
    assert body["decision_cutoff"] == f"2026-01-{day}T09:20:00Z"
    assert body["selected_forecast_publish_time"] == f"2026-01-{day}T07:30:00Z"
    assert body["forecast_age_minutes"] == 110
    assert body["market_timezone"] == "Europe/London"
    assert body["market_reference"] == "EPEX SPOT GB DAA 1 (60')"
    assert body["completeness"] == {
        "expected_hours": 24, "forecast_hours": 24, "missing_hours": 0,
    }
    assert [p["hour"] for p in body["series"]] == list(range(24))
    assert body["summary"]["average_forecast_mw"] == 7779
    assert body["summary"]["peak_forecast_mw"] == 7779
    assert body["summary"]["peak_start_time"] == body["series"][0]["start_time"]
    assert body["summary"]["historical_mae_mw"] == 987.5
    assert body["summary"]["historical_p90_abs_error_mw"] == 987.5
    for point in body["series"]:
        assert set(point) == {"start_time", "hour", "forecast_mw", "publish_time",
                              "p90_abs_error_mw", "lower_mw", "upper_mw"}
        assert point["lower_mw"] == 6791.5
        assert point["upper_mw"] == 8766.5


async def test_comparison_corrected_noon(api):
    client, path = api
    await seed(path)
    body = validate(await client.get("/api/v1/comparisons/2026-01-15"),
                    "ComparisonResponse")
    assert body["completeness"] == {
        "expected_hours": 24, "matched_hours": 24, "missing_hours": 0,
    }
    assert len(body["series"]) == 24
    assert body["series"][12] == {
        "start_time": "2026-01-16T12:00:00Z", "hour": 12,
        "forecast_mw": 7779, "actual_mw": 8766.5,
        "error_mw": -987.5, "absolute_error_mw": 987.5,
    }


async def test_accuracy_full_january_matches_service(api):
    client, path = api
    await seed(path, range(1, 32))
    body = validate(await client.get("/api/v1/accuracy"), "AccuracyResponse")
    async with connect_database(path) as db:
        expected = await january_accuracy(db)
    assert body["metrics"] == asdict(expected.metrics)
    assert body["period"] == {
        "decision_date_from": "2026-01-01", "decision_date_to": "2026-01-31",
        "decision_cutoff_time": "09:20", "market_timezone": "Europe/London",
    }
    assert len(body["heatmap"]) == body["metrics"]["matched_points"] == 744
    assert [r["hour"] for r in body["hour_of_day_error"]] == list(range(24))
    assert set(body["heatmap"][0]) == {
        "decision_date", "delivery_date", "start_time", "hour",
        "forecast_mw", "actual_mw", "error_mw",
    }
    assert set(body["hour_of_day_error"][0]) == {"hour", "mae_mw", "p90_abs_error_mw"}


async def test_evolution_cutoff_and_corrected_actual(api):
    client, path = api
    await seed(path)
    body = validate(await client.get("/api/v1/forecast-evolution", params={
        "target_time": "2026-01-16T13:00:00+01:00",
    }), "ForecastEvolutionResponse")
    assert body["target_time"] == "2026-01-16T12:00:00Z"
    assert body["hour"] == 12 and body["decision_date"] == "2026-01-15"
    assert body["decision_cutoff"] == "2026-01-15T09:20:00Z"
    assert body["actual_mw"] == 8766.5
    assert body["selected_publish_time"] == "2026-01-15T07:30:00Z"
    assert [r["publish_time"][11:16] for r in body["series"]] == [
        "02:30", "04:30", "07:30", "09:30",
    ]
    assert [r["is_available_at_decision"] for r in body["series"]] == [
        True, True, True, False,
    ]
    assert [r["is_selected_at_decision"] for r in body["series"]] == [
        False, False, True, False,
    ]


@pytest.mark.parametrize("url", [
    "/api/v1/decisions/invalid", "/api/v1/decisions/2026-02-01",
    "/api/v1/comparisons/2025-12-31", "/api/v1/comparisons/invalid",
    "/api/v1/forecast-evolution?target_time=invalid",
    "/api/v1/forecast-evolution?target_time=1768564800",
    "/api/v1/forecast-evolution?target_time=2026-01-16T12:00:00",
    "/api/v1/forecast-evolution?target_time=2026-01-16T12:30:00Z",
    "/api/v1/forecast-evolution?target_time=2026-02-02T12:00:00Z",
    "/api/v1/forecast-evolution",
])
async def test_invalid_requests_return_422(api, url):
    client, _ = api
    response = await client.get(url)
    assert response.status_code == 422
    assert "detail" in response.json()


@pytest.mark.parametrize("url,detail", [
    ("/api/v1/decisions/2026-01-15", "No decision-time forecasts available"),
    ("/api/v1/comparisons/2026-01-15", "No matched hourly data available"),
    ("/api/v1/accuracy", "No matched hourly data available"),
    ("/api/v1/forecast-evolution?target_time=2026-01-16T12:00:00Z",
     "No forecast vintages available for target"),
])
async def test_empty_database_is_initialized_and_returns_404(api, url, detail):
    client, _ = api
    response = await client.get(url)
    assert response.status_code == 404
    assert response.json() == {"detail": detail}
    assert (await client.get("/api/v1/health")).status_code == 200


async def test_partial_data_and_missing_actual_remain_explicit(api):
    client, path = api
    await seed(path, (14, 15))
    async with connect_database(path) as db:
        await db.execute("DELETE FROM wind_actuals_half_hourly WHERE "
                         "start_time LIKE '2026-01-16T12:30:%'")
        await db.execute("DELETE FROM wind_forecasts_hourly WHERE target_hour = 13")
    comparison = validate(await client.get("/api/v1/comparisons/2026-01-15"),
                          "ComparisonResponse")
    assert comparison["completeness"] == {
        "expected_hours": 24, "matched_hours": 22, "missing_hours": 2,
    }
    assert comparison["metrics"]["matched_points"] == 22
    assert {p["hour"] for p in comparison["series"]} == set(range(24)) - {12, 13}
    evolution = validate(await client.get("/api/v1/forecast-evolution", params={
        "target_time": "2026-01-16T12:00:00Z",
    }), "ForecastEvolutionResponse")
    assert evolution["actual_mw"] is None
    decision = validate(await client.get("/api/v1/decisions/2026-01-15"),
                        "DecisionResponse")
    assert decision["completeness"]["forecast_hours"] == 23
    assert decision["completeness"]["missing_hours"] == 1


async def test_forecast_without_history_is_explicit_missing_data(api):
    client, path = api
    await seed(path)
    async with connect_database(path) as db:
        await db.execute("DELETE FROM wind_actuals_half_hourly")
    response = await client.get("/api/v1/decisions/2026-01-15")
    assert response.status_code == 404
    assert response.json() == {"detail": "Historical error statistics unavailable"}


async def test_missing_one_historical_hour_does_not_invent_a_band(api):
    client, path = api
    await seed(path)
    async with connect_database(path) as db:
        await db.execute("DELETE FROM wind_actuals_half_hourly WHERE "
                         "settlement_period IN (25, 26)")
    response = await client.get("/api/v1/decisions/2026-01-15")
    assert response.status_code == 404
    assert response.json() == {"detail": "Historical error statistics unavailable"}


async def test_evolution_without_eligible_vintage_never_selects_later(api):
    client, path = api
    await seed(path)
    async with connect_database(path) as db:
        await db.execute("DELETE FROM wind_forecasts_hourly WHERE "
                         "publish_time < '2026-01-15T09:20:00Z'")
    response = await client.get("/api/v1/forecast-evolution", params={
        "target_time": "2026-01-16T12:00:00Z",
    })
    assert response.status_code == 404
    assert response.json() == {
        "detail": "No decision-time forecast available for target",
    }


async def test_publication_is_derived_per_target_and_at_cutoff_is_eligible(api):
    client, path = api
    await seed(path)
    async with connect_database(path) as db:
        await forecasts.upsert(db, Forecast(
            start_time="2026-01-16T12:00:00Z",
            publish_time="2026-01-15T09:20:00Z", generation_mw=100,
        ))
    body = validate(await client.get("/api/v1/decisions/2026-01-15"),
                    "DecisionResponse")
    assert body["selected_forecast_publish_time"] == "2026-01-15T09:20:00Z"
    assert body["forecast_age_minutes"] == 0
    assert body["series"][12]["publish_time"] == "2026-01-15T09:20:00Z"
    assert body["series"][11]["publish_time"] == "2026-01-15T07:30:00Z"
    assert body["series"][12]["forecast_mw"] == 100
    evolution = validate(await client.get("/api/v1/forecast-evolution", params={
        "target_time": "2026-01-16T12:00:00Z",
    }), "ForecastEvolutionResponse")
    assert evolution["selected_publish_time"] == "2026-01-15T09:20:00Z"
    assert sum(row["is_selected_at_decision"] for row in evolution["series"]) == 1


async def test_unexpected_failure_is_json_without_database_details(tmp_path):
    path = tmp_path / "broken.db"
    application = create_app(Settings(_env_file=None, database_path=path))
    async with application.router.lifespan_context(application):
        async with connect_database(path) as db:
            await db.execute("DROP TABLE wind_forecasts_hourly")
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=application, raise_app_exceptions=False),
            base_url="http://test",
        ) as client:
            response = await client.get("/api/v1/decisions/2026-01-15")
    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}


async def test_wape_zero_denominator_serializes_null(api):
    client, path = api
    await seed(path, zero_actual=True)
    for url, model in [("/api/v1/accuracy", "AccuracyResponse"),
                       ("/api/v1/comparisons/2026-01-15", "ComparisonResponse")]:
        body = validate(await client.get(url), model)
        assert body["metrics"]["wape_percent"] is None
    decision = validate(await client.get("/api/v1/decisions/2026-01-15"),
                        "DecisionResponse")
    assert all(p["lower_mw"] == 0 for p in decision["series"])


async def test_wape_above_100_is_valid_and_not_clamped(api):
    client, path = api
    await seed(path)
    async with connect_database(path) as db:
        await db.execute("UPDATE wind_actuals_half_hourly SET generation_mw = 1")
    body = validate(await client.get("/api/v1/accuracy"), "AccuracyResponse")
    assert body["metrics"]["wape_percent"] == 777800


async def test_openapi_declares_response_models_and_nullable_wape(api):
    client, _ = api
    document = (await client.get("/openapi.json")).json()
    for path, model in [
        ("decisions/{decision_date}", "DecisionResponse"),
        ("accuracy", "AccuracyResponse"),
        ("comparisons/{decision_date}", "ComparisonResponse"),
        ("forecast-evolution", "ForecastEvolutionResponse"),
    ]:
        schema = document["paths"][f"/api/v1/{path}"]["get"]["responses"]["200"]
        assert schema["content"]["application/json"]["schema"] == {
            "$ref": f"#/components/schemas/{model}",
        }
    wape = document["components"]["schemas"]["AccuracyMetrics"]["properties"][
        "wape_percent"
    ]
    assert {"type": "null"} in wape["anyOf"]


@pytest.mark.parametrize("invalid", [float("nan"), float("inf"), float("-inf")])
async def test_public_model_rejects_nonfinite_and_naive_timestamps(api, invalid):
    from app.models.api import ComparisonResponse

    client, path = api
    await seed(path)
    body = (await client.get("/api/v1/comparisons/2026-01-15")).json()
    body["series"][0]["error_mw"] = invalid
    with pytest.raises(ValidationError):
        ComparisonResponse.model_validate(body)
    body["series"][0]["error_mw"] = -987.5
    body["series"][0]["start_time"] = "2026-01-16T00:00:00"
    with pytest.raises(ValidationError):
        ComparisonResponse.model_validate(body)


@pytest.mark.parametrize("name,model_name", [
    ("decision", "DecisionResponse"), ("comparison", "ComparisonResponse"),
    ("evolution", "ForecastEvolutionResponse"),
])
def test_recorded_live_responses_match_public_models(name, model_name):
    from app.models import api as models

    path = Path(__file__).parent / "fixtures" / "api" / f"{name}.json"
    model = getattr(models, model_name).model_validate_json(path.read_text())
    assert model.model_dump(mode="json") == json.loads(path.read_text())


def test_recorded_accuracy_summary_is_explicitly_a_subset():
    from app.models.api import AccuracyMetrics, HeatmapPoint, HourOfDayError

    path = Path(__file__).parent / "fixtures" / "api" / "accuracy-summary.json"
    body = json.loads(path.read_text())
    assert AccuracyMetrics.model_validate(body["metrics"]).matched_points == 744
    assert body["heatmap_count"] == 744 and len(body["heatmap_sample"]) == 1
    assert len(body["hour_of_day_error"]) == 24
    for row in body["heatmap_sample"]:
        assert HeatmapPoint.model_validate(row).error_mw == -987.5
    for row in body["hour_of_day_error"]:
        HourOfDayError.model_validate(row)
