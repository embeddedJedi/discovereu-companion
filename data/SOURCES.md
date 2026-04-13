# Data Sources & Attribution

## Emergency numbers (2026-04-13)

- **EU 112 country pages** — `https://112.eu/en/countries/` — primary source for the general, police, ambulance, and fire numbers across all EU + EEA members in `data/emergency-numbers.json`. Each country block cites its specific 112.eu sub-page.
- **National interior ministries & police portals** — cross-checked per country (e.g. `bmi.gv.at`, `police.hu`, `policia.es`, `poliziadistato.it`, `politiet.no`, `politie.nl`, `polisen.se`, `psp.pt`, `egm.gov.tr`). Used to confirm short-code legacy numbers and tourist-police lines.
- **ILGA-Europe country pages** — `https://www.ilga-europe.org/` — only authoritative source consulted for `lgbtqiSafeLine` fields. Where no ILGA-recognised helpline exists the field is `null` by policy (a wrong number is worse than none). Currently populated only for IE (LGBT Ireland) and IT (Gay Help Line / Gay Center Rome).
- **Turkish Ministry of Interior + e-Devlet** — `icisleri.gov.tr`, `turkiye.gov.tr` — confirmed the 2021 consolidation of emergency lines under 112 and the Istanbul Tourist Police desk number.
- Refresh cadence: annually, or immediately on any publicly-announced number change. Contributors invited via GitHub issue to flag stale entries.

## Sub-project 1 sources (2026-04-11)

- **ILGA-Europe Rainbow Europe 2025** (annual report) — `https://www.ilga-europe.org/report/rainbow-europe-2025/` — LGBTQ+ rights scores for `data/rainbow-map.json`. Refreshed annually each May.
- **Wheelmap.org** (OSM-derived, CC BY-SA) — `https://wheelmap.org` — accessible venue counts for `data/accessibility.json`. EU Disability Card pilot metadata supplemented from `ec.europa.eu`.
- **EU 112 emergency registry** — `https://112.eu` — universal emergency number + per-country overrides for `data/emergency-phrases.json`. Phrase translations hand-authored by native speakers.

## Data polish E1 — Shared Mobility (2026-04-12)

- **Wikivoyage** (CC BY-SA) — `https://en.wikivoyage.org/` — city "Get around" sections informed the platform lists in `data/shared-mobility.json`.
- **Municipal transit operator websites** — RATP/Vélib' (Paris), BVG (Berlin), ATM (Milan), BiciMAD (Madrid), Bicing (Barcelona), BiciMAD, Dublinbikes, HSL (Helsinki), MOL Bubi (Budapest), MVG Rad (Munich), StadtRAD (Hamburg), Veturilo (Warsaw), WienMobil Rad (Vienna), etc. — price ranges and free-minute rules.
- **Platform coverage pages** — BlaBlaCar, Lime, Tier, Dott, Voi, Bolt, Uber, Free Now, Heetch, Cabify, Share Now, Free2move, Communauto, Greenwheels, MyWheels, GoMore, Klaxit, Karos, Oszkár, Panek, Traficar, Liftago, Swapfiets, Donkey Republic, OV-fiets, MARTI, BiTaksi, BinBin, İSBİKE, BİSİM. Country + city availability taken from each platform's public coverage/launch pages. Re-verify annually as the sector churns.
- All per-city price figures are approximate ranges; verify before booking.

## Sub-project 2 sources (2026-04-12)

- **Wikivoyage** (CC BY-SA 3.0) — `https://en.wikivoyage.org/` — country + city guide text for `data/guides.json`. Attribution preserved in each entry's `sourceUrl` field. Refreshed annually.
- **Spotify** — `https://open.spotify.com/genre/charts-regional` — regional Top 50 editorial playlist IDs for `data/soundtracks.json`. Embedded via iframe; playback governed by Spotify's own terms.
- **Groq** — `https://console.groq.com/` — Llama 3.1 70B Versatile model used for natural-language route suggestion. User provides their own API key; no proxy.
- **VFS Global / iDATA / TLScontact / BLS** — consulate application centre addresses in Turkiye for `data/tr-consulates.json`. Sourced from each provider's public Turkiye portal; providers occasionally change contracts so refresh quarterly.

