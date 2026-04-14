// js/features/ai-assistant.js
// High-level AI route suggestion pipeline:
//   1. Gather a compact country context block (top-10 matches for the
//      user's prompt against countries.json + guides.json summaries)
//   2. Build a system prompt with DiscoverEU rules (outbound + return leg)
//   3. Call the active LLM provider in JSON mode
//   4. Validate the returned route against data/countries.json
//   5. Return { stops, returnLeg, rationale, usage } or throw typed error

import { sendPrompt, getActiveProvider, getApiKey, ParseError } from './llm-adapter.js';
import { state } from '../state.js';
import { loadGuides } from '../data/loader.js';
import { h } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';

const MAX_STOPS = 20;
const MAX_NIGHTS_PER_STOP = 14;
const MAX_TOTAL_DAYS = 30;
const MAX_RETURN_STOPS = 2;
const TRANSPORT_ENUM = ['train', 'bus', 'flight', 'night-train'];

// Base system prompt. The caller injects runtime values (homeCountry/homeCity,
// includeReturnInBudget, seatCreditsLimit, travelDaysLimit) at call time.
function buildSystemPrompt(ctx) {
  const {
    homeCountry = '',
    homeCity = '',
    includeReturnInBudget = true,
    seatCreditsLimit = 4,
    travelDaysLimit = 7
  } = ctx || {};

  return `You are a DiscoverEU trip planner helping an 18-year-old plan a REAL Interrail-style round-trip: leave home, travel through Europe by rail, and come back safely in time.
You are NOT writing a brochure. You are deciding the actual order of countries, how many nights in each, and how the traveler gets home.

EUROPEAN RAIL TOUR LOGIC (this is how Seat61, Interrail.eu and experienced r/Interrail backpackers actually plan — follow it):

1. ONE REGION PER TRIP. Pick ONE contiguous region and stay in it. Cross-region hops burn 2+ travel days and destroy the pass math.
   Standard regional archetypes you should steer toward:
   - Benelux + Rhine:           NL → BE → DE (west) → FR
   - Iberia:                    PT → ES (+ optionally south FR via Barcelona)
   - Italy + Adriatic:          IT → SI → HR (+ optional AT extension via Villach)
   - Central Europe:            DE → CZ → AT → HU → PL → SK
   - Balkans:                   SI → HR → RS → BG → RO → GR (thin rail, buses fill gaps)
   - Scandinavia:               DK → SE → NO → FI (ferries between some legs)
   - Alpine / France-Swiss-N.Italy: FR → CH → IT (north)
   Natural gateway cities when two regions MUST be bridged: Munich, Vienna, Milan, Paris, Berlin, Zurich. Route through exactly ONE gateway, never two.
   Anti-pattern (reject this even if the user asks): Lisbon → Warsaw → Athens style scatter. Explain briefly in the rationale why you clustered.

2. PACING — the 2-3-4 RULE:
   - Small town (Hallstatt, Cinque Terre, Bruges): minimum 2 nights.
   - Medium city (Porto, Krakow, Salzburg, Ghent): 3 nights.
   - Capital / major (Rome, Paris, Berlin, Barcelona, Vienna, Amsterdam): 4 nights.
   - NEVER 1-night stays except when the "stay" is actually a night-train transit — in that case mark transport: "night-train" and set nights: 1 with a note.
   - Realistic country count: 20 days → 4-5 countries. 30 days → 5-7 countries. If the user asks for 10+ countries, push back in the rationale and deliver a tighter plan.

3. NIGHT-TRAIN STRATEGY. A night train is the right tool when a leg is 8h+, saves a paid hotel, and arrives 07:00-09:00 (not 05:00). Real live routes to prefer (2025-26):
   - ÖBB Nightjet: Vienna↔Paris, Vienna↔Rome/Milan/Venice, Munich↔Rome, Zurich↔Amsterdam, Berlin↔Paris, Berlin↔Brussels, Vienna↔Hamburg
   - European Sleeper: Brussels↔Amsterdam↔Berlin↔Prague
   - Snälltåget: Stockholm↔Hamburg (summer Berlin)
   - SNCF Intercités de Nuit: Paris↔Nice, Paris↔Toulouse, Paris↔Briançon
   - Balkans: Zagreb↔Split, Belgrade↔Bar
   Skip night trains on legs <6h (arrive 03:00) or when the traveler needs real sleep before a physical day (hiking, long hostel check-in queue).

4. RESERVATION-MANDATORY vs OPEN.
   - Reservation REQUIRED (€10-€35 each, on top of the pass) — warn in rationale so the user pre-books: France TGV/Intercités/Ouigo; Spain AVE/Avant/Alvia; Italy Frecciarossa/Frecciargento/Italo; Portugal Alfa Pendular/IC; Eurostar (London↔Paris/Brussels/Amsterdam); ALL night trains (couchette fee).
   - Reservation-FREE (just board): Germany ICE/IC/regional; NL/BE/LU all; Austria Railjet (optional); Switzerland; Czech/Poland/Hungary/Slovakia; most Nordic intercity.
   - If the trip is France/Spain/Italy-heavy, explicitly tell the user to budget €80-€150 for reservation fees.

5. BUDGET MIXING. Alternate cheap and expensive segments so the weekly average fits the user's budget tier:
   - Cheap (~€40-60/day): PT, CZ, PL, HU, RO, BG, HR inland, GR off-peak
   - Mid (~€70-100/day): ES, IT, DE, AT, Benelux, FR outside Paris
   - Expensive (~€120-200/day): CH, NO, IS, DK, UK, Paris/Amsterdam centers

6. FLOW / SEQUENCING:
   - Start near home — recover from travel-day fatigue in a cheap, easy first city. Don't put the "wow" destination on day 1; put it mid-trip (day 5-10).
   - NEVER backtrack. Paris → Berlin → Paris again is two wasted days. Each stop must advance the arc toward the furthest point or back toward home.
   - Prefer direct cross-border rail links: Lisbon↔Madrid (Lusitania NT), Milan↔Munich (Brenner), Copenhagen↔Hamburg, Vienna↔Budapest (Railjet 2h40), Paris↔Barcelona (TGV), Brussels↔Amsterdam↔Berlin (European Sleeper).
   - End the outbound leg within ONE cheap rail leg of home so the return is easy. Do NOT end at the furthest point from home.

Respond ONLY with JSON matching this exact shape:
{
  "stops": [
    { "countryId": "<ISO2>", "nights": <1..14>, "reason": "<concrete why: rail link, arrival-day feasibility, cost fit, or a single attraction that justifies the stay>" }
  ],
  "returnLeg": {
    "stops": [
      {
        "countryId": "<ISO2>",
        "cityId": "<city slug or empty>",
        "nights": <1..14>,
        "transport": "<train|bus|flight|night-train>",
        "note": "<why this stopover on the way home — night-train rest, border break, last unused seat credit>"
      }
    ],
    "transport": "<train|bus|flight>",
    "reasoning": "<one short paragraph: how the traveler actually gets from the last outbound stop back to ${homeCountry || 'home'}>"
  },
  "rationale": "<one paragraph written TO the traveler, 2nd person. Cover: why this order (geography + rail adjacency), rough daily budget fit, 1 reservation-mandatory leg to pre-book, 1 thing to pack for the climate mix, and how the return gets them home without wasted travel days>"
}

HARD RULES:
- countryId MUST be one of the provided ISO codes. Never invent a country not in the list.
- Max 20 outbound stops. Total nights across outbound stops <= 30.
- Minimum 2 nights per stop UNLESS it is a deliberate transit/night-train stopover (then 1 night is fine, say so in "reason").
- Chain countries that share a land border or have a known direct rail/night-train link. Avoid zig-zags that waste travel days.
- If any leg requires mandatory seat reservation (TGV, AVE, Italo, Frecciarossa, Eurostar, most night trains), flag it in the rationale so the traveler pre-books.
- Honor the user's stated constraints: budget tier (low/mid/high costPerDay from country data), accommodation type, accessibility needs, LGBTQ+ safety preference, green/low-flight preference, dietary needs.
- Answer in the user's interface language. Use 2nd person ("you will…"), not 3rd person.
- Do NOT wrap the JSON in markdown. Do NOT add commentary outside the JSON object.

ROUND-TRIP PLANNING (this is a real trip, not a fantasy itinerary):
- Home: ${homeCountry || '(unknown)'} / ${homeCity || '(unknown)'}. The traveler MUST end at home.
- The return leg can include 0-2 intermediate stops ONLY if they add real value: night-train rest break, a country reachable only on the way back, or using an unused seat-credit day.
- If the most direct return is a single overnight train or one flight, returnLeg.stops = [] and the reasoning explains which leg to book.
- includeReturnInBudget=${includeReturnInBudget}: if true, outbound + return combined MUST stay within seatCreditsLimit=${seatCreditsLimit} and travelDaysLimit=${travelDaysLimit}. If false, outbound alone uses the budget and the return is additional.
- For Turkish travelers with a consulate appointment flagged, put a Schengen-entry country (e.g. Greece via Alexandroupoli, Bulgaria via Svilengrad) as the first outbound stop and remind them in the rationale to carry the visa sticker.`;
}

