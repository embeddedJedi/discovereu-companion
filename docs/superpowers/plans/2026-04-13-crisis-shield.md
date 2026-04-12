# Crisis Shield (v1.3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the fully offline, zero-PII emergency & safety layer described in the Crisis Shield spec — emergency numbers, TR mission coverage across all 33 DiscoverEU countries, foreign-embassy lookup, three guided flowcharts (lost-passport / lost-card / medical), share-location, and route integration in every country card.

**Spec (authoritative):** [`docs/superpowers/specs/2026-04-13-crisis-shield-design.md`](../specs/2026-04-13-crisis-shield-design.md)

**Architecture summary:** Four new JSON data files under `data/`. One extension+rename (`tr-consulates.json` → `tr-missions.json`, loader serves both). Three new feature modules under `js/features/` (shield entry, DAG runner, share-location). Two new UI modules under `js/ui/` (panel + dial list). One new stylesheet. i18n additions. SW precache bump to v6. Integration into `js/ui/country-detail.js`.

**Tech stack:** Vanilla ES modules, `h()` DOM helper (never innerHTML with interpolated content), CDN-only dependencies, LocalStorage only for ephemeral flowchart resume (not PII), no test runner — browser-console smoke assertions per task.

**i18n path:** `js/i18n/i18n.js` (not `js/i18n.js`). Source files live in `i18n/*.json`.

**Safety:** No PII stored. Geolocation only on explicit share-location tap; used once, never persisted, never networked. All data files static.

---

## Task 1: Extend TR missions data — `data/tr-missions.json`

**Files:**
- Create: `data/tr-missions.json`
- Keep: `data/tr-consulates.json` (back-compat; loader will read both)

- [ ] **Step 1: Inspect existing `data/tr-consulates.json`** to preserve schema for `centres[]` (visa centres inside Türkiye).

```bash
head -60 data/tr-consulates.json
```

- [ ] **Step 2: Create `data/tr-missions.json`** with TR representations *inside* all 33 DiscoverEU countries. Re-use `centres[]` from the old file verbatim, then add a `missions[]` keyed by `countryId`:

```json
{
  "version": 1,
  "lastVerified": "2026-04-12",
  "centres": [ /* copied from tr-consulates.json */ ],
  "missions": [
    {
      "countryId": "FR",
      "type": "embassy",
      "city": "Paris",
      "address": "184 Boulevard Malesherbes, 75017 Paris",
      "phone24h": "+33 1 53 92 71 12",
      "emergencyEmail": "konsolosluk.paris@mfa.gov.tr",
      "mapsUrl": "https://maps.app.goo.gl/…",
      "sources": ["paris.be.mfa.gov.tr"]
    }
    /* …33 entries total, one per DiscoverEU country */
  ]
}
```

Entries must cite at least one official source per mission (`paris.be.mfa.gov.tr` pattern). Use `type: "embassy" | "consulate-general" | "honorary"`.

- [ ] **Step 3: Browser smoke**

```js
const m = await (await fetch('data/tr-missions.json')).json();
console.assert(m.missions.length === 33, 'expected 33 missions, got ' + m.missions.length);
console.assert(m.missions.every(x => x.countryId && x.phone24h), 'missing fields');
console.assert(Array.isArray(m.centres), 'centres array missing');
console.log('OK', m.missions.map(x => x.countryId).sort().join(','));
```

- [ ] **Step 4: Commit**

```bash
git add data/tr-missions.json
git commit -m "feat(v1.3): tr-missions.json — TR embassies + consulates across all 33 DiscoverEU countries"
```

---

## Task 2: Emergency numbers data — `data/emergency-numbers.json`

> Another agent is producing the curated country list in parallel. This task assumes that file has landed in `data/emergency-numbers.json` before Task 2 executes; validate it here rather than redo the curation.

**Files:**
- Validate (not author): `data/emergency-numbers.json`
- Modify: `PROGRESS.md` (only if the parallel agent has not yet logged the data file)

- [ ] **Step 1: Confirm file exists and has 33 country records** matching spec §3.1.

