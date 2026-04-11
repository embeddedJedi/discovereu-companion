# DiscoverEU Companion — Progress & Architecture

> **Single source of truth for this project.** Every feature, decision, and architectural change is recorded here. Read this before coding anything.

**Last updated:** 2026-04-11 (session 7 — Tier 3 Inclusion Pack: Rainbow Map, Wheelmap accessibility, emergency phrases, Fewer-opportunities mode, Welcome Wizard, 7-tab bar redesign)
**Phase:** 3 (Tier 3 sub-project 1 complete; sub-projects 2 & 3 remain)
**Launch target:** 2026-04-22 (12-day sprint)
**GitHub:** `embeddedJedi/discovereu-companion` *(not pushed yet)*
**Live URL:** `https://embeddedjedi.github.io/discovereu-companion` *(pending deploy)*

---

## 1. Vision

A free, open-source, single-page web app that helps 18-year-olds plan their DiscoverEU trip across 33 European countries. Universal first, with a Turkish bonus layer for Turkish applicants who face Schengen visa hurdles. Positioned for EACEA amplification.

**Tagline:** *"Engage · Connect · Empower — an accessible, green, and inclusive trip-planning companion for all European youth."*

**Success criteria:**
1. Site is live on GitHub Pages before 2026-04-22
2. Tier 1 + Tier 2 fully functional; Tier 3-5 at least partially implemented
3. Outreach package delivered to Turkish Ulusal Ajansı, EACEA, DG EAC Youth Unit LinkedIn contacts
4. At least 5 unique features no competitor has (reservation warnings, seat-credit tracker, Wrapped card, Rainbow Map, accessibility filter)

---

## 2. Tech stack

| Layer | Choice | Reason |
|---|---|---|
| Core | Vanilla HTML + ES modules + CSS | No build = EACEA reviewers can inspect instantly, no tooling barrier |
| Map | Leaflet (CDN) + Natural Earth GeoJSON | Mobile-friendly, public-domain data |
| Charts | Chart.js (CDN) | Radar chart for country comparison |
| PDF | jsPDF + html2canvas (CDN) | Route export |
| Share | LZ-string (CDN) | URL-encoded compressed routes |
| Storage | LocalStorage + IndexedDB | Persistence without backend |
| Offline | Service Worker | PWA mode for trains without signal |
| i18n | Custom vanilla engine + JSON files | 6 languages core |
| AI | Groq API (Llama 3) — user-provided key | Natural language route suggestion |
| External APIs | Open-Meteo, OpenTripMap, Wikivoyage, Wikimedia, Wheelmap | All free, CORS-friendly |

---

## 3. Architecture

### 3.1 File structure

