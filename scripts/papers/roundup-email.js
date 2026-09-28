/* ============================================================
   scripts/papers/roundup-email.js — Emails the monthly roundups
   ============================================================
   Run by .github/workflows/roundup.yml. Each member (see
   roundupLogins() in roundup.js) whose GitHub profile shows a
   public email gets their own roundup from the club's Gmail
   account; members without one are skipped.

   The Actions log is public, so this prints counts only: never
   a login, an address or a roundup.

   Environment:
     GMAIL_ADDRESS, GMAIL_APP_PASSWORD  The club Gmail account (secrets).
     ROUNDUP_OPTOUT  Logins that asked not to get it (repository variable).
     SEND            "true" sends; otherwise it only counts.
     MONTH           "YYYY-MM"; defaults to last month.
     GITHUB_TOKEN, GITHUB_REPOSITORY  To read the issues and profiles.
   ============================================================ */

import { readFileSync } from 'node:fs';
import { CONFIG } from '../../site/assets/js/config.js';
import { LABELS, github, fetchInspire, parseLoginList } from './lib.js';
import {
  roundupLogins,
  parseOptOut,
  memberPapers,
  buildRoundup,
  renderRoundup,
  monthKey,
  previousMonth,
} from './roundup.js';
import { renderRoundupHtml } from './roundup-html.js';
import { isEmail, sendMail } from './smtp.js';

const send = process.env.SEND === 'true';
const month = process.env.MONTH || previousMonth(monthKey(new Date()));
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
  console.error(`MONTH must look like 2026-09, not "${month}".`);
  process.exit(1);
}
const from = process.env.GMAIL_ADDRESS ?? '';
const pass = process.env.GMAIL_APP_PASSWORD ?? '';
if (send && (!isEmail(from) || !pass)) {
  console.error('Set the GMAIL_ADDRESS and GMAIL_APP_PASSWORD secrets to send.');
  process.exit(1);
}

const readLogins = (file) =>
  parseLoginList(readFileSync(new URL(`../../.github/${file}`, import.meta.url), 'utf8'));

const api = github(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY || CONFIG.issuesRepo);
const issues = await api.paginate(`/issues?labels=${LABELS.paper}&state=all`);
const optOut = parseOptOut(process.env.ROUNDUP_OPTOUT);
const logins = roundupLogins(issues, [
  ...readLogins('paper-members.txt'),
  ...readLogins('paper-maintainers.txt'),
]);

// Members with a public email; their profile name also finds their Sheet-era papers.
const members = [];
let noEmail = 0;
for (const login of logins.filter((l) => !optOut.has(l))) {
  let user;
  try {
    user = await api.request('GET', `https://api.github.com/users/${login}`);
  } catch {
    noEmail++; // a deleted or renamed account
    continue;
  }
  if (!isEmail(user.email)) {
    noEmail++;
    continue;
  }
  const names = user.name?.trim() ? [user.name.trim()] : [];
  members.push({ email: user.email, papers: memberPapers(issues, { login, names }) });
}

let meta = new Map();
const ids = [...new Set(members.flatMap((m) => m.papers.map((p) => p.arxivId)).filter(Boolean))];
try {
  meta = await fetchInspire(ids);
} catch (err) {
  console.error(`INSPIRE unavailable, so no titles or subfields: ${err.message}`);
}

const messages = members.map(({ email, papers }) => {
  const roundup = buildRoundup(papers, month, meta);
  return {
    from,
    fromName: CONFIG.clubName,
    to: email,
    ...renderRoundup(roundup, meta),
    html: renderRoundupHtml(roundup, meta),
  };
});

console.log(
  `Roundup for ${month}: ${logins.length} members, ` +
    `${logins.filter((l) => optOut.has(l)).length} opted out, ` +
    `${noEmail} without a public email, ${messages.length} to email.`
);
if (!send) {
  console.log('Not sending (SEND is not "true").');
  process.exit(0);
}

const { sent, failed } = await sendMail({
  host: 'smtp.gmail.com',
  port: 465,
  user: from,
  pass,
  messages,
});
console.log(`Sent ${sent}.`);
if (failed.length) {
  console.error(`${failed.length} not sent; reply codes: ${failed.map((f) => f.code).join(', ')}.`);
  process.exit(1);
}
