import { type Page } from '@playwright/test';

export class DancesPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async newDance() {
    await this.page.getByRole('button', { name: '+ New Dance' }).click();
    // Chakra ModalContent has role="dialog"; ModalHeader is a <header>, not a
    // heading role, so wait on the dialog itself.
    await this.page.getByRole('dialog').waitFor();
  }

  modalTitleInput() {
    return this.page.getByRole('dialog').getByRole('textbox').first();
  }

  async fillTitle(title: string) {
    await this.modalTitleInput().fill(title);
  }

  async pickFirstSong() {
    // react-select: focus the combobox input, then choose the first option.
    const dialog = this.page.getByRole('dialog');
    await dialog.locator('input[id^="react-select"]').click();
    await this.page
      .locator('[id^="react-select"][id*="option-0"]')
      .first()
      .click();
  }

  async save() {
    await this.page.getByRole('button', { name: 'Save' }).click();
  }

  rowByTitle(title: string) {
    return this.page.getByRole('row', { name: new RegExp(title) });
  }

  async deleteDance(title: string) {
    await this.rowByTitle(title)
      .getByRole('button', { name: 'Delete' })
      .click();
  }
}
