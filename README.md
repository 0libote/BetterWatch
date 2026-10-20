# BetterWatch

A Chrome Manifest V3 extension combining auto-skip with Trakt tracking.
Netflix is the primary target. Prime Video and HBO Max are included because
both upstream projects list them with skip support and Trakt scrobbling plus
history sync.

This is an initial development build. The build, automated fixtures, and UI
harness are verified; authenticated streaming and real Trakt writes still
need the manual checks in [docs/TESTING.md](docs/TESTING.md).

## Install in Chrome

Requires [Bun](https://bun.com/docs/installation) 1.4.3+ and Chrome 120+.
The development and release toolchain uses Bun; a separate Node.js install
is not required. CI uses the Bun version pinned in `package.json`.

```sh
bun install --frozen-lockfile
bun run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select this repository's `build/chrome` folder.
3. Pin BetterWatch, then reload any streaming tabs that were already open.
4. Click the toolbar icon to open the full-page workspace. Clicking again
   focuses the existing workspace tab.

The same build creates `dist/betterwatch-chrome.zip` and `dist/SHA256SUMS`. Unzip it before loading
it as an unpacked extension. No Firefox build or hosted backend is included.

## Release a version

Every tag pushed to GitHub triggers `.github/workflows/release.yml`. It installs
the locked dependencies, runs the type checks and tests, builds and validates
the Chrome extension, then publishes a GitHub Release for that tag with
`betterwatch-chrome.zip` and `SHA256SUMS`. Re-running the workflow updates the
assets on the existing release. No additional GitHub secrets are required;
Trakt credentials are configured locally after installing the extension.

The extension version comes from `package.json`. To bump it, create a matching
tag, and publish both the version commit and tag:

```sh
bun pm version patch
git push origin main --follow-tags
```

Tags with other names also trigger a release and use the package version from
their tagged commit. Creating a local tag alone does not publish anything.

## One workspace

All controls live in one extension page, `app.html`:

- **Overview** shows the actual playback and Trakt connection state, service
  preferences, and Netflix quick controls.
- **Auto-skip** gives each service its own controls and playback preview.
- **Trakt connection** guides registration, credentials, authorization, and
  per-service tracking without leaving the workspace.
- **Watch history** loads on request, supports search and selection, corrects
  matches and watched dates, and imports selected items. Scheduled results are
  available in the same view.
- **Settings** controls appearance, scheduled imports, import rules, optional
  extras, and cached matches. Dark mode is the initial default.

The extension has no toolbar popup and no separate options/history HTML pages.
Chrome’s extension options open the Settings section of this same workspace.
The HTML page runs as part of the installed extension; opening it directly as
a `file://` document cannot provide Chrome extension APIs.

## Connect Trakt

Auto-skip works without a Trakt account or application configuration.

1. Open **Trakt connection** in the BetterWatch workspace. Copy the redirect
   URI shown in the first step.
2. Create an application at https://trakt.tv/oauth/applications/new with that
   exact redirect URI and the `/scrobble` permission enabled.
3. Enter the application's client ID and client secret into BetterWatch
   connection page and choose **Save application**.
4. Choose **Connect Trakt** in the last step and authorize your application.
5. Start a movie or episode. The overview shows the title matched on Trakt; use
   the correction control if it identifies the wrong title.

The redirect URI depends on Chrome's extension ID. Keeping the unpacked
folder in the same location keeps that ID stable; if it changes, update your
Trakt application's redirect URI. App credentials and access/refresh tokens
stay in this profile's local extension storage, outside Chrome Sync. The
client secret in a browser extension is not a confidential server secret.
Changing app credentials disconnects the current session. Disconnect on the
connection page revokes the token through Trakt.

For a developer-managed build, `.env.example` lists optional build-time
credentials. Local values entered in settings override those build defaults.
Do not distribute a personal credential-bearing build or commit `.env`.

## Included behavior

- Per-service switches for intros, recaps, and advancing to the next episode
  during credits. Intro and recap skipping default on; credits default off.
- Netflix's continue-watching prompt can be dismissed automatically when
  explicitly enabled.
- Skipping uses visible service-provided controls, independently of Trakt.
  A disabled service or action takes effect in open tabs.
- Trakt start, pause/resume, stop, progress, title matching, and corrections
  retain Universal Trakt Scrobbler's implementation.
- **Watch history** provides history loading, match/date correction, and
  syncing selected watched items to Trakt. Scheduled history sync is opt-in
  in Settings; it is off by default.

Trakt scrobbling and history access default enabled for the three services.
History is not imported automatically unless scheduled sync is enabled or
you select items and sync them in the history screen.

## Scope and limits

- Netflix, Prime Video, and HBO Max are the entire service catalog.
- Prime Video scrobbling inherits the upstream English-language limitation.
  Supported Prime hosts are primevideo.com and Amazon's US, UK, Germany,
  Japan, and Australia domains.
- Shared intro/recap controls on Prime and HBO are classified from known
  button labels. Unknown labels are left untouched to respect the separate
  preferences. Netflix uses language-independent `data-uia` selectors.
- Skip-button availability and metadata depend on the streaming service's
  current UI, subscription, title, and region. This build does not claim
  that all authenticated service flows have been validated.
- Ad blocking, forced seeking through ads, playback speed, ratings overlays,
  profile selection, and cosmetic page modifications are outside this first
  version. There is no Firefox, mobile, Disney+, or Crunchyroll build.
- Optional community match suggestions, TMDB images, error reporting, and
  notifications default off. The inherited settings can opt into them;
  TMDB images and Rollbar need their optional build-time keys.

## Develop and verify

```sh
bun run check      # TypeScript and isolated Bun behavior tests
bun run build      # Production extension, ZIP, and SHA-256 checksum
bun run dev        # Watch and rebuild an unpacked Chrome extension
bun run preview    # Bun UI harness at http://localhost:4173
```

`bun.lock` is the dependency lockfile. Use `bun add`, `bun remove`, and
`bun update` to manage dependencies. `bun run test` runs Bun's test runner
with file isolation so Chrome API mocks stay independent. Type checking runs
TypeScript under Bun. Bun's bundler compiles the extension and extracts its
styles and local fonts; the preview server uses `Bun.serve`.

Watch mode rebuilds changes to `src/`, `assets/`, and `licenses/`; restart it
after changing build scripts, dependency/configuration files, or `.env`.
It leaves the production ZIP untouched. Set `PORT` to change the preview port.

Reload the extension in `chrome://extensions` after a rebuild and refresh
streaming tabs. The UI harness serves the compiled workspace using mock
Chrome APIs. It verifies layout and interactions; it cannot authorize Trakt,
scrobble, or exercise a real streaming player. Harness code is not packaged.

Implementation notes and live verification steps are in
[docs/TESTING.md](docs/TESTING.md) and [docs/DESIGN.md](docs/DESIGN.md).

## Upstream projects and licensing

- [Universal Trakt Scrobbler](https://github.com/trakt-tools/universal-trakt-scrobbler)
  supplies the Trakt, metadata, history, and underlying extension code (MIT).
- [Streaming enhanced / Netflix-Prime-Auto-Skip](https://github.com/Dreamlinerm/Netflix-Prime-Auto-Skip)
  supplies the service skip selectors and behavior adapted here (GPL-3.0).

BetterWatch's combined work is GPL-3.0-or-later. Original MIT notices remain
in place. Exact source snapshots and changes are recorded in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); both original license texts
are in `licenses/` and included in the extension package.
