# Accessibility Overlay 2.0 — Design Spec (v1.5)

**Date:** 2026-04-13 · **Status:** Design · **Owner:** architect
**Target:** WCAG AAA + dyslexia + low-bandwidth + deaf/HoH + motor/cognitive inclusion layer
**Grant narrative:** Erasmus+ KA Inclusion & Diversity priority — "lower the threshold for participation for young people with fewer opportunities, including those with disabilities, from rural/remote areas, or with limited digital/economic means."

---

## 1. Goals

Elevate the app from WCAG AA baseline to AAA where feasible, and bundle six discoverable, toggleable accessibility dialects under one panel. Zero regressions to existing AA compliance. All client-side, no backend, vanilla JS, CDN-only third parties.

## 2. Scope

In: WCAG AAA pass, dyslexia mode, low-bandwidth mode, wheelchair metro layer, Whisper.wasm voice transcription, in-app reduce-motion, a11y demo page, unified settings panel, color-blind filters.
Out: sign-language video, braille export, native screen-reader builds, server-side TTS, real-time captioning of external audio, automated a11y CI (tracked separately).

## 3. Data model — state slice `a11y`

Persisted under `localStorage["discoveru:a11y"]` (schema v1). Loaded synchronously in `main.js` before first paint to avoid FOUC.

```js
{
  schema: 1,
  contrastMode: "default" | "aaa" | "dyslexia-amber",
  fontFamily: "system" | "opendyslexic" | "atkinson",
  fontSizeScale: 1.0,           // 0.875 – 1.5
  lineHeight: 1.5,              // 1.5 | 1.8 | 2.0
  letterSpacing: 0,             // 0 | 0.05em | 0.12em
  reduceMotion: false,          // in-app, overrides prefers-reduced-motion=false
  lowBandwidth: false,
  colorBlindFilter: "none" | "protanopia" | "deuteranopia" | "tritanopia",
  wheelchairLayer: false,
  voiceTranscription: false,    // opt-in; triggers Whisper lazy-load
  focusRingAlways: true
}
```

Setter: `setA11y(patch)` in `js/state.js` → emits `a11y:change` event → every consumer re-reads tokens from `<html data-a11y-*>` attributes (no inline style thrash).

## 4. New files

### CSS
- `css/a11y.css` — tokens for AAA contrast palette, dyslexia-amber variant, focus-ring overrides, `[data-reduce-motion="1"] *{transition:none!important;animation:none!important}`, SVG color-blind filter references.
- `css/a11y-lowbw.css` — loaded only when `lowBandwidth=1`; hides decorative imagery, swaps gradients for solids, disables backdrop-filter.

### JS
- `js/features/a11y-settings.js` — single source of truth for the slice, apply/revert, localStorage sync, `data-a11y-*` attribute writer.
- `js/ui/a11y-panel.js` — renders Settings → Accessibility UI, all toggles keyboard-accessible (radio groups, sliders with aria-valuenow, live preview).
- `js/features/voice-transcribe.js` — lazy-imports `@xenova/transformers` (Whisper-tiny int8, ~40 MB), pipes 30 s IndexedDB audio chunks through ASR, stores transcript alongside audio in IndexedDB `voice-memories` store (`transcriptText`, `transcriptLang`, `transcribedAt`).
- `js/map/wheelchair-layer.js` — Leaflet layer reading `data/wheelmap-metro-index.json`, toggled from filters tab and a11y panel; step-free metro stations rendered as wheelchair-icon markers, keyboard-focusable.
- `js/features/color-blind-filter.js` — applies SVG filter on `<body>` via `filter: url(#daltonize-deut)`; filter definitions in inline SVG injected once.

### Data
- `data/wheelmap-metro-index.json` — per-city array of step-free metro/suburban stations. Schema: `{ city, country, stations: [{ id, name, lat, lon, line, stepFree: "yes"|"partial", lift: bool, source: "wheelmap"|"operator", verifiedOn }] }`. Target coverage: 25 cities at launch, aggregated from Wheelmap OSM snapshot + operator accessibility maps already linked in `data/accessibility.json`.

### Pages
- `pages/accessibility-demo.html` — standalone scripted walkthrough: skip-link, landmark nav, live region demo, toggle demo, NVDA + VoiceOver call-outs, video-less storyboard. Links from footer + `/more`.

### i18n
New key family `a11y.*` in all 6 locale files (EN, TR, DE, FR, ES, IT):
`a11y.panel.title`, `a11y.contrast.{default,aaa,dyslexia}`, `a11y.font.{system,opendyslexic,atkinson}`, `a11y.size.label`, `a11y.lineHeight.label`, `a11y.letterSpacing.label`, `a11y.reduceMotion`, `a11y.lowBandwidth.{label,help}`, `a11y.colorBlind.{none,prot,deut,trit}`, `a11y.wheelchair.layer`, `a11y.voice.transcribe.{label,help,download,ready,error}`, `a11y.demo.cta`, `a11y.reset`.

## 5. Third-party libraries

