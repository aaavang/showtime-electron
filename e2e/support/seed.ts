import { type ElectronApplication, type Page } from '@playwright/test';
import { expect } from '../fixtures/electron-app';
import { AppNav } from './pages/AppNav';
import { SongsPage } from './pages/SongsPage';
import { DancesPage } from './pages/DancesPage';
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
