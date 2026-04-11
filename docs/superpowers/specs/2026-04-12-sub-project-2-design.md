# Tier 3+4 Sub-project 2 — AI Assistant, Fun Layer, City Guide & Consulate Reminder

**Status:** Draft for approval
**Author:** DiscoverEU Companion team (brainstormed 2026-04-12)
**Target release:** Before 2026-04-22 (EACEA launch deadline)
**Sub-project:** 2 — bridges the remaining Tier 3 inclusion polish, the Tier 4 viral/memory pick, a new City/Country Guide layer added mid-brainstorm, and the final Tier 5 Turkish bonus card.

---

## 1. Context

The DiscoverEU Companion is a vanilla JS, no-build, single-page web app helping 18-year-olds plan their DiscoverEU trip across 33 European countries plus Western Balkans + Turkey. The north star is *EACEA / DG EAC Youth Unit amplification*; the positioning is *"accessible, green, and inclusive — lowering the threshold for participation."*

Tier 1 (MVP), Tier 2 (viral & amplification) and Tier 3 sub-project 1 (Inclusion data & map layers: Wheelmap, ILGA Rainbow Map, emergency info, fewer-opportunities mode, welcome wizard, 7-tab bar redesign) are live on GitHub Pages at `https://embeddedjedi.github.io/discovereu-companion/`.

This spec covers **sub-project 2**: a mixed bundle of features that together complete the "pre-launch competitive story" for the 2026-04-22 deadline. Sub-project 3 (DE/FR/ES/IT translations) stays separate and is not part of this spec. Several Tier 4 items (passive GPS journal, voice memory capsule, group vote, night arrival shield, pickpocket heatmap, smart packing assistant) are explicitly deferred to v1.1 to keep scope tight.

### 1.1 Why this bundle

1. **AI Route Suggestion** is the "big button" feature reviewers expect — delivering it signals we compete at a modern trip-planning standard.
2. **City Bingo + Daily Dare + Country Soundtrack + FutureMe** form the "viral/memory layer" — the `#DiscoverEUCompanion` shareable story.
3. **City & Country Guide** is the lived pain point surfaced mid-brainstorm by the user: *"I always worry about what to eat, what to do, when to go when I visit a new country/city for the first time."* This directly serves the EACEA "first-time traveller with fewer opportunities" framing and materially lowers the threshold for participation.
4. **Turkish consulate reminder** closes the Tier 5 Turkish bonus checklist — the last remaining card in `turkish-bonus.js`.

### 1.2 Scope boundary

**IN scope:**
- AI Route Suggestion (Groq, user-provided key, JSON mode, route hydration)
- City Bingo (5×5 universal + per-country bonus + optional photo evidence)
- Daily Dare (deterministic day-of-year rotation, streak counting)
- Country Soundtrack (Spotify embed, lazy iframe)
- FutureMe (localStorage sealed messages + .ics calendar reminder)
- Turkish consulate reminder (4th Turkish bonus card + .ics export)
- City & Country Guide (Wikivoyage-sourced static snapshot, 36 countries + ~72 cities, Country Detail accordions)
- New `Eğlence` (Fun) tab — 8th tab in the side panel
- Shared `.ics` helper (`js/utils/ics.js`) and image compression helper (`js/utils/image.js`)
- IndexedDB store `bingoPhotos` for Bingo photo evidence
- Service worker cache bump (`v3` → `v4`) with all new data files precached

**OUT of scope (deferred to v1.1 or sub-project 3):**
- DE/FR/ES/IT translations → sub-project 3
- Passive GPS trip journal
- Voice memory capsule (30 sec/day)
- Group Vote module
- Night Arrival Shield filter
- Pickpocket heatmap
- Smart Packing Assistant
- Deep personalisation wizard (beyond the minimal Welcome Wizard already shipped in sub-project 1)
- Gemini/OpenAI LLM alternatives (Groq-only for now)
- Spotify full-account auth (only the 30-sec-preview anonymous embed)
- Live Wikivoyage API fetches (only build-time curated snapshot)
- Push notifications / Notification API (consulate + FutureMe use .ics exports only)
- Backend of any kind

---

## 2. Goals

1. **Ship one credible AI feature** that integrates cleanly with the route builder (reservation warnings, seat credits, budget all reactive to AI-produced routes) while respecting the no-backend constraint.
2. **Give every visitor — even those without any AI key, without any Spotify login, offline on a train — a rich first-time-travel guide** for every country and its top cities in the DiscoverEU catalogue.
3. **Deliver a fun/memory layer** that earns organic sharing without resorting to push notifications or any tracking.
4. **Close the Turkish bonus layer** with the consulate appointment card that Turkish applicants asked for.
5. **Maintain hard constraints**: vanilla JS, no build step, WCAG AA, 375-px mobile, dark + light, i18n-first, CORS-friendly, offline-first PWA, secrets-free.
6. **Keep the tab bar scalable** — 7 → 8 tabs without reintroducing the clipping bug fixed in commit `ea7b67e`.

## 3. Non-goals

- Runtime Wikivoyage fetches. Data is a build-time snapshot, refreshed annually.
- Any LLM running without a user key. Zero-key demo mode was evaluated and dropped; the AI button is gated on the user providing their own Groq key.
- Any backend proxy, SMTP, push server, or managed service.
- Any binary asset checked into the repo (icons stay SVG-only).
- Any framework. Plain ES modules.
- DE/FR/ES/IT i18n work (sub-project 3).

---

## 4. Architecture

### 4.1 Data flow overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                         Static data snapshots                         │
│  data/guides.json          ← country + city guide (lazy)              │
│  data/bingo-challenges.json                                            │
│  data/daily-dares.json                                                 │
│  data/soundtracks.json                                                 │
│  data/tr-consulates.json                                               │
└────────────────┬───────────────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      js/data/loader.js (ext.)                         │
│  loadGuides() · getCountryGuide(id) · getCityGuide(id)                │
│  loadBingoChallenges() · loadDares() · loadSoundtracks()              │
│  loadConsulates()                                                      │
│  All lazy, in-memory cached, PWA-precached at SW v4                   │
└───┬──────────┬──────────┬──────────┬──────────┬──────────┬────────────┘
    │          │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌───────────┐ ┌────────┐ ┌────────────┐
