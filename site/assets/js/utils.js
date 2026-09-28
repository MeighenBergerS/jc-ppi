/* ============================================================
   utils.js — Week utilities, CSV parser, arXiv ID helpers, meeting text
   ============================================================ */

// ── WEEK UTILITIES ──────────────────────────────────────────

/**
 * Returns the Monday 00:00:00 of the week containing `date`.
 * Weeks run Monday–Sunday.
 */
export function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns the Monday of the current week. */
export function currentWeekStart() {
  return weekStart(new Date());
}

/**
 * Formats a week range string, e.g. "Feb 24 – Mar 2, 2026".
 * @param {Date} monday - The Monday of the week.
 */
export function fmtWeekRange(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts = { month: 'short', day: 'numeric' };
  return `${monday.toLocaleDateString('en-US', opts)} – ${sunday.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
}

// ── CSV PARSER ───────────────────────────────────────────────

/**
 * Minimal RFC-4180-compliant CSV parser.
 * Returns an array of row arrays (all values are strings).
 * @param {string} text - Raw CSV text.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [],
    field = '',
    inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } // escaped quote
      else if (ch === '"') {
        inQuotes = false;
      } // closing quote
      else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else if (ch === '\r') {
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  // Flush trailing field/row
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// ── ARXIV ID HELPERS ─────────────────────────────────────────

/**
 * Returns true if `id` is a syntactically valid arXiv ID.
 * Accepts:
 *   - Modern format: YYMM.NNNN or YYMM.NNNNN (exactly 4-digit prefix)
 *   - Old format:    category/YYMMNNN  e.g. hep-ph/9901123
 * The id must already be normalised (no URL prefix, no version suffix).
 */
export function isValidArxivId(id) {
  if (!id) return false;
  // Modern: exactly 4 digits, dot, 4 or 5 digits
  if (/^\d{4}\.\d{4,5}$/.test(id)) return true;
  // Old-style: at least one letter category prefix, slash, 7 digits
  if (/^[a-z][a-z\-]+\/\d{7}$/i.test(id)) return true;
  return false;
}

/**
 * Extracts a bare arXiv ID from a URL, short ID, or free-form string.
 * e.g. "https://arxiv.org/abs/2301.12345v2" → "2301.12345v2"
 */
export function normalizeArxivId(raw) {
  const trimmed = (raw || '').trim();
  const match = trimmed.match(/(\d{4}\.\d{4,5}(v\d+)?|[a-z\-]+\/\d{7})/i);
  return match ? match[0] : trimmed;
}

/**
 * Strips the version suffix from an arXiv ID.
 * e.g. "2301.12345v2" → "2301.12345"
 */
export function stripVersion(id) {
  return (id || '').replace(/v\d+$/i, '');
}

/**
 * Returns an <a> element linking to the arXiv abstract page.
 * @param {string} raw - Raw user-submitted arXiv ID or URL.
 */
export function arxivLink(raw) {
  const id = normalizeArxivId(raw);
  if (!id) return document.createTextNode('—');
  const a = document.createElement('a');
  a.href = `https://arxiv.org/abs/${id}`;
  a.textContent = id;
  a.className = 'arxiv-link';
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

// ── MEETING ─────────────────────────────────────────────────
// Text and calendar data derived from CONFIG (config.js), passed in so
// this file stays free of imports.

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Index of an English weekday name, Monday = 0; throws on an unknown name. */
export function weekdayIndex(day) {
  const i = WEEKDAYS.indexOf(day);
  if (i === -1) throw new Error(`Unknown weekday "${day}"`);
  return i;
}

/** '15:30' → '3:30 PM'. */
export function clockTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** The meeting's start time for display, e.g. '3:30 PM CT'. */
export function meetingTime(config) {
  return `${clockTime(config.meeting.start)} ${config.timezoneAbbr}`;
}

/**
 * A recurring weekly .ics calendar for the meeting.
 * @param {object} config   CONFIG
 * @param {string} siteUrl  Linked in the event description.
 */
export function meetingIcs(config, siteUrl) {
  const { meeting, timezone, clubName } = config;
  // Any week works as the first occurrence; this one starts Monday 2026-03-02.
  const date = `202603${String(2 + weekdayIndex(meeting.day)).padStart(2, '0')}`;
  const stamp = (hhmm) => `${date}T${hhmm.replace(':', '')}00`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//jc-ppi//${clubName}//EN`,
    'BEGIN:VEVENT',
    `DTSTART;TZID=${timezone}:${stamp(meeting.start)}`,
    `DTEND;TZID=${timezone}:${stamp(meeting.end)}`,
    `RRULE:FREQ=WEEKLY;BYDAY=${meeting.day.slice(0, 2).toUpperCase()}`,
    `SUMMARY:${clubName}`,
    `DESCRIPTION:Weekly HEP paper discussion.\\nSubmit papers at ${siteUrl}\\nUpdates in the group Slack channel.`,
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Journal club in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
