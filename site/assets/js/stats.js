/* ============================================================
   stats.js — Statistics page entry point
   ============================================================
   Builds three charts for the current calendar year:
     1. Papers submitted per member        (teal gradient bars)
     2. Subfield distribution              (fixed 10-color palette)
     3. Top keywords                       (purple gradient bars)

   CSV data is fetched fresh; INSPIRE metadata is re-used from
   the sessionStorage cache populated by the other pages.
   ============================================================ */

import { CONFIG, COL, TITLE_STOP_WORDS } from './config.js';
import { parseCsv, weekStart, fmtWeekRange, normalizeArxivId, stripVersion } from './utils.js';
import { fetchPaperMetadata } from './inspire.js';

const DEFAULT_YEAR = new Date().getFullYear();

// ── Category color palette ────────────────────────────────────
// ColorBrewer Dark2 (8) + steel blue + deep red.
// Categories are sorted alphabetically then assigned in order,
// so the same subfield always gets the same color.

const CAT_PALETTE = [
  '#1b9e77', // teal
  '#d95f02', // orange
  '#7570b3', // purple
  '#e7298a', // pink
  '#66a61e', // lime
  '#e6ab02', // amber
  '#a6761d', // brown
  '#666666', // grey
  '#2166ac', // steel blue  (added)
  '#b2182b', // deep red    (added)
];

function _catColor(name, sortedNames) {
  const idx = sortedNames.indexOf(name);
  return CAT_PALETTE[Math.max(0, idx) % CAT_PALETTE.length];
}

// ── Accent RGB values for gradient bars ───────────────────────
// Teal (#1b9e77) for members, purple (#7570b3) for keywords.
// Bars blend from the full accent colour down to a pale tint.

function _gradientColor(r, g, b, rank, total) {
  const t = total > 1 ? rank / (total - 1) : 0; // 0 = top, 1 = bottom
  const opacity = 1 - t * 0.58;
  const ri = Math.round(r + (255 - r) * (1 - opacity));
  const gi = Math.round(g + (255 - g) * (1 - opacity));
  const bi = Math.round(b + (255 - b) * (1 - opacity));
  return `rgb(${ri},${gi},${bi})`;
}

// ── Chart builder ─────────────────────────────────────────────

/**
 * Builds a labelled horizontal bar-chart <section>.
 *
 * @param {string} title
 * @param {Array<{label:string, value:number, color:string}>} rows  sorted desc
 * @param {string} [emptyMsg]
 */
function _buildChart(title, rows, emptyMsg = 'No data yet.', { formatValue } = {}) {
  const section = document.createElement('section');
  section.className = 'stat-section';

  const h3 = document.createElement('h3');
  h3.textContent = title;
  section.appendChild(h3);

  if (!rows.length) {
    const p = document.createElement('p');
    p.className = 'stat-empty';
    p.textContent = emptyMsg;
    section.appendChild(p);
    return section;
  }

  const max = rows[0].value;
  const chart = document.createElement('div');
  chart.className = 'bar-chart';

  rows.forEach(({ label, value, color }) => {
    const pct = max > 0 ? (value / max) * 100 : 0;
    const row = document.createElement('div');
    row.className = 'bar-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'bar-label';
    labelEl.textContent = label;
    labelEl.title = label;

    const track = document.createElement('div');
    track.className = 'bar-track';

    const fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.cssText = `width:${pct.toFixed(2)}%;background:${color}`;
    track.appendChild(fill);

    const valueEl = document.createElement('span');
    valueEl.className = 'bar-value';
    valueEl.textContent = formatValue ? formatValue(value) : value;

    row.appendChild(labelEl);
    row.appendChild(track);
    row.appendChild(valueEl);
    chart.appendChild(row);
  });

  section.appendChild(chart);
  return section;
}

// ── Summary KPI strip ─────────────────────────────────────────

function _buildSummary({ total, members, weeksActive, busiestWeek, topCat, year }) {
  const strip = document.createElement('div');
  strip.className = 'stat-summary';

  const kpis = [
    { value: total, label: `papers in ${year ?? ''}` },
    { value: members, label: `active member${members !== 1 ? 's' : ''}` },
    { value: weeksActive, label: `weeks active` },
    { value: busiestWeek, label: 'busiest week', small: true },
    { value: topCat || '—', label: 'top subfield', small: true },
  ];

  kpis.forEach(({ value, label, small }) => {
    const kpi = document.createElement('div');
    kpi.className = 'stat-kpi';

    const v = document.createElement('span');
    v.className = `stat-kpi-value${small ? ' stat-kpi-value--sm' : ''}`;
    v.textContent = value;

    const l = document.createElement('span');
    l.className = 'stat-kpi-label';
    l.textContent = label;

    kpi.appendChild(v);
    kpi.appendChild(l);
    strip.appendChild(kpi);
  });

  return strip;
}

