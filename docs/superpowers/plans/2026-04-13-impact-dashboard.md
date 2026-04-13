# Impact Dashboard (v1.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the per-user Strava-style impact card + the CC-BY-4.0 anonymised aggregate dataset + the standalone `/impact.html` public dashboard as described in the Impact Dashboard spec. No backend, no secrets, no auto-POST: aggregation flows through maintainer-reviewed PRs ("manual-PR-as-consent").

**Spec (authoritative):** [`docs/superpowers/specs/2026-04-13-impact-dashboard-design.md`](../specs/2026-04-13-impact-dashboard-design.md)

**Architecture summary:**
- New state slice `impact` in `js/state.js` (persisted via existing `PERSIST_KEYS`).
- Six new feature modules under `js/features/` (compute, card render, aggregate loader, opt-in, anonymiser, export).
- Two new UI modules: in-app 9th tab (`js/ui/impact-panel.js`) + standalone public page bootstrap (`js/pages/impact-page.js`).
- One new HTML route `pages/impact.html` with static-first markup (readable with JS off).
- Two new data files: `data/impact-public.json` (seed, CC-BY-4.0) + `data/impact-schema.json`.
- One Node freeze script `scripts/aggregate-impact.mjs` (dev-only, run by maintainer).
- CSS: `css/impact.css` + AAA tokens added to `css/design-system.css`.
- SW precache v6 -> v7 for new assets.
- i18n `impact.*` keys in en + tr; de/fr/es/it deferred.
- Every public-page metric gets a `data-grant-priority` attribute.

**Tech stack:** Vanilla ES modules, `h()` DOM helper (never innerHTML with interpolated content), CDN-only dependencies (Chart.js already loaded for radar), LocalStorage only for persisted slice, no test runner — browser-console smoke assertions per task.

**i18n path:** `js/i18n/i18n.js` (not `js/i18n.js`). Source files live in `i18n/*.json`.

**Privacy:** Opt-in default OFF. No auto-POST, no cookies, no analytics. PR-as-consent. k-anonymity k>=5 enforced at freeze time.

---

## Task 1: State slice — `impact` in `js/state.js`

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Extend `initialState`** with a new `impact` slice. Persisted fields only. Transient UI flags (panel-open, last-export-hash) live outside it.

```js
// inside initialState — after `futureMessages: [],`
impact: {
  schemaVersion: 1,
  tripId: null,                 // lazily generated on first compute
  generatedAt: null,            // ISO of last snapshot refresh
  optInPublicAggregate: false,  // default OFF per spec §7
  lastContribId: null,          // self-declared nonce for takedown requests
  a11yFiltersTouched: [],       // accumulated from filter panel interactions
  wheelmapLookups: 0,           // counter bumped by wheelmap feature
  guidesOpened: 0               // counter bumped by guide page
},
```

- [ ] **Step 2: Add `impact` to `PERSIST_KEYS`** so LocalStorage round-trips it:

```js
const PERSIST_KEYS = ['theme', 'language', 'user', 'route', 'filters', 'prep', 'bingo', 'dares', 'futureMessages', 'impact'];
```

- [ ] **Step 3: Extend `migrate()`** to backfill the slice for users whose LocalStorage predates v1.4:

```js
if (!persisted?.impact) {
  persisted.impact = {
    schemaVersion: 1, tripId: null, generatedAt: null,
    optInPublicAggregate: false, lastContribId: null,
    a11yFiltersTouched: [], wheelmapLookups: 0, guidesOpened: 0
  };
}
```

- [ ] **Step 4: Ephemeral counter hooks.** Document (as JSDoc near the slice) that `bingoCompleted`, `daresCompleted`, `languagesTouched`, `countryCount`, `totalKm`, `co2*`, `estSpendEUR`, `localShareEUR` are **derived** at compute-time from `state.route`, `state.bingo`, `state.dares`, `state.countries` — NEVER persisted to avoid drift.

- [ ] **Step 5: Browser smoke**

```js
const { state } = await import('./js/state.js');
console.assert(state.get('impact'), 'impact slice missing');
console.assert(state.get('impact').optInPublicAggregate === false, 'opt-in must default OFF');
state.set('impact', { ...state.get('impact'), wheelmapLookups: 3 });
location.reload(); // then re-run:
// const { state } = await import('./js/state.js');
// console.assert(state.get('impact').wheelmapLookups === 3, 'not persisted');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/state.js
git commit -m "feat(v1.4): state.impact slice — persisted opt-in + counters for Impact Dashboard"
```

---

## Task 2: Pure compute — `js/features/impact-compute.js`

**Files:**
- Create: `js/features/impact-compute.js`

- [ ] **Step 1: Exports.**

```js
export function computeImpactSnapshot(stateSnapshot);
// returns { personal: ImpactReport, meta: { generatedAt, schemaVersion, tripId } }
export function newTripId();
```

