# Green Hostel + Carbon Offset Layer (v1.7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the certified-green-hostel map overlay + an educational, non-pushy carbon offset CTA on the Impact panel and Wrapped Story, matching the v1.7 design spec. Reinforces the "green and inclusive" positioning required by EACEA review and maps to Erasmus+ KA220-YOU Green priority.

**Spec (authoritative):** [`docs/superpowers/specs/2026-04-13-green-hostel-offset-design.md`](../specs/2026-04-13-green-hostel-offset-design.md)

**Architecture summary:** One new curated JSON data file under `data/`. One new Leaflet layer module. One new UI module for the offset CTA (reusable between Impact dashboard and Wrapped Story export). One toggle wired into existing filter UI. New stylesheet. i18n additions (en + tr; de/fr/es/it deferred). SW cache bump v11 → v12 to precache the new assets. Integration into existing impact-card panel (panel only — NOT the exported canvas).

**Tech stack:** Vanilla ES modules, `h()` DOM helper (never innerHTML with interpolated content), Leaflet from CDN, no test runner — browser-console smoke assertions per task.

**i18n path:** `js/i18n/i18n.js` (not `js/i18n.js`). Source files live in `i18n/*.json`.

**Privacy:** No affiliate IDs, no `utm_*` params, no referrer leakage (`referrerpolicy="no-referrer"`), no click tracking, no third-party scripts. Provider link-outs are public marketing pages with no API keys required.

---

## Task 1: Curated green-hostel dataset — `data/green-hostels.json`

**Files:**
- Create: `data/green-hostels.json`
- Modify: `SOURCES.md`

- [ ] **Step 1: Author 15–20 entries** across 8–10 major DiscoverEU cities (Berlin, Paris, Amsterdam, Lisbon, Prague, Vienna, Copenhagen, Stockholm, Barcelona, Istanbul). Only EU Ecolabel, Green Key, or LEED certified properties. Every entry MUST carry a `sourceUrl` that points to the issuing body's public registry; unsourced rows are rejected (spec §3).

```json
{
  "version": 1,
  "lastVerified": "2026-04-13",
  "hostels": [
    {
      "id": "berlin-eastseven",
      "cityId": "berlin",
      "countryId": "DE",
      "name": "EastSeven Berlin Hostel",
      "cert": "GREEN_KEY",
      "certLevel": "standard",
      "url": "https://eastseven.de",
      "lat": 52.5346,
      "lng": 13.4106,
      "priceTier": "mid",
      "sustainabilityScore": 4,
      "verifiedAt": "2026-04-13",
      "sourceUrl": "https://www.greenkey.global/awarded-sites"
    }
    /* …15–20 entries total, 8–10 cities covered */
  ]
}
```

**Cert enum:** `EU_ECOLABEL` · `GREEN_KEY` · `LEED` (v1.7 scope — Nordic Swan / Biosphere / National equivalents deferred).
**Price tier:** `low` | `mid` | `high`.
**Sustainability score:** integer 1–5.

- [ ] **Step 2: Append a "Green Hostels (v1.7)" section to `SOURCES.md`** with the three certification-body registry URLs + verification date, one line per cert:

```
### Green Hostels (v1.7) — verified 2026-04-13
- EU Ecolabel registry: https://environment.ec.europa.eu/topics/circular-economy/eu-ecolabel_en
- Green Key awarded sites: https://www.greenkey.global/awarded-sites
- USGBC LEED project directory: https://www.usgbc.org/projects
```

- [ ] **Step 3: Browser smoke**

```js
const g = await (await fetch('data/green-hostels.json')).json();
console.assert(Array.isArray(g.hostels) && g.hostels.length >= 15, 'need ≥15 hostels');
const certs = new Set(['EU_ECOLABEL','GREEN_KEY','LEED']);
console.assert(g.hostels.every(h => certs.has(h.cert)), 'cert enum violated');
console.assert(g.hostels.every(h => h.sourceUrl && /^https:\/\//.test(h.sourceUrl)), 'sourceUrl required');
console.assert(g.hostels.every(h => typeof h.lat==='number' && typeof h.lng==='number'), 'lat/lng numeric');
const cities = new Set(g.hostels.map(h => h.cityId));
console.assert(cities.size >= 8, 'need ≥8 cities, got ' + cities.size);
console.log('OK', g.hostels.length, 'cities:', cities.size);
```

- [ ] **Step 4: Commit**

