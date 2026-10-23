# Phase 4 verification — 2026-10-23

Phase 4 is complete. Phase 5 remains untouched.

## Important real-data correction

The requested representative hourly actual of **8781 MW did not pass live verification**. The raw FUELHH response for 2026-01-16 contains:

| startTime | settlementPeriod | publishTime | generation MW |
| --- | --- | --- | --- |
| 2026-01-16T12:00:00Z | 25 | 2026-01-16T12:30:00Z | 8781 |
| 2026-01-16T12:30:00Z | 26 | 2026-01-16T13:00:00Z | 8752 |

The required averaging rule gives **(8781 + 8752) / 2 = 8766.5 MW**. Returning 8781 would return the first half-hour instead of the hourly mean. A separate narrow raw request reproduced this pair and independently calculated 8766.5. There is no archived original noon response establishing whether the prior example reflected a documentation error or older upstream data; the current response is the evidence used here.

The forecast fixture remains correct: the selected publication is 07:30Z at **7779 MW**, with 09:30Z ineligible. The signed illustrative difference is 7779 − 8766.5 = -987.5 MW; no production error/metric calculation was added.

Research, context, architecture and backend contract examples were corrected explicitly. The original 8600/8962 → 8781 mathematical fixture remains tested. Public JSON keys and types are unchanged, verified by comparing every fenced JSON example's shape against the existing contract. Frontend schemas need no changes; existing frontend mock values remain illustrative. No frontend files or frontend fixtures were modified.

## Files created or modified

- `app/domain/actuals.py`: pure hourly aggregation and internal HourlyActual/HourlyActuals dataclasses.
- `app/domain/decision.py`: internal DecisionContext for cutoff and delivery date.
- `app/domain/__init__.py`: package marker.
- `app/db/repositories/forecasts.py`: added at_cutoff; existing functions/interfaces preserved.
- `app/services/decision_service.py`: database-backed hourly_actuals and decision_forecasts helpers with completeness logging.
- `tests/test_hourly_actuals.py`, `tests/test_decision.py`: 21 new tests.
- `tests/fixtures/fuelhh-wind-2026-01-16-noon.json`: the two independently verified raw noon records.
- `README.md`: internal helper behavior and representative-data correction.
- `ARCHITECTURE.md`, `CONTRACTS.md`, `../docs/PROJECT_CONTEXT.md`, `../docs/ELEXON_API_RESEARCH.md`: corrected representative values; research includes the evidence and frontend impact.
- `IMPLEMENTATION.md`: only Phase 4 newly checked.
- This verification record.

No dependencies, schema, persisted hourly table, application startup, settings, public response model or public route changes were made. Original docs/samples files and previous phase records were preserved. Concurrent frontend work was left intact.

## Hourly actual aggregation

`aggregate_hourly_actuals(records, target_date)` normalizes aware timestamps to UTC, uses exact H:00 and H:30 keys, and emits ordered means only when both half-hours exist. Zero is checked by key presence, never truthiness.

The internal HourlyActual contains start_time, target_date, hour and generation_mw. HourlyActuals contains complete series points, missing_start_times and expected/available/missing counts. Missing targets have no fabricated generation value. Duplicate, naive or off-grid half-hours raise an error rather than being silently overwritten, converted using host timezone or rounded.

`hourly_actuals(connection, target_date)` reads the existing native actual repository and derives the result in memory. Nothing is aggregated during ingestion or stored in a new table.

## Decision cutoff and selection

DecisionContext derives delivery_date as decision_date + one day, and constructs 09:20 with ZoneInfo("Europe/London"). The datetime remains aware. A summer cutoff test confirms this is not a fixed UTC-offset implementation; supported delivery-day aggregation remains scoped to the January pilot.

`forecasts.at_cutoff(connection, target_date, cutoff)` canonicalizes the aware cutoff to UTC text, filters publications with `publish_time <= cutoff`, partitions by start_time and chooses ROW_NUMBER 1 ordered by publish_time descending. Results are sorted by target start_time. There is no lower publication-date restriction, fixed 07:30 selection or fallback to a future vintage.

`decision_forecasts(connection, decision_date)` uses that query for the next-day delivery date. It returns the DecisionContext, selected series and expected/available/missing counts. Missing targets remain absent. Nonhourly targets are rejected rather than inflating completeness. All forecast vintages remain in storage.

## Exact verification commands and results

Run from backend/:

