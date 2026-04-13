# Buddy Matching (v1.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the peer-matching layer described in the Buddy Matching design spec — per-city opt-in buddy board with three role types (local host / returner mentor / travel companion) plus a report channel, all driven by GitHub Issues as the zero-backend backplane.

**Spec (authoritative, do NOT redesign):** [`docs/superpowers/specs/2026-04-13-buddy-matching-design.md`](../specs/2026-04-13-buddy-matching-design.md)

**Architecture summary:** One new seed JSON (`data/buddy-cities.json`). Four new GitHub issue templates under `.github/ISSUE_TEMPLATE/`. Two new feature modules (`buddy.js`, `buddy-consent.js`). One new UI panel (`buddy-panel.js`). One new stylesheet (`css/buddy.css`). New `state.buddy` slice with persistence + migration. i18n additions under `buddy.*`. Two integration points: country-detail card and route-builder stop cards. SW precache bump v8 → v9.

**Tech stack:** Vanilla ES modules, `h()` DOM helper (never innerHTML with interpolated content), CDN-only dependencies, no build step, no backend, no PII in git.

**i18n path:** `js/i18n/i18n.js`. Source files under `i18n/*.json`.

**Privacy posture:** No user data ever reaches our code. Publishing goes through pre-filled `github.com/.../issues/new?template=...` URLs that open in a new tab — the user submits via GitHub directly. Reading uses the public, anonymous Issues REST API (CORS-enabled, 60 req/h per IP), cached 10 min in IndexedDB.

---

## Task 1: State slice — `state.buddy`

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Add default slice.** In the state factory, extend the default object:

```js
buddy: {
  handle: null,                 // GitHub handle the user chose to share (pseudonym OK)
  consented: false,
  consentedAt: null,
  preferences: {
    role: null,                 // 'local' | 'mentor' | 'traveler' | null
    kinds: [],                  // roles the user is interested in seeing
    languages: [],              // ISO 639-1 codes
    topics: [],                 // free-form short tags
    citiesOptIn: []             // cityIds the user wants to follow
  },
  seenIds: []                   // local dismissal cache for feed posts
}
```

- [ ] **Step 2: Persist via `PERSIST_KEYS`.** Append `'buddy'` to the whitelist of persisted slices. Ensure hydration merges against the default shape (missing sub-keys get defaults, unknown keys dropped).

- [ ] **Step 3: Migration.** Add a one-shot migration in `hydrate()` so users arriving from v1.5 gain the slice without clobbering anything. Guard:

```js
if (!persisted.buddy || typeof persisted.buddy !== 'object') persisted.buddy = defaultBuddy();
persisted.buddy = { ...defaultBuddy(), ...persisted.buddy,
  preferences: { ...defaultBuddy().preferences, ...(persisted.buddy.preferences||{}) } };
```

- [ ] **Step 4: Whitelist validation.** Any setter that writes `state.buddy.preferences.role` MUST reject values outside `['local','mentor','traveler', null]`. `handle` trimmed, max 39 chars, `/^[a-zA-Z0-9-]+$/` (GitHub handle rules); on invalid input, leave unchanged and log a warning.

- [ ] **Step 5: Browser smoke**

```js
const s = await import('./js/state.js');
s.reset();
console.assert(s.get().buddy && s.get().buddy.consented === false, 'slice missing');
s.update(st => { st.buddy.handle = 'octocat'; });
console.assert(s.get().buddy.handle === 'octocat', 'setter failed');
s.update(st => { st.buddy.preferences.role = 'BOGUS'; });
console.assert(s.get().buddy.preferences.role !== 'BOGUS', 'whitelist failed');
location.reload(); // then:
// console.assert((await import('./js/state.js')).get().buddy.handle === 'octocat');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/state.js
git commit -m "feat(v1.6): state.buddy slice — handle, consent, preferences, seenIds with persistence + migration"
```

---

## Task 2: i18n — `buddy.*` keys (en + tr)

