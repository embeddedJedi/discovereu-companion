# Phrasebook Video Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add curated YouTube pronunciation videos to the existing phrasebook. User clicks a phrase row, an inline `youtube-nocookie.com` player expands below it with a "Next video" cycle button. No API keys, no quotas.

**Architecture:** Extend existing `data/phrasebook/<lang>.json` entries with an optional `videos: string[]` array (YouTube IDs). Extend `js/ui/language-bridge-panel.js::renderPhraseRow()` to render a 🎬 button when `phrase.videos?.length > 0`. Clicking toggles an inline video player element that lives in the row, cycles through `videos[]` on "Next", and falls back to an external YouTube search link when no videos are curated. No new modules; no new modal. Existing country-detail → Language Bridge → Phrasebook tab flow is preserved.

**Tech Stack:** Vanilla ES modules, existing `h()` DOM helper, i18n via `t()`, design-system CSS tokens, `<iframe>` to `https://www.youtube-nocookie.com/embed/<id>`.

**Scope adjustment vs. spec:** The spec described a new full-screen modal triggered from the map popup. The existing codebase already implements that flow via `country-detail.js` → Language Bridge CTA → full panel with Phrasebook tab. Per CLAUDE.md ("follow existing patterns"), this plan enhances the existing tab instead of duplicating it. End-user UX matches the spec intent.

---

## File Structure

**Modified files:**
- `data/phrasebook/de.json` — add `videos` array to ~20 core phrases
- `data/phrasebook/fr.json` — same
- `data/phrasebook/it.json` — same
- `data/phrasebook/es.json` — same
- `data/phrasebook/tr.json` — same
- `data/SOURCES.md` — new "Phrasebook videos" section citing YouTube URLs
- `js/ui/language-bridge-panel.js` — extend `renderPhraseRow()` with video toggle + inline player
- `css/language-bridge.css` — new rules for `.lang-panel__video-*` classes (or the existing phrasebook stylesheet)
- `i18n/en.json`, `i18n/tr.json`, `i18n/de.json`, `i18n/fr.json`, `i18n/es.json`, `i18n/it.json` — add 5 new strings

**No new files.** No changes to `js/features/phrasebook.js` (its search/load/bookmark API is unchanged; new `videos` field is opaque to it).

---

## Task 1: Data schema — pick 20 core phrase IDs per language

**Files:**
- Read: `data/phrasebook/{de,fr,it,es,tr}.json`

- [ ] **Step 1: Identify the 20 "core" phrase IDs** that exist across all 5 JSON files.

Target IDs (must exist in all 5 files; if an ID differs in one file, note the equivalent):

```
greet-hello, greet-good-morning, greet-goodbye, greet-please, greet-thanks,
greet-sorry, greet-excuse-me, greet-yes, greet-no, greet-how-are-you,
num-1, num-2, num-3, num-5, num-10,
food-water, food-vegetarian,
dir-where-is, money-how-much, emerg-help
```

Run for each language:

```bash
for lang in de fr it es tr; do
  echo "=== $lang ==="
  grep -oE '"id": "[^"]+"' data/phrasebook/$lang.json | sort -u
done
```

Expected: confirm presence of the 20 IDs; note any language-specific renames and record them in a working scratch list (not committed).

- [ ] **Step 2: Commit the scratch list as a comment in SOURCES.md**

Add a new section to `data/SOURCES.md`:

```markdown
## Phrasebook videos

Core phrase set curated for video coverage (Phase C launch — de/fr/it/es/tr):

- greet-hello, greet-good-morning, greet-goodbye, greet-please, greet-thanks, greet-sorry, greet-excuse-me, greet-yes, greet-no, greet-how-are-you
- num-1, num-2, num-3, num-5, num-10
- food-water, food-vegetarian, dir-where-is, money-how-much, emerg-help

Videos are curated YouTube IDs embedded via youtube-nocookie.com. No API key.
Source URLs for each ID listed per language below.

### de (German)
<!-- filled in by Task 3 -->

### fr (French)
<!-- filled in by Task 3 -->

### it (Italian)
<!-- filled in by Task 3 -->

### es (Spanish)
<!-- filled in by Task 3 -->

### tr (Turkish)
<!-- filled in by Task 3 -->
```