function buildCountryContext(countries, guides) {
  const lines = [];
  for (const c of countries) {
    const guide = guides?.countries?.[c.id];
    const summary = (guide?.summary || c.description || '').slice(0, 200);
    const parts = [`${c.id} — ${c.name} (capital: ${c.capital || '?'})`];
    if (c.costPerDay) {
      parts.push(`€/day low/mid/high: ${c.costPerDay.low}/${c.costPerDay.mid}/${c.costPerDay.high}`);
    }
    if (Array.isArray(c.highlights) && c.highlights.length) {
      parts.push(`highlights: ${c.highlights.slice(0, 3).join(', ')}`);
    }
    if (c.accessibilityScore != null) parts.push(`accessibility: ${c.accessibilityScore}/5`);
    if (c.lgbtqSafety) parts.push(`lgbtq: ${c.lgbtqSafety}`);
    if (summary) parts.push(summary);
    if (guide?.avoidPitfalls?.length) {
      parts.push(`pitfalls: ${guide.avoidPitfalls.slice(0, 2).join('; ')}`);
    }
    lines.push(parts.join(' | '));
  }
  return lines.join('\n');
}

function validateStops(stops, countryIndex) {
  if (!Array.isArray(stops)) throw new ParseError('stops not an array');
  if (stops.length === 0)    throw new ParseError('stops empty');
  if (stops.length > MAX_STOPS) stops.length = MAX_STOPS;
  let totalNights = 0;
  const cleaned = [];
  for (const s of stops) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.countryId || '').toUpperCase();
    if (!countryIndex[id]) continue;
    const n = Math.max(1, Math.min(MAX_NIGHTS_PER_STOP, parseInt(s.nights, 10) || 2));
    if (totalNights + n > MAX_TOTAL_DAYS) break;
    totalNights += n;
    cleaned.push({ countryId: id, nights: n, reason: String(s.reason || '').slice(0, 200) });
  }
  if (cleaned.length === 0) throw new ParseError('no valid countryIds after validation');
  return cleaned;
}

