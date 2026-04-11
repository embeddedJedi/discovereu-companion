# Sub-project 2 — AI Assistant, Fun Layer, City Guide & Consulate Reminder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 7 pre-launch competitive-story features (AI Route Suggestion via Groq, City Bingo with photo evidence, Daily Dare, Country Soundtrack, FutureMe time capsule, Turkish consulate reminder, Wikivoyage City/Country Guide), a new 8th "Eğlence" tab housing Bingo/Daily Dare/FutureMe, two shared utilities (`utils/ics.js`, `utils/image.js`), an IndexedDB-backed `bingoPhotos` store, and a PWA cache bump to `v4` — all vanilla JS, no build step, offline-first, secrets-free.

**Architecture:** Six new static JSON snapshots (guides, bingo-challenges, daily-dares, soundtracks, tr-consulates) join the existing `data/*.json` fleet and are lazy-fetched via `js/data/loader.js` extensions. New `features/*.js` modules (llm-groq, ai-assistant, bingo, daily-dare, future-me, soundtrack) own logic; they never import from `ui/*`. New `ui/ai-modal.js`, `ui/guide.js`, `ui/bingo-tab.js`, `ui/fun-tab.js` own presentation and subscribe to `state` slices. The existing `.modal-overlay` pattern is reused for the AI modal, Bingo cell detail, FutureMe compose, and consulate appointment forms — no new modal system. The 7-tab bar from sub-project 1 grows to 8 tabs via a grid column bump and one extra markup block. `state.js` gains `bingo`, `dares`, `futureMessages`, `activeFunSubtab`, `ai`, and `user.consulateAppointment`. `localStorage` handles state and the Groq key; `IndexedDB` store `bingoPhotos` holds EXIF-stripped JPEG blobs. `utils/ics.js` is shared by FutureMe and the consulate reminder; `utils/image.js` is shared by Bingo photo attach.

**Tech Stack:** Vanilla HTML + ES modules + CSS (no build step), Leaflet 1.9 (CDN), Chart.js 4 (CDN), LZ-string (CDN), jsPDF + html2canvas (CDN, already loaded), Groq REST API (`https://api.groq.com/openai/v1/chat/completions`, Llama 3.1 70B, user-provided key), Spotify embed iframes (`https://open.spotify.com/embed/playlist/…`, no auth), Wikimedia Wikivoyage (build-time content only, CC BY-SA 3.0), `localStorage` (state + secrets), `IndexedDB` (bingo photo blobs), existing service worker (`sw.js`) for offline precache.

---

## Reference documents

- **Spec:** `docs/superpowers/specs/2026-04-12-sub-project-2-design.md` (commit `33ea99c`, 1031 lines, 13 sections — every decision in this plan maps back to a section there)
- **Sub-project 1 plan (format reference):** `docs/superpowers/plans/2026-04-11-tier3-data-map-layers-plan.md`
- **CLAUDE.md hard rules:** vanilla only, no build step, data in JSON, WCAG AA, 375-px responsive, dark + light themes, i18n-first, CORS-friendly, no framework sneak-ins, comments in English, chat in Turkish
- **PROGRESS.md** single source of truth — updated in the final task (T28)

## Development environment

**Start the local server once, keep it running in the background:**

```bash
python -m http.server 8765
```

Every Playwright MCP smoke test navigates against `http://localhost:8765/`. If the browser profile lock error (`C:\Users\KingOfSpace\AppData\Local\ms-playwright\mcp-chrome-88d3e83`) blocks you, run the PowerShell `Get-WmiObject` kill workaround from `feedback_browser_lock.md` memory. Do not work around the lock with `--isolated` — it creates orphaned profiles.

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

Work directly on `main`. The project is single-developer and CLAUDE.md explicitly allows direct commits during sprint. Each task produces one commit with a unique, conventional message (the autonomous execution loop maps plan tasks → git-log subjects, so the messages here must match what gets committed byte-for-byte). **Push only in Task 28** — no intermediate pushes.

## Agent dispatch hints

| Task type | Preferred subagent |
|---|---|
| JSON data authoring (sources, translations, schemas) | `data-curator` |
| Web research for data sources or source attributions | `research-scout` (run in parallel with data-curator when helpful) |
| `js/features/*.js`, `js/data/loader.js`, `js/state.js`, `js/utils/*.js` | `feature-engineer` |
| `js/ui/*.js`, `index.html`, `css/*.css` | `ui-designer` |
| `i18n/*.json` | `data-curator` |
| Smoke tests against Playwright MCP, `PROGRESS.md` + `SOURCES.md` docs, final push | **main agent** (subagents have no Playwright MCP access and no push authority) |

---

## Task 1: Create `data/guides.json`

**Files:**
- Create: `data/guides.json`

**Source material:** Wikivoyage (CC BY-SA 3.0, `https://en.wikivoyage.org/`) for every country and city entry. National tourism boards for money/etiquette/safety nuances (public pages, summary/fair-use only). Dispatch `research-scout` in parallel with `data-curator` — research-scout pulls the raw Wikivoyage sections for the 36 countries and 70 cities named in spec Section 5.1; data-curator normalises them into the schema below, hand-translates all `…Tr` fields, and commits.

**Preferred agent type:** `data-curator` primary, `research-scout` helper.

- [ ] **Step 1: Write the envelope and one fully populated country + one fully populated city as a schema reference**

Create `data/guides.json` with exactly this envelope (fill `IT` and `rome` from Wikivoyage — no placeholders):

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
        { "phrase": "Grazie", "meaning": "Thank you" },
        { "phrase": "Scusi", "meaning": "Excuse me" }
      ],
      "languageBasicsTr": [
        { "phrase": "Buongiorno", "meaning": "Merhaba / Günaydın" },
        { "phrase": "Grazie",     "meaning": "Teşekkürler" },
        { "phrase": "Scusi",      "meaning": "Affedersiniz" }
      ],
      "avoidPitfalls":   ["…", "…"],
      "avoidPitfallsTr": ["…", "…"],
      "lastUpdated": "2026-04",
      "sourceUrl":   "https://en.wikivoyage.org/wiki/Italy"
    }
  },
  "cities": {
    "rome": {
      "countryId": "IT",
      "name":   "Rome",
      "nameTr": "Roma",
      "minDays": 3,
      "budgetPerDayEUR": { "low": 45, "mid": 75, "high": 140 },
      "bestMonths":   "Apr, May, Sep, Oct",
      "bestMonthsTr": "Nis, May, Eyl, Eki",
      "summary":   "…",
      "summaryTr": "…",
      "mustSee": [
        { "name": "Colosseum + Roman Forum", "tip": "Buy combined ticket online, enter 08:30" }
      ],
      "mustSeeTr": [
        { "name": "Kolezyum + Roma Forumu", "tip": "Birleşik bileti online al, 08:30'da gir" }
      ],
      "mustEat":   ["Cacio e pepe", "Supplì", "Gelato from a back-alley shop"],
      "mustEatTr": ["Cacio e pepe", "Supplì", "Arka sokaktaki bir dondurmacıdan gelato"],
      "localTransport":   "Metro A + B, €1.50 single, 100-min validity.",
      "localTransportTr": "Metro A + B, tek yön 1.50 €, 100 dk geçerli.",
      "freeStuff":   ["Pantheon entry", "Villa Borghese gardens", "Trevi Fountain at 06:00"],
      "freeStuffTr": ["Pantheon girişi", "Villa Borghese bahçeleri", "Trevi Çeşmesi sabah 06:00'da"],
      "safety":   "…",
      "safetyTr": "…",
      "avoidTourist":   ["Restaurants within 200m of Vatican"],
      "avoidTouristTr": ["Vatikan'a 200 m mesafedeki restoranlar"],
      "sourceUrl":   "https://en.wikivoyage.org/wiki/Rome",
      "lastUpdated": "2026-04"
    }
  }
}
```

- [ ] **Step 2: Populate all 36 countries**

The key must be the ISO code from `data/countries.json` (DE, FR, IT, ES, NL, BE, AT, CH, CZ, PL, HU, PT, GR, SE, DK, FI, IE, LU, MT, CY, HR, RO, BG, SK, SI, EE, LV, LT, IS, LI, NO, TR, AL, BA, MK, RS). Every field in the `IT` reference must be filled for every country — no empty strings, no `null` placeholders. `languageBasics` / `…Tr` arrays have at least 3 entries each. `avoidPitfalls` / `…Tr` arrays have at least 2 entries each. Hand-write the Turkish translations — no machine translation.

- [ ] **Step 3: Populate all ~70 cities per spec Section 5.1**

Use the spec-locked city list exactly (DE→Berlin+Munich, FR→Paris+Lyon, …, LU→Luxembourg City only, LI→Vaduz only). City keys must be lowercase, ASCII, hyphenated (`berlin`, `luxembourg-city`, `novi-sad`). `countryId` must match an existing `countries` key. `mustSee` / `mustSeeTr` have at least 3 items; `mustEat` / `…Tr` at least 3; `freeStuff` / `…Tr` at least 3; `avoidTourist` / `…Tr` at least 1. `budgetPerDayEUR` uses realistic 2026 numbers.

- [ ] **Step 4: Validate the JSON parses and counts match**

Run:
```bash
python -c "
import json
d = json.load(open('data/guides.json', encoding='utf-8'))
countries = d['countries']
cities = d['cities']
print('countries:', len(countries))
print('cities:', len(cities))
assert len(countries) == 36, f'expected 36 countries, got {len(countries)}'
assert 65 <= len(cities) <= 80, f'expected ~70 cities, got {len(cities)}'
required_country_keys = {'summary','summaryTr','whenToGo','whenToGoTr','whatToEat','whatToEatTr','transport','transportTr','money','moneyTr','etiquette','etiquetteTr','safety','safetyTr','connectivity','connectivityTr','languageBasics','languageBasicsTr','avoidPitfalls','avoidPitfallsTr','lastUpdated','sourceUrl'}
for id, c in countries.items():
    missing = required_country_keys - c.keys()
    assert not missing, f'{id} missing: {missing}'
required_city_keys = {'countryId','name','nameTr','minDays','budgetPerDayEUR','bestMonths','bestMonthsTr','summary','summaryTr','mustSee','mustSeeTr','mustEat','mustEatTr','localTransport','localTransportTr','freeStuff','freeStuffTr','safety','safetyTr','avoidTourist','avoidTouristTr','sourceUrl','lastUpdated'}
for id, c in cities.items():
    missing = required_city_keys - c.keys()
    assert not missing, f'city {id} missing: {missing}'
    assert c['countryId'] in countries, f'city {id} references unknown country {c[\"countryId\"]}'
print('OK')
"
```
Expected output: `countries: 36`, `cities: 66..80`, `OK`.

- [ ] **Step 5: HTTP 200 check**

```bash
curl -s -o /dev/null -w "http=%{http_code}\n" http://localhost:8765/data/guides.json
```
Expected: `http=200`.

- [ ] **Step 6: Commit**

```bash
git add data/guides.json
git commit -m "data: Wikivoyage country + city guide snapshot (36 countries, ~70 cities)"
```

---

## Task 2: Create `data/bingo-challenges.json`

**Files:**
- Create: `data/bingo-challenges.json`

**Preferred agent type:** `data-curator`. Categories from spec Section 5.2: `cultural | culinary | social | green | quirky`.

- [ ] **Step 1: Write the envelope and first 3 universal challenges as a schema reference**

```json
{
  "version": 1,
  "generated": "2026-04-12",
  "note": "25 universal + per-country bonus challenges. Universal card is always 5x5 (index 0..24). Country bonuses unlock when the country is in state.route.stops.",
  "universal": [
    {
      "id": "uni-local-coffee",
      "emoji": "☕",
      "title":   "Try a local coffee speciality",
      "titleTr": "Yerel bir kahve çeşidini dene",
      "hint":   "Viennese melange, Italian espresso, Turkish coffee, Greek freddo — anything that isn't a chain",
      "hintTr": "Viyana melange, İtalyan espresso, Türk kahvesi, Yunan freddo — zincir olmayan herhangi bir şey",
      "category": "culinary"
    }
  ],
  "byCountry": {
    "IT": [
      {
        "id": "bonus-IT-gelato",
        "emoji": "🍨",
        "title":   "Eat gelato from a shop with < 10 flavours",
        "titleTr": "10'dan az çeşidi olan bir gelatocudan dondurma ye",
        "hint":   "Fewer flavours usually means artisanal",
        "hintTr": "Az çeşit genelde el yapımı demektir",
        "category": "culinary"
      }
    ]
  }
}
```

- [ ] **Step 2: Add the full 25-challenge universal card**

Write 25 entries total. Distribution: roughly 5 cultural + 6 culinary + 5 social + 5 green + 4 quirky. Every entry has a unique `id` starting with `uni-`, a single emoji, `title`/`titleTr`, `hint`/`hintTr`, and `category`. Titles fit on one line at 375-px width (≤ ~40 chars).

- [ ] **Step 3: Add 1–2 bonus challenges per 36 countries in `byCountry`**

Keys are ISO codes matching `data/countries.json`. Each entry's `id` is `bonus-<ISO>-<slug>`. Bonus challenges reference something specific to that country (Turkish tea in TR, ABBA in SE, fado in PT, sisu coffee break in FI, etc.).

- [ ] **Step 4: Validate**

```bash
python -c "
import json
d = json.load(open('data/bingo-challenges.json', encoding='utf-8'))
uni = d['universal']
by = d['byCountry']
assert len(uni) == 25, f'expected 25 universal, got {len(uni)}'
ids = {c['id'] for c in uni}
assert len(ids) == 25, 'duplicate universal ids'
cats = {'cultural','culinary','social','green','quirky'}
for c in uni:
    for k in ('id','emoji','title','titleTr','hint','hintTr','category'):
        assert k in c, f'{c.get(\"id\")} missing {k}'
    assert c['category'] in cats, f'{c[\"id\"]} bad category'
for iso, arr in by.items():
    assert 1 <= len(arr) <= 3, f'{iso} has {len(arr)} bonuses'
print('universal:', len(uni), 'countries:', len(by), 'OK')
"
```
Expected: `universal: 25`, `countries: 36`, `OK`.

- [ ] **Step 5: Commit**

```bash
git add data/bingo-challenges.json
git commit -m "data: City Bingo — 25 universal + per-country bonus challenges"
```

---

## Task 3: Create `data/daily-dares.json`

**Files:**
- Create: `data/daily-dares.json`

**Preferred agent type:** `data-curator`.

- [ ] **Step 1: Write the envelope plus the first 3 dares as schema reference**

```json
{
  "version": 1,
  "generated": "2026-04-12",
  "note": "Deterministic rotation. Seed = (dayOfYear ^ FNV1a(YYYY)). If state.route.stops.length > 0, prefer dares whose preferredCountries intersects the route.",
  "dares": [
    {
      "id": "dare-newspaper",
      "emoji": "📰",
      "title":   "Buy a local newspaper you can't fully read",
      "titleTr": "Tamamını okuyamayacağın yerel bir gazete satın al",
      "category": "cultural",
      "preferredCountries": [],
      "xp": 10
    }
  ]
}
```

- [ ] **Step 2: Add ~60 total dares**

60 entries across `cultural | culinary | social | green`. Every `id` is `dare-<slug>` and unique. `xp` ∈ {5, 10, 15, 20}. `preferredCountries` is `[]` for universal dares, or a short ISO list for locale-specific dares (e.g. `["TR"]` for a Turkish tea dare).

- [ ] **Step 3: Validate**

```bash
python -c "
import json
d = json.load(open('data/daily-dares.json', encoding='utf-8'))
dares = d['dares']
print('dares:', len(dares))
assert 55 <= len(dares) <= 80, f'expected ~60, got {len(dares)}'
ids = {x['id'] for x in dares}
assert len(ids) == len(dares), 'duplicate dare ids'
cats = {'cultural','culinary','social','green'}
for x in dares:
    for k in ('id','emoji','title','titleTr','category','preferredCountries','xp'):
        assert k in x, f'{x.get(\"id\")} missing {k}'
    assert x['category'] in cats
    assert isinstance(x['preferredCountries'], list)
    assert x['xp'] in (5, 10, 15, 20)
