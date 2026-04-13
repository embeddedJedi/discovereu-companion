# Accessibility Overlay 2.0 (v1.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the WCAG-AAA-plus accessibility overlay described in the spec — dyslexia mode, low-bandwidth mode, in-app reduce-motion, color-blind filters, wheelchair metro layer, opt-in Whisper.wasm voice transcription, unified Settings panel, and standalone demo page. No regressions to existing AA compliance. Client-side only, vanilla ES modules, CDN-only third parties.

**Spec (authoritative):** [`docs/superpowers/specs/2026-04-13-accessibility-overlay-design.md`](../specs/2026-04-13-accessibility-overlay-design.md)

**Architecture summary:**
- New `a11y` slice in `js/state.js` (persisted, schema-migrated).
- Two new stylesheets: `css/a11y.css` (tokens, data-attribute selectors, AAA contrast, reduce-motion, SVG filter refs) + `css/a11y-lowbw.css` (loaded on demand) + `css/a11y-colorblind.css` (SVG `feColorMatrix` defs).
- Feature modules: `js/features/a11y-settings.js` (applier), `js/features/color-blind-filter.js`, `js/features/low-bw.js`, `js/features/voice-transcribe.js` (opt-in Whisper).
- UI: `js/ui/a11y-panel.js` mounted under `/more → Accessibility`.
- Map: `js/map/wheelchair-layer.js` + `data/wheelmap-metro-index.json` seed (5 cities).
- Page: `pages/accessibility-demo.html` — screen-reader walkthrough.
- i18n `a11y.*` keys in en + tr; de/fr/es/it deferred.
- SW cache bump v7 -> v8 (Whisper deliberately excluded; opt-in online fetch).
- `<html>` data-attributes as the application surface: `data-a11y-dyslexia`, `data-a11y-contrast`, `data-a11y-motion`, `data-a11y-colorblind`, `data-a11y-lowbw`.

**Tech stack:** Vanilla ES modules, `h()` DOM helper (never innerHTML with interpolated content), CDN-only dependencies, LocalStorage for slice, IndexedDB for voice transcripts, no test runner — browser-console smoke assertions per task.

**i18n path:** `js/i18n/i18n.js`. Source files live in `i18n/*.json`.

**Privacy & safety:** Whisper model strictly opt-in, MB-sized confirm prompt, respects `navigator.connection.saveData`. No PII in the slice. Voice transcripts stay local in IndexedDB.

---

## Task 1: State slice — `a11y` in `js/state.js`

**Files:**
- Modify: `js/state.js`

- [ ] **Step 1: Extend `initialState`** with the `a11y` slice per spec §3. Slice must be loadable synchronously at boot (before first paint) to avoid FOUC.

```js
// inside initialState
a11y: {
  schemaVersion: 1,
  contrastMode: 'default',        // 'default' | 'aaa' | 'dyslexia-amber'
  fontFamily: 'system',           // 'system' | 'opendyslexic' | 'atkinson'
  fontSizeScale: 1.0,             // 0.875 .. 1.5
  lineHeight: 1.5,                // 1.5 | 1.8 | 2.0
  letterSpacing: 0,               // 0 | 0.05 | 0.12  (em)
  reduceMotion: false,
  lowBandwidth: false,
  colorBlindFilter: 'none',       // 'none'|'protanopia'|'deuteranopia'|'tritanopia'
  wheelchairLayer: false,
  voiceTranscription: false,      // triggers Whisper lazy-load when true
  focusRingAlways: true
},
```

- [ ] **Step 2: Add `a11y` to `PERSIST_KEYS`** so LocalStorage round-trips it under `discoveru:a11y` namespace (or the shared key — follow existing pattern).

- [ ] **Step 3: Extend `migrate()`** to backfill the slice for pre-v1.5 LocalStorage:

```js
if (!persisted?.a11y) {
  persisted.a11y = { /* defaults from Step 1 */ };
} else if (persisted.a11y.schemaVersion !== 1) {
  persisted.a11y = { ...DEFAULT_A11Y, ...persisted.a11y, schemaVersion: 1 };
}
```

- [ ] **Step 4: Event emission.** `state.set('a11y', patch)` must emit `a11y:change` (or pipe through the existing subscriber model) so the applier re-runs.

- [ ] **Step 5: Browser smoke**

```js
const { state } = await import('./js/state.js');
const a = state.get('a11y');
console.assert(a && a.schemaVersion === 1, 'a11y slice missing');
console.assert(a.contrastMode === 'default', 'default contrast wrong');
console.assert(a.voiceTranscription === false, 'voice must default OFF');
state.set('a11y', { ...a, reduceMotion: true });
// then reload and re-read
console.log('OK', state.get('a11y').reduceMotion);
```