```bash
git add data/SOURCES.md
git commit -m "docs(phrasebook): list core phrase IDs for video curation"
```

---

## Task 2: Add empty `videos: []` to every phrase in all 5 JSON files (schema bump)

**Files:**
- Modify: `data/phrasebook/{de,fr,it,es,tr}.json`

**Rationale:** Every phrase gets the field even if empty. The UI reads `phrase.videos?.length > 0` so an empty array keeps the existing row behavior unchanged. A missing field would work too, but a consistent schema simplifies future curation.

- [ ] **Step 1: Write a small Node one-liner to patch each JSON file.** (Keep it out of the repo.)

Run from repo root:

```bash
node -e "
const fs = require('fs');
for (const lang of ['de','fr','it','es','tr']) {
  const path = 'data/phrasebook/' + lang + '.json';
  const d = JSON.parse(fs.readFileSync(path, 'utf8'));
  for (const p of d.phrases) {
    if (!Array.isArray(p.videos)) p.videos = [];
  }
  fs.writeFileSync(path, JSON.stringify(d, null, 2) + '\n');
  console.log(lang, 'patched', d.phrases.length, 'phrases');
}
"
```

Expected output: `de patched NN phrases` for each of 5 languages.

- [ ] **Step 2: Visually spot-check one phrase in each file**

```bash
grep -A1 '"greet-hello"' data/phrasebook/de.json | head -3
```

Expected: the phrase object now ends with `, "videos": [] }` or similar.

- [ ] **Step 3: Commit**

```bash
git add data/phrasebook/
git commit -m "feat(phrasebook): add empty videos[] field to all phrases"
```

---

## Task 3: Curate ~20 YouTube video IDs per language + populate JSON

**Files:**
- Modify: `data/phrasebook/{de,fr,it,es,tr}.json`
- Modify: `data/SOURCES.md`

**Agent:** Use the `data-curator` agent for this task. It has WebFetch + WebSearch and is the right tool for research-driven data population.

- [ ] **Step 1: Dispatch data-curator with this brief**

Prompt (hand to agent verbatim):

> "Populate the `videos` array for the 20 core phrase IDs listed in `data/SOURCES.md` under 'Phrasebook videos' across all 5 phrasebook JSON files (`data/phrasebook/{de,fr,it,es,tr}.json`).
>
> For each (language, phrase) pair, find 2–3 YouTube videos that clearly teach or pronounce the target-language phrase. Prefer: Easy Languages, Learn[Language]with…, short native-speaker clips under 60 seconds. Avoid: music, age-gated, removed, or unrelated content.
>
> For each chosen video: (a) confirm it loads at `https://www.youtube-nocookie.com/embed/<id>` (no region lock), (b) extract the 11-char YouTube ID, (c) add it to that phrase's `videos` array in the JSON.
>
> For each ID added, append a line under the correct language section of `data/SOURCES.md` in the format: `- greet-hello: https://youtu.be/<id> — channel name (duration)`.
>
> Do not modify any other phrase fields. Do not add videos to non-core phrases. Preserve existing JSON ordering and 2-space indentation with a trailing newline."

- [ ] **Step 2: Verify each JSON file is still valid**

```bash
for lang in de fr it es tr; do node -e "JSON.parse(require('fs').readFileSync('data/phrasebook/$lang.json'))" && echo "$lang ok"; done
```

Expected: `de ok`, `fr ok`, … (5 lines).

- [ ] **Step 3: Verify ~20 phrases per language have non-empty videos**

```bash
for lang in de fr it es tr; do
  n=$(node -e "const d=require('./data/phrasebook/$lang.json'); console.log(d.phrases.filter(p=>p.videos&&p.videos.length>0).length)")
  echo "$lang: $n phrases with videos"
done
```

