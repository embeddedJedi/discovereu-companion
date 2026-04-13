# AI Intercultural Coach — v1.6 Design Spec

**Date:** 2026-04-13
**Status:** Draft (design only — implementation plan is a separate task)
**Strategic role:** KA220 "Digital transformation" + "Inclusion & diversity" priority flagship. Turns every country on the user's route into a 5-minute personalised micro-lesson, completion-certified by a downloadable Europass-compatible OpenBadge. Reframes DiscoverEU as a non-formal learning journey, not just tourism.

---

## 1. Purpose

For each country on the user's route, an LLM composes a 5-minute intercultural micro-lesson from existing curated data. Completion via a 5-question quiz (4/5 to pass) mints an **OpenBadge 2.0 JSON-LD credential** the learner can upload to their own Europass profile manually. Builds the grant narrative that DiscoverEU Companion delivers measurable learning outcomes aligned with the EU Key Competences framework (multilingual + cultural awareness).

## 2. Scope

**In:** per-country 6-section lesson generation, quiz engine, IndexedDB caching, progress + badges state, OpenBadge JSON-LD download, panel + standalone `/coach` route, i18n, WCAG AAA.
**Out (deferred):** formal accreditation, ECTS credits, course marketplace, server-signed Europass API submission, live tutor chat, speech recognition, teacher dashboards.

## 3. Content sourcing (LLM composes, never researches)

The LLM receives ONLY a curated context block assembled from existing JSON; it is forbidden to invent facts beyond rephrasing.

| Section | Source files |
|---|---|
| Greetings & phrases | `data/emergency-phrases.json` (greeting/thanks/help sets) + `guides.countries[id].phrases` |
| Food & dining | `data/guides.json` → `countries[id].food`, `cities[*].food` |
| Social norms | `data/guides.json` → `countries[id].etiquette`, `pickpocket-zones.json` (transport-etiquette risk cues) |
| Money notes | `data/countries.json` (currency, cashHeavy), `data/guides.json` → `moneyTips` |
| Cultural context | `data/guides.json` → `countries[id].context`, `soundtracks.json` (era + genre cues) |
| Quiz | LLM, grounded against the above block |

If a section's source is empty the lesson explicitly says "not enough verified data — ask a local" instead of hallucinating.

## 4. LLM prompt + output schema

System prompt enforces: (a) answer in user's UI language, (b) only JSON, (c) no claims beyond supplied context, (d) avoid stereotypes, (e) flag any uncertainty as `"uncertain": true`.

```json
{
  "countryId": "FR",
  "lang": "en",
  "lesson": {
    "greetings":  { "lines": [{ "native": "Bonjour", "latin": "bon-zhoor", "meaning": "Hello (formal)" }, ...5] },
    "food":       { "text": "...", "avoid": ["..."], "dietary": { "vegan": "...", "halal": "..." } },
    "social":     { "text": "...", "faux_pas": ["..."] },
    "money":      { "text": "...", "cashVsCard": "mostly card", "atmFees": "..." },
    "culture":    { "text": "...", "notes": ["..."] }
  },
  "quiz": [
    { "q": "...", "choices": ["A","B","C","D"], "answer": 1, "why": "..." }, ...5
  ],
  "uncertain": false,
  "sources": ["guides.FR", "emergency-phrases.FR"]
}
```

Reuses `llm-adapter.js` JSON mode. Response validated against a schema module `js/features/coach-schema.js`; validation failure triggers one re-ask, then a graceful fallback card.

## 5. Caching + state

**IndexedDB store** `coachLessons`, keyed by `${countryId}:${lang}`, value `{ lesson, quiz, generatedAt, modelId }`. TTL: indefinite. User-initiated "Refresh lesson" button re-generates; automatic regeneration only when the schema version bumps.

**Persistent state** (LocalStorage via `state.coach`):
```
coach: {
  lessonsCompleted: { "FR": { score: 5, passedAt: "2026-04-20T..." } },
  quizScores: { "FR": [5, 4] },
  badgesEarned: [{ countryId, issuedAt, badgeId, jsonBlobKey }]
}
```
Badge JSON-LD blobs stored in IndexedDB `coachBadges` store, exported on demand.

## 6. Quiz engine

**Reuses flowchart-runner (v1.3) DAG pattern.** A quiz is modelled as a 5-node linear DAG with a terminal scorecard node; leverages existing keyboard nav, back stack, and `aria-live` announcements. One small adapter `js/features/quiz-runner.js` wraps flowchart-runner with score accumulation. No second runner implementation.

## 7. OpenBadge 2.0 JSON-LD template (Option A)

