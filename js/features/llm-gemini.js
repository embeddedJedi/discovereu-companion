// js/features/llm-gemini.js
// Google Gemini provider for the multi-LLM adapter.
// Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}
// CORS: allowed for browser with user-provided key.
// Free tier: 15 RPM on Gemini 1.5 Flash (https://ai.google.dev/pricing).
//
// Translates standard chat messages → Gemini's `contents` format. Any
// `role: 'system'` message is folded into `systemInstruction`.

import { AuthError, RateLimitError, NetworkError, ParseError } from './llm-groq.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-1.5-flash';

export const id = 'gemini';
export const label = 'Gemini';

function toGeminiContents(messages) {
  const contents = [];
  let systemText = '';
  for (const m of messages || []) {
    if (!m || !m.content) continue;
    if (m.role === 'system') {
      systemText += (systemText ? '\n\n' : '') + String(m.content);
      continue;
    }
    const role = m.role === 'assistant' ? 'model' : 'user';
    contents.push({ role, parts: [{ text: String(m.content) }] });
  }
  return { contents, systemText };
}

export async function send(messages, options = {}, apiKey) {
  if (!apiKey) throw new AuthError('missing key');

  const { contents, systemText } = toGeminiContents(messages);
  const body = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: options.maxTokens ?? 1200
    }
  };
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
  if (options.jsonMode) body.generationConfig.responseMimeType = 'application/json';

  const model = options.model || DEFAULT_MODEL;
  const url = `${BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: options.signal
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new NetworkError('aborted');
    throw new NetworkError(err?.message || 'network error');
  }

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    // Gemini returns 400 for invalid keys — treat as auth.
    let detail = `HTTP ${res.status}`;
    try { const eb = await res.json(); detail = eb?.error?.message || detail; } catch (_) {}
    if (/api key|unauthenticated|permission/i.test(detail) || res.status !== 400) {
      throw new AuthError(detail);
    }
    throw new ParseError(detail);
  }
  if (res.status === 429) throw new RateLimitError('HTTP 429');
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const eb = await res.json(); detail = eb?.error?.message || detail; } catch (_) {}
    if (res.status >= 500) throw new NetworkError(detail);
    throw new ParseError(detail);
  }

  let json;
  try { json = await res.json(); } catch (_) { throw new ParseError('invalid JSON response'); }

  const parts = json?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map(p => (typeof p?.text === 'string' ? p.text : '')).join('')
    : '';
  if (!text) throw new ParseError('missing candidates[0].content.parts[*].text');

  const usage = json?.usageMetadata
    ? {
        prompt_tokens:     json.usageMetadata.promptTokenCount,
        completion_tokens: json.usageMetadata.candidatesTokenCount,
        total_tokens:      json.usageMetadata.totalTokenCount
      }
    : {};
  return { content: text, raw: json, usage };
}
