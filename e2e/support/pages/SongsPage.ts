import { type Page } from '@playwright/test';

export class SongsPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async importDirectory() {
    await this.page.getByRole('button', { name: /Library Actions/ }).click();
    await this.page.getByRole('menuitem', { name: /Import Directory/ }).click();
  }

  rowByTitle(title: string) {
    return this.page.getByRole('row', { name: new RegExp(title) });
  }

  async search(query: string) {
    await this.page.getByPlaceholder('Search...').fill(query);
  }
}