**Files:**
- Modify: `i18n/en.json` (source)
- Modify: `i18n/tr.json`
- Flag deferred: `de.json`, `fr.json`, `es.json`, `it.json`

- [ ] **Step 1: Add `buddy.*` keys** per spec §7. Approximate shape (~30 leaves):

```
buddy.title
buddy.subtitle
buddy.consent.headline
buddy.consent.bullets.public
buddy.consent.bullets.pseudonym
buddy.consent.bullets.meetPublic
buddy.consent.bullets.noMessages
buddy.consent.bullets.deleteAnytime
buddy.consent.bullets.crisisShield
buddy.consent.accept
buddy.consent.decline
buddy.role.local
buddy.role.mentor
buddy.role.traveler
buddy.role.report
buddy.post.cta
buddy.post.openOnGithub
buddy.feed.empty
buddy.feed.cached
buddy.feed.refreshing
buddy.feed.rateLimited
buddy.safety.meetPublic
buddy.safety.noPayments
buddy.safety.shareItinerary
buddy.report.cta
buddy.handle.label
buddy.handle.hint
buddy.languages
buddy.topics
buddy.crisisLink
buddy.cityPicker.label
buddy.cityPicker.empty
buddy.forgetMe
```

- [ ] **Step 2: Turkish translations** in `i18n/tr.json`.

- [ ] **Step 3: PROGRESS.md followup** — log "Buddy Matching translations (de/fr/es/it)" under §7.

- [ ] **Step 4: Browser smoke**

```js
const [en, tr] = await Promise.all(['en','tr'].map(l => fetch(`i18n/${l}.json`).then(r=>r.json())));
const mustHave = [
  'buddy.title','buddy.consent.headline','buddy.consent.accept',
  'buddy.role.local','buddy.role.mentor','buddy.role.traveler',
  'buddy.post.cta','buddy.feed.empty','buddy.safety.meetPublic',
  'buddy.report.cta','buddy.handle.label','buddy.cityPicker.label'
];
const pick = (o,k) => k.split('.').reduce((a,p)=>a?.[p], o);
for (const loc of [['en',en],['tr',tr]]) {
  const miss = mustHave.filter(k => !pick(loc[1], k));
  console.assert(miss.length === 0, `${loc[0]} missing: ${miss.join(',')}`);
}
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add i18n/en.json i18n/tr.json PROGRESS.md
git commit -m "feat(v1.6): i18n keys for Buddy Matching (en + tr); de/fr/es/it deferred"
```

---

## Task 3: Seed data — `data/buddy-cities.json`

**Files:**
- Create: `data/buddy-cities.json`

- [ ] **Step 1: Author seed.** ~20 cities across DiscoverEU countries that a consortium partner has committed to seed. Schema per spec §4.1:

```json
{
  "version": 1,
  "lastVerified": "2026-04-13",
  "cities": [
    {
      "cityId": "lisbon",
      "countryId": "PT",
      "label": "Lisbon",
      "active": false,
      "issueLabel": "buddy/lisbon",
      "issueNumber": null,
      "minPosts": 3,
      "seededBy": "consortium-partner-PT"
    }
    /* …~20 entries */
  ]
}
```

`active: false` until a maintainer opens the first real issue room and updates `issueNumber`. Keep `active: false` in the PR; flipping to `true` is a separate curation step (documented in §7 of PROGRESS).

- [ ] **Step 2: Browser smoke**

```js
const d = await (await fetch('data/buddy-cities.json')).json();
console.assert(Array.isArray(d.cities) && d.cities.length >= 15, 'seed too small');
console.assert(d.cities.every(c => c.cityId && c.countryId && c.issueLabel), 'missing fields');
console.assert(d.cities.every(c => typeof c.active === 'boolean'), 'active flag required');
console.log('OK', d.cities.length);
```

- [ ] **Step 3: Commit**

```bash
git add data/buddy-cities.json
git commit -m "feat(v1.6): buddy-cities.json — seed ~20 cities for Buddy Matching"
```

---

