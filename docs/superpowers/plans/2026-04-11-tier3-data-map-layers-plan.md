# Tier 3 Inclusion — Sub-project 1: Data & Map Layers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a dedicated `Kapsayıcılık` (Inclusion) tab with ILGA Rainbow Map + Wheelmap-derived accessibility + emergency phrases + Fewer-opportunities preset + first-visit Welcome Wizard, plus a scalable icon+label tab bar that grows from 6 to 7 tabs without clipping.

**Architecture:** Offline-first static JSON snapshots (`rainbow-map.json`, `accessibility.json`, `emergency-phrases.json`) read through a pluggable adapter module (`inclusion-data.js`) designed for future Phase 2 live-API augmentation. Polygons are recoloured by a new Leaflet layer (`inclusion-layer.js`) that subscribes to an ephemeral `state.inclusionMode` slice. A new `ui/inclusion.js` module owns the tab's summary + country views, and `ui/welcome-wizard.js` captures onboarding answers into `state.user` + `state.filters`. All three data layers share the existing `.modal-overlay` pattern so no new modal system is introduced.

**Tech Stack:** Vanilla HTML + ES modules + CSS (no build step), Leaflet 1.9 (CDN), Chart.js 4 (already loaded), LZ-string (already loaded), Lucide Icons (inlined SVG single-path, no dependency), LocalStorage persistence, existing service worker (`sw.js`) for offline cache.

---

## Reference documents

- **Spec**: `docs/superpowers/specs/2026-04-11-tier3-data-map-layers-design.md` (commit `11662c7`)
- **CLAUDE.md hard rules**: vanilla only, no build step, data in JSON, WCAG AA, 375-px responsive, dark + light themes, i18n-first, CORS-friendly, no framework sneak-ins
- **PROGRESS.md** single source of truth — update after Task 24

## Development environment

**Start the local server once, keep it running in the background:**

```bash
python -m http.server 8765
```

Every Playwright MCP smoke test navigates against `http://localhost:8765/`. If the browser profile lock error (`C:\Users\KingOfSpace\AppData\Local\ms-playwright\mcp-chrome-88d3e83`) blocks you, run the unlock procedure from commit `ea7b67e`'s session (PowerShell kill + lockfile rm). Do not work around the lock with `--isolated` — it creates orphaned profiles.

**Hard-refresh + clear service worker cache after any CSS/HTML/JS change** via browser DevTools OR:

```js
// Paste in browser_evaluate before re-navigating
async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();
  if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
  return 'cleared';
}
```

## Branch strategy

Work directly on `main`. The project is single-developer and CLAUDE.md explicitly allows direct commits to `main` during sprint. Each task produces one commit with a descriptive message; push after Task 24 (not per-task).

---

## Task 1: Create `data/rainbow-map.json`

**Files:**
- Create: `data/rainbow-map.json`

**Source material:** ILGA-Europe *Rainbow Europe 2025* annual report, `https://www.ilga-europe.org/report/rainbow-europe-2025/`. Delegated to `research-scout` agent to fetch + extract tables, `data-curator` agent to serialise. Research outputs land in `data-curator`'s working memory before this task writes the final file.

**Schema (this task enforces the schema exactly):**

- [ ] **Step 1: Write the file with the envelope and the first three countries (DE, FR, IT)**

Content to write (exact):

```json
{
  "version": 1,
  "generated": "2026-04-11",
  "source": "ILGA-Europe Rainbow Europe 2025 annual report",
  "sourceUrl": "https://www.ilga-europe.org/report/rainbow-europe-2025/",
  "note": "Aggregate and category scores plus flat key-item flags. Refresh manually each May when ILGA publishes the new report.",
  "rubricCategories": [
    { "id": "equality",          "weight": 25, "label": "Equality & non-discrimination" },
    { "id": "family",            "weight": 29, "label": "Family" },
    { "id": "hateCrime",         "weight": 19, "label": "Hate crime & hate speech" },
    { "id": "legalGenderRecog",  "weight": 13, "label": "Legal gender recognition" },
    { "id": "intersexIntegrity", "weight":  3, "label": "Intersex bodily integrity" },
    { "id": "civilSociety",      "weight":  6, "label": "Civil society space" },
    { "id": "asylum",            "weight":  5, "label": "Asylum" }
  ],
  "countries": []
}
```

- [ ] **Step 2: Populate `countries` array with 36 entries**

For each of the 36 country IDs in `data/countries.json` (DE, FR, IT, ES, NL, BE, AT, CH, CZ, PL, HU, PT, GR, SE, TR, DK, FI, IE, LU, MT, CY, HR, RO, BG, SK, SI, EE, LV, LT, IS, LI, NO, AL, BA, MK, RS), add an object following the `DE` example below. Use the ILGA 2025 raw data to fill in actual values — do not invent numbers.

Per-country schema (example — fill from ILGA data, replace `DE` with each country):

```json
{
  "id": "DE",
  "ilgaRank": 15,
  "overallScore": 55,
  "trend": "up",
  "categories": {
    "equality":          { "score": 78, "achievedItems": 10, "totalItems": 13 },
    "family":            { "score": 90, "achievedItems":  9, "totalItems": 10 },
    "hateCrime":         { "score": 60, "achievedItems":  6, "totalItems": 10 },
    "legalGenderRecog":  { "score": 85, "achievedItems":  6, "totalItems":  7 },
    "intersexIntegrity": { "score": 50, "achievedItems":  1, "totalItems":  2 },
    "civilSociety":      { "score":100, "achievedItems":  3, "totalItems":  3 },
    "asylum":            { "score": 75, "achievedItems":  3, "totalItems":  4 }
  },
  "keyItems": {
    "marriageEquality":        true,
    "jointAdoption":           true,
    "constitutionalBan":       false,
    "employmentProtection":    true,
    "selfDeterminationGender": true,
    "banOnIntersexSurgery":    "partial",
    "banOnConversionTherapy":  true,
    "hateCrimeLawSO":          true,
    "hateCrimeLawGI":          true
  },
  "highlight":   "Self-determination gender recognition law effective 2024",
  "highlightTr": "2024'te yürürlüğe giren kendi kaderini tayin yasası",
  "lastUpdated": "2025-05"
}
```

**Filling rules:**
- `ilgaRank` is the 1-49 European ranking (ILGA covers 49 countries)
- `overallScore` is the aggregate 0-100 percentage ILGA publishes
- `trend` is `"up"` / `"down"` / `"flat"` derived from the report's year-over-year comparison
- `categories.{cat}.score` is the 0-100 percentage for that category
- `categories.{cat}.achievedItems` / `totalItems` are the actual counts from the ILGA rubric
- `keyItems.*` are booleans OR the string `"partial"` (only for `banOnIntersexSurgery` where partial bans exist)
- `highlight` is one English sentence about the most notable 2024-2025 development
- `highlightTr` is the Turkish translation (data-curator writes both; no machine translation)
- `lastUpdated` is always `"2025-05"` (ILGA publication month) unless the country was updated later

For countries ILGA does not publish (AL, BA, MK, RS in some report editions), use:
```json
"ilgaRank": null,
"overallScore": null,
"trend": "flat",
"note": "Not covered in ILGA-Europe 2025; data from national NGO monitoring",
```
…and populate `categories` + `keyItems` from the closest national NGO source cited in `SOURCES.md`.

- [ ] **Step 3: Validate the JSON parses**

Run:
```bash
python -c "import json; d=json.load(open('data/rainbow-map.json', encoding='utf-8')); print('countries:', len(d['countries'])); assert len(d['countries']) == 36, 'expected 36 countries'; print('OK')"
```
Expected output: `countries: 36\nOK`

- [ ] **Step 4: Serve the file through the running local server**

Run:
```bash
curl -s -o /dev/null -w "http=%{http_code}\n" http://localhost:8765/data/rainbow-map.json
```
Expected output: `http=200`

- [ ] **Step 5: Commit**

```bash
git add data/rainbow-map.json
git commit -m "data: ILGA Rainbow Europe 2025 snapshot for 36 countries"
```

---

## Task 2: Create `data/accessibility.json`

**Files:**
- Create: `data/accessibility.json`

**Source material:** Wheelmap.org public snapshot 2026-04 (OSM-derived, `https://wheelmap.org`), EU Disability Card programme reference, DB Barrierefrei Reisen service guide, Eurostat 2024 Accessibility Index. `api-integrator` agent runs a one-shot Wheelmap API query (anonymous REST, CORS-friendly for aggregate counts) to get `topCities[].accessibleSpots` for the three largest cities per country. `data-curator` finalises notes from policy documents.

- [ ] **Step 1: Write the envelope and one representative country (DE)**

Start the file with:

```json
{
  "version": 1,
  "generated": "2026-04-11",
  "sources": [
    "Wheelmap.org public snapshot 2026-04 (OSM-based)",
    "EU Disability Card pilot programme",
    "DB Barrierefrei Reisen service guide",
    "Eurostat 2024 Accessibility Index"
  ],
  "note": "Country-level summary. Wheelmap data is per-city; we aggregate the top 3 cities per country. 'overallScore' mirrors countries.scores.accessibility so consumers can cross-reference.",
  "countries": []
}
```

Add the `DE` reference object:

```json
{
  "id": "DE",
  "overallScore": 4,
  "publicTransport": {
    "score": 4,
    "status": "mostly-accessible",
    "notes":   "S-Bahn + U-Bahn fully accessible in Berlin, Munich, Hamburg. DB long-distance trains 85% accessible.",
    "notesTr": "Berlin, Münih, Hamburg'da S-Bahn ve U-Bahn tamamen erişilebilir. DB uzun yol trenlerinin %85'i erişilebilir."
  },
  "trainStations": {
    "score": 4,
    "barrierFreePercent": 85,
    "assistanceBooking": {
      "available": true,
      "url":   "https://www.bahn.de/service/individuelle-hilfe/mobilitaetsservice",
      "phone": "+49 30 65212888",
      "leadTimeHours": 24
    }
  },
  "topCities": [
    { "city": "Berlin",  "accessibleSpots": 3147, "wheelmapCoverage": "high" },
    { "city": "Munich",  "accessibleSpots": 1893, "wheelmapCoverage": "high" },
    { "city": "Hamburg", "accessibleSpots": 1204, "wheelmapCoverage": "high" }
  ],
  "accommodation": {
    "score": 3,
    "notes":   "Major chains (Motel One, NH) offer accessible rooms; budget hostels vary.",
    "notesTr": "Büyük zincirlerde (Motel One, NH) erişilebilir oda bulunur; budget hostel'ler değişken."
  },
  "attractions": {
    "score": 4,
    "notes":   "Most museums offer free entry + guide for disabled visitors with a companion.",
    "notesTr": "Çoğu müze engelli ziyaretçilere refakatçiyle ücretsiz giriş + rehberlik sunar."
  },
  "disabilityCard": {
    "euDisabilityCardAccepted": true,
    "nationalCard": "Schwerbehindertenausweis",
    "typicalDiscount": "50% DB tickets, free public transport in most cities"
  },
  "lastUpdated": "2026-04"
}
```

- [ ] **Step 2: Populate all 36 countries**

Use Wheelmap snapshot + national railway accessibility pages + Eurostat for every country ID. `overallScore` MUST equal `countries.json` `scores.accessibility` for that country — cross-check by opening `data/countries.json`. If a mismatch appears, update `accessibility.json` (the Wheelmap-backed snapshot is the authoritative Tier 3 source; `countries.json` was a quick first pass and can be reconciled in Task 5).

`topCities` is always the three largest cities with real Wheelmap counts. `wheelmapCoverage` is `"high"` / `"medium"` / `"low"` based on whether Wheelmap has > 500 / 100-500 / < 100 catalogued spots.

- [ ] **Step 3: Validate structure and count**

Run:
```bash
python -c "
import json
d = json.load(open('data/accessibility.json', encoding='utf-8'))
cs = d['countries']
print('count:', len(cs))
assert len(cs) == 36, 'expected 36 countries'
for c in cs:
    assert 'overallScore' in c and 1 <= c['overallScore'] <= 5, f\"{c['id']} bad overallScore\"
    assert 'topCities' in c and len(c['topCities']) == 3, f\"{c['id']} bad topCities\"
print('OK')
"
```
Expected: `count: 36\nOK`

- [ ] **Step 4: Cross-check against `countries.json`**

Run:
```bash
python -c "
import json
cou = json.load(open('data/countries.json', encoding='utf-8'))
acc = json.load(open('data/accessibility.json', encoding='utf-8'))
cm = {c['id']: c for c in cou.get('countries', cou)}
mismatches = []
for a in acc['countries']:
    c = cm.get(a['id'])
    if c and c.get('scores', {}).get('accessibility') != a['overallScore']:
        mismatches.append((a['id'], c['scores']['accessibility'], a['overallScore']))
print('mismatches:', mismatches)
"
```
Expected: `mismatches: []`. If not empty, reconcile — update `countries.json.scores.accessibility` to match `accessibility.json.overallScore` (the latter is authoritative because it is Wheelmap-backed).