// Validate/clean an AI-proposed returnLeg. Never throws — returns null on failure
// so the outbound route can still be applied.
function validateReturnLeg(leg, countryIndex) {
  if (!leg || typeof leg !== 'object') return null;
  const rawStops = Array.isArray(leg.stops) ? leg.stops.slice(0, MAX_RETURN_STOPS) : [];
  const stops = [];
  for (const s of rawStops) {
    if (!s || typeof s !== 'object') continue;
    const id = String(s.countryId || '').toUpperCase();
    if (!countryIndex[id]) continue;
    const transport = TRANSPORT_ENUM.includes(s.transport) ? s.transport : 'train';
    const nights = Math.max(1, Math.min(MAX_NIGHTS_PER_STOP, parseInt(s.nights, 10) || 1));
    stops.push({
      countryId: id,
      cityId: String(s.cityId || '').slice(0, 40),
      nights,
      transport,
      note: String(s.note || '').slice(0, 200)
    });
  }
  const transport = ['train', 'bus', 'flight'].includes(leg.transport) ? leg.transport : 'train';
  const reasoning = String(leg.reasoning || '').slice(0, 600);
  return { stops, transport, reasoning };
}

/**
 * suggestRoute({ userPrompt, signal })
 *   → { stops, returnLeg, rationale, usage }
 */
