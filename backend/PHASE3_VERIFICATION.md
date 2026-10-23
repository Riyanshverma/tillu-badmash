# Phase 3 verification — 2026-10-23

Phase 3 is complete. Phase 4 remains untouched.

## Files created or modified

- `app/models/upstream.py`: raw FUELHH and WINDFOR Pydantic models.
- `app/clients/elexon.py`, `app/clients/__init__.py`: asynchronous daily-window Elexon client.
- `app/services/ingestion.py`, `app/services/__init__.py`: validation, normalization, atomic persistence and sync accounting.
- `app/scripts/sync_january_2026.py`, `app/scripts/__init__.py`: explicit January sync command.
- `tests/test_upstream.py`, `test_elexon_client.py`, `test_ingestion.py`, `test_sync_command.py`: 55 new tests.
- `README.md`: sync invocation, coverage, retries, rejection/count policy and transaction behavior.
- `IMPLEMENTATION.md`: only Phase 3 newly checked.
- This verification record.

No shared repositories, schema, settings, public response models/contracts, application startup, dependencies or lockfile changed. Real sample files were read unchanged. Concurrent frontend edits were left intact.

## Upstream validation

FUELHH requires dataset FUELHH, aware publication/start timestamps, settlement date, strict integer period 1–48, fuel type and finite nonnegative numeric generation. WINDFOR requires only dataset WINDFOR, aware publication/start timestamps and finite nonnegative numeric generation. It has no settlement fields.

Extra upstream fields are ignored as specified in the research. Numeric epoch timestamps, numeric-string/bool generation, negative/nonfinite generation and naive datetimes are rejected. Zero generation is valid.

All rows in a response are validated so rejected_rows counts the entire failing window. Any rejection fails the run; there is no silent partial acceptance. Logs identify dataset/window, row index and validation errors. Valid non-WIND records are filtered out.

## HTTP client and retries

The client receives an owned-by-caller httpx.AsyncClient and uses relative paths preserving the configured BMRS base URL.

- FUELHH: /datasets/FUELHH/stream with settlementDateFrom, settlementDateTo and fuelType=WIND.
- WINDFOR: /datasets/WINDFOR/stream with both publication bounds, from 00:00:00Z through 23:59:59.999999Z.
- Daily windows bound response size; no latest-only endpoint is used.
- Per-request connection timeout: 10 seconds; read/write/pool timeout: 30 seconds.
- At most three attempts for 429/500/502/503/504, timeout and network errors, with 0.5/1-second retry delays.
- Other HTTP errors, malformed JSON and non-array responses fail immediately.
- A bare empty array is a valid response.
- Client code contains no decision, aggregation, accuracy or public-response logic.

## Ingestion flow and sync accounting

`sync_data(client, database_path, *, actual_from, actual_to, publication_from, publication_to)` initializes the schema explicitly and commits a running sync record before fetching.

It fetches daily windows, validates every row and maps native actuals to Actual and native forecasts to Forecast. Existing forecast persistence derives target_date and target_hour from the UTC start_time. All forecast vintages are retained. The same canonical UTC text and unique keys from Phase 2 are reused.

Validated records are staged in memory for this bounded pilot. Dataset upserts and successful sync metadata commit together. Fetch/validation/persistence failures and cancellation leave pre-existing dataset rows intact, persist failed metadata separately and propagate the error. Failed runs report zero committed dataset rows and the failing window's rejection count. Success counts are processed records/upserts, not net inserts.

The full command requests actuals for January 2–February 1 and publications for January 1–31:

```sh
uv run python -m app.scripts.sync_january_2026
```

It prints a concise result, returns nonzero on failure and never runs during FastAPI startup.

## Exact verification commands and results

Run from backend/:

| Command | Result |
| --- | --- |
| `rtk proxy uv sync` | Exit 0; resolved 30 packages, checked 28 installed packages. Cache access required sandbox approval. |
| `rtk proxy .venv/bin/ruff check` | Exit 0; all checks passed. |
| `rtk proxy .venv/bin/pytest` | Exit 0; 84 passed: 29 existing plus 55 new tests. |
| `rtk proxy .venv/bin/pytest tests/test_ingestion.py tests/test_sync_command.py -q` | Exit 0; 9 focused temporary-database tests passed. |
| `rtk proxy git diff --check -- backend` (repository root) | Exit 0; no whitespace errors. |

Tests were written and observed failing before implementing raw models/client, ingestion and the command, then observed passing. Tests use the real sample payloads, MockTransport, real temporary SQLite databases and a synthetic full-January fixture.

Final review added a failing regression for Pydantic's numeric timestamp-string coercion. The before-validator now parses ISO strings explicitly, and both raw models reject numeric timestamp strings. The complete 84-test suite passed after that fix.

Coverage includes zero preservation, non-WIND filtering, raw WINDFOR's four-field schema, aware timestamps, malformed payloads, empty windows, nonretryable 400, bounded transient retries, normalization, stored UTC target fields, multiple coexisting vintages, rerun idempotency, validation rejection counts, HTTP failure auditing, SQL rollback, cancellation auditing, nonzero command failure and all 31 daily windows including February 1 delivery. The synthetic command fixture has 1,488 actuals and 5,952 forecast rows (eight vintages × 24 next-day targets × 31); that forecast count is a test fixture, not a claim about live API volume.

## Live narrow verification

Performed successfully after mocked tests passed, using a temporary database and six narrow daily requests. No full-month live sync was run and the configured persistent database was not populated by verification.