| Command | Result |
| --- | --- |
| `rtk proxy uv sync` | Exit 0; resolved 30 packages, checked 28 installed packages; cache access required sandbox approval. |
| `rtk proxy .venv/bin/ruff check` | Exit 0; all checks passed. |
| `rtk proxy .venv/bin/pytest` | Exit 0; **105 passed** (84 previous plus 21 Phase 4 tests). |
| `rtk proxy .venv/bin/pytest tests/test_hourly_actuals.py tests/test_decision.py -q` | Exit 0; **21 passed**. |
| `rtk proxy git diff --check -- backend docs` (repository root) | Exit 0; clean whitespace. |

The initial 20 behavioral tests were written and observed failing before implementation, then passing. The additional captured-data regression protects the distinction between a raw half-hour and the hourly mean. Test coverage includes:

- 8600/8962 → 8781, 0/100 → 50, and 0/0 → 0.
- Missing first/second halves, entirely missing days and explicit missing-hour timestamps.
- Unordered input, 48 → 24 complete ordered points, UTC-offset normalization, duplicate/off-grid/naive rejection.
- Aware London cutoff and January 31 → February 1.
- The complete eight-vintage representative fixture selecting 7779 at 07:30.
- Exact-cutoff eligibility and rejection of a publication one microsecond later.
- Independent target selection, a non-07:30 eligible publication, no eligible publication, zero forecasts and exclusion of another delivery date.
- SQL-backed full February 1 coverage and hourly derivation.

## Focused real-data verification

The configured data directory had no existing database, so narrow live syncs used an automatically removed temporary database. The first approved run confirmed 24/24 completeness and the correct forecast, then failed the stale 8781 hourly-actual assertion. An independent single-day raw request established the pair above. The corrected full verification then passed with four narrow daily requests: January 16 actuals/January 15 publications and February 1 actuals/January 31 publications.

| Decision / delivery | Cutoff | Selected publication | Selected targets | Actuals |
| --- | --- | --- | --- | --- |
| Jan 15 / Jan 16 | Jan 15 09:20Z | Jan 15 07:30Z | 24 | 48 native → 24 hourly |
| Jan 31 / Feb 1 | Jan 31 09:20Z | Jan 31 07:30Z | 24 | 48 native → 24 hourly |

Representative target 2026-01-16T12:00:00Z: selected forecast 7779 MW; actual 8766.5 MW; 09:30 remains stored but is not selected.

Within temporary savepoints, deleting the 12:30 half-hour returned 23 hourly actuals and explicitly marked noon missing. Deleting every eligible vintage for noon, while leaving future vintages stored, returned 23 selected forecasts and left noon absent. Both temporary modifications were rolled back.

The initial sandboxed live request failed DNS resolution; approved network access worked. No broad API research or full-month live sync was performed.

The following is the exact Python verification code executed via `rtk proxy .venv/bin/python -c`; the heredoc invocation reproduces it from backend/:

