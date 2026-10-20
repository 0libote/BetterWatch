# Full-page design

BetterWatch has one HTML interface, `app.html`. Clicking the toolbar opens it
or focuses its existing tab. Overview, auto-skip, Trakt, watch history, and
settings share navigation, state, and the same visual language.

## Direction

A dark media control room, with readable controls and no invented watching
statistics or placeholder viewing history. The six core colors are ink
`#11121a`, stage `#181922`, panel `#20212d`, line `#343542`, lavender
`#b5a2f3`, and chalk `#f0edf8`. Service colors identify the three providers.
Manrope is packaged locally for both headings and body text, with tabular
numbers for playback and history. Headings are clear and compact; secondary
copy explains consequences rather than implementation.

A quiet fixed sidebar anchors a spacious, left-aligned workspace:

```
brand       page name                         connection status
Overview    current watching / next action    Trakt connection
Auto-skip   Netflix       Prime Video         HBO Max
History     service controls                  local privacy note
Trakt
Settings
```

Service tiles carry recognizable marks and actual preferences. The playback
preview shows the parts an enabled setting will skip. Trakt setup uses a real
three-step sequence, includes copying the redirect URI, and completes in the
same page. History loads on request into a searchable, selectable table;
matching, dates, and syncing retain the existing APIs and correction dialogs.

## Review against generic defaults

Avoid a poster backdrop or decorative dashboard metrics: neither represents
real data before playback. Use the skip timeline as the characteristic visual
because it explains the product's behavior. Keep filled panels for distinct
tasks, and use rows for preferences rather than nesting cards inside cards.
The lavender accent is reserved for actions and selected states. Real provider
colors and clear status language supply the remaining hierarchy.

The layout adapts to a compact navigation rail and then a horizontal navigation
bar on narrow screens. All actions have keyboard focus, switches expose their
state, feedback is announced, and motion respects reduced-motion preference.
