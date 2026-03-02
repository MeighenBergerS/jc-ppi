/* ============================================================
   config.js — Site configuration and column mapping
   ============================================================
   The only file you should ever need to edit after initial setup.
   ============================================================ */

// ── GOOGLE INTEGRATION ──────────────────────────────────────

export const CONFIG = {
  // Published CSV export URL for your Google Sheet.
  // File → Share → Publish to web → Sheet1 → CSV → copy URL.
  sheetCsvUrl:
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSV30CUvQZhLXFlvt0HqGmGsMZqaapy4S_xIQAxYiJp1IBkkW515MNIdBvSnEaYRu9NQ1rOvCANW2ua/pub?output=csv',

  // Share link for the Google Form (the URL you give to members).
  // Publish → link icon → copy URL.
  formUrl: 'https://forms.gle/j88TQiKnpScU9xY28',

  // ── APPROVED SUBMITTERS ──────────────────────────────────
  // Submissions from these email addresses appear on the site automatically.
  // Emails are matched case-insensitively.
  // Submissions from anyone not listed here are hidden unless you manually
  // tick the Approved checkbox in column F of the Google Sheet.
  approvedEmails: [
    // 'stephan.meighenberger@gmail.com',
    // 'alice@example.com',
    // 'bob@example.com',
  ],
};

// ── SHEET COLUMN MAP ────────────────────────────────────────
// Column 0 is the Timestamp Google adds automatically.
// Columns 1–3 correspond to your three form questions in order.
// Column 4 is Email Address (collected by Google when sign-in is required).
// Column 5 is the Approved checkbox added manually in the sheet.
// Do not change these unless you reorder the sheet columns.

export const COL = {
  timestamp: 0,
  name: 1,
  arxivId: 2,
  comment: 3,
  email: 4,
  // Manually added column F in the sheet: a checkbox (TRUE/FALSE).
  // Tick this to approve a one-off submission from an unlisted email.
  approved: 5,
};
