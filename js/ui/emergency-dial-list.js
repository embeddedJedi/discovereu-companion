// js/ui/emergency-dial-list.js
// AAA-accessible emergency dial list for Crisis Shield.
//
// Renders a prominent list of tel: buttons for a given country. The caller is
// responsible for calling `load()` from crisis-shield.js before invoking
// renderDialList — this module is a synchronous render layer only.
//
// Visual contract (see spec §5, §9):
//   - Minimum 56x56 CSS px tap target per row.
//   - Number rendered in large type (>=1.5rem via .cs-dial__number).
//   - General (112 or equivalent) row is highlighted via .dial-critical.
//   - Color is never the sole indicator — icon + label + number always present.
//   - Full keyboard nav: Tab order top-to-bottom, Enter triggers tel: link.
//   - role="list" / role="listitem" semantics.
//
// No innerHTML with interpolated content — all DOM is built via h().

import { h, empty } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { getEmergencyNumbers } from '../features/crisis-shield.js';

// ─── DIAL_KIND_MAP ───────────────────────────────────────────────────────────
// Ordered list of dial kinds. Each entry = { field, icon, labelKey, critical? }.
//   - `field`    : key on the emergency-numbers country record
//   - `icon`     : emoji glyph (placeholder until icon set lands)
//   - `labelKey` : i18n dot-path used for the row label
//   - `critical` : true only for the `general` (EU-112) row
//
// Exported so tests and sibling UIs (compact card, panel header) can share
// the exact same ordering and metadata.
export const DIAL_KIND_MAP = [
  { field: 'general',        icon: '🚨', labelKey: 'crisis.dial.general',       critical: true  },
  { field: 'police',         icon: '🚓', labelKey: 'crisis.dial.police'                          },
  { field: 'ambulance',      icon: '🚑', labelKey: 'crisis.dial.ambulance'                       },
  { field: 'fire',           icon: '🚒', labelKey: 'crisis.dial.fire'                            },
  { field: 'touristPolice',  icon: '🕵️', labelKey: 'crisis.dial.tourist'                         },
  { field: 'womenHelpline',  icon: '♀️', labelKey: 'crisis.dial.women'                           },
  { field: 'lgbtqiSafeLine', icon: '🏳️‍🌈', labelKey: 'crisis.dial.lgbtq'                          },
  { field: 'mentalHealth',   icon: '💬', labelKey: 'crisis.dial.mental'                          },
  { field: 'poisonControl',  icon: '☠️', labelKey: 'crisis.dial.poison'                          }
];

// Normalise a displayable phone number to a tel: href-safe form.
// Keeps leading "+", strips spaces and common separators.
function toTelHref(num) {
  return 'tel:' + String(num).replace(/[^\d+]/g, '');
}

/**
 * Render a single dial row (<li role="listitem">).
 * The whole row is a tel: link so Enter + Tap both "call".
 */
function renderRow({ field, icon, labelKey, critical }, number, countryName) {
  const label = t(labelKey);
  // Example: "Call police — 17 in France"
  const ariaLabel = `${t('crisis.dial.callPrefix')} ${label} — ${number}${
    countryName ? ` (${countryName})` : ''
  }`;

  const link = h(
    'a',
    {
      href: toTelHref(number),
      class: 'cs-dial__link',
      'aria-label': ariaLabel,
      'data-field': field
    },
    [
      h('span', { class: 'cs-dial__icon', 'aria-hidden': 'true' }, icon),
      h('span', { class: 'cs-dial__text' }, [
        h('span', { class: 'cs-dial__label' }, label),
        h('span', { class: 'cs-dial__number' }, number)
      ])
    ]
  );

  return h(
    'li',
    {
      role: 'listitem',
      class: 'cs-dial__row' + (critical ? ' dial-critical' : '')
    },
    link
  );
}

/**
 * Render a skeleton fallback when the country record is missing.
 * Used when the caller has not yet completed `load()`, or when the countryId
 * is unknown. Keeps layout height stable so the surrounding panel does not
 * jump once data arrives.
 */
function renderSkeleton() {
  const rows = [0, 1, 2].map(i =>
    h('li', { role: 'listitem', class: 'cs-dial__row cs-dial__row--skeleton', 'aria-hidden': 'true' }, [
      h('span', { class: 'cs-dial__icon' }),
      h('span', { class: 'cs-dial__text' }, [
        h('span', { class: 'cs-dial__label cs-skel' }),
        h('span', { class: 'cs-dial__number cs-skel' })
      ])
    ])
  );
  return h(
    'ul',
    {
      class: 'cs-dial-grid cs-dial-grid--skeleton',
      role: 'list',
      'aria-busy': 'true',
      'aria-label': t('crisis.dial.loading')
    },
    rows
  );
}

/**
 * Clear `container` and render the emergency dial list for `countryId` inside it.
 *
 * Caller MUST have already awaited `load()` from crisis-shield.js. If the
 * country record is not available, a skeleton fallback is rendered and the
 * function returns null.
 *
 * @param {HTMLElement} container
 * @param {string} countryId - ISO2 (case-insensitive)
 * @returns {HTMLElement|null} the mounted <ul> list, or null on missing data
 */
export function renderDialList(container, countryId) {
  if (!container) return null;
  empty(container);

  let data = null;
  try {
    data = getEmergencyNumbers(countryId);
  } catch {
    // crisis-shield not loaded — caller contract violated, show skeleton.
    data = null;
  }

  if (!data) {
    const skel = renderSkeleton();
    container.appendChild(skel);
    return null;
  }

  const countryName = data.countryName || null;

  const rows = DIAL_KIND_MAP
    .map(kind => {
      const number = data[kind.field];
      if (!number) return null; // skip null/empty per spec §11
      return renderRow(kind, number, countryName);
    })
    .filter(Boolean);

  const list = h(
    'ul',
    {
      class: 'cs-dial-grid',
      role: 'list',
      'aria-label': t('crisis.dial.listLabel')
    },
    rows
  );

  container.appendChild(list);
  return list;
}
