// js/pages/kesfet.js
// Eğlence & Kapsayıcılık — game-inspired fun features.
// Each card has a distinctive visual identity.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty } from '../utils/dom.js';
import {
  listProviders, getActiveProvider, setActiveProvider,
  getApiKey, setApiKey, sendPrompt
} from '../features/llm-adapter.js';

let containerEl = null;
let activeCard = null;
let unsubscribers = [];

const FUN_CARDS = [
  {
    id: 'dares',
    icon: '\u26A1',
    labelKey: 'fun.card.dares',
    teaserFn: () => {
      const streak = state.getSlice('dares')?.streak || 0;
      return streak > 0 ? `${streak} ${t('fun.dayStreak')}` : t('fun.startDare');
    },
    cssClass: 'fun-card--dare',
    gradient: 'linear-gradient(135deg, #FF6B35 0%, #F7C948 100%)'
  },
  {
    id: 'bingo',
    icon: '\uD83D\uDCF8',
    labelKey: 'fun.card.bingo',
    teaserFn: () => {
      const done = Object.keys(state.getSlice('bingo')?.completed || {}).length;
      return `${done}/25 ${t('fun.challenges')}`;
    },
    cssClass: 'fun-card--bingo',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)'
  },
  {
    id: 'futureMe',
    icon: '\u2709\uFE0F',
    labelKey: 'fun.card.futureMe',
    teaserFn: () => {
      const count = (state.getSlice('futureMessages') || []).length;
      return count > 0 ? `${count} ${t('fun.capsules')}` : t('fun.writeCapsule');
    },
    cssClass: 'fun-card--letter',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #14B8A6 100%)'
  },
  {
    id: 'soundtrack',
    icon: '\uD83C\uDFB5',
    labelKey: 'fun.card.soundtrack',
    teaserFn: () => t('fun.listenNow'),
    cssClass: 'fun-card--vinyl',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)'
  },
  {
    id: 'groupVote',
    icon: '\uD83D\uDC65',
    labelKey: 'groupVote.title',
    teaserFn: () => t('groupVote.description'),
    cssClass: 'fun-card--vote',
    gradient: 'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)'
  },
  {
    id: 'journal',
    icon: '\uD83D\uDCCD',
    labelKey: 'journal.title',
    teaserFn: () => t('journal.logLocation'),
    cssClass: 'fun-card--journal',
    gradient: 'linear-gradient(135deg, #059669 0%, #0891B2 100%)'
  }
];

const subModules = {};

export async function mount(container) {
  containerEl = container;
  activeCard = null;
  render();
  unsubscribers.push(
    state.subscribe('bingo', render),
    state.subscribe('dares', render),
    state.subscribe('futureMessages', render),
    state.subscribe('language', render),
    state.subscribe('route', render)
  );
}

export function unmount() {
  unsubscribers.forEach(fn => fn());
  unsubscribers = [];
  activeCard = null;
  containerEl = null;
}

function render() {
  if (!containerEl) return;
  empty(containerEl);

  const page = h('div', { class: 'kesfet-page' });

  if (activeCard) {
    renderExpanded(page);
  } else {
    // Hero
    page.appendChild(h('div', { class: 'kesfet-hero' }, [
      h('h1', { class: 'kesfet-title' }, t('kesfet.pageTitle')),
      h('p', { class: 'kesfet-subtitle' }, t('kesfet.subtitle'))
    ]));

    // Fun cards — each with unique visual identity
    const grid = h('div', { class: 'kesfet-grid' });
    FUN_CARDS.forEach(card => {
      grid.appendChild(h('button', {
        class: `kesfet-card ${card.cssClass}`,
        type: 'button',
        onclick: () => { activeCard = card.id; render(); }
      }, [
        h('div', { class: 'kesfet-card-shine' }),
        h('div', { class: 'kesfet-card-bg', style: { background: card.gradient } }),
        h('div', { class: 'kesfet-card-inner' }, [
          h('div', { class: 'kesfet-card-icon' }, card.icon),
          h('h3', { class: 'kesfet-card-title' }, t(card.labelKey)),
          h('p', { class: 'kesfet-card-teaser' }, card.teaserFn())
        ])
      ]));
    });
    page.appendChild(grid);

    // Inclusion section
    const inclusionSection = h('section', { class: 'kesfet-section' });
    inclusionSection.appendChild(h('h2', { class: 'kesfet-section-title' }, t('kesfet.inclusionTitle')));
    import('../ui/inclusion.js').then(mod => {
      if (mod.renderInclusionPanel) mod.renderInclusionPanel(inclusionSection);
    }).catch(() => {});
    page.appendChild(inclusionSection);

    // Settings
    page.appendChild(renderSettings());
  }

  containerEl.appendChild(page);
}

