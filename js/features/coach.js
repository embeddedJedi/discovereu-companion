// js/features/coach.js
// Main API for the AI Intercultural Coach.
// Orchestrates: prompt build → LLM call (JSON mode) → schema validation →
// IndexedDB cache → state updates → OpenBadge 2.0 assertion claim.
//
// Errors thrown:
//   - 'coach-validation-failed' (err.errors = [...])
//   - 'coach-not-passed'
//   - 'coach-llm-error'
//   - 'coach-missing-key'
//
// All LLM output is validated by `validateCoachResponse` before being cached;
// invalid output never reaches the UI.

import { buildCoachPrompt, validateCoachResponse } from './coach-prompt.js';
import { sendPrompt, AuthError } from './llm-adapter.js';
import { buildAssertion } from './coach-badge.js';
import {
  putCoachLesson,
  getCoachLesson,
  putCoachBadge
} from '../utils/storage.js';
import { state } from '../state.js';

// Cache TTL — 30 days. Lessons go stale when curated data under data/*.json
// is refreshed; 30 days is a pragmatic re-compose cadence that keeps Groq
// quota usage low while still picking up content updates within a season.
const LESSON_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Current ISO timestamp. */
function isoNow() {
  return new Date().toISOString();
}

/** True when the cached lesson is newer than LESSON_TTL_MS. */
function isFresh(lesson) {
  if (!lesson || !lesson.generatedAt) return false;
  const t = Date.parse(lesson.generatedAt);
  if (Number.isNaN(t)) return false;
  return (Date.now() - t) < LESSON_TTL_MS;
}

/**
 * Call LLM and parse JSON response. Remaps typed LLM errors to coach-* errors.
 */
async function callAndParse({ system, user }) {
  let res;
  try {
    res = await sendPrompt({
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user }
      ],
      jsonMode: true
    });
  } catch (e) {
    if (e instanceof AuthError) {
      const err = new Error('coach-missing-key');
      err.cause = e;
      throw err;
    }
    const err = new Error('coach-llm-error');
    err.cause = e;
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(res.content);
  } catch (e) {
    const err = new Error('coach-validation-failed');
    err.errors = ['LLM output is not valid JSON'];
    err.cause = e;
    throw err;
  }
  return parsed;
}

/**
 * Generate a fresh lesson for a country, validate it, cache it, return it.
 *
 * @param {string} countryId
 * @param {string} [lang='en']
 * @returns {Promise<object>} lesson record
 */
export async function generateLesson(countryId, lang = 'en') {
  const { system, user } = await buildCoachPrompt(countryId, lang);
  const parsed = await callAndParse({ system, user });

  const { valid, errors } = validateCoachResponse(parsed);
  if (!valid) {
    const err = new Error('coach-validation-failed');
    err.errors = errors;
    throw err;
  }

  const id = `${countryId}_${lang}`;
  const record = {
    id,
    countryId,
    lang,
    generatedAt: isoNow(),
    // Normalize: surface the quiz at top-level per spec, keep narrative
    // sections in `sections`.
    sections: {
      greetings: parsed.greetings,
      food: parsed.food,
      norms: parsed.norms,
      money: parsed.money,
      context: parsed.context
    },
    quiz: parsed.quiz
  };

  await putCoachLesson(record);
  return record;
}

/**
 * Fetch a cached lesson or generate a new one. Cache TTL: 30 days.
 *
 * @param {string} countryId
 * @param {string} [lang='en']
 * @param {{ regenerate?: boolean }} [opts]
 * @returns {Promise<object>} lesson record
 */
export async function getLesson(countryId, lang = 'en', { regenerate = false } = {}) {
  if (!regenerate) {
    const cached = await getCoachLesson(countryId, lang);
    if (cached && isFresh(cached)) return cached;
  }
  return generateLesson(countryId, lang);
}

/**
 * Record quiz completion for a country. Writes `state.coach.lessonsCompleted`
 * and `state.coach.quizScores`, then dispatches `coach:completed`.
 *
 * @param {string} countryId
 * @param {{ passed: boolean, score: number }} result
 */
export async function markCompleted(countryId, { passed, score }) {
  state.update('coach', coach => {
    const prev = coach.lessonsCompleted?.[countryId];
    const attempts = (prev?.attempts || 0) + 1;
    return {
      ...coach,
      lessonsCompleted: {
        ...coach.lessonsCompleted,
        [countryId]: {
          completedAt: isoNow(),
          passed: !!passed,
          attempts
        }
      },
      quizScores: {
        ...coach.quizScores,
        [countryId]: score
      }
    };
  });

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('coach:completed', {
      detail: { countryId, passed: !!passed, score }
    }));
  }
}

/**
 * Claim an OpenBadge 2.0 assertion for a passed country lesson.
 * Throws 'coach-not-passed' when the user has not passed that country's quiz.
 *
 * @param {string} countryId
 * @param {{ recipientEmail?: string|null }} [opts]
 * @returns {Promise<{ badgeId, jsonLd, jsonLdHash, downloadBlob }>}
 */
export async function claimBadge(countryId, { recipientEmail = null } = {}) {
  const coach = state.getSlice('coach') || {};
  const entry = coach.lessonsCompleted?.[countryId];
  if (!entry || !entry.passed) {
    throw new Error('coach-not-passed');
  }

  const assertion = await buildAssertion({ countryId, recipientEmail });

  // Persist to IDB keyed by badgeId.
  await putCoachBadge({
    badgeId: assertion.badgeId,
    countryId,
    issuedAt: isoNow(),
    jsonLd: assertion.jsonLd,
    jsonLdHash: assertion.jsonLdHash
  });

  // Append to state.coach.badgesEarned (migrate() caps at 50 on reload).
  state.update('coach', c => {
    const next = [
      ...(c.badgesEarned || []),
      {
        countryId,
        badgeId: assertion.badgeId,
        issuedAt: isoNow(),
        jsonLdHash: assertion.jsonLdHash
      }
    ];
    return { ...c, badgesEarned: next };
  });

  return assertion;
}

/**
 * Has a badge for this country already been earned?
 * @param {string} countryId
 * @returns {boolean}
 */
export function isBadgeAlreadyEarned(countryId) {
  const coach = state.getSlice('coach') || {};
  const list = coach.badgesEarned || [];
  return list.some(b => b.countryId === countryId);
}