│features│ │features│ │features│ │features/  │ │features│ │features/   │
│bingo.js│ │daily-  │ │sound-  │ │future-me  │ │ai-     │ │turkish-    │
│        │ │dare.js │ │track.js│ │.js        │ │assist  │ │bonus ext.  │
└───┬────┘ └───┬────┘ └───┬────┘ └─────┬─────┘ └───┬────┘ └─────┬──────┘
    │          │          │          │            │            │
    │          │          │          ▼            ▼            ▼
    │          │          │     ┌────────────────────────────────┐
    │          │          │     │ js/utils/ics.js (NEW)          │
    │          │          │     │ buildICS · downloadICS         │
    │          │          │     └────────────────────────────────┘
    │          │          │
    ▼          │          │      llm-groq.js (NEW) ──► api.groq.com
┌────────────┐ │          │      callGroq({key, systemPrompt, userMsg, jsonMode})
│ utils/img  │ │          │
│ compress + │ │          │
│ EXIF strip │ │          │
└────┬───────┘ │          │
     │         │          │
     ▼         │          │
┌────────────┐ │          │
│ IndexedDB  │ │          │
│ bingoPhotos│ │          │
└────────────┘ │          │
               │          │
               ▼          ▼
         ┌─────────────────────────────────────┐
         │              UI layer               │
         │  ui/fun-tab.js  (new Eğlence tab)   │
         │    ├─ bingo-tab.js                  │
         │    ├─ daily-dare card               │
         │    └─ future-me.js UI               │
         │  ui/ai-modal.js (header + route)    │
         │  ui/guide.js    (Country Detail)    │
         │  ui/country-detail.js (extended)    │
         │  ui/prep.js     (consulate card)    │
         └─────────────────────────────────────┘
