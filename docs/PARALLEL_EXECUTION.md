# Parallel Execution Plan

## Objective

Run frontend and backend agents in parallel without allowing contracts or domain assumptions to drift.

---

## Research status

Live Elexon research is complete.

Authoritative findings are in:

```text
docs/ELEXON_API_RESEARCH.md
```

Do not rerun broad API exploration unless implementation exposes a contradiction.

Key locked facts:

```text
decision cutoff = 09:20 Europe/London
selected January vintage is normally 07:30Z
WINDFOR = hourly
FUELHH = half-hourly
comparison = hourly
24 comparison points/day
31 × 24 January heatmap
```

---

## Phase A — Contract lock

Before either agent builds feature logic:

1. backend reads `docs/ELEXON_API_RESEARCH.md`
2. backend public models follow `backend/CONTRACTS.md`
3. frontend mirrors those public models with Zod
4. frontend derives TypeScript types using `z.infer`

The frontend does not need raw Elexon schemas.

The backend owns upstream Elexon validation.

---

## Phase B — Parallel build

### Antigravity frontend

Sequence:

```text
foundation
→ Zod public contracts + fixtures
→ design system
→ Decision UI with fixtures
→ Accuracy UI with fixtures
→ real API integration later
```

The fixture dataset must contain:

```text
24 hourly decision points/day
```

not 48.

### Codex backend

Sequence:

```text
uv/FastAPI foundation
→ SQLite
→ raw Elexon ingestion
→ FUELHH half-hour normalization
→ WINDFOR hourly normalization
→ hourly actual aggregation
→ 09:20 decision-vintage selection
→ metrics/uncertainty
→ public API
```

---

## Phase C — Contract boundary

Frontend should be able to progress without a running backend.

Until integration:

```text
backend/CONTRACTS.md
        ↓
frontend Zod
        ↓
typed fixtures
```

Do not let frontend invent fields missing from the contract.

Backend must not tailor raw persistence around frontend component structure.

---

## Phase D — Integration

When the backend public API phase is approved:

```text
FastAPI Pydantic response
        ↓
HTTP
        ↓
frontend API client
        ↓
Zod.parse(...)
        ↓
React components
```

Use Chrome DevTools to verify:

- request URL
- HTTP status
- CORS
- response shape
- no duplicate request storms
- no contract validation failures

---

## Phase E — Docker

Ownership:

```text
frontend/Dockerfile -> Antigravity
backend/Dockerfile -> Codex
compose.yaml -> integration/backend Docker phase
```

Recommended services:

```text
frontend
backend
SQLite named volume
```

No Postgres.

No Redis.

Do not change the root README yet.

---

## Phase gate rule

Each agent works one implementation phase at a time.

For every phase:

```text
implement
→ verify
→ mark only that phase complete
→ stop
→ user reviews
```

Do not automatically advance to the next phase.