```bash
git add data/green-hostels.json SOURCES.md
git commit -m "feat(v1.7): green-hostels.json — curated certified-green hostel dataset across 8+ DiscoverEU cities"
```

---

## Task 2: State slice — `state.filters.greenHostelsOnly`

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Locate the filters slice** (search for `filters` default shape in `state.js`).

- [ ] **Step 2: Add `greenHostelsOnly: false`** to the filters default object, and ensure the persistence/migration code preserves the new key when loading prior-version stored state (older state without the key must merge to `false`).

- [ ] **Step 3: Export / notify** — if state uses a pub/sub pattern, make sure subscribers receive updates when this key flips.

- [ ] **Step 4: Browser smoke**

```js
const { state, setFilter } = await import('./js/state.js');
console.assert(state.filters.greenHostelsOnly === false, 'default must be false');
setFilter('greenHostelsOnly', true);
console.assert(state.filters.greenHostelsOnly === true, 'setter broken');
setFilter('greenHostelsOnly', false);
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add js/state.js
git commit -m "feat(v1.7): state.filters.greenHostelsOnly — toggle for green hostel overlay"
```

---

## Task 3: i18n — `green.*` and `offset.*` keys (en + tr)

**Files:**
- Modify: `i18n/en.json` (source)
- Modify: `i18n/tr.json`
- Flag as followup: `de.json`, `fr.json`, `es.json`, `it.json` (deferred)

- [ ] **Step 1: Add `green.*` keys.**

```
green.filter.toggle           "Certified green hostels"
green.cert.ecolabel           "EU Ecolabel"
green.cert.greenKey           "Green Key"
green.cert.leed               "LEED"
green.score.label             "Sustainability score"
green.score.sr                "{n} of 5 sustainability leaves"
green.priceTier.low           "€"
green.priceTier.mid           "€€"
green.priceTier.high          "€€€"
green.popup.curatedHeader     "Curated selection"
green.popup.externalLink      "Visit hostel site"
green.externalLink.sr         "(opens in new tab)"
```

- [ ] **Step 2: Add `offset.*` keys.**

```
offset.title                  "Balance your trip"
offset.intro                  "Tree-planting schemes absorb carbon slowly and can be reversed by fire or harvest. Verified emission-reduction credits (Gold Standard, VCS) retire measured tonnes of CO₂ once and for all. Both help — neither replaces flying less or taking the train."
offset.trees.label            "Tree planting"
offset.verified.label         "Verified emission reductions"
offset.disclaimer             "Offsetting does not replace reducing emissions."
offset.providers.myclimate    "myclimate"
offset.providers.climatecare  "ClimateCare"
offset.externalLink.sr        "(opens in new tab)"
```

- [ ] **Step 3: Turkish translations** for all of the above in `i18n/tr.json`.

- [ ] **Step 4: PROGRESS.md followup** — log "v1.7 Green/Offset translations (de/fr/es/it)" as a deferred translation task.

- [ ] **Step 5: Browser smoke**

```js
const [en, tr] = await Promise.all(['en','tr'].map(l => fetch(`i18n/${l}.json`).then(r=>r.json())));
const mustHave = ['green.filter.toggle','green.cert.ecolabel','green.score.sr','offset.title','offset.intro','offset.disclaimer','offset.providers.myclimate'];
const missEn = mustHave.filter(k => !k.split('.').reduce((a,p)=>a?.[p], en));
const missTr = mustHave.filter(k => !k.split('.').reduce((a,p)=>a?.[p], tr));
console.assert(missEn.length === 0, 'en missing: ' + missEn);
console.assert(missTr.length === 0, 'tr missing: ' + missTr);
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add i18n/en.json i18n/tr.json PROGRESS.md
git commit -m "feat(v1.7): i18n keys for green hostels + offset CTA (en + tr); de/fr/es/it deferred"
```

---

## Task 4: Map layer — `js/map/green-hostels-layer.js`

**Files:**
- Create: `js/map/green-hostels-layer.js`

- [ ] **Step 1: Exports.**

```js
export function createGreenHostelsLayer(map, state);
// returns Leaflet LayerGroup with .refresh() and .destroy() attached
```

- [ ] **Step 2: Lazy data load.** On first call (or first toggle to `true`), `fetch('data/green-hostels.json')` once; memoise in module scope. Do NOT fetch at module import time.