- [ ] **Step 5: Commit**

```bash
git add data/accessibility.json data/countries.json
git commit -m "data: Wheelmap + EU disability accessibility snapshot for 36 countries"
```

---

## Task 3: Create `data/emergency-phrases.json`

**Files:**
- Create: `data/emergency-phrases.json`

**Source material:** EU emergency number registry (`112.eu`), per-country tourism board phrase lists, Turkish consulate directory. Phrases are hand-written by `data-curator` (no machine translation to avoid errors that could get someone into trouble in a real emergency).

- [ ] **Step 1: Write the envelope + global phrases + one country example (DE)**

Start the file with:

```json
{
  "version": 1,
  "generated": "2026-04-11",
  "note": "Offline-ready emergency info. 112 is the universal EU emergency number; country overrides list local variants. Key phrases are in each country's primary language + global EN/TR fallbacks so non-speakers can point-and-show on a phone screen.",
  "universalEu": {
    "number": "112",
    "description": "EU-wide emergency number — police / ambulance / fire, any EU country, any mobile, works even without SIM."
  },
  "globalPhrases": {
    "en": {
      "help":              "Help!",
      "callPolice":        "Call the police, please.",
      "callAmbulance":     "Call an ambulance, please.",
      "iAmLost":           "I am lost.",
      "iNeedADoctor":      "I need a doctor.",
      "whereIsHospital":   "Where is the nearest hospital?",
      "doYouSpeakEnglish": "Do you speak English?",
      "allergicTo":        "I am allergic to {thing}.",
      "myPassportIsLost":  "My passport is lost."
    },
    "tr": {
      "help":              "İmdat!",
      "callPolice":        "Polis çağırın lütfen.",
      "callAmbulance":     "Ambulans çağırın lütfen.",
      "iAmLost":           "Kayboldum.",
      "iNeedADoctor":      "Doktora ihtiyacım var.",
      "whereIsHospital":   "En yakın hastane nerede?",
      "doYouSpeakEnglish": "İngilizce biliyor musunuz?",
      "allergicTo":        "{thing}'a alerjim var.",
      "myPassportIsLost":  "Pasaportumu kaybettim."
    }
  },
  "countries": [
    {
      "id": "DE",
      "primaryLanguages": ["de"],
      "numbers": {
        "police":        "110",
        "ambulance":     "112",
        "fire":          "112",
        "poisonControl": "030 19240 (Berlin)",
        "touristPolice": null
      },
      "phrases": {
        "de": {
          "help":              "Hilfe!",
          "callPolice":        "Rufen Sie die Polizei, bitte.",
          "callAmbulance":     "Rufen Sie einen Krankenwagen, bitte.",
          "iAmLost":           "Ich habe mich verirrt.",
          "iNeedADoctor":      "Ich brauche einen Arzt.",
          "whereIsHospital":   "Wo ist das nächste Krankenhaus?",
          "doYouSpeakEnglish": "Sprechen Sie Englisch?",
          "allergicTo":        "Ich bin allergisch gegen {thing}.",
          "myPassportIsLost":  "Mein Pass ist verloren."
        }
      },
      "embassyHint": {
        "tr":   "Türkiye Berlin Büyükelçiliği — +49 30 27585-0",
        "hint": "search: 'turkish embassy berlin'"
      }
    }
  ]
}
```

- [ ] **Step 2: Add the remaining 35 countries**

For each country, populate:
- `primaryLanguages`: ISO 639-1 codes (e.g. `["fr"]` for FR, `["nl", "fr"]` for BE)
- `numbers.police` / `ambulance` / `fire`: local numbers (112 is always the fallback)
- `phrases.{lang}`: all 9 keys in the local language, hand-written
- `embassyHint.tr`: Turkish embassy phone + city name

For multilingual countries (BE, CH, LU), include phrases for each official language as separate entries in `phrases`.

- [ ] **Step 3: Validate**

Run:
```bash
python -c "
import json
d = json.load(open('data/emergency-phrases.json', encoding='utf-8'))
cs = d['countries']
print('count:', len(cs))
assert len(cs) == 36, f'expected 36, got {len(cs)}'
required_phrases = {'help','callPolice','callAmbulance','iAmLost','iNeedADoctor','whereIsHospital','doYouSpeakEnglish','allergicTo','myPassportIsLost'}
for c in cs:
    for lang in c['primaryLanguages']:
        phrases = c.get('phrases', {}).get(lang, {})
        missing = required_phrases - phrases.keys()
        assert not missing, f\"{c['id']}.{lang} missing: {missing}\"
print('OK')
"
```
Expected: `count: 36\nOK`

- [ ] **Step 4: Commit**

```bash
git add data/emergency-phrases.json
git commit -m "data: emergency numbers + offline phrase packs for 36 countries"
```

---

## Task 4: Create the data adapter `js/features/inclusion-data.js`

**Files:**
- Create: `js/features/inclusion-data.js`

- [ ] **Step 1: Write the adapter module**

Create `js/features/inclusion-data.js` with exactly this content:

```js
// js/features/inclusion-data.js
// Pluggable adapter for Tier 3 Inclusion Pack data. Phase 1 reads from
// three static JSON snapshots; Phase 2 will layer live Wheelmap REST
// responses on top without changing any consumer signatures.
//
// IMPORTANT: cache-hit rule — once data is loaded, all accessor
// functions return synchronously. Never schedule a .then() callback
// on the cache-hit path: that is the bug we fixed in turkish-bonus.js
// (commit ea7b67e) and it will infinite-loop any renderer that
// re-invokes these functions on state updates.

import { loadJson } from '../data/loader.js';

let rainbowIndex = null;           // { [countryId]: entry }
let accessibilityIndex = null;     // { [countryId]: entry }
let emergencyData = null;          // full object (not indexed — small)
let loadPromise = null;

function indexById(list) {
  const out = {};
  for (const item of list || []) out[item.id] = item;
  return out;
}

/**
 * Trigger the one-shot load of all three datasets. Safe to call many
 * times — the in-flight promise is shared, and after resolution all
 * accessor functions are synchronous cache hits.
 */
export async function ensureInclusionData() {
  if (rainbowIndex && accessibilityIndex && emergencyData) return;
  if (loadPromise) return loadPromise;
  loadPromise = Promise.allSettled([
    loadJson('rainbow-map.json').then(d => { rainbowIndex = indexById(d.countries); }),
    loadJson('accessibility.json').then(d => { accessibilityIndex = indexById(d.countries); }),
    loadJson('emergency-phrases.json').then(d => { emergencyData = d; })
  ]).then(results => {
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const names = ['rainbow-map.json', 'accessibility.json', 'emergency-phrases.json'];
        console.warn(`[inclusion] ${names[i]} unavailable`, r.reason?.message || r.reason);
      }
    });
    loadPromise = null;
  });
  return loadPromise;
}

/** Synchronous after first load. Returns null if data unavailable. */
export function getRainbowData(countryId) {
  return rainbowIndex?.[countryId] || null;
}

/** Synchronous after first load. Returns null if data unavailable. */
export function getAccessibilityData(countryId) {
  return accessibilityIndex?.[countryId] || null;
}

/**
 * Returns { country, universal, userLang } or null if unavailable.
 * userLang is the caller's current i18n language for fallback phrases.
 */
export function getEmergencyInfo(countryId, userLang) {
  if (!emergencyData) return null;
  const country = emergencyData.countries?.find(c => c.id === countryId) || null;
  return {
    country,
    universal: emergencyData.universalEu,
    globalPhrases: emergencyData.globalPhrases,
    userLang
  };
}

/**
 * Returns a 0..1 normalised value for the map colour layer.
 * mode: 'rainbow' → ILGA overallScore / 100
 *       'accessibility' → overallScore / 5
 *       anything else → 0
 * Returns null when data for that country is unavailable.
 */
export function inclusionLayerValue(countryId, mode) {
  if (mode === 'rainbow') {
    const rd = getRainbowData(countryId);
    if (!rd || rd.overallScore == null) return null;
    return rd.overallScore / 100;
  }
  if (mode === 'accessibility') {
    const ad = getAccessibilityData(countryId);
    if (!ad || ad.overallScore == null) return null;
    return ad.overallScore / 5;
  }
  return null;
}

/** Summary statistics for the Inclusion tab's default (no country) view. */
export function inclusionSummaryStats() {
  const stats = {
    rainbowAverage: null,
    marriageEqualityCount: 0,
    selfDeterminationCount: 0,
    accessibleStationsCount: 0,
    disabilityCardCount: 0,
    totalCountries: 0
  };
  if (!rainbowIndex || !accessibilityIndex) return stats;

  const countries = Object.values(rainbowIndex);
  const scoreSum = countries.reduce((n, c) => n + (c.overallScore || 0), 0);
  stats.totalCountries = countries.length;
  stats.rainbowAverage = countries.length ? Math.round(scoreSum / countries.length) : 0;
  stats.marriageEqualityCount   = countries.filter(c => c.keyItems?.marriageEquality).length;
  stats.selfDeterminationCount  = countries.filter(c => c.keyItems?.selfDeterminationGender).length;

  for (const a of Object.values(accessibilityIndex)) {
    if (a.trainStations?.barrierFreePercent >= 80) stats.accessibleStationsCount++;
    if (a.disabilityCard?.euDisabilityCardAccepted) stats.disabilityCardCount++;
  }
  return stats;
}
```

- [ ] **Step 2: Syntax check**

Run:
```bash
node --check js/features/inclusion-data.js
```
Expected: no output (zero exit code).

- [ ] **Step 3: Smoke-test in browser**

Unlock browser + navigate:
```
mcp__playwright__browser_navigate → http://localhost:8765/index.html?bust=t4
```

Run in browser console via `browser_evaluate`:
```js
async () => {
  const mod = await import('/js/features/inclusion-data.js');
  await mod.ensureInclusionData();
  return {
    rainbowDE: mod.getRainbowData('DE')?.overallScore,
    accessDE:  mod.getAccessibilityData('DE')?.overallScore,
    emergencyDE: mod.getEmergencyInfo('DE', 'tr')?.country?.numbers?.police,
    layerRainbowDE:  mod.inclusionLayerValue('DE', 'rainbow'),
    layerAccessDE:   mod.inclusionLayerValue('DE', 'accessibility'),
    summary: mod.inclusionSummaryStats()
  };
}
```

Expected: all fields populated with numbers / strings from the DE entry (e.g. `rainbowDE: 55`, `accessDE: 4`, `emergencyDE: "110"`, `layerRainbowDE: 0.55`, `layerAccessDE: 0.8`, `summary.totalCountries: 36`).

- [ ] **Step 4: Commit**

```bash
git add js/features/inclusion-data.js
git commit -m "feat(inclusion): pluggable data adapter for Tier 3 datasets"
```

---

## Task 5: Extend `state.js` with `inclusionMode` and `user.onboarded`

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Add the new slice and flag**

Open `js/state.js`. Change the `initialState` object:

Replace:
```js
  user: {
    groupSize: 4,
    homeCountry: 'TR',
    budget: 'moderate',        // 'budget' | 'moderate' | 'comfort'
    accommodation: 'hostel',   // 'hostel' | 'airbnb' | 'camp' | 'couchsurf'
    foodStyle: 'moderate'      // 'budget' | 'moderate' | 'comfort'
  },
```

With:
```js
  user: {
    groupSize: 4,
    homeCountry: 'TR',
    budget: 'moderate',        // 'budget' | 'moderate' | 'comfort'
    accommodation: 'hostel',   // 'hostel' | 'airbnb' | 'camp' | 'couchsurf'
    foodStyle: 'moderate',     // 'budget' | 'moderate' | 'comfort'
    onboarded: false           // Welcome wizard completion flag — persisted via PERSIST_KEYS.user
  },
```

Find:
```js
  panelTab: 'detail',
  panelOpen: false,
  compare: [],                 // list of country ids (max 4) — ephemeral
```

Insert `inclusionMode` right after `compare`:

```js
  panelTab: 'detail',
  panelOpen: false,
  compare: [],                 // list of country ids (max 4) — ephemeral
  inclusionMode: 'default',    // 'default' | 'rainbow' | 'accessibility' — ephemeral
```

`inclusionMode` must NOT be added to `PERSIST_KEYS` — it stays ephemeral like `compare`.

- [ ] **Step 2: Syntax check**

Run:
```bash
node --check js/state.js
```
Expected: no output.

- [ ] **Step 3: Browser verify persistence works correctly**

Reload the page and in `browser_evaluate`:
```js
async () => {
  const { state } = await import('/js/state.js');
  return {
    hasOnboarded: 'onboarded' in state.getSlice('user'),
    onboarded: state.getSlice('user').onboarded,
    inclusionMode: state.getSlice('inclusionMode')
  };
}
```
Expected: `{ hasOnboarded: true, onboarded: false, inclusionMode: 'default' }`. If `onboarded` is missing, localStorage has a pre-existing `user` slice that did not contain the new key — this is fine because `_hydrate` spreads defaults first; confirm by running `localStorage.clear()` and reloading.

