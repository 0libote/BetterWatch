# Upstream parity — 2026-11-05

Compared against unchanged upstream heads (Universal Trakt Scrobbler `8dc74f1`,
Streaming enhanced `1b19523`). Ported the remaining user-visible gaps for the
three focused platforms: Netflix `netflix.ca`/`netflix.com.au` host coverage,
the Filipino Prime intro label, and Netflix/Prime Video artwork (`imageUrl`)
plumbing so history shows thumbnails without a TMDB key. Watch-credits
controls, speed sliders, and non-focused services remain intentionally out of
scope; the HBO tracking/history experimental limit and the real-account gate
below still apply. **117 tests pass.**

Verified 2026-11-05 in real Chromium 156.0.8078.79 (headless, fresh profiles):
the shipped `build/chrome` was loaded unpacked and each service fixture
(Netflix intro, Prime recap, Max intro over local HTTPS with host-resolver
mapping, real-time CDP polling) was skipped exactly once with no extension
errors. Fixture harness in `/tmp/opencode/fixture/`; dummy pages only, no
real accounts or history writes.

---

# Recovery follow-up — 2026-11-04

Tracking and import recovery now have additional regression coverage:
**112 tests pass**. Temporary tracking failures retry with backoff up to 30
seconds, without reporting success locally. Disabling tracking stops the watch;
re-enabling creates one polling loop. Expired tokens refresh before matching,
tracking transitions, and history operations. Active-title corrections retain
progress, and inactive tabs cannot clear another tab's current watch.

History retries preserve pagination and recheck Trakt before another write.
Failed scheduled runs retain their watches and do not advance the sync date.
Canceled Netflix requests stop retrying, and the workspace reports cancellation
without implying a login failure.

The production extension was loaded in isolated Chromium with controlled HTTPS
streaming/Trakt responses. Verified failed start/pause recovery, disable/re-enable,
token refresh, title correction at 25% progress, an accepted import whose response
failed (retry sent no second POST), and cancellation of a slow history request.
No page JavaScript errors occurred. Scripts/results are retained locally in
`/tmp/betterwatch-recovery/`. No real accounts or history writes were used.
The real-account and HBO production limits below still apply.

---

# Readiness update — 2026-11-04

**Status: basic local development use, with HBO tracking/history experimental.**
This is not a production certification or a claim of complete upstream parity.
The earlier assessment below is retained as a historical record.

## Fixed since the assessment

- Chrome background requests include profile cookies for the registered
  streaming hosts only. Trakt and other external APIs omit browser cookies;
  bearer headers and local credentials are preserved.
- Tracking registers its tab listener before asynchronous initialization,
  processes each tab's updates in order, serializes session mutations across
  tabs, and releases reservations after failed injection. Full navigation,
  navigation away, and tab closure clean up the old document.
- Host matching uses parsed URL hostnames instead of unescaped regular
  expressions. Disconnected tabs no longer block broadcasts to other players.
- Auto-skip covers max.com. The HBO tracking service also recognizes that host,
  but its legacy API is still experimental. Tracking/history default off for
  new installs; existing preferences are preserved. Auto-skip is independent.
- Class-less Prime controls are recognized from known localized skip commands.
  Intro/recap switches remain separate; unrelated bonus-feature buttons are
  left alone.
- Trakt title links and suggestion lookups follow upstream's app URL fix.
  Copied correction URLs are checked for valid hosts, paths, and episode numbers.

The relevant Universal Trakt Scrobbler fixes are `2c8c319` and `24529ee`.
Heads checked during this work were Scrobbler `8dc74f1` and Streaming enhanced
`1b19523`. Upstream features outside BetterWatch's stated service/feature scope
were not imported wholesale. BetterWatch's history workspace directly performs
selected imports, rather than using upstream's separate auto-sync dialog.

## Verification of the updated build

- `bun run check`: TypeScript and **85 tests pass, 0 fail**.
- Production build, resource validation, ZIP/checksum, preview HTTP checks,
  and release-version checks pass.
- The actual production extension was loaded in isolated Chromium
  156.0.8078.79. A local HTTPS fixture supplied streaming/Trakt responses;
  Chrome storage, extension messaging, scripting, and network APIs were real.
- Confirmed background session-cookie forwarding and cookie-free Trakt calls;
  Netflix intro skipping; connection during open playback; correct title ID
  and progress in start/pause/resume/stop; preference persistence and updates
  in an open player; selected history import and duplicate prevention.
- Tracking also woke and injected in a new player after explicitly stopping
  the Chrome service worker.
