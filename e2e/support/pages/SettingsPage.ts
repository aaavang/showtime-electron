import { type Page, type Locator } from '@playwright/test';

export class SettingsPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async seed() {
    await this.page.getByRole('button', { name: 'Seed Database' }).click();
  }

  async purge() {
    await this.page.getByRole('button', { name: 'Purge Database' }).click();
  }

  async exportDb() {
    await this.page.getByRole('button', { name: 'Export Database' }).click();
  }

  // Import is a two-step confirmation.
  async importDb() {
    await this.page.getByRole('button', { name: 'Import Database' }).click();
    await this.page.getByRole('button', { name: 'Continue' }).click();
    await this.page
      .getByRole('button', { name: 'Yes, replace everything' })
      .click();
  }

  autoplayCheckbox(): Locator {
    return this.page
      .getByText('Enable Fine-Grained Autoplay')
      .locator('..')
      .getByRole('checkbox');
  }

  async toggleAutoplay() {
    // Chakra hides the real <input>; click its wrapping label to toggle.
    await this.autoplayCheckbox().locator('xpath=ancestor::label[1]').click();
  }
}