- [ ] **Step 2: Inputs.** Function is PURE: takes `{ route, user, bingo, dares, impact, countries }` (the caller passes `state.snapshot()`). Reads no DOM, no LocalStorage, no network.

- [ ] **Step 3: Derivations.**
- `route.countryCount` = `new Set(route.stops.map(s=>s.countryId)).size`
- `route.stopCount` = `route.stops.length`
- `route.totalKm` = sum of great-circle between consecutive stop coords (reuse `js/features/co2.js` helper if it exposes one; otherwise inline haversine — keep in this module for testability)
- `green.co2TrainKg` = `computeCO2(route).trainKg` (import from `./co2.js`)
- `green.co2FlightKg` = `computeCO2(route).flightKg`
- `green.co2SavedKg` = `flightKg - trainKg` (floor at 0)
- `economy.estSpendEUR` from budget level * total nights (use EU Youth Travel Survey coefficients — keep table inline, cite in comment)
- `economy.localShareEUR` = 0.65 * estSpendEUR (spec §10 cites this heuristic)
- `inclusion.accessibilityFiltersUsed` = `impact.a11yFiltersTouched`
- `inclusion.wheelmapLookups` = `impact.wheelmapLookups`
- `inclusion.lowBudgetMode` = `user.budget === 'budget'`
- `culture.languagesTouched` = unique `countries[*].officialLanguages[0]` for each visited country
- `culture.languageCount` = `languagesTouched.length`
- `engagement.bingoCompleted` = `Object.keys(bingo.completed).length`
- `engagement.daresCompleted` = `Object.values(dares.completed).filter(v => v === true).length`
- `engagement.guidesOpened` = `impact.guidesOpened`

- [ ] **Step 4: `newTripId()`** returns ISO-date + 3-char random suffix: e.g. `2026-04-13T09:12Z-abc`. Crypto-random via `crypto.getRandomValues`.

- [ ] **Step 5: Browser smoke**

```js
const { computeImpactSnapshot } = await import('./js/features/impact-compute.js');
const { state } = await import('./js/state.js');
const snap = computeImpactSnapshot(state.snapshot());
console.assert(snap.personal.route, 'no route block');
console.assert(typeof snap.personal.green.co2SavedKg === 'number', 'co2SavedKg not numeric');
console.assert(snap.meta.schemaVersion === 1, 'schema 1');
console.log('OK', snap.personal.route.countryCount, 'countries,', snap.personal.green.co2SavedKg, 'kg saved');
```

- [ ] **Step 6: Commit**

```bash
git add js/features/impact-compute.js
git commit -m "feat(v1.4): impact-compute — pure snapshot builder reusing co2.js"
```

---

## Task 3: Card canvas export — `js/features/impact-card.js`

**Files:**
- Create: `js/features/impact-card.js`

- [ ] **Step 1: Exports.**

```js
export async function renderImpactCard(snapshot, { lang = 'en', theme = 'light' } = {});
// returns HTMLCanvasElement
export async function downloadImpactCardPng(snapshot, opts);
// triggers blob download as impact-<tripId>.png
```

- [ ] **Step 2: Pattern.** Mirror `js/features/wrapped.js` canvas pipeline: offscreen `<canvas>` 1080x1350 (portrait, share-friendly), DPR-aware, draws background gradient from design tokens, hero number, four metric blocks, footer with app URL + CC-BY note.

- [ ] **Step 3: Grant-priority glyphs.** Render tiny emoji indicators per metric block:
- green metrics: `🌱`
- inclusion metrics: `♿`
- participation (countries/languages): `🌍`
- digital/engagement: `🗳️`

Glyphs map 1:1 to spec §10 table. Use a single `drawGrantIcon(ctx, kind, x, y)` helper.

- [ ] **Step 4: Alt-text.** Attach a readable plain-text summary via `canvas.dataset.alt` for screen-reader copy-button in the panel (Task 4).

- [ ] **Step 5: Browser smoke**

```js
const { renderImpactCard } = await import('./js/features/impact-card.js');
const { computeImpactSnapshot } = await import('./js/features/impact-compute.js');
const { state } = await import('./js/state.js');
const snap = computeImpactSnapshot(state.snapshot());
const c = await renderImpactCard(snap);
document.body.append(c);
console.assert(c.width >= 1080 && c.height >= 1350, 'card dimensions off');
console.assert(c.dataset.alt && c.dataset.alt.length > 40, 'alt-text missing');
console.log('OK', c.dataset.alt.slice(0, 80));
```

- [ ] **Step 6: Commit**

```bash
git add js/features/impact-card.js
git commit -m "feat(v1.4): impact-card — canvas PNG export with grant-priority glyphs + alt-text"
```

---

