// js/features/coach-prompt.js
// Pure prompt builder for the AI Intercultural Coach.
// Composes a strict system+user prompt pair from local JSON data sources
// and exposes a JSON schema + validator the coach UI uses to gate output.
//
// Data sources pulled at call time:
//   - data/countries.json          (name, capital, languages, costPerDay)
//   - data/emergency-phrases.json  (greetings + help phrases, used VERBATIM)
//   - data/guides.json             (country guide summary + etiquette + safety)
//   - data/soundtracks.json        (iconic Top-50 playlist title)
//   - data/pickpocket-zones.json   (risk level + hot zones for capital city)
//
// The LLM is told to NEVER invent facts and to use the provided greetings as-is.

const DATA_BASE = "data/";

const LANG_FULL_NAMES = {
  en: "English",
  tr: "Turkish",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  pl: "Polish",
  nl: "Dutch",
  el: "Greek",
};

// ---------------------------------------------------------------------------
// JSON schema for the LLM response
// ---------------------------------------------------------------------------
export const COACH_RESPONSE_SCHEMA = {
  type: "object",
  required: ["greetings", "food", "norms", "money", "context", "quiz"],
  properties: {
    greetings: { type: "string" },
    food: { type: "string" },
    norms: { type: "string" },
    money: { type: "string" },
    context: { type: "string" },
    quiz: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        required: ["question", "options", "correctIdx", "explanation"],
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: { type: "string" },
          },
          correctIdx: { type: "integer", minimum: 0, maximum: 3 },
          explanation: { type: "string" },
        },
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------
export function validateCoachResponse(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { valid: false, errors: ["response is not an object"] };
  }
  const stringFields = ["greetings", "food", "norms", "money", "context"];
  for (const f of stringFields) {
    if (typeof parsed[f] !== "string" || !parsed[f].trim()) {
      errors.push(`field "${f}" must be a non-empty string`);
    }
  }
  if (!Array.isArray(parsed.quiz)) {
    errors.push(`field "quiz" must be an array`);
  } else if (parsed.quiz.length !== 5) {
    errors.push(`quiz must have exactly 5 items (got ${parsed.quiz.length})`);
  } else {
    parsed.quiz.forEach((q, i) => {
      if (!q || typeof q !== "object") {
        errors.push(`quiz[${i}] is not an object`);
        return;
      }
      if (typeof q.question !== "string" || !q.question.trim()) {
        errors.push(`quiz[${i}].question must be a non-empty string`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        errors.push(`quiz[${i}].options must be an array of 4 strings`);
      } else if (!q.options.every((o) => typeof o === "string" && o.trim())) {
        errors.push(`quiz[${i}].options must all be non-empty strings`);
      }
      if (
        !Number.isInteger(q.correctIdx) ||
        q.correctIdx < 0 ||
        q.correctIdx > 3
      ) {
        errors.push(`quiz[${i}].correctIdx must be integer 0-3`);
      }
      if (typeof q.explanation !== "string" || !q.explanation.trim()) {
        errors.push(`quiz[${i}].explanation must be a non-empty string`);
      }
    });
  }
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`failed to load ${path}: HTTP ${res.status}`);
  return res.json();
}

async function loadAllSources() {
  const [countries, phrases, guides, soundtracks, pickpocket] =
    await Promise.all([
      fetchJson(`${DATA_BASE}countries.json`),
      fetchJson(`${DATA_BASE}emergency-phrases.json`),
      fetchJson(`${DATA_BASE}guides.json`),
      fetchJson(`${DATA_BASE}soundtracks.json`),
      fetchJson(`${DATA_BASE}pickpocket-zones.json`),
    ]);
  return { countries, phrases, guides, soundtracks, pickpocket };
}

function pickGreetings(phrases, countryId) {
  // Use country-specific phrases verbatim; if unavailable, fall back to EN globals.
  const entry = (phrases.countries || []).find((c) => c.id === countryId);
  if (entry && entry.phrases) {
    const lang = (entry.primaryLanguages && entry.primaryLanguages[0]) || "en";
    const set = entry.phrases[lang];
    if (set) return { lang, set };
  }
  return { lang: "en", set: phrases.globalPhrases.en };
}

