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
