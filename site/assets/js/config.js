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

  // The club Gmail that .github/workflows/email-submissions.yml reads, so people
  // without GitHub can email a paper (arXiv ID as the subject, why in the body).
  // Shown on This Week and About when set; '' hides it.
  submissionEmail: 'particles.plots.jc@gmail.com',

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

  // Topics for paper pills, the Archive filter and the Stats "What we've been
  // reading" grid (topics.js). A paper gets a topic when `match` finds it in
  // the title or INSPIRE keywords, or twice in the abstract; at most three per
  // paper, the best matches first. Edit freely: order is the display order.
  topics: [
    {
      label: 'Neutrinos',
      match:
        /neutrino|ν|sterile|IceCube|KATRIN|DUNE|Hyper-?Kamiokande|Super-?Kamiokande|JUNO|seesaw|double[- ]beta/i,
    },
    {
      label: 'Dark matter',
      match:
        /dark matter|\bWIMPs?\b|freeze-?(?:in|out)|direct detection|relic (?:abundance|density)|dark sector|hidden sector/i,
    },
    {
      label: 'Axions & light particles',
      match: /axion|\bALPs?\b|dark photon|hidden photon|light scalar|feebly|millicharged/i,
    },
    {
      label: 'Cosmology',
      match:
        /cosmolog|\bCMB\b|cosmic microwave|inflation|dark energy|Hubble|nucleosynthesis|\bBBN\b|baryogenesis|leptogenesis|early universe|phase transition/i,
    },
    {
      label: 'Astroparticle',
      match:
        /cosmic[- ]rays?|gamma[- ]rays?|astrophysical|supernova|neutron stars?|multi-?messenger|blazar|galactic/i,
    },
    {
      label: 'Gravity & black holes',
      match:
        /gravitational[- ]waves?|\bLIGO\b|\bLISA\b|pulsar timing|black holes?|general relativity/i,
    },
    {
      label: 'Colliders',
      match:
        /\bLHC\b|collider|\bATLAS\b|\bCMS\b|\bLHCb\b|top quark|\bjets?\b|\bFCC|Drell-?Yan|four-top|di-top/i,
    },
    {
      label: 'Higgs & electroweak',
      match: /Higgs|electroweak|\b[WZ] bosons?|\bSMEFT\b/i,
    },
    {
      label: 'Flavour',
      match:
        /flavou?r|\bB[- ]mesons?|kaons?|\bCKM\b|\bg-2\b|anomalous magnetic moment|CP violation|rare decays?/i,
    },
    {
      label: 'QCD & hadrons',
      match: /\bQCD\b|lattice|hadron|parton|gluon|nucleon|\bPDFs?\b|quarkonium|heavy[- ]ion/i,
    },
    {
      label: 'Machine learning',
      match:
        /machine learning|neural network|deep learning|simulation-based inference|normali[sz]ing flow|transformer/i,
    },
    {
      label: 'Formal theory',
      match:
        /supersymmetr|string theory|scattering amplitude|conformal field|holograph|\bAdS\b|swampland|modular (?:symmetr|invarian|form)/i,
    },
  ],

  // Seasonal decorations (seasons.js, pixel art in themes.js): the site wears a
  // theme for the season, or for a few days around a physics day, decided by
  // the visitor's date. Northern-hemisphere seasons. Dates are 'MM-DD'; a day
  // can instead give a rule (see the Nobel Prize) and per-year overrides. Only
  // themes with art in themes.js are listed; the planned calendar is in
  // docs/MAINTAINING.md. Preview any theme with ?season=<theme> on a page URL,
  // or ?season=none for none. `enabled: false` turns it all off.
  seasons: {
    enabled: true,
    dayWindow: 2, // days before and after a physics day; a day's own `window` wins
    base: [
      { theme: 'autumn', from: '09-22', to: '12-20' },
      { theme: 'winter', from: '12-21', to: '03-19' },
      { theme: 'spring', from: '03-20', to: '06-20' },
      { theme: 'summer', from: '06-21', to: '09-21' },
    ],
    days: [
      { theme: 'dark-matter', label: 'Dark Matter Day', date: '10-31' },
      { theme: 'pauli', label: "Pauli's neutrino letter", date: '12-04' },
      { theme: 'women-in-science', label: 'Women and Girls in Science', date: '02-11' },
      { theme: 'pi-day', label: "Pi Day and Einstein's birthday", date: '03-14' },
      { theme: 'april-fools', label: "April Fools' Day", date: '04-01', window: 0 },
      { theme: 'day-of-light', label: 'International Day of Light', date: '05-16' },
      { theme: 'oscillations', label: 'Neutrino oscillations (Super-K, 1998)', date: '06-05' },
      { theme: 'neutrinos-detected', label: 'Neutrinos detected (1956)', date: '06-14' },
      { theme: 'asteroid-day', label: 'Asteroid Day', date: '06-30', window: 1 },
      { theme: 'higgs', label: 'Higgs boson discovery (2012)', date: '07-04' },
      { theme: 'perseids', label: 'Perseids', date: '08-12' },
      // The physics prize is announced on the Tuesday of Nobel week: the first
      // Tuesday on or after Oct 2 (every year 2018–2025). If a year differs,
      // add it to overrides, e.g. { 2031: '10-14' }.
      {
        theme: 'nobel',
        label: 'Nobel Prize in Physics',
        rule: { month: 10, weekday: 'Tuesday', onOrAfter: 2 },
        overrides: {},
      },
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
