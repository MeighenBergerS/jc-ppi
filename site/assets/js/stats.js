/* ============================================================
   stats.js — Statistics page entry point
   ============================================================
   For the selected calendar year: the club's numbers, its streak
   (current year), and these charts:
     1. The club is growing                (SVG lines: papers,
                                            discussed, people)
     2. Papers each week                   (teal heat strip)
     3. Papers each month, and discussed   (teal stacked columns)
     4. People bringing papers each month  (purple columns)
     5. Subfield distribution              (fixed 10-color palette)
     6. Top keywords                       (purple gradient bars)

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

function _buildSummary({ total, discussed, people, weeksActive, topCat }) {
  const strip = document.createElement('div');
  strip.className = 'stat-summary';

  const kpis = [
    { value: total, label: `paper${total !== 1 ? 's' : ''} suggested` },
    { value: discussed, label: 'discussed' },
    { value: people, label: `${people === 1 ? 'person' : 'people'} bringing papers` },
    { value: weeksActive, label: `week${weeksActive !== 1 ? 's' : ''} active` },
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
const _people = (n) => `${n} ${n === 1 ? 'person' : 'people'}`;

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
// One column per month, total on top, stacked from `segments`
// (bottom last). Future months show only their label.

/**
 * @param {number} year
 * @param {{total: number, title: string, segments: {className: string, value: number}[]}[]} months
 */
function _monthColumns(year, months) {
  const today = new Date();
  const max = Math.max(1, ...months.map((m) => m.total));

  const chart = document.createElement('div');
  chart.className = 'month-chart';
  months.forEach(({ total, title, segments }, m) => {
    const col = document.createElement('div');
    col.className = 'month-col';
    const future = new Date(year, m, 1) > today;
    if (!future) {
      col.title = `${MONTHS[m]} ${year}: ${title}`;
      col.setAttribute('role', 'img');
      col.setAttribute('aria-label', col.title);
    }

    const plot = document.createElement('div');
    plot.className = 'month-plot';
    if (total > 0) {
      const value = document.createElement('span');
      value.className = 'month-value';
      value.textContent = total;
      plot.appendChild(value);
    }
    const bar = document.createElement('div');
    bar.className = 'month-bar';
    bar.style.height = `${(total / max) * 100}%`;
    for (const { className, value } of segments) {
      if (value <= 0) continue;
      const seg = document.createElement('div');
      seg.className = `month-seg ${className}`;
      seg.style.flexGrow = String(value);
      bar.appendChild(seg);
    }
    plot.appendChild(bar);
    col.appendChild(plot);

    const label = document.createElement('span');
    label.className = `month-label${future ? ' month-label--future' : ''}`;
    label.textContent = MONTHS[m];
    col.appendChild(label);
    chart.appendChild(col);
  });
  return chart;
}

// Papers suggested each month; the darker part was discussed.
function _buildMonthChart(year, monthCounts) {
  const section = _chartSection(`Papers suggested each month in ${year}`);
  section.appendChild(
    _monthColumns(
      year,
      monthCounts.map(({ suggested, discussed }) => ({
        total: suggested,
        title: `${_plural(suggested, 'paper')} suggested, ${discussed} discussed`,
        segments: [
          { className: 'month-seg--suggested', value: suggested - discussed },
          { className: 'month-seg--discussed', value: discussed },
        ],
      }))
    )
  );

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.appendChild(_legendSwatch('month-seg month-seg--discussed', 'Discussed'));
  legend.appendChild(_legendSwatch('month-seg month-seg--suggested', 'Not discussed'));
  section.appendChild(legend);
  return section;
}

// How many different people brought a paper each month.
function _buildPeopleChart(year, monthCounts) {
  const section = _chartSection(`People bringing papers each month in ${year}`);
  section.appendChild(
    _monthColumns(
      year,
      monthCounts.map(({ people }) => ({
        total: people,
        title: `${_people(people)} brought papers`,
        segments: [{ className: 'month-seg--people', value: people }],
      }))
    )
  );
  return section;
}

// ── Growth lines ──────────────────────────────────────────────
// Running totals through the year: papers, discussed, people.
// SVG, one line per series, labelled at its end; a hover target
// per week shows that week's totals. The SVG is drawn at the
// container's width so its text stays readable on a phone.

const SVG_NS = 'http://www.w3.org/2000/svg';
const GROWTH_SERIES = [
  { key: 'papers', label: 'papers', className: 'growth--papers' },
  { key: 'discussed', label: 'discussed', className: 'growth--discussed' },
  { key: 'people', label: 'people', className: 'growth--people' },
];

