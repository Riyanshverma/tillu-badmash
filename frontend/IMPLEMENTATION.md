# Frontend Implementation Plan

## Execution rule

Work one phase at a time.

At the beginning of a phase:

1. read the phase goal
2. read its acceptance criteria
3. inspect relevant code
4. implement only that phase
5. verify it
6. mark only that phase complete
7. stop for user review

Do not automatically start the next phase.

---

## [x] Phase 0 — Contract lock and typed fixtures

### Goal

Build against verified application contracts, not guessed Elexon payloads.

### Research prerequisite

Live Elexon research is complete.

Read:

```text
../docs/ELEXON_API_RESEARCH.md
```

Key facts:

```text
WINDFOR = hourly
FUELHH = half-hourly
backend comparison = hourly
decision profile = 24 points/day
January heatmap = 31 × 24
decision cutoff = 09:20 Europe/London
typical January selected vintage = 07:30Z
```

### Tasks

- Read `../backend/CONTRACTS.md`.
- Create frontend Zod schemas mirroring every public API response.
- Derive response types using `z.infer`.
- Create typed fixtures for:
  - decision response
  - accuracy response
  - daily comparison
  - forecast evolution
- Fixture decision/comparison series must contain 24 hourly points, not 48.
- Include a realistic evolution fixture where:
  - 07:30 is selected
  - 09:30 is post-cutoff
- Do not call Elexon directly from frontend.

### Verify

- all valid fixtures parse
- intentionally invalid fixtures fail
- no duplicate manual API interfaces
- TypeScript passes

### Stop condition

Mark Phase 0 complete and stop.

---

## [x] Phase 1 — Project foundation

### Goal

Create the React/Vite foundation and application shell.

### Tasks

- initialize React + TypeScript + Vite
- add Tailwind CSS
- initialize shadcn/ui
- add:
  - Zod
  - TanStack Query
  - React Router
  - Recharts
  - Vitest
  - React Testing Library
- add shadcn chart support
- create:
  - router
  - providers
  - query client
  - API client shell
  - formatting utilities
  - Europe/London date formatter
- implement app shell/top navigation
- add routes:
  - `/`
  - `/accuracy`
- add basic not-found/error boundary
- add `.env.example`
- create frontend Dockerfile

### Verify

- app boots
- both routes render
- no console errors
- TypeScript passes
- lint passes
- base tests pass
- Docker image builds
- Playwright can navigate both routes

### Stop condition

Mark Phase 1 complete and stop.

---

## [ ] Phase 2 — Design system and static Decision view

### Goal

Implement the Decision page visually using typed fixtures only.

### Tasks

- map `DESIGN.md` tokens to Tailwind/CSS variables
- implement:
  - page header
  - January decision-date selector
  - decision context strip
  - metric cards
  - forecast profile
  - historical P90 band
  - methodology/source note
- use a 24-point hourly fixture
- display selected forecast publication timestamp from fixture
- display forecast age from fixture
- use hourly x-axis semantics

### Verify

Use Playwright at:

```text
1440px
1024px
390px
```

Use Chrome DevTools for:

- console
- overflow
- chart sizing
- accessibility basics

Acceptance:

- layout matches DESIGN.md
- no half-hour forecast assumptions
- no hard-coded 07:30 presentation rule
- no production API calls

### Stop condition

Mark Phase 2 complete and stop.

---

## [ ] Phase 3 — Static Accuracy view

### Goal

Implement all accuracy visualizations from typed hourly fixtures.

### Tasks

Implement:

- metric cards
- 24-point forecast-vs-actual chart
- 24-point signed error chart
- 31 × 24 error heatmap
- forecast-evolution chart
- selected decision vintage marker
- 09:20 cutoff marker
- actual reference line
- methodology note

### Verify

- positive error is red
- negative error is teal
- zero reference is visible
- heatmap has exactly 24 hourly columns
- evolution shows 07:30 selected in the representative fixture
- 09:30 is visibly post-cutoff
- browser-local timezone does not alter market times
- no console errors

### Stop condition

Mark Phase 3 complete and stop.

---

## [ ] Phase 4 — Backend integration and runtime validation

### Goal

Replace fixtures with real FastAPI responses while keeping Zod validation.

### Tasks

- implement API functions using `VITE_API_BASE_URL`
- parse every response through Zod
- add TanStack Query hooks
- connect decision date selection
- connect accuracy response
- connect daily comparison
- connect heatmap selection
- connect forecast evolution target selection
- add:
  - loading states
  - API error states
  - contract failure state
  - no-data state

### Verify

Chrome DevTools Network:

- correct endpoints
- no accidental request storms
- no failed CORS requests
- real response passes Zod

Playwright:

- test at least 3 January decision dates
- verify Decision metadata changes
- verify each selected day has 24 forecast points when complete
- navigate to Accuracy
- inspect heatmap
- inspect forecast evolution

### Stop condition

Mark Phase 4 complete and stop.

---

## [ ] Phase 5 — Quality and Docker integration

### Goal

Make the frontend assessment-ready.

### Tests

Add focused tests for:

- Zod parsing
- error-sign semantics
- MW/GW formatting
- Europe/London formatting
- decision context rendering
- 24-hour series assumptions
- no-data state
- contract-error state
- heatmap color-bucket logic

### Verify

Required:

```text
typecheck passes
lint passes
unit/component tests pass
production build passes
Docker build passes
compose-integrated frontend renders
no production console errors
```

Run a final Playwright smoke flow.

Use Chrome DevTools to inspect obvious:

- failed requests
- layout issues
- oversized assets
- long tasks

Do not spend assessment time on speculative micro-optimization.

### Stop condition

Mark Phase 5 complete and stop.