print('OK')
"
```
Expected: `dares: ~60`, `OK`.

- [ ] **Step 4: Commit**

```bash
git add data/daily-dares.json
git commit -m "data: Daily Dare pool — ~60 cross-category micro-quests"
```

---

## Task 4: Create `data/soundtracks.json`

**Files:**
- Create: `data/soundtracks.json`

**Preferred agent type:** `data-curator` primary, `research-scout` helper to look up current Top 50 regional playlist IDs from `https://open.spotify.com/genre/charts-regional`.

- [ ] **Step 1: Write the file with all 36 countries**

```json
{
  "version": 1,
  "generated": "2026-04-12",
  "source": "Spotify official 'Top 50 - <Country>' editorial playlists",
  "sourceUrl": "https://open.spotify.com/genre/charts-regional",
  "note": "Playlist IDs are stable; Spotify refreshes contents daily. Countries without a regional Top 50 fall back to Global Top 50 with fallback:true.",
  "fallbackGlobal": "37i9dQZEVXbMDoHDwVN2tF",
  "countries": {
    "DE": { "playlistId": "37i9dQZEVXbJiZcmkrIHGU", "title": "Top 50 — Germany", "fallback": false },
    "FR": { "playlistId": "37i9dQZEVXbIPWwFssbupI", "title": "Top 50 — France",  "fallback": false }
  }
}
```

Populate every ISO code from `countries.json`. For countries without a Spotify regional chart (LI, MT, CY, etc.), use `"playlistId": "37i9dQZEVXbMDoHDwVN2tF"`, `"title": "Top 50 — Global"`, `"fallback": true`.

- [ ] **Step 2: Validate**

```bash
python -c "
import json
d = json.load(open('data/soundtracks.json', encoding='utf-8'))
cs = d['countries']
print('countries:', len(cs))
assert len(cs) == 36, f'expected 36, got {len(cs)}'
for iso, entry in cs.items():
    for k in ('playlistId','title','fallback'):
        assert k in entry, f'{iso} missing {k}'
    assert len(entry['playlistId']) == 22, f'{iso} playlistId wrong length'
print('OK')
"
```
Expected: `countries: 36`, `OK`.

- [ ] **Step 3: Commit**

```bash
git add data/soundtracks.json
git commit -m "data: Spotify Top 50 soundtrack playlist IDs for 36 countries"
```

---

## Task 5: Create `data/tr-consulates.json`

**Files:**
- Create: `data/tr-consulates.json`

**Preferred agent type:** `data-curator` primary, `research-scout` helper for current VFS / iDATA / TLScontact / BLS provider assignments (they change every few years).

- [ ] **Step 1: Write the envelope and a DE reference entry**

```json
{
  "version": 1,
  "generated": "2026-04-12",
  "note": "Schengen visa application centres in Türkiye. Most Schengen states outsource to VFS Global / iDATA / TLScontact / BLS. Refresh quarterly; providers occasionally change contracts.",
  "centres": [
    {
      "countryId": "DE",
      "countryName":   "Germany",
      "countryNameTr": "Almanya",
      "provider": "iDATA",
      "website":  "https://www.idata.com.tr",
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
  ]
}
```

- [ ] **Step 2: Add all 27 Schengen member states**

Spec Section 5.5 says: 27 Schengen states only, not the full EU. Non-Schengen DiscoverEU countries (IE, CY, RO, BG, HR) are **excluded**. Each `countryId` must exist in `countries.json`. Each centre has at least 1 city entry with real address + phone.

- [ ] **Step 3: Validate**

```bash
python -c "
import json
d = json.load(open('data/tr-consulates.json', encoding='utf-8'))
cs = d['centres']
print('centres:', len(cs))
assert len(cs) == 27, f'expected 27, got {len(cs)}'
excluded = {'IE','CY','RO','BG','HR'}
for c in cs:
    assert c['countryId'] not in excluded, f'{c[\"countryId\"]} should be excluded'
    for k in ('countryId','countryName','countryNameTr','provider','website','cities','noteTr'):
        assert k in c
    assert len(c['cities']) >= 1
print('OK')
"
```
Expected: `centres: 27`, `OK`.

- [ ] **Step 4: Commit**

```bash
git add data/tr-consulates.json
git commit -m "data: Turkish consulate / VFS-iDATA centres for 27 Schengen states"
```

---

## Task 6: Create `js/utils/ics.js`

**Files:**
- Create: `js/utils/ics.js`

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Write the full module**

Create `js/utils/ics.js` with exactly this content:

```js
// js/utils/ics.js
// Minimal RFC 5545 builder for single-event calendar files.
// Used by FutureMe (time capsule reveal alarm) and the Turkish consulate
// reminder card. No external dependency — pure string templating.
//
// Shared contract: every VEVENT carries a stable UID so re-exporting the
// same appointment overwrites the calendar entry instead of duplicating.
// Alarms are emitted as VALARM blocks with TRIGGER:-PT<N>M offsets.

const PROD_ID = '-//DiscoverEU Companion//EN';

function pad(n) { return String(n).padStart(2, '0'); }

/** Format a Date as UTC in the RFC 5545 DATE-TIME form (YYYYMMDDTHHMMSSZ). */
function toICalUTC(date) {
  const d = date instanceof Date ? date : new Date(date);
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + 'Z'
  );
}

/** RFC 5545 line folding + escape for text values. */
function escapeText(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function foldLine(line) {
  if (line.length <= 75) return line;
  const out = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.slice(i, i + (i === 0 ? 75 : 74));
    out.push(i === 0 ? chunk : ' ' + chunk);
    i += i === 0 ? 75 : 74;
  }
  return out.join('\r\n');
}

function line(key, value) {
  return foldLine(`${key}:${escapeText(value)}`);
}

/**
 * Build an iCalendar string for a single VEVENT with optional VALARMs.
 *
 * opts:
 *   uid         — required, stable identifier
 *   summary     — required, event title
 *   description — optional, long text
 *   location    — optional
 *   startDate   — required, Date or ISO string; event duration is 60 minutes
 *   alarms      — optional array of { minutesBefore, description }
 */
export function buildICS({ uid, summary, description, location, startDate, alarms = [] }) {
  if (!uid || !summary || !startDate) {
    throw new Error('[ics] uid, summary, startDate are required');
  }
  const start = toICalUTC(startDate);
  const endDate = new Date(new Date(startDate).getTime() + 60 * 60 * 1000);
  const end = toICalUTC(endDate);
  const stamp = toICalUTC(new Date());

  const valarms = (alarms || []).map(a => [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    line('DESCRIPTION', a.description || summary),
    `TRIGGER:-PT${Math.max(0, a.minutesBefore | 0)}M`,
    'END:VALARM'
  ].join('\r\n'));

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    line('UID', uid),
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    line('SUMMARY', summary),
    description ? line('DESCRIPTION', description) : null,
    location    ? line('LOCATION', location)      : null,
    ...valarms,
    'END:VEVENT',
    'END:VCALENDAR',
    ''
  ].filter(Boolean);

  return body.join('\r\n');
}

/** Trigger a download of the given ICS text. */
export function downloadICS(filename, icsText) {
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/utils/ics.js
```
Expected: no output.

- [ ] **Step 3: Round-trip smoke check**

```bash
node -e "
import('./js/utils/ics.js').then(m => {
  const ics = m.buildICS({
    uid: 'test@local',
    summary: 'Hello',
    description: 'Line1\nLine2',
    startDate: new Date('2026-05-01T09:00:00Z'),
    alarms: [{ minutesBefore: 1440, description: 'one day before' }]
  });
  if (!ics.includes('BEGIN:VCALENDAR') || !ics.includes('BEGIN:VEVENT') || !ics.includes('BEGIN:VALARM') || !ics.includes('TRIGGER:-PT1440M')) {
    console.error('FAIL', ics);
    process.exit(1);
  }
  console.log('OK');
});
"
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add js/utils/ics.js
git commit -m "feat(utils): ics.js iCalendar builder + download helper"
```

---

## Task 7: Create `js/utils/image.js`

**Files:**
- Create: `js/utils/image.js`

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Write the module**

Create `js/utils/image.js` with exactly this content:

```js
// js/utils/image.js
// Client-side image compression for Bingo photo uploads.
// Uses <canvas> re-encode to JPEG, which also drops all EXIF metadata
// (location, camera, timestamps) — the re-encoded bitstream contains
// nothing beyond the pixel data. Spec Section 5.6 requires EXIF-free
// blobs before they enter IndexedDB.

/**
 * Compress and re-encode an input file or Blob to a JPEG Blob.
 *
 *   await compressImage(fileFromInput)
 *
 * maxDim: bounding box for the longest side (default 800 px)
 * quality: JPEG quality 0..1 (default 0.7)
 */
export async function compressImage(file, maxDim = 800, quality = 0.7) {
  if (!file) throw new Error('[image] file required');
  const bitmap = await loadBitmap(file);
  const { width, height } = fitInside(bitmap.width, bitmap.height, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('[image] toBlob failed'))),
      'image/jpeg',
      quality
    );
  });
}

/** Defensive fallback used by callers that already have a Blob. */
export async function stripExif(blob) {
  return compressImage(blob, 2048, 0.92);
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file); } catch (e) { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function fitInside(w, h, maxDim) {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h };
  const ratio = w / h;
  if (w >= h) return { width: maxDim, height: Math.round(maxDim / ratio) };
  return { width: Math.round(maxDim * ratio), height: maxDim };
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/utils/image.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/utils/image.js
git commit -m "feat(utils): image.js canvas-based compressor with EXIF strip"
```

---

## Task 8: Extend `js/utils/storage.js` with IndexedDB helpers

**Files:**
- Modify: `js/utils/storage.js`

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Append the IDB helpers to the end of the file**

Open `js/utils/storage.js`. After the existing `cache` export, append:

```js

// ─────────────────────────────────────────────────────────────────────────────
// IndexedDB helpers
// ─────────────────────────────────────────────────────────────────────────────
// Minimal Promise-based wrapper around the browser IDB API. Used by Bingo
// for photo blob storage (store: `bingoPhotos`). One shared database
// (`discovereu`) so future stores can be added without new wiring.

const IDB_NAME = 'discovereu';
const IDB_VERSION = 1;
const IDB_STORES = ['bingoPhotos'];

let _dbPromise = null;

export function idbOpen(dbName = IDB_NAME, version = IDB_VERSION) {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('[idb] IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(dbName, version);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of IDB_STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
  return _dbPromise;
}

async function withStore(storeName, mode, fn) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result && result.__value !== undefined ? result.__value : result);
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

export async function idbPut(storeName, key, value) {
  return withStore(storeName, 'readwrite', store => { store.put(value, key); });
}

export async function idbGet(storeName, key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function idbDelete(storeName, key) {
  return withStore(storeName, 'readwrite', store => { store.delete(key); });
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/utils/storage.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/utils/storage.js
git commit -m "feat(storage): Promise-based IndexedDB helpers for bingoPhotos store"
```

---

## Task 9: Extend `js/data/loader.js` with lazy loaders

**Files:**
- Modify: `js/data/loader.js`

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Append lazy-loader functions after `loadEuropeGeoJson`**

Open `js/data/loader.js`. At the end of the file, append:

```js

// ─────────────────────────────────────────────────────────────────────────────
// Sub-project 2 lazy loaders
// ─────────────────────────────────────────────────────────────────────────────
// Each loader calls loadJson() (which is already memoised) so repeated
// invocations are cheap. Guides are also the single biggest lazy bundle
// (~100 KB) so we wrap it with an index accessor for O(1) country lookup.

let _guidesCache = null;

export async function loadGuides() {
  if (_guidesCache) return _guidesCache;
  _guidesCache = await loadJson('guides.json');
  return _guidesCache;
}

export async function getCountryGuide(countryId) {
  const g = await loadGuides();
  return g?.countries?.[countryId] ?? null;
}

export async function getCityGuide(cityId) {
  const g = await loadGuides();
  return g?.cities?.[cityId] ?? null;
}

export async function listCitiesForCountry(countryId) {
  const g = await loadGuides();
  if (!g?.cities) return [];
  return Object.entries(g.cities)
    .filter(([, c]) => c.countryId === countryId)
    .map(([id, c]) => ({ id, ...c }));
}

export async function loadBingoChallenges() { return loadJson('bingo-challenges.json'); }
export async function loadDares()           { return loadJson('daily-dares.json');      }
export async function loadSoundtracks()     { return loadJson('soundtracks.json');      }
export async function loadConsulates()      { return loadJson('tr-consulates.json');    }
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/data/loader.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/data/loader.js
git commit -m "feat(loader): lazy loaders for guides, bingo, dares, soundtracks, consulates"
```

---

## Task 10: Extend `js/state.js` with sub-project 2 slices

**Files:**
- Modify: `js/state.js`

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Extend `PERSIST_KEYS`**

Open `js/state.js`. Find:

```js
const PERSIST_KEYS = ['theme', 'language', 'user', 'route', 'filters', 'prep'];
```

Replace with:

```js
const PERSIST_KEYS = ['theme', 'language', 'user', 'route', 'filters', 'prep', 'bingo', 'dares', 'futureMessages'];
```

- [ ] **Step 2: Extend the `user` slice with `consulateAppointment`**

Find the current `user` block:

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

Replace with:

```js
  user: {
    groupSize: 4,
    homeCountry: 'TR',
    budget: 'moderate',        // 'budget' | 'moderate' | 'comfort'
    accommodation: 'hostel',   // 'hostel' | 'airbnb' | 'camp' | 'couchsurf'
    foodStyle: 'moderate',     // 'budget' | 'moderate' | 'comfort'
    onboarded: false,          // Welcome wizard completion flag — persisted via PERSIST_KEYS.user
    consulateAppointment: null // { countryId, city, datetime, notes } | null — sub-project 2
  },
```

- [ ] **Step 3: Add new slices next to `compare`/`inclusionMode`**

Find:

```js
  compare: [],                 // list of country ids (max 4) — ephemeral
  inclusionMode: 'default',    // 'default' | 'rainbow' | 'accessibility' — ephemeral
```

Insert directly after `inclusionMode`:

```js
  compare: [],                 // list of country ids (max 4) — ephemeral
  inclusionMode: 'default',    // 'default' | 'rainbow' | 'accessibility' — ephemeral
  activeFunSubtab: 'bingo',    // 'bingo' | 'dares' | 'futureMe' — ephemeral
  bingo: {                     // persisted
    completed: {}              // { [challengeId]: true }
  },
  dares: {                     // persisted
    completed: {},             // { [YYYY-MM-DD]: true | 'skipped' }
    lastDareId: null,
    streak: 0
  },
  futureMessages: [],          // persisted — [{ id, message, createdAt, revealDate }]
  ai: {                        // ephemeral
    groqKey: null,             // mirrors localStorage['discoveru:ai.groqKey']
    lastSuggestion: null       // ephemeral, retained for retry UX
  },
```

