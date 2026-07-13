import { test, expect } from '../fixtures/electron-app';
import { AppNav } from '../support/pages/AppNav';
import { DancesPage } from '../support/pages/DancesPage';
import { PracticeTimePage } from '../support/pages/PracticeTimePage';
import { JukeboxPage } from '../support/pages/JukeboxPage';
import { importSongs, createDance } from '../support/seed';

test('plays, advances, and pauses a dance from Play Default', async ({
  app,
  page,
}) => {
  await importSongs(app, page);
  await createDance(page, 'Reel A');

  // Play Default from the Dances page opens the jukebox.
  await new AppNav(page).goTo('Dances');
  await new DancesPage(page)
    .rowByTitle('Reel A')
    .getByRole('button', { name: 'Play Default' })
    .click();

  const jukebox = new JukeboxPage(page);
  await jukebox.waitForLoaded();
  await expect(jukebox.playButton()).toBeVisible();

  await jukebox.playButton().click();
  await expect(jukebox.pauseButton()).toBeVisible();

  // Playback position advances (tracked via performance.now, works headless).
  await expect
    .poll(() => jukebox.currentSeconds(), { timeout: 8000 })
    .toBeGreaterThan(0);

  await jukebox.pauseButton().click();
  await expect(jukebox.playButton()).toBeVisible();

  await jukebox.close();
  await expect(jukebox.playButton()).toHaveCount(0);
});

test('navigates next and previous across a playlist', async ({ app, page }) => {
  await importSongs(app, page);
  await createDance(page, 'Reel A');
  await createDance(page, 'Reel B');

  await new AppNav(page).goTo('Showtime');
  const home = new PracticeTimePage(page);
  await home.addDance('Reel A');
  await home.addDance('Reel B');

  // Play the first track — this opens the jukebox with the full playlist.
  await home
    .trackRow('Reel A')
    .getByRole('button', { name: 'Play', exact: true })
    .click();

  const jukebox = new JukeboxPage(page);
  await expect(jukebox.trackCounter('1/2')).toBeVisible();

  await jukebox.next();
  await expect(jukebox.trackCounter('2/2')).toBeVisible();

  await jukebox.previous();
  await expect(jukebox.trackCounter('1/2')).toBeVisible();

  await jukebox.close();
});
