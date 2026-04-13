# Language Bridge (v1.7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the v1.7 Language Bridge — a pocket translator for DiscoverEU travellers with three modes (Camera OCR, Voice, offline Phrasebook) + saved-phrase deck. Offline-first, privacy-preserving (pixels never leave the device for OCR), WCAG AAA, i18n-ready, opt-in heavy assets.

**Spec (authoritative — do NOT redesign):** [`docs/superpowers/specs/2026-04-13-language-bridge-design.md`](../specs/2026-04-13-language-bridge-design.md)

**Reference plans (format):**
- [`docs/superpowers/plans/2026-04-13-crisis-shield.md`](2026-04-13-crisis-shield.md)
- [`docs/superpowers/plans/2026-04-13-ai-intercultural-coach.md`](2026-04-13-ai-intercultural-coach.md)

**Architecture summary:** One new state slice (`state.language`). One new IndexedDB store (`phrasebookDeck`). Four new feature modules + two UI modules. Per-country phrasebook JSON files under `data/phrasebook/` (5 seeded). Consent dialog reused across camera/mic. `tesseract.js@5` lazy-loaded on first OCR use (~11MB core + 2–10MB per language pack, opt-in, NOT precached). Whisper STT reuses v1.5 `voice-transcribe.js`; `speechSynthesis` for TTS. LLM translation via existing `llm-adapter.js`. i18n additions (en + tr only; de/fr/es/it deferred). SW precache bump (v10 → v11) covering phrasebook JSONs + JS/CSS. Integration into `js/ui/country-detail.js` as a "Open Language Bridge for {country}" CTA.

**Decision (locked by spec):** Offline-dict lookup first, LLM fallback when online + key present. OCR runs entirely in-browser via WASM (no pixel transmission). Voice mode explicitly labelled as sending audio to the user-configured Whisper provider.

**Tech stack:** Vanilla ES modules, `h()` DOM helper (never innerHTML with interpolated content), CDN-only deps (`tesseract.js@5` via jsdelivr, lazy), LocalStorage for `state.language`, IndexedDB for `phrasebookDeck`, no test runner — browser-console smoke assertions per task.

**i18n path:** `js/i18n/i18n.js`. Source files live in `i18n/*.json`.

**Reuses:** `js/features/voice-transcribe.js` (v1.5), `js/features/llm-adapter.js`, `js/utils/storage.js` IDB helpers, `js/utils/dom.js` `h()` helper, existing design-system tokens.

---

## Task 1: State slice `state.language` + persistence

**Files:**
- Modify: `js/state.js` (add slice, PERSIST_KEYS whitelist, migration)

- [ ] **Step 1: Extend default state.** In `js/state.js` add:

```js
language: {
  savedPhrases:  [],        // [{id, src, dst, srcLang, dstLang, country, ts}]
  ocrLang:       null,      // tesseract lang code (e.g. 'ita'); null = not chosen
  ocrTargetLang: 'en',      // user's UI lang mirror
  voiceOn:       false,     // opt-in toggle
  voiceRate:     1.0,       // 0.7 when slow-mode
  lastCountry:   null,
  consent:       { camera: false, mic: false },
  translationProvider: 'llm' // 'llm' | 'offline-dict'
}
```

- [ ] **Step 2: Add `"language"` to `PERSIST_KEYS`** so the slice is LocalStorage-hydrated on boot.

- [ ] **Step 3: Migration.** If persisted state lacks `language`, initialise it. If `language.savedPhrases` is missing, seed `[]`. If `language.consent` missing, seed `{ camera: false, mic: false }`. Never throw on old shapes.

- [ ] **Step 4: Exports.** `setLanguageOcrLang(code)`, `setLanguageVoiceOn(flag)`, `setLanguageConsent(kind, granted)`, `addSavedPhrase(rec)`, `removeSavedPhrase(id)`, `setLanguageLastCountry(id)`. Each mutates state and dispatches the existing state-changed event.

- [ ] **Step 5: Browser smoke**

```js
const s = await import('./js/state.js');
s.setLanguageConsent('camera', true);
s.addSavedPhrase({ id:'p1', src:'Hello', dst:'Ciao', srcLang:'en', dstLang:'it', country:'IT', ts:Date.now() });
console.assert(s.getState().language.consent.camera === true, 'consent not set');
console.assert(s.getState().language.savedPhrases.length === 1, 'phrase not added');
location.reload(); // re-check after reload
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/state.js
git commit -m "feat(v1.7): state.language slice — OCR lang, consent, saved phrases"
```

---

## Task 2: i18n — `lang.*` keys (en + tr)

**Files:**
- Modify: `i18n/en.json` (source of truth)
- Modify: `i18n/tr.json`
- Flag as followup: `de.json`, `fr.json`, `es.json`, `it.json` (deferred — log in PROGRESS.md §7)

