# Phase 7 verification — 2026-10-24

Phase 7 is complete. Container runtime verification passed. Browser UI verification was not performed because computer-use permission was unavailable; the user explicitly approved recording that limitation and completing Phase 7.

## Files created or modified

- `backend/Dockerfile`: runtime uv behavior, configurable Uvicorn port and HTTP healthcheck.
- `backend/.gitignore`: SQLite WAL/journal/shared-memory sidecar exclusions.
- `backend/README.md`: container startup, explicit sync, persistence and configuration workflow.
- Root `compose.yaml`: backend/frontend services, environment/build arguments and named SQLite volume.
- `frontend/Dockerfile`: minimal Vite API base URL build argument/environment wiring.
- `frontend/.dockerignore`: exclude local environment files and logs from the build context.
- `backend/IMPLEMENTATION.md`: only Phase 7 newly checked.
- This verification record.

No backend application/settings/domain/repository code, dependency or lockfile changed. No root README edit, new feature, infrastructure service or frontend React/Zod/product edit was made by the backend agent. Concurrent Antigravity frontend changes were preserved and included in the successful frontend image build.

## Final Docker design

The backend keeps Python 3.12 slim and the existing pinned uv 0.11.16 binary. It copies pyproject.toml/uv.lock, runs `uv sync --frozen --no-dev`, and copies only app/ into the application image. Tests, local environments, caches, documentation and developer databases are not copied. The runtime contains the app, locked production environment, project metadata and an empty writable data directory before a volume is mounted.

The existing non-root app user has UID 1000. `/app/data` is owned by that user; Docker's fresh named volume inherits the directory ownership. Runtime inspection confirmed non-root execution, writable data, DATABASE_PATH=/app/data/wind.db and absent pytest/Ruff packages. The image sets UV_NO_SYNC=1 so the required `uv run python -m ...` command uses the installed production environment instead of trying to install dev dependencies or update the root-owned virtual environment.

Uvicorn runs directly as the container process, bound to 0.0.0.0. UVICORN_PORT defaults to 8000 and can be overridden for standalone runtime. Compose deliberately uses internal port 8000 and separately configures the published host port. The standard-library health probe follows UVICORN_PORT and API_PREFIX. Final timing is interval 15 seconds, timeout 15 seconds, startup allowance 30 seconds, three retries and HTTP timeout 5 seconds.

The initial three-second process timeout falsely marked a running API unhealthy on the loaded local Docker Desktop VM. Docker health logs recorded probe process timeouts while direct API requests returned 200. Only healthcheck timing was changed; the final full Compose stop/start completed successfully with the backend healthy.

## Compose services and environment

| Item | Configuration |
| --- | --- |
| Backend build | backend/ |
| Backend binding | 127.0.0.1:${BACKEND_PORT:-8000} → container 8000 |
| Frontend build | frontend/, existing Node build → Nginx static runtime |
| Frontend binding | 127.0.0.1:${FRONTEND_PORT:-5173} → container 80 |
| Database | /app/data/wind.db |
| Named volume | backend-data mounted read/write at /app/data |
| Frontend ordering | backend service_healthy |
| API_PREFIX | /api/v1 |
| ELEXON_BASE_URL | https://data.elexon.co.uk/bmrs/api/v1 |
| LOG_LEVEL | environment-driven, defaults INFO |
| CORS_ORIGINS | JSON array containing http://localhost:${FRONTEND_PORT:-5173} |
| VITE_API_BASE_URL build argument | overrideable, defaults http://localhost:${BACKEND_PORT:-8000} |

There is no scheduler, automatic sync, extra proxy, database service or deployment machinery. The existing Nginx SPA fallback is retained. Local .env files are excluded from both build contexts. Gitignore checks confirmed generated databases/sidecars, local environments, Python/Node environments and frontend build output are ignored, while uv.lock, pyproject.toml, package-lock.json, .env.example, schema.sql and data/.gitkeep remain committable.

## Explicit sync workflow

Normal workflow from repository root:

```sh
docker compose build
docker compose up -d --wait
docker compose exec backend uv run python -m app.scripts.sync_january_2026
```

Health works immediately on the empty database. Startup initializes the schema only. Before explicit sync all four analytical endpoints returned the established JSON 404 responses; no fake zero data was returned. The sync command remains the only Elexon ingestion trigger. After sync all analytical endpoints returned 200 with real January results.

