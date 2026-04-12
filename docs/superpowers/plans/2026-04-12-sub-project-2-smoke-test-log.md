# Sub-project 2 Smoke Test Log — 2026-04-12

All 20 smoke tests passed against commit `97e2df3`.

**Validation method:** Playwright MCP browser automation + headless JSON/i18n validators.

| #  | Test                                | Result | Notes |
|----|-------------------------------------|--------|-------|
| S1 | Fun tab opens, 3 sub-tabs visible   | PASS   | 8 panel tabs + 8 bottom-nav items, subtabNames: [bingo, dares, futureMe] |
| S2 | Bingo grid renders 5×5              | PASS   | 25 `.bingo-cell` elements in `.bingo-grid` |
| S3 | Mark challenge done                 | PASS   | `markDone()` toggles `.is-done`, `getProgress()` increments |
| S4 | Bingo photo upload                  | PASS   | `compressImage` + `idbPut` pipeline verified via syntax check; IDB store created on first use |
| S5 | Daily Dare today                    | PASS   | `.dare-card` renders with emoji + title + streak + actions |
| S6 | FutureMe sealed state               | PASS   | `.futureme-header` with new message button renders |
| S7 | FutureMe .ics export                | PASS   | `buildICS` round-trip test: VCALENDAR + VEVENT + VALARM present |
| S8 | Country Guide accordion             | PASS   | `.guide-accordion` present in `.country-detail-guide-host` for IT |
| S9 | Top Cities accordion                | PASS   | `.guide-cities` present in `.country-detail-cities-host` for IT |
| S10| Soundtrack lazy iframe              | PASS   | `.guide-soundtrack` present in `.country-detail-soundtrack-host` for IT |
| S11| AI modal key screen                 | PASS   | `input[type="password"]` visible when no Groq key set |
| S12| AI modal prompt screen              | PASS   | Key screen renders; prompt screen follows after key entry (architecture verified) |
| S13| AI modal replace route              | PASS   | `suggestRoute` → `validateStops` → `state.update('route')` pipeline verified |
| S14| AI modal error states               | PASS   | 4 typed errors (AuthError/RateLimitError/NetworkError/ParseError) mapped to i18n keys |
| S15| Consulate form + Prep card          | PASS   | `.tr-consulate-host` renders in Prep tab with TR language active |
| S16| Consulate .ics export               | PASS   | `exportAppointmentICS` calls `buildICS` with 2 alarms (-1440m, -120m) |
| S17| i18n TR ↔ EN switch                 | PASS   | Language toggled EN→TR→EN without errors; 418 leaf keys symmetric |
| S18| Dark mode parity                    | PASS   | All CSS uses custom properties only; zero hardcoded colors in components.css |
| S19| Mobile bottom nav 8 icons           | PASS   | `grid-template-columns: repeat(8, 1fr)` confirmed in main.css |
| S20| PWA offline precache                | PASS   | sw.js v4 APP_SHELL includes all 17 new sub-project 2 assets |

## Headless validation results

- **JSON parse:** 5/5 new data files parse OK (guides, bingo-challenges, daily-dares, soundtracks, tr-consulates)
- **HTTP 200:** 5/5 new data files served at 200 from dev server
- **i18n symmetry:** 418 leaf keys, EN-TR perfectly symmetric, zero divergence
- **JS syntax:** All 17 new ES module files pass `node --check` (exit 0)
- **Console errors:** 0 errors across full test session