function _svg(tag, attrs = {}, text) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text != null) el.textContent = text;
  return el;
}

/** A round axis maximum: 5, 10, 20, 25, 50, 100, … at or above `n`. */
export function niceMax(n) {
  if (n <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(n));
  return [1, 2, 2.5, 5, 10].map((f) => f * pow).find((v) => v >= n);
}

function _buildGrowthChart(year, growth, width = 640) {
  const section = _chartSection(`The club is growing: ${year} so far`);
  const weeks = yearWeeks(year);
  const W = Math.min(760, Math.max(300, Math.round(width)));
  const H = 240;
  const M = { left: 34, right: 96, top: 12, bottom: 26 };
  const plotW = W - M.left - M.right;
  const plotH = H - M.top - M.bottom;
  const last = growth.at(-1) ?? { papers: 0, discussed: 0, people: 0 };
  const yMax = niceMax(Math.max(last.papers, last.people, 1));
  const x = (i) => M.left + (weeks.length > 1 ? (i / (weeks.length - 1)) * plotW : 0);
  const y = (v) => M.top + plotH - (v / yMax) * plotH;

  const svg = _svg('svg', {
    viewBox: `0 0 ${W} ${H}`,
    class: 'growth-chart',
    role: 'img',
    'aria-label':
      `By the latest week of ${year}: ${_plural(last.papers, 'paper')} suggested, ` +
      `${last.discussed} discussed, ${_people(last.people)}.`,
  });

  // Gridlines and y labels at 0, half and the top
  for (const v of [0, yMax / 2, yMax]) {
    svg.appendChild(
      _svg('line', {
        x1: M.left,
        x2: M.left + plotW,
        y1: y(v),
        y2: y(v),
        class: v ? 'growth-grid' : 'growth-axis',
      })
    );
    svg.appendChild(
      _svg('text', { x: M.left - 6, y: y(v) + 4, class: 'growth-tick', 'text-anchor': 'end' }, v)
    );
  }
  // Month labels at the first week of each month (every other month when narrow)
  const monthStep = plotW < 380 ? 2 : 1;
  weeks.forEach((monday, i) => {
    const prev = weeks[i - 1];
    if (monday.getFullYear() !== year || (prev && prev.getMonth() === monday.getMonth())) return;
    if (monday.getMonth() % monthStep) return;
    svg.appendChild(
      _svg(
        'text',
        { x: x(i), y: H - 8, class: 'growth-tick', 'text-anchor': 'middle' },
        MONTHS[monday.getMonth()]
      )
    );
  });

  if (growth.length) {
    // Lines, then end labels pushed apart so they never overlap
    const ends = [];
    for (const s of GROWTH_SERIES) {
      const points = growth.map((g, i) => `${x(i).toFixed(1)},${y(g[s.key]).toFixed(1)}`).join(' ');
      svg.appendChild(_svg('polyline', { points, class: `growth-line ${s.className}` }));
      const endX = x(growth.length - 1);
      svg.appendChild(
        _svg('circle', { cx: endX, cy: y(last[s.key]), r: 4, class: `growth-dot ${s.className}` })
      );
      ends.push({ s, value: last[s.key], ty: y(last[s.key]) + 4, endX });
    }
    ends.sort((a, b) => a.ty - b.ty);
    for (let i = 1; i < ends.length; i++) ends[i].ty = Math.max(ends[i].ty, ends[i - 1].ty + 15);
    for (const e of ends) {
      svg.appendChild(
        _svg('text', { x: e.endX + 9, y: e.ty, class: 'growth-end' }, `${e.value} ${e.s.label}`)
      );
    }

    // Hover targets: one column per week, with that week's totals
    const step = weeks.length > 1 ? plotW / (weeks.length - 1) : plotW;
    growth.forEach((g, i) => {
      const hit = _svg('rect', {
        x: x(i) - step / 2,
        y: M.top,
        width: step,
        height: plotH,
        class: 'growth-hit',
      });
      hit.appendChild(
        _svg(
          'title',
          {},
          `Week of ${g.monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ` +
            `${_plural(g.papers, 'paper')}, ${g.discussed} discussed, ` +
            `${_people(g.people)} so far`
        )
      );
      svg.appendChild(hit);
    });
  }
  section.appendChild(svg);

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  legend.appendChild(_legendSwatch('growth-swatch growth--papers', 'Papers suggested'));
  legend.appendChild(_legendSwatch('growth-swatch growth--discussed', 'Discussed'));
  legend.appendChild(_legendSwatch('growth-swatch growth--people', 'People bringing papers'));
  section.appendChild(legend);
  return section;
}

// ── Club streak ───────────────────────────────────────────────