`docker compose down` preserves the named volume. Subsequent `up` reuses it and does not sync again. `down --volumes` explicitly deletes data and was **not** executed. Container sync wrote to that named volume; no generated SQLite file was added to Git. A separate ignored backend/data/wind.db was present at final review and was left untouched; it was not used for container verification.

## Exact commands and results

The verification project was named `gridbricks-phase7` to isolate its containers and volume. Antigravity's existing Vite development server occupied port 5173, so the final container checks used FRONTEND_PORT=5174. Default Compose configuration was also validated successfully. `rtk proxy` prefixes below preserve exact CLI output.

From backend/:

| Command | Result |
| --- | --- |
| `rtk proxy uv sync` | Exit 0; resolved 30 packages, checked 28 installed packages. Cache access required sandbox approval. |
| `rtk proxy .venv/bin/ruff check` | Exit 0; all checks passed. |
| `rtk proxy .venv/bin/pytest -q` | Exit 0; **181 passed**. No Docker-internal unit tests added. |

From repository root:

| Command | Result |
| --- | --- |
| `rtk proxy docker compose config --format json` | Exit 0; two services, localhost ports, correct CORS/build URL and named volume. |
| `rtk proxy docker compose -p gridbricks-phase7 build` | Exit 0; both final image designs built successfully. |
| `rtk proxy docker compose -p gridbricks-phase7 up -d --wait --build backend` | Exit 0; fresh isolated backend/volume started healthy. |
| `rtk proxy docker compose -p gridbricks-phase7 exec -T backend uv run python -m app.scripts.sync_january_2026` | Exit 0; explicit sync succeeded as the non-root runtime user. |
| `rtk proxy env FRONTEND_PORT=5174 docker compose -p gridbricks-phase7 config --quiet` | Exit 0. |
| `rtk proxy env FRONTEND_PORT=5174 docker compose -p gridbricks-phase7 up -d --wait --no-build` | Exit 0; both services running after final image build. |
| `rtk proxy env FRONTEND_PORT=5174 docker compose -p gridbricks-phase7 down` | Exit 0; both containers/network removed, named volume retained. |
| `rtk proxy env FRONTEND_PORT=5174 docker compose -p gridbricks-phase7 up -d --wait --no-build` | Exit 0; both services available again without sync. |
| `rtk proxy git diff --check` and `rtk proxy git diff --cached --check` | Exit 0; clean whitespace. |

Read-only verification additionally used Python urllib HTTP requests, docker inspect, Compose logs/ps and sqlite3 queries inside the backend container. The frontend-container DNS check ran `docker compose -p gridbricks-phase7 exec -T frontend wget -qO- http://backend:8000/api/v1/health` through Context Mode; exit 0, response `{"status":"ok"}`.

Initial failures were investigated and are not reported as passing: sandbox Docker cache/socket access required approval; the first frontend build hit an in-progress Antigravity nullable-WAPE TypeScript update, then a later build passed after its changes; the original health timeout was too aggressive; and starting the frontend on occupied port 5173 failed until the test port was set to 5174. No frontend product patch or bypass of TypeScript checking was made by the backend agent.

## API runtime and persistence results

Before sync:

| Request | Status and response |
| --- | --- |
| /api/v1/health | 200, {status: ok} |
| /api/v1/decisions/2026-01-15 | 404, No decision-time forecasts available |
| /api/v1/accuracy | 404, No matched hourly data available |
| /api/v1/comparisons/2026-01-15 | 404, No matched hourly data available |
| /api/v1/forecast-evolution?target_time=2026-01-16T12:00:00Z | 404, No forecast vintages available for target |

Explicit sync output:

```text
Sync 1: success; fuelhh_rows=1488; windfor_rows=18104; rejected_rows=0
```

After sync, and again after the final two-service down/up cycle:

- Health and all four analytical endpoints returned 200.
- Decision series length 24; comparison series length 24 and completeness 24 expected / 24 matched / 0 missing.
- Accuracy matched_points and heatmap length 744; hour-of-day statistic rows 24.
- January 15 cutoff 09:20Z; selected publication 07:30Z, derived rather than hard-coded.
- Noon target 2026-01-16T12:00:00Z: forecast 7779 MW, actual 8766.5 MW, error -987.5 MW and absolute error 987.5 MW.
- Evolution selects 07:30 and marks it available; 09:30 remains visible and unavailable at decision time.
- January 31 decision delivers February 1 with 24 forecast points.
- JSON parsing rejected nonfinite constants; none were present.

