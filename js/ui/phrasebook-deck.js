// js/ui/phrasebook-deck.js
// v1.7 — Language Bridge: saved-phrases review UI.
//
// Pure UI module. Reads state.languageBridge.savedPhrases, renders a filterable
// deck of bookmarked phrases with TTS playback + remove + clear-all.
//
// Public API:
//   renderPhrasebookDeck(container) -> cleanup()
//
// Design contract (CLAUDE.md + plan Task 9):
//   - Zero innerHTML interpolation; everything via h().
//   - All strings via t(); no hardcoded English.
//   - Design tokens only via CSS classes — no inline styles.
//   - Keyboard-friendly: visible focus rings (CSS), 56x56 tap targets (CSS),
//     semantic <button>/<article> with ARIA labelling.
//   - aria-live="polite" on the deck so add/remove is announced.
//   - Subscribes to state.languageBridge for live re-render; cleanup
//     unsubscribes and cancels any in-flight TTS.

import { h, empty } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { state, countryById } from '../state.js';
import { removeBookmark } from '../features/phrasebook.js';

// Lightweight ISO alpha-2 → flag emoji. Returns '' if input not A-Z alpha-2.
function flagEmoji(cc) {
  if (typeof cc !== 'string' || cc.length !== 2) return '';
  const up = cc.toUpperCase();
  if (!/^[A-Z]{2}$/.test(up)) return '';
  const base = 0x1f1e6;
  return String.fromCodePoint(base + (up.charCodeAt(0) - 65), base + (up.charCodeAt(1) - 65));
}

function countryLabel(cc) {
  if (!cc) return '';
  const c = countryById(String(cc).toLowerCase());
  return c?.name || String(cc).toUpperCase();
}

function formatSavedDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) {
    return '';
  }
}

/**
 * Mount the saved-phrases deck into `container`.
 *
 * @param {HTMLElement} container
 * @returns {() => void} cleanup
 */
