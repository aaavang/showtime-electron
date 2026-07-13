# E2E Testing Harness — Design

**Date:** 2026-07-12
**Status:** Implemented — Phases 0–5 complete (16 specs green) on branch `e2e-testing`
**Author:** aaavang + Claude

## Goal

Introduce end-to-end (e2e) testing for the Showtime Electron app so that core
functionality is verified automatically by driving the real built application
(main process + preload + renderer), not mocked units. The destination is
**full-regression coverage of the core user flows**, built incrementally in
phases on a shared harness.

## Scope & constraints

- **Coverage target:** full regression of core flows (see Coverage Map).
- **Run target:** **local only** for now — a `yarn` script on macOS. No CI
  integration in this project yet; the config is kept CI-portable so a Linux
  (`xvfb`) or Windows runner can be added later without rework.
- **No production-code changes** to enable testing. Isolation and dialog
  stubbing are achieved entirely from the test harness.

## Framework decision

**Playwright (`@playwright/test`) with its Electron support (`_electron`).**

Rejected alternatives:

- **WebdriverIO + `wdio-electron-service`** — its main advantage (built-in
  `electron`/`dialog` mocking) is neutralized because Playwright can mutate the
  main process at runtime via `electronApp.evaluate()`. Playwright wins on DX,
  auto-waiting, traces, and ecosystem.
- **Playwright against the dev-server renderer with a mocked `window.electron`**
  — not true e2e; never exercises the main process, IPC, native dialogs, or
  real audio decode. Would miss the class of bugs (Windows IPC/ArrayBuffer,
  audio-load-from-disk) this suite most needs to catch.

## Architecture

### Launch strategy

Tests run against the **production build artifact**:

- Main: `release/app/dist/main/main.js` (loads the built renderer at
  `release/app/dist/renderer/index.html`).
- A global-setup step runs `yarn build` once per test run so the suite
  exercises the real shipped bundle.
- Playwright launches Electron via `_electron.launch({ args: [mainJs, ...] })`
  using the `electron` binary from the `electron` dependency.

### Directory layout

```
e2e/
  playwright.config.ts        # electron project; traces + video retained on failure
  fixtures/
    electron-app.ts           # custom test fixture: launches Electron, yields { app, page }
    dialogs.ts                # main-process native-dialog stubs
  support/
    db.ts                     # IndexedDB / seed reset helpers
    pages/                    # page objects (one per screen)
      DancesPage.ts
      SongsPage.ts
      PlaylistPage.ts
      JukeboxPage.ts
      AudioEditorPage.ts
      SettingsPage.ts
  specs/
    *.spec.ts                 # flow suites, grouped by phase
```

Audio fixtures reuse the existing `test-tunes/` directory (short clips keep
auto-advance/playback tests fast).

### State isolation

- Each test launches its **own Electron instance** with a unique throwaway
  profile via the `--user-data-dir=<tmp>` command-line switch (Electron honors
  it), so Chromium/IndexedDB storage starts empty. No cross-test bleed; no app
  changes.
- The Dexie database is named `'showtime'` and the app **does not auto-seed**
  (seeding is a manual Settings action), so a fresh profile starts with an
  empty catalog and each test sets up exactly the data it needs.
- `support/db.ts` wraps the app's own `seedData` helpers (`seedDatabase`,
  `clearDatabase`) via `page.evaluate` for tests that want a known baseline
  rather than an empty DB.

### Native dialog stubbing (no app changes)

Native dialogs (`dialog.showOpenDialogSync`, `showSaveDialogSync`) in
`src/main/setupIPC.ts` cannot be driven by Playwright. Before triggering an
import/export, the test overrides them in the main process:

```ts
await electronApp.evaluate(
  ({ dialog }, ret) => {
    dialog.showOpenDialogSync = () => ret;
  },
  ['/abs/path/to/test-tunes/track1.mp3'],
);
```

`fixtures/dialogs.ts` provides helpers:

