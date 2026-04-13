// js/features/coach-badge.js
// OpenBadge 2.0 JSON-LD Assertion builder (client-side, hosted verification).
//
// Europass accepts unsigned hosted Assertions per OBv2 spec provided that the
// BadgeClass and Issuer Profile JSON-LD files are reachable on public URLs.
// In this project they are hosted as static JSON under GitHub Pages:
//
//   https://embeddedjedi.github.io/discovereu-companion/badges/issuer.json
//   https://embeddedjedi.github.io/discovereu-companion/badges/classes/{countryId}.json
//   https://embeddedjedi.github.io/discovereu-companion/badges/assertions/{badgeId}.json
//
// Verification flow (per OBv2 "hosted" verification type):
//   1. User downloads the Assertion JSON from this app.
//   2. User uploads it to Europass profile → Credentials.
//   3. Europass fetches `badge` URL → BadgeClass JSON (Task 9 generates these).
//   4. BadgeClass fetches its `issuer` URL → Issuer Profile (Task 8 creates this).
//   5. Europass validates the recipient identity hash against the user's email
//      (the upload itself is the proof of claim).
//   6. Result: a green-checked credential on the user's Europass profile.
//
// No signing, no external crypto libs — only Web Crypto `subtle.digest`.

const PAGES_BASE = "https://embeddedjedi.github.io/discovereu-companion";
const ASSERTION_BASE = `${PAGES_BASE}/badges/assertions`;
const BADGECLASS_BASE = `${PAGES_BASE}/badges/classes`;
const DEFAULT_SALT = "discovereu-companion-2026";

/**
 * Build a fresh OpenBadge v2 Assertion for the given country.
 *
 * @param {object} opts
 * @param {string} opts.countryId       ISO country code matching a hosted BadgeClass.
 * @param {string|null} [opts.recipientEmail]  If provided, SHA-256-salted; else anonymous.
 * @returns {Promise<{ badgeId: string, jsonLd: string, jsonLdHash: string, downloadBlob: Blob }>}
 */
export async function buildAssertion({ countryId, recipientEmail = null }) {
  if (!countryId || typeof countryId !== "string") {
    throw new Error("buildAssertion: countryId is required");
  }

  const uuid = cryptoRandomUuid();
  const badgeId = `discovereu-coach-${countryId}-${uuid}`;

  let identity;
  if (recipientEmail && typeof recipientEmail === "string") {
    const hashHex = await hashEmail(recipientEmail, DEFAULT_SALT);
    identity = `sha256$${hashHex}`;
  } else {
    identity = `anonymous-${uuid}`;
  }

  const assertion = {
    "@context": "https://w3id.org/openbadges/v2",
    id: `${ASSERTION_BASE}/${badgeId}.json`,
    type: "Assertion",
    recipient: {
      type: "email",
      hashed: true,
      salt: DEFAULT_SALT,
      identity,
    },
    issuedOn: new Date().toISOString(),
    verification: { type: "hosted" },
    badge: `${BADGECLASS_BASE}/${countryId}.json`,
  };

  const jsonLd = canonicalizeJsonLd(assertion);
  const jsonLdHash = await sha256Hex(jsonLd);
  const downloadBlob = new Blob([jsonLd], { type: "application/ld+json" });

  return { badgeId, jsonLd, jsonLdHash, downloadBlob };
}

/**
 * Trigger a browser download for a Blob.
 * Used by coach-panel.js (Task 10).
 *
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on next tick to ensure the click is processed in all browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * SHA-256 hash of a salted email address, per OBv2 `sha256$<hex>` identity format.
 * The salt is concatenated after the email: `${email}${salt}`.
 *
 * @param {string} email
 * @param {string} [salt]
 * @returns {Promise<string>} Lowercase hex digest.
 */
export async function hashEmail(email, salt = DEFAULT_SALT) {
  if (!email || typeof email !== "string") {
    throw new Error("hashEmail: email is required");
  }
  return sha256Hex(`${email}${salt}`);
}

/**
 * Deterministic JSON stringify with recursively sorted object keys.
 * Arrays preserve their order; primitives are serialised by JSON.stringify.
 *
 * @param {unknown} obj
 * @returns {string}
 */
export function canonicalizeJsonLd(obj) {
  return JSON.stringify(sortKeys(obj));
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const view = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < view.length; i++) {
    hex += view[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function cryptoRandomUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback using getRandomValues.
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
  return (
    `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-` +
    `${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-` +
    `${hex.slice(10, 16).join("")}`
  );
}