```sh
rtk proxy .venv/bin/python - <<'PY'
import asyncio
from datetime import UTC, date, datetime
from pathlib import Path
from tempfile import TemporaryDirectory

import httpx

from app.clients.elexon import ElexonClient
from app.core.config import Settings
from app.db.connection import connect_database, utc_text
from app.db.repositories import actuals, forecasts
from app.services.decision_service import decision_forecasts, hourly_actuals
from app.services.ingestion import sync_data


async def verify():
    with TemporaryDirectory(prefix="gridbricks-phase4-") as directory:
        path = Path(directory) / "wind.db"
        async with httpx.AsyncClient(
            base_url=Settings().elexon_base_url.rstrip("/") + "/"
        ) as http:
            for decision, delivery in [
                (date(2026, 1, 15), date(2026, 1, 16)),
                (date(2026, 1, 31), date(2026, 2, 1)),
            ]:
                await sync_data(
                    ElexonClient(http), path,
                    actual_from=delivery, actual_to=delivery,
                    publication_from=decision, publication_to=decision,
                )
                async with connect_database(path) as db:
                    raw = await actuals.for_date(db, delivery)
                    derived = await hourly_actuals(db, delivery)
                    selected = await decision_forecasts(db, decision)
                    assert len(raw) == 48 and derived.available_hours == 24
                    assert selected.available_hours == 24
                    assert selected.missing_hours == derived.missing_hours == 0
                    assert selected.context.delivery_date == delivery
                    assert all(r.start_time.date() == delivery for r in selected.series)
                    assert all(r.publish_time <= selected.context.cutoff
                               for r in selected.series)
                    print("decision", decision, "delivery", delivery,
                          "cutoff", selected.context.cutoff.isoformat(),
                          "native_actuals", len(raw),
                          "hourly_actuals", derived.available_hours,
                          "selected_hours", selected.available_hours,
                          "selected_publications",
                          sorted({r.publish_time.isoformat() for r in selected.series}))
                    if decision == date(2026, 1, 15):
                        target = datetime(2026, 1, 16, 12, tzinfo=UTC)
                        point = next(r for r in selected.series if r.start_time == target)
                        outturn = next(r for r in derived.series if r.start_time == target)
                        assert point.publish_time == datetime(2026, 1, 15, 7, 30, tzinfo=UTC)
                        assert point.generation_mw == 7779
                        assert outturn.generation_mw == 8766.5
                        pair = [r for r in raw if r.start_time.hour == 12]
                        assert [r.generation_mw for r in pair] == [8781, 8752]
                        vintages = await forecasts.for_target(db, target)
                        assert any(r.publish_time == datetime(
                            2026, 1, 15, 9, 30, tzinfo=UTC
                        ) for r in vintages)
                        print("representative", target.isoformat(),
                              "forecast_mw", point.generation_mw,
                              "actual_mw", outturn.generation_mw,
                              "09:30_stored_but_not_selected", True)
                        await db.execute("SAVEPOINT missing_half")
                        await db.execute(
                            "DELETE FROM wind_actuals_half_hourly WHERE start_time = ?",
                            (utc_text(datetime(2026, 1, 16, 12, 30, tzinfo=UTC)),),
                        )
                        incomplete = await hourly_actuals(db, delivery)
                        assert incomplete.available_hours == 23
                        assert incomplete.missing_start_times == [target]
                        assert all(r.start_time != target for r in incomplete.series)
                        await db.execute("ROLLBACK TO missing_half")
                        await db.execute("RELEASE missing_half")
                        await db.execute("SAVEPOINT future_only")
                        await db.execute(
                            "DELETE FROM wind_forecasts_hourly WHERE start_time = ? "
                            "AND publish_time <= ?",
                            (utc_text(target), utc_text(selected.context.cutoff)),
                        )
                        incomplete = await decision_forecasts(db, decision)
                        assert incomplete.available_hours == 23
                        assert incomplete.missing_hours == 1
                        assert all(r.start_time != target for r in incomplete.series)
                        assert await forecasts.for_target(db, target)
                        await db.execute("ROLLBACK TO future_only")
                        await db.execute("RELEASE future_only")
                        print("missing-half and future-only target checks: PASS")
        print("PASS: real-data representative case, anti-lookahead, 48-to-24 actuals, "
              "missing-data safety and January 31 boundary")


asyncio.run(verify())
PY
```

Result: exit 0. Output:

```text
decision 2026-01-15 delivery 2026-01-16 cutoff 2026-01-15T09:20:00+00:00 native_actuals 48 hourly_actuals 24 selected_hours 24 selected_publications ['2026-01-15T07:30:00+00:00']
representative 2026-01-16T12:00:00+00:00 forecast_mw 7779.0 actual_mw 8766.5 09:30_stored_but_not_selected True
missing-half and future-only target checks: PASS
decision 2026-01-31 delivery 2026-02-01 cutoff 2026-01-31T09:20:00+00:00 native_actuals 48 hourly_actuals 24 selected_hours 24 selected_publications ['2026-01-31T07:30:00+00:00']
PASS: real-data representative case, anti-lookahead, 48-to-24 actuals, missing-data safety and January 31 boundary
```

## Limitations and stop boundary

- The original requested live actual of 8781 is not asserted as passing; it is replaced by the independently verified mean 8766.5, with source evidence, a regression fixture and corrected example documentation.
- Aggregation/completeness uses the 24 UTC delivery hours in the supported January/February 1 pilot. DST transition-day aggregation and dates outside the pilot are not claimed as supported.
- Live coverage checks were narrow, not a full-month live evaluation. Verification databases were temporary.
- No error metrics, comparison alignment, uncertainty bands, analytical public endpoints, frontend integration, or Docker/Compose work was implemented or tested.

Applied Ponytail, Context Mode, CodeGraph repository/contract impact review, Superpowers test-driven-development, systematic-debugging for the real-data discrepancy, and verification-before-completion. Phase 5 remains untouched.
