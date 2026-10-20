import { afterEach, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { zipSync } from 'fflate';
import { verifyPackage } from '../scripts/verify-package';

const temporary: string[] = [];
afterEach(async () => {
  for (const dir of temporary.splice(0))
    await rm(dir, { recursive: true, force: true });
});
async function fixture(
  files: Record<string, Uint8Array> = {
    'app.js': new TextEncoder().encode('console.log("built");'),
  },
) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'betterwatch-package-'));
  temporary.push(dir);
  const root = path.join(dir, 'chrome');
  const dist = path.join(dir, 'dist');
  await mkdir(root);
  await mkdir(dist);
  await Bun.write(path.join(root, 'app.js'), 'console.log("built");');
  const zip = zipSync(files);
  await Bun.write(path.join(dist, 'betterwatch-chrome.zip'), zip);
  await Bun.write(
    path.join(dist, 'SHA256SUMS'),
    `${Bun.CryptoHasher.hash('sha256', zip, 'hex')}  betterwatch-chrome.zip\n`,
  );
  return { root, dist };
}

test('package verification accepts matching files and checksum', async () => {
  const { root, dist } = await fixture();
  await verifyPackage(root, dist);
});

test('package verification rejects a stale checksum', async () => {
  const { root, dist } = await fixture();
  await Bun.write(
    path.join(dist, 'SHA256SUMS'),
    '0'.repeat(64) + '  betterwatch-chrome.zip\n',
  );
  await assert.rejects(verifyPackage(root, dist), /checksum/);
});

test('package verification rejects missing, extra, or modified files even with a valid ZIP checksum', async () => {
  const cases: Record<string, Uint8Array>[] = [
    {},
    { 'app.js': new TextEncoder().encode('console.log("stale");') },
    {
      'app.js': new TextEncoder().encode('console.log("built");'),
      'extra.js': new Uint8Array([1]),
    },
  ];
  for (const files of cases) {
    const { root, dist } = await fixture(files);
    await assert.rejects(verifyPackage(root, dist), /ZIP/);
  }
});
