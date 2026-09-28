/* ============================================================
   scripts/papers/build-csv.js — Site preview data from issues
   ============================================================
   Writes every approved paper issue as a CSV shaped like the
   Google Sheet's Public tab, and the newest Trending issue as a
   CSV shaped like its Trending tab, so the site can render them
   with ?source=issues. Run by deploy-pages.yml before each deploy.

   Usage: node scripts/papers/build-csv.js <papers.csv> <trending.csv>
   Environment: GITHUB_REPOSITORY (default MeighenBergerS/jc-ppi),
   GITHUB_TOKEN (optional locally; raises the API rate limit).
   ============================================================ */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { LABELS, issuesToRows, toCsv, github, fetchProfileNames } from './lib.js';
import { parseTrendingIssue, trendingToRows } from './trending.js';

const [out, trendingOut] = process.argv.slice(2);
if (!out || !trendingOut) {
  console.error('Usage: node scripts/papers/build-csv.js <papers.csv> <trending.csv>');
  process.exit(1);
}
const write = (path, text) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};

const api = github(
  process.env.GITHUB_TOKEN,
  process.env.GITHUB_REPOSITORY || 'MeighenBergerS/jc-ppi'
);
const issues = await api.paginate(`/issues?labels=${LABELS.paper}&state=all`);
const rows = issuesToRows(issues, await fetchProfileNames(api, issues));

write(out, toCsv(rows));
console.log(`Wrote ${rows.length} papers from ${issues.length} issues to ${out}`);

// The newest Trending issue, open or closed.
const latest = issues
  .filter((i) => i.labels.some((l) => l.name === LABELS.trending))
  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
const trendingRows = trendingToRows(parseTrendingIssue(latest?.body));
write(
  trendingOut,
  toCsv(trendingRows, [
    'Category',
    'Rank',
    'ArxivId',
    'Title',
    'Abstract',
    'Authors',
    'Affiliation',
    'Citations',
    'CitationsNoSelf',
  ])
);
console.log(
  `Wrote ${trendingRows.length} trending papers from ${latest ? `#${latest.number}` : 'no issue'} to ${trendingOut}`
);
