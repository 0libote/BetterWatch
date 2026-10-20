const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../build/chrome');
const manifest = JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.name,'BetterWatch');
assert.ok(!manifest.permissions.includes('<all_urls>'));
const files = [manifest.background.service_worker, manifest.action.default_popup,
  manifest.options_ui.page,...Object.values(manifest.icons),manifest.action.default_icon,
  'images/betterwatch-active-48.png', 'netflix.js','amazon-prime.js','hbo-max.js','history.html','LICENSE',
  'THIRD_PARTY_NOTICES.md','licenses/UNIVERSAL-TRAKT-SCROBBLER-MIT.txt',
  'licenses/STREAMING-ENHANCED-GPL-3.0.txt'];
for(const entry of manifest.content_scripts) files.push(...entry.js);
for(const file of files)assert.ok(fs.existsSync(path.join(root,file)),`Missing package resource: ${file}`);
for(const file of fs.readdirSync(root))assert.ok(!file.endsWith('.map'),'Production package includes development source maps');
for(const host of manifest.host_permissions)assert.ok(!/disney|crunchyroll|\*:\/\/\*\/\*/.test(host));
assert.ok(!fs.existsSync(path.join(root,'kino-pub-auth.html')));
assert.ok(!fs.existsSync(path.join(root,'preview.cjs')));
console.log('Chrome manifest and package resource checks passed.');
