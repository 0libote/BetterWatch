# Changelog

User-facing changes are recorded here. Move Unreleased entries into a version
section before creating the matching release tag.

## [Unreleased]

### Maintenance

- Gate macOS/Windows CI on the Linux suite, run workflow lint only for relevant
  changes, group MUI dependency updates, and reject incompatible direct peers.

- Add CI for Linux, macOS, and Windows with frozen Bun installs, repository
  checks, type checks, behavior tests, production builds, ZIP verification,
  preview HTTP checks, and downloadable build artifacts.
- Add weekly Bun dependency and GitHub Actions updates, contribution/security
  guidance, issue forms, a pull request template, and consistent line endings.
- Generate release descriptions with changes, commit links, install/upgrade
  instructions, checksums, and known limitations. Update descriptions on reruns.
- Correct the current package version to 0.1.1 and reject future numeric release
  tags that disagree with the extension version. Historical 0.1.1 assets still
  report 0.1.0; published artifacts remain unchanged.
- Sync `package.json` (and add a dated changelog section when missing) to
  numeric release tags in the tag workflow, and push the fix to the default
  branch after publishing, so a forgotten version bump no longer fails releases.
- Ignore Bun's additional local `.env` variants and handle malformed preview
  URLs with a useful HTTP error.

## [0.1.1] - 2026-10-20

### Changed

- Replace the toolbar popup and separate options/history pages with one
  full-page workspace. The toolbar opens or focuses the existing workspace tab.
- Add a dark media interface with service-specific auto-skip controls, guided
  Trakt setup, searchable/selectable watch history, and responsive layouts.
- Move dependency management, bundling, tests, preview serving, and release
  builds to Bun. Bundle styles and Manrope locally and retain the Chrome ZIP.
- Check service registration and serialized Netflix session/playback functions
  in development and minified production bundles.

### Known release metadata issue

The 0.1.1 tag was created while `package.json` still contained 0.1.0, so the
original 0.1.1 ZIP displays 0.1.0 in Chrome. The tag and assets are retained;
subsequent releases enforce agreement between tag and package version.

## [0.1.0] - 2026-10-20

### Added

- Initial Chrome Manifest V3 extension for Netflix, Prime Video, and HBO Max.
- Per-service skipping of intros and recaps, optional credits/next episode,
  and Netflix's optional continue-watching prompt dismissal.
- Trakt sign-in, playback scrobbling, title matching/correction, watch-history
  import, and opt-in scheduled synchronization from Universal Trakt Scrobbler.
- Local credential/token storage outside Chrome Sync, license attribution,
  automated skip/authentication fixtures, and installation/testing guides.
- Tag-triggered GitHub Releases with a Chrome extension ZIP and SHA-256 checksum.

Authenticated streaming and real Trakt writes require the manual checks in
[docs/TESTING.md](docs/TESTING.md); neither release claims that verification.
