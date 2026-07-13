import { type Page, type Locator } from '@playwright/test';

export type Tab = 'Showtime' | 'Dances' | 'Songs' | 'Playlists' | 'Settings';

export class AppNav {
  constructor(private page: Page) {}

  async goTo(tab: Tab) {
    await this.page.getByRole('tab', { name: tab }).click();
  }

  heading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }
}
