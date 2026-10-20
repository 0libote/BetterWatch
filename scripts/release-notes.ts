import assert from 'node:assert/strict';
import path from 'node:path';

export function checkChromeVersion(version: string) {
  assert.match(
    version,
    /^(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,3}$/,
    'Chrome versions need one to four numeric components without leading zeros',
  );
  const parts = version.split('.').map(Number);
  assert.ok(
    parts.every((value) => value <= 65535) && parts.some((value) => value > 0),
    'Chrome version components must be 0–65535 and not all zero',
  );
}

function tagVersion(tag: string) {
  return /^v?(\d+(?:\.\d+){0,3})(?:-[\dA-Za-z.-]+)?(?:\+[\dA-Za-z.-]+)?$/.exec(
    tag,
  )?.[1];
}

export function checkReleaseVersion(tag: string, version: string) {
  checkChromeVersion(version);
  assert.ok(tag.trim(), 'A release tag is required');
  const numeric = tagVersion(tag);
  if (numeric)
    assert.equal(
      numeric,
      version,
      `Tag ${tag} disagrees with extension version ${version}; bump package.json before tagging`,
    );
}

export function changelogSection(changelog: string, version: string) {
  const sections = [...changelog.matchAll(/^## \[([^\]]+)\][^\n]*$/gm)];
  const index = sections.findIndex((section) => section[1] === version);
  if (index === -1) return '';
  const section = sections[index];
  return changelog
    .slice(section.index! + section[0].length, sections[index + 1]?.index)
    .trim();
}

const markdown = (text: string) => text.replace(/[\\`*_[\]<>#]/g, '\\$&');
export interface ReleaseDetails {
  tag: string;
  version: string;
  repository: string;
  sha: string;
  toolchain: string;
  changes: string;
  previousTag?: string;
  commits: { sha: string; subject: string }[];
}

export function renderReleaseNotes(details: ReleaseDetails) {
  const {
    tag,
    version,
    repository,
    sha,
    toolchain,
    changes,
    previousTag,
    commits,
  } = details;
  assert.match(
    repository,
    /^[\w.-]+\/[\w.-]+$/,
    'Use an owner/repository name',
  );
  const repo = `https://github.com/${repository}`;
  const ref = encodeURIComponent(tag);
  const mismatch = tagVersion(tag) && tagVersion(tag) !== version;
  const commitList = commits
    .map(
      (commit) =>
        `- ${markdown(commit.subject)} ([${commit.sha.slice(0, 7)}](${repo}/commit/${commit.sha}))`,
    )
    .join('\n');
  return `## BetterWatch ${markdown(tag)}

Chrome auto-skip and Trakt for Netflix, Prime Video, and HBO Max.

- **Extension version:** ${markdown(version)}
- **Requires:** Chrome 120 or newer; desktop Chrome extension only.
- **Build tooling:** ${markdown(toolchain)}. Build tools are only needed when compiling from source.
- **Source:** [${sha.slice(0, 7)}](${repo}/commit/${sha})

${mismatch ? `> **Historical version discrepancy:** This release is tagged ${markdown(tag)}, but its original ZIP reports extension version ${markdown(version)} in Chrome. The published asset has not been replaced. Future version tags are checked against package.json before publishing.\n\n` : ''}### Changes

${changes ? changes.replace(/^### /gm, '#### ') : 'Changes in this release are listed in the commits below.'}

### Commits

${commitList || 'No additional commits since the previous tag.'}

${previousTag ? `[Full changelog](${repo}/compare/${encodeURIComponent(previousTag)}...${ref})` : `[Source history](${repo}/commits/${ref})`}

### Download and install

1. Download [betterwatch-chrome.zip](${repo}/releases/download/${ref}/betterwatch-chrome.zip) and unzip it into a permanent folder.
2. Open \`chrome://extensions\`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing \`manifest.json\`.
3. Pin BetterWatch and reload any open streaming tabs. Open BetterWatch from its toolbar icon.

To upgrade an unpacked installation, replace the files in the same folder, click **Reload** in \`chrome://extensions\`, and refresh streaming tabs. Keeping the same folder helps preserve the extension ID and Trakt redirect URI.

The [SHA256SUMS](${repo}/releases/download/${ref}/SHA256SUMS) asset contains the ZIP's SHA-256 checksum. On Linux, verify both downloaded files with \`sha256sum --check SHA256SUMS\`; on macOS, use \`shasum -a 256 -c SHA256SUMS\`.

### Trakt and known limits

Auto-skip works without Trakt. To enable tracking, create your Trakt application and connect it from BetterWatch; follow the [setup instructions](${repo}/blob/${ref}/README.md#connect-trakt).

Prime Video scrobbling requires an English UI. Service controls and availability vary by title, region, and subscription. Automated fixtures and the preview harness do not verify authenticated playback or real Trakt writes; those still need the [manual checks](${repo}/blob/${ref}/docs/TESTING.md).

This is a development release distributed as an unpacked extension, with no Firefox build or hosted backend.
`;
}

function git(args: string[], cwd: string, optional = false) {
  const result = Bun.spawnSync(['git', ...args], { cwd });
  if (!optional) assert.equal(result.exitCode, 0, result.stderr.toString());
  return result.exitCode === 0 ? result.stdout.toString().trim() : '';
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dir, '..');
  const pkg = await Bun.file(path.join(root, 'package.json')).json();
  const tag = process.env.RELEASE_TAG || pkg.version;
  checkReleaseVersion(tag, pkg.version);
  if (process.argv.includes('--check')) {
    console.log(
      `Release tag ${tag} agrees with extension version ${pkg.version}.`,
    );
  } else {
    const manifest = await Bun.file(
      path.join(root, 'build/chrome/manifest.json'),
    ).json();
    assert.equal(
      manifest.version,
      pkg.version,
      'Rebuild the extension before generating release notes',
    );
    const previousTag = git(
      ['describe', '--tags', '--abbrev=0', 'HEAD^'],
      root,
      true,
    );
    const history = git(
      [
        'log',
        '--format=%H%x09%s',
        previousTag ? `${previousTag}..HEAD` : 'HEAD',
      ],
      root,
    );
    const commits = history
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, ...subject] = line.split('\t');
        return { sha, subject: subject.join('\t') };
      });
    const notes = renderReleaseNotes({
      tag,
      version: pkg.version,
      repository: process.env.GITHUB_REPOSITORY || '0libote/BetterWatch',
      sha: git(['rev-parse', 'HEAD'], root),
      toolchain: pkg.packageManager.replace('@', ' '),
      changes: changelogSection(
        await Bun.file(path.join(root, 'CHANGELOG.md')).text(),
        pkg.version,
      ),
      previousTag,
      commits,
    });
    await Bun.write(path.join(root, 'dist/RELEASE_NOTES.md'), notes);
    console.log(
      `Release description written to dist/RELEASE_NOTES.md (${commits.length} commits).`,
    );
  }
}
