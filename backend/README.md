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

The image runs as a non-root user and reserves writable `/app/data` for SQLite. Its default `DATABASE_PATH` is `/app/data/wind.db`; omit `DATABASE_PATH` from a container env file to retain that default, or set it to the same absolute path. Database initialization and analytics are deferred to later phases.

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
