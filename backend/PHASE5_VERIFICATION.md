# Phase 5 verification — 2026-10-23

Phase 5 is complete. Phase 6 remains untouched.

## Files created or modified

- `app/domain/comparison.py`: ComparisonPoint and timestamp-based match_hourly.
- `app/domain/metrics.py`: AccuracyMetrics and calculate_metrics.
- `app/domain/uncertainty.py`: hour-of-day statistics and historical P90 forecast bands.
- `app/services/accuracy_service.py`: daily_comparison and january_accuracy, plus internal result/completeness dataclasses.
- `tests/test_analytics.py`: 34 domain/numeric tests.
- `tests/test_accuracy_service.py`: 7 alignment/service/database tests.
- `README.md`, `ARCHITECTURE.md`: internal usage, percentile choice, missing-data semantics and historical-band interpretation.
- `IMPLEMENTATION.md`: only Phase 5 newly checked.
- This verification record.

Phase 4 functions/interfaces, repositories, schema, ingestion, settings, public models/contracts, API routes, dependencies and lockfile were not changed. No frontend files were modified.

## Comparison and completeness design

ComparisonPoint is an internal frozen dataclass with decision_date, aware UTC start_time, forecast_mw and actual_mw. Delivery date, target hour, signed error, absolute error and squared error are derived properties, so they cannot contradict the source values. It rejects naive/off-grid/wrong-delivery timestamps, nonfinite/negative generation and unrepresentable squared errors.

match_hourly aligns by the intersection of start_time keys, independently of input position, and returns ordered points. Duplicate targets fail rather than multiplying comparisons. Unmatched forecasts or actuals are excluded; missing values are never substituted with zero.

daily_comparison reuses Phase 4 decision_forecasts and hourly_actuals. Its completeness records expected_hours, forecast_hours, actual_hours, matched_hours and missing_hours (expected minus matched). Metrics use only matched points.

january_accuracy evaluates January 1–31 decision dates, including February 1 delivery. It concatenates matched points in decision/date/hour order and calculates overall metrics from those points. It does not average daily metrics. The series contains the decision_date, delivery_date, timestamp, target hour, forecast, actual and signed error needed by a future heatmap.

## Metric formulas and precision

For error = forecast − actual:

| Metric | Calculation |
| --- | --- |
| MAE MW | mean(abs(error)) |
| RMSE MW | sqrt(mean(error squared)) |
| Bias MW | mean(error), with sign preserved |
| WAPE % | sum(abs(error)) / sum(abs(actual)) × 100 |
| P90 MW | NumPy percentile(abs(error), 90, method="linear") |
| Over-forecast % | count(error > 0) / matched_points × 100 |
| Under-forecast % | count(error < 0) / matched_points × 100 |
| matched_points | actual matched-series length |

Exact-zero errors count in matched_points but in neither directional numerator. The percentages therefore need not sum to 100%.

Empty input returns matched_points 0 and nullable metrics. WAPE alone is None when all matched actuals sum to zero. Valid zero actuals remain in the dataset and other metrics. No intermediate rounding occurs. Outputs are native Python finite floats or None; invalid/overflowing calculations raise ValueError instead of emitting NaN or Infinity.

Hand calculation: errors -100, +200, -300 against actuals 1000 each yield MAE 200, RMSE 216.02468994692867, bias -66.66666666666667, WAPE 20%, linear P90 280, over 1/3 and under 2/3 of matched points. Small percentile fixtures verify [0, 10] → 9 and a singleton 50 → 50.

## Hour-of-day uncertainty

hour_of_day_statistics groups matched January points by UTC target hour 0–23, returning sorted observed groups with MAE, linear P90 absolute error and group matched_points. There are at most 24 groups. No FUELHH settlement-period grouping is used.

forecast_bands attaches the matching hour's P90 to each selected forecast:

- lower_mw = max(0, forecast_mw − P90)
- upper_mw = forecast_mw + P90

An hour without history has None for internal P90/lower/upper values, rather than an invented zero-width band. Duplicate/invalid statistics and nonfinite generation/results fail clearly. Unit examples verify 1000 ± 300 → [700, 1300] and 100 ± 300 → [0, 400].

These are retrospective descriptive statistics across all matched January decisions, as requested. They are not confidence intervals or an estimate calibrated using only data available before each decision. Phase 4 selection still excludes later forecast publications.

## Corrected noon anchor

The captured real Phase 4 half-hours remain 8781 MW at 12:00 and 8752 MW at 12:30 on January 16. The new analytical tests use:

```text
decision date = 2026-01-15
target = 2026-01-16T12:00:00Z
selected forecast = 7779 MW (07:30 publication)
hourly actual = 8766.5 MW
error = -987.5 MW
absolute error = 987.5 MW
squared error = 975156.25
```

Both the captured-data service regression and the full-month live evaluation confirm this anchor. No new analytical code/test treats the first half-hour as the hourly actual.

## Exact verification commands and results

Run from backend/:

| Command | Result |
| --- | --- |
| `rtk proxy uv sync` | Exit 0; resolved 30 packages, checked 28 installed packages. Sandbox approval was needed for existing cache access. |
| `rtk proxy .venv/bin/ruff check` | Exit 0; all checks passed. |
| `rtk proxy .venv/bin/pytest` | Exit 0; **146 passed**, including 105 existing and 41 new tests. |
| `rtk proxy .venv/bin/pytest tests/test_analytics.py tests/test_accuracy_service.py -q` | Exit 0; **41 passed**. |
| `rtk proxy git diff --check -- backend` (repository root) | Exit 0; clean whitespace. |

TDD: domain tests were observed failing before comparison/metric/uncertainty implementation, then passing. Service/alignment tests failed before their implementation. A failing no-history band test established the need to reject mutated nonfinite generation before returning an unknown band; that guard then passed. Numeric expectations were derived independently, not by comparing NumPy against itself.

Controlled temporary-SQLite verification covers:

- Corrected noon comparison and exact fractional error/square.
- 24 complete hours → 24 matches, with late vintages unable to affect metrics.
- Full January fixture → 744 matches, 24 hour groups and January 31 → February 1.
- Empty January → zero matches, 744 missing, nullable metrics and no hour groups.
- Partial January → 3 matches/741 missing, with point-weighted MAE 200 rather than the incorrect daily-average MAE 175.
- Separate forecast/actual/matched counts when data gaps occur in different hours.
- Zero actuals, zero total WAPE denominator, zero signed errors, singleton/interpolated P90, signed bias, clipped bands, unknown hour history and finite strict JSON output.
- Invalid generation, wrong timestamps, duplicate input/history and numeric overflow rejection.

Stale-value search (repository root):

```sh
rtk proxy rg -n '8781|-1002' backend/app/domain/comparison.py backend/app/domain/metrics.py backend/app/domain/uncertainty.py backend/app/services/accuracy_service.py backend/tests/test_analytics.py backend/tests/test_accuracy_service.py backend/README.md backend/ARCHITECTURE.md
```

Exit 0 with two valid hits: README identifies 8781/8752 as raw half-hours and explicitly preserves the old synthetic arithmetic fixture; architecture labels 8781 as the 12:00 half-hour. No new analytical code/tests contain either stale noon value.

## Full-month live evaluation

Performed using the existing command `uv run python -m app.scripts.sync_january_2026` with DATABASE_PATH overridden to a temporary database. It fetched 62 bounded daily windows, then evaluated January analytics and independently verified all metric values using standard-library math.fsum, math.sqrt, sorted-error linear interpolation and counts. No NumPy operations were used by that independent verifier.

Sync succeeded with zero rejected rows:

| Stored dataset | Rows |
| --- | ---: |
| Native half-hour FUELHH WIND actuals, Jan 2–Feb 1 | 1488 |
| All hourly WINDFOR vintages published Jan 1–31 | 18104 |

Observed live analytics:

| Result | Value |
| --- | ---: |
| Expected hours | 744 |
| Available forecast hours | 744 |
| Available actual hours | 744 |
| Matched points | 744 |
| Missing points | 0 |
| Hour-of-day groups | 24 |
| MAE MW | 2038.9126344086021 |
| RMSE MW | 2504.758652899355 |
| Bias MW | 1747.8870967741937 |
| WAPE % | 18.069767278418126 |
| P90 absolute error MW | 4097.9 |
| Over-forecast % | 84.94623655913979 |
| Under-forecast % | 15.053763440860216 |

The corrected noon anchor passed. All constructed January 15 bands had known history and nonnegative lower bounds. No frontend fixture values were changed to these measured metrics.

Exact Python code executed via `rtk proxy .venv/bin/python -c`; this equivalent heredoc reproduces it from backend/ (requires network/cache access):