- [ ] **Step 6: Commit**

```bash
git add js/state.js
git commit -m "feat(v1.5): a11y state slice — persisted + migrated toggles for overlay 2.0"
```

---

## Task 2: i18n keys — `a11y.*` (en + tr)

**Files:**
- Modify: `i18n/en.json` (source)
- Modify: `i18n/tr.json`
- Flag as followup: `de.json`, `fr.json`, `es.json`, `it.json`

- [ ] **Step 1: Add keys per spec §4.** Required:

```
a11y.panel.title
a11y.contrast.default | contrast.aaa | contrast.dyslexia
a11y.font.system | font.opendyslexic | font.atkinson
a11y.size.label | size.help
a11y.lineHeight.label
a11y.letterSpacing.label
a11y.reduceMotion.label | reduceMotion.help
a11y.lowBandwidth.label | lowBandwidth.help
a11y.colorBlind.none | colorBlind.prot | colorBlind.deut | colorBlind.trit
a11y.wheelchair.layer | wheelchair.help
a11y.voice.transcribe.label | voice.transcribe.help | voice.transcribe.download
a11y.voice.transcribe.ready | voice.transcribe.error | voice.transcribe.progress
a11y.demo.cta | a11y.demo.title
a11y.reset | a11y.openPanel
```

- [ ] **Step 2: Translate to Turkish** in `i18n/tr.json`. Avoid startup-y wording; use EU inclusion vocabulary ("erişilebilir", "engelliler için", "düşük bant genişliği").

- [ ] **Step 3: Log deferred locales.** In `PROGRESS.md` §7 followups, add: *"v1.5 a11y translations — de/fr/es/it deferred."*

- [ ] **Step 4: Browser smoke**

```js
const [en, tr] = await Promise.all(['en','tr'].map(l => fetch(`i18n/${l}.json`).then(r=>r.json())));
const need = ['a11y.panel.title','a11y.contrast.aaa','a11y.font.opendyslexic','a11y.reduceMotion.label','a11y.lowBandwidth.label','a11y.colorBlind.deut','a11y.wheelchair.layer','a11y.voice.transcribe.label'];
for (const bag of [en, tr]) {
  const missing = need.filter(k => !k.split('.').reduce((a,p)=>a?.[p], bag));
  console.assert(missing.length === 0, 'missing: ' + missing.join(','));
}
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add i18n/en.json i18n/tr.json PROGRESS.md
git commit -m "feat(v1.5): i18n a11y.* keys (en + tr); de/fr/es/it deferred"
```

---

## Task 3: Stylesheet — `css/a11y.css` + AAA tokens

**Files:**
- Create: `css/a11y.css`
- Modify: `css/design-system.css` (AAA contrast token pair)
- Modify: `index.html` (link tag)

- [ ] **Step 1: Design-system AAA tokens.** In both `:root` and `[data-theme="dark"]`:

```css
--a11y-aaa-bg: #000000;
--a11y-aaa-fg: #FFFFFF;         /* 21:1 */
--a11y-amber-bg: #FFF3C4;       /* dyslexia-amber, measured ≥7:1 vs #222 */
--a11y-amber-fg: #222222;
--a11y-font-scale: 1;
--a11y-line-height: 1.5;
--a11y-letter-spacing: 0;
```

- [ ] **Step 2: `css/a11y.css` — selectors driven by `<html data-a11y-*>` attributes:**

```css
html { font-size: calc(16px * var(--a11y-font-scale)); }
html[data-a11y-contrast="aaa"]       { background: var(--a11y-aaa-bg); color: var(--a11y-aaa-fg); }
html[data-a11y-contrast="dyslexia-amber"] { background: var(--a11y-amber-bg); color: var(--a11y-amber-fg); }
html[data-a11y-dyslexia="opendyslexic"] body,
html[data-a11y-dyslexia="opendyslexic"] input,
html[data-a11y-dyslexia="opendyslexic"] button { font-family: 'OpenDyslexic', system-ui, sans-serif; }
html[data-a11y-dyslexia="atkinson"] body { font-family: 'Atkinson Hyperlegible', system-ui, sans-serif; }
html[data-a11y-motion="none"] *,
html[data-a11y-motion="none"] *::before,
html[data-a11y-motion="none"] *::after {
  transition: none !important;
  animation: none !important;
  scroll-behavior: auto !important;
}
body { line-height: var(--a11y-line-height); letter-spacing: var(--a11y-letter-spacing); }
html[data-a11y-focus="always"] :focus { outline: 3px solid var(--focus, #FFBF00); outline-offset: 2px; }
```

