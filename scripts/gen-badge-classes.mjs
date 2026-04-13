#!/usr/bin/env node
/**
 * gen-badge-classes.mjs
 *
 * Generates one OpenBadge 2.0 BadgeClass JSON per DiscoverEU-eligible country
 * from data/countries.json into badges/classes/{cc}.json (lowercase ISO code).
 *
 * Usage:
 *   node scripts/gen-badge-classes.mjs            # write files
 *   node scripts/gen-badge-classes.mjs --dry-run  # log only
 *
 * Deterministic: no timestamps, stable key order. Re-runs produce identical output.
 * No npm dependencies — pure Node ESM.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const COUNTRIES_PATH = resolve(ROOT, 'data/countries.json');
const OUT_DIR = resolve(ROOT, 'badges/classes');

const BASE_URL = 'https://embeddedjedi.github.io/discovereu-companion';
const ISSUER_URL = `${BASE_URL}/badges/issuer.json`;

// DiscoverEU-eligible countries: 33 EU/EEA-associated + TR bonus layer.
const ELIGIBLE = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO',
  'MK', 'RS', 'TR',
]);

const ALIGNMENT = [
  {
    targetName: 'EU Key Competence 8: Cultural awareness and expression',
    targetUrl: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32018H0604(01)',
  },
];

const TAGS = ['DiscoverEU', 'intercultural', 'non-formal', 'digital-credential', 'eu-youth'];

function buildBadgeClass(countryId, countryName) {
  const cc = countryId.toLowerCase();
  return {
    '@context': 'https://w3id.org/openbadges/v2',
    id: `${BASE_URL}/badges/classes/${cc}.json`,
    type: 'BadgeClass',
    name: `Intercultural Coach — ${countryName}`,
    description:
      `Awarded for completing the DiscoverEU Companion intercultural coaching micro-lesson for ${countryName}, ` +
      'demonstrating basic knowledge of greetings, food culture, social norms, money practices, and cultural context. ' +
      'Verified via hosted OpenBadge 2.0.',
    image: `${BASE_URL}/badges/images/${cc}.svg`,
    criteria: {
      narrative: `Complete the ${countryName} micro-lesson in DiscoverEU Companion and score at least 4 out of 5 on the quiz.`,
    },
    issuer: ISSUER_URL,
    tags: TAGS,
    alignment: ALIGNMENT,
  };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');

  const raw = readFileSync(COUNTRIES_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const countries = Array.isArray(parsed) ? parsed : parsed.countries;
  if (!Array.isArray(countries)) {
    throw new Error('countries.json: could not locate countries array');
  }

  const eligible = countries
    .filter((c) => ELIGIBLE.has(c.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const missing = [...ELIGIBLE].filter(
    (code) => !eligible.some((c) => c.id === code),
  );
  if (missing.length) {
    throw new Error(`Missing from countries.json: ${missing.join(', ')}`);
  }

  if (!dryRun && !existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }

  const ids = [];
  for (const country of eligible) {
    const badgeClass = buildBadgeClass(country.id, country.name);
    const cc = country.id.toLowerCase();
    const outPath = resolve(OUT_DIR, `${cc}.json`);
    const json = `${JSON.stringify(badgeClass, null, 2)}\n`;
    if (dryRun) {
      console.log(`[dry-run] would write ${outPath} (${json.length} bytes)`);
    } else {
      writeFileSync(outPath, json, 'utf8');
    }
    ids.push(cc);
  }

  console.log(
    `${dryRun ? '[dry-run] ' : ''}Generated ${ids.length} BadgeClass file(s) in ${OUT_DIR}`,
  );
  console.log(`IDs: ${ids.join(', ')}`);
}

main();