```
DiscoverEU/
├── index.html                  # SPA entry, loads modules
├── CLAUDE.md                   # Project instructions (overrides global)
├── PROGRESS.md                 # This file
├── README.md                   # Public-facing project description
├── LICENSE                     # MIT
├── .gitignore
├── .github/
│   └── workflows/
│       └── pages.yml           # GitHub Pages auto-deploy
├── .claude/
│   └── agents/                 # Specialized agent definitions
│       ├── architect.md
│       ├── ui-designer.md
│       ├── feature-engineer.md
│       ├── data-curator.md
│       ├── map-specialist.md
│       ├── api-integrator.md
│       ├── outreach-writer.md
│       └── research-scout.md
├── css/
│   ├── design-system.css       # CSS vars, typography, dark/light tokens
│   ├── main.css                # App shell, header, panel, layout
│   ├── components.css          # Buttons, cards, badges, forms, modals
│   └── map.css                 # Leaflet overrides
├── js/
│   ├── main.js                 # App bootstrap, wires everything together
│   ├── state.js                # Central reactive state store
│   ├── map/
│   │   ├── map.js              # Leaflet init + lifecycle
│   │   ├── countries-layer.js  # GeoJSON country polygons
│   │   ├── labels.js           # Zoom-aware country labels
│   │   └── filters.js          # Color map by active filter
│   ├── data/
│   │   └── loader.js           # JSON fetch + cache
│   ├── ui/
│   │   ├── theme.js            # Dark/light toggle + system preference
│   │   ├── panel.js            # Side panel tab controller
│   │   ├── country-detail.js   # Country info tab
│   │   ├── route-builder.js    # Drag-drop route tab
│   │   ├── budget.js           # Budget calculator tab
│   │   ├── filters-ui.js       # Filter controls tab
│   │   ├── comparison.js       # Radar chart comparison tab
│   │   ├── templates.js        # Pre-built route templates
│   │   └── prep.js             # Countdown, quiz, checklist, packing
│   ├── features/
│   │   ├── reservations.js     # ⭐ Mandatory reservation warnings
│   │   ├── seat-credits.js     # ⭐ 4 DiscoverEU credit tracker
│   │   ├── co2.js              # CO2 vs flying calculator
│   │   ├── wrapped.js          # DiscoverEU Wrapped shareable card
│   │   ├── bingo.js            # City Bingo card + achievements
│   │   ├── daily-dare.js       # Daily challenge push
│   │   ├── journal.js          # Passive GPS trip journal
│   │   ├── voice-memory.js     # 30sec audio capsule
│   │   ├── soundtrack.js       # Country Spotify embed
│   │   ├── group-vote.js       # 4-person group decisions
│   │   ├── night-shield.js     # Late arrival filter
│   │   ├── packing.js          # Smart packing assistant
│   │   ├── emergency.js        # Offline emergency info
│   │   ├── pickpocket.js       # Safety heatmap
│   │   ├── future-me.js        # Time capsule email
│   │   ├── wheelmap.js         # Accessibility integration
│   │   ├── rainbow-map.js      # ILGA LGBTQ+ layer
│   │   ├── ai-assistant.js     # LLM route suggestion
│   │   └── turkish-bonus.js    # Schengen visa + Sofia Express + TL budget
│   ├── i18n/
│   │   └── i18n.js             # Translation engine
│   └── utils/
│       ├── storage.js          # LocalStorage/IndexedDB wrapper
│       ├── pdf.js              # jsPDF wrapper
│       ├── share.js            # URL compression (LZ-string)
│       ├── format.js           # Currency, date, number formatters
│       ├── geo.js              # Haversine, centroid helpers
│       └── dom.js              # Tiny DOM helpers (h, on, qs)
├── data/
│   ├── SOURCES.md              # Data attribution
│   ├── countries.json          # 44 countries: metadata, scores, tips
│   ├── cities.json             # Major cities per country
│   ├── trains.json             # City-pairs: duration, reservation flag
│   ├── reservations.json       # Mandatory reservation routes (Tier 1 ⭐)
│   ├── route-templates.json    # Pre-built routes (Balkan, West, etc.)
│   ├── cost-of-living.json     # Kaggle-derived per-country
│   ├── accessibility.json      # Wheelmap data snapshot
│   ├── rainbow-map.json        # ILGA scores snapshot
│   ├── bingo-challenges.json   # City photo challenges
│   ├── emergency-phrases.json  # Emergency phrases per language
│   ├── daily-dares.json        # Rotating mini-quests
│   └── geojson/
│       └── europe.geojson      # Natural Earth country borders
├── i18n/
│   ├── en.json                 # Source language
│   ├── tr.json                 # Turkish
│   ├── de.json                 # German
│   ├── fr.json                 # French
│   ├── es.json                 # Spanish
│   └── it.json                 # Italian
└── assets/
    ├── icons/                  # SVG icons
    ├── images/                 # Hero, brand marks
    └── manifest.json           # PWA manifest
```

### 3.2 Data flow

```
┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│  data/*.json │───────▶│ data/loader  │───────▶│  state.js    │
│  i18n/*.json │        │              │        │  (reactive)  │
└──────────────┘        └──────────────┘        └──────┬───────┘
                                                       │
                                                       │ subscribe
                                                       ▼
        ┌──────────────────────────────────────────────────────┐
        │                  UI modules (js/ui/)                 │
        │                                                      │
        │  • map.js        • country-detail.js                  │
        │  • route-builder • budget.js                          │
        │  • filters-ui    • comparison.js                      │
        │  • prep.js       • templates.js                       │
        └──────────────────────────────────────────────────────┘
                                                       ▲
                                                       │ mutate
                                                       │
        ┌──────────────────────────────────────────────┘
        │
        │ User interactions → state updates → UI re-renders
        │
        ▼
   LocalStorage (theme, route, preferences)
   IndexedDB (photos, voice memos, journal)
```

