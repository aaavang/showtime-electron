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