Expected: each language reports 18–22 phrases with videos (target 20, small variance OK).

- [ ] **Step 4: Commit**

```bash
git add data/phrasebook/ data/SOURCES.md
git commit -m "feat(phrasebook): curate 2-3 YouTube videos per core phrase (5 languages)"
```

---

## Task 4: i18n strings

**Files:**
- Modify: `i18n/en.json`, `i18n/tr.json`, `i18n/de.json`, `i18n/fr.json`, `i18n/es.json`, `i18n/it.json`

- [ ] **Step 1: Add 5 keys under `lang.phrasebook.*`**

Open each i18n file, find the `lang.phrasebook.*` block (it contains `search`, `empty`, `bookmarkAdd`, etc.), and add:

```json
"videoPlay": "Play pronunciation video",
"videoNext": "Next video",
"videoClose": "Close video",
"videoSearchYoutube": "Search on YouTube",
"videoUnavailable": "No video yet — search YouTube"
```

Translations (use these exact values):

| key | en | tr | de | fr | es | it |
|---|---|---|---|---|---|---|
| videoPlay | Play pronunciation video | Telaffuz videosunu oynat | Aussprachevideo abspielen | Lire la vidéo de prononciation | Reproducir vídeo de pronunciación | Riproduci video di pronuncia |
| videoNext | Next video | Sonraki video | Nächstes Video | Vidéo suivante | Siguiente vídeo | Video successivo |
| videoClose | Close video | Videoyu kapat | Video schließen | Fermer la vidéo | Cerrar vídeo | Chiudi video |
| videoSearchYoutube | Search on YouTube | YouTube'da ara | Auf YouTube suchen | Rechercher sur YouTube | Buscar en YouTube | Cerca su YouTube |
| videoUnavailable | No video yet — search YouTube | Video henüz yok — YouTube'da ara | Noch kein Video — auf YouTube suchen | Pas encore de vidéo — rechercher sur YouTube | Aún sin vídeo — buscar en YouTube | Nessun video — cerca su YouTube |

- [ ] **Step 2: Validate JSON**

```bash
for lang in en tr de fr es it; do node -e "JSON.parse(require('fs').readFileSync('i18n/$lang.json'))" && echo "$lang ok"; done
```

Expected: 6 `ok` lines.

- [ ] **Step 3: Commit**

```bash
git add i18n/
git commit -m "i18n(phrasebook): add video-layer strings (5 keys, 6 locales)"
```

---

## Task 5: CSS for inline video panel

**Files:**
- Modify: `css/language-bridge.css` (or whichever stylesheet the Language Bridge panel uses — grep `lang-panel__phrase-row` to confirm)

- [ ] **Step 1: Confirm target stylesheet**

```bash
grep -rln "lang-panel__phrase-row" css/
```

Expected: one file. Use that file for the new rules.

- [ ] **Step 2: Append the following rules** to the end of that CSS file:

```css
/* --- Phrasebook video layer (Phase C) --------------------------------- */

.lang-panel__phrase-row {
  flex-direction: column;
  align-items: stretch;
}

.lang-panel__phrase-row-main {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  width: 100%;
}

.lang-panel__phrase-row-main > .lang-panel__phrase-text {
  flex: 1 1 auto;
}

.lang-panel__btn--video {
  font-size: 1.1em;
  line-height: 1;
  padding: var(--space-1) var(--space-2);
}

.lang-panel__btn--video[aria-expanded="true"] {
  background: var(--accent-soft, var(--bg-subtle));
}

.lang-panel__video {
  margin-top: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border-top: 1px solid var(--border-subtle);
  padding-top: var(--space-2);
}

.lang-panel__video-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--bg-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.lang-panel__video-frame iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.lang-panel__video-controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--text-sm);
}

.lang-panel__video-counter {
  margin-left: auto;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.lang-panel__video-fallback {
  padding: var(--space-2);
  color: var(--text-muted);
  font-size: var(--text-sm);
}
```