- [ ] **Step 3: Link in `index.html` before existing stylesheets** (cascade order: design-system → a11y → feature sheets):

```html
<link rel="stylesheet" href="css/a11y.css">
```

- [ ] **Step 4: Browser smoke**

```js
document.documentElement.setAttribute('data-a11y-motion', 'none');
const t = getComputedStyle(document.body).transitionDuration;
console.assert(t === '0s' || t === '0s, 0s' || t.startsWith('0'), 'motion not killed: '+t);
document.documentElement.removeAttribute('data-a11y-motion');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add css/a11y.css css/design-system.css index.html
git commit -m "feat(v1.5): a11y.css — data-attribute-driven AAA/dyslexia/motion tokens"
```

---

## Task 4: Applier — `js/features/a11y-settings.js`

**Files:**
- Create: `js/features/a11y-settings.js`

- [ ] **Step 1: Exports.**

```js
export function initA11y();             // wires state subscription; applies once at boot
export function applyA11y(slice);       // pure: sets attributes + CSS vars on <html>
export async function loadDyslexiaFont(); // lazy-loads OpenDyslexic woff2 on demand
export async function loadAtkinsonFont();
export function resetA11y();            // writes defaults back into state
```

- [ ] **Step 2: `applyA11y(slice)` algorithm:**

```js
const html = document.documentElement;
html.setAttribute('data-a11y-contrast', slice.contrastMode);
html.setAttribute('data-a11y-dyslexia', slice.fontFamily === 'opendyslexic' ? 'opendyslexic'
                                       : slice.fontFamily === 'atkinson' ? 'atkinson' : 'off');
html.setAttribute('data-a11y-motion', slice.reduceMotion ? 'none' : 'auto');
html.setAttribute('data-a11y-colorblind', slice.colorBlindFilter);
html.setAttribute('data-a11y-lowbw', slice.lowBandwidth ? '1' : '0');
html.setAttribute('data-a11y-focus', slice.focusRingAlways ? 'always' : 'auto');
html.style.setProperty('--a11y-font-scale', slice.fontSizeScale);
html.style.setProperty('--a11y-line-height', slice.lineHeight);
html.style.setProperty('--a11y-letter-spacing', slice.letterSpacing + 'em');
```

- [ ] **Step 3: Font loader (lazy, on demand only).** `loadDyslexiaFont()` injects:

```js
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'https://cdnjs.cloudflare.com/ajax/libs/opendyslexic/0.91.12/opendyslexic.min.css';
link.crossOrigin = 'anonymous';
document.head.append(link);
```

Guard against double-inject with a module-scoped flag. Same pattern for Atkinson (Google Fonts).

- [ ] **Step 4: `initA11y()`** runs `applyA11y(state.get('a11y'))` immediately (pre-paint) and subscribes to `a11y:change`.

- [ ] **Step 5: Reduce-motion override chain (JSDoc).**

```
Effective motion =
  state.a11y.reduceMotion === true                -> NONE  (user opt-in wins)
  state.a11y.reduceMotion === false && OS reduce  -> NONE  (respect OS)
  state.a11y.reduceMotion === false && OS default -> AUTO
The in-app toggle can only STRENGTHEN reduce-motion; the "Allow motion anyway"
escape hatch is offered separately (spec §8) via an override flag if added later.
```

- [ ] **Step 6: Browser smoke**

```js
const m = await import('./js/features/a11y-settings.js');
m.applyA11y({ contrastMode:'aaa', fontFamily:'system', fontSizeScale:1.25, lineHeight:1.8, letterSpacing:0.05, reduceMotion:true, lowBandwidth:false, colorBlindFilter:'none', voiceTranscription:false, focusRingAlways:true });
console.assert(document.documentElement.getAttribute('data-a11y-contrast') === 'aaa');
console.assert(document.documentElement.getAttribute('data-a11y-motion') === 'none');
console.assert(document.documentElement.style.getPropertyValue('--a11y-font-scale') === '1.25');
console.log('OK');
```

- [ ] **Step 7: Commit**

```bash
git add js/features/a11y-settings.js
git commit -m "feat(v1.5): a11y-settings applier — data-attributes + CSS vars + lazy fonts"
```

---

## Task 5: UI panel — `js/ui/a11y-panel.js`

**Files:**
- Create: `js/ui/a11y-panel.js`
- Modify: `js/ui/more-page.js` (or wherever `/more` tab is assembled) — add Accessibility entry

- [ ] **Step 1: Exports.**

```js
export function openA11yPanel();
export function closeA11yPanel();
export function renderA11ySection();   // embedded render for /more tab
```