- [ ] **Step 1: Add `lang.*` leaves** per spec §10:
  - Panel: `lang.panel.title`, `lang.tab.camera`, `lang.tab.phrasebook`, `lang.tab.voice`, `lang.tab.saved`
  - Consent: `lang.consent.camera.title`, `lang.consent.camera.body`, `lang.consent.camera.accept`, `lang.consent.camera.decline`, `lang.consent.mic.title`, `lang.consent.mic.body`, `lang.consent.mic.accept`, `lang.consent.mic.decline`
  - OCR: `lang.ocr.capture`, `lang.ocr.processing`, `lang.ocr.noText`, `lang.ocr.tryAgain`, `lang.ocr.sizeWarn` (13MB size warning)
  - Voice: `lang.voice.listening`, `lang.voice.translating`, `lang.voice.speak`, `lang.voice.slowMode`
  - Phrasebook: `lang.phrasebook.search`, `lang.phrasebook.category`, `lang.phrasebook.bookmark`, `lang.phrasebook.noResults`
  - Privacy: `lang.privacy.notice`
  - CTA: `lang.openFor` (e.g. "Open Language Bridge for {country}")

- [ ] **Step 2: Turkish translations** in `i18n/tr.json`. Preserve key paths exactly.

- [ ] **Step 3: Browser smoke**

```js
const [en, tr] = await Promise.all(['en','tr'].map(l => fetch(`i18n/${l}.json`).then(r=>r.json())));
const mustHave = ['lang.panel.title','lang.tab.camera','lang.consent.camera.body','lang.ocr.sizeWarn','lang.voice.slowMode','lang.phrasebook.search','lang.privacy.notice','lang.openFor'];
const missEn = mustHave.filter(k => !k.split('.').reduce((a,p)=>a?.[p], en));
const missTr = mustHave.filter(k => !k.split('.').reduce((a,p)=>a?.[p], tr));
console.assert(!missEn.length, 'en missing: ' + missEn);
console.assert(!missTr.length, 'tr missing: ' + missTr);
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add i18n/en.json i18n/tr.json
git commit -m "feat(v1.7): i18n keys lang.* (en + tr); de/fr/es/it deferred"
```

---

## Task 3: Phrasebook data — `data/phrasebook/` + 5 seed countries

**Files:**
- Create: `data/phrasebook/_index.json`
- Create: `data/phrasebook/DE.json`, `FR.json`, `IT.json`, `ES.json`, `TR.json`

- [ ] **Step 1: Index file.** `data/phrasebook/_index.json`:

```json
{
  "version": 1,
  "countries": {
    "DE": { "file": "data/phrasebook/DE.json", "language": "de", "ocrLang": "deu" },
    "FR": { "file": "data/phrasebook/FR.json", "language": "fr", "ocrLang": "fra" },
    "IT": { "file": "data/phrasebook/IT.json", "language": "it", "ocrLang": "ita" },
    "ES": { "file": "data/phrasebook/ES.json", "language": "es", "ocrLang": "spa" },
    "TR": { "file": "data/phrasebook/TR.json", "language": "tr", "ocrLang": "tur" }
  }
}
```

- [ ] **Step 2: Per-country files** — ~200 phrases each. Source:
  1. Seed from `data/emergency-phrases.json` (extract country-relevant entries).
  2. Augment from Wikivoyage phrasebooks (CC-BY-SA — add attribution footer in panel).
  3. Cover 6 categories per spec §4: `greetings`, `transport`, `food`, `emergency`, `accommodation`, `culture`.

Schema:
```json
{
  "country": "IT",
  "language": "it",
  "attribution": "Phrases adapted from Wikivoyage (CC-BY-SA)",
  "phrases": [
    {"id":"greet.hello","cat":"greetings","src":"Hello","dst":"Ciao","ipa":"/ˈtʃa.o/","audio":null},
    {"id":"emerg.help","cat":"emergency","src":"Help!","dst":"Aiuto!","ipa":"/aˈju.to/","audio":null}
  ]
}
```

- [ ] **Step 3: Validation smoke**

```js
const idx = await (await fetch('data/phrasebook/_index.json')).json();
console.assert(Object.keys(idx.countries).length === 5, 'need 5 seed countries');
for (const [cc, meta] of Object.entries(idx.countries)) {
  const pb = await (await fetch(meta.file)).json();
  console.assert(pb.phrases.length >= 150, `${cc} under phrase budget`);
  const cats = new Set(pb.phrases.map(p => p.cat));
  for (const req of ['greetings','transport','food','emergency','accommodation','culture']) {
    console.assert(cats.has(req), `${cc} missing cat ${req}`);
  }
}
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add data/phrasebook/
git commit -m "feat(v1.7): phrasebook data — 5 seed countries (DE/FR/IT/ES/TR), ~200 phrases each"
```

---

