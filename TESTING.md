# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence. Without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework

**Vitest** (v4.x) with globals enabled.

## Running Tests

```bash
npx vitest run
```

Watch mode:
```bash
npx vitest
```

## Test Directory

All tests live in `test/`. File naming: `{module}.test.js`.

## Test Layers

- **Unit tests** — pure functions in `js/utils.js` and game logic. Located in `test/`. Write these for any new utility or game mechanic.
- **Integration tests** — not yet applicable (no server-side logic beyond static file serving).
- **Smoke tests** — browser-based QA via gstack `/qa`.
- **E2E tests** — future (Playwright if needed for canvas interaction testing).

## Conventions

- Use `describe`/`it` blocks with clear names
- Test real behavior with meaningful assertions (never just `toBeDefined()`)
- When fixing a bug, write a regression test
- When adding a conditional, test both paths
