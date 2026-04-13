// js/features/ocr.js — DiscoverEU Companion
// v1.7 Language Bridge — opt-in OCR pipeline.
//
// This module is the *plumbing* for on-device text recognition. It:
//   • requests a single-shot rear-facing camera stream,
//   • captures one frame to a PNG blob,
//   • lazy-loads tesseract.js@5 ONLY when the user has explicitly asked
//     for OCR (never at boot, never from the service worker),
//   • runs recognition in a memoised Tesseract worker and reports
//     progress via window CustomEvents so any UI can listen.
//
// Privacy / battery / data-plan rules enforced here:
//   • No auto-download: callers MUST gate ensureTesseract() behind the
//     `lang.ocr.sizeWarn` consent screen.
//   • No continuous scan: captureFrame is single-shot.
//   • No network I/O of pixels: recognition is 100% WASM-local.
//   • Data-saver aware: we detect navigator.connection.saveData and fire
//     `ocr:data-saver` so the UI can show a stronger warning.
//   • COOP/COEP aware: on GitHub Pages we won't have cross-origin
//     isolation, so tesseract falls back to single-thread. We fire
//     `ocr:slow-mode` once at lazy-load time.

// Pinned CDN — do NOT bump without re-auditing size + SRI.
const TESSERACT_CDN_URL =
  'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js';

// Known language packs we currently surface in the UI. Tesseract itself
// supports many more, but we curate this list to match our phrasebook +
// DiscoverEU country coverage.
const AVAILABLE_LANGS = Object.freeze([
  'eng', 'deu', 'fra', 'ita', 'spa', 'tur', 'nld', 'pol', 'por', 'ces',
]);

// ISO-3166-1 alpha-2 country id → Tesseract lang code.
// Intentionally conservative: unknown countries fall back to 'eng'.
const COUNTRY_TO_OCR_LANG = Object.freeze({
  at: 'deu', be: 'fra', bg: 'eng', hr: 'eng', cy: 'eng',
  cz: 'ces', dk: 'eng', ee: 'eng', fi: 'eng', fr: 'fra',
  de: 'deu', gr: 'eng', hu: 'eng', ie: 'eng', it: 'ita',
  lv: 'eng', lt: 'eng', lu: 'fra', mt: 'eng', nl: 'nld',
  pl: 'pol', pt: 'por', ro: 'eng', sk: 'ces', si: 'eng',
  es: 'spa', se: 'eng', is: 'eng', li: 'deu', no: 'eng',
  ch: 'deu', tr: 'tur', uk: 'eng',
});

// ---- module-scoped single-flight caches --------------------------------

let tesseractPromise = null; // Promise<{ createWorker, ... }> — memoised script load
let workerPromise = null;    // Promise<TesseractWorker> — memoised worker
let workerLang = null;       // last lang loaded into that worker
let slowModeAnnounced = false;

// ---- public API --------------------------------------------------------

/**
 * Returns the curated list of Tesseract language codes we expose to the
 * UI. Callers should use this to render the language picker.
 */
export function listAvailableLanguages() {
  return AVAILABLE_LANGS.slice();
}

/**
 * Maps a DiscoverEU country id (lowercase ISO alpha-2) to the best
 * Tesseract language pack we ship for it. Falls back to 'eng'.
 */
export function mapCountryIdToOcrLang(countryId) {
  if (!countryId || typeof countryId !== 'string') return 'eng';
  const key = countryId.toLowerCase();
  return COUNTRY_TO_OCR_LANG[key] || 'eng';
}

/**
 * Heuristic: returns true if tesseract.js will be forced into
 * single-thread mode. This is the case on GitHub Pages (no COOP/COEP
 * headers), on browsers without SharedArrayBuffer, or when cross-origin
 * isolation was not granted to the document.
 */
export function getSlowModeHint() {
  try {
    if (typeof SharedArrayBuffer === 'undefined') return true;
    // crossOriginIsolated is the definitive signal when it exists.
    if (typeof globalThis.crossOriginIsolated === 'boolean') {
      return !globalThis.crossOriginIsolated;
    }
    return false;
  } catch (_err) {
    return true;
  }
}

/**
 * Requests a rear-facing camera MediaStream. Throws a normalised Error
 * whose .message is one of: 'camera-permission-denied' | 'no-camera'.
 * Callers should catch and surface the matching i18n string.
 */
export async function requestCameraStream() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('no-camera');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  } catch (err) {
    const name = err && err.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      throw new Error('camera-permission-denied');
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError' ||
        name === 'DevicesNotFoundError') {
      throw new Error('no-camera');
    }
    // Anything else (NotReadableError, AbortError, …) is not a camera /
    // permission problem per se; propagate so the UI can show a generic
    // error but keep the distinct contract for the two documented cases.
    throw err;
  }
}

/**
 * Draws the current frame of `videoElement` to an offscreen canvas and
 * returns a PNG Blob. Single-shot — we never loop.
 */