## Task 4: OCR feature — `js/features/ocr.js`

**Files:**
- Create: `js/features/ocr.js`

- [ ] **Step 1: Exports.**

```js
export async function ensureTesseract();
// lazy dynamic import of tesseract.js@5 from jsdelivr; resolves to the global Tesseract
export async function recognizeImage(blobOrCanvas, ocrLang, { onProgress } = {});
// returns { text, words: [{text, confidence, bbox}], confidence }
export async function captureFromVideo(videoEl);
// grabs a single frame via OffscreenCanvas → Blob (no continuous streaming)
```

- [ ] **Step 2: Size gate.** Before first `ensureTesseract()` call, caller must display the `lang.ocr.sizeWarn` confirm ("This will download ~13MB. Continue?") — this task exports a `tesseractCached()` boolean for the UI. Never auto-download.

- [ ] **Step 3: Worker lifecycle.** Create a single reusable `Tesseract.createWorker()` memoised on the module. On subsequent `recognizeImage` calls, reuse the worker; switch language pack only when `ocrLang` changes.

- [ ] **Step 4: Progress.** Forward tesseract's `logger` events through `onProgress({ status, progress })` so the UI can show a progress bar.

- [ ] **Step 5: Camera permission gate.** `captureFromVideo` assumes the video element already has a `srcObject` from `getUserMedia`. Do NOT request permissions here — that belongs in `consent-dialog` + the panel. Single-shot capture only (spec §13 battery).

- [ ] **Step 6: Browser smoke (online, user accepted size prompt)**

```js
const m = await import('./js/features/ocr.js');
await m.ensureTesseract();
// draw text to a canvas and OCR it:
const c = document.createElement('canvas'); c.width=400; c.height=80;
const ctx = c.getContext('2d'); ctx.fillStyle='#fff'; ctx.fillRect(0,0,400,80);
ctx.fillStyle='#000'; ctx.font='32px serif'; ctx.fillText('Ciao Roma', 10, 50);
const r = await m.recognizeImage(c, 'ita', { onProgress: s => console.log(s) });
console.assert(/Ciao/i.test(r.text), 'OCR failed: ' + r.text);
console.log('OK', r.text.trim(), r.confidence);
```

- [ ] **Step 7: Commit**

```bash
git add js/features/ocr.js
git commit -m "feat(v1.7): ocr feature — lazy tesseract.js worker, single-shot capture, progress"
```

---

## Task 5: Translation feature — `js/features/translate.js`

**Files:**
- Create: `js/features/translate.js`
- Uses existing: `js/features/llm-adapter.js`

- [ ] **Step 1: Exports.**

```js
export async function translate({ text, srcLang, dstLang, politeness = 'neutral', context = null });
// returns { text, provider: 'offline-dict' | 'llm', confidence }
export function offlineDictLookup(text, srcLang, dstLang, phrasebook);
// fuzzy substring/Levenshtein match against loaded phrasebook; returns null on miss
```

- [ ] **Step 2: Strategy.**
  1. If `state.language.translationProvider === 'offline-dict'` OR offline (`!navigator.onLine`) OR no LLM key configured → offline-dict first.
  2. Else LLM via `llm-adapter` with the prompt below; on failure, fall back to offline-dict.

- [ ] **Step 3: LLM prompt.** System:

```
You are a translation assistant for a DiscoverEU travel app. Translate the user text from {srcLang} to {dstLang}.
Rules: (1) Return JSON only: {"text": "...", "confidence": 0..1}. (2) Preserve politeness register "{politeness}". (3) If the source is ambiguous, pick the most common traveller context (menu / sign / greeting). (4) Never invent proper nouns. (5) If unsure, set confidence < 0.6.
```

User payload includes `text` and optional `context` (e.g. "sign on train platform").

- [ ] **Step 4: Parsing + guardrails.** Parse JSON strictly; on parse failure, re-ask once; on second failure, return `{ ok: false, reason: 'parse' }` and let the UI surface `lang.ocr.tryAgain`.

- [ ] **Step 5: Browser smoke**

```js
const m = await import('./js/features/translate.js');
// offline-dict path:
const pb = await (await fetch('data/phrasebook/IT.json')).json();
const off = m.offlineDictLookup('Hello', 'en', 'it', pb);
console.assert(off?.text?.toLowerCase().includes('ciao'), 'offline dict miss');
// LLM path (requires key):
const r = await m.translate({ text: 'Where is the train station?', srcLang:'en', dstLang:'it' });
console.assert(r.text && r.provider, 'no translation');
console.log('OK', r.provider, r.text);
```

- [ ] **Step 6: Commit**

```bash
git add js/features/translate.js
git commit -m "feat(v1.7): translate feature — offline-dict first, LLM fallback with strict JSON"
```

---

## Task 6: Phrasebook feature — `js/features/phrasebook.js`

