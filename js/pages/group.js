// js/pages/group.js
// v1.7 — Group invite / share route.
//
// Two entry paths:
//   1. Standalone /pages/group.html bootstrap (this file also auto-runs).
//   2. SPA route #/group?g=<compressed>  (main.js mounts via PAGE_MODULES).
//
// Behaviour:
//   - Parses `g` from hash ("#/group?g=..."), search ("?g=..."), or legacy
//     "#g=..." fragment.
//   - On success: decodeGroupUrl → mergeIncomingGroup → show invite banner
//     (or conflict confirm) → render the group panel.
//   - On failure: show friendly error + "Go to home" CTA.
//   - All strings flow through t(); no innerHTML of interpolated content.

import { state } from '../state.js';
import { t, load as loadI18n, getLanguage } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';

let mountEl = null;
let unsubLang = null;
let panelCleanup = null;

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

/**
 * Extract the `g` parameter from the current location, supporting:
 *   #/group?g=XXX
 *   #/group&g=XXX   (defensive)
 *   ?g=XXX          (standalone pages/group.html)
 *   #g=XXX          (short fragment fallback)
 */
export function readGroupParam() {
  const hash = (location.hash || '').replace(/^#\/?/, '');
  // strip leading "group"
  let rest = hash;
  if (rest.startsWith('group')) {
    rest = rest.slice('group'.length);
    if (rest.startsWith('/')) rest = rest.slice(1);
  }
  const qIdx = Math.max(rest.indexOf('?'), rest.indexOf('&'));
  if (qIdx >= 0) {
    const qp = new URLSearchParams(rest.slice(qIdx + 1));
    const g = qp.get('g');
    if (g) return g;
  }
  if (hash.startsWith('g=')) return hash.slice(2);

  if (location.search) {
    const g = new URLSearchParams(location.search).get('g');
    if (g) return g;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function renderInviteBanner(container) {
  const banner = h('section', {
    class: 'group-invite-banner',
    role: 'status',
    'aria-live': 'polite'
  }, [
    h('h2', { class: 'group-invite-banner__title' }, t('group.share.invitedTitle')),
    h('p', { class: 'group-invite-banner__body' }, t('group.share.invitedBody'))
  ]);
  container.appendChild(banner);
}

function renderError(container, messageKey) {
  empty(container);
  const section = h('section', { class: 'group-error', role: 'alert' });
  section.appendChild(h('h2', { class: 'group-error__title' }, t('group.share.errorTitle')));
  section.appendChild(h('p', { class: 'group-error__message' }, t(messageKey)));

  const homeBtn = h('a', {
    class: 'btn btn-primary',
    href: './'
  }, t('group.share.goHome'));
  section.appendChild(homeBtn);
  container.appendChild(section);
}

/** Keyboard-accessible confirm dialog for group-code conflicts. */
function askReplaceGroup() {
  return new Promise((resolve) => {
    const overlay = h('div', {
      class: 'group-confirm-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'group-confirm-title'
    });
    const box = h('div', { class: 'group-confirm' });
    box.appendChild(h('h2', {
      id: 'group-confirm-title',
      class: 'group-confirm__title'
    }, t('group.share.conflictTitle')));
    box.appendChild(h('p', { class: 'group-confirm__body' }, t('group.share.conflictBody')));

    const actions = h('div', { class: 'group-confirm__actions' });
    const cancel = h('button', {
      type: 'button',
      class: 'btn btn-ghost'
    }, t('group.share.conflictKeep'));
    const ok = h('button', {
      type: 'button',
      class: 'btn btn-primary'
    }, t('group.share.conflictReplace'));

    const close = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (ev) => {
      if (ev.key === 'Escape') close(false);
    };
    cancel.addEventListener('click', () => close(false));
    ok.addEventListener('click', () => close(true));
    document.addEventListener('keydown', onKey);

    actions.appendChild(cancel);
    actions.appendChild(ok);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Focus the safer default (cancel).
    setTimeout(() => cancel.focus(), 0);
  });
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

function getLocalUserId() {
  const user = state.getSlice('user') || {};
  if (typeof user.id === 'string' && user.id) return user.id;
  const group = state.getSlice('group') || {};
  return group.leaderId || null;
}

async function renderPanel(container) {
  try {
    const mod = await import('../ui/group-plan-panel.js');
    if (typeof mod.renderGroupPanel === 'function') {
      panelCleanup = mod.renderGroupPanel(container);
    }
  } catch (err) {
    // Panel module may not exist yet in early tasks — fail gracefully.
    console.warn('[group-page] panel not available', err?.message || err);
    container.appendChild(h('p', { class: 'group-page__placeholder' },
      t('group.share.panelMissing')));
  }
}

async function processInvite(container) {
  const compressed = readGroupParam();
  if (!compressed) {
    // No invite — just render the panel as-is.
    await renderPanel(container);
    return;
  }

  let groupPlan;
  try {
    groupPlan = await import('../features/group-plan.js');
  } catch (err) {
    console.error('[group-page] group-plan.js import failed', err);
    renderError(container, 'group.share.errorDecode');
    return;
  }

  let decoded;
  try {
    decoded = groupPlan.decodeGroupUrl(compressed);
  } catch (err) {
    console.warn('[group-page] decode failed', err?.message || err);
    renderError(container, 'group.share.errorDecode');
    return;
  }

  const localUserId = getLocalUserId();
  let result;
  try {
    result = groupPlan.mergeIncomingGroup(decoded, localUserId);
  } catch (err) {
    console.warn('[group-page] merge failed', err?.message || err);
    renderError(container, 'group.share.errorMerge');
    return;
  }

  if (result && result.action === 'conflict') {
    const replace = await askReplaceGroup();
    if (replace) {
      // Force-adopt incoming by clearing the local group and re-merging.
      state.update('group', () => ({
        members: [], leaderId: null, createdAt: null, groupCode: null
      }));
      try {
        groupPlan.mergeIncomingGroup(decoded, localUserId);
      } catch (err) {
        console.warn('[group-page] forced merge failed', err?.message || err);
        renderError(container, 'group.share.errorMerge');
        return;
      }
    } else {
      // User kept local group — still render the panel for their current group.
      await renderPanel(container);
      return;
    }
  }

  empty(container);
  renderInviteBanner(container);
  const host = h('div', { class: 'group-panel-host' });
  container.appendChild(host);
  await renderPanel(host);
}

// ---------------------------------------------------------------------------
// Public mount / unmount (SPA contract)
// ---------------------------------------------------------------------------

export async function mount(container) {
  if (!container) return;
  mountEl = container;
  container.classList.add('group-page');

  // Re-render on hashchange so ?g=... updates react live.
  window.addEventListener('hashchange', onHashChange);

  // Re-render text on language change.
  unsubLang = state.subscribe('language', () => {
    // Light refresh: re-process invite so banner/labels update.
    if (mountEl) {
      empty(mountEl);
      processInvite(mountEl);
    }
  });

  await processInvite(container);
}

export function unmount() {
  try { if (typeof panelCleanup === 'function') panelCleanup(); } catch (_) { /* noop */ }
  panelCleanup = null;
  window.removeEventListener('hashchange', onHashChange);
  try { if (typeof unsubLang === 'function') unsubLang(); } catch (_) { /* noop */ }
  unsubLang = null;
  mountEl = null;
}

function onHashChange() {
  if (!mountEl) return;
  empty(mountEl);
  processInvite(mountEl);
}

// ---------------------------------------------------------------------------
// Standalone bootstrap (pages/group.html)
// ---------------------------------------------------------------------------
// When loaded directly (not via SPA router), wire up i18n + theme + mount.

async function bootStandalone() {
  const host = document.getElementById('group-mount');
  if (!host) return;

  try {
    // Theme (best-effort; optional module).
    try {
      const theme = await import('../ui/theme.js');
      if (typeof theme.initTheme === 'function') theme.initTheme();
    } catch (_) { /* noop */ }

    // i18n
    const savedLang = state.getSlice('language') || 'en';
    try {
      await loadI18n(savedLang);
    } catch (err) {
      console.warn('[group-page] i18n load failed', err);
    }

    // Apply i18n to any static data-i18n attributes in the header/title.
    try {
      const i18n = await import('../i18n/i18n.js');
      if (typeof i18n.applyAll === 'function') i18n.applyAll();
      else if (typeof i18n.apply === 'function') i18n.apply(document);
    } catch (_) { /* noop */ }

    await mount(host);
  } catch (err) {
    console.error('[group-page] bootstrap failed', err);
    host.textContent = t('group.share.errorGeneric');
  }
}

// Detect standalone mode by the presence of the dedicated mount node
// AND the absence of the SPA root (#pageRoot belongs to index.html).
if (typeof document !== 'undefined') {
  const isStandalone = !!document.getElementById('group-mount') && !document.getElementById('pageRoot');
  if (isStandalone) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootStandalone);
    } else {
      bootStandalone();
    }
  }
}

// Prevent "unused import" tree-shake concerns; getLanguage is exported for
// any downstream panels that may want it later.
export { getLanguage };
