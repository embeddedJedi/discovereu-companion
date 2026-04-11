# Tier 3 Inclusion — Sub-project 1: Data & Map Layers

**Status:** Draft for approval
**Author:** DiscoverEU Companion team (brainstormed 2026-04-11)
**Target release:** Before 2026-04-22 (EACEA launch deadline)
**Sub-project:** 1 of 3 in the Tier 3 Inclusion Pack

---

## 1. Context

The DiscoverEU Companion is a vanilla JS, no-build, single-page web app that helps 18-year-olds plan their DiscoverEU trip across 33 European countries plus Western Balkans + Turkey. The north star is *EACEA / DG EAC Youth Unit amplification*; the positioning is *"accessible, green, and inclusive — lowering the threshold for participation."*

Tier 1 (MVP) and Tier 2 (viral & amplification) are already shipped and live on GitHub Pages at `https://embeddedjedi.github.io/discovereu-companion/`. The app now has a 36-country interactive map, country detail panel, drag-drop route builder, budget calculator, radar-chart comparison, Wrapped shareable card, PDF export, Turkish bonus layer, CO₂ calculator, and PWA offline mode.

Tier 3 is the Inclusion Pack — the most direct expression of the EACEA narrative. It was originally scoped as a single list of five items (Wheelmap, ILGA Rainbow Map, DE/FR/ES/IT translations, emergency info, fewer-opportunities mode). During brainstorming the user chose to decompose it into three sub-projects:

- **Sub-project 1 — Data & Map Layers** *(this spec)*: Wheelmap + Rainbow Map + Emergency info + Fewer-opportunities mode, including the data snapshots, map visualisation, a new dedicated `Kapsayıcılık` ("Inclusion") tab, and a **minimal first-visit Welcome Wizard** that connects onboarding answers to the Fewer-opportunities preset
- **Sub-project 2 — UI Panels** *(future spec)*: any additional UI work that surfaces after shipping sub-project 1 (for example the Night Arrival Shield or Pickpocket heatmap, depending on reprioritisation)
- **Sub-project 3 — Localisation** *(future spec)*: DE / FR / ES / IT translation passes
- **Future sub-spec — Personalisation Wizard** *(separate, post-Tier-3)*: deeper contextual questions (passive, surfaced at natural moments like "adding the 3rd stop to a route" or "opening the Wrapped card for the first time"), granular preference capture, saved profiles, and settings management. Out of scope for this spec; noted here so the minimal welcome wizard shipped in this spec is understood as Phase 1 of a larger personalisation story.

This spec covers sub-project 1 only.

## 2. Goals

1. Make inclusion the **first thing** an EACEA reviewer sees when they open the side panel — dedicated tab, rich content, not buried inside country Detail cards.
2. Deliver **data depth**: the full ILGA Rainbow Europe 2025 rubric (7 categories + 9 key flag items) and Wheelmap-derived accessibility data for all 36 countries, not a single aggregate score.
3. Work **offline** end-to-end: every piece of inclusion data must be cacheable by the existing service worker and usable on a train without signal. Live API integration is explicitly deferred to a Phase 2 spec.
4. Introduce a **scalable tab bar architecture** that can grow to 7–8 tabs without reintroducing the clipping bug fixed in commit `ea7b67e`. Mobile bottom-nav is synchronised in the same change.
5. Ship a **Fewer-opportunities mode** preset that expresses the EU Youth Strategy *"for youth with fewer opportunities"* language as a concrete, single-click filter combination.

## 3. Non-goals

- Live Wheelmap / OpenStreetMap API integration → Phase 2 spec
- DE / FR / ES / IT translations → sub-project 3
- City-level accessibility data (the app is country-centric)
- Real-time ILGA score refresh (the Rainbow Europe report is annual)
- A new CMS / admin UI for data entry — JSON files are hand-edited by data-curator agent runs
- Any backend service — everything is static files + client JS

## 4. Architecture

### 4.1 Data flow

