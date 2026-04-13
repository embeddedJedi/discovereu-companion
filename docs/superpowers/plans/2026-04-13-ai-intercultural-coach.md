# AI Intercultural Coach (v1.6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship a per-country 5-minute intercultural micro-lesson layer that LLM-composes from existing curated JSON, grades learners via a 5-MCQ quiz (≥4/5 pass), and mints a downloadable **OpenBadge 2.0 JSON-LD assertion** the learner can upload manually to their Europass profile. No backend. Lessons + badges cached in IndexedDB. Accessible (WCAG AAA), i18n-ready, offline-first once cached.

**Spec (authoritative — do NOT redesign):** [`docs/superpowers/specs/2026-04-13-ai-intercultural-coach-design.md`](../specs/2026-04-13-ai-intercultural-coach-design.md)

**Reference plans (format):**
- [`docs/superpowers/plans/2026-04-13-crisis-shield.md`](2026-04-13-crisis-shield.md)
- [`docs/superpowers/plans/2026-04-13-impact-dashboard.md`](2026-04-13-impact-dashboard.md)

**Architecture summary:** One new state slice (`state.coach`). Two new IndexedDB stores (`coachLessons`, `coachBadges`). Five new JS modules under `js/features/` + one under `js/ui/`. One generator script under `scripts/`. Static hosted `/badges/issuer.json` + `/badges/classes/*.json` (33 files) served from GitHub Pages — **this is load-bearing for OpenBadge 2.0 HostedBadge verification**. i18n additions (en + tr). SW precache bump (v9 → v10). Integration into `js/ui/country-detail.js` + new `/coach` route.

**Decision (locked by spec §7 Option A):** client-side OpenBadge 2.0 Assertion generation with `verification.type = "HostedBadge"` resolving BadgeClass + Issuer via public GitHub Pages URLs. No signing. No backend. No server-side Europass submission.

**Tech stack:** Vanilla ES modules, `h()` DOM helper (never innerHTML with interpolated content), CDN-only dependencies, LocalStorage for `state.coach`, IndexedDB for lesson + badge blobs, no test runner — browser-console smoke assertions per task.

**i18n path:** `js/i18n/i18n.js`. Source files live in `i18n/*.json`.

**Reuses:** `flowchart-runner.js` (v1.3) for quiz DAG walk; `llm-adapter.js` JSON mode; existing `storage.js` IndexedDB helpers.

---

## Task 1: State slice `state.coach` + persistence

**Files:**
- Modify: `js/state.js` (add slice, PERSIST_KEYS whitelist, migration)

- [ ] **Step 1: Extend default state.** In `js/state.js` add:

```js
coach: {
  lessonsCompleted: { /* [countryId]: { completedAt, passed, score } */ },
  quizScores:       { /* [countryId]: lastScore */ },
  badgesEarned:     [ /* { countryId, badgeId, issuedAt, jsonLdHash } */ ],
  flags:            { /* [countryId]: reasonText */ }
}
```

- [ ] **Step 2: Add `"coach"` to `PERSIST_KEYS`** so the slice is LocalStorage-hydrated on boot.

- [ ] **Step 3: Migration.** If persisted state lacks `coach`, initialise it. If `coach.badgesEarned` is missing, seed `[]`. Never throw on old shapes.

- [ ] **Step 4: Exports.** `setCoachLessonCompleted(countryId, {passed, score})`, `setCoachQuizScore(countryId, score)`, `addCoachBadge(record)`, `flagCoachLesson(countryId, reason)`. Each mutates state and dispatches the existing state-changed event.

- [ ] **Step 5: Browser smoke**

```js
const s = await import('./js/state.js');
s.setCoachQuizScore('FR', 5);
s.setCoachLessonCompleted('FR', { passed: true, score: 5 });
s.addCoachBadge({ countryId: 'FR', badgeId: 'urn:uuid:test', issuedAt: new Date().toISOString(), jsonLdHash: 'abc' });
console.assert(s.getState().coach.lessonsCompleted.FR.passed, 'lesson not marked');
console.assert(s.getState().coach.badgesEarned.length === 1, 'badge not recorded');
location.reload(); // then re-check: state.coach must survive reload
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/state.js
git commit -m "feat(v1.6): state.coach slice — lessons, quiz scores, badges earned"
```

