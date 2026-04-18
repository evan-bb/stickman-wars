# Stickman Wars

Top-down 2D canvas game, plain HTML + vanilla JS. No build step.

## Run locally

```bash
node server.js        # http://localhost:3000
npm test              # vitest (see TESTING.md)
```

## Deploy

```bash
firebase deploy --only hosting   # → https://stickman-wars-13094.web.app
```

Firebase project: `stickman-wars-13094` (set in `.firebaserc`). Hosting serves the repo root; `firebase.json` ignores `node_modules`, `test/`, `server.js`, and dot-directories.

## Architecture

No bundler, no modules. `index.html` loads `js/*.js` with plain `<script>` tags in dependency order — **order matters** (`constants.js` first, `main.js` last). All classes and constants are window globals; there is no `import`/`export`.

- `js/constants.js` — all tuning values (biomes, weapons, bosses, XP table, storm)
- `js/game.js` — main loop, scene state, world generation
- `js/player.js`, `js/ai.js`, `js/boss.js` — entity behaviour
- `js/stickman.js` — shared rendering for any stick-figure
- `js/biome.js`, `js/iso.js` — terrain drawing
- `js/input.js`, `js/touch.js` — keyboard/mouse and mobile joystick
- `js/main.js` — bootstrap, canvas sizing, `new Game(...)`

## Gotchas

- **Adding a new constant or tuning value**: put it in `js/constants.js`. Referenced as a bare global everywhere else.
- **Adding a new JS file**: also add a `<script>` tag to `index.html` in the correct position relative to its dependencies.
- **Firebase ignore**: `**/.*` alone doesn't exclude files *inside* dot-directories — keep both `**/.*` and `**/.*/**` in `firebase.json`.
- **Mobile**: canvas is hidden in portrait (rotate overlay shown). Logical canvas is 1280×720, CSS-scaled to fit.
- **Persistence**: XP and unlocks live in `localStorage` (e.g. `stickman_xp`). Clearing site data resets progression.

## Testing

See [TESTING.md](TESTING.md). Tests live in `test/`, run with `npm test` (vitest). Write a regression test when fixing a bug.
