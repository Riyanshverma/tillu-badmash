# Backend Architecture

## Overview

The backend is one small FastAPI service.

```text
Elexon
  │
  ├── FUELHH: 30-minute actuals
  │
  └── WINDFOR: hourly forecast vintages
  │
  ▼
httpx client
  │
  ▼
Pydantic upstream validation
  │
  ▼
normalization / ingestion
  │
  ▼
SQLite
  ├── wind_actuals_half_hourly
  └── wind_forecasts_hourly
  │
  ├── derive hourly actuals
  ├── select latest forecast <= 09:20 cutoff
  └── align by hourly start_time
  │
  ▼
domain analytics
  ├── MAE
  ├── RMSE
  ├── bias
  ├── WAPE
  ├── P90
  └── hour-of-day uncertainty
  │
  ▼
FastAPI public contracts
  │
  ▼
React + Zod
```

No microservices, queue, Redis, or external database are required.

---

# Layer responsibilities

## Elexon client

File:

```text
app/clients/elexon.py
```

Responsibilities:

- construct Elexon requests
- use safe timeouts
- bounded retry for transient failures
- deserialize JSON
- return raw data

Must not:

- select decision vintages
- aggregate actuals
- compute metrics
- know frontend response shapes

Use:

```text
httpx.AsyncClient
```

---

# Upstream Pydantic models

## FUELHH raw

Observed fields:

```text
dataset
publishTime
startTime
settlementDate
settlementPeriod
fuelType
generation
```

Validation:

```text
dataset == FUELHH
timezone-aware publishTime
timezone-aware startTime
settlementPeriod 1..48
generation >= 0
```

Only retain:

```text
fuelType == WIND
```

## WINDFOR raw

Observed fields:

```text
dataset
publishTime
startTime
generation
```

Do not require:

```text
settlementDate
settlementPeriod
```

Derive internally from `startTime` only where useful:

```text
target_date
target_hour
```

---

# SQLite schema

## `wind_actuals_half_hourly`

```sql
CREATE TABLE wind_actuals_half_hourly (
    start_time TEXT PRIMARY KEY,
    settlement_date TEXT NOT NULL,
    settlement_period INTEGER NOT NULL,
    generation_mw REAL NOT NULL,
    source_publish_time TEXT NOT NULL
);
```

Indexes:

```text
settlement_date
settlement_period
```

This table preserves FUELHH at its native half-hour resolution.

---

## `wind_forecasts_hourly`

```sql
CREATE TABLE wind_forecasts_hourly (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    publish_time TEXT NOT NULL,
    start_time TEXT NOT NULL,
    target_date TEXT NOT NULL,
    target_hour INTEGER NOT NULL,
    generation_mw REAL NOT NULL,
    UNIQUE (publish_time, start_time)
);
```

Indexes:

```text
(start_time, publish_time)
target_date
target_hour
publish_time
```

Do not create a synthetic settlement period for WINDFOR.

---

## `sync_runs`

```sql
CREATE TABLE sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    status TEXT NOT NULL,
    fuelhh_rows INTEGER NOT NULL DEFAULT 0,
    windfor_rows INTEGER NOT NULL DEFAULT 0,
    rejected_rows INTEGER NOT NULL DEFAULT 0,
    detail TEXT
);
```

No migration framework is required in v1.

Keep schema initialization deterministic in `schema.sql`.

---

# Ingestion

## FUELHH

Fetch WIND actuals covering delivery dates:

```text
2026-01-02 through 2026-02-01
```

A wider harmless range is acceptable if it simplifies ingestion.

Prefer query-level:

```text
fuelType=WIND
```

Normalize to `wind_actuals_half_hourly`.

Expected:

```text
48 rows/day
```

---

## WINDFOR

Use publication windows because raw WINDFOR requires:

```text
publishDateTimeFrom
publishDateTimeTo
```

Retrieve enough publication history to reconstruct all January purchase decisions.

For each record derive:

```text
target_date = date(start_time)
target_hour = hour(start_time)
```

Persist the raw hourly vintage.

Expected:

```text
8 vintages/day
73 target hours/vintage
```

Do not use `/forecast/generation/wind/latest/stream` as the historical source.

---

# Hourly actual derivation

The product comparison resolution is hourly because WINDFOR is hourly.

For forecast target:

```text
H:00
```

retrieve FUELHH actuals:

```text
H:00
H:30
```

and derive:

```text
hourly_actual_mw =
(actual_H00 + actual_H30) / 2
```

Example:

```text
12:00 actual = 8781
12:30 actual = 8752

hourly actual = 8766.5 MW
```

Never sum the values.

The averaging logic belongs in domain/service code or a clear repository query/view.

A third persisted hourly-actual table is not necessary for v1 unless profiling proves it useful.

---

# Decision-time forecast selection

Input:

```text
decision_date
```

Derived:

```text
cutoff = decision_date at 09:20 Europe/London
delivery_date = decision_date + 1 day
```

For each hourly target on the delivery date:

