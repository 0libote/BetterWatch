import { test } from 'bun:test';
import assert from 'node:assert/strict';
import {
  changelogSection,
  checkChromeVersion,
  checkReleaseVersion,
  renderReleaseNotes,
  type ReleaseDetails,
} from '../scripts/release-notes';

test('release versions respect Chrome component limits and reject invalid numbering', () => {
  for (const version of ['1', '0.1.1', '65535.0.1.4'])
    checkChromeVersion(version);
  for (const version of [
    '0',
    '0.0.0.0',
    '01.2.3',
    '1.65536',
    '1.2.3.4.5',
    '1.2.3-beta',
    '1.2.',
  ]) {
    assert.throws(() => checkChromeVersion(version));
  }
});

test('numeric tags must agree with the actual extension version', () => {
  for (const tag of ['0.1.1', 'v0.1.1', 'v0.1.1-beta.2', 'preview-october'])
    checkReleaseVersion(tag, '0.1.1');
  for (const tag of ['0.1.2', 'v0.1.2', 'v0.1.2-beta.1'])
    assert.throws(() => checkReleaseVersion(tag, '0.1.1'), /disagrees/);
  assert.throws(() => checkReleaseVersion('', '0.1.1'));
});

test('curated release changes stop at the next version and exclude Unreleased', () => {
  const changelog =
    '# Changelog\n\n## [Unreleased]\n\n- Not shipped.\n\n## [0.1.1] - 2026-10-20\n\n### Changed\n\n- Bun builds.\n\n## [0.1.0]\n\n- Initial release.\n';
  assert.equal(
    changelogSection(changelog, '0.1.1'),
    '### Changed\n\n- Bun builds.',
  );
  assert.equal(changelogSection(changelog, '0.2.0'), '');
});

const details: ReleaseDetails = {
  tag: '0.1.1',
  version: '0.1.1',
  repository: '0libote/BetterWatch',
  sha: 'a'.repeat(40),
  toolchain: 'bun 1.4.3',
  changes: '- Faster builds.',
  previousTag: '0.1.0',
  commits: [{ sha: 'b'.repeat(40), subject: 'Fix [player] matching' }],
};

test('release descriptions include real changes, commits, installation, and known limits', () => {
  const notes = renderReleaseNotes(details);
  for (const text of [
    '- Faster builds.',
    'compare/0.1.0...0.1.1',
    'commit/' + 'b'.repeat(40),
    'betterwatch-chrome.zip',
    'SHA256SUMS',
    'chrome://extensions',
    'Chrome 120',
    'English UI',
    'manual checks',
  ])
    assert.ok(notes.includes(text), text);
  assert.ok(notes.includes('Fix \\[player\\] matching'));
  assert.ok(!notes.includes('Historical version discrepancy'));
});

test('initial and uncurated releases retain useful history and commit details', () => {
  const notes = renderReleaseNotes({
    ...details,
    changes: '',
    previousTag: undefined,
  });
  assert.ok(
    notes.includes('Changes in this release are listed in the commits below.'),
  );
  assert.ok(notes.includes('/commits/0.1.1'));
  assert.ok(!notes.includes('/compare/'));
});

test('historical release notes clearly identify an existing tag/asset version discrepancy', () => {
  const notes = renderReleaseNotes({ ...details, version: '0.1.0' });
  assert.ok(notes.includes('Historical version discrepancy'));
  assert.ok(notes.includes('original ZIP reports extension version 0.1.0'));
});
