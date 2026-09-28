/* ============================================================
   scripts/papers/roundup.js — Personal monthly roundups
   ============================================================
   One member's month at the journal club: the papers they
   suggested, which were discussed, their weekly streak and the
   milestones they reached. Compared only with their own earlier
   months, never with other members. Pure functions; the preview
   (roundup-preview.js) and the monthly email (roundup-email.js)
   use them.

   A member is { login, names }: their GitHub username, and the
   names they used in the Google Sheet, which identify their
   imported papers (those issues were opened by the importer).
   ============================================================ */

import { CONFIG } from '../../site/assets/js/config.js';
import { plainText } from '../../site/assets/js/mathtext.js';
import {
  FIELDS,
  LABELS,
  parseIssueForm,
  parseImported,
  cleanArxivId,
  submittedAt,
  isVisiblePaper,
  weekStartDay,
} from './lib.js';

// Milestones: each counts something in a member's history and is
// reached at each of its tiers. They repeat over the years, so a
// grad student keeps reaching new ones.
export const MILESTONES = [
  {
    id: 'papers',
    emoji: '📚',
    unit: 'paper',
    goal: (t) => `${t} papers suggested`,
    tiers: [10, 25, 50, 100, 200],
  },
  {
    id: 'discussed',
    emoji: '🗣️',
    unit: 'paper',
    goal: (t) => `${t} papers discussed`,
    tiers: [5, 10, 25, 50, 100],
  },
  {
    id: 'streak',
    emoji: '🔥',
    unit: 'week',
    goal: (t) => `${t}-week streak`,
    tiers: [4, 8, 12, 26, 52],
  },
  {
    id: 'subfields',
    emoji: '🧭',
    unit: 'subfield',
    goal: (t) => `${t} subfields covered`,
    tiers: [2, 4, 6, 8],
  },
  {
    id: 'fresh',
    emoji: '⚡',
    unit: 'paper',
    goal: (t) => `${t} papers suggested the month they hit arXiv`,
    tiers: [5, 20, 50, 100],
  },
  {
    id: 'votes',
    emoji: '👍',
    unit: 'vote',
    goal: (t) => `${t} votes on your papers`,
    tiers: [10, 50, 100, 250, 500],
  },
];

const labelSet = (issue) => new Set(issue.labels.map((l) => (typeof l === 'string' ? l : l.name)));
const norm = (name) => (name ?? '').trim().toLowerCase();