---

## Task 2: IndexedDB stores — `coachLessons` + `coachBadges`

**Files:**
- Modify: `js/utils/storage.js` (open-DB migration)

- [ ] **Step 1: Bump DB version** in `storage.js`. In `onupgradeneeded`, create two stores if missing:

```js
if (!db.objectStoreNames.contains('coachLessons')) {
  db.createObjectStore('coachLessons', { keyPath: 'key' }); // key = `${countryId}:${lang}`
}
if (!db.objectStoreNames.contains('coachBadges')) {
  db.createObjectStore('coachBadges',  { keyPath: 'badgeId' });
}
```

- [ ] **Step 2: Helpers.** Export `putLesson(key, record)`, `getLesson(key)`, `deleteLesson(key)`, `putBadge(record)`, `getBadge(badgeId)`, `listBadges()`. Each wraps the existing promisified IDB transaction helper.

- [ ] **Step 3: Browser smoke**

```js
const s = await import('./js/utils/storage.js');
await s.putLesson('FR:en', { key: 'FR:en', lesson: { greetings: {} }, generatedAt: Date.now(), modelId: 'test' });
const l = await s.getLesson('FR:en');
console.assert(l?.modelId === 'test', 'lesson roundtrip failed');
await s.putBadge({ badgeId: 'urn:uuid:1', countryId: 'FR', json: { '@context': 'x' } });
console.assert((await s.listBadges()).length >= 1, 'listBadges broken');
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add js/utils/storage.js
git commit -m "feat(v1.6): IndexedDB stores coachLessons + coachBadges with helpers"
```

---

## Task 3: i18n — `coach.*` keys (en + tr)

**Files:**
- Modify: `i18n/en.json` (source of truth)
- Modify: `i18n/tr.json`
- Flag as followup: `de.json`, `fr.json`, `es.json`, `it.json` (deferred — log in PROGRESS.md §7)

- [ ] **Step 1: Add ~25 `coach.*` leaves** (spec §10):
  - `coach.title`, `coach.start`, `coach.refresh`, `coach.offlineUnavailable`, `coach.noKey`, `coach.uncertain`, `coach.sources`
  - `coach.section.greetings`, `coach.section.food`, `coach.section.social`, `coach.section.money`, `coach.section.culture`
  - `coach.quiz.start`, `coach.quiz.q`, `coach.quiz.correct`, `coach.quiz.wrong`, `coach.quiz.passed`, `coach.quiz.failed`, `coach.quiz.retry`, `coach.quiz.score`
  - `coach.badge.earned`, `coach.badge.export`, `coach.badge.hashEmail`, `coach.badge.skipEmail`, `coach.badge.uploadEuropass`

- [ ] **Step 2: Turkish translations** in `i18n/tr.json`. Preserve key paths exactly.

- [ ] **Step 3: Browser smoke**

```js
const [en, tr] = await Promise.all(['en','tr'].map(l => fetch(`i18n/${l}.json`).then(r=>r.json())));
const mustHave = ['coach.title','coach.section.greetings','coach.quiz.passed','coach.badge.export','coach.badge.uploadEuropass','coach.uncertain'];
const missEn = mustHave.filter(k => !k.split('.').reduce((a,p)=>a?.[p], en));
const missTr = mustHave.filter(k => !k.split('.').reduce((a,p)=>a?.[p], tr));
console.assert(!missEn.length, 'en missing: ' + missEn);
console.assert(!missTr.length, 'tr missing: ' + missTr);
console.log('OK');
```

- [ ] **Step 4: Commit**

```bash
git add i18n/en.json i18n/tr.json
git commit -m "feat(v1.6): i18n keys coach.* (en + tr); de/fr/es/it deferred"
```

---

## Task 4: Prompt builder — `js/features/coach-prompt.js`

**Files:**
- Create: `js/features/coach-prompt.js`