## Task 4: In-app panel — `js/ui/impact-panel.js`

**Files:**
- Create: `js/ui/impact-panel.js`

- [ ] **Step 1: Exports.**

```js
export function renderImpactPanel(rootEl);
// mounts the 9th "Impact" tab into the provided root
export function refreshImpactPanel();
```

- [ ] **Step 2: Structure (all via `h()`).**
- Header (`h1` with `impact.title`) + subtitle `impact.subtitle`.
- Empty state when `route.stops.length === 0`: illustration + CTA "Build a route first" (key `impact.empty`).
- Metric cards wrapped in a `<dl>` with `aria-describedby` per metric (spec §8). Each card carries a `data-grant-priority="green|inclusion|participation|digital"` attribute.
- Radar chart: Chart.js 2D radar with five axes (Green, Inclusion, Participation, Digital, Engagement); each axis normalised to 0-100. Include a `<table>` fallback rendered inside a visually-hidden `.sr-only` wrapper with the same numbers (spec §8 "charts have <table> data fallback").
- Actions row: `Download PNG card`, `Copy plain-text summary`, `Export snapshot JSON` (opens Task 9 flow), `Opt-in toggle` (wired to `state.impact.optInPublicAggregate`).

- [ ] **Step 3: Accessibility.**
- Focus order: title -> metric cards -> actions -> toggle.
- Counters honour `prefers-reduced-motion` (no count-up animation).
- Contrast >=7:1 (AAA) — verified against tokens added in Task 11.

- [ ] **Step 4: Wiring.** Subscribe to `state` changes on `route`, `bingo`, `dares`, `impact`; recompute via `computeImpactSnapshot` and re-render on any change.

- [ ] **Step 5: Browser smoke**

```js
const { renderImpactPanel } = await import('./js/ui/impact-panel.js');
const root = document.createElement('section');
document.body.append(root);
renderImpactPanel(root);
console.assert(root.querySelector('[data-grant-priority]'), 'grant-priority attrs missing');
console.assert(root.querySelector('dl'), 'metrics not in <dl>');
console.assert(root.querySelector('table'), 'chart <table> fallback missing');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/ui/impact-panel.js
git commit -m "feat(v1.4): impact-panel — 9th tab with radar + grant-priority metric cards + AAA a11y"
```

---

## Task 5: k-anonymity anonymiser — `js/features/impact-anonymize.js`

**Files:**
- Create: `js/features/impact-anonymize.js`

- [ ] **Step 1: Exports.**

```js
export function toContributionShape(snapshot);
// returns the spec §2.3 shape: same as personal minus tripId + rounded + no free-text
export function applyKAnonymity(records, k = 5);
// takes array of contribution records, returns array with rare combos generalised
```