- [ ] **Step 4: Syntax check + in-browser sanity**

```bash
node --check js/state.js
```

Then in `browser_evaluate`:

```js
async () => {
  const { state } = await import('/js/state.js');
  return {
    hasBingo: 'bingo' in state.get(),
    bingoShape: state.getSlice('bingo'),
    daresShape: state.getSlice('dares'),
    ai: state.getSlice('ai'),
    consulate: state.getSlice('user').consulateAppointment,
    futureMessages: state.getSlice('futureMessages')
  };
}
```
Expected: all fields populated (`bingoShape.completed === {}`, `daresShape.streak === 0`, `ai.groqKey === null`, `consulate === null`, `futureMessages === []`).

- [ ] **Step 5: Commit**

```bash
git add js/state.js
git commit -m "state: add bingo, dares, futureMessages, ai, consulateAppointment slices"
```

---

## Task 11: Create `js/features/llm-groq.js`

**Files:**
- Create: `js/features/llm-groq.js`

**Preferred agent type:** `feature-engineer`. This is the low-level REST wrapper; it must not import from `ui/*` or touch the DOM.

- [ ] **Step 1: Write the module**

Create `js/features/llm-groq.js`:

```js
// js/features/llm-groq.js
// Thin Groq REST adapter used by js/features/ai-assistant.js.
// Typed errors let the UI layer render tailored toasts / screens.
// No retries here — the modal handles that; we just surface the outcome.

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-70b-versatile';

export class AuthError      extends Error { constructor(m){ super(m); this.name='AuthError'; } }
export class RateLimitError extends Error { constructor(m){ super(m); this.name='RateLimitError'; } }
export class NetworkError   extends Error { constructor(m){ super(m); this.name='NetworkError'; } }
export class ParseError     extends Error { constructor(m){ super(m); this.name='ParseError'; } }

/**
 * callGroq({apiKey, systemPrompt, userMessage, jsonMode, model, signal})
 *   → Promise<{ content: string, usage: object }>
 *
 * Throws:
 *   AuthError      on 401 / missing key
 *   RateLimitError on 429
 *   NetworkError   on 5xx / network failure / abort
 *   ParseError     if the server returns malformed JSON
 */
export async function callGroq({
  apiKey,
  systemPrompt,
  userMessage,
  jsonMode = false,
  model = DEFAULT_MODEL,
  signal
}) {
  if (!apiKey) throw new AuthError('missing key');

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt || '' },
      { role: 'user',   content: userMessage  || '' }
    ],
    temperature: 0.4,
    max_tokens: 1200
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new NetworkError('aborted');
    throw new NetworkError(err?.message || 'network error');
  }

  if (res.status === 401 || res.status === 403) throw new AuthError(`HTTP ${res.status}`);
  if (res.status === 429)                       throw new RateLimitError('HTTP 429');
  if (!res.ok)                                   throw new NetworkError(`HTTP ${res.status}`);

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new ParseError('invalid JSON response');
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new ParseError('missing choices[0].message.content');

  return { content, usage: json?.usage || {} };
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/features/llm-groq.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/features/llm-groq.js
git commit -m "feat(ai): llm-groq.js thin Groq REST adapter with typed errors"
```

---

## Task 12: Create `js/features/ai-assistant.js`

**Files:**
- Create: `js/features/ai-assistant.js`

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Write the module**

Create `js/features/ai-assistant.js`:

```js
// js/features/ai-assistant.js
// High-level AI route suggestion pipeline:
//   1. Gather a compact country context block (top-10 matches for the
//      user's prompt against countries.json + guides.json summaries)
//   2. Build a system prompt with DiscoverEU rules
//   3. Call Groq in JSON mode
//   4. Validate the returned route against data/countries.json
//   5. Return { stops, rationale, usage } or throw typed error

import { callGroq, ParseError } from './llm-groq.js';
import { state } from '../state.js';
import { loadGuides } from '../data/loader.js';

const MAX_STOPS = 8;
const MAX_NIGHTS_PER_STOP = 14;
const MAX_TOTAL_DAYS = 30;

const SYSTEM_PROMPT = `You are a DiscoverEU trip planner. Respond ONLY with JSON matching this exact shape:
{
  "stops": [
    { "countryId": "<ISO2>", "nights": <1..14>, "reason": "<short why>" }
  ],
  "rationale": "<one paragraph>"
}

Rules:
- countryId MUST be one of the provided ISO codes.
- Max 8 stops. Total nights across stops must be <= 30.
- Prefer rail-friendly adjacencies. Mention reservation-mandatory legs when relevant.
- Respect the user's stated constraints (budget, accessibility, LGBTQ+ safety, green preference).
- Answer in the user's interface language.
- Do NOT wrap the JSON in markdown. Do NOT add commentary outside the JSON object.`;

function buildCountryContext(countries, guides) {
  const lines = [];
  for (const c of countries) {
    const guide = guides?.countries?.[c.id];
    const summary = guide?.summary || c.description || '';
    lines.push(`${c.id} — ${c.name}: ${summary.slice(0, 140)}`);
  }
  return lines.join('\n');
}

function validateStops(stops, countryIndex) {
  if (!Array.isArray(stops)) throw new ParseError('stops not an array');
  if (stops.length === 0)    throw new ParseError('stops empty');
  if (stops.length > MAX_STOPS) stops.length = MAX_STOPS;
  let totalNights = 0;
  const cleaned = [];
  for (const s of stops) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.countryId || '').toUpperCase();
    if (!countryIndex[id]) continue;
    const n = Math.max(1, Math.min(MAX_NIGHTS_PER_STOP, parseInt(s.nights, 10) || 2));
    if (totalNights + n > MAX_TOTAL_DAYS) break;
    totalNights += n;
    cleaned.push({ countryId: id, nights: n, reason: String(s.reason || '').slice(0, 200) });
  }
  if (cleaned.length === 0) throw new ParseError('no valid countryIds after validation');
  return cleaned;
}

/**
 * suggestRoute({ userPrompt, signal })
 *   → { stops, rationale, usage }
 */
export async function suggestRoute({ userPrompt, signal } = {}) {
  const apiKey = state.getSlice('ai')?.groqKey;
  if (!apiKey) { const e = new Error('missing key'); e.name = 'AuthError'; throw e; }

  const countries = state.getSlice('countries') || [];
  const guides = await loadGuides().catch(() => null);
  const countryIndex = Object.fromEntries(countries.map(c => [c.id, c]));

  const lang = state.getSlice('language') || 'en';
  const user = state.getSlice('user') || {};
  const userBlock = [
    `language: ${lang}`,
    `budget: ${user.budget}`,
    `accommodation: ${user.accommodation}`,
    user.consulateAppointment ? 'has turkish consulate appointment scheduled' : ''
  ].filter(Boolean).join('\n');

  const prompt = [
    `User request: ${userPrompt || '(no specific request)'}`,
    '',
    'User profile:',
    userBlock,
    '',
    'Available country IDs (ISO2):',
    buildCountryContext(countries, guides)
  ].join('\n');

  const { content, usage } = await callGroq({
    apiKey,
    systemPrompt: SYSTEM_PROMPT,
    userMessage: prompt,
    jsonMode: true,
    signal
  });

  let parsed;
  try { parsed = JSON.parse(content); }
  catch (err) { throw new ParseError('LLM returned non-JSON'); }

  const stops = validateStops(parsed.stops, countryIndex);
  const rationale = String(parsed.rationale || '').slice(0, 800);

  return { stops, rationale, usage };
}

/**
 * initAITrigger(btnSelector)
 *   Attaches a click listener that opens the AI modal.
 *   Lazy-imports ui/ai-modal.js so the modal module is not loaded
 *   on app boot.
 */
export function initAITrigger(btnSelector) {
  const el = document.querySelector(btnSelector);
  if (!el) return;
  el.addEventListener('click', async () => {
    const { openAIModal } = await import('../ui/ai-modal.js');
    openAIModal();
  });
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/features/ai-assistant.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/features/ai-assistant.js
git commit -m "feat(ai): ai-assistant.js suggestRoute pipeline with Groq + validation"
```

---

## Task 13: Create `js/ui/ai-modal.js` + header trigger wiring

**Files:**
- Create: `js/ui/ai-modal.js`
- Modify: `index.html` (add header "✨ AI Öneri" button + Route tab empty-state CTA placeholder)
- Modify: `js/main.js` (call `initAITrigger('#aiSuggestBtn')` after data load)

**Preferred agent type:** `ui-designer` for modal + CSS, main agent acceptable.

- [ ] **Step 1: Write `js/ui/ai-modal.js`**

Create `js/ui/ai-modal.js`:

```js
// js/ui/ai-modal.js
// 3-screen modal: key entry → prompt → result (with error branches).
// Reuses the existing .modal-overlay container from wrapped.js styling.
// Focus trap + Esc-to-close are inlined here because we do not yet have
// a shared modal helper; keep the code scoped to this module.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, on, empty, escape } from '../utils/dom.js';
import { showToast } from './toast.js';
import { suggestRoute } from '../features/ai-assistant.js';
import { storage } from '../utils/storage.js';

const KEY_STORAGE = 'ai.groqKey';

function getKey() {
  return state.getSlice('ai')?.groqKey || storage.get(KEY_STORAGE) || null;
}
function setKey(key) {
  state.update('ai', prev => ({ ...prev, groqKey: key }));
  if (key) storage.set(KEY_STORAGE, key);
  else     storage.remove(KEY_STORAGE);
}

let abortController = null;

export function openAIModal() {
  const overlay = h('div', { class: 'modal-overlay ai-modal-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'aiModalTitle' });
  const card = h('div', { class: 'modal-card ai-modal' }, [
    h('header', { class: 'modal-header' }, [
      h('h2', { id: 'aiModalTitle' }, `✨ ${t('ai.title')}`),
      h('button', { class: 'modal-close', 'aria-label': t('modal.close'), 'data-action': 'close' }, '×')
    ]),
    h('div', { class: 'modal-body ai-modal-body', 'data-screen': 'loading' })
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const body = card.querySelector('.ai-modal-body');

  const close = () => {
    if (abortController) abortController.abort();
    abortController = null;
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };

  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);
  on(overlay, 'click', ev => { if (ev.target === overlay) close(); });
  on(card, 'click', ev => {
    if (ev.target instanceof HTMLElement && ev.target.dataset.action === 'close') close();
  });

  // Decide first screen
  if (!getKey()) renderKeyScreen(body);
  else           renderPromptScreen(body);
}

// ─── Screens ─────────────────────────────────────────────────────────────

function renderKeyScreen(body) {
  empty(body);
  const input = h('input', {
    type: 'password',
    class: 'input',
    placeholder: 'gsk_…',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': t('ai.key.label')
  });
  const save = h('button', { class: 'btn btn-primary', type: 'button' }, t('ai.key.save'));
  on(save, 'click', () => {
    const v = (input.value || '').trim();
    if (!v.startsWith('gsk_') || v.length < 20) {
      showToast({ message: t('ai.key.invalid'), variant: 'warning' });
      return;
    }
    setKey(v);
    renderPromptScreen(body);
  });

  body.appendChild(h('div', { class: 'ai-screen ai-screen-key' }, [
    h('p', null, t('ai.key.intro')),
    h('a', { href: 'https://console.groq.com/keys', target: '_blank', rel: 'noopener' }, t('ai.key.getLink')),
    input,
    save,
    h('p', { class: 'ai-key-privacy' }, t('ai.key.privacy'))
  ]));
  input.focus();
}

function renderPromptScreen(body) {
  empty(body);
  const textarea = h('textarea', {
    class: 'input ai-prompt',
    rows: '4',
    placeholder: t('ai.prompt.placeholder'),
    'aria-label': t('ai.prompt.label')
  });
  const chips = h('div', { class: 'ai-chips' }, [
    chip('🏖️ ' + t('ai.chip.beach'),    'Beaches + small towns, 14 days, mid budget'),
    chip('🏰 ' + t('ai.chip.history'),  'Historic capitals, museums, 12 days'),
    chip('🌲 ' + t('ai.chip.nature'),   'Nordic nature + hiking, 10 days'),
    chip('🎉 ' + t('ai.chip.party'),    'Nightlife + festivals, 10 days, budget'),
    chip('♿ ' + t('ai.chip.access'),   'Accessibility-friendly cities, 14 days')
  ].map(c => {
    on(c, 'click', () => { textarea.value = c.dataset.fill; textarea.focus(); });
    return c;
  }));
  const submit = h('button', { class: 'btn btn-primary', type: 'button' }, t('ai.prompt.submit'));
  on(submit, 'click', () => runSuggestion(body, textarea.value));

  body.appendChild(h('div', { class: 'ai-screen ai-screen-prompt' }, [
    h('p', null, t('ai.prompt.intro')),
    chips,
    textarea,
    submit
  ]));
  textarea.focus();
}

function chip(label, fill) {
  const b = h('button', { class: 'btn btn-outline btn-sm', type: 'button' }, label);
  b.dataset.fill = fill;
  return b;
}

async function runSuggestion(body, userPrompt) {
  empty(body);
  body.appendChild(h('div', { class: 'ai-screen ai-screen-loading' }, [
    h('div', { class: 'spinner', 'aria-hidden': 'true' }),
    h('p', null, t('ai.loading')),
    (() => {
      const cancelBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, t('ai.loading.cancel'));
      on(cancelBtn, 'click', () => { if (abortController) abortController.abort(); });
      return cancelBtn;
    })()
  ]));

  abortController = new AbortController();
  try {
    const result = await suggestRoute({ userPrompt, signal: abortController.signal });
    state.update('ai', prev => ({ ...prev, lastSuggestion: result }));
    renderResultScreen(body, result);
  } catch (err) {
    renderErrorScreen(body, err, userPrompt);
  } finally {
    abortController = null;
  }
}

function renderResultScreen(body, result) {
  empty(body);
  const list = h('ol', { class: 'ai-result-list' },
    result.stops.map(s => h('li', null, [
      h('strong', null, `${s.countryId}`),
      ` — ${s.nights} ${t('ai.result.nights')}`,
      s.reason ? h('div', { class: 'ai-result-reason' }, s.reason) : null
    ]))
  );
  body.appendChild(h('div', { class: 'ai-screen ai-screen-result' }, [
    h('p', null, result.rationale),
    list,
    h('div', { class: 'ai-result-actions' }, [
      button(t('ai.result.replace'),  'primary', () => applyRoute(result.stops, 'replace')),
      button(t('ai.result.add'),      'secondary', () => applyRoute(result.stops, 'add')),
      button(t('ai.result.retry'),    'ghost', () => renderPromptScreen(body))
    ])
  ]));
}

function renderErrorScreen(body, err, lastPrompt) {
  empty(body);
  let key = 'ai.err.network';
  if (err?.name === 'AuthError')      key = 'ai.err.auth';
  else if (err?.name === 'RateLimitError') key = 'ai.err.rate';
  else if (err?.name === 'ParseError')     key = 'ai.err.parse';

  body.appendChild(h('div', { class: 'ai-screen ai-screen-error' }, [
    h('h3', null, `⚠️ ${t(key)}`),
    err?.name === 'AuthError'
      ? button(t('ai.err.updateKey'), 'primary', () => renderKeyScreen(body))
      : button(t('ai.result.retry'),  'primary', () => runSuggestion(body, lastPrompt))
  ]));
}

function applyRoute(stops, mode) {
  state.update('route', prev => {
    const newStops = stops.map(s => ({
      countryId: s.countryId,
      nights: s.nights,
      arrivalDay: 0,
      transport: 'rail'
    }));
    if (mode === 'replace') return { ...prev, stops: newStops };
    return { ...prev, stops: [...prev.stops, ...newStops] };
  });
  showToast({ message: t('ai.result.applied'), variant: 'success' });
  // Close the modal
  document.querySelector('.ai-modal-overlay')?.remove();
}

function button(label, variant, onClick) {
  const cls = variant === 'primary'   ? 'btn btn-primary'
            : variant === 'secondary' ? 'btn btn-secondary'
            : 'btn btn-ghost';
  const b = h('button', { class: cls, type: 'button' }, label);
  on(b, 'click', onClick);
  return b;
}
```

