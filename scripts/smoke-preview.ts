import assert from 'node:assert/strict';
import path from 'node:path';
import { startPreview } from './preview';

const root = path.resolve(import.meta.dir, '../build/chrome');
const server = await startPreview(root, 0, '127.0.0.1');
try {
  const base = `http://127.0.0.1:${server.port}`;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type') || '', /text\/html/);
  const servedHtml = await page.text();
  const manifest = await Bun.file(path.join(root, 'manifest.json')).json();
  assert.ok(
    servedHtml.includes(JSON.stringify(manifest)),
    'Preview must use the built manifest and version',
  );
  assert.ok(
    servedHtml.includes('window.chrome=api;window.browser=api;'),
    'Preview must inject Chrome mocks',
  );
  assert.ok(
    !(await Bun.file(path.join(root, 'app.html')).text()).includes(
      'window.chrome=api;window.browser=api;',
    ),
    'Packaged HTML must not contain preview mocks',
  );
  for (const [file, type] of [
    ['app.js', /javascript/],
    ['app.css', /text\/css/],
    ['images/betterwatch-48.png', /image\/png/],
    ['manifest.json', /json/],
  ] as const) {
    const response = await fetch(`${base}/${file}`);
    assert.equal(response.status, 200, file);
    assert.match(response.headers.get('content-type') || '', type, file);
    assert.ok((await response.arrayBuffer()).byteLength > 0, file);
  }
  assert.equal((await fetch(`${base}/missing-file`)).status, 404);
  assert.equal((await fetch(`${base}/%E0%A4%A`)).status, 400);
  assert.equal((await fetch(`${base}/..%2f..%2fpackage.json`)).status, 403);
  console.log(
    'Bun preview HTTP, MIME types, mock isolation, and error routes passed.',
  );
} finally {
  await server.stop(true);
}