```text
select latest publish_time <= cutoff
```

Recommended SQL:

```sql
SELECT *
FROM (
    SELECT
        f.*,
        ROW_NUMBER() OVER (
            PARTITION BY start_time
            ORDER BY publish_time DESC
        ) AS rn
    FROM wind_forecasts_hourly f
    WHERE
        target_date = :delivery_date
        AND publish_time <= :cutoff_utc
)
WHERE rn = 1
ORDER BY start_time;
```

Expected complete day:

```text
24 forecast points
```

For January 2026 live data, the selected vintage is normally:

```text
07:30Z
```

because the next vintage:

```text
09:30Z
```

occurs after the 09:20 cutoff.

Do not encode:

```text
publish_time == 07:30
```

as the algorithm.

Encode:

```text
max(publish_time <= cutoff)
```

---

# Hourly comparison dataset

For each decision date:

1. select 24 decision-time forecasts
2. derive 24 hourly actuals
3. join on hourly `start_time`
4. compute:

```text
error_mw = forecast_mw - actual_mw
absolute_error_mw = abs(error_mw)
squared_error = error_mw ** 2
```

Expected full January size:

```text
31 × 24 = 744 matched points
```

Do not confuse this with the 1,488 raw FUELHH half-hour rows.

---

# Metrics

Implement pure numeric functions in:

```text
app/domain/metrics.py
```

Required:

- MAE MW
- RMSE MW
- bias MW
- WAPE %
- P90 absolute error MW
- over-forecast %
- under-forecast %
- matched point count

Use NumPy only where it improves clarity.

If:

```text
sum(abs(actual)) == 0
```

return:

```text
wape_percent = None
```

Never emit Infinity or NaN JSON values.

Empty matched input returns matched_points 0 and nullable metrics. Exact-zero errors count in the denominator but count as neither over- nor under-forecast, so those percentages can sum to less than 100%. P90 uses NumPy `percentile(..., 90, method="linear")` without intermediate rounding. Nonfinite generation or unrepresentable numeric results fail clearly rather than entering analytical output.

---

# Historical uncertainty

Compute P90 absolute error by:

```text
target hour 0..23
```

not by settlement period.

For hour H:

```text
P90(
    abs(error_mw)
    for all January matched points where hour == H
)
```

Attach the matching hour-of-day P90 value to every Decision series point.

Only hours with matched January history produce statistics. Missing hour history remains unknown (nullable internal band values), never a synthetic zero-width band. These are retrospective January historical-error statistics, not a calibrated probabilistic interval or a rolling as-of-decision estimate.

Band:

```text
lower_mw = max(0, forecast_mw - p90_abs_error_mw)
upper_mw = forecast_mw + p90_abs_error_mw
```

---

# Forecast evolution

Input:

```text
target_time
```

Query:

```text
all wind_forecasts_hourly where start_time == target_time
```

Sort ascending by:

```text
publish_time
```

Return:

- target time
- target hour
- cutoff
- actual hourly value if available
- every vintage
- `is_available_at_decision`
- `is_selected_at_decision`

Typical January sequence:

```text
02:30
04:30
07:30 selected
09:30 post-cutoff
12:25
15:30
18:30
22:30
```

---

# Public API

Base:

```text
/api/v1
```

Routes:

```text
GET /health
GET /decisions/{decision_date}
GET /accuracy
GET /comparisons/{decision_date}
GET /forecast-evolution?target_time=<ISO8601>
```

Handlers should:

```text
parse
→ call service
→ return Pydantic model
```

No domain logic in route handlers.

---

# Configuration

Use `pydantic-settings`.

Example:

```text
ELEXON_BASE_URL=https://data.elexon.co.uk/bmrs/api/v1
DATABASE_PATH=/app/data/wind.db
DECISION_TIME=09:20
MARKET_TIMEZONE=Europe/London
API_PREFIX=/api/v1
CORS_ORIGINS=...
```

Do not expose cutoff configuration in the frontend.

---

# Startup

Preferred:

```text
initialize schema
start API
```

Do not run a long Elexon sync every time the application imports.

Local sync:

```text
uv run python -m app.scripts.sync_january_2026
```

Server:

```text
uv run uvicorn app.main:app --reload
```

---

# Errors

## Elexon sync failure

- fail the sync clearly
- preserve existing valid database state
- record failure in `sync_runs`

## Missing comparison data

- never replace missing actual/forecast with zero
- report completeness
- omit unmatched analytical points where necessary

## Invalid decision date

Use request validation or stable 4xx behavior.

## Unexpected error

Return stable 500 response without internal traceback.

---

# Logging

Log:

- sync start/end
- request windows
- raw row counts
- validated row counts
- rejected rows
- decision selection completeness
- hourly aggregation completeness
- unexpected exceptions

Do not build a separate observability platform.

---

# Docker

Backend image:

```text
Python base
→ install uv
→ uv sync --frozen
→ copy application
→ run uvicorn
```

SQLite writable path:

```text
/app/data
```

Root Compose should mount a named volume there.
