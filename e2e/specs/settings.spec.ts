import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '../fixtures/electron-app';
import { AppNav } from '../support/pages/AppNav';
import { SettingsPage } from '../support/pages/SettingsPage';
import { stubSave, stubOpenFiles } from '../fixtures/dialogs';

test('seeds and purges the database', async ({ page }) => {
  const nav = new AppNav(page);
  const settings = new SettingsPage(page);

  await nav.goTo('Settings');
  await settings.seed();

  await nav.goTo('Dances');
  await expect(page.getByRole('row', { name: /Waltz/ })).toBeVisible();

  await nav.goTo('Settings');
  await settings.purge();

  await nav.goTo('Dances');
  await expect(page.getByRole('row', { name: /Waltz/ })).toHaveCount(0);
});

test('fine-grained autoplay setting persists across navigation', async ({
  page,
}) => {
  const nav = new AppNav(page);
  const settings = new SettingsPage(page);

  await nav.goTo('Settings');
  await expect(settings.autoplayCheckbox()).not.toBeChecked();

  await settings.toggleAutoplay();
  await expect(settings.autoplayCheckbox()).toBeChecked();

  await nav.goTo('Dances');
  await nav.goTo('Settings');
  await expect(settings.autoplayCheckbox()).toBeChecked();
});

test('exports and re-imports the database (round trip)', async ({
  app,
  page,
}) => {
  const nav = new AppNav(page);
  const settings = new SettingsPage(page);

  await nav.goTo('Settings');
  await settings.seed();
  await nav.goTo('Dances');
  await expect(page.getByRole('row', { name: /Waltz/ })).toBeVisible();

  // Export to a temp JSON file.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'showtime-e2e-db-'));
  const dumpPath = path.join(dir, 'dump.json');
  await stubSave(app, dumpPath);
  await nav.goTo('Settings');
  await settings.exportDb();
  await expect
    .poll(() => fs.existsSync(dumpPath), { timeout: 15_000 })
    .toBe(true);
  const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
  expect(dump.dances.length).toBeGreaterThan(0);

  // Purge, confirm empty.
  await settings.purge();
  await nav.goTo('Dances');
  await expect(page.getByRole('row', { name: /Waltz/ })).toHaveCount(0);

  // Import the dump back and confirm the data returns.
  await stubOpenFiles(app, [dumpPath]);
  await nav.goTo('Settings');
  await settings.importDb();
  await nav.goTo('Dances');
  await expect(page.getByRole('row', { name: /Waltz/ })).toBeVisible();

  fs.rmSync(dir, { recursive: true, force: true });
});
