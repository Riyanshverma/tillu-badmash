# Backend Implementation Plan

## Execution rule

Work one phase at a time.

For the active phase:

1. read the phase
2. inspect existing code
3. use the relevant Superpowers skill
4. implement only the active phase
5. verify
6. mark only that phase complete
7. stop for user review

Do not automatically start the next phase.

---

## [x] Phase 0 — Research and contract reconciliation

### Goal

Ensure every backend assumption matches the completed live Elexon research.

### Research status

Live API research is complete.

Read:

```text
../docs/ELEXON_API_RESEARCH.md
```

Confirmed facts:

```text
FUELHH = 48 half-hour rows/day
WINDFOR = hourly
WINDFOR raw fields = dataset, publishTime, startTime, generation
WINDFOR has no settlementDate/settlementPeriod
decision cutoff = 09:20 Europe/London
selected January vintage normally = 07:30Z
comparison resolution = hourly
24 comparison points/day
31 × 24 = 744 maximum January matched points
```

### Tasks

- reconcile `ARCHITECTURE.md`
- reconcile `CONTRACTS.md`
- verify sample JSON files exist
- confirm no backend plan requires raw WINDFOR settlement fields
- confirm no analytical plan assumes 48 forecast points/day

### Verify

Search the backend planning/docs for stale assumptions such as:

```text
08:30 selected vintage
48 forecast periods
WINDFOR settlementPeriod
1488 matched forecast points
```

No stale analytical assumption should remain.

### Stop condition

Mark Phase 0 complete and stop.

---

## [x] Phase 1 — uv/FastAPI foundation

### Goal

Create a minimal production-shaped backend.

### Tasks

- initialize with `uv`
- configure project metadata
- add:
  - FastAPI
  - Pydantic v2
  - pydantic-settings
  - httpx
  - aiosqlite
  - NumPy
  - pytest
  - pytest-asyncio
  - Ruff
- implement:
  - settings
  - FastAPI app
  - API router
  - health route
  - logging
  - configured CORS
- add `.env.example`
- create backend Dockerfile

### Verify

```text
uv sync
ruff check
pytest
FastAPI boots
GET /api/v1/health -> 200
Docker image builds
```

### Stop condition

Mark Phase 1 complete and stop.

---

## [x] Phase 2 — SQLite schema and repositories

### Goal

Persist native-resolution Elexon data cleanly.

### Tasks

Create:

```text
wind_actuals_half_hourly
wind_forecasts_hourly
sync_runs
```

Implement repositories for:

- FUELHH half-hour actuals
- WINDFOR hourly vintages
- sync runs

Add deterministic upsert/deduplication.

Do not implement decision selection or metrics yet.

### Tests

Prove:

- schema initializes
- duplicate forecast `(publish_time, start_time)` does not duplicate
- actual `start_time` upsert is deterministic
- generation zero is preserved
- FUELHH date query ordering is stable
- forecast query ordering is stable
- target hour 0..23 is derived correctly from `start_time`

### Stop condition

Mark Phase 2 complete and stop.

---

## [x] Phase 3 — Elexon client and ingestion

### Goal

Fetch and normalize historical January data safely.

### Tasks

- implement raw Pydantic models exactly from research
- implement async Elexon client
- implement bounded request chunks
- fetch FUELHH with `fuelType=WIND`
- normalize/store half-hour actuals
- fetch WINDFOR with publication datetime windows
- normalize/store hourly forecast vintages
- derive:
  - `target_date`
  - `target_hour`
- implement sync-run accounting
- create:

```text
uv run python -m app.scripts.sync_january_2026
```

Data coverage must support:

```text
decision dates: Jan 1–31
delivery dates: Jan 2–Feb 1
```

### Verify

- FUELHH rows are present
- WINDFOR rows are present
- FUELHH native resolution is 30 min
- WINDFOR target resolution is hourly
- one target has multiple forecast vintages
- no duplicated `(publish_time, start_time)`
- rerunning sync is idempotent
- Jan 31 forecasts cover Feb 1

### Stop condition

Mark Phase 3 complete and stop.

---

## [ ] Phase 4 — Hourly actual aggregation + decision-time selection

### Goal

Implement the core temporal correctness logic.

### Part A — hourly actual aggregation

For target hour H:

```text
hourly_actual =
(FUELHH H:00 + FUELHH H:30) / 2
```

Required tests:

- known pair averages correctly
- zero values are preserved
- missing one half-hour does not silently produce a misleading value
- output start time is exactly H:00
- 48 complete half-hours produce 24 hourly actuals

### Part B — decision forecast selection

For each target on delivery day:

```text
selected =
max(publish_time)
where publish_time <= decision cutoff
```

Required test fixture:

```text
02:30 -> 9020
04:30 -> 7903
07:30 -> 7779
09:30 -> 7802
cutoff = 09:20

selected = 7779
```

Also test:

- exactly-at-cutoff publication
- no pre-cutoff forecast
- later publication never leaks in
- Jan 31 -> Feb 1
- timezone-aware cutoff
- unordered forecast rows

### Live/manual verification

For:

```text
decision date = 2026-01-15
target = 2026-01-16T12:00:00Z
```

verify:

```text
selected publish = 07:30Z
selected forecast = 7779 MW
```

### Stop condition

Mark Phase 4 complete and stop.

---

## [ ] Phase 5 — Accuracy and uncertainty analytics

### Goal

Calculate metrics from hourly matched data.

### Tasks

Build matched hourly rows:

```text
start_time
hour
forecast_mw
actual_mw
error_mw
absolute_error_mw
```

Implement:

- MAE
- RMSE
- bias
- WAPE
- P90 absolute error
- over-forecast %
- under-forecast %
- per-hour-of-day MAE
- per-hour-of-day P90
- uncertainty bands

### Required tests

- hand-calculated fixture
- positive and negative bias
- zero actual values
- WAPE zero denominator
- percentile behavior
- missing point
- no NaN/Infinity
- 24 complete points/day
- 744 maximum complete January points

### Verify

Compare fixture output to independent hand calculation.

### Stop condition

Mark Phase 5 complete and stop.

---

## [ ] Phase 6 — Public API contracts

### Goal

Expose frontend-ready hourly responses.

### Implement

```text
GET /api/v1/decisions/{decision_date}
GET /api/v1/accuracy
GET /api/v1/comparisons/{decision_date}
GET /api/v1/forecast-evolution?target_time=
```

Pydantic responses must match:

```text
CONTRACTS.md
```

### Tests

Cover:

- valid decision response
- 24-hour completeness
- unsupported decision date
- invalid target timestamp
- incomplete data behavior
- error sign
- JSON serialization
- no NaN/Infinity
- forecast evolution marks 07:30 selected for the representative Jan 15 fixture
- 09:30 evolution point is not available at decision time

### Verify

- OpenAPI renders
- response tests match contracts
- frontend fixtures can be validated against actual API responses

### Stop condition

Mark Phase 6 complete and stop.

---

## [ ] Phase 7 — Docker and integration hardening

### Goal

Run the backend consistently in containers.

### Tasks

- finalize Dockerfile
- keep `/app/data` writable
- coordinate root `compose.yaml`
- mount named SQLite volume
- document/run sync inside container
- verify CORS with frontend
- verify production command

Do not change root README yet.

### Verify

```text
docker compose build
docker compose up
health endpoint works
sync command works
SQLite survives restart
frontend can call backend
ruff check
pytest
```

### Stop condition

Mark Phase 7 complete and stop.