```js
const e = await (await fetch('data/emergency-numbers.json')).json();
console.assert(Array.isArray(e.countries) && e.countries.length === 33, 'need 33 countries');
console.assert(e.countries.every(c => c.numbers && c.numbers.general), 'numbers.general required');
console.assert(e.countries.every(c => c.lastVerified), 'lastVerified required');
console.assert(e.countries.every(c => Array.isArray(c.sources) && c.sources.length >= 2), 'need ≥2 sources per spec §11');
console.log('OK', e.countries.length);
```

- [ ] **Step 2: Validate verified flag policy** — any entry with `"verified": false` MUST be present so the UI can hide it (spec §11):

```js
console.log('unverified count:', e.countries.filter(c => c.verified === false).length);
```

- [ ] **Step 3: If validation fails**, raise a blocker comment on the parallel task — do NOT fabricate numbers (spec §11 "wrong number is worse than no number"). Otherwise move on.

- [ ] **Step 4: Commit (only if this task added anything)**

```bash
git add data/emergency-numbers.json
git commit -m "chore(v1.3): validate emergency-numbers.json schema for Crisis Shield"
```

---

## Task 3: Embassy lookup pattern — `data/embassy-lookup-pattern.json`

**Files:**
- Create: `data/embassy-lookup-pattern.json`

- [ ] **Step 1: Author the file.** Per destination country, build a URL-template that lets any-nationality user find *their own* embassy in the destination. Zero data collected — app only builds a link.

```json
{
  "version": 1,
  "templates": {
    "googleSearch": "https://www.google.com/search?q={home}+embassy+in+{destCountry}+{destCity}",
    "ddgSearch":    "https://duckduckgo.com/?q={home}+embassy+in+{destCountry}"
  },
  "mfaPatterns": [
    "mfa.{homeIso2}.gov",
    "embassy-of-{home}-in-{destCountry}.org"
  ],
  "perCountryHint": {
    "FR": { "guidanceKey": "crisis.ownEmbassyHint.FR" }
    /* …33 entries (all may map to the default key) */
  }
}
```

Placeholders (`{home}`, `{homeIso2}`, `{destCountry}`, `{destCity}`) are substituted at runtime in `crisis-shield.js`.

- [ ] **Step 2: Browser smoke**

```js
const p = await (await fetch('data/embassy-lookup-pattern.json')).json();
console.assert(p.templates.googleSearch.includes('{home}'), 'template needs {home}');
console.assert(Object.keys(p.perCountryHint).length === 33, 'need 33 countries');
console.log('OK');
```

- [ ] **Step 3: Commit**

```bash
git add data/embassy-lookup-pattern.json
git commit -m "feat(v1.3): embassy-lookup-pattern.json — any-nationality own-embassy finder"
```

---

## Task 4: Crisis flowcharts DAG — `data/crisis-flowcharts.json`

**Files:**
- Create: `data/crisis-flowcharts.json`

- [ ] **Step 1: Author three DAGs** — `lost-passport`, `lost-card`, `medical`. Every node text is an i18n key; NO embedded copy (spec §3.4).

```json
{
  "version": 1,
  "flows": {
    "lost-passport": {
      "start": "lp-1",
      "nodes": {
        "lp-1": { "type": "step",     "textKey": "flow.lp.call112",   "next": "lp-2" },
        "lp-2": { "type": "decision", "textKey": "flow.lp.haveCopy",
                  "options": [
                    { "labelKey": "flow.lp.yes", "next": "lp-3" },
                    { "labelKey": "flow.lp.no",  "next": "lp-4" }
                  ]},
        "lp-3": { "type": "terminal", "textKey": "flow.lp.goMission",
                  "action": { "kind": "openMission" },
                  "sourceUrl": "https://www.mfa.gov.tr/…" },
        "lp-4": { "type": "terminal", "textKey": "flow.lp.reportPolice",
                  "action": { "kind": "dial", "number": "police" },
                  "sourceUrl": "https://ec.europa.eu/…" }
      }
    },
    "lost-card":  { "start": "c-1",  "nodes": { /* … */ } },
    "medical":    { "start": "m-1",  "nodes": { /* … */ } }
  }
}
```

Every terminal node MUST carry a `sourceUrl` (spec §11 "never contradict official advice").

- [ ] **Step 2: Validate structure**