export function renderPhrasebookDeck(container) {
  if (!container) {
    throw new Error('renderPhrasebookDeck: container required');
  }

  let disposed = false;
  let activeCountry = null; // filter chip state: null = show all
  const unsubs = [];

  // Cancel any outstanding TTS on cleanup.
  function stopTts() {
    try {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    } catch (_) { /* ignore */ }
    // Best-effort: also try voice-translator.cancelSpeak if loaded.
    import('../features/voice-translator.js')
      .then((mod) => { try { mod.cancelSpeak?.(); } catch (_) { /* noop */ } })
      .catch(() => { /* module missing — already cancelled above */ });
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    stopTts();
    while (unsubs.length) {
      const u = unsubs.pop();
      try { u(); } catch (_) { /* noop */ }
    }
    empty(container);
  }

  // Re-render whenever saved phrases change.
  unsubs.push(state.subscribe('languageBridge', () => {
    if (disposed) return;
    render();
  }));

  function getPhrases() {
    const lb = state.getSlice('languageBridge');
    const arr = lb && Array.isArray(lb.savedPhrases) ? lb.savedPhrases.slice() : [];
    // Sort: newest savedAt first (stable fallback on equal/missing timestamps).
    arr.sort((a, b) => {
      const ta = a && a.savedAt ? Date.parse(a.savedAt) : 0;
      const tb = b && b.savedAt ? Date.parse(b.savedAt) : 0;
      return (isNaN(tb) ? 0 : tb) - (isNaN(ta) ? 0 : ta);
    });
    return arr;
  }

  function distinctCountries(phrases) {
    const seen = new Set();
    const out = [];
    for (const p of phrases) {
      if (!p || typeof p.countryId !== 'string') continue;
      const cc = p.countryId.toUpperCase();
      if (seen.has(cc)) continue;
      seen.add(cc);
      out.push(cc);
    }
    return out;
  }

  // ---- header ---------------------------------------------------------

  function renderHeader(phrases) {
    const header = h('header', { class: 'phrasebook-deck__header' });

    header.appendChild(h('h2', {
      class: 'phrasebook-deck__title',
      id: 'phrasebook-deck-title'
    }, t('lang.deck.title')));

    const clearBtn = h('button', {
      type: 'button',
      class: 'phrasebook-deck__btn phrasebook-deck__btn--danger',
      'data-action': 'clear-all',
      disabled: phrases.length === 0 ? true : null,
      'aria-disabled': phrases.length === 0 ? 'true' : 'false'
    }, t('lang.deck.removeAll'));

    clearBtn.addEventListener('click', async () => {
      if (!phrases.length) return;
      const ok = window.confirm(t('lang.deck.removeAll'));
      if (!ok) return;
      // Remove one-by-one so IDB + state stay consistent with removeBookmark().
      const ids = phrases.map((p) => p.id).filter(Boolean);
      for (const id of ids) {
        try { await removeBookmark(id); } catch (_) { /* continue */ }
      }
      // State subscription re-renders automatically.
    });

    header.appendChild(clearBtn);
    return header;
  }

  // ---- sticky filter bar ---------------------------------------------

  function renderFilterBar(phrases) {
    const bar = h('div', {
      class: 'phrasebook-deck__filters',
      role: 'group',
      'aria-label': t('lang.deck.title')
    });

    const countries = distinctCountries(phrases);
    if (!countries.length) return bar;

    const makeChip = (cc, label, isActive) => {
      const chip = h('button', {
        type: 'button',
        class: 'phrasebook-deck__chip' + (isActive ? ' is-active' : ''),
        'aria-pressed': isActive ? 'true' : 'false',
        'data-country': cc == null ? '' : cc
      }, label);
      chip.addEventListener('click', () => {
        activeCountry = cc;
        render();
      });
      return chip;
    };

    bar.appendChild(makeChip(null, t('lang.deck.title'), activeCountry === null));

    for (const cc of countries) {
      const flag = flagEmoji(cc);
      const label = (flag ? `${flag} ` : '') + countryLabel(cc);
      bar.appendChild(makeChip(cc, label, activeCountry === cc));
    }

    return bar;
  }

  // ---- phrase card ---------------------------------------------------

  function renderCard(phrase) {
    const cc = typeof phrase.countryId === 'string' ? phrase.countryId.toUpperCase() : '';
    const tgtLang = phrase.targetLang || 'en';
    const srcLang = phrase.sourceLang || 'en';
    const targetId = `phrasebook-deck-tgt-${phrase.id}`;

    const flag = flagEmoji(cc);
    const badge = h('span', {
      class: 'phrasebook-deck__badge',
      'aria-label': countryLabel(cc)
    }, (flag ? `${flag} ` : '') + cc);

    const sourceEl = h('p', {
      class: 'phrasebook-deck__src',
      lang: srcLang
    }, phrase.source || '');

    const targetEl = h('p', {
      class: 'phrasebook-deck__tgt',
      id: targetId,
      lang: tgtLang
    }, phrase.target || '');

    const dateEl = h('p', {
      class: 'phrasebook-deck__date'
    }, formatSavedDate(phrase.savedAt));

    const playBtn = h('button', {
      type: 'button',
      class: 'phrasebook-deck__btn phrasebook-deck__btn--play',
      'data-action': 'play-audio',
      'aria-label': t('lang.deck.playAudio')
    }, t('lang.deck.playAudio'));

    playBtn.addEventListener('click', async () => {
      try {
        const mod = await import('../features/voice-translator.js');
        if (typeof mod.speakText === 'function') {
          try { mod.cancelSpeak?.(); } catch (_) { /* noop */ }
          mod.speakText(phrase.target || '', tgtLang);
          return;
        }
      } catch (_) { /* fall through to native TTS */ }
      // Fallback: native Web Speech API.
      try {
        if (typeof speechSynthesis !== 'undefined' && phrase.target) {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(phrase.target);
          u.lang = tgtLang;
          speechSynthesis.speak(u);
        }
      } catch (_) { /* ignore */ }
    });

    const removeBtn = h('button', {
      type: 'button',
      class: 'phrasebook-deck__btn phrasebook-deck__btn--ghost',
      'data-action': 'remove',
      'aria-label': t('lang.phrasebook.bookmarkRemove')
    }, t('lang.phrasebook.bookmarkRemove'));

    removeBtn.addEventListener('click', async () => {
      try { await removeBookmark(phrase.id); } catch (_) { /* state subscription rerenders */ }
    });

    const actions = h('div', { class: 'phrasebook-deck__actions' }, [playBtn, removeBtn]);

    return h('article', {
      class: 'phrasebook-deck__card',
      role: 'article',
      'aria-labelledby': targetId
    }, [
      h('div', { class: 'phrasebook-deck__card-head' }, [badge, dateEl]),
      h('div', { class: 'phrasebook-deck__card-body' }, [sourceEl, targetEl]),
      actions
    ]);
  }

  // ---- main render ---------------------------------------------------

  function render() {
    if (disposed) return;
    empty(container);

    const all = getPhrases();
    const filtered = activeCountry
      ? all.filter((p) => (p.countryId || '').toUpperCase() === activeCountry)
      : all;

    const root = h('section', {
      class: 'phrasebook-deck',
      'aria-labelledby': 'phrasebook-deck-title',
      'aria-live': 'polite'
    });

    root.appendChild(renderHeader(all));
    root.appendChild(renderFilterBar(all));

    if (!filtered.length) {
      root.appendChild(h('p', {
        class: 'phrasebook-deck__empty',
        role: 'note'
      }, t('lang.deck.empty')));
    } else {
      const list = h('div', { class: 'phrasebook-deck__list' });
      for (const phrase of filtered) {
        if (!phrase || typeof phrase.id !== 'string') continue;
        list.appendChild(renderCard(phrase));
      }
      root.appendChild(list);
    }

    container.appendChild(root);
  }

  render();
  return cleanup;
}
