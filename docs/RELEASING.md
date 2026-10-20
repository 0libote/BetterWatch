# Releasing BetterWatch

Every tag pushed to GitHub starts the release workflow. It uses the exact Bun
version in `package.json`, a frozen `bun.lock`, repository/type/behavior checks,
a production build, ZIP/checksum verification, and a preview HTTP smoke test.
Only successful builds publish release assets. No additional secrets are
needed beyond GitHub's workflow token.

## Prepare a version

1. Review the changes and run `bun run check`, `bun run build`,
   `bun run package:check`, and `bun run smoke:preview`.
2. Move the relevant Unreleased entries in `CHANGELOG.md` into a new version
   section, such as `## [0.1.2] - YYYY-MM-DD`. Leave an Unreleased section for
   future changes and commit the reviewed source and changelog.
3. From a clean working tree, run `bun pm version patch` (or `minor`/`major`).
   Bun creates the version commit and tag. Confirm that its version matches
   the changelog section before pushing.
4. Push with `git push origin main --follow-tags`.

Version tags may have a `v` prefix. Their numeric version must exactly match
`package.json`; Chrome's version must have one to four numeric components,
each 0–65535, without leading zeros, and cannot be all zero. Arbitrary named
tags still build and publish using the actual package version shown in notes.
The workflow rejects mismatched numeric tags before publishing anything.

The original 0.1.1 tag contains a ZIP whose internal extension version is
0.1.0. Its description documents this historical discrepancy; the original
asset and tag are retained. The current package has been aligned to 0.1.1
so the next patch bump proceeds to 0.1.2.

## Release descriptions

`bun run release:notes` writes `dist/RELEASE_NOTES.md` after a build. It uses
the version's curated changelog section, lists commits since the nearest
previous tag, and adds source links, the actual extension version, tooling,
install/upgrade steps, checksum instructions, Trakt setup, and known limits.
It works for direct commits to main as well as merged pull requests.

Set `RELEASE_TAG` to preview a particular tag; `bun run release:check` validates
it without requiring a build. A tagged checkout needs full Git history for
the commit list; both workflows request it. With no prior tag, notes include
the initial source history. A missing changelog section falls back to commits.

Re-running a release replaces `betterwatch-chrome.zip` and `SHA256SUMS` and
refreshes the generated description. Treat the changelog as the maintained
source for those details; edits made only on GitHub are overwritten on reruns.
The Linux CI artifact includes the description for review without publishing
a release.

After publication, inspect the assets, verify their checksum, and load the ZIP
in Chrome. Automated checks do not replace the authenticated service/Trakt
checks in [TESTING.md](TESTING.md).