- Production Prime localized fallback and Max auto-skip controls clicked in
  their respective controlled HTTPS pages.
- Workspace routes opened without page JavaScript errors and fit a 390px
  viewport. HBO tracking and history default off in the installed extension.

Runtime fixture scripts and results are retained in this environment under
`/tmp/betterwatch-validation/`. They use dummy credentials and write no real
Trakt history. Permanent regression coverage is in `tests/`.

## Remaining production gate

Run the authenticated checks in [TESTING.md](TESTING.md) with real Netflix,
English Prime, and Trakt accounts, including OAuth, refresh/revoke, regional
flows, and scheduled imports. No real streaming account or Trakt OAuth session
was used in the isolated test profile. HBO's endpoint/session assumptions need
current authenticated evidence before its tracking/history can be promoted
beyond experimental support. Chrome 120 was not separately exercised.

---

# Readiness assessment — 2026-10-28

Assessed BetterWatch 0.1.2 at `d3d5d40419b4f329d4dd092334d1ac7ffb47ee9e`.

**Verdict: not ready for a production release claiming all three services work.**
Build health is good, and the installed workspace works in Chromium. Additional
tests exposed a shared authentication problem and an injection race. Matching
upstream code also carries upstream's unresolved HBO limitations.

## Upstream comparison

Sources were cloned and compared, rather than relying on their feature lists.

- Universal Trakt Scrobbler's recorded original is
  `555b8976d1a043bf7a0160223dced83a75030190`. Its current head during this review
  was `2c8c319ec5d1018e42cd44b58addb6883f25405c`, four commits later.
- Streaming enhanced's recorded original and current head were both
  `12c9d1a9b7e8cf4300f903ad1da1ae115596bb4f`.
- All 13 files in BetterWatch's Netflix, Amazon Prime, and HBO Max service
  directories are byte-for-byte identical to both the recorded Scrobbler
  snapshot and its current head. This includes their parsers and API endpoints.
- `TraktScrobble`, `TraktSync`, `TraktSettings`, `ServiceApi`, and `TmdbApi`
  also match current upstream exactly. BetterWatch deliberately changes
  `TraktAuth` and `TraktApi` for locally configured credentials and safer auth.
- The primary Netflix, Prime, and HBO skip selectors match Streaming enhanced.
  Its Prime fallback and `max.com` coverage were not carried over.
- BetterWatch has no replacement hosted backend. Trakt requests still target
  `api.trakt.tv` v2; optional community suggestions and TMDB proxy requests
  still target `https://uts.rafaelgomes.xyz/api`. Those optional integrations
  default off and were not live-tested.

## Findings

### 1. High: background requests omit streaming-session cookies

`src/common/Requests.ts:229` calls `fetch()` without `credentials: 'include'`.
Other extension contexts forward requests through this background implementation.
The inherited manual cookie workaround is unavailable in this Chrome manifest:
it does not request `cookies`, `webRequest`, or blocking webRequest access.

Reproduced in the installed production extension on Chromium 156.0.8078.47,
using an isolated profile, a dummy secure Netflix cookie, and an intercepted
HTTPS endpoint that returns the request's cookie header:

```text
extension-page default fetch:           cookie = null
extension-page credentials=include:     cookie = betterwatch_fixture_session=dummy
actual send-request background handler: cookie = null
```

This establishes missing cookies in the real request path, not successful or
failed authentication against a real Netflix account. Cookie-authenticated
Netflix/Prime activation and history calls cannot be considered ready until
this is corrected and tested against signed-in accounts. Bearer-token Trakt
requests are a separate authentication mechanism.

This file is identical to current upstream; the defect was inherited.

### 2. High: HBO tracking uses a legacy integration with unresolved upstream failures

`src/services/hbo-max/HboMaxApi.ts:142` uses the Hadron 50.41 client,
`api.hbo.com` endpoints, and `authToken`/`deviceSerialNumber` local-storage keys.
The parser recognizes `/player/<id>` URLs only. These are inherited assumptions,
not evidence that current HBO playback and history work.

