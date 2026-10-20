import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { tagVersion } from '../scripts/release-notes';
import {
  compareChromeVersions,
  syncChangelog,
  syncPackageJson,
} from '../scripts/sync-release-version';

test('numeric tag versions are detected with prefixes and suffixes', () => {
  assert.equal(tagVersion('0.1.2'), '0.1.2');
  assert.equal(tagVersion('v0.1.2'), '0.1.2');
  assert.equal(tagVersion('v0.1.2-beta.1'), '0.1.2');
  assert.equal(tagVersion('1+build.5'), '1');
  assert.equal(tagVersion('preview-october'), undefined);
  assert.equal(tagVersion(''), undefined);
});

test('chrome versions compare component by component', () => {
  assert.equal(compareChromeVersions('0.1.2', '0.1.2'), 0);
  assert.equal(compareChromeVersions('1.2', '1.2.0'), 0);
  assert.ok(compareChromeVersions('0.1.3', '0.1.2') > 0);
  assert.ok(compareChromeVersions('0.1.2', '0.2') < 0);
  assert.ok(compareChromeVersions('1', '0.9.9.9') > 0);
});

test('package.json sync only touches the version field', () => {
  const before =
    '{\n  "name": "betterwatch",\n  "version": "0.1.1",\n  "private": true\n}\n';
  const after = syncPackageJson(before, '0.1.2');
  assert.equal(
    after,
    '{\n  "name": "betterwatch",\n  "version": "0.1.2",\n  "private": true\n}\n',
  );
  assert.throws(() => syncPackageJson('{}\n', '0.1.2'), /version field/);
});

test('changelog sync inserts a dated section before the first version', () => {
  const changelog =
    '# Changelog\n\n## [Unreleased]\n\n- Pending.\n\n## [0.1.1] - 2026-10-20\n\n- Shipped.\n';
  const updated = syncChangelog(changelog, '0.1.2', '2026-10-21');
  assert.ok(updated.includes('## [0.1.2] - 2026-10-21'));
  assert.ok(
    updated.indexOf('## [0.1.2]') < updated.indexOf('## [0.1.1]'),
  );
  assert.ok(updated.includes('## [Unreleased]'));
  assert.ok(updated.includes('- Pending.'));
});

test('changelog sync leaves existing sections untouched', () => {
  const changelog = '# Changelog\n\n## [0.1.2] - 2026-10-21\n\n- Shipped.\n';
  assert.equal(syncChangelog(changelog, '0.1.2', '2026-10-22'), changelog);
});

test('changelog sync appends when no version section exists', () => {
  const updated = syncChangelog('# Changelog\n', '0.1.2', '2026-10-21');
  assert.ok(updated.endsWith('## [0.1.2] - 2026-10-21\n\n### Changed\n\n- Release 0.1.2.\n\n'));
});
