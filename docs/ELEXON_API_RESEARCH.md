# Elexon API Research

## Status

Live API research is complete.

The findings in this document are based on direct HTTP inspection of the Elexon Insights Solution APIs.

These observed behaviors are authoritative for implementation unless later live evidence contradicts them.

### Phase 4 correction — 2026-10-23

A narrow recheck of FUELHH for 2026-01-16 found 8781 MW at 12:00Z (settlement period 25, published 12:30Z) and 8752 MW at 12:30Z (period 26, published 13:00Z). The hourly actual is therefore `(8781 + 8752) / 2 = 8766.5 MW`. The earlier 8781 MW hourly example does not match this live pair; 8781 is the first half-hour value in the current response. This is an example-data correction, not a change to the averaging or error-sign rules. The original 8600/8962 → 8781 arithmetic case remains a synthetic unit-test fixture.

The verified pair above yields 8766.5 MW. The 07:30Z forecast remains 7779 MW, so the illustrative signed difference is -987.5 MW. Public field names/types are unchanged; frontend schemas need no changes.

Base URL:

```text
https://data.elexon.co.uk/bmrs/api/v1
```

No API key is required.

---

# 1. FUELHH — wind generation actuals

## Endpoint

```text
GET /datasets/FUELHH/stream
```

Recommended request:

```text
GET /datasets/FUELHH/stream
  ?settlementDateFrom=2026-01-15
  &settlementDateTo=2026-01-15
  &fuelType=WIND
```

Observed:

```text
HTTP 200
Content-Type: application/json
Top-level shape: bare JSON array
```

The non-stream route:

```text
GET /datasets/FUELHH
```

returns:

```json
{
  "data": []
}
```

---

## Raw FUELHH schema

Observed fields:

```text
dataset
publishTime
startTime
settlementDate
settlementPeriod
fuelType
generation
```

Representative records:

```json
[
  {
    "dataset": "FUELHH",
    "publishTime": "2026-01-15T00:30:00Z",
    "startTime": "2026-01-15T00:00:00Z",
    "settlementDate": "2026-01-15",
    "settlementPeriod": 1,
    "fuelType": "WIND",
    "generation": 14602
  },
  {
    "dataset": "FUELHH",
    "publishTime": "2026-01-15T01:00:00Z",
    "startTime": "2026-01-15T00:30:00Z",
    "settlementDate": "2026-01-15",
    "settlementPeriod": 2,
    "fuelType": "WIND",
    "generation": 14311
  },
  {
    "dataset": "FUELHH",
    "publishTime": "2026-01-15T01:30:00Z",
    "startTime": "2026-01-15T01:00:00Z",
    "settlementDate": "2026-01-15",
    "settlementPeriod": 3,
    "fuelType": "WIND",
    "generation": 14200
  },
  {
    "dataset": "FUELHH",
    "publishTime": "2026-01-15T02:00:00Z",
    "startTime": "2026-01-15T01:30:00Z",
    "settlementDate": "2026-01-15",
    "settlementPeriod": 4,
    "fuelType": "WIND",
    "generation": 14516
  },
  {
    "dataset": "FUELHH",
    "publishTime": "2026-01-15T02:30:00Z",
    "startTime": "2026-01-15T02:00:00Z",
    "settlementDate": "2026-01-15",
    "settlementPeriod": 5,
    "fuelType": "WIND",
    "generation": 14534
  }
]
```

---

## FUELHH field contract

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `dataset` | string literal `"FUELHH"` | No | Dataset identifier |
| `publishTime` | timezone-aware ISO datetime | No | Usually 30 minutes after interval start |
| `startTime` | timezone-aware ISO datetime | No | Half-hour interval start |
| `settlementDate` | date | No | `YYYY-MM-DD` |
| `settlementPeriod` | integer | No | 1 through 48 in January |
| `fuelType` | string | No | Filter to `WIND` |
| `generation` | integer MW | No | Non-negative |

Observed:

- 48 WIND rows/day
- 1,488 WIND rows for January 1–31
- 0 nulls
- 0 duplicate WIND `startTime` values
- WIND generation observed between 1,695 MW and 17,805 MW in January
- generation `0` is valid in FUELHH and must never be interpreted as missing

---

# 2. WINDFOR — historical wind forecast vintages

## Endpoint

```text
GET /datasets/WINDFOR/stream
```

Successful request:

```text
GET /datasets/WINDFOR/stream
  ?publishDateTimeFrom=2026-01-15T00:00:00Z
  &publishDateTimeTo=2026-01-15T23:59:59Z
```

Observed:

```text
HTTP 200
Top-level shape: bare JSON array
```

