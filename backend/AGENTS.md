# Backend Agent Instructions

You are implementing the Python/FastAPI backend of a time-boxed energy analytics assessment.

Read before coding:

1. [`README.md`](./README.md)
2. [`ARCHITECTURE.md`](./ARCHITECTURE.md)
3. [`CONTRACTS.md`](./CONTRACTS.md)
4. [`IMPLEMENTATION.md`](./IMPLEMENTATION.md)
5. [`../docs/PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md)
6. [`../docs/ELEXON_API_RESEARCH.md`](../docs/ELEXON_API_RESEARCH.md)

Work only on the user-approved implementation phase.

---

## 1. Think before coding

Surface assumptions and validate external-data behavior before encoding it.

### Superpowers skills

Use **`superpowers:brainstorming`** when:

- a domain interpretation is genuinely ambiguous
- multiple architecture approaches have meaningful tradeoffs
- a proposed change would alter the documented architecture

Use **`superpowers:writing-plans`** only if the active phase needs decomposition beyond `IMPLEMENTATION.md`; do not rewrite the whole project plan.

### Other tools

Use **Context Mode** when reading large docs or Elexon research so only current-phase context stays active.

Use **Code Graph** before modifying shared domain models, repositories, services, or public contracts to understand impact.

Do not silently pick a new business rule when `PROJECT_CONTEXT.md` already locks it.

---

## 2. Simplicity first

Use the least complex backend that satisfies the contract.

Current defaults are deliberate:

- one FastAPI service
- SQLite
- aiosqlite
- direct SQL
- Pydantic
- httpx
- NumPy only for useful numeric operations

Do not add:

- ORM
- Alembic
- Redis
- task queue
- background worker
- repository base classes
- generic service framework
- event bus
- microservices

unless the current phase proves they are necessary and the user approves the deviation.

### Superpowers skill

Use **`superpowers:brainstorming`** before proposing a new infrastructure dependency.

Use **Code Graph** to prove whether an abstraction has multiple real consumers.

---

## 3. Make surgical changes

Change only files needed for the active phase.

- preserve existing style
- avoid unrelated refactors
- keep API contract changes explicit
- do not rename public fields casually
- remove only unused code created by your change

### Tools

Use **Code Graph** before:

- moving domain functions
- changing response models
- changing repository signatures
- changing shared utilities

Review the diff before completion.

---

## 4. Goal-driven execution and tests

Use tests to define correctness for domain work.

### Superpowers skills

Use **`superpowers:test-driven-development`** for:

- decision cutoff logic
- forecast-vintage selection
- comparison alignment
- metrics
- uncertainty
- contract validation
- bug fixes in those areas

Use **`superpowers:systematic-debugging`** when:

- a test fails unexpectedly
- Elexon behavior differs from the research
- SQLite queries produce surprising results
- async/network behavior is unclear

Do not patch symptoms before identifying the cause.

Use **Context Mode** to keep the active failure, relevant code, and relevant contract in view.

---

## 5. Verify before marking a phase complete

Use **`superpowers:verification-before-completion`** before checking a phase.

Minimum verification depends on the phase but should include the checks listed in `IMPLEMENTATION.md`.

For backend phases, verification usually includes:

```text
ruff check
pytest
targeted manual endpoint/request
```

For Docker phases:

```text
docker build / docker compose
health request
database persistence check
```

When a phase passes:

1. change only that phase checkbox to `[x]`
2. summarize what changed
3. list verification commands/results
4. mention any known limitation
5. stop

Do not start the next phase until the user explicitly approves it.
