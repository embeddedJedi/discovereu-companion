// js/ui/language-bridge-panel.js
// v1.7 — Language Bridge main panel (Task 8, partial: 3 tabs — Camera / Voice / Phrasebook).
//
// This module renders the user-facing Language Bridge UI. It is pure UI — all
// pipelines live in js/features/{ocr,translate,phrasebook,voice-translator}.js.
//
// Public API:
//   renderLanguageBridgePanel(container, { initialTab, countryId }) -> cleanup()
//
// Design contract (CLAUDE.md + plan §Task 8):
//   - Zero innerHTML interpolation; everything via h().
//   - All strings through t(); no hardcoded English.
//   - Uses design tokens only (class hooks, no inline style).
//   - Keyboard: arrow-key tablist, visible focus rings (CSS-driven).
//   - Consent gates for camera + OCR size warning; aria-live result cards.
//   - Clean shutdown: stops camera, aborts LLM, unsubscribes state on cleanup.
//
// NOTE: voice-translator.js (Task 7) may or may not exist at import time. We
// load it lazily via dynamic import() in the Voice tab and degrade gracefully
// when absent.

import { h, empty, on } from '../utils/dom.js';
import { t } from '../i18n/i18n.js';
import { state, countryById } from '../state.js';
import {
  requestCameraStream,
  captureFrame,
  recognize,
  mapCountryIdToOcrLang,
  getSlowModeHint
} from '../features/ocr.js';
import { translate } from '../features/translate.js';
import {
  loadPhrasebook,
  searchPhrases,
  getCategories,
  getAvailableCountries,
  bookmarkPhrase
} from '../features/phrasebook.js';

// ---- seed-country → LLM target language (ISO 639-1) --------------------
// Fallback used by the target-language <select>. Anything not listed here
// resolves to 'en' so the picker never crashes on unseeded countries.
const COUNTRY_TO_LANG = Object.freeze({
  DE: 'de', FR: 'fr', IT: 'it', ES: 'es', TR: 'tr',
  AT: 'de', BE: 'fr', CH: 'de', LI: 'de', LU: 'fr',
  NL: 'nl', PL: 'pl', PT: 'pt', CZ: 'cs', SK: 'cs'
});

function countryToLang(cc) {
  if (!cc) return 'en';
  return COUNTRY_TO_LANG[String(cc).toUpperCase()] || 'en';
}

function countryName(cc) {
  if (!cc) return '';
  const c = countryById(String(cc).toLowerCase());
  return c?.name || String(cc).toUpperCase();
}

/**
 * Mount the Language Bridge panel into `container`.
 *
 * @param {HTMLElement} container
 * @param {{ initialTab?: 'camera'|'voice'|'phrasebook', countryId?: string }} [opts]
 * @returns {() => void} cleanup
 */
