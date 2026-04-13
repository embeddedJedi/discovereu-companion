# DiscoverEU Companion

> An accessible, green, and inclusive trip-planning companion for all European youth — lowering the threshold for participation in the [DiscoverEU](https://youth.europa.eu/discovereu) programme.

[![MIT License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-ready-5A0FC8)](assets/manifest.json)
[![WCAG](https://img.shields.io/badge/WCAG-AA%20baseline%20%7C%20AAA%20target-blue)](pages/accessibility-demo.html)
[![Erasmus+ aligned](https://img.shields.io/badge/Erasmus%2B-aligned-blue)](https://erasmus-plus.ec.europa.eu/)
[![GitHub Pages](https://img.shields.io/badge/Live-GitHub%20Pages-24292e)]({{CANLI_URL}})

**Open app → {{CANLI_URL}}**

## Engage · Connect · Empower

DiscoverEU Companion is a free, open-source, single-page web application that supports 18-year-olds across 33 eligible countries as they plan, budget, travel and remember their DiscoverEU journey. The project is designed around the EU Youth Strategy priorities of **inclusion, digital engagement, sustainable mobility and active European citizenship**, with special attention to participants facing greater obstacles — youth with fewer opportunities, travellers with accessibility needs, LGBTQ+ youth, and Turkish applicants navigating Schengen visa requirements.

We believe that a well-designed companion tool can meaningfully lower the threshold for participation: by turning reservation penalties, language anxiety, night-arrival stress and budget uncertainty into problems that are solved before departure. The app runs in any modern browser with no build step and no account, so reviewers and participants can inspect, fork, or use it in under a minute.

## What it does

- **Round-trip route builder** with outbound + return polylines, directional arrows, and seat-credit-aware legs
- **AI trip assistant** (user-provided key) for natural-language itineraries and a `returnLeg` diff workflow
- **Crisis Shield** — offline emergency numbers, embassy directory, DAG-based crisis flowcharts, share-location
- **Accessibility 2.0** — dyslexia mode, reduced-motion, contrast filters, colourblind palettes, low-bandwidth mode, opt-in Whisper transcription, wheelchair metro layer
- **Impact Dashboard** — anonymous k≥5 aggregation with a CC-BY-4.0 [public dataset](data/impact-public.json) and a 1080×1080 shareable card
- **Buddy Matching** — GitHub-Issues-backed, consent-gated, PII-whitelisted, route-aware (see [#buddy-safety](#buddy-safety))
- **AI Intercultural Coach** with 33 deterministic OpenBadge 2.0 country badges and salted-hash verification
- **DiscoverEU Wrapped** — end-of-trip statistics card (countries, kilometres, CO₂ saved)
- **Fun layer** — City Bingo, FutureMe time capsule, Daily Dare micro-quests, Country Soundtrack, voice memory capsule
- **Turkish bonus layer** — Schengen visa checklist, Sofia Express pre-segment, TL budget mode

Full feature inventory and architecture live in [PROGRESS.md](PROGRESS.md).

## Built on open data

Wikivoyage · Natural Earth · OpenStreetMap · Wheelmap · ILGA-Europe Rainbow Map · Open-Meteo · OpenTripMap · Wikimedia Commons. Full attribution: [`data/SOURCES.md`](data/SOURCES.md).

## Accessibility

WCAG 2.1 **AA** as baseline across the whole app, with **AAA** targets in the Crisis Shield and impact-card surfaces. Dyslexia-friendly typography, reduced-motion honouring `prefers-reduced-motion`, colourblind-safe palettes, keyboard-first navigation, semantic landmarks, a wheelchair-accessible metro overlay, and an opt-in Whisper.wasm transcription for audio journal entries. A low-bandwidth mode disables heavy assets for train-Wi-Fi conditions. See the live demo: [`/pages/accessibility-demo.html`](pages/accessibility-demo.html).

## Privacy

- No backend, no server-side logging, no analytics
- No accounts, no personally identifying data collected
- All user content stored locally (LocalStorage + IndexedDB)
- AI keys are user-provided at runtime and stay in the browser
- Buddy matching uses public GitHub Issues with an explicit consent gate and a PII whitelist

## How it works

1. **Plan a route** — pick a home city, drag stops, see reservation warnings, seat-credit usage, CO₂ vs flying, and total cost in real time.
2. **Learn and prep** — country guides, intercultural coach, accessibility overlay, crisis flowcharts, packing assistant, emergency phrases.
3. **Travel and remember** — passive GPS journal, voice capsule, City Bingo, Daily Dare, FutureMe email, end-of-trip Wrapped card and PDF trip book.

## Open dataset

Aggregate trip statistics (k≥5 anonymised) are published as [`data/impact-public.json`](data/impact-public.json) under CC-BY-4.0. Contributions flow through a manual-PR-as-consent pipeline — no silent collection. Methodology is documented inline in the Impact Dashboard at [`/pages/impact.html`](pages/impact.html).

## Erasmus+ alignment

The project is designed against the four horizontal priorities of the Erasmus+ programme: **Inclusion and Diversity** (fewer-opportunities youth, Turkish applicants, accessibility, Rainbow Map), **Digital Transformation** (an open digital tool that is inspectable source-first), **Environment** (CO₂ comparison, slow-travel prompts, Green Traveler badge), and **Participation in democratic life** (dialogue instruments, open data, transparent methodology).

## Contribute

Translations, accessibility verifications, hostel entries, buddy-city seeds, and feature proposals are all welcome. Start here: [CONTRIBUTING.md](CONTRIBUTING.md). Issue templates cover buddy seeds, accessibility reports, data corrections, and feature requests.

## <a id="buddy-safety"></a>Buddy safety

Buddy Matching exists to help solo travellers find fellow DiscoverEU participants in the same city on the same dates. It is designed safety-first:

- **Meet only in public places** for first meetings — cafés, station lobbies, hostel common rooms. Never at a private address.
- **Never share payment details, ID documents, passport numbers, or accommodation access** with a buddy.
- **Keep chat on platform** — any request to move to private channels before meeting in person is a red flag.
- **Only a PII whitelist** of non-identifying fields (city, date window, language, interests) is accepted in issue templates; anything else is scrubbed.
- **Report concerns immediately** by opening a `buddy-safety` issue or by using the in-app Crisis Shield, which includes local emergency numbers and the nearest embassy for Turkish participants.
- **Trust your gut.** Cancel any meet-up that feels off — no explanation owed.

## License

[MIT](LICENSE).

## Acknowledgements

Built in gratitude to the [DiscoverEU programme](https://youth.europa.eu/discovereu), [EACEA](https://www.eacea.ec.europa.eu/), and [Türkiye Ulusal Ajansı](https://www.ua.gov.tr/) for making youth mobility possible. Open-source foundations: Leaflet, Chart.js, jsPDF, html2canvas, LZ-string, Natural Earth, OpenStreetMap, Wikivoyage, Wheelmap, ILGA-Europe, Open-Meteo, OpenTripMap, Wikimedia Commons.

---

*Community-built, not officially endorsed by the European Commission, EACEA, or Interrail/Eurail. It exists to help young Europeans make the most of the DiscoverEU opportunity.*
