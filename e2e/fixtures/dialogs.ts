import { type ElectronApplication } from '@playwright/test';

export async function stubOpenDirectory(app: ElectronApplication, dir: string) {
  await app.evaluate(({ dialog }, d) => {
    dialog.showOpenDialogSync = () => [d];
  }, dir);
}

export async function stubOpenFiles(app: ElectronApplication, paths: string[]) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialogSync = () => p;
  }, paths);
}

export async function stubSave(app: ElectronApplication, savePath: string) {
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialogSync = () => p;
  }, savePath);
}

export async function stubCancel(app: ElectronApplication) {
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialogSync = () => undefined;
    dialog.showSaveDialogSync = () => undefined;
  });
}