```

### 4.2 Phased rollout

| Concern | Phase 1 (this spec) | Phase 2 (future, deferred) |
|---|---|---|
| City/Country guides | Static snapshot from Wikivoyage, hand-translated TR | Optional "refresh" button that calls Wikivoyage via CORS fetch |
| Guide refresh cadence | Manual re-run of `data-curator` pipeline twice a year | GitHub Actions monthly cron (blocked: billing lock) |
| AI provider | Groq only (Llama 3.1 70B) | Add Gemini adapter next to `llm-groq.js` without touching consumers |
| Consulate data | Static JSON, 27 Schengen states | Optional live VFS/iDATA availability check (none offer public API now) |
| Bingo photos | IndexedDB local only, never leaves device | Optional Wrapped-card collage (already scoped in Tier 2) |
| FutureMe | localStorage + .ics | None — no remote messaging planned ever |
| Daily Dare | Deterministic local rotation | None — push notifications explicitly rejected |
| Soundtrack | Spotify embed iframe, 30-sec previews | None — login is Spotify's own layer |

The adapter pattern from sub-project 1 (`features/inclusion-data.js`) is repeated for `data/loader.js` extensions so swapping sources in Phase 2 touches a single file.

---

## 5. Data schemas

All new files share the existing `version` + `generated` + `source(s)` + `note` envelope, matching `reservations.json`, `turkish-bonus.json`, `rainbow-map.json`, etc.

### 5.1 `data/guides.json` (new, lazy-loaded)

One unified file holding both country-level and city-level guides. Loaded on first Country Detail open, cached in-memory, precached by the service worker for offline use.

```json
{
  "version": 1,
  "generated": "2026-04-12",
  "sources": [
    "Wikivoyage (CC BY-SA 3.0, en.wikivoyage.org)",
    "EU Rail Passenger Rights (eurail.com)",
    "National tourism boards (public pages, summary only, fair-use excerpts)"
  ],
  "refreshPolicy": "Annual + ad-hoc when a major source updates. 'Contribute on GitHub' link on every card.",
  "countries": {
    "IT": {
      "summary": "…",
      "summaryTr": "…",
      "whenToGo": "…",
      "whenToGoTr": "…",
      "whatToEat": "…",
      "whatToEatTr": "…",
      "transport": "…",
      "transportTr": "…",
      "money": "…",
      "moneyTr": "…",
      "etiquette": "…",
      "etiquetteTr": "…",
      "safety": "…",
      "safetyTr": "…",
      "connectivity": "…",
      "connectivityTr": "…",
      "languageBasics": [
        { "phrase": "Buongiorno", "meaning": "Hello / Good morning" },
        { "phrase": "Grazie", "meaning": "Thank you" }
      ],
      "languageBasicsTr": [
        { "phrase": "Buongiorno", "meaning": "Merhaba / Günaydın" },
        { "phrase": "Grazie", "meaning": "Teşekkürler" }
      ],
      "avoidPitfalls": ["…", "…"],
      "avoidPitfallsTr": ["…", "…"],
      "lastUpdated": "2026-04",
      "sourceUrl": "https://en.wikivoyage.org/wiki/Italy"
    }
    // … 36 countries total (EU27 + IS/LI/NO + TR bonus + AL/BA/MK/RS context)
  },
  "cities": {
    "rome": {
      "countryId": "IT",
      "name": "Rome",
      "nameTr": "Roma",
      "minDays": 3,
      "budgetPerDayEUR": { "low": 45, "mid": 75, "high": 140 },
      "bestMonths": "Apr, May, Sep, Oct",
      "bestMonthsTr": "Nis, May, Eyl, Eki",
      "summary": "…",
      "summaryTr": "…",
      "mustSee": [
        { "name": "Colosseum + Roman Forum", "tip": "Buy combined ticket online, enter 08:30" }
      ],
      "mustSeeTr": [
        { "name": "Kolezyum + Roma Forumu", "tip": "Birleşik bileti online al, 08:30'da gir" }
      ],
      "mustEat": ["Cacio e pepe", "Supplì", "Gelato from a back-alley shop"],
      "mustEatTr": ["Cacio e pepe", "Supplì", "Arka sokaktaki bir dondurmacıdan gelato"],
      "localTransport": "Metro A + B, €1.50 single, 100-min validity.",
      "localTransportTr": "Metro A + B, tek yön 1.50 €, 100 dk geçerli.",
      "freeStuff": ["Pantheon entry", "Villa Borghese gardens", "Trevi Fountain at 06:00"],
      "freeStuffTr": ["Pantheon girişi", "Villa Borghese bahçeleri", "Trevi Çeşmesi sabah 06:00'da"],
      "safety": "…",
      "safetyTr": "…",
      "avoidTourist": ["Restaurants within 200m of Vatican"],
      "avoidTouristTr": ["Vatikan'a 200 m mesafedeki restoranlar"],
      "sourceUrl": "https://en.wikivoyage.org/wiki/Rome",
      "lastUpdated": "2026-04"
    }
    // … approximately 72 cities (2 per country; LI/MC/SM may ship with 1)
  }
}
```

**Selection rule for 2 cities per country** (data-curator authored list, spec-locked):

| Country | City 1 | City 2 | Notes |
|---|---|---|---|
| DE | Berlin | Munich | |
| FR | Paris | Lyon | |
| IT | Rome | Florence | |
| ES | Madrid | Barcelona | |
| NL | Amsterdam | Utrecht | |
| BE | Brussels | Ghent | |
| AT | Vienna | Salzburg | |
| CH | Zurich | Bern | Non-DiscoverEU |
| CZ | Prague | Brno | |
| PL | Warsaw | Kraków | |
| HU | Budapest | Debrecen | |
| PT | Lisbon | Porto | |
| GR | Athens | Thessaloniki | |
| SE | Stockholm | Gothenburg | |
| DK | Copenhagen | Aarhus | |
| FI | Helsinki | Turku | |
| IE | Dublin | Galway | |
| LU | Luxembourg City | — | 1 city |
| MT | Valletta | Mdina | |
| CY | Nicosia | Limassol | |
| HR | Zagreb | Split | |
| RO | Bucharest | Cluj-Napoca | |
| BG | Sofia | Plovdiv | |
| SK | Bratislava | Košice | |
| SI | Ljubljana | Maribor | |
| EE | Tallinn | Tartu | |
| LV | Riga | Jūrmala | |
| LT | Vilnius | Kaunas | |
| IS | Reykjavík | Akureyri | |
| LI | Vaduz | — | 1 city (micro-state) |
| NO | Oslo | Bergen | Non-DiscoverEU rail |
| TR | Istanbul | Izmir | Turkish bonus layer |
| AL | Tirana | Gjirokastër | Western Balkans context |
| BA | Sarajevo | Mostar | |
| MK | Skopje | Ohrid | |
| RS | Belgrade | Novi Sad | |

Total: ~70 cities (33 countries × 2 + 4 × 1 single-city), fits ~105 KB before gzip.

### 5.2 `data/bingo-challenges.json`

```json
{
  "version": 1,
  "generated": "2026-04-12",
  "note": "25 universal + per-country bonus challenges. Universal card is always 5×5 (index 0..24). Country bonuses unlock when the country is in state.route.stops.",
  "universal": [
    {
      "id": "uni-local-coffee",
      "emoji": "☕",
      "title": "Try a local coffee speciality",
      "titleTr": "Yerel bir kahve çeşidini dene",
      "hint": "Viennese melange, Italian espresso, Turkish coffee, Greek freddo — anything that isn't a chain",
      "hintTr": "Viyana melange, İtalyan espresso, Türk kahvesi, Yunan freddo — zincir olmayan herhangi bir şey",
      "category": "culinary"
    }
    // … 25 total across cultural / culinary / social / green / quirky
  ],
  "byCountry": {
    "IT": [
      {
        "id": "bonus-IT-gelato",
        "emoji": "🍨",
        "title": "Eat gelato from a shop with < 10 flavours",
        "titleTr": "10'dan az çeşidi olan bir gelatocudan dondurma ye",
        "hint": "Fewer flavours usually = artisanal",
        "hintTr": "Az çeşit genelde el yapımı demektir",
        "category": "culinary"
      }
    ]
    // … 1–2 bonus challenges per 36 countries
  }
}
```

**Categories:** `cultural | culinary | social | green | quirky`.

**Persistence split:**
- Completion map → `localStorage['discovereu_bingo']` = `{ completed: { [id]: true } }` (< 5 KB)
- Photo blobs → IndexedDB `discovereu.bingoPhotos`, key = `challengeId`, value = JPEG Blob (≤ 800 × 800 px, quality 0.7, EXIF stripped)

### 5.3 `data/daily-dares.json`

```json
{
  "version": 1,
  "generated": "2026-04-12",
  "note": "Deterministic rotation. Seed = (dayOfYear ^ FNV1a(YYYY)). If state.route.stops.length > 0, prefer dares whose preferredCountries intersects the route.",
  "dares": [
    {
      "id": "dare-newspaper",
      "emoji": "📰",
      "title": "Buy a local newspaper you can't fully read",
      "titleTr": "Tamamını okuyamayacağın yerel bir gazete satın al",
      "category": "cultural",
      "preferredCountries": [],
      "xp": 10
    }
    // … ~60 dares across cultural / culinary / social / green
  ]
}
```

**Selection algorithm:**

```
seed  = dayOfYear(today) ^ fnv1a(YYYY(today))
pool  = dares.filter(d => d.preferredCountries.length === 0
                       || d.preferredCountries.some(c => route.has(c)))