## Task 4: GitHub issue templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/buddy-local.md`
- Create: `.github/ISSUE_TEMPLATE/buddy-mentor.md`
- Create: `.github/ISSUE_TEMPLATE/buddy-traveler.md`
- Create: `.github/ISSUE_TEMPLATE/buddy-report.md`

- [ ] **Step 1: `buddy-local.md`** — "I live in {city} and can grab a coffee". YAML front-matter:

```yaml
---
name: Buddy — Local host (coffee meetup)
about: Offer a one-hour coffee + advice in your city (social only, no paid hosting)
title: "[buddy/local] in <CITY>"
labels: ["buddy-matching","buddy/local"]
---
```

Body sections (each as a `## Heading` with a prefilled placeholder):
- GitHub handle (auto by GitHub)
- City + neighbourhood (no exact address)
- Languages I speak
- Best days / rough hours
- Quick pitch (max 2 lines, no surnames, no phone, no email, no payment talk)
- Safety acknowledgement — `- [ ] I will only suggest public places` (required)
- `- [ ] I am 18+`

- [ ] **Step 2: `buddy-mentor.md`** — "I did DiscoverEU to {region}, ask me anything". Same YAML pattern, labels `["buddy-matching","buddy/mentor"]`. Body: handle, region visited, when, what you can help with, async-only notice, 18+ check.

- [ ] **Step 3: `buddy-traveler.md`** — "I'll be in {city} on {date ±3d}". Labels `["buddy-matching","buddy/traveler"]`. Body: handle, city, date range, what you're up for (coffee, museum, walk), languages, safety acknowledgement, 18+ check.

- [ ] **Step 4: `buddy-report.md`** — "Report a user". Labels `["buddy-matching","buddy/report"]`. Body: reported handle (prefilled via URL param), offending issue link, reason dropdown (spam / harassment / minor / payment / other), free-text details. Header banner: "If there is immediate danger, call 112 first — see Crisis Shield."

- [ ] **Step 5: Browser smoke** (file existence — no runtime)

```bash
ls .github/ISSUE_TEMPLATE/buddy-*.md | wc -l   # expect 4
grep -l "buddy-matching" .github/ISSUE_TEMPLATE/buddy-*.md | wc -l   # expect 4
```

- [ ] **Step 6: Commit**

```bash
git add .github/ISSUE_TEMPLATE/buddy-local.md .github/ISSUE_TEMPLATE/buddy-mentor.md .github/ISSUE_TEMPLATE/buddy-traveler.md .github/ISSUE_TEMPLATE/buddy-report.md
git commit -m "feat(v1.6): GitHub issue templates for Buddy Matching (local/mentor/traveler/report)"
```

---

## Task 5: Feature module — `js/features/buddy.js`

**Files:**
- Create: `js/features/buddy.js`

- [ ] **Step 1: Exports.**

```js
export async function loadBuddyCities();                         // memoised fetch + parse
export async function getCitiesWithBuddies({ activeOnly = true } = {});
export function buildPostUrl({ kind, cityId, preferences });     // returns new-issue URL
export function buildReportUrl({ handle, issueUrl });            // returns report template URL
export async function fetchRecentPosts(cityId, { limit = 10, kind = null } = {});
export function filterBySeen(posts, seenIds);
export function markSeen(id);                                    // updates state.buddy.seenIds
```

- [ ] **Step 2: URL builders.** No innerHTML, pure string builders. Repo constants:

```js
const GH_OWNER = 'embeddedJedi';
const GH_REPO  = 'discovereu-companion';
const NEW_ISSUE = `https://github.com/${GH_OWNER}/${GH_REPO}/issues/new`;
```

`buildPostUrl({ kind: 'local', cityId: 'lisbon', preferences })` → `${NEW_ISSUE}?template=buddy-local.md&title=${enc('[buddy/local] in Lisbon')}&labels=${enc('buddy-matching,buddy/lisbon,buddy/local')}&body=${enc(body)}` where `body` is composed from the user's chosen `languages`, `topics`, and a safety footer pointing at Crisis Shield. `kind ∈ {'local','mentor','traveler'}` — whitelist; anything else throws.

- [ ] **Step 3: `fetchRecentPosts(cityId)`.** Anonymous REST call:

```
GET https://api.github.com/repos/embeddedJedi/discovereu-companion/issues
    ?labels=buddy/<cityId>&state=open&per_page=<limit>