function _buildStreak(weeks) {
  const box = document.createElement('div');
  box.className = 'streak-callout';
  const big = document.createElement('div');
  big.className = 'streak-big';
  big.textContent = `🔥 ${weeks}-week streak`;
  const text = document.createElement('p');
  text.textContent = `The club has had at least one paper every week for ${weeks} weeks.`;
  box.append(big, text);
  return box;
}

// ── Pure aggregation (exported for testing) ──────────────────

/**
 * Computes submission statistics for a given calendar year from raw CSV rows.
 * Pure function — no DOM, no network.
 *
 * @param {number} year
 * @param {string[][]} allRows - All CSV rows (already sliced past header).
 * @returns {{ papers, memberCounts, weekCounts, monthCounts, discussed, growth }}
 *   monthCounts holds { suggested, discussed, people } for January to December,
 *   `people` counting distinct submitters. `discussed` is the year's total.
 *   `growth` has one entry per week of the year up to `now`:
 *   { monday, papers, discussed, people }, each counted from January 1.
 */
export function computeSubmissionStats(year, allRows, now = new Date()) {
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

  const isDiscussed = (p) => (p[COL.discussed] ?? '').trim().toUpperCase() === 'TRUE';
  const person = (p) => (p[COL.name] || '').trim().toLowerCase() || 'anonymous';

  const monthPeople = Array.from({ length: 12 }, () => new Set());
  const monthCounts = Array.from({ length: 12 }, () => ({ suggested: 0, discussed: 0, people: 0 }));
  papers.forEach((p) => {
    const m = new Date(p[COL.timestamp]).getMonth();
    monthCounts[m].suggested++;
    if (isDiscussed(p)) monthCounts[m].discussed++;
    monthPeople[m].add(person(p));
  });
  monthCounts.forEach((month, m) => (month.people = monthPeople[m].size));

  // Running totals, week by week, up to the week holding `now`
  const byWeek = new Map();
  papers.forEach((p) => {
    const key = weekStart(new Date(p[COL.timestamp])).toISOString();
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key).push(p);
  });
  const growth = [];
  const seenPeople = new Set();
  let paperTotal = 0;
  let discussedTotal = 0;
  for (const monday of yearWeeks(year)) {
    if (monday > now) break;
    for (const p of byWeek.get(monday.toISOString()) ?? []) {
      paperTotal++;
      if (isDiscussed(p)) discussedTotal++;
      seenPeople.add(person(p));
    }
    growth.push({ monday, papers: paperTotal, discussed: discussedTotal, people: seenPeople.size });
  }

  return {
    papers,
    memberCounts,
    weekCounts,
    monthCounts,
    discussed: papers.filter(isDiscussed).length,
    growth,
  };
}

/**
 * The club's streak: consecutive weeks, up to the week holding `now`, with
 * at least one paper. The week in progress may be empty without ending it.
 *
 * @param {string[][]} allRows - All CSV rows.
 * @param {Date} [now]
 * @returns {number}
 */
export function clubStreak(allRows, now = new Date()) {
  const weeks = new Set(
    allRows
      .map((p) => new Date(p[COL.timestamp]))
      .filter((d) => !isNaN(d))
      .map((d) => weekStart(d).getTime())
  );
  const back = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7);
  let week = weekStart(now);
  if (!weeks.has(week.getTime())) week = back(week);
  let streak = 0;
  while (weeks.has(week.getTime())) {
    streak++;
    week = back(week);
  }
  return streak;
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

  const { papers, memberCounts, weekCounts, monthCounts, discussed, growth } =
    computeSubmissionStats(year, allRows);

  const isCurrentYear = year === new Date().getFullYear();
  if (subtitle)
    subtitle.textContent = `${year}${isCurrentYear ? ' year-to-date' : ''} · ${papers.length} paper${papers.length !== 1 ? 's' : ''}`;

  container.innerHTML = '';

  // Render summary with placeholder top-cat (filled in after INSPIRE)
  const summaryEl = _buildSummary({
    total: papers.length,
    discussed,
    people: memberCounts.size,
    weeksActive: weekCounts.size,
    topCat: null,
  });
  container.appendChild(summaryEl);

  const streak = clubStreak(allRows);
  if (isCurrentYear && streak >= 2) container.appendChild(_buildStreak(streak));

  // Time charts (CSV data only — no INSPIRE call needed)
  container.appendChild(_buildGrowthChart(year, growth, container.clientWidth));
  container.appendChild(_buildWeekStrip(year, weekCounts));
  container.appendChild(_buildMonthChart(year, monthCounts));
  container.appendChild(_buildPeopleChart(year, monthCounts));

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