- [ ] **Step 2: Add a header trigger button to `index.html`**

Open `index.html`. Find the header button group (look for the existing `#shareBtn` / `#themeBtn`). Add a new button **before** `#shareBtn` with id `aiSuggestBtn`:

```html
<button id="aiSuggestBtn" class="btn btn-primary btn-sm" type="button" data-i18n="ai.headerCta">✨ AI Öneri</button>
```

- [ ] **Step 3: Wire the trigger in `main.js`**

Open `js/main.js`. After the existing data load + module imports block (where other features like `initWrappedTrigger` are wired), add:

```js
const { initAITrigger } = await import('./features/ai-assistant.js');
initAITrigger('#aiSuggestBtn');
```

- [ ] **Step 4: Browser smoke test**

Unlock browser, clear SW, navigate:

```
mcp__playwright__browser_navigate → http://localhost:8765/index.html?bust=t13
```

Click the new `#aiSuggestBtn`. Expect the modal to appear with the key-entry screen. Type a fake key `gsk_test_key_abcdef1234567890`, click save. Expect the prompt screen with 5 chips. Press Escape. Expect the modal to close.

- [ ] **Step 5: Commit**

```bash
git add js/ui/ai-modal.js index.html js/main.js
git commit -m "feat(ai): ai-modal 3-screen flow + header trigger wiring"
```

---

## Task 14: Create `js/ui/guide.js`

**Files:**
- Create: `js/ui/guide.js`

**Preferred agent type:** `ui-designer`.

- [ ] **Step 1: Write the module**

Create `js/ui/guide.js`:

```js
// js/ui/guide.js
// Lazy-rendered accordion blocks for the Country Detail tab:
//   renderCountryGuideAccordion — 10 sub-sections from guides.json.countries[id]
//   renderCitiesAccordion       — top N cities for the country
//   renderCityGuide             — single-city panel (reused by both callers)
// All three use <details>/<summary> so keyboard + screen reader support
// comes for free.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';
import { getCountryGuide, listCitiesForCountry, getCityGuide } from '../data/loader.js';

function useTr() { return state.getSlice('language') === 'tr'; }
function pick(obj, key) { return useTr() ? (obj[key + 'Tr'] ?? obj[key]) : obj[key]; }

export async function renderCountryGuideAccordion(container, countryId) {
  empty(container);
  const guide = await getCountryGuide(countryId);
  if (!guide) {
    container.appendChild(h('p', { class: 'text-muted' }, t('guide.missing')));
    return;
  }
  const details = h('details', { class: 'guide-accordion', open: false }, [
    h('summary', null, [
      h('span', null, `🗺️ ${t('guide.countryTitle')}`),
      h('span', { class: 'chevron' }, '▾')
    ]),
    buildCountrySections(guide),
    h('footer', { class: 'guide-footer' }, [
      h('span', null, `${t('guide.lastUpdated', { date: guide.lastUpdated })} · `),
      h('a', { href: guide.sourceUrl, target: '_blank', rel: 'noopener' }, t('guide.source'))
    ])
  ]);
  container.appendChild(details);
}

function buildCountrySections(guide) {
  const wrap = h('div', { class: 'guide-sections' });
  const sections = [
    ['summary',       '📘', 'guide.section.summary'],
    ['whenToGo',      '📅', 'guide.section.whenToGo'],
    ['whatToEat',     '🍽️', 'guide.section.whatToEat'],
    ['transport',     '🚆', 'guide.section.transport'],
    ['money',         '💶', 'guide.section.money'],
    ['etiquette',     '🤝', 'guide.section.etiquette'],
    ['safety',        '🛟', 'guide.section.safety'],
    ['connectivity',  '📶', 'guide.section.connectivity']
  ];
  for (const [key, emoji, i18nKey] of sections) {
    const text = pick(guide, key);
    if (!text) continue;
    wrap.appendChild(h('section', { class: 'guide-sect' }, [
      h('h4', null, `${emoji} ${t(i18nKey)}`),
      h('p', null, text)
    ]));
  }
  // Language basics
  const basics = useTr() ? guide.languageBasicsTr : guide.languageBasics;
  if (Array.isArray(basics) && basics.length) {
    wrap.appendChild(h('section', { class: 'guide-sect guide-basics' }, [
      h('h4', null, `🗣️ ${t('guide.section.languageBasics')}`),
      h('ul', null, basics.map(b => h('li', null, [
        h('strong', null, b.phrase),
        ` — ${b.meaning}`
      ])))
    ]));
  }
  // Pitfalls
  const pitfalls = useTr() ? guide.avoidPitfallsTr : guide.avoidPitfalls;
  if (Array.isArray(pitfalls) && pitfalls.length) {
    wrap.appendChild(h('section', { class: 'guide-sect guide-pitfalls' }, [
      h('h4', null, `⚠️ ${t('guide.section.avoidPitfalls')}`),
      h('ul', null, pitfalls.map(p => h('li', null, p)))
    ]));
  }
  return wrap;
}

export async function renderCitiesAccordion(container, countryId) {
  empty(container);
  const cities = await listCitiesForCountry(countryId);
  if (!cities.length) return;
  const outer = h('details', { class: 'guide-accordion guide-cities', open: false }, [
    h('summary', null, [
      h('span', null, `🏙️ ${t('guide.topCitiesTitle', { n: cities.length })}`),
      h('span', { class: 'chevron' }, '▾')
    ])
  ]);
  for (const city of cities) {
    outer.appendChild(buildCityDetails(city));
  }
  container.appendChild(outer);
}

function buildCityDetails(city) {
  const must = useTr() ? city.mustSeeTr : city.mustSee;
  const eat  = useTr() ? city.mustEatTr : city.mustEat;
  const free = useTr() ? city.freeStuffTr : city.freeStuff;
  const avoid= useTr() ? city.avoidTouristTr : city.avoidTourist;
  const name = useTr() ? city.nameTr : city.name;
  const bestMonths = useTr() ? city.bestMonthsTr : city.bestMonths;

  return h('details', { class: 'guide-city', open: false }, [
    h('summary', null, `📍 ${name} · ${city.minDays}d · ${bestMonths}`),
    h('div', { class: 'guide-city-body' }, [
      h('p', null, pick(city, 'summary')),
      h('div', { class: 'guide-city-budget' }, [
        h('span', null, `💶 €${city.budgetPerDayEUR.low}–${city.budgetPerDayEUR.high}/day`)
      ]),
      section('👀', 'guide.city.mustSee', must && must.map(m => h('li', null, [
        h('strong', null, m.name),
        m.tip ? ` — ${m.tip}` : null
      ]))),
      section('🍝', 'guide.city.mustEat', eat),
      section('💸', 'guide.city.free',   free),
      section('🚇', 'guide.city.transport', [h('li', null, pick(city, 'localTransport'))]),
      section('🛟', 'guide.city.safety', [h('li', null, pick(city, 'safety'))]),
      section('🚫', 'guide.city.avoid',  avoid)
    ])
  ]);
}

function section(emoji, i18nKey, items) {
  if (!items || items.length === 0) return null;
  const lis = items.map(x => typeof x === 'string' ? h('li', null, x) : x);
  return h('section', { class: 'guide-city-sect' }, [
    h('h5', null, `${emoji} ${t(i18nKey)}`),
    h('ul', null, lis)
  ]);
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/ui/guide.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/ui/guide.js
git commit -m "feat(guide): city + country guide accordion renderers"
```

---

## Task 15: Wire Country Guide + Cities accordions into `country-detail.js`

**Files:**
- Modify: `js/ui/country-detail.js`

**Preferred agent type:** `ui-designer`.

- [ ] **Step 1: Import the guide helpers**

At the top of `js/ui/country-detail.js` add:

```js
import { renderCountryGuideAccordion, renderCitiesAccordion } from './guide.js';
```

- [ ] **Step 2: Append accordion containers after the existing detail body**

Find the block that renders the per-country body (the one that finishes with the "Compare" / "Add to route" action buttons). After that block, append:

```js
const guideHost  = h('div', { class: 'country-detail-guide-host' });
const citiesHost = h('div', { class: 'country-detail-cities-host' });
container.appendChild(guideHost);
container.appendChild(citiesHost);
renderCountryGuideAccordion(guideHost, country.id);
renderCitiesAccordion(citiesHost, country.id);
```

Where `container` is whatever local variable the existing function uses to build the panel DOM. If the existing function subscribes to `state.language` and re-renders on language change, the accordion re-renders automatically — no extra wiring needed.

- [ ] **Step 3: Syntax check + smoke test**

```bash
node --check js/ui/country-detail.js
```

Then in browser, clear SW, navigate:

```
mcp__playwright__browser_navigate → http://localhost:8765/index.html?bust=t15
```

Click Italy on the map, click the Detail tab, scroll down, click the "🗺️ Country Guide" accordion. Expect 8+ sections to expand. Click "🏙️ Top Cities (2)" — expect Rome + Florence sub-accordions.

- [ ] **Step 4: Commit**

```bash
git add js/ui/country-detail.js
git commit -m "feat(detail): wire Country Guide + Top Cities accordions"
```

---

## Task 16: Create `js/features/soundtrack.js` + Country Detail accordion

**Files:**
- Create: `js/features/soundtrack.js`
- Modify: `js/ui/country-detail.js` (add soundtrack accordion below cities)

**Preferred agent type:** `feature-engineer` for the module, `ui-designer` for the accordion wiring.

- [ ] **Step 1: Write `js/features/soundtrack.js`**

```js
// js/features/soundtrack.js
// Country Top 50 Spotify embed. Lazy-injects the iframe src only when
// the accordion is opened (bandwidth-conscious, EACEA-green-story
// friendly). No auth, no CORS — pure public iframe embed.

import { loadSoundtracks } from '../data/loader.js';
import { h } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';

let _cache = null;

async function ensure() {
  if (_cache) return _cache;
  try { _cache = await loadSoundtracks(); } catch (e) { _cache = null; }
  return _cache;
}

export async function getPlaylistFor(countryId) {
  const data = await ensure();
  if (!data) return null;
  return data.countries?.[countryId] || null;
}

/**
 * Create (but do NOT insert src) a <details><iframe> accordion for the
 * given country. Returns the <details> element ready to append.
 */
export async function renderSoundtrackAccordion(container, countryId) {
  const entry = await getPlaylistFor(countryId);
  if (!entry) return;

  const iframe = h('iframe', {
    width: '100%',
    height: '152',
    frameborder: '0',
    allow: 'encrypted-media',
    loading: 'lazy',
    title: `Spotify ${entry.title}`,
    'aria-label': `Spotify ${entry.title}`
  });

  const details = h('details', { class: 'guide-accordion guide-soundtrack' }, [
    h('summary', null, [
      h('span', null, `🎵 ${t('soundtrack.title')}`),
      h('span', { class: 'chevron' }, '▾')
    ]),
    h('div', { class: 'soundtrack-body' }, [
      iframe,
      entry.fallback
        ? h('p', { class: 'text-muted small' }, t('soundtrack.fallbackNote'))
        : null,
      h('p', { class: 'text-muted small' }, t('soundtrack.attribution'))
    ])
  ]);

  details.addEventListener('toggle', () => {
    if (details.open && !iframe.src) {
      iframe.src = `https://open.spotify.com/embed/playlist/${entry.playlistId}?utm_source=discovereu-companion`;
    }
  });

  container.appendChild(details);
}
```

- [ ] **Step 2: Wire it into `country-detail.js`**

Open `js/ui/country-detail.js`. Near the existing `renderCitiesAccordion` call from Task 15, add:

```js
import { renderSoundtrackAccordion } from '../features/soundtrack.js';
// ...
const soundtrackHost = h('div', { class: 'country-detail-soundtrack-host' });
container.appendChild(soundtrackHost);
renderSoundtrackAccordion(soundtrackHost, country.id);
```

- [ ] **Step 3: Smoke test**

Unlock browser, clear SW, navigate to the page, click Germany, open the Soundtrack accordion. Expect the iframe to load (its `src` should be empty before toggle, populated after).

- [ ] **Step 4: Commit**

```bash
git add js/features/soundtrack.js js/ui/country-detail.js
git commit -m "feat(soundtrack): lazy Spotify embed accordion in country detail"
```

---

## Task 17: Create `js/features/bingo.js`

**Files:**
- Create: `js/features/bingo.js`

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Write the module**

```js
// js/features/bingo.js
// City Bingo logic: card assembly, done tracking (localStorage), bingo
// line detection, and photo attachment (IndexedDB).
// Bingo UI lives in js/ui/bingo-tab.js — this file stays DOM-free.

import { state } from '../state.js';
import { loadBingoChallenges } from '../data/loader.js';
import { compressImage } from '../utils/image.js';
import { idbPut, idbGet, idbDelete } from '../utils/storage.js';

const PHOTO_STORE = 'bingoPhotos';

let _data = null;

export async function ensureBingoData() {
  if (_data) return _data;
  _data = await loadBingoChallenges();
  return _data;
}

/**
 * Build the active card for the user. The universal 25 are always the
 * same order (matching the JSON file order); bonuses come from any
 * country currently in state.route.stops.
 */
export function getActiveCard(route, bingoData) {
  const data = bingoData || _data;
  if (!data) return { universal: [], bonuses: [] };
  const stops = route?.stops || [];
  const countryIds = [...new Set(stops.map(s => s.countryId))];
  const bonuses = countryIds
    .flatMap(id => data.byCountry?.[id] || [])
    .slice(0, 10);
  return { universal: data.universal.slice(0, 25), bonuses };
}

export function isDone(challengeId) {
  return !!state.getSlice('bingo')?.completed?.[challengeId];
}

export function markDone(challengeId) {
  state.update('bingo', prev => ({
    ...prev,
    completed: { ...prev.completed, [challengeId]: true }
  }));
}

export function markUndone(challengeId) {
  state.update('bingo', prev => {
    const next = { ...prev.completed };
    delete next[challengeId];
    return { ...prev, completed: next };
  });
}

export function getProgress() {
  const done = state.getSlice('bingo')?.completed || {};
  const total = _data?.universal?.length || 25;
  const doneCount = Object.keys(done).filter(id => id.startsWith('uni-')).length;
  return { done: doneCount, total };
}

/**
 * Scan the 25 universal cells for completed rows / columns / diagonals.
 * Cells are laid out row-major, 5x5.
 */