```

Cache responses in IndexedDB store `buddyCache` keyed by `cityId`, TTL 10 minutes, stale-while-revalidate: return cached immediately if fresh, else fetch and update. On 403 (rate limit) or network error, return the stale entry if any, with `{ stale: true, rateLimited: <bool> }` metadata so UI can show `buddy.feed.rateLimited` / `buddy.feed.cached`.

Normalise each issue to:
```js
{ id, number, title, url, author: issue.user?.login || null, createdAt, kindLabel }
```
Never store bodies in cache (minimise exposure; UI links out to GitHub for the body).

- [ ] **Step 4: `filterBySeen` + `markSeen`** read/write `state.buddy.seenIds`, capped at 200 ids (FIFO trim).

- [ ] **Step 5: Browser smoke**

```js
const m = await import('./js/features/buddy.js');
const cs = await m.getCitiesWithBuddies({ activeOnly: false });
console.assert(Array.isArray(cs) && cs.length >= 15, 'cities missing');
const url = m.buildPostUrl({ kind:'local', cityId:'lisbon', preferences:{ languages:['en','pt'], topics:['food'] } });
console.assert(url.startsWith('https://github.com/embeddedJedi/discovereu-companion/issues/new'), 'bad url');
console.assert(url.includes('template=buddy-local.md'), 'template missing');
try { m.buildPostUrl({ kind:'BOGUS', cityId:'lisbon' }); console.assert(false,'should throw'); } catch {}
const feed = await m.fetchRecentPosts('lisbon', { limit: 3 }).catch(e => ({ error: String(e) }));
console.log('feed:', feed);
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/features/buddy.js
git commit -m "feat(v1.6): buddy feature module — URL builders + cached Issues REST feed"
```

---

## Task 6: Consent gate — `js/features/buddy-consent.js`

**Files:**
- Create: `js/features/buddy-consent.js`

- [ ] **Step 1: Exports.**

```js
export async function ensureConsent();     // resolves true if already/newly consented, false if declined
export function openConsentGate();         // imperative open (for "Forget me" re-prompt)
export function forgetMe();                // clears state.buddy handle/consent locally
```

- [ ] **Step 2: UI via `h()` only.** Full-screen modal, `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus-trapped, `Esc` = decline (not silent dismiss). Content:
  - Headline: `buddy.consent.headline`.
  - Bulleted list (all i18n keys, no hardcoded strings): what gets shared (GitHub handle, pseudonym allowed), what does NOT (email, phone, location, messages), meet-public rule, delete-anytime, Crisis Shield link.
  - Required checkbox + primary button (`buddy.consent.accept`) + secondary (`buddy.consent.decline`).
  - Crisis Shield link opens the Crisis Shield panel if v1.3 is wired; else a plain anchor to `#crisis-shield`.

- [ ] **Step 3: On accept.** `state.buddy.consented = true`, `consentedAt = new Date().toISOString()`. Resolve `true`.

- [ ] **Step 4: `forgetMe()`.** Resets `state.buddy` to defaults (keeps `seenIds` empty) and announces via `aria-live="polite"` toast. Does NOT delete posts on GitHub — surfaces a link explaining the user must delete via GitHub UI.

- [ ] **Step 5: Browser smoke**

```js
const m = await import('./js/features/buddy-consent.js');
const p = m.ensureConsent();
const dlg = document.querySelector('[role="dialog"][aria-modal="true"]');
console.assert(dlg, 'consent gate not mounted');
dlg.querySelector('input[type="checkbox"]').click();
dlg.querySelector('[data-action="consent-accept"]').click();
console.assert(await p === true, 'consent not resolved');
const s = (await import('./js/state.js')).get();
console.assert(s.buddy.consented && s.buddy.consentedAt, 'state not updated');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/features/buddy-consent.js
git commit -m "feat(v1.6): buddy-consent — accessible consent gate + forgetMe"
```

