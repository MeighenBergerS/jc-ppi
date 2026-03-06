// ============================================================
// CONFIGURATION — edit only this block
// ============================================================

// ── Sheet tab names ──────────────────────────────────────────
var SHEET_NAME          = 'Public';   // main submissions tab
var MEMBERS_SHEET_NAME  = 'Members';  // one approved email per row in column A
var TRENDING_SHEET_NAME = 'Trending'; // written by refreshTrendingPapers

// ── Slack Incoming Webhook ───────────────────────────────────
// Go to https://api.slack.com/apps → Create App → Incoming Webhooks
// Add a webhook for your channel and paste the URL below.
var SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';

// ── Site URL (used in Slack messages) ───────────────────────
var SITE_URL = 'https://meighenbergers.github.io/jc-ppi/';

// ── Meeting description (used in Slack messages) ─────────────
var MEETING_TIME = '2:30pm';      // e.g. '2:30pm', '3pm'
var MEETING_DAY  = 'tomorrow'; // e.g. 'tomorrow', 'Friday'

// ── INSPIRE-HEP settings ─────────────────────────────────────
// How many weeks back to look when finding trending papers.
var INSPIRE_LOOKBACK_WEEKS = 4;

// Top N papers to fetch per category (written to the Trending tab).
var INSPIRE_RESULTS_PER_CATEGORY = 3;

// Maximum characters to store for abstracts in the Trending tab.
var ABSTRACT_MAX_CHARS = 500;

// Categories to fetch from INSPIRE-HEP.
// Each entry:
//   label — display name on the website and in Slack
//   emoji — prefix emoji
//   extra — extra INSPIRE search term (empty string = all hep-ph)
var INSPIRE_CATEGORIES = [
  { label: 'Overall hep-ph', emoji: '🔬', extra: '' },
  { label: 'Neutrinos',      emoji: '⚛️ ', extra: 'and a neutrino' },
  { label: 'Dark Matter',    emoji: '🌑', extra: 'and a "dark matter"' }
];

// ── Public tab — 1-indexed column positions ──────────────────
var COL_TIMESTAMP  = 1; // A — submission timestamp
var COL_NAME       = 2; // B — submitter's name
var COL_ARXIV      = 3; // C — arXiv ID as submitted (may be URL or bare ID)
var COL_APPROVED   = 5; // E — "TRUE" when approved
var COL_REMOVED    = 6; // F — "TRUE" when removed by a visitor
var COL_EDITED     = 7; // G — edited comment text (empty = use original)
var COL_VOTES      = 8; // H — running vote count
var COL_DISCUSSED  = 9; // I — "TRUE" when starred as discussed at the meeting

// ── Trending tab — 1-indexed column positions ────────────────
var TCOL_CATEGORY         = 1; // A
var TCOL_RANK             = 2; // B
var TCOL_ARXIV_ID         = 3; // C
var TCOL_TITLE            = 4; // D
var TCOL_ABSTRACT         = 5; // E
var TCOL_AUTHORS          = 6; // F
var TCOL_AFFILIATION      = 7; // G
var TCOL_CITATIONS        = 8; // H
var TCOL_CITATIONS_NOSELF = 9; // I

// ============================================================
// END OF CONFIGURATION
// ============================================================


// ── Member approval on form submit ───────────────────────────

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
// DEPLOY as a web app:
//   Deploy → New deployment → Type: Web app
//   Execute as: Me
//   Who has access: Anyone
// Copy the /exec URL into config.js as mutateUrl.
//
// SHEET SETUP — add these columns to the right of column E
// on the Public tab:
//   F  Removed        (leave blank; Apps Script writes "TRUE" here)
//   G  EditedComment  (leave blank; Apps Script writes the new comment)
//   H  Votes          (set to 0 for existing rows; Apps Script increments)
//   I  Discussed      (leave blank; Apps Script writes "TRUE" here)
// ============================================================