```
                      ┌──────────────────────────────┐
                      │   data/rainbow-map.json      │
                      │   data/accessibility.json    │
                      │   data/emergency-phrases.json│   ← 3 new static data files
                      └──────────────┬───────────────┘
                                     │ loadJson() via data/loader.js
                                     ▼
                      ┌──────────────────────────────┐
                      │ js/features/inclusion-data.js│   ← NEW — pluggable adapter
                      │  getRainbowData(id)          │
                      │  getAccessibilityData(id)    │
                      │  getEmergencyInfo(id, lang)  │
                      │  inclusionLayerValue(id,mode)│
                      └──────────────┬───────────────┘
                                     │
                ┌────────────────────┼─────────────────────┐
                ▼                    ▼                     ▼
       ┌─────────────────┐  ┌───────────────────┐  ┌──────────────────┐
       │ map/inclusion-  │  │ ui/inclusion.js   │  │ ui/filters-ui.js │
       │ layer.js (NEW)  │  │ (NEW — tab)       │  │ (small changes)  │
       │ polygon recolour│  │ summary + country │  │ Fewer-opps hooks │
       └─────────────────┘  └───────────────────┘  └──────────────────┘
                ▲                    ▲
                │                    │
                └── state.inclusionMode
                     'default' | 'rainbow' | 'accessibility'
```

### 4.2 Phased rollout — Phase 1 (this spec) vs Phase 2 (future)

| Concern | Phase 1 (this spec) | Phase 2 (future) |
|---|---|---|
| Rainbow Map source | Static JSON snapshot from ILGA 2025 report | Remains static — no public API |
| Accessibility source | Static JSON from Wheelmap snapshot + EU policy docs | Optional live overlay from Wheelmap REST API via user toggle |
| Adapter API (`inclusion-data.js`) | Reads from static caches | Same signatures; can layer live responses on top |
| Offline behaviour | Fully offline | Must degrade gracefully to Phase 1 cache when offline |
| User-facing control | Automatic | Settings toggle: "Use live Wheelmap data" |

The `inclusion-data.js` adapter is designed so that upgrading to Phase 2 is a single-file change — consumer modules (`inclusion-layer.js`, `ui/inclusion.js`) do not know where their data comes from.

## 5. Data schemas

All three files share the same envelope: `version` + `generated` + `note` + `source(s)` + data array/map. This matches the pattern set by `data/trains.json` and `data/turkish-bonus.json`.

### 5.1 `data/rainbow-map.json`

Source: ILGA-Europe *Rainbow Europe 2025* annual report. Seven weighted categories totalling 100%.

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
  "countries": [
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
  ]
}
```

### 5.2 `data/accessibility.json`

Source: Wheelmap.org public snapshot (OSM derivative) + EU Disability Card programme + Eurostat 2024 Accessibility Index + national railway accessibility services (DB Barrierefrei, SNCF Accès Plus, Trenitalia Sala Blu, etc.).

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
  "countries": [
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
  ]
}
```

### 5.3 `data/emergency-phrases.json`

Source: official EU tourism portal (`visiteurope.com`), per-country tourism boards, EU emergency number registry (`112.eu`), Turkish consulate directory.

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

Estimated total size: ~140 KB raw, ~35 KB gzipped. Comfortable inside the existing service worker cache bucket.

## 6. UI — tab bar redesign + Inclusion tab

### 6.1 Tab bar redesign (icon + label layout)

The current tab bar (`css/main.css:138`) uses horizontal flex with text-only labels. It was just patched in commit `ea7b67e` to use `flex: 1 1 0` equal-width distribution because six text labels overflowed the 420 px side panel. The patch is a local minimum — adding a seventh tab would re-break it.

This spec upgrades the bar to an icon-above-label layout that scales to 7–8 tabs without any label clipping:

```css
.panel-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-sunken);
  padding: 0;
  gap: 0;
}
.panel-tab {
  flex: 1 1 0;
  min-width: 0;
  padding: var(--space-2) var(--space-1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: var(--text-xs);
  /* … */
}
.panel-tab .tab-icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 2;
  fill: none;
}
```