- [ ] **Step 1: Pure function exports.**

```js
export async function buildContextBlock(countryId);
// returns { phrases, guide, pickpocket, soundtracks, country } — fetched from /data/*.json
export function buildCoachPrompt({ countryId, lang, context });
// returns { system, user } strings — no network, no side effects
```

- [ ] **Step 2: Data assembly** reads these existing files (spec §3 table):
  - `data/countries.json` → currency, cashHeavy
  - `data/emergency-phrases.json` → greeting/thanks/help sets
  - `data/guides.json` → `countries[id].{phrases,food,etiquette,moneyTips,context}` + city food
  - `data/pickpocket-zones.json` → transport etiquette risk cues
  - `data/soundtracks.json` → era + genre cues

Missing subsections must pass through as `null` (spec §3: "not enough verified data — ask a local").

- [ ] **Step 3: System prompt** enforces (spec §4): answer in `lang`; JSON only; compose strictly from provided context; avoid stereotypes ("all X do Y" forbidden); flag uncertainty as `"uncertain": true`; include `"sources"` array naming the context keys used.

- [ ] **Step 4: User prompt** embeds the context block as a JSON object delimited by fenced `<CONTEXT>` tags and names the required output schema verbatim (6 sections + 5-MCQ quiz per spec §4).

- [ ] **Step 5: Browser smoke**

```js
const m = await import('./js/features/coach-prompt.js');
const ctx = await m.buildContextBlock('FR');
console.assert(ctx.country?.currency, 'country currency missing');
const p = m.buildCoachPrompt({ countryId: 'FR', lang: 'en', context: ctx });
console.assert(p.system.includes('JSON'), 'system prompt missing JSON constraint');
console.assert(p.user.includes('<CONTEXT>'), 'context block not embedded');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/features/coach-prompt.js
git commit -m "feat(v1.6): coach-prompt — strict-context LLM prompt builder"
```

---

## Task 5: Core orchestrator — `js/features/coach.js`

**Files:**
- Create: `js/features/coach.js`
- Uses existing: `js/features/llm-adapter.js`, `js/utils/storage.js`

- [ ] **Step 1: Exports.**

```js
export async function generateLesson(countryId, lang = 'en', { force = false } = {});
// calls llm-adapter JSON mode with coach-prompt, validates shape, caches, returns record
export async function getLesson(countryId, lang = 'en');
// cache-first; falls back to generateLesson if online; returns null if offline + uncached
export function markCompleted(countryId, { passed, score });
// writes state.coach via Task 1 helpers
```

- [ ] **Step 2: Validation.** Inline schema check (or small local `coach-schema.js` if clearer): lesson has all 6 section keys, quiz has length 5 with `choices.length === 4`, `answer` is 0..3. On fail, re-ask once (spec §4); second failure returns `{ ok: false, reason: 'schema' }`.

- [ ] **Step 3: Cache write.** `storage.putLesson('${countryId}:${lang}', { key, lesson, quiz, generatedAt: Date.now(), modelId, uncertain, sources })`.

- [ ] **Step 4: Offline behaviour** (spec §12). If `navigator.onLine === false` and no cached record, return `{ ok: false, reason: 'offline' }` — never partial content.

- [ ] **Step 5: Browser smoke**

```js
const m = await import('./js/features/coach.js');
const r = await m.getLesson('FR', 'en'); // requires user Groq key
console.assert(r?.lesson?.greetings, 'lesson not generated');
console.assert(r?.quiz?.length === 5, 'quiz must be 5 MCQ');
m.markCompleted('FR', { passed: true, score: 5 });
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/features/coach.js
git commit -m "feat(v1.6): coach orchestrator — generate, validate, cache, mark-completed"
```

---

## Task 6: Quiz runner adapter — `js/features/quiz-runner.js`

**Files:**
- Create: `js/features/quiz-runner.js`
- Reuses: `js/features/flowchart-runner.js` (v1.3)

- [ ] **Step 1: Rationale.** Do NOT write a new quiz engine. Map the 5-MCQ quiz into the same DAG shape `flowchart-runner` already walks (spec §6), then thread score accumulation through `onRender`/`onTerminal` callbacks.