```js
const f = await (await fetch('data/crisis-flowcharts.json')).json();
for (const [id, flow] of Object.entries(f.flows)) {
  console.assert(flow.nodes[flow.start], `${id}: start node missing`);
  for (const n of Object.values(flow.nodes)) {
    if (n.type === 'terminal') console.assert(n.sourceUrl, `${id}: terminal missing sourceUrl`);
    if (n.type === 'decision') console.assert(n.options?.every(o => flow.nodes[o.next]), `${id}: dangling option`);
    if (n.type === 'step')     console.assert(flow.nodes[n.next], `${id}: dangling next`);
  }
}
console.log('OK', Object.keys(f.flows));
```

- [ ] **Step 3: Commit**

```bash
git add data/crisis-flowcharts.json
git commit -m "feat(v1.3): crisis-flowcharts.json — lost-passport / lost-card / medical DAGs"
```

---

## Task 5: Feature module — `js/features/crisis-shield.js`

**Files:**
- Create: `js/features/crisis-shield.js`

- [ ] **Step 1: Exports.**

```js
export async function loadCrisisData();            // lazy loads all four JSON files, caches in module
export async function getShieldForCountry(countryId); // returns { emergency, mission, embassyLookup, flowcharts }
export function buildOwnEmbassyUrl(patterns, home, destCountry, destCity);
export async function renderCompactCard(countryId); // returns HTMLElement for country-detail
export async function openFullShield(countryId);    // imports + opens panel
```

- [ ] **Step 2: Loader.** `Promise.all` on the four files (`emergency-numbers`, `tr-missions`, `embassy-lookup-pattern`, `crisis-flowcharts`). Memoise in a module-scoped `let cache = null`.

- [ ] **Step 3: Resolution.** `getShieldForCountry('FR')` returns:
```
{
  emergency: countries.find(c => c.countryId === 'FR'),
  mission:   missions.find(m => m.countryId === 'FR'),
  embassyLookup: { templates, hintKey: perCountryHint.FR?.guidanceKey || 'crisis.ownEmbassyHint' },
  flowcharts: flows
}
```

- [ ] **Step 4: `renderCompactCard`** uses `h()` only. Shows 3 biggest numbers (general, police, ambulance) + "Open full shield" button. No innerHTML with data.

- [ ] **Step 5: Browser smoke**

```js
const m = await import('./js/features/crisis-shield.js');
const s = await m.getShieldForCountry('FR');
console.assert(s.emergency.numbers.general, 'no 112');
console.assert(s.mission && s.mission.phone24h, 'no mission');
console.log('OK', s.emergency.numbers.general, s.mission.city);
```

- [ ] **Step 6: Commit**

```bash
git add js/features/crisis-shield.js
git commit -m "feat(v1.3): crisis-shield feature module — data loader + resolver + compact card"
```

---

## Task 6: Flowchart runner — `js/features/flowchart-runner.js`

**Files:**
- Create: `js/features/flowchart-runner.js`

- [ ] **Step 1: Exports.**

```js
export function createRunner(flow, { onRender, onTerminal });
// returns { start(), advance(optionId?), back(), restart(), current() }
```

- [ ] **Step 2: Internals.** Back stack (array of node ids). `advance()` validates option exists in current decision. `back()` pops if length > 1. `restart()` resets to `flow.start`.

- [ ] **Step 3: `onRender(node)`** invoked after every transition with `{ node, canBack, canRestart }`. Runner itself is DOM-free (UI layer renders).

- [ ] **Step 4: Keyboard contract** documented in JSDoc: Tab traversal, Enter advances, Backspace / Alt+ArrowLeft triggers `back()`, Escape closes overlay (handled in panel).

- [ ] **Step 5: Browser smoke**

```js
const { createRunner } = await import('./js/features/flowchart-runner.js');
const flows = (await (await fetch('data/crisis-flowcharts.json')).json()).flows;
let last;
const r = createRunner(flows['lost-passport'], { onRender: s => { last = s; } });
r.start();
console.assert(last.node, 'start failed');
r.advance(0);           // first option
console.assert(r.current().id !== flows['lost-passport'].start, 'did not advance');
r.back();
console.assert(r.current().id === flows['lost-passport'].start, 'back broken');
r.restart();
console.log('OK', r.current().id);
```

