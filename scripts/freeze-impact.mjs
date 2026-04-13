#!/usr/bin/env node
/**
 * scripts/freeze-impact.mjs
 *
 * Maintainer-run aggregator for DiscoverEU Companion impact contributions.
 *
 * Reads anonymised snapshots from `contributions/impact/*.json` (merged via PR
 * flow), applies k-anonymity via `js/features/impact-anonymize.js`, writes
 * `data/impact-public.json`, and rewrites the FROZEN block inside
 * `pages/impact.html` with refreshed numbers.
 *
 * Usage:
 *   node scripts/freeze-impact.mjs          # freeze for real
 *   node scripts/freeze-impact.mjs --dry-run # log only, no writes
 *
 * Node >= 20, zero dependencies.
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/* ------------------------------------------------------------------ */
/* Paths                                                              */
/* ------------------------------------------------------------------ */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const CONTRIB_DIR = join(REPO_ROOT, "contributions", "impact");
const OUT_JSON = join(REPO_ROOT, "data", "impact-public.json");
const OUT_HTML = join(REPO_ROOT, "pages", "impact.html");
const ANONYMIZER = join(REPO_ROOT, "js", "features", "impact-anonymize.js");

const DRY_RUN = process.argv.includes("--dry-run");

/* ------------------------------------------------------------------ */
/* Logging helpers                                                    */
/* ------------------------------------------------------------------ */

const log = (...args) => console.log("[freeze-impact]", ...args);
const warn = (...args) => console.warn("[freeze-impact]", ...args);
const err = (...args) => console.error("[freeze-impact]", ...args);

/* ------------------------------------------------------------------ */
/* Envelope validation                                                */
/* ------------------------------------------------------------------ */

function validateEnvelope(obj, fileName) {
  if (!obj || typeof obj !== "object") {
    throw new Error(`${fileName}: not a JSON object`);
  }
  const c = obj.contribution;
  if (!c || typeof c !== "object") {
    throw new Error(`${fileName}: missing .contribution envelope`);
  }
  if (typeof c.version !== "string" || !c.version.startsWith("impact-contribution/")) {
    throw new Error(`${fileName}: unexpected contribution.version "${c.version}"`);
  }
  if (!c.anonymizedSnapshot || typeof c.anonymizedSnapshot !== "object") {
    throw new Error(`${fileName}: missing contribution.anonymizedSnapshot`);
  }
  return c.anonymizedSnapshot;
}

/* ------------------------------------------------------------------ */
/* FROZEN block rewriter                                              */
/* ------------------------------------------------------------------ */

/**
 * Replace the numeric `<strong>…</strong>` contents of the 5 `<li>` entries
 * inside the `<!-- BEGIN:FROZEN --> ... <!-- END:FROZEN -->` block, and flip
 * `data-source="seed"` to `"frozen"`. Preserves all surrounding markup.
 */