- [ ] **Step 2: Structure (all via `h()`).** Sections in order:
  1. Header + reset button (`a11y.reset`).
  2. Contrast radio group — `default`, `aaa`, `dyslexia-amber`.
  3. Font-family radio group — `system`, `opendyslexic`, `atkinson`.
  4. Sliders: font-size (0.875–1.5), line-height (1.5 / 1.8 / 2.0), letter-spacing (0 / 0.05 / 0.12em). Each with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and a visible numeric readout.
  5. Reduce-motion toggle.
  6. Low-bandwidth toggle.
  7. Color-blind select (none/prot/deut/trit).
  8. Wheelchair-layer toggle.
  9. Voice-transcription toggle (shows MB-size download confirm on enable).
  10. Link: "Open accessibility demo page" → `pages/accessibility-demo.html`.

- [ ] **Step 3: Accessibility rules.**
  - Radios grouped with `<fieldset>`/`<legend>`.
  - All controls reachable by Tab; arrow-key navigation inside radio groups.
  - Live preview: every change calls `state.set('a11y', …)` which triggers the applier; no separate "Apply" button.
  - Panel is a `role="dialog"` with focus trap + Esc to close (when opened as overlay). As an embedded `/more` section, it is a plain landmark (`<section aria-labelledby>`).
  - Respect `data-a11y-motion="none"` for its own transitions.

- [ ] **Step 4: Browser smoke**

```js
const { renderA11ySection } = await import('./js/ui/a11y-panel.js');
const el = renderA11ySection();
document.body.append(el);
console.assert(el.querySelectorAll('input[type="radio"]').length >= 6, 'radios missing');
console.assert(el.querySelectorAll('input[type="range"]').length >= 3, 'sliders missing');
console.assert(el.querySelectorAll('input[type="checkbox"]').length >= 4, 'toggles missing');
console.assert(el.querySelector('[data-a11y-action="reset"]'), 'reset missing');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add js/ui/a11y-panel.js js/ui/more-page.js
git commit -m "feat(v1.5): a11y-panel UI — toggles, sliders, live preview in /more"
```

---

## Task 6: Wheelchair metro seed — `data/wheelmap-metro-index.json`

**Files:**
- Create: `data/wheelmap-metro-index.json`

- [ ] **Step 1: Author seed** covering 5 cities: Paris, Berlin, Madrid, Rome, İstanbul. Sources: Wheelmap OSM snapshot + operator accessibility maps already linked from `data/accessibility.json`.

```json
{
  "version": 1,
  "lastVerified": "2026-04-13",
  "cities": [
    {
      "city": "Paris",
      "country": "FR",
      "source": "wheelmap+ratp",
      "stations": [
        { "id": "paris-14-chatelet", "name": "Châtelet (L14)", "lat": 48.8585, "lon": 2.3475, "line": "14", "stepFree": "yes", "lift": true }
      ]
    }
    /* Berlin, Madrid, Rome, İstanbul — ≥ 8 stations each, step-free only */
  ]
}
```

- [ ] **Step 2: Browser smoke**

```js
const w = await (await fetch('data/wheelmap-metro-index.json')).json();
console.assert(w.cities.length === 5, 'need 5 cities');
console.assert(w.cities.every(c => c.stations.every(s => s.lat && s.lon && s.stepFree)), 'bad station');
console.log('OK', w.cities.map(c => c.city).join(','));
```

- [ ] **Step 3: Commit**

```bash
git add data/wheelmap-metro-index.json
git commit -m "feat(v1.5): wheelmap-metro-index seed — 5 cities step-free stations"
```

---

## Task 7: Wheelchair map layer — `js/map/wheelchair-layer.js`

**Files:**
- Create: `js/map/wheelchair-layer.js`
- Modify: `js/map/` entry point that registers toggles (confirm via Glob)

- [ ] **Step 1: Exports.**

```js
export async function createWheelchairLayer(map);   // returns { layer, toggle(on) }
```

- [ ] **Step 2: Behaviour.** Lazy-loads `data/wheelmap-metro-index.json` only when first enabled. Each station becomes an `L.marker` with a wheelchair icon (inline SVG, no external asset). Marker is keyboard-focusable (`keyboard: true`) and its `alt` / popup reads `"<name> — step-free: yes, lift: true"` (i18n-localised).

- [ ] **Step 3: Toggle wiring.** Subscribe to `a11y:change`; when `state.a11y.wheelchairLayer` flips, call `layer.addTo(map)` or `map.removeLayer(layer)`.

- [ ] **Step 4: Browser smoke**

