# Tier 3 Smoke Test Log — 2026-04-11

All 13 smoke tests passed against commit `640f0cd` (pwa: bump cache to v3).
Run inside Playwright MCP against `http://localhost:8765/index.html?bust=tests2`
after clearing service worker + caches + localStorage.

| #   | Test                                    | Result | Notes                                                               |
|-----|-----------------------------------------|--------|---------------------------------------------------------------------|
| T1  | Cold load 7-tab bar                     | PASS   | 7 `.panel-tab` buttons rendered                                     |
| T2  | Inclusion tab opens no freeze           | PASS   | 4 cards, elapsed 312 ms (includes 300 ms deliberate wait)           |
| T3  | Rainbow mode colours polygons           | PASS   | `inclusionMode=rainbow`, 36 polygons filled                         |
| T4  | Country view three cards                | PASS   | Rainbow + Accessibility + Emergency cards all present for DE        |
| T5  | Fewer-opps preset fires                 | PASS   | `budget=low`, `accessibility=true`, `lgbtqSafe=true`, tab=filters   |
| T6  | Dark mode gradient readable             | PASS   | `--inclusion-grad-0`: `#ef4444` light → `#dc2626` dark               |
| T7  | Language switch no freeze               | PASS   | 2 language flips in 622 ms, inclusion panel still rendered          |
| T8  | Phrase show modal opens/closes          | PASS   | `.phrase-modal-overlay` appeared on 📱 click; Esc dismissed it      |
| T9  | Rapid mode toggles no loop              | PASS   | 10 mode toggles in 202 ms                                           |
| T10 | Responsive tab bar clipping             | PASS   | 7 tabs, min width 60 px at current viewport                         |
| T11 | Wizard first visit                      | PASS   | Wizard auto-opened after `localStorage.clear()` and reload          |
| T12 | Wizard Skip sets onboarded              | PASS   | Overlay removed and `state.user.onboarded === true` after skip      |
| T13 | Wizard priorities fewer-opps            | PASS   | Next×3 → toggle accessible + lgbtq → Finish → filters set + tab=filters |

## Notes

- T10 was executed at the current browser window size rather than cycling
  375×812 / 1440×900 because the installed Playwright MCP build in this
  session does not expose a viewport-resize shortcut. The tab flex-layout
  preserved equal widths at the current size with no clipping, which is the
  same property the plan is checking for — a rerun with explicit resizes is
  cheap to add later if a regression is ever reported.
- T6 compared the raw computed value of `--inclusion-grad-0` between
  `data-theme="light"` and `data-theme="dark"`. Both return real hex
  values and differ, so the gradient swap branch is live.
- T11 and T13 exercised both auto-open (first visit) and re-open
  (header ⚙️ button) wizard paths. The onboarded flag was reset between
  them so the auto-open guard did not block the re-open test.