// ── Pure aggregation (exported for testing) ──────────────────

/**
 * Computes submission statistics for a given calendar year from raw CSV rows.
 * Pure function — no DOM, no network.
 *
 * @param {number} year
 * @param {string[][]} allRows - All CSV rows (already sliced past header).
 * @returns {{ papers, memberCounts, weekCounts, busiestKey }}
 */
export function computeSubmissionStats(year, allRows) {
  const yearRows = allRows.filter((p) => {
    const ts = new Date(p[COL.timestamp]);
    return !isNaN(ts) && ts.getFullYear() === year;
  });

  const seen = new Map();
  yearRows.forEach((p) => {
    const id = stripVersion(normalizeArxivId(p[COL.arxivId]));
    if (!id || seen.has(id)) return;
    seen.set(id, p);
  });
  const papers = [...seen.values()];

  const memberCounts = new Map();
  papers.forEach((p) => {
    const name = (p[COL.name] || '').trim() || 'Anonymous';
    memberCounts.set(name, (memberCounts.get(name) ?? 0) + 1);
  });

  const weekCounts = new Map();
  papers.forEach((p) => {
    const key = weekStart(new Date(p[COL.timestamp])).toISOString();
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
  });

  let busiestKey = null,
    busiestN = 0;
  weekCounts.forEach((n, k) => {
    if (n > busiestN) {
      busiestN = n;
      busiestKey = k;
    }
  });

  const discussedCounts = new Map();
  papers.forEach((p) => {
    if ((p[COL.discussed] ?? '').trim().toUpperCase() !== 'TRUE') return;
    const name = (p[COL.name] || '').trim() || 'Anonymous';
    discussedCounts.set(name, (discussedCounts.get(name) ?? 0) + 1);
  });

  return { papers, memberCounts, weekCounts, busiestKey, discussedCounts };
}

// ── Stats renderer ────────────────────────────────────────────

/**
 * Renders all stat charts for a given year using pre-fetched rows.
 * Clears and repopulates #stats-container on each call.
 */
