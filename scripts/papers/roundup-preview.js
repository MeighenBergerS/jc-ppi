/* ============================================================
   scripts/papers/roundup-preview.js — Print one member's roundup
   ============================================================
   Prints the monthly roundup email for one member, from the live
   paper issues, without sending anything.

   Usage: npm run roundup -- <login> [YYYY-MM] [--name "Sheet name"]...
   The month defaults to last month. --name adds a name the member
   used in the Google Sheet, so their imported papers count too.
   Environment: GITHUB_REPOSITORY (default CONFIG.issuesRepo),
   GITHUB_TOKEN (optional; raises the API rate limit).
   ============================================================ */

import { CONFIG } from '../../site/assets/js/config.js';
import { LABELS, github, fetchInspire } from './lib.js';
import { memberPapers, buildRoundup, renderRoundup, monthKey, previousMonth } from './roundup.js';

const args = process.argv.slice(2);
const names = [];
const positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name') names.push(args[++i] ?? '');
  else positional.push(args[i]);
}
const [login, month = previousMonth(monthKey(new Date()))] = positional;
if (!login || !/^\d{4}-\d{2}$/.test(month)) {
  console.error('Usage: npm run roundup -- <login> [YYYY-MM] [--name "Sheet name"]...');
  process.exit(1);
}

const api = github(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY || CONFIG.issuesRepo);
const issues = await api.paginate(`/issues?labels=${LABELS.paper}&state=all`);
const papers = memberPapers(issues, { login, names });

let meta = new Map();
try {
  meta = await fetchInspire([...new Set(papers.map((p) => p.arxivId).filter(Boolean))]);
} catch (err) {
  console.error(`INSPIRE unavailable, so no titles or subfields: ${err.message}`);
}

const { subject, text } = renderRoundup(buildRoundup(papers, month, meta), meta);
console.log(`Subject: ${subject}\n\n${text}`);
