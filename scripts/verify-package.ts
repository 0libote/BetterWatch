import assert from 'node:assert/strict';
import path from 'node:path';
import { unzipSync } from 'fflate';

export async function verifyPackage(root: string, dist: string) {
  const zip = await Bun.file(path.join(dist, 'betterwatch-chrome.zip')).bytes();
  const digest = Bun.CryptoHasher.hash('sha256', zip, 'hex');
  assert.equal(
    await Bun.file(path.join(dist, 'SHA256SUMS')).text(),
    `${digest}  betterwatch-chrome.zip\n`,
    'Release checksum does not match the ZIP',
  );
  const contents = unzipSync(zip);
  const archived = Object.keys(contents)
    .filter((name) => !name.endsWith('/'))
    .sort();
  const built = [
    ...new Bun.Glob('**/*').scanSync({ cwd: root, onlyFiles: true, dot: true }),
  ]
    .map((name) => name.split(path.sep).join('/'))
    .sort();
  assert.deepEqual(
    archived,
    built,
    'ZIP contents differ from the validated build',
  );
  for (const name of archived) {
    assert.deepEqual(
      contents[name],
      await Bun.file(path.join(root, name)).bytes(),
      `ZIP file differs: ${name}`,
    );
  }
  console.log(
    `Verified ${archived.length} packaged files and SHA-256 (${zip.length.toLocaleString()} bytes).`,
  );
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..');
  await verifyPackage(path.join(root, 'build/chrome'), path.join(root, 'dist'));
}
