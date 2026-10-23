# Phase 6 verification — 2026-10-23

Phase 6 is complete. Phase 7 remains untouched. No frontend files were modified.

## Files created or modified

- `app/models/api.py`: explicit nested public response models for all four analytical endpoints; existing HealthResponse preserved.
- `app/api/dependencies.py`: configured SQLite connection/read snapshot, January date constraints and aware hourly target validation.
- `app/api/routes/decisions.py`, `accuracy.py`, `comparisons.py`, `evolution.py`: thin GET routes with response models.
- `app/api/router.py`: registers the four routes under the configured `/api/v1` prefix.
- `app/services/api_service.py`: public response assembly from existing Phase 4/5 services/domain functions.
- `app/main.py`: lifespan schema initialization, configured database wiring and JSON 404/500 exception handling.
- `tests/test_public_api.py`: 35 tests covering deterministic API behavior, serialization and recorded responses.
- `tests/test_foundation.py`: existing health/OpenAPI assertion expanded to the five routes.
- `tests/verify_phase6_http.py`: explicitly invoked full-month live sync and real localhost HTTP verification using a disposable database/server.
- `tests/fixtures/api/{decision,comparison,evolution,accuracy-summary}.json`: captured live HTTP integration samples.
- `CONTRACTS.md`, `README.md`: API behavior, WAPE correction, usage and handoff guidance.
- `IMPLEMENTATION.md`: only Phase 6 newly checked; this verification record added.

No domain algorithm, repository interface, SQLite schema, ingestion behavior, dependency or lockfile was changed in Phase 6. Earlier staged Phase 5 changes were preserved.

## Public models, routes and service reuse

Every successful analytical response is constructed as an explicit Pydantic model by the response assembly service and validated/serialized by FastAPI. Nested models constrain hours, counts, nonnegative generation, finite signed errors, aware timestamps and directional percentages. WAPE is finite/nonnegative with no upper ceiling, or null for a zero denominator.

Routes contain only calls to the assembly service. Decision responses reuse decision_forecasts, january_accuracy and forecast_bands. Comparison responses reuse daily_comparison; accuracy responses reuse january_accuracy. Evolution retrieves all target vintages and calls the existing decision_forecasts and hourly_actuals services, so its selected vintage and derived actual use the same authoritative algorithms as comparisons. Post-cutoff vintages remain visible but unavailable at decision time.

Decision summary average/peak are presentation aggregates over the selected series, assembled in the service. Peak ties use the earliest target. Historical summary MAE/P90 are the existing overall January metrics; bands use the existing target-hour P90. Mixed per-target publications retain individual timestamps; the headline publication is the latest selected publication and its age is whole elapsed minutes, floored. A controlled test inserts an exactly-at-cutoff vintage and verifies both the changed headline and independent per-target selection.

Startup opens/initializes the configured database schema only. Import performs no database work. A request opens one connection and a read transaction for a consistent snapshot across its service queries. There is no automatic sync, scheduler or background worker.

## Contract reconciliation and errors

The noon examples in CONTRACTS.md were already corrected in Phase 4: hourly actual 8766.5 MW and signed error -987.5 MW. No stale value was reintroduced.

One field requires frontend reconciliation: metrics.wape_percent. The verified Phase 5 formula returns None for a zero actual denominator, and a relative error can exceed 100%. The previous frontend percentSchema permits neither null nor values above 100. CONTRACTS.md now explicitly defines a finite nonnegative number without a ceiling, or null. Tests cover null and a valid WAPE of 777800%; no clamping, Infinity or NaN is used. Other metric fields stay non-null on successful nonempty responses.

- 422: malformed/unsupported decision dates, missing/malformed/naive/numeric/off-hour targets and unsupported delivery dates; normal FastAPI detail validation response.
- 404, `{"detail":"No decision-time forecasts available"}`: no selected forecasts for a supported decision date.
- 404, `{"detail":"Historical error statistics unavailable"}`: no historical error data for any returned forecast hour. This preserves non-null band/summary fields without inventing values.
- 404, `{"detail":"No matched hourly data available"}`: comparison or accuracy has no matches.
- 404, `{"detail":"No forecast vintages available for target"}`: evolution target is absent.
- 404, `{"detail":"No decision-time forecast available for target"}`: only ineligible vintages exist for that target.
- 500, `{"detail":"Internal server error"}`: unexpected failure; database details/tracebacks remain in logs.

Partial decisions omit missing forecast hours and report forecast completeness, provided history is available for the hours returned. Partial comparisons omit unmatched hours and report matched completeness; metrics use only the matched points. Partial accuracy exposes the actual matched count/heatmap and observed hour groups for the fixed January period. Evolution actual_mw is null when the complete half-hour pair is unavailable, consistent with the existing frontend schema. Missing values are never replaced with zero.

