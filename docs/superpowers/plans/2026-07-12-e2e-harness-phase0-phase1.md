# E2E Harness — Phase 0 + Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Playwright-Electron e2e harness that drives the real built app, then cover the app-shell smoke path and the Library/catalog CRUD flows (Songs import, Dances CRUD, Dance variants), including regression guards for the v2.9.2 fixes.

**Architecture:** Playwright's `_electron` API launches the production-built `release/app/dist/main/main.js` with a throwaway `--user-data-dir` (empty IndexedDB per test) and `NODE_ENV=production`. A global-setup step runs `yarn build` and exposes the built preload at the path the unpackaged main expects. Native OS dialogs are stubbed at runtime via `electronApp.evaluate`. Page objects encapsulate selectors; specs read as user flows.

**Tech Stack:** `@playwright/test`, Electron 35, React 18, Chakra UI 2, Dexie 4, TanStack Table, Tone.js. TypeScript throughout.

## Global Constraints

- **Run target:** local (macOS) only. No CI wiring. Keep config CI-portable.
- **No production-code changes** to enable testing (harness-only: launch args, runtime dialog stubs, global-setup preload shim).
- **State isolation:** every test launches its own Electron instance with a unique temp `--user-data-dir`; Dexie DB name is `'showtime'`; the app does NOT auto-seed (fresh profile = empty catalog).
- **Launch env:** `NODE_ENV=production` (so the app loads the built renderer via `file://` and skips dev DevTools).
- **Preload shim:** unpackaged `main.js` (`app.isPackaged === false`) resolves preload to `release/app/.erb/dll/preload.js`; global-setup symlinks that to `../../dist/main/preload.js`.
- **jest vs playwright:** jest tests live in `src/__tests__` (unchanged); Playwright `testDir` is `e2e/specs`. They must not collect each other's files.
- **Verified selectors:** nav tabs have `role="tab"` with names `Showtime|Dances|Songs|Playlists|Settings`; page title is an `h1` (`getByRole('heading', { level: 1 })`); home heading text is `Practice Time`.
- **Delete confirmation** uses `window.confirm` (handle via `page.on('dialog')`).

---

## File Structure

```
e2e/
  playwright.config.ts        # electron test config
  global-setup.ts             # yarn build + preload symlink
  fixtures/
    electron-app.ts           # `test` fixture extended with { app, page }
    dialogs.ts                # stubOpenFiles/stubOpenDirectory/stubSave/stubCancel
  support/
    paths.ts                  # repo/build/fixture path constants
    pages/
      AppNav.ts               # tab navigation + heading assertions
      SongsPage.ts
      DancesPage.ts
      DanceDetailsPage.ts
  specs/
    smoke.spec.ts             # Phase 0
    songs.spec.ts             # Phase 1
    dances.spec.ts            # Phase 1 (+ modal regression guard)
    dance-details.spec.ts     # Phase 1
package.json                  # add e2e scripts + @playwright/test (already installed)
.gitignore                    # ignore release/app/.erb, e2e artifacts
```

---

## Task 1: Playwright config, paths, and global-setup

**Files:**

- Create: `e2e/support/paths.ts`
- Create: `e2e/global-setup.ts`
- Create: `e2e/playwright.config.ts`
- Modify: `package.json` (scripts), `.gitignore`

**Interfaces:**

- Produces: `paths.ts` exports `REPO_ROOT`, `MAIN_JS`, `PRELOAD_BUILT`, `PRELOAD_SHIM`, `TEST_TUNES_DIR`, `ELECTRON_BIN`.
- Produces: `global-setup.ts` default-exports an async fn (Playwright globalSetup).
- Produces: config sets `testDir: './specs'`, `globalSetup`, retained trace/video on failure, single worker.

- [ ] **Step 1: Write `e2e/support/paths.ts`**

```ts
import path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '../..');
export const MAIN_JS = path.join(REPO_ROOT, 'release/app/dist/main/main.js');
export const PRELOAD_BUILT = path.join(
  REPO_ROOT,
  'release/app/dist/main/preload.js',
);
// Where the unpackaged main (app.isPackaged === false) looks for the preload.
export const PRELOAD_SHIM = path.join(
  REPO_ROOT,
  'release/app/.erb/dll/preload.js',
);
export const TEST_TUNES_DIR = path.join(REPO_ROOT, 'test-tunes');
// eslint-disable-next-line import/no-dynamic-require, global-require
export const ELECTRON_BIN = require(
  path.join(REPO_ROOT, 'node_modules/electron'),
) as unknown as string;
```

- [ ] **Step 2: Write `e2e/global-setup.ts`**