| Lib | CDN | Version | License | Notes |
|---|---|---|---|---|
| OpenDyslexic | `cdnjs.cloudflare.com/ajax/libs/opendyslexic/…/opendyslexic.woff2` | 0.91.12 | Bitstream Vera-derived, free redistribution | `font-display: swap`, lazy |
| Atkinson Hyperlegible | Google Fonts CDN | latest | OFL 1.1 | fallback dyslexia font |
| @xenova/transformers (Whisper-tiny int8) | `cdn.jsdelivr.net/npm/@xenova/transformers@2.17.x` | 2.17.x | Apache-2.0 | Opt-in only; verify CORS + COEP/COOP headers on Pages — fallback to jsDelivr `+esm` bundle |
| Color-blind filters | none (inline SVG `feColorMatrix`) | — | public domain | Daltonize matrices by Fidaner/Wong |

All licenses MIT/Apache/OFL-compatible with our MIT.

## 6. Service Worker cache additions

- **Precache:** OpenDyslexic woff2 (~50 KB), Atkinson (~30 KB), `a11y.css`, `a11y-lowbw.css`, `wheelmap-metro-index.json`, `accessibility-demo.html`.
- **Runtime cache (opt-in, on first enable):** Whisper-tiny model shards via `cache-first + stale-while-revalidate`, keyed under `a11y-whisper-v1`. Never precached. A visible "Download 40 MB speech model?" confirmation runs first; respects `navigator.connection.saveData` and `lowBandwidth` flag by refusing auto-download.

## 7. Low-bandwidth mode specifics

Toggle sets `<html data-lowbw="1">` + loads `css/a11y-lowbw.css`. Effects:
- GeoJSON swapped from full-resolution to simplified variant (already present as `data/countries-simplified.geojson`).
- Wikivoyage live-refresh, soundtrack preview, wrapped card canvas renders, heatmap tiles: deferred until explicit user action.
- `<img loading="lazy">` forced; hero illustrations become CSS solids.
- Initial JS budget target: ≤ 50 KB gzipped (measured via `scripts/bundle-size.sh` check — manual).

## 8. Reduced-motion dialect

In-app toggle independent of OS pref. When active: Leaflet `zoomAnimation:false, fadeAnimation:false, markerZoomAnimation:false`; all CSS transitions/animations disabled via `*{transition:none!important}`; Wrapped auto-advance disabled, manual next/prev only; confetti disabled.

## 9. Accessibility testing protocol

1. **Automated:** axe DevTools + Lighthouse a11y ≥ 98 on `/`, `/more`, `pages/accessibility-demo.html` per release.
2. **Manual keyboard:** tab through every tab of panel without mouse; verify no focus trap, skip-link first.
3. **Screen reader:** NVDA (Windows FF), VoiceOver (macOS Safari + iOS), TalkBack (Android Chrome) — smoke script in demo page.
4. **Contrast:** all text tokens in `css/a11y.css` measured ≥ 7:1 (AAA normal) / 4.5:1 (large), documented in `docs/a11y/contrast-report.md`.
5. **Dyslexia check:** British Dyslexia Association style-guide checklist (font, line-height ≥ 1.5, no justified text, amber/cream backgrounds available).
6. **Low-bandwidth:** Chrome DevTools Slow-3G + CPU 4× throttle — interactive ≤ 5 s.
7. **Voice transcription:** verify deaf/HoH path (audio → text) works offline after first model download; WER measured on 5 sample clips per supported lang.

## 10. Grant narrative mapping

| Feature | Erasmus+ / KA priority |
|---|---|
| WCAG AAA | Inclusion & Diversity — disability |
| Dyslexia mode | Inclusion — learning differences (~10 % of youth) |
| Low-bandwidth | Inclusion — rural/remote, economic obstacles (aligns with Rural Youth focus) |
| Wheelchair metro | Disability + Green (active mobility) |
| Voice transcription | Deaf/HoH inclusion + multilingual dimension |
| Reduce-motion | Cognitive + vestibular disabilities |
| Demo page | Transparency for assessors; DG EAC review-friendly |

## 11. Risks & mitigations

- **Whisper.wasm size (40 MB) + first-load latency.** Mitigation: strictly opt-in, explicit MB-sized confirm prompt, progress UI, cache-first after first download, never auto-trigger on low-bandwidth mode, WASM SIMD feature-detect with graceful fallback message.
- **COEP/COOP headers** required for SharedArrayBuffer on some Whisper builds — GitHub Pages does not set them. Mitigation: pick transformers.js build that runs without cross-origin isolation (single-thread WASM path); acceptance test before merge.
- **OpenDyslexic polarising opinions in dyslexia community.** Mitigation: offer Atkinson Hyperlegible as equal-weight alternative; cite BDA guidance in help text.
- **Color-blind SVG filter affecting map tiles.** Mitigation: apply filter to `<body>` except `.leaflet-tile-pane` (raster tiles stay untouched; vector overlays recolored).
- **localStorage quota** with settings + voice transcripts. Mitigation: transcripts live in IndexedDB not localStorage; a11y slice ≤ 1 KB.
- **AAA contrast may conflict with brand palette.** Mitigation: AAA is a mode, not the default; default stays AA-compliant brand palette.

## 12. Out of scope (v1.5)

Sign-language interpretation, braille export, server-side TTS, real-time external-audio captioning, full automated a11y CI gate, per-country wheelchair *bus* routing, Whisper on languages outside {en, tr, de, fr, es, it}.

---

**Approval gate:** architect + ui-designer sign-off before implementation plan is written.
