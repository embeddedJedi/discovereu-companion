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
  const contextBlock = context ? `Context: ${context}` : '';
  return [
    `You are a translator for a young European traveler.`,
    `Translate the user's text from ${from} to ${to}.`,
    `- Preserve meaning, not literal word-for-word.`,
    `- Use polite register (formal you) unless context indicates casual.`,
    `- Do not add explanations or notes — return ONLY the translation.`,
    `- If the source text is already in target language, return it unchanged.`,
    contextBlock,
    `Output format: a single JSON object {"translated": "...", "sourceLang": "${from}", "targetLang": "${to}", "confidence": "high"|"medium"|"low"}`
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
