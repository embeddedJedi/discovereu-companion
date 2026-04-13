// js/features/voice-transcribe.js
// Opt-in speech-to-text for voice memories using Whisper-tiny via
// @xenova/transformers. The transformers.js library (~40 MB including the
// Whisper-tiny model) is LAZY-LOADED — nothing is fetched until the user
// explicitly triggers transcription or warmup with the `a11y.transcribeVoice`
// toggle on.
//
// Service-worker note: this module's CDN imports are intentionally NOT
// precached. See sw.js — only app shell and small data files are precached.
// The transformers runtime + model weights are fetched on demand and cached
// by transformers.js itself (uses IndexedDB via its `useBrowserCache` flag).
//
// COEP/COOP headers are not set on GitHub Pages, so SharedArrayBuffer is
// unavailable. transformers.js transparently falls back to single-thread
// WASM (~2-3× slower). We surface this via `voice-transcribe:slow-mode`.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';

// Pinned CDN URL — bumping requires re-verifying model compatibility.
export const TRANSFORMERS_CDN_URL =
  'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
const MODEL_ID = 'Xenova/whisper-tiny';

let _transcriber = null;
let _slowModeAnnounced = false;

// ─── Slow-mode detection ────────────────────────────────────────────────────
export function getSlowModeHint() {
  return typeof SharedArrayBuffer === 'undefined';
}

function announceSlowModeOnce() {
  if (_slowModeAnnounced) return;
  if (!getSlowModeHint()) return;
  _slowModeAnnounced = true;
  try {
    window.dispatchEvent(new CustomEvent('voice-transcribe:slow-mode', {
      detail: { messageKey: 'a11y.transcribe.slowMode' }
    }));
  } catch (_) { /* non-browser env */ }
}

// ─── Gate ───────────────────────────────────────────────────────────────────
function isEnabled() {
  try {
    const a11y = state.getSlice('a11y') || {};
    return a11y.transcribeVoice === true;
  } catch (_) {
    return false;
  }
}

// ─── Lazy loader (single-flight) ────────────────────────────────────────────
async function loadTransformers() {
  if (loadTransformers._p) return loadTransformers._p;
  loadTransformers._p = (async () => {
    const mod = await import(/* @vite-ignore */ TRANSFORMERS_CDN_URL);
    const { pipeline, env } = mod;
    // Force CDN fetch — we do not ship local model weights.
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true; // model weights go to IndexedDB via transformers.js
    return { pipeline, env };
  })();
  return loadTransformers._p;
}

function emitProgress(p) {
  // transformers.js progress shape: { status, name, file, progress, loaded, total }
  const status = p && p.status;
  let stage = 'download';
  if (status === 'ready' || status === 'done') stage = 'ready';
  else if (status === 'initiate' || status === 'init' || status === 'loading') stage = 'init';
  const percent = typeof p?.progress === 'number' ? Math.round(p.progress) : 0;
  try {
    window.dispatchEvent(new CustomEvent('voice-transcribe:progress', {
      detail: { percent, stage, raw: p }
    }));
  } catch (_) { /* noop */ }
}

async function getTranscriber() {
  if (_transcriber) return _transcriber;
  announceSlowModeOnce();
  const { pipeline } = await loadTransformers();
  _transcriber = await pipeline('automatic-speech-recognition', MODEL_ID, {
    progress_callback: emitProgress
  });
  // Final ready ping so UI can clear the progress bar.
  emitProgress({ status: 'ready', progress: 100 });
  return _transcriber;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** True if the ASR pipeline is already initialised in this session. */
export function isTranscriptionReady() {
  return _transcriber !== null;
}

/**
 * Kick off model download + pipeline init without running inference.
 * Progress is emitted via `voice-transcribe:progress` events.
 */
export async function warmup() {
  if (!isEnabled()) throw new Error('transcription-disabled');
  await getTranscriber();
}

/**
 * Decode the given audio Blob to text.
 * @param {Blob} blob
 * @param {{ language?: string }} [opts]
 * @returns {Promise<{ text: string, language: string, duration: number }>}
 */
export async function transcribeAudio(blob, opts = {}) {
  if (!isEnabled()) throw new Error('transcription-disabled');
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('invalid-audio');
  }

  let transcriber;
  try {
    transcriber = await getTranscriber();
  } catch (err) {
    // Most common first-run failure: offline / CDN unreachable.
    if (!navigator.onLine) throw new Error('model-not-downloaded');
    throw err;
  }

  const language = opts.language || 'en';
  const started = performance.now();

  // Decode Blob → Float32Array @ 16 kHz mono (Whisper requirement).
  const audioData = await decodeBlobToMono16k(blob);

  const out = await transcriber(audioData, {
    language,
    task: 'transcribe',
    chunk_length_s: 30,
    return_timestamps: false
  });

  const duration = (performance.now() - started) / 1000;
  const text = (out && typeof out.text === 'string') ? out.text.trim() : '';
  return { text, language, duration };
}

/**
 * Helper for voice-memory UI to call post-recording. Resolves to null when
 * the feature is disabled so callers can treat it as an opportunistic hook.
 */
export async function transcribeIfEnabled(blob) {
  if (!isEnabled()) return null;
  try {
    return await transcribeAudio(blob);
  } catch (err) {
    console.warn('[voice-transcribe] failed:', err.message);
    return null;
  }
}

// ─── Audio decoding ─────────────────────────────────────────────────────────
async function decodeBlobToMono16k(blob) {
  const arrayBuf = await blob.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('invalid-audio');
  // Decode at native rate, then resample to 16 kHz mono via OfflineAudioContext.
  const tmp = new AC();
  let decoded;
  try {
    decoded = await tmp.decodeAudioData(arrayBuf.slice(0));
  } catch (_) {
    try { tmp.close(); } catch (_) {}
    throw new Error('invalid-audio');
  }
  try { tmp.close(); } catch (_) {}

  const targetRate = 16000;
  const targetLength = Math.ceil(decoded.duration * targetRate);
  const offline = new OfflineAudioContext(1, targetLength, targetRate);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}