**Files:**
- Create: `js/features/phrasebook.js`
- Uses existing: `js/utils/storage.js` (helpers added in Task 10)

- [ ] **Step 1: Exports.**

```js
export async function loadIndex();
// fetches data/phrasebook/_index.json, memoised
export async function loadCountryPhrasebook(countryId);
// fetches data/phrasebook/{countryId}.json, memoised; returns null if not seeded
export function searchPhrases(phrasebook, query, { cat = null } = {});
// case-insensitive substring match against src + dst; returns matches sorted by cat then id
export async function bookmarkPhrase({ countryId, phraseId, src, dst, srcLang, dstLang });
// writes to state.language.savedPhrases AND IDB phrasebookDeck store
export async function unbookmarkPhrase(id);
```

- [ ] **Step 2: Offline-first.** All `data/phrasebook/*.json` for the 5 seeded countries are precached by the SW (Task 12). Non-seeded countries return `null` → UI shows `lang.phrasebook.noResults` + falls back to translate.js for ad-hoc phrases.

- [ ] **Step 3: Browser smoke**

```js
const m = await import('./js/features/phrasebook.js');
const idx = await m.loadIndex();
const pb = await m.loadCountryPhrasebook('IT');
console.assert(pb?.phrases?.length >= 150, 'IT phrasebook missing');
const hits = m.searchPhrases(pb, 'help');
console.assert(hits.length >= 1, 'search miss');
await m.bookmarkPhrase({ countryId:'IT', phraseId: hits[0].id, src: hits[0].src, dst: hits[0].dst, srcLang:'en', dstLang:'it' });
const s = (await import('./js/state.js')).getState();
console.assert(s.language.savedPhrases.length >= 1, 'bookmark not persisted');
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add js/features/phrasebook.js
git commit -m "feat(v1.7): phrasebook feature — index loader, search, bookmark to IDB + state"
```

---

## Task 7: Voice translator — `js/features/voice-translator.js`

**Files:**
- Create: `js/features/voice-translator.js`
- Reuses: `js/features/voice-transcribe.js` (v1.5), `js/features/translate.js` (Task 5)

- [ ] **Step 1: Exports.**

```js
export async function startTurn({ srcLang, dstLang, onState, maxSeconds = 30 });
// 1. getUserMedia(audio) (consent must already be granted)
// 2. record up to maxSeconds; emit onState('listening')
// 3. pass blob to voice-transcribe.js (Whisper via user key); emit onState('translating')
// 4. translate via translate.js
// 5. speak via speechSynthesis with voiceRate from state; emit onState('speaking')
// returns { srcText, dstText, provider }
export function speak(text, lang, { rate = 1.0 } = {});
// wraps window.speechSynthesis.speak(new SpeechSynthesisUtterance)
export function cancelSpeak();
```

- [ ] **Step 2: Consent.** `startTurn` throws if `state.language.consent.mic !== true`. Caller is responsible for showing `consent-dialog` before invoking.

- [ ] **Step 3: Cost disclosure.** Emit `onState({ stage: 'costEstimate', seconds, approxUsd })` before sending to Whisper so the UI can show a running tally (spec §13).

- [ ] **Step 4: Slow-mode.** If `state.ui.slowMode === true` (or `state.language.voiceRate < 1`), pass `rate` through to `SpeechSynthesisUtterance`.

- [ ] **Step 5: Voice selection.** Pick a `speechSynthesis.getVoices()` voice whose `lang` starts with `dstLang`; fall back to default. Log chosen voice name for debugging.

- [ ] **Step 6: Browser smoke (requires mic + Whisper key)**

```js
const m = await import('./js/features/voice-translator.js');
m.speak('Ciao Roma', 'it', { rate: 0.9 });
// manual verify: TTS plays through speakers
// full turn requires mic grant:
const s = (await import('./js/state.js'));
s.setLanguageConsent('mic', true);
const r = await m.startTurn({ srcLang:'en', dstLang:'it', onState: x => console.log(x), maxSeconds: 5 });
console.assert(r.dstText, 'turn failed');
console.log('OK', r);
```

- [ ] **Step 7: Commit**

```bash
git add js/features/voice-translator.js
git commit -m "feat(v1.7): voice-translator — Whisper STT + translate + speechSynthesis TTS"
```

---

## Task 8: Main UI panel — `js/ui/language-bridge-panel.js` + consent dialog + CSS

**Files:**
- Create: `js/ui/language-bridge-panel.js`
- Create: `js/ui/consent-dialog.js`
- Create: `css/language-bridge.css`
- Modify: `index.html` (link `css/language-bridge.css`)

- [ ] **Step 1: `consent-dialog.js` exports.**

```js
export async function requestConsent(kind /* 'camera' | 'mic' */);
// returns true/false; writes state.language.consent[kind] on accept
```

