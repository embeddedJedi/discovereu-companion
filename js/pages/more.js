// js/pages/more.js
// More page: AI hero CTA + grouped settings/features list.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';

let containerEl = null;
let unsubscribers = [];

export function mount(container) {
  containerEl = container;
  render();
  unsubscribers.push(
    state.subscribe('language', render),
    state.subscribe('user', render)
  );
}

export function unmount() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  containerEl = null;
}

function render() {
  if (!containerEl) return;
  empty(containerEl);

  const page = h('div', { class: 'more-page' });

  // AI Hero CTA
  page.appendChild(h('button', {
    class: 'more-hero-cta',
    type: 'button',
    onclick: async () => {
      try {
        const { initAITrigger } = await import('../features/ai-assistant.js');
        initAITrigger();
      } catch (err) { console.error('[more] AI module failed', err); }
    }
  }, [
    h('div', { class: 'more-hero-icon' }, '✨'),
    h('div', { class: 'more-hero-text' }, [
      h('strong', null, t('more.aiTitle')),
      h('p', null, t('more.aiSubtitle'))
    ])
  ]));

  // Section: Share & Remember
  page.appendChild(renderSection(t('more.section.share'), [
    { label: t('more.wrapped'),    icon: '🎆', action: openWrapped },
    { label: t('more.exportPdf'),  icon: '📄', action: openPdfExport },
    { label: t('more.shareRoute'), icon: '🔗', action: shareRoute }
  ]));

  // Section: Compare
  page.appendChild(renderSection(t('more.section.compare'), [
    { label: t('more.radarCompare'), icon: '📊', action: openCompare }
  ]));

  // Section: Accessibility (v1.5 Accessibility Overlay)
  page.appendChild(renderSection(t('a11y.panel.title'), [
    { label: t('a11y.panel.title'), icon: '♿', action: openA11yPanel }
  ]));

  // Section: Turkish Bonus (conditional)
  const user = state.getSlice('user');
  const lang = state.getSlice('language');
  const route = state.getSlice('route');
  const showTurkish = lang === 'tr' || user?.homeCountry === 'TR' ||
    (route?.stops?.[0]?.countryId === 'TR');
  if (showTurkish) {
    page.appendChild(renderSection(t('more.section.turkish'), [
      { label: t('more.visaGuide'),    icon: '🛂', action: () => openTurkishBonus() },
      { label: t('more.sofiaExpress'), icon: '🚂', action: () => openTurkishBonus() },
      { label: t('more.tlBudget'),     icon: '💱', action: () => openTurkishBonus() },
      { label: t('more.consulate'),    icon: '🏛️', action: () => openTurkishBonus() }
    ]));
  }

  // Section: Settings
  page.appendChild(renderSettingsSection());

  containerEl.appendChild(page);
}

function renderSection(title, items) {
  return h('section', { class: 'more-section' }, [
    h('h3', { class: 'more-section-title' }, title),
    h('div', { class: 'more-list' }, items.map(item =>
      h('button', { class: 'more-list-item', type: 'button', onclick: item.action }, [
        h('span', { class: 'more-item-icon' }, item.icon),
        h('span', { class: 'more-item-label' }, item.label),
        h('span', { class: 'more-item-arrow', 'aria-hidden': 'true' }, '›')
      ])
    ))
  ]);
}

