# End-to-end tests

Playwright-driven end-to-end tests that launch the **real built Electron app**
(main process + preload + renderer) and exercise core user flows.

## Running

```bash
yarn e2e          # build the app, then run the whole suite (headless-ish)
yarn e2e:headed   # same, with a visible window (useful for debugging)
yarn e2e:ui       # Playwright UI mode (does NOT rebuild — build first if stale)
yarn e2e:debug    # Playwright inspector (step through)
```

`yarn e2e` runs `yarn build` first so tests hit the current production bundle.
To run a subset without rebuilding:

```bash
npx playwright test --config e2e/playwright.config.ts dances
npx playwright test --config e2e/playwright.config.ts --grep "no flicker"
```

The HTML report (on failure) lands in `e2e/playwright-report/`; traces and video
are retained on failure under `e2e/test-results/`.

## How it works

- **Launch model:** `global-setup.ts` ensures the app is built and symlinks the
  built preload to `release/app/.erb/dll/preload.js` — the path the _unpackaged_
  `main.js` resolves (because `app.isPackaged` is `false` when Playwright launches
  the raw bundle). The `electron-app` fixture then launches Electron with
  `NODE_ENV=production` and a unique throwaway `--user-data-dir`, so each test
  starts with an empty IndexedDB (`showtime`) and no cross-test bleed.
- **No production-code changes.** Everything test-only lives under `e2e/`.
- **Native dialogs** (file/dir/save pickers) can't be driven by Playwright, so
  `fixtures/dialogs.ts` overrides them in the main process at runtime via
  `app.evaluate` (`stubOpenDirectory`, `stubOpenFiles`, `stubSave`, `stubCancel`).
- **Audio:** real fixture files in `test-tunes/` decode through the real WebAudio
  path. Tests assert player _state_ (playing/paused, time, track index), not sound.
- **Routing:** the app uses `MemoryRouter`, so the browser URL never changes —
  assert on on-screen content (headings, rows), not `page.url()`.
- **Page objects** in `support/pages/` encapsulate selectors so specs read as
  user flows and selector tweaks stay in one place.

## Coverage (Phase 0 + Phase 1)

- `smoke.spec.ts` — app launches; every nav tab renders its page.
- `songs.spec.ts` — import a directory of audio files; search/filter.
- `dances.spec.ts` — create a dance (+ default variant); delete with confirm;
  **regression guard**: the New Dance modal keeps typed input across a re-render
  (guards the v2.9.2 flicker/remount fix).
- `dance-details.spec.ts` — open a variant's Actions menu and route to the audio
  editor; **regression guard**: the menu item is clickable above the sticky
  header (guards the v2.9.2 Portal fix).

Later phases (playlists, jukebox playback, audio editor/timestamps, settings/data)
are described in `docs/superpowers/specs/2026-07-12-e2e-testing-harness-design.md`.

## Troubleshooting

- **A run was interrupted and the next run fails to launch:** a stray Electron
  process may be holding a debug port. Clear it:
  `pkill -f "Electron.app/Contents/MacOS/Electron"`.
- **Selectors changed:** run `yarn e2e:headed` or open the failure trace
  (`npx playwright show-trace e2e/test-results/<dir>/trace.zip`).

## CI portability (not wired up)

The suite is local-only for now. To run on Linux CI later, wrap the run in a
virtual display: `xvfb-run -a yarn e2e`. macOS/Windows runners can run it headed
directly. Nothing in the harness is macOS-specific except that it currently only
runs where a display (or xvfb) is available.
