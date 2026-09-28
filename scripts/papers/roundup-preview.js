/* ============================================================
   scripts/papers/roundup-preview.js — Print one member's roundup
   ============================================================
   Prints the monthly roundup email for one member, from the live
   paper issues, without sending anything.

   Usage: npm run roundup -- <login> [YYYY-MM] [--name "Sheet name"]...
                             [--html file.html]
   The month defaults to last month. --name adds a name the member
   used in the Google Sheet, so their imported papers count too.
   --html also writes the HTML email to a file, to open in a browser.
   Environment: GITHUB_REPOSITORY (default CONFIG.issuesRepo),
   GITHUB_TOKEN (optional; raises the API rate limit).
   ============================================================ */

import { writeFileSync } from 'node:fs';
import { CONFIG } from '../../site/assets/js/config.js';
import { LABELS, github, fetchInspire } from './lib.js';
import { memberPapers, buildRoundup, renderRoundup, monthKey, previousMonth } from './roundup.js';
import { renderRoundupHtml } from './roundup-html.js';

const args = process.argv.slice(2);
const names = [];
const positional = [];
let htmlFile = '';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--name') names.push(args[++i] ?? '');
  else if (args[i] === '--html') htmlFile = args[++i] ?? '';
  else positional.push(args[i]);
}
const [login, month = previousMonth(monthKey(new Date()))] = positional;
if (!login || !/^\d{4}-\d{2}$/.test(month)) {
  console.error(
    'Usage: npm run roundup -- <login> [YYYY-MM] [--name "Sheet name"]... [--html file.html]'
  );
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

const roundup = buildRoundup(papers, month, meta);
const { subject, text } = renderRoundup(roundup, meta);
console.log(`Subject: ${subject}\n\n${text}`);
if (htmlFile) {
  writeFileSync(htmlFile, renderRoundupHtml(roundup, meta));
  console.log(`Wrote the HTML email to ${htmlFile}`);
}
