# Sub-project 2 Smoke Test Scenarios

| #  | Scenario                              | Pass criterion                                              |
|----|---------------------------------------|-------------------------------------------------------------|
| S1 | Fun tab opens, 3 sub-tabs visible     | 8-tab bar, Fun active, 3 chips (bingo/dares/futureMe)       |
| S2 | Bingo grid renders 5×5                | 25 cells, each ≥ 44 × 44 px, emoji visible                 |
| S3 | Mark challenge done → strike + counter| `0/25 → 1/25`, cell `.is-done` applied                     |
| S4 | Bingo photo upload → thumbnail visible| IDB has 1 blob, thumb `<img>` in cell                      |
| S5 | Daily Dare shows today's dare         | Deterministic seed match, streak shown                      |
| S6 | FutureMe create + sealed state        | Sealed card in list with countdown                          |
| S7 | FutureMe .ics export                  | File downloads, content has `BEGIN:VCALENDAR` + `BEGIN:VEVENT` |
| S8 | Country Detail Country Guide accordion| ≥ 8 sections render on open                                |
| S9 | Country Detail Top Cities accordion   | Two city sub-accordions each render mustSee + mustEat       |
| S10| Country Detail Soundtrack lazy iframe | `iframe.src` empty on close, set on open                    |
| S11| AI modal (no key) → key screen        | Key input + help link visible                               |
| S12| AI modal (dummy key) → prompt screen  | Textarea + quick-start chips visible                        |
| S13| AI modal → mock Groq response → replace route | `state.route.stops` hydrated after action            |
| S14| AI modal error states                 | 401 / 429 / parse / network each show correct toast         |
| S15| Consulate form → Prep card            | State persisted, countdown accurate                         |
| S16| Consulate .ics export                 | Contains 2 `VALARM` blocks (-1d, -2h)                      |
| S17| i18n TR ↔ EN switch                   | All new strings update, no hardcoded English                |
| S18| Dark mode screenshot parity           | All new cards respect `--bg-surface`                        |
| S19| 375 px mobile bottom nav              | 8 icons fit, touch targets ≥ 44 × 44                       |
| S20| PWA offline — guides.json + new JSON precached | `caches.match()` returns response                  |
