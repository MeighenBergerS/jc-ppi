/* ============================================================
   config.js — Site configuration and column mapping
   ============================================================
   The only file you should ever need to edit after initial setup.
   ============================================================ */

// ── DATA SOURCES ────────────────────────────────────────────
// Papers are GitHub issues labelled "paper"; see docs/SETUP.md.
// The deploy workflow (scripts/papers/build-csv.js) writes both CSVs
// into site/data/ before every deploy.

export const CONFIG = {
  // The GitHub repository whose issues hold the paper submissions.
  issuesRepo: 'MeighenBergerS/jc-ppi',

  // Approved paper issues, one row per submission (see COL below).
  papersCsvUrl: './data/papers.csv',

  // The newest "Trending" issue, one row per trending paper (see COL_TREND below).
  trendingCsvUrl: './data/trending.csv',

  // Where "Submit a Paper" links go: the paper issue form.
  formUrl: 'https://github.com/MeighenBergerS/jc-ppi/issues/new?template=1-paper.yml',

  // How many weeks back to search for Iowa-affiliated papers on the Iowa Research tab.
  iowaLookbackWeeks: 8,

  // Base URL of the deployed site — used in the calendar .ics file description.
  // Leave blank to derive from window.location automatically (correct for most deployments).
  // Set explicitly if the auto-detected URL is wrong for your setup.
  siteUrl: '',

  // Meeting schedule — update these if the day, time, or location changes.
  // day/time/timezoneLabel/timezone appear in the "When" block on the home page.
  // icsAnchor/icsDurationEnd/icsDayCode drive the "Add to Calendar" download.
  meeting: {
    day: 'Friday',
    time: '3:30 PM CT',
    timezoneLabel: 'Central Time', // human-readable label shown next to the time
    timezone: 'America/Chicago', // IANA timezone name used in the .ics file
    icsAnchor: '20260306T153000', // DTSTART of a known occurrence — update if time changes
    icsDurationEnd: '20260306T170000', // DTEND of that same occurrence
    icsDayCode: 'FR', // RRULE BYDAY value (FR=Friday, TH=Thursday, etc.)
    slackUrl: '', // Slack channel URL — leave '' to show plain text
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