```js
const { createWheelchairLayer } = await import('./js/map/wheelchair-layer.js');
const { map } = window.__mapRef ?? {};  // or grab the exported map instance
const l = await createWheelchairLayer(map);
l.toggle(true);
console.assert(document.querySelectorAll('.leaflet-marker-icon').length > 0, 'no markers rendered');
l.toggle(false);
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add js/map/wheelchair-layer.js js/map/*
git commit -m "feat(v1.5): wheelchair-layer — Leaflet toggle with step-free metro markers"
```

---

## Task 8: Voice transcription — `js/features/voice-transcribe.js`

**Files:**
- Create: `js/features/voice-transcribe.js`
- Modify: `js/features/voice-memory.js` — add hook to call `transcribeAudio(blob)` when `state.a11y.voiceTranscription === true`

- [ ] **Step 1: Exports.**

```js
export async function ensureModelReady({ onProgress });  // lazy-loads Whisper-tiny
export async function transcribeAudio(blob, { lang = 'auto' } = {}); // returns { text, lang, confidence }
export function isModelCached();                          // checks a11y-whisper-v1 cache
```

- [ ] **Step 2: Lazy-load transformers.js.** Only imported after the user flips the voice-transcription toggle AND clicks "Download 40 MB speech model" in the confirm dialog.

```js
const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17/dist/transformers.min.js');
env.allowRemoteModels = true;
env.useBrowserCache = true;       // cache to IndexedDB via transformers.js
const asr = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', { progress_callback: onProgress });
```

- [ ] **Step 3: Guards.**
  - If `navigator.connection?.saveData === true` OR `state.a11y.lowBandwidth === true` → refuse auto-download; return `{ ok: false, reason: 'saveData' }`.
  - If `typeof SharedArrayBuffer === 'undefined'` → continue on the single-thread WASM path; show a "slow mode" banner (COEP/COOP headers unavailable on GitHub Pages — see §14 of this plan).
  - Respect `a11y.voiceTranscription` toggle as hard gate.

- [ ] **Step 4: Hook in `voice-memory.js`.** After successful recording:

```js
if (state.get('a11y').voiceTranscription) {
  const { transcribeAudio } = await import('./voice-transcribe.js');
  const { text, lang } = await transcribeAudio(blob);
  await idb.put('voice-memories', { ...record, transcriptText: text, transcriptLang: lang, transcribedAt: Date.now() });
}
```

- [ ] **Step 5: Progress UI.** Emit `a11y:voice:progress` events with `{ loaded, total, stage }` so the panel can render a progress bar.

- [ ] **Step 6: Browser smoke (manual, opt-in).**

```js
// Only after flipping voice toggle ON + accepting model download prompt:
const { transcribeAudio } = await import('./js/features/voice-transcribe.js');
const ctx = new AudioContext();
const blob = /* a small 3-5s wav blob */ null;
if (blob) {
  const r = await transcribeAudio(blob);
  console.log('transcript:', r);
}
```

- [ ] **Step 7: Commit**

```bash
git add js/features/voice-transcribe.js js/features/voice-memory.js
git commit -m "feat(v1.5): voice-transcribe — opt-in Whisper-tiny lazy load + transcript store"
```

---

## Task 9: Color-blind filters — `css/a11y-colorblind.css` + `js/features/color-blind-filter.js`

**Files:**
- Create: `css/a11y-colorblind.css`
- Create: `js/features/color-blind-filter.js`
- Modify: `index.html` — link the stylesheet

- [ ] **Step 1: SVG filter definitions.** Inject once into `<body>` (hidden SVG) with `feColorMatrix` daltonize matrices (Fidaner/Wong) for `protanopia`, `deuteranopia`, `tritanopia`. IDs: `a11y-cb-prot`, `a11y-cb-deut`, `a11y-cb-trit`.

- [ ] **Step 2: CSS rules** driven by `<html data-a11y-colorblind="…">`:

```css
html[data-a11y-colorblind="protanopia"]   body > :not(.leaflet-tile-pane) { filter: url(#a11y-cb-prot); }
html[data-a11y-colorblind="deuteranopia"] body > :not(.leaflet-tile-pane) { filter: url(#a11y-cb-deut); }
html[data-a11y-colorblind="tritanopia"]   body > :not(.leaflet-tile-pane) { filter: url(#a11y-cb-trit); }
```

Raster tiles excluded (spec §11).

- [ ] **Step 3: `color-blind-filter.js` exports** `ensureSvgInjected()` (idempotent). Called once by `initA11y()`.

- [ ] **Step 4: Browser smoke**

