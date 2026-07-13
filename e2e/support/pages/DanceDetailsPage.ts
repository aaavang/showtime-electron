import { type Page } from '@playwright/test';

export class DanceDetailsPage {
  constructor(private page: Page) {}

  variantRow(title: string) {
    return this.page.getByRole('row', { name: new RegExp(title) });
  }

  async openActionsFor(variantTitle: string) {
    await this.variantRow(variantTitle)
      .getByRole('button', { name: 'Actions' })
      .click();
  }

  menuItem(name: string) {
    return this.page.getByRole('menuitem', { name });
  }
}