export async function suggestRoute({ userPrompt, signal } = {}) {
  // Adapter picks the active provider (Groq / Gemini / OpenAI) and its key.
  const apiKey = getApiKey(getActiveProvider());
  if (!apiKey) { const e = new Error('missing key'); e.name = 'AuthError'; throw e; }

  const countries = state.getSlice('countries') || [];
  const guides = await loadGuides().catch(() => null);
  const countryIndex = Object.fromEntries(countries.map(c => [c.id, c]));

  const lang = state.getSlice('language') || 'en';
  const user = state.getSlice('user') || {};
  const route = state.getSlice('route') || {};
  const userBlock = [
    `interface language: ${lang}`,
    `home: ${user.homeCountry || '?'} / ${user.homeCity || '?'}`,
    `budget tier: ${user.budget || 'mid'} (use the matching €/day column from country data)`,
    `accommodation preference: ${user.accommodation || 'hostel'}`,
    user.accessibilityNeeds ? `accessibility needs: ${user.accessibilityNeeds}` : '',
    user.dietary ? `dietary: ${user.dietary}` : '',
    user.lgbtqPriority ? 'prioritize LGBTQ+ safe destinations' : '',
    user.greenPreference ? 'prefer rail/bus over flights; avoid short-haul flights' : '',
    user.consulateAppointment ? 'turkish passport + consulate appointment scheduled — first stop must be Schengen-entry country' : '',
    `seat-credit budget: ${route.seatCreditsLimit ?? 4} reservation days`,
    `total travel-day budget: ${route.travelDaysLimit ?? 7} days`,
    `include return in budget: ${route.includeReturnInBudget !== false}`
  ].filter(Boolean).join('\n');

  const prompt = [
    `User request: ${userPrompt || '(no specific request)'}`,
    '',
    'User profile:',
    userBlock,
    '',
    'Available country IDs (ISO2):',
    buildCountryContext(countries, guides)
  ].join('\n');

  const systemPrompt = buildSystemPrompt({
    homeCountry: user.homeCountry,
    homeCity: user.homeCity,
    includeReturnInBudget: route.includeReturnInBudget,
    seatCreditsLimit: route.seatCreditsLimit,
    travelDaysLimit: route.travelDaysLimit
  });

  const { content, usage } = await sendPrompt({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: prompt }
    ],
    jsonMode: true,
    signal
  });

  let parsed;
  try { parsed = JSON.parse(content); }
  catch (err) { throw new ParseError('LLM returned non-JSON'); }

  const stops = validateStops(parsed.stops, countryIndex);
  const rationale = String(parsed.rationale || '').slice(0, 800);
  const returnLeg = validateReturnLeg(parsed.returnLeg, countryIndex);

  // Persist the return leg immediately onto state.route so the route
  // renderer picks it up alongside the outbound stops. Consumers that
  // already apply `stops` via the existing result UI (replace/add) will
  // continue to work; returnLeg is written unconditionally here because
  // it belongs to the same route suggestion.
  if (returnLeg) {
    try {
      state.update('route', r => ({
        ...r,
        returnStops: returnLeg.stops,
        returnTransport: returnLeg.transport || r.returnTransport
      }));
    } catch (_) { /* non-fatal */ }
  }

  return { stops, returnLeg, rationale, usage };
}

/**
 * initAITrigger(btnSelector)
 *   Attaches a click listener that opens the AI modal.
 *   Lazy-imports ui/ai-modal.js so the modal module is not loaded
 *   on app boot.
 */
export function initAITrigger(btnSelector) {
  const el = document.querySelector(btnSelector);
  if (!el) return;
  el.addEventListener('click', async () => {
    const { openAIModal } = await import('../ui/ai-modal.js');
    openAIModal();
  });
}

/* ------------------------------------------------------------------ *
 * Optimize-return action                                              *
 *                                                                     *
 * The route builder (commit 53f3ff6) dispatches a custom event on     *
 * window: `ai:optimize-return`. When fired, we send a focused LLM     *
 * call that optimises ONLY the return leg (outbound is frozen) and    *
 * show a diff modal. The user can accept (writes the new returnStops  *
 * into state.route) or reject (no change).                            *
 * ------------------------------------------------------------------ */

