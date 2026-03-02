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
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSV30CUvQZhLXFlvt0HqGmGsMZqaapy4S_xIQAxYiJp1IBkkW515MNIdBvSnEaYRu9NQ1rOvCANW2ua/pubhtml?gid=620589092&single=true',

  // Share link for the Google Form (the URL you give to members).
  // Publish → link icon → copy URL.
  formUrl: 'https://forms.gle/j88TQiKnpScU9xY28',
};

// ── SHEET COLUMN MAP ────────────────────────────────────────
// Columns refer to the *Public* tab (email is excluded there):
//   A (0) Timestamp  B (1) Name  C (2) arXiv ID  D (3) Comment  E (4) Approved
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
};
