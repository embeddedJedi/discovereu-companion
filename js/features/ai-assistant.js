// js/features/ai-assistant.js
// High-level AI route suggestion pipeline:
//   1. Gather a compact country context block (top-10 matches for the
//      user's prompt against countries.json + guides.json summaries)
//   2. Build a system prompt with DiscoverEU rules
//   3. Call Groq in JSON mode
//   4. Validate the returned route against data/countries.json
//   5. Return { stops, rationale, usage } or throw typed error

import { sendPrompt, getActiveProvider, getApiKey, ParseError } from './llm-adapter.js';
import { state } from '../state.js';
import { loadGuides } from '../data/loader.js';

const MAX_STOPS = 20;
const MAX_NIGHTS_PER_STOP = 14;
const MAX_TOTAL_DAYS = 30;

const SYSTEM_PROMPT = `You are a DiscoverEU trip planner. Respond ONLY with JSON matching this exact shape:
{
  "stops": [
    { "countryId": "<ISO2>", "nights": <1..14>, "reason": "<short why>" }
  ],
  "rationale": "<one paragraph>"
}

Rules:
- countryId MUST be one of the provided ISO codes.
- Max 20 stops. Total nights across stops must be <= 30.
- Prefer rail-friendly adjacencies. Mention reservation-mandatory legs when relevant.
- Respect the user's stated constraints (budget, accessibility, LGBTQ+ safety, green preference).
- Answer in the user's interface language.
- Do NOT wrap the JSON in markdown. Do NOT add commentary outside the JSON object.`;

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

/**
 * suggestRoute({ userPrompt, signal })
 *   → { stops, rationale, usage }
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

  const { content, usage } = await sendPrompt({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
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

  return { stops, rationale, usage };
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