async function renderExpanded(page) {
  const card = FUN_CARDS.find(c => c.id === activeCard);
  if (!card) { activeCard = null; render(); return; }

  // Back button
  page.appendChild(h('button', {
    class: 'kesfet-back',
    type: 'button',
    onclick: () => { activeCard = null; render(); }
  }, [h('span', null, '\u2190'), h('span', null, t('fun.backToGrid'))]));

  // Expanded header with card's gradient
  page.appendChild(h('div', {
    class: `kesfet-expanded-hero ${card.cssClass}`,
    style: { background: card.gradient }
  }, [
    h('span', { class: 'kesfet-expanded-icon' }, card.icon),
    h('h2', { class: 'kesfet-expanded-title' }, t(card.labelKey))
  ]));

  // Content
  const contentArea = h('div', { class: 'kesfet-expanded-content' });
  page.appendChild(contentArea);

  try {
    if (!subModules[activeCard]) {
      switch (activeCard) {
        case 'bingo':      subModules.bingo = await import('../ui/bingo-tab.js'); break;
        case 'dares':      subModules.dares = await import('../features/daily-dare.js'); break;
        case 'futureMe':   subModules.futureMe = await import('../features/future-me.js'); break;
        case 'soundtrack': subModules.soundtrack = await import('../features/soundtrack.js'); break;
        case 'groupVote':  subModules.groupVote  = await import('../features/group-vote.js'); break;
        case 'journal':    subModules.journal    = await import('../features/journal.js'); break;
      }
    }
    const mod = subModules[activeCard];
    if (mod?.renderInto) await mod.renderInto(contentArea);
  } catch (err) {
    console.error(`[kesfet] failed to load ${activeCard}`, err);
    contentArea.textContent = t('fun.loadError');
  }
}

function renderSettings() {
  const currentLang = state.getSlice('language') || 'en';
  const currentTheme = state.getSlice('theme') || 'light';

  return h('section', { class: 'kesfet-section kesfet-settings' }, [
    h('h2', { class: 'kesfet-section-title' }, t('more.section.settings')),
    h('div', { class: 'kesfet-settings-grid' }, [
      h('div', { class: 'kesfet-setting' }, [
        h('label', { for: 'ksLang' }, t('more.language')),
        h('select', {
          id: 'ksLang',
          onchange: async (ev) => {
            const { i18n } = await import('../i18n/i18n.js');
            await i18n.load(ev.target.value);
          }
        }, ['en', 'tr', 'de', 'fr', 'es', 'it'].map(code =>
          h('option', { value: code, selected: code === currentLang }, code.toUpperCase())
        ))
      ]),
      h('div', { class: 'kesfet-setting' }, [
        h('label', null, t('more.themeLabel')),
        h('div', { class: 'kesfet-theme-btns' }, ['light', 'dark'].map(theme =>
          h('button', {
            class: `chip ${currentTheme === theme ? 'chip-active' : ''}`,
            type: 'button',
            onclick: () => { state.set('theme', theme); document.documentElement.setAttribute('data-theme', theme); }
          }, t(`more.theme.${theme}`))
        ))
      ]),
      renderLlmSetting()
    ]),
    h('button', {
      class: 'btn btn-danger', style: { width: '100%', marginTop: 'var(--space-4)' },
      type: 'button',
      onclick: () => { if (confirm(t('more.clearConfirm'))) { state.reset(); location.reload(); } }
    }, t('more.clearData'))
  ]);
}

