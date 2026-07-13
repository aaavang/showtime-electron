import { type ElectronApplication, type Page } from '@playwright/test';
import { test, expect } from '../fixtures/electron-app';
import { AppNav } from '../support/pages/AppNav';
import { SongsPage } from '../support/pages/SongsPage';
import { DancesPage } from '../support/pages/DancesPage';
import { stubOpenDirectory } from '../fixtures/dialogs';
import { TEST_TUNES_DIR } from '../support/paths';

async function seedSongsAndGoToDances(app: ElectronApplication, page: Page) {
  const nav = new AppNav(page);
  await nav.goTo('Songs');
  await stubOpenDirectory(app, TEST_TUNES_DIR);
  await new SongsPage(page).importDirectory();
  await expect(new SongsPage(page).rowByTitle('track1')).toBeVisible();
  await nav.goTo('Dances');
}

test('creates a dance with a default variant', async ({ app, page }) => {
  await seedSongsAndGoToDances(app, page);
  const dances = new DancesPage(page);

  await dances.newDance();
  await dances.fillTitle('Reel One');
  await dances.pickFirstSong();
  await dances.save();

  await expect(dances.rowByTitle('Reel One')).toBeVisible();
});

test('deletes a dance after confirmation', async ({ app, page }) => {
  await seedSongsAndGoToDances(app, page);
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
  await new AppNav(page).goTo('Dances');
  const dances = new DancesPage(page);
  await dances.newDance();
  await dances.fillTitle('Persisted Title');

  // Wait past the old ~200ms debounce loop window; a remount would clear input.
  await page.waitForTimeout(800);

  await expect(dances.modalTitleInput()).toHaveValue('Persisted Title');
});