Notes:
- All tokens must already exist in `css/design-system.css`. If `--accent-soft` doesn't exist, the fallback `var(--bg-subtle)` handles it.
- `aspect-ratio: 16/9` is widely supported and avoids the padding-top hack.

- [ ] **Step 3: Commit**

```bash
git add css/
git commit -m "style(phrasebook): inline video panel styles"
```

---

## Task 6: Extend `renderPhraseRow()` with video toggle + player

**Files:**
- Modify: `js/ui/language-bridge-panel.js` (around lines 653–681)

- [ ] **Step 1: Replace the existing `renderPhraseRow` with this version**

Locate `function renderPhraseRow(phrase, targetLangCode, cc)` at approximately line 653. Replace the entire function body (lines 653–681) with:

```javascript
  function renderPhraseRow(phrase, targetLangCode, cc) {
    const srcId = `lang-src-${phrase.id}`;
    const hasVideo = Array.isArray(phrase.videos) && phrase.videos.length > 0;

    // Per-row state: which video index is currently showing, and whether
    // the player panel is open. Closures keep this local to the row.
    let videoIndex = 0;
    let videoOpen = false;

    const videoHost = h('div', {
      class: 'lang-panel__video',
      hidden: true
    });

    const videoBtn = h('button', {
      type: 'button',
      class: 'lang-panel__btn lang-panel__btn--ghost lang-panel__btn--video',
      'aria-label': t('lang.phrasebook.videoPlay'),
      'aria-expanded': 'false',
      'data-action': 'toggle-video'
    }, hasVideo ? '🎬' : '🔎');

    const row = h('li', {
      class: 'lang-panel__phrase-row',
      'aria-describedby': srcId
    }, [
      h('div', { class: 'lang-panel__phrase-row-main' }, [
        h('div', { class: 'lang-panel__phrase-text' }, [
          h('p', { class: 'lang-panel__phrase-src', id: srcId, lang: 'en' }, phrase.source),
          h('p', { class: 'lang-panel__phrase-tgt', lang: targetLangCode }, phrase.target),
          phrase.audioHint
            ? h('p', { class: 'lang-panel__phrase-hint' }, phrase.audioHint)
            : null
        ]),
        videoBtn,
        h('button', {
          type: 'button',
          class: 'lang-panel__btn lang-panel__btn--ghost',
          'aria-label': t('lang.phrasebook.bookmarkAdd'),
          'data-action': 'save-phrase'
        }, t('lang.phrasebook.bookmarkAdd'))
      ]),
      videoHost
    ]);

    row.querySelector('[data-action="save-phrase"]').addEventListener('click', async () => {
      try {
        await bookmarkPhrase(phrase, cc);
      } catch (_) { /* state subscription will rerender; ignore here */ }
    });

    videoBtn.addEventListener('click', () => {
      videoOpen = !videoOpen;
      videoBtn.setAttribute('aria-expanded', String(videoOpen));
      if (videoOpen) {
        videoHost.hidden = false;
        renderVideoPanel();
      } else {
        videoHost.hidden = true;
        empty(videoHost); // stops iframe playback
      }
    });

    function renderVideoPanel() {
      empty(videoHost);
      if (!hasVideo) {
        videoHost.appendChild(renderVideoFallback(phrase, targetLangCode));
        return;
      }
      const id = phrase.videos[videoIndex];
      const frame = h('div', { class: 'lang-panel__video-frame' }, [
        h('iframe', {
          src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`,
          title: `${phrase.target} — ${phrase.source}`,
          loading: 'lazy',
          referrerpolicy: 'no-referrer',
          allow: 'encrypted-media; picture-in-picture',
          allowfullscreen: ''
        })
      ]);

      const controls = h('div', { class: 'lang-panel__video-controls' }, [
        phrase.videos.length > 1
          ? h('button', {
              type: 'button',
              class: 'lang-panel__btn lang-panel__btn--ghost',
              'data-action': 'next-video'
            }, t('lang.phrasebook.videoNext'))
          : null,
        h('a', {
          class: 'lang-panel__btn lang-panel__btn--ghost',
          href: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
          target: '_blank',
          rel: 'noopener noreferrer'
        }, t('lang.phrasebook.videoSearchYoutube')),
        h('span', {
          class: 'lang-panel__video-counter',
          'aria-live': 'polite'
        }, `${videoIndex + 1} / ${phrase.videos.length}`)
      ]);

      const nextBtn = controls.querySelector('[data-action="next-video"]');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          videoIndex = (videoIndex + 1) % phrase.videos.length;
          renderVideoPanel();
        });
      }

      videoHost.appendChild(frame);
      videoHost.appendChild(controls);
    }

    return row;
  }

  function renderVideoFallback(phrase, targetLangCode) {
    const query = encodeURIComponent(`${phrase.target} pronunciation`);
    const url = `https://www.youtube.com/results?search_query=${query}`;
    return h('div', { class: 'lang-panel__video-fallback' }, [
      h('p', {}, t('lang.phrasebook.videoUnavailable')),
      h('a', {
        class: 'lang-panel__btn lang-panel__btn--ghost',
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
        lang: targetLangCode
      }, t('lang.phrasebook.videoSearchYoutube'))
    ]);
  }
