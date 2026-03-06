/* ============================================================
   config.js — Site configuration and column mapping
   ============================================================
   The only file you should ever need to edit after initial setup.
   ============================================================ */

// ── GOOGLE INTEGRATION ──────────────────────────────────────

export const CONFIG = {
  // Published CSV export URL for the *Public* sheet tab.
  // That tab mirrors all columns from the response sheet EXCEPT email.
  // File → Share → Publish to web → choose the "Public" tab → CSV → copy URL.
  sheetCsvUrl:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSV30CUvQZhLXFlvt0HqGmGsMZqaapy4S_xIQAxYiJp1IBkkW515MNIdBvSnEaYRu9NQ1rOvCANW2ua/pub?gid=620589092&single=true&output=csv',

  // Share link for the Google Form (the URL you give to members).
  // Publish → link icon → copy URL.
  formUrl: 'https://forms.gle/j88TQiKnpScU9xY28',

  // Published CSV export URL for the *Trending* tab.
  // File → Share → Publish to web → choose the "Trending" tab → CSV → copy URL.
  // Leave blank until the Trending tab has been created and published.
  trendingCsvUrl:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSV30CUvQZhLXFlvt0HqGmGsMZqaapy4S_xIQAxYiJp1IBkkW515MNIdBvSnEaYRu9NQ1rOvCANW2ua/pub?gid=1574674238&single=true&output=csv',

  // Apps Script web app URL for vote/edit/remove mutations.
  // Deploy docs/appscript.gs as a web app (Execute as: Me, Anyone can access)
  // and paste the /exec URL here.  Leave blank to disable interactive controls.
  mutateUrl:
    'https://script.google.com/macros/s/AKfycbw6pJRxEQOXgLGLL3f0ih6HL05aSkwiKLipp0sB2o7Ec906WPxxVQ4ZmKlX742Aedix/exec',

  // Base URL of the deployed site — used in the calendar .ics file description.
  // Leave blank to derive from window.location automatically (correct for most deployments).
  // Set explicitly if the auto-detected URL is wrong for your setup.
  siteUrl: '',

  // Meeting schedule — update these if the day, time, or location changes.
  // day/time/timezoneLabel/timezone appear in the "When" block on the home page.
  // icsAnchor/icsDurationEnd/icsDayCode drive the "Add to Calendar" download.
  meeting: {
    day: 'Friday',
    time: '2:30 PM CT',
    timezoneLabel: 'Central Time', // human-readable label shown next to the time
    timezone: 'America/Chicago', // IANA timezone name used in the .ics file
    icsAnchor: '20260306T143000', // DTSTART of a known occurrence — update if time changes
    icsDurationEnd: '20260306T160000', // DTEND of that same occurrence
    icsDayCode: 'FR', // RRULE BYDAY value (FR=Friday, TH=Thursday, etc.)
    slackUrl: '', // Slack channel URL — leave '' to show plain text
  },
};

// ── SHEET COLUMN MAP ────────────────────────────────────────
// Columns refer to the *Public* tab (email is excluded there):
//   A (0) Timestamp  B (1) Name  C (2) arXiv ID  D (3) Comment  E (4) Approved
//   F (5) Removed    G (6) EditedComment          H (7) Votes
// The three new columns (F-H) are written by the Apps Script.
// Do not change these unless you reorder the Public tab columns.

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

export const COL = {
  timestamp: 0,
  name: 1,
  arxivId: 2,
  comment: 3,
  // Approved checkbox (column E in the Public tab, column F in the raw sheet).
  // Ticked automatically by the Apps Script for known members;
  // tick manually in the raw sheet for one-off approvals.
  approved: 4,
  // Interactivity columns (added to the Public tab; see docs/appscript.gs).
  removed: 5, // "TRUE" when a visitor removes the entry
  editedComment: 6, // overrides comment when non-empty
  votes: 7, // running upvote count
  discussed: 8, // "TRUE" when the paper was starred as discussed at the JC meeting
};

// ── TRENDING TAB COLUMN MAP ─────────────────────────────────
// Columns in the Trending tab CSV (0-indexed):
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