Upstream has unresolved login/history reports in
[issue 428](https://github.com/trakt-tools/universal-trakt-scrobbler/issues/428)
and [issue 310](https://github.com/trakt-tools/universal-trakt-scrobbler/issues/310).
These are user reports, not a live reproduction in this review.

There is also a confirmed coverage difference: Streaming enhanced's manifest
includes both `max.com` and `hbomax.com`, while BetterWatch's manifest and
`serviceForHost()` exclude `max.com`. Calling `serviceForHost('play.max.com')`
returns `null`; neither auto-skip nor tracking is injected there. Whether a
particular account still visits that host depends on region and redirects.

Do not promise HBO tracking/history support without a current authenticated
capture proving the endpoint, session format, and playback URL assumptions.

### 3. Medium: simultaneous tab updates inject the same tracking script twice

`src/common/ScriptInjector.ts:96` reads session storage before reserving a tab.
Two concurrent calls can both read the same empty list and both inject.

A deterministic harness compiled the real module and issued two concurrent
complete updates for tab 10 at `https://www.netflix.com/watch/123`:

```text
expected scripting.executeScript calls: 1
actual scripting.executeScript calls:   2
```

This can duplicate content-script initialization and tracking activity. The
harness proves duplicate injection; it does not prove duplicate real Trakt
history writes.

Current upstream fixes per-tab serialization and reload cleanup in
[commit 2c8c319](https://github.com/trakt-tools/universal-trakt-scrobbler/commit/2c8c319ec5d1018e42cd44b58addb6883f25405c).
BetterWatch also lacks that commit's synchronous background-listener
registration. A stop/restart experiment **passed on Chromium 156**: auto-skip
worked and the tracking bundle was injected after the worker stopped. The
asleep-worker failure was therefore not reproduced here; it remains an
upstream-documented lifecycle risk, particularly for the claimed Chrome 120+
range, which was not tested in full.

### 4. Medium: Prime skip behavior is narrower than the original

`src/skip/model.ts:42` requires a class containing `skipelement` for Prime intro
or recap controls. Streaming enhanced additionally searches button text when
that class is missing, including localized intro labels. BetterWatch has no
such fallback, so those upstream-supported controls cannot be selected.

The cautious handling of unknown intro/recap labels is intentional and separate
from this missing selector fallback.

### 5. Low: recent upstream Trakt navigation fixes are missing

`src/models/TraktItem.ts` still generates old `trakt.tv/users/me/history` links
with episode/movie filters. Upstream replaced these with direct
`app.trakt.tv` title/episode links and updated correction-dialog lookups in
[commit 24529ee](https://github.com/trakt-tools/universal-trakt-scrobbler/commit/24529ee48637e8e10ee2ade9bfd61921eabf46df).
BetterWatch's search/correction code predates that change. This is a confirmed
source difference; no signed-in Trakt navigation was exercised here.

## Checks performed

- `bun run check`: repository checks, TypeScript, **58 tests passed, 0 failed**.
- `bun run build`: production extension built; manifest/resource checks passed.
- `bun run package:check`: all 37 packaged files and SHA-256 verified.
- `bun run smoke:preview`: HTTP, MIME types, mock isolation, and error routes passed.
- `bun run release:check`: tag 0.1.2 agrees with package metadata.
- Loaded the actual production extension in an isolated Chromium profile,
  without the UI harness or mocked Chrome APIs.
- Opened Overview, Auto-skip, Trakt, Watch history, Settings, and Help. No page
  JavaScript errors were observed. Checked one page at 390px: no horizontal overflow.
- Toggled intro preferences separately for all three services and checked
  persisted state after reload. Rejected empty Trakt application credentials.
- Exercised packaged Netflix auto-skip on an intercepted HTTPS fixture:
  the visible intro control was clicked. Worker stop/restart was also exercised.
- Parsed movie and season/episode metadata using the actual Netflix API class.
- Ran the additional cookie and duplicate-injection reproductions described above.

The standard 58 tests use fixtures/mocks for streaming and Trakt. Passing them
does not override the additional failures. The worker restart test and cookie
test used actual Chrome extension APIs; their network content was controlled.

## Release gate

Correct cookie forwarding and the injection race; restore or explicitly narrow
the missing upstream skip coverage; resolve or withdraw the HBO tracking claim.
Then run the authenticated checks in [TESTING.md](TESTING.md), including Trakt
OAuth/refresh/revoke, actual play/pause/stop and history writes, duplicate import
handling, service-worker restarts during playback, and regional service flows.

No authenticated streaming subscriptions or Trakt credentials were available in
the isolated test profile. No real watch-history entries were written. No
application code was changed during this assessment.

Review scripts and raw JSON results were retained for this environment under
`/tmp/betterwatch-readiness/` (`browser.cjs`, `network.cjs`, `contracts.ts`, and
their result files). Upstream clones are under `/tmp/betterwatch-uts-review/`
and `/tmp/betterwatch-skip-review/`. Temporary artifacts are not release inputs.
