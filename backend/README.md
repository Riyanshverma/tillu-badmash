# Backend

## Purpose

FastAPI backend for reconstructing decision-time Elexon wind forecasts, storing normalized January 2026 data in SQLite, calculating forecast accuracy, and exposing stable API contracts to the React frontend.

Read first:

- [`../docs/PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md)
- [`../docs/ELEXON_API_RESEARCH.md`](../docs/ELEXON_API_RESEARCH.md)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md)
- [`CONTRACTS.md`](./CONTRACTS.md)
- [`IMPLEMENTATION.md`](./IMPLEMENTATION.md)
- [`AGENTS.md`](./AGENTS.md)

---

## Stack

- Python
- uv
- FastAPI
- Pydantic v2
- pydantic-settings
- httpx
- aiosqlite
- NumPy
- pytest
- pytest-asyncio
- Ruff
- Docker

Use `uv` for environment and dependency management.

Do not introduce a heavy ORM unless implementation evidence shows direct SQL with `aiosqlite` has become harder to maintain.

## Local development

Run from `backend/`:

```sh
uv sync
cp .env.example .env
uv run uvicorn app.main:app --reload
```

Health: `GET http://127.0.0.1:8000/api/v1/health` returns `{"status":"ok"}`.

Settings load from environment variables and the local `.env` file; environment variables take precedence. `CORS_ORIGINS` is a JSON array of allowed origins, for example `["http://localhost:5173"]`. The default is an empty list. `API_PREFIX` defaults to `/api/v1`; `LOG_LEVEL` defaults to `INFO`.

Checks:

```sh
uv run ruff check
uv run pytest
```

Container:

```sh
docker build -t gridbricks-backend:phase1 .
docker run --rm -p 8000:8000 --env-file .env gridbricks-backend:phase1
```

The image runs as a non-root user and reserves writable `/app/data` for SQLite. Its default `DATABASE_PATH` is `/app/data/wind.db`; omit `DATABASE_PATH` from a container env file to retain that default, or set it to the same absolute path. The sync command below initializes the database explicitly; analytical HTTP routes remain later-phase work.

## January data sync

Run explicitly from `backend/`; FastAPI startup does not fetch data:

```sh
uv run python -m app.scripts.sync_january_2026
```

The command initializes the configured SQLite database and requests daily FUELHH WIND windows for January 2–February 1, plus daily WINDFOR publication windows for January 1–31. It preserves native half-hour actuals and all hourly forecast vintages. Re-running uses the existing unique keys for upserts.

HTTP requests have 10-second connection and 30-second read timeouts. Transient HTTP 429/500/502/503/504 and timeout/network errors have at most three attempts, with 0.5- and 1-second retry delays. Other HTTP errors, malformed JSON and unexpected response shapes fail immediately.

Invalid required rows are counted and logged; any rejection fails the run. Valid non-WIND rows are filtered. Empty arrays are valid: a successful sync records processed rows, not a guarantee of complete period coverage. Inspect the logged counts and `sync_runs` metadata.

The pilot stages validated records in memory, then commits data and successful sync metadata in one transaction. Failed runs preserve existing dataset rows and record failure metadata separately, with zero committed row counts. Successful counts represent processed records, including upserts, rather than newly inserted rows. Ingestion remains separate from the temporal and analytical helpers below.

## Temporal derivation

Internal helpers in `app/services/decision_service.py` operate on an existing database connection:

- `hourly_actuals(connection, target_date)` returns complete hourly means and explicit missing hour starts. Both H:00 and H:30 are required; zeros are valid. No derived table is stored.
- `decision_forecasts(connection, decision_date)` builds the fixed 09:20 Europe/London cutoff and next-day delivery date, then selects the latest eligible publication independently per target. Later vintages remain stored but are not selected.

Both results expose expected, available and missing hour counts. These are internal January-pilot results, not public API responses or accuracy metrics.

The January 16 noon live FUELHH pair is 8781/8752 MW, yielding 8766.5 MW. The selected January 15 forecast remains 7779 MW published at 07:30Z. See `PHASE4_VERIFICATION.md` for the correction to earlier example values and live boundary checks. The 8600/8962 → 8781 arithmetic fixture remains in the unit tests.

## Internal accuracy and uncertainty analytics

`app/services/accuracy_service.py` reuses the temporal helpers:

- `daily_comparison(connection, decision_date)` aligns complete hourly actuals with selected forecasts by timestamp, returning matched points, metrics and separate forecast/actual/matched completeness counts.
- `january_accuracy(connection)` evaluates January 1–31 purchase decisions, including February 1 delivery. It calculates overall metrics from all matched rows and returns hour-of-day statistics and heatmap-ready point metadata.

Comparison errors are forecast minus actual. The corrected noon anchor is 7779 − 8766.5 = -987.5 MW, with absolute error 987.5 and squared error 975156.25.

Pure domain functions calculate MAE, RMSE, signed bias, WAPE, linear-method P90 and over/under percentages without rounding. Zero errors count as neither over nor under. Empty matches produce nullable metrics with matched_points 0; WAPE is None when total actual generation is zero. Invalid or overflowing numeric results fail rather than emit NaN/Infinity.

`forecast_bands(selected_forecasts, hour_statistics)` in `app/domain/uncertainty.py` attaches each target hour's historical P90, with lower bound clipped to zero. An hour without history has unknown band values. These are retrospective January historical error bands, not confidence intervals.

## Public API (Phase 6)

Run `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000` from backend/.
The configured SQLite schema initializes on startup; loading data still requires
the explicit January sync command. No Elexon request runs on startup or an API request.

- `GET /api/v1/health`
- `GET /api/v1/decisions/2026-01-15`
- `GET /api/v1/accuracy`
- `GET /api/v1/comparisons/2026-01-15`
- `GET /api/v1/forecast-evolution?target_time=2026-01-16T12:00:00Z`

`/docs` and `/openapi.json` describe the Pydantic response models in
`app/models/api.py`. Thin routes call `app/services/api_service.py`, which assembles
existing Phase 4/5 results. Each request uses a consistent SQLite read snapshot.
See CONTRACTS.md for 404 missing-data and 422 invalid-input behavior. Partial
comparisons retain explicit completeness; missing actuals are never zero-filled.
WAPE is nonnegative, unbounded above, and nullable for a zero actual denominator.

`tests/fixtures/api/` contains captured real HTTP responses; accuracy is an explicitly
labelled summary rather than the full 744-row payload. To repeat live verification
using a disposable database and localhost server:

```sh
PYTHONPATH=. uv run python tests/verify_phase6_http.py
```

This explicitly invoked verifier requires Elexon network access. The regular pytest
suite uses temporary databases and controlled/captured fixtures without live access.

---

## Directory structure

Target:

```text
backend/
├── app/
│   ├── api/
│   │   ├── dependencies.py
│   │   ├── routes/
│   │   │   ├── health.py
│   │   │   ├── decisions.py
│   │   │   ├── accuracy.py
│   │   │   ├── comparisons.py
│   │   │   └── evolution.py
│   │   └── router.py
│   ├── clients/
│   │   └── elexon.py
│   ├── core/
│   │   ├── config.py
│   │   └── logging.py
│   ├── db/
│   │   ├── connection.py
│   │   ├── schema.sql
│   │   └── repositories/
│   │       ├── actuals.py
│   │       └── forecasts.py
│   ├── domain/
│   │   ├── decision.py
│   │   ├── metrics.py
│   │   └── uncertainty.py
│   ├── models/
│   │   ├── upstream.py
│   │   └── api.py
│   ├── services/
│   │   ├── ingestion.py
│   │   ├── decision_service.py
│   │   └── accuracy_service.py
│   ├── scripts/
│   │   └── sync_january_2026.py
│   └── main.py
├── data/
│   └── .gitkeep
├── tests/
│   ├── fixtures/
│   ├── unit/
│   ├── integration/
│   └── conftest.py
├── .env.example
├── Dockerfile
├── pyproject.toml
├── uv.lock
├── ARCHITECTURE.md
├── CONTRACTS.md
├── IMPLEMENTATION.md
├── AGENTS.md
└── README.md
```

---

## Core business rule

Decision cutoff:

```text
09:20 Europe/London on decision day D
```

Delivery day:

```text
D + 1 day
```

Forecast selection:

```text
for each delivery start_time:
    choose max(publish_time)
    where publish_time <= decision_cutoff
```

Never choose a later forecast.

---

## SQLite role

SQLite is a normalized historical read store and local cache.

Tables:

- `wind_actuals_half_hourly`
- `wind_forecasts_hourly`
- `sync_runs`

The backend must be able to rebuild the database from Elexon.

Do not require a separate database server.

Docker Compose should persist the local database through a named volume.

---

## What is out of scope

Do not add:

- Postgres
- Redis
- Celery
- message queues
- Kubernetes
- user/auth tables
- prices
- weather
- demand
- optimization
- trading execution
- LLM endpoints
- generic event architecture

---

## Docker

Backend Dockerfile must:

- use uv
- install locked dependencies
- run FastAPI with an explicit host/port
- keep SQLite in a writable `/app/data` path

The root compose file is the integration layer and may mount a named volume at the backend data directory.

---

## Quality rules

- Pydantic validates all upstream and public payloads.
- Timezone-aware datetimes only.
- Core decision/metrics logic must be pure enough to unit test.
- API handlers should be thin.
- Elexon client should not contain business rules.
- Database repositories should not calculate metrics.
- Services orchestrate dependencies.
- Never silently drop data errors that could change metrics.