- [ ] **Step 4: Commit**

```bash
git add js/state.js
git commit -m "state: add inclusionMode (ephemeral) + user.onboarded (persisted)"
```

---

## Task 6: Redesign tab bar CSS (icon + label layout)

**Files:**
- Modify: `css/main.css` (lines around 138-164 — the `.panel-tabs` + `.panel-tab` blocks from commit `ea7b67e`)

- [ ] **Step 1: Replace the tab bar CSS block**

Open `css/main.css`. Find the current:
```css
.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-sunken);
  padding: 0;
  gap: 0;
}

.panel-tab {
  /* Equal-width distribution: six tabs always fit the 420 px side panel
     (and the mobile full-width panel) without horizontal scrolling.
     Horizontal padding is tight so "Hazırlık" / "Karşılaştır" survive. */
  flex: 1 1 0;
  min-width: 0;
  padding: var(--space-3) var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
  transition: color var(--duration-fast), border-color var(--duration-fast);
}

.panel-tab:hover { color: var(--text-primary); }
.panel-tab[aria-selected="true"] {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
}
```

Replace with:
```css
.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-sunken);
  padding: 0;
  gap: 0;
}

.panel-tab {
  /* Icon-above-label layout: scales from 6 to 7-8 tabs without clipping.
     At 420 px panel / 7 tabs = 60 px/tab, leaving room for a 20 px icon
     and a ≤6-char label underneath. */
  flex: 1 1 0;
  min-width: 0;
  padding: var(--space-2) var(--space-1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  color: var(--text-secondary);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color var(--duration-fast), border-color var(--duration-fast);
}

.panel-tab .tab-icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  flex-shrink: 0;
}

.panel-tab .tab-label {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-tab:hover { color: var(--text-primary); }
.panel-tab[aria-selected="true"] {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
}
.panel-tab[aria-selected="true"] .tab-icon {
  stroke: var(--accent-primary);
}
```

- [ ] **Step 2: Update mobile bottom-nav for 7 tabs**

In the same `css/main.css`, find the media query block around line 190 that contains `.bottom-nav`. Replace the current `display: flex` / default columns with a grid:

Find:
```css
  .bottom-nav {
    /* existing properties, including display: flex */
  }
```

