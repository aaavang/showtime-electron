import fs from 'fs';
import os from 'os';
import path from 'path';
import { test, expect } from '../fixtures/electron-app';
import { AudioEditorPage } from '../support/pages/AudioEditorPage';
import { openAudioEditorForDance } from '../support/seed';
import { stubSave } from '../fixtures/dialogs';

test('loads the audio editor with the track title and controls', async ({
  app,
  page,
}) => {
  await openAudioEditorForDance(app, page, 'Reel A');
  const editor = new AudioEditorPage(page);

  await expect(editor.titleInput()).toBeVisible();
  await expect(editor.titleInput()).not.toHaveValue('');
  await expect(editor.trimButton()).toBeVisible();
  await expect(editor.saveButton()).toBeVisible();
});

test('exports a new MP3 to disk via the save dialog', async ({ app, page }) => {
  await openAudioEditorForDance(app, page, 'Reel A');
  const editor = new AudioEditorPage(page);

  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'showtime-e2e-export-'));
  const outPath = path.join(outDir, 'exported.mp3');
  await stubSave(app, outPath);

  // A new title routes Save through the save dialog (never overwrites the
  // original fixture file).
  await editor.setTitle('Reel A Export');
  await editor.save();

  // Main renders + MP3-encodes the region, then writes the file.
  await expect
    .poll(() => fs.existsSync(outPath), { timeout: 60_000, intervals: [500] })
    .toBe(true);
  expect(fs.statSync(outPath).size).toBeGreaterThan(0);

  fs.rmSync(outDir, { recursive: true, force: true });
});