```ts
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  MAIN_JS,
  PRELOAD_BUILT,
  PRELOAD_SHIM,
  REPO_ROOT,
} from './support/paths';

export default async function globalSetup() {
  // Build the app if the main bundle is missing or stale-ish.
  if (!fs.existsSync(MAIN_JS)) {
    execSync('yarn build', { cwd: REPO_ROOT, stdio: 'inherit' });
  }
  if (!fs.existsSync(PRELOAD_BUILT)) {
    throw new Error(
      `Built preload missing at ${PRELOAD_BUILT}. Run \`yarn build\`.`,
    );
  }
  // Expose the built preload where the unpackaged main resolves it.
  fs.mkdirSync(path.dirname(PRELOAD_SHIM), { recursive: true });
  if (fs.existsSync(PRELOAD_SHIM)) fs.rmSync(PRELOAD_SHIM);
  fs.symlinkSync(
    path.relative(path.dirname(PRELOAD_SHIM), PRELOAD_BUILT),
    PRELOAD_SHIM,
  );
}
```

- [ ] **Step 3: Write `e2e/playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: { trace: 'retain-on-failure', video: 'retain-on-failure' },
});
```

- [ ] **Step 4: Add scripts to `package.json`**

Add to `"scripts"`:

```json
"e2e": "yarn build && playwright test --config e2e/playwright.config.ts",
"e2e:headed": "yarn build && playwright test --config e2e/playwright.config.ts --headed",
"e2e:ui": "playwright test --config e2e/playwright.config.ts --ui",
"e2e:debug": "playwright test --config e2e/playwright.config.ts --debug"
```

- [ ] **Step 5: Update `.gitignore`**

Append:

```
# e2e
release/app/.erb
e2e/playwright-report
e2e/test-results
```

- [ ] **Step 6: Commit**

```bash
git add e2e/support/paths.ts e2e/global-setup.ts e2e/playwright.config.ts package.json .gitignore
git commit -m "test(e2e): playwright config, paths, and global-setup preload shim"
```

---

## Task 2: Electron-app fixture

**Files:**

- Create: `e2e/fixtures/electron-app.ts`

**Interfaces:**

- Consumes: `paths.ts` constants.
- Produces: `export const test` — Playwright `test` extended with fixtures `app: ElectronApplication` and `page: Page` (first renderer window, React mounted). `export { expect } from '@playwright/test'`.

- [ ] **Step 1: Write the fixture**

```ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  _electron,
  test as base,
  expect,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import { ELECTRON_BIN, MAIN_JS } from '../support/paths';

type Fixtures = { app: ElectronApplication; page: Page };

export const test = base.extend<Fixtures>({
  app: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showtime-e2e-'));
    const app = await _electron.launch({
      executablePath: ELECTRON_BIN,
      args: [MAIN_JS, `--user-data-dir=${userDataDir}`],
      env: { ...process.env, NODE_ENV: 'production' },
      timeout: 30_000,
    });
    await use(app);
    await app.close().catch(() => {});
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow({ timeout: 30_000 });
    await page.waitForLoadState('domcontentloaded');
    // React has mounted once the nav tabs are present.
    await page
      .getByRole('tab', { name: 'Dances' })
      .waitFor({ timeout: 20_000 });
    await use(page);
  },
});

export { expect };
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fixtures/electron-app.ts
git commit -m "test(e2e): electron-app fixture with isolated userData"
```

---

## Task 3: Phase 0 smoke spec (app shell + nav)

**Files:**

- Create: `e2e/support/pages/AppNav.ts`
- Create: `e2e/specs/smoke.spec.ts`

**Interfaces:**

- Consumes: `test`, `expect` from the fixture.
- Produces: `AppNav` class — `constructor(page)`, `goTo(tab: 'Showtime'|'Dances'|'Songs'|'Playlists'|'Settings')`, `heading(): Locator`.

- [ ] **Step 1: Write `AppNav.ts`**

```ts
import { type Page, type Locator } from '@playwright/test';

export type Tab = 'Showtime' | 'Dances' | 'Songs' | 'Playlists' | 'Settings';

export class AppNav {
  constructor(private page: Page) {}

  async goTo(tab: Tab) {
    await this.page.getByRole('tab', { name: tab }).click();
  }

  heading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }
}
```

- [ ] **Step 2: Write the failing smoke test**

```ts
import { test, expect } from '../fixtures/electron-app';
import { AppNav } from '../support/pages/AppNav';

