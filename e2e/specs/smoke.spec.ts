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