- `stubOpenFiles(paths: string[])`
- `stubOpenDirectory(dir: string)`
- `stubSave(path: string)`
- `stubCancel()` (dialog returns `undefined`)

### Audio strategy

Real fixture files are decoded through the real WebAudio path (works on
macOS without app changes). Tests assert **player state**, not sound output:

- playing / paused
- `currentTime` advances while playing
- track index changes on next / prev / auto-advance at track end

## Coverage Map (phased)

Each phase is delivered as its own implementation plan. Phase 0 must be green
before later phases are built; later phases reuse Phase 0's fixtures and page
objects.

### Phase 0 — Foundation

Playwright config, `electron-app` fixture, dialog stubs, `db.ts` reset helpers,
page-object skeletons, and a smoke spec: app launches → navigate all five tabs
(Showtime/PracticeTime, Dances, Songs, Playlists, Settings) → each heading
renders. **Gate:** green before proceeding.

### Phase 1 — Library & catalog CRUD

- **Songs:** import directory (stubbed → `test-tunes/`) → rows appear; search
  filters; column sort; Library Actions menu opens and `Validate Library` runs.
- **Dances:** create via the New Dance modal (title + song) → dance + default
  variant created; edit; delete (confirm dialog); search; "Play Default" opens
  the jukebox.
- **DanceDetails:** add variant; make default; edit; delete; Actions menu →
  "Edit Audio" routes to the audio editor.

### Phase 2 — Playlists & building

Create / save / save-as / load / export (XSPF, stubbed save) / clear; build a
playlist in PlaylistDetails/PracticeTime (add dances via SelectDanceModal);
reorder tracks; per-track notes; autoplay toggle; unsaved-changes indicator.

### Phase 3 — Playback (jukebox)

Open from "Play Default" and from a playlist; play/pause; `currentTime`
advances; next / prev dance; auto-advance at track end (short fixture);
show-mode guard confirm dialog when acting mid-show; notes popover; close.

### Phase 4 — Audio editor & timestamps

Load track + waveform present; trim-to-selection; fade preview; speed adjust;
key hotkeys; MP3 export (stubbed save → assert file written); timestamps add /
jump / delete.

### Phase 5 — Settings & data

Seed & clear DB; export DB (stubbed save → valid JSON on disk); import DB
(stubbed open → data appears); settings toggles (fine-grain autoplay) affect
behavior.

### Regression guards (folded into Phases 1 & 3)

Cheap tests pinning the v2.9.2 fixes:

- **(a)** The New Dance modal stays mounted and preserves typed input across a
  background re-render (guards against the render-loop/remount flicker).
- **(b)** An action-menu item near the top of a scrolled table is visible and
  clickable — not covered by the sticky header (guards the Portal fix).

## Scripts

Added to `package.json`:

- `e2e` — build then run the suite (headless-style launch on macOS).
- `e2e:headed` — run with a visible window.
- `e2e:ui` — Playwright UI mode.
- `e2e:debug` — Playwright inspector.

## Dependencies

New dev dependencies (Playwright). **`package.json` changes require user
approval before installing**, per the repository's configuration-file
protection rule. Anticipated:

- `@playwright/test`

## Out of scope (for now)

- CI integration (Linux `xvfb` / Windows runner) — deferred; config kept
  portable.
- Asserting actual audio output (device sound) — we assert player state.
- Visual regression / screenshot diffing.
- Cross-platform e2e (Windows/Linux behavior differences).

## Risks & mitigations

- **Electron isn't truly headless** — fine locally on macOS; documented
  `xvfb` note for any future Linux CI.
- **Autoplay gesture policy** — Playwright clicks count as user gestures, so
  play/auto-advance flows are drivable.
- **`--user-data-dir` behavior** — verified as the isolation mechanism; if a
  platform ever ignores it, fall back to deleting the `'showtime'` IndexedDB
  and reloading the window between tests.
- **Build coupling** — tests depend on `release/app/dist` being current; the
  global-setup `yarn build` step keeps it fresh.
