// js/features/llm-groq.js
// Thin Groq REST adapter used by js/features/ai-assistant.js.
// Typed errors let the UI layer render tailored toasts / screens.
// No retries here — the modal handles that; we just surface the outcome.

const ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export class AuthError      extends Error { constructor(m){ super(m); this.name='AuthError'; } }
export class RateLimitError extends Error { constructor(m){ super(m); this.name='RateLimitError'; } }
export class NetworkError   extends Error { constructor(m){ super(m); this.name='NetworkError'; } }
export class ParseError     extends Error { constructor(m){ super(m); this.name='ParseError'; } }

/**
 * callGroq({apiKey, systemPrompt, userMessage, jsonMode, model, signal})
 *   → Promise<{ content: string, usage: object }>
 *
 * Throws:
 *   AuthError      on 401 / missing key
 *   RateLimitError on 429
 *   NetworkError   on 5xx / network failure / abort
 *   ParseError     if the server returns malformed JSON
 */
export async function callGroq({
  apiKey,
  systemPrompt,
  userMessage,
  jsonMode = false,
  model = DEFAULT_MODEL,
  signal
}) {
  if (!apiKey) throw new AuthError('missing key');

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt || '' },
      { role: 'user',   content: userMessage  || '' }
    ],
    temperature: 0.4,
    max_tokens: 1200
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new NetworkError('aborted');
    throw new NetworkError(err?.message || 'network error');
  }

  if (res.status === 401 || res.status === 403) throw new AuthError(`HTTP ${res.status}`);
  if (res.status === 429)                       throw new RateLimitError('HTTP 429');
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const errBody = await res.json();
      detail = errBody?.error?.message || detail;
    } catch (_) { /* ignore parse failure on error body */ }
    if (res.status >= 500) throw new NetworkError(detail);
    throw new ParseError(detail);
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    throw new ParseError('invalid JSON response');
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new ParseError('missing choices[0].message.content');

  return { content, usage: json?.usage || {} };
}