```js
const { ensureSvgInjected } = await import('./js/features/color-blind-filter.js');
ensureSvgInjected();
console.assert(document.getElementById('a11y-cb-deut'), 'deut filter missing');
document.documentElement.setAttribute('data-a11y-colorblind','deuteranopia');
console.assert(getComputedStyle(document.body).filter.includes('url'), 'filter not applied');
document.documentElement.setAttribute('data-a11y-colorblind','none');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add css/a11y-colorblind.css js/features/color-blind-filter.js index.html
git commit -m "feat(v1.5): color-blind SVG filters — protanopia/deuteranopia/tritanopia (map tiles exempt)"
```

---

## Task 10: Reduce-motion global dialect

**Files:**
- Modify: `js/features/a11y-settings.js` (already drafted in Task 4 — now wire Leaflet + Wrapped + confetti)
- Modify: `js/map/` map init (pass `zoomAnimation:false` etc. when slice says so)
- Modify: `js/features/wrapped.js` (disable auto-advance when reduce-motion on)
- Modify: `js/features/confetti.js` (no-op when reduce-motion on)

- [ ] **Step 1: Map options.** On map init, read `state.get('a11y').reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches` and pass to Leaflet:

```js
L.map(el, { zoomAnimation: !reduce, fadeAnimation: !reduce, markerZoomAnimation: !reduce });
```

- [ ] **Step 2: Wrapped auto-advance.** Replace the `setInterval` step with manual next/prev only when reduce-motion on.

- [ ] **Step 3: Confetti guard.**

```js
if (state.get('a11y').reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
```

- [ ] **Step 4: JSDoc on `applyA11y`** stating override chain (already drafted in Task 4 Step 5 — keep in sync).

- [ ] **Step 5: Browser smoke**

```js
const { state } = await import('./js/state.js');
state.set('a11y', { ...state.get('a11y'), reduceMotion: true });
// trigger wrapped open programmatically
const wr = await import('./js/features/wrapped.js');
// confirm auto-advance timer is null/cleared
// confirm confetti no-ops
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/features/a11y-settings.js js/features/wrapped.js js/features/confetti.js js/map/*
git commit -m "feat(v1.5): reduce-motion global — Leaflet + wrapped + confetti honour in-app toggle"
```

---

## Task 11: Low-bandwidth mode — `js/features/low-bw.js`

**Files:**
- Create: `js/features/low-bw.js`
- Create: `css/a11y-lowbw.css`
- Modify: `js/features/a11y-settings.js` — when `lowBandwidth` flips, call `applyLowBw(on)`

- [ ] **Step 1: Exports.**

```js
export function applyLowBw(on);   // attach/detach stylesheet; set <html data-a11y-lowbw="1">
export function listDeferredModules();  // returns string[] of what's stripped (for panel help text)
```

- [ ] **Step 2: `css/a11y-lowbw.css`** — hides decorative imagery, disables backdrop-filter, swaps gradients to solids, forces `img { content-visibility: auto; }`.

- [ ] **Step 3: Deferred modules when `lowBandwidth=on`:**
  - Wikivoyage live-refresh: don't auto-fetch; show "Refresh now" button only.
  - Voice-memory recording UI: hidden.
  - Wrapped canvas: replaced by static text summary.
  - Leaflet tiles: switch tile provider to lower-res variant if available, else keep but at `maxZoom - 2`.
  - Countries GeoJSON: load `data/countries-simplified.geojson` instead of full-resolution.
  - Soundtrack preview audio: not auto-loaded.

Document all of these strings under `a11y.lowBandwidth.help` (i18n Task 2).

- [ ] **Step 4: Stylesheet toggle.** `applyLowBw(true)` appends `<link rel="stylesheet" href="css/a11y-lowbw.css" id="a11y-lowbw-sheet">`; `applyLowBw(false)` removes it.

- [ ] **Step 5: Browser smoke**

```js
const { applyLowBw, listDeferredModules } = await import('./js/features/low-bw.js');
applyLowBw(true);
console.assert(document.getElementById('a11y-lowbw-sheet'), 'lowbw sheet not attached');
console.assert(document.documentElement.getAttribute('data-a11y-lowbw') === '1');
console.assert(listDeferredModules().length >= 4, 'deferred list too short');
applyLowBw(false);
console.assert(!document.getElementById('a11y-lowbw-sheet'), 'lowbw sheet not detached');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/features/low-bw.js css/a11y-lowbw.css js/features/a11y-settings.js
git commit -m "feat(v1.5): low-bandwidth mode — defer heavy modules + lean stylesheet"
```

---

## Task 12: Demo page — `pages/accessibility-demo.html`

**Files:**
- Create: `pages/accessibility-demo.html`
- Modify: `index.html` footer (link to demo)