| Window | Persisted/processed result |
| --- | --- |
| January 15 actuals + January 15 publications, first run | 48 WIND actuals, 584 forecast rows, 8 vintages for target 2026-01-16T12:00:00Z, zero rejected. |
| Same windows, second run | Same 48 actuals and 584 forecast database rows; counts unchanged, zero rejected. |
| February 1 actuals + January 31 publications | 48 actuals; all 8 January 31 vintages each cover all 24 February 1 target hours; zero rejected. |

Actual timestamps retain 30-minute spacing; forecast targets remain hourly. The representative target includes both 07:30 and 09:30 publications. There are no duplicate publication/target pairs. Nothing was filtered by a decision cutoff.

The initial sandboxed request failed at DNS resolution; the approved network retry succeeded. The fractional-second publication-window upper bound was accepted by the live API. No observed behavior required a public contract change.

Exact reproducible live verification (from backend/):

```sh
rtk proxy .venv/bin/python - <<'PY'
import asyncio
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

import httpx

from app.clients.elexon import ElexonClient
from app.core.config import Settings
from app.db.connection import connect_database
from app.db.repositories import actuals, forecasts
from app.services.ingestion import sync_data


async def verify():
    settings = Settings()
    with TemporaryDirectory(prefix="gridbricks-phase3-") as directory:
        path = Path(directory) / "wind.db"
        async with httpx.AsyncClient(
            base_url=settings.elexon_base_url.rstrip("/") + "/"
        ) as http:
            client = ElexonClient(http)
            counts = []
            for _ in range(2):
                run = await sync_data(
                    client, path,
                    actual_from=date(2026, 1, 15), actual_to=date(2026, 1, 15),
                    publication_from=date(2026, 1, 15),
                    publication_to=date(2026, 1, 15),
                )
                assert run.status == "success" and run.rejected_rows == 0
                async with connect_database(path) as db:
                    a = await actuals.for_date(db, date(2026, 1, 15))
                    assert len(a) == 48
                    assert [r.settlement_period for r in a] == list(range(1, 49))
                    assert all(
                        b.start_time - a.start_time == timedelta(minutes=30)
                        for a, b in zip(a, a[1:])
                    )
                    v = await forecasts.for_target(
                        db, datetime(2026, 1, 16, 12, tzinfo=UTC)
                    )
                    publications = [r.publish_time.isoformat() for r in v]
                    assert "2026-01-15T07:30:00+00:00" in publications
                    assert "2026-01-15T09:30:00+00:00" in publications
                    assert all(r.start_time.minute == 0 for r in v)
                    total = (await db.execute_fetchall(
                        "SELECT COUNT(*) AS n FROM wind_forecasts_hourly"
                    ))[0]["n"]
                    counts.append((len(a), total))
                    print("Jan15", "run", run.id, "actuals", len(a),
                          "forecast_rows", total, "target_vintages", len(v),
                          "rejected", run.rejected_rows)
            assert counts[0] == counts[1]
            run = await sync_data(
                client, path,
                actual_from=date(2026, 2, 1), actual_to=date(2026, 2, 1),
                publication_from=date(2026, 1, 31), publication_to=date(2026, 1, 31),
            )
            async with connect_database(path) as db:
                a = await actuals.for_date(db, date(2026, 2, 1))
                assert len(a) == 48
                groups = await db.execute_fetchall(
                    "SELECT publish_time, COUNT(DISTINCT target_hour) AS hours "
                    "FROM wind_forecasts_hourly WHERE target_date = '2026-02-01' "
                    "AND publish_time LIKE '2026-01-31%' GROUP BY publish_time"
                )
                assert len(groups) == 8 and all(r["hours"] == 24 for r in groups)
                print("Boundary", "actual_rows", len(a),
                      "Jan31_vintages_covering_Feb1", len(groups),
                      "hours_per_vintage", 24, "rejected", run.rejected_rows)
                duplicate = await db.execute_fetchall(
                    "SELECT publish_time, start_time FROM wind_forecasts_hourly "
                    "GROUP BY publish_time, start_time HAVING COUNT(*) > 1"
                )
                assert duplicate == []
        print("PASS: live narrow ingestion, rerun idempotency, native resolutions, "
              "multiple vintages, metadata and February 1 coverage")


asyncio.run(verify())
PY
```

Result: exit 0, with:

```text
Jan15 run 1 actuals 48 forecast_rows 584 target_vintages 8 rejected 0
Jan15 run 2 actuals 48 forecast_rows 584 target_vintages 8 rejected 0
Boundary actual_rows 48 Jan31_vintages_covering_Feb1 8 hours_per_vintage 24 rejected 0
PASS: live narrow ingestion, rerun idempotency, native resolutions, multiple vintages, metadata and February 1 coverage
```

## Limitations and stop boundary

- Live verification covered narrow windows, not the entire month. The complete command/window sequence was tested with mocked HTTP and temporary SQLite.
- Memory staging is intentional for this fixed pilot; larger coverage should move to bounded persistence batches with an explicit atomicity policy.
- Empty windows are valid, so successful transport/validation is not proof of complete dataset coverage. Counts and logs make that visible.
- Upserts retain Phase 2's last-write-wins policy. Any invalid required row fails the run.
- No aggregation, decision cutoff/selection, comparison, metrics, uncertainty, analytical routes, frontend integration, scheduler/worker or Compose work was implemented. Docker runtime verification is outside this phase.

Applied Ponytail, Context Mode, CodeGraph repository/dependency review, Superpowers test-driven-development, systematic-debugging for verification diagnostics and verification-before-completion.