At 420 px / 7 tabs = 60 px each → 52 px content after padding → a 20 px icon + a ~6-character label line. Every language is kept to ≤ 6 characters per label:

| Tab ID     | EN    | TR     | DE     | FR     | ES     | IT     |
|------------|-------|--------|--------|--------|--------|--------|
| detail     | Info  | Detay  | Info   | Info   | Info   | Info   |
| route      | Route | Rota   | Reise  | Route  | Ruta   | Rotta  |
| budget     | Cost  | Bütçe  | Kosten | Coût   | Coste  | Costo  |
| filters    | Filter| Filtre | Filter | Filtre | Filtro | Filtro |
| compare    | Match | Kıyas  | Vergl. | Comp.  | Comp.  | Conf.  |
| inclusion  | Equal | Kapsa  | Inkl.  | Incl.  | Inclu. | Inclu. |
| prep       | Prep  | Hazır. | Pack.  | Prép.  | Prep.  | Prep.  |

Icons are inline single-path SVGs borrowed from **Lucide Icons** (MIT licensed, zero runtime cost, matching the stroke style already used in the mobile bottom-nav):

| Tab ID    | Lucide name    | Meaning             |
|-----------|----------------|---------------------|
| detail    | `info`         | Country info        |
| route     | `route`        | Route planning      |
| budget    | `wallet`       | Budget              |
| filters   | `sliders`      | Filter controls     |
| compare   | `bar-chart-3`  | Radar comparison    |
| inclusion | `accessibility`| ILGA + Wheelmap     |
| prep      | `backpack`     | Pre-departure prep  |

The mobile bottom-nav is expanded from its current 4 items to the full 7 in the same commit, using `display: grid; grid-template-columns: repeat(7, 1fr);`. At 375 px viewport that is 53 px / tab, still inside the safe zone.

### 6.2 Inclusion tab — summary view (no country selected)

```
┌─ Kapsayıcılık Panoraması ──────────────────┐
│                                             │
│  🌈 AVRUPA RAINBOW ENDEKS                   │
│  Ortalama ILGA skoru: 48 / 100              │
│  33 DiscoverEU ülkesinin 17'si tam          │
│  evlilik eşitliğini, 22'si kendi kaderini   │
│  tayin yasasını tanıyor.                    │
│                                             │
│  ♿ ERİŞİLEBİLİR ULAŞIM                      │
│  23 / 33 ülkenin ana tren istasyonları      │
│  engelsiz erişim sunuyor.                   │
│  EU Disability Card 29 ülkede geçerli.      │
│                                             │
│  🧭 HARİTA MODLARI                           │
│  [ Varsayılan ] [ 🌈 Rainbow ] [ ♿ Erişim ] │
│                                             │
│  ⚡ DÜŞÜK EŞİK MODU                          │
│  Erasmus+ Inclusion Action kriterleriyle    │
│  haritayı süzer.                            │
│  [ Etkinleştir ]                             │
└─────────────────────────────────────────────┘
```

Summary-view statistics are computed on first render from the three datasets; they are not hard-coded. As data is updated each year, the copy updates automatically.

### 6.3 Inclusion tab — country view (country selected)

Country view is three stacked cards:

1. **Rainbow breakdown** — 7 progress bars for ILGA categories + 9 key-item flags (✓ / ✗ / partial) + highlight quote + source attribution
2. **Accessibility breakdown** — 4 progress bars (public transport / train stations / accommodation / attractions) + EU Disability Card info + Wheelmap top-3 cities + station assistance booking details
3. **Emergency card** — EU 112 reminder + local numbers table + translated key phrases (country language next to user language) + embassy hint for Turkish users + "Show on phone" modal trigger

### 6.4 Map colour layer

