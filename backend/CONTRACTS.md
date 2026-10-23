# Public API Contracts

## Ownership

Backend Pydantic response models are the source of truth.

Frontend Zod schemas mirror these contracts.

Raw Elexon objects are never exposed directly to the frontend.

All times are timezone-aware ISO-8601 strings.

All generation/error values are returned in MW.

All numeric outputs are finite. `metrics.wape_percent` is a nonnegative number
without a 100% ceiling, or `null` when the matched actual denominator is zero.
This reflects the verified Phase 5 formula; WAPE is not a bounded accuracy score.
Other metrics are non-null on successful responses (zero matches return 404).
The existing frontend `percentSchema` for WAPE must become
`z.number().finite().nonnegative().nullable()` during frontend integration.

Frontend may format MW as GW for presentation.

---

# Domain conventions

Example-data correction (2026-10-23): the representative 2026-01-16T12:00:00Z hourly actual is 8766.5 MW, derived from FUELHH values 8781 and 8752. Earlier examples used 8781 as an hourly value. The signed example error is now -987.5 MW. Only example values changed; public fields/types and frontend Zod schemas are unchanged. Existing frontend mock fixtures remain illustrative and were not modified in Phase 4.

## Decision cutoff

```text
09:20 Europe/London
```

For January 2026:

```text
09:20Z
```

## Comparison resolution

```text
hourly
```

Expected complete delivery day:

```text
24 points
```

## Error sign

```text
error_mw = forecast_mw - actual_mw
```

```text
positive -> over-forecast
negative -> under-forecast
```

---

# GET `/api/v1/health`

## 200

```json
{
  "status": "ok"
}
```

---

# GET `/api/v1/decisions/{decision_date}`

Supported:

```text
2026-01-01 through 2026-01-31
```

Example:

```json
{
  "decision_date": "2026-01-15",
  "delivery_date": "2026-01-16",
  "decision_cutoff": "2026-01-15T09:20:00Z",
  "market_timezone": "Europe/London",
  "market_reference": "EPEX SPOT GB DAA 1 (60')",
  "selected_forecast_publish_time": "2026-01-15T07:30:00Z",
  "forecast_age_minutes": 110,
  "completeness": {
    "expected_hours": 24,
    "forecast_hours": 24,
    "missing_hours": 0
  },
  "summary": {
    "average_forecast_mw": 8740.2,
    "peak_forecast_mw": 12310.0,
    "peak_start_time": "2026-01-16T17:00:00Z",
    "historical_mae_mw": 720.4,
    "historical_p90_abs_error_mw": 1450.0
  },
  "series": [
    {
      "start_time": "2026-01-16T12:00:00Z",
      "hour": 12,
      "forecast_mw": 7779.0,
      "publish_time": "2026-01-15T07:30:00Z",
      "p90_abs_error_mw": 1350.0,
      "lower_mw": 6429.0,
      "upper_mw": 9129.0
    }
  ]
}
```

Notes:

- a complete day contains 24 hourly forecast targets
- `selected_forecast_publish_time` is the actual selected vintage timestamp, not a hard-coded display value
- January live data normally selects the 07:30Z vintage
- if data is incomplete, report that through `completeness`; never invent missing hours
- with mixed per-target vintages, the headline publication is the latest selected
  publication; each series item retains its own authoritative publication
- `forecast_age_minutes` is the whole elapsed minutes since that headline
  publication (floored); peak ties use the earliest target
- historical summary statistics and hour-specific P90 bands describe all matched
  January decisions, not a history restricted to before the purchase decision
- missing history for any returned forecast hour returns 404 rather than a
  fabricated band; missing forecast hours are omitted and counted

---

# GET `/api/v1/accuracy`

Scope:

All matched hourly decision-time forecasts vs derived hourly actuals for January 2026 purchase decisions.

Expected maximum:

```text
31 × 24 = 744 matched points
```

Example:

```json
{
  "period": {
    "decision_date_from": "2026-01-01",
    "decision_date_to": "2026-01-31",
    "decision_cutoff_time": "09:20",
    "market_timezone": "Europe/London"
  },
  "metrics": {
    "mae_mw": 720.4,
    "rmse_mw": 941.8,
    "bias_mw": 118.2,
    "wape_percent": 8.7,
    "p90_abs_error_mw": 1480.0,
    "over_forecast_percent": 54.1,
    "under_forecast_percent": 45.9,
    "matched_points": 744
  },
  "heatmap": [
    {
      "decision_date": "2026-01-15",
      "delivery_date": "2026-01-16",
      "start_time": "2026-01-16T12:00:00Z",
      "hour": 12,
      "forecast_mw": 7779.0,
      "actual_mw": 8766.5,
      "error_mw": -987.5
    }
  ],
  "hour_of_day_error": [
    {
      "hour": 12,
      "mae_mw": 650.0,
      "p90_abs_error_mw": 1350.0
    }
  ]
}
```

Do not invent a headline "accuracy percentage."

---

# GET `/api/v1/comparisons/{decision_date}`

Example:

```json
{
  "decision_date": "2026-01-15",
  "delivery_date": "2026-01-16",
  "decision_cutoff": "2026-01-15T09:20:00Z",
  "completeness": {
    "expected_hours": 24,
    "matched_hours": 24,
    "missing_hours": 0
  },
  "metrics": {
    "mae_mw": 690.0,
    "rmse_mw": 850.0,
    "bias_mw": 120.0,
    "wape_percent": 7.9,
    "p90_abs_error_mw": 1320.0,
    "over_forecast_percent": 56.25,
    "under_forecast_percent": 43.75,
    "matched_points": 24
  },
  "series": [
    {
      "start_time": "2026-01-16T12:00:00Z",
      "hour": 12,
      "forecast_mw": 7779.0,
      "actual_mw": 8766.5,
      "error_mw": -987.5,
      "absolute_error_mw": 987.5
    }
  ]
}
```

Missing actuals or forecasts:

- must not be converted to zero
- should reduce completeness
- unmatched points should not enter metric calculations

---

# GET `/api/v1/forecast-evolution?target_time=<ISODateTime>`

Example:

```json
{
  "target_time": "2026-01-16T12:00:00Z",
  "hour": 12,
  "decision_date": "2026-01-15",
  "decision_cutoff": "2026-01-15T09:20:00Z",
  "actual_mw": 8766.5,
  "selected_publish_time": "2026-01-15T07:30:00Z",
  "series": [
    {
      "publish_time": "2026-01-15T02:30:00Z",
      "forecast_mw": 9020.0,
      "is_available_at_decision": true,
      "is_selected_at_decision": false
    },
    {
      "publish_time": "2026-01-15T04:30:00Z",
      "forecast_mw": 7903.0,
      "is_available_at_decision": true,
      "is_selected_at_decision": false
    },
    {
      "publish_time": "2026-01-15T07:30:00Z",
      "forecast_mw": 7779.0,
      "is_available_at_decision": true,
      "is_selected_at_decision": true
    },
    {
      "publish_time": "2026-01-15T09:30:00Z",
      "forecast_mw": 7802.0,
      "is_available_at_decision": false,
      "is_selected_at_decision": false
    }
  ]
}
```

Later vintages remain visible in this analytical endpoint but must be marked unavailable at decision time.

`actual_mw` is nullable when either native half-hour is missing. Targets must be
exact UTC hours with timezone-aware ISO-8601 input, normalized to UTC. Supported
delivery dates are January 2 through February 1, inclusive. If vintages exist but
none was eligible at the decision cutoff, return 404 rather than selecting later data.

---

# Error and incomplete-data behavior

Invalid dates/timestamps, naive or off-hour targets and dates outside the supported
pilot return 422 with FastAPI's standard `detail` validation response.

Missing data returns 404 with `{"detail": "<message>"}`:

| Condition | Message |
| --- | --- |
| Decision has no eligible hourly forecasts | No decision-time forecasts available |
| Decision lacks historical errors for any returned hour | Historical error statistics unavailable |
| Comparison/accuracy has no matched points | No matched hourly data available |
| Evolution target has no vintages | No forecast vintages available for target |
| Evolution target has no eligible decision-time forecast | No decision-time forecast available for target |

Partial comparisons return only matched points with reduced completeness and metrics
computed from those points. Partial accuracy returns only matched heatmap points and
observed hour groups; `matched_points` and the fixed period reveal coverage. Neither
endpoint fills gaps with zeros. Unexpected failures return 500 with
`{"detail": "Internal server error"}`; details remain in server logs.

Startup initializes the configured SQLite schema only. Requests read a consistent
database snapshot; ingestion remains an explicit command, never an import/startup
or request side effect.

---

# Shared model concepts

## Completeness

Decision:

```text
expected_hours
forecast_hours
missing_hours
```

Comparison:

```text
expected_hours
matched_hours
missing_hours
```

Keep completeness explicit rather than pretending incomplete data is complete.

---

# Frontend Zod examples

```ts
import { z } from "zod"

const isoDateTime = z.string().datetime({ offset: true })

export const DecisionSeriesPointSchema = z.object({
  start_time: isoDateTime,
  hour: z.number().int().min(0).max(23),
  forecast_mw: z.number().finite().nonnegative(),
  publish_time: isoDateTime,
  p90_abs_error_mw: z.number().finite().nonnegative(),
  lower_mw: z.number().finite().nonnegative(),
  upper_mw: z.number().finite().nonnegative(),
})

export const ComparisonPointSchema = z.object({
  start_time: isoDateTime,
  hour: z.number().int().min(0).max(23),
  forecast_mw: z.number().finite().nonnegative(),
  actual_mw: z.number().finite().nonnegative(),
  error_mw: z.number().finite(),
  absolute_error_mw: z.number().finite().nonnegative(),
})

export type DecisionSeriesPoint = z.infer<typeof DecisionSeriesPointSchema>
export type ComparisonPoint = z.infer<typeof ComparisonPointSchema>
```

Do not expose or validate raw Elexon records in normal frontend product code.

---

# Contract evolution rule

When a public contract changes:

1. update this file
2. update backend Pydantic model
3. update backend response tests
4. update frontend Zod schema
5. update frontend fixtures
6. run both test suites

Never change only one side.

Phase 6 exception authorized by the phase scope: the WAPE correction is recorded
here, in backend models/tests and the Phase 6 frontend handoff. Frontend Zod and
fixture changes are deferred to frontend integration; no frontend files are edited.