## Core data sources (2026-04-10)

- **Natural Earth** (public domain) — `https://www.naturalearthdata.com/` — 1:50m country boundaries for `data/geojson/europe.geojson`. Simplified to 36 European features.
- **Kaggle Cost of Living** — `https://www.kaggle.com/datasets/` — per-country cost indices informing `data/countries.json` `costPerDay` fields.
- **Seat61** — `https://www.seat61.com/` — train route and mandatory reservation data for `data/trains.json` and `data/reservations.json`.
- **Eurail / Interrail** — `https://www.eurail.com/` — DiscoverEU pass rules, seat credit mechanics, participating countries.

## TR missions (2026-04-13)

- **Republic of Türkiye Ministry of Foreign Affairs — Representations index** — `https://www.mfa.gov.tr/representations.en.mfa` — authoritative list of TR embassies, consulate-generals, and honorary consulates worldwide. Primary source for `data/tr-missions.json`.
- **Per-mission mfa.gov.tr subdomains** — each TR mission publishes its own site under the pattern `<city>.be.mfa.gov.tr` (embassies), `<city>.bk.mfa.gov.tr` (consulate-generals), and `<city>.emb.mfa.gov.tr` (some embassies) — used for address, phone, email, and working hours of each entry.
- Honorary consulates (IS, LI, LU, MT) have limited consular capacity; TR citizens in those countries are typically served by the nearest resident embassy as noted in each entry's `notes` field.
- Cyprus: TR maintains diplomatic representation in the Turkish Republic of Northern Cyprus (Lefkoşa) and does not operate a mission in the Republic of Cyprus; this is noted in the CY entry.
- Refresh cadence: quarterly, or immediately on any publicly-announced change. `emergencyPhone` fields are null pending per-mission verification — most missions publish a 24/7 nöbetçi memur line on their site and these will be filled in a follow-up pass.

## Embassy lookup patterns (2026-04-13)

Source data for `data/embassy-lookup-pattern.json` — every `mfaUrl`, `embassyListUrl`, and `emergencyPhone` was verified against the issuing government's official foreign-affairs portal on 2026-04-13. Coverage: 33 DiscoverEU-eligible nationalities (incl. Türkiye) + 10 top non-European nationalities (US, GB, CA, AU, NZ, JP, KR, IN, BR, AR) = 43 entries.

- **Ministry of Foreign Affairs portals** — primary source for each entry. Notable directories:
  - UK FCDO — `https://www.gov.uk/world/embassies`
  - US State Department — `https://www.usembassy.gov/`
  - Canada Global Affairs — `https://travel.gc.ca/assistance/embassies-consulates`
  - Australia DFAT — `https://www.dfat.gov.au/about-us/our-locations/missions`
  - New Zealand MFAT — `https://www.mfat.govt.nz/en/embassies/`
  - Sweden — `https://www.swedenabroad.se/`
  - Norway — `https://www.norway.no/`
  - Finland — `https://finlandabroad.fi/`
  - Netherlands — `https://www.netherlandsworldwide.nl/`
  - France (MEAE) — `https://www.diplomatie.gouv.fr/`
  - Germany (AA) — `https://www.auswaertiges-amt.de/`
  - Italy (Farnesina) — `https://www.esteri.it/`
  - Spain — `https://www.exteriores.gob.es/`
  - Türkiye (MFA) — `https://www.mfa.gov.tr/`
  - Japan MOFA — `https://www.mofa.go.jp/`
  - Korea MOFA — `https://www.mofa.go.kr/`
  - India MEA — `https://www.mea.gov.in/`
  - Brazil Itamaraty — `https://www.gov.br/mre/`
  - Argentina Cancillería — `https://www.cancilleria.gob.ar/`
