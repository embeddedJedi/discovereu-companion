// js/ui/offset-cta.js
// v1.7 — Reusable "Balance your trip" carbon offset CTA.
//
// Educational, non-pushy link-out to verified offset providers. No affiliate
// IDs, no utm_*, no tracking pixels. All outbound links use
// referrerpolicy="no-referrer" to avoid referrer leakage.
//
// Rendered in two places:
//   1. Impact Dashboard panel (below the stats grid, when co2Saved > 0)
//   2. Wrapped Story slide (penultimate slide) — see integration note below.
//
// Build DOM via h() only. Never innerHTML with interpolated data.
//
// Export:
//   renderOffsetCta(container, { co2Kg }) -> { element, cleanup }

import { t } from '../i18n/i18n.js';
import { h } from '../utils/dom.js';

// Provider metadata. URLs are public marketing / calculator pages — no
// affiliate IDs, no utm params, no checkout deep-links. If a URL redirects
// or rots, update here (and re-verify the fallback). Keep alphabetical by
// display key for a stable, non-preferential ordering.
const PROVIDERS = [
  {
    key: 'myclimate',
    i18nKey: 'offset.cta.myclimate',
    url: 'https://www.myclimate.org/en/contribute-now/carbon-offset/'
  },
  {
    key: 'climatecare',
    i18nKey: 'offset.cta.climatecare',
    // Primary URL per task spec. If this 404s / redirects to a commercial
    // funnel, fall back to the corporate page below.
    url: 'https://climatecare.org/calculator/',
    fallbackUrl: 'https://www.climate-care.com/'
  },
  {
    key: 'treesforall',
    i18nKey: 'offset.cta.treesforall',
    url: 'https://treesforall.nl/en/plant-a-tree/'
  }
];

/**
 * Build a single external provider anchor with all privacy + a11y attrs.
 */
function buildProviderLink(provider) {
  const label = t(provider.i18nKey);
  // aria-label composed via t() with {provider} interpolation, with a safe
  // fallback if the i18n key isn't defined yet.
  const ariaTemplate = t('offset.cta.providerAria', { provider: label });
  const ariaLabel = ariaTemplate === 'offset.cta.providerAria'
    ? `Offset with ${label} (opens in new tab)`
    : ariaTemplate;

  return h('a', {
    class: 'offset-cta__provider',
    href: provider.url,
    target: '_blank',
    rel: 'noopener noreferrer',
    referrerpolicy: 'no-referrer',
    'aria-label': ariaLabel,
    'data-provider': provider.key
  }, [
    h('span', { class: 'offset-cta__provider-label' }, label)
    // External-link icon added via CSS ::after (see css/green-hostel.css).
  ]);
}

/**
 * Render the offset CTA card into `container`.
 *
 * @param {HTMLElement} container Host element to append the card into.
 * @param {{ co2Kg: number }} options
 * @returns {{ element: HTMLElement, cleanup: () => void }}
 */
export function renderOffsetCta(container, { co2Kg } = {}) {
  if (!container) {
    const noop = () => {};
    return { element: null, cleanup: noop };
  }

  const kg = Number.isFinite(co2Kg) ? Math.max(0, Math.round(co2Kg)) : 0;

  // Title + body
  const title = h('h3', {
    id: 'offset-cta-title',
    class: 'offset-cta__title'
  }, t('offset.cta.title'));

  const body = h('p', {
    class: 'offset-cta__body'
  }, t('offset.cta.body', { kg }));

  // Provider list
  const providerItems = PROVIDERS.map(p =>
    h('li', { class: 'offset-cta__provider-item' }, [buildProviderLink(p)])
  );
  const providerList = h('ul', {
    class: 'offset-cta__providers',
    role: 'list'
  }, providerItems);

  // Educational "learn more" link
  const learnMoreUrl = t('offset.learnMoreUrl');
  // Guard against an unresolved key so we don't render `href="offset.learnMoreUrl"`.
  const safeLearnMoreUrl = /^https?:\/\//.test(learnMoreUrl)
    ? learnMoreUrl
    : 'https://climate.ec.europa.eu/eu-action/climate-strategies-targets_en';
  const learnMore = h('a', {
    class: 'offset-cta__learn-more',
    href: safeLearnMoreUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
    referrerpolicy: 'no-referrer'
  }, t('offset.learnMore'));

  // Disclaimer
  const disclaimer = h('small', {
    class: 'offset-cta__disclaimer'
  }, t('offset.disclaimer'));

  // Card root
  const element = h('article', {
    class: 'offset-cta',
    role: 'region',
    'aria-labelledby': 'offset-cta-title',
    style: {
      display: 'flex',
      'flex-direction': 'column',
      gap: '0.75rem',
      padding: '1rem',
      'border-radius': '0.75rem',
      'border-left': '4px solid var(--accent, #0057b7)'
    }
  }, [title, body, providerList, learnMore, disclaimer]);

  container.appendChild(element);

  function cleanup() {
    if (element.parentNode) element.parentNode.removeChild(element);
  }

  return { element, cleanup };
}
