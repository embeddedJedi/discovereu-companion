// js/features/voice-translator.js
// Voice → voice translation chain:
//   1. Whisper STT  (via voice-transcribe.js)
//   2. Text translation (via translate.js — Task 5)
//   3. Playback via native Web Speech API (speechSynthesis)
//
// Gated by `state.a11y.transcribeVoice === true` (Whisper opt-in).
// All user-facing errors go through i18n keys (see `lang.voice.*`).

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { transcribeAudio } from './voice-transcribe.js';

// translate.js is loaded dynamically so this module stays importable even if
// Task 5's feature has not shipped yet in a given deploy snapshot.
async function loadTranslate() {
  const mod = await import('./translate.js');
  if (typeof mod.translate !== 'function') {
    throw new Error('translate-unavailable');
  }
  return mod.translate;
}

// ─── BCP-47 mapping ─────────────────────────────────────────────────────────
// DiscoverEU stores short ISO-639-1 codes in state ('de', 'fr', 'it', ...).
// Web Speech API voices are tagged with full BCP-47 ('de-DE', 'fr-FR', ...).
// This map gives us a sensible default region when the caller passes only a
// short code. Callers may also pass a full BCP-47 tag — we normalise on '-'.
const LANG_TO_BCP47 = {
  en: 'en-GB', // DiscoverEU is EU-centric — prefer en-GB over en-US
  de: 'de-DE',
  fr: 'fr-FR',
  it: 'it-IT',
  es: 'es-ES',
  pt: 'pt-PT',
  nl: 'nl-NL',
  tr: 'tr-TR',
  pl: 'pl-PL',
  cs: 'cs-CZ',
  sk: 'sk-SK',
  hu: 'hu-HU',
  ro: 'ro-RO',
  bg: 'bg-BG',
  hr: 'hr-HR',
  sl: 'sl-SI',
  el: 'el-GR',
  sv: 'sv-SE',
  no: 'nb-NO',
  da: 'da-DK',
  fi: 'fi-FI',
  et: 'et-EE',
  lv: 'lv-LV',
  lt: 'lt-LT',
  is: 'is-IS',
  ga: 'ga-IE',
  mt: 'mt-MT',
  lb: 'lb-LU',
  sq: 'sq-AL',
  mk: 'mk-MK',
  sr: 'sr-RS',
  bs: 'bs-BA',
  uk: 'uk-UA'
};

function toBcp47(lang) {
  if (!lang || typeof lang !== 'string') return null;
  if (lang.includes('-')) return lang;
  const key = lang.toLowerCase();
  return LANG_TO_BCP47[key] || key;
}

function langPrefix(lang) {
  if (!lang) return '';
  return String(lang).toLowerCase().split('-')[0];
}

// ─── Gate ───────────────────────────────────────────────────────────────────
function isEnabled() {
  try {
    const a11y = state.getSlice ? state.getSlice('a11y') : (state.get?.().a11y || {});
    return a11y && a11y.transcribeVoice === true;
  } catch (_) {
    return false;
  }
}

function assertTtsAvailable() {
  if (typeof window === 'undefined' || typeof window.speechSynthesis === 'undefined') {
    const err = new Error('tts-unavailable');
    err.i18nKey = 'lang.voice.ttsUnavailable';
    throw err;
  }
}

// ─── Voice enumeration ──────────────────────────────────────────────────────

/**
 * Synchronously returns SpeechSynthesis voices whose BCP-47 `lang` starts
 * with the given language code (matching on the 2-letter prefix).
 * Example: 'de' matches 'de-DE', 'de-AT', 'de-CH'.
 * Returns [] if speechSynthesis is unavailable or no voices loaded yet.
 */
export function getAvailableVoices(lang) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
  const all = window.speechSynthesis.getVoices() || [];
  const prefix = langPrefix(lang);
  if (!prefix) return all.slice();
  return all.filter(v => langPrefix(v.lang) === prefix);
}

// Ensure voices are loaded. Chromium populates getVoices() asynchronously.
function waitForVoices(timeoutMs = 1500) {
  return new Promise(resolve => {
    if (!window.speechSynthesis) return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing && existing.length) return resolve(existing);
    let done = false;
    const finish = list => {
      if (done) return;
      done = true;
      try { window.speechSynthesis.onvoiceschanged = null; } catch (_) {}
      resolve(list || []);
    };
    try {
      window.speechSynthesis.onvoiceschanged = () => {
        finish(window.speechSynthesis.getVoices());
      };
    } catch (_) { /* noop */ }
    setTimeout(() => finish(window.speechSynthesis.getVoices()), timeoutMs);
  });
}

function pickVoice(voices, bcp47) {
  if (!voices || !voices.length) return null;
  const lower = (bcp47 || '').toLowerCase();
  const prefix = langPrefix(bcp47);
  // 1. exact BCP-47 match
  const exact = voices.find(v => v.lang && v.lang.toLowerCase() === lower);
  if (exact) return exact;
  // 2. same prefix + default flag
  const prefixed = voices.filter(v => langPrefix(v.lang) === prefix);
  const def = prefixed.find(v => v.default);
  if (def) return def;
  if (prefixed.length) return prefixed[0];
  // 3. no match — caller will fall back to utterance default
  return null;
}