let returnOptimizeInFlight = false;

async function handleOptimizeReturn() {
  if (returnOptimizeInFlight) return;
  returnOptimizeInFlight = true;

  const route = state.getSlice('route') || {};
  const user  = state.getSlice('user')  || {};
  const countries = state.getSlice('countries') || [];
  const countryIndex = Object.fromEntries(countries.map(c => [c.id, c]));

  const { showToast } = await import('../ui/toast.js');

  const apiKey = getApiKey(getActiveProvider());
  if (!apiKey) {
    showToast(t('ai.err.auth') || 'API key required', 'error');
    returnOptimizeInFlight = false;
    return;
  }

  showToast(t('ai.return.optimizing') || 'Planning your return…', 'info');

  const chosenMode = ['train', 'bus', 'flight'].includes(route.returnTransport)
    ? route.returnTransport
    : 'train';

  const MODE_RULES = {
    train: `The user has chosen TRAIN for the return leg. This is a DiscoverEU rail pass return.
- Prefer a night-train as the FINAL leg whenever a live corridor exists (ÖBB Nightjet, European Sleeper, Snälltåget, SNCF Intercités de Nuit, Balkan sleepers). Saves a hotel night and a travel day.
- Flag reservation-mandatory trains (France TGV, Spain AVE, Italy Frecciarossa/Italo, Eurostar, ALL night-trains) as €10-35 extra that must be booked ahead.
- Every stop must sit on a direct rail corridor toward home. No detours.
- Keep "transport" field = "train" (use "night-train" on individual stops if that specific leg is a sleeper).`,

    bus: `The user has chosen BUS for the return leg (FlixBus / Eurolines / national coach operators).
- Plan the return as long-distance coach hops. Typical realistic legs: FlixBus/Eurolines corridors (Paris↔Berlin, Berlin↔Warsaw↔Vilnius, Vienna↔Budapest↔Bucharest, Madrid↔Lisbon, Amsterdam↔London via Eurotunnel bus).
- Overnight coaches (10-14h) are the bus equivalent of night-trains — prefer them as the final leg to save a hotel night.
- Bus is slower than rail: if the total journey home is > ~24h of bus time, you MAY suggest 1 overnight stopover at a real coach hub (Frankfurt, Munich, Milan, Lyon, Prague) to break fatigue.
- Do NOT propose train-only corridors (e.g. no Eurostar). All stops must be reachable by intercity coach.
- Keep "transport" field = "bus" on every stop and on the leg.`,

    flight: `The user has chosen FLIGHT for the return leg (self-paid budget airline — DiscoverEU does not cover flights).
- Plan a DIRECT flight home from the last outbound stop whenever a budget carrier serves that airport → home airport (Ryanair, Wizz Air, easyJet, Transavia, Vueling, Pegasus). Return stops=[] in that case.
- Only add an intermediate stop if the last outbound city has NO direct budget flight home AND a nearby hub (≤4h rail/bus) does — in that case add ONE stop at the hub city with transport="train" or "bus" to position for the flight. Maximum 1 stop.
- Call out the specific airport pair and a realistic airline in the reasoning.
- Keep "transport" field = "flight" on the leg itself. Individual positioning stops may use "train" or "bus".`
  };

  const systemPrompt = `You plan ONLY the return leg of a real DiscoverEU round-trip. The outbound is FROZEN — do not modify it.
Your job: get the traveler from the LAST outbound stop back to ${user.homeCountry || '(home country unknown)'} / ${user.homeCity || '(home city unknown)'} with minimal wasted travel days.

USER-SELECTED RETURN MODE: ${chosenMode.toUpperCase()} — you MUST honor this choice. Do not silently switch modes.

FROZEN OUTBOUND (last stop is the departure point of the return):
${JSON.stringify(route.stops || [])}

MODE-SPECIFIC RULES:
${MODE_RULES[chosenMode]}

UNIVERSAL RULES:
- NEVER backtrack through a city already visited on the outbound leg — the #1 rookie mistake on return threads.
- NEVER add a stop just to "see one more country" on the way home. The traveler is tired.
- If a single direct leg home is feasible, return stops=[] and explain which leg/flight/bus to book in the reasoning.
- Respect includeReturnInBudget=${route.includeReturnInBudget} (seatCreditsLimit=${route.seatCreditsLimit ?? 4}, travelDaysLimit=${route.travelDaysLimit ?? 7}).

OUTPUT: JSON only, no markdown, no commentary. The top-level "transport" MUST equal "${chosenMode}".
{ "returnLeg": { "stops": [{ "countryId": "<ISO2>", "cityId": "<slug>", "nights": <1..14>, "transport": "<train|bus|flight|night-train>", "note": "<why this stopover>" }], "transport": "${chosenMode}", "reasoning": "<one paragraph in 2nd person: which leg/flight/coach to book first, any reservation or booking warning, expected total travel time home>" } }`;

  let parsed;
  try {
    const { content } = await sendPrompt({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: 'Optimize my return.' }
      ],
      jsonMode: true
    });
    parsed = JSON.parse(content);
  } catch (err) {
    console.error('[ai-assistant] optimize-return failed', err);
    showToast(t('ai.err.network') || 'AI failed', 'error');
    returnOptimizeInFlight = false;
    return;
  }

  const proposed = validateReturnLeg(parsed?.returnLeg, countryIndex);
  if (!proposed) {
    showToast(t('ai.err.parse') || 'AI returned an unexpected response', 'error');
    returnOptimizeInFlight = false;
    return;
  }

  // Enforce the user's selected mode on the top-level leg even if the model
  // drifted — the prompt is authoritative, the UI selector is authoritative.
  proposed.transport = chosenMode;

  showReturnDiff(route.returnStops || [], proposed);
  returnOptimizeInFlight = false;
}