export function captureFrame(videoElement) {
  return new Promise((resolve, reject) => {
    try {
      if (!videoElement || !videoElement.videoWidth || !videoElement.videoHeight) {
        throw new Error('video-not-ready');
      }
      const w = videoElement.videoWidth;
      const h = videoElement.videoHeight;
      let canvas;
      // Prefer OffscreenCanvas when available — keeps main thread tidy.
      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(w, h);
      } else {
        canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoElement, 0, 0, w, h);

      if (canvas.convertToBlob) {
        canvas.convertToBlob({ type: 'image/png' }).then(resolve, reject);
      } else {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('canvas-blob-failed'));
        }, 'image/png');
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Lazy, single-flight loader for tesseract.js. Resolves to an object
 * exposing { createWorker } (and whatever else the UMD global attaches).
 *
 * IMPORTANT: we only call this AFTER the user has confirmed the size
 * warning. There is no auto-preload anywhere in the app.
 */
export function ensureTesseract() {
  if (tesseractPromise) return tesseractPromise;

  // Fire slow-mode + data-saver signals exactly once, before the fetch.
  if (!slowModeAnnounced) {
    slowModeAnnounced = true;
    if (getSlowModeHint()) {
      dispatchEvent('ocr:slow-mode', { reason: 'no-cross-origin-isolation' });
    }
    try {
      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (conn && conn.saveData === true) {
        dispatchEvent('ocr:data-saver', { effectiveType: conn.effectiveType || null });
      }
    } catch (_err) { /* ignore — connection API is optional */ }
  }

  tesseractPromise = loadScript(TESSERACT_CDN_URL)
    .then(() => {
      const T = /** @type {any} */ (window).Tesseract;
      if (!T || typeof T.createWorker !== 'function') {
        throw new Error('tesseract-load-failed');
      }
      return T;
    })
    .catch((err) => {
      // Invalidate the cache so a later retry can re-attempt the load.
      tesseractPromise = null;
      throw err;
    });

  return tesseractPromise;
}

/**
 * Recognises text in `blob` using the requested language pack.
 * Throws Error('ocr-no-text') when the average confidence is below 20%
 * (empty page / blurry shot / wrong pack).
 */
export async function recognize(blob, lang = 'eng') {
  if (!blob) throw new Error('ocr-no-input');
  const T = await ensureTesseract();

  const worker = await getOrCreateWorker(T, lang);

  const result = await worker.recognize(blob);
  const data = result && result.data ? result.data : {};
  const text = (data.text || '').trim();
  const confidence = typeof data.confidence === 'number' ? data.confidence : 0;

  dispatchProgress(100, 'done');

  if (confidence < 20 || !text) {
    throw new Error('ocr-no-text');
  }
  return { text, confidence };
}

// ---- internals ---------------------------------------------------------

async function getOrCreateWorker(T, lang) {
  const normalized = AVAILABLE_LANGS.includes(lang) ? lang : 'eng';

  if (workerPromise) {
    const w = await workerPromise;
    if (workerLang === normalized) return w;
    // Language change: tear down and rebuild. Tesseract workers can
    // reinitialise in-place, but rebuilding is simpler and matches the
    // single-shot UX (users rarely switch languages mid-session).
    try { await w.terminate(); } catch (_err) { /* ignore */ }
    workerPromise = null;
    workerLang = null;
  }

  workerLang = normalized;
  workerPromise = T.createWorker(normalized, 1, {
    logger: (m) => {
      if (!m) return;
      const pct = typeof m.progress === 'number' ? Math.round(m.progress * 100) : null;
      dispatchProgress(pct, m.status || 'working');
    },
    errorHandler: (e) => {
      // eslint-disable-next-line no-console
      console.warn('[ocr] tesseract error', e);
    },
  });

  try {
    return await workerPromise;
  } catch (err) {
    workerPromise = null;
    workerLang = null;
    throw err;
  }
}

function dispatchProgress(percent, status) {
  try {
    window.dispatchEvent(new CustomEvent('ocr:progress', {
      detail: { percent, status },
    }));
  } catch (_err) { /* ignore — CustomEvent always available in browsers */ }
}

function dispatchEvent(name, detail) {
  try {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  } catch (_err) { /* ignore */ }
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    // Re-use if a previous call already inserted the tag.
    const existing = document.querySelector(`script[data-ocr-src="${url}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('tesseract-script-error')), { once: true });
      return;
    }
    const tag = document.createElement('script');
    tag.src = url;
    tag.async = true;
    tag.crossOrigin = 'anonymous';
    tag.referrerPolicy = 'no-referrer';
    tag.dataset.ocrSrc = url;
    tag.addEventListener('load', () => {
      tag.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    tag.addEventListener('error', () => reject(new Error('tesseract-script-error')), { once: true });
    document.head.appendChild(tag);
  });
}
