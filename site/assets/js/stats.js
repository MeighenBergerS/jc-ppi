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

import { CONFIG, COL }                                        from "./config.js";
import { parseCsv, weekStart, fmtWeekRange,
         normalizeArxivId, stripVersion }                     from "./utils.js";
import { fetchPaperMetadata }                                 from "./inspire.js";

const YEAR = new Date().getFullYear();

// ── Category color palette ────────────────────────────────────
// ColorBrewer Dark2 (8) + steel blue + deep red.
// Categories are sorted alphabetically then assigned in order,
// so the same subfield always gets the same color.

const CAT_PALETTE = [
  "#1b9e77",   // teal
  "#d95f02",   // orange
  "#7570b3",   // purple
  "#e7298a",   // pink
  "#66a61e",   // lime
  "#e6ab02",   // amber
  "#a6761d",   // brown
  "#666666",   // grey
  "#2166ac",   // steel blue  (added)
  "#b2182b",   // deep red    (added)
];

function _catColor(name, sortedNames) {
  const idx = sortedNames.indexOf(name);
  return CAT_PALETTE[Math.max(0, idx) % CAT_PALETTE.length];
}

// ── Accent RGB values for gradient bars ───────────────────────
// Teal (#1b9e77) for members, purple (#7570b3) for keywords.
// Bars blend from the full accent colour down to a pale tint.

