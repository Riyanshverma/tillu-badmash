# Project Context

## Purpose

Build a focused pilot web application for a UK energy utility team making day-ahead power-purchase decisions.

The product must help the user:

1. Understand the latest Elexon wind-generation forecast that was actually available at the day-ahead decision time.
2. Quantify how accurate those decision-time forecasts were when compared with Elexon wind-generation actuals.
3. Inspect historical forecast uncertainty and forecast evolution without introducing any data source beyond Elexon.

This document is the shared source of truth for both frontend and backend agents.

---

## Locked business assumption: decision cutoff

### Market reference

Use:

```text
EPEX SPOT GB DAA 1 (60')
```

### Decision cutoff

Use:

```text
09:20 Europe/London on decision day D
```

where:

```text
delivery day = D + 1 day
```

For January 2026:

```text
Europe/London = GMT = UTC
```

therefore:

```text
decision cutoff = 09:20Z
```

### Forecast selection rule

For every hourly WINDFOR target on the delivery day:

```text
selected forecast =
the forecast record with the greatest publishTime
where publishTime <= decision cutoff
```

Never use a forecast published after the cutoff.

### Empirically verified January behavior

Live Elexon inspection showed that the January 2026 WINDFOR publication immediately before the 09:20 cutoff is:

```text
07:30Z
```

The next publication is approximately:

```text
09:30Z
```

which is 10 minutes after the cutoff and must not be used.

Example for target:

```text
2026-01-16T12:00:00Z
```

Observed vintages:

```text
02:30 -> 9020 MW
04:30 -> 7903 MW
07:30 -> 7779 MW   <- selected
09:30 -> 7802 MW   <- look-ahead, forbidden
12:25 -> 7673 MW
15:30 -> 7831 MW
18:30 -> 7656 MW
22:30 -> 7371 MW
```

The algorithm remains time-based. Do not hard-code `07:30` as the selection rule; hard-code/configure the `09:20 Europe/London` cutoff and select the latest eligible publication.

---

## Data scope

Use Elexon only.

### Actual wind generation — FUELHH

Endpoint:

```text
GET /datasets/FUELHH/stream
```

Use:

```text
fuelType == "WIND"
```

Observed raw fields:

- `dataset`
- `publishTime`
- `startTime`
- `settlementDate`
- `settlementPeriod`
- `fuelType`
- `generation`

Observed behavior:

- 48 half-hourly periods per day
- settlement periods 1 through 48
- generation is a non-negative integer in MW
- no null fields in the inspected January data
- no duplicate WIND `startTime` rows
- query-level `fuelType=WIND` filtering works

### Wind forecast — WINDFOR

Endpoint:

```text
GET /datasets/WINDFOR/stream
```

Observed raw fields:

- `dataset`
- `publishTime`
- `startTime`
- `generation`

Important:

Raw WINDFOR does **not** include:

- `settlementDate`
- `settlementPeriod`

Do not require those fields in upstream Pydantic validation.

Observed behavior:

- target resolution is hourly
- every `startTime` is on `:00:00Z`
- each vintage contains 73 target hours
- 8 forecast vintages are published per day in January
- `publishDateTimeFrom` and `publishDateTimeTo` must be supplied together
- `(publishTime, startTime)` pairs were unique in the inspected data

Approximate January publication cadence:

```text
02:30Z
04:30Z
07:30Z
09:30Z
11:30Z or occasionally ~12:25Z
15:30Z
18:30Z
22:30Z
```

Raw WINDFOR is authoritative for reconstructing historical decision-time forecasts.

---

## Critical resolution mismatch

FUELHH actuals:

```text
30-minute resolution
48 values/day
```

WINDFOR forecasts:

```text
60-minute resolution
24 delivery targets/day
```

The comparison dataset must therefore be normalized to **hourly** resolution.

### Hourly actual aggregation

For forecast hour H:

```text
hourly_actual_mw =
(FUELHH at H:00 + FUELHH at H:30) / 2
```

Example:

```text
12:00 actual = 8781 MW
12:30 actual = 8752 MW

hourly actual =
(8781 + 8752) / 2
= 8766.5 MW
```

Do not sum the two MW values.

The derived comparison dataset contains:

```text
24 points per delivery day
```

For 31 January purchase-decision dates:

```text
31 × 24 = 744 expected comparison points
```

assuming complete data.

The raw FUELHH dataset still contains:

```text
31 × 48 = 1488 half-hour actual rows
```

These are different counts and must not be confused.

---

## January 2026 interpretation

The assignment says purchase decisions made in January 2026.

