/* ============================================================
   scripts/papers/import-sheet.js — One-time Google Sheet import
   ============================================================
   Creates one closed "paper" issue per approved row of the
   published Public tab, oldest first, so the issue-based preview
   has the full history. Removed rows are closed as not planned;
   the rest as completed. The original timestamp and vote count
   are kept in a hidden marker the preview reads. Safe to rerun:
   rows already imported are skipped.

   Usage:
     GITHUB_TOKEN=$(gh auth token) node scripts/papers/import-sheet.js [--dry-run]
   Environment: GITHUB_REPOSITORY (default MeighenBergerS/jc-ppi).

   Afterwards, run the Papers workflow with scope "all" so the
   bot adds metadata to the imported issues.
   ============================================================ */

import { CONFIG, COL } from '../../site/assets/js/config.js';
import { parseCsv } from '../../site/assets/js/utils.js';
import {
  LABELS,
  FIELDS,
  cleanArxivId,
  importedMarker,
  parseImported,
  github,
  sleep,
} from './lib.js';

const dryRun = process.argv.includes('--dry-run');
const repo = process.env.GITHUB_REPOSITORY || 'MeighenBergerS/jc-ppi';
const api = github(process.env.GITHUB_TOKEN, repo);
const isTrue = (v) => (v ?? '').trim().toUpperCase() === 'TRUE';
const noPing = (s) => (s ?? '').trim().replace(/@/g, '@​');

const res = await fetch(CONFIG.sheetCsvUrl);
if (!res.ok) throw new Error(`Sheet CSV: HTTP ${res.status}`);
const rows = parseCsv(await res.text())
  .slice(1)
  .filter((r) => r[COL.timestamp] && isTrue(r[COL.approved]));

const existing = new Set(
  dryRun
    ? []
    : (await api.paginate(`/issues?labels=${encodeURIComponent(LABELS.imported)}&state=all`))
        .map((i) => parseImported(i.body))
        .filter(Boolean)
        .map((d) => `${d.timestamp}|${d.arxiv}`)
);

let created = 0;
for (const r of rows) {
  const timestamp = r[COL.timestamp].trim();
  const arxiv = r[COL.arxivId].trim();
  if (existing.has(`${timestamp}|${arxiv}`)) continue;

  const votes = Number(r[COL.votes]) || 0;
  const removed = isTrue(r[COL.removed]);
  const discussed = isTrue(r[COL.discussed]);
  const why = (r[COL.editedComment] || r[COL.comment] || '').trim();
  const status = [
    `Submitted ${timestamp}`,
    `${votes} vote${votes === 1 ? '' : 's'} on the old site`,
    ...(discussed ? ['discussed'] : []),
    ...(removed ? ['removed'] : []),
  ].join(' · ');

  const body = [
    `_Imported from the Google Sheet. ${status}._`,
    importedMarker({ timestamp, votes, arxiv }),
    '',
    `### ${FIELDS.arxiv}`,
    '',
    arxiv,
    '',
    `### ${FIELDS.why}`,
    '',
    noPing(why) || '_No response_',
    '',
    `### ${FIELDS.name}`,
    '',
    noPing(r[COL.name]),
    '',
  ].join('\n');
  const labels = [LABELS.paper, LABELS.imported, ...(discussed ? [LABELS.discussed] : [])];
  const title = `${cleanArxivId(arxiv) ?? arxiv} (imported)`;

  if (dryRun) {
    console.log(`[dry run] ${title} | ${labels.join(', ')} | ${removed ? 'removed' : 'closed'}`);
    continue;
  }
  const issue = await api.request('POST', '/issues', { title, body, labels });
  await sleep(1500);
  await api.request('PATCH', `/issues/${issue.number}`, {
    state: 'closed',
    state_reason: removed ? 'not_planned' : 'completed',
  });
  created++;
  console.log(`#${issue.number}: ${title}${removed ? ' (removed)' : ''}`);
  await sleep(2500);
}
console.log(`${dryRun ? 'Would import' : 'Imported'} ${dryRun ? rows.length : created} rows.`);