- **Emergency hotlines** — cross-checked against each MFA's public "consular emergency" / "crisis centre" page. Where a single public 24/7 number is not published (AR), the field is `null` and `emergencyNote` directs users to the post-specific duty officer.
- **Liechtenstein** — consular representation is provided by Switzerland abroad under the 1919 Liechtenstein-Switzerland Customs and Representation Treaty; both numbers documented.
- Refresh cadence: annually, or immediately when a user issue reports a dead URL. Contributors invited via GitHub issue.

## Impact public dataset (2026-04-13)

- **Internal aggregation** — no external sources. `data/impact-public.json` is produced by the Node freeze script (`scripts/freeze-impact.mjs`, Task 8) from user-contributed trip summaries merged via GitHub PR. The anonymization pipeline (k-anonymity threshold k=5) is defined in `docs/superpowers/specs/2026-04-13-impact-dashboard-design.md` and implemented in `js/impact-anonymize.js`.
- **License** — CC-BY-4.0 applies **only** to `data/impact-public.json`; the rest of `/data/` retains upstream licenses documented elsewhere in this file. Full terms: `data/LICENSE-impact-public.md`.
- **Seed state** — the committed seed file has `inputCount: 0` and zeroed aggregates. It is rewritten in place by the freeze script once contribution PRs are merged.
- Refresh cadence: on-demand, after each batch of merged contribution PRs.

## Crisis flowcharts (2026-04-13)

- **Turkish MFA Consular Services** — `https://www.mfa.gov.tr/consular-info.en.mfa` — authoritative guidance on lost/stolen Turkish passport abroad, Emergency Travel Document (ETD) procedure, and nearest mission lookup. Cited from the `lost-passport` flow terminal.
- **Your Europe — Payments & cards** — `https://europa.eu/youreurope/citizens/consumers/financial-products-and-services/payments-transfers-cheques/index_en.htm` — EU consumer rights on lost/stolen bank cards, freeze obligations, issuer liability caps. Cited from the `lost-card` bank branch terminal.
- **Interrail FAQ — Lost Pass** — `https://www.interrail.eu/en/support/customer-service/faqs` — official Interrail policy for lost or stolen Mobile/Paper Pass replacement. Cited from the `lost-card` Interrail branch terminal.
- **DiscoverEU participant portal** — `https://youth.europa.eu/discovereu_en` — official EACEA programme portal with travel-pass support contact. Cited from the `lost-card` DiscoverEU-ticket branch terminal.
- **EC EHIC page** — `https://ec.europa.eu/social/main.jsp?catId=559` — European Health Insurance Card coverage, rights, and use-abroad guidance. Cited from both `medical-emergency` emergency + urgent-care terminals.
- **Your Europe — Unplanned healthcare** — `https://europa.eu/youreurope/citizens/health/unplanned-healthcare/temporary-stays/index_en.htm` — pharmacy access, reimbursement for temporary stays. Cited from the `medical-emergency` minor branch terminal.
- Refresh cadence: annually, or on any publicly-announced policy change from MFA, EACEA, or EC DG SANTE.

## Wheelmap metro index (2026-04-13)

Source data for `data/wheelmap-metro-index.json` — step-free metro station seed covering 5 DiscoverEU cities (Paris, Berlin, Madrid, Rome, İstanbul). Coordinates cross-checked against OpenStreetMap node data; accessibility status taken from each operator's official map plus Wheelmap community verification.

