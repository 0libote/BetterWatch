import assert from 'node:assert/strict';
import path from 'node:path';
import { checkChromeVersion, tagVersion } from './release-notes';

/**
 * Compare two Chrome-style numeric versions (one to four components).
 * Returns a negative number when `a` is older, zero when equal,
 * and a positive number when `a` is newer.
 */
export function compareChromeVersions(a: string, b: string) {
  const parts = [a.split('.').map(Number), b.split('.').map(Number)];
  const length = Math.max(parts[0].length, parts[1].length);
  for (let index = 0; index < length; index++) {
    const diff = (parts[0][index] ?? 0) - (parts[1][index] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ensure the changelog contains a section for `version`. Existing sections
 * are returned untouched; otherwise a dated section is inserted before the
 * first versioned section (or appended when none exists). Unreleased entries
 * are never moved automatically.
 */
export function syncChangelog(changelog: string, version: string, date: string) {
  if (new RegExp(`^## \\[${escapeRegExp(version)}\\]`, 'm').test(changelog))
    return changelog;
  const entry = `## [${version}] - ${date}\n\n### Changed\n\n- Release ${version}.\n\n`;
  const match = /^## \[\d[^\]]*\][^\n]*$/m.exec(changelog);
  if (!match) return `${changelog.trimEnd()}\n\n${entry}`;
  const index = match.index;
  assert.ok(index !== undefined);
  return `${changelog.slice(0, index)}${entry}${changelog.slice(index)}`;
}

/** Replace the top-level `version` field without reformatting package.json. */
export function syncPackageJson(text: string, version: string) {
  assert.match(text, /^(\s*)"version":\s*"[^"]*"/m, 'package.json has no version field');
  return text.replace(
    /^(\s*)"version":\s*"[^"]*"/m,
    (_match, indent: string) => `${indent}"version": "${version}"`,
  );
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..');
  const args = Bun.argv.slice(2);
  const rawTag =
    process.env.RELEASE_TAG || args.find((arg) => !arg.startsWith('-'));
  assert.ok(rawTag, 'Set RELEASE_TAG to the release tag being published');
  const tag = rawTag.trim();
  assert.ok(tag, 'Set RELEASE_TAG to the release tag being published');
  const numeric = tagVersion(tag);
  const packagePath = path.join(root, 'package.json');
  const packageText = await Bun.file(packagePath).text();
  const current = (JSON.parse(packageText) as { version: string }).version;
  if (!numeric) {
    console.log(
      `Tag ${tag} is not a numeric version; keeping extension version ${current}.`,
    );
    process.exit(0);
  }
  checkChromeVersion(numeric);
  if (current === numeric) {
    console.log(
      `Release tag ${tag} agrees with extension version ${current}.`,
    );
    process.exit(0);
  }
  if (
    args.includes('--no-downgrade') &&
    compareChromeVersions(current, numeric) > 0
  ) {
    console.log(
      `Keeping newer extension version ${current} instead of downgrading to tag ${tag}.`,
    );
    process.exit(0);
  }
  await Bun.write(packagePath, syncPackageJson(packageText, numeric));
  const changelogPath = path.join(root, 'CHANGELOG.md');
  const changelog = await Bun.file(changelogPath).text();
  const updated = syncChangelog(
    changelog,
    numeric,
    new Date().toISOString().slice(0, 10),
  );
  if (updated !== changelog) await Bun.write(changelogPath, updated);
  console.log(
    `Synced extension version ${current} to ${numeric} for tag ${tag}.`,
  );
}
