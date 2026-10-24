# Wind Procurement Intelligence

A focused tool for a UK electricity buyer to inspect the national wind forecast
available at the day-ahead purchase decision and understand how those forecasts
performed against actual generation.

## Why this exists

A forecast published after a purchasing deadline can make historical performance
look better than the information the buyer actually had. This application
reconstructs the decision-time forecast before measuring its accuracy.

## What the application shows

- **Decision:** choose a January 2026 decision date; inspect the selected forecast
  publication, forecast age, hourly delivery profile and historical P90 error band.
- **Accuracy:** review January metrics, hourly forecast-versus-actual comparisons,
  a 31 × 24 error heatmap and forecast evolution. Selecting a heatmap hour updates
  the comparison and evolution views.

## Key correctness rule

The pilot market reference is **EPEX SPOT GB DAA 1 (60')**. For decision date D:

```text
decision cutoff = D at 09:20 Europe/London
delivery date   = D + 1 day
selected forecast for each target = latest WINDFOR publishTime <= cutoff
```

January London time is GMT/UTC, but the backend constructs timezone-aware market
datetimes. The typical eligible January vintage is 07:30Z; this is observed data,
not the selection algorithm. A 09:30Z publication arrives ten minutes after the
09:20 cutoff and cannot be used for that decision. Evolution may display it,
explicitly marked unavailable at decision time.

## Architecture

```text
Elexon FUELHH ─┐
              ├─> explicit Python sync ─> SQLite named volume
Elexon WINDFOR┘                              │
                                            ▼
                        FastAPI selection, aggregation and analytics
                                            │
                                            ▼
                              React + TanStack Query + Zod
```

The backend uses Python 3.12, uv, FastAPI, Pydantic v2, httpx, aiosqlite and NumPy.
The frontend uses React, TypeScript, Vite, Zod, TanStack Query and Recharts.
Compose runs a FastAPI backend and an Nginx-served frontend. The browser calls the
backend; it never calls Elexon directly. Analytical routes delegate to services and
domain functions.

## Data sources

Only Elexon's public Insights API is used; **no API key is needed**.

| Dataset | Purpose | Native resolution |
| --- | --- | --- |
| FUELHH, fuelType=WIND | National wind actual generation | 30 minutes, 48 rows per January day |
| WINDFOR | Historical national wind forecast vintages | Hourly delivery targets |

Raw WINDFOR has dataset, publishTime, startTime and generation fields; it does not
have settlement dates or periods. All vintages are retained for reconstruction.
See [verified API research](docs/ELEXON_API_RESEARCH.md).

## Running locally with Docker

Prerequisite: Docker with Compose, and network access for image/package downloads
and the explicit Elexon data sync. Run from the repository root:

```bash
docker compose build
docker compose up -d --wait
```

The backend initializes an empty SQLite schema on startup. Health works before
data loading; analytical requests return explicit missing-data responses. The
frontend shows an error/retry state instead of fabricated or fixture data.

Ports bind to localhost. Defaults are BACKEND_PORT=8000 and FRONTEND_PORT=5173.
If a port is occupied, set the corresponding environment variable consistently
when building/starting Compose. CORS follows the configured localhost frontend
port. VITE_API_BASE_URL defaults to http://localhost:${BACKEND_PORT} and is embedded
at frontend **build time**; rebuild if that URL changes. The Docker-network URL
http://backend:8000 is for containers, not browser JavaScript.

## Loading January 2026 data

With the stack running, load the historical data explicitly:

```bash
docker compose exec backend uv run python -m app.scripts.sync_january_2026
```

The command fetches FUELHH actuals for January 2–February 1 and WINDFOR publication
history for January 1–31, in bounded daily windows. It records counts/status and
exits nonzero on failure. Re-running upserts the same natural keys safely. No full
sync runs on import, startup or HTTP requests. Refresh/retry the views after sync.

SQLite lives at /app/data/wind.db on the backend-data named volume. To stop and
restart without losing it:

```bash
docker compose down
docker compose up -d --wait
```

Do not use `docker compose down --volumes` unless you intend to delete the stored
history. A different Compose project name uses a separate volume.

## Application URLs

| View | Default URL |
| --- | --- |
| Decision | http://localhost:5173/ |
| Accuracy | http://localhost:5173/accuracy |
| API health | http://localhost:8000/api/v1/health |
| OpenAPI documentation | http://localhost:8000/docs |

## API endpoints

All endpoints use GET:

```text
/api/v1/health
/api/v1/decisions/{decision_date}
/api/v1/accuracy
/api/v1/comparisons/{decision_date}
/api/v1/forecast-evolution?target_time=<offset-aware ISO-8601>
```

Decision dates are January 1–31, 2026. Evolution targets are exact UTC delivery
hours from January 2 through February 1. Invalid/unsupported inputs return 422;
missing data returns documented 404 responses. Partial comparisons include only
matched hours and report completeness. Timestamps include explicit timezone
offsets, and numeric values are finite or explicitly nullable.

See [public contracts](backend/CONTRACTS.md) for response examples.

## Forecast / actual alignment

WINDFOR forecasts are hourly; FUELHH actuals are half-hourly. The backend derives:

```text
hourly actual MW = (H:00 actual MW + H:30 actual MW) / 2
```

MW values are averaged, not summed. Both half-hours must exist; an incomplete pair
does not become an actual. Selected forecasts and derived actuals are matched by
start_time, without filling missing values with zero. A complete delivery day has
24 matches; the full January decision pilot has at most 31 × 24 = 744.

Verified noon example: decision January 15, target January 16 at 12:00Z, selected
07:30Z forecast 7779 MW. FUELHH values 8781 MW at 12:00 and 8752 MW at 12:30 give
8766.5 MW hourly actual and **−987.5 MW error**, an under-forecast.

## Accuracy metrics

**error = forecast − actual**: positive means over-forecast, negative means
under-forecast. Metrics use matched hourly points only; calculations are not
rounded until presentation.

| Metric | Meaning / calculation |
| --- | --- |
| MAE, MW | Mean absolute error; typical absolute miss |
| RMSE, MW | Square root of mean squared error; gives larger misses more weight |
| Bias, MW | Mean signed error |
| WAPE, % | sum(abs(error)) / sum(abs(actual)) × 100; null if denominator is zero; may exceed 100% |
| P90 absolute error, MW | 90th percentile of absolute error, NumPy linear method |
| Over-/under-forecast, % | Share of matches with positive/negative error; exact-zero errors count in neither |

Historical bands use each target hour's January P90 absolute error:
`lower = max(0, forecast − P90)`, `upper = forecast + P90`. These are retrospective
descriptive error bands, **not probabilistic confidence intervals** or a rolling
calibration based only on observations available before each decision.

The verified January 2026 dataset produced 744 matches, zero missing hours, MAE
about 2039 MW, RMSE 2505 MW, bias +1747.9 MW, WAPE 18.1%, P90 4098 MW, over-forecast
84.9% and under-forecast 15.1%. These are observed dataset results, not business
constants or hard-coded product outputs.

## Build and static checks

For host-side checks, install Python 3.12 with uv and Node.js 22 with npm. From the
repository root, run each block separately:

```bash
cd backend
uv sync
uv run ruff check .
```

```bash
cd frontend
npm ci
npm run typecheck
npm run lint
npm run build
```

Automated test suites have been removed for the assessment submission. See
[CLEANUP_REPORT.md](CLEANUP_REPORT.md) for static checks and runtime smoke results;
[FINAL_AUDIT.md](FINAL_AUDIT.md) retains the earlier audit history.

## Project structure

```text
backend/app/       API, Elexon client, persistence, domain analytics and sync CLI
frontend/src/      Views, charts, API client and Zod contracts
docs/             Product context and verified Elexon research
compose.yaml      Two services and the persistent SQLite volume
```

The [backend architecture](backend/ARCHITECTURE.md) and
[frontend design](frontend/DESIGN.md) provide further detail.

## Important assumptions

- Elexon only; national wind only.
- January 2026 purchase-decision dates and the fixed 09:20 Europe/London pilot cutoff.
- The January 31 decision evaluates February 1 delivery.
- Forecast selection is cutoff-driven, independently for every hourly target.
- Historical P90 describes January errors, rather than a formal probability bound.

## Known limitations

The pilot covers one month, market reference and cutoff. It includes neither
demand nor wholesale prices, so it does not calculate exact thermal procurement
volumes. Historical data must be synchronized explicitly before analytics are
available. The current chart bundle triggers a non-blocking Vite size advisory;
no deployment or public-service scaling is claimed.

The evolution presentation findings in the historical final audit were fixed
before cleanup. Current browser smoke results are in [CLEANUP_REPORT.md](CLEANUP_REPORT.md).