function rewriteFrozenBlock(html, values) {
  const marker = /<!-- BEGIN:FROZEN -->[\s\S]*?<!-- END:FROZEN -->/;
  const match = html.match(marker);
  if (!match) {
    throw new Error(
      `Could not find <!-- BEGIN:FROZEN --> ... <!-- END:FROZEN --> block in ${OUT_HTML}`
    );
  }
  let block = match[0];

  // Flip data-source="seed" -> "frozen".
  block = block.replace(/data-source="seed"/, 'data-source="frozen"');

  // Replace each <strong>…</strong> occurrence in fixed order.
  // Order matches the HTML authored in pages/impact.html:
  //   1. trips planned
  //   2. countries covered
  //   3. CO2 saved
  //   4. accessibility features adopted
  //   5. public contributions
  const replacements = [
    String(values.trips),
    String(values.countries),
    `${values.co2} kg`,
    String(values.a11y),
    String(values.contributions),
  ];
  let i = 0;
  block = block.replace(/<strong>[^<]*<\/strong>/g, () => {
    const v = replacements[i] ?? "0";
    i += 1;
    return `<strong>${v}</strong>`;
  });
  if (i !== replacements.length) {
    throw new Error(
      `Expected ${replacements.length} <strong> slots in FROZEN block, found ${i}`
    );
  }

  return html.replace(marker, block);
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

async function main() {
  log(DRY_RUN ? "DRY RUN — no files will be written" : "Freezing impact dataset");

  if (!existsSync(CONTRIB_DIR)) {
    err(
      `contributions/impact/ does not exist.\n` +
        `  Expected path: ${CONTRIB_DIR}\n` +
        `  Create it (and add at least one anonymised snapshot PR) before running this script.`
    );
    process.exit(1);
  }

  // 1. Read + validate contributions.
  const files = readdirSync(CONTRIB_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  log(`Found ${files.length} contribution file(s) in ${CONTRIB_DIR}`);

  const records = [];
  for (const f of files) {
    const full = join(CONTRIB_DIR, f);
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(full, "utf8"));
    } catch (e) {
      err(`Failed to parse ${f}: ${e.message}`);
      process.exit(1);
    }
    let snapshot;
    try {
      snapshot = validateEnvelope(parsed, f);
    } catch (e) {
      err(`Envelope validation failed: ${e.message}`);
      process.exit(1);
    }
    records.push(snapshot);
  }

  // 2. Dynamic import of anonymiser (pure ESM, Node-safe).
  const anonymizerUrl = pathToFileURL(ANONYMIZER).href;
  const { mergeContributions, anonymize } = await import(anonymizerUrl);

  // Each submitted snapshot is already anonymised on the client, but re-running
  // anonymize() here enforces the whitelist one more time — defence in depth.
  const normalised = records.map((r) => anonymize(r));

  // 3. Aggregate with k=5.
  const aggregate = mergeContributions(normalised, { k: 5 });

  // 4. Build public envelope.
  const publicDoc = {
    version: "impact-public/1.0",
    license: "CC-BY-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution:
      "DiscoverEU Companion — https://github.com/embeddedJedi/discovereu-companion",
    generatedAt: new Date().toISOString(),
    inputCount: normalised.length,
    k: 5,
    kAnonymitySafe: aggregate.kAnonymitySafe,
    droppedForKAnonymity: aggregate.droppedForKAnonymity,
    aggregate,
  };

  // 5. Compute FROZEN numbers.
  const totalA11yAdoptions = Object.values(aggregate.a11yFeatureAdoption || {})
    .reduce((a, b) => a + (Number(b) || 0), 0);
  const frozenValues = {
    trips: aggregate.totalTrips,
    countries: aggregate.totalCountriesCovered,
    co2: Math.round(Number(aggregate.totalCo2Saved) || 0),
    a11y: totalA11yAdoptions,
    contributions: normalised.length,
  };

  // 6. Summary log.
  log("Aggregate highlights:");
  log(`  inputCount:              ${publicDoc.inputCount}`);
  log(`  totalTrips (kept):       ${aggregate.totalTrips}`);
  log(`  totalCountriesCovered:   ${aggregate.totalCountriesCovered}`);
  log(`  totalKm:                 ${aggregate.totalKm}`);
  log(`  totalCo2Saved:           ${aggregate.totalCo2Saved}`);
  log(`  totalEstimatedSpend:     ${aggregate.totalEstimatedSpend}`);
  log(`  languageDiversity:       ${JSON.stringify(aggregate.languageDiversity)}`);
  log(`  droppedForKAnonymity:    ${aggregate.droppedForKAnonymity}`);
  log(`  kAnonymitySafe:          ${aggregate.kAnonymitySafe}`);

  const triggered = [];
  if (aggregate.droppedForKAnonymity > 0) triggered.push("record-level k-suppression");
  const bingoBins = Object.keys(aggregate.bingoCompletedHistogram || {}).length;
  const seatBins = Object.keys(aggregate.seatCreditsHistogram || {}).length;
  const a11yBins = Object.keys(aggregate.a11yFeatureAdoption || {}).length;
  log(`  histogram bins kept:     bingo=${bingoBins} seat=${seatBins} a11y=${a11yBins}`);
  if (!aggregate.kAnonymitySafe) triggered.push("suppression ratio >10%");
  log(`  thresholds triggered:    ${triggered.length ? triggered.join(", ") : "none"}`);

  // 7. Write outputs (unless dry-run).
  if (DRY_RUN) {
    log("Dry run — skipping writes.");
    log("Would write:", OUT_JSON);
    log("Would rewrite FROZEN block in:", OUT_HTML);
    log("FROZEN values:", frozenValues);
    return;
  }

  // Ensure data/ directory exists.
  mkdirSync(dirname(OUT_JSON), { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(publicDoc, null, 2) + "\n", "utf8");
  log("Wrote", OUT_JSON);

  if (!existsSync(OUT_HTML)) {
    warn(
      `pages/impact.html not found — skipping FROZEN block rewrite.\n` +
        `  Expected: ${OUT_HTML}`
    );
  } else {
    const html = readFileSync(OUT_HTML, "utf8");
    const updated = rewriteFrozenBlock(html, frozenValues);
    writeFileSync(OUT_HTML, updated, "utf8");
    log("Rewrote FROZEN block in", OUT_HTML);
  }

  log("Done.");
}

main().catch((e) => {
  err(e.stack || e.message || String(e));
  process.exit(1);
});