- [ ] **Step 6: Commit**

```bash
git add js/features/flowchart-runner.js
git commit -m "feat(v1.3): flowchart-runner — DAG walker with back stack and restart"
```

---

## Task 7: Share-location — `js/features/share-location.js`

**Files:**
- Create: `js/features/share-location.js`

- [ ] **Step 1: Exports.**

```js
export async function shareLocation({ labelKey = 'crisis.shareLocation' } = {});
// returns { ok: true, via: 'webshare' | 'clipboard' | 'link' } or { ok: false, reason }
```

- [ ] **Step 2: Behaviour.** `navigator.geolocation.getCurrentPosition` with `{ enableHighAccuracy: true, timeout: 8000 }`. Build both:
- `geo:LAT,LNG` URI
- OSM fallback `https://www.openstreetmap.org/?mlat=LAT&mlon=LNG#map=17/LAT/LNG`

Try `navigator.share({ title, text, url: osmUrl })`. If unsupported, `navigator.clipboard.writeText(osmUrl)` and toast. If clipboard unavailable, return `{ ok: true, via: 'link', url: osmUrl }` so the UI can render a click-to-open anchor.

Coordinates are NEVER persisted (spec §10).

- [ ] **Step 3: Browser smoke**

```js
const m = await import('./js/features/share-location.js');
// Reject geolocation in DevTools sensors panel to exercise fallback:
const r = await m.shareLocation().catch(e => ({ ok:false, reason:String(e) }));
console.log('shareLocation result:', r);
```

- [ ] **Step 4: Commit**

```bash
git add js/features/share-location.js
git commit -m "feat(v1.3): share-location — Web Share API with OSM/clipboard fallbacks, zero persistence"
```

---

## Task 8: UI panel — `js/ui/crisis-shield-panel.js`

**Files:**
- Create: `js/ui/crisis-shield-panel.js`

- [ ] **Step 1: Exports.**

```js
export function openCrisisShieldPanel(countryId);
export function closeCrisisShieldPanel();
```

- [ ] **Step 2: Structure (all via `h()`).**