```

**Notes:**
- `empty()` is already imported from `../utils/dom.js` (line 22). No new imports needed.
- `t()` is already imported (line 23).
- The iframe uses `youtube-nocookie.com` (privacy-friendly) and `rel=0` to suppress unrelated recommendations.
- Setting `videoHost.hidden = true` and emptying it fully unmounts the iframe — this stops playback cleanly without a `postMessage` call.

- [ ] **Step 2: Manually smoke-test in the browser**

Open `index.html` directly in Chrome/Firefox. Pick a seeded country (e.g. Germany):

1. Click Germany on the map → country-detail panel opens.
2. Scroll to "Language Bridge" CTA → click to open the full panel.
3. Confirm Phrasebook tab is active.
4. Find a core phrase with a curated video (e.g. "Hello → Hallo"). Verify 🎬 button appears.
5. Click 🎬 → iframe loads, video is playable, "Next video" cycles if >1 ID, counter updates.
6. Click 🎬 again → panel collapses, audio stops.
7. Find a non-core phrase (no videos). Verify 🔎 button appears; clicking opens YouTube-search fallback link.
8. Tab through the row with keyboard — all three buttons reachable, focus rings visible.
9. Resize to 375px — layout stacks cleanly.
10. Toggle dark/light theme — colors follow design tokens.

If any step fails, fix before committing.

- [ ] **Step 3: Commit**

```bash
git add js/ui/language-bridge-panel.js
git commit -m "feat(phrasebook): inline YouTube video player per phrase row"
```

---

## Task 7: Update PROGRESS.md + push

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Add an entry**

Append under the appropriate "Done" section (look for v1.7 Language Bridge or create a new v1.2+ block):

```markdown
- **Phrasebook video layer (Phase C)** — shipped 2026-04-14. Each phrase row in the Language Bridge phrasebook tab now offers a 🎬 button that expands an inline `youtube-nocookie.com` player; 2–3 curated YouTube IDs per ~20 core phrases across de/fr/it/es/tr. No API key, no quota. Phrases without curated videos show a 🔎 fallback that opens a YouTube search in a new tab. Spec: `docs/superpowers/specs/2026-04-14-phrasebook-video-layer-design.md`. Plan: `docs/superpowers/plans/2026-04-14-phrasebook-video-layer.md`.
```

- [ ] **Step 2: Commit + push**

```bash
git add PROGRESS.md
git commit -m "docs(progress): phrasebook video layer (Phase C) shipped"
git push origin main
```

Expected: push succeeds; GitHub Pages redeploys automatically.

---

## Phase 2 (out of scope, deferred)

- nl / pl / pt / ro / el / cs phrasebooks + videos → covers ~15 countries.
- Full 33-country coverage with multi-language countries (BE, CH, LU) using a sub-language picker.
- User-submitted video IDs (needs moderation).
- SW cache prefetch of the first video per phrase for offline use.