Important query behavior:

- `publishDateTimeFrom` and `publishDateTimeTo` must be supplied together
- `settlementDateFrom` and `settlementDateTo` are not valid selectors for the raw WINDFOR stream and were observed to be ignored
- malformed/inverted publication datetime requests can return HTTP 400 Problem Details

---

## Critical raw schema finding

Raw WINDFOR contains exactly:

```text
dataset
publishTime
startTime
generation
```

Raw WINDFOR does **not** contain:

```text
settlementDate
settlementPeriod
```

Do not require those fields in upstream validation.

Representative real records for one delivery target:

```json
[
  {
    "dataset": "WINDFOR",
    "publishTime": "2026-01-15T02:30:00Z",
    "startTime": "2026-01-16T12:00:00Z",
    "generation": 9020
  },
  {
    "dataset": "WINDFOR",
    "publishTime": "2026-01-15T04:30:00Z",
    "startTime": "2026-01-16T12:00:00Z",
    "generation": 7903
  },
  {
    "dataset": "WINDFOR",
    "publishTime": "2026-01-15T07:30:00Z",
    "startTime": "2026-01-16T12:00:00Z",
    "generation": 7779
  },
  {
    "dataset": "WINDFOR",
    "publishTime": "2026-01-15T09:30:00Z",
    "startTime": "2026-01-16T12:00:00Z",
    "generation": 7802
  },
  {
    "dataset": "WINDFOR",
    "publishTime": "2026-01-15T12:25:00Z",
    "startTime": "2026-01-16T12:00:00Z",
    "generation": 7673
  },
  {
    "dataset": "WINDFOR",
    "publishTime": "2026-01-15T15:30:00Z",
    "startTime": "2026-01-16T12:00:00Z",
    "generation": 7831
  },
  {
    "dataset": "WINDFOR",
    "publishTime": "2026-01-15T18:30:00Z",
    "startTime": "2026-01-16T12:00:00Z",
    "generation": 7656
  },
  {
    "dataset": "WINDFOR",
    "publishTime": "2026-01-15T22:30:00Z",
    "startTime": "2026-01-16T12:00:00Z",
    "generation": 7371
  }
]
```

---

## WINDFOR field contract

| Field | Type | Nullable | Notes |
|---|---|---:|---|
| `dataset` | string literal `"WINDFOR"` | No | Dataset identifier |
| `publishTime` | timezone-aware ISO datetime | No | Vintage publication time |
| `startTime` | timezone-aware ISO datetime | No | Hourly delivery target |
| `generation` | integer MW | No | Non-negative forecast |

---

## WINDFOR target resolution

Observed:

```text
60-minute resolution
```

All inspected `startTime` values were on:

```text
HH:00:00Z
```

Each forecast vintage contained:

```text
73 target hours
```

The horizon is sufficient to cover the full next delivery day.

No duplicate:

```text
(publishTime, startTime)
```

pairs were observed.

---

## January publication cadence

Eight forecast vintages/day were observed approximately at:

```text
02:30Z
04:30Z
07:30Z
09:30Z
11:30Z or ~12:25Z
15:30Z
18:30Z
22:30Z
```

For January:

```text
Europe/London == GMT == UTC
```

Therefore the 09:20 day-ahead cutoff occurs between:

```text
07:30Z
and
09:30Z
```

---

# 3. Decision cutoff verification

Locked cutoff:

```text
09:20 Europe/London
```

For January:

```text
09:20Z
```

Selection algorithm:

```text
selected forecast =
max(publishTime)
where publishTime <= 09:20Z
```

For target:

```text
2026-01-16T12:00:00Z
```

observed vintages were:

| publishTime | forecast MW | cutoff status |
|---|---:|---|
| `02:30Z` | 9020 | eligible but superseded |
| `04:30Z` | 7903 | eligible but superseded |
| `07:30Z` | 7779 | **selected** |
| `09:30Z` | 7802 | post-cutoff / forbidden |
| `12:25Z` | 7673 | post-cutoff |
| `15:30Z` | 7831 | post-cutoff |
| `18:30Z` | 7656 | post-cutoff |
| `22:30Z` | 7371 | post-cutoff |

Therefore:

```text
selected decision-time forecast = 7779 MW
selected publishTime = 2026-01-15T07:30:00Z
```

The 09:30 vintage is unavailable to the trader at the 09:20 cutoff and must never leak into decision-time analysis.

---

# 4. FUELHH/WINDFOR resolution alignment

This is the critical normalization rule.

FUELHH:

```text
30-minute actuals
48 periods/day
```

WINDFOR:

```text
hourly forecasts
24 delivery targets/day
```

Comparison therefore occurs at hourly resolution.

For hour H:

```text
hourly_actual_mw =
(actual at H:00 + actual at H:30) / 2
```

Do not sum the two MW values.

Example:

```text
forecast 12:00 = 7779 MW
hourly actual 12:00 = 8766.5 MW

error =
7779 - 8766.5
= -987.5 MW
```

Therefore:

```text
expected comparison points/day = 24
expected comparison points for 31 January decisions = 744
```

The separate raw January FUELHH count remains:

```text
1488 half-hour rows
```

---

# 5. Normalized backend records

## FUELHH normalized row

```json
{
  "start_time": "2026-01-15T00:00:00Z",
  "settlement_date": "2026-01-15",
  "settlement_period": 1,
  "generation_mw": 14602.0,
  "source_publish_time": "2026-01-15T00:30:00Z"
}
```

## WINDFOR normalized row

Use fields derived naturally from the hourly `startTime`.

```json
{
  "publish_time": "2026-01-15T07:30:00Z",
  "start_time": "2026-01-16T12:00:00Z",
  "target_date": "2026-01-16",
  "target_hour": 12,
  "generation_mw": 7779.0
}
```

Do not create a fake WINDFOR settlement period in the public domain model.

## Hourly actual derived row

```json
{
  "start_time": "2026-01-16T12:00:00Z",
  "target_date": "2026-01-16",
  "target_hour": 12,
  "generation_mw": 8766.5,
  "source_periods": [25, 26]
}
```

`source_periods` is optional internal metadata and does not need to be exposed publicly.

---

# 6. Latest forecast endpoint cross-check

Endpoint:

```text
GET /forecast/generation/wind/latest/stream
```

Observed:

- requires `from` and `to`
- includes `settlementDate` and odd settlement periods
- returns only the final/latest vintage for historical targets
- cannot reproduce earlier decision-time forecast vintages

Therefore it must not replace:

```text
/datasets/WINDFOR/stream
```

for this application.

---

# 7. January 31 boundary

Verified:

```text
decision date = 2026-01-31
cutoff = 2026-01-31T09:20:00Z
selected vintage = 2026-01-31T07:30:00Z
delivery date = 2026-02-01
```

The selected forecast contains all 24 hourly targets for February 1.

FUELHH contains all 48 WIND half-hour periods for February 1.

The final January purchase decision can therefore be evaluated completely.

---

# 8. HTTP behavior

Observed:

### Empty FUELHH window

```text
200 OK
[]
```

### Inverted FUELHH settlement dates

```text
200 OK
[]
```

### Inverted WINDFOR publication datetimes

```text
400 Bad Request
RFC 9110 Problem Details
```

### Missing one WINDFOR publication range bound

```text
400 Bad Request
```

### Malformed date

```text
400 Bad Request
```

### Caching

Observed:

```text
cache-control: no-store, must-revalidate, no-cache
pragma: no-cache
```

No successful-response rate-limit headers were observed.

---

# 9. Recommended Pydantic upstream validation

```python
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ElexonFuelhhRawRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    dataset: Literal["FUELHH"]
    publishTime: datetime
    startTime: datetime
    settlementDate: date
    settlementPeriod: int = Field(ge=1, le=48)
    fuelType: str
    generation: float = Field(ge=0.0)

    @field_validator("publishTime", "startTime")
    @classmethod
    def ensure_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("Datetime must be timezone-aware")
        return value


class ElexonWindforRawRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")

    dataset: Literal["WINDFOR"]
    publishTime: datetime
    startTime: datetime
    generation: float = Field(ge=0.0)

    @field_validator("publishTime", "startTime")
    @classmethod
    def ensure_timezone_aware(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("Datetime must be timezone-aware")
        return value
```

Do not add optional `settlementDate` or `settlementPeriod` to the raw WINDFOR model merely because another Elexon endpoint happens to expose them.

The raw stream contract observed for this assignment does not contain them.

---

# 10. Frontend validation rule

The React frontend should not parse raw Elexon payloads in production.

Frontend Zod schemas should validate only the application's FastAPI public responses defined in:

```text
backend/CONTRACTS.md
```

Raw Elexon validation belongs to the Python backend.

---

# Implementation conclusions

The implementation must now assume:

```text
FUELHH raw resolution = 30 minutes
WINDFOR raw resolution = 60 minutes
decision cutoff = 09:20 Europe/London
typical selected January vintage = 07:30Z
comparison resolution = 60 minutes
decision profile points/day = 24
accuracy heatmap = 31 × 24
maximum expected January comparison points = 744
```
