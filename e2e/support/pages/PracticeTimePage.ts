import { type Page, type Locator } from '@playwright/test';

// The home screen (route '/') — the surface where a playlist is built, saved,
// loaded, and cleared.
export class PracticeTimePage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async addFirstDance() {
    await this.page.getByRole('button', { name: '+ Add Dance' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor();
    // Pick the first dance option; its default variant auto-selects.
    await dialog.locator('input[id^="react-select"]').first().click();
    await this.page
      .locator('[id^="react-select"][id*="option-0"]')
      .first()
      .click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await dialog.waitFor({ state: 'hidden' });
  }

  trackRow(danceTitle: string): Locator {
    return this.page.getByRole('row', { name: new RegExp(danceTitle) });
  }

  unsavedIndicator(): Locator {
    return this.page.getByText('Unsaved Changes');
  }

  private async openPlaylistActions() {
    await this.page.getByRole('button', { name: /Playlist Actions/ }).click();
  }

  async saveAs(title: string) {
    await this.openPlaylistActions();
    await this.page.getByRole('menuitem', { name: 'Save As...' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor();
    await dialog.getByRole('textbox').first().fill(title);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await dialog.waitFor({ state: 'hidden' });
  }

  async clear() {
    await this.openPlaylistActions();
    // "Clear" and "Clear Autoplay" both exist — match exactly.
    await this.page
      .getByRole('menuitem', { name: 'Clear', exact: true })
      .click();
  }
}
