// js/features/impact-export.js
// v1.4 Impact Dashboard — user-initiated contribution export.
//
// PRIVACY GUARANTEES
// ------------------
//   • Export is ALWAYS user-initiated. This module never auto-POSTs,
//     never fetches, never calls sendBeacon. The only network egress is
//     the user clicking the returned `prDeepLink` in their own browser.
//   • The exported payload contains ONLY the output of `anonymize()` from
//     `impact-anonymize.js` (k-anonymity-aware whitelist + rounding).
//     The raw personal snapshot is never serialised.
//   • `submittedAt` is truncated to the date (YYYY-MM-DD). Full timestamps
//     would create a timing fingerprint usable for re-identification.
//   • No PII fields, no free-text, no tripId, no geolocation. Ever.
//
// Aggregation model: Manual PR-as-consent. The user downloads a file,
// inspects it, then (optionally) uses the pre-filled GitHub "new file"
// deep-link to open a PR against the public contributions folder.
// Merging is a human-reviewed operation, not an automated pipeline.

import { anonymize } from './impact-anonymize.js';
import { computeImpact } from './impact-compute.js';

const GITHUB_OWNER = 'embeddedJedi';
const GITHUB_REPO = 'discovereu-companion';
const GITHUB_BRANCH = 'main';
const CONTRIB_DIR = 'contributions/impact';

/**
 * Build the wire-format contribution envelope.
 *
 * Pure function: same snapshot in -> same envelope out (aside from the
 * `submittedAt` date field which uses today's UTC date).
 *
 * @param {object} snapshot Output of `computeImpact()` — `{ personal, meta }`.
 * @returns {{contribution: {version: string, submittedAt: string, anonymizedSnapshot: object}}}
 */
export function buildContributionJson(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new TypeError('buildContributionJson: snapshot must be an object');
  }
  const anonymized = anonymize(snapshot);
  const submittedAt = new Date().toISOString().slice(0, 10); // YYYY-MM-DD only
  return {
    contribution: {
      version: 'impact-contribution/1.0',
      submittedAt,
      anonymizedSnapshot: anonymized
    }
  };
}

/**
 * Extract a short hash for filename use. Prefers the snapshot meta.hash
 * (if a raw snapshot was passed before anonymisation stripped it) or the
 * anonymised meta.hash that anonymize() forwards.
 */
function shortHashOf(contributionJson) {
  const anon = contributionJson?.contribution?.anonymizedSnapshot;
  const h = anon?.meta?.hash;
  if (typeof h === 'string' && h.length >= 8) return h.slice(0, 8);
  // Fallback: crypto-random 8 hex chars. Non-deterministic but safe for
  // filename uniqueness — the canonical dedup key remains meta.hash when
  // available.
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Build the GitHub pre-filled "new file" deep link.
 *
 * GitHub's /new/<branch> route accepts:
 *   • `filename` — relative path under the repo root
 *   • `value`    — initial file contents (URL-encoded)
 *
 * @param {object} contributionJson Envelope from `buildContributionJson`.
 * @returns {string} Absolute GitHub URL.
 */
export function buildPrDeepLink(contributionJson) {
  if (!contributionJson || typeof contributionJson !== 'object') {
    throw new TypeError('buildPrDeepLink: contributionJson must be an object');
  }
  const shortHash = shortHashOf(contributionJson);
  const filename = `${CONTRIB_DIR}/${shortHash}.json`;
  const body = JSON.stringify(contributionJson, null, 2);

  const url = new URL(
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/new/${GITHUB_BRANCH}`
  );
  url.searchParams.set('filename', filename);
  url.searchParams.set('value', body);
  return url.toString();
}

/**
 * User-triggered contribution export.
 *
 * Side effects (browser-only):
 *   1. Downloads `discovereu-impact-<shortHash>.json` via anchor-click.
 *   2. Returns `{ downloadUrl, prDeepLink }` so the caller can also
 *      offer a "Open PR on GitHub" button.
 *
 * If no snapshot is passed, a fresh one is computed via `computeImpact()`.
 *
 * @param {object} [snapshot] Optional pre-computed `{ personal, meta }`.
 * @returns {Promise<{downloadUrl: string, prDeepLink: string}>}
 */
export async function exportContribution(snapshot) {
  const snap = snapshot || (await computeImpact());
  const contributionJson = buildContributionJson(snap);
  const shortHash = shortHashOf(contributionJson);

  const body = JSON.stringify(contributionJson, null, 2);
  const blob = new Blob([body], { type: 'application/json' });
  const downloadUrl = URL.createObjectURL(blob);
  const prDeepLink = buildPrDeepLink(contributionJson);

  // Trigger the browser download. Using a detached anchor keeps this
  // pure-client and avoids polluting the DOM tree.
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `discovereu-impact-${shortHash}.json`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Revoke on the next tick — Firefox needs the URL alive during the
  // click handler, but keeping it around leaks memory.
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);

  return { downloadUrl, prDeepLink };
}
