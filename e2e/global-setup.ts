import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  MAIN_JS,
  PRELOAD_BUILT,
  PRELOAD_SHIM,
  REPO_ROOT,
} from './support/paths';

export default async function globalSetup() {
  // Build the app if the main bundle is missing.
  if (!fs.existsSync(MAIN_JS)) {
    execSync('yarn build', { cwd: REPO_ROOT, stdio: 'inherit' });
  }
  if (!fs.existsSync(PRELOAD_BUILT)) {
    throw new Error(
      `Built preload missing at ${PRELOAD_BUILT}. Run \`yarn build\`.`,
    );
  }
  // Expose the built preload where the unpackaged main resolves it.
  fs.mkdirSync(path.dirname(PRELOAD_SHIM), { recursive: true });
  if (fs.existsSync(PRELOAD_SHIM)) fs.rmSync(PRELOAD_SHIM);
  fs.symlinkSync(
    path.relative(path.dirname(PRELOAD_SHIM), PRELOAD_BUILT),
    PRELOAD_SHIM,
  );
}
