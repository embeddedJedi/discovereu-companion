# Features Round 1 (Sub-project C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship 4 new/enhanced features: Night Arrival Shield, enhanced Smart Packing Assistant, Multi-LLM adapter (Gemini/OpenAI), and redesigned Wrapped card.

**Architecture:** Each feature is a self-contained ES module in `js/features/`. Features hook into existing page modules via their exported mount functions. All use the existing `state` store and `i18n` engine. No new CDN dependencies required.

**Tech Stack:** Vanilla ES modules, existing `state.js`/`i18n.js`/`dom.js`/`storage.js` utilities, existing `html2canvas` (CDN already loaded) for Wrapped.

---

### Task 1: Night Arrival Shield

**Files:**
- Create: `js/features/night-shield.js`
- Modify: `js/pages/map.js` (add to map filter popover)
- Modify: `js/ui/route-builder.js` (show "Late arrival" badges on stops in route tab)
- Modify: `i18n/en.json`, `i18n/tr.json` (add `nightShield.*` keys)

**Approach:** Pure function `checkNightArrivals(route)` walks route stops, uses `trains.json` duration data, assumes an 08:00 departure per leg, sums cumulative duration, and flags stops arriving after 22:00. Returns array of `{ cityId, arrivalEstimate, isLate }`. Route builder renders an orange warning badge on each late stop. Map filter popover gets a "Hide late-arrival routes" toggle (persisted in `state.filters.hideLateArrival`, defaults false).

- [ ] **Step 1:** Create `js/features/night-shield.js` exporting `checkNightArrivals(route, trains)` and `isLateArrival(stop)`. Pure functions, no DOM.

- [ ] **Step 2:** Add `nightShield` i18n keys: `lateArrivalBadge`, `lateArrivalTooltip`, `hideLateArrivalToggle`, `nightShieldDescription`.

- [ ] **Step 3:** Wire route-builder to call `checkNightArrivals` and render `<span class="badge badge-warning" title="...">🌙 Late</span>` on affected stops.

- [ ] **Step 4:** Add toggle to filters-ui; wire to `state.filters.hideLateArrival`.

- [ ] **Step 5:** Quick smoke test — add a Sofia Express night train to route, verify late badge renders.

- [ ] **Step 6:** Commit.
```bash
git add js/features/night-shield.js js/ui/route-builder.js js/ui/filters-ui.js i18n/
git commit -m "feat(v1.1): night arrival shield — late-arrival warnings + filter"
```

---

### Task 2: Smart Packing Assistant (weather-aware enhancement)

**Files:**
- Modify: `js/features/packing.js` (new file OR enhance existing packing logic in `js/ui/prep.js`)
- Create: `js/features/packing.js` (new standalone module)
- Modify: `js/pages/hazirlik.js` to mount the new packing UI
- Modify: `i18n/en.json`, `i18n/tr.json` (add `packing.*` keys)

**Approach:** Upgrade existing route-aware packing list with:
1. **Weather awareness:** Fetch Open-Meteo 7-day forecast per stop city (CORS-friendly, no key). If rain probability >40% → add rain gear. If max temp <10°C → add warm layers. If max temp >28°C → add sunscreen/hat. Cache forecasts for 6h in `storage` TTL cache.
2. **Category grouping:** Essentials, Clothing, Electronics, Documents, Health (~5 categories with 4-8 items each).
3. **Custom items:** User can add/remove items; persisted in `state.prep.packingCustom` (new slice).
4. **Progress bar:** Visual bar showing `packed / total` count. "All packed" celebration (confetti-free, CSS animation) when complete.

Fallback: if Open-Meteo fetch fails, fall back to the existing route-category logic already in place (beach/nordic/nature/culture).

- [ ] **Step 1:** Extract packing logic from `prep.js` into new `js/features/packing.js`. Export `buildPackingList(route, user, weather)` returning `{ categories: {id, name, items: [{id, label, packed}]} }`.

- [ ] **Step 2:** Add Open-Meteo fetch helper: `fetchForecasts(stops)` in `js/features/packing.js`. URL: `https://api.open-meteo.com/v1/forecast?latitude=X&longitude=Y&daily=temperature_2m_max,precipitation_probability_max&forecast_days=7`. Use `Promise.allSettled` so one city's failure doesn't tank others. Cache via `storage.cache` with 6h TTL.

- [ ] **Step 3:** Add custom-item UI: text input + add button at bottom of list, X button per item to remove. Persist in `state.prep.packingCustom` (add to `PERSIST_KEYS`).

- [ ] **Step 4:** Progress bar + completion animation in CSS (`.packing-progress`, `.packing-complete`).

- [ ] **Step 5:** Wire `hazirlik.js` to mount the new packing UI (replace old packing section).

- [ ] **Step 6:** Add i18n keys for categories + new UI strings.

- [ ] **Step 7:** Smoke test: route with Oslo (cold) + Barcelona (hot) should produce warm layers AND sunscreen.

- [ ] **Step 8:** Commit.
```bash
git add js/features/packing.js js/pages/hazirlik.js css/ i18n/ js/state.js
git commit -m "feat(v1.1): smart packing assistant — weather-aware + categories + custom items"
```

---

### Task 3: Multi-LLM Adapter (Gemini + OpenAI)

