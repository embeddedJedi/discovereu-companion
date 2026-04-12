# Features Round 2 (Sub-project D) Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Each of the 4 features below is self-contained — dispatch one agent per feature in parallel.

**Goal:** Ship Group Vote, GPS Trip Journal, Voice Memory Capsule, Bingo Photo Collage.

**Architecture:** All 4 are new ES modules in `js/features/`. Each mounts into an existing page (Fun page for most, route builder for Group Vote). All persistence via existing `storage.js` (LocalStorage + IndexedDB helpers). No new CDN deps.

---

### Feature D1: Group Vote Module

**Files:**
- Create: `js/features/group-vote.js`
- Modify: `js/pages/kesfet.js` (new Fun card OR new route-builder entry point)
- Modify: `i18n/en.json`, `i18n/tr.json` (`groupVote.*`)

**Spec:** Shareable URL-encoded ballot. Up to 4 voters pick from a list of candidate stops. Results as a simple bar chart. No backend — all state in URL hash using LZ-string (already loaded).

**API:**
- `createBallot(candidateStops)` → returns shareable URL with `#vote=LZ(candidates+voterCount)`
- `readBallot()` → parses hash, returns current ballot state
- `submitVote(voterId, selection)` → appends to ballot, updates URL, shows results
- Mount in kesfet page as a new card with "Start Group Vote" CTA

**UI:** Modal with candidate list (checkboxes), voter name input, submit button. After submit, shows aggregated tallies with horizontal bars.

**Commit:** `feat(v1.1): group vote module — URL-based 4-person voting`

---

### Feature D2: GPS Trip Journal

**Files:**
- Create: `js/features/journal.js`
- Modify: `js/pages/kesfet.js` (new Fun card "Journey Timeline")
- Modify: `js/utils/storage.js` if needed (IndexedDB helpers already exist for bingo photos — reuse)
- Modify: `i18n/en.json`, `i18n/tr.json` (`journal.*`)

**Spec:** Passive location logging + timeline UI.

**API:**
- `requestGeolocation()` — navigator.geolocation.getCurrentPosition, stores `{ lat, lng, ts }` to IndexedDB `journalEntries` store
- `addManualEntry({ cityId?, note, photos, ts })` — manual entry when GPS off
- `readJournal()` — returns all entries sorted by ts desc
- Timeline render: vertical list, day headers, per-entry card with city name (reverse-geocode via Nominatim `https://nominatim.openstreetmap.org/reverse?lat=X&lon=Y&format=json`), photo slots (reuse `utils/image.js` for EXIF strip), 280-char note, inline edit
- Export: html2canvas → long image of whole timeline

**Privacy:** All on-device. "Clear journal" button in settings (kesfet page).

**Commit:** `feat(v1.1): GPS trip journal — timeline with photos, notes, auto/manual entries`

---

### Feature D3: Voice Memory Capsule

**Files:**
- Create: `js/features/voice-memory.js`
- Modify: `js/pages/kesfet.js` (integrate into journal timeline OR new Fun card)
- Modify: `js/utils/storage.js` if needed — new `voiceMemories` IndexedDB store
- Modify: `i18n/en.json`, `i18n/tr.json` (`voiceMemory.*`)

**Spec:** MediaRecorder API, max 30s per recording, one per day keyed by ISO date.

**API:**
- `startRecording()` — requests mic permission, starts MediaRecorder (opus/webm), auto-stops at 30s
- `stopRecording()` — saves Blob to IndexedDB `voiceMemories` store, key `YYYY-MM-DD`
- `listMemories()` — all memories sorted by date
- `playMemory(date)` — returns a playable URL.createObjectURL
- `deleteMemory(date)` — removes

**UI:** Record button with visual countdown ring (CSS `@keyframes` on a circular SVG). List of recorded days with play/delete controls. Integrate inline into Journal timeline per-day node if Journal exists, otherwise standalone card.

**Fallback:** if `MediaRecorder` unavailable, show a friendly "Not supported on this device" message.

**Commit:** `feat(v1.1): voice memory capsule — 30s daily audio with IndexedDB persistence`

---

### Feature D4: Bingo Photo Collage

**Files:**
- Modify: `js/features/bingo.js` (extend existing)
- Modify: `i18n/en.json`, `i18n/tr.json` (`bingo.collage.*`)

**Spec:** When ≥4 bingo challenges have photos, show "Generate Collage" button. Canvas-based 3×3 or 4×4 grid of thumbnails with challenge labels overlaid.

**API:**
- `generateCollage(photos, options)` → returns a 1080×1080 PNG Blob
- Layout: grid determined by photo count (4 → 2×2, 5-9 → 3×3, 10-16 → 4×4)
- Each cell: cover-cropped photo, black gradient overlay at bottom 30%, challenge label in white text

**UI:** Button appears in bingo card when threshold met. Clicking generates + shows preview modal with Download + Share buttons.

**Commit:** `feat(v1.1): bingo photo collage — canvas-based 3x3/4x4 grid export`

---

### Feature D5: PROGRESS.md + push (after all D1-D4 commits land)

Update PROGRESS.md: Group Vote, Journal, Voice Memory, Bingo Collage — move to Done. Push.
