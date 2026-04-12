// js/ui/crisis-shield-panel.js
// Crisis Shield — compact card entry point + full modal dialog.
//
// Responsibilities:
//   - renderCompactCard(container, countryId)  → in-panel entry teaser.
//   - openCrisisShield(countryId, initialTab)  → opens full modal with three
//     tabs (numbers / embassy / flowcharts). Handles backdrop-click, Esc,
//     focus trap, and focus restoration.
//   - closeCrisisShield()                      → removes dialog, restores focus.
//
// No innerHTML with interpolated content — every node is built via h().
// All user-facing strings route through t(). Runner + data layers imported
// from sibling feature modules; this module is strictly the view + input
// glue.

import { h, empty, qs } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { state } from '../state.js';
import { showToast } from './toast.js';
import {
  load as loadCrisisData,
  getTRMissions,
  getEmbassyLookup,
  getFlowchart,
  resolveNumberRef,
  resolveUrlRef
} from '../features/crisis-shield.js';
import { createRunner } from '../features/flowchart-runner.js';
import { shareCurrentLocation } from '../features/share-location.js';
import { renderDialList } from './emergency-dial-list.js';

// ─── Module-scoped dialog lifecycle state ────────────────────────────────────

let activeDialog = null;          // { backdrop, panel, cleanup, previousFocus }
let activeCountryId = null;
let activeTab = 'numbers';

const FLOW_IDS = ['lost-passport', 'lost-card', 'medical-emergency'];
const FLOW_I18N_NAMESPACE = {
  'lost-passport':    'crisis.flow.lostPassport',
  'lost-card':        'crisis.flow.lostCard',
  'medical-emergency': 'crisis.flow.medical'
};

// ─── Compact card (entry point inside country-detail panel) ──────────────────

/**
 * Render the Crisis Shield teaser inside `container`. The teaser shows the
 * shield icon, a short title, and an "Open full shield" button that launches
 * the modal for `countryId`.
 *
 * @param {HTMLElement} container
 * @param {string} countryId
 */
export function renderCompactCard(container, countryId) {
  if (!container) return;
  empty(container);

  const openBtn = h('button', {
    type: 'button',
    class: 'crisis-compact-card__open',
    'data-action': 'open-shield',
    onclick: () => openCrisisShield(countryId)
  }, t('crisis.open'));

  const card = h('div', { class: 'crisis-compact-card', role: 'region', 'aria-label': t('crisis.title') }, [
    h('div', { class: 'crisis-compact-card__header' }, [
      h('span', { class: 'crisis-compact-card__icon', 'aria-hidden': 'true' }, '🛡'),
      h('h3', { class: 'crisis-compact-card__title' }, t('crisis.compact.title'))
    ]),
    h('p', { class: 'crisis-compact-card__subtitle' }, t('crisis.compact.subtitle')),
    openBtn
  ]);

  container.appendChild(card);
}

// ─── Full modal dialog ───────────────────────────────────────────────────────

/**
 * Open the Crisis Shield modal dialog for `countryId`. If already open for a
 * different country the previous dialog is closed first. The `initialTab`
 * selects which section opens ('numbers' | 'embassy' | 'flowcharts').
 *
 * @param {string} countryId
 * @param {'numbers'|'embassy'|'flowcharts'} [initialTab]
 */
