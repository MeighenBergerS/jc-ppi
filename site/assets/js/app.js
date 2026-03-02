/* ============================================================
   app.js — Page renderers and entry point
   ============================================================
   Loads submissions from Google Sheets, fetches paper metadata
   from INSPIRE-HEP, and renders the This Week / Archive pages.
   ============================================================ */

import { CONFIG, COL }       from "./config.js";
import { parseCsv, weekStart, currentWeekStart, fmtWeekRange } from "./utils.js";
import { fetchPaperMetadata } from "./inspire.js";
import { buildTable }         from "./table.js";


// ── THIS WEEK ────────────────────────────────────────────────

async function renderThisWeek(papers, container) {
  const monday = currentWeekStart();
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const label = document.getElementById("week-label");
  if (label) label.textContent = fmtWeekRange(monday);

  const thisWeek = papers.filter(p => {
    const ts = new Date(p[COL.timestamp]);
    return !isNaN(ts) && ts >= monday && ts <= sunday;
  });

  container.innerHTML = "";

  if (thisWeek.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📭</p>
        <p>No papers submitted yet this week.</p>
        <p style="margin-top:.5rem;font-size:.85rem;">Be the first — submit one using the button below!</p>
      </div>`;
  } else {
    container.innerHTML = `<div class="loading">Fetching paper details from INSPIRE-HEP…</div>`;
    const metaMap = await fetchPaperMetadata(thisWeek.map(p => p[COL.arxivId]));
    container.innerHTML = "";
    container.appendChild(buildTable(thisWeek, metaMap));
  }

  const cta = document.getElementById("submit-cta");
  if (cta) cta.style.display = "";
}


// ── ARCHIVE ──────────────────────────────────────────────────

async function renderArchive(papers, container) {
  const monday = currentWeekStart();
  const past   = papers.filter(p => {
    const ts = new Date(p[COL.timestamp]);
    return !isNaN(ts) && ts < monday;
  });

  container.innerHTML = "";

  if (past.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>🗓️</p><p>No past submissions yet.</p></div>`;
    return;
  }

  container.innerHTML = `<div class="loading">Fetching paper details from INSPIRE-HEP…</div>`;
  const metaMap = await fetchPaperMetadata(past.map(p => p[COL.arxivId]));
  container.innerHTML = "";

  // Group by week
  const weeks = new Map();
  past.forEach(p => {
    const key = weekStart(new Date(p[COL.timestamp])).toISOString();
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(p);
  });

  const sortedKeys = [...weeks.keys()].sort((a, b) => new Date(b) - new Date(a));

  sortedKeys.forEach((key, idx) => {
    const weekPapers = weeks.get(key);
    const mon        = new Date(key);

    const details = document.createElement("details");
    details.className = "archive-week";
    if (idx === 0) details.open = true;   // open most recent week by default

    const summary = document.createElement("summary");
    summary.innerHTML = `
      ${fmtWeekRange(mon)}
      <span class="week-count">${weekPapers.length} paper${weekPapers.length !== 1 ? "s" : ""}</span>
    `;
    details.appendChild(summary);
    details.appendChild(buildTable(weekPapers, metaMap));
    container.appendChild(details);
  });
}


// ── ENTRY POINT ──────────────────────────────────────────────

async function init() {
  // Wire up the Google Form link wherever it appears on the page
  document.querySelectorAll("#submit-link, #submit-cta-link").forEach(el => {
    if (CONFIG.formUrl && CONFIG.formUrl !== "PASTE_YOUR_GOOGLE_FORM_URL_HERE") {
      el.href = CONFIG.formUrl;
    } else {
      el.textContent = "Submit a Paper (not configured yet)";
      el.removeAttribute("href");
    }
  });

  const container = document.getElementById("papers-container");

  if (!CONFIG.sheetCsvUrl || CONFIG.sheetCsvUrl === "PASTE_YOUR_SHEET_CSV_URL_HERE") {
    container.innerHTML = `<div class="error">
      ⚠️ <strong>Not configured yet.</strong>
      Open <code>site/assets/js/config.js</code> and fill in
      <code>sheetCsvUrl</code> and <code>formUrl</code>.
      See the README for instructions.
    </div>`;
    return;
  }

  try {
    const res  = await fetch(CONFIG.sheetCsvUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const rows   = parseCsv(text);
    const papers = rows.slice(1).filter(r => r.length > COL.timestamp && r[COL.timestamp]);

    const page = window.location.pathname.includes("archive") ? "archive" : "index";
    if (page === "index")   await renderThisWeek(papers, container);
    if (page === "archive") await renderArchive(papers, container);

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error">
      ⚠️ Could not load papers. Make sure the Google Sheet is published as CSV
      and the URL in <code>config.js</code> is correct.<br>
      <small>${err.message}</small>
    </div>`;
  }
}

init();
