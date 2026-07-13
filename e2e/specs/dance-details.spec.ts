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
  // seed a song + a dance with a default variant
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
  // Regression guard (b): the item is visible & clickable, not covered by the
  // sticky header (the v2.9.2 Portal fix).
  await expect(editAudio).toBeVisible();
  await editAudio.click();

  // App uses MemoryRouter, so the URL never changes — assert on the screen.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Audio Editor',
  );
});