export function renderLanguageBridgePanel(container, opts = {}) {
  if (!container) {
    throw new Error('renderLanguageBridgePanel: container required');
  }

  const { initialTab = 'phrasebook', countryId = null } = opts;

  let disposed = false;
  let activeTab = initialTab;
  let targetLang = countryToLang(countryId);

  // Resources to clean up.
  let cameraStream = null;
  let cameraVideo = null;
  let abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let currentUtterance = null;
  const unsubs = [];

  // Progress listener for OCR.
  let ocrProgressEl = null;
  const onOcrProgress = (ev) => {
    if (!ocrProgressEl) return;
    const pct = ev?.detail?.percent;
    if (pct == null) return;
    ocrProgressEl.textContent = t('lang.ocr.downloading', { percent: pct });
  };
  window.addEventListener('ocr:progress', onOcrProgress);

  // Re-render on state.language change.
  unsubs.push(state.subscribe('language', () => {
    if (disposed) return;
    render();
  }));
  unsubs.push(state.subscribe('languageBridge', () => {
    if (disposed) return;
    // Only the phrasebook tab depends on saved-phrase state today; cheap rerender.
    if (activeTab === 'phrasebook') render();
  }));

  // ---- camera lifecycle ------------------------------------------------

  function stopCamera() {
    if (cameraStream) {
      try { cameraStream.getTracks().forEach(t => t.stop()); } catch (_) { /* noop */ }
      cameraStream = null;
    }
    if (cameraVideo) {
      try { cameraVideo.srcObject = null; } catch (_) { /* noop */ }
      cameraVideo = null;
    }
  }

  function stopTts() {
    try {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    } catch (_) { /* ignore */ }
    currentUtterance = null;
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    stopCamera();
    stopTts();
    if (abortController) {
      try { abortController.abort(); } catch (_) { /* noop */ }
      abortController = null;
    }
    window.removeEventListener('ocr:progress', onOcrProgress);
    while (unsubs.length) {
      const u = unsubs.pop();
      try { u(); } catch (_) { /* noop */ }
    }
    empty(container);
  }

  // ---- tab switching ---------------------------------------------------

  function switchTab(next) {
    if (next === activeTab) return;
    // Leaving camera tab: release the stream immediately (privacy + battery).
    if (activeTab === 'camera') stopCamera();
    if (activeTab === 'voice') stopTts();
    activeTab = next;
    render();
    // Move focus to the newly selected tab for AT users.
    const tab = container.querySelector(`[role="tab"][data-tab="${next}"]`);
    if (tab) tab.focus();
  }

  // ---- header ----------------------------------------------------------

  function renderHeader() {
    const header = h('header', { class: 'lang-panel__header' });

    header.appendChild(h('h2', {
      class: 'lang-panel__title',
      id: 'lang-panel-title'
    }, t('lang.panel.title')));

    header.appendChild(h('p', { class: 'lang-panel__subtitle' },
      t('lang.panel.subtitle')));

    if (countryId) {
      header.appendChild(h('p', {
        class: 'lang-panel__route-badge',
        role: 'note'
      }, t('lang.panel.currentRoute', { country: countryName(countryId) })));
    }

    // Target language select.
    const selectId = 'lang-panel-target';
    const selectWrap = h('div', { class: 'lang-panel__lang-select' }, [
      h('label', { for: selectId, class: 'lang-panel__lang-label' },
        t('lang.panel.chooseLang')),
      (function buildSelect() {
        const options = [];
        // Prefer seeded countries first for discoverability.
        const seen = new Set();
        for (const cc of getAvailableCountries()) {
          const code = countryToLang(cc);
          if (seen.has(code)) continue;
          seen.add(code);
          options.push(h('option', {
            value: code,
            selected: code === targetLang ? true : null
          }, `${countryName(cc)} (${code})`));
        }
        const sel = h('select', {
          id: selectId,
          class: 'lang-panel__lang-selector',
          'aria-label': t('lang.panel.chooseLang')
        }, options);
        sel.addEventListener('change', (ev) => {
          targetLang = ev.target.value || 'en';
        });
        return sel;
      })()
    ]);
    header.appendChild(selectWrap);

    return header;
  }

  // ---- tab bar ---------------------------------------------------------

  const TABS = [
    { id: 'camera',     key: 'lang.panel.tabs.camera' },
    { id: 'voice',      key: 'lang.panel.tabs.voice' },
    { id: 'phrasebook', key: 'lang.panel.tabs.phrasebook' }
  ];

  function renderTabBar() {
    const bar = h('div', {
      class: 'lang-panel__tabs',
      role: 'tablist',
      'aria-label': t('lang.panel.title')
    });

    TABS.forEach((tab, idx) => {
      const isActive = tab.id === activeTab;
      const btn = h('button', {
        type: 'button',
        role: 'tab',
        id: `lang-tab-${tab.id}`,
        class: 'lang-panel__tab' + (isActive ? ' is-active' : ''),
        'aria-selected': isActive ? 'true' : 'false',
        'aria-controls': `lang-tabpanel-${tab.id}`,
        tabindex: isActive ? '0' : '-1',
        'data-tab': tab.id
      }, t(tab.key));

      btn.addEventListener('click', () => switchTab(tab.id));
      btn.addEventListener('keydown', (ev) => {
        if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
          ev.preventDefault();
          const dir = ev.key === 'ArrowRight' ? 1 : -1;
          const nextIdx = (idx + dir + TABS.length) % TABS.length;
          switchTab(TABS[nextIdx].id);
        } else if (ev.key === 'Home') {
          ev.preventDefault(); switchTab(TABS[0].id);
        } else if (ev.key === 'End') {
          ev.preventDefault(); switchTab(TABS[TABS.length - 1].id);
        }
      });

      bar.appendChild(btn);
    });

    return bar;
  }

  // ---- CAMERA TAB ------------------------------------------------------

  function renderCameraTab() {
    const panel = h('section', {
      role: 'tabpanel',
      id: 'lang-tabpanel-camera',
      'aria-labelledby': 'lang-tab-camera',
      class: 'lang-panel__body lang-panel__body--camera',
      tabindex: '0'
    });

    if (getSlowModeHint()) {
      panel.appendChild(h('p', { class: 'lang-panel__slow-banner', role: 'note' },
        t('lang.voice.slowMode')));
    }

    // Status / live region.
    const status = h('div', {
      class: 'lang-panel__status',
      role: 'status',
      'aria-live': 'polite'
    });

    const progress = h('p', {
      class: 'lang-panel__progress',
      'aria-live': 'polite'
    });
    ocrProgressEl = progress;

    // Result card region.
    const resultRegion = h('div', {
      class: 'lang-panel__result-region',
      'aria-live': 'polite'
    });

    // Initial state: Start button.
    const videoHost = h('div', { class: 'lang-panel__video-host' });
    const controls = h('div', { class: 'lang-panel__camera-controls' });

    const startBtn = h('button', {
      type: 'button',
      class: 'lang-panel__btn lang-panel__btn--primary',
      'data-action': 'start-camera'
    }, t('lang.ocr.start'));

    controls.appendChild(startBtn);

    on(panel, 'click', '[data-action="start-camera"]', async () => {
      // Size-warn consent before the first OCR pack download.
      const consented = window.confirm(t('lang.ocr.sizeWarn'));
      if (!consented) return;

      status.textContent = '';
      try {
        cameraStream = await requestCameraStream();
      } catch (err) {
        const msg = err && err.message === 'camera-permission-denied'
          ? t('lang.ocr.permissionDenied')
          : t('lang.ocr.permissionNeeded');
        empty(status);
        status.setAttribute('role', 'alert');
        status.appendChild(h('p', { class: 'lang-panel__error' }, msg));
        status.appendChild(h('button', {
          type: 'button',
          class: 'lang-panel__btn',
          'data-action': 'start-camera'
        }, t('lang.ocr.start')));
        return;
      }

      // Mount <video>.
      empty(videoHost);
      cameraVideo = h('video', {
        class: 'lang-panel__video',
        autoplay: true,
        playsinline: true,
        muted: true,
        'aria-label': t('lang.ocr.start')
      });
      cameraVideo.srcObject = cameraStream;
      videoHost.appendChild(cameraVideo);

      empty(controls);
      controls.appendChild(h('button', {
        type: 'button',
        class: 'lang-panel__btn lang-panel__btn--primary',
        'data-action': 'capture'
      }, t('lang.ocr.capture')));
    });

    on(panel, 'click', '[data-action="capture"]', async () => {
      if (!cameraVideo) return;
      status.setAttribute('role', 'status');
      status.textContent = t('lang.ocr.recognizing');
      try {
        const blob = await captureFrame(cameraVideo);
        const ocrLang = mapCountryIdToOcrLang(countryId || 'uk');
        const rec = await recognize(blob, ocrLang);
        status.textContent = '';
        progress.textContent = '';

        // Translate the recognized text.
        let translated = { translated: '', targetLang };
        try {
          translated = await translate(rec.text, {
            to: targetLang,
            signal: abortController?.signal
          });
        } catch (err) {
          // Show raw OCR + translation error; not fatal.
          translated = { translated: '', targetLang, error: err.message };
        }
        empty(resultRegion);
        resultRegion.appendChild(renderResultCard({
          source: rec.text,
          translated: translated.translated,
          targetLang: translated.targetLang || targetLang,
          savable: true
        }));
      } catch (err) {
        status.setAttribute('role', 'alert');
        status.textContent = err.message === 'ocr-no-text'
          ? t('lang.ocr.noText')
          : t('lang.errors.offlineFallback');
      }
    });

    panel.appendChild(videoHost);
    panel.appendChild(controls);
    panel.appendChild(progress);
    panel.appendChild(status);
    panel.appendChild(resultRegion);

    return panel;
  }

  // ---- VOICE TAB -------------------------------------------------------

  function renderVoiceTab() {
    const panel = h('section', {
      role: 'tabpanel',
      id: 'lang-tabpanel-voice',
      'aria-labelledby': 'lang-tab-voice',
      class: 'lang-panel__body lang-panel__body--voice',
      tabindex: '0'
    });

    const a11y = state.getSlice('a11y') || {};
    if (a11y.transcribeVoice === false) {
      panel.appendChild(h('div', { class: 'lang-panel__a11y-hint', role: 'note' }, [
        h('p', null, t('lang.voice.ttsUnavailable')),
        h('a', {
          href: '#',
          class: 'lang-panel__link',
          'data-action': 'open-a11y'
        }, t('lang.panel.title'))
      ]));
      return panel;
    }

    if (getSlowModeHint()) {
      panel.appendChild(h('p', { class: 'lang-panel__slow-banner', role: 'note' },
        t('lang.voice.slowMode')));
    }

    const status = h('div', {
      class: 'lang-panel__status',
      role: 'status',
      'aria-live': 'polite'
    });

    const resultRegion = h('div', {
      class: 'lang-panel__result-region',
      'aria-live': 'polite'
    });

    const holdBtn = h('button', {
      type: 'button',
      class: 'lang-panel__hold-btn',
      'data-action': 'voice-hold',
      'aria-label': t('lang.voice.start')
    }, t('lang.voice.start'));

    let mediaRecorder = null;
    let chunks = [];
    let activeStream = null;

    async function startListening() {
      if (mediaRecorder) return;
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (_) {
        status.setAttribute('role', 'alert');
        status.textContent = t('lang.ocr.permissionDenied');
        return;
      }
      status.textContent = t('lang.voice.listening');
      holdBtn.classList.add('is-listening');
      chunks = [];
      try {
        mediaRecorder = new MediaRecorder(activeStream);
      } catch (_) {
        status.textContent = t('lang.voice.ttsUnavailable');
        return;
      }
      mediaRecorder.addEventListener('dataavailable', (e) => {
        if (e.data && e.data.size) chunks.push(e.data);
      });
      mediaRecorder.start();
    }

    async function stopListening() {
      if (!mediaRecorder) return;
      const rec = mediaRecorder;
      mediaRecorder = null;
      holdBtn.classList.remove('is-listening');
      await new Promise((res) => {
        rec.addEventListener('stop', () => res(), { once: true });
        try { rec.stop(); } catch (_) { res(); }
      });
      try { activeStream?.getTracks().forEach(t => t.stop()); } catch (_) { /* noop */ }
      activeStream = null;

      if (!chunks.length) { status.textContent = ''; return; }
      const blob = new Blob(chunks, { type: 'audio/webm' });
      status.textContent = t('lang.voice.translating');

      // voice-translator.js may not exist yet; dynamic import + graceful fallback.
      let result = null;
      try {
        const mod = await import('../features/voice-translator.js');
        if (typeof mod.voiceTranslate === 'function') {
          result = await mod.voiceTranslate(blob, { to: targetLang, signal: abortController?.signal });
        }
      } catch (_) {
        // Module missing — degrade silently.
      }

      if (!result) {
        status.setAttribute('role', 'alert');
        status.textContent = t('lang.errors.offlineFallback');
        return;
      }

      status.textContent = '';
      empty(resultRegion);
      resultRegion.appendChild(renderResultCard({
        source: result.source || '',
        translated: result.translated || '',
        targetLang: result.targetLang || targetLang,
        savable: true,
        playable: true
      }));
    }

    holdBtn.addEventListener('pointerdown', startListening);
    holdBtn.addEventListener('pointerup', stopListening);
    holdBtn.addEventListener('pointercancel', stopListening);
    holdBtn.addEventListener('keydown', (ev) => {
      if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) {
        ev.preventDefault();
        startListening();
      }
    });
    holdBtn.addEventListener('keyup', (ev) => {
      if (ev.key === ' ' || ev.key === 'Enter') {
        ev.preventDefault();
        stopListening();
      }
    });

    panel.appendChild(holdBtn);
    panel.appendChild(status);
    panel.appendChild(resultRegion);
    return panel;
  }

  // ---- PHRASEBOOK TAB --------------------------------------------------

  function renderPhrasebookTab() {
    const panel = h('section', {
      role: 'tabpanel',
      id: 'lang-tabpanel-phrasebook',
      'aria-labelledby': 'lang-tab-phrasebook',
      class: 'lang-panel__body lang-panel__body--phrasebook',
      tabindex: '0'
    });

    // Resolve a country id: explicit > first route stop > first seeded country.
    let pbCountry = countryId;
    if (!pbCountry) {
      const route = state.getSlice('route');
      pbCountry = route?.stops?.[0]?.countryId || getAvailableCountries()[0];
    }
    pbCountry = String(pbCountry).toUpperCase();

    const searchInput = h('input', {
      type: 'search',
      class: 'lang-panel__search',
      placeholder: t('lang.phrasebook.search'),
      'aria-label': t('lang.phrasebook.search')
    });

    const chipsWrap = h('div', {
      class: 'lang-panel__chips',
      role: 'group',
      'aria-label': t('lang.phrasebook.search')
    });

    const list = h('ul', {
      class: 'lang-panel__phrase-list',
      'aria-live': 'polite'
    });

    let loadedBook = null;
    let activeCategory = null;

    function rerenderList() {
      empty(list);
      if (!loadedBook) return;
      const q = searchInput.value || '';
      const matches = searchPhrases(loadedBook, q, { category: activeCategory, limit: 50 });
      if (!matches.length) {
        list.appendChild(h('li', {
          class: 'lang-panel__empty',
          role: 'note'
        }, t('lang.phrasebook.empty')));
        return;
      }
      for (const phrase of matches) {
        list.appendChild(renderPhraseRow(phrase, loadedBook.language, pbCountry));
      }
    }

    searchInput.addEventListener('input', rerenderList);

    panel.appendChild(h('div', { class: 'lang-panel__search-wrap' }, [searchInput]));
    panel.appendChild(chipsWrap);
    panel.appendChild(list);

    // Footer: saved deck link.
    panel.appendChild(h('div', { class: 'lang-panel__footer' }, [
      h('button', {
        type: 'button',
        class: 'lang-panel__link',
        'data-action': 'open-deck',
        disabled: true,
        'aria-disabled': 'true'
      }, t('lang.deck.title'))
    ]));

    // Async load phrasebook.
    loadPhrasebook(pbCountry)
      .then((pb) => {
        if (disposed) return;
        loadedBook = pb;
        empty(chipsWrap);
        const cats = getCategories(pb);
        cats.forEach((cat) => {
          const chip = h('button', {
            type: 'button',
            class: 'lang-panel__chip',
            'aria-pressed': 'false',
            'data-category': cat
          }, t(`lang.phrasebook.category.${cat}`) || cat);
          chip.addEventListener('click', () => {
            if (activeCategory === cat) {
              activeCategory = null;
              chip.setAttribute('aria-pressed', 'false');
            } else {
              // Clear other chips.
              chipsWrap.querySelectorAll('.lang-panel__chip').forEach(c => c.setAttribute('aria-pressed', 'false'));
              activeCategory = cat;
              chip.setAttribute('aria-pressed', 'true');
            }
            rerenderList();
          });
          chipsWrap.appendChild(chip);
        });
        rerenderList();
      })
      .catch((_err) => {
        if (disposed) return;
        empty(list);
        list.appendChild(h('li', {
          class: 'lang-panel__empty',
          role: 'note'
        }, t('lang.phrasebook.empty')));
      });

    return panel;
  }

  function renderPhraseRow(phrase, targetLangCode, cc) {
    const srcId = `lang-src-${phrase.id}`;
    const row = h('li', {
      class: 'lang-panel__phrase-row',
      'aria-describedby': srcId
    }, [
      h('div', { class: 'lang-panel__phrase-text' }, [
        h('p', { class: 'lang-panel__phrase-src', id: srcId, lang: 'en' }, phrase.source),
        h('p', { class: 'lang-panel__phrase-tgt', lang: targetLangCode }, phrase.target),
        phrase.audioHint
          ? h('p', { class: 'lang-panel__phrase-hint' }, phrase.audioHint)
          : null
      ]),
      h('button', {
        type: 'button',
        class: 'lang-panel__btn lang-panel__btn--ghost',
        'aria-label': t('lang.phrasebook.bookmarkAdd'),
        'data-action': 'save-phrase'
      }, t('lang.phrasebook.bookmarkAdd'))
    ]);

    row.querySelector('[data-action="save-phrase"]').addEventListener('click', async () => {
      try {
        await bookmarkPhrase(phrase, cc);
      } catch (_) { /* state subscription will rerender; ignore here */ }
    });

    return row;
  }

  // ---- result card (shared by Camera + Voice) --------------------------

  function renderResultCard({ source, translated, targetLang: tl, savable, playable }) {
    const srcId = `lang-result-src-${Date.now()}`;
    const card = h('article', {
      class: 'lang-panel__result-card',
      'aria-describedby': srcId,
      'aria-live': 'polite'
    }, [
      h('p', { class: 'lang-panel__result-src', id: srcId, lang: 'en' }, source || ''),
      h('p', { class: 'lang-panel__result-tgt', lang: tl || targetLang }, translated || ''),
    ]);

    const actions = h('div', { class: 'lang-panel__result-actions' });

    if (playable && translated) {
      const playBtn = h('button', {
        type: 'button',
        class: 'lang-panel__btn',
        'data-action': 'play-tts'
      }, t('lang.voice.playback'));
      playBtn.addEventListener('click', () => {
        try {
          if (typeof speechSynthesis === 'undefined') return;
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(translated);
          u.lang = tl || targetLang;
          currentUtterance = u;
          speechSynthesis.speak(u);
        } catch (_) { /* ignore */ }
      });
      actions.appendChild(playBtn);
    }

    if (savable && source) {
      const saveBtn = h('button', {
        type: 'button',
        class: 'lang-panel__btn lang-panel__btn--ghost',
        'data-action': 'save-free-phrase'
      }, t('lang.phrasebook.bookmarkAdd'));
      saveBtn.addEventListener('click', async () => {
        const cc = (countryId || 'DE').toUpperCase();
        const synthetic = {
          id: `free-${Date.now()}`,
          source,
          target: translated || source,
          category: null
        };
        try { await bookmarkPhrase(synthetic, cc); } catch (_) { /* ignore */ }
      });
      actions.appendChild(saveBtn);
    }

    if (actions.children.length) card.appendChild(actions);
    return card;
  }

  // ---- main render -----------------------------------------------------

  function render() {
    empty(container);
    const article = h('article', {
      class: 'lang-panel',
      'data-lang-panel': '',
      'aria-labelledby': 'lang-panel-title'
    });

    article.appendChild(renderHeader());
    article.appendChild(renderTabBar());

    let body;
    if (activeTab === 'camera') body = renderCameraTab();
    else if (activeTab === 'voice') body = renderVoiceTab();
    else body = renderPhrasebookTab();
    article.appendChild(body);

    container.appendChild(article);
  }

  render();
  return cleanup;
}
