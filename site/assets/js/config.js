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
};

// ── SHEET COLUMN MAP ────────────────────────────────────────
// Column 0 is the Timestamp Google adds automatically.
// Columns 1–3 correspond to your three form questions in order.
// Do not change these unless you reorder the form questions.

export const COL = {
  timestamp: 0,
  name: 1,
  arxivId: 2,
  comment: 3,
};