Update it to use a 7-column grid (if the rule doesn't explicitly set `display`, add it):

```css
  .bottom-nav {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border-top: 1px solid var(--border-subtle);
    background: var(--bg-surface);
    z-index: var(--z-panel);
  }
  .bottom-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: var(--space-1);
    font-size: 0.625rem;
    color: var(--text-secondary);
    background: none;
    border: none;
    cursor: pointer;
  }
  .bottom-nav-item svg { width: 20px; height: 20px; }
  .bottom-nav-item[aria-selected="true"] { color: var(--accent-primary); }
```

The full media query may already have some of these rules — preserve any existing unrelated ones; only the `display` + `grid-template-columns` are required to change.

- [ ] **Step 3: Commit**

```bash
git add css/main.css
git commit -m "style(tabs): icon+label tab bar layout scaling to 7 tabs on desktop and mobile"
```

---

## Task 7: Add 7th tab + rewrite tab markup with Lucide SVG icons

**Files:**
- Modify: `index.html` (lines 139-152 for panel-tabs, lines 170-201 for bottom-nav)

- [ ] **Step 1: Replace the panel-tabs `<nav>` markup**

Open `index.html`. Find the current block:
```html
        <nav class="panel-tabs" role="tablist" aria-label="Panel sections">
          <button class="panel-tab" role="tab" data-tab="detail" aria-selected="true"
                  data-i18n="panel.tab.detail">Detail</button>
          <button class="panel-tab" role="tab" data-tab="route"
                  data-i18n="panel.tab.route">Route</button>
          <button class="panel-tab" role="tab" data-tab="budget"
                  data-i18n="panel.tab.budget">Budget</button>
          <button class="panel-tab" role="tab" data-tab="filters"
                  data-i18n="panel.tab.filters">Filters</button>
          <button class="panel-tab" role="tab" data-tab="compare"
                  data-i18n="panel.tab.compare">Compare</button>
          <button class="panel-tab" role="tab" data-tab="prep"
                  data-i18n="panel.tab.prep">Prep</button>
        </nav>
```

Replace with:
```html
        <nav class="panel-tabs" role="tablist" aria-label="Panel sections">
          <button class="panel-tab" role="tab" data-tab="detail" aria-selected="true">
            <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span class="tab-label" data-i18n="panel.tab.detail">Info</span>
          </button>
          <button class="panel-tab" role="tab" data-tab="route">
            <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="6" cy="19" r="3"/>
              <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
              <circle cx="18" cy="5" r="3"/>
            </svg>
            <span class="tab-label" data-i18n="panel.tab.route">Route</span>
          </button>
          <button class="panel-tab" role="tab" data-tab="budget">
            <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/>
              <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
            </svg>
            <span class="tab-label" data-i18n="panel.tab.budget">Cost</span>
          </button>
          <button class="panel-tab" role="tab" data-tab="filters">
            <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <line x1="4" y1="21" x2="4" y2="14"/>
              <line x1="4" y1="10" x2="4" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12" y2="3"/>
              <line x1="20" y1="21" x2="20" y2="16"/>
              <line x1="20" y1="12" x2="20" y2="3"/>
              <line x1="1" y1="14" x2="7" y2="14"/>
              <line x1="9" y1="8" x2="15" y2="8"/>
              <line x1="17" y1="16" x2="23" y2="16"/>
            </svg>
            <span class="tab-label" data-i18n="panel.tab.filters">Filter</span>
          </button>
          <button class="panel-tab" role="tab" data-tab="compare">
            <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 3v18h18"/>
              <path d="M7 16V9"/>
              <path d="M12 16V5"/>
              <path d="M17 16v-5"/>
            </svg>
            <span class="tab-label" data-i18n="panel.tab.compare">Match</span>
          </button>
          <button class="panel-tab" role="tab" data-tab="inclusion">
            <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="16" cy="4" r="1"/>
              <path d="M18 19l-3-8-4 1 1 8"/>
              <path d="M7 22l3-6 4 1"/>
              <path d="M10 11l-4 1 1 4"/>
              <path d="M16 5l-3 4h4l-1 4"/>
            </svg>
            <span class="tab-label" data-i18n="panel.tab.inclusion">Equal</span>
          </button>
          <button class="panel-tab" role="tab" data-tab="prep">
            <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10z"/>
              <path d="M8 10V6a4 4 0 0 1 8 0v4"/>
              <line x1="8" y1="14" x2="16" y2="14"/>
            </svg>
            <span class="tab-label" data-i18n="panel.tab.prep">Prep</span>
          </button>
        </nav>
```

- [ ] **Step 2: Replace the mobile bottom-nav markup**

Find the existing 4-item `.bottom-nav` block (around lines 170-201) and replace it with the full 7-item version. All 7 buttons use the same SVG paths as the panel-tabs above — copy them as inline SVGs with the same viewBox/path:

```html
    <!-- ═══════ Mobile bottom nav ═══════ -->
    <nav class="bottom-nav" role="navigation" aria-label="Main sections">
      <button class="bottom-nav-item" data-tab="detail" aria-selected="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span data-i18n="panel.tab.detail">Info</span>
      </button>
      <button class="bottom-nav-item" data-tab="route">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="6" cy="19" r="3"/>
          <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
          <circle cx="18" cy="5" r="3"/>
        </svg>
        <span data-i18n="panel.tab.route">Route</span>
      </button>
      <button class="bottom-nav-item" data-tab="budget">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4"/>
          <path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/>
          <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
        </svg>
        <span data-i18n="panel.tab.budget">Cost</span>
      </button>
      <button class="bottom-nav-item" data-tab="filters">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="4" y1="21" x2="4" y2="14"/>
          <line x1="4" y1="10" x2="4" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12" y2="3"/>
          <line x1="20" y1="21" x2="20" y2="16"/>
          <line x1="20" y1="12" x2="20" y2="3"/>
          <line x1="1" y1="14" x2="7" y2="14"/>
          <line x1="9" y1="8" x2="15" y2="8"/>
          <line x1="17" y1="16" x2="23" y2="16"/>
        </svg>
        <span data-i18n="panel.tab.filters">Filter</span>
      </button>
      <button class="bottom-nav-item" data-tab="compare">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M3 3v18h18"/>
          <path d="M7 16V9"/>
          <path d="M12 16V5"/>
          <path d="M17 16v-5"/>
        </svg>
        <span data-i18n="panel.tab.compare">Match</span>
      </button>
      <button class="bottom-nav-item" data-tab="inclusion">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="16" cy="4" r="1"/>
          <path d="M18 19l-3-8-4 1 1 8"/>
          <path d="M7 22l3-6 4 1"/>
          <path d="M10 11l-4 1 1 4"/>
          <path d="M16 5l-3 4h4l-1 4"/>
        </svg>
        <span data-i18n="panel.tab.inclusion">Equal</span>
      </button>
      <button class="bottom-nav-item" data-tab="prep">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10z"/>
          <path d="M8 10V6a4 4 0 0 1 8 0v4"/>
          <line x1="8" y1="14" x2="16" y2="14"/>
        </svg>
        <span data-i18n="panel.tab.prep">Prep</span>
      </button>
    </nav>
```

- [ ] **Step 3: Browser smoke test**

Unlock the browser, clear service worker, reload:
```
mcp__playwright__browser_navigate → http://localhost:8765/index.html?bust=t7
```

Then take a screenshot of the tab bar:
```
mcp__playwright__browser_take_screenshot → filename: task7-tabbar.png (element: .panel-tabs)
```

Visually verify: 7 tabs, each with icon above a ≤6-char label, equal width, no clipping.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "ui(tabs): 7-tab layout with Lucide SVG icons, mobile bottom-nav mirrored"
```

---

## Task 8: i18n labels for tabs + new inclusion block (seed only)

**Files:**
- Modify: `i18n/en.json` (panel.tab block)
- Modify: `i18n/tr.json` (panel.tab block)

- [ ] **Step 1: Shorten existing tab labels in `en.json`**

Open `i18n/en.json`. Find:
```json
"tab": {
  "detail": "Detail",
  "route": "Route",
  "budget": "Budget",
  "filters": "Filters",
  "compare": "Compare",
  "prep": "Prep"
},
```

Replace with:
```json
"tab": {
  "detail": "Info",
  "route": "Route",
  "budget": "Cost",
  "filters": "Filter",
  "compare": "Match",
  "inclusion": "Equal",
  "prep": "Prep"
},
```

- [ ] **Step 2: Shorten existing tab labels in `tr.json`**

Open `i18n/tr.json`. Find:
```json
"tab": {
  "detail": "Detay",
  "route": "Rota",
  "budget": "Bütçe",
  "filters": "Filtre",
  "compare": "Kıyas",
  "prep": "Hazırlık"
},
```

Replace with:
```json
"tab": {
  "detail": "Detay",
  "route": "Rota",
  "budget": "Bütçe",
  "filters": "Filtre",
  "compare": "Kıyas",
  "inclusion": "Kapsa",
  "prep": "Hazır."
},
```

- [ ] **Step 3: Validate both JSONs parse**

Run:
```bash
python -c "import json; [json.load(open(f, encoding='utf-8')) for f in ['i18n/en.json','i18n/tr.json']]; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Browser verify tabs render without clipping**

Navigate to `http://localhost:8765/index.html?bust=t8`, clear SW, take screenshot of `.panel-tabs` in Turkish (the longest labels). Verify no label ends in an ellipsis.

- [ ] **Step 5: Commit**

```bash
git add i18n/en.json i18n/tr.json
git commit -m "i18n(tabs): shorten labels to ≤6 chars + add inclusion tab key"
```

---

## Task 9: Gradient colour variables in `design-system.css`

**Files:**
- Modify: `css/design-system.css`

- [ ] **Step 1: Add gradient tokens to `:root`**

Open `css/design-system.css`. At the end of the `:root` block (near the other colour / spacing tokens), add:

```css
  /* Inclusion map colour gradient — 5 stops, 0 → 100 scale.
     Red → orange → yellow → light-green → dark-green.
     Matches WCAG AA contrast against --bg-default. */
  --inclusion-grad-0:   #ef4444;
  --inclusion-grad-25:  #f97316;
  --inclusion-grad-50:  #facc15;
  --inclusion-grad-75:  #86efac;
  --inclusion-grad-100: #16a34a;
```

- [ ] **Step 2: Add dark-theme overrides**

Find the `[data-theme="dark"]` block (or `:root[data-theme="dark"]`). Add:

```css
  --inclusion-grad-0:   #dc2626;
  --inclusion-grad-25:  #ea580c;
  --inclusion-grad-50:  #ca8a04;
  --inclusion-grad-75:  #4ade80;
  --inclusion-grad-100: #15803d;
```

- [ ] **Step 3: Commit**

```bash
git add css/design-system.css
git commit -m "style(inclusion): 5-stop gradient custom properties for map colouring"
```

---

## Task 10: Create `js/map/inclusion-layer.js`

**Files:**
- Create: `js/map/inclusion-layer.js`

- [ ] **Step 1: Write the module**

Create `js/map/inclusion-layer.js`:

```js
// js/map/inclusion-layer.js
// Recolours country polygons in the existing Leaflet layer based on
// state.inclusionMode. Sibling to countries-layer.js: stroke/class state
// stays untouched, we only update fillColor + fillOpacity through
// Leaflet's setStyle(). CSS custom properties are read from the computed
// style of :root so gradients respect dark/light theme.

import { state } from '../state.js';
import { ensureInclusionData, inclusionLayerValue } from '../features/inclusion-data.js';

const GRADIENT_STOPS = [
  { pct: 0,   varName: '--inclusion-grad-0'   },
  { pct: 25,  varName: '--inclusion-grad-25'  },
  { pct: 50,  varName: '--inclusion-grad-50'  },
  { pct: 75,  varName: '--inclusion-grad-75'  },
  { pct: 100, varName: '--inclusion-grad-100' }
];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function gradientColorForPct(pct) {
  const clamped = Math.max(0, Math.min(100, pct));
  // Pick the nearest stop under and over; return the lower stop's colour
  // (step gradient, not interpolated — keeps it deterministic and fast).
  for (let i = GRADIENT_STOPS.length - 1; i >= 0; i--) {
    if (clamped >= GRADIENT_STOPS[i].pct) return cssVar(GRADIENT_STOPS[i].varName);
  }
  return cssVar(GRADIENT_STOPS[0].varName);
}

/**
 * Apply the current inclusionMode to the given Leaflet GeoJSON layer.
 * layer is the returned layer from initCountriesLayer().
 */
export async function initInclusionLayer(layer) {
  await ensureInclusionData();  // one-shot load; synchronous on repeat

  const apply = () => {
    const mode = state.getSlice('inclusionMode');
    layer.eachLayer(sub => {
      const id = sub.feature?.properties?.id;
      if (!id) return;
      if (mode === 'default') {
        sub.setStyle({ fillColor: 'transparent', fillOpacity: 0 });
        return;
      }
      const value = inclusionLayerValue(id, mode);
      if (value == null) {
        sub.setStyle({ fillColor: 'transparent', fillOpacity: 0 });
        return;
      }
      sub.setStyle({
        fillColor: gradientColorForPct(value * 100),
        fillOpacity: 0.55
      });
    });
  };

  state.subscribe('inclusionMode', apply);
  state.subscribe('countries', apply);   // re-apply if dataset reloads
  document.addEventListener('themechange', apply);  // gradients change with theme
  apply();
}
```

- [ ] **Step 2: Syntax check**

Run:
```bash
node --check js/map/inclusion-layer.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/map/inclusion-layer.js
git commit -m "feat(inclusion): map colour layer reactive to inclusionMode + theme"
```

---

## Task 11: Wire inclusion layer into `main.js`

**Files:**
- Modify: `js/main.js`

- [ ] **Step 1: Import + wire**

Open `js/main.js`. Find the block that wires the map layers around line 75-85:

```js
    if (map) {
      const [{ initCountriesLayer }, { initLabelsLayer }] = await Promise.all([
        import('./map/countries-layer.js'),
        import('./map/labels.js')
      ]);
      await initCountriesLayer(map);
      await initLabelsLayer(map);
```

Replace with:

```js
    if (map) {
      const [{ initCountriesLayer }, { initLabelsLayer }, { initInclusionLayer }] = await Promise.all([
        import('./map/countries-layer.js'),
        import('./map/labels.js'),
        import('./map/inclusion-layer.js')
      ]);
      const countriesLayer = await initCountriesLayer(map);
      await initLabelsLayer(map);
      if (countriesLayer) await initInclusionLayer(countriesLayer);
```

This requires `initCountriesLayer` to return the Leaflet layer it creates. Check `js/map/countries-layer.js`: if `initCountriesLayer` currently doesn't return the layer, add `return countriesLayer;` (or whatever the local variable is called) at the end of that function. Commit that fix in the same commit — it's a single-line change and trivially correct.

- [ ] **Step 2: Smoke test in browser**

Navigate to `http://localhost:8765/index.html?bust=t11`, clear SW. In the browser console run:

```js
async () => {
  const { state } = await import('/js/state.js');
  state.set('inclusionMode', 'rainbow');
  await new Promise(r => setTimeout(r, 200));
  // Check any polygon got a non-transparent fill
  const leafletPaths = document.querySelectorAll('.leaflet-interactive');
  const filled = Array.from(leafletPaths).filter(p => {
    const f = p.getAttribute('fill-opacity');
    return f && parseFloat(f) > 0;
  });
  return { total: leafletPaths.length, filled: filled.length };
}
```

Expected: `{ total: 36, filled: N }` where `N` > 0. If `filled` is 0, the inclusion layer isn't being applied — debug `inclusion-data.js` loading + `inclusion-layer.js` subscription.

- [ ] **Step 3: Commit**

```bash
git add js/main.js js/map/countries-layer.js
git commit -m "feat(map): wire inclusion colour layer on top of countries layer"
```

---

## Task 12: Create `js/ui/inclusion.js` — summary view + tab registration

**Files:**
- Create: `js/ui/inclusion.js`

- [ ] **Step 1: Write the module with summary view and exports**

Create `js/ui/inclusion.js`:

```js
// js/ui/inclusion.js
// "Kapsayıcılık" tab — renders two views depending on whether a country
// is selected: the summary panorama (no selection) or a per-country
// breakdown (Rainbow + Accessibility + Emergency cards). Also exports
// activateFewerOpportunitiesMode() as the single source of truth for the
// preset logic (called from both this tab's button and the welcome
// wizard).

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { qs, h, empty, on } from '../utils/dom.js';
import {
  ensureInclusionData,
  getRainbowData,
  getAccessibilityData,
  getEmergencyInfo,
  inclusionSummaryStats
} from '../features/inclusion-data.js';
import { showToast } from './toast.js';

export function initInclusion() {
  const body = qs('#panelBody');
  if (!body) return;

  const render = async () => {
    if (state.getSlice('panelTab') !== 'inclusion') return;
    await ensureInclusionData();
    renderInto(body);
  };

  state.subscribe('panelTab',         render);
  state.subscribe('selectedCountry',  render);
  state.subscribe('inclusionMode',    render);
  state.subscribe('countries',        render);
  state.subscribe('language',         render);

  render();
}

function renderInto(root) {
  empty(root);
  const selectedId = state.getSlice('selectedCountry');
  const panel = selectedId
    ? renderCountryView(selectedId)
    : renderSummaryView();
  root.appendChild(panel);
  wireActions(root);
}

// ─── Summary view ─────────────────────────────────────────────────────────

function renderSummaryView() {
  const stats = inclusionSummaryStats();
  const mode  = state.getSlice('inclusionMode');

  return h('div', { class: 'inclusion-panel' }, [
    h('header', { class: 'inclusion-header' }, [
      h('h2', null, t('inclusion.title')),
      h('p',  null, t('inclusion.subtitle'))
    ]),

    h('section', { class: 'inclusion-card inclusion-summary-card' }, [
      h('h3', null, `🌈 ${t('inclusion.summary.rainbowTitle')}`),
      h('p',  { class: 'inclusion-stat-big' }, `${stats.rainbowAverage} / 100`),
      h('p',  { class: 'inclusion-stat-caption' }, t('inclusion.summary.rainbowCaption', {
        marriage: stats.marriageEqualityCount,
        selfdet:  stats.selfDeterminationCount
      }))
    ]),

    h('section', { class: 'inclusion-card' }, [
      h('h3', null, `♿ ${t('inclusion.summary.accessTitle')}`),
      h('p',  null, t('inclusion.summary.accessStations', {
        n: stats.accessibleStationsCount,
        total: stats.totalCountries
      })),
      h('p',  null, t('inclusion.summary.accessDiscCard', {
        n: stats.disabilityCardCount
      }))
    ]),

    h('section', { class: 'inclusion-card' }, [
      h('h3', null, `🧭 ${t('inclusion.summary.mapModesTitle')}`),
      h('div', { class: 'inclusion-mode-chips', role: 'radiogroup', 'aria-label': 'Map colour mode' }, [
        renderModeChip('default',       mode, t('inclusion.mode.default')),
        renderModeChip('rainbow',       mode, '🌈 ' + t('inclusion.mode.rainbow')),
        renderModeChip('accessibility', mode, '♿ ' + t('inclusion.mode.accessibility'))
      ])
    ]),

    h('section', { class: 'inclusion-card inclusion-fewer-opps' }, [
      h('h3', null, `⚡ ${t('inclusion.summary.fewerOppsTitle')}`),
      h('p',  null, t('inclusion.summary.fewerOppsDesc')),
      h('button', {
        class: 'btn btn-primary',
        type: 'button',
        'data-action': 'activate-fewer-opps'
      }, t('inclusion.summary.fewerOppsCta'))
    ]),

    h('p', { class: 'inclusion-hint' }, t('inclusion.summary.pickCountryHint'))
  ]);
}

function renderModeChip(value, current, label) {
  return h('button', {
    class: 'mode-chip' + (current === value ? ' is-active' : ''),
    type: 'button',
    role: 'radio',
    'aria-checked': current === value ? 'true' : 'false',
    'data-action': 'set-mode',
    'data-mode': value
  }, label);
}

// ─── Country view (stub — filled in Task 13) ─────────────────────────────

function renderCountryView(countryId) {
  // Filled in Task 13 — this stub returns a placeholder so the tab
  // renders instead of throwing when a country is selected.
  return h('div', { class: 'inclusion-panel' }, [
    h('p', null, `Loading country view for ${countryId}...`)
  ]);
}

// ─── Actions ──────────────────────────────────────────────────────────────

function wireActions(panel) {
  on(panel, 'click', '[data-action="set-mode"]', (_ev, target) => {
    state.set('inclusionMode', target.dataset.mode);
  });
  on(panel, 'click', '[data-action="activate-fewer-opps"]', () => {
    activateFewerOpportunitiesMode();
  });
}

// ─── Exported: Fewer-opportunities preset (single source of truth) ────────

export function activateFewerOpportunitiesMode() {
  state.update('filters', f => ({
    ...f,
    budget:        'low',
    accessibility: true,
    lgbtqSafe:     true,
    interrailOnly: true
  }));
  showToast(t('inclusion.fewerOppsEnabled'), 'success', 5000);
  state.set('panelTab', 'filters');
}
```

- [ ] **Step 2: Wire into `main.js` side-panel init**

Open `js/main.js`. Find the Promise.all that imports the tab modules (around line 62):

```js
    await Promise.all([
      import('./ui/country-detail.js').then(m => m.initCountryDetail()),
      import('./ui/filters-ui.js').then(m => m.initFiltersUI()),
      import('./ui/route-builder.js').then(m => m.initRouteBuilder()),
      import('./ui/budget.js').then(m => m.initBudget()),
      import('./ui/compare.js').then(m => m.initCompare()),
      import('./ui/prep.js').then(m => m.initPrep())
    ]);
```

Add the inclusion import:

```js
    await Promise.all([
      import('./ui/country-detail.js').then(m => m.initCountryDetail()),
      import('./ui/filters-ui.js').then(m => m.initFiltersUI()),
      import('./ui/route-builder.js').then(m => m.initRouteBuilder()),
      import('./ui/budget.js').then(m => m.initBudget()),
      import('./ui/compare.js').then(m => m.initCompare()),
      import('./ui/inclusion.js').then(m => m.initInclusion()),
      import('./ui/prep.js').then(m => m.initPrep())
    ]);
```

- [ ] **Step 3: Syntax check**

Run:
```bash
node --check js/ui/inclusion.js && node --check js/main.js
```
Expected: no output.

- [ ] **Step 4: Smoke test — click Inclusion tab, see summary view**

Navigate, clear SW, click the 6th tab (inclusion). Verify:
- Summary view renders with 4 cards (Rainbow, Access, Modes, Fewer-opps)
- Mode chips are clickable, change `state.inclusionMode`
- Polygons recolour on the map when mode changes
- Fewer-opps button doesn't error (it will work end-to-end once filters tab acknowledges the toast)

- [ ] **Step 5: Commit**

```bash
git add js/ui/inclusion.js js/main.js
git commit -m "feat(inclusion): tab summary view, mode chips, fewer-opps preset export"
```

---

## Task 13: Inclusion tab country view (Rainbow + Accessibility + Emergency cards)

**Files:**
- Modify: `js/ui/inclusion.js` (replace the `renderCountryView` stub)

- [ ] **Step 1: Replace the stub with the full country view**

Open `js/ui/inclusion.js`. Replace the entire `renderCountryView` function (and add the three helper render functions it calls) with:

```js
function renderCountryView(countryId) {
  const country = countryById(countryId);
  if (!country) {
    return h('div', { class: 'inclusion-panel' }, [
      h('p', null, t('inclusion.country.notFound'))
    ]);
  }

  const rd = getRainbowData(countryId);
  const ad = getAccessibilityData(countryId);
  const ei = getEmergencyInfo(countryId, state.getSlice('language'));
  const useTr = state.getSlice('language') === 'tr';

  return h('div', { class: 'inclusion-panel' }, [
    h('header', { class: 'inclusion-header' }, [
      h('h2', null, `${country.flag || ''} ${country.name}`),
      h('p',  null, t('inclusion.country.subtitle'))
    ]),
    rd ? renderRainbowCard(rd, useTr)       : renderMissingCard('rainbow'),
    ad ? renderAccessibilityCard(ad, useTr) : renderMissingCard('accessibility'),
    ei ? renderEmergencyCard(ei, useTr)     : renderMissingCard('emergency')
  ]);
}

function renderRainbowCard(rd, useTr) {
  const cats = [
    { id: 'equality',          icon: '⚖️' },
    { id: 'family',            icon: '👪' },
    { id: 'hateCrime',         icon: '🛡️' },
    { id: 'legalGenderRecog',  icon: '🆔' },
    { id: 'intersexIntegrity', icon: '🩺' },
    { id: 'civilSociety',      icon: '📣' },
    { id: 'asylum',            icon: '🏛️' }
  ];
  return h('section', { class: 'inclusion-card rainbow-card' }, [
    h('header', { class: 'inclusion-card-head' }, [
      h('h3', null, '🌈 ILGA Rainbow Europe'),
      rd.ilgaRank != null
        ? h('span', { class: 'badge badge-soft' }, `#${rd.ilgaRank}`)
        : null,
      h('span', { class: 'inclusion-big-score' }, `${rd.overallScore ?? '—'}/100`)
    ]),
    h('div', { class: 'rainbow-categories' },
      cats.map(cat => {
        const c = rd.categories?.[cat.id];
        if (!c) return null;
        return h('div', { class: 'rainbow-category' }, [
          h('span', { class: 'rainbow-cat-label' }, `${cat.icon} ${t('inclusion.rainbow.cat.' + cat.id)}`),
          h('div', { class: 'progress progress-sm', role: 'progressbar',
                     'aria-valuenow': String(c.score), 'aria-valuemin': '0', 'aria-valuemax': '100' }, [
            h('div', { class: 'progress-bar', style: { width: `${c.score}%` } })
          ]),
          h('span', { class: 'rainbow-cat-score' }, `${c.score}%`)
        ]);
      })
    ),
    rd.keyItems ? h('ul', { class: 'key-items' },
      Object.entries(rd.keyItems).map(([k, v]) => h('li', { class: 'key-item ' + (v === true ? 'ok' : v === 'partial' ? 'partial' : 'no') }, [
        h('span', { class: 'key-icon' }, v === true ? '✓' : v === 'partial' ? '◐' : '✗'),
        h('span', null, t('inclusion.rainbow.keyItem.' + k))
      ]))
    ) : null,
    rd.highlight ? h('p', { class: 'rainbow-highlight' }, `💬 ${useTr && rd.highlightTr ? rd.highlightTr : rd.highlight}`) : null,
    h('p', { class: 'inclusion-source' }, `${t('inclusion.source')}: ILGA-Europe 2025${rd.lastUpdated ? ' · ' + rd.lastUpdated : ''}`)
  ]);
}