index = seed % pool.length
today = pool[index]
```

**State:**
```json
{
  "dares": {
    "completed": { "2026-04-12": true, "2026-04-13": true },
    "lastDareId": "dare-newspaper",
    "streak": 2
  }
}
```

Streak recomputed on app open: longest consecutive run of `completed[YYYY-MM-DD] === true` ending on today or yesterday.

### 5.4 `data/soundtracks.json`

```json
{
  "version": 1,
  "generated": "2026-04-12",
  "source": "Spotify official 'Top 50 - <Country>' editorial playlists",
  "sourceUrl": "https://open.spotify.com/genre/charts-regional",
  "note": "Playlist IDs are stable; Spotify refreshes contents daily. Countries without a regional Top 50 fall back to Global Top 50 with fallback:true.",
  "countries": {
    "DE": { "playlistId": "37i9dQZEVXbJiZcmkrIHGU", "title": "Top 50 — Germany", "fallback": false },
    "FR": { "playlistId": "37i9dQZEVXbIPWwFssbupI", "title": "Top 50 — France",  "fallback": false }
    // … 36 entries
  }
}
```

Embed URL pattern: `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=discovereu-companion`.

No auth, no CORS — `<iframe>` only. 30-second previews play anonymously; logged-in Spotify visitors get full tracks automatically.

### 5.5 `data/tr-consulates.json`

```json
{
  "version": 1,
  "generated": "2026-04-12",
  "note": "Schengen visa application centres in Türkiye. Most Schengen states outsource to VFS Global / iDATA / TLScontact / BLS. Refresh quarterly; providers occasionally change contracts.",
  "centres": [
    {
      "countryId": "DE",
      "countryName": "Germany",
      "countryNameTr": "Almanya",
      "provider": "iDATA",
      "website": "https://www.idata.com.tr",
      "cities": [
        { "name": "Istanbul",  "address": "…", "phone": "+90 …" },
        { "name": "Ankara",    "address": "…", "phone": "+90 …" },
        { "name": "Izmir",     "address": "…", "phone": "+90 …" },
        { "name": "Antalya",   "address": "…", "phone": "+90 …" },
        { "name": "Bursa",     "address": "…", "phone": "+90 …" },
        { "name": "Gaziantep", "address": "…", "phone": "+90 …" }
      ],
      "noteTr": "Randevu açılışı genelde 09:00. Yoğun dönemlerde 3-4 hafta bekleyiş."
    }
    // … 27 Schengen states
  ]
}
```

Scope: 27 Schengen member states only. Non-Schengen DiscoverEU participants (IE/CY/RO/BG/HR) don't require a Schengen visa for Turkish nationals and are excluded.

### 5.6 LocalStorage keys (new)

| Key | Type | Notes |
|---|---|---|
| `discovereu_bingo` | `{ completed: Map<id,bool> }` | Bingo completion state |
| `discovereu_dares` | `{ completed: Map<date,bool>, streak: n, lastDareId: id }` | Daily Dare + streak |
| `discovereu_future_msgs` | `Array<{id, message, createdAt, revealDate}>` | FutureMe messages |
| `discovereu_groq_key` | `string` | User-provided Groq API key |
| `discovereu_consulate_appt` | `{countryId, city, datetime, notes}` | Single appointment tracked |

Added to `PERSIST_KEYS` in `js/state.js`.

### 5.7 IndexedDB store (new)

| DB | Store | Key | Value | Notes |
|---|---|---|---|---|
| `discovereu` | `bingoPhotos` | `challengeId` (string) | `Blob` (JPEG) | EXIF stripped, ≤ 800×800, Q = 0.7 |

Database created on first photo attach. `js/utils/storage.js` gains `idbOpen(name, version)`, `idbPut(store, key, value)`, `idbGet(store, key)`, `idbDelete(store, key)`.

---

## 6. Module API signatures

### 6.1 New utilities

```js
// js/utils/ics.js
export function buildICS({ uid, summary, description, location, startDate, alarms }) {
  // RFC 5545 VCALENDAR + VEVENT + VALARM[] string builder
  // alarms: [{ minutesBefore: Number, description: String }]
  // Returns: complete iCalendar text
}
export function downloadICS(filename, icsText) {
  // Creates Blob, triggers <a download>
}
```

```js
// js/utils/image.js
export async function compressImage(file, maxDim = 800, quality = 0.7) {
  // Canvas resize + JPEG re-encode. Returns Blob.
  // EXIF is dropped automatically by canvas re-encode.
}
export async function stripExif(blob) { /* defensive fallback */ }
```

```js
// js/utils/storage.js — additions to existing module
export function idbOpen(dbName = 'discovereu', version = 1) { /* Promise<IDBDatabase> */ }
export async function idbPut(store, key, value) { /* Promise<void> */ }
export async function idbGet(store, key)        { /* Promise<any>  */ }
export async function idbDelete(store, key)     { /* Promise<void> */ }
```

### 6.2 AI Assistant

```js
// js/features/llm-groq.js
export class AuthError      extends Error {}
export class RateLimitError extends Error {}
export class NetworkError   extends Error {}
export class ParseError     extends Error {}

export async function callGroq({
  apiKey,
  systemPrompt,
  userMessage,
  jsonMode = false,
  model = 'llama-3.1-70b-versatile',
  signal
}) {
  // POST https://api.groq.com/openai/v1/chat/completions
  // Throws typed errors for 401/429/5xx/abort
  // Returns { content, usage }
}
```

```js
// js/features/ai-assistant.js
import { callGroq } from './llm-groq.js';
import { loadGuides } from '../data/loader.js';

export async function suggestRoute({ userPrompt, state, signal }) {
  // 1. Load guides for top-10 relevant country contexts (tokens kept under ~4000)
  // 2. Build system prompt (DiscoverEU rules, country IDs, user state, language)
  // 3. Call Groq in JSON mode
  // 4. Validate returned JSON: stops[].countryId must exist in countries.json,
  //    stops[].nights must be 1..14, total travelDays ≤ 30
  // 5. Return { stops, rationale, usage } or throw typed error
}

export function initAITrigger(btnSelector) {
  // Attaches a click handler to any element matching selector.
  // Clicking opens the AI modal.
}
```

```js
// js/ui/ai-modal.js
export function openAIModal({ state, onRouteSelected }) {
  // Steps:
  //   1. If !localStorage['discovereu_groq_key'] → key-entry screen
  //   2. Prompt screen with quick-start chips
  //   3. Loading state with AbortController-wired cancel
  //   4. Result screen with Replace / Add / Retry actions
  //   5. Error states: auth / rate / parse / network
  // onRouteSelected({stops, mode: 'replace'|'add'}) dispatched on action
}
```

Modal appends itself to the main `.modal-overlay` container (reused from Wrapped modal). Focus trap via existing helper.

### 6.3 City Bingo

```js
// js/features/bingo.js
export async function loadBingoChallenges() { /* data/bingo-challenges.json */ }

