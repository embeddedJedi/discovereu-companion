// js/features/llm-adapter.js
// Unified multi-provider LLM adapter. Dispatches to the currently active
// provider (Groq / Gemini / OpenAI). API keys are user-provided, stored
// per-provider in localStorage under `discoveru:llm-key-<id>`.
//
// Standard message format: [{ role: 'system'|'user'|'assistant', content }]
// Normalized response:     { content: string, raw: any, usage?: object }
//
// Errors thrown use the typed classes re-exported from ./llm-groq.js so
// existing error-handling code in ai-modal continues to work unchanged.

import { state } from '../state.js';
import { storage } from '../utils/storage.js';
import * as groq   from './llm-groq.js';
import * as gemini from './llm-gemini.js';
import * as openai from './llm-openai.js';

export { AuthError, RateLimitError, NetworkError, ParseError } from './llm-groq.js';

const PROVIDERS = {
  groq:   { module: groq,   id: 'groq',   label: 'Groq',   keyLabelKey: 'llm.getGroqKey',   keyPattern: /^gsk_[A-Za-z0-9]{20,}$/ },
  gemini: { module: gemini, id: 'gemini', label: 'Gemini', keyLabelKey: 'llm.getGeminiKey', keyPattern: /^AI[A-Za-z0-9_\-]{20,}$/ },
  openai: { module: openai, id: 'openai', label: 'OpenAI', keyLabelKey: 'llm.getOpenAIKey', keyPattern: /^sk-[A-Za-z0-9_\-]{20,}$/ }
};

const DEFAULT_PROVIDER = 'groq';
const LEGACY_GROQ_KEY = 'ai.groqKey';  // preserve v1.0 key if present

/** List providers for UI selectors. */
export function listProviders() {
  return Object.values(PROVIDERS).map(p => ({
    id: p.id, label: p.label, keyLabelKey: p.keyLabelKey, keyPattern: p.keyPattern
  }));
}

/** Active provider id. Reads state.settings.llmProvider then localStorage. */
export function getActiveProvider() {
  const settings = state.getSlice('settings') || {};
  const fromState = settings.llmProvider;
  const id = fromState || storage.get('llm-provider') || DEFAULT_PROVIDER;
  return PROVIDERS[id] ? id : DEFAULT_PROVIDER;
}

/** Set active provider id (persisted). */
export function setActiveProvider(id) {
  if (!PROVIDERS[id]) return;
  storage.set('llm-provider', id);
  // Mirror into state.settings if that slice exists
  try {
    const cur = state.getSlice('settings') || {};
    state.set('settings', { ...cur, llmProvider: id });
  } catch (_) { /* settings slice may not exist yet */ }
}

/** Read user's API key for a provider (or the active one if no id passed). */
export function getApiKey(providerId) {
  const id = providerId || getActiveProvider();
  const key = storage.get(`llm-key-${id}`);
  if (key) return key;
  // Back-compat: old Groq key
  if (id === 'groq') {
    const legacy = storage.get(LEGACY_GROQ_KEY) || state.getSlice('ai')?.groqKey;
    if (legacy) return legacy;
  }
  return null;
}

/** Persist user's API key for a provider. Empty/null clears it. */
export function setApiKey(providerId, key) {
  if (!PROVIDERS[providerId]) return;
  if (key && key.trim()) {
    storage.set(`llm-key-${providerId}`, key.trim());
  } else {
    storage.remove(`llm-key-${providerId}`);
  }
  // Keep the legacy Groq mirror in sync so ai-modal getKey()/setKey() still work.
  if (providerId === 'groq') {
    if (key && key.trim()) {
      storage.set(LEGACY_GROQ_KEY, key.trim());
      try { state.update('ai', ai => ({ ...(ai || {}), groqKey: key.trim() })); } catch (_) {}
    } else {
      storage.remove(LEGACY_GROQ_KEY);
      try { state.update('ai', ai => ({ ...(ai || {}), groqKey: null })); } catch (_) {}
    }
  }
}

/**
 * sendPrompt({ messages, jsonMode, providerOverride, signal })
 *   → { content, raw, usage? }
 *
 * Throws AuthError / RateLimitError / NetworkError / ParseError.
 */
export async function sendPrompt({ messages, jsonMode = false, maxTokens, providerOverride, signal } = {}) {
  const id = providerOverride || getActiveProvider();
  const entry = PROVIDERS[id];
  if (!entry) throw new Error(`[llm-adapter] unknown provider: ${id}`);
  const apiKey = getApiKey(id);
  return entry.module.send(messages || [], { jsonMode, maxTokens, signal }, apiKey);
}