Live accuracy metrics remained:

| Metric | Value |
| --- | ---: |
| MAE MW | 2038.9126344086021 |
| RMSE MW | 2504.758652899355 |
| Bias MW | 1747.8870967741937 |
| WAPE % | 18.069767278418126 |
| P90 absolute error MW | 4097.9 |
| Over-forecast % | 84.94623655913979 |
| Under-forecast % | 15.053763440860216 |

The retained volume is `gridbricks-phase7_backend-data`, mounted read/write at /app/data. After container removal/recreation, SQLite still contained 1488 actual rows, 18104 forecast rows and **exactly one** sync_runs row with status success. No second sync was performed. This confirms both persistence and preservation of explicit ingestion behavior.

## CORS and frontend request verification

Before the port override, an OPTIONS request from http://localhost:5173 returned 200 with that exact Access-Control-Allow-Origin; https://unlisted.example returned 400 with no allow-origin header. After setting FRONTEND_PORT=5174, actual GET requests to health and every analytical endpoint sent Origin: http://localhost:5174 and received that exact allow-origin header with 200 responses.

The containerized frontend at http://localhost:5174 returned 200 from Nginx, its compiled JavaScript asset returned 200 and contained http://localhost:8000, and direct /accuracy navigation returned the SPA HTML with 200. The frontend container resolved backend and fetched its health endpoint successfully. The existing Vite development server on port 5173 was not stopped or changed.

Browser UI verification was attempted using the provided computer-use tool. No browser surfaces were connected, and native Chrome inspection returned **Computer Use permissions are not granted**. Accordingly no browser rendering, DevTools console/network or browser-enforced CORS claim is made. HTTP origin/preflight checks, compiled URL verification and container networking passed independently.

## Limitations and scope

- Browser UI verification remains the only unperformed integration check, due to the computer-use permission gate described above. The user explicitly approved completing Phase 7 with this limitation recorded.
- Only the local Docker Desktop platform was built/run; no deployment, cross-platform image matrix or load testing was performed.
- The frontend build emitted existing dependency audit findings (four moderate, two critical), Zod annotation warnings and a large-bundle warning. Dependency upgrades and frontend product optimization are outside this backend phase; neither lockfile was changed.
- The populated verification database is in the isolated project's named volume, not backend/data or the default Compose project's separate volume. The verification stack is left running for review. Do not use down --volumes unless deliberately deleting that test history.
- No new product features, analytical calculations or public contract changes were added. No root README or frontend product source was edited by the backend agent.

## Frontend Integration Notes

- Build-time variable: VITE_API_BASE_URL, passed as a frontend Docker build argument. Default browser URL is http://localhost:8000; do not append /api/v1 because the existing API client appends endpoint paths.
- Browser frontend URL: http://localhost:5173 by default; the isolated verification stack uses **http://localhost:5174** to avoid the running Vite server.
- Browser API URL: **http://localhost:8000** for both configurations.
- Container API URL: **http://backend:8000**, resolvable only on the Compose network. Do not embed this hostname into browser JavaScript.
- Backend CORS origin: http://localhost:${FRONTEND_PORT}; it was verified with 5173 and 5174 and remains an exact allowlist, without wildcards.
- Changing FRONTEND_PORT updates published frontend port and CORS; changing BACKEND_PORT updates the published backend port and the default frontend build argument. Rebuild the frontend after changing its API base URL. Backend standalone internal port is controlled by UVICORN_PORT; Compose uses internal 8000.
- Default service workflow: build → up → explicit `docker compose exec backend uv run python -m app.scripts.sync_january_2026`. Empty analytics return 404 until that sync finishes.
- Existing verification stack management: `FRONTEND_PORT=5174 docker compose -p gridbricks-phase7 up -d --wait --no-build`; stop with the same environment/project flags and `down`, without --volumes. Its project-specific history survives restart.
- Antigravity retains ownership of React/Zod/API integration changes. The backend agent changed only frontend Docker build-argument wiring and build-context exclusions.
