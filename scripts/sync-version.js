const fs = require('fs');
const rootVersion = require('../package.json').version;
const appPkgPath = './release/app/package.json';
const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
appPkg.version = rootVersion;
fs.writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2) + '\n');
console.log(`Synced release/app version to ${rootVersion}`);
