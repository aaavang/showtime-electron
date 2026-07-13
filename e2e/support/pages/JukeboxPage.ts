import { type Page, type Locator } from '@playwright/test';

// The jukebox player, rendered inside the bottom Drawer (role="dialog").
// All controls are scoped to that drawer so they never collide with page
// buttons of the same name (e.g. a track row's own "Play").
export class JukeboxPage {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private root(): Locator {
    return this.page.getByRole('dialog');
  }

  playButton(): Locator {
    return this.root().getByRole('button', { name: 'Play', exact: true });
  }

  pauseButton(): Locator {
    return this.root().getByRole('button', { name: 'Pause', exact: true });
  }

  private timeText(): Locator {
    // The "M:SS/M:SS" position/duration readout.
    return this.root().getByText(/\d+:\d\d\/\d+:\d\d/);
  }

  // Wait until the track has decoded (duration is known, not "--:--").
  async waitForLoaded() {
    await this.timeText().waitFor();
  }

  async currentSeconds(): Promise<number> {
    const text = (await this.timeText().textContent()) ?? '0:00/0:00';
    const [mm, ss] = text.split('/')[0].split(':').map(Number);
    return mm * 60 + ss;
  }

  trackCounter(text: string): Locator {
    return this.root().getByText(text, { exact: true });
  }

  async next() {
    await this.root().getByRole('button', { name: 'Next' }).click();
  }

  async previous() {
    await this.root().getByRole('button', { name: 'Previous' }).click();
  }

  async close() {
    await this.root().getByRole('button', { name: 'close' }).click();
  }
}