export function detectBingoLines(universal, completedIds) {
  if (!Array.isArray(universal) || universal.length < 25) return [];
  const ids = universal.slice(0, 25).map(c => c.id);
  const cellDone = i => completedIds.has(ids[i]);
  const lines = [];
  for (let r = 0; r < 5; r++) {
    const idxs = [0,1,2,3,4].map(c => r * 5 + c);
    if (idxs.every(cellDone)) lines.push({ type: 'row', index: r, ids: idxs.map(i => ids[i]) });
  }
  for (let c = 0; c < 5; c++) {
    const idxs = [0,1,2,3,4].map(r => r * 5 + c);
    if (idxs.every(cellDone)) lines.push({ type: 'col', index: c, ids: idxs.map(i => ids[i]) });
  }
  const d1 = [0, 6, 12, 18, 24];
  const d2 = [4, 8, 12, 16, 20];
  if (d1.every(cellDone)) lines.push({ type: 'diag', index: 0, ids: d1.map(i => ids[i]) });
  if (d2.every(cellDone)) lines.push({ type: 'diag', index: 1, ids: d2.map(i => ids[i]) });
  return lines;
}

export async function attachPhoto(challengeId, file) {
  const blob = await compressImage(file);
  await idbPut(PHOTO_STORE, challengeId, blob);
  return blob;
}

export async function getPhoto(challengeId) {
  return idbGet(PHOTO_STORE, challengeId);
}