function renderAccessibilityCard(ad, useTr) {
  const sections = [
    { id: 'publicTransport',  icon: '🚇' },
    { id: 'trainStations',    icon: '🚆' },
    { id: 'accommodation',    icon: '🏨' },
    { id: 'attractions',      icon: '🏛️' }
  ];
  return h('section', { class: 'inclusion-card access-card' }, [
    h('header', { class: 'inclusion-card-head' }, [
      h('h3', null, '♿ ' + t('inclusion.access.title')),
      h('span', { class: 'inclusion-big-score' }, `${ad.overallScore ?? '—'}/5`)
    ]),
    h('div', { class: 'access-sections' },
      sections.map(s => {
        const data = ad[s.id];
        if (!data) return null;
        const pct = Math.round(((data.score || 0) / 5) * 100);
        return h('div', { class: 'access-section' }, [
          h('span', { class: 'access-label' }, `${s.icon} ${t('inclusion.access.section.' + s.id)}`),
          h('div', { class: 'progress progress-sm', role: 'progressbar',
                     'aria-valuenow': String(data.score), 'aria-valuemin': '0', 'aria-valuemax': '5' }, [
            h('div', { class: 'progress-bar', style: { width: `${pct}%` } })
          ]),
          h('span', { class: 'access-score' }, `${data.score}/5`)
        ]);
      })
    ),
    ad.disabilityCard ? h('div', { class: 'access-meta' }, [
      h('p', null, `🎫 ${ad.disabilityCard.euDisabilityCardAccepted ? t('inclusion.access.euCardYes') : t('inclusion.access.euCardNo')}`),
      ad.disabilityCard.nationalCard ? h('p', null, `${t('inclusion.access.nationalCard')}: ${ad.disabilityCard.nationalCard}`) : null,
      ad.disabilityCard.typicalDiscount ? h('p', null, `${t('inclusion.access.discount')}: ${ad.disabilityCard.typicalDiscount}`) : null
    ]) : null,
    Array.isArray(ad.topCities) && ad.topCities.length > 0 ? h('div', { class: 'access-cities' }, [
      h('p', { class: 'access-cities-title' }, `📍 ${t('inclusion.access.topCities')}`),
      h('ul', null, ad.topCities.map(c => h('li', null, `${c.city}: ${c.accessibleSpots.toLocaleString()}`)))
    ]) : null,
    ad.trainStations?.assistanceBooking?.available ? h('div', { class: 'access-assist' }, [
      h('p', null, `📞 ${t('inclusion.access.assistanceBooking')}`),
      h('a', { href: `tel:${ad.trainStations.assistanceBooking.phone}` }, ad.trainStations.assistanceBooking.phone),
      h('p', { class: 'access-lead' }, t('inclusion.access.leadTimeHours', { n: ad.trainStations.assistanceBooking.leadTimeHours }))
    ]) : null,
    h('p', { class: 'inclusion-source' }, `${t('inclusion.source')}: Wheelmap.org · ${ad.lastUpdated || ''}`)
  ]);
}

function renderEmergencyCard(ei, useTr) {
  const country = ei.country;
  if (!country) return null;
  const primaryLang = country.primaryLanguages?.[0];
  const localPhrases = country.phrases?.[primaryLang] || {};
  const phraseKeys = ['help','callPolice','callAmbulance','whereIsHospital','doYouSpeakEnglish'];
  const userFallback = ei.globalPhrases?.[ei.userLang] || ei.globalPhrases?.en || {};

  return h('section', { class: 'inclusion-card emergency-card' }, [
    h('header', { class: 'inclusion-card-head' }, [
      h('h3', null, '📞 ' + t('inclusion.emergency.title'))
    ]),
    h('div', { class: 'emergency-numbers' }, [
      h('p', { class: 'emergency-universal' }, [
        h('strong', null, '🇪🇺 '),
        h('span', null, `${t('inclusion.emergency.eu')}: `),
        h('a', { href: `tel:${ei.universal?.number}` }, ei.universal?.number || '112')
      ]),
      h('dl', { class: 'emergency-local' }, [
        h('dt', null, t('inclusion.emergency.police')),    h('dd', null, h('a', { href: `tel:${country.numbers?.police}` }, country.numbers?.police || '—')),
        h('dt', null, t('inclusion.emergency.ambulance')), h('dd', null, h('a', { href: `tel:${country.numbers?.ambulance}` }, country.numbers?.ambulance || '—')),
        h('dt', null, t('inclusion.emergency.fire')),      h('dd', null, h('a', { href: `tel:${country.numbers?.fire}` }, country.numbers?.fire || '—'))
      ])
    ]),
    h('div', { class: 'emergency-phrases' }, [
      h('p', { class: 'emergency-phrases-title' }, `💬 ${t('inclusion.emergency.phrasesTitle')} (${primaryLang?.toUpperCase()})`),
      h('ul', null, phraseKeys.map(key => {
        const local = localPhrases[key] || '—';
        const userTxt = userFallback[key] || '';
        return h('li', { class: 'phrase-row' }, [
          h('div', { class: 'phrase-user' }, userTxt),
          h('div', { class: 'phrase-local' }, local),
          h('button', {
            class: 'btn btn-ghost btn-sm',
            type: 'button',
            'data-action': 'show-phrase',
            'data-phrase': local
          }, '📱')
        ]);
      }))
    ]),
    country.embassyHint?.tr ? h('p', { class: 'emergency-embassy' }, `🇹🇷 ${country.embassyHint.tr}`) : null
  ]);
}

function renderMissingCard(kind) {
  return h('section', { class: 'inclusion-card inclusion-missing' }, [
    h('p', null, t('inclusion.missing.' + kind))
  ]);
}
```

Also add a handler for the `show-phrase` action in `wireActions`:

Replace the current `wireActions` with:

```js
function wireActions(panel) {
  on(panel, 'click', '[data-action="set-mode"]', (_ev, target) => {
    state.set('inclusionMode', target.dataset.mode);
  });
  on(panel, 'click', '[data-action="activate-fewer-opps"]', () => {
    activateFewerOpportunitiesMode();
  });
  on(panel, 'click', '[data-action="show-phrase"]', (_ev, target) => {
    showPhraseModal(target.dataset.phrase || '');
  });
}

function showPhraseModal(phrase) {
  const overlay = h('div', { class: 'modal-overlay phrase-modal-overlay', 'data-modal': 'phrase' }, [
    h('div', { class: 'modal modal-phrase', role: 'dialog', 'aria-modal': 'true' }, [
      h('p', { class: 'phrase-text' }, phrase),
      h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        'data-action': 'close-phrase-modal'
      }, '×')
    ])
  ]);
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });
  overlay.querySelector('[data-action="close-phrase-modal"]').addEventListener('click', close);
  document.addEventListener('keydown', function handler(ev) {
    if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
  });
}
```

- [ ] **Step 2: Syntax check**

Run:
```bash
node --check js/ui/inclusion.js
```
Expected: no output.

- [ ] **Step 3: Browser smoke test**

Navigate, clear SW, click Germany on the map, then click the Inclusion tab. Verify:
- Header shows 🇩🇪 Germany
- Rainbow card renders 7 category progress bars + key items + highlight
- Accessibility card renders 4 sections + disability card + top cities + assistance booking link
- Emergency card renders EU 112 + 3 local numbers + phrase table + embassy hint
- Clicking 📱 on a phrase opens the full-screen phrase modal; Esc closes it

- [ ] **Step 4: Commit**

```bash
git add js/ui/inclusion.js
git commit -m "feat(inclusion): per-country view with Rainbow/Accessibility/Emergency cards"
```

---

## Task 14: Inclusion CSS (card styles, progress bars, phrase modal)

**Files:**
- Modify: `css/components.css`

- [ ] **Step 1: Append the new block to `components.css`**

Open `css/components.css`. At the bottom of the file, append:

```css
/* ─── Tier 3 Inclusion tab ───────────────────────────────────────────── */

.inclusion-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.inclusion-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.inclusion-header h2 {
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  margin: 0;
}
.inclusion-header p {
  color: var(--text-secondary);
  margin: 0;
}

.inclusion-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.inclusion-card-head {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.inclusion-card-head h3 {
  margin: 0;
  font-size: var(--text-base);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
  flex: 1 1 auto;
}
.inclusion-big-score {
  font-size: var(--text-lg);
  font-weight: var(--weight-bold);
  color: var(--accent-primary);
}

.inclusion-stat-big {
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  color: var(--accent-primary);
  margin: var(--space-1) 0;
}
.inclusion-stat-caption {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin: 0;
}

.inclusion-mode-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.mode-chip {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--bg-default);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}
.mode-chip.is-active {
  background: var(--accent-primary);
  color: var(--bg-default);
  border-color: var(--accent-primary);
}

.inclusion-fewer-opps {
  border-color: var(--accent-primary);
}
.inclusion-fewer-opps .btn {
  align-self: flex-start;
}

.inclusion-hint {
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  text-align: center;
}

/* Rainbow categories */