### 3.3 State shape (js/state.js)

```javascript
{
  theme: "light" | "dark",
  language: "en" | "tr" | "de" | "fr" | "es" | "it",
  user: {
    groupSize: 4,
    homeCountry: "TR",
    budget: "budget" | "moderate" | "comfort",
    accommodation: "hostel" | "airbnb" | "camp" | "couchsurf"
  },
  route: {
    stops: [{ countryId, cityId, nights, arrivalDay }],
    travelDaysUsed: 0,
    seatCreditsUsed: 0,
    totalCO2: 0,
    totalCost: 0
  },
  filters: {
    categories: Set<"nature" | "culture" | "nightlife" | ...>,
    budget: "all" | "low" | "mid" | "high",
    interrailOnly: false,
    accessibility: false,
    lgbtqSafe: false
  },
  selectedCountry: "DE" | null,
  panelTab: "detail" | "route" | "budget" | "filters" | "compare" | "prep"
}
```

### 3.4 Module dependencies

- `main.js` imports: state, i18n, theme, map, panel, all ui/*
- All ui/ modules depend on: state, i18n, dom, format
- features/ modules are optional plug-ins registered through `main.js`
- Nothing imports from features/ except main.js (keeps core decoupled)

### 3.5 CDN dependencies (loaded in `index.html`)

```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js"></script>
```

All loaded with SRI hashes (to add in Phase 1).

---

## 4. Feature roadmap

### Tier 1 — MVP Core *(Days 1-5)*
- [x] Interactive 36-country map (33 DiscoverEU + TR + Western Balkans) with zoom labels
- [x] Country detail side panel (all 36 countries with data)
- [x] Filter system with map coloring
- [x] Drag-drop route builder + 7-day progress bar
- [x] ⭐ **Mandatory reservation warning system** (competitive differentiator #1)
- [x] ⭐ **4 DiscoverEU seat credit tracker** (competitive differentiator #2)
- [x] Budget calculator (4 people, multi-currency)
- [x] Pre-built route templates (Grand Tour, Balkan, Nordic, Med, Green, Inclusion, Budget, Turkish Bridge)
- [x] Interrail / non-participating warning (via country detail + filter)

### Tier 2 — Viral & Amplification *(Days 6-8)*
- [x] **DiscoverEU Wrapped** shareable card (Instagram-ready)
- [x] **CO2 vs flying** comparison + Green Traveler badge
- [x] 2–4 country radar chart comparison
- [x] PWA offline mode (service worker)
- [x] Shareable route URL (LZ-compressed)
- [x] PDF export of full itinerary
- [x] Countdown timer + checklist + smart packing list

### Tier 3 — Inclusion *(Days 9-10)*
- [x] **Wheelmap accessibility layer** — map colour mode + country breakdown card + station assistance + EU Disability Card meta
- [x] **ILGA Rainbow Map LGBTQ+ safety layer** — full 7-category rubric + key items + map colour mode
- [x] **Low-budget "fewer opportunities" mode** — single-click preset, single source of truth shared between Inclusion tab and Welcome Wizard
- [x] **Emergency info panel** — EU 112 + local numbers + per-country phrase pack + "show on phone" modal
- [x] **Welcome Wizard** — first-visit 4-question onboarding, feeds answers into state.user + state.filters
- [x] **7-tab bar redesign** — icon + label layout, scales beyond 6 tabs, mobile bottom-nav mirrored
- [ ] DE / FR / ES / IT translations  ← sub-project 3 (separate spec)

### Tier 4 — Fun & Memory *(Days 11-12)*
- [ ] City Bingo cards + achievement badges
- [ ] Daily Dare micro-quest push
- [ ] Passive GPS trip journal (Polarsteps-lite)
- [ ] Voice memory capsule (30-second audio per day)
- [ ] Country Soundtrack (Spotify Top 50 embed)
- [ ] Group Vote Module (for 4-person groups)
- [ ] Night Arrival Shield (22:00+ filter)
- [ ] Smart Packing Assistant
- [ ] Pickpocket heatmap
- [ ] FutureMe time capsule

### Tier 5 — Turkish bonus layer
- [x] Schengen visa checklist (18-year-old variant)
- [x] Sofia Express connector (DiscoverEU pre-segment)
- [x] TL budget mode + Wise/Revolut guidance
- [ ] Turkish consulate appointment reminder

### AI (cross-cutting)
- [ ] Natural language route suggestion (Groq API, user-provided key)

### Deploy & outreach
- [ ] GitHub repo + Pages workflow
- [ ] Custom domain (post-launch)
- [ ] Outreach package for EACEA, Turkish UA, LinkedIn DG EAC Youth Unit

---

## 5. Progress tracker

### ✅ Done
- Git repository initialized + pushed to `github.com/embeddedJedi/discovereu-companion`
- GitHub Pages enabled → `https://embeddedjedi.github.io/discovereu-companion/`
- Project directory structure created
- `.gitignore`, `.gitattributes`, `LICENSE` (MIT), `README.md`
- `CLAUDE.md` project instructions (web-app context override)
- `PROGRESS.md` architecture + roadmap + tracker
- 8 agent definitions in `.claude/agents/`
- `css/design-system.css` — full CSS custom property system, dark/light themes, typography, spacing, shadows, motion
- `css/main.css` — app shell grid, header, side panel, responsive bottom nav, loading state
- `css/components.css` — buttons, badges, chips, cards, forms, alerts, modals, toasts, stats, route-stop cards, **country detail panel**
- `css/map.css` — Leaflet overrides, country polygons, labels, route polylines, popups, controls, legend
- `index.html` — full SPA shell with CDN imports, header, panel tabs, mobile bottom nav, early theme script
- `js/utils/dom.js` — qs/qsa/h/on/empty/escape helpers
- `js/utils/storage.js` — namespaced LocalStorage + TTL cache
- `js/utils/format.js` — currency/date/duration/distance/weight/percent formatters (locale-aware)
- `js/state.js` — reactive store with persistence, subscribe/update API, shape documented
- `js/i18n/i18n.js` — translation engine with fallback, `data-i18n` attribute application
- `i18n/en.json` + `i18n/tr.json` — full translation baseline incl. country-detail section
- `js/ui/theme.js` — dark/light toggle + system preference + themechange event
- `js/main.js` — bootstrap, state-driven panel tabs + bottom nav, data load, map + layer + labels + detail wiring
- `js/map/map.js` — minimal Leaflet init with European bounds
- **`data/geojson/europe.geojson`** — Natural Earth 1:50m, 36 features (33 DiscoverEU + BA/MK/RS + TR bonus), ~275 KB, stripped props to id/name/name_long/continent
- **`data/countries.json`** — v1 schema + first 15 countries (DE/FR/IT/ES/NL/BE/AT/CH/CZ/PL/HU/PT/GR/SE/TR) with scores, costPerDay, highlights, sources
- **`js/data/loader.js`** — in-memory JSON fetch + cache, `loadCoreData()` hydrates countries/trains/reservations/routeTemplates slices via Promise.allSettled
- **`js/map/countries-layer.js`** — Leaflet GeoJSON layer with click/hover/keyboard focus, `selectCountry()` / `focusCountry()` helpers, classList toggling for selected/in-route/non-participating (preserves leaflet-interactive)
- **`js/map/labels.js`** — zoom-aware divIcon labels, 4 importance tiers by area, centroid placement handling Polygon + MultiPolygon
- **`js/ui/country-detail.js`** — Detail tab renderer: flag, name, badges, short description, facts grid, score bars, highlights, Add-to-route + Compare actions, non-participating warning
- **`data/countries.json`** expanded to all **36 countries** — EU27 + IS/LI/NO + TR bonus + AL/BA/MK/RS map context, with scores, costPerDay, highlights, sources
- **`js/map/filters.js`** — pure matcher: `filtersActive`, `matchesFilters`, `countMatches`. Applied by `countries-layer` to toggle `.filter-match` class.
- **`js/ui/filters-ui.js`** — Filters tab: category chips (6), budget level segmented, accessibility/LGBTQ+ toggles, Interrail-only toggle, live match count, reset button
- **`data/route-templates.json`** — 8 curated routes (Grand Tour, Balkan Adventure, Nordic Lights, Mediterranean Coast, Green Rail, Inclusion First, Budget Backpacker, Turkish Bridge)
- **`js/ui/route-builder.js`** — Route tab: 7-day progress bar, seat-credits indicator, drag-drop reordering, per-stop ±1 nights controls, clear route, template gallery (shown when empty or as "more templates" footer), reservation warnings section
- **`data/reservations.json`** — 12 mandatory reservation entries (FR↔IT/ES/DE/CH TGV, IT Frecciarossa, ES AVE, DE↔AT Nightjet, HR↔HU, SE night, BG↔GR, RO↔HU, TR↔BG Sofia Express)
- **`js/features/reservations.js`** ⭐ — `getRouteReservations(route)` walks adjacent stop pairs against the reservations data set, supports bidirectional + domestic matching
- **`js/features/seat-credits.js`** ⭐ — `computeSeatCredits(route)` counts international vs domestic paid reservations, enforces 4-credit limit, surfaces `exceeded` flag
- **Language-reactive tabs** — all tab modules subscribe to `state.language` so dynamic `h()`-rendered text (not just `data-i18n` attributes) refreshes on switch
- **`js/ui/budget.js`** — Budget calculator tab. Pure `computeBudget(route, user)` splits each stop's `costPerDay[tier]` into 40/35/25 accommodation/food/activities shares, applies accommodation & food modifiers, and sums reservation costs as transport. Per-person + group total cards + breakdown bar rows, stepper + chip controls for group size / travel style / accommodation / food.
- **Chart.js 4.4.0** — added to CDN list in `index.html` with `defer`, used only by the Compare tab.
- **`js/ui/compare.js`** — Compare tab renders a radar chart over 2-4 countries across 6 axes (nature / culture / nightlife / food / budgetFriendly / accessibility). Single Chart.js instance, destroyed on tab-leave to prevent canvas leaks. Colour palette: EU-blue / gold / green / red. Countries are added via the Detail tab's "Compare" button, capped at 4 with oldest-first eviction.
- **`state.compare`** — new ephemeral (non-persisted) slice: list of country IDs currently in the comparison. Cleared on session refresh.
- **`js/features/co2.js`** — `computeCO2(route)` haversine between capital coordinates (36 inline lat/lng pairs), 35 g/pkm rail vs 255 g/pkm flight emission factors, returns `{ totalKm, railKg, flightKg, savedKg, savedPct, green }`. Rendered as a green card in the Route panel with a "Green Traveler" badge when savings ≥ 75%.
- **`js/ui/prep.js`** — Prep tab with three sections: departure countdown (HTML date input + live day-delta that ticks every 60s when visible), 10-item pre-departure checklist with progress pill and strike-through, smart packing list that grows with the route (beach → swimsuit/sunscreen/flipflops, nordic → warm jacket/thermals, nature → rain jacket/hiking shoes, culture → nice outfit) plus camp-specific items when `user.accommodation === 'camp'`.
- **`state.prep`** — new persisted slice `{ departureDate, checklistDone, packingDone }`, added to `PERSIST_KEYS`, so checks survive page reloads.
- **LZ-string 1.5.0 CDN + `js/utils/share.js`** — URL hash round-trip: `encodeRoute()` / `decodeRoute()` via `compressToEncodedURIComponent`, `currentShareURL()` builds the canonical share URL, `hydrateRouteFromHash()` runs after `loadCoreData` so arriving at `/#route=…` auto-hydrates the Route tab. A 6-stop Turkish Bridge route fits in ~165 chars — well under any 2000-char gist fallback threshold.
- **`js/ui/toast.js`** — lightweight toast stack bound to existing `.toast` styles; 4 variants (success/warning/danger/info) via left-border colours. Used by the header Share button.
- **Header Share button wired** — empty route → warning toast, otherwise copies the share URL to the clipboard (with `execCommand` fallback) and updates `history.replaceState` so the address bar reflects the copied link.
- **PWA shell — `assets/manifest.json` + `sw.js`** — cache-first stale-while-revalidate service worker, pre-caches the CSS/HTML app shell + icons + manifest on install, wipes older cache buckets on activate. Register is a no-op on `file://`. SVG-only icon set (logo in blue + gold EU star) doubles as maskable + favicon so there are zero binary assets in the repo.
- **`js/main.js` boot order** — now: theme → i18n → tabs → data load → `hydrateRouteFromHash` → module imports → map → SW register → hide loading shell.
- **`js/features/wrapped.js`** ⭐ — DiscoverEU Wrapped shareable card. Opens a `.modal-wrapped` overlay rendered as real DOM (so the card is screen-reader-legible and EACEA-inspectable), then flattens it to a 1080×1080 PNG with html2canvas for sharing. Hooks into any `[data-wrapped-trigger]` element via `initWrappedTrigger()`; the Route tab exposes a primary "Wrapped" button once the route has at least one stop. Empty route → warning toast instead of an empty card.
- **`js/features/pdf-export.js`** — Print-ready A4 itinerary export via jsPDF. Lays out the document with vector text (not a canvas snapshot) so output stays crisp and selectable on any printer. Dynamically imported from `route-builder.js` the first time the user clicks "Export PDF" so jsPDF only loads on demand. Sections: cover page, day-by-day stops with nights + highlights, reservations table, budget summary, CO₂ card, seat-credit status.
- **`js/features/turkish-bonus.js` + `data/turkish-bonus.json`** ⭐ (Tier 5) — Turkish applicant layer. Three cards rendered into the Prep tab: 10-item **Schengen visa checklist** (biometrics, €30k travel insurance, €50/day financial proof, DiscoverEU invitation letter, etc.), **Sofia Express** callout (Istanbul→Sofia sleeper, the only direct rail bridge into DiscoverEU, ~12h, ~€25), and **TL budget tips** (Wise / Revolut / Ziraat Maximum guidance plus ~43–45 TL/EUR reference rate). Active when `language==='tr'`, `user.homeCountry==='TR'`, or the route starts at a Turkish stop — otherwise the whole module is a no-op.
- **`css/components.css`** — added `.modal-overlay`, `.modal-wrapped`, `.wrapped-card`, `.turkish-bonus`, and `.tier5-card` styles so the three new features slot into the existing design-system tokens without hardcoded colours.
- **Session 6 translations** — `i18n/en.json` + `i18n/tr.json` extended with `wrapped.*`, `modal.*`, `pdf.*`, and `turkishBonus.*` keys.
- **Session 7 — Tier 3 Inclusion sub-project 1** (2026-04-11):
  - 3 new data files: `rainbow-map.json`, `accessibility.json`, `emergency-phrases.json` (~140 KB total)
  - `js/features/inclusion-data.js` pluggable adapter (Phase-2-ready signatures)
  - `js/map/inclusion-layer.js` polygon fill recolouring reactive to `state.inclusionMode`
  - `js/ui/inclusion.js` summary + country views, mode chips, fewer-opps preset export
  - `js/ui/welcome-wizard.js` 4-question first-visit onboarding
  - Tab bar redesign from text-only to icon + label layout, 6 → 7 tabs (mobile bottom-nav mirrored)
  - All 13 smoke tests pass

### 🚧 In progress
- *(nothing — ready to continue)*

### ⏭ Next up (in order)
1. Housekeeping: `.gitignore` dev screenshots + `.playwright-mcp/`, commit session 2–6 work in logical chunks, push to GitHub, verify Pages deploy
2. Tier 3: Wheelmap accessibility layer + ILGA Rainbow Map layer
3. Tier 3: DE / FR / ES / IT translations (extend i18n JSONs)
4. Tier 3: Emergency info panel (offline, per country) + fewer-opportunities mode
5. Tier 4: City Bingo + Daily Dare + Journal + Voice capsule (fun/memory layer)
6. Tier 4: Country Soundtrack (Spotify embed), Group Vote, Night Arrival Shield, Pickpocket heatmap, FutureMe
7. AI: Natural-language route suggestion (Groq API, user-provided key)
8. Deploy polish: custom domain + outreach package for EACEA / Turkish UA / LinkedIn DG EAC Youth Unit

### 🛑 Blocked
- *(none)*

---

## 6. Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-10 | Vanilla JS + no build step | EACEA reviewers can inspect source instantly; no framework complexity |
| 2026-04-10 | Leaflet over D3 | Mobile-friendly, simpler API, zoom behavior built-in |
| 2026-04-10 | Universal positioning (not Turkey-only) | Larger audience + EACEA framing requires "for all European youth" |
| 2026-04-10 | Manual/static JSON for train data | Live train APIs fragmented; statically curated `reservations.json` covers competitive edge |
| 2026-04-10 | Groq for AI (user key) | Free tier, Llama 3 fast, no backend proxy needed |
| 2026-04-10 | PROGRESS.md as single source of truth | User directive — architecture + progress in one place, drives code |
| 2026-04-10 | 8-agent team with Turkish chat / English code | User directive — specialized agents for domain work |
| 2026-04-10 | Each tab module owns its own render and subscribes to `panelTab` | Avoids a central router; tabs clear `#panelBody` via `empty()` when they become active |
| 2026-04-10 | Tab modules also subscribe to `state.language` | Dynamic content built with `h()` bypasses `data-i18n`, so an explicit re-render is needed on language switch |
| 2026-04-10 | Domestic mandatory reservations don't burn DiscoverEU credits | Matches the real DiscoverEU rules: free credits only cover international legs; AVE/Frecciarossa domestic are extra out-of-pocket |
| 2026-04-10 | Templates gallery doubles as an "empty state" and as a footer | Single module avoids mode-switching; when the route is empty it's the hero, otherwise a collapsed "more templates" invitation |
| 2026-04-10 | Budget = daily cost × 40/35/25 split × accommodation/food modifiers + reservation costs | Lets a single `costPerDay[low/mid/high]` number drive four breakdown categories without extra data; keeps `data/countries.json` small |
| 2026-04-10 | `state.compare` is ephemeral (not persisted) | Comparing is a lightweight exploratory action, not part of the user's saved itinerary; refresh should start clean |
| 2026-04-10 | Chart.js is loaded via CDN with `defer`, retried once by `drawChart` | Avoids blocking the initial paint; the Compare tab is rarely the first thing a user opens |
| 2026-04-10 | CO₂ distance uses capital-to-capital haversine | Precise enough for the ratio message (which is the whole point of the card); avoids shipping a real city-pair distance table |
| 2026-04-10 | Packing list adapts to the route instead of a universal checklist | Fewer items = higher completion rate; users won't tick "warm jacket" on a Greek beach trip |
| 2026-04-10 | Share URL uses `location.hash`, not a query string | Hash stays client-side so GitHub Pages needs no routing rules; `history.replaceState` keeps the address bar in sync without reloads |
| 2026-04-10 | Service worker is same-origin only, CDN assets skipped | Leaflet / Chart.js / LZ-string already ship with long-lived cache headers; re-caching them in our SW would just duplicate bytes |
| 2026-04-10 | Icons are SVG-only, including maskable | Keeps the repo binary-free so EACEA reviewers can clone + read everything; modern Chrome/Safari PWA installers accept SVG maskables |

---

## 7. Open questions

- Q: Use Leaflet tile layer (CartoDB / OSM) or tile-less GeoJSON-only look? → **Decided:** GeoJSON-only minimal look, with optional tile layer toggle in settings. Cleaner visual identity and lighter for mobile.
- Q: How to handle 44 countries when some don't have full data? → Stub entries with "data needed — contribute!" CTA linking to GitHub issue.
- Q: Route-sharing URL length limit for LZ-compressed state? → Test with a 15-stop route; fallback to gist if > 2000 chars.
- Q: AI key management UX? → Modal on first AI use, stored in localStorage with a "clear" button.
- Q: Natural Earth GeoJSON file size vs loading speed? → Preprocess to European countries only + simplify geometries (turf.simplify or mapshaper).

---

## 8. Workflow

**To add a feature:**
1. Find it in Section 4 (Feature roadmap)
2. Check Section 3 (Architecture) — which file/module does it belong to?
3. Move it to `🚧 In progress` in Section 5
4. Read any relevant existing code
5. Implement using the right [agent](.claude/agents/)
6. Update Section 5 → `✅ Done`
7. If a decision was made, add to Section 6 (Decisions log)
8. If a question came up, add to Section 7 (Open questions)
9. Commit with conventional message
10. Push to `main` (GitHub Pages auto-deploys)

**When in doubt about scope or approach, ask the user. Never guess.**
