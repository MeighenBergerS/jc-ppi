/* ============================================================
   stats.js — Statistics page entry point
   ============================================================
   Builds four charts for the selected calendar year:
     1. Papers each week                   (teal heat strip)
     2. Papers each month, and discussed   (teal stacked columns)
     3. Subfield distribution              (fixed 10-color palette)
     4. Top keywords                       (purple gradient bars)

   The page describes the club, never ranks its members: no chart
   is broken down by person.

   data/papers.csv is fetched fresh; INSPIRE metadata is re-used
   from the localStorage cache populated by the other pages.
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
// Purple (#7570b3) for keywords.
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
function _buildChart(title, rows, emptyMsg = 'No data yet.') {
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
    valueEl.textContent = value;

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

// ── Weekly heat strip ─────────────────────────────────────────
// One row per quarter, one cell per week, shaded by papers that
// week (0, 1, 2, 3, 4+; colors in style.css, .heat-cell).

const MONTHS = Array.from({ length: 12 }, (_, m) =>
  new Date(2000, m, 1).toLocaleDateString('en-US', { month: 'short' })
);

const _plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;

function _chartSection(title) {
  const section = document.createElement('section');
  section.className = 'stat-section';
  const h3 = document.createElement('h3');
  h3.textContent = title;
  section.appendChild(h3);
  return section;
}

function _legendSwatch(className, text) {
  const item = document.createElement('span');
  item.className = 'chart-legend-item';
  const swatch = document.createElement('span');
  swatch.className = className;
  item.appendChild(swatch);
  if (text) item.append(text);
  return item;
}

function _buildWeekStrip(year, weekCounts) {
  const section = _chartSection(`Papers each week in ${year}`);
  const today = new Date();

  const quarters = [[], [], [], []];
  yearWeeks(year).forEach((monday) => {
    // The week holding January 1 may start in December; it belongs to Q1.
    const month = monday.getFullYear() < year ? 0 : monday.getMonth();
    quarters[Math.floor(month / 3)].push(monday);
  });

  const strip = document.createElement('div');
  strip.className = 'heat-strip';
  quarters.forEach((weeks, q) => {
    const label = document.createElement('span');
    label.className = 'heat-label';
    label.textContent = `${MONTHS[q * 3]}–${MONTHS[q * 3 + 2]}`;
    strip.appendChild(label);

    const row = document.createElement('div');
    row.className = 'heat-row';
    weeks.forEach((monday) => {
      const n = weekCounts.get(monday.toISOString()) ?? 0;
      const cell = document.createElement('span');
      cell.className = 'heat-cell';
      if (monday > today) {
        cell.classList.add('heat-cell--future');
      } else {
        cell.dataset.level = String(Math.min(n, 4));
        cell.title = `${fmtWeekRange(monday)}: ${_plural(n, 'paper')}`;
        cell.setAttribute('role', 'img');
        cell.setAttribute('aria-label', cell.title);
      }
      row.appendChild(cell);
    });
    strip.appendChild(row);
  });
  section.appendChild(strip);

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.append('Papers:');
  ['0', '1', '2', '3', '4+'].forEach((text, level) => {
    const item = _legendSwatch('heat-cell', text);
    item.firstChild.dataset.level = String(level);
    legend.appendChild(item);
  });
  section.appendChild(legend);
  return section;
}

// ── Monthly columns ───────────────────────────────────────────
// Papers suggested each month; the darker part was discussed.

function _buildMonthChart(year, monthCounts) {
  const section = _chartSection(`Papers suggested each month in ${year}`);
  const today = new Date();
  const max = Math.max(1, ...monthCounts.map((m) => m.suggested));

  const chart = document.createElement('div');
  chart.className = 'month-chart';
  monthCounts.forEach(({ suggested, discussed }, m) => {
    const col = document.createElement('div');
    col.className = 'month-col';
    const future = new Date(year, m, 1) > today;
    if (!future) {
      col.title = `${MONTHS[m]} ${year}: ${_plural(suggested, 'paper')} suggested, ${discussed} discussed`;
      col.setAttribute('role', 'img');
      col.setAttribute('aria-label', col.title);
    }

    const plot = document.createElement('div');
    plot.className = 'month-plot';
    if (suggested > 0) {
      const value = document.createElement('span');
      value.className = 'month-value';
      value.textContent = suggested;
      plot.appendChild(value);
    }
    const bar = document.createElement('div');
    bar.className = 'month-bar';
    bar.style.height = `${(suggested / max) * 100}%`;
    if (suggested > discussed) {
      const rest = document.createElement('div');
      rest.className = 'month-seg month-seg--suggested';
      rest.style.flexGrow = String(suggested - discussed);
      bar.appendChild(rest);
    }
    if (discussed > 0) {
      const disc = document.createElement('div');
      disc.className = 'month-seg month-seg--discussed';
      disc.style.flexGrow = String(discussed);
      bar.appendChild(disc);
    }
    plot.appendChild(bar);
    col.appendChild(plot);

    const label = document.createElement('span');
    label.className = `month-label${future ? ' month-label--future' : ''}`;
    label.textContent = MONTHS[m];
    col.appendChild(label);
    chart.appendChild(col);
  });
  section.appendChild(chart);

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.appendChild(_legendSwatch('month-seg month-seg--discussed', 'Discussed'));
  legend.appendChild(_legendSwatch('month-seg month-seg--suggested', 'Not discussed'));
  section.appendChild(legend);
  return section;
}

// ── Pure aggregation (exported for testing) ──────────────────

/**
 * Computes submission statistics for a given calendar year from raw CSV rows.
 * Pure function — no DOM, no network.
 *
 * @param {number} year
 * @param {string[][]} allRows - All CSV rows (already sliced past header).
 * @returns {{ papers, memberCounts, weekCounts, busiestKey, monthCounts }}
 *   monthCounts holds { suggested, discussed } for January to December.
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

  const monthCounts = Array.from({ length: 12 }, () => ({ suggested: 0, discussed: 0 }));
  papers.forEach((p) => {
    const month = monthCounts[new Date(p[COL.timestamp]).getMonth()];
    month.suggested++;
    if ((p[COL.discussed] ?? '').trim().toUpperCase() === 'TRUE') month.discussed++;
  });

  return { papers, memberCounts, weekCounts, busiestKey, monthCounts };
}

/**
 * The weeks of a calendar year, as the Monday each starts on (local time).
 * The first week is the one holding January 1, so it may start in December.
 *
 * @param {number} year
 * @returns {Date[]}
 */