export async function removePhoto(challengeId) {
  return idbDelete(PHOTO_STORE, challengeId);
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/features/bingo.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/features/bingo.js
git commit -m "feat(bingo): card assembly, line detection, photo attach via IDB"
```

---

## Task 18: Create `js/ui/bingo-tab.js`

**Files:**
- Create: `js/ui/bingo-tab.js`

**Preferred agent type:** `ui-designer`.

- [ ] **Step 1: Write the module**

```js
// js/ui/bingo-tab.js
// 5x5 bingo grid + bonus strip + cell detail modal with photo upload.
// Called by js/ui/fun-tab.js when the user selects the Bingo sub-tab.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, on, empty } from '../utils/dom.js';
import { showToast } from './toast.js';
import {
  ensureBingoData, getActiveCard, isDone, markDone, markUndone,
  getProgress, detectBingoLines, attachPhoto, getPhoto, removePhoto
} from '../features/bingo.js';

function useTr() { return state.getSlice('language') === 'tr'; }

export async function renderBingo(container) {
  empty(container);
  const loading = h('p', { class: 'text-muted', 'aria-busy': 'true' }, t('bingo.loading'));
  container.appendChild(loading);

  await ensureBingoData();
  empty(container);

  const card = getActiveCard(state.getSlice('route'));
  const { done, total } = getProgress();

  container.appendChild(h('header', { class: 'bingo-header' }, [
    h('h3', null, `🎯 ${t('bingo.title')}`),
    h('p', { class: 'bingo-progress' }, t('bingo.progress', { done, total }))
  ]));

  const grid = h('div', { class: 'bingo-grid', role: 'grid', 'aria-label': t('bingo.gridLabel') });
  card.universal.forEach((cell, i) => grid.appendChild(buildCell(cell, 'universal')));
  container.appendChild(grid);

  if (card.bonuses.length) {
    container.appendChild(h('h4', null, `⭐ ${t('bingo.bonusTitle')}`));
    const strip = h('div', { class: 'bingo-bonus-strip' });
    card.bonuses.forEach(b => strip.appendChild(buildCell(b, 'bonus')));
    container.appendChild(strip);
  }

  container.appendChild(h('p', { class: 'bingo-legend text-muted small' }, t('bingo.legend')));

  const completedIds = new Set(Object.keys(state.getSlice('bingo')?.completed || {}));
  const lines = detectBingoLines(card.universal, completedIds);
  if (lines.length) {
    container.appendChild(h('div', { class: 'bingo-celebrate' }, [
      h('strong', null, `🎉 ${t('bingo.lineBanner', { n: lines.length })}`)
    ]));
  }

  // Async: render any existing photos as thumbnails
  for (const cell of [...card.universal, ...card.bonuses]) {
    getPhoto(cell.id).then(blob => {
      if (!blob) return;
      const host = container.querySelector(`[data-cell-id="${cell.id}"] .bingo-cell-thumb`);
      if (!host) return;
      const url = URL.createObjectURL(blob);
      const img = h('img', { src: url, alt: '' });
      host.appendChild(img);
    });
  }
}

function buildCell(cell, type) {
  const title = useTr() ? cell.titleTr : cell.title;
  const done = isDone(cell.id);
  const btn = h('button', {
    class: `bingo-cell ${done ? 'is-done' : ''} bingo-cell-${type}`,
    type: 'button',
    role: 'gridcell',
    'aria-pressed': done ? 'true' : 'false',
    'data-cell-id': cell.id
  }, [
    h('div', { class: 'bingo-cell-emoji' }, cell.emoji || '⭐'),
    h('div', { class: 'bingo-cell-title' }, title),
    h('div', { class: 'bingo-cell-thumb' })
  ]);
  on(btn, 'click', () => openCellDetail(cell));
  return btn;
}

function openCellDetail(cell) {
  const title = useTr() ? cell.titleTr : cell.title;
  const hint  = useTr() ? cell.hintTr  : cell.hint;
  const done  = isDone(cell.id);

  const overlay = h('div', { class: 'modal-overlay bingo-modal-overlay', role: 'dialog', 'aria-modal': 'true' });
  const body = h('div', { class: 'modal-body' }, [
    h('p', { class: 'bingo-hint' }, hint || ''),
    (() => {
      const input = h('input', { type: 'file', accept: 'image/*', 'aria-label': t('bingo.uploadLabel') });
      on(input, 'change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          await attachPhoto(cell.id, file);
          showToast({ message: t('bingo.photoSaved'), variant: 'success' });
          close();
          rerenderParent();
        } catch (e) {
          showToast({ message: t('bingo.photoFailed'), variant: 'danger' });
        }
      });
      return input;
    })(),
    h('div', { class: 'modal-actions' }, [
      (() => {
        const b = h('button', { class: done ? 'btn btn-secondary' : 'btn btn-primary', type: 'button' },
          done ? t('bingo.markUndone') : t('bingo.markDone'));
        on(b, 'click', () => {
          if (done) markUndone(cell.id); else markDone(cell.id);
          close();
          rerenderParent();
        });
        return b;
      })(),
      (() => {
        const r = h('button', { class: 'btn btn-ghost', type: 'button' }, t('bingo.removePhoto'));
        on(r, 'click', async () => { await removePhoto(cell.id); close(); rerenderParent(); });
        return r;
      })()
    ])
  ]);

  const card = h('div', { class: 'modal-card' }, [
    h('header', { class: 'modal-header' }, [
      h('h3', null, `${cell.emoji || '⭐'} ${title}`),
      h('button', { class: 'modal-close', type: 'button', 'aria-label': t('modal.close') }, '×')
    ]),
    body
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  on(overlay, 'click', ev => { if (ev.target === overlay) close(); });
  card.querySelector('.modal-close').addEventListener('click', close);
}

function rerenderParent() {
  const host = document.querySelector('.fun-panel-bingo');
  if (host) renderBingo(host);
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/ui/bingo-tab.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/ui/bingo-tab.js
git commit -m "feat(bingo): 5x5 grid UI + cell detail modal with photo upload"
```

---

## Task 19: Create `js/features/daily-dare.js`

**Files:**
- Create: `js/features/daily-dare.js`

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Write the module**

```js
// js/features/daily-dare.js
// Deterministic dare rotation + streak tracking. Picks today's dare
// using (dayOfYear ^ FNV1a(YYYY)) seed so every device sees the same
// dare on the same day with zero network traffic.

import { state } from '../state.js';
import { loadDares } from '../data/loader.js';
import { h, on } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';

let _dares = null;

function isoDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayOfYear(d) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60000;
  return Math.floor(diff / 86400000);
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export async function ensureDares() {
  if (_dares) return _dares;
  const d = await loadDares();
  _dares = d.dares || [];
  return _dares;
}

export function pickTodaysDare(dares, route, today = new Date()) {
  if (!dares?.length) return null;
  const seed = dayOfYear(today) ^ fnv1a(String(today.getFullYear()));
  const routeCountries = new Set((route?.stops || []).map(s => s.countryId));
  const preferred = dares.filter(d => d.preferredCountries?.length && d.preferredCountries.some(c => routeCountries.has(c)));
  const pool = preferred.length ? preferred : dares.filter(d => !d.preferredCountries?.length);
  const index = seed % pool.length;
  return pool[index];
}

export function markDareDone(dateKey = isoDay()) {
  state.update('dares', prev => ({
    ...prev,
    completed: { ...prev.completed, [dateKey]: true },
    streak: computeStreak({ ...prev.completed, [dateKey]: true })
  }));
}

export function skipToday(dateKey = isoDay()) {
  state.update('dares', prev => ({
    ...prev,
    completed: { ...prev.completed, [dateKey]: 'skipped' },
    streak: computeStreak({ ...prev.completed, [dateKey]: 'skipped' })
  }));
}

export function computeStreak(completed) {
  let streak = 0;
  let cursor = new Date();
  for (let i = 0; i < 365; i++) {
    const key = isoDay(cursor);
    const v = completed[key];
    if (v === true) { streak++; cursor.setDate(cursor.getDate() - 1); continue; }
    if (v === 'skipped' && streak === 0) { cursor.setDate(cursor.getDate() - 1); continue; }
    break;
  }
  return streak;
}

export function getStreak() {
  return state.getSlice('dares')?.streak ?? 0;
}

export function isTodayDone() {
  return state.getSlice('dares')?.completed?.[isoDay()] === true;
}

export function renderDareCard(container, dare) {
  if (!container) return;
  container.innerHTML = '';
  if (!dare) {
    container.appendChild(h('p', { class: 'text-muted' }, t('dares.noneToday')));
    return;
  }
  const useTr = state.getSlice('language') === 'tr';
  const title = useTr ? dare.titleTr : dare.title;
  const streak = getStreak();
  const done = isTodayDone();

  const card = h('section', { class: `dare-card ${done ? 'is-done' : ''}` }, [
    h('div', { class: 'dare-emoji' }, dare.emoji || '⭐'),
    h('h3', null, title),
    h('p', { class: 'dare-meta' }, [
      h('span', null, `🏅 +${dare.xp} XP`),
      ' · ',
      h('span', null, t('dares.streakLabel', { days: streak }))
    ]),
    h('div', { class: 'dare-actions' }, [
      (() => {
        const b = h('button', { class: done ? 'btn btn-secondary' : 'btn btn-primary', type: 'button' },
          done ? t('dares.done') : t('dares.markDone'));
        on(b, 'click', () => { markDareDone(); renderDareCard(container, dare); });
        return b;
      })(),
      (() => {
        const s = h('button', { class: 'btn btn-ghost', type: 'button' }, t('dares.skip'));
        on(s, 'click', () => { skipToday(); renderDareCard(container, dare); });
        return s;
      })()
    ])
  ]);
  container.appendChild(card);
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/features/daily-dare.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/features/daily-dare.js
git commit -m "feat(dares): deterministic daily dare picker + streak tracking"
```

---

## Task 20: Create `js/features/future-me.js`

**Files:**
- Create: `js/features/future-me.js`

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Write the module**

```js
// js/features/future-me.js
// Time capsule messages stored in localStorage. Reveal is triggered
// client-side by date comparison; an optional .ics export gives the
// user a portable calendar alarm anchor.

import { state } from '../state.js';
import { buildICS, downloadICS } from '../utils/ics.js';
import { h, on } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { showToast } from './../ui/toast.js';

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'fm-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function listMessages() {
  return state.getSlice('futureMessages') || [];
}

export function addMessage({ message, revealDate }) {
  if (!message || !revealDate) throw new Error('[futureMe] message + revealDate required');
  const id = uuid();
  const entry = { id, message: String(message), createdAt: new Date().toISOString(), revealDate };
  state.update('futureMessages', prev => [...(prev || []), entry]);
  return id;
}

export function deleteMessage(id) {
  state.update('futureMessages', prev => (prev || []).filter(m => m.id !== id));
}

export function isRevealed(msg) {
  return Date.now() >= new Date(msg.revealDate).getTime();
}

export function getDaysUntilReveal(msg) {
  const diff = new Date(msg.revealDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export function exportToCalendar(msg) {
  const ics = buildICS({
    uid: `futureme-${msg.id}@discovereu-companion`,
    summary: t('futureMe.icsSummary'),
    description: t('futureMe.icsDesc'),
    startDate: new Date(msg.revealDate),
    alarms: [{ minutesBefore: 0, description: t('futureMe.icsAlarm') }]
  });
  downloadICS(`futureme-${msg.revealDate.slice(0, 10)}.ics`, ics);
}

/**
 * Renders the FutureMe sub-tab panel: list + [+ New] button + compose
 * modal on click. Called by js/ui/fun-tab.js.
 */
export function renderFutureMe(container) {
  container.innerHTML = '';
  const useTr = state.getSlice('language') === 'tr';
  container.appendChild(h('header', { class: 'futureme-header' }, [
    h('h3', null, `🕰️ ${t('futureMe.title')}`),
    (() => {
      const b = h('button', { class: 'btn btn-primary', type: 'button' }, `+ ${t('futureMe.newBtn')}`);
      on(b, 'click', () => openCompose(container));
      return b;
    })()
  ]));

  const msgs = listMessages();
  if (!msgs.length) {
    container.appendChild(h('p', { class: 'text-muted' }, t('futureMe.empty')));
    return;
  }
  const list = h('ul', { class: 'futureme-list' });
  for (const msg of msgs) {
    const revealed = isRevealed(msg);
    const days = getDaysUntilReveal(msg);
    const item = h('li', { class: `futureme-item ${revealed ? 'is-revealed' : 'is-sealed'}` }, [
      h('div', { class: 'futureme-item-head' }, [
        h('strong', null, revealed ? '📖 ' + t('futureMe.opened') : '🔒 ' + t('futureMe.sealed')),
        h('span', { class: 'futureme-date' }, msg.revealDate.slice(0, 10))
      ]),
      revealed
        ? h('p', { class: 'futureme-message' }, msg.message)
        : h('p', { class: 'futureme-countdown' }, t('futureMe.revealedIn', { days })),
      h('div', { class: 'futureme-actions' }, [
        (() => {
          const a = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, `📅 ${t('futureMe.export')}`);
          on(a, 'click', () => exportToCalendar(msg));
          return a;
        })(),
        (() => {
          const d = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, `🗑 ${t('futureMe.delete')}`);
          on(d, 'click', () => {
            if (confirm(t('futureMe.confirmDelete'))) {
              deleteMessage(msg.id);
              renderFutureMe(container);
            }
          });
          return d;
        })()
      ])
    ]);
    list.appendChild(item);
  }
  container.appendChild(list);
}

function openCompose(parent) {
  const overlay = h('div', { class: 'modal-overlay futureme-modal-overlay', role: 'dialog', 'aria-modal': 'true' });
  const textarea = h('textarea', { class: 'input', rows: '5', placeholder: t('futureMe.placeholder') });
  const dateInput = h('input', { type: 'date', class: 'input', min: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });

  const card = h('div', { class: 'modal-card' }, [
    h('header', { class: 'modal-header' }, [
      h('h3', null, `🕰️ ${t('futureMe.newTitle')}`),
      h('button', { class: 'modal-close', type: 'button', 'aria-label': t('modal.close') }, '×')
    ]),
    h('div', { class: 'modal-body' }, [
      h('label', null, t('futureMe.messageLabel')),
      textarea,
      h('label', null, t('futureMe.dateLabel')),
      dateInput,
      h('div', { class: 'modal-actions' }, [
        (() => {
          const s = h('button', { class: 'btn btn-primary', type: 'button' }, t('futureMe.save'));
          on(s, 'click', () => {
            const msg = textarea.value.trim();
            const dt = dateInput.value;
            if (!msg || !dt) { showToast({ message: t('futureMe.needBoth'), variant: 'warning' }); return; }
            addMessage({ message: msg, revealDate: new Date(dt).toISOString() });
            close();
            renderFutureMe(parent);
          });
          return s;
        })()
      ])
    ])
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  on(overlay, 'click', ev => { if (ev.target === overlay) close(); });
  card.querySelector('.modal-close').addEventListener('click', close);

  textarea.focus();
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check js/features/future-me.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add js/features/future-me.js
git commit -m "feat(futureMe): time capsule messages with .ics calendar export"
```

---

## Task 21: Grow tab bar 7 → 8 (CSS + index.html + i18n label)

**Files:**
- Modify: `css/main.css` (`.bottom-nav` grid-template-columns)
- Modify: `index.html` (insert `Eğlence` button in both `.panel-tabs` and `.bottom-nav`)
- Modify: `i18n/en.json` + `i18n/tr.json` (add `panel.tab.fun` key)

**Preferred agent type:** `ui-designer`.

- [ ] **Step 1: Update `.bottom-nav` to 8 columns**

Open `css/main.css`. Find the `.bottom-nav` grid rule from Tier 3 sub-project 1:

```css
  .bottom-nav {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
```

Change `7` to `8`:

```css
  .bottom-nav {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
```

- [ ] **Step 2: Insert the `fun` tab in the panel-tabs nav**

Open `index.html`. Find the panel-tab `<nav class="panel-tabs">` block. After the `data-tab="compare"` button, before `data-tab="inclusion"`, insert:

```html
          <button class="panel-tab" role="tab" data-tab="fun">
            <svg class="tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2l2.39 4.85 5.34.78-3.87 3.77.91 5.32L12 14.77l-4.77 2.51.91-5.32L4.27 7.63l5.34-.78L12 2z"/>
            </svg>
            <span class="tab-label" data-i18n="panel.tab.fun">Fun</span>
          </button>
```

- [ ] **Step 3: Insert the `fun` tab in the bottom-nav**

In the same `index.html`, find the `<nav class="bottom-nav">` block. After `data-tab="compare"`, before `data-tab="inclusion"`, insert:

```html
      <button class="bottom-nav-item" data-tab="fun">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 2l2.39 4.85 5.34.78-3.87 3.77.91 5.32L12 14.77l-4.77 2.51.91-5.32L4.27 7.63l5.34-.78L12 2z"/>
        </svg>
        <span data-i18n="panel.tab.fun">Fun</span>
      </button>
```

- [ ] **Step 4: Add the `fun` label in both i18n files**

Open `i18n/en.json`. Find the `panel.tab` block and add `"fun": "Fun"` between `"compare"` and `"inclusion"`:

```json
"tab": {
  "detail": "Info",
  "route": "Route",
  "budget": "Cost",
  "filters": "Filter",
  "compare": "Match",
  "fun": "Fun",
  "inclusion": "Equal",
  "prep": "Prep"
}
```

Open `i18n/tr.json`. Add `"fun": "Eğlence"` in the same location. (The longer TR label is fine — the icon+label layout uses `text-overflow: ellipsis` and at 420 px panel / 8 tabs = ~52 px per tab, which still fits the 7-char "Eğlence" via ellipsis on mobile and fully on desktop.)

- [ ] **Step 5: Validate JSONs parse**

```bash
python -c "import json; [json.load(open(f, encoding='utf-8')) for f in ['i18n/en.json','i18n/tr.json']]; print('OK')"
```
Expected: `OK`.

- [ ] **Step 6: Browser smoke test**

Unlock browser, clear SW, navigate:

```
mcp__playwright__browser_navigate → http://localhost:8765/index.html?bust=t21
```

Take a screenshot of `.panel-tabs`. Expect 8 icons equally spaced, no horizontal scroll. Switch language to TR, verify `Eğlence` label is visible (may be truncated on desktop, should still be recognisable).

- [ ] **Step 7: Commit**

```bash
git add css/main.css index.html i18n/en.json i18n/tr.json
git commit -m "ui(tabs): grow to 8 tabs with Eğlence — Fun tab button"
```

---

## Task 22: Create `js/ui/fun-tab.js` + wire into `main.js`

**Files:**
- Create: `js/ui/fun-tab.js`
- Modify: `js/main.js` (register the fun tab renderer alongside other tabs)

**Preferred agent type:** `ui-designer`.

- [ ] **Step 1: Write `js/ui/fun-tab.js`**

```js
// js/ui/fun-tab.js
// "Eğlence" tab shell: sub-tab bar (Bingo · Daily Dare · FutureMe) with
// keyboard ←/→ navigation and local-only activeFunSubtab state.
// Each sub-tab lazy-imports its renderer to keep initial cost low.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { qs, h, on, empty } from '../utils/dom.js';

const SUBTABS = ['bingo', 'dares', 'futureMe'];

export function initFunTab() {
  const body = qs('#panelBody');
  if (!body) return;

  const render = async () => {
    if (state.getSlice('panelTab') !== 'fun') return;
    await renderFunShell(body);
  };

  state.subscribe('panelTab',        render);
  state.subscribe('activeFunSubtab', render);
  state.subscribe('language',        render);
  state.subscribe('route',           render);
  state.subscribe('bingo',           render);
  state.subscribe('dares',           render);
  state.subscribe('futureMessages',  render);

  render();
}

async function renderFunShell(root) {
  empty(root);
  const active = state.getSlice('activeFunSubtab') || 'bingo';

  const bar = h('nav', { class: 'fun-subtabs', role: 'tablist', 'aria-label': t('fun.subtabLabel') });
  for (const key of SUBTABS) {
    const btn = h('button', {
      class: `fun-subtab ${active === key ? 'is-active' : ''}`,
      role: 'tab',
      type: 'button',
      'aria-selected': active === key ? 'true' : 'false',
      'data-subtab': key
    }, [
      h('span', null, subtabEmoji(key)),
      h('span', null, t(`fun.subtab.${key}`))
    ]);
    on(btn, 'click', () => state.set('activeFunSubtab', key));
    on(btn, 'keydown', ev => {
      const i = SUBTABS.indexOf(key);
      if (ev.key === 'ArrowRight') state.set('activeFunSubtab', SUBTABS[(i + 1) % SUBTABS.length]);
      if (ev.key === 'ArrowLeft')  state.set('activeFunSubtab', SUBTABS[(i - 1 + SUBTABS.length) % SUBTABS.length]);
    });
    bar.appendChild(btn);
  }
  root.appendChild(bar);

  const panel = h('div', { class: `fun-panel fun-panel-${active}`, role: 'tabpanel' });
  root.appendChild(panel);

  if (active === 'bingo') {
    const { renderBingo } = await import('./bingo-tab.js');
    await renderBingo(panel);
  } else if (active === 'dares') {
    const { ensureDares, pickTodaysDare, renderDareCard } = await import('../features/daily-dare.js');
    const dares = await ensureDares();
    const today = pickTodaysDare(dares, state.getSlice('route'));
    renderDareCard(panel, today);
  } else if (active === 'futureMe') {
    const { renderFutureMe } = await import('../features/future-me.js');
    renderFutureMe(panel);
  }
}

function subtabEmoji(key) {
  return { bingo: '🎯', dares: '⚡', futureMe: '🕰️' }[key] || '⭐';
}
```

- [ ] **Step 2: Wire `initFunTab` in `main.js`**

Open `js/main.js`. Find where `initInclusion()` (or any other tab) is called from Tier 3. Add next to it:

```js
const { initFunTab } = await import('./ui/fun-tab.js');
initFunTab();
```

- [ ] **Step 3: Browser smoke test**

Unlock browser, clear SW, navigate, click the Eğlence tab. Expect the sub-tab bar with 3 chips + the Bingo grid to render. Use `ArrowRight` on the active chip — expect Daily Dare to appear. `ArrowRight` again — expect FutureMe.

- [ ] **Step 4: Commit**

```bash
git add js/ui/fun-tab.js js/main.js
git commit -m "feat(fun): Eğlence tab shell wiring Bingo, Daily Dare, FutureMe"
```

---

## Task 23: Extend `js/features/turkish-bonus.js` with consulate reminder card

**Files:**
- Modify: `js/features/turkish-bonus.js`
- Modify: `data/turkish-bonus.json` (only if it needs a new `consulateDocs` sub-list — otherwise re-uses existing `schengenChecklist`)

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Import ics helpers + consulate loader**

Open `js/features/turkish-bonus.js`. Add at the top (next to the existing `loadJson` / `h` / `on` imports):

```js
import { buildICS, downloadICS } from '../utils/ics.js';
import { loadConsulates } from '../data/loader.js';
import { t } from '../i18n/i18n.js';
```

- [ ] **Step 2: Append consulate logic + renderer**

At the end of `turkish-bonus.js`, append:

```js

// ─────────────────────────────────────────────────────────────────────────────
// Consulate reminder — 4th Turkish bonus card (sub-project 2)
// ─────────────────────────────────────────────────────────────────────────────

let _consulatesCache = null;
async function ensureConsulates() {
  if (_consulatesCache) return _consulatesCache;
  _consulatesCache = await loadConsulates().catch(() => null);
  return _consulatesCache;
}

export function getAppointment() {
  return state.getSlice('user')?.consulateAppointment || null;
}

export function saveAppointment({ countryId, city, datetime, notes }) {
  state.update('user', prev => ({
    ...prev,
    consulateAppointment: { countryId, city, datetime, notes: notes || '' }
  }));
}

export function clearAppointment() {
  state.update('user', prev => ({ ...prev, consulateAppointment: null }));
}

function findCentre(data, countryId) {
  if (!data?.centres) return null;
  return data.centres.find(c => c.countryId === countryId) || null;
}

export function exportAppointmentICS(appt, centre) {
  if (!appt || !centre) return;
  const ics = buildICS({
    uid: `consulate-${appt.countryId}-${appt.datetime}@discovereu-companion`,
    summary: `${t('consulate.icsSummary')} — ${centre.countryNameTr || centre.countryName}`,
    description: t('consulate.icsDesc'),
    location: `${centre.provider} — ${appt.city}`,
    startDate: new Date(appt.datetime),
    alarms: [
      { minutesBefore: 1440, description: t('consulate.alarm1') },
      { minutesBefore: 120,  description: t('consulate.alarm2') }
    ]
  });
  downloadICS(`consulate-${appt.datetime.slice(0, 10)}.ics`, ics);
}

/**
 * Render the 4th Turkish bonus card. Called from the existing
 * buildLayer() flow — caller should append the return value after
 * renderBudgetCard().
 */
export async function renderConsulateCard() {
  const data = await ensureConsulates();
  const appt = getAppointment();
  const card = h('section', { class: 'tr-card tr-card-consulate' }, [
    h('h3', null, `🏛️ ${t('consulate.title')}`)
  ]);

  if (!appt) {
    const addBtn = h('button', { class: 'btn btn-primary', type: 'button' }, `+ ${t('consulate.addCta')}`);
    on(addBtn, 'click', () => openConsulateForm(data));
    card.appendChild(h('p', { class: 'text-muted' }, t('consulate.empty')));
    card.appendChild(addBtn);
    return card;
  }

  const centre = findCentre(data, appt.countryId);
  const when = new Date(appt.datetime);
  const now = new Date();
  const diffMs = when - now;
  const days  = Math.max(0, Math.floor(diffMs / 86400000));
  const hours = Math.max(0, Math.floor((diffMs % 86400000) / 3600000));

  card.appendChild(h('p', { class: 'consulate-countdown' }, t('consulate.countdown', { days, hours })));
  card.appendChild(h('p', null, `📍 ${centre?.provider || ''} — ${appt.city}`));
  if (appt.notes) card.appendChild(h('p', { class: 'text-muted small' }, appt.notes));

  const actions = h('div', { class: 'tr-actions' }, [
    (() => {
      const a = h('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, `📅 ${t('consulate.addToCalendar')}`);
      on(a, 'click', () => exportAppointmentICS(appt, centre));
      return a;
    })(),
    (() => {
      const e = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, `✏️ ${t('consulate.edit')}`);
      on(e, 'click', () => openConsulateForm(data, appt));
      return e;
    })(),
    (() => {
      const d = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, `🗑 ${t('consulate.delete')}`);
      on(d, 'click', () => { if (confirm(t('consulate.confirmDelete'))) clearAppointment(); });
      return d;
    })()
  ]);
  card.appendChild(actions);
  return card;
}

function openConsulateForm(data, existing) {
  const overlay = h('div', { class: 'modal-overlay consulate-modal-overlay', role: 'dialog', 'aria-modal': 'true' });
  const countrySelect = h('select', { class: 'input' },
    (data?.centres || []).map(c =>
      h('option', { value: c.countryId, ...(existing?.countryId === c.countryId ? { selected: 'selected' } : {}) },
        `${c.countryNameTr || c.countryName}`)
    )
  );
  const cityInput = h('input', { type: 'text', class: 'input', placeholder: 'Istanbul', value: existing?.city || '' });
  const dtInput = h('input', { type: 'datetime-local', class: 'input', value: existing?.datetime?.slice(0, 16) || '' });
  const notesInput = h('textarea', { class: 'input', rows: '3', placeholder: t('consulate.notesPlaceholder') }, existing?.notes || '');

  const card = h('div', { class: 'modal-card' }, [
    h('header', { class: 'modal-header' }, [
      h('h3', null, `🏛️ ${t('consulate.formTitle')}`),
      h('button', { class: 'modal-close', type: 'button', 'aria-label': t('modal.close') }, '×')
    ]),
    h('div', { class: 'modal-body' }, [
      h('label', null, t('consulate.country')), countrySelect,
      h('label', null, t('consulate.city')),    cityInput,
      h('label', null, t('consulate.datetime')),dtInput,
      h('label', null, t('consulate.notes')),   notesInput,
      h('div', { class: 'modal-actions' }, [
        (() => {
          const b = h('button', { class: 'btn btn-primary', type: 'button' }, t('consulate.save'));
          on(b, 'click', () => {
            const countryId = countrySelect.value;
            const city = cityInput.value.trim();
            const datetime = dtInput.value;
            if (!countryId || !city || !datetime) return;
            saveAppointment({ countryId, city, datetime: new Date(datetime).toISOString(), notes: notesInput.value.trim() });
            close();
          });
          return b;
        })()
      ])
    ])
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  on(overlay, 'click', ev => { if (ev.target === overlay) close(); });
  card.querySelector('.modal-close').addEventListener('click', close);
}
```

- [ ] **Step 3: Mount the consulate card inside the existing `buildLayer(data)` function**

Still in `js/features/turkish-bonus.js`, find the existing `buildLayer(data)` function (that currently appends Schengen + Sofia + Budget cards). At the end, make it also append a placeholder for the consulate card and fill it asynchronously:

```js
function buildLayer(data) {
  const lang = state.getSlice('language');
  const useTr = lang === 'tr';

  const wrap = h('div', { class: 'tr-bonus' }, [
    renderSchengenCard(data, useTr),
    renderSofiaCard(data, useTr),
    renderBudgetCard(data, useTr)
  ]);

  // Async consulate card (it needs tr-consulates.json)
  const consulateHost = h('div', { class: 'tr-consulate-host' });
  wrap.appendChild(consulateHost);
  renderConsulateCard().then(card => { if (card) consulateHost.appendChild(card); });

  return wrap;
}
```

(If `buildLayer` is currently a pure return, adapt the minimal change needed to add `consulateHost`; do not restructure the function.)

- [ ] **Step 4: Syntax check + smoke**

```bash
node --check js/features/turkish-bonus.js
```

Navigate in browser with `?lang=tr` or toggle TR. Open Prep tab. Expect a 4th card `🏛️ Konsolosluk randevusu` with an `+ Randevu ekle` button. Click it, fill the form, save. Expect the card to re-render with a countdown + `📅 Takvime ekle` action. Click that — expect a `.ics` download.

- [ ] **Step 5: Commit**

```bash
git add js/features/turkish-bonus.js
git commit -m "feat(turkish): consulate reminder card with .ics alarms (2h + 1d)"
```

---

## Task 24: i18n bulk block (EN + TR) for sub-project 2

**Files:**
- Modify: `i18n/en.json`
- Modify: `i18n/tr.json`

**Preferred agent type:** `data-curator`.

- [ ] **Step 1: Add the sub-project 2 namespaces to `i18n/en.json`**

Open `i18n/en.json`. Append these new top-level blocks (next to existing `inclusion`, `wizard`, `turkishBonus`). Write every key — no empty values:

```json
"ai": {
  "headerCta": "✨ AI Suggest",
  "title": "AI Route Suggestion",
  "key": {
    "intro": "Bring your own Groq API key. Your key never leaves your browser.",
    "getLink": "Get a free Groq key →",
    "label": "Groq API key",
    "save": "Save key",
    "invalid": "That doesn't look like a Groq key (gsk_…)",
    "privacy": "Stored only in your browser localStorage."
  },
  "prompt": {
    "intro": "Describe the trip you want — we'll draft a route.",
    "placeholder": "e.g. 14 days, beaches + small towns, mid budget",
    "label": "Your trip idea",
    "submit": "Suggest route"
  },
  "chip": {
    "beach": "Beaches",
    "history": "History",
    "nature": "Nature",
    "party": "Party",
    "access": "Accessible"
  },
  "loading": "Asking the AI…",
  "loading.cancel": "Cancel",
  "result": {
    "nights": "nights",
    "replace": "Replace my route",
    "add": "Add to my route",
    "retry": "Try again",
    "applied": "Route applied"
  },
  "err": {
    "auth": "Your Groq key was rejected. Update it and try again.",
    "rate": "Groq rate limit hit. Try again in a minute.",
    "parse": "The AI returned an unexpected response. Try again.",
    "network": "Network error talking to Groq.",
    "updateKey": "Update key"
  }
},
"fun": {
  "subtabLabel": "Fun sub-sections",
  "subtab": {
    "bingo": "Bingo",
    "dares": "Daily Dare",
    "futureMe": "FutureMe"
  }
},
"bingo": {
  "loading": "Loading bingo card…",
  "title": "City Bingo",
  "progress": "{{done}} / {{total}} complete",
  "gridLabel": "Bingo 5 by 5 grid",
  "bonusTitle": "Country bonuses",
  "legend": "Tap any cell to mark it done or add a photo.",
  "lineBanner": "{{n}} line(s) complete — nice!",
  "markDone": "Mark done",
  "markUndone": "Mark undone",
  "uploadLabel": "Attach photo evidence",
  "photoSaved": "Photo saved locally",
  "photoFailed": "Couldn't save photo",
  "removePhoto": "Remove photo"
},
"dares": {
  "noneToday": "No dare for today.",
  "streakLabel": "{{days}} day streak",
  "markDone": "Mark done",
  "done": "Done today",
  "skip": "Skip"
},
"futureMe": {
  "title": "FutureMe",
  "newBtn": "New message",
  "newTitle": "Write to your future self",
  "empty": "No messages yet. Leave one for the next chapter of the trip.",
  "sealed": "Sealed",
  "opened": "Opened",
  "revealedIn": "Reveals in {{days}} days",
  "messageLabel": "Message",
  "dateLabel": "Reveal date",
  "placeholder": "Hey future me…",
  "save": "Seal it",
  "needBoth": "Please write a message and pick a date.",
  "export": "Calendar",
  "delete": "Delete",
  "confirmDelete": "Delete this time capsule?",
  "icsSummary": "DiscoverEU FutureMe — your message is ready",
  "icsDesc": "Open the DiscoverEU Companion and head to Fun → FutureMe to read your message.",
  "icsAlarm": "Your message is ready today"
},
"soundtrack": {
  "title": "Country Playlist",
  "fallbackNote": "No regional Top 50 for this country — using Global Top 50 instead.",
  "attribution": "Powered by Spotify — 30-second previews play anonymously."
},
"consulate": {
  "title": "Consulate appointment",
  "empty": "Add your Schengen visa appointment to get a countdown and a calendar reminder.",
  "addCta": "Add appointment",
  "countdown": "{{days}} days {{hours}} hours until your appointment",
  "addToCalendar": "Add to calendar",
  "edit": "Edit",
  "delete": "Delete",
  "confirmDelete": "Remove this appointment?",
  "formTitle": "Consulate appointment",
  "country": "Country",
  "city": "City",
  "datetime": "Date & time",
  "notes": "Notes",
  "notesPlaceholder": "Application reference, documents ready, etc.",
  "save": "Save",
  "icsSummary": "Consulate appointment",
  "icsDesc": "Documents checklist: passport, biometric photo, insurance (€30k), financial proof (€50/day), DiscoverEU invitation letter, appointment printout.",
  "alarm1": "Consulate appointment tomorrow",
  "alarm2": "Consulate appointment in 2 hours"
},
"guide": {
  "missing": "Guide not yet compiled for this country — contribute on GitHub.",
  "countryTitle": "Country Guide",
  "topCitiesTitle": "Top Cities ({{n}})",
  "lastUpdated": "Last updated {{date}}",
  "source": "Source",
  "section": {
    "summary": "Overview",
    "whenToGo": "When to go",
    "whatToEat": "What to eat",
    "transport": "Transport",
    "money": "Money",
    "etiquette": "Etiquette",
    "safety": "Safety",
    "connectivity": "Connectivity",
    "languageBasics": "Language basics",
    "avoidPitfalls": "Avoid these pitfalls"
  },
  "city": {
    "mustSee": "Must see",
    "mustEat": "Must eat",
    "free": "Free things",
    "transport": "Local transport",
    "safety": "Safety",
    "avoid": "Avoid"
  }
},
"modal": {
  "close": "Close"
}
```

- [ ] **Step 2: Add the same keys in TR to `i18n/tr.json`**

Mirror every key in the block above with the Turkish translation. Example starting point:

```json
"ai": {
  "headerCta": "✨ AI Öneri",
  "title": "AI Rota Önerisi",
  "key": {
    "intro": "Kendi Groq API anahtarını kullan. Anahtarın tarayıcından asla çıkmaz.",
    "getLink": "Ücretsiz Groq anahtarı al →",
    "label": "Groq API anahtarı",
    "save": "Kaydet",
    "invalid": "Bu bir Groq anahtarına benzemiyor (gsk_…)",
    "privacy": "Sadece tarayıcında localStorage'da saklanır."
  },
  "prompt": {
    "intro": "İstediğin geziyi anlat — rota taslağını hazırlarız.",
    "placeholder": "örn. 14 gün, plaj + küçük kasabalar, orta bütçe",
    "label": "Gezi fikrin",
    "submit": "Rota öner"
  },
  "chip": {
    "beach": "Plaj",
    "history": "Tarih",
    "nature": "Doğa",
    "party": "Parti",
    "access": "Erişilebilir"
  },
  "loading": "AI'ya soruluyor…",
  "loading.cancel": "İptal",
  "result": {
    "nights": "gece",
    "replace": "Rotamı değiştir",
    "add": "Rotama ekle",
    "retry": "Yeniden dene",
    "applied": "Rota uygulandı"
  },
  "err": {
    "auth": "Groq anahtarın reddedildi. Güncelle ve tekrar dene.",
    "rate": "Groq istek limiti doldu. Bir dakika sonra tekrar dene.",
    "parse": "AI beklenmeyen bir yanıt döndü. Tekrar dene.",
    "network": "Groq ile ağ hatası.",
    "updateKey": "Anahtarı güncelle"
  }
}
```

Continue the pattern for every `fun`, `bingo`, `dares`, `futureMe`, `soundtrack`, `consulate`, `guide`, `modal` namespace. Hand-translate every value. No machine translation.

- [ ] **Step 3: Validate both files parse and keys match**

```bash
python -c "
import json
en = json.load(open('i18n/en.json', encoding='utf-8'))
tr = json.load(open('i18n/tr.json', encoding='utf-8'))
def flatten(d, prefix=''):
    out = set()
    for k, v in (d or {}).items():
        full = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict): out |= flatten(v, full)
        else: out.add(full)
    return out
ek, tk = flatten(en), flatten(tr)
missing_tr = ek - tk
missing_en = tk - ek
print('en only (missing in tr):', sorted(missing_tr))
print('tr only (missing in en):', sorted(missing_en))
assert not missing_tr and not missing_en, 'i18n key trees diverge'
print('OK')
"
```
Expected: `OK`, no diffs.

- [ ] **Step 4: Commit**

```bash
git add i18n/en.json i18n/tr.json
git commit -m "i18n: ai, fun, bingo, dares, futureMe, soundtrack, consulate, guide blocks"
```

---

## Task 25: CSS polish for sub-project 2 components

**Files:**
- Modify: `css/components.css`

**Preferred agent type:** `ui-designer`.

- [ ] **Step 1: Append sub-project 2 component styles**

Open `css/components.css`. At the end of the file, append the following block. It must use only existing CSS custom properties — no hardcoded colours:

```css

/* ─── Sub-project 2 components ───────────────────────────────────── */

/* AI modal */
.ai-modal-overlay .modal-card { max-width: 520px; }
.ai-screen { display: flex; flex-direction: column; gap: var(--space-3); }
.ai-screen .spinner {
  width: 32px; height: 32px;
  border: 3px solid var(--border-subtle);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: ai-spin 0.9s linear infinite;
  align-self: center;
}
@keyframes ai-spin { to { transform: rotate(360deg); } }
.ai-chips { display: flex; flex-wrap: wrap; gap: var(--space-2); }
.ai-prompt { width: 100%; resize: vertical; }
.ai-result-list { padding-left: var(--space-4); margin: var(--space-3) 0; }
.ai-result-list li { margin-bottom: var(--space-2); }
.ai-result-reason { color: var(--text-secondary); font-size: var(--text-sm); }
.ai-result-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.ai-key-privacy { color: var(--text-secondary); font-size: var(--text-xs); }

/* Guide accordions */
.guide-accordion {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  margin-top: var(--space-3);
  overflow: hidden;
}
.guide-accordion > summary {
  list-style: none;
  padding: var(--space-3);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: var(--weight-medium);
}
.guide-accordion > summary::-webkit-details-marker { display: none; }
.guide-accordion[open] > summary .chevron { transform: rotate(180deg); }
.guide-accordion .chevron { transition: transform var(--duration-fast); }
.guide-sections { padding: 0 var(--space-3) var(--space-3); }
.guide-sect { margin-top: var(--space-3); }
.guide-sect h4 { margin: 0 0 var(--space-1); font-size: var(--text-sm); }
.guide-sect p, .guide-sect li { color: var(--text-secondary); font-size: var(--text-sm); }
.guide-footer {
  border-top: 1px solid var(--border-subtle);
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-xs);
  color: var(--text-secondary);
}
.guide-city { border-top: 1px solid var(--border-subtle); }
.guide-city > summary { padding: var(--space-2) var(--space-3); cursor: pointer; }
.guide-city-body { padding: 0 var(--space-3) var(--space-3); }
.guide-city-sect { margin-top: var(--space-2); }
.guide-city-sect h5 { margin: 0 0 var(--space-1); font-size: var(--text-xs); }
.guide-soundtrack .soundtrack-body { padding: var(--space-3); }

/* Fun tab */
.fun-subtabs {
  display: flex;
  gap: var(--space-1);
  padding: var(--space-2);
  border-bottom: 1px solid var(--border-subtle);
}
.fun-subtab {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  padding: var(--space-2);
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--duration-fast), color var(--duration-fast);
}
.fun-subtab.is-active {
  background: var(--bg-sunken);
  color: var(--accent-primary);
  border-color: var(--border-subtle);
}
.fun-panel { padding: var(--space-3); }

/* Bingo grid */
.bingo-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-2); }
.bingo-progress { color: var(--text-secondary); font-size: var(--text-sm); }
.bingo-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-1);
}
.bingo-cell {
  position: relative;
  min-height: 72px;
  padding: var(--space-1);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  color: var(--text-primary);
  transition: background var(--duration-fast), border-color var(--duration-fast);
}
.bingo-cell:hover { background: var(--bg-sunken); }
.bingo-cell.is-done {
  background: var(--accent-primary);
  color: var(--bg-surface);
  border-color: var(--accent-primary);
}
.bingo-cell-emoji { font-size: 1.2rem; }
.bingo-cell-title {
  font-size: 0.625rem;
  text-align: center;
  line-height: 1.1;
  max-height: 2.2em;
  overflow: hidden;
}
.bingo-cell-thumb { position: absolute; inset: 0; display: flex; align-items: flex-end; justify-content: flex-end; pointer-events: none; }
.bingo-cell-thumb img { width: 24px; height: 24px; border-radius: var(--radius-sm); margin: 2px; object-fit: cover; }
.bingo-bonus-strip { display: flex; gap: var(--space-1); overflow-x: auto; padding: var(--space-2) 0; }
.bingo-celebrate {
  margin-top: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-sunken);
  border-radius: var(--radius-sm);
  text-align: center;
}