- [ ] **Step 2: `toContributionShape` rules** (spec §2.3):
- Drop `tripId`, `generatedAt` beyond ISO date (keep `YYYY-MM`).
- Round `totalKm`, `estSpendEUR`, `localShareEUR`, `co2*Kg` to 2 significant figures (helper `round2sig`).
- Keep arrays (`accessibilityFiltersUsed`, `languagesTouched`) but sort alphabetically (determinism for hashing).
- Reject free-text fields entirely (schema-driven whitelist: if a field isn't in the allowed set, strip it).

- [ ] **Step 3: `applyKAnonymity` rules.**
- Form a quasi-identifier key from `(countryCount, languageCount, lowBudgetMode, accessibilityFiltersUsed.join('|'))`.
- Count occurrences. For any key with count < k:
  - Collapse `accessibilityFiltersUsed` to `["<generalised>"]`.
  - Cap `countryCount` to a bucket: `1-2`, `3-4`, `5-7`, `8+`.
  - Re-test; if still < k after one pass, drop the record.
- Document caller responsibility: anonymiser operates on *arrays* (batch), single-record callers must NOT publish without batching (enforced by freeze script in Task 8).

- [ ] **Step 4: Browser smoke**

```js
const m = await import('./js/features/impact-anonymize.js');
const sample = Array.from({length: 10}, (_,i)=>({
  route:{countryCount:3,stopCount:5,totalKm:1234},
  culture:{languageCount:2,languagesTouched:['de','cs']},
  inclusion:{accessibilityFiltersUsed:[],lowBudgetMode:true,wheelmapLookups:0},
  economy:{estSpendEUR:900,localShareEUR:600},
  green:{co2TrainKg:150,co2FlightKg:1200,co2SavedKg:1050},
  engagement:{bingoCompleted:i,daresCompleted:0,guidesOpened:1}
}));
sample.push({ ...sample[0], inclusion:{...sample[0].inclusion, accessibilityFiltersUsed:['step-free','quiet-space','wheelchair']}});
const out = m.applyKAnonymity(sample, 5);
console.assert(out.length <= sample.length, 'never grows');
console.assert(out.every(r => !('tripId' in r)), 'tripId must be absent');
console.log('OK', out.length, 'records after k-anon');
```

- [ ] **Step 5: Commit**

```bash
git add js/features/impact-anonymize.js
git commit -m "feat(v1.4): impact-anonymize — contribution-shape builder + k>=5 anonymiser"
```

---

## Task 6: Public aggregate loader — `js/features/impact-aggregate.js`

**Files:**
- Create: `js/features/impact-aggregate.js`

- [ ] **Step 1: Exports.**

```js
export async function loadAggregate();
// fetches data/impact-public.json with cache: 'no-cache' + SWR fallback
export function renderAggregateCharts(container, aggregate, { chartJs } = {});
// mounts Chart.js radar + bar charts; each metric <dl> gets data-grant-priority
```

- [ ] **Step 2: Behaviour.**
- `loadAggregate()` resolves `{ generatedAt, totalContributors, totals, distributions, kFloor }`.
- Renders inside `container` using `h()`, every numeric element tagged `data-grant-priority="<kind>"` (matches spec §10 table).
- Provides a `<table>` text fallback alongside each chart (AAA).
- Respects `prefers-reduced-motion`.

- [ ] **Step 3: Browser smoke**

```js
const m = await import('./js/features/impact-aggregate.js');
const agg = await m.loadAggregate();
console.assert(agg && typeof agg.totalContributors === 'number', 'aggregate shape');
const c = document.createElement('section'); document.body.append(c);
m.renderAggregateCharts(c, agg);
console.assert(c.querySelectorAll('[data-grant-priority]').length >= 4, 'grant-priority attrs missing');
console.assert(c.querySelector('table'), 'no fallback table');
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add js/features/impact-aggregate.js
git commit -m "feat(v1.4): impact-aggregate — public dashboard loader + grant-priority tagged charts"
```

---

## Task 7: Public page route — `pages/impact.html` + `js/pages/impact-page.js`

**Files:**
- Create: `pages/impact.html`
- Create: `js/pages/impact-page.js`

- [ ] **Step 1: `pages/impact.html`** is a standalone HTML document. Static-first: pre-rendered numbers inlined into the markup at freeze time by the aggregate script (Task 8). Progressive enhancement: JS replaces them with live charts if it loads.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>DiscoverEU Companion — Public Impact</title>
  <link rel="stylesheet" href="../css/design-system.css">
  <link rel="stylesheet" href="../css/impact.css">
  <link rel="canonical" href="/impact.html">
  <meta name="description" content="Anonymised, CC-BY-4.0 impact dataset from the DiscoverEU Companion community.">
</head>
<body>
  <main>
    <h1 data-i18n="impact.public.title">DiscoverEU Companion — Community Impact</h1>
    <p data-i18n="impact.public.cite">Dataset licensed CC-BY-4.0. Cite: DiscoverEU Companion (2026).</p>
    <section id="impact-root" aria-live="polite">
      <!-- Freeze script (Task 8) injects a static <dl> of numbers here between
           <!-- BEGIN:FROZEN --> and <!-- END:FROZEN --> markers. -->
      <!-- BEGIN:FROZEN -->
      <dl>
        <dt data-i18n="impact.metric.countries">Countries visited</dt>
        <dd data-grant-priority="participation">0</dd>
        <dt data-i18n="impact.metric.co2Saved">CO2 saved (kg)</dt>
        <dd data-grant-priority="green">0</dd>
      </dl>
      <!-- END:FROZEN -->
    </section>
    <noscript>
      <p>Interactive charts require JavaScript; the numbers above are the latest monthly freeze.</p>
    </noscript>
  </main>
  <script type="module" src="../js/pages/impact-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: `js/pages/impact-page.js`** bootstraps the enhanced view:

```js
import { loadAggregate, renderAggregateCharts } from '../features/impact-aggregate.js';
import { applyI18n } from '../i18n/i18n.js';

(async () => {
  await applyI18n(document);
  const root = document.getElementById('impact-root');
  const agg = await loadAggregate();
  // Replace frozen block with live charts
  root.replaceChildren();
  renderAggregateCharts(root, agg);
})();
```

- [ ] **Step 3: Browser smoke**

```bash
# From repo root, start a static server (any) and open pages/impact.html
# With JS disabled in DevTools, numbers from FROZEN block must remain visible.
```

```js
// With JS enabled:
const dls = document.querySelectorAll('[data-grant-priority]');
console.assert(dls.length >= 4, 'enhanced charts missing grant-priority attrs');
console.log('OK', dls.length);
```

- [ ] **Step 4: Commit**

```bash
git add pages/impact.html js/pages/impact-page.js
git commit -m "feat(v1.4): /impact.html public page with static-first FROZEN block + JS enhancement"
```

---

## Task 8: Freeze script — `scripts/aggregate-impact.mjs` + `scripts/README.md`

**Files:**
- Create: `scripts/aggregate-impact.mjs`
- Modify or create: `scripts/README.md`
- Create (empty dir keepfile): `contributions/impact/.gitkeep`

- [ ] **Step 1: Behaviour.** Node >=20, ESM, zero deps. Reads all `contributions/impact/*.json`, validates each against `data/impact-schema.json`, batches them, applies `applyKAnonymity(records, 5)` (import the browser module via relative path — pure JS, no DOM), computes totals + distributions, writes `data/impact-public.json`, and rewrites the `<!-- BEGIN:FROZEN --> ... <!-- END:FROZEN -->` block in `pages/impact.html` with inlined numbers.

```js
// scripts/aggregate-impact.mjs
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { applyKAnonymity } from '../js/features/impact-anonymize.js';

const DIR = 'contributions/impact';
const OUT = 'data/impact-public.json';
const PAGE = 'pages/impact.html';

const files = (await readdir(DIR)).filter(f => f.endsWith('.json'));
const records = await Promise.all(files.map(async f =>
  JSON.parse(await readFile(`${DIR}/${f}`, 'utf8'))
));

// Schema check
const schema = JSON.parse(await readFile('data/impact-schema.json', 'utf8'));
for (const r of records) {
  if (r.schemaVersion !== schema.contribution.schemaVersion) {
    throw new Error(`schema drift: ${r.schemaVersion}`);
  }
}

const anon = applyKAnonymity(records, 5);
const totals = anon.reduce((a, r) => ({
  contributors: a.contributors + 1,
  countries:    a.countries + r.route.countryCount,
  km:           a.km + r.route.totalKm,
  co2Saved:     a.co2Saved + r.green.co2SavedKg,
  localSpend:   a.localSpend + r.economy.localShareEUR,
  languages:    new Set([...a.languages, ...r.culture.languagesTouched])
}), { contributors: 0, countries: 0, km: 0, co2Saved: 0, localSpend: 0, languages: new Set() });

const out = {
  generatedAt: new Date().toISOString(),
  kFloor: 5,
  totalContributors: totals.contributors,
  totals: { ...totals, languages: [...totals.languages].sort() },
  distributions: { /* histogram buckets — omitted for brevity */ },
  license: 'CC-BY-4.0'
};
await writeFile(OUT, JSON.stringify(out, null, 2));

// Rewrite FROZEN block
let html = await readFile(PAGE, 'utf8');
const frozen = `<!-- BEGIN:FROZEN -->
<dl>
  <dt data-i18n="impact.metric.countries">Countries visited</dt>
  <dd data-grant-priority="participation">${out.totals.countries}</dd>
  <dt data-i18n="impact.metric.co2Saved">CO2 saved (kg)</dt>
  <dd data-grant-priority="green">${Math.round(out.totals.co2Saved)}</dd>
</dl>
<!-- END:FROZEN -->`;
html = html.replace(/<!-- BEGIN:FROZEN -->[\s\S]*?<!-- END:FROZEN -->/, frozen);
await writeFile(PAGE, html);

console.log('Froze', anon.length, 'records ->', OUT);
```

- [ ] **Step 2: `scripts/README.md`** documents the monthly workflow: (a) reviewer merges PRs adding files to `contributions/impact/*.json`; (b) reviewer runs `node scripts/aggregate-impact.mjs`; (c) reviewer commits the updated `data/impact-public.json` and `pages/impact.html`; (d) reviewer deletes raw files in `contributions/impact/` in the same commit (spec §6). Stress: k>=5 enforced; any record failing schema aborts the freeze.

- [ ] **Step 3: Smoke**

```bash
# Drop 6 synthetic records into contributions/impact/ then:
node scripts/aggregate-impact.mjs
# Check data/impact-public.json updated and pages/impact.html FROZEN block refreshed.
cat data/impact-public.json | head -20
```

- [ ] **Step 4: Commit**

```bash
git add scripts/aggregate-impact.mjs scripts/README.md contributions/impact/.gitkeep
git commit -m "feat(v1.4): aggregate-impact freeze script with k>=5 + FROZEN block rewrite"
```

---

## Task 9: User export + PR deep-link — `js/features/impact-export.js`

**Files:**
- Create: `js/features/impact-export.js`

- [ ] **Step 1: Exports.**

```js
export async function exportContributionJson(snapshot);
// returns { filename, blob, prUrl, copy } — never auto-POSTs
export function openContributeModal();
// two-step consent modal per spec §7
```

- [ ] **Step 2: Behaviour.**
- Builds contribution record via `toContributionShape` (Task 5).
- Stamps a fresh `contribId` (crypto-random 8 chars), writes it to `state.impact.lastContribId` for takedown reference.
- Returns a `Blob` of the JSON + filename `snapshot-<contribId>.json`.
- Constructs a pre-filled GitHub new-file URL:
  `https://github.com/embeddedJedi/discovereu-companion/new/main/contributions/impact?filename=<contribId>.json&value=<url-encoded-json>`
- Modal: two-step consent (step 1: field list + GDPR Art. 6(1)(a) reference; step 2: JSON verbatim + Review/Copy/Open PR/Cancel buttons). Default OFF; no auto-POST.

- [ ] **Step 3: Revoke.** Settings-panel wiring is out of scope here — just expose `deleteLocalImpactData()` that clears the `impact` slice (sets back to defaults) and dispatches a state change. Wire the UI in Task 4 (one-click button in the impact panel footer).

- [ ] **Step 4: Browser smoke**

```js
const m = await import('./js/features/impact-export.js');
const { computeImpactSnapshot } = await import('./js/features/impact-compute.js');
const { state } = await import('./js/state.js');
const snap = computeImpactSnapshot(state.snapshot());
const r = await m.exportContributionJson(snap);
console.assert(r.filename.startsWith('snapshot-'), 'filename scheme');
console.assert(r.prUrl.includes('github.com/embeddedJedi/discovereu-companion/new'), 'pr deep-link');
console.assert(!('tripId' in JSON.parse(await r.blob.text())), 'tripId leaked');
console.log('OK', r.filename);
```

- [ ] **Step 5: Commit**

```bash
git add js/features/impact-export.js
git commit -m "feat(v1.4): impact-export — contribution JSON + pre-filled PR deep-link (manual consent)"
```

---

## Task 10: i18n keys — `impact.*` (en + tr)

**Files:**
- Modify: `i18n/en.json`
- Modify: `i18n/tr.json`
- Flag as followup: `de.json`, `fr.json`, `es.json`, `it.json`

- [ ] **Step 1: Add keys (spec §4)** under a new `impact` object:

`title`, `subtitle`, `empty`, `metric.countries`, `metric.km`, `metric.co2Saved`, `metric.localSpend`, `metric.languages`, `metric.accessibility`, `metric.bingo`, `export.png`, `export.json`, `optin.title`, `optin.what`, `optin.notWhat`, `optin.consent`, `optin.revoke`, `public.title`, `public.cite`.

- [ ] **Step 2: Turkish translations** in `i18n/tr.json`.

- [ ] **Step 3: PROGRESS.md followup** — log "Impact Dashboard translations (de/fr/es/it)" as a deferred v1.4 translation task.

- [ ] **Step 4: Browser smoke**

```js
const [en, tr] = await Promise.all(['en','tr'].map(l => fetch(`i18n/${l}.json`).then(r=>r.json())));
const mustHave = ['impact.title','impact.subtitle','impact.metric.co2Saved','impact.optin.consent','impact.public.cite','impact.empty'];
const missEn = mustHave.filter(k => !k.split('.').reduce((a,p)=>a?.[p], en));
const missTr = mustHave.filter(k => !k.split('.').reduce((a,p)=>a?.[p], tr));
console.assert(missEn.length === 0, 'en missing: ' + missEn);
console.assert(missTr.length === 0, 'tr missing: ' + missTr);
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add i18n/en.json i18n/tr.json PROGRESS.md
git commit -m "feat(v1.4): i18n keys for Impact Dashboard (en + tr); de/fr/es/it deferred"
```

---

## Task 11: CSS — `css/impact.css` + AAA tokens

**Files:**
- Create: `css/impact.css`
- Modify: `css/design-system.css` (add `--impact-green`, `--impact-inclusion`, `--impact-participation`, `--impact-digital` tokens for light and dark)
- Modify: `index.html` (add `<link rel="stylesheet" href="css/impact.css">`)

- [ ] **Step 1: Design-system tokens.** Append under both `:root` and `[data-theme="dark"]` blocks, each hue verified >=7:1 contrast vs background:

```css
--impact-green:         #0F7B3F;
--impact-inclusion:     #1F5FA8;
--impact-participation: #7A4ECF;
--impact-digital:       #8A3B00;
```

- [ ] **Step 2: `css/impact.css`** defines:
- `.imp-panel`, `.imp-card`, `.imp-metric`, `.imp-radar`, `.imp-actions`, `.imp-optin`.
- `[data-grant-priority="green"] { border-inline-start: 4px solid var(--impact-green); }` (and the three others).
- `.imp-public` layout for `/impact.html` (wider container, no sidebar).
- `@media (prefers-reduced-motion: reduce)` disables count-up transitions.
- Focus rings: `outline: 3px solid var(--focus); outline-offset: 2px;` on every interactive.
- Responsive: 375px stacked, 768px two-col, 1440px three-col.

- [ ] **Step 3: Browser smoke**

```js
const s = getComputedStyle(document.documentElement);
for (const t of ['--impact-green','--impact-inclusion','--impact-participation','--impact-digital']) {
  console.assert(s.getPropertyValue(t).trim(), t + ' token missing');
}
console.assert([...document.styleSheets].some(x => (x.href||'').endsWith('impact.css')), 'impact.css not linked');
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add css/impact.css css/design-system.css index.html
git commit -m "feat(v1.4): impact.css + AAA grant-priority tokens in design-system"
```

---

## Task 12: Seed data — `data/impact-public.json` + `data/impact-schema.json`

**Files:**
- Create: `data/impact-public.json`
- Create: `data/impact-schema.json`

- [ ] **Step 1: `data/impact-public.json`** — zeroed baseline with CC-BY-4.0 header (JSON doesn't support comments; instead embed `"license": "CC-BY-4.0"` + `"licenseUrl"` fields and note the header in `scripts/README.md`).

```json
{
  "generatedAt": "2026-04-13T00:00:00Z",
  "license": "CC-BY-4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
  "kFloor": 5,
  "totalContributors": 0,
  "totals": {
    "countries": 0, "km": 0, "co2Saved": 0, "localSpend": 0,
    "languages": []
  },
  "distributions": {
    "countryCount": { "1-2": 0, "3-4": 0, "5-7": 0, "8+": 0 },
    "budgetMode":   { "budget": 0, "moderate": 0, "comfort": 0 }
  }
}
```

- [ ] **Step 2: `data/impact-schema.json`** — JSON Schema draft 2020-12 describing both the contribution shape (spec §2.3) and the aggregate shape. Includes `contribution.schemaVersion: 1` (used by freeze script).

- [ ] **Step 3: Browser smoke**

```js
const p = await (await fetch('data/impact-public.json')).json();
console.assert(p.license === 'CC-BY-4.0', 'license header');
console.assert(p.kFloor === 5, 'k-floor');
const s = await (await fetch('data/impact-schema.json')).json();
console.assert(s.contribution.schemaVersion === 1, 'schema version');
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add data/impact-public.json data/impact-schema.json
git commit -m "feat(v1.4): impact-public.json seed (CC-BY-4.0) + impact-schema.json"
```

---

## Task 13: Service worker cache v6 -> v7 + bottom-nav integration

**Files:**
- Modify: `sw.js`
- Modify: `index.html` (bottom-nav — add 9th "Impact" tab per spec §5)
- Modify: `js/ui/bottom-nav.js` (or equivalent nav module — locate via Glob)

- [ ] **Step 1: Bump cache version.**

```js
const CACHE_VERSION = 'discovereu-v7';
```

- [ ] **Step 2: Append to precache manifest** (same-origin only):

```
'pages/impact.html',
'data/impact-public.json',
'data/impact-schema.json',
'css/impact.css',
'js/features/impact-compute.js',
'js/features/impact-card.js',
'js/features/impact-aggregate.js',
'js/features/impact-anonymize.js',
'js/features/impact-export.js',
'js/ui/impact-panel.js',
'js/pages/impact-page.js'
```

- [ ] **Step 3: Stale-while-revalidate for aggregate.** In the SW `fetch` handler, treat `data/impact-public.json` as SWR: return cache immediately, revalidate in background (spec §9).

- [ ] **Step 4: Bottom-nav 9th tab.** Spec §5 explicitly mandates a 9th "Impact" tab with a rising-line chart icon. Add the tab to the nav module + wire to mount `renderImpactPanel` when selected. Gated empty-state shows `impact.empty` when `route.stops.length === 0`.

- [ ] **Step 5: Browser smoke**

```js
const keys = await caches.keys();
console.assert(keys.includes('discovereu-v7'), 'v7 cache missing');
const c = await caches.open('discovereu-v7');
for (const p of ['pages/impact.html','data/impact-public.json','css/impact.css','js/features/impact-compute.js','js/ui/impact-panel.js']) {
  console.assert(await c.match(p), 'not precached: ' + p);
}
// Nav:
console.assert(document.querySelector('[data-nav="impact"]'), '9th tab missing from bottom-nav');
console.log('OK');
```

Then toggle DevTools Network -> Offline, hard-reload, open the Impact tab: must render fully from cache; aggregate numbers come from last SWR cache.

- [ ] **Step 6: Commit**

```bash
git add sw.js index.html js/ui/bottom-nav.js
git commit -m "chore(v1.4): sw cache v7 + bottom-nav 9th Impact tab"
```

---

## Task 14: Final smoke + PROGRESS.md

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Full smoke.**

1. Clear SW caches + LocalStorage.
2. Reload. Build a route with >=3 countries.
3. Open Impact tab: metrics render, radar shows, `data-grant-priority` present on every public metric.
4. Click Download PNG -> file downloads; open in viewer and confirm grant-priority glyphs visible.
5. Toggle opt-in ON; click Export snapshot JSON -> file downloads; click Open PR -> GitHub new-file page opens pre-filled.
6. Click Revoke -> local impact slice resets.
7. Open `pages/impact.html` directly: FROZEN block numbers visible with JS off; charts render with JS on; every metric has `data-grant-priority`.
8. Run `node scripts/aggregate-impact.mjs` with 6 synthetic contribution files; confirm `data/impact-public.json` updates and `pages/impact.html` FROZEN block refreshes.
9. Network -> Offline, hard-reload: Impact tab + `/impact.html` still load from SW cache.
10. Lighthouse accessibility on Impact tab and `/impact.html` >=95.

- [ ] **Step 2: Update PROGRESS.md.**
- Move every Impact Dashboard entry to `Done`.
- Add decision entry under §6:

```
**Decision (2026-04-13):** Impact Dashboard ships with manual-PR-as-consent aggregation — no backend, no auto-POST, no Gist token. k-anonymity k>=5 enforced at freeze time. Public dashboard is static-HTML-first with JS enhancement. CC-BY-4.0 on `data/impact-public.json`.
**Alternatives considered:** auto-POST to GitHub Gist (rejected — secrets + spam surface), P2P/CRDT (rejected — out of scope), server-side aggregation (rejected — violates no-backend constraint).
**Rationale:** Preserves vanilla/no-backend/no-secrets constraint; PR history is its own consent audit trail for EACEA; static-first page is reviewable with JS off.
**Consequences:** Monthly freeze task added to maintenance; `data-grant-priority` attributes become a stable contract the grant-writer agent scrapes; translations (de/fr/es/it) deferred.
```

- Add followups to §7:
  - Impact Dashboard translations de/fr/es/it.
  - Monthly freeze-script run + `contributions/impact/*` PR queue.
  - Consider per-country heat-map of aggregate totals (v1.5 candidate).

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(v1.4): mark Impact Dashboard complete; log decision + followups"
```

---

## Self-review — spec ↔ task coverage

| Spec section | Requirement | Covered by |
|---|---|---|
| §2.1 per-user persisted slice (`deu:impact:v1` shape) | Task 1 (slice + PERSIST_KEYS + migrate) |
| §2.1 derived fields never persisted (avoid drift) | Task 1 Step 4, Task 2 |
| §2.2 ephemeral-only (no PII beyond ISO date) | Tasks 2, 5, 9 (round + whitelist) |
| §2.3 opt-in snapshot shape | Task 5 (`toContributionShape`) |
| §3 `impact.js` compute | Task 2 (named `impact-compute.js` per brief) |
| §3 `impact-card.js` PNG export extends wrapped.js pipeline | Task 3 |
| §3 `impact-aggregate.js` load + render | Task 6 |
| §3 `impact-optin.js` consent flow + serialiser | Task 9 (merged with export per brief) |
| §3 `impact-panel.js` in-app tab | Task 4 |
| §3 `pages/impact.html` standalone public route | Task 7 |
| §3 `js/pages/impact-page.js` bootstrap | Task 7 |
| §3 `data/impact-public.json` CC-BY-4.0 | Task 12 |
| §3 `data/impact-schema.json` | Task 12 |
| §3 i18n `impact.*` (en+5) | Task 10 (en+tr; de/fr/es/it deferred — see note below) |
| §3 `scripts/aggregate-impact.mjs` monthly freeze | Task 8 |
| §4 key family | Task 10 |
| §5 new 9th tab + `/impact.html` | Tasks 4, 7, 13 |
| §6 manual-PR-as-consent mechanism | Tasks 8, 9 |
| §6 monthly freeze + audit trail | Task 8 |
| §7 default OFF + two-step consent + revoke + no cookies/analytics | Tasks 1, 4, 9 |
| §8 AAA, `<dl>` + `aria-describedby`, `<table>` chart fallback, reduced-motion | Tasks 4, 6, 11 |
| §9 SW precache additions + SWR for aggregate | Task 13 |
| §10 `data-grant-priority` on every public metric | Tasks 3 (glyphs), 4, 6, 7, 11 (border tokens) |
| §11 k>=5 at freeze | Tasks 5, 8 |
| §11 schemaVersion reject on drift | Task 8 |
| §12 out-of-scope items | Not implemented (by design) |

All in-scope spec requirements map to at least one task. Out-of-scope items (§12) are explicitly not implemented.

**Deferred translations (explicit):** `impact.*` for `de.json`, `fr.json`, `es.json`, `it.json` is deferred to a separate v1.4 follow-up task, logged in PROGRESS.md §7 by Task 14. Only `en.json` and `tr.json` ship in this plan.
