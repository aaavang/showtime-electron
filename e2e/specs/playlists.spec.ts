import { test, expect } from '../fixtures/electron-app';
import { AppNav } from '../support/pages/AppNav';
import { PracticeTimePage } from '../support/pages/PracticeTimePage';
import { PlaylistsPage } from '../support/pages/PlaylistsPage';
import { importSongs, createDance } from '../support/seed';

test('builds a playlist, saves it, and it appears in the Playlists list', async ({
  app,
  page,
}) => {
  await importSongs(app, page);
  await createDance(page, 'Reel A');

  const nav = new AppNav(page);
  await nav.goTo('Showtime');
  const home = new PracticeTimePage(page);

  await home.addFirstDance();
  await expect(home.trackRow('Reel A')).toBeVisible();
  await expect(home.unsavedIndicator()).toBeVisible();

  await home.saveAs('My Set');
  await expect(home.unsavedIndicator()).toHaveCount(0);

  await nav.goTo('Playlists');
  await expect(new PlaylistsPage(page).rowByTitle('My Set')).toBeVisible();
});

test('loads a saved playlist back onto the home screen', async ({
  app,
  page,
}) => {
  await importSongs(app, page);
  await createDance(page, 'Reel A');

  const nav = new AppNav(page);
  await nav.goTo('Showtime');
  const home = new PracticeTimePage(page);
  await home.addFirstDance();
  await home.saveAs('My Set');

  // Clear the current session, then load the saved playlist from the list.
  await home.clear();
  await expect(home.trackRow('Reel A')).toHaveCount(0);

  await nav.goTo('Playlists');
  await new PlaylistsPage(page).load('My Set');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Practice Time - My Set',
  );
  await expect(home.trackRow('Reel A')).toBeVisible();
});

test('clears the current playlist', async ({ app, page }) => {
  await importSongs(app, page);
  await createDance(page, 'Reel A');

  await new AppNav(page).goTo('Showtime');
  const home = new PracticeTimePage(page);
  await home.addFirstDance();
  await expect(home.trackRow('Reel A')).toBeVisible();

  await home.clear();
  await expect(home.trackRow('Reel A')).toHaveCount(0);
});