- [ ] **Step 3: Marker.** Use `L.divIcon` with an inline green-tinted leaf SVG (28×28 CSS px). Never set `innerHTML` with interpolated hostel data — build popup content via the `h()` helper in a detached fragment and pass a DOM element to `bindPopup()`.

  Marker DOM attributes: `role="button"`, `aria-label` = `${name}, ${certLabel}` (resolved through `i18n()`). Focus ring 2px via CSS.

- [ ] **Step 4: Popup contents.**
  - Header badge: `green.popup.curatedHeader`
  - Hostel name
  - Cert badge: decorative SVG `aria-hidden="true"` + visible text (`<abbr title="European Union Ecolabel">EU Ecolabel</abbr>` where applicable)
  - Sustainability score: 5-leaf bar wrapped in `role="img"` with `aria-label` from `green.score.sr` (substitute `{n}`)
  - Price tier: `green.priceTier.{low|mid|high}`
  - External link anchor to `url` with `target="_blank"`, `rel="noopener noreferrer"`, `referrerpolicy="no-referrer"`, external-link icon `aria-hidden="true"` + visually-hidden SR suffix `green.externalLink.sr`

- [ ] **Step 5: Toggle-aware.** Subscribe to `state.filters.greenHostelsOnly`:
  - `false` → remove layer group from map
  - `true`  → add layer group + (per spec §4) dim the existing OpenTripMap hostel layer to 30% opacity rather than hiding it. Dimming is implemented by toggling a CSS class on the OpenTripMap layer's pane (`pane.classList.toggle('leaflet-pane--dim', on)`).

- [ ] **Step 6: Route filtering.** If `state.route?.cityIds?.length` exists, filter hostels to those cityIds; otherwise render all.

- [ ] **Step 7: Browser smoke**

```js
const L = window.L;
const map = L.map(document.body.appendChild(h('div',{style:'width:400px;height:300px'}))).setView([52.52,13.4],5);
const { createGreenHostelsLayer } = await import('./js/map/green-hostels-layer.js');
const { state, setFilter } = await import('./js/state.js');
const layer = createGreenHostelsLayer(map, state);
setFilter('greenHostelsOnly', true);
await new Promise(r => setTimeout(r, 400));
const markers = document.querySelectorAll('.leaflet-marker-icon[role="button"]');
console.assert(markers.length >= 3, 'expected ≥3 green markers, got ' + markers.length);
console.assert([...markers].every(m => m.getAttribute('aria-label')), 'aria-label missing');
setFilter('greenHostelsOnly', false);
await new Promise(r => setTimeout(r, 200));
console.assert(document.querySelectorAll('.leaflet-marker-icon[role="button"]').length === 0, 'layer not hidden on toggle off');
console.log('OK');
```

- [ ] **Step 8: Commit**

```bash
git add js/map/green-hostels-layer.js
git commit -m "feat(v1.7): green-hostels-layer — Leaflet overlay with accessible cert badges + popups"
```

---

## Task 5: Filters UI toggle — extend `js/ui/filters-ui.js`

**Files:**
- Modify: `js/ui/filters-ui.js`

- [ ] **Step 1: Locate the existing filter-toggle row construction** (other boolean filter toggles). Copy the pattern; do NOT invent a new component.

- [ ] **Step 2: Add a new toggle** right after the existing toggles with:
  - Label from `i18n('green.filter.toggle')`
  - `role="switch"`, `aria-checked` bound to `state.filters.greenHostelsOnly`
  - Keyboard: Space + Enter flip the state via `setFilter('greenHostelsOnly', ...)`
  - Visible focus ring (design-system `--focus` token)
  - Small leaf icon to the left, `aria-hidden="true"`

- [ ] **Step 3: Wire the green hostels layer.** On first mount of filters-ui, import and call `createGreenHostelsLayer(map, state)` once, so the layer is registered and ready to respond to state flips. Avoid duplicate initialisation.

- [ ] **Step 4: Browser smoke**

```js
// After app bootstrap:
const sw = document.querySelector('[data-filter="greenHostelsOnly"][role="switch"]');
console.assert(sw, 'toggle not rendered');
console.assert(sw.getAttribute('aria-checked') === 'false', 'default aria-checked');
sw.click();
console.assert(sw.getAttribute('aria-checked') === 'true', 'click did not flip');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add js/ui/filters-ui.js
git commit -m "feat(v1.7): filters-ui — green-hostels toggle wired to state + Leaflet layer"
```

---

## Task 6: Offset CTA module — `js/ui/offset-cta.js`