function buildContextBlock({
  country,
  greetingsBlock,
  guide,
  soundtrack,
  pickRisk,
}) {
  const lines = [];

  lines.push(`COUNTRY:`);
  lines.push(
    `  Name: ${country.name}${country.nameLocal ? ` (${country.nameLocal})` : ""}`,
  );
  lines.push(`  Capital: ${country.capital}`);
  lines.push(
    `  Official languages (ISO 639-1): ${(country.languages || []).join(", ") || "n/a"}`,
  );
  lines.push(`  Currency: ${country.currency || "n/a"}`);
  if (country.costPerDay) {
    lines.push(
      `  Cost per day (EUR): low €${country.costPerDay.low}, mid €${country.costPerDay.mid}, high €${country.costPerDay.high}`,
    );
  }
  lines.push("");

  lines.push(`GREETINGS (use verbatim, do NOT translate the local phrases):`);
  lines.push(`  Greeting language: ${greetingsBlock.lang}`);
  for (const [k, v] of Object.entries(greetingsBlock.set)) {
    lines.push(`  ${k}: ${v}`);
  }
  lines.push("");

  if (guide) {
    lines.push(`GUIDE SUMMARY:`);
    if (guide.summary) lines.push(`  Summary: ${guide.summary}`);
    if (guide.whatToEat) lines.push(`  Food: ${guide.whatToEat}`);
    if (guide.money) lines.push(`  Money: ${guide.money}`);
    if (guide.etiquette) lines.push(`  Etiquette: ${guide.etiquette}`);
    if (guide.safety) lines.push(`  Safety: ${guide.safety}`);
    if (Array.isArray(guide.avoidPitfalls) && guide.avoidPitfalls.length) {
      lines.push(`  Avoid pitfalls:`);
      guide.avoidPitfalls.forEach((p) => lines.push(`    - ${p}`));
    }
    if (Array.isArray(guide.languageBasics) && guide.languageBasics.length) {
      lines.push(`  Language basics (additional, may use):`);
      guide.languageBasics.forEach((p) =>
        lines.push(`    - ${p.phrase} = ${p.meaning}`),
      );
    }
    lines.push("");
  }

  if (Array.isArray(country.highlights) && country.highlights.length) {
    lines.push(`TOP ATTRACTIONS:`);
    country.highlights.slice(0, 3).forEach((h) => lines.push(`  - ${h}`));
    lines.push("");
  }

  lines.push(`TOP CITIES:`);
  lines.push(`  - ${country.capital} (capital)`);
  lines.push("");

  if (soundtrack && !soundtrack.fallback) {
    lines.push(`MUSIC / CULTURAL ASSOCIATION:`);
    lines.push(`  - ${soundtrack.title}`);
    lines.push("");
  }

  if (pickRisk) {
    lines.push(`PICKPOCKET CONTEXT (capital city only):`);
    lines.push(`  Risk score (1-5): ${pickRisk.riskScore}`);
    if (Array.isArray(pickRisk.hotspots)) {
      lines.push(`  Hotspots:`);
      pickRisk.hotspots.slice(0, 5).forEach((h) => lines.push(`    - ${h}`));
    }
    if (pickRisk.note) lines.push(`  Note: ${pickRisk.note}`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildSystemPrompt({ countryName, lang, providedContextBlock }) {
  const langFullName = LANG_FULL_NAMES[lang] || lang;
  return `You are an intercultural coach for DiscoverEU travelers (18 years old, first-time traveler to Europe).
Your job is to COMPOSE a 5-minute micro-lesson about ${countryName} using ONLY the facts provided below.

HARD RULES:
- Do NOT invent facts, stereotypes, or political claims.
- Do NOT mention any event or person not in the provided context.
- Use exactly the phrases provided for greetings — DO NOT translate or paraphrase them.
- Keep output in ${lang} (${langFullName}).
- Output ONLY valid JSON matching the schema below. No prose, no markdown fences.

PROVIDED CONTEXT:
${providedContextBlock}

OUTPUT SCHEMA:
{
  "greetings": "5 lines, one per line, each in the form: 'Phrase (pronunciation) — English meaning'",
  "food": "paragraph, 80-120 words, covering: tipping, meal times, things to be careful about, vegan/halal availability",
  "norms": "paragraph, 80-120 words, covering: gesture faux-pas, public-transport etiquette, queuing, conversational topics to avoid",
  "money": "paragraph, 60-100 words, covering: cash vs card, ATM fees, currency quirks",
  "context": "paragraph, 80-120 words, covering 2-3 things a respectful visitor should know",
  "quiz": [
    { "question": "...", "options": ["A", "B", "C", "D"], "correctIdx": 0, "explanation": "..." }
    // exactly 5 items total
  ]
}

Every quiz "explanation" cites the specific section above where the answer comes from.
Every "correctIdx" is 0, 1, 2, or 3.`;
}

function buildUserPrompt({ countryName, countryId, lang }) {
  return `Country: ${countryName} (${countryId})
Language target: ${lang}

Generate the JSON now.`;
}

// ---------------------------------------------------------------------------
// Pure variant: caller supplies all data sources.
// ---------------------------------------------------------------------------
export function buildCoachPromptFromData(countryId, lang, dataSources) {
  const { countries, phrases, guides, soundtracks, pickpocket } = dataSources;

  const country = (countries.countries || []).find((c) => c.id === countryId);
  if (!country) throw new Error(`unknown countryId: ${countryId}`);

  const greetingsBlock = pickGreetings(phrases, countryId);
  const guide = guides && guides.countries ? guides.countries[countryId] : null;
  const soundtrack =
    soundtracks && soundtracks.countries
      ? soundtracks.countries[countryId]
      : null;

  // Look up pickpocket data for the capital city (lowercase id match).
  let pickRisk = null;
  if (pickpocket && pickpocket.cities && country.capital) {
    const key = country.capital.toLowerCase();
    pickRisk = pickpocket.cities[key] || null;
  }

  const providedContextBlock = buildContextBlock({
    country,
    greetingsBlock,
    guide,
    soundtrack,
    pickRisk,
  });

  const system = buildSystemPrompt({
    countryName: country.name,
    lang,
    providedContextBlock,
  });
  const user = buildUserPrompt({
    countryName: country.name,
    countryId,
    lang,
  });

  return { system, user, schema: COACH_RESPONSE_SCHEMA };
}

// ---------------------------------------------------------------------------
// Convenience wrapper: fetches data sources at call time.
// ---------------------------------------------------------------------------
export async function buildCoachPrompt(countryId, lang = "en") {
  const dataSources = await loadAllSources();
  return buildCoachPromptFromData(countryId, lang, dataSources);
}
