# DiscoverEU Companion — Project Instructions

> **This project OVERRIDES the global firmware CLAUDE.md.** This is a web application project, not embedded firmware. Ignore all IMERSA Wave / STM32 / FreeRTOS / register / pinmap rules while working here.

---

## Project

**DiscoverEU Companion** — an open-source single-page web application that helps 18-year-olds plan, budget, travel, and remember their DiscoverEU trip across 33 European countries, with a special Turkish bonus layer.

| Field | Value |
|---|---|
| **Type** | Vanilla JS web application, no build step |
| **Audience** | All 33 DiscoverEU countries' youth + Turkish bonus layer |
| **Goal** | Earn DiscoverEU/EACEA amplification, support Turkish applicants, win advantages in future applications |
| **Application deadline** | 2026-04-22 (launch target) |
| **Hosting** | GitHub Pages (free), custom domain later |
| **GitHub owner** | `embeddedJedi` |
| **Repo name** | `discovereu-companion` |
| **License** | MIT |

---

## Positioning (use this exact framing in all communication)

> *"An accessible, green, and inclusive trip-planning companion for all European youth — lowering the threshold for participation in the DiscoverEU programme."*

Landing page motto: **Engage · Connect · Empower**

Language to use (from EU Youth Strategy + Erasmus+ Inclusion Action):
- `fewer opportunities`, `lower the threshold for participation`, `accessible and inclusive design`, `environmental footprint`, `sustainable mobility`, `intercultural understanding`, `sense of European belonging`, `active European citizenship`

Language to **avoid** (never appears in DG EAC documents):
- `startup`, `MVP`, `user acquisition`, `monetization`, `growth hacking`

---

## Tech stack

- **Vanilla HTML + ES modules + CSS** — no framework, no build, no `npm install`
- **Leaflet** (CDN) — map engine
- **Chart.js** (CDN) — radar charts
- **jsPDF + html2canvas** (CDN) — PDF & shareable card export
- **LZ-string** (CDN) — URL-encoded route sharing
- **Natural Earth GeoJSON** — public-domain country boundaries
- **LocalStorage + IndexedDB** — persistence
- **Service Worker** — PWA offline mode
- **CORS-friendly free APIs only** — Open-Meteo, OpenTripMap, Wikivoyage, Wikimedia, Wheelmap, Groq/Gemini (AI)

Constraint: `index.html` must open directly in a browser with no build tooling. This is a hard requirement — it's what lets EACEA reviewers inspect the source instantly.

---

## Architecture & progress

**Single source of truth:** [`PROGRESS.md`](PROGRESS.md)

Before implementing any feature:
1. Read `PROGRESS.md` — understand current architecture, file structure, data flow, and what's already done.
2. Find the feature in the Roadmap section (Tier 1-5).
3. Mark it `in_progress` in the Progress Tracker.
4. Implement.
5. Update `PROGRESS.md` — move it to `Done`, note any architectural decisions made.
6. Commit.

---

## Rules (hard constraints)

1. **Vanilla only** — no React, Vue, Svelte, npm, bundlers, TypeScript. CDN scripts are OK.
2. **No build step** — `index.html` must run directly in a browser.
3. **Data in JSON** — all content lives in `/data/*.json` or `/i18n/*.json`, never hardcoded in JS logic.
4. **Accessibility first** — WCAG AA minimum, keyboard navigation everywhere, semantic HTML, proper `aria-*` attributes, visible focus rings.
5. **Mobile responsive** — every feature must work on 375px wide screens. Test at 375, 768, 1440.
6. **Dark + light themes** — always use CSS custom properties from `css/design-system.css`. Never hardcode colors.
7. **Multi-language** — every user-facing string goes through i18n. Zero hardcoded English in markup.
8. **CORS-friendly APIs only** — no backend. If an API needs a key, it must be user-provided or allow anonymous browser calls.
9. **Never commit secrets** — API keys go in runtime config (user pastes into settings), never in git.
10. **Code comments in English, discussion in Turkish** — all code/comments/commit messages are English; all chat with the user is Turkish.
11. **No frameworks sneaking in** — if you think "we need a framework", stop and ask the user first.
12. **Tree-shakeable modules** — each JS file is a single-purpose ES module with explicit exports. No global pollution.

---

## Agent team

Specialized agents live in [.claude/agents/](.claude/agents/). Use the right agent for each domain:

| Agent | Use when |
|---|---|
| [architect](.claude/agents/architect.md) | Planning features, cross-cutting decisions, updating PROGRESS.md |
| [ui-designer](.claude/agents/ui-designer.md) | HTML, CSS, accessibility, responsive, dark/light theme |
| [feature-engineer](.claude/agents/feature-engineer.md) | JS feature implementation (route builder, bingo, calculators) |
| [data-curator](.claude/agents/data-curator.md) | Country data, translations, JSON schemas |
| [map-specialist](.claude/agents/map-specialist.md) | Leaflet, GeoJSON, map layers, spatial operations |
| [api-integrator](.claude/agents/api-integrator.md) | External APIs (Open-Meteo, Wheelmap, LLMs), CORS handling |
| [outreach-writer](.claude/agents/outreach-writer.md) | EACEA / Turkish UA / LinkedIn pitch content |
| [research-scout](.claude/agents/research-scout.md) | Deep web research for features, data sources, regulations |

Launch multiple agents in parallel whenever their work is independent.

---

## Language conventions

- **Chat with user:** Turkish (primary collaboration language)
- **Code, comments, identifiers, commit messages:** English
- **UI strings:** always through i18n, English source file, Turkish + 4 other translations

---

## Git workflow

- Branch: `main` (direct commits OK during sprint — no branch protection yet)
- Commit style: conventional (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)
- Push after each meaningful milestone (not after every file)
- GitHub Pages deploys from `main` automatically via `.github/workflows/pages.yml`
- Never commit secrets, node_modules, .env, or .claude/settings.local.json
