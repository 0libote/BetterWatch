import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Script } from 'node:vm';
export async function validateBuild(root: string, production = true) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'),
  );
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.name, 'BetterWatch');
  assert.ok(!manifest.permissions.includes('<all_urls>'));
  const files = [
    manifest.background.service_worker,
    manifest.options_ui.page.split('#')[0],
    ...Object.values(manifest.icons),
    manifest.action.default_icon,
    'images/betterwatch-active-48.png',
    'netflix.js',
    'amazon-prime.js',
    'hbo-max.js',
    'app.html',
    'app.js',
    'app.css',
    'LICENSE',
    'THIRD_PARTY_NOTICES.md',
    'licenses/UNIVERSAL-TRAKT-SCROBBLER-MIT.txt',
    'licenses/STREAMING-ENHANCED-GPL-3.0.txt',
    'licenses/MANROPE-OFL.txt',
  ];
  for (const entry of manifest.content_scripts) files.push(...entry.js);
  for (const file of files)
    assert.ok(
      fs.existsSync(path.join(root, file)),
      `Missing package resource: ${file}`,
    );
  const html = await Bun.file(path.join(root, 'app.html')).text();
  for (const [, resource] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assert.ok(
      !/^(?:https?:|data:|\/\/)/.test(resource),
      `Nonlocal HTML resource: ${resource}`,
    );
    assert.ok(
      fs.existsSync(path.join(root, resource)),
      `Missing HTML resource: ${resource}`,
    );
  }
  assert.ok(
    html.includes('href="app.css"'),
    'Workspace must load extracted styles',
  );
  const css = await Bun.file(path.join(root, 'app.css')).text();
  for (const [, resource] of css.matchAll(/url\(["']?([^\s)"']+)["']?\)/g)) {
    if (resource.startsWith('data:')) continue;
    assert.ok(
      !/^(?:https?:|\/\/)/.test(resource),
      `Nonlocal CSS resource: ${resource}`,
    );
    assert.ok(
      fs.existsSync(path.join(root, resource)),
      `Missing CSS resource: ${resource}`,
    );
  }
  const scripts = fs
    .readdirSync(root)
    .filter((file) => file.endsWith('.js'))
    .sort();
  assert.deepEqual(scripts, [
    'amazon-prime.js',
    'app.js',
    'auto-skip.js',
    'background.js',
    'hbo-max.js',
    'netflix.js',
    'trakt.js',
  ]);
  for (const file of scripts) {
    // Chrome loads the worker and injected content files as classic scripts.
    new Script(await Bun.file(path.join(root, file)).text(), {
      filename: file,
    });
  }
  if (production)
    for (const file of fs.readdirSync(root))
      assert.ok(
        !file.endsWith('.map'),
        'Production package includes development source maps',
      );
  for (const host of manifest.host_permissions)
    assert.ok(!/disney|crunchyroll|\*:\/\/\*\/\*/.test(host));
  assert.equal(manifest.action.default_popup, undefined);
  assert.deepEqual(
    fs.readdirSync(root).filter((file) => file.endsWith('.html')),
    ['app.html'],
  );
  assert.ok(!fs.existsSync(path.join(root, 'kino-pub-auth.html')));
  assert.ok(!fs.existsSync(path.join(root, 'preview.ts')));
  console.log('Chrome manifest and package resource checks passed.');
}
