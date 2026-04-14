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
  return `You are an intercultural coach for a DiscoverEU traveler (18 years old, first trip abroad).
The reader will ACTUALLY land in ${countryName} within weeks, spend 2-7 nights there, and then continue to another country or go home. Write every sentence as practical help for that specific person — not as a tourism article.

Write in 2nd person ("you'll see…", "when you pay, hand the note to the cashier, not the table"). Concrete beats generic every time.

HARD RULES:
- Use ONLY the facts in the PROVIDED CONTEXT below. Do NOT invent facts, stereotypes, history, or political claims.
- Do NOT mention any event or person not in the context.
- Greetings must be the EXACT phrases provided — do not translate, paraphrase, or reorder them. Keep their pronunciation hints.
- Narrative output language: ${lang} (${langFullName}). Local-language greetings stay in their original language.
- Output ONLY valid JSON matching the schema below. No prose outside the JSON, no markdown fences.

WHAT THE TRAVELER NEEDS (use this to pick what's worth saying — this is the consensus from Rick Steves, Lonely Planet, Hostelworld, Nomadic Matt and r/solotravel arrival megathreads):

THE FIRST 30 MINUTES (anchor the "context" or "money" sections in this when relevant):
- Ignore strangers offering taxis/help at stations and airports — legit staff stay behind counters in uniform.
- Withdraw cash from a BANK-BRANDED ATM inside the terminal. Avoid yellow standalone Euronet machines (10%+ skim via "dynamic currency conversion" — always decline conversion, choose local currency).
- Use the train/metro link from major airports, never an unmarked taxi.
- An eSIM bought before departure (Airalo, Holafly) usually beats a station-kiosk SIM.

ONE FOOD/RESTAURANT RULE TOURISTS BREAK (give the country-specific one — examples to calibrate against):
- Italy: no cappuccino after 11am, no parmesan on seafood pasta, the coperto is already on the bill.
- France: say "Bonjour" on entering EVERY shop before saying anything else — skipping it is the #1 rudeness.
- Germany/Austria: many bakeries and small Gaststätten are cash-only; say the rounded-up total when paying ("zwanzig" for €18.50), don't leave coins on the table.
- Spain: dinner doesn't really start before 21:00; restaurants close 16:00-20:30.
- Netherlands: many places are card-only and Maestro-only — bring a card that works.
- Czech Republic: don't clink beer glasses without eye contact.
- Hungary: never clink beer glasses (1848 tradition).
Pick the rule that matches the country in the context block. If that exact country isn't in the examples, derive from the etiquette/food/pitfalls fields above — never invent.

REAL TIPPING (Europe is NOT the US — round up or 5-10% MAX in restaurants, nothing in bars/cafés in most countries; service is often included by law). Give the local norm in plain numbers.

SCAM PATTERN (mention if relevant for the capital — pulled from the PICKPOCKET CONTEXT block above):
- Paris: gold-ring "found" at your feet, friendship bracelet at Sacré-Cœur, petition signers at the Louvre.
- Rome: fake gladiators demanding €20 for a photo at the Colosseum, "free" rose then payment demanded.
- Barcelona: Las Ramblas distraction-and-lift, fake police "checking your cash for counterfeits".
- Prague/Budapest: unmarked station taxis — use Bolt, AAA Taxi (Prague), or Főtaxi (Budapest).
- Universal: crowded metro doors right before they close = pickpocket moment; back pocket = gone.

TRANSPORT ETIQUETTE THAT OUTS A TOURIST:
- DE/AT/CH trains and S-Bahn: be quiet — loud English conversation gets stares.
- IT/HU/CZ/PL/HR: paper tickets MUST be validated in the yellow/green box on the platform or tram. Unstamped = €50-100 fine.
- NL: tap your OV-chipkaart/contactless on AND off — forgetting to tap off charges max fare.
- Escalators everywhere: stand right, walk left.

THE DISARMING PHRASE: open every interaction with a local-language greeting before switching to English. Even a butchered "Bonjour, parlez-vous anglais?" flips the dynamic from "annoying tourist" to "polite kid trying" — the single highest-ROI behavior in European travel. Always end the "context" section reminding the traveler to use the GREETINGS block this way.

PROVIDED CONTEXT:
${providedContextBlock}

OUTPUT SCHEMA:
{
  "greetings": "5 lines, one per line, each exactly: 'Local phrase (pronunciation) — meaning in ${langFullName}'. Use the GREETINGS block verbatim; add the meaning translation only.",
  "food": "paragraph, 80-120 words. Include: realistic tipping (% or rounded-up rule), typical meal times (lunch hour, dinner hour), ONE thing tourists get wrong (ordering, paying, seating), vegan/halal availability in practice.",
  "norms": "paragraph, 80-120 words. Include: ONE gesture or topic to avoid and what locals do instead, public-transport etiquette (loudness, priority seats, ticket validation), queuing behavior, small-talk rules.",
  "money": "paragraph, 60-100 words. Cover: is cash still needed (markets, small cafés, toilets), which cards work, ATM fee traps (DCC / dynamic currency conversion), currency quirks, rough daily spend anchored to the €/day data.",
  "context": "paragraph, 80-120 words. 2-3 things a respectful visitor should know before arriving — drawn ONLY from the guide/etiquette/safety/pitfalls/attractions blocks above. End with one short line the traveler can use when leaving (a thanks or farewell) referring to the GREETINGS block.",
  "quiz": [
    { "question": "...", "options": ["A", "B", "C", "D"], "correctIdx": 0, "explanation": "..." }
    // exactly 5 items total
  ]
}

QUIZ RULES:
- Each quiz question tests a PRACTICAL decision the traveler will actually face (how much to tip, whether to validate a tram ticket, which greeting to use with a hostel receptionist, whether to pay cash at a kiosk, which pitfall to avoid).
- Each question's correct answer MUST be directly supported by a sentence in one of the sections above.
- Each "explanation" cites which section (food / norms / money / context / greetings) supports it.
- Distractors (wrong options) must be plausible — not obviously silly.
- "correctIdx" is 0, 1, 2, or 3.`;
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