function renderSettingsSection() {
  const currentLang = state.getSlice('language') || 'en';
  const currentTheme = state.getSlice('theme') || 'light';

  return h('section', { class: 'more-section' }, [
    h('h3', { class: 'more-section-title' }, t('more.section.settings')),
    h('div', { class: 'more-settings' }, [
      // Language
      h('div', { class: 'more-setting-row' }, [
        h('label', { for: 'moreLangSelect' }, t('more.language')),
        h('select', {
          id: 'moreLangSelect',
          onchange: async (ev) => {
            const { i18n } = await import('../i18n/i18n.js');
            await i18n.load(ev.target.value);
          }
        }, ['en', 'tr', 'de', 'fr', 'es', 'it'].map(code =>
          h('option', { value: code, selected: code === currentLang }, code.toUpperCase())
        ))
      ]),
      // Theme
      h('div', { class: 'more-setting-row' }, [
        h('label', null, t('more.themeLabel')),
        h('div', { class: 'more-theme-toggle' }, ['light', 'dark'].map(theme =>
          h('button', {
            class: `chip ${currentTheme === theme ? 'chip-active' : ''}`,
            type: 'button',
            onclick: () => {
              state.set('theme', theme);
              document.documentElement.setAttribute('data-theme', theme);
            }
          }, t(`more.theme.${theme}`))
        ))
      ]),
      // AI API Key
      h('div', { class: 'more-setting-row' }, [
        h('label', { for: 'moreAiKey' }, t('more.aiKey')),
        h('input', {
          id: 'moreAiKey',
          type: 'password',
          class: 'input',
          placeholder: 'gsk_...',
          value: localStorage.getItem('discoveru:ai.groqKey') || '',
          onchange: (ev) => {
            const key = ev.target.value.trim();
            if (key) {
              localStorage.setItem('discoveru:ai.groqKey', key);
              state.update('ai', ai => ({ ...ai, groqKey: key }));
            } else {
              localStorage.removeItem('discoveru:ai.groqKey');
              state.update('ai', ai => ({ ...ai, groqKey: null }));
            }
          }
        })
      ]),
      // Clear data
      h('button', {
        class: 'btn btn-danger more-clear-btn',
        type: 'button',
        onclick: () => {
          if (confirm(t('more.clearConfirm'))) {
            state.reset();
            location.reload();
          }
        }
      }, t('more.clearData')),
      // About
      h('div', { class: 'more-about' }, [
        h('p', null, t('more.about')),
        h('a', { href: 'https://github.com/embeddedJedi/discovereu-companion', target: '_blank', rel: 'noopener' }, 'GitHub')
      ])
    ])
  ]);
}

// Action handlers
async function openWrapped() {
  try {
    const mod = await import('../features/wrapped.js');
    if (mod.openWrappedModal) mod.openWrappedModal();
    else if (mod.initWrappedTrigger) mod.initWrappedTrigger();
  } catch (err) { console.error('[more] wrapped failed', err); }
}

async function openPdfExport() {
  try {
    const mod = await import('../features/pdf-export.js');
    if (mod.exportPDF) mod.exportPDF();
  } catch (err) { console.error('[more] pdf export failed', err); }
}

async function shareRoute() {
  const { copyCurrentURL } = await import('../utils/share.js');
  const { showToast } = await import('../ui/toast.js');
  const route = state.getSlice('route');
  if (!route?.stops?.length) {
    showToast(t('share.empty'), 'warning');
    return;
  }
  const ok = await copyCurrentURL();
  showToast(ok ? t('share.copied') : t('share.failed'), ok ? 'success' : 'danger');
}

async function openCompare() {
  try {
    const { renderComparePanel } = await import('../ui/compare.js');
    if (renderComparePanel && containerEl) {
      empty(containerEl);
      const wrapper = h('div', { class: 'more-page' });
      wrapper.appendChild(h('button', {
        class: 'guide-back-btn', type: 'button',
        onclick: render
      }, [h('span', null, '←'), h('span', null, ' ' + t('guide.backToList'))]));
      const area = h('div');
      renderComparePanel(area);
      wrapper.appendChild(area);
      containerEl.appendChild(wrapper);
    }
  } catch (err) { console.error('[more] compare failed', err); }
}

async function openA11yPanel() {
  try {
    const { renderA11yPanel } = await import('../ui/a11y-panel.js');
    if (renderA11yPanel && containerEl) {
      empty(containerEl);
      const wrapper = h('div', { class: 'more-page' });
      wrapper.appendChild(h('button', {
        class: 'guide-back-btn', type: 'button',
        onclick: render
      }, [h('span', null, '←'), h('span', null, ' ' + t('guide.backToList'))]));
      const area = h('div');
      renderA11yPanel(area);
      wrapper.appendChild(area);
      containerEl.appendChild(wrapper);
    }
  } catch (err) { console.error('[more] a11y panel failed', err); }
}

async function openTurkishBonus() {
  try {
    const mod = await import('../features/turkish-bonus.js');
    if (mod.renderTurkishBonus && containerEl) {
      empty(containerEl);
      const wrapper = h('div', { class: 'more-page' });
      wrapper.appendChild(h('button', {
        class: 'guide-back-btn', type: 'button',
        onclick: render
      }, [h('span', null, '←'), h('span', null, ' ' + t('guide.backToList'))]));
      const area = h('div');
      mod.renderTurkishBonus(area);
      wrapper.appendChild(area);
      containerEl.appendChild(wrapper);
    }
  } catch (err) { console.error('[more] turkish bonus failed', err); }
}
