# Verification

## Automated

`npm run check` runs TypeScript and Node tests. DOM tests exercise real skip
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

`npm run build` emits Chrome Manifest V3 output plus a ZIP. Build validation
must also confirm all manifest-referenced resources exist, only the three
service bundles are present, and the ZIP contains attribution/license files.

`npm run preview` serves the compiled popup, settings, and history pages with
mock Chrome APIs. Browser inspection checks popup width, preference changes,
service switching, setup form validation, and both color schemes. This does
not validate Chrome extension loading or real Trakt/streaming requests.

## Required live checks before calling this production-ready

These require an authenticated Chrome profile and streaming subscriptions.

1. Load `build/chrome` unpacked, inspect the extension's Errors view and
   service-worker console, and confirm no registration/runtime errors.
2. Open Netflix, start an episode, and confirm the intro and recap buttons
   skip once. Disable each preference while watching and confirm it stops.
3. Enable credits and keep-watching separately and verify their actual
   service buttons. Navigate to another episode without refreshing.
4. Configure a new Trakt application with the displayed redirect URI and
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

The initial build has not completed these authenticated checks. Upstream
support listings are the scope decision, not evidence of live verification.
