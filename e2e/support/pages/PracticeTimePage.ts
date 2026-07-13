import { type Page, type Locator } from '@playwright/test';

// The home screen (route '/') — the surface where a playlist is built, saved,
// loaded, and cleared.
export class PracticeTimePage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async addFirstDance() {
    await this.addDance();
  }

  // Add a dance to the playlist via the Select Dance modal. With `name`, the
  // dance combobox is filtered to that dance first; otherwise the first option
  // is used. The default variant auto-selects either way.
  async addDance(name?: string) {
    await this.page.getByRole('button', { name: '+ Add Dance' }).click();
    const dialog = this.page.getByRole('dialog');
    await dialog.waitFor();
    const combobox = dialog.locator('input[id^="react-select"]').first();
    await combobox.click();
    if (name) {
      await combobox.fill(name);
    }
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
