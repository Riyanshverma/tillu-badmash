# Frontend Agent Instructions

You are implementing the frontend of a time-boxed energy analytics assessment.

Read these before coding:

1. [`README.md`](./README.md)
2. [`DESIGN.md`](./DESIGN.md)
3. [`IMPLEMENTATION.md`](./IMPLEMENTATION.md)
4. [`../docs/PROJECT_CONTEXT.md`](../docs/PROJECT_CONTEXT.md)
5. [`../backend/CONTRACTS.md`](../backend/CONTRACTS.md)

The implementation plan controls sequencing. Work only on the currently approved phase.

---

## 1. Think before coding

Do not silently invent product behavior or API shapes.

Before each phase:

- read the relevant docs
- state assumptions briefly
- identify any conflict between docs and code
- prefer the documented product rule over ad-hoc UI logic

### Tools to use

**Context Mode**
- Use when reading large project/docs context.
- Use it to keep the active context focused on the current phase.
- Prefer it over repeatedly loading unrelated files.

**Code Graph**
- Use before changing shared components, routing, contracts, or API utilities.
- Use it to understand callers/dependencies and avoid accidental cross-feature breakage.

**Playwright MCP**
- Do not use as a substitute for thinking.
- Use after a UI flow exists to verify user-visible behavior.

**Chrome DevTools MCP**
- Use when browser behavior is ambiguous: network, console, layout, performance, accessibility tree.

If a simpler interpretation satisfies the locked requirements, use it.

---

## 2. Simplicity first

Build the minimum frontend that solves the documented product problem.

Do not add:

- state-management libraries beyond TanStack Query + React state
- new design systems
- alternate chart libraries
- authentication
- speculative filters
- exchange/cutoff configuration
- generic component abstractions used once
- visual effects not present in DESIGN.md

### Tool rule

Use **Code Graph** before introducing a new abstraction. If only one caller exists and no concrete second use is present, keep the code local.

Use **Context Mode** to compare the requested behavior against `README.md` and `DESIGN.md` before adding a dependency.

---

## 3. Make surgical changes

Touch only files required by the active phase.

- Match established naming/style.
- Do not reformat unrelated files.
- Do not refactor working adjacent code without a phase requirement.
- Remove only unused code created by your own changes.
- If you notice unrelated problems, report them without fixing them.

### Tool rule

Use **Code Graph** before refactoring or moving exported code.

Use **git diff** or the harness's equivalent review view before declaring a phase complete.

---

## 4. Execute toward verifiable goals

Every task must end in a concrete check.

Examples:

```text
"Add Decision page" ->
render fixture ->
verify semantic metadata ->
verify chart ->
verify 1440/1024/390 layouts
```

```text
"Connect backend" ->
request API ->
parse with Zod ->
render response ->
test loading/error/invalid-contract cases
```

### Tools to use

**Playwright MCP**
- Required for each completed UI phase.
- Exercise the exact acceptance flow from `IMPLEMENTATION.md`.
- Use screenshots when visual comparison helps.

**Chrome DevTools MCP**
- Required for integration phase network validation.
- Check console errors, request failures, layout overflow, and obvious performance issues.

**Context Mode**
- Re-read only the active phase acceptance criteria before verification.

Do not mark a phase complete unless its checks pass.

---

## 5. Verify, mark one phase, then stop

The user is reviewing every phase manually.

When a phase is complete:

1. run the phase checks
2. update only that phase from `[ ]` to `[x]`
3. summarize files changed
4. summarize verification performed
5. stop

Do not begin the next phase until the user explicitly approves it.

### Final verification tools

Use:

- Playwright MCP for interaction/regression smoke
- Chrome DevTools MCP for console/network/layout
- Code Graph if the final change touched shared dependencies

A phase is not complete merely because the page "looks right."
