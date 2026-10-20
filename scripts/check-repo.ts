import assert from 'node:assert/strict';
import path from 'node:path';
import { checkChromeVersion } from './release-notes';
import { checkDirectPeers } from './check-peers';

const root = path.resolve(import.meta.dir, '..');
const pkg = await Bun.file(path.join(root, 'package.json')).json();
await checkDirectPeers(root);
assert.match(
  pkg.packageManager,
  /^bun@\d+\.\d+\.\d+$/,
  'Pin an exact Bun version in packageManager',
);
assert.ok(
  Bun.semver.satisfies(Bun.version, pkg.engines.bun),
  'Installed Bun does not satisfy engines.bun',
);
assert.equal(
  pkg.devDependencies['@types/bun'],
  pkg.packageManager.slice(4),
  'Keep Bun runtime and types aligned',
);
checkChromeVersion(pkg.version);
assert.ok(
  await Bun.file(path.join(root, 'bun.lock')).exists(),
  'Commit bun.lock',
);
for (const file of [
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
]) {
  assert.ok(
    !(await Bun.file(path.join(root, file)).exists()),
    `Use only bun.lock; remove ${file}`,
  );
}
for (const file of new Bun.Glob('.github/**/*.{yml,yaml}').scanSync({
  cwd: root,
})) {
  assert.ok(
    Bun.YAML.parse(await Bun.file(path.join(root, file)).text()),
    `Invalid YAML: ${file}`,
  );
}
const tracked = Bun.spawnSync(['git', 'ls-files', '-z'], { cwd: root });
assert.equal(tracked.exitCode, 0, tracked.stderr.toString());
for (const file of tracked.stdout.toString().split('\0').filter(Boolean)) {
  assert.ok(
    !path.basename(file).startsWith('.env') ||
      path.basename(file) === '.env.example',
    `Do not track local environment file: ${file}`,
  );
}
console.log(`Repository configuration verified (Bun ${Bun.version}).`);