export async function openCrisisShield(countryId, initialTab = 'numbers') {
  if (activeDialog) closeCrisisShield();

  activeCountryId = countryId;
  activeTab = initialTab || 'numbers';

  // Ensure all data is loaded before mounting; the UI shows a skeleton if the
  // country record is still missing after load.
  try {
    await loadCrisisData();
  } catch (e) {
    console.error('[crisis-shield-panel] data load failed', e);
  }

  const previousFocus = document.activeElement;

  const backdrop = h('div', {
    class: 'crisis-shield-backdrop',
    onclick: (ev) => {
      if (ev.target === backdrop) closeCrisisShield();
    }
  });

  const titleId = 'cs-title-' + Math.random().toString(36).slice(2, 8);

  const closeBtn = h('button', {
    type: 'button',
    class: 'crisis-shield-panel__close',
    'aria-label': t('crisis.close'),
    onclick: closeCrisisShield
  }, '×');

  const tabBar = buildTabBar();
  const body = h('div', { class: 'crisis-shield-panel__body', role: 'tabpanel' });

  const panel = h('div', {
    class: 'crisis-shield-panel',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId
  }, [
    h('header', { class: 'crisis-shield-panel__header' }, [
      h('h2', { id: titleId, class: 'crisis-shield-panel__title' }, t('crisis.title')),
      closeBtn
    ]),
    tabBar,
    body
  ]);

  // Esc to close + focus-trap Tab wrap.
  const keyHandler = (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      closeCrisisShield();
      return;
    }
    if (ev.key === 'Tab') {
      trapFocus(panel, ev);
    }
  };
  document.addEventListener('keydown', keyHandler);

  // Reduced-motion aware enter class — JS-owned animations only.
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion) {
    panel.classList.add('crisis-shield-panel--entering');
    requestAnimationFrame(() => {
      panel.classList.remove('crisis-shield-panel--entering');
      panel.classList.add('crisis-shield-panel--open');
    });
  } else {
    panel.classList.add('crisis-shield-panel--open');
  }

  document.body.appendChild(backdrop);
  document.body.appendChild(panel);

  activeDialog = {
    backdrop,
    panel,
    previousFocus,
    cleanup: () => document.removeEventListener('keydown', keyHandler)
  };

  renderTab(body, activeTab, countryId);

  // Move initial focus to close button (topmost interactive).
  requestAnimationFrame(() => {
    const tabBtn = panel.querySelector(`[role="tab"][data-tab="${activeTab}"]`);
    (tabBtn || closeBtn).focus();
  });
}