// ─── Multi-LLM provider setting ─────────────────────────────────────────────
const PROVIDER_LINKS = {
  groq:   { href: 'https://console.groq.com/keys',    placeholder: 'gsk_...',      helpKey: 'llm.getGroqKey'   },
  gemini: { href: 'https://aistudio.google.com/apikey', placeholder: 'AIza...',    helpKey: 'llm.getGeminiKey' },
  openai: { href: 'https://platform.openai.com/api-keys', placeholder: 'sk-...',   helpKey: 'llm.getOpenAIKey' }
};

function renderLlmSetting() {
  const providers = listProviders();
  let selectedId = getActiveProvider();
  const wrap = h('div', { class: 'kesfet-setting kesfet-setting--llm' });

  const providerSelect = h('select', {
    id: 'ksLlmProvider',
    class: 'input',
    onchange: (ev) => {
      selectedId = ev.target.value;
      setActiveProvider(selectedId);
      refreshKeyInput();
      refreshHelp();
    }
  }, providers.map(p =>
    h('option', { value: p.id, selected: p.id === selectedId }, p.label)
  ));

  const keyInput = h('input', {
    id: 'ksLlmKey',
    type: 'password',
    class: 'input',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: PROVIDER_LINKS[selectedId]?.placeholder || ''
  });
  const saveBtn   = h('button', { class: 'btn btn-primary', type: 'button' }, t('llm.saveKey'));
  const testBtn   = h('button', { class: 'btn btn-ghost',   type: 'button' }, t('llm.testConnection'));
  const statusEl  = h('span', { class: 'kesfet-llm-status', role: 'status', 'aria-live': 'polite' });
  const helpEl    = h('div',  { class: 'kesfet-llm-help text-muted small' });

  function refreshKeyInput() {
    keyInput.value = getApiKey(selectedId) || '';
    keyInput.placeholder = PROVIDER_LINKS[selectedId]?.placeholder || '';
    statusEl.textContent = '';
  }
  function refreshHelp() {
    empty(helpEl);
    const info = PROVIDER_LINKS[selectedId];
    if (!info) return;
    helpEl.appendChild(h('a', { href: info.href, target: '_blank', rel: 'noopener' }, t(info.helpKey)));
    if (selectedId === 'openai') {
      helpEl.appendChild(h('div', { class: 'text-muted small' }, t('llm.openAINote')));
    }
  }

  saveBtn.addEventListener('click', () => {
    const v = (keyInput.value || '').trim();
    setApiKey(selectedId, v);
    statusEl.textContent = t('llm.keySavedToast');
  });

  testBtn.addEventListener('click', async () => {
    const v = (keyInput.value || '').trim();
    if (v) setApiKey(selectedId, v);
    statusEl.textContent = '…';
    try {
      const r = await sendPrompt({
        messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
        providerOverride: selectedId
      });
      statusEl.textContent = r?.content ? t('llm.testSuccess') : t('llm.testFailure');
    } catch (err) {
      console.warn('[llm test]', err);
      statusEl.textContent = `${t('llm.testFailure')} (${err?.name || 'error'})`;
    }
  });

  refreshKeyInput();
  refreshHelp();

  wrap.appendChild(h('label', { for: 'ksLlmProvider' }, t('llm.providerLabel')));
  wrap.appendChild(providerSelect);
  wrap.appendChild(h('label', { for: 'ksLlmKey', style: { marginTop: 'var(--space-2)' } }, t('llm.apiKeyLabel')));
  wrap.appendChild(keyInput);
  wrap.appendChild(h('div', { class: 'kesfet-llm-actions', style: { display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' } }, [saveBtn, testBtn]));
  wrap.appendChild(statusEl);
  wrap.appendChild(helpEl);
  return wrap;
}