export function getActiveCard(route, bingoData) {
  // Returns: { universal: [...25 challenges], bonuses: [...perCountry filtered] }
}
export function markDone(challengeId)   { /* write localStorage */ }
export function markUndone(challengeId) { /* write localStorage */ }
export function isDone(challengeId)     { /* read localStorage */ }

export function detectBingoLines(completedIds) {
  // Scans 5 rows + 5 cols + 2 diagonals
  // Returns: [{ type: 'row'|'col'|'diag', index: n, ids: [...] }]
}

export async function attachPhoto(challengeId, file) {
  const blob = await compressImage(file);
  await idbPut('bingoPhotos', challengeId, blob);
}
export async function getPhoto(challengeId)    { /* idbGet */ }
export async function removePhoto(challengeId) { /* idbDelete */ }
```

```js
// js/ui/bingo-tab.js
export function renderBingo(container, state) {
  // Renders header (progress counter), 5×5 grid, bonus strip, legend
  // Each cell: <button> with emoji + short title + done indicator + photo thumb
  // Click opens challenge modal with photo upload + done toggle
}
```

### 6.4 Daily Dare

```js
// js/features/daily-dare.js
export async function loadDares() { /* data/daily-dares.json */ }

export function pickTodaysDare(dares, route, today = new Date()) {
  // Deterministic seeded selection (see 5.3 algorithm)
}

export function markDareDone(dateKey = isoDay(new Date())) {
  // Write completed[dateKey] = true, recompute streak
}
export function skipToday() {
  // Write completed[dateKey] = 'skipped', streak resets if not yesterday-continued
}
export function getStreak() { /* returns int */ }

export function renderDareCard(container, dare) {
  // Shared renderer used by both Eğlence tab sub-tab 2 and Prep tab summary
}
```

### 6.5 Country Soundtrack

```js
// js/features/soundtrack.js
export async function loadSoundtracks() { /* data/soundtracks.json */ }

export function getPlaylistFor(countryId, soundtracks) {
  // { playlistId, title, fallback } or null
}

export function renderSoundtrackAccordion(container, countryId) {
  // <details> element whose <summary> is i18n label + play icon
  // The inner <iframe src="..."> is injected only when the <details> opens
  // (toggle event listener). Bandwidth-conscious, EACEA-green-story friendly.
}
```

### 6.6 FutureMe

```js
// js/features/future-me.js
import { buildICS, downloadICS } from '../utils/ics.js';

export function listMessages() { /* from localStorage */ }
export function addMessage({ message, revealDate }) {
  // Generates UUID id, writes to localStorage, returns id
}
export function deleteMessage(id)       { /* */ }
export function isRevealed(msg)         { /* Date.now() >= new Date(msg.revealDate) */ }
export function getDaysUntilReveal(msg) { /* int */ }

export function exportToCalendar(msg) {
  const ics = buildICS({
    uid: `futureme-${msg.id}@discovereu-companion`,
    summary: 'DiscoverEU FutureMe — mesajın hazır',
    description: 'discovereu-companion sitesini aç ve Eğlence → Gelecek Bana sekmesinde mesajını oku.',
    startDate: new Date(msg.revealDate),
    alarms: [
      { minutesBefore: 0,  description: 'Mesajın bugün hazır' }
    ]
  });
  downloadICS(`futureme-${msg.revealDate}.ics`, ics);
}
```

### 6.7 Consulate reminder (Turkish bonus extension)

```js
// js/features/turkish-bonus.js — additive
import { buildICS, downloadICS } from '../utils/ics.js';

export async function loadConsulates() { /* data/tr-consulates.json */ }

export function getConsulate(countryId, cityName) {
  // Returns matching centre city entry or null
}

export function saveAppointment({ countryId, city, datetime, notes }) {
  state.user.consulateAppointment = { countryId, city, datetime, notes };
  persistUserState();
}
export function clearAppointment() { /* */ }

export function renderConsulateCard(container) {
  // 4th card in Prep tab (alongside Schengen checklist, Sofia Express, TL tips)
  // Shows countdown if appointment set; "Add appointment" empty state otherwise
  // Document checklist reuses existing Schengen list from turkish-bonus.json
}