## Exact verification commands and results

Run from backend/ unless noted. `rtk proxy` preserves the exact command output.

| Command | Result |
| --- | --- |
| `rtk proxy uv sync` | Exit 0; resolved 30 packages, checked 28 installed packages. Approval was needed for existing cache access. |
| `rtk proxy .venv/bin/ruff check` | Exit 0; all checks passed. |
| `rtk proxy .venv/bin/pytest` | Exit 0; **181 passed** (146 existing plus 35 new API/contract tests). |
| `rtk proxy .venv/bin/pytest tests/test_public_api.py -q` | Exit 0; **35 passed**. |
| `rtk proxy env PYTHONPATH=. uv run python tests/verify_phase6_http.py` | Exit 0; full live sync, real Uvicorn HTTP requests and response-model assertions passed. Requires network/localhost/cache permissions. |
| `rtk proxy git diff --cached --check -- backend` (repository root) | Exit 0; clean whitespace in staged backend changes. |

TDD: before implementation, the new API/OpenAPI tests produced 26 failures and 2 existing passing foundation checks. Failures were the expected absent routes/models. After implementation, the API tests passed; edge-case and recorded-response coverage expanded the final new test count to 35. Deterministic tests use isolated temporary SQLite databases; pytest does not call live Elexon.

Tests cover complete days, 744 controlled January points, January 31 → February 1, partial/missing forecasts and half-hours, missing hour-specific history, exact-cutoff eligibility, mixed selected publications, strict finite output, nullable/unbounded WAPE, normal validation responses, configured database startup and stable missing/internal errors. Every successful analytical test response is explicitly parsed through its declared Pydantic model. Recorded live responses are also validated independently in the regular test suite.

## Real HTTP verification

The live verifier invokes the existing `uv run python -m app.scripts.sync_january_2026` command with DATABASE_PATH pointing inside a TemporaryDirectory. It then starts `uv run uvicorn app.main:app --host 127.0.0.1 --port <ephemeral-port>` against that same database. HTTP responses are checked against their Pydantic models, their serialized JSON and the direct january_accuracy result. JSON serialization forbids nonfinite values. The server is terminated and the temporary database removed afterward.

Sync output:

```text
Sync 1: success; fuelhh_rows=1488; windfor_rows=18104; rejected_rows=0
```

| HTTP request | Observed result |
| --- | --- |
| `/api/v1/health` | 200 |
| `/api/v1/decisions/2026-01-15` | 200; cutoff 09:20Z, delivery Jan 16, selected publication 07:30Z, age 110 minutes, 24 forecast points, missing 0 |
| `/api/v1/accuracy` | 200; 744 matched points/heatmap items, 24 hour-of-day rows, missing 0 implied by all 744 targets matched |
| `/api/v1/comparisons/2026-01-15` | 200; 24 matched points, missing 0; corrected noon values below |
| `/api/v1/forecast-evolution?target_time=2026-01-16T12:00:00Z` | 200; 24 stored vintages spanning multiple publication days, 07:30 selected/available, 09:30 unavailable, actual 8766.5 MW |
| `/api/v1/decisions/2026-01-31` | 200; delivery Feb 1, 24 selected hourly points |
| `/openapi.json`, `/docs` | 200; health and all four analytical paths present, declared public response models visible |

Representative comparison item:

```json
{"start_time":"2026-01-16T12:00:00Z","hour":12,"forecast_mw":7779.0,"actual_mw":8766.5,"error_mw":-987.5,"absolute_error_mw":987.5}
```

Representative decision item:

```json
{"start_time":"2026-01-16T12:00:00Z","hour":12,"forecast_mw":7779.0,"publish_time":"2026-01-15T07:30:00Z","p90_abs_error_mw":3388.0,"lower_mw":4391.0,"upper_mw":11167.0}
```

Live decision summary: average forecast 7930.416666666667 MW, peak 10375 MW at 2026-01-16T21:00:00Z, historical MAE 2038.9126344086021 MW and historical P90 4097.9 MW.

Live `/accuracy` metrics agree with the direct service and the Phase 5 full-month verification:

| Metric | Value |
| --- | ---: |
| matched_points | 744 |
| MAE MW | 2038.9126344086021 |
| RMSE MW | 2504.758652899355 |
| Bias MW | 1747.8870967741937 |
| WAPE % | 18.069767278418126 |
| P90 absolute error MW | 4097.9 |
| Over-forecast % | 84.94623655913979 |
| Under-forecast % | 15.053763440860216 |

Full decision/comparison/evolution responses are saved in tests/fixtures/api/. Accuracy-summary.json contains the authoritative period/metrics, heatmap count, one labelled heatmap sample and all 24 hour-of-day rows. It is deliberately a summary, not a complete AccuracyResponse; the full 744-row response was validated over HTTP without committing it. No fixture values are used to produce API responses.

