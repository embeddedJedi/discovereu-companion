// js/features/soundtrack.js
// Country Top 50 Spotify embed. Lazy-injects the iframe src only when
// the accordion is opened (bandwidth-conscious, EACEA-green-story
// friendly). No auth, no CORS — pure public iframe embed.

import { loadSoundtracks } from '../data/loader.js';
import { h } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';

let _cache = null;

async function ensure() {
  if (_cache) return _cache;
  try { _cache = await loadSoundtracks(); } catch (e) { _cache = null; }
  return _cache;
}

export async function getPlaylistFor(countryId) {
  const data = await ensure();
  if (!data) return null;
  return data.countries?.[countryId] || null;
}

/**
 * Fun page card API — renders the soundtrack for the first country in
 * the user's route, or a prompt to add stops if no route is set yet.
 */
export async function renderInto(container) {
  const { state } = await import('../state.js');
  const route = state.getSlice('route');
  const firstCountry = route?.stops?.[0]?.countryId;
  if (!firstCountry) {
    container.appendChild(
      h('p', { class: 'text-muted' }, t('soundtrack.noRoute'))
    );
    return;
  }
  await renderSoundtrackAccordion(container, firstCountry);
}

/**
 * Create (but do NOT insert src) a <details><iframe> accordion for the
 * given country. Returns the <details> element ready to append.
 */
export async function renderSoundtrackAccordion(container, countryId) {
  const entry = await getPlaylistFor(countryId);
  if (!entry) return;

  const iframe = h('iframe', {
    width: '100%',
    height: '152',
    frameborder: '0',
    allow: 'encrypted-media',
    loading: 'lazy',
    title: `Spotify ${entry.title}`,
    'aria-label': `Spotify ${entry.title}`
  });

  const details = h('details', { class: 'guide-accordion guide-soundtrack' }, [
    h('summary', null, [
      h('span', null, `🎵 ${t('soundtrack.title')}`),
      h('span', { class: 'chevron' }, '▾')
    ]),
    h('div', { class: 'soundtrack-body' }, [
      iframe,
      entry.fallback
        ? h('p', { class: 'text-muted small' }, t('soundtrack.fallbackNote'))
        : null,
      h('p', { class: 'text-muted small' }, t('soundtrack.attribution'))
    ])
  ]);

  details.addEventListener('toggle', () => {
    if (details.open && !iframe.src) {
      iframe.src = `https://open.spotify.com/embed/playlist/${entry.playlistId}?utm_source=discovereu-companion`;
    }
  });

  container.appendChild(details);
}