Renders a `role="dialog" aria-modal="true"` with plain-language explainer (i18n `lang.consent.{kind}.body`), Accept / Decline / Learn-more buttons; focus-trapped; Esc = decline.

- [ ] **Step 2: `language-bridge-panel.js` exports.**

```js
export async function openLanguageBridgePanel(countryId);
export function closeLanguageBridgePanel();
```

- [ ] **Step 3: Structure (all via `h()`, zero innerHTML interpolation).**

Overlay `role="dialog" aria-modal="true" aria-labelledby`. Sections:
1. Header: country name, privacy notice link (`lang.privacy.notice`), close button (Esc also closes).
2. Tab bar: Camera / Phrasebook / Voice / Saved — `role="tablist"` with arrow-key navigation.
3. **Camera tab:** initially a button `lang.ocr.capture`. On tap → `requestConsent('camera')` → `getUserMedia({ video: { facingMode: 'environment' } })` → video overlay with 7:1-contrast guide frame. Capture button → freeze frame → show size-warn if tesseract not cached → `ocr.recognizeImage` with `ocrLang` from phrasebook index → editable text box (spec §13 manual edit) → `translate.translate()` → show result with bookmark button. `navigator.vibrate(50)` on successful capture.
4. **Phrasebook tab:** search input (`lang.phrasebook.search`) + category filter chips; list of `{src, dst, ipa}` rows; each has a play-back (TTS) + bookmark toggle. Empty state shows `lang.phrasebook.noResults` + "try translating" CTA opening Camera OCR text input mode.
5. **Voice tab:** big push-to-talk button with visible state machine (idle → listening → translating → speaking). Slow-mode toggle. Cost estimate chip visible before first turn.
6. **Saved tab:** mounts `phrasebook-deck.js` (Task 9).
7. Footer: Wikivoyage CC-BY-SA attribution + offline indicator + privacy notice anchor.

- [ ] **Step 4: Accessibility (AAA).**
- Focus trap inside overlay; restore focus to opener on close.
- Every phrase result rendered as selectable `<p lang="{dstLang}">` (spec §11 screen reader).
- OCR/translation results announced via `aria-live="polite"` region.
- Camera guide frame meets 7:1 contrast.
- TTS output always paired with on-screen subtitle + IPA.
- `prefers-reduced-motion` disables tab-switch transitions.
- All tabs keyboard reachable; Enter/Space activates.

- [ ] **Step 5: Desktop vs mobile.** Full-screen on ≤768px, right side-panel (480px) on larger.

- [ ] **Step 6: Browser smoke**

```js
const { openLanguageBridgePanel } = await import('./js/ui/language-bridge-panel.js');
await openLanguageBridgePanel('IT');
const dlg = document.querySelector('[data-lang-panel][role="dialog"]');
console.assert(dlg && dlg.getAttribute('aria-modal') === 'true', 'panel/aria missing');
console.assert(dlg.querySelectorAll('[role="tab"]').length === 4, 'need 4 tabs');
console.assert(dlg.querySelector('[aria-live="polite"]'), 'live region missing');
// click Phrasebook tab
dlg.querySelectorAll('[role="tab"]')[1].click();
console.assert(dlg.querySelector('input[type="search"]'), 'search missing');
console.log('OK');
```

- [ ] **Step 7: Commit**

```bash
git add js/ui/language-bridge-panel.js js/ui/consent-dialog.js css/language-bridge.css index.html
git commit -m "feat(v1.7): language-bridge-panel — 4 tabs, consent dialog, AAA a11y"
```

---

## Task 9: Saved-phrases UI — `js/ui/phrasebook-deck.js`

**Files:**
- Create: `js/ui/phrasebook-deck.js`

- [ ] **Step 1: Exports.**

```js
export function mountPhrasebookDeck(container);
// reads state.language.savedPhrases, renders one <li> per phrase with play + delete
export function refreshDeck();
// re-renders after state change; subscribe via state-changed event
```

- [ ] **Step 2: Row structure.** Each `<li>`:
- `<p lang="{srcLang}">` source text
- `<p lang="{dstLang}">` target text + optional IPA
- Play button → `voice-translator.speak(dst, dstLang)`
- Delete button → `phrasebook.unbookmarkPhrase(id)` with undo toast (5s window)

- [ ] **Step 3: Empty state.** Shows `lang.phrasebook.noResults` with CTA opening Phrasebook tab.

- [ ] **Step 4: Accessibility.** Each row is a list item with `aria-label` combining src + dst + country. Delete is destructive → `aria-describedby` warns on focus.

- [ ] **Step 5: Browser smoke**