test('app launches and every tab renders its page', async ({ page }) => {
  const nav = new AppNav(page);

  await expect(page).toHaveTitle('Showtime!');
  await expect(nav.heading()).toHaveText('Practice Time');

  await nav.goTo('Dances');
  await expect(nav.heading()).toHaveText('Dances');

  await nav.goTo('Songs');
  await expect(nav.heading()).toHaveText('Songs');

  await nav.goTo('Playlists');
  await expect(nav.heading()).toHaveText('Playlists');

  await nav.goTo('Settings');
  await expect(nav.heading()).toHaveText('Settings');
});
```

- [ ] **Step 3: Run and verify it passes**

Run: `yarn e2e --grep "every tab"`
Expected: 1 passed. (This is the harness gate — must be green before Task 4+.)

- [ ] **Step 4: Commit**

```bash
git add e2e/support/pages/AppNav.ts e2e/specs/smoke.spec.ts
git commit -m "test(e2e): phase 0 app-shell smoke spec"
```

---

## Task 4: Dialog stubs + Songs import spec

**Files:**

- Create: `e2e/fixtures/dialogs.ts`
- Create: `e2e/support/pages/SongsPage.ts`
- Create: `e2e/specs/songs.spec.ts`

**Interfaces:**

- Consumes: `ElectronApplication`, `TEST_TUNES_DIR`.
- Produces: `dialogs.ts` — `stubOpenDirectory(app, dir)`, `stubOpenFiles(app, paths)`, `stubSave(app, path)`, `stubCancel(app)`. Each mutates the main process `dialog` module.
- Produces: `SongsPage` — `openLibraryActions()`, `importDirectory()`, `rowByTitle(t)`, `search(q)`.

Behavior facts (verified): `importDirectory` sends `getAudioFilesInDirectory`; main calls `dialog.showOpenDialogSync({properties:['openDirectory']})`, walks the returned dir, replies with the mp3 paths; the renderer adds each as a song titled after the filename (e.g. `track1`). Library Actions is a Chakra `Menu` (portalled) with items `Import Directory...` and `Validate Library`.

- [ ] **Step 1: Write `dialogs.ts`**

```ts
import { type ElectronApplication } from '@playwright/test';

export async function stubOpenDirectory(app: ElectronApplication, dir: string) {
  await app.evaluate(({ dialog }, d) => {
    dialog.showOpenDialogSync = () => [d];
  }, dir);
}

export async function stubOpenFiles(app: ElectronApplication, paths: string[]) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialogSync = () => p;
  }, paths);
}

export async function stubSave(app: ElectronApplication, savePath: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialogSync = () => p;
  }, savePath);
}

export async function stubCancel(app: ElectronApplication) {
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialogSync = () => undefined;
    dialog.showSaveDialogSync = () => undefined;
  });
}
```

- [ ] **Step 2: Write `SongsPage.ts`**

```ts
import { type Page } from '@playwright/test';

export class SongsPage {
  constructor(private page: Page) {}

  async importDirectory() {
    await this.page.getByRole('button', { name: /Library Actions/ }).click();
    await this.page.getByRole('menuitem', { name: /Import Directory/ }).click();
  }

  rowByTitle(title: string) {
    return this.page.getByRole('row', { name: new RegExp(title) });
  }

  async search(query: string) {
    await this.page.getByPlaceholder('Search...').fill(query);
  }
}
```

- [ ] **Step 3: Write the failing Songs import test**

```ts
import { test, expect } from '../fixtures/electron-app';
import { AppNav } from '../support/pages/AppNav';
import { SongsPage } from '../support/pages/SongsPage';
import { stubOpenDirectory } from '../fixtures/dialogs';
import { TEST_TUNES_DIR } from '../support/paths';

test('imports a directory of audio files into the library', async ({
  app,
  page,
}) => {
  await new AppNav(page).goTo('Songs');
  const songs = new SongsPage(page);

  await stubOpenDirectory(app, TEST_TUNES_DIR);
  await songs.importDirectory();

  await expect(songs.rowByTitle('track1')).toBeVisible();
  await expect(songs.rowByTitle('track2')).toBeVisible();

  await songs.search('track1');
  await expect(songs.rowByTitle('track1')).toBeVisible();
  await expect(songs.rowByTitle('track2')).toHaveCount(0);
});
```

- [ ] **Step 4: Run and verify**

Run: `yarn e2e --grep "imports a directory"`
Expected: 1 passed. If the menu item selector differs, adjust `SongsPage` selectors against the actual DOM (portalled MenuList renders at body root — `getByRole('menuitem')` still finds it).

- [ ] **Step 5: Commit**

```bash
git add e2e/fixtures/dialogs.ts e2e/support/pages/SongsPage.ts e2e/specs/songs.spec.ts
git commit -m "test(e2e): dialog stubs and songs import spec"
```

---

## Task 5: Dances CRUD spec + modal regression guard

**Files:**

- Create: `e2e/support/pages/DancesPage.ts`
- Create: `e2e/specs/dances.spec.ts`

**Interfaces:**

- Consumes: `SongsPage` (to seed a song for the New Dance song-select), `stubOpenDirectory`.
- Produces: `DancesPage` — `newDance()`, `fillTitle(t)`, `pickFirstSong()`, `save()`, `rowByTitle(t)`, `deleteDance(t)`, `modalTitleInput()`.

Behavior facts (verified): "+ New Dance" opens a modal (header `New Dance`) with a Title `Input`, a react-select song picker (`defaultOptions` loads from `database.songs`), and `Save`/`Cancel`. Saving requires a title; it creates the dance plus a default variant. Delete uses `window.confirm`. The New Dance modal is the component whose flicker was fixed in v2.9.2.

- [ ] **Step 1: Write `DancesPage.ts`**

```ts
import { type Page } from '@playwright/test';