- [ ] **Step 1: Static-first markup.** Must read usefully with JS disabled. Proper landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`), skip-link to `#main`, heading hierarchy H1 → H2 → H3, one live region demo (`aria-live="polite"`), one toggle demo, explicit NVDA + VoiceOver + TalkBack call-outs in prose.

- [ ] **Step 2: Link a11y stylesheets + i18n boot** so a reviewer can flip the toggles right on the demo page.

- [ ] **Step 3: Storyboard blocks** (written walkthrough, no video):
  - "1. Skip-link test"
  - "2. Landmark navigation"
  - "3. Live-region announcement"
  - "4. Toggle demo — flip dyslexia + amber + reduce-motion"
  - "5. Wheelchair layer on map (link to main app)"
  - "6. Voice transcription (opt-in; lazy)"

- [ ] **Step 4: Footer link in `index.html`:** add `<a href="pages/accessibility-demo.html" data-i18n="a11y.demo.cta">`.

- [ ] **Step 5: Browser smoke**

```js
const r = await fetch('pages/accessibility-demo.html');
console.assert(r.ok, 'demo page missing');
const html = await r.text();
for (const t of ['<main', 'aria-live', 'skip', '<h1', 'NVDA', 'VoiceOver']) {
  console.assert(html.includes(t), 'demo missing marker: '+t);
}
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add pages/accessibility-demo.html index.html
git commit -m "feat(v1.5): accessibility-demo.html — SR walkthrough + live toggle showcase"
```

---

## Task 13: Service worker precache bump (v7 → v8)

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump cache version.**

```js
const CACHE_VERSION = 'discovereu-v8';
```

- [ ] **Step 2: Append to precache manifest** (same-origin only):

```
'css/a11y.css',
'css/a11y-lowbw.css',
'css/a11y-colorblind.css',
'js/features/a11y-settings.js',
'js/features/color-blind-filter.js',
'js/features/low-bw.js',
'js/features/voice-transcribe.js',
'js/ui/a11y-panel.js',
'js/map/wheelchair-layer.js',
'data/wheelmap-metro-index.json',
'pages/accessibility-demo.html'
```

- [ ] **Step 3: Deliberate exclusions** (document as inline comment in `sw.js`):
  - `@xenova/transformers` + Whisper-tiny weights — too large (~40 MB); opt-in online fetch, cached under a **separate** runtime cache key `a11y-whisper-v1` via `cache-first + stale-while-revalidate` handler, only after user confirms download.
  - OpenDyslexic woff2 — font-display: swap on cdnjs; optionally add to precache if size permits (<100 KB). If added, note it here; if not, the font falls back to system on offline first-run.

- [ ] **Step 4: Browser smoke (airplane-mode cold load).**

```js
const keys = await caches.keys();
console.assert(keys.includes('discovereu-v8'), 'v8 missing');
const c = await caches.open('discovereu-v8');
for (const p of ['css/a11y.css','js/features/a11y-settings.js','js/ui/a11y-panel.js','data/wheelmap-metro-index.json','pages/accessibility-demo.html']) {
  console.assert(await c.match(p), 'not precached: '+p);
}
// confirm Whisper is NOT precached:
console.assert(!(await c.match('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17/dist/transformers.min.js')), 'whisper leaked into precache');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add sw.js
git commit -m "chore(v1.5): sw cache v8 — precache a11y assets; Whisper stays opt-in online"
```

---

## Task 14: Final smoke + PROGRESS.md + decision log

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Manual a11y audit checklist** (per spec §9):

  1. axe DevTools + Lighthouse a11y ≥ 98 on `/`, `/more`, `pages/accessibility-demo.html`.
  2. Keyboard-only tab through Settings → Accessibility; no focus traps; skip-link first.
  3. NVDA (Win FF) / VoiceOver (macOS) smoke on demo page.
  4. Contrast: AAA mode ≥ 7:1 for normal text, 4.5:1 for large.
  5. BDA dyslexia checklist: line-height ≥ 1.5, no justified text, amber/cream bg available.
  6. Chrome DevTools Slow-3G + 4× CPU throttle on lowBandwidth=on → interactive ≤ 5s.
  7. Voice transcription round-trip on a 5s sample (opt-in path).
  8. Color-blind filter applied everywhere EXCEPT `.leaflet-tile-pane`.
  9. Reduce-motion: Leaflet zoom, wrapped auto-advance, confetti all suppressed.
  10. Whisper refused auto-download when `saveData === true`.

- [ ] **Step 2: Update PROGRESS.md.**
  - Move every v1.5 Accessibility Overlay entry to `Done`.
  - Add decision entry under §6:

```
**Decision (2026-04-13):** Accessibility Overlay 2.0 ships as data-attribute-driven CSS layer + opt-in Whisper
transcription. All state under `a11y` slice in LocalStorage; transcripts in IndexedDB. Whisper is NEVER
precached; downloads only on explicit confirm + honours saveData.
**Alternatives considered:** server-side TTS (backend forbidden), native TalkBack/VoiceOver bridges
(out of scope v1.5), automated a11y CI (deferred — tracked separately), sign-language video (§12).
**Rationale:** Maps directly to Erasmus+ Inclusion & Diversity priority; reviewable without build tooling;
zero regressions to AA baseline (AAA is opt-in mode).
**Consequences:** SW cache bump v7 → v8; quarterly re-verification of wheelmap seed; i18n de/fr/es/it
deferred to post-launch translation sprint; Whisper runs single-thread WASM on GitHub Pages due to
missing COEP/COOP headers — slower but functional.
```

  - Add followups to §7:
    - v1.5 a11y translations de/fr/es/it.
    - Expand wheelmap-metro-index from 5 to 25 cities (spec §4 target).
    - Evaluate GitHub Pages custom domain + `_headers` for COEP/COOP to unlock Whisper multi-thread.
    - Contrast report doc: `docs/a11y/contrast-report.md`.

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(v1.5): mark Accessibility Overlay 2.0 complete; log decision + followups"
```

---

## Self-review — spec ↔ task coverage

| Spec section | Requirement | Covered by |
|---|---|---|
| §3 `a11y` slice, schema v1, sync-load pre-paint | Task 1 |
| §4 `css/a11y.css` — AAA tokens, dyslexia-amber, reduce-motion, focus ring | Task 3 |
| §4 `css/a11y-lowbw.css` — decorative imagery hidden, backdrop-filter off | Task 11 |
| §4 `js/features/a11y-settings.js` — applier + `data-a11y-*` writer | Task 4 |
| §4 `js/ui/a11y-panel.js` — radio/slider/toggle live preview | Task 5 |
| §4 `js/features/voice-transcribe.js` — lazy Whisper-tiny + IDB transcripts | Task 8 |
| §4 `js/map/wheelchair-layer.js` — Leaflet toggle | Task 7 |
| §4 `js/features/color-blind-filter.js` — SVG `feColorMatrix` | Task 9 |
| §4 `data/wheelmap-metro-index.json` — seed cities | Task 6 |
| §4 `pages/accessibility-demo.html` — SR storyboard | Task 12 |
| §4 i18n `a11y.*` keys (6 locales; 4 deferred) | Task 2 |
| §5 CDN libs (OpenDyslexic, Atkinson, transformers.js, SVG filters) | Tasks 4, 8, 9 |
| §6 SW precache additions + Whisper exclusion | Task 13 |
| §7 low-bandwidth specifics (simplified GeoJSON, deferred heavy modules, JS budget) | Task 11 |
| §8 in-app reduce-motion overriding OS pref (both ways) | Tasks 4, 10 |
| §9 testing protocol (axe, keyboard, SR, contrast, BDA, Slow-3G, WER) | Task 14 |
| §10 grant narrative mapping | Task 14 decision log |
| §11 risks & mitigations (Whisper size, COEP/COOP, font polarisation, filter vs tiles, quota, AAA palette) | Tasks 8, 9, 13, 14 |
| §12 out-of-scope items | Not implemented (by design) |

All in-scope spec requirements map to at least one task.

---

## Deferred i18n locales

`de.json`, `fr.json`, `es.json`, `it.json` intentionally skipped for `a11y.*` keys in v1.5 — logged under PROGRESS.md §7 followups. English + Turkish ship as source. This mirrors the v1.3 / v1.4 pattern (Crisis Shield, Impact Dashboard).

---

## Whisper.wasm cross-origin-isolation flag

Whisper multi-thread WASM requires `SharedArrayBuffer`, which requires **both** of these response headers:

```
Cross-Origin-Opener-Policy:   same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**GitHub Pages does not set these headers and does not expose a `_headers` file mechanism**. Consequences:

1. `typeof SharedArrayBuffer === 'undefined'` at runtime.
2. `@xenova/transformers` transparently falls back to a single-thread WASM path — still functional, ~2-3× slower on Whisper-tiny.
3. Code in `voice-transcribe.js` **must not** assume multi-thread; guard in Task 8 Step 3.
4. Show a one-line banner ("Slow mode — your host doesn't allow cross-origin isolation") in the a11y panel when single-thread is detected, so reviewers understand the perf ceiling is host-driven, not code-driven.

If the project later moves to a custom domain behind Cloudflare Pages or Netlify, a `_headers` file flipping COOP/COEP unlocks multi-thread — tracked as a followup in Task 14.