function stopLine(s) {
  // Build a short, human-readable stop summary WITHOUT innerHTML — pure DOM.
  const parts = [
    s.countryId || '?',
    s.cityId ? `/${s.cityId}` : '',
    ` · ${s.nights || 1}n`,
    s.transport ? ` · ${s.transport}` : ''
  ];
  return h('li', { class: 'route-return-diff-stop' }, parts.join(''));
}

function stopList(stops, emptyKey) {
  if (!stops || !stops.length) {
    return h('p', { class: 'route-return-diff-empty' },
      t(emptyKey) || '(direct return, no stops)');
  }
  return h('ul', { class: 'route-return-diff-list' },
    stops.map(stopLine));
}

function showReturnDiff(current, proposed) {
  const backdrop = h('div', {
    class: 'modal-backdrop',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': t('route.return.sectionTitle') || 'Return'
  });

  const close = () => backdrop.remove();

  const onAccept = () => {
    state.update('route', r => ({
      ...r,
      returnStops: proposed.stops,
      returnTransport: proposed.transport || r.returnTransport
    }));
    close();
  };

  // Use h() for every element; never innerHTML with interpolated content.
  const box = h('div', { class: 'modal-box route-return-diff' }, [
    h('h3', { class: 'route-return-diff-title' },
      t('route.return.sectionTitle') || 'Return'),

    h('div', { class: 'route-return-diff-col' }, [
      h('h4', {}, t('ai.return.current') || 'Current'),
      stopList(current, 'route.return.directHint')
    ]),

    h('div', { class: 'route-return-diff-col' }, [
      h('h4', {}, t('ai.return.proposed') || 'Proposed'),
      stopList(proposed.stops, 'route.return.directHint')
    ]),

    proposed.reasoning
      ? h('p', { class: 'route-return-diff-reasoning' }, proposed.reasoning)
      : null,

    h('div', { class: 'modal-actions' }, [
      h('button', {
        type: 'button',
        class: 'btn btn-primary',
        onclick: onAccept
      }, t('ai.return.accept') || 'Use this return'),
      h('button', {
        type: 'button',
        class: 'btn btn-ghost',
        onclick: close
      }, t('ai.return.reject') || 'Keep current return')
    ])
  ]);

  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close();
  });

  backdrop.appendChild(box);
  document.body.appendChild(backdrop);
}

// Listen once, at module load. The route builder dispatches this event.
if (typeof window !== 'undefined') {
  window.addEventListener('ai:optimize-return', handleOptimizeReturn);
}