```js
const { mountPhrasebookDeck } = await import('./js/ui/phrasebook-deck.js');
const s = await import('./js/state.js');
s.addSavedPhrase({ id:'t1', src:'Thanks', dst:'Grazie', srcLang:'en', dstLang:'it', country:'IT', ts:Date.now() });
const div = document.createElement('div'); document.body.append(div);
mountPhrasebookDeck(div);
console.assert(div.querySelectorAll('li').length >= 1, 'no rows');
console.assert(div.querySelector('button[data-action="play"]'), 'no play button');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/ui/phrasebook-deck.js
git commit -m "feat(v1.7): phrasebook-deck UI — saved phrases list with play + delete + undo"
```

---

## Task 10: IndexedDB store `phrasebookDeck` + storage helpers

**Files:**
- Modify: `js/utils/storage.js`

- [ ] **Step 1: Bump DB version.** In `storage.js`, in `onupgradeneeded`, add:

```js
if (!db.objectStoreNames.contains('phrasebookDeck')) {
  const os = db.createObjectStore('phrasebookDeck', { keyPath: 'id' });
  os.createIndex('byCountry', 'country', { unique: false });
}
```

- [ ] **Step 2: Helpers.** Export `putSavedPhrase(rec)`, `getSavedPhrase(id)`, `listSavedPhrases({ countryId } = {})`, `deleteSavedPhrase(id)`. Each wraps the existing promisified IDB transaction helper.

- [ ] **Step 3: Sync strategy.** Task 6 `bookmarkPhrase` writes to BOTH state (for fast render) AND this store (for durability beyond LocalStorage quota). On boot, `state.language.savedPhrases` is hydrated from LocalStorage; IDB is the authoritative source if LS is cleared → add a `reconcileSavedPhrases()` helper that merges.

- [ ] **Step 4: Browser smoke**

```js
const s = await import('./js/utils/storage.js');
await s.putSavedPhrase({ id:'x1', country:'IT', src:'Hi', dst:'Ciao', srcLang:'en', dstLang:'it', ts:Date.now() });
console.assert((await s.listSavedPhrases()).length >= 1, 'list broken');
console.assert((await s.listSavedPhrases({ countryId:'IT' })).length >= 1, 'by-country index broken');
await s.deleteSavedPhrase('x1');
console.assert((await s.getSavedPhrase('x1')) === undefined, 'delete failed');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add js/utils/storage.js
git commit -m "feat(v1.7): IDB phrasebookDeck store + helpers + byCountry index"
```

---

## Task 11: Integration — country-detail CTA

**Files:**
- Modify: `js/ui/country-detail.js`

- [ ] **Step 1: Locate integration point.** Insert the Language Bridge CTA below the Crisis Shield slot and above any fun-layer blocks. Search for `.cs-slot` and append after.

- [ ] **Step 2: Append CTA button.**

```js
import { openLanguageBridgePanel } from '../ui/language-bridge-panel.js';
import { t } from '../i18n/i18n.js';

const langSlot = h('section', { class: 'lang-slot', 'aria-labelledby': 'lang-cta-title' });
const btn = h('button', {
  class: 'lang-cta',
  'data-action': 'open-language-bridge',
  'aria-label': t('lang.openFor').replace('{country}', countryName),
}, [ t('lang.openFor').replace('{country}', countryName) ]);
btn.addEventListener('click', () => openLanguageBridgePanel(countryId));
langSlot.append(h('h3', { id: 'lang-cta-title' }, [ t('lang.panel.title') ]), btn);
panel.append(langSlot);
```

- [ ] **Step 3: Visibility rule.** Show the CTA for all 33 countries; if phrasebook is not seeded for that country, panel still opens (Camera + Voice + empty Saved tab work; Phrasebook tab shows `lang.phrasebook.noResults` + translate-instead CTA).

- [ ] **Step 4: Browser smoke**

```js
// open country detail for IT via the UI, then:
const slot = document.querySelector('.lang-slot');
console.assert(slot, 'lang-slot not injected');
const btn = slot.querySelector('[data-action="open-language-bridge"]');
btn.click();
console.assert(document.querySelector('[data-lang-panel][role="dialog"]'), 'panel did not open');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add js/ui/country-detail.js
git commit -m "feat(v1.7): country-detail CTA — Open Language Bridge for {country}"
```

---

## Task 12: Service worker precache bump (v10 → v11)

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump version.**

```js
const CACHE_VERSION = 'discovereu-v11';
```

- [ ] **Step 2: Append to same-origin precache manifest.**

```
'js/features/ocr.js',
'js/features/translate.js',
'js/features/phrasebook.js',
'js/features/voice-translator.js',
'js/ui/language-bridge-panel.js',
'js/ui/consent-dialog.js',
'js/ui/phrasebook-deck.js',
'css/language-bridge.css',
'data/phrasebook/_index.json',
'data/phrasebook/DE.json',
'data/phrasebook/FR.json',
'data/phrasebook/IT.json',
'data/phrasebook/ES.json',
'data/phrasebook/TR.json'
```