Supported decision dates:

```text
2026-01-01 through 2026-01-31
```

For each decision date D:

```text
delivery date = D + 1 day
```

Therefore the final supported delivery date is:

```text
2026-02-01
```

Live API research confirmed that:

- the 2026-01-31 07:30Z WINDFOR vintage covers all 24 hours of 2026-02-01
- FUELHH supplies all 48 half-hour WIND actual periods for 2026-02-01

Do not drop the January 31 decision.

---

## Core time concepts

These three timestamps must never be conflated:

### `decision_time`

When the trader must make the day-ahead purchase decision.

### `publish_time`

When a forecast vintage was published.

### `start_time`

The hourly delivery target being forecast.

Correctness depends on respecting all three.

---

## Error sign convention

Use:

```text
error_mw = forecast_mw - actual_mw
```

Therefore:

```text
positive error -> wind was over-forecast
negative error -> wind was under-forecast
```

Example:

```text
forecast = 7779 MW
actual = 8766.5 MW

error = -987.5 MW
```

This means wind was under-forecast by 987.5 MW.

Use this sign convention consistently in:

- backend calculations
- API contracts
- metric definitions
- charts
- heatmap
- tooltips
- explanatory text

---

## Accuracy metrics

Required v1 metrics:

### MAE

```text
mean(abs(forecast - actual))
```

### RMSE

```text
sqrt(mean((forecast - actual)^2))
```

### Bias

```text
mean(forecast - actual)
```

Interpretation:

```text
positive -> systematic over-forecasting
negative -> systematic under-forecasting
```

### WAPE

```text
sum(abs(forecast - actual))
/
sum(abs(actual))
* 100
```

Use WAPE instead of headline MAPE.

### P90 absolute error

```text
90th percentile(abs(forecast - actual))
```

Display this as historical error, not as a probabilistic confidence interval.

### Over-forecast percentage

Percentage of matched hourly points where:

```text
error_mw > 0
```

### Under-forecast percentage

Percentage of matched hourly points where:

```text
error_mw < 0
```

---

## Historical uncertainty band

Calculate historical P90 absolute error by **target hour of day**.

For hour H:

```text
p90_abs_error_mw[H] =
P90(
    abs(error_mw)
    across January comparison points where target hour == H
)
```

For each hourly forecast point:

```text
lower_mw = max(0, forecast_mw - p90_abs_error_mw[H])
upper_mw = forecast_mw + p90_abs_error_mw[H]
```

Label the visualization:

```text
Historical P90 error band
```

Do not call it:

```text
90% confidence interval
```

---

## Required product views

### Decision view

Purpose:

Show the wind information available when the trader had to make the day-ahead decision.

Include:

- decision date
- delivery date
- decision cutoff
- selected forecast publication timestamp
- forecast age at cutoff
- average forecast wind
- peak forecast wind and peak hour
- historical MAE
- historical P90 absolute error
- 24-point hourly forecast profile
- historical P90 error band
- explicit Elexon data/source note
- explicit cutoff assumption note

Do not make actual generation the primary focus on this page.

### Accuracy view

Purpose:

Quantify trust in the decision-time forecast.

Include:

- MAE
- RMSE
- bias
- WAPE
- P90 absolute error
- over-forecast percentage
- under-forecast percentage
- hourly forecast vs hourly actual
- signed hourly error bars
- January 31 × 24 error heatmap
- forecast evolution inspection

---

## Forecast evolution

For a selected hourly target `start_time`, return every available forecast vintage for that target ordered by `publish_time`.

The UI must visibly mark the forecast selected at the 09:20 cutoff.

Later vintages may appear for analytical context, but must be explicitly marked as unavailable at decision time.

Example:

```text
02:30 pre-cutoff
04:30 pre-cutoff
07:30 selected
09:30 post-cutoff
12:25 post-cutoff
...
```

---

## Out of scope

Do not add:

- consumer demand forecasts
- wholesale prices
- thermal generation procurement calculations
- weather APIs
- other renewable datasets
- machine-learning forecasts
- authentication
- users or roles
- notifications
- trading execution
- order submission
- optimization engines
- LLM features
- Kubernetes
- microservices
- alternate exchange selector
- alternate cutoff selector
- non-Elexon product data

---

## Product language

Prefer:

- decision-time forecast
- forecast vintage
- actual / outturn
- decision cutoff
- publication time
- delivery hour
- forecast error
- historical error
- uncertainty

Do not claim the application calculates the exact amount of thermal power the utility should purchase because consumer demand is not part of the assignment.