---

## Task 7: UI panel — `js/ui/buddy-panel.js`

**Files:**
- Create: `js/ui/buddy-panel.js`

- [ ] **Step 1: Exports.**

```js
export function openBuddyPanel({ cityId = null } = {});
export function closeBuddyPanel();
```

- [ ] **Step 2: Structure (all via `h()`).**

- Overlay `.bd-panel` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- Header: title (`buddy.title`), close button.
- Persistent `.bd-safety-banner` (AAA contrast, `role="note"`, three bullets + Crisis Shield link).
- City picker (`<select>` driven by route stops intersected with `buddy-cities.json`; fallback to all `active: true` cities). `aria-label` from `buddy.cityPicker.label`.
- Role tabs: Local / Mentor / Traveler / Report. `role="tablist"`, arrow-key navigation, `aria-selected`.
- Recent posts feed mount: `role="feed"`, each post `role="article"` with:
  - Role badge (icon + text — colour is never sole indicator).
  - Author handle (link to GitHub profile), created time (relative, localised).
  - Title (link opens issue on GitHub in a new tab).
  - Dismiss button → `markSeen(id)`.
  - Report button → opens `buildReportUrl({ handle, issueUrl })`.
- "Post your request" primary CTA → gated through `ensureConsent()` then opens `buildPostUrl(...)` in a new tab.
- Footer: "Forget me" link (`buddy.forgetMe`).

- [ ] **Step 3: Consent gate first.** First mount calls `ensureConsent()`; if declined, panel closes and returns focus to opener.

- [ ] **Step 4: Feed rendering.** Call `fetchRecentPosts(cityId, { limit: 10, kind })`. If `{ stale: true }`, show `buddy.feed.cached`. If `{ rateLimited: true }` with no cached data, show `buddy.feed.rateLimited` plus a direct "open on GitHub" anchor. Empty feed → `buddy.feed.empty`. No infinite scroll, no FOMO timers.

- [ ] **Step 5: Accessibility.** Focus trap, `Esc` closes, arrow keys on tablist, reduced-motion respected, screen reader announces safety banner before feed.

- [ ] **Step 6: Browser smoke**

```js
const { openBuddyPanel } = await import('./js/ui/buddy-panel.js');
openBuddyPanel({ cityId: 'lisbon' });
// Accept consent via checkbox + button in the gate, then:
const dlg = document.querySelector('.bd-panel[role="dialog"]');
console.assert(dlg, 'panel not mounted');
console.assert(dlg.querySelector('.bd-safety-banner'), 'safety banner missing');
console.assert(dlg.querySelector('[role="tablist"]'), 'tablist missing');
console.assert(dlg.querySelector('[role="feed"]'), 'feed missing');
console.log('OK');
```

- [ ] **Step 7: Commit**

```bash
git add js/ui/buddy-panel.js
git commit -m "feat(v1.6): buddy-panel — accessible role tabs, feed, safety banner, report buttons"
```

---

## Task 8: Integration — country-detail panel

**Files:**
- Modify: `js/ui/country-detail.js`

- [ ] **Step 1: Locate Crisis Shield compact card insertion** (v1.3). If a `.cs-slot` exists, insert the Buddy CTA immediately after it; else insert after the overview block.

- [ ] **Step 2: Insert "Find a buddy in {capital}" card.** Only render when `buddy-cities.json` lists the capital cityId. Use `h()` only:

```js
import { getCitiesWithBuddies } from '../features/buddy.js';
import { openBuddyPanel } from './buddy-panel.js';
// …after crisis shield:
getCitiesWithBuddies({ activeOnly: true }).then(cs => {
  const match = cs.find(c => c.countryId === countryId && c.cityId === capitalCityId);
  if (!match) return;
  const card = h('section', { class: 'bd-country-card', 'aria-labelledby': 'bd-cc-title' },
    h('h3', { id: 'bd-cc-title' }, t('buddy.title')),
    h('p', {}, t('buddy.subtitle')),
    h('button', { type:'button', 'data-action':'open-buddy',
                  onclick: () => openBuddyPanel({ cityId: match.cityId }) },
      t('buddy.post.cta'))
  );
  panel.append(card);
});
```

- [ ] **Step 3: Browser smoke**

```js
// Open country detail for a country whose capital is in buddy-cities.json (after flipping active:true on that row for the test), then:
const card = document.querySelector('.bd-country-card');
console.assert(card, 'buddy card missing');
card.querySelector('[data-action="open-buddy"]').click();
console.assert(document.querySelector('.bd-panel[role="dialog"]'), 'panel did not open');
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add js/ui/country-detail.js
git commit -m "feat(v1.6): integrate Buddy CTA card into country-detail panel"
```

---

## Task 9: Integration — route-builder stop cards

**Files:**
- Modify: `js/ui/route-builder.js`

- [ ] **Step 1: Locate stop-card render.** Add a non-intrusive badge when the stop's cityId appears in `buddy-cities.json` as `active: true`.

- [ ] **Step 2: Badge.**

```js
import { getCitiesWithBuddies } from '../features/buddy.js';
import { openBuddyPanel } from './buddy-panel.js';
// on stop card render:
getCitiesWithBuddies({ activeOnly: true }).then(cs => {
  if (!cs.some(c => c.cityId === stop.cityId)) return;
  const btn = h('button', {
    type: 'button',
    class: 'bd-stop-badge',
    'aria-label': t('buddy.title') + ' — ' + stop.label,
    onclick: (e) => { e.stopPropagation(); openBuddyPanel({ cityId: stop.cityId }); }
  }, t('buddy.post.cta'));
  stopCardEl.append(btn);
});
```

Icon + text label (colour never sole indicator). Non-blocking — card still works without buddy layer.

- [ ] **Step 3: Browser smoke**

```js
// Build a route that includes a buddy-active city, then:
const badges = document.querySelectorAll('.bd-stop-badge');
console.assert(badges.length >= 1, 'no stop badges');
badges[0].click();
console.assert(document.querySelector('.bd-panel[role="dialog"]'), 'panel did not open');
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add js/ui/route-builder.js
git commit -m "feat(v1.6): route-builder stop cards surface Buddy badge for active cities"
```

---

## Task 10: CSS — `css/buddy.css`

**Files:**
- Create: `css/buddy.css`
- Modify: `index.html` (add `<link rel="stylesheet" href="css/buddy.css">`)

- [ ] **Step 1: Classes** per spec §6: `.bd-panel`, `.bd-safety-banner`, `.bd-consent-gate`, `.bd-feed`, `.bd-post`, `.bd-role-badge` (three variants: local / mentor / traveler — each with icon + text, colour-plus-shape), `.bd-report-btn`, `.bd-country-card`, `.bd-stop-badge`, `.bd-city-picker`.

- [ ] **Step 2: Tokens from `design-system.css`** — never hardcode colours. Safety banner uses AAA contrast (reuse `--cs-critical` / `--cs-critical-fg` tokens from v1.3 if present; otherwise define `--bd-safety` / `--bd-safety-fg` with ≥ 7:1 contrast in both light and dark).

- [ ] **Step 3: Behaviour.**
- `@media (prefers-reduced-motion: reduce)` disables transitions.
- Focus ring on every interactive: `outline: 3px solid var(--focus); outline-offset: 2px;`.
- Mobile-first: full-screen `.bd-panel` at ≤ 768px, right side-panel (480px) above.
- Minimum 56×56 px tap targets on post actions and CTA buttons.
- `.bd-role-badge--local|--mentor|--traveler` — each has a distinct shape/icon as well as colour.

- [ ] **Step 4: Browser smoke**

