# DiscoverEU Companion — Progress & Architecture

> **Single source of truth for this project.** Every feature, decision, and architectural change is recorded here. Read this before coding anything.

**Last updated:** 2026-04-10
**Phase:** 1 (Foundation)
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
- [ ] Interactive 44-country map with zoom labels
- [ ] Country detail side panel
- [ ] Filter system with map coloring
- [ ] Drag-drop route builder + 7-day progress bar
- [ ] ⭐ **Mandatory reservation warning system** (competitive differentiator #1)
- [ ] ⭐ **4 DiscoverEU seat credit tracker** (competitive differentiator #2)
- [ ] Budget calculator (4 people, multi-currency)
- [ ] Pre-built route templates (Balkan, West, North, Med, Green, Inclusion)
- [ ] Interrail validity warning for non-participating countries

### Tier 2 — Viral & Amplification *(Days 6-8)*
- [ ] **DiscoverEU Wrapped** shareable card (Instagram-ready)
- [ ] **CO2 vs flying** comparison + Green Traveler badge
- [ ] 2–4 country radar chart comparison
- [ ] PWA offline mode (service worker)
- [ ] Shareable route URL (LZ-compressed)
- [ ] PDF export of full itinerary
- [ ] Countdown timer + quiz prep + checklist + packing list

### Tier 3 — Inclusion *(Days 9-10)*
- [ ] Wheelmap accessibility filter
- [ ] ILGA Rainbow Map LGBTQ+ safety layer
- [ ] DE / FR / ES / IT translations
- [ ] Low-budget "fewer opportunities" mode
- [ ] Emergency info panel (offline, per country)

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
- [ ] Schengen visa checklist (18-year-old variant)
- [ ] Sofia Express connector (DiscoverEU pre-segment)
- [ ] TL budget mode + Wise/Revolut guidance
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
- Git repository initialized (local)
- Project directory structure created
- `.gitignore`, `LICENSE`, `README.md` written
- `css/design-system.css` — full CSS custom property system, dark/light themes, typography, spacing, radii, motion
- `css/main.css` — app shell grid, header, side panel layout, responsive bottom nav, loading state
- Project infrastructure: `CLAUDE.md`, `PROGRESS.md`, 8 agent definitions

### 🚧 In progress
- *(nothing — ready to continue)*

### ⏭ Next up (in order)
1. `css/components.css` + `css/map.css`
2. `index.html` app shell
3. `js/utils/dom.js`, `js/utils/storage.js`, `js/utils/format.js`
4. `js/state.js` reactive store
5. `js/i18n/i18n.js` + `i18n/en.json` + `i18n/tr.json`
6. `js/ui/theme.js`
7. `data/geojson/europe.geojson` download (Natural Earth)
8. `js/map/map.js` + `js/map/countries-layer.js` + `js/map/labels.js`
9. `data/countries.json` schema + first 15 countries
10. `js/main.js` bootstrap wiring

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