- Overlay root `.cs-panel` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`.
- Sections in order:
  1. Header with country name + close button (`Esc` also closes).
  2. EU 112 explainer + `dialQuirks` (`crisis.dialQuirk` preceded by `aria-live="polite"` so screen readers announce before the dial list — spec §9).
  3. `<emergency-dial-list>` mount (Task 9).
  4. TR mission block (`.cs-mission-block`) with 24h phone (tel:), email (mailto:), `mapsUrl` anchor.
  5. Own-embassy block (`crisis.ownEmbassy` + hint) that opens `buildOwnEmbassyUrl(...)` in new tab.
  6. Flowcharts: three tabs (`lost-passport`, `lost-card`, `medical`). Each tab mounts a flowchart UI driven by `flowchart-runner.js`; back / restart buttons; terminal node renders `sourceUrl` anchor.
  7. Share-location button (`.cs-share-btn`).
  8. Offline + no-PII notes at bottom.

- [ ] **Step 3: Accessibility.**
- Focus trap inside overlay; restore focus to opener on close.
- Keyboard: `Esc` close, `Alt+←` / `Backspace` → flowchart `back()`, Enter advances.
- Every `tel:` / `mailto:` has `aria-label` with the full readable number/address.
- `prefers-reduced-motion` disables node-transition animation.

- [ ] **Step 4: Desktop vs mobile.** Full-screen on `≤768px`, side-panel (right, 480px) on larger.

- [ ] **Step 5: Browser smoke**

```js
const { openCrisisShieldPanel } = await import('./js/ui/crisis-shield-panel.js');
openCrisisShieldPanel('FR');
const dlg = document.querySelector('.cs-panel[role="dialog"]');
console.assert(dlg, 'panel not mounted');
console.assert(dlg.getAttribute('aria-modal') === 'true', 'aria-modal missing');
console.assert(document.querySelectorAll('.cs-panel a[href^="tel:"]').length >= 1, 'tel links missing');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/ui/crisis-shield-panel.js
git commit -m "feat(v1.3): crisis-shield-panel — accessible overlay with flowcharts and mission block"
```

---

## Task 9: Emergency dial list — `js/ui/emergency-dial-list.js`

**Files:**
- Create: `js/ui/emergency-dial-list.js`

- [ ] **Step 1: Exports.**

```js
export function renderDialList(emergencyRecord, { largeType = false } = {});
// returns HTMLElement (an unordered list of large tap targets)
```

- [ ] **Step 2: Rules.**
- Each item is an `<a href="tel:…">` wrapped in `<li>`. Minimum 56×56 CSS px.
- Icon + text label + readable number. Colour is never the only indicator (spec §9).
- Skip keys whose number is `null`. Skip entries where `verified === false`.
- `aria-label` reads e.g. "Call police 17 in France".
- `largeType` adds class `.cs-card--largetype`.

- [ ] **Step 3: Browser smoke**

```js
const { renderDialList } = await import('./js/ui/emergency-dial-list.js');
const e = (await (await fetch('data/emergency-numbers.json')).json()).countries.find(c => c.countryId === 'FR');
const el = renderDialList(e);
document.body.append(el);
const links = el.querySelectorAll('a[href^="tel:"]');
console.assert(links.length >= 3, 'expected ≥3 tel links');
console.assert([...links].every(a => a.getAttribute('aria-label')), 'aria-label missing');
console.log('OK', links.length);
```

- [ ] **Step 4: Commit**

```bash
git add js/ui/emergency-dial-list.js
git commit -m "feat(v1.3): emergency-dial-list — AAA-contrast tel: grid with large tap targets"
```

---

## Task 10: CSS — `css/crisis-shield.css` + AAA tokens

**Files:**
- Create: `css/crisis-shield.css`
- Modify: `css/design-system.css` (add `--cs-critical`, `--cs-critical-fg` tokens for light and dark)
- Modify: `index.html` (add `<link rel="stylesheet" href="css/crisis-shield.css">`)

- [ ] **Step 1: Design-system tokens.** Append under both `:root` and `[data-theme="dark"]`:

```css
--cs-critical:    #B00020;   /* AAA against --cs-critical-fg */
--cs-critical-fg: #FFFFFF;
--cs-critical-hover: #8E001A;
```

Verify ≥ 7:1 contrast (spec §5).

- [ ] **Step 2: `css/crisis-shield.css`** defines:
- `.cs-panel`, `.cs-card`, `.cs-dial-grid` (CSS grid, min 56px tap targets), `.cs-flowchart`, `.cs-node`, `.cs-share-btn`, `.cs-mission-block`, `.cs-quirk-list`.
- `.cs-card--largetype { font-size: 22px; }` (inclusion).
- `@media (prefers-reduced-motion: reduce)` disables transitions.
- Focus ring visible on all interactives: `outline: 3px solid var(--focus); outline-offset: 2px;`.
- Mobile-first: 375px, 768px breakpoint switches panel from full-screen to right side-panel.

- [ ] **Step 3: Browser smoke**

```js
const s = getComputedStyle(document.documentElement);
console.assert(s.getPropertyValue('--cs-critical').trim(), '--cs-critical token missing');
console.assert([...document.styleSheets].some(x => (x.href||'').endsWith('crisis-shield.css')), 'crisis-shield.css not linked');
console.log('OK', s.getPropertyValue('--cs-critical').trim());
```

- [ ] **Step 4: Commit**

```bash
git add css/crisis-shield.css css/design-system.css index.html
git commit -m "feat(v1.3): crisis-shield.css + AAA critical tokens in design-system"
```

---

## Task 11: i18n — `crisis.*` and `flow.*` keys

**Files:**
- Modify: `i18n/en.json` (source)
- Modify: `i18n/tr.json`
- Flag as followup: `de.json`, `fr.json`, `es.json`, `it.json` (deferred)

- [ ] **Step 1: Add `crisis.*` keys** per spec §6: `title`, `call112`, `dialQuirk`, `police`, `ambulance`, `fire`, `tourist`, `women`, `lgbtq`, `child`, `mental`, `trMission`, `trMission24h`, `ownEmbassy`, `ownEmbassyHint`, `shareLocation`, `shareLocationBody`, `shareCopy`, `offlineNote`, `noPII`.

- [ ] **Step 2: Add `flow.lp.*`, `flow.card.*`, `flow.med.*` keys** referenced by `data/crisis-flowcharts.json` (step text, decision prompts, option labels, `back`, `restart`, `done`). Keys must match exactly what the JSON references.

- [ ] **Step 3: Turkish translations** in `i18n/tr.json`.

- [ ] **Step 4: PROGRESS.md followup** — log "Crisis Shield translations (de/fr/es/it)" as a deferred v1.3 translation task.

- [ ] **Step 5: Browser smoke**

```js
const [en, tr] = await Promise.all(['en','tr'].map(l => fetch(`i18n/${l}.json`).then(r=>r.json())));
const mustHave = ['crisis.title','crisis.call112','crisis.trMission24h','crisis.ownEmbassyHint','crisis.shareLocation','flow.lp.call112'];
const missing = mustHave.filter(k => !k.split('.').reduce((a,p)=>a?.[p], en));
console.assert(missing.length === 0, 'en missing: ' + missing);
const missingTr = mustHave.filter(k => !k.split('.').reduce((a,p)=>a?.[p], tr));
console.assert(missingTr.length === 0, 'tr missing: ' + missingTr);
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add i18n/en.json i18n/tr.json PROGRESS.md
git commit -m "feat(v1.3): i18n keys for Crisis Shield (en + tr); de/fr/es/it deferred"
```

---

## Task 12: Service worker precache bump (v5 → v6)

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump cache version.** In `sw.js`:

```js
const CACHE_VERSION = 'discovereu-v6';
```

- [ ] **Step 2: Append to precache manifest** (same-origin only — spec §7):

```
'data/emergency-numbers.json',
'data/tr-missions.json',
'data/embassy-lookup-pattern.json',
'data/crisis-flowcharts.json',
'css/crisis-shield.css',
'js/features/crisis-shield.js',
'js/features/flowchart-runner.js',
'js/features/share-location.js',
'js/ui/crisis-shield-panel.js',
'js/ui/emergency-dial-list.js'
```

(`data/emergency-phrases.json` should already be in the manifest — verify, don't duplicate.)

- [ ] **Step 3: Browser smoke (airplane-mode cold load).**

```js
// Reload once with SW enabled; then:
const keys = await caches.keys();
console.assert(keys.includes('discovereu-v6'), 'v6 cache missing');
const c = await caches.open('discovereu-v6');
for (const p of ['data/emergency-numbers.json','data/tr-missions.json','data/crisis-flowcharts.json','data/embassy-lookup-pattern.json','css/crisis-shield.css']) {
  console.assert(await c.match(p), 'not precached: ' + p);
}
console.log('OK');
```

Then toggle DevTools → Network → Offline, hard-reload, open Crisis Shield for FR — must render fully.

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "chore(v1.3): sw cache v6 — precache Crisis Shield data + assets for offline-first"
```