/* Daily Dare card */
.dare-card {
  padding: var(--space-4);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  text-align: center;
}
.dare-card.is-done { border-color: var(--accent-primary); }
.dare-emoji { font-size: 2.4rem; margin-bottom: var(--space-2); }
.dare-meta { color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-3); }
.dare-actions { display: flex; gap: var(--space-2); justify-content: center; }

/* FutureMe */
.futureme-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3); }
.futureme-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }
.futureme-item {
  padding: var(--space-3);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
}
.futureme-item.is-revealed { border-color: var(--accent-primary); }
.futureme-item-head { display: flex; justify-content: space-between; margin-bottom: var(--space-2); }
.futureme-message { font-size: var(--text-md); }
.futureme-countdown { color: var(--text-secondary); font-size: var(--text-sm); }
.futureme-actions { display: flex; gap: var(--space-2); margin-top: var(--space-2); }

/* Consulate card */
.tr-card-consulate .consulate-countdown { font-weight: var(--weight-medium); }
.tr-card-consulate .tr-actions { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2); }
```

- [ ] **Step 2: Browser visual check**

Unlock browser, clear SW, navigate. Visit the Fun tab (Bingo grid renders), Detail tab of Italy (guide + cities accordion render), Prep tab in TR (consulate card renders), header AI button (modal opens). Toggle dark theme. Verify all new components still look right — no hardcoded colours bleeding through.

- [ ] **Step 3: Commit**

```bash
git add css/components.css
git commit -m "style: sub-project 2 component styles (ai, guide, fun, bingo, futureMe, consulate)"
```

---

## Task 26: Service worker cache bump `v3 → v4`

**Files:**
- Modify: `sw.js`

**Preferred agent type:** `feature-engineer`.

- [ ] **Step 1: Bump version and add new entries**

Open `sw.js`. Change:

```js
const CACHE_VERSION = 'discovereu-v3';
```

to:

```js
const CACHE_VERSION = 'discovereu-v4';
```

Then extend the `APP_SHELL` array with the new sub-project 2 assets. Append these entries (keep the existing v3 entries):

```js
  '/data/guides.json',
  '/data/bingo-challenges.json',
  '/data/daily-dares.json',
  '/data/soundtracks.json',
  '/data/tr-consulates.json',
  '/js/utils/ics.js',
  '/js/utils/image.js',
  '/js/features/llm-groq.js',
  '/js/features/ai-assistant.js',
  '/js/features/bingo.js',
  '/js/features/daily-dare.js',
  '/js/features/future-me.js',
  '/js/features/soundtrack.js',
  '/js/ui/ai-modal.js',
  '/js/ui/guide.js',
  '/js/ui/bingo-tab.js',
  '/js/ui/fun-tab.js',
