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

  return `You are a DiscoverEU trip planner. Respond ONLY with JSON matching this exact shape:
{
  "stops": [
    { "countryId": "<ISO2>", "nights": <1..14>, "reason": "<short why>" }
  ],
  "returnLeg": {
    "stops": [
      {
        "countryId": "<ISO2>",
        "cityId": "<city slug or empty>",
        "nights": <1..14>,
        "transport": "<train|bus|flight|night-train>",
        "note": "<short why>"
      }
    ],
    "transport": "<train|bus|flight>",
    "reasoning": "<one short paragraph>"
  },
  "rationale": "<one paragraph>"
}

Rules:
- countryId MUST be one of the provided ISO codes.
- Max 20 outbound stops. Total nights across outbound stops must be <= 30.
- Prefer rail-friendly adjacencies. Mention reservation-mandatory legs when relevant.
- Respect the user's stated constraints (budget, accessibility, LGBTQ+ safety, green preference).
- Answer in the user's interface language.
- Do NOT wrap the JSON in markdown. Do NOT add commentary outside the JSON object.

Round-trip planning:
- The user's home is ${homeCountry}/${homeCity}. Plan BOTH outbound and return.
- The return leg may include 0-2 intermediate stops when it improves the trip
  (night-train stopover, scenic detour, using unused seat credits).
- Respect includeReturnInBudget=${includeReturnInBudget}: if true, your plan
  must not exceed seatCreditsLimit=${seatCreditsLimit} or travelDaysLimit=${travelDaysLimit}
  across outbound AND return combined.
- Return a routeSchema object with \`stops\` (outbound) and \`returnLeg\` (return).
- If no intermediate return stops are needed, return returnLeg.stops as [].`;
}

function buildCountryContext(countries, guides) {
  const lines = [];
  for (const c of countries) {
    const guide = guides?.countries?.[c.id];
    const summary = guide?.summary || c.description || '';
    lines.push(`${c.id} — ${c.name}: ${summary.slice(0, 140)}`);
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
    `language: ${lang}`,
    `budget: ${user.budget}`,
    `accommodation: ${user.accommodation}`,
    user.consulateAppointment ? 'has turkish consulate appointment scheduled' : ''
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

  const systemPrompt = `You plan ONLY the return leg of a DiscoverEU trip.
The outbound (frozen) is:
${JSON.stringify(route.stops || [])}
Home: ${user.homeCountry || ''}/${user.homeCity || ''}.
Return a JSON object { "returnLeg": { "stops": [...], "transport": "train|bus|flight", "reasoning": "..." } }.
0-2 intermediate stops. Each stop has countryId (ISO2), cityId, nights, transport (train|bus|flight|night-train), note.
Respect includeReturnInBudget=${route.includeReturnInBudget}.
Do NOT wrap the JSON in markdown. Do NOT add commentary outside the JSON object.`;

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