- **Wheelmap.org** (ODbL, OSM-derived) — `https://wheelmap.org/` — community-verified wheelchair accessibility flags per station node.
- **OpenStreetMap** (ODbL) — `https://www.openstreetmap.org/` — latitude/longitude for every listed station.
- **RATP Accessibility (Paris)** — `https://www.ratp.fr/en/accessibility` — Line 14 full accessibility, RER A/B lift inventory.
- **BVG Accessibility (Berlin)** — `https://www.bvg.de/en/tickets-fares/all-about-tickets/accessibility` — U-Bahn/S-Bahn step-free station list (~83% coverage reported 2025).
- **Metro de Madrid — Accessibility** — `https://www.metromadrid.es/en/travel-in-the-metro/accessibility` — line-by-line accessible-station matrix; Lines 6, 8, 11, 12 fully step-free.
- **ATAC Roma — Accessibilità** — `https://www.atac.roma.it/accessibilita` — Line C full accessibility, Line A/B lift status (frequently updated for outages).
- **Metro İstanbul** — `https://www.metro.istanbul/en` — operator map confirming lift + platform-screen-door coverage on all post-2000 M-lines (M2, M3, M4, M5, M6, M7, M8, M9, M11) and Marmaray.
- License: ODbL attribution inherited from Wheelmap/OSM; curated per-city summary fields are CC BY-SA 4.0 under this project.
- Refresh cadence: annually, or when an operator publishes a new accessible-station list. Contributors invited via GitHub issue — curated seed list, not an exhaustive enumeration.

## Green hostels (2026-04-13)

Source data for `data/green-hostels.json` — curated seed of certified-green hostels across DiscoverEU cities. Every non-placeholder entry was cross-checked against a publicly cited source (the hostel operator's own page documenting certification, the certification body's country news feed, or an official national partner directory). Entries flagged `verify: true` are placeholders for cities where no specific hostel could be confirmed from the cert body's public directory at seed time — these must be validated or removed before launch.

- **Green Key International — global directory and country pages** — `https://www.greenkey.global/green-key-sites` — authoritative list of Green Key awarded sites worldwide.
- **Green Key Denmark directory** — `https://www.greenkey.dk/en/map-details/steel-house-copenhagen` — source for Steel House Copenhagen's Green Key status.
- **Green Key France (La Clef Verte)** — `https://www.laclefverte.org/` — national equivalent in France; cross-referenced via `https://www.mije.com/en/youth-hostel-in-paris/the-green-key-label-of-the-mije-fauconnier-hostel` and `https://www.hifrance.org/en/about-us/the-labels/green-key/`.
- **EU Ecolabel — Tourist accommodation product group** — `https://environment.ec.europa.eu/topics/circular-economy/eu-ecolabel_en` — official EU Ecolabel hotel/hostel registry.
- **USGBC LEED project directory** — `https://www.usgbc.org/projects` — authoritative LEED-certified project registry.
- **Biosphere Sustainable (Responsible Tourism Institute)** — `https://www.biospheretourism.com/` — certified sustainable destinations and establishments. Used for Kabul Party Hostel Barcelona via `https://www.kabul.es/2025-biosphere-certification-of-sustainability/`.
- **Nordic Swan Ecolabel directory** — `https://www.nordic-ecolabel.org/product-groups/group/?productGroupCode=055` — hotels, restaurants and conference facilities certified under Nordic Swan.
- **Destinet / Tourism2030 — Green Key STF listing** — `https://destinet.eu/who-who/market-place/certifiers-section/international-green-key/stf-af-chapman-skeppsholmen-hostel` — cross-reference for STF af Chapman & Skeppsholmen, Stockholm.

