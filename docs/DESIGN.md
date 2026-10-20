# First version decisions

Chrome only, with Netflix as the primary service. The service intersection is
interpreted as auto-skip support plus both live Trakt scrobbling and history
sync. This includes Netflix, Prime Video, and HBO Max. Disney+ has scrobbling
but no history sync in UTS; Crunchyroll has sync but no live scrobbling.

Retain UTS's MIT implementation for metadata resolution, OAuth, matching,
scrobbling, correction, and history review. Restrict its generated service
registry and bundles to those three providers. Skip behavior is an independent
content script, adapted from Streaming enhanced's GPL selectors. It starts
without Trakt authentication, never sends watching data itself, and watches
local preference changes. It uses bounded DOM scans and click cooldowns.

No new hosted service is required. Optional upstream community corrections,
images, and telemetry stay disabled unless enabled in settings. Tokens and
app credentials remain local to the profile; ordinary inherited preferences
can use Chrome Sync. Trakt headers reload the current app and token for each
activation so a refresh cannot leave an API instance using a stale token.

## Visual direction

Use a quiet blue player-control palette: deep slate `#182234`, ink blue
`#284e85`, sky `#9ac5f6`, mist `#f5f8fc`, paper `#ffffff`, and neutral text.
Trebuchet MS with Segoe UI fallback gives the compact controls an approachable
voice; titles use weight and tight spacing rather than decorative lettering.

A 400px, left-aligned popup places the live Trakt state above the service tabs
and skip switches, with history and settings always accessible. Settings use
a wider single column for app setup followed by skip and history preferences.
Only the Trakt state needs a filled surface; controls remain directly on the
page. Keep visible keyboard focus, native switch semantics, and light/dark
appearance. Avoid a poster-image backdrop because it competes with controls
and does not help users identify a disconnected state.

The original all-icon toolbar was replaced with named settings/history actions
to make the two primary tasks discoverable before authentication. Advanced
history matching and correction use the inherited UTS interfaces.