```js
console.assert([...document.styleSheets].some(x => (x.href||'').endsWith('buddy.css')), 'buddy.css not linked');
const probe = document.createElement('div');
probe.className = 'bd-panel'; document.body.append(probe);
const cs = getComputedStyle(probe);
console.assert(cs.position !== 'static', 'bd-panel styling not applied');
probe.remove();
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add css/buddy.css index.html
git commit -m "feat(v1.6): buddy.css — panel, consent gate, feed, safety banner, role badges"
```

---

## Task 11: Service worker precache bump (v8 → v9)

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump cache version.**

```js
const CACHE_VERSION = 'discovereu-v9';
```

- [ ] **Step 2: Append to precache manifest** (same-origin only):

```
'data/buddy-cities.json',
'css/buddy.css',
'js/features/buddy.js',
'js/features/buddy-consent.js',
'js/ui/buddy-panel.js'
```

GitHub REST endpoints (`api.github.com`) MUST NOT be added to the precache — cross-origin, dynamic. `fetchRecentPosts` handles its own IndexedDB cache.

- [ ] **Step 3: Browser smoke (airplane-mode cold load).**

```js
const keys = await caches.keys();
console.assert(keys.includes('discovereu-v9'), 'v9 cache missing');
const c = await caches.open('discovereu-v9');
for (const p of ['data/buddy-cities.json','css/buddy.css','js/features/buddy.js','js/features/buddy-consent.js','js/ui/buddy-panel.js']) {
  console.assert(await c.match(p), 'not precached: ' + p);
}
console.log('OK');
```

Then DevTools → Network → Offline → hard reload → open Buddy panel for a buddy-active city: panel UI chrome must render (feed will show `buddy.feed.rateLimited`/`cached` messaging when offline — expected).

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "chore(v1.6): sw cache v9 — precache Buddy assets (api.github.com excluded)"
```

---

## Task 12: Final smoke + PROGRESS.md + decision log

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Full route-level smoke.**

1. Clear SW caches + localStorage + IndexedDB `buddyCache` store.
2. Hard reload; confirm state migration adds `state.buddy` cleanly.
3. Open country detail for a country whose capital appears in `buddy-cities.json` (flip one `active: true` for the smoke test, then revert). Confirm Buddy CTA card renders after the Crisis Shield slot.
4. Click "Post your request" → consent gate appears → accept → new GitHub tab opens with correct template + prefilled labels.
5. Build a route containing the buddy-active city → stop card shows the badge → click opens the panel filtered to that city.
6. Role tabs keyboard-navigable (arrow keys, Enter activates, Esc closes).
7. "Forget me" clears `state.buddy.handle` and re-opens the consent gate on next entry.
8. DevTools → Network → Offline: panel chrome still loads (SW v9); feed shows cached message.
9. Lighthouse accessibility pass on open panel — target ≥ 95.

- [ ] **Step 2: Update PROGRESS.md.**
- Move every Buddy Matching entry to `Done` under §5.
- Add decision entry under §6:

```
**Decision (2026-04-13):** Buddy Matching uses GitHub Issues as the zero-backend matching backplane.
**Context:** v1.6 needs peer-to-peer matching without any user data hitting our infrastructure.
**Alternatives considered:** Matrix relay (adds account + moderation burden), Discord/Telegram (closed platform, leaks user graph), email relay (needs paid inbox + manual triage), custom backend (violates no-backend constraint).
**Rationale:** Auditable, free, leverages GitHub's existing Trust & Safety + moderation tools, no PII ever reaches our code, CORS-enabled read API sufficient for feed with 10-min cache. Swappable: `buddy.js` isolates URL builders so a future Matrix pivot is localised.
**Consequences:** Feed is bounded by GitHub's 60 req/h anonymous rate limit — mitigated by IndexedDB cache + stale-while-revalidate + graceful degrade to "open on GitHub" link. Moderation happens via maintainer issue tools; `minPosts` gate prevents ghost-town UX in unseeded cities.
```

- Add followups to §7:
  - Buddy Matching translations de/fr/es/it.
  - Maintainer task: open the first buddy issue rooms per city, flip `active: true`, populate `issueNumber`.
  - Quarterly review of `buddy-cities.json` (active flags + partners).
  - Consider GitHub Actions weekly digest bot per city (deferred; spec §3 architecture diagram).

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(v1.6): mark Buddy Matching complete; log GitHub-Issues-backplane decision + followups"
```

