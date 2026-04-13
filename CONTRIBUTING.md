# Contributing to DiscoverEU Companion

Thank you for considering a contribution. This project serves young Europeans planning their DiscoverEU trip, and every translation, data correction, and accessibility report materially improves the experience for someone aged 18.

## Run locally

```
git clone https://github.com/embeddedJedi/discovereu-companion.git
cd discovereu-companion
```

Then open `index.html` directly in a modern browser. **There is no build step.** No `npm install`, no bundler, no transpiler. This is a hard project constraint — it keeps the source inspectable by reviewers and contributors in under a minute. If you need a local web server for Service Worker testing, `python -m http.server 8000` is sufficient.

## Code conventions

- **Vanilla JavaScript (ES modules) only.** No React, Vue, Svelte, TypeScript, or bundlers. CDN script tags are acceptable.
- **DOM helpers live in `js/utils/dom.js`.** Use the `h()` helper for element creation; do not assign user-provided strings to `innerHTML`.
- **i18n for every user-facing string.** Source lives in `i18n/en.json`; hardcoded English in markup is rejected in review.
- **CSS custom properties** from `css/design-system.css` — never hardcode colours. Dark and light themes must both work.
- **Mobile-first.** Test at 375 px, 768 px, and 1440 px. Keyboard navigation and visible focus rings are required.
- **One file, one purpose.** Each ES module exports a small surface; no global pollution.

## Translations

Pick any of the six locales in `i18n/`: `en.json`, `tr.json`, `de.json`, `fr.json`, `es.json`, `it.json`. English is the source of truth; copy missing keys and translate. DE / FR / ES / IT currently fall back to EN for the newest buddy / accessibility / impact / coach surfaces — these are high-value targets.

## Data contributions

- **Accessibility verifications** → update `data/accessibility.json` with a source link.
- **Green hostel entries** → `data/hostels-green.json` with location, sustainability notes, and a public reference.
- **Buddy city seeds** → open a `buddy-seed` issue (template provided) rather than editing JSON directly.
- **Country / city corrections** → cite a public source in the PR description.

## Proposing features

Open an issue using the feature-request template. Describe the user, the problem, the smallest version that would ship, and link any relevant DiscoverEU / EACEA policy context. Large features should be discussed before implementation.

## Review cycle

During the launch month (April 2026) maintainers aim to review PRs within one week. Outside launch months, expect two to three weeks. Critical accessibility or safety issues are prioritised.

## Commit messages

Conventional style: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Keep the subject under 72 characters.

## Launch sprint priorities

Refer to the **Next up** section of [PROGRESS.md](PROGRESS.md) for the active priority list — translations backfill, manual Playwright smoke pass, custom-domain configuration, and outreach dispatch.

## Code of conduct

Be kind. This project exists for 18-year-olds taking their first independent trip across Europe. Act accordingly.
