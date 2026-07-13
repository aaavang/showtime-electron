import { type Page, type Locator } from '@playwright/test';

// The Playlists tab — the list of saved playlists.
export class PlaylistsPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  rowByTitle(title: string): Locator {
    return this.page.getByRole('row', { name: new RegExp(title) });
  }

  async load(title: string) {
    await this.rowByTitle(title).getByRole('button', { name: 'Load' }).click();
  }

  async deleteEntry(title: string) {
    await this.rowByTitle(title)
      .getByRole('button', { name: 'Delete' })
      .click();
  }
}