/** "2026-09", the month `date` falls in, in the club's time zone. */
export function monthKey(date, timeZone = CONFIG.timezone) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit' })
      .formatToParts(date)
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}`;
}

/** The month before "2026-09": "2026-08". */
export function previousMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
}

/** "September 2026". */
export function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * True when a modern arXiv ID (YYMM.NNNNN) was posted in `month` ("2026-09"),
 * i.e. the paper was suggested the month it appeared. Old-style IDs never are.
 */
export function isFresh(arxivId, month) {
  const m = /^(\d{2})(\d{2})\.\d{4,5}$/.exec(arxivId ?? '');
  return !!m && month === `20${m[1]}-${m[2]}`;
}

/**
 * A member's visible paper issues, oldest first. Their own issues match by
 * login; imported issues match by the Sheet name, ignoring case.
 * @param {object[]} issues - Paper issues from the GitHub API.
 * @param {{login: string, names?: string[]}} member
 * @returns {{number, url, arxivId, date: Date, month, week, discussed, votes}[]}
 */
export function memberPapers(issues, member) {
  const login = norm(member.login);
  const names = new Set((member.names ?? []).map(norm).filter(Boolean));
  return issues
    .filter(isVisiblePaper)
    .filter((issue) => {
      const imported = parseImported(issue.body);
      if (imported) return names.has(norm(parseIssueForm(issue.body)[FIELDS.name]));
      return norm(issue.user?.login) === login;
    })
    .map((issue) => {
      const date = submittedAt(issue);
      return {
        number: issue.number,
        url: issue.html_url,
        arxivId: cleanArxivId(parseIssueForm(issue.body)[FIELDS.arxiv]),
        date,
        month: monthKey(date),
        week: weekStartDay(date),
        discussed: labelSet(issue).has(LABELS.discussed),
        votes: (parseImported(issue.body)?.votes ?? 0) + (issue.reactions?.['+1'] ?? 0),
      };
    })
    .sort((a, b) => a.date - b.date);
}

/**
 * The longest run of consecutive weeks with a paper, and the run that is
 * still going at `refWeek` (a weekStartDay() number). The week in progress
 * may have no paper yet without breaking the current run.
 * @param {Iterable<number>} weeks - weekStartDay() numbers.
 */
export function streaks(weeks, refWeek) {
  const set = new Set(weeks);
  let best = 0;
  for (const w of set) {
    if (set.has(w - 7)) continue; // not the start of a run
    let n = 1;
    while (set.has(w + 7 * n)) n++;
    best = Math.max(best, n);
  }
  let current = 0;
  let w = set.has(refWeek) ? refWeek : refWeek - 7;
  while (set.has(w)) {
    current++;
    w -= 7;
  }
  return { best, current };
}

/**
 * What each milestone counts, over a list of papers.
 * @param {object[]} papers - From memberPapers().
 * @param {Map<string, {categories?: string[]}>} meta - arXiv ID → INSPIRE metadata.
 * @returns {Record<string, number>} milestone id → count
 */
export function milestoneCounts(papers, meta = new Map()) {
  const subfields = new Set(papers.flatMap((p) => meta.get(p.arxivId)?.categories ?? []));
  return {
    papers: papers.length,
    discussed: papers.filter((p) => p.discussed).length,
    streak: streaks(
      papers.map((p) => p.week),
      0
    ).best,
    subfields: subfields.size,
    fresh: papers.filter((p) => isFresh(p.arxivId, p.month)).length,
    votes: papers.reduce((sum, p) => sum + p.votes, 0),
  };
}

/** The highest tier of `milestone` that `count` reaches, or 0. */
export function tierReached(milestone, count) {
  return milestone.tiers.filter((t) => count >= t).at(-1) ?? 0;
}

/** Month end as a weekStartDay() number: the week holding the month's last day. */
function _lastWeekOf(key) {
  const [y, m] = key.split('-').map(Number);
  // Noon UTC on the last day of the month is that same date in US time zones.
  return weekStartDay(new Date(Date.UTC(y, m, 0, 18)));
}

/**
 * A member's roundup for one month. Everything counts by the month a paper
 * was suggested, with its labels and votes as they are now; so a milestone
 * crossed by a later vote or "discussed" label on an older paper is not
 * announced, only counted.
 * @param {object[]} papers - The member's papers, from memberPapers().
 * @param {string} month - "2026-09".
 * @param {Map} meta - arXiv ID → INSPIRE metadata ({ title, categories }).
 * @returns {{
 *   month, papers: object[], suggested, discussed, votes, subfields: string[],
 *   streak: {current, best}, previous: {suggested, discussed},
 *   total: number, reached: {emoji, label, tier}[],
 *   next: {emoji, label, unit, tier, count, toGo}[]
 * }}
 */
export function buildRoundup(papers, month, meta = new Map()) {
  const thisMonth = papers.filter((p) => p.month === month);
  const lastMonth = papers.filter((p) => p.month === previousMonth(month));
  const before = papers.filter((p) => p.month < month);
  const upToNow = papers.filter((p) => p.month <= month);

  const countsBefore = milestoneCounts(before, meta);
  const countsNow = milestoneCounts(upToNow, meta);
  const reached = [];
  const next = [];
  for (const m of MILESTONES) {
    const tier = tierReached(m, countsNow[m.id]);
    if (tier > tierReached(m, countsBefore[m.id])) {
      reached.push({ emoji: m.emoji, label: m.goal(tier), tier });
    }
    const upcoming = m.tiers.find((t) => t > countsNow[m.id]);
    if (upcoming)
      next.push({
        emoji: m.emoji,
        label: m.goal(upcoming),
        unit: m.unit,
        tier: upcoming,
        count: countsNow[m.id],
        toGo: upcoming - countsNow[m.id],
      });
  }
  next.sort((a, b) => a.toGo - b.toGo);

  return {
    month,
    papers: thisMonth,
    suggested: thisMonth.length,
    discussed: thisMonth.filter((p) => p.discussed).length,
    votes: thisMonth.reduce((sum, p) => sum + p.votes, 0),
    subfields: [...new Set(thisMonth.flatMap((p) => meta.get(p.arxivId)?.categories ?? []))],
    streak: streaks(
      upToNow.map((p) => p.week),
      _lastWeekOf(month)
    ),
    previous: {
      suggested: lastMonth.length,
      discussed: lastMonth.filter((p) => p.discussed).length,
    },
    total: upToNow.length,
    reached,
    next: next.slice(0, 2),
  };
}

const _plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;
const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** "September". */
export const monthName = (key) => monthLabel(key).split(' ')[0];

/** The month's scorecard: [[4, 'papers suggested'], [1, 'discussed'], [2, 'votes']]. */
export function scorecard(r) {
  return [
    [r.suggested, r.suggested === 1 ? 'paper suggested' : 'papers suggested'],
    [r.discussed, 'discussed'],
    [r.votes, r.votes === 1 ? 'vote' : 'votes'],
  ];
}

/** "1 more to go", "3 more weeks to go". */
export function toGoText(m) {
  return m.unit === 'week' ? `${_plural(m.toGo, 'more week')} to go` : `${m.toGo} more to go`;
}

/** "Two milestones down. Two more within reach…", or '' with nothing reached. */
export function unlockedNote(r) {
  if (!r.reached.length) return '';
  const word = (n) => NUMBER_WORDS[n] ?? String(n);
  const down = `${word(r.reached.length)} milestone${r.reached.length !== 1 ? 's' : ''} down.`;
  return r.next.length ? `${down} ${word(r.next.length)} more within reach…` : down;
}

/** The personal stats: [[value, unit, label]]. */
export function personalStats(r) {
  return [
    [r.streak.current, r.streak.current === 1 ? 'week' : 'weeks', 'Current streak'],
    [r.total, r.total === 1 ? 'paper' : 'papers', 'Suggested all time'],
    [
      r.previous.suggested,
      r.previous.suggested === 1 ? 'paper' : 'papers',
      `Suggested in ${monthName(previousMonth(r.month))}`,
    ],
  ];
}

/**
 * The roundup as a plain-text email: { subject, text }. renderRoundupHtml()
 * in roundup-html.js writes the same content as HTML.
 * @param {object} r - From buildRoundup().
 * @param {Map} meta - arXiv ID → INSPIRE metadata, for titles.
 */
export function renderRoundup(r, meta = new Map()) {
  const month = monthName(r.month);
  const lines = [
    `📚 Your ${month} at ${CONFIG.shortName}`,
    'A little monthly recap of your journal-club activity',
    '',
  ];

  if (r.suggested) {
    lines.push(
      scorecard(r)
        .map(([n, label]) => `${n} ${label}`)
        .join(' · '),
      ''
    );
    lines.push('📄 YOUR PAPERS', '');
    for (const p of r.papers) {
      const title = plainText(meta.get(p.arxivId)?.title ?? '');
      lines.push(`${p.discussed ? '⭐' : '📄'} ${p.arxivId ?? '(no arXiv ID)'}`);
      if (title) lines.push(`   ${title}`);
      lines.push(`   ${p.discussed ? 'Discussed' : 'Suggested'} · View discussion: ${p.url}`, '');
    }
    if (r.subfields.length) {
      lines.push(`YOUR ${month.toUpperCase()} MIX`, r.subfields.join(' · '), '');
    }
  } else {
    lines.push("No papers this month. There's always next week!", '');
  }

  if (r.reached.length) {
    lines.push('🏆 THIS MONTH YOU UNLOCKED', '');
    for (const m of r.reached) lines.push(`${m.emoji} ${m.label}`);
    lines.push('', unlockedNote(r), '');
  }

  lines.push('🔥 YOUR JOURNAL-CLUB STATS', '');
  for (const [value, unit, label] of personalStats(r)) {
    lines.push(`${`${value} ${unit}`.padEnd(11)} ${label[0].toLowerCase()}${label.slice(1)}`);
  }
  lines.push('');

  if (r.next.length) {
    lines.push('🎯 ALMOST THERE…', '');
    for (const m of r.next) lines.push(`${m.emoji} ${m.label} — ${toGoText(m)}`);
    lines.push('');
  }

  lines.push(
    `Seen something worth discussing? Suggest a paper: ${CONFIG.formUrl}`,
    '',
    '—',
    'Your journal-club activity is private — only you receive these numbers.',
    'Want to stop receiving this email? Just reply and let us know.'
  );
  if (CONFIG.siteUrl) lines.push(CONFIG.siteUrl);

  return { subject: `📚 Your ${month} at ${CONFIG.shortName}`, text: lines.join('\n') + '\n' };
}

/**
 * Who gets a roundup: everyone on the member lists, and everyone who has
 * suggested a paper from their own GitHub account. Lower-case, sorted; no bots.
 * @param {object[]} issues - Paper issues from the GitHub API.
 * @param {string[]} listed - Logins from paper-members.txt and paper-maintainers.txt.
 */
export function roundupLogins(issues, listed = []) {
  const authors = issues
    .filter((i) => isVisiblePaper(i) && !parseImported(i.body))
    .map((i) => i.user?.login ?? '');
  return [...new Set([...listed, ...authors].map(norm))]
    .filter((login) => login && !login.endsWith('[bot]'))
    .sort();
}

/** Logins in an opt-out list: separated by spaces, commas or new lines. */
export function parseOptOut(text) {
  return new Set(
    (text ?? '')
      .split(/[\s,]+/)
      .map(norm)
      .filter(Boolean)
  );
}