**Files:**
- Create: `js/features/llm-adapter.js` (unified interface)
- Create: `js/features/llm-gemini.js` (Gemini provider)
- Create: `js/features/llm-openai.js` (OpenAI provider)
- Modify: `js/features/llm-groq.js` (conform to adapter interface)
- Modify: `js/features/ai-assistant.js` (use adapter instead of groq directly)
- Modify: `js/pages/kesfet.js` settings section (add provider selector + per-provider key inputs)
- Modify: `i18n/en.json`, `i18n/tr.json` (add `llm.*` keys)

**Approach:** Unified `sendPrompt({ messages, jsonMode })` interface. Each provider module exports `send(messages, options, apiKey) → Promise<response>`. Adapter reads `state.settings.llmProvider` (`"groq" | "gemini" | "openai"`) and `state.settings.llmKeys[provider]`, dispatches to correct provider.

**Provider endpoints:**
- Groq: `https://api.groq.com/openai/v1/chat/completions` (already implemented)
- Gemini: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=X` (CORS-friendly, key in query string or header)
- OpenAI: `https://api.openai.com/v1/chat/completions` (requires CORS — use standard bearer auth)

- [ ] **Step 1:** Create `js/features/llm-adapter.js` with `sendPrompt()` and `listProviders()` exports. Dispatches via provider registry map.

- [ ] **Step 2:** Refactor existing `llm-groq.js` to export `{ id: 'groq', label: 'Groq (Llama)', send(messages, options, apiKey) }`.

- [ ] **Step 3:** Create `llm-gemini.js` with same shape. Gemini uses a different request body (`contents: [{parts:[{text}]}]`), so the provider module translates the standard `messages` array into Gemini's format.

- [ ] **Step 4:** Create `llm-openai.js` with same shape (OpenAI format matches Groq's already).

- [ ] **Step 5:** Update `ai-assistant.js` to call the adapter instead of `llm-groq` directly.

- [ ] **Step 6:** Extend settings UI in `kesfet.js`: provider `<select>` + 3 input fields for keys (one per provider, only the active one visible, toggleable "Show all keys" checkbox). Keys stored in `localStorage` via `storage.local`, NEVER in git.

- [ ] **Step 7:** Add i18n keys for provider names, key labels, save button.

- [ ] **Step 8:** Smoke test: switch provider dropdown, verify AI assistant calls correct endpoint. Use a bogus key; verify 401 error surfaces gracefully.

- [ ] **Step 9:** Commit.
```bash
git add js/features/llm-*.js js/features/ai-assistant.js js/pages/kesfet.js i18n/
git commit -m "feat(v1.1): multi-LLM adapter — Groq + Gemini + OpenAI with unified interface"
```

---

### Task 4: Wrapped Redesign (Strava-style Story Card)

**Files:**
- Modify: `js/features/wrapped.js` (replace current modal with new design)
- Modify: `css/components.css` (new `.wrapped-v2-*` styles)
- Modify: `i18n/en.json`, `i18n/tr.json`

**Approach:** Two formats:
1. **Post (1080×1350):** Dark gradient bg (#0a0e27 → #1a1f3a), mini route map at top (canvas-drawn polyline on a simplified world map OR html2canvas of existing Leaflet minimap), stats grid below (countries visited, total km, travel days, CO₂ saved, seat credits used), watermark footer.
2. **Story (1080×1920):** Same content, vertical layout, QR code at bottom pointing to share URL.

Format selector toggle at top of modal. Export produces a PNG Blob via html2canvas.

- [ ] **Step 1:** Rewrite the `.wrapped-card` DOM in `wrapped.js` with a `data-format="post" | "story"` attribute and matching CSS classes.

- [ ] **Step 2:** Add a canvas-based mini map renderer: `renderMiniMap(ctx, route, width, height)` — draws a very simplified Europe outline (use existing `europe.geojson` centroids + a rough rectangle bounds) and overlays route polyline in EU gold. Nothing fancy — just enough to read as "here's your route".

- [ ] **Step 3:** Build stats panel: `computeWrappedStats(route)` returns `{ countries, totalKm, days, co2SavedKg, creditsUsed }`. Render as a 2-column grid.

- [ ] **Step 4:** Generate QR code for Story format. Use a tiny in-JS QR library via CDN (e.g., `qrcode-generator`) OR fall back to Google Chart API's QR endpoint `https://api.qrserver.com/v1/create-qr-code/?data=ENCODED_URL&size=200x200` (CORS-friendly).

- [ ] **Step 5:** Add format toggle UI (segmented control with two buttons).

- [ ] **Step 6:** Export logic: html2canvas renders the card at explicit pixel dimensions (1080×1350 or 1080×1920). Use `scale: window.devicePixelRatio || 2` for crispness.

- [ ] **Step 7:** Add i18n keys for format labels, stats labels, export button.

- [ ] **Step 8:** Smoke test: 5-country route → generate Post → download PNG → verify dimensions + legibility.

- [ ] **Step 9:** Commit.
```bash
git add js/features/wrapped.js css/components.css i18n/
git commit -m "feat(v1.1): wrapped redesign — Strava-style Post + Story formats with mini map"
```

---

### Task 5: PROGRESS.md + push

- [ ] **Step 1:** Update PROGRESS.md: mark Night Shield, Smart Packing Assistant, Multi-LLM adapter, Wrapped redesign as complete in the roadmap. Add session note under Session 9 or v1.1-C heading.

- [ ] **Step 2:** Commit.
```bash
git add PROGRESS.md
git commit -m "docs(v1.1): mark sub-project C (features round 1) complete"
```

- [ ] **Step 3:** Push.
```bash
git push origin main
```