function doPost(e) {
  var result = ContentService
    .createTextOutput()
    .setMimeType(ContentService.MimeType.JSON);

  try {
    var data    = JSON.parse(e.postData.contents);
    var action  = data.action;
    var comment = (data.comment || '').toString();

    if (!action) throw new Error('Missing action');

    // ── Trigger a trending refresh (no arxivId needed) ────────
    if (action === 'triggerTrendingRefresh') {
      refreshTrendingPapers();
      result.setContent(JSON.stringify({ ok: true }));
      return result;
    }

    // All other actions require an arxivId
    var arxivId = (data.arxivId || '').toString().trim();
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
  weekEnd.setDate(weekEnd.getDate() + 7);

  var lastRow = sheet.getLastRow();
  for (var i = 2; i <= lastRow; i++) {
    var rawId    = sheet.getRange(i, COL_ARXIV).getValue().toString().trim();
    var approved = sheet.getRange(i, COL_APPROVED).getValue().toString().trim().toUpperCase();
    var removed  = sheet.getRange(i, COL_REMOVED).getValue().toString().trim().toUpperCase();

    if (approved !== 'TRUE' || removed === 'TRUE') continue;
    if (_normalizeId(rawId) !== cleanId) continue;

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
  var d    = new Date(date);
  var day  = d.getDay(); // 0=Sun … 6=Sat
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
// TRIGGER:
//   Apps Script → Triggers → Add trigger
//     Function:   weeklySlackReminder
//     Event:      Time-driven → Week timer → Thursday → 1pm–2pm
// ============================================================

function weeklySlackReminder() {
  var ss          = SpreadsheetApp.getActiveSpreadsheet();
  var publicSheet = ss.getSheetByName(SHEET_NAME);
  if (!publicSheet) {
    Logger.log('Sheet "' + SHEET_NAME + '" not found — aborting reminder.');
    return;
  }

  var now       = new Date();
  var weekStart = _thisWeekMonday(now);
  var weekEnd   = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  var lastRow    = publicSheet.getLastRow();
  var submitters = [];
  var topPaper   = null;

  if (lastRow >= 2) {
    var data = publicSheet.getRange(2, 1, lastRow - 1, COL_VOTES).getValues();

    data.forEach(function (row) {
      var tsVal    = row[COL_TIMESTAMP - 1];
      var name     = (row[COL_NAME - 1] || '').toString().trim();
      var arxivId  = _normalizeId((row[COL_ARXIV - 1] || '').toString());
      var approved = (row[COL_APPROVED - 1] || '').toString().trim().toUpperCase();
      var removed  = (row[COL_REMOVED - 1] || '').toString().trim().toUpperCase();
      var votes    = Number(row[COL_VOTES - 1]) || 0;

      if (approved !== 'TRUE' || removed === 'TRUE') return;

      var ts = tsVal instanceof Date ? tsVal : new Date(tsVal);
      if (isNaN(ts) || ts < weekStart || ts >= weekEnd) return;

      if (name && !submitters.includes(name)) submitters.push(name);

      if (!topPaper || votes > topPaper.votes) {
        topPaper = { arxivId: arxivId, votes: votes, name: name };
      }
    });
  }

  // Read trending papers from the cached Trending tab (no live API calls needed)
  var trending = _readTrendingFromSheet();

  _postToSlack(_buildMessage(submitters, topPaper, trending));
}

// ── Read trending from sheet ──────────────────────────────────

/**
 * Reads the Trending tab and returns an array parallel to INSPIRE_CATEGORIES,
 * each element being an array of up to INSPIRE_RESULTS_PER_CATEGORY objects:
 *   { rank, arxivId, title, authors, affiliation, citations, citationsNoSelf }
 * Returns an empty array per category if the tab is missing or empty.
 */
function _readTrendingFromSheet() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var trendingSheet = ss.getSheetByName(TRENDING_SHEET_NAME);
  var result        = INSPIRE_CATEGORIES.map(function () { return []; });

  if (!trendingSheet || trendingSheet.getLastRow() < 2) return result;

  var lastRow = trendingSheet.getLastRow();
  var data    = trendingSheet.getRange(2, 1, lastRow - 1, TCOL_CITATIONS_NOSELF).getValues();

  data.forEach(function (row) {
    var categoryLabel = (row[TCOL_CATEGORY - 1] || '').toString().trim();
    var idx = INSPIRE_CATEGORIES.findIndex(function (c) { return c.label === categoryLabel; });
    if (idx === -1) return;

    result[idx].push({
      rank:            Number(row[TCOL_RANK - 1]) || 0,
      arxivId:         (row[TCOL_ARXIV_ID - 1] || '').toString().trim(),
      title:           (row[TCOL_TITLE - 1] || '').toString().trim(),
      authors:         (row[TCOL_AUTHORS - 1] || '').toString().trim(),
      affiliation:     (row[TCOL_AFFILIATION - 1] || '').toString().trim(),
      citations:       Number(row[TCOL_CITATIONS - 1]) || 0,
      citationsNoSelf: Number(row[TCOL_CITATIONS_NOSELF - 1]) || 0
    });
  });

  // Sort each category by rank ascending
  result.forEach(function (papers) {
    papers.sort(function (a, b) { return a.rank - b.rank; });
  });

  return result;
}

// ── Message builder ───────────────────────────────────────────

function _buildMessage(submitters, topPaper, trending) {
  var lines = [];

  lines.push('*📄 Journal Club — weekly paper reminder* (meeting ' + MEETING_DAY + ' at ' + MEETING_TIME + '!)');
  lines.push('');

  if (submitters.length === 0) {
    lines.push('No papers submitted yet this week — be the first! 🚀');
  } else if (submitters.length === 1) {
    lines.push('Thank you *' + submitters[0] + '* for submitting! 🎉');
  } else {
    var last = submitters[submitters.length - 1];
    var rest = submitters.slice(0, -1);
    lines.push('Thank you *' + rest.join(', ') + '*, and *' + last + '* for submitting! 🎉');
  }

  lines.push('');

  if (topPaper && topPaper.arxivId) {
    var arxivUrl = 'https://arxiv.org/abs/' + topPaper.arxivId;
    if (topPaper.votes > 0) {
      lines.push(
        '🏆 *Top paper this week:* <' + arxivUrl + '|' + topPaper.arxivId + '>' +
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

  if (submitters.length < 3) {
    lines.push('👀 Haven\'t submitted yet? There\'s still time — browse arXiv and share something interesting!');
  } else {
    lines.push('💡 Haven\'t submitted yet? You can still add a paper before the meeting.');
  }
  lines.push('➡️  Submit here: ' + SITE_URL);

  // Trending section — show only the top paper (rank 1) per category in Slack;
  // link to the site for the full list of 3 per category.
  var hasTrending = trending && trending.some(function (papers) { return papers.length > 0; });
  if (hasTrending) {
    lines.push('');
    lines.push('─────────────────────────────────');
    lines.push('*📡 Trending in hep-ph — past ' + INSPIRE_LOOKBACK_WEEKS + ' weeks* (full list on the site ↗)');
    lines.push('_Ranked by citation count, excl. self-citations (via INSPIRE-HEP)_');
    lines.push('');

    INSPIRE_CATEGORIES.forEach(function (cat, i) {
      var papers = trending[i];
      lines.push(cat.emoji + ' *' + cat.label + '*');

      if (!papers || papers.length === 0) {
        lines.push('  _No data available._');
      } else {
        var top = papers[0]; // rank 1 only in the Slack message
        var link = top.arxivId
          ? '<https://arxiv.org/abs/' + top.arxivId + '|' + top.arxivId + '>'
          : '_(no arXiv ID)_';
        lines.push(
          '  ' + link +
          ' — *' + top.citationsNoSelf + '* citations excl. self / ' + top.citations + ' total'
        );
        if (top.title)       lines.push('  _' + top.title + '_');
        if (top.authors)     lines.push('  ' + top.authors + (top.affiliation ? ' · ' + top.affiliation : ''));
      }
      lines.push('');
    });
  }

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


// ============================================================
// Trending Papers Refresh — Monday & Wednesday 7 AM
// ============================================================
// TRIGGER (set up two triggers, one for each day):
//   Apps Script → Triggers → Add trigger
//     Function:   refreshTrendingPapers
//     Event:      Time-driven → Week timer → Monday    → 7am–8am
//     ---
//     Function:   refreshTrendingPapers
//     Event:      Time-driven → Week timer → Wednesday → 7am–8am
//
// SHEET SETUP — add a tab named "Trending" with this header row:
//   A          B     C        D      E         F        G            H         I
//   Category   Rank  ArxivId  Title  Abstract  Authors  Affiliation  Citations CitationsNoSelf
// ============================================================

function refreshTrendingPapers() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var trendingSheet = ss.getSheetByName(TRENDING_SHEET_NAME);

  if (!trendingSheet) {
    Logger.log('Trending sheet "' + TRENDING_SHEET_NAME + '" not found — skipping refresh.');
    return;
  }

  // Clear all data rows, keeping the header
  var lastRow = trendingSheet.getLastRow();
  if (lastRow > 1) {
    trendingSheet.getRange(2, 1, lastRow - 1, trendingSheet.getLastColumn()).clearContent();
  }

  var cutoff  = new Date();
  cutoff.setDate(cutoff.getDate() - (INSPIRE_LOOKBACK_WEEKS * 7));
  var dateStr = Utilities.formatDate(cutoff, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var newRows = [];

  INSPIRE_CATEGORIES.forEach(function (cat, catIndex) {
    if (catIndex > 0) Utilities.sleep(1000); // stay within INSPIRE rate limits

    try {
      var query = 'arxiv_categories hep-ph and date > ' + dateStr;
      if (cat.extra) query += ' ' + cat.extra;

      var url = 'https://inspirehep.net/api/literature'
        + '?sort=mostcited'
        + '&size=' + INSPIRE_RESULTS_PER_CATEGORY
        + '&fields=arxiv_eprints,titles,abstracts,authors,collaborations,citation_count,citation_count_without_self_citations'
        + '&q=' + encodeURIComponent(query);

      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      var code     = response.getResponseCode();

      if (code === 429) {
        Logger.log('INSPIRE rate limit hit for "' + cat.label + '" — waiting 6s and retrying.');
        Utilities.sleep(6000);
        response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
        code     = response.getResponseCode();
      }

      if (code !== 200) {
        Logger.log('INSPIRE returned HTTP ' + code + ' for "' + cat.label + '"');
        return;
      }

      var json = JSON.parse(response.getContentText());
      if (!json.hits || !json.hits.hits || json.hits.hits.length === 0) {
        Logger.log('No INSPIRE results for "' + cat.label + '"');
        return;
      }

      json.hits.hits.forEach(function (hit, rank) {
        var meta = hit.metadata;

        // ── arXiv ID ──────────────────────────────────────
        var arxivId = '';
        if (meta.arxiv_eprints && meta.arxiv_eprints.length > 0) {
          arxivId = (meta.arxiv_eprints[0].value || '').toString().trim();
        }

        // ── Title ─────────────────────────────────────────
        var title = '';
        if (meta.titles && meta.titles.length > 0) {
          title = (meta.titles[0].title || '').toString().trim();
        }

        // ── Abstract ──────────────────────────────────────
        var abstract = '';
        if (meta.abstracts && meta.abstracts.length > 0) {
          abstract = (meta.abstracts[0].value || '').toString().trim();
          if (abstract.length > ABSTRACT_MAX_CHARS) {
            abstract = abstract.substring(0, ABSTRACT_MAX_CHARS - 1) + '\u2026';
          }
        }

        // ── Authors & affiliation ──────────────────────────
        var authors     = '';
        var affiliation = '';

        // Prefer collaboration name if present
        if (meta.collaborations && meta.collaborations.length > 0) {
          authors     = (meta.collaborations[0].value || '').toString().trim() + ' Collaboration';
          affiliation = '';
        } else if (meta.authors && meta.authors.length > 0) {
          var authorList = meta.authors;
          var names = authorList.map(function (a) {
            return (a.full_name || '').toString().trim();
          }).filter(Boolean);

          authors = (names.length <= 10) ? names.join(', ') : names[0] + ' et al.';

          // Affiliation from the first author
          var firstAuthor = authorList[0];
          if (firstAuthor.affiliations && firstAuthor.affiliations.length > 0) {
            affiliation = (firstAuthor.affiliations[0].value || '').toString().trim();
          }
        }

        newRows.push([
          cat.label,                                               // A Category
          rank + 1,                                                // B Rank
          arxivId,                                                 // C ArxivId
          title,                                                   // D Title
          abstract,                                                // E Abstract
          authors,                                                 // F Authors
          affiliation,                                             // G Affiliation
          Number(meta.citation_count) || 0,                       // H Citations
          Number(meta.citation_count_without_self_citations) || 0 // I CitationsNoSelf
        ]);
      });

    } catch (err) {
      Logger.log('Error fetching INSPIRE for "' + cat.label + '": ' + err.message);
    }
  });

  if (newRows.length > 0) {
    trendingSheet.getRange(2, 1, newRows.length, newRows[0].length).setValues(newRows);
    Logger.log('Trending tab updated: ' + newRows.length + ' rows written.');
  } else {
    Logger.log('No trending rows to write — INSPIRE may be unavailable.');
  }
}