export class DancesPage {
  constructor(private page: Page) {}

  async newDance() {
    await this.page.getByRole('button', { name: '+ New Dance' }).click();
    await this.page.getByRole('heading', { name: 'New Dance' }).waitFor();
  }

  modalTitleInput() {
    return this.page.getByRole('dialog').getByRole('textbox').first();
  }

  async fillTitle(title: string) {
    await this.modalTitleInput().fill(title);
  }

  async pickFirstSong() {
    // react-select: open menu and choose the first option
    await this.page
      .getByRole('dialog')
      .locator('input[id^="react-select"]')
      .click();
    await this.page
      .locator('[id^="react-select"][id*="option-0"]')
      .first()
      .click();
  }

  async save() {
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  rowByTitle(title: string) {
    return this.page.getByRole('row', { name: new RegExp(title) });
  }

  async deleteDance(title: string) {
    await this.rowByTitle(title)
      .getByRole('button', { name: 'Delete' })
      .click();
  }
}
```

- [ ] **Step 2: Write the failing Dances CRUD test**

```ts
import { test, expect } from '../fixtures/electron-app';
import { AppNav } from '../support/pages/AppNav';
import { SongsPage } from '../support/pages/SongsPage';
import { DancesPage } from '../support/pages/DancesPage';
import { stubOpenDirectory } from '../fixtures/dialogs';
import { TEST_TUNES_DIR } from '../support/paths';

async function seedSongs(app, page) {
  const nav = new AppNav(page);
  await nav.goTo('Songs');
  await stubOpenDirectory(app, TEST_TUNES_DIR);
  await new SongsPage(page).importDirectory();
  await expect(new SongsPage(page).rowByTitle('track1')).toBeVisible();
  await nav.goTo('Dances');
}

test('creates a dance with a default variant', async ({ app, page }) => {
  await seedSongs(app, page);
  const dances = new DancesPage(page);

  await dances.newDance();
  await dances.fillTitle('Reel One');
  await dances.pickFirstSong();
  await dances.save();

  await expect(dances.rowByTitle('Reel One')).toBeVisible();
});

test('deletes a dance after confirmation', async ({ app, page }) => {
  await seedSongs(app, page);
  const dances = new DancesPage(page);
  await dances.newDance();
  await dances.fillTitle('Temp Dance');
  await dances.pickFirstSong();
  await dances.save();
  await expect(dances.rowByTitle('Temp Dance')).toBeVisible();

  page.on('dialog', (d) => d.accept());
  await dances.deleteDance('Temp Dance');
  await expect(dances.rowByTitle('Temp Dance')).toHaveCount(0);
});

// Regression guard (v2.9.2): the New Dance modal must not remount/flicker —
// typed input must survive a background re-render of the page.
test('new-dance modal keeps input across re-render (no flicker remount)', async ({
  page,
}) => {
  const dances = new DancesPage(page);
  await dances.newDance();
  await dances.fillTitle('Persisted Title');

  // Wait past the old ~200ms debounce loop window; a remount would clear input.
  await page.waitForTimeout(800);

  await expect(dances.modalTitleInput()).toHaveValue('Persisted Title');
});
```

- [ ] **Step 3: Run and verify**

Run: `yarn e2e --grep "dance"`
Expected: 3 passed. Adjust react-select option selector if the built markup differs (verify via `--headed`/trace).

- [ ] **Step 4: Commit**

```bash
git add e2e/support/pages/DancesPage.ts e2e/specs/dances.spec.ts
git commit -m "test(e2e): dances CRUD + new-dance modal regression guard"
```

---

## Task 6: Dance variants (DanceDetails) spec

**Files:**

- Create: `e2e/support/pages/DanceDetailsPage.ts`
- Create: `e2e/specs/dance-details.spec.ts`

**Interfaces:**

- Consumes: `DancesPage`, `SongsPage`.
- Produces: `DanceDetailsPage` — `openActionsFor(variantTitle)`, `menuItem(name)`, `variantRow(title)`.

Behavior facts (verified): from Dances, "Variants..." routes to `/dances/:id` (heading `<title> Details`). Each variant row has an `Actions` Chakra `Menu` (portalled) with `Make Default`, `Edit...`, `Edit Audio...`, `Delete`. Non-default variants show `Make Default`.

- [ ] **Step 1: Write `DanceDetailsPage.ts`**

```ts
import { type Page } from '@playwright/test';

export class DanceDetailsPage {
  constructor(private page: Page) {}

