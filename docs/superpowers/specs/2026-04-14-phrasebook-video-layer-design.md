# Phrasebook Video Layer — Design

**Date:** 2026-04-14
**Status:** Approved, ready for implementation plan
**Scope:** Phase C — start with existing 5 languages (de/es/fr/it/tr), expand later.

---

## Goal

Let users click a country on the map, open a phrasebook modal, pick a phrase, and watch a short native-speaker video of that phrase. No API keys, no quotas, no user setup. Curated YouTube IDs embedded via `youtube-nocookie.com`.

## Non-Goals

- Live YouTube search (no API, no keys).
- All 33 countries in v1 (explicitly deferred to Phase 2/3).
- Offline video playback (iframe requires network).
- Recording or uploading user audio.

## Data model

Extend existing `data/phrasebook/<lang>.json` entries with a `videos` array:

```json
{
  "id": "hello",
  "en": "Hello",
  "tr": "Merhaba",
  "native": "Hallo",
  "ipa": "/ˈha.lo/",
  "videos": ["dQw4w9WgXcQ", "abc123xyz"]
}
```

- `videos`: array of YouTube video IDs (2–3 per phrase), curated.
- Empty array allowed → UI falls back to "Search on YouTube →" link.
- Schema change is additive; existing phrasebook consumers unaffected.

## Country → language mapping

- `data/countries.json` gets a `primary_language` field (ISO 639-1) where missing.
- Mapping table used by the popup button:
  - `de` → DE, AT (+ CH partial)
  - `fr` → FR, BE, LU (+ CH partial)
  - `es` → ES
  - `it` → IT (+ CH partial)
  - `tr` → TR
- Multi-language countries (BE, CH, LU): pick one primary for v1; note in data SOURCES.md.
- Countries without a supported language → button rendered disabled with "Coming soon" tooltip.

## UX flow

1. User clicks a country on the map.
2. Existing country popup gains a **🗣️ Phrasebook** button (disabled + tooltip if unsupported).
3. Click → full-screen modal opens (reusing existing modal pattern, e.g. consulate/crisis-shield modal).
4. Modal contents:
   - Header: flag + language name (e.g. "🇩🇪 Deutsch")
   - Search input filters the phrase list live (matches native + translation + en).
   - Phrase grid: each card shows `native` (large), translation, IPA, and 🎬 icon if videos exist.
   - Click card → video panel slides in below with a `youtube-nocookie.com` iframe.
   - Controls under iframe: **"Next video →"** (cycles `videos[]`), **"Open on YouTube ↗"**, **"Close"**.
   - If `videos` empty → instead of iframe, show "Search on YouTube →" link opening `https://www.youtube.com/results?search_query=<native>+pronunciation` in new tab.
5. Modal closes via ✕, ESC, or backdrop click.

## Components & files

**New / modified:**

- `data/phrasebook/{de,es,fr,it,tr}.json` — add `videos` field to each entry (curated).
- `data/countries.json` — ensure `primary_language` exists for all 33.
- `js/features/phrasebook.js` — extend: add `openPhrasebookModal(langCode)`, render grid, video switcher, search filter.
- `js/map/countries-layer.js` — inject "Phrasebook" button into popup HTML, wire click → `openPhrasebookModal()`.
- `css/phrasebook.css` (new or extend) — modal layout, card grid, video panel; use design-system tokens only.
- `i18n/*.json` — add strings: `phrasebook.title`, `phrasebook.search`, `phrasebook.nextVideo`, `phrasebook.noVideo`, `phrasebook.comingSoon`, `phrasebook.openOnYoutube`.

**Unchanged but consulted:**

- Existing modal/overlay pattern (mirror whichever crisis-shield or consulate uses).
- `css/design-system.css` tokens for colors, spacing, radii.

## Data flow

```
countries-layer.js (popup click)
        │
        ▼
phrasebook.js::openPhrasebookModal(langCode)
        │
        ├─► fetch data/phrasebook/<langCode>.json  (cached after first load)
        │
        ├─► render modal (grid + search)
        │
        └─► onPhraseClick(phrase)
                ├─► if phrase.videos.length > 0
                │     └─► mount iframe src=https://www.youtube-nocookie.com/embed/<id>
                │           (index state per phrase; "Next" increments modulo length)
                │
                └─► else
                      └─► render external search link
```

## Accessibility

- Modal: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` → header id.
- Focus trapped in modal; ESC closes; return focus to popup button on close.
- Search input labelled via `aria-label` (i18n string).
- Phrase cards are real `<button>` elements; keyboard navigable; Enter/Space triggers.
- iframe has `title` attribute with the phrase for screen readers.
- Video controls ("Next", "Close") are buttons with visible labels, not icon-only.

## Responsive

- ≥768px: modal max-width 960px, 3-column phrase grid, video panel to the right of grid.
- <768px: full-screen modal, 1-column stack, video panel appears below grid (scrolls into view).
- Tested at 375 / 768 / 1440.

## Theming

All colors via design-system CSS variables (`--bg-card`, `--text-primary`, `--accent`, etc.). Works in dark + light automatically. No hardcoded hex values.

## Error handling

- Phrasebook JSON fetch fails → modal shows a localized error message with Retry button; does not crash map.
- Invalid/removed YouTube ID → iframe shows YouTube's own error frame; "Next video" still works to skip.
- Country without `primary_language` → button disabled (never a runtime error).

## Video curation (data-curator workflow)

For each of de / es / fr / it / tr:

1. Pick ~20 core phrases already in the JSON (greetings, politeness, emergencies, directions, prices, food, transport, thanks, numbers 1–10).
2. Search YouTube for each phrase in target language + "pronunciation" or "how to say".
3. Prefer channels: Easy Languages, Learn [Language] with…, native-speaker educators, short (<60s) clips.
4. Pick 2–3 stable video IDs per phrase. Skip videos with age-gate, music, or removed status.
5. Record source URL for each ID in `data/SOURCES.md` under a new "Phrasebook videos" section.
6. Update `data/phrasebook/<lang>.json` with `videos` arrays.

## Testing

- Manual: open each of 5 languages, verify modal opens, search filters, each phrase plays a video, "Next video" cycles, external link fallback works for phrases with empty `videos`.
- Viewport test: 375 / 768 / 1440.
- Theme test: dark + light.
- Keyboard-only test: Tab through phrases, Enter plays, ESC closes, focus returns.
- Unsupported country click (e.g. Poland): button disabled with tooltip.

## Out of scope / future

- Phase 2: add nl, pl, pt, ro, el, cs phrasebooks + videos → covers ~15 countries.
- Phase 3: full 33-country coverage incl. multi-language countries with sub-language picker.
- Future: user-submitted video IDs (moderation needed), offline caching via SW.

## Open questions — RESOLVED

- Scope: Phase C (5 languages first). ✓
- Entry point: popup button → full-screen modal. ✓
- No user API keys. ✓
