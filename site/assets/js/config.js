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

  // Apps Script web app URL for vote/edit/remove mutations.
  // Deploy docs/appscript.gs as a web app (Execute as: Me, Anyone can access)
  // and paste the /exec URL here.  Leave blank to disable interactive controls.
  mutateUrl:
    'https://script.google.com/macros/s/AKfycbw6pJRxEQOXgLGLL3f0ih6HL05aSkwiKLipp0sB2o7Ec906WPxxVQ4ZmKlX742Aedix/exec',

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
};
