// js/features/translate.js
// LLM-based translation for the Language Bridge feature.
//
// Uses the unified llm-adapter (`sendPrompt`) so any configured provider
// (Groq / Gemini / OpenAI) is supported transparently. Results are cached
// in-memory for the session only (no persistence — keeps phrase history
// private to the tab).
//
// Exports:
//   translate(text, { from, to, context, signal })
//   detectLanguage(text)
//   getRecentTranslations()

import { sendPrompt, AuthError, RateLimitError } from './llm-adapter.js';

const MAX_CACHE = 50;
// Insertion-ordered Map → acts as LRU when we delete+reinsert on hit.
const cache = new Map();

function cacheKey(from, to, text) {
  return `${from}|${to}|${text}`;
}

function cacheGet(key) {
  if (!cache.has(key)) return null;
  const v = cache.get(key);
  // LRU touch: move to end.
  cache.delete(key);
  cache.set(key, v);
  return v.result;
}

function cacheSet(key, result) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, { result, at: Date.now() });
  while (cache.size > MAX_CACHE) {
    const oldest = cache.keys().next().value;
    cache.delete(oldest);
  }
}

function mapError(err) {
  if (err instanceof AuthError) return new Error('translate-no-key');
  if (err instanceof RateLimitError) return new Error('translate-rate-limit');
  // Surface abort / network errors unchanged.
  return err;
}

function buildSystemPrompt(from, to, context) {
  const contextBlock = context
    ? `SITUATION: ${context}`
    : 'SITUATION: generic traveler interaction (hostel, station, café, shop, or street) with a stranger.';
  return [
    `You are a phrasebook translator for an 18-year-old DiscoverEU traveler who will say this phrase OUT LOUD to a European local within minutes. Optimize for being UNDERSTOOD, not for grammatical elegance. You follow the same conventions Lonely Planet, Berlitz and DK Eyewitness pocket phrasebooks use.`,
    `Translate from ${from === 'auto' ? 'the detected source language' : from} to ${to}.`,
    ``,
    `=== REGISTER (the most important decision) ===`,
    `Default to FORMAL register with strangers, shopkeepers, staff, police, anyone visibly over ~25:`,
    `  German Sie · French vous · Italian Lei · Spanish usted · Portuguese o senhor/a senhora · Polish Pan/Pani · Czech vy · Russian вы · Dutch u.`,
    `Use INFORMAL only when the situation clearly is: hostel dorm-mate of similar age, peer the traveler already tu'd with, or a child. Scandinavian languages (Swedish, Norwegian, Danish) are universally informal — no formal exists in modern usage.`,
    `Getting register wrong is never offensive coming from a foreigner, so when in doubt, FORMAL is free safety.`,
    ``,
    `=== CULTURAL SUBSTITUTION (don't translate literally) ===`,
    `Many phrases need cultural swaps, not word-for-word mapping. Examples:`,
    `  "excuse me" (to pass through a crowd):  IT permesso · FR pardon · DE Entschuldigung · ES perdón`,
    `  "excuse me" (to get attention):          IT scusi (formal) / scusa (casual) · RU извините · DE Entschuldigung`,
    `  "you're welcome": varies wildly — FR je vous en prie (formal) / de rien (casual) · ES de nada · DE bitte · CZ není zač · IT prego`,
    `  "please" doesn't exist in Scandinavian languages — tone + tack/takk covers it.`,
    `  "how are you?" is a real question (not a greeting) in FR/DE/RU — don't use with strangers.`,
    `Pick what a native would ACTUALLY say in this situation, not the dictionary equivalent.`,
    ``,
    `=== ROMANIZATION FOR NON-LATIN SCRIPTS ===`,
    `For Greek, Bulgarian/Russian/Serbian Cyrillic, Ukrainian, etc. — output BOTH the native script AND a pronounceable romanization the traveler can read aloud. Use practical/tourist romanization, never academic ISO 9.`,
    `Format: "Ευχαριστώ (efharistó)" · "Спасибо (spasiba)" · "Здравствуйте (zdrastvuyte)" · "Дякую (dyakuyu)".`,
    `For Serbian, prefer the Latin-script form (Serbia officially uses both; Croatia/Bosnia only Latin).`,
    `For Latin-script targets (FR, DE, IT, ES, PT, NL, PL, CZ, HU, RO, HR, etc.) do NOT append pronunciation.`,
    ``,
    `=== EMERGENCY PHRASES STAY BLUNT ===`,
    `If the source signals urgency (help, lost, doctor, hospital, police, fire, allergic, attack, robbed), DROP politeness softening. Cultural norms suspend in emergencies.`,
    `  GOOD: "Arzt, bitte" · "Médecin, s'il vous plaît" · "Medico, per favore" · "Au secours!" · "Hilfe!"`,
    `  BAD: "Entschuldigung, könnten Sie vielleicht einen Arzt..."`,
    ``,
    `=== SHORT IS GOOD ===`,
    `The traveler is reading off a phone screen at a counter. 1-4 words beats a full sentence:`,
    `  Prices: just "Quanto?" / "Combien?" / "Wie viel?" — not a full sentence.`,
    `  Directions: "Wo ist [place]?" / "Dove [place]?" while pointing.`,
    `  Numbers/prices: render as digits + currency word ("20 euro"), never spell out.`,
    ``,
    `=== ONE PHRASE, NOT A MENU ===`,
    `Return ONE translation. Never offer alternatives or variants — beginners freeze when given choices. Pick the single highest-coverage formal version and ship it.`,
    `If the source is already in the target language, return it unchanged with confidence "high".`,
    ``,
    contextBlock,
    ``,
    `Confidence rubric: "high" = fixed phrase you are certain about; "medium" = correct but a native might tweak the register or word choice; "low" = source is ambiguous or contains slang/proper-names you had to guess.`,
    `Return ONLY the JSON object — no markdown, no commentary, no alternatives:`,
    `{"translated": "...", "sourceLang": "${from}", "targetLang": "${to}", "confidence": "high"|"medium"|"low"}`
  ].filter(Boolean).join('\n');
}

