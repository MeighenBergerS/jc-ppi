/* ============================================================
   scripts/papers/build-csv.js — Site preview data from issues
   ============================================================
   Writes every approved paper issue as a CSV shaped like the
   Google Sheet's Public tab, so the site can render it with
   ?source=issues. Run by deploy-pages.yml before each deploy.

   Usage: node scripts/papers/build-csv.js <output.csv>
   Environment: GITHUB_REPOSITORY (default MeighenBergerS/jc-ppi),
   GITHUB_TOKEN (optional locally; raises the API rate limit).
   ============================================================ */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { LABELS, issuesToRows, toCsv, github } from './lib.js';

const out = process.argv[2];
if (!out) {
  console.error('Usage: node scripts/papers/build-csv.js <output.csv>');
  process.exit(1);
}

const api = github(
  process.env.GITHUB_TOKEN,
  process.env.GITHUB_REPOSITORY || 'MeighenBergerS/jc-ppi'
);
const issues = await api.paginate(`/issues?labels=${LABELS.paper}&state=all`);
const rows = issuesToRows(issues);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, toCsv(rows));
console.log(`Wrote ${rows.length} papers from ${issues.length} issues to ${out}`);