A new `js/map/inclusion-layer.js` module subscribes to `state.inclusionMode` and re-colours country polygon fills through Leaflet's `setStyle({ fillColor, fillOpacity })`. The layer is stacked **above** the existing filter-match stroke layer so the two concerns are independent: filter match paints the stroke, inclusion mode paints the fill.

A 5-stop gradient is exposed through design-system custom properties so the colours respect light/dark themes:

```css
:root {
  --inclusion-grad-0:   #ef4444;  /* red   — 0-25   */
  --inclusion-grad-25:  #f97316;  /* orange — 25-50 */
  --inclusion-grad-50:  #facc15;  /* yellow — 50-75 */
  --inclusion-grad-75:  #86efac;  /* l-green — 75-90 */
  --inclusion-grad-100: #16a34a;  /* d-green — 90-100 */
}
[data-theme="dark"] {
  --inclusion-grad-0:   #dc2626;
  /* … darker variants … */
}
```

A legend card below the map (`#inclusionLegend`) shows the active scale and the dataset's `lastUpdated` date. The legend is hidden when mode is `default`.

### 6.5 Welcome Wizard (first-visit onboarding)

A minimal, skippable 4-question modal appears on the very first visit so the app can personalise its defaults instead of shipping everyone the same cold-start experience. The wizard is the ground-floor of the deeper Personalisation Wizard that will be specced separately post-Tier-3.

**Trigger:** `state.user.onboarded !== true` (new persisted boolean, default `false`). Fires from `main.js` after `loadCoreData()` completes and the loading shell is hidden.

**Dismissal:** "Skip for now" is always visible; the modal can be reopened later from a small `⚙️` button in the header.

**Questions (max 4, enforced):**

1. **Home country** — `<select>` prefilled by browser locale guess (`navigator.language` → country). Used to set `state.user.homeCountry` and, if the answer is `TR`, toggle the Turkish Bonus layer automatically.
2. **Group size** — segmented control: `1` / `2-3` / `4` (DiscoverEU max). Writes `state.user.groupSize`.
3. **Budget style** — segmented control: `budget` / `moderate` / `comfort`. Writes `state.user.budget` and drives the Budget tab defaults.
4. **Priorities** — multi-select chips: `accessible` / `LGBTQ+ safe` / `low-budget` / `green/sustainable` / `cultural` / `adventurous`. Writes into `state.filters`:
   - If any of `accessible` / `LGBTQ+ safe` / `low-budget` is selected, the Fewer-opportunities preset is applied automatically (same bulk filter update as the Inclusion tab button — single source of truth, no duplicate code path).
   - `green/sustainable` sets `filters.green = true` (already a state field, currently unused by UI but available).
   - `cultural` / `adventurous` seed `filters.categories` with the matching category tags.

**UI layout:**

- Reuses the existing `.modal-overlay` + `.modal` pattern established by the Wrapped card in `js/features/wrapped.js`. No new modal system.
- 4-step carousel inside a single modal — Previous / Next / Skip buttons, 4-dot progress indicator at the top.
- Final step renders a small summary: *"Seninle tanışıyoruz 👋 — Türkiye'den 4 kişi, düşük bütçe, erişilebilir + LGBTQ+ güvenli öncelikler. Haritayı bu tercihlere göre ayarladık."* with a "Finish" button.
- On Finish: sets `state.user.onboarded = true`, persists, closes modal, optionally displays a quick toast confirming the Fewer-opportunities preset if it was triggered.
- The modal does NOT block map or side panel rendering — it appears on top, and if the user closes it with Esc or Skip, the rest of the app is already fully functional underneath.

**File additions:**

- `js/ui/welcome-wizard.js` — wizard renderer + state wiring + auto-trigger from `main.js`
- `css/components.css` — `.wizard-modal`, `.wizard-step`, `.wizard-progress`, `.priority-chip` styles
- `i18n/en.json` + `i18n/tr.json` — `wizard.*` block (~25 keys for questions, options, buttons, summary copy)

**State additions:**