**Files:**
- Create: `js/ui/offset-cta.js`

- [ ] **Step 1: Exports.**

```js
export function renderOffsetCta(container, tripCo2Kg, { variant = 'panel' } = {});
// variant: 'panel' (Impact dashboard) | 'story' (Wrapped Story slide)
// returns the inserted HTMLElement
```

- [ ] **Step 2: Behaviour.**
  - If `tripCo2Kg <= 0` → return `null` and do not render.
  - Build DOM via `h()` only. Never interpolate into innerHTML.
  - Heading from `i18n('offset.title')`.
  - Intro paragraph from `i18n('offset.intro')` (the explainer already distinguishes tree-planting vs verified reductions in ≤60 words).
  - Two provider buttons, alphabetical order — ClimateCare, myclimate — each an `<a>` with:
    - `target="_blank"`
    - `rel="noopener noreferrer"`
    - `referrerpolicy="no-referrer"`
    - external-link icon `aria-hidden="true"`
    - visually-hidden SR suffix `offset.externalLink.sr`
    - NO `utm_*` params, NO affiliate IDs
  - Provider URLs (public marketing pages, no API keys, no tracking):
    - `https://www.myclimate.org/`
    - `https://climatecare.org/`
  - Always-visible footnote from `i18n('offset.disclaimer')`.

- [ ] **Step 3: Variants.**
  - `panel` → inserts a `<section class="offset-cta offset-cta--panel">` into `container`.
  - `story` → returns a standalone card sized for the Wrapped Story slide (no extra wrapper chrome). The story variant must NOT be written into the exported canvas image — the caller decides placement.

- [ ] **Step 4: Browser smoke**

```js
const { renderOffsetCta } = await import('./js/ui/offset-cta.js');
const host = document.body.appendChild(h('div'));
const el = renderOffsetCta(host, 120);
console.assert(el, 'should render for positive CO2');
const links = el.querySelectorAll('a[target="_blank"]');
console.assert(links.length === 2, 'expected 2 provider links, got ' + links.length);
console.assert([...links].every(a => /noopener/.test(a.rel) && a.referrerPolicy === 'no-referrer'), 'privacy attrs missing');
console.assert([...links].every(a => !/utm_|affid=|ref=/.test(a.href)), 'tracking params leaked');
const none = renderOffsetCta(host, 0);
console.assert(none === null, 'should skip render at 0 kg');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add js/ui/offset-cta.js
git commit -m "feat(v1.7): offset-cta — reusable educational offset CTA, zero tracking"
```

---

## Task 7: CSS — `css/green-hostel.css` + impact.css extension

**Files:**
- Create: `css/green-hostel.css`
- Modify: `css/impact.css` (or equivalent impact-panel stylesheet — locate via `Glob css/*impact*`)
- Modify: `index.html` (add `<link rel="stylesheet" href="css/green-hostel.css">`)

- [ ] **Step 1: `css/green-hostel.css`** defines:
  - `.green-marker` divIcon styles — 28×28, green-tinted leaf, outline stroke for ≥4.5:1 contrast against light and dark map tiles, 2px `var(--focus)` ring on `:focus-visible`.
  - `.green-popup` layout — badge row, cert abbr styling, 5-leaf score bar (`role="img"` container + individual leaves with filled/empty state), price-tier pill.
  - `.leaflet-pane--dim` → `opacity: 0.3` (applied to the OpenTripMap hostel pane when green-only is on).
  - `.filter-toggle--green` leaf icon slot.
  - `@media (prefers-reduced-motion: reduce)` disables any transition.

- [ ] **Step 2: Impact stylesheet extension** — append `.offset-cta` block:
  - Card surface using existing design-system tokens (`--surface`, `--border`, `--text`). Never hardcode colours.
  - `.offset-cta__providers` flex row, wraps on ≤375px.
  - `.offset-cta__disclaimer` muted text colour, always visible.
  - Focus rings on anchor buttons via `--focus`.
  - `.offset-cta--story` slide variant — larger heading, full-bleed padding.

- [ ] **Step 3: Browser smoke**

```js
console.assert([...document.styleSheets].some(x => (x.href||'').endsWith('green-hostel.css')), 'green-hostel.css not linked');
const probe = document.body.appendChild(h('div',{class:'offset-cta'}));
const bg = getComputedStyle(probe).backgroundColor;
console.assert(bg && bg !== 'rgba(0, 0, 0, 0)', 'offset-cta has no surface token applied');
probe.remove();
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add css/green-hostel.css css/impact.css index.html
git commit -m "feat(v1.7): green-hostel.css + offset-cta styles via design-system tokens"
```