- [ ] **Step 2: Exports.**

```js
export function quizToFlow(quiz);
// returns { start, nodes } — 5 decision nodes q-1..q-5 + one terminal 'done' node with score summary
export function createQuizRunner(quiz, { onRender, onDone });
// wraps flowchart-runner.createRunner; accumulates score; calls onDone({ score, passed }) at terminal
```

- [ ] **Step 3: Node shape.** Each question becomes `{ type: 'decision', textKey: null, text: q.q, options: q.choices.map((c,i) => ({ label: c, next: i === q.answer ? nextId+':correct' : nextId+':wrong' })) }`. Use "virtual" edges inside the adapter to short-circuit into the next question regardless of branch; track the correct/wrong choice in a scoreboard kept in the adapter's closure. Terminal node reports `{ score: n, passed: n >= 4 }`.

- [ ] **Step 4: A11y.** Inherits `flowchart-runner` keyboard contract (Tab/Enter/Backspace) and `aria-live` announcements — confirm by re-reading that module's JSDoc. No new keyboard code.

- [ ] **Step 5: Browser smoke**

```js
const { quizToFlow, createQuizRunner } = await import('./js/features/quiz-runner.js');
const quiz = [
  { q: 'Q1', choices: ['a','b','c','d'], answer: 0, why: '' },
  { q: 'Q2', choices: ['a','b','c','d'], answer: 1, why: '' },
  { q: 'Q3', choices: ['a','b','c','d'], answer: 2, why: '' },
  { q: 'Q4', choices: ['a','b','c','d'], answer: 3, why: '' },
  { q: 'Q5', choices: ['a','b','c','d'], answer: 0, why: '' },
];
const flow = quizToFlow(quiz);
console.assert(Object.keys(flow.nodes).length >= 6, 'need 5 q + terminal');
let done;
const r = createQuizRunner(quiz, { onRender: () => {}, onDone: s => { done = s; } });
r.start(); r.advance(0); r.advance(1); r.advance(2); r.advance(3); r.advance(0);
console.assert(done?.score === 5 && done?.passed, 'perfect score not detected');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/features/quiz-runner.js
git commit -m "feat(v1.6): quiz-runner — flowchart-runner adapter with score accumulation"
```

---

## Task 7: OpenBadge 2.0 Assertion builder — `js/features/coach-badge.js`

**Files:**
- Create: `js/features/coach-badge.js`

- [ ] **Step 1: Exports.**

```js
export async function buildAssertion({ countryId, recipientEmail = null });
// returns a fully-formed OpenBadge 2.0 JSON-LD Assertion object
export function downloadAssertion(assertion);
// triggers a blob + anchor download: `discovereu-badge-${countryId}.json`
export async function sha256Hex(text);
// Web Crypto helper; used for recipient hashing and jsonLdHash state field
```

- [ ] **Step 2: Assertion shape** (spec §7):