---

## Task 13: Integration into country detail panel

**Files:**
- Modify: `js/ui/country-detail.js` (integration point — confirmed via `Glob`; spec §8 says "right after weather block")

- [ ] **Step 1: Locate weather block** in `country-detail.js` (search for the weather render call).

- [ ] **Step 2: Insert Crisis Shield compact card** immediately after weather:

```js
import { renderCompactCard, openFullShield } from '../features/crisis-shield.js';
// …after weather append:
const shieldSlot = h('section', { class: 'cs-slot', 'aria-labelledby': 'cs-title' });
panel.append(shieldSlot);
renderCompactCard(countryId).then(card => {
  shieldSlot.append(card);
  card.querySelector('[data-action="open-shield"]')
      ?.addEventListener('click', () => openFullShield(countryId));
});
```

- [ ] **Step 3: Bottom nav.** Spec does not mandate a bottom-nav entry; leave nav untouched. (If a later decision adds it, log in PROGRESS.md §6.)

- [ ] **Step 4: Browser smoke**

```js
// Open a country detail panel for FR via the UI, then:
const slot = document.querySelector('.cs-slot');
console.assert(slot, 'cs-slot not injected');
console.assert(slot.querySelector('a[href^="tel:"]'), 'compact card missing dial link');
const btn = slot.querySelector('[data-action="open-shield"]');
btn.click();
console.assert(document.querySelector('.cs-panel[role="dialog"]'), 'full shield did not open');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add js/ui/country-detail.js
git commit -m "feat(v1.3): integrate Crisis Shield compact card into country detail panel"
```

