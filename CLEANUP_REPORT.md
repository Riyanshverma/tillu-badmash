# Repository cleanup

## Removed tests

Backend:
- Entire `backend/tests/`: 17 files covering unit/API/repository/ingestion/metrics checks, fixtures and the phase HTTP verifier.
- pytest configuration in `pyproject.toml`.

Frontend:
- Entire `frontend/src/test/`: 13 files covering Vitest/Testing Library checks, fixtures, setup and query wrappers.
- `npm test`, Vitest Vite configuration and six test-only DOM attributes.
- No new tests or permanent smoke-test scripts were added.

## Removed dependencies

- Backend: `pytest`, `pytest-asyncio`.
- Frontend test tooling: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
- Unused frontend styling: `class-variance-authority`, `clsx`, `tailwind-merge`.
- Both lockfiles updated: backend 30 → 23 packages; frontend 446 → 335 lock entries. Retained package versions are unchanged.

## Removed over-engineering

- Folded the single-use `Providers` component and query-client module into `App`, preserving the error boundary and cache settings.
- Replaced query-key factory functions with the same arrays at their four use sites.
- Deleted unused `cn` styling helper and its dependency chain.
- Removed unused frontend `getHealth` and its schema/type; the backend health endpoint remains.
- Removed unused forecast repository `for_date`; cutoff selection and target evolution queries remain.
- Removed unused `DECISION_TIME`/`MARKET_TIMEZONE` settings and example env entries. The existing domain logic still fixes 09:20 Europe/London.
- CodeGraph was consulted before production simplification, with focused searches where its results omitted symbols. Context Mode was attempted but failed to load `better-sqlite3`; focused local inspection was used instead.

## Removed internal workflow files

- Backend `PHASE0`–`PHASE7` verification records.
- Frontend `PHASE2`–`PHASE5` verification records and `FINAL_BLOCKER_FIX_VERIFICATION.md`.
- Both `IMPLEMENTATION.md` plans and backend/frontend `AGENTS.md` files.
- `docs/PARALLEL_EXECUTION.md`.
- Total: 18 workflow documents. Retained useful docs have stale deleted-file references corrected; `FINAL_AUDIT.md` is explicitly historical.

## Kept intentionally

- FastAPI routes, services/domain functions, direct SQLite repositories, schema, Elexon client and explicit January ingestion command.
- Pydantic, Zod, `fetchAndValidate`, `ContractValidationError`, error handling and input validation.
- React Router, TanStack Query, all product views/charts, loading/error states and London date formatting.
- Ruff, TypeScript, ESLint, Vite, Dockerfiles, Compose, backend healthcheck and persistent volume.
- Root README, final audit, project context, Elexon research, architecture, public contracts and frontend design. Small `docs/samples/` files remain as upstream research evidence.
- No analytical formulas, public API fields/statuses, UI design or deployment infrastructure changed.

## Verification

- Backend: `uv sync` and `uv run ruff check .` passed.
- Frontend: `npm install`, `npm run typecheck`, `npm run lint`, `npm run build` passed.
- Docker: Compose configuration, image builds and `docker compose up -d --wait` passed; existing January volume reused without resync.
- API smoke: all five required endpoints returned 200. Decision/comparison have 24 hours; accuracy has 744 matches and 24 hour groups.
- Required anchor: decision 2026-01-15, target 2026-01-16T12:00:00Z, selected publication 07:30Z, cutoff 09:20Z, forecast 7779 MW, actual 8766.5 MW, error −987.5 MW.
- January metrics unchanged: MAE 2038.9126344086021 MW, RMSE 2504.758652899355 MW, bias 1747.8870967741937 MW, WAPE 18.069767278418126%, P90 4097.9 MW, over/under 84.94623655913979% / 15.053763440860216%.
- Native Chrome smoke: Decision loads; January 15 → January 29 selection updates delivery/context/profile. Accuracy loads metrics/charts; keyboard selection of January 1 hour 00 updates comparison and evolution, showing selected 07:30 forecast 18,781 MW and a separate 09:20 cutoff marker.
- Git status/deletions reviewed; no generated files, real `.env`, SQLite data, environments, build output, coverage or caches are tracked. Whitespace checks passed.

Limitations: no automated tests run (intentionally removed), full browser regression, console/network audit or fresh upstream sync. Existing build advisories remain (bundle size and Zod annotations); npm reported three moderate vulnerabilities and the host Node 23 engine warning. Dependency upgrades/security triage were outside cleanup scope. The historical evolution findings were already fixed before cleanup; this task only corrected their stale README warning.

## Result

51 files deleted: 30 test/fixture/helper files, 18 workflow documents and 3 runtime helper modules. Submission inventory goes from 160 tracked files to 110 files including this report. Ten direct dependencies removed; six areas of runtime scaffolding/dead code simplified. Runtime analytics and the five public endpoints are preserved. No Turso, Render, Vercel migration or deployment was started.
