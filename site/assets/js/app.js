/* ============================================================
   app.js — Page renderers and entry point
   ============================================================
   Loads submissions from Google Sheets, fetches paper metadata
   from INSPIRE-HEP, and renders the This Week / Archive pages.

   This Week polls for new submissions every POLL_INTERVAL ms.
   Archive groups by week and lazy-loads metadata on first open.
   Duplicate arXiv submissions are silently suppressed.
   ============================================================ */

import { CONFIG, COL } from './config.js';
import {
  parseCsv,
  weekStart,
  currentWeekStart,
  fmtWeekRange,
  normalizeArxivId,
  stripVersion,
} from './utils.js';
import { fetchPaperMetadata } from './inspire.js';
import { buildTable } from './table.js';

/** Re-fetch interval for the This Week page (ms). */
const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes

// ── Subfield filter state ─────────────────────────────────────

/** Currently active category chip, or null for ‘All’. */
let _activeCategory = null;

/** Union of all categories discovered from loaded weeks. */
const _knownCategories = new Set();

// ── Helpers ───────────────────────────────────────────────────

/** Fetch and parse all paper rows from the Google Sheet CSV. */
async function fetchPapers() {
  const res = await fetch(CONFIG.sheetCsvUrl, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const rows = parseCsv(text);
  return rows
    .slice(1)
    .filter((r) => r.length > COL.timestamp && r[COL.timestamp])
    .filter((r) => (r[COL.approved] ?? '').trim().toUpperCase() === 'TRUE');
}

/**
 * Suppress duplicate arXiv IDs, keeping the earliest submission.
 * Rows with no recognisable arXiv ID are kept as-is.
 */
export function deduplicatePapers(papers) {
  const seen = new Map();
  papers.forEach((p) => {
    const id = stripVersion(normalizeArxivId(p[COL.arxivId]));
    if (!id || seen.has(id)) return;
    seen.set(id, p);
  });
  return [...seen.values()];
}

// ── This Week ─────────────────────────────────────────────────

let _lastThisWeekCount = -1; // used to skip re-renders when nothing changed

async function renderThisWeek(papers, container, { force = false } = {}) {
  const monday = currentWeekStart();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const label = document.getElementById('week-label');
  if (label) label.textContent = fmtWeekRange(monday);

  const thisWeek = deduplicatePapers(papers).filter((p) => {
    const ts = new Date(p[COL.timestamp]);
    return !isNaN(ts) && ts >= monday && ts <= sunday;
  });

  // Skip expensive re-render when paper count hasn't changed (poll path)
  if (!force && thisWeek.length === _lastThisWeekCount) return;
  _lastThisWeekCount = thisWeek.length;

  container.innerHTML = '';

  if (thisWeek.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📭</p>
        <p>No papers submitted yet this week.</p>
        <p style="margin-top:.5rem;font-size:.85rem;">Be the first — submit one using the button below!</p>
      </div>`;
  } else {
    container.innerHTML = `<div class="loading">Fetching paper details from INSPIRE-HEP…</div>`;
    const metaMap = await fetchPaperMetadata(thisWeek.map((p) => p[COL.arxivId]));
    container.innerHTML = '';
    container.appendChild(buildTable(thisWeek, metaMap));
  }

  const cta = document.getElementById('submit-cta');
  if (cta) cta.style.display = '';
}

// ── Archive ───────────────────────────────────────────────────

async function renderArchive(papers, container) {
  const monday = currentWeekStart();
  const past = deduplicatePapers(
    papers.filter((p) => {
      const ts = new Date(p[COL.timestamp]);
      return !isNaN(ts) && ts < monday;
    })
  );

  container.innerHTML = '';

  if (past.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>🗓️</p><p>No past submissions yet.</p></div>`;
    return;
  }

  // Group by week
  const weeks = new Map();
  past.forEach((p) => {
    const key = weekStart(new Date(p[COL.timestamp])).toISOString();
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(p);
  });

  const sortedKeys = [...weeks.keys()].sort((a, b) => new Date(b) - new Date(a));

  sortedKeys.forEach((key, idx) => {
    const weekPapers = weeks.get(key);
    const mon = new Date(key);

    const details = document.createElement('details');
    details.className = 'archive-week';

    const summary = document.createElement('summary');
    summary.innerHTML = `
      ${fmtWeekRange(mon)}
      <span class="week-count">${weekPapers.length} paper${weekPapers.length !== 1 ? 's' : ''}</span>
    `;
    details.appendChild(summary);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'archive-week-content';
    details.appendChild(contentDiv);

    const loadWeek = () => {
      contentDiv.innerHTML = `<div class="loading">Fetching paper details from INSPIRE-HEP…</div>`;
      fetchPaperMetadata(weekPapers.map((p) => p[COL.arxivId])).then((metaMap) => {
        contentDiv.innerHTML = '';
        const table = buildTable(weekPapers, metaMap);
        // Register any new subfield categories and re-render filter bar
        _registerCategories(metaMap);
        // Apply active text + category filters immediately on load
        const searchInput = document.getElementById('archive-search');
        const query = (searchInput?.value ?? '').trim().toLowerCase();
        const visible = _filterTable(table, query);
        if ((query || _activeCategory) && visible === 0) details.style.display = 'none';
        contentDiv.appendChild(table);
      });
    };

    if (idx === 0) {
      // Eagerly load the most-recent past week and open it by default
      details.open = true;
      loadWeek();
    } else {
      // Lazy-load on first open
      let loaded = false;
      details.addEventListener('toggle', () => {
        if (details.open && !loaded) {
          loaded = true;
          loadWeek();
        }
      });
    }

    container.appendChild(details);
  });
}

// ── Archive search ────────────────────────────────────────────

/**
 * Hides/shows <tr> rows in a table based on a lower-cased query
 * and the active subfield category.
 * Returns the count of visible rows.
 */
function _filterTable(table, query) {
  let visible = 0;
  table.querySelectorAll('tbody tr').forEach((tr) => {
    const textMatch = !query || tr.textContent.toLowerCase().includes(query);
    const catMatch =
      !_activeCategory || (tr.dataset.categories || '').split(',').includes(_activeCategory);
    const match = textMatch && catMatch;
    tr.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  return visible;
}

/**
 * Wires up the #archive-search input to live-filter all rendered tables.
 * Tables that haven't been lazy-loaded yet are filtered when they load
 * (handled inside renderArchive's loadWeek closure above).
 */
function initArchiveSearch() {
  const input = document.getElementById('archive-search');
  if (!input) return;
  input.addEventListener('input', _applyAllFilters);
}

/**
 * Re-applies both the text search and the active category filter
 * to every currently loaded archive table.
 */
function _applyAllFilters() {
  const searchInput = document.getElementById('archive-search');
  const query = (searchInput?.value ?? '').trim().toLowerCase();
  document.querySelectorAll('.archive-week').forEach((details) => {
    const table = details.querySelector('table');
    if (!table) return; // not yet loaded — filtered on load
    const visible = _filterTable(table, query);
    details.style.display = (query || _activeCategory) && visible === 0 ? 'none' : '';
  });
}

/**
 * Adds newly discovered categories from a metaMap to _knownCategories
 * and re-renders the subfield filter bar when new ones are found.
 */
function _registerCategories(metaMap) {
  let added = false;
  metaMap.forEach((meta) => {
    (meta.categories ?? []).forEach((cat) => {
      if (!_knownCategories.has(cat)) {
        _knownCategories.add(cat);
        added = true;
      }
    });
  });
  if (added) _renderSubfieldBar();
}

/** Renders the subfield filter chip bar from _knownCategories. */
function _renderSubfieldBar() {
  const bar = document.getElementById('subfield-filter-bar');
  if (!bar || _knownCategories.size === 0) return;
  bar.innerHTML = '';

  const makeChip = (label, isActive, onClick) => {
    const btn = document.createElement('button');
    btn.className = 'sf-btn' + (isActive ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  };

  bar.appendChild(
    makeChip('All subfields', _activeCategory === null, () => {
      _activeCategory = null;
      _applyAllFilters();
      _renderSubfieldBar();
    })
  );

  [..._knownCategories].sort().forEach((cat) =>
    bar.appendChild(
      makeChip(cat, _activeCategory === cat, () => {
        _activeCategory = cat;
        _applyAllFilters();
        _renderSubfieldBar();
      })
    )
  );
}

// ── Calendar export ───────────────────────────────────────────

/**
 * Generates and downloads a recurring .ics calendar file for the
 * weekly Friday journal-club meeting (2:30 PM CT, America/Chicago).
 */
function _downloadCalendar() {
  // Use a known Friday as the recurrence anchor (March 6, 2026)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//jc-ppi//Iowa Particles & Plots JC//EN',
    'BEGIN:VEVENT',
    'DTSTART;TZID=America/Chicago:20260306T143000',
    'DTEND;TZID=America/Chicago:20260306T160000',
    'RRULE:FREQ=WEEKLY;BYDAY=FR',
    'SUMMARY:Iowa Particles & Plots Journal Club',
    'DESCRIPTION:Weekly HEP paper discussion.\\nSubmit papers at https://meighenbergers.github.io/jc-ppi/\\nUpdates in the group Slack channel.',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Journal club in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'jc-ppi-meetings.ics';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Entry point ───────────────────────────────────────────────

async function init() {
  // Wire up the Google Form link wherever it appears on the page
  document.querySelectorAll('#submit-link, #submit-cta-link').forEach((el) => {
    if (CONFIG.formUrl && CONFIG.formUrl !== 'PASTE_YOUR_GOOGLE_FORM_URL_HERE') {
      el.href = CONFIG.formUrl;
    } else {
      el.textContent = 'Submit a Paper (not configured yet)';
      el.removeAttribute('href');
    }
  });

  const container = document.getElementById('papers-container');

  if (!CONFIG.sheetCsvUrl || CONFIG.sheetCsvUrl === 'PASTE_YOUR_SHEET_CSV_URL_HERE') {
    container.innerHTML = `<div class="error">
      ⚠️ <strong>Not configured yet.</strong>
      Open <code>site/assets/js/config.js</code> and fill in
      <code>sheetCsvUrl</code> and <code>formUrl</code>.
      See the README for instructions.
    </div>`;
    return;
  }

  const page = window.location.pathname.includes('archive') ? 'archive' : 'index';

  try {
    const papers = await fetchPapers();

    if (page === 'index') {
      await renderThisWeek(papers, container, { force: true });

      // Wire up calendar export button
      document.getElementById('cal-export')?.addEventListener('click', _downloadCalendar);

      // Poll for new This Week submissions every POLL_INTERVAL ms
      setInterval(async () => {
        try {
          const fresh = await fetchPapers();
          await renderThisWeek(fresh, container);
        } catch (e) {
          console.warn('Poll failed:', e);
        }
      }, POLL_INTERVAL);
    }

    if (page === 'archive') {
      await renderArchive(papers, container);
      initArchiveSearch();
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error">
      ⚠️ Could not load papers. Make sure the Google Sheet is published as CSV
      and the URL in <code>config.js</code> is correct.<br>
      <small>${err.message}</small>
    </div>`;
  }
}

if (typeof window !== 'undefined') init();