```js
{
  "@context": "https://w3id.org/openbadges/v2",
  "id": `urn:uuid:${crypto.randomUUID()}`,
  "type": "Assertion",
  "recipient": recipientEmail
      ? { "type": "email", "hashed": true, "salt": randomSalt, "identity": `sha256$${hashWithSalt}` }
      : { "type": "email", "hashed": true, "salt": randomSalt, "identity": `sha256$${hashOfAnonymous}` },
  "issuedOn": new Date().toISOString(),
  "verification": { "type": "HostedBadge" },
  "badge": `https://embeddedjedi.github.io/discovereu-companion/badges/classes/${countryId}.json`
}
```

`badge` is an IRI (not an inline object). OBv2 validators dereference it over HTTPS. This is why Task 9 must ship the 33 BadgeClass JSON files on GitHub Pages.

- [ ] **Step 3: Persistence.** After build, write via `storage.putBadge({ badgeId: assertion.id, countryId, json: assertion, issuedAt: assertion.issuedOn })` and append to `state.coach.badgesEarned` via Task 1 helper.

- [ ] **Step 4: Privacy.** `recipientEmail` defaults to `null`; hashing is done with a freshly generated per-assertion salt via `crypto.getRandomValues`. Never persist the raw email.

- [ ] **Step 5: Browser smoke**

```js
const m = await import('./js/features/coach-badge.js');
const a = await m.buildAssertion({ countryId: 'FR' });
console.assert(a['@context'] === 'https://w3id.org/openbadges/v2', 'wrong context');
console.assert(a.type === 'Assertion', 'wrong type');
console.assert(a.verification.type === 'HostedBadge', 'wrong verification');
console.assert(typeof a.badge === 'string' && a.badge.endsWith('/FR.json'), 'badge must be IRI');
console.assert(a.recipient.hashed === true && a.recipient.salt, 'recipient not hashed');
console.log('OK', a.id);
```

- [ ] **Step 6: Commit**

```bash
git add js/features/coach-badge.js
git commit -m "feat(v1.6): coach-badge — OpenBadge 2.0 Assertion builder + hashed-email download"
```

---

## Task 8: Issuer profile — `badges/issuer.json`

**Files:**
- Create: `badges/issuer.json`

- [ ] **Step 1: Author static Issuer profile.**

```json
{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "Issuer",
  "id": "https://embeddedjedi.github.io/discovereu-companion/badges/issuer.json",
  "name": "DiscoverEU Companion",
  "url": "https://embeddedjedi.github.io/discovereu-companion/",
  "email": "contact@imersa.tech",
  "description": "An accessible, green, and inclusive trip-planning companion for all European youth — lowering the threshold for participation in the DiscoverEU programme."
}
```

- [ ] **Step 2: Verify Pages routing.** Confirm `/badges/` path serves statically — GitHub Pages serves any repo path that is not in `.nojekyll`-excluded directories. Add a brief README in `badges/` explaining the directory is intentionally public for OBv2 HostedBadge verification.

- [ ] **Step 3: Commit**

```bash
git add badges/issuer.json badges/README.md
git commit -m "feat(v1.6): OpenBadge Issuer profile hosted on GitHub Pages"
```

---

## Task 9: BadgeClass generator — `scripts/gen-badge-classes.mjs` + 33 outputs

**Files:**
- Create: `scripts/gen-badge-classes.mjs`
- Create: `badges/classes/*.json` (33 files, one per DiscoverEU country)

- [ ] **Step 1: Generator.** Reads `data/countries.json`, iterates the 33 DiscoverEU country IDs, writes each `badges/classes/${id}.json`:

```json
{
  "@context": "https://w3id.org/openbadges/v2",
  "type": "BadgeClass",
  "id": "https://embeddedjedi.github.io/discovereu-companion/badges/classes/FR.json",
  "name": "Intercultural Awareness — France",
  "description": "Completed a 5-minute intercultural micro-lesson and quiz for France, based on curated EU public data.",
  "image": "https://embeddedjedi.github.io/discovereu-companion/badges/images/generic.svg",
  "criteria": { "narrative": "Scored at least 4 out of 5 on the France intercultural awareness quiz. Non-formal self-assessed learning." },
  "issuer": "https://embeddedjedi.github.io/discovereu-companion/badges/issuer.json",
  "tags": ["europass", "intercultural", "discovereu", "key-competences"]
}
```

- [ ] **Step 2: Run once and commit outputs.**

```bash
node scripts/gen-badge-classes.mjs
ls badges/classes | wc -l   # must be 33
```

- [ ] **Step 3: Placeholder image.** Create `badges/images/generic.svg` — simple EU-flag-themed SVG badge; replaceable later per-country without regen (since `image` URL is stable).

- [ ] **Step 4: Browser smoke (served via Pages or local server)**

```js
const r = await fetch('badges/classes/FR.json').then(r => r.json());
console.assert(r.type === 'BadgeClass' && r.issuer.endsWith('issuer.json'), 'BadgeClass malformed');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-badge-classes.mjs badges/classes/ badges/images/
git commit -m "feat(v1.6): 33 BadgeClass JSON files + generator + generic badge SVG"
```

---

## Task 10: UI panel — `js/ui/coach-panel.js`

**Files:**
- Create: `js/ui/coach-panel.js`
- Create: `css/coach.css`
- Modify: `index.html` (link `css/coach.css`)

- [ ] **Step 1: Exports.**

```js
export async function openCoachPanel(countryId);
export function closeCoachPanel();
```

- [ ] **Step 2: Structure (all via `h()`, zero innerHTML interpolation).**

Overlay `role="dialog" aria-modal="true" aria-labelledby`. Sections:
1. Header: country name, close button (Esc also closes).
2. Status chip — "not started / passed X/5 / badge earned" sourced from `state.coach`.
3. Six `<section aria-labelledby>` blocks rendering `lesson.greetings/food/social/money/culture` + `sources` footer. Phrases get `lang="<countryIsoLang>"` + Latin transliteration (spec §11).
4. "Start quiz" button → mounts `createQuizRunner(quiz, ...)` in place of the lesson sections.
5. On `onDone({ passed, score })`: call `coach.markCompleted(...)`. If `passed`, reveal a **Claim badge** button.
6. Claim flow: optional email input (default skipped — `coach.badge.skipEmail`), then `coachBadge.buildAssertion` + `downloadAssertion`. Show persistent "Upload to your Europass profile" link with short instructions.
7. "Refresh lesson" (regenerate) button with confirm.
8. `coach.uncertain` banner when `lesson.uncertain === true`.

- [ ] **Step 3: Accessibility.** Focus trap; restore focus to opener; `prefers-reduced-motion` disables transitions; progress indicator NEVER colour-only; large-type mode inherits from v1.3 design tokens.

- [ ] **Step 4: Offline hook.** If `coach.getLesson` returns `{ ok:false, reason:'offline' }`, render the i18n `coach.offlineUnavailable` message with a retry button — no partial content.

- [ ] **Step 5: Browser smoke**

```js
const { openCoachPanel } = await import('./js/ui/coach-panel.js');
await openCoachPanel('FR');
const dlg = document.querySelector('[data-coach-panel][role="dialog"]');
console.assert(dlg && dlg.getAttribute('aria-modal') === 'true', 'panel/aria missing');
console.assert(dlg.querySelectorAll('section[aria-labelledby]').length >= 5, 'lesson sections missing');
console.log('OK');
```

- [ ] **Step 6: Commit**

```bash
git add js/ui/coach-panel.js css/coach.css index.html
git commit -m "feat(v1.6): coach-panel — accessible lesson + quiz + badge UI"
```

---

## Task 11: Integration — country-detail card + `/coach` standalone route

**Files:**
- Modify: `js/ui/country-detail.js` (insert "Learn this country (5 min)" card ABOVE Crisis Shield slot per spec §9.1)
- Create: `js/pages/coach.js` (standalone page)
- Modify: `js/router.js` (register `#coach` route with optional `?country=` query)

- [ ] **Step 1: Country-detail card.** Above the Crisis Shield slot, append a `<section class="coach-slot">` with status chip (from `state.coach`) + "Learn this country (5 min)" button that invokes `openCoachPanel(countryId)`.

- [ ] **Step 2: Standalone route.** `#coach` renders a grid of all route countries (from `state.route`) with progress rings (reduced-motion: linear bars) + a "badges earned" counter from `state.coach.badgesEarned.length`. Each tile opens `openCoachPanel(id)`. Deep link `#coach?country=DE` auto-opens DE's panel on mount.

- [ ] **Step 3: Router wiring.** Parse `#coach` + optional `?country=XX`. Guard against countries not on the current route (still allow open — lesson is self-contained).

- [ ] **Step 4: Browser smoke**

```js
// After opening FR country detail:
console.assert(document.querySelector('.coach-slot [data-action="open-coach"]'), 'card missing');
location.hash = '#coach?country=DE';
await new Promise(r => setTimeout(r, 300));
console.assert(document.querySelector('[data-coach-panel]'), 'deep link did not open panel');
console.log('OK');
```

- [ ] **Step 5: Commit**

```bash
git add js/ui/country-detail.js js/pages/coach.js js/router.js
git commit -m "feat(v1.6): integrate coach card in country-detail + /coach standalone route"
```

---

## Task 12: Service worker precache bump (v9 → v10)

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump version.**

```js
const CACHE_VERSION = 'discovereu-v10';
```

- [ ] **Step 2: Append to same-origin precache manifest.**

```
'js/features/coach.js',
'js/features/coach-prompt.js',
'js/features/coach-badge.js',
'js/features/quiz-runner.js',
'js/ui/coach-panel.js',
'js/pages/coach.js',
'css/coach.css',
'badges/issuer.json',
'badges/images/generic.svg',
// Top-5 frequently-visited-country BadgeClasses (pragmatic shortlist):
'badges/classes/FR.json',
'badges/classes/DE.json',
'badges/classes/IT.json',
'badges/classes/ES.json',
'badges/classes/NL.json'
```

(Existing `data/countries.json`, `data/emergency-phrases.json`, `data/guides.json`, `data/pickpocket-zones.json`, `data/soundtracks.json` should already be precached from earlier versions — verify, don't duplicate.)

- [ ] **Step 3: Browser smoke (airplane-mode cold load).**

```js
const c = await caches.open('discovereu-v10');
for (const p of ['js/features/coach.js','js/ui/coach-panel.js','badges/issuer.json','badges/classes/FR.json']) {
  console.assert(await c.match(p), 'not precached: ' + p);
}
console.log('OK');
```

Then DevTools → Offline, hard-reload, open coach panel for FR (already-generated lesson must render fully; a fresh country must show `coach.offlineUnavailable`).

- [ ] **Step 4: Commit**

```bash
git add sw.js
git commit -m "chore(v1.6): sw cache v10 — precache Coach assets + top-5 BadgeClasses"
```

---

## Task 13: Final smoke + PROGRESS.md + decision log

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Full route-level smoke.**

1. Clear SW + LocalStorage + IndexedDB.
2. Reload; paste a Groq key in settings; build a route with FR + DE.
3. Open FR country detail → "Learn this country (5 min)" card visible above Crisis Shield.
4. Click → lesson renders with 6 sections + sources; start quiz → 5 MCQs → scores 5/5 → pass.
5. Claim badge without email → assertion downloads as `discovereu-badge-FR.json`. Open the file — verify `@context`, `type: "Assertion"`, `verification.type: "HostedBadge"`, `badge` IRI reachable on the deployed Pages site.
6. Go to `#coach` → grid shows FR passed + 1 badge earned.
7. Toggle offline → FR re-open works from cache; DE (uncached) shows `coach.offlineUnavailable`.
8. Lighthouse a11y on open panel ≥ 95.

- [ ] **Step 2: Update PROGRESS.md.**
  - Move all v1.6 Coach entries to `Done`.
  - Add decision under §6:

```
**Decision (2026-04-13):** AI Intercultural Coach ships with client-side OpenBadge 2.0 Assertion generation + statically hosted BadgeClass/Issuer JSON on GitHub Pages (HostedBadge verification). No backend, no signing.
**Alternatives considered:** signed assertions via consortium Europass API proxy (Option B — documented, KA220-funded path); PDF + QR (Option C — rejected, not OBv2 compliant).
**Rationale:** No backend constraint preserved; Europass accepts unsigned hosted Assertions; reviewable by EACEA without build tooling; aligns with KA220 Digital-Transformation + Inclusion priorities.
**Consequences:** /badges/ directory is load-bearing and must remain publicly resolvable at the canonical GitHub Pages URL; custom-domain migration must preserve or 301 that path. Quarterly content review of BadgeClass narratives added to maintenance.
```

  - Add followups to §7:
    - Coach translations de/fr/es/it.
    - Per-country SVG badge art (replace `generic.svg`).
    - Optional KA220-funded Europass API proxy (Option B).
    - Editorial review checklist `docs/coach-editorial.md`.

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md
git commit -m "docs(v1.6): mark AI Intercultural Coach complete; log decision + followups"
```

---

## Self-review — spec ↔ task coverage

| Spec section | Requirement | Covered by |
|---|---|---|
| §1 Purpose — per-country 5-min lesson + quiz + OpenBadge | Tasks 4–10 |
| §2 In-scope: 6-section lesson, quiz, IDB cache, state, OBv2 JSON-LD, panel + `/coach` route, i18n, AAA | Tasks 1–12 |
| §3 Content sourcing — LLM composes from curated JSON only | Task 4 (prompt); Task 5 (validator enforces) |
| §3 Empty-source fallback ("ask a local") | Task 4 Step 2 |
| §4 Prompt + output schema (JSON only, avoid stereotypes, `uncertain:true`) | Task 4 Step 3; Task 5 validation |
| §4 schema validator + one re-ask + fallback | Task 5 Step 2 |
| §5 IDB `coachLessons` keyed by `${countryId}:${lang}` | Task 2, Task 5 Step 3 |
| §5 `state.coach` persistent slice | Task 1 |
| §5 IDB `coachBadges` + on-demand export | Task 2, Task 7 |
| §6 Quiz reuses flowchart-runner (v1.3), no second engine | Task 6 |
| §7 OpenBadge 2.0 Option A — HostedBadge, client-side Assertion, hashed email optional | Tasks 7, 8, 9 |
| §7 Hosted BadgeClass + Issuer at static Pages URLs | Tasks 8, 9 |
| §8 New JS modules (coach, coach-schema inline, quiz-runner, openbadge=coach-badge, coach-panel) | Tasks 5, 6, 7, 10 |
| §9.1 Country-detail panel card | Task 11 Step 1 |
| §9.2 Standalone `#coach` route with grid + counter | Task 11 Steps 2–3 |
| §10 i18n keys `coach.*` | Task 3 |
| §11 AAA: section landmarks, keyboard model, `lang` + transliteration, reduced-motion, colour-not-sole | Tasks 6, 10 Step 3 |
| §12 Offline: fully-cached lessons work; uncached shows explicit message; badge export offline-capable | Tasks 5 Step 4, 10 Step 4, 12 |
| §13 Hallucination mitigation — strict prompt, validator, `uncertain` banner, sources footer, flag action | Tasks 4, 5, 10 (flag via `state.coach.flags` from Task 1) |
| §13 PII — hashed + salted client-side; default skipped | Task 7 Step 4, Task 10 Step 2 (flow 6) |
| §14 Grant narrative mapping | PROGRESS.md decision log (Task 13) |
| §15 Out-of-scope (ECTS, server-signed, tutor chat, speech rec) | Not implemented (by design) |

All in-scope spec requirements map to at least one task. Out-of-scope items (§15) are explicitly not implemented.

---

## Deferred i18n locales

German, French, Spanish, Italian `coach.*` translations are **deferred** and tracked as a followup in PROGRESS.md §7 (same pattern used for Crisis Shield v1.3). English + Turkish ship with v1.6.

---

## CRITICAL — GitHub Pages routing for OpenBadge verification

OpenBadge 2.0 HostedBadge verification requires the following URLs to resolve publicly with `Content-Type: application/json` (or JSON-LD) and without authentication:

- `https://embeddedjedi.github.io/discovereu-companion/badges/issuer.json`
- `https://embeddedjedi.github.io/discovereu-companion/badges/classes/{countryId}.json` × 33

Before closing v1.6:

1. Confirm GitHub Pages serves `/badges/` statically (no `.nojekyll` rule excludes it; no `404.html` catchall intercepts).
2. `curl -I https://embeddedjedi.github.io/discovereu-companion/badges/issuer.json` must return `200 OK` and a JSON-ish content-type.
3. Run a downloaded assertion through a public OBv2 validator (e.g. openbadges.org validator or IMS Global tooling) once Pages is live — confirm PASS.
4. If the project migrates to a custom domain, all 34 URLs must 301 to the new canonical hostname; otherwise every issued badge becomes unverifiable. Log this constraint in PROGRESS.md §6 as part of the decision consequences.

Failure here silently breaks every badge already issued in the wild — treat as a launch-blocker.