**Refresh cadence:** `verifiedAt` must be refreshed quarterly. Every certification is valid for 12 months and must be renewed by the property annually; a quarterly curator pass catches lapses. Contributors invited via GitHub issue to flag stale entries or propose new verified hostels (PR must include a sourceUrl pointing to the issuing body's public record).

## Buddy-matching cities (2026-04-13)

- **`data/buddy-cities.json`** — editorial seed of the 20 highest-traffic DiscoverEU destinations (per European Commission participant statistics) to bootstrap the buddy-matching feature. Cities: Paris, Berlin, Madrid, Rome, Barcelona, Amsterdam, Prague, Vienna, Budapest, Lisbon, Athens, Krakow, Warsaw, Copenhagen, Stockholm, Dublin, Brussels, Munich, Milan, İstanbul.
- **Coordinates** — İstanbul coordinates cross-referenced with the `cities[]` block in `data/countries.json`. The other 19 cities are not present in `countries.json` cities arrays (only Türkiye lists sub-cities), so lat/lng values were taken from publicly verified Wikipedia / OpenStreetMap canonical city centroids. No coordinates fabricated.
- **Issue routing** — each city maps to a GitHub label `buddy-{cityId}`. Maintainer curates the sticky issue per city post-launch, then updates the corresponding `issueNumber` and flips `active` to `true` in a follow-up PR (see plan `docs/superpowers/plans/2026-04-13-buddy-matching.md` §Maintainer curation).
- Refresh cadence: reviewed each time DiscoverEU publishes updated participant travel stats (roughly annually).

## Phrasebook seed (2026-04-13)

Scope: `data/phrasebook/de.json`, `fr.json`, `it.json`, `es.json`, `tr.json` — seed phrasebook of ~175 travel phrases per country across 9 categories (greetings, numbers, food, directions, emergency, everyday, shopping, time, travel). Source language is English; target is the authentic native phrase with polite register (Sie / vous / Lei / usted / siz) preferred as traveler meets strangers.

**Sources:**
- **Existing repo SSOT** — the 9 phrases per country in `data/emergency-phrases.json` were reused verbatim for the `emergency` category (entries flagged `"notes": "Source: emergency-phrases.json."`). This keeps the two datasets consistent and avoids drift.
- **BBC Languages / Memrise-style learner corpora** — structure and register conventions (polite Sie/vous/Lei/usted; natural idiomatic toasts like `Prost!`, `Santé!`, `Salute!`, `¡Salud!`, `Şerefe!` rather than literal translations of "Cheers!").
- **Wikivoyage phrasebooks** (CC BY-SA) — cross-reference for travel-specific vocabulary (ticket, platform, reservation, validate) and country-specific notes (IT regional trains require `convalido`; FR tap water is free via `une carafe`; TR `üstü kalsın` as standard tip phrasing).
- **Native/near-native consultation** — TR phrases curated by the maintainer (Emirhan Ekşi, L1 speaker). DE/FR/IT/ES require native-speaker review pass in quarterly refresh cycle.

**Content rules applied:**
- Every entry has required fields `id`, `category`, `source`, `target`; optional `ipa`, `audioHint`, `notes` filled where informative.
- Dietary-restriction phrases (vegan / vegetarian / halal / nut allergy / peanut allergy / lactose / gluten / no pork) included in every country's `food` category — high-stakes for inclusion.
- `audioHint` is English-letter approximation, not IPA. Designed for on-phone read-aloud, not linguistic accuracy.
- Culturally-specific bonus phrases added where they materially help a traveler: IT `cappuccino` (with note on morning-only convention), TR `Türk kahvesi` / `Afiyet olsun` / `İstanbulkart`.

**Coverage counts:** DE 175, FR 175, IT 175, ES 175, TR 176 (31 food entries — includes bonus `Afiyet olsun` and Turkish-coffee-specific phrasing). Other categories match plan spec exactly (20/20/25/15/25/15/10/15).

**Known limitations to flag in quarterly review:**
- IPA provided only on tricky/irregular words; most entries carry only `audioHint`.
- FR / ES polite-form usage was prioritised; informal (tu / tú) variants are NOT included in this seed.
- No regional variants (e.g., Catalan / Basque / Bavarian / Sicilian / Québecois) — national standard register only.

**Refresh cadence:** quarterly review pass by native speakers; next review due 2026-07-13. Add new countries as demand surfaces.
