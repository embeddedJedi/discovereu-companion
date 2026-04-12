// js/ui/ai-modal.js
// 3-screen modal: key entry → prompt → result (with error branches).
// Reuses the existing .modal-overlay container from wrapped.js styling.
// Focus trap + Esc-to-close are inlined here because we do not yet have
// a shared modal helper; keep the code scoped to this module.

import { state } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, on, empty, escape } from '../utils/dom.js';
import { showToast } from './toast.js';
import { suggestRoute } from '../features/ai-assistant.js';
import { storage } from '../utils/storage.js';

const KEY_STORAGE = 'ai.groqKey';

function getKey() {
  return state.getSlice('ai')?.groqKey || storage.get(KEY_STORAGE) || null;
}
function setKey(key) {
  state.update('ai', prev => ({ ...prev, groqKey: key }));
  if (key) storage.set(KEY_STORAGE, key);
  else     storage.remove(KEY_STORAGE);
}

let abortController = null;

export function openAIModal() {
  const overlay = h('div', { class: 'modal-overlay ai-modal-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'aiModalTitle' });
  const card = h('div', { class: 'modal-card ai-modal' }, [
    h('header', { class: 'modal-header' }, [
      h('h2', { id: 'aiModalTitle' }, `✨ ${t('ai.title')}`),
      h('button', { class: 'modal-close', 'aria-label': t('modal.close'), 'data-action': 'close' }, '×')
    ]),
    h('div', { class: 'modal-body ai-modal-body', 'data-screen': 'loading' })
  ]);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const body = card.querySelector('.ai-modal-body');

  const close = () => {
    if (abortController) abortController.abort();
    abortController = null;
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };

  function onKey(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', onKey);
  on(overlay, 'click', ev => { if (ev.target === overlay) close(); });
  on(card, 'click', ev => {
    if (ev.target instanceof HTMLElement && ev.target.dataset.action === 'close') close();
  });

  // Decide first screen
  if (!getKey()) renderKeyScreen(body);
  else           renderPromptScreen(body);
}

// ─── Screens ─────────────────────────────────────────────────────────────

function renderKeyScreen(body) {
  empty(body);
  const input = h('input', {
    type: 'password',
    class: 'input',
    placeholder: 'gsk_…',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-label': t('ai.key.label')
  });
  const save = h('button', { class: 'btn btn-primary', type: 'button' }, t('ai.key.save'));
  on(save, 'click', () => {
    const v = (input.value || '').trim();
    if (!v.startsWith('gsk_') || v.length < 20) {
      showToast({ message: t('ai.key.invalid'), variant: 'warning' });
      return;
    }
    setKey(v);
    renderPromptScreen(body);
  });

  body.appendChild(h('div', { class: 'ai-screen ai-screen-key' }, [
    h('p', null, t('ai.key.intro')),
    h('a', { href: 'https://console.groq.com/keys', target: '_blank', rel: 'noopener' }, t('ai.key.getLink')),
    input,
    save,
    h('p', { class: 'ai-key-privacy' }, t('ai.key.privacy'))
  ]));
  input.focus();
}

function renderPromptScreen(body) {
  empty(body);
  const textarea = h('textarea', {
    class: 'input ai-prompt',
    rows: '4',
    placeholder: t('ai.prompt.placeholder'),
    'aria-label': t('ai.prompt.label')
  });
  const chips = h('div', { class: 'ai-chips' }, [
    chip('🏖️ ' + t('ai.chip.beach'),    'Beaches + small towns, 14 days, mid budget'),
    chip('🏰 ' + t('ai.chip.history'),  'Historic capitals, museums, 12 days'),
    chip('🌲 ' + t('ai.chip.nature'),   'Nordic nature + hiking, 10 days'),
    chip('🎉 ' + t('ai.chip.party'),    'Nightlife + festivals, 10 days, budget'),
    chip('♿ ' + t('ai.chip.access'),   'Accessibility-friendly cities, 14 days')
  ].map(c => {
    on(c, 'click', () => { textarea.value = c.dataset.fill; textarea.focus(); });
    return c;
  }));
  const submit = h('button', { class: 'btn btn-primary', type: 'button' }, t('ai.prompt.submit'));
  on(submit, 'click', () => runSuggestion(body, textarea.value));

  body.appendChild(h('div', { class: 'ai-screen ai-screen-prompt' }, [
    h('p', null, t('ai.prompt.intro')),
    chips,
    textarea,
    submit
  ]));
  textarea.focus();
}

function chip(label, fill) {
  const b = h('button', { class: 'btn btn-outline btn-sm', type: 'button' }, label);
  b.dataset.fill = fill;
  return b;
}

async function runSuggestion(body, userPrompt) {
  empty(body);
  body.appendChild(h('div', { class: 'ai-screen ai-screen-loading' }, [
    h('div', { class: 'spinner', 'aria-hidden': 'true' }),
    h('p', null, t('ai.loading')),
    (() => {
      const cancelBtn = h('button', { class: 'btn btn-ghost', type: 'button' }, t('ai.loading.cancel'));
      on(cancelBtn, 'click', () => { if (abortController) abortController.abort(); });
      return cancelBtn;
    })()
  ]));

  abortController = new AbortController();
  try {
    const result = await suggestRoute({ userPrompt, signal: abortController.signal });
    state.update('ai', prev => ({ ...prev, lastSuggestion: result }));
    renderResultScreen(body, result);
  } catch (err) {
    renderErrorScreen(body, err, userPrompt);
  } finally {
    abortController = null;
  }
}

function renderResultScreen(body, result) {
  empty(body);
  const list = h('ol', { class: 'ai-result-list' },
    result.stops.map(s => h('li', null, [
      h('strong', null, `${s.countryId}`),
      ` — ${s.nights} ${t('ai.result.nights')}`,
      s.reason ? h('div', { class: 'ai-result-reason' }, s.reason) : null
    ]))
  );
  body.appendChild(h('div', { class: 'ai-screen ai-screen-result' }, [
    h('p', null, result.rationale),
    list,
    h('div', { class: 'ai-result-actions' }, [
      button(t('ai.result.replace'),  'primary', () => applyRoute(result.stops, 'replace')),
      button(t('ai.result.add'),      'secondary', () => applyRoute(result.stops, 'add')),
      button(t('ai.result.retry'),    'ghost', () => renderPromptScreen(body))
    ])
  ]));
}

function renderErrorScreen(body, err, lastPrompt) {
  empty(body);
  let key = 'ai.err.network';
  if (err?.name === 'AuthError')      key = 'ai.err.auth';
  else if (err?.name === 'RateLimitError') key = 'ai.err.rate';
  else if (err?.name === 'ParseError')     key = 'ai.err.parse';

  body.appendChild(h('div', { class: 'ai-screen ai-screen-error' }, [
    h('h3', null, `⚠️ ${t(key)}`),
    err?.name === 'AuthError'
      ? button(t('ai.err.updateKey'), 'primary', () => renderKeyScreen(body))
      : button(t('ai.result.retry'),  'primary', () => runSuggestion(body, lastPrompt))
  ]));
}

function applyRoute(stops, mode) {
  state.update('route', prev => {
    const newStops = stops.map(s => ({
      countryId: s.countryId,
      nights: s.nights,
      arrivalDay: 0,
      transport: 'rail'
    }));
    if (mode === 'replace') return { ...prev, stops: newStops };
    return { ...prev, stops: [...prev.stops, ...newStops] };
  });
  showToast({ message: t('ai.result.applied'), variant: 'success' });
  // Close the modal
  document.querySelector('.ai-modal-overlay')?.remove();
}

function button(label, variant, onClick) {
  const cls = variant === 'primary'   ? 'btn btn-primary'
            : variant === 'secondary' ? 'btn btn-secondary'
            : 'btn btn-ghost';
  const b = h('button', { class: cls, type: 'button' }, label);
  on(b, 'click', onClick);
  return b;
}