```js
// js/state.js — state.user additions
user: {
  // existing fields
  onboarded: false   // persisted; flips true on wizard completion or after 'Skip for now' 3 times
}
```

**Relationship to Fewer-opportunities preset:** the wizard's priority multi-select is the **first** and most natural trigger for the Fewer-opportunities preset. The preset logic lives in exactly one place (`js/ui/inclusion.js` exports `activateFewerOpportunitiesMode()`), and `welcome-wizard.js` calls that exported function — no duplicate state manipulation.

**Why this belongs in this spec:** the wizard and the Inclusion tab share the same conceptual surface (*"tell us what matters to you"* → *"here are the inclusion-aware defaults"*). Shipping them together makes the EACEA outreach story considerably stronger: a reviewer opens the app, gets asked three friendly questions, and immediately sees Rainbow Europe + accessibility defaults tuned to their answers. Without the wizard, the Inclusion tab is content they have to discover.

### 6.6 Fewer-opportunities mode preset

A primary button in the Inclusion tab's summary view fires:

```js
state.update('filters', f => ({
  ...f,
  budget:        'low',
  accessibility: true,
  lgbtqSafe:     true,
  interrailOnly: true
}));
showToast(t('inclusion.fewerOppsEnabled'), 'success', 5000);
state.set('panelTab', 'filters');
```

A `role="status" aria-live="polite"` toast explains: *"Erasmus+ Inclusion Action kriterlerine göre süzüldü — düşük bütçe, erişilebilir altyapı ve LGBTQ+ güvenli ülkeler. Daha az fırsata sahip gençler için."* The user lands on the Filters tab immediately so the result of the preset is visible.

## 7. State changes

```js
// js/state.js — initialState additions
{
  // existing slices unchanged
  panelTab: 'detail',  // 'detail' | 'route' | 'budget' | 'filters' | 'compare' | 'inclusion' | 'prep'
  inclusionMode: 'default',  // 'default' | 'rainbow' | 'accessibility' — EPHEMERAL

  user: {
    // existing user fields
    onboarded: false   // PERSISTED — flips true on wizard completion or skip
  }
}
```

`inclusionMode` is **not** persisted — like `compare`, it resets on each session. Route shares (URL hash) do not encode the mode; each visitor sees their own preferred layer.

`user.onboarded` **is** persisted (user slice is already in `PERSIST_KEYS`) so the wizard only appears once.

## 8. File inventory

| File | Status | Purpose |
|---|---|---|
| `js/features/inclusion-data.js`     | **NEW**      | Pluggable data adapter for all three JSONs, Phase-2-ready signatures |
| `js/map/inclusion-layer.js`         | **NEW**      | Polygon fill recolouring, mode-reactive |
| `js/ui/inclusion.js`                | **NEW**      | Inclusion tab renderer (summary + country view), fewer-opps hook |
| `js/ui/welcome-wizard.js`           | **NEW**      | First-visit 4-question onboarding modal, reuses Wrapped card modal pattern |
| `data/rainbow-map.json`             | **NEW**      | ILGA Rainbow Europe 2025 full rubric, 36 countries |
| `data/accessibility.json`           | **NEW**      | Wheelmap + EU policy accessibility data, 36 countries |
| `data/emergency-phrases.json`       | **NEW**      | Emergency numbers + phrases, 36 countries |
| `js/main.js`                        | UPDATED      | Inclusion tab + layer wiring, panelTab value list, wizard auto-trigger |
| `js/state.js`                       | UPDATED      | `inclusionMode` slice added, `user.onboarded` flag added |
| `js/ui/filters-ui.js`               | UPDATED      | Reference to fewer-opps helper from inclusion.js |
| `css/main.css`                      | UPDATED      | Tab bar redesign (icon + label layout, both desktop and mobile) |
| `css/components.css`                | UPDATED      | `.inclusion-*` card styles, legend, phrase-show modal, `.wizard-*` styles |
| `css/map.css`                       | UPDATED      | Polygon fill transition animation |
| `css/design-system.css`             | UPDATED      | 5-step gradient custom properties (light + dark) |
| `index.html`                        | UPDATED      | 7-tab markup with Lucide SVG icons inline, mobile bottom-nav expanded |
| `i18n/en.json`                      | UPDATED      | `inclusion.*`, `emergency.*`, `panel.tab.inclusion`, `wizard.*` blocks |
| `i18n/tr.json`                      | UPDATED      | Same blocks in Turkish |
| `sw.js`                             | UPDATED      | Cache manifest entries for the 3 new JSONs + new modules |
| `PROGRESS.md`                       | UPDATED      | Tier 3 Inclusion checklist progression |
| `data/SOURCES.md`                   | CREATED/UPDATED | Citations for ILGA, Wheelmap, Eurostat, EU Disability Card, per-country railway accessibility services |