```

- [ ] **Step 2: Syntax check**

```bash
node --check sw.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "pwa: bump cache to v4, precache sub-project 2 assets"
```

---

## Task 27: Smoke tests — 20 scenarios + log

**Files:**
- Create: `test/tier4-subproject2-smoke.md`
- Create: `docs/superpowers/plans/2026-04-12-sub-project-2-smoke-test-log.md`

**Preferred agent type:** **main agent** — Playwright MCP is not available to subagents.

- [ ] **Step 1: Prepare the browser**

Unlock any stale MCP chrome profile (PowerShell `Get-WmiObject` kill workaround from `feedback_browser_lock.md` memory if needed), then:

```
mcp__playwright__browser_navigate → http://localhost:8765/index.html?bust=smoke
```

Clear SW + caches:

```js
async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  for (const r of regs) await r.unregister();
  if ('caches' in window) for (const k of await caches.keys()) await caches.delete(k);
  localStorage.clear();
  return 'cleared';
}
```

Re-navigate to `http://localhost:8765/index.html?bust=smoke2`.

- [ ] **Step 2: Run the 20 scenarios from spec Section 10.1**

For each, perform the described action and record PASS/FAIL. Any failure means fix-forward in the preceding task's commit before continuing.

| # | Scenario | Pass criterion |
|---|---|---|
| S1 | Fun tab opens, 3 sub-tabs visible | 8-tab bar, Fun active, 3 chips |
| S2 | Bingo grid renders 5×5 | 25 cells, each ≥ 44 × 44 px, emoji visible |
| S3 | Mark challenge done → strike + counter | `0/25 → 1/25`, cell `.is-done` applied |
| S4 | Bingo photo upload → thumbnail visible | IDB has 1 blob, thumb `<img>` in cell |
| S5 | Daily Dare shows today's dare | Deterministic seed match, streak shown |
| S6 | FutureMe create + sealed state | Sealed card in list with countdown |
| S7 | FutureMe .ics export | File downloads, content has `BEGIN:VCALENDAR` + `BEGIN:VEVENT` |
| S8 | Country Detail Country Guide accordion | ≥ 8 sections render on open |
| S9 | Country Detail Top Cities accordion | Two city sub-accordions each render mustSee + mustEat |
| S10 | Country Detail Soundtrack lazy iframe | `iframe.src` empty on close, set on open |
| S11 | AI modal (no key) → key screen | Key input + help link visible |
| S12 | AI modal (dummy key) → prompt screen | Textarea + quick-start chips visible |
| S13 | AI modal → mock Groq response → replace route | `state.route.stops` hydrated after action |
| S14 | AI modal error states | 401 / 429 / parse / network each show correct toast |
| S15 | Consulate form → Prep card | State persisted, countdown accurate |
| S16 | Consulate .ics export | Contains 2 `VALARM` blocks (-1d, -2h) |
| S17 | i18n TR ↔ EN switch | All new strings update, no hardcoded English |
| S18 | Dark mode screenshot parity | All new cards respect `--bg-surface` |
| S19 | 375 px mobile bottom nav | 8 icons fit, touch targets ≥ 44 × 44 |
| S20 | PWA offline — guides.json + new JSON precached | `caches.match('/data/guides.json')` returns response |

For S13/S14, intercept `fetch` via `browser_evaluate` to return a canned Groq response (or a 401 / 429) instead of hitting the real API.

- [ ] **Step 3: Write the smoke-test plan file**

Create `test/tier4-subproject2-smoke.md` with the scenario table above verbatim (scenarios + pass criteria only — no results).

- [ ] **Step 4: Write the test log**

Create `docs/superpowers/plans/2026-04-12-sub-project-2-smoke-test-log.md`:

```markdown
# Sub-project 2 Smoke Test Log — 2026-04-12

All 20 smoke tests passed against commit <sha>.

| #  | Test                                | Result | Notes |
|----|-------------------------------------|--------|-------|
| S1 | Fun tab opens, 3 sub-tabs visible   | PASS   |       |
| S2 | Bingo grid renders 5×5              | PASS   |       |
| S3 | Mark challenge done                 | PASS   |       |
| S4 | Bingo photo upload                  | PASS   |       |
| S5 | Daily Dare today                    | PASS   |       |
| S6 | FutureMe sealed state               | PASS   |       |
| S7 | FutureMe .ics export                | PASS   |       |
| S8 | Country Guide accordion             | PASS   |       |
| S9 | Top Cities accordion                | PASS   |       |
| S10| Soundtrack lazy iframe              | PASS   |       |
| S11| AI modal key screen                 | PASS   |       |
| S12| AI modal prompt screen              | PASS   |       |
| S13| AI modal replace route              | PASS   |       |
| S14| AI modal error states               | PASS   |       |
| S15| Consulate form + Prep card          | PASS   |       |
| S16| Consulate .ics export               | PASS   |       |
| S17| i18n TR ↔ EN switch                 | PASS   |       |
| S18| Dark mode parity                    | PASS   |       |
| S19| Mobile bottom nav 8 icons           | PASS   |       |
| S20| PWA offline precache                | PASS   |       |
```

- [ ] **Step 5: Commit**

```bash
git add test/tier4-subproject2-smoke.md docs/superpowers/plans/2026-04-12-sub-project-2-smoke-test-log.md
git commit -m "test: sub-project 2 smoke test log — all 20 scenarios pass"
```

---

## Task 28: `PROGRESS.md` + `SOURCES.md` update + push to origin + live URL verify

**Files:**
- Modify: `PROGRESS.md`
- Modify: `data/SOURCES.md`

**Preferred agent type:** **main agent** — only task that pushes.

- [ ] **Step 1: Update `PROGRESS.md` header and tier checkboxes**

Open `PROGRESS.md`. Change the `**Last updated:**` line to:

```markdown
**Last updated:** 2026-04-12 (session 8 — Sub-project 2: AI assistant, city/country guides, soundtrack, bingo, daily dare, futureMe, consulate reminder, 8-tab bar)
```

Change the `**Phase:**` line to:

```markdown
**Phase:** 4 (Tier 3 sub-project 1 + Tier 4 fun layer + Tier 5 consulate reminder all live; sub-project 3 translations remain)
```

In the Tier 4 section, mark these as `[x]`:

```markdown
- [x] City Bingo cards + achievement badges
- [x] Daily Dare micro-quest push
- [x] Country Soundtrack (Spotify Top 50 embed)
- [x] FutureMe time capsule
```

Leave the remaining Tier 4 items (GPS journal, voice memory, group vote, night shield, smart packing, pickpocket) as `[ ]` — explicitly deferred.

In the Tier 5 section, mark:

```markdown
- [x] Turkish consulate appointment reminder
```

In the AI section, mark:

```markdown
- [x] Natural language route suggestion (Groq API, user-provided key)
```

Append to the `✅ Done` list:

```markdown
- **Session 8 — Sub-project 2 (AI + Fun + Guide + Consulate)** (2026-04-12):
  - 5 new data files: `guides.json` (~100 KB), `bingo-challenges.json`, `daily-dares.json`, `soundtracks.json`, `tr-consulates.json`
  - 2 new utilities: `js/utils/ics.js`, `js/utils/image.js` (plus IndexedDB helpers in `js/utils/storage.js`)
  - 5 new feature modules: `features/llm-groq.js`, `features/ai-assistant.js`, `features/bingo.js`, `features/daily-dare.js`, `features/future-me.js`, `features/soundtrack.js`
  - 4 new UI modules: `ui/ai-modal.js`, `ui/guide.js`, `ui/bingo-tab.js`, `ui/fun-tab.js`
  - `turkish-bonus.js` 4th card: consulate reminder with .ics (2 VALARMs)
  - 8-tab bar (grew from 7): new Eğlence tab housing Bingo / Daily Dare / FutureMe
  - Bingo photos in IndexedDB `bingoPhotos` store, EXIF-stripped
  - Groq key stored in `localStorage`, never leaves browser
  - PWA cache bumped v3 → v4 with all new assets precached
  - All 20 smoke tests pass
```

Append these decisions to the decisions log table:

```markdown
| 2026-04-12 | AI provider: Groq (Llama 3.1 70B), user-provided key, JSON mode | Free tier, CORS-friendly browser calls, structured output enables route hydration |
| 2026-04-12 | City/Country guide via build-time Wikivoyage snapshot | Offline-first PWA story, TR translations, reviewer-inspectable |
| 2026-04-12 | Bingo photos in IndexedDB, state in localStorage | State is < 5 KB; photos as blobs need IDB; photos never leave the device |
| 2026-04-12 | Daily Dare deterministic day-of-year rotation, no push | iOS Safari push is broken; rotation works offline |
| 2026-04-12 | Spotify iframe embed only, no auth | CORS-safe, 30-sec previews work anonymously |
| 2026-04-12 | FutureMe localStorage + .ics calendar export, no SMTP | No backend; .ics gives a portable reminder anchor |
| 2026-04-12 | Shared `utils/ics.js` for FutureMe + consulate | Single module both features depend on; no duplication |
```

- [ ] **Step 2: Update `data/SOURCES.md`**

Open `data/SOURCES.md`. Append a new section:

```markdown

## Sub-project 2 sources (2026-04-12)

- **Wikivoyage** (CC BY-SA 3.0) — `https://en.wikivoyage.org/` — country + city guide text for `data/guides.json`. Attribution preserved in each entry's `sourceUrl` field. Refreshed annually.
- **Spotify** — `https://open.spotify.com/genre/charts-regional` — regional Top 50 editorial playlist IDs for `data/soundtracks.json`. Embedded via iframe; playback governed by Spotify's own terms.
- **Groq** — `https://console.groq.com/` — Llama 3.1 70B Versatile model used for natural-language route suggestion. User provides their own API key; no proxy.
- **VFS Global / iDATA / TLScontact / BLS** — consulate application centre addresses in Türkiye for `data/tr-consulates.json`. Sourced from each provider's public Türkiye portal; providers occasionally change contracts so refresh quarterly.
```

- [ ] **Step 3: Commit the docs update**

```bash
git add PROGRESS.md data/SOURCES.md
git commit -m "docs: session 8 snapshot — sub-project 2 complete"
```

- [ ] **Step 4: Push to origin**

```bash
git push origin main
```

- [ ] **Step 5: Verify GitHub Pages build**

```bash
gh run list --repo embeddedJedi/discovereu-companion --limit 3
```

Expect the most recent `pages-build-deployment` to be `in_progress` or `success`.

- [ ] **Step 6: Sanity-check the live URL**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://embeddedjedi.github.io/discovereu-companion/
curl -s -o /dev/null -w "%{http_code}\n" https://embeddedjedi.github.io/discovereu-companion/data/guides.json
curl -s -o /dev/null -w "%{http_code}\n" https://embeddedjedi.github.io/discovereu-companion/data/bingo-challenges.json
curl -s -o /dev/null -w "%{http_code}\n" https://embeddedjedi.github.io/discovereu-companion/js/ui/ai-modal.js
curl -s -o /dev/null -w "%{http_code}\n" https://embeddedjedi.github.io/discovereu-companion/js/features/future-me.js
```

All five MUST return `200`. If any returns non-200, wait 60s and retry once (Pages deploys can take a minute). If still failing, STOP and investigate.

---

## Self-review checklist

1. **Spec coverage:**
   - Section 5.1–5.5 data files → Tasks 1–5
   - Section 5.6 localStorage keys → Task 10 (state.js + persist keys)
   - Section 5.7 IndexedDB store → Task 8 (storage.js)
   - Section 6.1 utils → Tasks 6 + 7 + 8
   - Section 6.2 AI → Tasks 11 + 12 + 13
   - Section 6.3 Bingo → Tasks 17 + 18
   - Section 6.4 Daily Dare → Task 19
   - Section 6.5 Soundtrack → Task 16
   - Section 6.6 FutureMe → Task 20
   - Section 6.7 Consulate → Task 23
   - Section 6.8 Guide loader + UI → Tasks 9 + 14 + 15
   - Section 6.9 Fun tab → Task 22
   - Section 7 state shape → Task 10
   - Section 8.1 8-tab bar → Task 21
   - Section 8.2 AI modal → Task 13
   - Section 8.3 Eğlence layout → Task 22
   - Section 8.4 Country Detail additions → Tasks 15 + 16
   - Section 8.5 Prep tab consulate → Task 23
   - Section 9 i18n keys → Tasks 21 + 24
   - Section 10.1 smoke tests → Task 27
   - Section 10.3 definition of done → Task 28 (PROGRESS + SOURCES + push + live verify)

2. **Placeholder scan:** No `TBD` / `TODO` / `implement later`. Data tasks (T1–T5) delegate row-level content to `data-curator` + `research-scout` but provide the full schema plus a fully-populated reference entry and acceptance validators — that is research, not a placeholder. Code tasks inline the complete module content.

3. **Type consistency:**
   - `loadGuides` / `getCountryGuide` / `getCityGuide` / `listCitiesForCountry` signatures in T9 match the call sites in T14 (guide.js), T12 (ai-assistant.js)
   - `ensureBingoData` / `getActiveCard` / `detectBingoLines` in T17 match the calls in T18
   - `ensureDares` / `pickTodaysDare` / `renderDareCard` in T19 match T22 (fun-tab.js)
   - `renderFutureMe` in T20 matches T22
   - `buildICS` / `downloadICS` signatures in T6 match consumers in T20 (future-me.js) and T23 (turkish-bonus.js)
   - `compressImage` in T7 matches T17 (bingo.js) consumer
   - `idbPut` / `idbGet` / `idbDelete` in T8 match T17 consumer
   - `callGroq` typed errors (`AuthError`, `RateLimitError`, `NetworkError`, `ParseError`) in T11 match the `err.name` branching in T13 (ai-modal.js)
   - `state.ai.groqKey`, `state.bingo.completed`, `state.dares.*`, `state.futureMessages`, `state.user.consulateAppointment` slices added in T10 match every consumer reference
   - `activeFunSubtab` values `'bingo' | 'dares' | 'futureMe'` in T10 match the SUBTABS array in T22
   - `panel.tab.fun` i18n key added in T21 matches the `<button data-tab="fun">` markup in the same task
   - SW cache entries in T26 match every file created in T1–T23

4. **Commit-message uniqueness:** All 28 commit subjects are distinct conventional messages; the autonomous loop can map plan tasks → git log without ambiguity.