On pass (≥4/5), generate a BadgeAssertion:
```json
{
  "@context": "https://w3id.org/openbadges/v2",
  "id": "urn:uuid:<v4>",
  "type": "Assertion",
  "recipient": { "type": "email", "hashed": true, "salt": "<random>", "identity": "sha256$<hash>" },
  "issuedOn": "2026-04-20T12:00:00Z",
  "verification": { "type": "HostedBadge" },
  "badge": {
    "type": "BadgeClass",
    "id": "https://embeddedjedi.github.io/discovereu-companion/badges/intercultural-fr.json",
    "name": "Intercultural Awareness — France",
    "description": "Completed a 5-minute intercultural micro-lesson and quiz.",
    "image": "https://embeddedjedi.github.io/discovereu-companion/badges/intercultural-fr.png",
    "criteria": { "narrative": "Score ≥ 4/5 on the France quiz." },
    "issuer": "https://embeddedjedi.github.io/discovereu-companion/issuer.json",
    "tags": ["europass", "intercultural", "discovereu", "key-competences"]
  }
}
```
Hosted BadgeClass + Issuer JSON live in the repo `/badges/` (static GitHub Pages URLs — verifiable without a backend). User downloads assertion via "Export badge (.json)" and uploads to their Europass profile. Email is optional and hashed client-side; skippable.

**Option B (KA220-funded upgrade):** signed assertions via a consortium partner's Europass API proxy. Documented, not implemented.
**Option C (PDF + QR):** rejected — not OpenBadge compliant.

## 8. New JS modules

- `js/features/coach.js` — orchestrates context build → LLM call → validate → cache → render.
- `js/features/coach-schema.js` — JSON schema validator for lesson + quiz shape.
- `js/features/quiz-runner.js` — thin flowchart-runner adapter with scoring.
- `js/features/openbadge.js` — assertion builder, email hashing (Web Crypto), JSON download.
- `js/ui/coach-panel.js` — panel renderer (lesson sections + quiz launcher + badge tray).

## 9. UI entry points

1. **Country-detail panel** gains a "Learn this country" section above Crisis Shield: compact card showing lesson status (not started / in progress / passed + badge).
2. **Standalone `/coach` route** (hash `#coach`): grid of all route countries with progress rings, total badges counter, "Export all badges (.zip)" action.

## 10. i18n keys

Namespace `coach.*` (~40 keys): `coach.title`, `coach.start`, `coach.refresh`, `coach.section.greetings|food|social|money|culture`, `coach.quiz.start|q|correct|wrong|passed|failed|retry`, `coach.badge.earned|export|hashEmail|skipEmail`, `coach.uncertain`, `coach.offlineUnavailable`, `coach.noKey`.

## 11. Accessibility (WCAG AAA)

Section headings form a navigable landmark list; each lesson section is `<section aria-labelledby>`. Quiz reuses flowchart-runner's AAA keyboard model. Native-script phrases have `lang="fr"` + Latin transliteration + audio-free pronunciation hint. Large-type mode inherits from v1.3. Reduced-motion: progress rings become linear bars. Colour never the sole indicator of correct/wrong.

## 12. Offline behaviour

Cached lessons fully available offline via Service Worker + IndexedDB. If a country is uncached and the device is offline, UI shows "Go online once to generate this lesson" — never partial hallucinated content. Badge export works offline from cached assertions.

## 13. Risks + mitigations

| Risk | Mitigation |
|---|---|
| LLM hallucination | Prompt restricts to supplied context; schema validation; `uncertain:true` UI banner; sources shown per lesson |
| Cultural stereotyping | Prompt forbids generalisations ("all French…"); editorial review checklist in `docs/coach-editorial.md`; user "Report lesson" action writes to `state.coach.flags` |
| Email PII in badge | Hashed + salted client-side; email optional; default skipped |
| OpenBadge misuse | BadgeClass narrative explicitly states "non-formal, self-assessed"; no ECTS claim |
| Offline cold-start | SW precaches English lesson for top-5 most-planned countries |
| API key cost | Reuses user-provided Groq key; 6-section lesson ≈ 1.5k tokens, quiz ≈ 800 tokens — within free tier |

## 14. Grant narrative mapping

- **KA220 Digital transformation** — LLM-personalised learning + OpenBadge 2.0 credentials.
- **KA220 Inclusion & diversity** — AAA accessibility, multilingual, first-time-traveller onboarding, hashed-or-skip PII.
- **EU Key Competences** — multilingual + cultural awareness + digital literacy mapped per lesson.
- **Europass ecosystem** — OpenBadge assertions upload-ready to any Europass profile, validating non-formal learning.

## 15. Out of scope

Formal accreditation, ECTS/ECVET credits, course marketplace, teacher dashboards, speech recognition, server-signed Europass API submission (KA220-funded path), live tutor chat, cohort analytics.
