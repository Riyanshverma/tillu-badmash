# Frontend

## Purpose

React client for the UK day-ahead wind forecast pilot.

The frontend visualizes backend-owned business logic. It must not independently reconstruct forecast vintages, aggregate FUELHH data, or calculate authoritative accuracy metrics.

Before making changes, read:

- [`../docs/PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md)
- [`../docs/ELEXON_API_RESEARCH.md`](../docs/ELEXON_API_RESEARCH.md)
- [`../backend/CONTRACTS.md`](../backend/CONTRACTS.md)
- [`DESIGN.md`](./DESIGN.md)

---

## Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Recharts v3
- Zod
- TanStack Query
- React Router
- Docker

Use Zod schemas as runtime response validators.

Derive TypeScript response types with:

```ts
type Example = z.infer<typeof ExampleSchema>
```

Do not duplicate interfaces manually when the corresponding Zod schema already exists.

---

## Locked data model

The frontend receives **hourly application data**.

It does not receive raw FUELHH rows for normal product rendering.

Important:

```text
WINDFOR forecast = 24 hourly target points/day
derived actual = 24 hourly actual points/day
```

The backend obtains the hourly actual by averaging the two half-hour FUELHH values corresponding to each forecast hour.

The frontend must never perform this aggregation itself.

---

## Charting decision

Use Recharts v3 for:

- 24-point wind forecast profile
- historical P90 error band
- forecast vs hourly actual
- signed hourly forecast error
- forecast evolution

Build the January error heatmap as a dedicated CSS-grid component:

```text
31 decision dates × 24 delivery hours
```

Do not add a second charting library only for the heatmap.

---

## Directory structure

Current structure:

```text
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── app.tsx
│   │   └── router.tsx
│   ├── components/
│   │   ├── charts/
│   │   │   ├── forecast-profile-chart.tsx
│   │   │   ├── forecast-vs-actual-chart.tsx
│   │   │   ├── forecast-error-chart.tsx
│   │   │   ├── forecast-evolution-chart.tsx
│   │   │   └── error-heatmap.tsx
│   │   ├── decision/
│   │   ├── accuracy/
│   │   ├── layout/
│   │   └── common/
│   ├── contracts/
│   │   ├── common.ts
│   │   ├── decision.ts
│   │   ├── accuracy.ts
│   │   ├── comparison.ts
│   │   └── evolution.ts
│   ├── lib/
│   │   ├── api-client.ts
│   │   ├── queries.ts
│   │   ├── format.ts
│   │   └── dates.ts
│   ├── pages/
│   │   ├── decision-page.tsx
│   │   └── accuracy-page.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── Dockerfile
├── package.json
├── vite.config.ts
├── DESIGN.md
└── README.md
```

---

## Required screens

### Decision

Route:

```text
/
```

Must display:

- decision date picker limited to January 2026 decision dates
- delivery date
- 09:20 Europe/London decision cutoff
- selected decision-time forecast publication
- forecast age
- average forecast
- peak forecast and hour
- historical MAE
- historical P90 absolute error
- 24-hour forecast profile
- historical P90 error band
- source/assumption note

Expected January selected forecast publication will normally be approximately:

```text
07:30Z
```

But the UI must display the actual timestamp returned by the backend.

Do not hard-code 07:30 into presentation logic.

### Accuracy

Route:

```text
/accuracy
```

Must display:

- MAE
- RMSE
- bias
- WAPE
- P90 absolute error
- over-forecast percentage
- under-forecast percentage
- forecast vs actual chart
- signed error chart
- January 31 × 24 error heatmap
- forecast-evolution panel

---

## State ownership

### Server state

Use TanStack Query for:

- decision view
- accuracy summary
- selected-day comparison
- forecast evolution

### URL state

Prefer URL/search params for shareable selected dates/target hours where useful.

### Local UI state

Use React state only for presentational interactions.

Do not introduce Redux or Zustand for this scope.

---

## Contracts and validation

Every application API response must pass through a Zod schema before reaching feature components.

Example:

```ts
const payload = await apiClient.get("/api/v1/decisions/2026-01-15")
return DecisionResponseSchema.parse(payload)
```

Pydantic backend contracts are authoritative.

Mirror:

```text
../backend/CONTRACTS.md
```

Do not create frontend schemas for raw FUELHH/WINDFOR unless a development-only tool explicitly requires them.

---

## Time handling

Backend timestamps are timezone-aware ISO strings.

Display market time using:

```text
Europe/London
```

with explicit `Intl.DateTimeFormat` timezone configuration.

Do not rely on the browser's local timezone.

For January 2026:

```text
London = GMT = UTC
```

but keep timezone handling explicit.

---

## Error convention

The backend uses:

```text
error_mw = forecast_mw - actual_mw
```

Frontend semantics:

```text
positive -> over-forecast -> red
negative -> under-forecast -> teal
```

Do not reverse this convention in charts or copy.

---

## What is out of scope

Do not implement:

- authentication
- user settings
- alternate market cutoff configuration
- demand
- thermal procurement
- prices
- weather
- notifications
- AI assistant
- mobile-native product
- speculative dashboards beyond Decision and Accuracy

---

## Docker

The frontend must have a production Dockerfile.

Expected pattern:

```text
Node build stage
→ Vite production build
→ lightweight static server
```

The root compose file will integrate frontend and backend.

---

## Quality bar

Before submission:

- TypeScript passes
- lint passes
- no browser console errors
- no unexpected API failures
- responsive layout is checked
- Decision, Accuracy, date selection, heatmap and evolution flows pass a browser smoke check
- implementation matches `DESIGN.md`

Run `npm install`, `npm run typecheck`, `npm run lint` and `npm run build` from
frontend/. See ../CLEANUP_REPORT.md for the latest verification results.