## 9. Error handling & graceful degradation

1. **Missing country in a dataset** → show a fallback card: *"Bu ülke için veri henüz derlenmedi — GitHub'da katkıda bulun"*. No crash.
2. **Entire JSON fails to load** → `Promise.allSettled` lets the other two layers work; mode chip for the missing dataset is disabled with a tooltip.
3. **No local-language phrases** → fall back to `globalPhrases.en`, mark the card with *"Yerel dil çevirisi henüz yok"*.
4. **Mode active but country lacks data** → the polygon stays transparent, the country remains clickable, and the legend shows *"N/M ülke verili"*.
5. **Infinite-loop regression guard** → `inclusion-data.js.ensureLoaded()` returns the cached promise; consumers check cache first before scheduling callbacks. This is the same pattern learned from fixing `turkish-bonus.js` in commit `ea7b67e`.

## 10. Accessibility (WCAG AA)

- **Tab bar** — icon `aria-hidden="true"`, visible label text read by screen readers, keyboard focus preserved from current behaviour
- **Mode chips** — `role="radiogroup"` + `role="radio"` + `aria-checked`, Arrow-Left / Arrow-Right navigation
- **Colour + text redundancy** — legend shows numeric ticks (0, 25, 50, 75, 100); every map colour is duplicated in text in the country card; gradient uses both hue *and* lightness changes for colour-blind users
- **Contrast** — all gradients meet 4.5:1 contrast against `--bg-default` in both light and dark themes
- **Progress bars** — `role="progressbar" aria-valuenow` + bar + text "78%" → three redundant channels
- **"Show on phone" modal** — `role="dialog" aria-modal="true"`, focus-trap, Esc closes, 32 px minimum font
- **Emergency numbers** — `<a href="tel:112">` so mobile devices call directly
- **Toast for fewer-opps preset** — `role="status" aria-live="polite"`

## 11. Testing strategy

**Static checks (pre-commit):**

- `node --check` on every new JS module
- `json.load` (Python) on every new JSON file
- Line count / file size sanity check (each JSON < 100 KB raw)

**Browser smoke tests (Playwright MCP, manual trigger):**

| # | Scenario |
|---|---|
| T1 | Cold load → 7-tab bar renders with equal widths, no overflow |
| T2 | Click "Kapsayıcılık" tab → summary view renders, no freeze |
| T3 | Click "Rainbow" mode chip → polygons recolour, legend appears |
| T4 | Click Germany on map → country view fills with 3 cards |
| T5 | Click "Fewer-opps" preset → toast fires, filters tab opens, map filtered |
| T6 | Switch dark mode → gradient colours remain readable |
| T7 | Switch TR → DE language → inclusion tab re-renders, no freeze |
| T8 | Click "Show phrase on phone" → modal opens, Esc closes |
| T9 | Rapidly toggle 6 mode chips → no freeze (loop regression guard) |
| T10 | Test at 375 / 768 / 1440 viewport → tab bar never clips |
| T11 | First-visit flow: cold storage → wizard modal appears → 4 questions → Finish → `user.onboarded === true`, wizard does not reopen on refresh |
| T12 | Wizard Skip: open wizard → click Skip → modal closes, app is fully interactive, `user.onboarded === true` |
| T13 | Wizard priority answer triggers Fewer-opps: pick `accessible + lgbtq` → Finish → `state.filters` reflects the preset, Inclusion tab is focused |

