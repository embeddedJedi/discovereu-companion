// js/ui/coach-panel.js
// v1.6 — AI Intercultural Coach lesson UI.
//
// Renders, in order:
//   - Loading state while coach.getLesson() resolves
//   - Error state with specific i18n key per error.message
//   - Ready state with 6 lesson sections + embedded 5-MCQ quiz + badge claim
//
// Pure UI layer. All logic delegates to js/features/coach.js and
// js/features/coach-badge.js. No innerHTML with interpolated content — all
// DOM is built via h() from js/utils/dom.js.
//
// Public API:
//   renderCoachPanel(container, { countryId }) -> cleanup()
//
// Re-renders when state.language changes. Calls in-flight LLM are best-effort
// cancelled through an AbortController surfaced on the cleanup path (if the
// orchestrator ever exposes one; currently coach.getLesson does not, so the
// cleanup simply ignores a late resolution).

import { state, countryById } from '../state.js';
import { t } from '../i18n/i18n.js';
import { h, empty, on } from '../utils/dom.js';
import {
  getLesson,
  markCompleted,
  claimBadge,
  isBadgeAlreadyEarned
} from '../features/coach.js';
import { runQuizFromData } from '../features/quiz-runner.js';
import { triggerDownload } from '../features/coach-badge.js';

const ERROR_KEY_MAP = {
  'coach-missing-key': 'coach.errors.llmKey',
  'no-key':            'coach.errors.llmKey',
  'coach-llm-error':   'coach.errors.generic',
  'coach-validation-failed': 'coach.errors.generic',
  'rate-limited':      'coach.errors.rateLimited'
};

/**
 * Render the Coach panel into the given container.
 *
 * @param {HTMLElement} container
 * @param {{ countryId: string }} opts
 * @returns {() => void} cleanup function
 */