.rainbow-categories {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.rainbow-category {
  display: grid;
  grid-template-columns: 1fr auto 40px;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}
.rainbow-category .progress {
  min-width: 80px;
}
.rainbow-cat-label { color: var(--text-secondary); }
.rainbow-cat-score { color: var(--text-primary); font-variant-numeric: tabular-nums; text-align: right; }

.key-items {
  list-style: none;
  padding: 0;
  margin: var(--space-2) 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
}
.key-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--text-xs);
}
.key-item.ok      { color: var(--accent-green, #16a34a); }
.key-item.partial { color: var(--warning, #f97316); }
.key-item.no      { color: var(--text-tertiary); text-decoration: line-through; }
.key-icon { font-weight: var(--weight-bold); }

.rainbow-highlight {
  background: var(--bg-sunken);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-primary);
  margin: 0;
}

.inclusion-source {
  font-size: var(--text-xs);
  color: var(--text-tertiary);
  margin: 0;
}

/* Accessibility card */

.access-sections {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.access-section {
  display: grid;
  grid-template-columns: 1fr auto 30px;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
}
.access-section .progress { min-width: 80px; }
.access-label { color: var(--text-secondary); }
.access-score { color: var(--text-primary); font-variant-numeric: tabular-nums; text-align: right; }

.access-meta {
  border-top: 1px solid var(--border-subtle);
  padding-top: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.access-meta p { margin: 0 0 var(--space-1); }

.access-cities {
  font-size: var(--text-sm);
  color: var(--text-secondary);
}
.access-cities-title { font-weight: var(--weight-medium); margin: 0 0 var(--space-1); }
.access-cities ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
}

.access-assist {
  background: var(--bg-sunken);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
}
.access-assist p { margin: 0; }
.access-assist a { color: var(--accent-primary); text-decoration: underline; }
.access-lead { color: var(--text-tertiary); font-size: var(--text-xs); margin-top: 2px !important; }

/* Emergency card */

.emergency-numbers {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.emergency-universal {
  font-size: var(--text-base);
  color: var(--text-primary);
  background: var(--accent-soft, rgba(42,71,194,0.08));
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  margin: 0;
}
.emergency-universal a { color: var(--accent-primary); font-weight: var(--weight-bold); }
.emergency-local {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px var(--space-3);
  font-size: var(--text-sm);
}
.emergency-local dt { color: var(--text-secondary); }
.emergency-local dd { margin: 0; }
.emergency-local a { color: var(--accent-primary); font-weight: var(--weight-semibold); }

.emergency-phrases-title {
  font-weight: var(--weight-medium);
  margin: var(--space-2) 0 var(--space-1);
}
.emergency-phrases ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.phrase-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--text-sm);
  padding: var(--space-1) 0;
  border-bottom: 1px solid var(--border-subtle);
}
.phrase-user { color: var(--text-secondary); }
.phrase-local { color: var(--text-primary); font-weight: var(--weight-medium); }
.phrase-row .btn-sm {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
}

.emergency-embassy {
  background: var(--bg-sunken);
  padding: var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  margin: var(--space-2) 0 0;
}

/* Phrase show modal — full-screen readable tile */

.phrase-modal-overlay {
  align-items: center;
  justify-content: center;
}
.modal-phrase {
  max-width: 90vw;
  max-height: 80vh;
  padding: var(--space-6);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.modal-phrase .phrase-text {
  font-size: 2.5rem;
  font-weight: var(--weight-bold);
  color: var(--text-primary);
  text-align: center;
  margin: 0;
  line-height: 1.3;
}
.modal-phrase .btn {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  font-size: var(--text-2xl);
  padding: var(--space-1) var(--space-2);
}

/* Missing data fallback card */

.inclusion-missing {
  text-align: center;
  color: var(--text-tertiary);
  font-size: var(--text-sm);
  padding: var(--space-4);
}
```

- [ ] **Step 2: Commit**

```bash
git add css/components.css
git commit -m "style(inclusion): card styles, progress bars, phrase modal"
```

---

## Task 15: Create `js/ui/welcome-wizard.js` — shell + Question 1

**Files:**
- Create: `js/ui/welcome-wizard.js`

- [ ] **Step 1: Write the module shell**

Create `js/ui/welcome-wizard.js`:

```js
// js/ui/welcome-wizard.js
// First-visit 4-step onboarding modal. Reuses the existing .modal-overlay
// pattern from wrapped.js. Answers feed state.user + state.filters; the
// priorities step delegates to inclusion.js for the Fewer-opportunities
// preset logic (single source of truth).

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, on } from '../utils/dom.js';
import { activateFewerOpportunitiesMode } from './inclusion.js';

const STEP_COUNT = 4;

// Transient state held in the module while the wizard is open.
let answers = {
  homeCountry: null,
  groupSize: null,
  budget: null,
  priorities: new Set()
};
let currentStep = 0;
let overlayEl = null;

export function shouldShowWizard() {
  return state.getSlice('user')?.onboarded !== true;
}

export function openWizard() {
  currentStep = 0;
  answers = { homeCountry: null, groupSize: null, budget: null, priorities: new Set() };
  // Pre-fill the home country guess from browser locale.
  const guess = (navigator.language || 'en').split('-')[1]?.toUpperCase() || 'TR';
  answers.homeCountry = guess;

  overlayEl = h('div', { class: 'modal-overlay wizard-overlay', 'data-modal': 'wizard' }, [
    h('div', { class: 'modal wizard-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'wizard-title' }, [
      h('header', { class: 'wizard-header' }, [
        h('h3', { id: 'wizard-title', class: 'wizard-title' }, t('wizard.title')),
        h('button', {
          class: 'modal-close',
          type: 'button',
          'aria-label': t('modal.close'),
          'data-action': 'wizard-skip'
        }, '×')
      ]),
      h('div', { class: 'wizard-progress', role: 'progressbar',
                 'aria-valuenow': '1', 'aria-valuemin': '1', 'aria-valuemax': String(STEP_COUNT) }, [
        ...Array.from({ length: STEP_COUNT }, (_, i) => h('span', { class: 'wizard-dot' + (i === 0 ? ' is-active' : '') }))
      ]),
      h('div', { class: 'wizard-body' }),
      h('footer', { class: 'wizard-footer' }, [
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-action': 'wizard-skip' }, t('wizard.skip')),
        h('div', { class: 'wizard-spacer' }),
        h('button', { class: 'btn btn-ghost', type: 'button', 'data-action': 'wizard-prev' }, t('wizard.prev')),
        h('button', { class: 'btn btn-primary', type: 'button', 'data-action': 'wizard-next' }, t('wizard.next'))
      ])
    ])
  ]);

  document.body.appendChild(overlayEl);
  wireActions();
  renderStep();
}

function wireActions() {
  on(overlayEl, 'click', '[data-action="wizard-skip"]', finishSkip);
  on(overlayEl, 'click', '[data-action="wizard-prev"]', prevStep);
  on(overlayEl, 'click', '[data-action="wizard-next"]', nextStep);
  on(overlayEl, 'click', '[data-action="wizard-country"]', (_ev, target) => {
    answers.homeCountry = target.value || target.dataset.country;
  });
  on(overlayEl, 'change', 'select[data-action="wizard-country-select"]', (ev) => {
    answers.homeCountry = ev.target.value;
  });
  on(overlayEl, 'click', '[data-action="wizard-group"]', (_ev, target) => {
    answers.groupSize = Number(target.dataset.size);
    renderStep();
  });
  on(overlayEl, 'click', '[data-action="wizard-budget"]', (_ev, target) => {
    answers.budget = target.dataset.budget;
    renderStep();
  });
  on(overlayEl, 'click', '[data-action="wizard-priority"]', (_ev, target) => {
    const p = target.dataset.priority;
    if (answers.priorities.has(p)) answers.priorities.delete(p);
    else answers.priorities.add(p);
    renderStep();
  });
  document.addEventListener('keydown', escListener);
}

function escListener(ev) {
  if (ev.key === 'Escape') finishSkip();
}

function renderStep() {
  if (!overlayEl) return;
  const body = overlayEl.querySelector('.wizard-body');
  if (!body) return;
  body.innerHTML = '';
  body.appendChild(renderQuestion(currentStep));

  // Update dots
  overlayEl.querySelectorAll('.wizard-dot').forEach((dot, i) => {
    dot.classList.toggle('is-active', i === currentStep);
  });
  overlayEl.querySelector('.wizard-progress').setAttribute('aria-valuenow', String(currentStep + 1));

  // Footer buttons
  const prevBtn = overlayEl.querySelector('[data-action="wizard-prev"]');
  const nextBtn = overlayEl.querySelector('[data-action="wizard-next"]');
  prevBtn.disabled = currentStep === 0;
  nextBtn.textContent = currentStep === STEP_COUNT - 1 ? t('wizard.finish') : t('wizard.next');
}

function renderQuestion(stepIndex) {
  switch (stepIndex) {
    case 0: return renderQ1HomeCountry();
    // Cases 1-3 filled in Task 16.
    default: return h('div', null, 'TODO');
  }
}

function renderQ1HomeCountry() {
  // Use the existing countries slice to build a <select>.
  const countries = state.getSlice('countries') || [];
  const options = [{ id: 'TR', name: 'Türkiye' }, ...countries]
    .reduce((map, c) => (map[c.id] = c.name, map), {});

  return h('div', { class: 'wizard-step' }, [
    h('h4', null, t('wizard.q1.title')),
    h('p',  { class: 'wizard-help' }, t('wizard.q1.help')),
    h('select', {
      class: 'input',
      'data-action': 'wizard-country-select',
      'aria-label': t('wizard.q1.title')
    }, Object.entries(options).map(([id, name]) => h('option', {
      value: id,
      ...(answers.homeCountry === id ? { selected: '' } : {})
    }, `${name} (${id})`)))
  ]);
}

function nextStep() {
  if (currentStep < STEP_COUNT - 1) {
    currentStep++;
    renderStep();
  } else {
    finish();
  }
}

function prevStep() {
  if (currentStep > 0) {
    currentStep--;
    renderStep();
  }
}

function finish() {
  // Apply answers
  state.update('user', u => ({
    ...u,
    homeCountry: answers.homeCountry || u.homeCountry,
    groupSize:   answers.groupSize   || u.groupSize,
    budget:      answers.budget      || u.budget,
    onboarded:   true
  }));

  // Priorities → filters preset
  if (answers.priorities.has('accessible') || answers.priorities.has('lgbtq') || answers.priorities.has('lowBudget')) {
    activateFewerOpportunitiesMode();
  } else {
    if (answers.priorities.has('green')) {
      state.update('filters', f => ({ ...f, green: true }));
    }
  }

  closeWizard();
}

function finishSkip() {
  // Skip still marks onboarded so the wizard doesn't reappear on every visit.
  state.update('user', u => ({ ...u, onboarded: true }));
  closeWizard();
}

function closeWizard() {
  document.removeEventListener('keydown', escListener);
  overlayEl?.remove();
  overlayEl = null;
}
```

- [ ] **Step 2: Syntax check**

Run:
```bash
node --check js/ui/welcome-wizard.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/ui/welcome-wizard.js
git commit -m "feat(wizard): welcome wizard shell + Q1 home country"
```

---

## Task 16: Welcome wizard questions 2–4

**Files:**
- Modify: `js/ui/welcome-wizard.js` — replace the `renderQuestion` switch default and add three new functions

- [ ] **Step 1: Replace the renderQuestion switch**

Open `js/ui/welcome-wizard.js`. Replace:

```js
function renderQuestion(stepIndex) {
  switch (stepIndex) {
    case 0: return renderQ1HomeCountry();
    // Cases 1-3 filled in Task 16.
    default: return h('div', null, 'TODO');
  }
}
```

With:

```js
function renderQuestion(stepIndex) {
  switch (stepIndex) {
    case 0: return renderQ1HomeCountry();
    case 1: return renderQ2GroupSize();
    case 2: return renderQ3Budget();
    case 3: return renderQ4Priorities();
    default: return h('div', null, '?');
  }
}

function renderQ2GroupSize() {
  const sizes = [
    { value: 1, label: t('wizard.q2.solo') },
    { value: 2, label: t('wizard.q2.small') },
    { value: 4, label: t('wizard.q2.full') }
  ];
  return h('div', { class: 'wizard-step' }, [
    h('h4', null, t('wizard.q2.title')),
    h('p',  { class: 'wizard-help' }, t('wizard.q2.help')),
    h('div', { class: 'wizard-options', role: 'radiogroup', 'aria-label': t('wizard.q2.title') },
      sizes.map(s => h('button', {
        class: 'wizard-option' + (answers.groupSize === s.value ? ' is-active' : ''),
        type: 'button',
        role: 'radio',
        'aria-checked': answers.groupSize === s.value ? 'true' : 'false',
        'data-action': 'wizard-group',
        'data-size': String(s.value)
      }, s.label)))
  ]);
}

function renderQ3Budget() {
  const tiers = [
    { value: 'budget',   label: t('wizard.q3.low') },
    { value: 'moderate', label: t('wizard.q3.mid') },
    { value: 'comfort',  label: t('wizard.q3.high') }
  ];
  return h('div', { class: 'wizard-step' }, [
    h('h4', null, t('wizard.q3.title')),
    h('p',  { class: 'wizard-help' }, t('wizard.q3.help')),
    h('div', { class: 'wizard-options', role: 'radiogroup', 'aria-label': t('wizard.q3.title') },
      tiers.map(tier => h('button', {
        class: 'wizard-option' + (answers.budget === tier.value ? ' is-active' : ''),
        type: 'button',
        role: 'radio',
        'aria-checked': answers.budget === tier.value ? 'true' : 'false',
        'data-action': 'wizard-budget',
        'data-budget': tier.value
      }, tier.label)))
  ]);
}

function renderQ4Priorities() {
  const priorities = [
    { id: 'accessible', icon: '♿', label: t('wizard.q4.accessible') },
    { id: 'lgbtq',      icon: '🌈', label: t('wizard.q4.lgbtq') },
    { id: 'lowBudget',  icon: '💶', label: t('wizard.q4.lowBudget') },
    { id: 'green',      icon: '🌱', label: t('wizard.q4.green') },
    { id: 'cultural',   icon: '🏛️', label: t('wizard.q4.cultural') },
    { id: 'adventurous',icon: '🏔️', label: t('wizard.q4.adventurous') }
  ];
  return h('div', { class: 'wizard-step' }, [
    h('h4', null, t('wizard.q4.title')),
    h('p',  { class: 'wizard-help' }, t('wizard.q4.help')),
    h('div', { class: 'wizard-priorities' },
      priorities.map(p => h('button', {
        class: 'priority-chip' + (answers.priorities.has(p.id) ? ' is-active' : ''),
        type: 'button',
        'aria-pressed': answers.priorities.has(p.id) ? 'true' : 'false',
        'data-action': 'wizard-priority',
        'data-priority': p.id
      }, `${p.icon} ${p.label}`)))
  ]);
}
```

- [ ] **Step 2: Syntax check**

Run:
```bash
node --check js/ui/welcome-wizard.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/ui/welcome-wizard.js
git commit -m "feat(wizard): Q2 group size, Q3 budget, Q4 priorities"
```

---

## Task 17: Wire wizard auto-trigger + header `⚙️` re-open button

**Files:**
- Modify: `js/main.js` (auto-trigger)
- Modify: `index.html` (settings button)

- [ ] **Step 1: Auto-trigger after bootstrap**

Open `js/main.js`. Find the section near the end of `boot()` that hides the loading shell:

```js
    // 8. Hide loading shell
    const loader = qs('#appLoading');
    if (loader) {
      loader.setAttribute('data-hidden', 'true');
      setTimeout(() => loader.remove(), 400);
    }

    console.info('[DiscoverEU Companion] ready');
```

Replace with:

```js
    // 8. Hide loading shell
    const loader = qs('#appLoading');
    if (loader) {
      loader.setAttribute('data-hidden', 'true');
      setTimeout(() => loader.remove(), 400);
    }

    // 9. First-visit welcome wizard
    const { shouldShowWizard, openWizard } = await import('./ui/welcome-wizard.js');
    if (shouldShowWizard()) {
      // Delay a beat so the loading shell has finished fading out first.
      setTimeout(openWizard, 500);
    }

    // 10. Wire the header settings button to re-open the wizard on demand
    const settingsBtn = qs('#btnSettings');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => openWizard());
    }

    console.info('[DiscoverEU Companion] ready');
```

- [ ] **Step 2: Add the settings button to the header**

Open `index.html`. Find the header actions region (near `#btnShare`). Before the closing of that region, add:

```html
      <button id="btnSettings" class="btn-icon" type="button"
              aria-label="Settings — re-open the welcome wizard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
      </button>
```

- [ ] **Step 3: Syntax check**

Run:
```bash
node --check js/main.js
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add js/main.js index.html
git commit -m "feat(wizard): auto-open on first visit, settings button to re-open"
```

---

## Task 18: Welcome wizard CSS

**Files:**
- Modify: `css/components.css`

- [ ] **Step 1: Append wizard styles to the end of `components.css`**

At the bottom of `css/components.css`, append:

```css
/* ─── Welcome wizard ─────────────────────────────────────────────────── */

.wizard-overlay {
  align-items: center;
  justify-content: center;
}

.wizard-modal {
  max-width: 480px;
  width: 92vw;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.wizard-header {
  display: flex;
  align-items: center;
  padding: var(--space-4) var(--space-5) var(--space-2);
}
.wizard-title {
  flex: 1 1 auto;
  margin: 0;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
}
.wizard-header .modal-close {
  background: none;
  border: none;
  font-size: var(--text-2xl);
  color: var(--text-secondary);
  cursor: pointer;
  line-height: 1;
}

.wizard-progress {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-5) var(--space-3);
}
.wizard-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-subtle);
  transition: background var(--duration-fast);
}
.wizard-dot.is-active {
  background: var(--accent-primary);
}

.wizard-body {
  padding: var(--space-4) var(--space-5);
  min-height: 220px;
}

.wizard-step {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.wizard-step h4 {
  margin: 0;
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
}
.wizard-step .wizard-help {
  color: var(--text-secondary);
  font-size: var(--text-sm);
  margin: 0;
}
.wizard-step .input {
  width: 100%;
}

.wizard-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-2);
}
.wizard-option {
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-default);
  color: var(--text-primary);
  font-size: var(--text-base);
  font-weight: var(--weight-medium);
  cursor: pointer;
  text-align: center;
}
.wizard-option.is-active {
  background: var(--accent-primary);
  color: var(--bg-default);
  border-color: var(--accent-primary);
}

.wizard-priorities {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.priority-chip {
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  background: var(--bg-default);
  color: var(--text-primary);
  font-size: var(--text-sm);
  cursor: pointer;
}
.priority-chip.is-active {
  background: var(--accent-primary);
  color: var(--bg-default);
  border-color: var(--accent-primary);
}

.wizard-footer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5);
  border-top: 1px solid var(--border-subtle);
}
.wizard-footer .wizard-spacer {
  flex: 1 1 auto;
}
.wizard-footer .btn-ghost[data-action="wizard-prev"]:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Commit**

```bash
git add css/components.css
git commit -m "style(wizard): welcome wizard modal, progress dots, option chips"
```

---

## Task 19: i18n blocks for inclusion + emergency + wizard

**Files:**
- Modify: `i18n/en.json`
- Modify: `i18n/tr.json`

- [ ] **Step 1: Add the new blocks to `en.json`**

Open `i18n/en.json`. Add the following top-level keys (next to existing blocks like `panel`, `detail`, `route`, `prep`):

```json
"inclusion": {
  "title": "Inclusion",
  "subtitle": "Accessibility, LGBTQ+ safety, and emergency information for all 36 countries.",
  "source": "Source",
  "fewerOppsEnabled": "Filtered for youth with fewer opportunities — low budget, accessible, LGBTQ+ safe.",
  "summary": {
    "rainbowTitle": "Europe Rainbow Index",
    "rainbowCaption": "Average ILGA score across {total} countries. {marriage} recognise full marriage equality, {selfdet} have self-determination gender laws.",
    "accessTitle": "Accessible infrastructure",
    "accessStations": "{n} / {total} countries offer step-free access at all major train stations.",
    "accessDiscCard": "EU Disability Card accepted in {n} countries.",
    "mapModesTitle": "Map modes",
    "fewerOppsTitle": "Fewer-opportunities mode",
    "fewerOppsDesc": "Filter the map by Erasmus+ Inclusion Action criteria.",
    "fewerOppsCta": "Activate",
    "pickCountryHint": "Pick a country on the map for the full breakdown."
  },
  "mode": {
    "default": "Default",
    "rainbow": "Rainbow",
    "accessibility": "Accessibility"
  },
  "country": {
    "subtitle": "Rainbow rubric, accessibility breakdown, and emergency info.",
    "notFound": "Country not found."
  },
  "rainbow": {
    "cat": {
      "equality":          "Equality",
      "family":            "Family",
      "hateCrime":         "Hate crime",
      "legalGenderRecog":  "Gender recognition",
      "intersexIntegrity": "Intersex integrity",
      "civilSociety":      "Civil society",
      "asylum":            "Asylum"
    },
    "keyItem": {
      "marriageEquality":        "Marriage equality",
      "jointAdoption":           "Joint adoption",
      "constitutionalBan":       "Constitutional non-discrimination",
      "employmentProtection":    "Employment protection",
      "selfDeterminationGender": "Self-determination gender law",
      "banOnIntersexSurgery":    "Ban on intersex surgery",
      "banOnConversionTherapy":  "Ban on conversion therapy",
      "hateCrimeLawSO":          "Hate crime law (SO)",
      "hateCrimeLawGI":          "Hate crime law (GI)"
    }
  },
  "access": {
    "title": "Accessibility",
    "section": {
      "publicTransport": "Public transport",
      "trainStations":   "Train stations",
      "accommodation":   "Accommodation",
      "attractions":     "Attractions"
    },
    "euCardYes": "EU Disability Card accepted",
    "euCardNo":  "EU Disability Card not yet accepted",
    "nationalCard": "National card",
    "discount": "Typical discount",
    "topCities": "Accessible venues (Wheelmap)",
    "assistanceBooking": "Train assistance booking",
    "leadTimeHours": "Book {n} hours ahead"
  },
  "emergency": {
    "title": "Emergency",
    "eu": "EU emergency number",
    "police": "Police",
    "ambulance": "Ambulance",
    "fire": "Fire",
    "phrasesTitle": "Basic phrases"
  },
  "missing": {
    "rainbow":       "Rainbow data is not yet compiled for this country — contribute on GitHub.",
    "accessibility": "Accessibility data is not yet compiled for this country — contribute on GitHub.",
    "emergency":     "Emergency data is not yet compiled for this country — contribute on GitHub."
  }
},
"wizard": {
  "title": "Welcome!",
  "skip": "Skip for now",
  "prev": "Back",
  "next": "Next",
  "finish": "Finish",
  "q1": {
    "title": "Where are you from?",
    "help":  "We use this to unlock country-specific tips (Schengen visa, Sofia Express, and more)."
  },
  "q2": {
    "title": "How many of you?",
    "help":  "DiscoverEU allows groups of up to 4 applicants.",
    "solo":  "1 — solo",
    "small": "2-3 — friends",
    "full":  "4 — full group"
  },
  "q3": {
    "title": "Budget style?",
    "help":  "This sets defaults in the Budget tab.",
    "low":   "Budget",
    "mid":   "Moderate",
    "high":  "Comfort"
  },
  "q4": {
    "title": "What matters most?",
    "help":  "Pick any that apply — the map adapts to your priorities.",
    "accessible":  "Accessible",
    "lgbtq":       "LGBTQ+ safe",
    "lowBudget":   "Low budget",
    "green":       "Sustainable",
    "cultural":    "Cultural",
    "adventurous": "Adventurous"
  }
}
```

Insert before the existing `panel` block or wherever top-level keys are grouped. Preserve trailing commas correctly.

- [ ] **Step 2: Add the same blocks to `tr.json`**

Open `i18n/tr.json`. Add the mirrored Turkish blocks:

```json
"inclusion": {
  "title": "Kapsayıcılık",
  "subtitle": "36 ülke için erişilebilirlik, LGBTQ+ güvenliği ve acil durum bilgisi.",
  "source": "Kaynak",
  "fewerOppsEnabled": "Daha az fırsata sahip gençler için süzüldü — düşük bütçe, erişilebilir, LGBTQ+ güvenli.",
  "summary": {
    "rainbowTitle": "Avrupa Rainbow Endeksi",
    "rainbowCaption": "{total} ülke genelinde ortalama ILGA skoru. {marriage} ülke tam evlilik eşitliğini, {selfdet} ülke kendi kaderini tayin yasasını tanıyor.",
    "accessTitle": "Erişilebilir altyapı",
    "accessStations": "{n} / {total} ülkenin ana tren istasyonları engelsiz erişim sunuyor.",
    "accessDiscCard": "EU Disability Card {n} ülkede geçerli.",
    "mapModesTitle": "Harita modları",
    "fewerOppsTitle": "Düşük eşik modu",
    "fewerOppsDesc": "Erasmus+ Inclusion Action kriterleriyle haritayı süzer.",
    "fewerOppsCta": "Etkinleştir",
    "pickCountryHint": "Tam dökümü görmek için haritadan bir ülke seç."
  },
  "mode": {
    "default": "Varsayılan",
    "rainbow": "Rainbow",
    "accessibility": "Erişim"
  },
  "country": {
    "subtitle": "Rainbow rubric, erişilebilirlik kırılımı ve acil durum bilgisi.",
    "notFound": "Ülke bulunamadı."
  },
  "rainbow": {
    "cat": {
      "equality":          "Eşitlik",
      "family":            "Aile",
      "hateCrime":         "Nefret suçu",
      "legalGenderRecog":  "Cinsiyet tanıma",
      "intersexIntegrity": "İnterseks bütünlüğü",
      "civilSociety":      "Sivil toplum",
      "asylum":            "İltica"
    },
    "keyItem": {
      "marriageEquality":        "Evlilik eşitliği",
      "jointAdoption":           "Ortak evlat edinme",
      "constitutionalBan":       "Anayasal ayrımcılık yasağı",
      "employmentProtection":    "İstihdamda koruma",
      "selfDeterminationGender": "Kendi kaderini tayin yasası",
      "banOnIntersexSurgery":    "İnterseks ameliyat yasağı",
      "banOnConversionTherapy":  "Dönüştürme terapisi yasağı",
      "hateCrimeLawSO":          "Nefret suçu yasası (cinsel yönelim)",
      "hateCrimeLawGI":          "Nefret suçu yasası (cinsiyet kimliği)"
    }
  },
  "access": {
    "title": "Erişilebilirlik",
    "section": {
      "publicTransport": "Toplu ulaşım",
      "trainStations":   "Tren istasyonları",
      "accommodation":   "Konaklama",
      "attractions":     "Turistik yerler"
    },
    "euCardYes": "EU Disability Card kabul ediliyor",
    "euCardNo":  "EU Disability Card henüz kabul edilmiyor",
    "nationalCard": "Yerel kart",
    "discount": "Tipik indirim",
    "topCities": "Erişilebilir mekan sayısı (Wheelmap)",
    "assistanceBooking": "Tren yardım bookingu",
    "leadTimeHours": "{n} saat önceden rezervasyon yap"
  },
  "emergency": {
    "title": "Acil durum",
    "eu": "EU acil numarası",
    "police": "Polis",
    "ambulance": "Ambulans",
    "fire": "İtfaiye",
    "phrasesTitle": "Temel ifadeler"
  },
  "missing": {
    "rainbow":       "Bu ülke için Rainbow verisi henüz derlenmedi — GitHub'da katkıda bulun.",
    "accessibility": "Bu ülke için erişilebilirlik verisi henüz derlenmedi — GitHub'da katkıda bulun.",
    "emergency":     "Bu ülke için acil durum verisi henüz derlenmedi — GitHub'da katkıda bulun."
  }
},
"wizard": {
  "title": "Hoş geldin!",
  "skip": "Şimdilik geç",
  "prev": "Geri",
  "next": "İleri",
  "finish": "Bitir",
  "q1": {
    "title": "Nereden geliyorsun?",
    "help":  "Ülkeye özgü ipuçlarını (Schengen vizesi, Sofia Express, vb.) açmak için kullanıyoruz."
  },
  "q2": {
    "title": "Kaç kişisiniz?",
    "help":  "DiscoverEU 4 kişiye kadar gruplara izin veriyor.",
    "solo":  "1 — tek başıma",
    "small": "2-3 — arkadaşlarla",
    "full":  "4 — tam grup"
  },
  "q3": {
    "title": "Bütçe stilin?",
    "help":  "Bütçe sekmesindeki varsayılanları ayarlar.",
    "low":   "Ekonomik",
    "mid":   "Orta",
    "high":  "Konforlu"
  },
  "q4": {
    "title": "Öncelikli ne?",
    "help":  "Uygun olanları seç — harita tercihlerine göre ayarlanır.",
    "accessible":  "Erişilebilir",
    "lgbtq":       "LGBTQ+ güvenli",
    "lowBudget":   "Düşük bütçe",
    "green":       "Sürdürülebilir",
    "cultural":    "Kültür",
    "adventurous": "Macera"
  }
}
```

- [ ] **Step 3: Validate both parse**

Run:
```bash
python -c "import json; [json.load(open(f, encoding='utf-8')) for f in ['i18n/en.json','i18n/tr.json']]; print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add i18n/en.json i18n/tr.json
git commit -m "i18n: inclusion, emergency, wizard blocks (EN + TR)"
```

---

## Task 20: Service worker cache manifest update

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump cache version and add new entries**

Open `sw.js`. Find the constant that names the cache bucket (e.g. `const CACHE = 'discovereu-v2';` from the earlier session log) and the array of precached paths.

Increment the version to `v3`:
```js
const CACHE = 'discovereu-v3';
```

Add the following entries to the precache list:
```js
  '/data/rainbow-map.json',
  '/data/accessibility.json',
  '/data/emergency-phrases.json',
  '/js/features/inclusion-data.js',
  '/js/map/inclusion-layer.js',
  '/js/ui/inclusion.js',
  '/js/ui/welcome-wizard.js',
```

- [ ] **Step 2: Syntax check**

Run:
```bash
node --check sw.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "pwa: bump cache to v3, precache Tier 3 inclusion assets"
```

---

## Task 21: Smoke tests T1–T13

This task runs the full smoke-test matrix from the spec. Each test is a Playwright MCP evaluation against a fresh browser session. Record pass / fail for each. Do not commit anything until every test passes — fix-forward in the preceding task's commit if a regression appears.

- [ ] **Step 1: Prepare the browser**

Unlock any stale browser profile, navigate to `http://localhost:8765/index.html?bust=tests`, then clear the service worker + caches:

```js
async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();
  if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
  localStorage.clear();  // also reset user.onboarded for T11/T12
  return 'cleared';
}
```

Then re-navigate to `http://localhost:8765/index.html?bust=tests2`.

- [ ] **Step 2: Run each test and record the result**

For each of the following, run the described action and verify the expected outcome. Any failure means: fix the corresponding task's commit before continuing.

- **T1 — Cold load renders 7-tab bar:** After navigation, take a screenshot of `.panel-tabs`. Expect 7 buttons, equal width, no clipping.
- **T2 — Inclusion tab opens without freeze:** Click the Inclusion tab (ref from snapshot). Expect the summary view to render with 4 cards. `elapsed_ms` via `performance.now()` difference ≤ 500 ms.
- **T3 — Rainbow mode colours polygons:** Click the "Rainbow" mode chip. Expect `state.inclusionMode === 'rainbow'` and at least 20 polygons to have `fill-opacity > 0`.
- **T4 — Country view renders three cards:** Click Germany polygon on the map, then click the Inclusion tab. Expect Rainbow + Accessibility + Emergency cards visible.
- **T5 — Fewer-opps preset fires:** Click "Etkinleştir" button. Expect toast, `state.filters.budget === 'low'`, `state.filters.accessibility === true`, `state.panelTab === 'filters'`.
- **T6 — Dark mode readable:** Toggle theme. Expect gradient colours on any filled polygon change (re-read `getComputedStyle` of `--inclusion-grad-0`).
- **T7 — Language switch:** Change language to EN then back to TR. Expect Inclusion tab re-renders without freeze.
- **T8 — Phrase show modal:** In country view, click 📱 on any phrase. Expect `.phrase-modal-overlay` to appear; press Escape; expect it to be gone.
- **T9 — Rapid mode toggles (loop regression):** Click mode chips 10 times in a loop. Expect `elapsed_ms < 500`.
- **T10 — Responsive clipping:** Resize viewport to 375×812, then to 1440×900. At each size take `.panel-tabs` screenshot and verify no clipping.
- **T11 — Wizard first visit:** With `localStorage.clear()` applied, reload. Expect the wizard overlay to appear within 1 second.
- **T12 — Wizard Skip:** Click Skip. Expect `state.getSlice('user').onboarded === true` and the overlay removed.
- **T13 — Wizard priorities trigger fewer-opps:** Clear onboarded flag, reopen wizard via settings gear, click through to step 4, toggle "Accessible" + "LGBTQ+ safe", click Finish. Expect toast, filters updated, panelTab set to filters.

- [ ] **Step 3: Document the results**

If all tests pass, create a short file `docs/superpowers/plans/2026-04-11-tier3-smoke-test-log.md` with:

```markdown
# Tier 3 Smoke Test Log — 2026-04-11

All 13 smoke tests passed against commit <sha>.

| # | Test                                    | Result | Notes |
|---|-----------------------------------------|--------|-------|
| T1  | Cold load 7-tab bar                     | PASS |       |
| T2  | Inclusion tab opens no freeze           | PASS |       |
| T3  | Rainbow mode colours polygons           | PASS |       |
| T4  | Country view three cards                | PASS |       |
| T5  | Fewer-opps preset fires                 | PASS |       |
| T6  | Dark mode readable                      | PASS |       |
| T7  | Language switch no freeze               | PASS |       |
| T8  | Phrase show modal opens/closes          | PASS |       |
| T9  | Rapid mode toggles no loop              | PASS |       |
| T10 | Responsive tab bar clipping             | PASS |       |
| T11 | Wizard first visit                      | PASS |       |
| T12 | Wizard Skip sets onboarded              | PASS |       |
| T13 | Wizard priorities fewer-opps            | PASS |       |
```

- [ ] **Step 4: Commit the test log**

```bash
git add docs/superpowers/plans/2026-04-11-tier3-smoke-test-log.md
git commit -m "test: Tier 3 smoke test log — all 13 scenarios pass"
```

---

## Task 22: Update `PROGRESS.md`, push to origin

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Update the Tier 3 checklist and Done list**

Open `PROGRESS.md`. Replace:

```markdown
**Last updated:** 2026-04-10 (session 6 — Wrapped card, PDF export, Turkish bonus layer, housekeeping + first real push)
**Phase:** 2 (Tier 2 complete; Tier 5 Turkish bonus landed early alongside the Prep tab)
```

With:

```markdown
**Last updated:** 2026-04-11 (session 7 — Tier 3 Inclusion Pack: Rainbow Map, Wheelmap accessibility, emergency phrases, Fewer-opportunities mode, Welcome Wizard, 7-tab bar redesign)
**Phase:** 3 (Tier 3 sub-project 1 complete; sub-projects 2 & 3 remain)
```

Find the Tier 3 section:
```markdown
### Tier 3 — Inclusion *(Days 9-10)*
- [ ] Wheelmap accessibility filter
- [ ] ILGA Rainbow Map LGBTQ+ safety layer
- [ ] DE / FR / ES / IT translations
- [ ] Low-budget "fewer opportunities" mode
- [ ] Emergency info panel (offline, per country)
```

Replace with:
```markdown
### Tier 3 — Inclusion *(Days 9-10)*
- [x] **Wheelmap accessibility layer** — map colour mode + country breakdown card + station assistance + EU Disability Card meta
- [x] **ILGA Rainbow Map LGBTQ+ safety layer** — full 7-category rubric + key items + map colour mode
- [x] **Low-budget "fewer opportunities" mode** — single-click preset, single source of truth shared between Inclusion tab and Welcome Wizard
- [x] **Emergency info panel** — EU 112 + local numbers + per-country phrase pack + "show on phone" modal
- [x] **Welcome Wizard** — first-visit 4-question onboarding, feeds answers into state.user + state.filters
- [x] **7-tab bar redesign** — icon + label layout, scales beyond 6 tabs, mobile bottom-nav mirrored
- [ ] DE / FR / ES / IT translations  ← sub-project 3 (separate spec)
```

Then in the "Done" section append a session 7 snapshot block with the key bullet points from this sprint:

```markdown
- **Session 7 — Tier 3 Inclusion sub-project 1** (2026-04-11):
  - 3 new data files: `rainbow-map.json`, `accessibility.json`, `emergency-phrases.json` (~140 KB total)
  - `js/features/inclusion-data.js` pluggable adapter (Phase-2-ready signatures)
  - `js/map/inclusion-layer.js` polygon fill recolouring reactive to `state.inclusionMode`
  - `js/ui/inclusion.js` summary + country views, mode chips, fewer-opps preset export
  - `js/ui/welcome-wizard.js` 4-question first-visit onboarding
  - Tab bar redesign from text-only to icon + label layout, 6 → 7 tabs (mobile bottom-nav mirrored)
  - All 13 smoke tests pass
```

- [ ] **Step 2: Push everything to origin**

```bash
git add PROGRESS.md
git commit -m "docs: session 7 snapshot — Tier 3 inclusion sub-project 1 complete"
git push origin main
```

Verify the GitHub Pages legacy deploy tries to build:
```bash
gh run list --repo embeddedJedi/discovereu-companion --limit 3
```
Expect the most recent `pages-build-deployment` to be `in_progress` or `success`.

- [ ] **Step 3: Sanity-check the live URL**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://embeddedjedi.github.io/discovereu-companion/
curl -s -o /dev/null -w "%{http_code}\n" https://embeddedjedi.github.io/discovereu-companion/data/rainbow-map.json
curl -s -o /dev/null -w "%{http_code}\n" https://embeddedjedi.github.io/discovereu-companion/js/ui/inclusion.js
```

All three MUST return `200` before this task is considered done.

---

## Self-review checklist

1. **Spec coverage:** Every requirement in the spec maps to a task — data (T1-3), adapter (T4), state (T5), tab bar (T6-8), map layer (T9-11), tab content (T12-13), card CSS (T14), wizard (T15-19), service worker (T20), tests (T21), progress (T22). Fewer-opportunities preset is centralised in `js/ui/inclusion.js` exported from T12 and called by both T12 (summary card button) and T15 (wizard finish). Welcome wizard section 6.5 of the spec is covered by tasks T15-19. The 13 smoke tests are covered by T21.
2. **Placeholder scan:** No `TBD` / `TODO` / `implement later` appears outside literal code strings. Every file has complete content or explicit reference to authoritative source material. The data tasks (T1-3) delegate row-level values to `research-scout` + `data-curator` but provide the full schema plus an example entry for each file — that's research, not a placeholder.
3. **Type consistency:** `activateFewerOpportunitiesMode` is declared in T12 and imported in T15; `shouldShowWizard` / `openWizard` are declared in T15 and imported in T17; `initInclusionLayer(layer)` signature in T10 matches the call site in T11; `ensureInclusionData` promise contract is identical across T4 (adapter) and T10 (map layer) and T12 (tab). `inclusionLayerValue(countryId, mode)` returns `null | 0..1` consistently between T4 and T10.