- [ ] **Step 3: DO NOT precache tesseract.** The ~11MB tesseract.js core + per-language packs are loaded lazily from jsdelivr only after the user confirms the `lang.ocr.sizeWarn` prompt. Spec §7 allows caching under a separate `cache-ocr-core-v1` bucket populated *at runtime on first successful OCR*; implement with a `fetch`-listener in `sw.js` that caches jsdelivr tesseract responses into `cache-ocr-core-v1` on demand. This is opt-in, NOT precache.

- [ ] **Step 4: Browser smoke (airplane-mode cold load).**

```js
const c = await caches.open('discovereu-v11');
for (const p of [
  'js/features/ocr.js','js/features/translate.js','js/features/phrasebook.js',
  'js/features/voice-translator.js','js/ui/language-bridge-panel.js',
  'css/language-bridge.css','data/phrasebook/_index.json','data/phrasebook/IT.json'
]) {
  console.assert(await c.match(p), 'not precached: ' + p);
}
// tesseract must NOT be precached:
const keys = await caches.keys();
console.log('ocr bucket exists only if user ran OCR once:', keys.includes('cache-ocr-core-v1'));
console.log('OK');
```

Then DevTools → Offline, hard-reload, open Language Bridge for IT → Phrasebook tab works fully offline; Camera tab shows size-warn and refuses to proceed offline if tesseract uncached.

- [ ] **Step 5: Commit**

```bash
git add sw.js
git commit -m "chore(v1.7): sw cache v11 — precache phrasebook + JS/CSS; tesseract runtime-cached on demand"
```

---

## Task 13: Final smoke + PROGRESS.md + decision log

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Full route-level smoke.**

1. Clear SW + LocalStorage + IndexedDB.
2. Reload; paste a Groq (or OpenAI) key in settings; build a route with IT + DE.
3. Open IT country detail → "Open Language Bridge for Italy" CTA visible below Crisis Shield.
4. Click → panel opens on Camera tab. Accept camera consent → video overlay shows guide frame. Point at a printed word → capture → size warn → accept → OCR runs → detected text editable → translate → save phrase. `navigator.vibrate(50)` fires on capture.
5. Switch to Phrasebook tab → search "help" → results render with IPA + play. Bookmark one.
6. Switch to Voice tab → accept mic consent → record "Where is the train station?" → Whisper → translate to Italian → TTS plays at rate 1.0. Toggle slow-mode → repeat → rate 0.7.
7. Switch to Saved tab → both bookmarked phrases appear. Play works. Delete + undo works.
8. Close panel; open DE country detail (not seeded) → panel opens → Phrasebook shows `lang.phrasebook.noResults` with translate-instead CTA.
9. Toggle Network → Offline, hard reload. Re-open IT panel: Phrasebook + Saved work fully; Camera refuses OCR if tesseract was not previously cached (shows `lang.ocr.sizeWarn` with offline notice); Voice disabled with clear message.
10. Lighthouse a11y on open panel ≥ 95.

- [ ] **Step 2: Update PROGRESS.md.**
  - Move all v1.7 Language Bridge entries to `Done`.
  - Add decision under §6:

```
**Decision (2026-04-13):** Language Bridge ships with three modes (OCR / Phrasebook / Voice), offline-first curated phrasebooks for 5 seed countries, WASM OCR that keeps pixels on-device, and LLM translation with offline-dict fallback. Tesseract.js (~13MB) is opt-in lazy download, never precached.
**Alternatives considered:** server-side translation proxy (rejected — backend constraint); real-time AR video translation (§14 out of scope, deferred); bundling tesseract in SW precache (rejected — 13MB on every install, hostile to low-end mobile plans).
**Rationale:** KA220 Digital (offline-first WASM + PWA + no backend), Inclusion (breaks language barrier for fewer-opportunities youth, AAA a11y), Participation (enables spontaneous intercultural encounter). Privacy-preserving by architecture: OCR never networks.
**Consequences:** Phrasebook content must be extended from 5 → 33 countries in a v1.7.1 follow-up. Tesseract runtime-cache bucket size must be displayed in Settings → Storage. Custom-domain migration must preserve `data/phrasebook/` URLs (already precached URLs must remain reachable).
```

  - Add followups to §7:
    - Language Bridge translations de/fr/es/it (i18n `lang.*`).
    - Extend phrasebooks from 5 to 33 DiscoverEU countries.
    - Native-speaker review pass on IT/ES/DE/FR/TR phrase registers.
    - Settings → Storage: show tesseract cache size + clear button.
    - Optional: per-country TTS voice preference.

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(v1.7): mark Language Bridge complete; log decision + followups"
```

---

## Self-review — spec ↔ task coverage

| Spec section | Requirement | Covered by |
|---|---|---|
| §2 `state.language` slice (savedPhrases, ocrLang, voiceOn, consent, provider) | Task 1 |
| §3 Four feature modules (ocr, translate, phrasebook, voice-bridge) + panel + consent-dialog | Tasks 4, 5, 6, 7, 8 |
| §3 Reuses `voice-transcribe.js`, `llm-adapter.js`, `emergency-phrases.json` seed | Tasks 3, 5, 7 |
| §4 `data/phrasebook/{country}.json` schema + `_index.json` | Task 3 |
| §4 6 categories (greetings, transport, food, emergency, accommodation, culture) | Task 3 Step 2 |
| §4 Wikivoyage CC-BY-SA attribution | Task 3 Step 2 + Task 8 Step 3 (footer) |
| §5 tesseract.js@5 lazy via jsdelivr | Task 4 Step 1 |
| §5 Per-language packs selective, IDB-cached | Task 4 + Task 12 Step 3 (runtime bucket) |
| §5 Web Speech API TTS native | Task 7 Step 1 |
| §5 Whisper reuses v1.5 | Task 7 |
| §6 Consent never on panel open; only explicit tap | Task 8 Step 3 (Camera/Voice tabs) |
| §6 `consent-dialog.js` with Accept/Decline/Learn-more | Task 8 Step 1 |
| §6 Consent revocable in Settings (state slice) | Task 1 Step 4 |
| §7 Phrasebook JSONs precached | Task 12 Step 2 |
| §7 Tesseract cached on first OCR (runtime bucket) | Task 12 Step 3 |
| §7 Offline-dict always available; LLM only online + key | Task 5 Step 2 |
| §8 OCR pixels never transmitted | Task 4 (WASM only) |
| §8 Voice clearly labelled as sending audio | Task 7 Step 3 (cost chip) + Task 8 Voice tab |
| §8 Saved phrases local only, exportable | Tasks 1, 6, 10 |
| §8 Privacy notice in panel header | Task 8 Step 3 section 1 |
| §9 SW cache buckets + size warning | Task 12 + `lang.ocr.sizeWarn` (Task 2) |
| §10 i18n `lang.*` keys in en + tr | Task 2 |
| §11 AAA — TTS + subtitle + IPA, 7:1 guide frame, vibrate, keyboard, live region, slow-mode, dyslexia font, selectable `<p>` | Tasks 8 Step 4, 9 Step 4 |
| §12 Grant narrative (KA220 Digital / Inclusion / Participation) | Task 13 decision log |
| §13 Risks — confidence + manual edit, opt-in size, offline fallback, single-shot capture, cost cap | Tasks 4, 5, 7, 8 |
| §14 Out of scope | Not implemented (by design) |
| §15 Deliverables checklist | Tasks 1–13 combined |

All in-scope spec requirements map to at least one task. Out-of-scope items (§14) are explicitly not implemented.

---

## Deferred i18n locales

German, French, Spanish, Italian `lang.*` translations are **deferred** and tracked as a followup in PROGRESS.md §7 (same pattern used for Crisis Shield v1.3 and Coach v1.6). English + Turkish ship with v1.7.

---

## Deferred phrasebook coverage

v1.7 ships with 5 seed phrasebooks (DE, FR, IT, ES, TR) — ~1000 curated phrases total. Extension to the remaining 28 DiscoverEU countries is tracked as a v1.7.1 follow-up (PROGRESS.md §7). Non-seeded countries still work via:
- OCR + LLM translation (online)
- Voice + LLM translation (online)
- Saved deck (cross-country)

Only the curated offline Phrasebook tab degrades gracefully to `lang.phrasebook.noResults`.

---

## CRITICAL — tesseract.js size warning

`tesseract.js@5` core is ~11MB (WASM + JS). Each language pack (`deu.traineddata`, `ita.traineddata`, etc.) is an additional 2–10MB. Combined first-OCR download can reach ~13MB for a single language; a user visiting 5 different-language countries and using OCR in each could download ~35MB total.

**Rules:**

1. **Never precache in SW.** Opt-in only. The `cache-ocr-core-v1` bucket is populated at runtime by `sw.js` fetch listener after the user explicitly accepts `lang.ocr.sizeWarn`.
2. **Show the size prompt before every FIRST download.** Language pack downloads after the core is cached should also prompt if the pack is >5MB (per-language threshold).
3. **Offline behaviour:** if tesseract is uncached and the device is offline, OCR is unavailable — show `lang.ocr.tryAgain` with an explanation, not a silent failure.
4. **Settings → Storage (v1.7.1 followup):** display `cache-ocr-core-v1` + `cache-ocr-lang-v1` sizes with a "clear" button so users can reclaim space.
5. **Mobile data guard:** if `navigator.connection?.saveData === true` or `effectiveType` is `'2g'` / `'slow-2g'`, the size prompt MUST also say "Wi-Fi recommended" (spec §13 mitigation).

Failure to respect these rules will hostile-download >10MB on metered mobile connections — treat as a launch blocker.
