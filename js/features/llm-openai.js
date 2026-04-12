// js/features/llm-openai.js
// OpenAI provider for the multi-LLM adapter.
// Endpoint: https://api.openai.com/v1/chat/completions (CORS enabled).
// Uses Bearer auth with user-provided key. OpenAI is NOT free — users
// must fund their account; UI shows a note next to the "Get key" link.

import { AuthError, RateLimitError, NetworkError, ParseError } from './llm-groq.js';

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export const id = 'openai';
export const label = 'OpenAI';

export async function send(messages, options = {}, apiKey) {
  if (!apiKey) throw new AuthError('missing key');

  const body = {
    model: options.model || DEFAULT_MODEL,
    messages: (messages || []).map(m => ({ role: m.role, content: m.content })),
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 1200
  };
  if (options.jsonMode) body.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: options.signal
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new NetworkError('aborted');
    throw new NetworkError(err?.message || 'network error');
  }

  if (res.status === 401 || res.status === 403) throw new AuthError(`HTTP ${res.status}`);
  if (res.status === 429)                       throw new RateLimitError('HTTP 429');
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const eb = await res.json(); detail = eb?.error?.message || detail; } catch (_) {}
    if (res.status >= 500) throw new NetworkError(detail);
    throw new ParseError(detail);
  }

  let json;
  try { json = await res.json(); } catch (_) { throw new ParseError('invalid JSON response'); }
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new ParseError('missing choices[0].message.content');
  return { content, raw: json, usage: json?.usage || {} };
}