---

## Self-review — spec ↔ task coverage

| Spec section | Requirement | Covered by |
|---|---|---|
| §1 three peer types + coffee/async/companion scope | Tasks 4, 5, 7 |
| §2 in-scope surfaces (board, consent, report, crisis deep-link, country + route integration) | Tasks 6, 7, 8, 9 |
| §2 out-of-scope (chat, ML, paid, calendar, verification, push) | Not implemented (by design) |
| §3 GitHub Issues backplane — URL builders, public Issues REST feed, CORS, 10-min cache | Task 5 |
| §3 read-only anonymous feed path | Task 5 Step 3 |
| §4.1 `buddy-cities.json` schema incl. `active`, `minPosts`, `issueLabel`, `seededBy` | Task 3 |
| §4.2 `state.buddy` slice (handle/consent/preferences/seenIds) + persistence | Task 1 |
| §4.3 four issue templates with label enforcement + safety checkboxes | Task 4 |
| §5 `buddy.js` URL builders + `fetchCityFeed` + `filterBySeen` (DOM-free) | Task 5 |
| §5 `buddy-panel.js` renders consent gate → prefs → feed → CTA → report | Tasks 6, 7 |
| §5 loader addition for `buddy-cities.json` | Task 5 (memoised loader) + Task 11 (SW precache) |
| §6 CSS classes `.bd-consent-gate`, `.bd-feed`, `.bd-post`, `.bd-role-badge`, `.bd-report-btn`, `.bd-safety-banner` | Task 10 |
| §7 `buddy.*` i18n namespace (~25 keys) | Task 2 |
| §8 integration in country panel (compact card under Crisis Shield) | Task 8 |
| §8 integration in route-builder stop cards | Task 9 |
| §9 privacy & safety flow — consent gate, safety banner, report button, forget-me, crisis link | Tasks 6, 7 |
| §10 WCAG AAA — focus trap, role=dialog/feed/article, reduced-motion, no FOMO, colour-not-sole-indicator | Tasks 6, 7, 10 |
| §11 risks — rate-limit mitigation (SWR cache), spam via GH native + minPosts, predator via public-meet + report + Crisis Shield | Tasks 5, 6, 7 |
| §11 backplane swappability isolated in `buddy.js` | Task 5 Step 2 |
| §12 grant narrative (KA220 + inclusion + digital privacy) | Decision log in Task 12 |
| §13 out-of-scope (native chat, ML matchmaking, paid hosting, scheduling, verification, push, reputation) | Not implemented (by design) |

All in-scope spec requirements map to at least one task.

### Deferred / flagged

- **i18n locales deferred:** `de`, `fr`, `es`, `it`. Logged as PROGRESS §7 followup in Task 12.
- **`active: true` flip + real `issueNumber`** population is a maintainer curation step, not a PR task — the PR ships the schema and seed with `active: false` to prevent ghost-town UX.

### GitHub rate-limit note

Anonymous GitHub REST API is capped at 60 req/h per IP. Mitigations already baked into the plan:
1. 10-minute IndexedDB cache in Task 5 with stale-while-revalidate.
2. On 403 rate-limit, UI shows `buddy.feed.rateLimited` + an "open on GitHub" anchor — read access never fully breaks.
3. Precache (Task 11) explicitly excludes `api.github.com` (cross-origin, dynamic).
4. Post submission is a plain browser navigation to `github.com/.../issues/new` — no API quota consumed by writers.

No authenticated token is shipped (would require user-provided PAT + settings UI — out of scope for v1.6; deferred as a possible v1.7 "power-user" toggle).
