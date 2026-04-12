# Outreach Package (Sub-project B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 3 outreach documents (EACEA one-pager HTML/PDF, Turkish UA email, LinkedIn DG EAC message) ready to send before 2026-04-22 launch.

**Architecture:** Pure content creation — no JS/CSS changes. Three Markdown/HTML files in `docs/outreach/`. The EACEA one-pager is a self-contained HTML file that prints to A4 PDF. The other two are Markdown templates ready to copy-paste.

**Deliverables:**
1. `docs/outreach/eacea-one-pager.html` — print-to-PDF A4 landscape, EU blue/gold design
2. `docs/outreach/turkish-ua-email.md` — formal Turkish email, max 300 words
3. `docs/outreach/linkedin-dg-eac.md` — English connection message, ~150 words

**Key constraints:**
- Use ONLY EU Youth Strategy vocabulary (see CLAUDE.md Positioning section)
- NEVER use startup jargon (MVP, user acquisition, monetization, growth hacking)
- Only claim features that exist in PROGRESS.md
- Live URL: `https://embeddedjedi.github.io/discovereu-companion/`
- GitHub: `https://github.com/embeddedJedi/discovereu-companion`
- License: MIT
- Project creator: Emirhan Eksi

---

### Task 1: Create EACEA One-Pager (HTML, print-ready)

**Files:**
- Create: `docs/outreach/eacea-one-pager.html`

**Context:** A4 landscape, single page, self-contained HTML (inline CSS, no external dependencies). Must look professional when printed or saved as PDF from a browser. EU blue (#003399) + gold (#FFCC00) accent. Clean typography (system fonts).

**Content structure (from spec Section 9.1):**
- Header: "DiscoverEU Companion — An Open-Source Trip Planning Tool for European Youth"
- Subtitle: "Engage · Connect · Empower"
- 3-column layout:
  - **What:** ~50 words describing the project in EU Youth Strategy vocabulary
  - **Why it matters:** 3 bullets (inclusion via fewer-opportunities mode + accessibility/LGBTQ+ layers, sustainability via CO2 calculator + rail-first design, digital empowerment via open-source + no-build architecture)
  - **5 Unique Features:** mandatory reservation warnings, 4 seat-credit tracker, CO2 vs flying calculator, Wheelmap accessibility + ILGA Rainbow Map layers, AI route planner (Groq/Gemini)
- Screenshot placeholder strip (3 slots with border + caption)
- Footer: GitHub URL, live site URL, MIT license, "Made by a DiscoverEU traveler for DiscoverEU travelers"

- [ ] **Step 1:** Write the complete `eacea-one-pager.html` with inline CSS, all content, A4 landscape print layout (`@media print`), EU color scheme, 3-column body, footer.

- [ ] **Step 2:** Open in browser and verify it renders correctly at A4 landscape proportions. Check print preview fits on one page.

- [ ] **Step 3:** Commit.
```bash
git add docs/outreach/eacea-one-pager.html
git commit -m "docs(outreach): add EACEA one-pager HTML for print-to-PDF"
```

---

### Task 2: Create Turkish Ulusal Ajansi Email

**Files:**
- Create: `docs/outreach/turkish-ua-email.md`

**Context:** Formal Turkish email to the Turkish National Agency (Ulusal Ajans) for Erasmus+. Max 300 words. Institutional tone. References Erasmus+ Turkey NA's own inclusion goals.

**Content structure (from spec Section 9.2):**
1. Greeting: "Saygi degerler Erasmus+ Turkiye Ulusal Ajansi Yetkilisi,"
2. Self-introduction: DiscoverEU participant/applicant, project creator
3. Project description: 1 paragraph in Turkish, EU vocabulary Turkish equivalents (katilim esigini dusurmek, daha az firsata sahip gencler, erisilebilir ve kapsayici tasarim, surdurulebilir hareketlilik)
4. Turkish-specific value: Schengen visa guide, Sofia Express connector, TL budget mode, consulate reminder
5. Concrete ask: "Bu araci Turkiye'den DiscoverEU kazananlariyla paylasir misiniz?"
6. Links: GitHub, live site, contact info
7. Closing: formal Turkish sign-off

- [ ] **Step 1:** Write the complete `turkish-ua-email.md` with proper Turkish formal letter structure, all content, links.

- [ ] **Step 2:** Review word count (must be <=300 words body), verify all mentioned features exist in PROGRESS.md.

- [ ] **Step 3:** Commit.
```bash
git add docs/outreach/turkish-ua-email.md
git commit -m "docs(outreach): add Turkish Ulusal Ajansi email template"
```

---

### Task 3: Create LinkedIn DG EAC Message

**Files:**
- Create: `docs/outreach/linkedin-dg-eac.md`

**Context:** ~150 words, English, connection/InMail message to DG EAC Youth Unit staff on LinkedIn. Professional, not salesy. References EU Youth Strategy and DiscoverEU programme goals.

**Content structure (from spec Section 9.3):**
1. Opening: acknowledge their work on DiscoverEU/youth mobility
2. One-sentence project intro with live URL
3. Two standout features: inclusion layers (Wheelmap + Rainbow Map) + sustainability calculator (CO2 savings)
4. Soft ask: "Happy to share a demo or discuss how this could support programme goals."
5. Sign-off with live site link

- [ ] **Step 1:** Write the complete `linkedin-dg-eac.md` with the message template, placeholder for recipient name.

- [ ] **Step 2:** Verify word count (~150 words), check no startup jargon slipped in.

- [ ] **Step 3:** Commit.
```bash
git add docs/outreach/linkedin-dg-eac.md
git commit -m "docs(outreach): add LinkedIn DG EAC Youth Unit message template"
```

---

### Task 4: Update PROGRESS.md + Final Review

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1:** Update PROGRESS.md: move "Outreach package for EACEA, Turkish UA, LinkedIn DG EAC Youth Unit" to Done section with a session note.

- [ ] **Step 2:** Commit all changes.
```bash
git add PROGRESS.md
git commit -m "docs: mark outreach package as complete in PROGRESS.md"
```

- [ ] **Step 3:** Push to origin main.
```bash
git push origin main
```