Each test produces a screenshot under `.playwright-mcp/` (gitignored).

## 12. Build sequence

Implementation is split into six steps that can be dispatched to specialised agents in parallel where possible.

| Step | Agent(s)                        | Output                                                                 | Depends on |
|------|---------------------------------|------------------------------------------------------------------------|------------|
| 1    | `research-scout` + `data-curator` (parallel) | 3 JSONs in `data/` + `SOURCES.md` updates                              | none       |
| 2    | `feature-engineer`              | `inclusion-data.js`, `inclusion-layer.js`, `state.js` update           | none       |
| 3    | `ui-designer`                   | Tab bar redesign in `css/main.css` + Lucide SVGs in `index.html`        | none       |
| 4    | `feature-engineer`              | `ui/inclusion.js` (summary + country view + fewer-opps), main.js wire   | 2, 3       |
| 5    | `ui-designer`                   | `components.css` cards + legend + phrase-show modal + gradient vars + wizard styles | 4          |
| 6    | `data-curator`                  | `i18n/en.json` + `i18n/tr.json` inclusion / emergency / wizard blocks   | 4          |
| 7    | `feature-engineer`              | `ui/welcome-wizard.js` (4-step modal + auto-trigger in main.js + delegates to activateFewerOpportunitiesMode) | 4          |
| 8    | `feature-engineer`              | `sw.js` cache manifest update, `PROGRESS.md` progress update            | 1, 4, 7    |

Steps 1, 2, 3 can run in parallel (no cross-dependencies). Step 4 is the critical path because it consumes both the data adapter and the new tab markup. Steps 5, 6, 7 run in parallel after step 4. Step 8 is the finisher.

Each step is its own git commit with a descriptive message. Manual verification with Playwright MCP happens after step 8.

## 13. Acceptance criteria

- [ ] All 13 smoke tests (T1–T13) pass on a real browser against the local server
- [ ] All 3 JSONs parse cleanly and cover 36/36 countries (no stubs, no TBDs)
- [ ] Welcome wizard appears on first visit, does not reappear after Finish / Skip
- [ ] Wizard's "accessible / lgbtq / low-budget" priorities trigger the Fewer-opps preset automatically
- [ ] `PROGRESS.md` Tier 3 section marks Wheelmap / Rainbow Map / Emergency / Fewer-opps / Welcome Wizard as `[x]`
- [ ] No new console errors or warnings on a clean load (hard-refresh + SW cleared)
- [ ] Tab bar renders correctly at 375, 768, and 1440 px in both TR and EN
- [ ] Rainbow / Accessibility gradients meet WCAG AA 4.5:1 contrast in both themes
- [ ] Commit history is split into logical chunks (data / adapter / tabs / UI / i18n / PWA)
- [ ] Changes are pushed to `origin/main` and the GitHub Pages deploy succeeds
- [ ] `SOURCES.md` cites ILGA, Wheelmap, Eurostat, EU Disability Card, and at least 3 national railway accessibility services

## 14. Open questions

None — all key decisions were settled during brainstorming (scope decomposition, phased data strategy, rich schema, combined map layer + detail cards, dedicated Inclusion tab, tab bar redesign scope).

## 15. Phase 2 hooks (explicitly out of scope, noted for continuity)

- `inclusion-data.js.ensureLoaded(opts)` will accept a `{ liveMode: true }` option that overlays live Wheelmap REST API responses on top of the static cache
- The accessibility card will grow a "Canlı veri" ("live data") badge when the live layer is in use, with a last-synced timestamp
- Consumer signatures (`getRainbowData`, `getAccessibilityData`, `getEmergencyInfo`) remain unchanged — the upgrade is a single-file change inside the adapter
