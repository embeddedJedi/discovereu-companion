// js/features/share-location.js
// Crisis Shield — one-tap location share.
// Privacy: coordinates are captured once and never persisted, never networked
// beyond the user-initiated Web Share target.

import { t } from '../i18n/i18n.js';

const DEFAULT_PREFIX = 'I am here, please help';
const GEO_TIMEOUT_MS = 10000;

/**
 * Build a Google Maps URL for the given coordinates.
 * Pure function.
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function buildMapsUrl(lat, lng) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Compose the share message from a localized prefix and coordinates.
 * Pure function.
 * @param {number} lat
 * @param {number} lng
 * @param {string} localizedPrefix
 * @returns {string}
 */
export function buildShareMessage(lat, lng, localizedPrefix) {
  return `${localizedPrefix}: ${buildMapsUrl(lat, lng)}`;
}

/**
 * Resolve the localized prefix via i18n, falling back to English if the key
 * is missing (t() returns the key itself when unresolved).
 */
function resolvePrefix(messageKey) {
  try {
    const value = t(messageKey);
    if (typeof value === 'string' && value && value !== messageKey) return value;
  } catch (_) {
    // fall through
  }
  return DEFAULT_PREFIX;
}

/**
 * Request current geolocation with high accuracy and a 10s timeout.
 * Rejects with Error('permission-denied') or Error('timeout') for the two
 * cases the UI must explain to the user.
 * @returns {Promise<{lat:number,lng:number}>}
 */
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err && err.code === 1) reject(new Error('permission-denied'));
        else if (err && err.code === 3) reject(new Error('timeout'));
        else reject(new Error('position-unavailable'));
      },
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 0 }
    );
  });
}

/**
 * One-tap location share. Captures current coordinates, composes a localized
 * message + Google Maps URL, and tries progressive fallbacks:
 *   1) navigator.share({ text, url })
 *   2) navigator.clipboard.writeText(text)
 *   3) return { outcome: 'failed', fallbackText } for manual copy
 *
 * @param {{ messageKey?: string }} [opts]
 * @returns {Promise<'shared'|'copied'|{outcome:'failed', fallbackText:string}>}
 */
export async function shareCurrentLocation({ messageKey = 'crisis.share.message' } = {}) {
  const { lat, lng } = await getPosition();
  const prefix = resolvePrefix(messageKey);
  const url = buildMapsUrl(lat, lng);
  const text = buildShareMessage(lat, lng, prefix);

  // 1) Web Share API
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text, url });
      return 'shared';
    } catch (err) {
      // AbortError = user cancelled; treat as failed-without-copy so UI can
      // offer manual options instead of silently falling through.
      if (err && err.name === 'AbortError') {
        return { outcome: 'failed', fallbackText: text };
      }
      // otherwise fall through to clipboard
    }
  }

  // 2) Clipboard
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch (_) {
      // fall through
    }
  }

  // 3) Manual fallback
  return { outcome: 'failed', fallbackText: text };
}
