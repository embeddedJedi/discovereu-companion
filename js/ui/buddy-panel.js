// js/ui/buddy-panel.js
// Buddy Matching — main UI panel.
//
// Responsibilities:
//   - renderBuddyPanel(container, { initialCity }) → mounts the full panel
//     (safety banner, city picker, role tabs, feed, post CTA) into `container`
//     and returns a cleanup function that unsubscribes state listeners and
//     aborts any in-flight GitHub fetch.
//
// Hard rules:
//   - No innerHTML with interpolated data — every node is built via h().
//   - Every user-facing string goes through t(). No hardcoded English.
//   - Consent gate is called before any post is created (see CTA handler).
//   - The public GitHub Issues feed is anonymous; we never persist bodies.

import { h, empty } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { state } from '../state.js';
import {
  getCitiesWithBuddies,
  buildPostUrl,
  fetchRecentPosts
} from '../features/buddy.js';

const KINDS = ['local', 'mentor', 'traveler'];
const SEEN_CAP = 200;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const delta = Math.max(0, Date.now() - then);
  const m = Math.floor(delta / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const hrs = Math.floor(m / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function excerpt(body, maxLen = 160) {
  if (!body || typeof body !== 'string') return '';
  const cleaned = body.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen - 1) + '…' : cleaned;
}

function routeCityIds() {
  const route = state.getSlice('route') || { stops: [], returnStops: [] };
  const ids = new Set();
  (route.stops || []).forEach(s => s?.cityId && ids.add(s.cityId));
  (route.returnStops || []).forEach(s => s?.cityId && ids.add(s.cityId));
  return ids;
}

function updateCitiesOptIn(cityId) {
  if (!cityId) return;
  state.update('buddy', b => {
    const list = Array.isArray(b.preferences?.citiesOptIn) ? b.preferences.citiesOptIn : [];
    if (list.includes(cityId)) return b;
    return {
      ...b,
      preferences: {
        ...(b.preferences || {}),
        citiesOptIn: [...list, cityId].slice(-50)
      }
    };
  });
}

function markSeenIds(ids) {
  if (!ids || !ids.length) return;
  state.update('buddy', b => {
    const cur = Array.isArray(b.seenIds) ? b.seenIds : [];
    const merged = cur.slice();
    for (const id of ids) {
      if (id == null) continue;
      const s = String(id);
      if (!merged.includes(s)) merged.push(s);
    }
    const trimmed = merged.length > SEEN_CAP ? merged.slice(merged.length - SEEN_CAP) : merged;
    return { ...b, seenIds: trimmed };
  });
}

// ─── Subviews ────────────────────────────────────────────────────────────────

function renderSafetyBanner() {
  const link = h('a', {
    class: 'buddy-safety-banner__link',
    href: '#crisis-shield',
    'data-action': 'open-crisis'
  }, t('buddy.consent.crisisLink'));

  return h('div', {
    class: 'buddy-safety-banner',
    role: 'note',
    'aria-label': t('buddy.banner.safety')
  }, [
    h('span', { class: 'buddy-safety-banner__text' }, t('buddy.banner.safety')),
    link
  ]);
}

function renderHeader() {
  return h('header', { class: 'buddy-panel__header' }, [
    h('h2', { class: 'buddy-panel__title', id: 'buddy-panel-title' }, t('buddy.panel.title')),
    h('p',  { class: 'buddy-panel__subtitle' }, t('buddy.panel.subtitle'))
  ]);
}

function renderPostCard(post) {
  const handle = post?.user?.handle || '';
  const profileHref = handle ? `https://github.com/${encodeURIComponent(handle)}` : null;
  const issueHref = post?.url || '#';
  const reportHref = post?.reportUrl || '#';
  const reportLabel = `Report post ${post?.title || ''}`.trim();

  const handleEl = profileHref
    ? h('a', {
        class: 'buddy-post__handle',
        href: profileHref,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, '@' + handle)
    : h('span', { class: 'buddy-post__handle' }, handle || '—');

  return h('article', {
    class: 'buddy-post',
    role: 'article',
    'data-post-id': String(post?.id ?? '')
  }, [
    h('div', { class: 'buddy-post__meta' }, [
      handleEl,
      h('span', { class: 'buddy-post__time' }, timeAgo(post?.createdAt))
    ]),
    h('a', {
      class: 'buddy-post__title',
      href: issueHref,
      target: '_blank',
      rel: 'noopener noreferrer'
    }, post?.title || ''),
    h('p', { class: 'buddy-post__body' }, excerpt(post?.body)),
    h('div', { class: 'buddy-post__actions' }, [
      h('a', {
        class: 'buddy-post__report',
        href: reportHref,
        target: '_blank',
        rel: 'noopener noreferrer',
        'aria-label': reportLabel
      }, t('buddy.report.button'))
    ])
  ]);
}

function renderFeedStates() {
  return {
    loading: () => h('div', { class: 'buddy-feed__state buddy-feed__state--loading' },
      h('span', { role: 'status' }, '…')
    ),
    empty: () => h('div', { class: 'buddy-feed__state buddy-feed__state--empty' },
      t('buddy.panel.empty')
    ),
    rateLimited: () => h('div', { class: 'buddy-feed__state buddy-feed__state--rate-limited', role: 'alert' },
      t('buddy.panel.rateLimited')
    ),
    error: (msg) => h('div', { class: 'buddy-feed__state buddy-feed__state--error', role: 'alert' }, msg)
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

/**
 * Render the full Buddy panel into `container`.
 *
 * @param {HTMLElement} container
 * @param {{initialCity?: string}} [opts]
 * @returns {() => void} cleanup
 */
export function renderBuddyPanel(container, { initialCity = null } = {}) {
  if (!container) return () => {};
  empty(container);

  // ─── Local view state ────────────────────────────────────────────────────
  let selectedCity = initialCity || null;
  let selectedKind = KINDS[0];
  let abortCtrl = null;
  let disposed = false;

  // ─── DOM refs ────────────────────────────────────────────────────────────
  const feedStates = renderFeedStates();
  const feedEl = h('div', {
    class: 'buddy-feed',
    role: 'feed',
    'aria-live': 'polite',
    'aria-busy': 'false'
  });

  const cityPickerWrap = h('section', { class: 'buddy-panel__city' });
  const tabsWrap = h('div', {
    class: 'buddy-panel__tabs',
    role: 'tablist',
    'aria-label': t('buddy.panel.title')
  });
  const tabHint = h('p', { class: 'buddy-panel__tab-hint' });
  const postBtn = h('button', {
    type: 'button',
    class: 'buddy-panel__post-btn btn-primary',
    'data-action': 'buddy-post'
  }, t('buddy.panel.postButton'));

  const root = h('section', {
    class: 'buddy-panel',
    'aria-labelledby': 'buddy-panel-title'
  }, [
    renderHeader(),
    renderSafetyBanner(),
    cityPickerWrap,
    tabsWrap,
    tabHint,
    h('section', { class: 'buddy-panel__feed-section' }, [
      h('h3', { class: 'buddy-panel__feed-title' }, t('buddy.panel.recentPosts')),
      feedEl
    ]),
    h('div', { class: 'buddy-panel__cta' }, postBtn)
  ]);
  container.appendChild(root);

  // ─── City picker ─────────────────────────────────────────────────────────
  let allCities = [];

  function renderCityPicker() {
    empty(cityPickerWrap);
    const routeIds = routeCityIds();
    const routeFiltered = allCities.filter(c => routeIds.has(c.cityId));
    const hasRouteMatches = routeFiltered.length > 0;
    const listed = hasRouteMatches ? routeFiltered : allCities;

    const label = h('label', {
      class: 'buddy-panel__city-label',
      for: 'buddy-city-select'
    }, t('buddy.panel.cityLabel'));

    if (!allCities.length) {
      cityPickerWrap.appendChild(label);
      cityPickerWrap.appendChild(h('p', { class: 'buddy-panel__city-empty' },
        t('buddy.panel.noCities')));
      return;
    }

    const select = h('select', {
      id: 'buddy-city-select',
      class: 'buddy-panel__city-select',
      'aria-label': t('buddy.panel.cityLabel')
    });

    if (!selectedCity) {
      select.appendChild(h('option', { value: '', disabled: true, selected: true },
        t('buddy.panel.pickCity')));
    }

    for (const c of listed) {
      const opt = h('option', { value: c.cityId }, c.name || c.cityId);
      if (c.cityId === selectedCity) opt.selected = true;
      select.appendChild(opt);
    }

    select.addEventListener('change', (ev) => {
      selectedCity = ev.target.value || null;
      updateCitiesOptIn(selectedCity);
      loadFeed();
    });

    cityPickerWrap.appendChild(label);
    cityPickerWrap.appendChild(select);

    if (!hasRouteMatches) {
      cityPickerWrap.appendChild(h('p', { class: 'buddy-panel__city-hint' },
        t('buddy.panel.pickCity')));
    }
  }

  // ─── Role tabs (Local / Mentor / Traveler) ───────────────────────────────
  function renderTabs() {
    empty(tabsWrap);
    KINDS.forEach((kind, i) => {
      const isActive = kind === selectedKind;
      const tab = h('button', {
        type: 'button',
        role: 'tab',
        id: `buddy-tab-${kind}`,
        class: 'buddy-panel__tab' + (isActive ? ' buddy-panel__tab--active' : ''),
        'aria-selected': isActive ? 'true' : 'false',
        'aria-controls': 'buddy-feed',
        tabindex: isActive ? '0' : '-1',
        'data-kind': kind
      }, t(`buddy.kind.${kind}`));

      tab.addEventListener('click', () => selectKind(kind));
      tab.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          const dir = ev.key === 'ArrowRight' ? 1 : -1;
          const idx = KINDS.indexOf(selectedKind);
          const next = KINDS[(idx + dir + KINDS.length) % KINDS.length];
          selectKind(next, /*focus*/ true);
        } else if (ev.key === 'Home') {
          ev.preventDefault();
          selectKind(KINDS[0], true);
        } else if (ev.key === 'End') {
          ev.preventDefault();
          selectKind(KINDS[KINDS.length - 1], true);
        }
      });

      tabsWrap.appendChild(tab);
    });

    empty(tabHint);
    tabHint.appendChild(document.createTextNode(t(`buddy.kind.${selectedKind}Hint`)));
  }

  function selectKind(kind, focus = false) {
    if (!KINDS.includes(kind)) return;
    selectedKind = kind;
    renderTabs();
    if (focus) {
      const btn = tabsWrap.querySelector(`[data-kind="${kind}"]`);
      if (btn) btn.focus();
    }
  }

  // ─── Feed loader ─────────────────────────────────────────────────────────
  async function loadFeed() {
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    const signal = abortCtrl.signal;

    empty(feedEl);
    if (!selectedCity) {
      feedEl.appendChild(feedStates.empty());
      return;
    }
    feedEl.setAttribute('aria-busy', 'true');
    feedEl.appendChild(feedStates.loading());

    try {
      const posts = await fetchRecentPosts(selectedCity, { limit: 10, signal });
      if (disposed || signal.aborted) return;
      empty(feedEl);
      feedEl.setAttribute('aria-busy', 'false');

      const filtered = Array.isArray(posts)
        ? posts.filter(p => !selectedKind || !p.kind || p.kind === selectedKind)
        : [];

      if (!filtered.length) {
        feedEl.appendChild(feedStates.empty());
        return;
      }

      for (const p of filtered) feedEl.appendChild(renderPostCard(p));
      markSeenIds(filtered.map(p => p.id));
    } catch (err) {
      if (disposed || signal.aborted) return;
      empty(feedEl);
      feedEl.setAttribute('aria-busy', 'false');
      if (err && err.message === 'rate-limited') {
        feedEl.appendChild(feedStates.rateLimited());
      } else {
        feedEl.appendChild(feedStates.error(t('buddy.panel.empty')));
      }
    }
  }

  // ─── Post CTA (consent-gated) ────────────────────────────────────────────
  postBtn.addEventListener('click', async () => {
    if (!selectedCity) return;
    try {
      const mod = await import('../features/buddy-consent.js');
      const consentFn = mod.requireConsent || mod.ensureConsent;
      if (typeof consentFn !== 'function') return;
      const ok = await consentFn();
      if (!ok) return;
    } catch (e) {
      // If the consent module is absent, fail closed — do nothing.
      console.warn('[buddy-panel] consent module missing', e);
      return;
    }

    const prefs = (state.getSlice('buddy') || {}).preferences || {};
    try {
      const url = buildPostUrl({
        kind: selectedKind,
        cityId: selectedCity,
        preferences: prefs
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.warn('[buddy-panel] buildPostUrl failed', e);
    }
  });

  // ─── State subscriptions ─────────────────────────────────────────────────
  const unsubscribers = [];

  unsubscribers.push(state.subscribe('route', () => {
    if (disposed) return;
    renderCityPicker();
  }));

  unsubscribers.push(state.subscribe('language', () => {
    if (disposed) return;
    renderCityPicker();
    renderTabs();
  }));

  unsubscribers.push(state.subscribe('buddy', () => {
    // Intentionally no-op re-render for buddy — we write to it ourselves and
    // don't want render loops. Kept for future consent-state reflection.
  }));

  // ─── Initial paint + async city load ─────────────────────────────────────
  renderTabs();
  renderCityPicker(); // empty list shell first

  getCitiesWithBuddies().then(cities => {
    if (disposed) return;
    allCities = Array.isArray(cities) ? cities : [];
    // If an initialCity was supplied but isn't in the seed, drop it so the
    // picker shows the placeholder instead of a ghost selection.
    if (selectedCity && !allCities.some(c => c.cityId === selectedCity)) {
      selectedCity = null;
    }
    renderCityPicker();
    if (selectedCity) {
      updateCitiesOptIn(selectedCity);
      loadFeed();
    } else {
      empty(feedEl);
      feedEl.appendChild(feedStates.empty());
    }
  }).catch(err => {
    if (disposed) return;
    console.warn('[buddy-panel] city load failed', err);
    empty(feedEl);
    feedEl.appendChild(feedStates.error(t('buddy.panel.noCities')));
  });

  // ─── Cleanup ─────────────────────────────────────────────────────────────
  return function cleanup() {
    disposed = true;
    if (abortCtrl) { try { abortCtrl.abort(); } catch (_) {} }
    for (const un of unsubscribers) { try { un(); } catch (_) {} }
    empty(container);
  };
}
