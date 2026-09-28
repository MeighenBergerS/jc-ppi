/* ============================================================
   scripts/papers/slack-reminder.js — Weekly Slack reminder
   ============================================================
   Run by .github/workflows/slack-reminder.yml. Replaces the
   weeklySlackReminder Apps Script trigger.

   Environment:
     SLACK_WEBHOOK_URL  Incoming-webhook URL (repository secret).
     PAPERS_SOURCE      "sheet" (default): the published Google Sheet.
                        "issues": the GitHub paper issues.
     SCHEDULE           The cron that started the run (github.event.schedule).
     SLACK_REMINDER     "on" lets scheduled runs post; otherwise they print only.
     POST               "true" on a manual run posts; otherwise it prints only.
     GITHUB_TOKEN, GITHUB_REPOSITORY  For the issues source.
   ============================================================ */

import { CONFIG } from '../../site/assets/js/config.js';
import { parseCsv } from '../../site/assets/js/utils.js';
import { LABELS, github, issuesToRows, fetchProfileNames, fetchInspire } from './lib.js';
import { thisWeekPapers, buildReminder, isReminderSchedule } from './slack.js';
import { fetchTrending } from './trending.js';

const SITE_URL = 'https://meighenbergers.github.io/jc-ppi/';
const source = process.env.PAPERS_SOURCE === 'issues' ? 'issues' : 'sheet';
const schedule = process.env.SCHEDULE ?? '';
const repo = process.env.GITHUB_REPOSITORY || CONFIG.issuesRepo;

if (schedule && !isReminderSchedule(schedule)) {
  console.log(`Schedule "${schedule}" is not 1 PM in Iowa today; the other schedule posts.`);
  process.exit(0);
}

let rows;
let submitUrl;
if (source === 'issues') {
  const api = github(process.env.GITHUB_TOKEN, repo);
  const issues = await api.paginate(`/issues?labels=${LABELS.paper}&state=all`);
  rows = issuesToRows(issues, await fetchProfileNames(api, issues));
  submitUrl = `https://github.com/${repo}/issues/new?template=paper.yml`;
} else {
  const res = await fetch(CONFIG.sheetCsvUrl);
  if (!res.ok) throw new Error(`Sheet CSV: HTTP ${res.status}`);
  rows = parseCsv(await res.text()).slice(1);
  submitUrl = SITE_URL;
}

const papers = thisWeekPapers(rows);
const titles = {};
try {
  for (const [id, meta] of await fetchInspire(papers.map((p) => p.arxivId).filter(Boolean))) {
    titles[id] = meta.title;
  }
} catch (err) {
  console.error(`Paper titles unavailable: ${err.message}`);
}
const trending = await fetchTrending({ size: 1 });
const text = buildReminder({ papers, trending, meeting: CONFIG.meeting, submitUrl, titles });

console.log(`Source: ${source}. Papers this week: ${papers.length}.\n`);
console.log(text);

const post = schedule ? process.env.SLACK_REMINDER === 'on' : process.env.POST === 'true';
if (!post) {
  console.log(
    schedule
      ? '\nNot posted: set the repository variable SLACK_REMINDER to "on" to post on schedule.'
      : '\nNot posted: run with "post" ticked to send it.'
  );
  process.exit(0);
}
if (!process.env.SLACK_WEBHOOK_URL) throw new Error('SLACK_WEBHOOK_URL is not set');
const res = await fetch(process.env.SLACK_WEBHOOK_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text }),
});
const reply = await res.text();
if (!res.ok || reply !== 'ok') throw new Error(`Slack: HTTP ${res.status} ${reply}`);
console.log('\nPosted to Slack.');
