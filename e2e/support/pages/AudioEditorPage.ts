import { type Page, type Locator } from '@playwright/test';

export class AudioEditorPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  titleInput(): Locator {
    return this.page.getByPlaceholder('Song title');
  }

  trimButton(): Locator {
    return this.page.getByRole('button', { name: /Trim to Selection/ });
  }

  saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save', exact: true });
  }

  async setTitle(title: string) {
    await this.titleInput().fill(title);
  }

  async save() {
    await this.saveButton().click();
  }
}