```sh
rtk proxy .venv/bin/python - <<'PY'
import asyncio
import json
import math
import os
import subprocess
from dataclasses import asdict
from datetime import UTC, date, datetime
from pathlib import Path
from tempfile import TemporaryDirectory

from app.db.connection import connect_database
from app.services.accuracy_service import daily_comparison, january_accuracy
from app.services.decision_service import decision_forecasts
from app.domain.uncertainty import forecast_bands


async def verify(path):
    async with connect_database(path) as db:
        result = await january_accuracy(db)
        metrics = result.metrics
        assert result.completeness.expected_hours == 744
        assert 0 < metrics.matched_points <= 744
        errors = [p.forecast_mw - p.actual_mw for p in result.series]
        absolute = [abs(e) for e in errors]
        n = len(errors)
        denominator = math.fsum(p.actual_mw for p in result.series)
        independent = {
            "mae_mw": math.fsum(absolute) / n,
            "rmse_mw": math.sqrt(math.fsum(e * e for e in errors) / n),
            "bias_mw": math.fsum(errors) / n,
            "wape_percent": math.fsum(absolute) / denominator * 100,
            "over_forecast_percent": sum(e > 0 for e in errors) / n * 100,
            "under_forecast_percent": sum(e < 0 for e in errors) / n * 100,
        }
        ordered = sorted(absolute)
        index = 0.9 * (n - 1)
        lo, hi = math.floor(index), math.ceil(index)
        independent["p90_abs_error_mw"] = (
            ordered[lo] + (ordered[hi] - ordered[lo]) * (index - lo)
        )
        for key, value in independent.items():
            assert math.isclose(getattr(metrics, key), value, rel_tol=1e-12)
        daily = await daily_comparison(db, date(2026, 1, 15))
        anchor = next(p for p in daily.series
                      if p.start_time == datetime(2026, 1, 16, 12, tzinfo=UTC))
        assert (anchor.forecast_mw, anchor.actual_mw, anchor.error_mw) == (
            7779, 8766.5, -987.5
        )
        selected = await decision_forecasts(db, date(2026, 1, 15))
        bands = forecast_bands(selected.series, result.hour_of_day_error)
        assert len(result.hour_of_day_error) <= 24
        assert all(b.lower_mw is not None and b.lower_mw >= 0 for b in bands)
        counts = {}
        for table in ["wind_actuals_half_hourly", "wind_forecasts_hourly"]:
            counts[table] = (await db.execute_fetchall(
                f"SELECT COUNT(*) AS n FROM {table}"
            ))[0]["n"]
        run = dict((await db.execute_fetchall(
            "SELECT status, fuelhh_rows, windfor_rows, rejected_rows "
            "FROM sync_runs ORDER BY id DESC"
        ))[0])
        summary = {
            "stored_rows": counts, "sync_run": run,
            "completeness": {**asdict(result.completeness),
                             "missing_hours": result.completeness.missing_hours},
            "metrics": asdict(metrics),
            "hour_groups": len(result.hour_of_day_error),
            "noon": {"forecast_mw": anchor.forecast_mw,
                     "actual_mw": anchor.actual_mw, "error_mw": anchor.error_mw},
            "independent_metrics_verified": True,
            "nonnegative_band_lower_bounds": True,
        }
        print("LIVE_ANALYTICS", json.dumps(summary, allow_nan=False), flush=True)


with TemporaryDirectory(prefix="gridbricks-phase5-") as directory:
    path = Path(directory) / "wind.db"
    env = {**os.environ, "DATABASE_PATH": str(path)}
    print("Starting full January sync into a temporary database", flush=True)
    process = subprocess.run(
        ["uv", "run", "python", "-m", "app.scripts.sync_january_2026"],
        env=env, text=True, capture_output=True, timeout=300,
    )
    print("SYNC_EXIT", process.returncode, process.stdout.strip(), flush=True)
    if process.returncode:
        print(process.stderr[-6000:], flush=True)
        raise SystemExit(process.returncode)
    asyncio.run(verify(path))
PY
```

The sync command exited 0 and printed `Sync 1: success; fuelhh_rows=1488; windfor_rows=18104; rejected_rows=0`. Independent metric agreement used relative tolerance 1e-12. The temporary database was removed afterward; backend/data was not populated.

## Limitations and stop boundary

- Internal nullable empty metrics and unknown bands are preserved honestly; Phase 6 must map missing-data behavior to explicit public responses. No public fields/types were changed here.
- January hour-of-day history is descriptive and contains at most 31 matched observations per hour. No rolling calibration, confidence claims or forecasting model was added.
- Unrepresentable numeric calculations fail rather than returning nonfinite numbers.
- This remains the January pilot; no new DST-day aggregation scope was added.
- No analytical routes, frontend/Zod integration, Docker/Compose work or new infrastructure was implemented. Frontend and Docker runtime checks were not run.

Applied Ponytail, Context Mode, CodeGraph review of the Phase 4 boundaries, Superpowers test-driven-development and verification-before-completion. No unexpected numerical/SQL mismatch required a behavioral fix; lint diagnostics were line wrapping only. Phase 6 remains untouched.
