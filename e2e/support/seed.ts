import { type ElectronApplication, type Page } from '@playwright/test';
import { expect } from '../fixtures/electron-app';
import { AppNav } from './pages/AppNav';
import { SongsPage } from './pages/SongsPage';
import { DancesPage } from './pages/DancesPage';
import { DanceDetailsPage } from './pages/DanceDetailsPage';
import { stubOpenDirectory } from '../fixtures/dialogs';
import { TEST_TUNES_DIR } from './paths';

// Import the test-tunes directory into the Songs library. Leaves the app on
// the Songs page.
export async function importSongs(app: ElectronApplication, page: Page) {
  const nav = new AppNav(page);
  await nav.goTo('Songs');
  await stubOpenDirectory(app, TEST_TUNES_DIR);
  const songs = new SongsPage(page);
  await songs.importDirectory();
  await expect(songs.rowByTitle('track1')).toBeVisible();
}

// Create a dance (with a default variant) named `title`. Requires songs to
// already exist. Leaves the app on the Dances page.
export async function createDance(page: Page, title: string) {
  await new AppNav(page).goTo('Dances');
  const dances = new DancesPage(page);
  await dances.newDance();
  await dances.fillTitle(title);
  await dances.pickFirstSong();
  await dances.save();
  await expect(dances.rowByTitle(title)).toBeVisible();
}

// Import songs, create `danceTitle`, then open its default variant in the
// audio editor. Leaves the app on the Audio Editor screen.
export async function openAudioEditorForDance(
  app: ElectronApplication,
  page: Page,
  danceTitle: string,
) {
  await importSongs(app, page);
  await createDance(page, danceTitle);

  const dances = new DancesPage(page);
  await dances
    .rowByTitle(danceTitle)
    .getByRole('button', { name: 'Variants...' })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    `${danceTitle} Details`,
  );

  const details = new DanceDetailsPage(page);
  await details.openActionsFor('Default Variant');
  await details.menuItem('Edit Audio...').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Audio Editor',
  );
}