---

## Task 8: Impact dashboard integration — mount offset CTA

**Files:**
- Modify: `js/features/impact-card.js`

- [ ] **Step 1: Locate the Impact Dashboard panel render** (search for the CO₂ chart mount / impact panel container in `impact-card.js`).

- [ ] **Step 2: Import and call `renderOffsetCta`** below the CO₂ chart in the panel rendering path:

```js
import { renderOffsetCta } from '../ui/offset-cta.js';
// …after the CO2 chart is appended to the panel container:
renderOffsetCta(panelContainer, tripCo2Kg, { variant: 'panel' });
```

- [ ] **Step 3: Do NOT insert the CTA into the exported canvas / html2canvas image.** Exported shareable cards must remain unchanged — the CTA is for the live panel only. If the export path is a separate render function, leave it alone.

- [ ] **Step 4: (Optional) Wrapped Story slide.** If the Wrapped Story feature is still in scope for this sub-project, add a dedicated final slide calling `renderOffsetCta(slide, tripCo2Kg, { variant: 'story' })`. Skip if Wrapped Story is out of reach this sprint — log as followup.

- [ ] **Step 5: Browser smoke**

```js
// Build a trip with non-zero CO2, open Impact panel, then:
const panel = document.querySelector('.impact-panel, [data-panel="impact"]');
console.assert(panel && panel.querySelector('.offset-cta'), 'offset-cta not mounted into panel');
// Verify export image does NOT contain it:
// (Trigger export path and inspect — manual check; confirm no .offset-cta in the rendered canvas DOM clone.)
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/features/impact-card.js
git commit -m "feat(v1.7): impact-card — mount offset CTA in Impact panel (export image untouched)"
```

---

## Task 9: Service worker precache bump (v11 → v12)

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump cache version.**

```js
const CACHE_VERSION = 'discovereu-v12';
```

- [ ] **Step 2: Append to precache manifest** (same-origin only):

```
'data/green-hostels.json',
'css/green-hostel.css',
'js/map/green-hostels-layer.js',
'js/ui/offset-cta.js'
```

- [ ] **Step 3: Browser smoke (offline cold load).**

```js
const keys = await caches.keys();
console.assert(keys.includes('discovereu-v12'), 'v12 cache missing');
const c = await caches.open('discovereu-v12');
for (const p of ['data/green-hostels.json','css/green-hostel.css','js/map/green-hostels-layer.js','js/ui/offset-cta.js']) {
  console.assert(await c.match(p), 'not precached: ' + p);
}
console.log('OK');
```

Then toggle DevTools → Network → Offline, hard-reload, flip the green toggle — markers must render and popups must open.

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "chore(v1.7): sw cache v12 — precache green hostels + offset CTA assets"
```

---

## Task 10: Final smoke + PROGRESS.md

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Full user-level smoke.**

1. Clear SW caches and storage.
2. Reload; open the map.
3. Flip `green.filter.toggle` → ≥3 markers render in each tested city (Berlin, Paris, Lisbon, Prague, Istanbul where covered).
4. Open a popup → cert badge, 5-leaf score (SR label reads "X of 5 sustainability leaves"), price tier, external link opens in new tab.
5. Build a route with non-zero CO₂ → open Impact panel → offset CTA renders with two provider buttons and always-visible disclaimer. Export image still looks identical to before.
6. Keyboard: Tab traverses toggle + markers + provider buttons; focus ring visible everywhere.
7. Toggle Network → Offline, hard reload, repeat steps 3–5.
8. DevTools Lighthouse accessibility run on the open Impact panel — expect ≥ 95.
9. DevTools Network panel: confirm no requests to non-whitelisted domains (no GA, no analytics, no affiliate hosts).

- [ ] **Step 2: Update PROGRESS.md.**
- Move every v1.7 Green/Offset entry to `Done`.
- Add decision entry under §6:

```
**Decision (2026-04-13):** v1.7 ships Green Hostels as a curated static JSON overlay + offset CTA as an educational, tracking-free link-out. No affiliate IDs, no utm params, no third-party scripts.
**Alternatives considered:** live booking API integration (requires key + backend — deferred post-grant), partner discount codes (documented upgrade path in spec §10, not built).
**Rationale:** Supports KA220-YOU Green priority; reviewable by EACEA without build tooling; honest about offset limitations via disclaimer.
**Consequences:** Quarterly re-verification task for hostel certs added to maintenance; translations (de/fr/es/it) tracked as followup.
```

- Add followups to §7:
  - v1.7 Green/Offset translations de/fr/es/it.
  - Quarterly `verifiedAt` refresh for `green-hostels.json`.
  - Monthly CI link-rot check for hostel `url` + `sourceUrl`.
  - Wrapped Story offset slide (if deferred in Task 8 Step 4).

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(v1.7): mark Green Hostel + Offset Layer complete; log decision + followups"
```

