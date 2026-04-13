// js/features/quiz-runner.js
// Thin adapter around flowchart-runner for 5-question multiple-choice quizzes
// used by the AI Intercultural Coach (v1.6).
//
// Design: rather than building a parallel engine, each quiz question becomes a
// `question` node in a flowchart DAG. The adapter tracks score + answers
// externally; the underlying runner just walks the DAG.
//
// Quiz item shape (from coach lesson JSON):
//   { question: string, options: string[], correctIdx: number, explanation: string }
//
// All strings are raw text (LLM-generated), NOT i18n keys. The UI layer should
// render them as-is.

import { createRunner } from "./flowchart-runner.js";

const QUIZ_LENGTH = 5;

/**
 * Validate a single quiz item.
 * @param {unknown} item
 * @param {number} idx
 */
function validateItem(item, idx) {
  if (!item || typeof item !== "object") {
    throw new Error(`quiz-runner: item ${idx} is not an object`);
  }
  if (typeof item.question !== "string" || !item.question.trim()) {
    throw new Error(`quiz-runner: item ${idx} missing "question" string`);
  }
  if (!Array.isArray(item.options) || item.options.length < 2) {
    throw new Error(`quiz-runner: item ${idx} needs ≥2 options`);
  }
  if (!item.options.every((o) => typeof o === "string")) {
    throw new Error(`quiz-runner: item ${idx} options must all be strings`);
  }
  if (
    typeof item.correctIdx !== "number" ||
    !Number.isInteger(item.correctIdx) ||
    item.correctIdx < 0 ||
    item.correctIdx >= item.options.length
  ) {
    throw new Error(`quiz-runner: item ${idx} correctIdx out of range`);
  }
  if (typeof item.explanation !== "string") {
    throw new Error(`quiz-runner: item ${idx} missing "explanation" string`);
  }
}

/**
 * Build a flowchart-runner-compatible DAG + wrapper API for a 5-question quiz.
 *
 * @param {Array<{question:string, options:string[], correctIdx:number, explanation:string}>} quizArray
 * @param {object} [opts]
 * @param {(node:object, state:object) => void} [opts.onEnter]
 *        Forwarded to the underlying flowchart runner.
 * @returns {{
 *   runner: ReturnType<typeof createRunner>,
 *   chooseAnswer: (chosenIdx:number) => void,
 *   getScore: () => number,
 *   getAnswers: () => Array<{questionIdx:number, chosenIdx:number, correct:boolean, correctIdx:number, explanation:string}>,
 *   getTotal: () => number,
 * }}
 */
export function runQuizFromData(quizArray, opts = {}) {
  if (!Array.isArray(quizArray) || quizArray.length !== QUIZ_LENGTH) {
    throw new Error(`quiz-runner: quiz must have exactly ${QUIZ_LENGTH} questions`);
  }
  quizArray.forEach(validateItem);

  // Build flowchart DAG: q1 → q2 → ... → q5 → terminal.
  /** @type {Record<string, any>} */
  const nodes = {};
  for (let i = 0; i < QUIZ_LENGTH; i++) {
    const nextId = i === QUIZ_LENGTH - 1 ? "terminal" : `q${i + 2}`;
    nodes[`q${i + 1}`] = {
      kind: "question",
      text: quizArray[i].question, // raw text, not i18n key
      options: quizArray[i].options.map((opt, j) => ({
        labelKey: opt, // raw text; UI renders as-is
        next: nextId,
        _idx: j,
      })),
    };
  }
  nodes.terminal = { kind: "terminal", text: "done", sourceUrl: null };

  const flowchart = {
    title: "quiz",
    description: "",
    startNode: "q1",
    nodes,
  };

  let score = 0;
  /** @type {Array<{questionIdx:number, chosenIdx:number, correct:boolean, correctIdx:number, explanation:string}>} */
  const answers = [];
  let currentQuestionIdx = 0;

  const runner = createRunner(flowchart, {
    onEnter: typeof opts.onEnter === "function" ? opts.onEnter : undefined,
  });

  /**
   * Record an answer for the current question and advance the underlying runner.
   * Must be called exactly once per question, in order.
   * @param {number} chosenIdx
   */
  function chooseAnswer(chosenIdx) {
    if (currentQuestionIdx >= QUIZ_LENGTH) {
      throw new Error("quiz-runner: quiz already complete");
    }
    const item = quizArray[currentQuestionIdx];
    if (
      typeof chosenIdx !== "number" ||
      !Number.isInteger(chosenIdx) ||
      chosenIdx < 0 ||
      chosenIdx >= item.options.length
    ) {
      throw new Error(`quiz-runner: invalid chosenIdx "${chosenIdx}"`);
    }
    const correctIdx = item.correctIdx;
    const correct = chosenIdx === correctIdx;
    if (correct) score++;
    answers.push({
      questionIdx: currentQuestionIdx,
      chosenIdx,
      correct,
      correctIdx,
      explanation: item.explanation,
    });
    currentQuestionIdx++;
    runner.choose(chosenIdx);
  }

  return {
    runner,
    chooseAnswer,
    getScore: () => score,
    getAnswers: () => answers.slice(),
    getTotal: () => QUIZ_LENGTH,
  };
}