/** Close the active Crisis Shield dialog, restoring focus to the opener. */
export function closeCrisisShield() {
  if (!activeDialog) return;
  const { backdrop, panel, cleanup, previousFocus } = activeDialog;
  cleanup();
  backdrop.remove();
  panel.remove();
  activeDialog = null;
  if (previousFocus && typeof previousFocus.focus === 'function') {
    try { previousFocus.focus(); } catch { /* ignore */ }
  }
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

function buildTabBar() {
  const tabs = [
    { id: 'numbers',    labelKey: 'crisis.tab.numbers' },
    { id: 'embassy',    labelKey: 'crisis.tab.embassy' },
    { id: 'flowcharts', labelKey: 'crisis.tab.flows' }
  ];

  const bar = h('div', {
    class: 'crisis-shield-panel__tabs',
    role: 'tablist',
    'aria-label': t('crisis.title')
  });

  tabs.forEach((tab) => {
    const btn = h('button', {
      type: 'button',
      role: 'tab',
      class: 'crisis-shield-panel__tab',
      'data-tab': tab.id,
      'aria-selected': tab.id === activeTab ? 'true' : 'false',
      tabindex: tab.id === activeTab ? '0' : '-1',
      onclick: () => selectTab(tab.id),
      onkeydown: (ev) => onTabKey(ev, tabs.map(x => x.id))
    }, t(tab.labelKey));
    bar.appendChild(btn);
  });

  return bar;
}

function onTabKey(ev, tabIds) {
  if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
  ev.preventDefault();
  const currentIdx = tabIds.indexOf(activeTab);
  if (currentIdx < 0) return;
  const nextIdx = ev.key === 'ArrowRight'
    ? (currentIdx + 1) % tabIds.length
    : (currentIdx - 1 + tabIds.length) % tabIds.length;
  selectTab(tabIds[nextIdx]);
  const nextBtn = activeDialog?.panel.querySelector(`[role="tab"][data-tab="${tabIds[nextIdx]}"]`);
  nextBtn?.focus();
}

function selectTab(tabId) {
  if (!activeDialog) return;
  activeTab = tabId;
  const { panel } = activeDialog;
  panel.querySelectorAll('[role="tab"]').forEach((el) => {
    const selected = el.getAttribute('data-tab') === tabId;
    el.setAttribute('aria-selected', selected ? 'true' : 'false');
    el.setAttribute('tabindex', selected ? '0' : '-1');
  });
  const body = panel.querySelector('.crisis-shield-panel__body');
  renderTab(body, tabId, activeCountryId);
}

// ─── Tab body renderers ──────────────────────────────────────────────────────

function renderTab(body, tabId, countryId) {
  if (!body) return;
  empty(body);
  if (tabId === 'numbers')          renderNumbersTab(body, countryId);
  else if (tabId === 'embassy')     renderEmbassyTab(body, countryId);
  else if (tabId === 'flowcharts')  renderFlowchartsTab(body, countryId);
}

// — Numbers tab ---------------------------------------------------------------

function renderNumbersTab(body, countryId) {
  const dialHost = h('div', { class: 'cs-numbers__list' });
  renderDialList(dialHost, countryId);

  const shareBtn = h('button', {
    type: 'button',
    class: 'cs-share-btn',
    onclick: onShareLocation
  }, [
    h('span', { 'aria-hidden': 'true' }, '📍 '),
    t('crisis.share.button')
  ]);

  body.appendChild(h('section', { class: 'cs-numbers' }, [
    dialHost,
    h('p', { class: 'cs-panel-note', 'aria-live': 'polite' }, t('crisis.call112')),
    shareBtn,
    h('p', { class: 'cs-panel-note' }, t('crisis.offlineNote')),
    h('p', { class: 'cs-panel-note' }, t('crisis.noPII'))
  ]));
}

async function onShareLocation() {
  try {
    const result = await shareCurrentLocation({ messageKey: 'crisis.share.message' });
    if (result === 'shared') {
      showToast(t('crisis.share.success'), 'success');
    } else if (result === 'copied') {
      showToast(t('crisis.share.copied'), 'success');
    } else {
      showToast(t('crisis.share.failed'), 'warn');
    }
  } catch (err) {
    const msg = String(err && err.message || err);
    if (msg.includes('permission-denied')) showToast(t('crisis.share.permissionDenied'), 'error');
    else if (msg.includes('timeout'))      showToast(t('crisis.share.timeout'),          'error');
    else                                   showToast(t('crisis.share.failed'),           'error');
  }
}

// — Embassy tab ---------------------------------------------------------------

function renderEmbassyTab(body, countryId) {
  const section = h('section', { class: 'cs-embassy' });

  // TR missions block
  const trBlock = h('div', { class: 'cs-mission-block' });
  const trHeading = h('h3', { class: 'cs-mission-block__title' },
    t('crisis.embassy.tr.title', { country: countryId }));
  trBlock.appendChild(trHeading);

  const tr = getTRMissions(countryId);
  if (!tr || !tr.missions || tr.missions.length === 0) {
    trBlock.appendChild(h('p', { class: 'cs-panel-note' }, t('crisis.embassy.tr.empty')));
  } else {
    // Re-render title with actual country name if available.
    if (tr.countryName) {
      trHeading.textContent = t('crisis.embassy.tr.title', { country: tr.countryName });
    }
    tr.missions.forEach((m) => trBlock.appendChild(renderMissionCard(m)));
  }
  section.appendChild(trBlock);

  // Own-embassy lookup
  const home = state.getSlice('user')?.homeCountry || 'TR';
  const lookup = getEmbassyLookup(home);
  const otherBlock = h('div', { class: 'cs-mission-block cs-mission-block--other' }, [
    h('h3', { class: 'cs-mission-block__title' }, t('crisis.embassy.other.title')),
    h('p', { class: 'cs-panel-note' },
      t('crisis.embassy.other.guidance', { destCountry: countryId }))
  ]);
  if (lookup) {
    const url = lookup.embassyListUrl || lookup.mfaUrl || lookup.fallbackUrl;
    if (url) {
      otherBlock.appendChild(h('a', {
        class: 'cs-mission-card__link',
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, t('crisis.embassy.other.lookup')));
    }
    if (lookup.guidance) {
      otherBlock.appendChild(h('p', { class: 'cs-panel-note' }, lookup.guidance));
    }
    if (lookup.emergencyPhone) {
      otherBlock.appendChild(h('a', {
        class: 'cs-mission-card__link',
        href: 'tel:' + lookup.emergencyPhone.replace(/[^\d+]/g, ''),
        'aria-label': `${t('crisis.embassy.tr.phone24h')}: ${lookup.emergencyPhone}`
      }, `☎ ${lookup.emergencyPhone}`));
    }
  }
  otherBlock.appendChild(h('p', { class: 'cs-panel-note' }, t('crisis.ownEmbassyHint')));
  section.appendChild(otherBlock);

  body.appendChild(section);
}

function renderMissionCard(mission) {
  const card = h('article', { class: 'cs-mission-card' });
  const heading = [mission.type, mission.city].filter(Boolean).join(' · ');
  card.appendChild(h('h4', { class: 'cs-mission-card__heading' }, heading || t('crisis.embassy.tr.title', { country: '' })));

  if (mission.address) {
    const mapsUrl = 'https://www.google.com/maps/search/?api=1&q='
      + encodeURIComponent(mission.address);
    card.appendChild(h('a', {
      class: 'cs-mission-card__link',
      href: mapsUrl,
      target: '_blank',
      rel: 'noopener noreferrer'
    }, `📍 ${mission.address}`));
  }
  const phone = mission.emergencyPhone || mission.phone;
  if (phone) {
    card.appendChild(h('a', {
      class: 'cs-mission-card__link',
      href: 'tel:' + String(phone).replace(/[^\d+]/g, ''),
      'aria-label': `${t('crisis.embassy.tr.phone24h')}: ${phone}`
    }, `☎ ${phone}`));
  }
  if (mission.email) {
    card.appendChild(h('a', {
      class: 'cs-mission-card__link',
      href: 'mailto:' + mission.email,
      'aria-label': `${t('crisis.embassy.tr.email')}: ${mission.email}`
    }, `✉ ${mission.email}`));
  }
  if (mission.website) {
    card.appendChild(h('a', {
      class: 'cs-mission-card__link',
      href: mission.website,
      target: '_blank',
      rel: 'noopener noreferrer'
    }, mission.website));
  }
  if (mission.hours) {
    card.appendChild(h('p', { class: 'cs-panel-note' }, mission.hours));
  }
  return card;
}

// — Flowcharts tab ------------------------------------------------------------

function renderFlowchartsTab(body, countryId) {
  const home = state.getSlice('user')?.homeCountry || 'TR';
  const picker = h('div', { class: 'cs-flow-picker', role: 'group', 'aria-label': t('crisis.tab.flows') });
  const nodeContainer = h('div', { class: 'crisis-flow', 'aria-live': 'polite' });

  FLOW_IDS.forEach((flowId) => {
    const ns = FLOW_I18N_NAMESPACE[flowId];
    const btn = h('button', {
      type: 'button',
      class: 'flow-picker__btn',
      'data-flow': flowId,
      onclick: () => startFlow(flowId, nodeContainer, countryId, home)
    }, t(`${ns}.title`));
    picker.appendChild(btn);
  });

  body.appendChild(picker);
  body.appendChild(nodeContainer);
}

function startFlow(flowId, nodeContainer, countryId, nationality) {
  const flow = getFlowchart(flowId);
  if (!flow) {
    empty(nodeContainer);
    nodeContainer.appendChild(h('p', { class: 'cs-panel-note' }, t('crisis.flow.done')));
    return;
  }
  let runner;
  runner = createRunner(flow, {
    onEnter: (node) => renderNode(nodeContainer, node, runner, flowId, countryId, nationality)
  });
  // Prime the very first render with the start node.
  renderNode(nodeContainer, flow.nodes[flow.startNode], runner, flowId, countryId, nationality);
}

function renderNode(container, node, runner, flowId, countryId, nationality) {
  if (!container || !node) return;
  empty(container);

  const ns = FLOW_I18N_NAMESPACE[flowId] || '';
  const text = node.text ? t(node.text) : '';

  if (node.kind === 'question') {
    const wrap = h('div', { class: 'flow-node' }, [
      h('p', { class: 'flow-node__prompt' }, text)
    ]);
    const opts = h('ul', { class: 'flow-options', role: 'list' });
    (node.options || []).forEach((opt, idx) => {
      const li = h('li');
      const btn = h('button', {
        type: 'button',
        class: 'flow-option',
        onclick: () => runner.choose(idx),
        onkeydown: (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            runner.choose(idx);
          }
        }
      }, t(opt.labelKey));
      li.appendChild(btn);
      opts.appendChild(li);
    });
    wrap.appendChild(opts);
    container.appendChild(wrap);
  } else if (node.kind === 'action') {
    const wrap = h('div', { class: 'flow-node' }, [
      h('p', { class: 'flow-node__prompt' }, text)
    ]);

    const actions = Array.isArray(node.actions) ? node.actions : [];
    const actionList = h('ul', { class: 'flow-actions', role: 'list' });
    actions.forEach((action) => {
      const item = renderActionItem(action, countryId, nationality);
      if (item) actionList.appendChild(h('li', null, item));
    });
    if (actionList.childNodes.length) wrap.appendChild(actionList);

    // Advance button.
    wrap.appendChild(h('button', {
      type: 'button',
      class: 'flow-option',
      onclick: () => runner.choose()
    }, t('crisis.flow.done')));

    container.appendChild(wrap);
  } else if (node.kind === 'terminal') {
    const wrap = h('div', { class: 'flow-terminal' }, [
      h('p', { class: 'flow-terminal__text' }, text)
    ]);
    if (node.sourceUrl) {
      wrap.appendChild(h('a', {
        class: 'flow-terminal__source',
        href: node.sourceUrl,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, `${t('crisis.flow.source')} ↗`));
    }
    container.appendChild(wrap);
  }

  // Controls: Back + Restart
  const controls = h('div', { class: 'flow-controls' });
  const backBtn = h('button', {
    type: 'button',
    class: 'flow-controls__btn flow-controls__btn--back',
    onclick: () => runner.back()
  }, t('crisis.flow.back'));
  if (!runner.canGoBack()) backBtn.setAttribute('aria-disabled', 'true');

  const restartBtn = h('button', {
    type: 'button',
    class: 'flow-controls__btn flow-controls__btn--restart',
    onclick: () => runner.restart()
  }, t('crisis.flow.restart'));

  controls.appendChild(backBtn);
  controls.appendChild(restartBtn);
  container.appendChild(controls);
}

function renderActionItem(action, countryId, nationality) {
  if (!action || !action.kind) return null;
  switch (action.kind) {
    case 'call': {
      const num = resolveNumberRef(action.numberRef, countryId);
      if (!num) return null;
      return h('a', {
        class: 'cs-mission-card__link',
        href: 'tel:' + String(num).replace(/[^\d+]/g, ''),
        'aria-label': `Call ${num}`
      }, `☎ ${num}`);
    }
    case 'link': {
      const url = action.urlKey ? t(action.urlKey) : '';
      if (!url || url === action.urlKey) return null;
      return h('a', {
        class: 'cs-mission-card__link',
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, url);
    }
    case 'external': {
      const url = resolveUrlRef(action.urlRef, { countryId, nationality });
      if (!url) return null;
      return h('a', {
        class: 'cs-mission-card__link',
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, url);
    }
    case 'copy': {
      const value = action.valueKey ? t(action.valueKey) : '';
      if (!value || value === action.valueKey) return null;
      const btn = h('button', {
        type: 'button',
        class: 'cs-mission-card__link',
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(value);
            showToast(t('crisis.share.copied'), 'success');
          } catch {
            showToast(t('crisis.share.failed'), 'warn');
          }
        }
      }, `⧉ ${value}`);
      return btn;
    }
    case 'share': {
      const value = action.valueKey ? t(action.valueKey) : '';
      if (!value || value === action.valueKey) return null;
      return h('button', {
        type: 'button',
        class: 'cs-mission-card__link',
        onclick: async () => {
          try {
            if (typeof navigator.share === 'function') {
              await navigator.share({ text: value });
              showToast(t('crisis.share.success'), 'success');
            } else if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(value);
              showToast(t('crisis.share.copied'), 'success');
            }
          } catch {
            // User-cancelled share or clipboard failure — silent.
          }
        }
      }, `↗ ${value}`);
    }
    default:
      return null;
  }
}

// ─── Focus trap helper ───────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function trapFocus(root, ev) {
  const focusables = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last  = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (ev.shiftKey && active === first) {
    ev.preventDefault();
    last.focus();
  } else if (!ev.shiftKey && active === last) {
    ev.preventDefault();
    first.focus();
  }
}

// Expose for smoke-tests / dev console.
if (typeof window !== 'undefined') {
  window.__crisisShield = { openCrisisShield, closeCrisisShield, renderCompactCard };
}
