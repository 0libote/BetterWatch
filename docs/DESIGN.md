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
Overview    service        intros / recaps / credits / auto-skip
Auto-skip   Netflix        direct controls and history links
History     Prime Video    direct controls and history links
Trakt       HBO Max        direct controls and history links
            playback preview                  Trakt connection
Trakt
Settings
```

The overview starts with a control table for all three services. Each row
provides separate intro, recap, credit, and enable switches, plus Netflix
keep-watching. Pausing a service disables its action switches while preserving
them. Rows become compact labeled controls on mobile. History and detailed
settings are linked per service. The playback preview follows the selected
service and shows the parts its enabled settings will skip. Trakt setup uses a real
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
