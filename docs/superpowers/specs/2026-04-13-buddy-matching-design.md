# Buddy Matching — v1.6 Design Spec

**Date:** 2026-04-13
**Status:** Draft (design only)
**Strategic role:** Network-effect core for KA220 Cooperation Partnership narrative. Maps directly to Erasmus+ **Participation** (peer-to-peer civic engagement) and **Inclusion** (first-time travellers get a human contact before arrival). Natural multi-country structure fits KA220's 3-orgs / 3-countries requirement — each consortium partner seeds their city's buddy pool.

---

## 1. Purpose

Connect a DiscoverEU traveller with one of three peer types on any stop of their route:
1. **Local host** — 18–25 y/o resident offering one hour of coffee + advice (strictly social, no paid hosting).
2. **Returner mentor** — 19–22 y/o who did DiscoverEU to this region previously; answers questions asynchronously.
3. **Travel companion** — another traveller in the same city ±3 days, for a shared meal / museum visit.

## 2. Scope

**In:** per-city opt-in matching board, three post types, consent + safety gate, report button, deep links into Crisis Shield, integration into country panel and route-builder stop cards.
**Out (deferred):** native chat, ML match-ranking, paid hosting, scheduling/calendar tool, identity verification, push notifications.

## 3. Architecture — GitHub Issues backplane (Option A, chosen)

**Why Option A:** auditable, zero backend, no accounts for us to manage, leverages GitHub's existing T&S and moderation tools, free, already our source of truth. Matrix (B) requires account + mod burden; Discord/Telegram (C) leaks to closed platforms; email relay (D) needs a paid inbox and manual triage.

```
 user ──► buddy-panel.js ──► buddy.js ──► opens GH "new issue" URL
                                          with prefilled template
                                                │
                                                ▼
                                    github.com/embeddedJedi/
                                    discovereu-companion/issues
                                                │
                            labels: buddy/{cityId}, buddy/{role}
                                                │
                         ┌──────────────────────┼───────────────────┐
                         ▼                      ▼                   ▼
                  other travellers       GitHub Actions      moderators
                  browse via our          bot: weekly         (maintainers)
                  read-only feed          digest comment      via normal
                  (Issues API, CORS)      per city            issue mod tools
```

No user data ever hits our code — we only open `github.com/.../issues/new?template=...&title=...&body=...` URLs. Browsing happens via the public Issues REST API (CORS-enabled, unauthenticated, 60 req/h per IP — sufficient for read-only city feeds, cached 10 min).

## 4. Data model

### 4.1 New: `data/buddy-cities.json`
```
{ "cityId": "lisbon", "countryId": "PT", "label": "Lisbon",
  "active": true, "seededBy": "consortium-partner-PT",
  "issueLabel": "buddy/lisbon", "minPosts": 3 }
```
`active: false` hides the buddy card until a partner seeds ≥ `minPosts` initial entries — prevents ghost-town UX in unlaunched cities.

### 4.2 `state.buddy` slice (persisted, minimal)
```
{ handle: null, consented: false, consentedAt: null,
  preferences: { role: null, languages: [], topics: [] },
  seenIds: [] }
```
`handle` is the GitHub handle the **user chose** to share (pseudonymous allowed). `seenIds` is a local dismissal cache so the feed doesn't re-surface posts.

### 4.3 GitHub issue templates — `.github/ISSUE_TEMPLATE/`
- `buddy-local.md` — "I live in {city} and can grab a coffee"
- `buddy-mentor.md` — "I did DiscoverEU to {region}, ask me anything"
- `buddy-traveler.md` — "I'll be in {city} on {date ±3d}"
- `buddy-report.md` — "Report a user" (handle pre-filled, reason dropdown)

Each template enforces: no surname, no phone, no address, no payment talk, "meet in public" checkbox required. YAML front-matter sets labels automatically.

## 5. New JS modules

