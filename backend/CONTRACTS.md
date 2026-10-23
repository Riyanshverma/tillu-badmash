# Public API Contracts

## Ownership

Backend Pydantic response models are the source of truth.

Frontend Zod schemas mirror these contracts.

Raw Elexon objects are never exposed directly to the frontend.

All times are timezone-aware ISO-8601 strings.

All generation/error values are returned in MW.

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