export function yearWeeks(year) {
  const first = weekStart(new Date(year, 0, 1));
  const weeks = [];
  for (let i = 0; ; i++) {
    const monday = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 7 * i);
    if (monday.getFullYear() > year) return weeks;
    weeks.push(monday);
  }
}

// ── Stats renderer ────────────────────────────────────────────

/**
 * Renders all stat charts for a given year using pre-fetched rows.
 * Clears and repopulates #stats-container on each call.
 */
async function renderStats(year, allRows) {
  const container = document.getElementById('stats-container');
  const subtitle = document.getElementById('stats-subtitle');

  const { papers, memberCounts, weekCounts, busiestKey, monthCounts } = computeSubmissionStats(
    year,
    allRows
  );
  const busiestWeekLabel = busiestKey ? fmtWeekRange(new Date(busiestKey)) : '—';

  const isCurrentYear = year === new Date().getFullYear();
  if (subtitle)
    subtitle.textContent = `${year}${isCurrentYear ? ' year-to-date' : ''} · ${papers.length} paper${papers.length !== 1 ? 's' : ''}`;

  container.innerHTML = '';

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
  // Time charts (CSV data only — no INSPIRE call needed)
  container.appendChild(_buildWeekStrip(year, weekCounts));
  container.appendChild(_buildMonthChart(year, monthCounts));

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
  // Point the "Bring a paper" link at the paper issue form
  document.querySelectorAll('#submit-link').forEach((el) => {
    el.href = CONFIG.formUrl;
  });

  const container = document.getElementById('stats-container');

  try {
    // ── 1. Fetch + parse the papers CSV ─────────────────────
    const res = await fetch(CONFIG.papersCsvUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const allRows = parseCsv(await res.text())
      .slice(1)
      .filter((r) => r.length > COL.timestamp && r[COL.timestamp])
      .filter((r) => (r[COL.approved] ?? '').trim().toUpperCase() === 'TRUE')
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