/**
 * Translate text using the active LLM provider.
 * @param {string} text
 * @param {{from?:string, to:string, context?:string|null, signal?:AbortSignal}} opts
 * @returns {Promise<{translated:string, sourceLang:string, targetLang:string, confidence:'high'|'medium'|'low'}>}
 */
export async function translate(text, { from = 'auto', to, context = null, signal } = {}) {
  if (!text || typeof text !== 'string') {
    throw new Error('translate-empty-input');
  }
  if (!to || typeof to !== 'string') {
    throw new Error('translate-missing-target');
  }

  const key = cacheKey(from, to, text);
  const cached = cacheGet(key);
  if (cached) return cached;

  const system = buildSystemPrompt(from, to, context);
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: text }
  ];

  let resp;
  try {
    resp = await sendPrompt({ messages, jsonMode: true, signal });
  } catch (err) {
    throw mapError(err);
  }

  let parsed;
  try {
    parsed = JSON.parse(resp.content);
  } catch (_) {
    // Some providers wrap JSON in code fences even in jsonMode.
    const m = String(resp.content || '').match(/\{[\s\S]*\}/);
    if (!m) throw new Error('translate-malformed');
    try {
      parsed = JSON.parse(m[0]);
    } catch (_err) {
      throw new Error('translate-malformed');
    }
  }

  if (!parsed || typeof parsed.translated !== 'string') {
    throw new Error('translate-malformed');
  }

  const result = {
    translated: parsed.translated,
    sourceLang: typeof parsed.sourceLang === 'string' ? parsed.sourceLang : from,
    targetLang: typeof parsed.targetLang === 'string' ? parsed.targetLang : to,
    confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium'
  };

  cacheSet(key, result);
  return result;
}

/**
 * Detect the ISO 639-1 language code of a text sample using the LLM.
 * Falls back to 'unknown' if the LLM is unavailable or the response is unusable.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'unknown';

  const messages = [
    {
      role: 'system',
      content:
        'Identify the language of the user\'s text. Respond with ONLY the ISO 639-1 two-letter code (e.g. "en", "fr", "tr"). No punctuation, no explanation.'
    },
    { role: 'user', content: text }
  ];

  try {
    const resp = await sendPrompt({ messages, jsonMode: false });
    const raw = String(resp.content || '').trim().toLowerCase();
    const m = raw.match(/[a-z]{2}/);
    return m ? m[0] : 'unknown';
  } catch (_err) {
    return 'unknown';
  }
}

/**
 * Return last 20 cached translations, newest first.
 * Shape: [{ from, to, text, translated, sourceLang, targetLang, confidence, at }]
 */
export function getRecentTranslations() {
  const entries = Array.from(cache.entries());
  // cache is insertion-ordered; newest is at the end.
  entries.reverse();
  return entries.slice(0, 20).map(([key, { result, at }]) => {
    const [from, to, ...rest] = key.split('|');
    const text = rest.join('|');
    return {
      from,
      to,
      text,
      translated: result.translated,
      sourceLang: result.sourceLang,
      targetLang: result.targetLang,
      confidence: result.confidence,
      at
    };
  });
}