- `js/features/buddy.js` — pure logic: `fetchCityFeed(cityId)`, `buildPostUrl(role, cityId, prefs)`, `buildReportUrl(handle)`, `filterBySeen(posts)`. No DOM.
- `js/ui/buddy-panel.js` — renders: consent gate → preferences form → city feed list → "Post mine" CTA → report link.
- Loader addition in `js/data/loader.js` for `data/buddy-cities.json`.

State touched: `state.buddy` only. No cross-module coupling beyond reading `state.route.stops` to surface buddy cards on relevant cities.

## 6. CSS (`css/buddy.css`)

`.bd-consent-gate`, `.bd-feed`, `.bd-post`, `.bd-role-badge` (3 colours: host / mentor / traveler, icon + text — colour never sole indicator), `.bd-report-btn`, `.bd-safety-banner` (persistent, AAA contrast, links to Crisis Shield).

## 7. i18n namespace `buddy.*`

`buddy.title`, `buddy.consent.headline`, `buddy.consent.bullets[1..5]`, `buddy.consent.accept`, `buddy.consent.decline`, `buddy.role.local|mentor|traveler`, `buddy.post.cta`, `buddy.feed.empty`, `buddy.feed.cached`, `buddy.safety.meetPublic`, `buddy.safety.noPayments`, `buddy.safety.shareItinerary`, `buddy.report.cta`, `buddy.handle.label`, `buddy.handle.hint`, `buddy.languages`, `buddy.topics`, `buddy.crisisLink` (~25 keys).

## 8. Integration points

- **Country panel** (`js/ui/country-panel.js`): compact "Meet a buddy in {capital}" card below Crisis Shield — only if `buddy-cities.json` lists the capital as `active`.
- **Route builder stop card** (`js/ui/route-builder.js`): small buddy icon per stop; click opens panel filtered to that stop.

## 9. Privacy & safety flow

1. First tap on any buddy surface → full-screen consent gate (not dismissible by accident, `Esc` = decline).
2. Bullets: "GitHub public · pseudonym OK · meet in public · we never see your messages · you can delete anytime · Crisis Shield link".
3. Explicit checkbox + primary button enables `state.buddy.consented = true` with timestamp.
4. Safety banner persists above every feed render.
5. Report button on every post → opens `buddy-report.md` template with handle prefilled.
6. "Forget me" button clears `state.buddy` locally; GitHub post deletion is the user's own via GitHub UI (linked).

## 10. Accessibility (WCAG AAA)

Consent gate fully keyboard-operable, focus trapped, `role="dialog"` + `aria-modal`. Post list `role="feed"`, each post `role="article"`. No infinite scroll, no FOMO timers, no red-dot notifications, no "only 2 left" scarcity. Reduced motion respected. Screen reader announces safety banner before first post.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Spam / bot posts | GitHub's native spam detection + `minPosts` gate + maintainer mod tools |
| Minors (<18) on board | Consent gate states 18+ only; rely on GitHub T&S (13+); flagged via report template |
| Predatory users | Public-meet rule, report button, Crisis Shield one tap away, no DMs in-app |
| Cultural / language friction | `preferences.languages` filter; neutral EN-first templates; partner orgs moderate in local language |
| GitHub API rate limit | 10-min cache + stale-while-revalidate; degrade to "open on GitHub" link |
| Platform dependency on GitHub | Backplane is swappable — `buddy.js` isolates URL builders; can pivot to Matrix post-launch |

## 12. Grant narrative

- **Participation (KA154 + KA220):** genuine peer-to-peer civic activity across borders — the textbook definition of EU youth participation.
- **Inclusion:** first-time / fewer-opportunities travellers arrive with a known human contact, lowering the threshold for participation.
- **Digital:** privacy-by-design, no surveillance, no PII, open-source — a model for ethical youth digital tools.
- **KA220 consortium fit:** each partner org seeds + moderates one city pool → natural 3-country structure, measurable KPIs (active cities, posts, reports resolved).

## 13. Out of scope

Native in-app chat, ML matchmaking, paid hosting, calendar/scheduling, identity verification, push notifications, reputation scores, reviews/ratings.
