import path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '../..');
export const MAIN_JS = path.join(REPO_ROOT, 'release/app/dist/main/main.js');
export const PRELOAD_BUILT = path.join(
  REPO_ROOT,
  'release/app/dist/main/preload.js',
);
// Where the unpackaged main (app.isPackaged === false) looks for the preload.
export const PRELOAD_SHIM = path.join(
  REPO_ROOT,
  'release/app/.erb/dll/preload.js',
);
export const TEST_TUNES_DIR = path.join(REPO_ROOT, 'test-tunes');
// eslint-disable-next-line import/no-dynamic-require, global-require
export const ELECTRON_BIN = require(
  path.join(REPO_ROOT, 'node_modules/electron'),
) as unknown as string;