// ─── TTS playback ───────────────────────────────────────────────────────────

let _currentUtterance = null;

/**
 * Speak the given text in the requested language via the browser's native TTS.
 * Resolves when the utterance ends; rejects on synthesis error.
 * Throws Error('tts-unavailable') if speechSynthesis is not in the global.
 */
export function speakText(text, lang, opts = {}) {
  assertTtsAvailable();
  if (!text || !String(text).trim()) return Promise.resolve();

  return new Promise(async (resolve, reject) => {
    try {
      const voices = await waitForVoices();
      const bcp47 = toBcp47(lang);
      const voice = pickVoice(voices, bcp47);

      const utter = new SpeechSynthesisUtterance(String(text));
      if (voice) {
        utter.voice = voice;
        utter.lang = voice.lang;
      } else if (bcp47) {
        utter.lang = bcp47;
      }
      utter.volume = typeof opts.volume === 'number' ? opts.volume : 1.0;
      utter.rate = typeof opts.rate === 'number' ? opts.rate : 0.95;
      utter.pitch = typeof opts.pitch === 'number' ? opts.pitch : 1.0;

      utter.onend = () => {
        if (_currentUtterance === utter) _currentUtterance = null;
        resolve();
      };
      utter.onerror = ev => {
        if (_currentUtterance === utter) _currentUtterance = null;
        const err = new Error(ev && ev.error ? `tts-error:${ev.error}` : 'tts-error');
        err.i18nKey = 'lang.voice.ttsUnavailable';
        reject(err);
      };

      _currentUtterance = utter;
      try {
        window.speechSynthesis.cancel(); // clear any queued leftover
      } catch (_) { /* noop */ }
      window.speechSynthesis.speak(utter);
    } catch (err) {
      reject(err);
    }
  });
}

/** Stop any currently speaking utterance. */
export function cancelSpeak() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try { window.speechSynthesis.cancel(); } catch (_) { /* noop */ }
  _currentUtterance = null;
}

// ─── Full voice-translate pipeline ──────────────────────────────────────────

/**
 * Full STT → translate → TTS chain.
 *
 * @param {Blob} audioBlob  Recorded utterance in a browser-decodable format.
 * @param {{ from?: string, to: string, signal?: AbortSignal }} opts
 * @returns {Promise<{
 *   source: string,
 *   translated: string,
 *   sourceLang: string,
 *   targetLang: string,
 *   audioPlaybackPromise: Promise<void> | null
 * }>}
 */
export async function voiceTranslate(audioBlob, opts = {}) {
  if (!isEnabled()) {
    const err = new Error('transcription-disabled');
    err.i18nKey = 'lang.errors.llmKey';
    throw err;
  }
  if (!(audioBlob instanceof Blob) || audioBlob.size === 0) {
    throw new Error('invalid-audio');
  }
  const { from = 'auto', to, signal } = opts;
  if (!to) throw new Error('missing-target-lang');

  const throwIfAborted = () => {
    if (signal && signal.aborted) {
      const err = new Error('aborted');
      err.name = 'AbortError';
      throw err;
    }
  };
  throwIfAborted();

  // Step 1: Whisper STT
  const stt = await transcribeAudio(
    audioBlob,
    from && from !== 'auto' ? { language: from } : {}
  );
  throwIfAborted();

  const sourceText = (stt && stt.text) || '';
  const sourceLang = (stt && stt.language) || (from !== 'auto' ? from : 'en');

  if (!sourceText.trim()) {
    return {
      source: '',
      translated: '',
      sourceLang,
      targetLang: to,
      audioPlaybackPromise: null
    };
  }

  // Step 2: Translation (delegates provider + key handling to translate.js)
  const translate = await loadTranslate();
  throwIfAborted();
  const tResult = await translate(sourceText, { from: sourceLang, to, signal });
  const translated =
    (tResult && (tResult.text || tResult.translated || tResult.translation)) ||
    (typeof tResult === 'string' ? tResult : '');
  throwIfAborted();

  // Step 3: TTS playback — fire and forget; surface the promise for callers
  // that want to show a "speaking…" state or chain a replay button.
  let audioPlaybackPromise = null;
  if (translated) {
    try {
      audioPlaybackPromise = speakText(translated, to);
      // Swallow rejection silently here — caller can attach its own handler.
      audioPlaybackPromise.catch(err => {
        console.warn('[voice-translator] TTS playback failed:', err.message);
      });
    } catch (err) {
      // TTS unavailable shouldn't fail the whole translate call — the text
      // result is still useful on screen.
      console.warn('[voice-translator] TTS unavailable:', err.message);
      audioPlaybackPromise = null;
    }
  }

  // Abort cleanup — if the caller aborts after we fire TTS, stop playback.
  if (signal) {
    signal.addEventListener('abort', cancelSpeak, { once: true });
  }

  return {
    source: sourceText,
    translated,
    sourceLang,
    targetLang: to,
    audioPlaybackPromise
  };
}

// Expose mapping for tests / debugging (read-only snapshot).
export function _bcp47For(lang) {
  return toBcp47(lang);
}
