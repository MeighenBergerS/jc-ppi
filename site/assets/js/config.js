/* ============================================================
   config.js — Club settings and column maps
   ============================================================
   The one place for the club's settings: the site, the paper
   bot, the Trending issue and the Slack reminder all read them
   from here. Things that can't import this file (the workflow
   crons, the static text in site/index.html) are checked
   against it by tests/config.test.js.
   ============================================================ */

// The GitHub repository whose issues hold the paper submissions.
const REPO = 'MeighenBergerS/jc-ppi';

export const CONFIG = {
  clubName: 'Iowa Particles & Plots Journal Club',
  shortName: 'Particles & Plots', // in friendly text, e.g. the monthly roundup email

  issuesRepo: REPO,

  // Where "Bring a paper" links go: the paper issue form.
  formUrl: `https://github.com/${REPO}/issues/new?template=1-paper.yml`,

  // Base URL of the deployed site, used in the calendar .ics file.
  // Leave blank to derive it from window.location (right for most deployments).
  siteUrl: '',

  // Data the deploy workflow (scripts/papers/build-csv.js) writes into site/data/.
  papersCsvUrl: './data/papers.csv', // approved paper issues (see COL below)
  trendingCsvUrl: './data/trending.csv', // the newest Trending issue (see COL_TREND below)

  // The club's time zone: the meeting, the Slack reminder, and the weeks the
  // bot and the reminder count in. (The site counts weeks in the visitor's time.)
  timezone: 'America/Chicago', // IANA name
  timezoneLabel: 'Central Time',
  timezoneAbbr: 'CT',

  // The weekly meeting. Times are 24-hour, in `timezone`.
  meeting: {
    day: 'Friday',
    start: '15:30',
    end: '17:00',
    slackUrl: '', // Slack channel URL; leave '' to show plain text
  },

  // The weekly Slack reminder (scripts/papers/slack-reminder.js). The crons in
  // .github/workflows/slack-reminder.yml must match; tests/config.test.js checks.
  slackReminder: {
    day: 'Thursday',
    hour: 13, // 24-hour, in `timezone`
  },

  // The private monthly roundup emails (scripts/papers/roundup-email.js), sent
  // for the month before. The cron in .github/workflows/roundup.yml must match;
  // tests/config.test.js checks.
  roundup: {
    dayOfMonth: 1,
  },

  // The Trending issue (scripts/papers/trending.js). The cron in
  // .github/workflows/trending.yml must match `refreshDays`.
  trending: {
    arxivCategory: 'hep-ph',
    lookbackWeeks: 4,
    perCategory: 3,
    refreshDays: ['Monday', 'Wednesday'],
    // `extra` narrows the INSPIRE search for that category.
    categories: [
      { label: 'Overall hep-ph', emoji: '🔬', extra: '' },
      { label: 'Neutrinos', emoji: '⚛️', extra: 'neutrino' },
      { label: 'Dark Matter', emoji: '🌑', extra: '"dark matter"' },
    ],
  },

  // The Iowa Research page: how many weeks back to search.
  iowa: {
    lookbackWeeks: 8,
  },
};

// ── STATS PAGE STOP WORDS ──────────────────────────────────
// Words excluded from the title-word frequency chart on the Stats page.
// Add or remove entries freely — lower-case, one word per entry.
// Three groups are kept separate for readability:
//   1. Standard English (articles, prepositions, conjunctions, …)
//   2. Academic paper filler (common title verbs/nouns with no topic signal)
//   3. HEP-specific boilerplate (universally present in the field)

export const TITLE_STOP_WORDS = new Set([
  // 1. Standard English
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'nor',
  'so',
  'yet',
  'in',
  'of',
  'for',
  'with',
  'at',
  'by',
  'from',
  'via',
  'on',
  'to',
  'into',
  'onto',
  'upon',
  'over',
  'under',
  'about',
  'as',
  'its',
  'it',
  'is',
  'are',
  'be',
  'been',
  'being',
  'has',
  'have',
  'had',
  'was',
  'were',
  'do',
  'does',
  'did',
  'this',
  'that',
  'these',
  'those',
  'their',
  'they',
  'them',
  'we',
  'us',
  'our',
  'i',
  'not',
  'no',

  // 2. Academic paper filler
  'probing',
  'probe',
  'exploring',
  'explore',
  'studying',
  'study',
  'searching',
  'search',
  'constraining',
  'constraints',
  'constraint',
  'revisiting',
  'revisited',
  'towards',
  'using',
  'beyond',
  'new',
  'novel',
  'first',
  'improved',
  'updated',
  'precise',
  'precision',
  'general',
  'effective',
  'implications',
  'implication',
  'evidence',
  'observation',
  'observations',
  'measurement',
  'measurements',
  'analysis',
  'analyses',
  'approach',
  'approaches',
  'case',
  'cases',
  'role',
  'impact',
  'effects',
  'effect',
  'via',
  'through',
  'within',
  'based',
  'induced',
  'driven',
  'dependent',
  'independent',

  // 3. HEP-specific boilerplate
  'physics',
  'particle',
  'field',
  'theory',
  'model',
  'models',
  'standard',
  'quantum',
  'lhc',
  'collider',
  'colliders',
  'cross',
  'section',
  'sections',
  'energy',
  'mass',
]);

// ── PAPERS CSV COLUMN MAP ───────────────────────────────────
// Columns of papers.csv (0-indexed), written by scripts/papers/lib.js
// issuesToRows(). The layout matches the retired Google Sheet's Public tab,
// so the history and the test fixtures read the same way. Only approved,
// not-removed papers are written, so Approved is always "TRUE" and Removed
// and EditedComment are always empty.
export const COL = {
  timestamp: 0,
  name: 1,
  arxivId: 2,
  comment: 3,
  approved: 4, // "TRUE"
  removed: 5, // "TRUE" when removed; never set in papers.csv
  editedComment: 6, // overrides comment when non-empty; never set in papers.csv
  votes: 7, // 👍 reactions on the issue (plus votes from the Google Sheet era)
  discussed: 8, // "TRUE" when the issue has the "discussed" label
  issueUrl: 9, // the paper's GitHub issue
};

// ── TRENDING CSV COLUMN MAP ─────────────────────────────────
// Columns of trending.csv (0-indexed), written from the newest Trending issue:
//   A (0) Category  B (1) Rank  C (2) ArxivId  D (3) Title  E (4) Abstract
//   F (5) Authors   G (6) Affiliation  H (7) Citations  I (8) CitationsNoSelf
export const COL_TREND = {
  category: 0,
  rank: 1,
  arxivId: 2,
  title: 3,
  abstract: 4,
  authors: 5,
  affiliation: 6,
  citations: 7,
  citationsNoSelf: 8,
};