---

## Task 14: Final smoke + PROGRESS.md

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Full route-level smoke.**

1. Clear SW caches and storage.
2. Reload; build a route with at least one country (e.g. FR).
3. Open country detail → confirm Crisis Shield compact card renders after weather.
4. Tap "Open full shield" → panel opens with dial list, TR mission, own-embassy lookup, three flowcharts, share-location button.
5. Keyboard: Tab traversal works; Esc closes; Alt+← steps flowchart back.
6. Toggle Network → Offline, hard reload, repeat steps 3–5.
7. DevTools Lighthouse accessibility run on the open panel — expect ≥ 95 and no critical issues.

- [ ] **Step 2: Update PROGRESS.md.**
- Move every Crisis Shield entry to `Done`.
- Add decision entry under §6:

```
**Decision (2026-04-13):** Crisis Shield ships as offline-first, zero-PII, data-driven layer using four static JSON files + one DAG runner. No backend, no framework.
**Alternatives considered:** live incident feeds (deferred v1.4+), in-app VoIP (out of scope, §12), auto-SOS (§12).
**Rationale:** Supports KA3 inclusion narrative; works on dead SIM / one-bar signal; reviewable by EACEA without build tooling.
**Consequences:** Quarterly data refresh task added to maintenance; translations (de/fr/es/it) tracked as followup.
```

- Add followups to §7:
  - Crisis Shield translations de/fr/es/it.
  - Quarterly `lastVerified` refresh of `emergency-numbers.json` and `tr-missions.json`.

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(v1.3): mark Crisis Shield complete; log decision + followups"
```

---

## Self-review — spec ↔ task coverage

| Spec section | Requirement | Covered by |
|---|---|---|
| §3.1 `emergency-numbers.json` | 33 countries, 112 + helplines, dialQuirks, sources, lastVerified | Task 2 |
| §3.2 rename `tr-consulates.json` → `tr-missions.json`, add `mission` block | Task 1 |
| §3.2 back-compat `centres[]` | Task 1 Step 2 |
| §3.3 `embassy-lookup-pattern.json` — URL template + MFA patterns | Task 3 |
| §3.4 `crisis-flowcharts.json` — 3 DAGs, i18n keys only | Task 4 |
| §3.5 reuse `emergency-phrases.json` (no schema change) | Task 12 (cache verify) |
| §4 `crisis-shield.js` — renderCrisisShieldCard / openFullShield / shareLocation entry | Tasks 5, 7 |
| §4 `flowchart-runner.js` — DAG + back stack + reset | Task 6 |
| §4 `share-location.js` — `geo:` + OSM + `navigator.share` + clipboard fallback | Task 7 |
| §4 `crisis-shield-panel.js` — full-screen mobile / side-panel desktop | Task 8 |
| §4 `emergency-dial-list.js` — large tap targets, tel: | Task 9 |
| §4 "no persistent state, ephemeral only" | Tasks 6, 7 (no storage writes) |
| §5 new CSS classes | Task 10 Step 2 |
| §5 `--cs-critical`, `--cs-critical-fg` AAA tokens | Task 10 Step 1 |
| §5 `.cs-card--largetype` 22px | Task 10 Step 2 |
| §6 `crisis.*` i18n keys | Task 11 Step 1 |
| §6 `flow.lp.*` / `flow.card.*` / `flow.med.*` | Task 11 Step 2 |
| §7 SW precache additions | Task 12 |
| §8 integration after weather in country panel | Task 13 |
| §9 AAA accessibility (tap targets, aria, keyboard, reduced-motion, colour-not-sole-indicator, quirk before dial) | Tasks 8, 9, 10 |
| §10 zero-PII, one-shot geolocation | Task 7 Step 2 |
| §11 ≥2 sources per number, `verified: false` hidden, sourceUrl on terminals, `navigator.share` fallback | Tasks 2, 4, 7, 9 |
| §12 out-of-scope items | Not implemented (by design) |

All in-scope spec requirements map to at least one task. Out-of-scope items (§12) are explicitly not implemented.