---

## Self-review — spec ↔ task coverage

| Spec section | Requirement | Covered by |
|---|---|---|
| §3 `data/green-hostels.json` schema + sourceUrl rule | Task 1 |
| §3 cert enum (EU_ECOLABEL / GREEN_KEY / LEED for v1.7) | Task 1 |
| §3 JSON schema file | Deferred — see note below |
| §4 `js/map/green-hostels-layer.js` exports + lazy load | Task 4 |
| §4 green-leaf divIcon, `role="button"`, aria-label | Task 4 Step 3 |
| §4 popup: cert badge + score bar + price tier + external link | Task 4 Step 4 |
| §4 toggle-aware + dim OpenTripMap layer to 30% | Task 4 Step 5 + Task 7 (`.leaflet-pane--dim`) |
| §4 route filtering by `state.route.cityIds` | Task 4 Step 6 |
| §4 `state.filters.greenHostelsOnly` | Task 2 |
| §4 filter-row toggle via i18n | Task 5 |
| §5 `renderOffsetCta(container, tripCo2Kg)` | Task 6 |
| §5 mount in Impact panel + Wrapped Story | Task 8 (panel mandatory; story flagged optional/followup) |
| §5 3 provider buttons alphabetical, no utm, no affiliate | Task 6 Step 2 (2 providers — myclimate + ClimateCare; Gold Standard deferred, see note) |
| §5 always-visible disclaimer | Task 6 Step 2 |
| §6 `green.*` + `offset.*` i18n keys (en + tr) | Task 3 |
| §6 de/fr/es/it deferred | Task 3 Step 4 |
| §7 accessibility — cert abbr, score role=img, focus ring, external-link SR text | Tasks 4, 6, 7 |
| §7 contrast ≥4.5:1 marker against tiles | Task 7 Step 1 |
| §8 privacy — no third-party scripts, `referrerpolicy="no-referrer"`, no persistent tracking | Tasks 4, 6 |
| §9 grant narrative mapping | PROGRESS.md decision entry (Task 10) |
| §10 upgrade path documented, not built | Not implemented (by design) |
| §11 risk mitigations (curated label, verifiedAt, disclaimer, link-rot followup) | Tasks 1, 4, 6, 10 |
| §13 acceptance criteria — ≥3 hostels per city, resolvable sourceUrl, CTA when CO2>0, a11y ≥95, no non-whitelisted requests, i18n only | Task 10 Step 1 |

### Deferred / deviations from spec

- **JSON schema file (spec §3)** — not authored in this plan; `data/green-hostels.json` validation is done inline in Task 1 Step 3 smoke. Can be added later without reshaping data.
- **Cert enum subset** — spec lists 6 cert types; this sub-project seeds 3 (EU Ecolabel, Green Key, LEED) to keep curation honest at launch. Enum in code accepts all 6; data only uses 3 for now.
- **Providers shown** — spec §5 lists 3 (myclimate, ClimateCare, Gold Standard). This plan ships 2 (myclimate + ClimateCare). Reason: Gold Standard Marketplace public URL routes through a checkout funnel that some reviewers may read as commercial; ship the two education-first providers now, add Gold Standard once we pick a stable, non-checkout entry page. Log as v1.7.x followup.
- **de/fr/es/it translations** — deferred to the translation sub-project.
- **Wrapped Story final slide** — Task 8 Step 4 marked optional; if not shipped this sprint, logged as followup.

### Note on provider URLs

Both outbound provider URLs (`https://www.myclimate.org/`, `https://climatecare.org/`) are public marketing pages. No API keys, no SDK, no script tags, no cookies set by us, no referrer sent (`referrerpolicy="no-referrer"`), no `utm_*` or affiliate parameters. This keeps v1.7 free of any commercial surface and consistent with EACEA reviewability.