export function renderCoachPanel(container, { countryId }) {
  if (!container || !countryId) {
    throw new Error('renderCoachPanel: container and countryId are required');
  }

  let disposed = false;
  let unsubscribeLanguage = null;
  const abortController = typeof AbortController !== 'undefined'
    ? new AbortController()
    : null;

  function cleanup() {
    disposed = true;
    if (unsubscribeLanguage) { unsubscribeLanguage(); unsubscribeLanguage = null; }
    if (abortController) {
      try { abortController.abort(); } catch (_) { /* ignore */ }
    }
    empty(container);
  }

  // Re-render on language change.
  unsubscribeLanguage = state.subscribe('language', () => {
    if (disposed) return;
    load();
  });

  function countryName() {
    const c = countryById(countryId);
    return c?.name || countryId;
  }

  // ---- RENDER STATES ---------------------------------------------------

  function renderShell(bodyNode, { showRegenerate = false } = {}) {
    empty(container);

    const article = h('article', {
      class: 'coach-panel',
      'data-coach-panel': '',
      role: 'region',
      'aria-label': t('coach.panel.title')
    });

    const header = h('header', { class: 'coach-panel__header' }, [
      h('div', { class: 'coach-panel__title-wrap' }, [
        h('h2', { class: 'coach-panel__title', id: `coach-title-${countryId}` },
          t('coach.panel.title')),
        h('p', { class: 'coach-panel__subtitle' },
          t('coach.panel.subtitle', { country: countryName() }))
      ]),
      showRegenerate
        ? h('button', {
            type: 'button',
            class: 'coach-panel__regenerate btn btn--ghost',
            'data-action': 'regenerate'
          }, t('coach.panel.regenerate'))
        : null
    ]);

    article.appendChild(header);

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      article.appendChild(h('div', {
        class: 'coach-panel__offline',
        role: 'note'
      }, t('coach.panel.offline')));
    }

    article.appendChild(bodyNode);

    // Delegated click for regenerate.
    on(article, 'click', '[data-action="regenerate"]', () => {
      if (disposed) return;
      load({ regenerate: true });
    });

    container.appendChild(article);
  }

  function renderLoading() {
    const body = h('div', {
      class: 'coach-panel__loading',
      role: 'status',
      'aria-live': 'polite'
    }, [
      h('div', { class: 'coach-panel__spinner', 'aria-hidden': 'true' }),
      h('p', null, t('coach.panel.generating'))
    ]);
    renderShell(body);
  }

  function renderError(err) {
    console.error('[coach] lesson failed', err, {
      message: err?.message,
      cause: err?.cause,
      errors: err?.errors
    });
    const msg = err && typeof err.message === 'string' ? err.message : '';
    const key = ERROR_KEY_MAP[msg] || 'coach.errors.generic';
    const body = h('div', {
      class: 'coach-panel__error',
      role: 'alert'
    }, [
      h('p', null, t(key)),
      h('button', {
        type: 'button',
        class: 'btn btn--primary',
        'data-action': 'regenerate'
      }, t('coach.panel.regenerate'))
    ]);
    renderShell(body, { showRegenerate: false });
  }

  function renderReady(lesson) {
    const body = h('div', { class: 'coach-panel__body' });

    const sections = lesson.sections || {};

    body.appendChild(buildGreetingsSection(sections.greetings));
    body.appendChild(buildParagraphSection('food', sections.food));
    body.appendChild(buildParagraphSection('norms', sections.norms));
    body.appendChild(buildParagraphSection('money', sections.money));
    body.appendChild(buildParagraphSection('context', sections.context));

    // Quiz section with mount point.
    const quizMount = h('div', {
      class: 'coach-panel__quiz-mount',
      'aria-live': 'polite'
    });

    const quizSection = h('section', {
      class: 'coach-section coach-section--quiz',
      'aria-labelledby': `coach-quiz-${countryId}`
    }, [
      h('h3', { id: `coach-quiz-${countryId}` }, t('coach.section.quiz')),
      h('p', { class: 'coach-quiz__intro' }, t('coach.quiz.intro')),
      quizMount
    ]);
    body.appendChild(quizSection);

    // Badge mount below quiz (populated after pass).
    const badgeMount = h('div', { class: 'coach-panel__badge-mount' });
    body.appendChild(badgeMount);

    // If badge already earned, surface that immediately.
    if (isBadgeAlreadyEarned(countryId)) {
      renderAlreadyEarned(badgeMount);
    }

    renderShell(body, { showRegenerate: true });

    // Mount quiz after shell is in the DOM so focus management works.
    mountQuiz(lesson.quiz, quizMount, badgeMount);
  }

  // ---- SECTION BUILDERS ------------------------------------------------

  function buildGreetingsSection(value) {
    const id = `coach-greetings-${countryId}`;
    const section = h('section', {
      class: 'coach-section coach-section--greetings',
      'aria-labelledby': id
    }, [
      h('h3', { id }, t('coach.section.greetings'))
    ]);
    const text = greetingsToText(value);
    if (text) {
      section.appendChild(h('pre', {
        class: 'coach-section__pre'
      }, text));
    } else {
      section.appendChild(h('p', { class: 'coach-section__empty' }, '—'));
    }
    return section;
  }

  function greetingsToText(value) {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.filter(Boolean).join('\n');
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
    }
    return String(value);
  }

  function buildParagraphSection(key, value) {
    const id = `coach-${key}-${countryId}`;
    const section = h('section', {
      class: `coach-section coach-section--${key}`,
      'aria-labelledby': id
    }, [
      h('h3', { id }, t(`coach.section.${key}`))
    ]);
    const paragraphs = toParagraphs(value);
    if (paragraphs.length) {
      paragraphs.forEach(p => section.appendChild(
        h('p', { class: 'coach-section__p' }, p)
      ));
    } else {
      section.appendChild(h('p', { class: 'coach-section__empty' }, '—'));
    }
    return section;
  }

  function toParagraphs(value) {
    if (value == null) return [];
    if (typeof value === 'string') {
      return value.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
    }
    if (Array.isArray(value)) return value.map(String).filter(Boolean);
    if (typeof value === 'object') {
      return Object.values(value).map(String).filter(Boolean);
    }
    return [String(value)];
  }

  // ---- QUIZ ------------------------------------------------------------

  function mountQuiz(quizArray, mountNode, badgeMount) {
    empty(mountNode);

    let quizAdapter;
    try {
      quizAdapter = runQuizFromData(quizArray);
    } catch (e) {
      mountNode.appendChild(h('p', { class: 'coach-quiz__error' },
        t('coach.errors.generic')));
      return;
    }

    let qIndex = 0;

    function renderQuestion() {
      empty(mountNode);
      const item = quizArray[qIndex];
      const qId = `coach-q-${countryId}-${qIndex}`;

      const card = h('div', {
        class: 'coach-quiz__card',
        role: 'group',
        'aria-labelledby': qId
      }, [
        h('p', { class: 'coach-quiz__progress' },
          t('coach.quiz.question', { n: qIndex + 1 })),
        h('h4', { id: qId, class: 'coach-quiz__question' }, item.question)
      ]);

      const list = h('div', {
        class: 'coach-quiz__options',
        role: 'radiogroup',
        'aria-labelledby': qId
      });

      item.options.forEach((opt, i) => {
        const btn = h('button', {
          type: 'button',
          class: 'coach-quiz__option',
          role: 'radio',
          'aria-checked': 'false',
          'data-idx': String(i)
        }, opt);
        btn.addEventListener('click', () => handleAnswer(i));
        btn.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            handleAnswer(i);
          }
        });
        list.appendChild(btn);
      });

      card.appendChild(list);
      mountNode.appendChild(card);

      // Focus the first option for keyboard users.
      const first = list.querySelector('button');
      if (first) first.focus();
    }

    function handleAnswer(idx) {
      if (disposed) return;
      try {
        quizAdapter.chooseAnswer(idx);
      } catch (_) {
        return;
      }
      qIndex++;
      if (qIndex < quizArray.length) {
        renderQuestion();
      } else {
        renderResult();
      }
    }

    function renderResult() {
      const score = quizAdapter.getScore();
      const total = quizAdapter.getTotal();
      const answers = quizAdapter.getAnswers();
      const passed = score >= 4;

      markCompleted(countryId, { passed, score });

      empty(mountNode);
      const card = h('div', {
        class: `coach-quiz__result coach-quiz__result--${passed ? 'pass' : 'fail'}`,
        role: 'status',
        'aria-live': 'polite'
      });

      card.appendChild(h('h4', { class: 'coach-quiz__result-title' },
        passed ? t('coach.quiz.passedTitle') : t('coach.quiz.failedTitle')));

      card.appendChild(h('p', { class: 'coach-quiz__result-score' },
        t('coach.quiz.passedBody', { score: `${score}/${total}` })));

      // Per-question explanations
      const expList = h('ol', { class: 'coach-quiz__explanations' });
      answers.forEach((a, i) => {
        expList.appendChild(h('li', {
          class: a.correct ? 'is-correct' : 'is-wrong'
        }, [
          h('strong', null,
            a.correct ? t('coach.quiz.correct') : t('coach.quiz.incorrect')),
          ' ',
          h('span', null, quizArray[i].explanation || '')
        ]));
      });
      card.appendChild(expList);

      if (!passed) {
        card.appendChild(h('p', { class: 'coach-quiz__fail-body' },
          t('coach.quiz.failedBody')));
      }

      const retryBtn = h('button', {
        type: 'button',
        class: 'btn btn--secondary coach-quiz__retry',
        'data-action': 'retry'
      }, t('coach.quiz.retry'));
      retryBtn.addEventListener('click', () => {
        // Re-run the SAME quiz questions — no new LLM call.
        mountQuiz(quizArray, mountNode, badgeMount);
        empty(badgeMount);
        if (isBadgeAlreadyEarned(countryId)) renderAlreadyEarned(badgeMount);
      });
      card.appendChild(retryBtn);

      mountNode.appendChild(card);

      // Show badge claim area on pass.
      empty(badgeMount);
      if (passed) {
        if (isBadgeAlreadyEarned(countryId)) {
          renderAlreadyEarned(badgeMount);
        } else {
          renderBadgeClaim(badgeMount);
        }
      }
    }

    renderQuestion();
  }

  // ---- BADGE AREA ------------------------------------------------------

  function renderBadgeClaim(mount) {
    empty(mount);

    const emailId = `coach-email-${countryId}`;
    const section = h('section', {
      class: 'coach-badge',
      'aria-labelledby': `coach-badge-heading-${countryId}`
    }, [
      h('h3', {
        id: `coach-badge-heading-${countryId}`,
        class: 'coach-badge__title'
      }, t('coach.badge.earned')),
      h('p', { class: 'coach-badge__hint' }, t('coach.badge.europassHint')),
      h('label', { for: emailId, class: 'coach-badge__label' },
        t('coach.badge.europassHint')),
      h('input', {
        type: 'email',
        id: emailId,
        class: 'coach-badge__email',
        autocomplete: 'email',
        placeholder: 'name@example.com'
      })
    ]);

    const claimBtn = h('button', {
      type: 'button',
      class: 'btn btn--primary coach-badge__claim',
      'data-action': 'claim-badge'
    }, t('coach.badge.download'));

    const postLinkSlot = h('div', { class: 'coach-badge__post' });

    claimBtn.addEventListener('click', async () => {
      claimBtn.disabled = true;
      try {
        const input = section.querySelector(`#${CSS.escape(emailId)}`);
        const recipientEmail = (input && input.value.trim()) || null;
        const assertion = await claimBadge(countryId, { recipientEmail });
        const filename = t('coach.badge.fileName', { country: countryId })
          .replace(/[^A-Za-z0-9._-]+/g, '-');
        triggerDownload(assertion.downloadBlob, filename || `discovereu-badge-${countryId}.json`);

        empty(postLinkSlot);
        postLinkSlot.appendChild(h('a', {
          href: 'https://europa.eu/europass/',
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'coach-badge__europass-link'
        }, t('coach.badge.europassLink')));
      } catch (e) {
        // Surface a generic error inline (toast would be better if available).
        postLinkSlot.appendChild(h('p', {
          role: 'alert',
          class: 'coach-badge__error'
        }, t('coach.errors.generic')));
      } finally {
        claimBtn.disabled = false;
      }
    });

    section.appendChild(claimBtn);
    section.appendChild(postLinkSlot);
    mount.appendChild(section);
  }

  function renderAlreadyEarned(mount) {
    empty(mount);
    const coach = state.getSlice('coach') || {};
    const record = (coach.badgesEarned || []).find(b => b.countryId === countryId);
    const date = record && record.issuedAt
      ? new Date(record.issuedAt).toLocaleDateString()
      : '';
    mount.appendChild(h('section', {
      class: 'coach-badge coach-badge--earned',
      role: 'note'
    }, [
      h('h3', { class: 'coach-badge__title' }, t('coach.badge.earned')),
      h('p', null, t('coach.badge.alreadyEarned', { date })),
      h('a', {
        href: 'https://europa.eu/europass/',
        target: '_blank',
        rel: 'noopener noreferrer',
        class: 'coach-badge__europass-link'
      }, t('coach.badge.europassLink'))
    ]));
  }

  // ---- LOAD LIFECYCLE --------------------------------------------------

  async function load({ regenerate = false } = {}) {
    if (disposed) return;
    renderLoading();
    const lang = state.getSlice('language') || 'en';
    try {
      const lesson = await getLesson(countryId, lang, { regenerate });
      if (disposed) return;
      if (!lesson || !lesson.sections || !Array.isArray(lesson.quiz)) {
        renderError(new Error('coach-validation-failed'));
        return;
      }
      renderReady(lesson);
    } catch (e) {
      if (disposed) return;
      renderError(e);
    }
  }

  load();

  return cleanup;
}
