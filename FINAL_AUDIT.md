# Final Audit

Historical audit from before repository cleanup. Its test counts and phase-file
references describe that earlier state; automated suites and workflow records
have since been removed. See [CLEANUP_REPORT.md](CLEANUP_REPORT.md) for current
verification and repository status.

Date: 2026-10-24. Scope: the completed January pilot and local Compose workflow,
with a single reviewer using the application. No product code or infrastructure
behavior was changed by this audit.

**Builds, tests, contracts and live backend analytics pass. Unqualified submission
readiness is blocked by the evolution-chart presentation findings below.**

## Repository status

- Backend Phases 0–7 and frontend Phases 0–5 are all marked complete. No new phase was added or plan checkbox changed.
- Required source/configuration files exist. Existing uncommitted implementation changes were preserved.
- The working tree is not a complete Git submission yet: compose.yaml, phase records and frontend production modules are among the untracked files. Review/include them, along with this audit's documents, before committing or submitting a Git checkout. No commit, staging or deletion was performed by this audit.

## Domain consistency

- Pilot market reference: EPEX SPOT GB DAA 1 (60'); cutoff D at 09:20 Europe/London; delivery D+1, including January 31 → February 1.
- Backend selection uses publish_time <= cutoff and the greatest eligible publication independently per target. It does not select by a fixed 07:30 equality. The January 07:30 observation and 09:30 exclusion are consistent with live responses.
- FUELHH remains half-hourly, WINDFOR hourly. The backend averages both native half-hours, requires the pair and aligns complete hours by timestamp. No frontend FUELHH averaging or raw upstream ingestion was found.
- Complete January coverage is 744 matched hours, distinct from 1488 native actual rows. Missing matches are not zero-filled.
- Signed error remains forecast minus actual. The noon pair is 8781/8752 MW, derived actual 8766.5 MW, forecast 7779 MW and error -987.5 MW.
- Remaining scan hits for retired assumptions are explicit rejection/history text, timezone-normalization fixtures or generic numeric-formatting tests. Valid raw 8781 MW references were retained. The evolution chart is the exception to data-driven presentation, documented below.

## Backend verification

From backend/, all commands exited 0:

| Command | Result |
| --- | --- |
| `uv sync` | 30 packages resolved; 28 installed packages checked |
| `uv run ruff check .` | All checks passed |
| `uv run pytest` | **181 passed** |

Thin route handlers delegate to services/domain functions. All five intended GET
paths appear in OpenAPI; no endpoint was added. Startup initializes the schema
without ingestion. The persistent database was reused, so no unnecessary external
sync was run during this audit.

## Frontend verification

From frontend/, all commands exited 0:

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm test` | **77 passed**, six test files |
| `npm run lint` | Passed |
| `npm run build` | Passed; existing bundle-size advisory |

Production source has no test-fixture imports or direct Elexon client. Page data
comes through the typed API client and TanStack Query. Passing tests do not cover
the evolution-chart defects identified by the additional render reproducer.

## Docker verification

From repository root:

```sh
docker compose config
docker compose build
docker compose up -d --wait
```

All exited 0. The final audit used the default gridbricks-assignment project:

- Frontend: http://localhost:5173/ and /accuracy, both HTTP 200 from Nginx.
- Backend: http://localhost:8000/api/v1/health, HTTP 200 with status ok.
- /docs and /openapi.json: HTTP 200; exactly the five intended application routes.
- All four analytical endpoints: HTTP 200 and frontend-origin CORS allowed.
- Existing named volume: gridbricks-assignment_backend-data; 1488 actuals, 18104 forecasts and one sync run remained after image/container recreation.

The canonical fresh-data command is unchanged:

```sh
docker compose exec backend uv run python -m app.scripts.sync_january_2026
```

The audit did not delete volumes, resync the already-complete dataset or change
Compose. No new deep browser audit was performed: product source was unchanged.
Previous browser verification remains recorded in frontend/PHASE5_VERIFICATION.md;
the new semantic finding below qualifies its earlier readiness conclusion.

Live analytical response checks confirmed:

| Result | Observed |
| --- | ---: |
| Decision / comparison points | 24 / 24 |
| January matched / missing hours | 744 / 0 |
| Hour-of-day groups | 24 |
| MAE MW | 2038.9126344086021 |
| RMSE MW | 2504.758652899355 |
| Bias MW | 1747.8870967741937 |
| WAPE % | 18.069767278418126 |
| P90 absolute error MW | 4097.9 |
| Over / under forecast % | 84.94623655913979 / 15.053763440860216 |

The noon evolution selected 07:30Z, rejected 09:30Z for decision availability and
returned actual 8766.5 MW. Comparison returned error -987.5 MW. These are dataset
observations, not new constants.

## Git hygiene

- git status and git ls-files were inspected. No tracked environment secrets, Node/Python environments, caches, build output, coverage, SQLite databases, logs or OS metadata were found.
- Both package lockfiles, backend pyproject.toml, package.json, schema.sql and backend/frontend .env.example files are tracked. compose.yaml is present but untracked, as are several completed-phase files; inclusion before Git submission remains necessary.
- Added root .gitignore rules for local environment files, logs and OS metadata. Example env files remain allowed. Existing backend/frontend ignore rules cover generated data/build files.
- Existing local databases and all verification documents were preserved. Whitespace and README relative-link checks pass; the root README contains no developer-specific absolute paths or broken screenshots.
- A reasonable current-file secret scan found no credentials. It covered tracked and submission-source files for private keys, provider tokens, credential assignments and authenticated URLs without printing possible secret values. This is not a forensic Git-history scan or security certification.

## Contract compatibility

All four live analytical HTTP responses were parsed successfully by their actual
frontend Zod response schemas, loaded through Vite. Normal backend response-model
validation and the 181 API/domain tests also pass.

WAPE accepts finite nonnegative values, null and values above 100 (null and 150
were explicitly checked). Directional percentages still reject values above 100.
Timestamps are offset-aware and schemas expose hourly targets, not forecast
settlement periods. Backend numeric JSON remains finite. No public field or
response type was changed by this audit.

## Documentation changes

- Replaced the placeholder root README with product purpose, actual architecture, correctness rules, data alignment, Docker/sync commands, URLs, endpoints, metric definitions, test commands and limitations.
- Added root .gitignore and this report.
- Corrected frontend Phase 4's January 5 example from 08:30 / age 50 minutes to the live-confirmed 07:30 / age 110 minutes.
- Corrected frontend Phase 5's noon raw pair to periods 25/26, 8781/8752 MW; clarified January decision dates and February 1 delivery.
- Qualified the earlier frontend Phase 5 readiness conclusion with the new reproducible presentation defect.
- Updated CONTRACTS.md's stale pending WAPE wording to the reconciled implementation and labelled illustrative JSON examples as distinct from measured response samples. No schema redesign.
- Updated the backend README's planned directory tree to the current main files and the parallel-execution note to reflect final root README preparation.

## Product correctness findings

1. **High: evolution captions show another target's values.**
   [Chart title and target label](frontend/src/components/charts/forecast-evolution-chart.tsx#L121)
   retain 12:00 GMT; the [footer](frontend/src/components/charts/forecast-evolution-chart.tsx#L260)
   retains 7779 MW. Reproducer: select decision January 29, delivery hour 17,
   or request evolution for 2026-01-30T17:00:00Z. The real API selects **16883 MW**,
   while rendering the actual component with that response yields **12:00 GMT**
   and **7,779 MW** in its captions. The plotted rows are data-driven; those
   captions are not. Smallest follow-up: derive captions from target_time and
   the selected series item, and test a second target/forecast.

2. **High: the cutoff marker is positioned at 07:30, not 09:20.**
   [ReferenceLine x](frontend/src/components/charts/forecast-evolution-chart.tsx#L196)
   is the categorical string 07:30 GMT while its label says 09:20 cutoff.
   This visually conflates selected publication with decision cutoff. The series
   includes vintages across publication days, making clock-only labels ambiguous.
   A focused follow-up should position the marker using the actual cutoff
   datetime on an appropriate publication-time axis, with a regression check.

Both findings were documented rather than redesigning a working chart during a
documentation audit. The first was reproduced by loading the current component
with Vite, fetching the live non-noon response and rendering it with React's
renderToStaticMarkup; no product/test file was modified. Source inspection proves
the second marker-coordinate mismatch. Backend selection and calculations remain correct.

## Known non-blocking issues

- The [evolution outturn legend](frontend/src/components/charts/forecast-evolution-chart.tsx#L138)
  uses truthiness, so a valid actual_mw of zero displays an unavailable dash even
  though the reference line accepts zero. No zero-outturn January live case was
  observed; include zero/null distinction in the focused presentation fix.
- Vite reports a roughly 916 kB uncompressed / 269 kB gzip main bundle and dependency annotation advisories. These do not fail the build.
- Earlier install output recorded dependency audit findings; dependency vulnerability triage/upgrades were not part of this audit and no lockfile was changed. A passing secret scan is not a dependency security clearance.
- Scope remains the January national-wind pilot and local container execution, not deployment or load testing.

## Assessment readiness

**Not yet ready for unqualified submission.** The backend, live contracts,
documented startup flow and all existing checks pass, but the evolution chart can
misstate the selected hour/value and visually misplace the cutoff. Resolve those
focused frontend correctness findings and add coverage before presenting the
interactive evolution view as fully correct. Also review/include/commit the
currently untracked completed-phase source/configuration and audit files for a
complete Git-based submission. No new feature, refactor, deployment or recording
was started by this audit.
