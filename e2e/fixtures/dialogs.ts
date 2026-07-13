import { type ElectronApplication } from '@playwright/test';

// Each helper mutates the main-process `dialog` module so native OS dialogs
// return fixed values instead of opening. The `as typeof ...` casts satisfy
// Electron's overloaded showOpenDialogSync/showSaveDialogSync signatures.

export async function stubOpenDirectory(app: ElectronApplication, dir: string) {
  await app.evaluate(({ dialog }, d) => {
    dialog.showOpenDialogSync = (() => [d]) as typeof dialog.showOpenDialogSync;
  }, dir);
}

export async function stubOpenFiles(app: ElectronApplication, paths: string[]) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialogSync = (() => p) as typeof dialog.showOpenDialogSync;
  }, paths);
}

export async function stubSave(app: ElectronApplication, savePath: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialogSync = (() => p) as typeof dialog.showSaveDialogSync;
  }, savePath);
}

export async function stubCancel(app: ElectronApplication) {
  await app.evaluate(({ dialog }) => {
    // Electron types these sync dialogs as returning non-nullable values, but
    // at runtime they return undefined on cancel — cast through unknown.
    dialog.showOpenDialogSync = (() =>
      undefined) as unknown as typeof dialog.showOpenDialogSync;
    dialog.showSaveDialogSync = (() =>
      undefined) as unknown as typeof dialog.showSaveDialogSync;
  });
}
