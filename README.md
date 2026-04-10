# DiscoverEU Companion

> **An accessible, green, and inclusive trip-planning companion for all European youth.**
> Built to lower the threshold for participation in the [DiscoverEU](https://youth.europa.eu/discovereu) programme.

## What is this?

DiscoverEU is the European Union initiative that gives 18-year-olds a free travel pass to explore Europe by train. **DiscoverEU Companion** is a free, open-source, single-page web application that helps participants plan, budget, travel, and remember their journey — with special attention to participants facing greater obstacles (Turkish applicants requiring Schengen visas, participants with fewer opportunities, travellers with accessibility needs, LGBTQ+ youth).

**Live site:** `https://embeddedjedi.github.io/discovereu-companion` *(coming soon)*

## Key features

### Planning
- 🗺 **Interactive 44-country map** with zoom-based labels and thematic filters
- 🚂 **Drag-and-drop route builder** with 7 travel-day progress tracking
- ⚠️ **Mandatory-reservation warning system** — never get caught paying penalties on a TGV again
- 🎟 **4 free DiscoverEU seat-reservation credit tracker** (not available in any other tool!)
- 💶 **Real-time budget calculator** — 4 people, multi-currency (EUR / TL / PLN / ...)
- 🧭 **Pre-built templates** — Balkan, Western Classic, Nordic Adventure, Mediterranean Sun, Green Route, Inclusion Route

### Inclusion (DiscoverEU-aligned)
- ♿ **Wheelmap accessibility filter** — wheelchair-friendly stations, hostels, venues
- 🏳️‍🌈 **ILGA Rainbow Map** LGBTQ+ safety layer
- 🗣 **6 languages core** — EN / DE / FR / ES / IT / TR + community translations
- 💰 **Fewer-opportunities low-budget mode**

### Sustainability
- 🌱 **CO₂ comparison vs flying** with "Green Traveler" badge
- 🌿 **Slow-travel suggestions**

### Fun & memories
- 🎴 **City Bingo cards** — photo challenges & achievements
- 🌅 **Daily Dare** micro-quest push
- 📍 **Passive GPS trip journal** (Polarsteps-lite)
- 🎙 **Voice memory capsule** — 30 seconds of sound per day
- 🎵 **Country Soundtrack** — Spotify Top 50 by country
- 📖 **Trip book export** — PDF + optional physical print
- ✉️ **FutureMe time capsule** — an email from your 18-year-old self, one year later

### Practical safety
- 🌙 **Night-arrival shield** — 22:00+ filter + 24/7 check-in hostels
- 🚨 **Pickpocket heatmap**
- 🎒 **Smart packing assistant** — weather + days + transport aware
- 🩺 **Offline emergency phrases** — pharmacy, allergy, "I need help"
- 👥 **Group vote module** — for 4-person groups
- 📴 **PWA offline mode** — works on trains with no signal

### AI assistance
- 🤖 **Natural-language route suggestion** — "10 days, museums + beach, under €800"

### Turkish bonus layer
- 🛂 Schengen visa checklist (18-year-old variant)
- 🚆 Sofia Express connector (DiscoverEU pre-segment)
- 💱 TL budget mode + Wise/Revolut guidance

## Tech

- **Vanilla JavaScript (ES modules)** — no build step, `index.html` runs anywhere
- **Leaflet** — map engine
- **Chart.js** — radar charts
- **jsPDF + html2canvas** — PDF & shareable card export
- **LZ-string** — URL-encoded route sharing
- **Natural Earth GeoJSON** — public-domain country boundaries
- **Wikivoyage / OpenTripMap / Open-Meteo / Wheelmap / ILGA Rainbow Map** — open data sources
- **GitHub Pages** — free hosting

## Data sources

All data is CORS-friendly and uses free tiers or CC-licensed datasets. See [`data/SOURCES.md`](data/SOURCES.md) for the full attribution list.

## Contributing

Translations, country data corrections, hostel recommendations, route templates — PRs welcome. Open an issue first for larger features.

## License

[MIT](LICENSE) — do what you want, just don't blame us if your 22:00 train to Prague gets cancelled.

---

*This is a community-built tool and is not officially endorsed by the European Commission, EACEA, or Interrail/Eurail. It exists to help young Europeans make the most of the DiscoverEU opportunity.*
