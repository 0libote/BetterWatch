# Third-party source notices

BetterWatch is a Chrome-only derivative combining the following projects.
The combined work is distributed under GPL-3.0-or-later; the retained MIT
components also remain available under their original MIT license.

## Universal Trakt Scrobbler

https://github.com/trakt-tools/universal-trakt-scrobbler

The playback, metadata, Trakt authentication/search/scrobbling, history sync,
and underlying UI infrastructure in `src/` originate from this project.
Original MIT license: `licenses/UNIVERSAL-TRAKT-SCROBBLER-MIT.txt`.

Universal Trakt Scrobbler source snapshot: `555b8976d1a043bf7a0160223dced83a75030190`.

Streaming enhanced source snapshot: `12c9d1a9b7e8cf4300f903ad1da1ae115596bb4f`.

## Streaming enhanced (Netflix-Prime-Auto-Skip)

https://github.com/Dreamlinerm/Netflix-Prime-Auto-Skip

The service-specific skip selectors and skip-button behavior in `src/skip/`
are adapted from this project, rewritten to run independently of Trakt.
Original GPL license: `licenses/STREAMING-ENHANCED-GPL-3.0.txt`.

BetterWatch modifications: restrict the service catalog and builds to Chrome,
add independent skip preferences and controls, add local Trakt app setup,
change the popup and theme, and disable optional telemetry/community services
by default. No endorsement by the upstream projects is implied.
