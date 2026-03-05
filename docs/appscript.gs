// Name of the sheet tab that lists approved member emails, one per row in column A.
// To add or remove a member, edit that tab directly — no code changes needed.
var MEMBERS_SHEET_NAME = 'Members';

function onFormSubmit(e) {
  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  var email = (e.values[4] ?? '').trim().toLowerCase();
  var approved = _getApprovedEmails().includes(email);
  sheet.getRange(row, 6).setValue(approved);
}

/**
 * Reads approved member emails from the Members tab.
 * Returns an array of lowercase, trimmed email strings.
 * Falls back to an empty array if the tab doesn't exist yet.
 */
function _getApprovedEmails() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var membersSheet = ss.getSheetByName(MEMBERS_SHEET_NAME);
  if (!membersSheet) return [];
  var lastRow = membersSheet.getLastRow();
  if (lastRow < 1) return [];
  return membersSheet
    .getRange(1, 1, lastRow, 1)
    .getValues()
    .map(function (r) {
      return r[0].toString().trim().toLowerCase();
    })
    .filter(Boolean);
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
var COL_REMOVED   = 6; // F — "TRUE" when removed by a visitor
var COL_EDITED    = 7; // G — edited comment text (empty = use original)
var COL_VOTES     = 8; // H — running vote count
var COL_DISCUSSED = 9; // I — "TRUE" when the paper was starred as discussed at the meeting

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

    } else if (action === 'discuss') {
      var wasDiscussed = sheet.getRange(row, COL_DISCUSSED).getValue().toString().trim().toUpperCase() === 'TRUE';
      sheet.getRange(row, COL_DISCUSSED).setValue(wasDiscussed ? '' : 'TRUE');
      result.setContent(JSON.stringify({ ok: true, discussed: !wasDiscussed }));

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

// ============================================================
// Weekly Slack Reminder — Thursday 1 PM
// ============================================================
// Posts a summary to your Slack channel via an Incoming Webhook.
//
// SETUP:
//   1. Go to https://api.slack.com/apps → Create App → From scratch
//   2. Enable "Incoming Webhooks" and add a webhook for your channel
//   3. Paste the webhook URL into SLACK_WEBHOOK_URL below
//   4. Set SLACK_CHANNEL to your channel name (for display only)
//
// TRIGGER:
//   Apps Script → Triggers → Add trigger
//     Function:   weeklySlackReminder
//     Event:      Time-driven → Week timer → Thursday → 1pm–2pm
// ============================================================

var SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';

// ── Column indices for the PUBLIC sheet (1-indexed) ───────────
// Adjust COL_NAME if your submitter name column is not column B.
var COL_TIMESTAMP  = 1; // A — submission timestamp
var COL_NAME       = 2; // B — submitter's name ← adjust if needed
// COL_ARXIV, COL_APPROVED, COL_REMOVED, COL_VOTES already defined above

// ── Main function ─────────────────────────────────────────────

function weeklySlackReminder() {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var publicSheet = ss.getSheetByName(SHEET_NAME);   // 'Public', defined above
  if (!publicSheet) {
    Logger.log('Sheet "' + SHEET_NAME + '" not found — aborting reminder.');
    return;
  }

  var now       = new Date();
  var weekStart = _thisWeekMonday(now); // reuses existing helper
  var weekEnd   = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  var lastRow = publicSheet.getLastRow();
  if (lastRow < 2) {
    _postToSlack(_buildMessage([], null));
    return;
  }

  // Read all relevant columns in one batch (faster than per-cell reads)
  var data = publicSheet.getRange(2, 1, lastRow - 1, COL_VOTES).getValues();

  var submitters  = []; // names of people who submitted this week
  var topPaper    = null; // { arxivId, votes, name }

  data.forEach(function (row) {
    var tsVal    = row[COL_TIMESTAMP - 1];
    var name     = (row[COL_NAME - 1] || '').toString().trim();
    var arxivId  = _normalizeId((row[COL_ARXIV - 1] || '').toString());
    var approved = (row[COL_APPROVED - 1] || '').toString().trim().toUpperCase();
    var removed  = (row[COL_REMOVED - 1] || '').toString().trim().toUpperCase();
    var votes    = Number(row[COL_VOTES - 1]) || 0;

    // Skip unapproved or removed rows
    if (approved !== 'TRUE' || removed === 'TRUE') return;

    // Check timestamp falls within this week
    var ts = tsVal instanceof Date ? tsVal : new Date(tsVal);
    if (isNaN(ts) || ts < weekStart || ts >= weekEnd) return;

    // Collect submitter name (deduplicated)
    if (name && !submitters.includes(name)) submitters.push(name);

    // Track highest-voted paper
    if (!topPaper || votes > topPaper.votes) {
      topPaper = { arxivId: arxivId, votes: votes, name: name };
    }
  });

  _postToSlack(_buildMessage(submitters, topPaper));
}

// ── Message builder ───────────────────────────────────────────

function _buildMessage(submitters, topPaper) {
  var siteUrl = 'https://meighenbergers.github.io/jc-ppi/';
  var lines   = [];

  lines.push('*📄 Journal Club — weekly paper reminder* (meeting tomorrow at 2:30pm!)');
  lines.push('');

  // Thank submitters
  if (submitters.length === 0) {
    lines.push('No papers submitted yet this week — be the first! 🚀');
  } else if (submitters.length === 1) {
    lines.push('Thank you *' + submitters[0] + '* for submitting! 🎉');
  } else {
    var last  = submitters[submitters.length - 1];
    var rest  = submitters.slice(0, -1);
    lines.push('Thank you *' + rest.join(', ') + '*, and *' + last + '* for submitting! 🎉');
  }

  lines.push('');

  // Top paper
  if (topPaper && topPaper.arxivId) {
    var arxivUrl = 'https://arxiv.org/abs/' + topPaper.arxivId;
    if (topPaper.votes > 0) {
      lines.push(
        '🏆 *Top paper so far:* <' + arxivUrl + '|' + topPaper.arxivId + '>' +
        ' — ' + topPaper.votes + (topPaper.votes === 1 ? ' vote' : ' votes')
      );
    } else {
      lines.push(
        '📌 *This week\'s paper:* <' + arxivUrl + '|' + topPaper.arxivId + '>' +
        ' (no votes yet — go cast yours!)'
      );
    }
  }

  lines.push('');

  // Nudge to submit
  if (submitters.length < 3) {
    // Encourage more submissions if the list is thin
    lines.push('👀 Haven\'t submitted yet? There\'s still time — browse arXiv and share something interesting!');
  } else {
    lines.push('💡 Haven\'t submitted yet? You can still add a paper before the meeting.');
  }

  lines.push('➡️  Submit here: ' + siteUrl);

  return lines.join('\n');
}

// ── Slack poster ──────────────────────────────────────────────

function _postToSlack(text) {
  var payload = JSON.stringify({ text: text });
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  };
  var response = UrlFetchApp.fetch(SLACK_WEBHOOK_URL, options);
  Logger.log('Slack response: ' + response.getContentText());
}