  variantRow(title: string) {
    return this.page.getByRole('row', { name: new RegExp(title) });
  }

  async openActionsFor(variantTitle: string) {
    await this.variantRow(variantTitle)
      .getByRole('button', { name: 'Actions' })
      .click();
  }

  menuItem(name: string) {
    return this.page.getByRole('menuitem', { name });
  }
}
```

- [ ] **Step 2: Write the failing test (regression guard (b): menu item usable near sticky header)**

```ts
import { test, expect } from '../fixtures/electron-app';
import { AppNav } from '../support/pages/AppNav';
import { SongsPage } from '../support/pages/SongsPage';
import { DancesPage } from '../support/pages/DancesPage';
import { DanceDetailsPage } from '../support/pages/DanceDetailsPage';
import { stubOpenDirectory } from '../fixtures/dialogs';
import { TEST_TUNES_DIR } from '../support/paths';

test('variant Actions menu opens above the sticky header and Edit Audio routes to the editor', async ({
  app,
  page,
}) => {
  // seed a song + a dance
  const nav = new AppNav(page);
  await nav.goTo('Songs');
  await stubOpenDirectory(app, TEST_TUNES_DIR);
  await new SongsPage(page).importDirectory();
  await expect(new SongsPage(page).rowByTitle('track1')).toBeVisible();
  await nav.goTo('Dances');

  const dances = new DancesPage(page);
  await dances.newDance();
  await dances.fillTitle('Jig One');
  await dances.pickFirstSong();
  await dances.save();

  await dances
    .rowByTitle('Jig One')
    .getByRole('button', { name: 'Variants...' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Jig One Details',
  );

  const details = new DanceDetailsPage(page);
  await details.openActionsFor('Default Variant');
  const editAudio = details.menuItem('Edit Audio...');
  // Regression guard (b): the item is visible & clickable, not covered by header.
  await expect(editAudio).toBeVisible();
  await editAudio.click();

  await expect(page).toHaveURL(/audio-editor/);
});
```

- [ ] **Step 3: Run and verify**

Run: `yarn e2e --grep "Actions menu"`
Expected: 1 passed. If the default variant title differs, read it from the row (it is `Default Variant for <dance>` per `saveDance`), and adjust the regex.

- [ ] **Step 4: Commit**

```bash
git add e2e/support/pages/DanceDetailsPage.ts e2e/specs/dance-details.spec.ts
git commit -m "test(e2e): dance variant actions + sticky-header menu regression guard"
```

---

## Task 7: Full run + README

**Files:**

- Create: `e2e/README.md`

- [ ] **Step 1: Run the whole suite**

Run: `yarn e2e`
Expected: all specs pass. Triage any flake (increase specific waits, prefer role/text selectors, assert on state not timing).

- [ ] **Step 2: Write `e2e/README.md`**

Document: how to run (`yarn e2e`, `:headed`, `:ui`, `:debug`), the launch model (prod build + preload shim + isolated userData), how dialog stubbing works, and the CI-portability note (Linux needs `xvfb-run`).

- [ ] **Step 3: Commit**

```bash
git add e2e/README.md
git commit -m "docs(e2e): how to run and extend the suite"
```

---

## Self-Review Notes

- **Spec coverage:** Phase 0 (smoke) = Task 3. Phase 1 Songs = Task 4; Dances = Task 5; DanceDetails = Task 6. Regression guard (a) = Task 5; guard (b) = Task 6. Harness (config/isolation/dialog stubs) = Tasks 1–2, 4.
- **Deferred to later plans:** Phases 2–5 (playlists, jukebox playback, audio editor/timestamps, settings/data).
- **Known selector risks:** react-select option markup and Chakra portalled `menuitem` roles are verified by running under `--headed`/trace during implementation; page objects localize any fixes.
