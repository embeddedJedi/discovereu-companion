# v1.7 Language Bridge — Design Spec

**Date:** 2026-04-13
**Sub-project:** v1.7 (Pivot, KA220 Digital + Inclusion + Participation)
**Status:** Draft — awaiting review

## 1. Goal

Give DiscoverEU travellers a pocket translator that works offline-first, respects privacy, and lowers the language barrier for youth with fewer opportunities. Three modes: **OCR** (point camera at sign/menu), **Phrasebook** (offline curated deck), **Voice** (speak → translate → speak back).

## 2. Data model — `state.language` slice

```js
state.language = {
  ocrLang: 'eng',              // tesseract lang code
  ocrTargetLang: 'en',         // user's UI lang
  voiceOn: false,              // opt-in toggle
  voiceRate: 1.0,              // slow-mode aware (0.7 when slow-mode)
  savedPhrases: [],            // [{id, src, dst, srcLang, dstLang, country, ts}]
  lastCountry: null,
  consent: { camera: false, mic: false },
  translationProvider: 'llm'   // 'llm' | 'offline-dict'
};
```

Persistence: `savedPhrases` → IndexedDB (`phrasebook-deck` store); rest → LocalStorage.

## 3. New modules

| File | Responsibility |
|---|---|
| `js/features/ocr.js` | Lazy-load tesseract, run recognize, return text + bbox |
| `js/features/translate.js` | Unified adapter: offline-dict first → LLM fallback |
| `js/features/phrasebook.js` | Load `data/phrasebook/{country}.json`, search, bookmark |
| `js/features/voice-bridge.js` | Whisper STT → translate → `speechSynthesis.speak()` |
| `js/ui/language-bridge-panel.js` | Tabbed panel: Camera / Phrasebook / Voice / Saved |
| `js/ui/consent-dialog.js` | Reusable camera/mic consent modal |

Reuses: `voice-transcribe.js` (v1.5), `llm-adapter.js`, `emergency-phrases.json` as seed.

## 4. Data files

- `data/phrasebook/{countryId}.json` — one file per route-country, ~200 phrases, grouped: greetings, transport, food, emergency, accommodation, culture. Schema:
```json
{
  "country": "it",
  "language": "it",
  "phrases": [
    {"id":"greet.hello","cat":"greetings","src":"Hello","dst":"Ciao","ipa":"/ˈtʃa.o/","audio":null}
  ]
}
```
- `data/phrasebook/_index.json` — country → file map for lazy loading.
- Curation seeded from `emergency-phrases.json` + Wikivoyage phrasebooks (CC-BY-SA attribution in footer).

## 5. CDN libs

- `tesseract.js@5` via jsdelivr (lazy `import()` on first OCR use)
- Tesseract language packs: selective download per route country (eng, ita, fra, deu, spa, ell, pol, ron, tur, etc.) — cached in IDB, ~2–10MB each
- Web Speech API (`SpeechSynthesis`) — native, no lib
- Whisper reuses v1.5 pipeline

## 6. Permissions UX

- Camera/mic **never** requested on panel open. Only on explicit button tap.
- `consent-dialog.js` shows plain-language explainer ("We will use your camera once to read text. No image leaves your device.") with Accept / Decline / Learn more.
- Decision stored in `state.language.consent`; revocable in Settings.

## 7. Offline-first guarantee

- Phrasebook JSON for all route countries precached by SW on route-save (`cache-phrasebook-v1`).
- Tesseract core + active language pack cached on first successful OCR (`cache-ocr-v1`).
- Offline dict translation (phrasebook fuzzy match) always available; LLM only when online + key set.

## 8. Privacy

- OCR: image frame processed in-browser via tesseract WASM; pixels never transmitted.
- Voice: Whisper runs via user-provided key (same as v1.5); clearly labelled "audio sent to <provider>".
- Saved phrases stored locally only; exportable as JSON.
- Privacy notice in panel header with link to full policy.

## 9. SW cache additions

| Cache | Strategy | Size budget |
|---|---|---|
| `cache-phrasebook-v1` | Cache-first, precached on route save | ~1MB (33 countries) |
| `cache-ocr-core-v1` | Cache-first, lazy on first OCR | ~11MB (tesseract core) |
| `cache-ocr-lang-v1` | Cache-first, per lang on demand | 2–10MB per lang |

SW warns user before first OCR download ("This will use ~13MB. Continue?").

## 10. i18n keys

Family `language.*`:
- `language.panel.title`, `language.tab.{camera,phrasebook,voice,saved}`
- `language.consent.{camera,mic}.{title,body,accept,decline}`
- `language.ocr.{capture,processing,noText,tryAgain}`
- `language.voice.{listening,translating,speak,slowMode}`
- `language.phrasebook.{search,category,bookmark,noResults}`
- `language.privacy.notice`

Five locales (en, tr, de, fr, es) as per project baseline.

## 11. Accessibility (WCAG AAA targets)

- TTS output always paired with on-screen subtitle + IPA pronunciation.
- Camera overlay: 7:1 contrast guide frame, haptic `navigator.vibrate(50)` on successful capture.
- All tabs keyboard reachable; live-region announcements for OCR/translation results.
- Slow-mode: voiceRate=0.7, phrasebook shows syllable splits.
- Dyslexia-friendly font option (reuse existing toggle).
- Screen-reader-friendly: detected OCR text rendered as selectable `<p>`, not canvas.

## 12. Grant narrative mapping

- **KA220 Digital** — offline-first WASM OCR, PWA, no-backend privacy architecture, open source.
- **Inclusion** — breaks language barrier for youth with fewer opportunities (non-native speakers, rural applicants); AAA accessibility; works on low-end Android.
- **Participation** — enables intercultural encounter by making spontaneous conversation viable; supports active European citizenship.

## 13. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Tesseract accuracy on stylised menus | Show confidence score, allow manual edit before translate |
| Language-pack size on mobile data | Explicit opt-in, Wi-Fi-only suggestion, per-lang granularity |
| LLM rate-limit / no key | Offline dict fallback always works |
| Battery drain (camera + WASM) | Single-shot capture, not continuous video |
| Cultural mistranslation (register, idiom) | Curated phrasebook reviewed by native speakers; LLM prompt includes politeness context |
| Whisper cost for voice mode | Opt-in, 30s cap per turn, shows token/cost estimate |

## 14. Out of scope (v1.7)

- Real-time video translation (AR overlay)
- Handwriting recognition
- Image-to-image stylised translation (sign repaint)
- Conversation mode with diarisation
- Custom TTS voices

## 15. Deliverables checklist

- [ ] 4 JS feature modules + 1 UI panel + 1 consent dialog
- [ ] 33 phrasebook JSONs + index
- [ ] SW cache buckets + size-warning prompt
- [ ] i18n keys in 5 locales
- [ ] Privacy notice copy reviewed
- [ ] AAA audit pass
- [ ] PROGRESS.md v1.7 section updated
