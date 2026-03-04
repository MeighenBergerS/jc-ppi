const APPROVED = [
  'example@gmail.com',
];

function onFormSubmit(e) {
  const sheet = e.range.getSheet();
  const row = e.range.getRow();
  const email = (e.values[4] ?? '').trim().toLowerCase();
  console.log('Email received:', JSON.stringify(email));  // ← here
  const approved = APPROVED.map((a) => a.toLowerCase()).includes(email);
  sheet.getRange(row, 6).setValue(approved);
}


// ============================================================
// Apps Script — doPost handler for jc-ppi interactivity
// ============================================================
// Paste this function into your existing Apps Script project
// (Google Sheet → Extensions → Apps Script).
//
// DEPLOY as a web app:
//   Deploy → New deployment → Type: Web app
//   Execute as: Me
//   Who has access: Anyone
// Copy the /exec URL into config.js as mutateUrl.
//
// SHEET SETUP — add three columns to the right of column E
// on the "Public" tab (or whatever SHEET_NAME is set to):
//   F  Removed        (leave blank; Apps Script writes "TRUE" here)
//   G  EditedComment  (leave blank; Apps Script writes the new comment)
//   H  Votes          (set to 0 for existing rows; Apps Script increments)
// ============================================================

var SHEET_NAME   = 'Public'; // change if your tab is named differently

// 1-indexed column positions in the Public tab
var COL_ARXIV    = 3; // C — arXiv ID as submitted (may be URL or bare ID)
var COL_APPROVED = 5; // E — "TRUE" when approved
var COL_REMOVED  = 6; // F — "TRUE" when removed by a visitor
var COL_EDITED   = 7; // G — edited comment text (empty = use original)
var COL_VOTES    = 8; // H — running vote count

// ── Entry point ───────────────────────────────────────────────

function doPost(e) {
  var result = ContentService
    .createTextOutput()
    .setMimeType(ContentService.MimeType.JSON);

  try {
    var data    = JSON.parse(e.postData.contents);
    var action  = data.action;
    var arxivId = (data.arxivId || '').toString().trim();
    var comment = (data.comment || '').toString();

    if (!action)  throw new Error('Missing action');
    if (!arxivId) throw new Error('Missing arxivId');

    var sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found');

    var row = _findRow(sheet, arxivId);
    if (row === -1) throw new Error('Paper not found: ' + arxivId);

    if (action === 'vote') {
      var current  = Number(sheet.getRange(row, COL_VOTES).getValue()) || 0;
      var newCount = current + 1;
      sheet.getRange(row, COL_VOTES).setValue(newCount);
      result.setContent(JSON.stringify({ ok: true, votes: newCount }));

    } else if (action === 'remove') {
      sheet.getRange(row, COL_REMOVED).setValue('TRUE');
      result.setContent(JSON.stringify({ ok: true }));

    } else if (action === 'edit') {
      sheet.getRange(row, COL_EDITED).setValue(comment.trim());
      result.setContent(JSON.stringify({ ok: true }));

    } else {
      throw new Error('Unknown action: ' + action);
    }

  } catch (err) {
    result.setContent(JSON.stringify({ ok: false, error: err.message }));
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Finds the 1-indexed row number of a paper by arXiv ID.
 * Matches normalised IDs (strips URL prefix, version suffix).
 * Returns -1 if not found, if the row is removed / not approved,
 * or if the submission timestamp is not within the current week
 * (Monday 00:00 – Sunday 23:59 in the spreadsheet's timezone).
 */
function _findRow(sheet, cleanId) {
  var now       = new Date();
  var weekStart = _thisWeekMonday(now);
  var weekEnd   = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7); // exclusive upper bound (Monday 00:00 next week)

  var lastRow = sheet.getLastRow();
  for (var i = 2; i <= lastRow; i++) {
    var rawId    = sheet.getRange(i, COL_ARXIV).getValue().toString().trim();
    var approved = sheet.getRange(i, COL_APPROVED).getValue().toString().trim().toUpperCase();
    var removed  = sheet.getRange(i, COL_REMOVED).getValue().toString().trim().toUpperCase();

    if (approved !== 'TRUE' || removed === 'TRUE') continue;
    if (_normalizeId(rawId) !== cleanId) continue;

    // Reject rows outside the current week
    var ts = new Date(sheet.getRange(i, 1).getValue()); // column A — Timestamp
    if (isNaN(ts) || ts < weekStart || ts >= weekEnd) continue;

    return i;
  }
  return -1;
}

/**
 * Returns a Date set to Monday 00:00:00 of the week containing `date`,
 * using the local timezone of the Apps Script environment (matches the sheet).
 */
function _thisWeekMonday(date) {
  var d   = new Date(date);
  var day = d.getDay(); // 0=Sun … 6=Sat
  var diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Strips the common arXiv URL prefix and version suffix from an ID,
 * matching what normalizeArxivId + stripVersion does on the client.
 */
function _normalizeId(raw) {
  var s = raw.trim();
  s = s.replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//, '');
  s = s.replace(/v\d+$/, '');
  return s;
}
