// js/features/buddy-consent.js
// Buddy Matching consent gate (v1.6).
//
// Full-screen modal shown before ANY buddy feature activates. Users must
// explicitly acknowledge what gets shared, what does not, and a short safety
// checklist before continuing. Consent is persisted in state.buddy.consented
// so we only show the gate once per user.
//
// Exports:
//   requireConsent() → Promise<boolean>
//     Resolves `true` if the user accepts (and state.buddy.consented flips
//     true), `false` if cancels/Esc/backdrop. If already consented, resolves
//     immediately with `true` without opening the modal.
//   resetConsent()  (test helper)
//     Sets state.buddy.consented = false.
//
// Implementation notes:
//   - All DOM built via h(); never innerHTML with interpolated content.
//   - Strings route through t(); no hardcoded copy.
//   - Focus trap: Tab/Shift+Tab cycles checkbox → continue → cancel → wrap.
//   - Esc acts as Cancel. Backdrop click only dismisses if target IS backdrop.
//   - Reduced-motion: skip fade-in when the OS asks for reduced motion.
//   - Styles live in css/buddy.css (class hooks only).

import { h } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { state } from '../state.js';

let activeGate = null;   // { backdrop, resolve, cleanup, previousFocus }

/**
 * Open the consent gate (or resolve immediately if already consented).
 * @returns {Promise<boolean>}
 */
export function requireConsent() {
  const buddy = state.getSlice('buddy');
  if (buddy && buddy.consented === true) {
    return Promise.resolve(true);
  }
  // If a gate is already mounted, reuse its promise instead of stacking.
  if (activeGate) {
    return new Promise((resolve) => {
      const prev = activeGate.resolve;
      activeGate.resolve = (v) => { prev(v); resolve(v); };
    });
  }
  return openGate();
}

/**
 * Test helper — revokes consent locally so the gate reappears next call.
 */
export function resetConsent() {
  state.update('buddy', (b) => ({ ...b, consented: false }));
}

// ─── Internal ────────────────────────────────────────────────────────────────