## Limitations and stop boundary

- The configured default backend/data database was not populated by verification. Use the explicit sync command to load it; an empty database returns the documented 404 responses.
- Historical P90 bands are retrospective January descriptive statistics, not formal probabilistic intervals or rolling historical calibration. Existing Phase 4 cutoff selection still prevents later forecast publications from affecting the selected decision forecast.
- This remains the January pilot. No expanded date/DST scope, cache, new infrastructure or analytical algorithm was added.
- Frontend/Zod changes, Docker/Compose/deployment work and Phase 7 were not performed.

Applied Context Mode for focused docs/results, CodeGraph before shared API/service inspection, Ponytail, Superpowers test-driven-development and verification-before-completion. Context Mode search/index remains unavailable because its installed better-sqlite3 module is missing; compact ctx_execute processing worked. No unexpected temporal/numeric failure required a systematic-debugging fix.

## Frontend Integration Handoff

Authoritative shapes below use `Date` = YYYY-MM-DD string, `Timestamp` = timezone-aware UTC ISO-8601 string, `Hour` = integer 0..23, `Count` = nonnegative integer, `MW` = finite nonnegative number, `Signed` = finite number and `Percent` = finite number 0..100. All listed keys are required. Arrays contain only observed points, in timestamp/hour order.

```text
Metrics = {mae_mw: MW, rmse_mw: MW, bias_mw: Signed,
  wape_percent: MW | null, p90_abs_error_mw: MW,
  over_forecast_percent: Percent, under_forecast_percent: Percent,
  matched_points: Count}

GET /api/v1/health
{status: "ok"}

GET /api/v1/decisions/{decision_date}
{decision_date: Date, delivery_date: Date, decision_cutoff: Timestamp,
 market_timezone: "Europe/London", market_reference: "EPEX SPOT GB DAA 1 (60')",
 selected_forecast_publish_time: Timestamp, forecast_age_minutes: Count,
 completeness: {expected_hours: Count, forecast_hours: Count, missing_hours: Count},
 summary: {average_forecast_mw: MW, peak_forecast_mw: MW, peak_start_time: Timestamp,
   historical_mae_mw: MW, historical_p90_abs_error_mw: MW},
 series: [{start_time: Timestamp, hour: Hour, forecast_mw: MW,
   publish_time: Timestamp, p90_abs_error_mw: MW, lower_mw: MW, upper_mw: MW}]}

GET /api/v1/accuracy
{period: {decision_date_from: Date, decision_date_to: Date,
   decision_cutoff_time: "09:20", market_timezone: "Europe/London"},
 metrics: Metrics,
 heatmap: [{decision_date: Date, delivery_date: Date, start_time: Timestamp,
   hour: Hour, forecast_mw: MW, actual_mw: MW, error_mw: Signed}],
 hour_of_day_error: [{hour: Hour, mae_mw: MW, p90_abs_error_mw: MW}]}

GET /api/v1/comparisons/{decision_date}
{decision_date: Date, delivery_date: Date, decision_cutoff: Timestamp,
 completeness: {expected_hours: Count, matched_hours: Count, missing_hours: Count},
 metrics: Metrics,
 series: [{start_time: Timestamp, hour: Hour, forecast_mw: MW, actual_mw: MW,
   error_mw: Signed, absolute_error_mw: MW}]}

GET /api/v1/forecast-evolution?target_time=<offset-aware ISO-8601>
{target_time: Timestamp, hour: Hour, decision_date: Date, decision_cutoff: Timestamp,
 actual_mw: MW | null, selected_publish_time: Timestamp,
 series: [{publish_time: Timestamp, forecast_mw: MW,
   is_available_at_decision: boolean, is_selected_at_decision: boolean}]}
```

Here MW describes the nonnegative numeric validator; wape_percent is measured in percent, not MW, and has no upper bound.

Compared against frontend/src/contracts/{common,decision,accuracy,comparison,evolution}.ts: keys and nesting match. The single structural validation difference is **AccuracyMetricsSchema.wape_percent**, shared by accuracy and comparison: replace percentSchema with `z.number().finite().nonnegative().nullable()`. All other existing frontend public field schemas accept these successful response shapes. Evolution actual_mw is already nullable. The frontend must handle the documented 404/422 responses and render nullable WAPE explicitly rather than treating it as zero.

Frontend fixtures may still contain illustrative metrics, P90 bands and stale noon actual/error examples. Reconcile those with the saved real responses: actual 8766.5, error -987.5, noon hour-specific P90 3388 and overall historical P90 4097.9. Backend values are authoritative. No frontend files were changed; Phase 7 remains untouched.
