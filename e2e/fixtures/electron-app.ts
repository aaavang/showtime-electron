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