function openGate() {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const reduceMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Checkbox — gates the continue button.
    const checkbox = h('input', {
      type: 'checkbox',
      id: 'buddy-consent-checkbox',
      class: 'buddy-consent-checkbox',
      'aria-describedby': 'buddy-consent-sections'
    });

    const continueBtn = h('button', {
      type: 'button',
      class: 'btn-primary buddy-consent-continue',
      'data-action': 'consent-accept',
      disabled: true
    }, t('buddy.consent.continue'));

    const cancelBtn = h('button', {
      type: 'button',
      class: 'btn-ghost buddy-consent-cancel',
      'data-action': 'consent-cancel'
    }, t('buddy.consent.cancel'));

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) continueBtn.removeAttribute('disabled');
      else continueBtn.setAttribute('disabled', '');
    });

    const titleEl = h('h2', {
      id: 'buddy-consent-title',
      class: 'buddy-consent-title',
      tabindex: '-1'
    }, t('buddy.consent.title'));

    const sharedSection = h('section', { class: 'buddy-consent-section buddy-consent-section--shared' },
      h('h3', { class: 'buddy-consent-section-title' }, t('buddy.consent.sharedTitle')),
      h('p', { class: 'buddy-consent-section-body' }, t('buddy.consent.shared'))
    );

    const notSharedSection = h('section', { class: 'buddy-consent-section buddy-consent-section--not-shared' },
      h('h3', { class: 'buddy-consent-section-title' }, t('buddy.consent.notSharedTitle')),
      h('p', { class: 'buddy-consent-section-body buddy-consent-section-body--emphasis' }, t('buddy.consent.notShared'))
    );

    const safetySection = h('section', { class: 'buddy-consent-section buddy-consent-section--safety' },
      h('h3', { class: 'buddy-consent-section-title' }, t('buddy.consent.safetyTitle')),
      h('ul', { class: 'buddy-consent-safety-list' },
        h('li', null, t('buddy.consent.safety1')),
        h('li', null, t('buddy.consent.safety2')),
        h('li', null, t('buddy.consent.safety3'))
      )
    );

    const crisisSection = h('section', { class: 'buddy-consent-section buddy-consent-section--crisis' },
      h('button', {
        type: 'button',
        class: 'buddy-consent-crisis-link',
        'data-action': 'consent-crisis',
        onclick: () => openCrisisShieldForFirstStop()
      }, t('buddy.consent.crisisLink'))
    );

    const sectionsWrap = h('div', { id: 'buddy-consent-sections', class: 'buddy-consent-sections' },
      sharedSection,
      notSharedSection,
      safetySection,
      crisisSection
    );

    const checkboxRow = h('label', {
      class: 'buddy-consent-checkbox-row',
      for: 'buddy-consent-checkbox'
    }, checkbox, h('span', { class: 'buddy-consent-checkbox-label' }, t('buddy.consent.checkbox')));

    const actions = h('div', { class: 'buddy-consent-actions' }, continueBtn, cancelBtn);

    const dialog = h('div', {
      class: 'buddy-consent-dialog',
      role: 'document'
    }, titleEl, sectionsWrap, checkboxRow, actions);

    const backdrop = h('div', {
      class: 'buddy-consent-backdrop' + (reduceMotion ? '' : ' buddy-consent-backdrop--entering'),
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'buddy-consent-title'
    }, dialog);

    // ─── Handlers ────────────────────────────────────────────────────────────
    function accept() {
      if (!checkbox.checked) return;
      state.update('buddy', (b) => ({ ...b, consented: true }));
      finish(true);
    }
    function cancel() {
      finish(false);
    }
    function finish(result) {
      if (!activeGate) return;
      activeGate.cleanup();
      const r = activeGate.resolve;
      activeGate = null;
      try { if (previousFocus && previousFocus.focus) previousFocus.focus(); } catch (_) { /* ignore */ }
      r(result);
    }

    continueBtn.addEventListener('click', accept);
    cancelBtn.addEventListener('click', cancel);

    backdrop.addEventListener('click', (ev) => {
      if (ev.target === backdrop) cancel();
    });

    // Focus trap — cycle checkbox → continue → cancel.
    function focusables() {
      const list = [checkbox];
      if (!continueBtn.hasAttribute('disabled')) list.push(continueBtn);
      list.push(cancelBtn);
      return list;
    }
    function onKey(ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        cancel();
        return;
      }
      if (ev.key !== 'Tab') return;
      const items = focusables();
      const active = document.activeElement;
      const idx = items.indexOf(active);
      if (ev.shiftKey) {
        ev.preventDefault();
        const next = idx <= 0 ? items[items.length - 1] : items[idx - 1];
        next.focus();
      } else {
        ev.preventDefault();
        const next = idx === -1 || idx === items.length - 1 ? items[0] : items[idx + 1];
        next.focus();
      }
    }
    backdrop.addEventListener('keydown', onKey);

    const cleanup = () => {
      backdrop.removeEventListener('keydown', onKey);
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    };

    activeGate = { backdrop, resolve, cleanup, previousFocus };

    document.body.appendChild(backdrop);

    // Announce title via screen reader; delay one frame so role=dialog is live.
    requestAnimationFrame(() => {
      try { titleEl.focus(); } catch (_) { /* ignore */ }
    });
  });
}

/**
 * Open Crisis Shield for the first stop of the current route, if available.
 * Falls back to a console warning when the panel module can't be loaded or
 * no stop is known (e.g. user hasn't built a route yet).
 */
async function openCrisisShieldForFirstStop() {
  const route = state.getSlice('route');
  const firstStop = route && Array.isArray(route.stops) && route.stops[0];
  const countryId = firstStop && firstStop.countryId;
  try {
    const mod = await import('../ui/crisis-shield-panel.js');
    if (typeof mod.openCrisisShield === 'function') {
      if (!countryId) {
        console.warn('[buddy-consent] no route stop for Crisis Shield deep-link');
        return;
      }
      mod.openCrisisShield(countryId);
    } else {
      console.warn('[buddy-consent] openCrisisShield not exported');
    }
  } catch (e) {
    console.warn('[buddy-consent] Crisis Shield panel unavailable', e);
  }
}