export function exportAppointmentICS(appt, consulate) {
  const ics = buildICS({
    uid: `consulate-${appt.countryId}-${appt.datetime}@discovereu-companion`,
    summary: `Konsolosluk randevusu — ${consulate.countryNameTr}`,
    description: 'Belgeler checklist: pasaport, biyometrik foto, sigorta (€30k), mali kanıt (€50/gün), DiscoverEU davet mektubu, randevu çıktısı.',
    location: `${consulate.provider} — ${appt.city}`,
    startDate: new Date(appt.datetime),
    alarms: [
      { minutesBefore: 1440, description: '1 gün sonra konsolosluk randevun' },
      { minutesBefore: 120,  description: '2 saat sonra konsolosluk randevun' }
    ]
  });
  downloadICS(`consulate-${appt.datetime.slice(0,10)}.ics`, ics);
}
```

### 6.8 Guide loader + UI

```js
// js/data/loader.js — additions
let _guidesCache = null;
export async function loadGuides() {
  if (_guidesCache) return _guidesCache;
  const res = await fetch('data/guides.json');
  _guidesCache = await res.json();
  return _guidesCache;
}
export async function getCountryGuide(countryId) {
  const g = await loadGuides();
  return g.countries[countryId] ?? null;
}
export async function getCityGuide(cityId) {
  const g = await loadGuides();
  return g.cities[cityId] ?? null;
}
export async function listCitiesForCountry(countryId) {
  const g = await loadGuides();
  return Object.entries(g.cities)
    .filter(([, c]) => c.countryId === countryId)
    .map(([id]) => id);
}
```

```js
// js/ui/guide.js
export async function renderCountryGuideAccordion(container, countryId) {
  // <details open="false"> with 10 sub-sections (summary, whenToGo, whatToEat,
  // transport, money, etiquette, safety, connectivity, languageBasics, avoidPitfalls)
  // Each section lazy-renders on open; language switch re-renders in place
}
export async function renderCitiesAccordion(container, countryId) {
  // Top-level <details> "Top Cities (N)"
  // For each cityId: nested <details> calling renderCityGuide()
}
export async function renderCityGuide(container, cityId) {
  // mustSee, mustEat, freeStuff, localTransport, safety, avoidTourist, minDays, bestMonths
}
```

### 6.9 Fun (Eğlence) tab

```js
// js/ui/fun-tab.js
export function renderFunTab(container) {
  // Sub-tab bar [Bingo | Daily Dare | FutureMe]
  // Sub-tab state is local (not persisted), resets on tab-leave
  // Keyboard ←/→ nav between sub-tabs
  // Each sub-tab calls its renderer into the content panel
}
```

### 6.10 Dependency graph (no cycles)

```
main.js
  ├─ ui/ai-modal.js  ──► features/ai-assistant.js  ──► features/llm-groq.js
  │                                              └──► data/loader.js (guides)
  ├─ ui/fun-tab.js   ──► features/bingo.js       ──► utils/image.js
  │                                              └──► utils/storage.js (IDB)
  │                  ──► features/daily-dare.js  ──► data/loader.js
  │                  ──► features/future-me.js   ──► utils/ics.js
  ├─ ui/country-detail.js (extended)
  │                  ──► ui/guide.js             ──► data/loader.js
  │                  └──► features/soundtrack.js ──► data/loader.js
  └─ ui/prep.js (extended)
                     ──► features/turkish-bonus.js (extended) ──► utils/ics.js
                                                              └──► data/loader.js
