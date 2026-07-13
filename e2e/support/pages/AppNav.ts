import { type Page, type Locator } from '@playwright/test';

export type Tab = 'Showtime' | 'Dances' | 'Songs' | 'Playlists' | 'Settings';

export class AppNav {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goTo(tab: Tab) {
    await this.page.getByRole('tab', { name: tab }).click();
  }

  heading(): Locator {
    return this.page.getByRole('heading', { level: 1 });
  }
}
