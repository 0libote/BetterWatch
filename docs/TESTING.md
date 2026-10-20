# Verification

## Automated

`bun run check` runs TypeScript under Bun and the native Bun test runner.
Tests use `bun:test`; `bun run test` enables `--isolate` so each file has its
own globals and module cache, including its mock Chrome APIs. DOM tests exercise real skip
engine code against representative upstream player selectors in jsdom.
The Trakt tests use a mock extension environment and no network requests.

Covered behaviors:

- Supported host boundaries and malformed preference recovery.
- Netflix intro/preplay recap selectors, including a non-English intro.
- Hidden/disabled controls, service/action switches, missing video elements.
- Click cooldown, episode navigation, and opt-in credits/keep-watching.
- Prime and HBO shared intro/recap preference handling and known selectors.
- Prime recommendation controls without an identified next episode.
- OAuth callback state rejection/acceptance before code exchange.
- Waiting for authorization before playback lookup, and beginning tracking
  after connecting in an already open player tab.
- Current local app ID/token headers, shared concurrent token refresh,
  cancel/retry, and token preservation/removal on temporary/auth failures.
- Local-only token persistence, protection against sync overwrite, complete
  removal of a single synced storage key.
- Service registration in Bun's development and minified production bundles,
  plus Netflix session/playback functions serialized into a fresh page context
  without access to the bundle's variables or compiler helpers.

`bun run build` uses Bun's browser bundler to emit Chrome Manifest V3 output,
a ZIP, and its SHA-256 checksum. All script entry points use IIFE format so
Chrome can load them as classic content scripts and a classic service worker.
CSS is extracted into `app.css`, linked by the only HTML page. Build validation
must also confirm all manifest-referenced resources exist, only the three
service bundles are present, and the ZIP contains attribution/license files.

`bun run preview` uses `Bun.serve` to serve the compiled single `app.html` workspace with
mock Chrome APIs. Browser inspection checks desktop and narrow layouts, preference changes,
service switching, guided setup, form validation, and appearance changes. This does
not validate Chrome extension loading or real Trakt/streaming requests.

## Full-page regression checks

The build validator asserts that `app.html` is the only packaged HTML page
and that the toolbar action has no `default_popup`. Toolbar tests cover
creating a workspace tab, focusing an existing tab/window, deduplicating
concurrent clicks, and replacing a closed tab. History selection tests prevent
imports of already synced items, incomplete lookups, missing dates, and watches
below the threshold. Chrome service preferences must not revoke the host
permissions needed by independent auto-skip.

## Required live checks before calling this production-ready

These require an authenticated Chrome profile and streaming subscriptions.

1. Load `build/chrome` unpacked, inspect the extension's Errors view and
   service-worker console, and confirm no registration/runtime errors.
2. Open Netflix, start an episode, and confirm the intro and recap buttons
   skip once. Disable each preference while watching and confirm it stops.
3. Enable credits and keep-watching separately and verify their actual
   service buttons. Navigate to another episode without refreshing.
4. Use the workspace’s **Trakt connection** flow with the displayed redirect URI and
   `/scrobble` permission. Confirm connect, cancel/retry, and disconnect.
5. Confirm the show/season/episode (and a movie) resolve correctly. Pause,
   resume, seek, reach completion, close the tab, and check Trakt watching and
   history. Skip an intro and credits during this flow to check interaction.
6. Stop/restart the extension service worker during playback; verify that
   messages wake it and pause/stop still reach Trakt.
7. Load Netflix history, inspect dates/progress, correct a match, and sync a
   small selected sample. Repeat syncing to check duplicate handling.
8. Repeat playback, skips, matching, and history on English Prime Video and
   HBO Max. Verify current account/region endpoints before claiming support.
9. Opt into scheduled sync and verify the alarm opens the appropriate
   history page and preserves profile context.
10. Simulate token expiration, revoked authorization, temporary network
    failure, and rate limiting. Verify refresh/retry and useful errors.

The authenticated checks remain required after the full-page redesign. Upstream
support listings are the scope decision, not evidence of live verification.

## Redesign browser checks

The UI harness was exercised at desktop, tablet, and 390px widths. Verified
service-specific persistence, disabled controls, route changes, empty setup
validation, keyboard focus, appearance changes, and history search/selection.
History fixtures were injected only into the mock browser storage for these
checks and removed afterward; they are not in the application or release.

An axe-core WCAG A/AA audit is also run against the rendered workspace. This
complements keyboard and layout inspection; it does not replace authenticated
Chrome extension or streaming tests.