```

Rule: `features/*` never imports from `ui/*`.

---

## 7. State shape additions

```js
// js/state.js — new slices
{
  // PERSISTED
  user: {
    ...existing,
    consulateAppointment: { countryId, city, datetime, notes } | null
  },
  bingo: {
    completed: { [challengeId]: true }
  },
  dares: {
    completed: { [YYYY-MM-DD]: true | 'skipped' },
    lastDareId: string | null,
    streak: number
  },
  futureMessages: Array<{ id, message, createdAt, revealDate }>,
  ai: {
    groqKey: string | null,      // mirrors localStorage key for reactivity
    lastSuggestion: object | null // ephemeral — stored for retry UX, not persisted
  },

  // EPHEMERAL (not in PERSIST_KEYS)
  activeFunSubtab: 'bingo' | 'dares' | 'futureMe'
}
```

`PERSIST_KEYS` extended with: `user` (already persisted, new sub-key), `bingo`, `dares`, `futureMessages`.

`state.ai.groqKey` is persisted in `localStorage['discovereu_groq_key']` through `utils/storage.js` namespaced helpers (not via the standard state persistence path, to keep the reactive store clean of user secrets).

---

## 8. UI surface changes

### 8.1 Tab bar — 7 → 8

New tab: **Eğlence** (icon: `sparkles` from Lucide, tr label "Eğlence", en label "Fun").

- Desktop (≥ 768 px): icon + full label horizontal row, all 8 tabs fit within `.panel-tabs` (tested at 1440 × 900 and 1280 × 800)
- Tablet (420–767 px): icon + abbreviated 3-letter label
- Mobile (< 420 px): icon-only, 44 × 44 px touch targets, 8 tabs split the screen width evenly (~46 px each on 375 px wide viewports — still ≥ 44 px safe hit area because margins are shared)

No horizontal scroll. The Tier 3 clip-fix stays intact.

### 8.2 AI modal

Lives in the existing `.modal-overlay` container. Invoked from:
1. Header `✨ AI Öneri` button (new)
2. Route tab empty state card `[✨ Let AI suggest your route]` CTA

Three screens stacked in the same modal container (step-wise): key entry → prompt → result. `Esc` always closes. Focus trap on open, focus restore on close.

### 8.3 Eğlence tab layout

```
[Sub-tab bar: Bingo · Daily Dare · FutureMe]
[Content panel, re-rendered on sub-tab switch]
```

- `role="tablist"` + `role="tab"` + `role="tabpanel"` (mirrors main panel tab bar)
- Local `activeFunSubtab` state, not persisted
- Bingo sub-tab: 5×5 grid + bonus strip + legend. Cell click → challenge modal with photo upload + done toggle
- Daily Dare sub-tab: single large card with today's dare, streak badge, done/skip actions
- FutureMe sub-tab: list of sealed + opened messages, `[+ New message]` button → compose modal

### 8.4 Country Detail tab additions

Three new `<details>` sections appended after the existing "Add to route / Compare" actions:

1. **🗺️ Country Guide** — 10 sub-sections, lazy-rendered
2. **🏙️ Top Cities (N)** — nested `<details>`, one per top city
3. **🎵 Country Playlist** — single Spotify iframe, src injected only when open

Dark/light themed via `--color-surface` + `--color-border`. Spotify iframe adopts system theme automatically.

### 8.5 Prep tab — Consulate card

Added as the 4th Turkish bonus card (after Schengen checklist, Sofia Express, TL tips). Only visible when:
- `state.language === 'tr'` OR
- `state.user.homeCountry === 'TR'` OR
- First route stop's country === 'TR'

Empty state: `[+ Randevu ekle]` → opens a simple form modal. Filled state: countdown + location + documents checklist (reuses Schengen checklist from existing `turkish-bonus.json`) + `[📅 Takvime ekle]`, `[✏️ Düzenle]`, `[🗑 Sil]` actions.

### 8.6 Responsive breakpoints

Unchanged from design-system; new components tested at:
- 375 × 667 (iPhone SE) — bottom nav 8 icons, modal full-screen, bingo grid scrolls if necessary
- 768 × 1024 (iPad) — side panel fills right half, bingo grid fits
- 1440 × 900 (desktop) — all new accordions render without wrapping

### 8.7 Dark/light compliance

All new components use existing CSS custom properties exclusively:
- `--color-surface`, `--color-surface-alt`, `--color-border`
- `--color-text`, `--color-text-muted`
- `--color-accent`, `--color-success`, `--color-warning`, `--color-danger`
- `--shadow-sm`, `--shadow-md`
- `--space-*`, `--radius-*`, `--motion-*`

Zero hardcoded colours. Contrast ratios AA-compliant by inheritance.

---

## 9. i18n keys

New key namespace in `i18n/en.json` and `i18n/tr.json`. Both files extended symmetrically. DE/FR/ES/IT remain untouched (sub-project 3).

New top-level blocks (~100 keys × 2 languages = ~200 strings):

- `tabs.fun` — "Fun" / "Eğlence"
- `fun.subtab.*` — bingo / dares / futureMe labels
- `ai.*` — modal title, key entry, prompt, quickstart chips, loading, result, errors
- `bingo.*` — title, progress, universal, bonus, cell detail, photo actions, done states, line/full-card celebration
- `dares.*` — title, today badge, streak, done/skip, XP, category labels
- `futureMe.*` — title, new button, sealed state, reveal countdown, calendar export, form labels, preset periods, delete confirm
- `soundtrack.*` — title, open-to-play, fallback note, Spotify attribution
- `consulate.*` — title, empty state, countdown, form labels, provider note, docs title, actions, alarms note
- `guide.*` — country title, top cities title, 15 section labels, lastUpdated, source, contribute link

Interpolation (`{{variable}}`) is already supported by `js/i18n/i18n.js`; used for:
- `dares.streak` — `{{days}}`
- `consulate.countdown` — `{{days}} days {{hours}} hours`
- `futureMe.revealedIn` — `{{days}}`
- `futureMe.revealsOn` — `{{date}}`
- `bingo.progress` — `{{done}} / {{total}}`
- `guide.lastUpdated` — `{{date}}`

Dynamic JSON content (guides, bingo challenges, dares) carries inline `foo`/`fooTr` fields and is not routed through `i18n.js`. The render layer reads `state.language === 'tr' ? obj.fooTr : obj.foo`, matching the pattern established in sub-project 1 (`inclusion.js`).

A small `scripts/i18n-diff.py` helper is added to verify en.json and tr.json have identical key trees.

---

## 10. Testing & acceptance

### 10.1 Playwright MCP smoke tests

Committed as `test/tier4-subproject2-smoke.md`, mirroring the Tier 3 format. Each scenario is one inline Playwright session using the main agent (subagents have no MCP access).

| # | Scenario | Pass criterion |
|---|---|---|
| S1 | Fun tab opens, 3 sub-tabs visible | 8-tab bar, Fun active, 3 chips |
| S2 | Bingo grid renders 5×5 | 25 cells, each ≥ 44 × 44 px, emoji visible |
| S3 | Mark challenge done → strike + counter | `3/25` → `4/25` |
| S4 | Bingo photo upload → thumbnail visible | IDB has 1 blob, `<img>` in cell |
| S5 | Daily Dare shows today's dare | Deterministic seed check, streak shown |
| S6 | FutureMe create + sealed state | Sealed card in list with countdown |
| S7 | FutureMe .ics export | File downloads, content has `BEGIN:VCALENDAR` + `BEGIN:VEVENT` |
| S8 | Country Detail Country Guide accordion | 10 sections render on open |
| S9 | Country Detail Top Cities accordion | Two city sub-accordions each render must-see + must-eat |
| S10 | Country Detail Soundtrack lazy iframe | `iframe.src` empty on close, set on open |
| S11 | AI modal (no key) → key screen | Key input + help link |
| S12 | AI modal (dummy key) → prompt screen | Textarea + quick-start chips |
| S13 | AI modal → mock Groq response → replace route | `state.route.stops` hydrated |
| S14 | AI modal error states | 401 / 429 / parse / network each show correct toast |
| S15 | Consulate form → Prep card | State persisted, countdown accurate |
| S16 | Consulate .ics export | Contains 2 `VALARM` blocks (-1d, -2h) |
| S17 | i18n tr ↔ en switch | All new strings update, no hardcoded English |
| S18 | Dark mode screenshot parity | All new cards respect `--color-surface` |
| S19 | 375 px mobile bottom nav | 8 icons fit, touch targets ≥ 44 × 44 |
| S20 | PWA offline — guides.json + new JSON precached | `caches.match()` returns response |

### 10.2 Headless validation

```bash
# JSON parse checks
for f in data/guides.json data/bingo-challenges.json data/daily-dares.json \
         data/soundtracks.json data/tr-consulates.json; do
  python -c "import json; json.load(open('$f',encoding='utf-8')); print('$f OK')"
done

# i18n symmetry (new helper script)
python scripts/i18n-diff.py en tr

# HTTP 200 via dev server
for f in data/guides.json data/bingo-challenges.json data/daily-dares.json \
         data/soundtracks.json data/tr-consulates.json; do
  curl -s -o /dev/null -w "$f %{http_code}\n" http://localhost:8765/$f
done
```

### 10.3 Definition of Done

The sub-project is complete when:

1. ✅ All 7 features are live on `https://embeddedjedi.github.io/discovereu-companion/`
2. ✅ All 20 smoke tests in `test/tier4-subproject2-smoke.md` pass, log committed
3. ✅ Headless JSON validation + i18n symmetry passing
4. ✅ `PROGRESS.md` updated: Tier 3/4 items moved to Done, decisions appended
5. ✅ `SOURCES.md` has Wikivoyage (CC BY-SA), Spotify, Groq, ILGA, Wheelmap attributions
6. ✅ Service worker cache version bumped `v3 → v4`; all new data files precached
7. ✅ `i18n/en.json` + `i18n/tr.json` complete; zero hardcoded English in new markup
8. ✅ 375 px, 768 px, 1440 px screenshots captured in light + dark modes
9. ✅ `main` branch pushed; GitHub Pages deploy verified by curl against live URL
10. ✅ No axe-core AA regressions vs sub-project 1 baseline

---

## 11. Rollout sequence (commit-level granularity)

Full task breakdown lives in `docs/superpowers/plans/2026-04-12-sub-project-2-plan.md` (written in Phase 2). High-level order:

1. **Data layer** — 5 new JSON files (guides, bingo, dares, soundtracks, tr-consulates) — 5 commits, mostly data-curator + research-scout
2. **Utilities** — `utils/ics.js`, `utils/image.js`, `utils/storage.js` IDB additions — 3 commits
3. **Loader extensions** — `data/loader.js` gains lazy guide/bingo/dares/soundtracks/consulates loaders — 1 commit
4. **State shape** — `state.js` new slices + persistence keys — 1 commit
5. **LLM adapter** — `features/llm-groq.js` — 1 commit
6. **AI feature + modal** — `features/ai-assistant.js` + `ui/ai-modal.js` + header trigger + Route tab empty-state CTA — 2 commits
7. **Guide UI** — `ui/guide.js` + Country Detail accordion wiring — 2 commits
8. **Soundtrack** — `features/soundtrack.js` + Country Detail accordion — 1 commit
9. **Bingo feature + UI** — `features/bingo.js` + `ui/bingo-tab.js` + cell modal — 2 commits
10. **Daily Dare** — `features/daily-dare.js` + Eğlence sub-tab + Prep summary — 1 commit
11. **FutureMe** — `features/future-me.js` + Eğlence sub-tab + compose modal — 1 commit
12. **Fun tab shell** — `ui/fun-tab.js` + tab bar update (7 → 8 tabs) + mobile bottom nav mirror — 2 commits (shell first, wiring after)
13. **Consulate reminder** — `turkish-bonus.js` extension + Prep card + form modal — 1 commit
14. **i18n** — en.json + tr.json blocks — 1 commit
15. **CSS polish** — new component styles, modal variants, dark/light audit — 1–2 commits
16. **Service worker cache v4** — precache new JSON files — 1 commit
17. **Smoke tests** — 20 scenarios, committed log — 1 commit
18. **PROGRESS.md + SOURCES.md + decisions log** — 1 commit
19. **Push to main** — single push after all above, GitHub Pages deploy verification

Approximate task count: **26–28**. Matches Tier 3 sub-project 1 complexity (22 tasks) plus the City/Country Guide addendum (+6) and the consulate card (+1).

---

## 12. Open questions

None at spec write-time. The following were raised and resolved during brainstorming:

| Q | Resolution |
|---|---|
| AI provider: Groq or Gemini? | Groq (Llama 3.1 70B versatile), JSON mode, user-provided key |
| Can AI work without a user key? | No — evaluated hybrid rule-based fallback, user chose Katman 2 (key-gated) only |
| Bingo persistence: localStorage or IDB? | Both — state in localStorage, photos in IndexedDB |
| Bingo photo support: in or out? | In, with EXIF strip + client-side compression |
| Daily Dare push notifications? | No — silent deterministic rotation, `[✓ Done]` + `[Skip]` in-app |
| Spotify login requirement? | No — iframe embed plays 30-sec previews anonymously |
| Spotify alternative (YouTube, Deezer)? | Rejected — Spotify embed is zero-maintenance + EU-native |
| FutureMe: email or localStorage? | localStorage + optional .ics reminder (no SMTP, no backend) |
| Consulate reminder: push or .ics? | .ics calendar export with two VALARM reminders |
| City Guide: live API or snapshot? | Build-time snapshot (Wikivoyage → data-curator → static JSON) |
| City Guide: how many cities? | 2 per country × 36 = ~70 (with LI/LU/etc. as 1-city exceptions) |
| City Guide + Country Guide in one file? | Yes — `data/guides.json` unified, lazy-loaded |
| New tab vs cram into Prep? | New tab: `Eğlence` (8th) housing Bingo + Daily Dare + FutureMe |
| AI Assistant as modal vs panel? | Modal (reuses existing `.modal-overlay`, doesn't compete with Route tab) |

---

## 13. Decisions log (for PROGRESS.md)

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-12 | AI provider: Groq (Llama 3.1 70B), user-provided key, JSON mode | Free tier, CORS-friendly browser calls, structured output enables route hydration |
| 2026-04-12 | No key-free AI fallback | Rule-based rival was considered but scope-cut — user chose AI Katman 2 only |
| 2026-04-12 | City/Country guide via build-time Wikivoyage snapshot | Offline-first PWA story, TR translations, reviewer-inspectable, 40 min/year maintenance |
| 2026-04-12 | Two cities per country (top-city list spec-locked) | ~70 cities fits ~100 KB pre-gzip, depth without bloat |
| 2026-04-12 | Unified `data/guides.json` (country + city) | Single lazy fetch, simpler SW precache, simpler cache eviction |
| 2026-04-12 | New 8th tab `Eğlence` housing Bingo + Daily Dare + FutureMe | Prep tab already crowded; dedicated surface aids discoverability |
| 2026-04-12 | Bingo photos in IndexedDB, state in localStorage | State is < 5 KB (localStorage is fine); photos as blobs need IDB |
| 2026-04-12 | Bingo photos never leave the device | Privacy-first, bolsters EACEA inclusion story |
| 2026-04-12 | Daily Dare deterministic day-of-year rotation, no push | iOS Safari push is broken; rotation works offline + PWA-friendly |
| 2026-04-12 | Spotify iframe embed only, no auth | CORS-safe, 30-sec previews work anonymously, zero maintenance |
| 2026-04-12 | FutureMe localStorage + .ics calendar export, no SMTP | No backend; .ics gives a portable reminder anchor |
| 2026-04-12 | Consulate reminder = Prep tab 4th Turkish card + .ics | Reuses existing turkish-bonus surface; .ics alarms substitute for push |
| 2026-04-12 | Shared `utils/ics.js` for FutureMe + consulate | Single module both features depend on; no duplication |

---

*End of spec.*