async function renderStats(year, allRows) {
  const container = document.getElementById('stats-container');
  const subtitle = document.getElementById('stats-subtitle');

  const { papers, memberCounts, weekCounts, busiestKey, discussedCounts } = computeSubmissionStats(
    year,
    allRows
  );
  const busiestWeekLabel = busiestKey ? fmtWeekRange(new Date(busiestKey)) : '—';

  const isCurrentYear = year === new Date().getFullYear();
  if (subtitle)
    subtitle.textContent = `${year}${isCurrentYear ? ' year-to-date' : ''} · ${papers.length} paper${papers.length !== 1 ? 's' : ''}`;

  // Render member bars (no API call needed)
  container.innerHTML = '';

  const memberRows = [...memberCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value], i, arr) => ({
      label,
      value,
      color: _gradientColor(27, 158, 119, i, arr.length), // teal
    }));

  // Render summary with placeholder top-cat (filled in after INSPIRE)
  const summaryEl = _buildSummary({
    total: papers.length,
    members: memberCounts.size,
    weeksActive: weekCounts.size,
    busiestWeek: busiestWeekLabel,
    topCat: null,
    year,
  });
  container.appendChild(summaryEl);
  container.appendChild(_buildChart(`Papers submitted in ${year} by member`, memberRows));

  // Discussed-at-JC chart (CSV data only — no INSPIRE call needed)
  if (discussedCounts.size > 0) {
    const discussedRows = [...discussedCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i, arr) => ({
        label,
        value,
        color: _gradientColor(230, 171, 2, i, arr.length), // amber
      }));
    container.appendChild(
      _buildChart(
        `Discussed at JC in ${year} by member`,
        discussedRows,
        'No papers starred as discussed yet.',
        {
          formatValue: (v) => '★'.repeat(v) + ` (${v})`,
        }
      )
    );
  }

  if (papers.length === 0) return;

  // Fetch INSPIRE metadata (batched + cached)
  const inspireNote = document.createElement('p');
  inspireNote.className = 'loading';
  inspireNote.textContent = 'Fetching subfield & keyword data from INSPIRE-HEP…';
  container.appendChild(inspireNote);

  const metaMap = await fetchPaperMetadata(papers.map((p) => p[COL.arxivId]));
  inspireNote.remove();

  // Category distribution
  const catCounts = new Map();
  metaMap.forEach((meta) => {
    (meta.categories ?? []).forEach((cat) => {
      catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1);
    });
  });

  const sortedCatNames = [...catCounts.keys()].sort();
  const catRows = [...catCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({
      label,
      value,
      color: _catColor(label, sortedCatNames),
    }));

  // Back-fill top category in summary strip
  if (catRows.length) {
    const topCatEl = summaryEl.querySelector('.stat-kpi:last-child .stat-kpi-value');
    if (topCatEl) topCatEl.textContent = catRows[0].label;
  }

  container.appendChild(
    _buildChart(
      'Subfield distribution',
      catRows,
      'No category data yet — papers may still be indexing on INSPIRE-HEP.'
    )
  );

  // Title word frequency (top 10)
  const wordCounts = new Map();
  metaMap.forEach((meta) => {
    if (!meta.title) return;
    meta.title
      .toLowerCase()
      .replace(/[^a-z0-9\- ]/g, ' ')
      .split(/\s+/)
      .forEach((word) => {
        if (!word || word.length < 2 || TITLE_STOP_WORDS.has(word) || /^\d+$/.test(word)) return;
        wordCounts.set(word, (wordCounts.get(word) ?? 0) + 1);
      });
  });

  const wordRows = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value], i, arr) => ({
      label,
      value,
      color: _gradientColor(117, 112, 179, i, arr.length), // purple
    }));

  container.appendChild(
    _buildChart(
      'Top title words (year to date)',
      wordRows,
      'Not enough papers yet to show word frequencies.'
    )
  );
}

// ── Entry point ───────────────────────────────────────────────

async function init() {
  // Wire up the Google Form link
  document.querySelectorAll('#submit-link').forEach((el) => {
    if (CONFIG.formUrl && CONFIG.formUrl !== 'PASTE_YOUR_GOOGLE_FORM_URL_HERE') {
      el.href = CONFIG.formUrl;
    } else {
      el.textContent = 'Submit a Paper (not configured yet)';
      el.removeAttribute('href');
    }
  });

  const container = document.getElementById('stats-container');

  if (!CONFIG.sheetCsvUrl || CONFIG.sheetCsvUrl === 'PASTE_YOUR_SHEET_CSV_URL_HERE') {
    container.innerHTML = `<div class="error">
      ⚠️ <strong>Not configured yet.</strong>
      Open <code>site/assets/js/config.js</code> and fill in
      <code>sheetCsvUrl</code> and <code>formUrl</code>.
    </div>`;
    return;
  }

  try {
    // ── 1. Fetch + parse the sheet ──────────────────────────
    const res = await fetch(CONFIG.sheetCsvUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const allRows = parseCsv(await res.text())
      .slice(1)
      .filter((r) => r.length > COL.timestamp && r[COL.timestamp])
      .filter((r) => (r[COL.removed] ?? '').trim().toUpperCase() !== 'TRUE');

    // ── 2. Populate year selector ───────────────────────────
    const availableYears = [
      ...new Set(
        allRows.map((r) => new Date(r[COL.timestamp]).getFullYear()).filter((y) => !isNaN(y))
      ),
    ].sort((a, b) => b - a); // newest first

    const yearSelect = document.getElementById('year-select');
    if (yearSelect && availableYears.length > 0) {
      availableYears.forEach((y) => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
      });
      const defaultYear = availableYears.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : availableYears[0];
      yearSelect.value = defaultYear;
      yearSelect.addEventListener('change', () => {
        renderStats(parseInt(yearSelect.value, 10), allRows);
      });
    }

    // ── 3. Initial render ───────────────────────────────────
    const selectedYear =
      yearSelect && yearSelect.value ? parseInt(yearSelect.value, 10) : DEFAULT_YEAR;
    await renderStats(selectedYear, allRows);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error">
      ⚠️ Could not load statistics.<br><small>${err.message}</small>
    </div>`;
  }
}

if (typeof window !== 'undefined') init();