function _gradientColor(r, g, b, rank, total) {
  const t = total > 1 ? rank / (total - 1) : 0;   // 0 = top, 1 = bottom
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
function _buildChart(title, rows, emptyMsg = "No data yet.") {
  const section = document.createElement("section");
  section.className = "stat-section";

  const h3 = document.createElement("h3");
  h3.textContent = title;
  section.appendChild(h3);

  if (!rows.length) {
    const p = document.createElement("p");
    p.className   = "stat-empty";
    p.textContent = emptyMsg;
    section.appendChild(p);
    return section;
  }

  const max   = rows[0].value;
  const chart = document.createElement("div");
  chart.className = "bar-chart";

  rows.forEach(({ label, value, color }) => {
    const pct = max > 0 ? (value / max) * 100 : 0;
    const row = document.createElement("div");
    row.className = "bar-row";

    const labelEl = document.createElement("span");
    labelEl.className   = "bar-label";
    labelEl.textContent = label;
    labelEl.title       = label;

    const track = document.createElement("div");
    track.className = "bar-track";

    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.cssText = `width:${pct.toFixed(2)}%;background:${color}`;
    track.appendChild(fill);

    const valueEl = document.createElement("span");
    valueEl.className   = "bar-value";
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

function _buildSummary({ total, members, weeksActive, busiestWeek, topCat }) {
  const strip = document.createElement("div");
  strip.className = "stat-summary";

  const kpis = [
    { value: total,           label: `papers in ${YEAR}`                         },
    { value: members,         label: `active member${members !== 1 ? "s" : ""}`  },
    { value: weeksActive,     label: `weeks active`                               },
    { value: busiestWeek,     label: "busiest week", small: true                  },
    { value: topCat || "—",   label: "top subfield",  small: true                 },
  ];

  kpis.forEach(({ value, label, small }) => {
    const kpi = document.createElement("div");
    kpi.className = "stat-kpi";

    const v = document.createElement("span");
    v.className   = `stat-kpi-value${small ? " stat-kpi-value--sm" : ""}`;
    v.textContent = value;

    const l = document.createElement("span");
    l.className   = "stat-kpi-label";
    l.textContent = label;

    kpi.appendChild(v);
    kpi.appendChild(l);
    strip.appendChild(kpi);
  });

  return strip;
}


// ── Entry point ───────────────────────────────────────────────

async function init() {
  // Wire up the Google Form link
  document.querySelectorAll("#submit-link").forEach(el => {
    if (CONFIG.formUrl && CONFIG.formUrl !== "PASTE_YOUR_GOOGLE_FORM_URL_HERE") {
      el.href = CONFIG.formUrl;
    } else {
      el.textContent = "Submit a Paper (not configured yet)";
      el.removeAttribute("href");
    }
  });

  const container = document.getElementById("stats-container");
  const subtitle  = document.getElementById("stats-subtitle");

  if (!CONFIG.sheetCsvUrl || CONFIG.sheetCsvUrl === "PASTE_YOUR_SHEET_CSV_URL_HERE") {
    container.innerHTML = `<div class="error">
      ⚠️ <strong>Not configured yet.</strong>
      Open <code>site/assets/js/config.js</code> and fill in
      <code>sheetCsvUrl</code> and <code>formUrl</code>.
    </div>`;
    return;
  }

  try {
    // ── 1. Fetch + parse the sheet ──────────────────────────
    const res = await fetch(CONFIG.sheetCsvUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const allRows = parseCsv(await res.text())
      .slice(1)
      .filter(r => r.length > COL.timestamp && r[COL.timestamp]);

    // ── 2. Filter to current calendar year ─────────────────
    const yearRows = allRows.filter(p => {
      const ts = new Date(p[COL.timestamp]);
      return !isNaN(ts) && ts.getFullYear() === YEAR;
    });

    // Deduplicate by arXiv ID (earliest submission wins)
    const seen = new Map();
    yearRows.forEach(p => {
      const id = stripVersion(normalizeArxivId(p[COL.arxivId]));
      if (!id || seen.has(id)) return;
      seen.set(id, p);
    });
    const papers = [...seen.values()];

    if (subtitle) subtitle.textContent = `${YEAR} year-to-date · ${papers.length} paper${papers.length !== 1 ? "s" : ""}`;

    // ── 3. Papers per member ────────────────────────────────
    const memberCounts = new Map();
    papers.forEach(p => {
      const name = (p[COL.name] || "").trim() || "Anonymous";
      memberCounts.set(name, (memberCounts.get(name) ?? 0) + 1);
    });

    // ── 4. Most active week ─────────────────────────────────
    const weekCounts = new Map();
    papers.forEach(p => {
      const key = weekStart(new Date(p[COL.timestamp])).toISOString();
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
    });
    let busiestKey = null, busiestN = 0;
    weekCounts.forEach((n, k) => { if (n > busiestN) { busiestN = n; busiestKey = k; } });
    const busiestWeekLabel = busiestKey ? fmtWeekRange(new Date(busiestKey)) : "—";

    // ── 5. Render member bars (no API call needed) ──────────
    container.innerHTML = "";

    const memberRows = [...memberCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i, arr) => ({
        label,
        value,
        color: _gradientColor(27, 158, 119, i, arr.length),  // teal
      }));

    // Render summary with placeholder top-cat (filled in after INSPIRE)
    const summaryEl = _buildSummary({
      total:       papers.length,
      members:     memberCounts.size,
      weeksActive: weekCounts.size,
      busiestWeek: busiestWeekLabel,
      topCat:      null,
    });
    container.appendChild(summaryEl);
    container.appendChild(_buildChart(`Papers submitted in ${YEAR} by member`, memberRows));

    if (papers.length === 0) return;

    // ── 6. Fetch INSPIRE metadata (batched + cached) ────────
    const inspireNote = document.createElement("p");
    inspireNote.className   = "loading";
    inspireNote.textContent = "Fetching subfield & keyword data from INSPIRE-HEP…";
    container.appendChild(inspireNote);

    const metaMap = await fetchPaperMetadata(papers.map(p => p[COL.arxivId]));
    inspireNote.remove();

    // ── 7. Category distribution ────────────────────────────
    const catCounts = new Map();
    metaMap.forEach(meta => {
      (meta.categories ?? []).forEach(cat => {
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
      const topCatEl = summaryEl.querySelector(".stat-kpi:last-child .stat-kpi-value");
      if (topCatEl) topCatEl.textContent = catRows[0].label;
    }

    container.appendChild(_buildChart("Subfield distribution", catRows,
      "No category data yet — papers may still be indexing on INSPIRE-HEP."));

    // ── 8. Keyword distribution (top 20) ───────────────────
    const kwCounts = new Map();
    metaMap.forEach(meta => {
      (meta.keywords ?? []).forEach(kw => {
        kwCounts.set(kw, (kwCounts.get(kw) ?? 0) + 1);
      });
    });

    const kwRows = [...kwCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([label, value], i, arr) => ({
        label,
        value,
        color: _gradientColor(117, 112, 179, i, arr.length),  // purple (--accent-sec)
      }));

    container.appendChild(_buildChart("Top keywords (year to date)", kwRows,
      "No keyword data yet."));

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error">
      ⚠️ Could not load statistics.<br><small>${err.message}</small>
    </div>`;
  }
}

init();
