/* ============================================================
   papers.js — Iowa Particles & Plots Journal Club
   ============================================================ */

// ── CONFIG ─────────────────────────────────────────────────
// Fill in these two values after setting up your Google Sheet
// and Google Form (see README for step-by-step instructions).

const CONFIG = {

  // The published CSV export URL for your Google Sheet.
  // See README: "Step 3 – Publish the sheet as CSV"
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSV30CUvQZhLXFlvt0HqGmGsMZqaapy4S_xIQAxYiJp1IBkkW515MNIdBvSnEaYRu9NQ1rOvCANW2ua/pub?output=csv",

  // The share URL for your Google Form.
  // See README: "Step 2 – Create the Google Form"
  formUrl: "https://forms.gle/j88TQiKnpScU9xY28",

};

// ── COLUMN INDICES ──────────────────────────────────────────
// These correspond to the columns in your Google Sheet.
// Column 0 is always the Timestamp that Google adds automatically.
// Columns 1–3 map to your 3 form questions in order.
// There is NO title column — titles are fetched live from the arXiv API.

const COL = {
  timestamp : 0,
  name      : 1,
  arxivId   : 2,
  comment   : 3,   // "Why are you suggesting this?"
};


// ── WEEK UTILITIES ──────────────────────────────────────────

/**
 * Returns the Monday 00:00:00 of the week containing `date`.
 * Weeks run Monday–Sunday.
 */
function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay();                       // 0=Sun … 6=Sat
  const diffToMonday = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns the Monday of the *current* week.
 */
function currentWeekStart() {
  return weekStart(new Date());
}

/**
 * Formats a Date as "Mon D, YYYY", e.g. "Feb 24, 2026".
 */
function fmtDate(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Formats a week range string, e.g. "Feb 24 – Mar 2, 2026".
 */
function fmtWeekRange(monday) {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  return `${monday.toLocaleDateString("en-US", opts)} – ${sunday.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}


// ── CSV PARSER ───────────────────────────────────────────────

/**
 * Minimal RFC-4180-compliant CSV parser.
 * Returns an array of row arrays (all values are strings).
 */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }        // escaped quote
      else if (ch === '"')            { inQuotes = false; }         // closing quote
      else                            { field += ch; }
    } else {
      if      (ch === '"')  { inQuotes = true; }
      else if (ch === ',')  { row.push(field); field = ""; }
      else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        if (ch === '\r') i++;
        row.push(field); field = "";
        rows.push(row);  row = [];
      } else if (ch === '\r') {
        row.push(field); field = "";
        rows.push(row);  row = [];
      } else {
        field += ch;
      }
    }
  }
  // flush final field/row
  if (field || row.length) { row.push(field); rows.push(row); }

  return rows;
}


// ── ARXIV HELPERS ────────────────────────────────────────────

/**
 * Extracts a bare arXiv ID from a full URL, short ID, or raw string.
 * e.g. "https://arxiv.org/abs/2301.12345" → "2301.12345"
 */
function normalizeArxivId(raw) {
  const trimmed = (raw || "").trim();
  const match = trimmed.match(/(\d{4}\.\d{4,5}(v\d+)?|[a-z\-]+\/\d{7})/i);
  return match ? match[0] : trimmed;
}

/**
 * Returns an anchor element linking to the arXiv abstract page.
 */
function arxivLink(raw) {
  const id = normalizeArxivId(raw);
  if (!id) return document.createTextNode("—");
  const a = document.createElement("a");
  a.href = `https://arxiv.org/abs/${id}`;
  a.textContent = id;
  a.className = "arxiv-link";
  a.target = "_blank";
  a.rel = "noopener";
  return a;
}


// ── ARXIV METADATA FETCHER ───────────────────────────────────

/**
 * Fetches title + authors for a list of arXiv IDs in a single
 * batched API call. Returns a Map of { id → { title, authors } }.
 * Falls back gracefully if the API is unavailable.
 */
/**
 * Strips the version suffix from an arXiv ID, e.g. "2301.12345v2" → "2301.12345".
 * Used to unify the API response IDs with user-submitted IDs.
 */
function stripVersion(id) {
  return (id || "").replace(/v\d+$/i, "");
}

async function fetchArxivMetadata(ids) {
  const meta = new Map();
  const cleanIds = ids.map(id => stripVersion(normalizeArxivId(id))).filter(Boolean);
  if (cleanIds.length === 0) return meta;

  // INSPIRE-HEP REST API — supports browser CORS (their own SPA uses it),
  // no auth required, looks up directly by arXiv ID.
  // We fire one request per paper in parallel; typical JC lists are small
  // so this is fine and simpler than batching via search queries.
  const requests = cleanIds.map(id =>
    fetch(`https://inspirehep.net/api/arxiv/${id}?fields=titles,authors,abstracts,citation_count`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  );

  const results = await Promise.all(requests);
  console.debug("[INSPIRE] raw results:", results);

  results.forEach((data, i) => {
    const id = cleanIds[i];
    if (!data?.metadata) {
      console.debug("[INSPIRE] no metadata for", id);
      return;
    }
    const m = data.metadata;

    const title    = m.titles?.[0]?.title?.trim() ?? "";
    const abstract = m.abstracts?.[0]?.value?.trim() ?? "";
    const allAuthors = m.authors ?? [];
    const authors  = allAuthors
      .slice(0, 4)
      .map(a => a.full_name)
      .join(", ") + (allAuthors.length > 4 ? " et al." : "");
    const citations = m.citation_count ?? null;

    console.debug("[INSPIRE] parsed →", { id, title, authors, abstractLen: abstract.length, citations });
    meta.set(id, { title, authors, abstract, citations, inspireId: m.control_number });
  });

  // Mark any IDs that got no result so the table can show a warning
  cleanIds.forEach(id => {
    if (!meta.has(id)) meta.set(id, { notFound: true });
  });

  console.debug("[INSPIRE] meta map keys:", [...meta.keys()]);
  return meta;
}


// ── TABLE BUILDER ────────────────────────────────────────────

/**
 * Builds a <table> DOM node from paper rows enriched with arXiv metadata.
 * @param {Array}  papers  - array of CSV row arrays
 * @param {Map}    metaMap - Map of arxivId → { title, authors } from fetchArxivMetadata
 */
function buildTable(papers, metaMap = new Map()) {
  const table = document.createElement("table");
  table.className = "papers-table";

  // Header
  const thead = table.createTHead();
  const hRow  = thead.insertRow();
  ["Submitted by", "Paper", "Why they suggest it"].forEach(label => {
    const th = document.createElement("th");
    th.textContent = label;
    hRow.appendChild(th);
  });

  // Body
  const tbody = table.createTBody();
  papers.forEach(paper => {
    const tr = tbody.insertRow();
    const id = stripVersion(normalizeArxivId(paper[COL.arxivId]));
    const meta = metaMap.get(id) || {};
    console.debug("[table] row:", { raw: paper[COL.arxivId], id, metaFound: !!meta.title });

    // Name
    const tdName = tr.insertCell();
    tdName.textContent = (paper[COL.name] || "").trim() || "—";

    // Paper: arXiv badge + fetched title + authors
    const tdPaper = tr.insertCell();
    if (meta.title) {
      const titleDiv = document.createElement("div");
      titleDiv.className = "paper-title";
      titleDiv.textContent = meta.title;
      tdPaper.appendChild(titleDiv);
    }
    if (meta.authors) {
      const authorsDiv = document.createElement("div");
      authorsDiv.className = "paper-comment";
      authorsDiv.textContent = meta.authors;
      tdPaper.appendChild(authorsDiv);
    }
    if (meta.abstract) {
      const abstractDiv = document.createElement("div");
      abstractDiv.className = "paper-abstract";
      abstractDiv.textContent = meta.abstract;
      tdPaper.appendChild(abstractDiv);
    }
    const badgeRow = document.createElement("div");
    badgeRow.style.cssText = "margin-top:0.4rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;";
    badgeRow.appendChild(arxivLink(paper[COL.arxivId]));
    if (meta.inspireId) {
      const inspireA = document.createElement("a");
      inspireA.href = `https://inspirehep.net/literature/${meta.inspireId}`;
      inspireA.textContent = "iNSPIRE-HEP";
      inspireA.className = "inspire-link";
      inspireA.target = "_blank";
      inspireA.rel = "noopener";
      badgeRow.appendChild(inspireA);
    }
    if (meta.citations != null) {
      const citeSpan = document.createElement("span");
      citeSpan.className = "cite-count";
      citeSpan.textContent = `${meta.citations.toLocaleString()} citation${meta.citations !== 1 ? "s" : ""}`;
      badgeRow.appendChild(citeSpan);
    }
    tdPaper.appendChild(badgeRow);
    if (meta.notFound) {
      const warn = document.createElement("div");
      warn.className = "inspire-not-found";
      warn.textContent = "⚠ Not yet indexed on iNSPIRE-HEP — title and abstract unavailable";
      tdPaper.appendChild(warn);
    }

    // Comment / reason
    const tdComment = tr.insertCell();
    const comment = (paper[COL.comment] || "").trim();
    tdComment.textContent = comment || "—";
    if (!comment) tdComment.style.color = "var(--muted)";
  });

  return table;
}


// ── PAGE RENDERERS ───────────────────────────────────────────

async function renderThisWeek(papers, container) {
  const monday = currentWeekStart();
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);

  // Update the week label
  const label = document.getElementById("week-label");
  if (label) label.textContent = fmtWeekRange(monday);

  // Filter to this week
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
    container.innerHTML = `<div class="loading">Fetching paper details from arXiv…</div>`;
    const ids     = thisWeek.map(p => p[COL.arxivId]);
    const metaMap = await fetchArxivMetadata(ids);
    container.innerHTML = "";
    container.appendChild(buildTable(thisWeek, metaMap));
  }

  // Show the submit CTA
  const cta = document.getElementById("submit-cta");
  if (cta) cta.style.display = "";
}


async function renderArchive(papers, container) {
  // Filter to past weeks only
  const monday = currentWeekStart();
  const past = papers.filter(p => {
    const ts = new Date(p[COL.timestamp]);
    return !isNaN(ts) && ts < monday;
  });

  container.innerHTML = "";

  if (past.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>🗓️</p><p>No past submissions yet.</p></div>`;
    return;
  }

  // Fetch all arXiv metadata in one batched request
  container.innerHTML = `<div class="loading">Fetching paper details from arXiv…</div>`;
  const allIds  = past.map(p => p[COL.arxivId]);
  const metaMap = await fetchArxivMetadata(allIds);
  container.innerHTML = "";

  // Group by week start (as ISO string key)
  const weeks = new Map();
  past.forEach(p => {
    const key = weekStart(new Date(p[COL.timestamp])).toISOString();
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key).push(p);
  });

  // Sort weeks newest first
  const sortedKeys = [...weeks.keys()].sort((a, b) => new Date(b) - new Date(a));

  sortedKeys.forEach(key => {
    const weekPapers = weeks.get(key);
    const mon = new Date(key);

    const details = document.createElement("details");
    details.className = "archive-week";
    // Open the most recent past week by default
    if (key === sortedKeys[0]) details.open = true;

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
// Auto-detect the page from the URL — no inline script needed,
// which avoids Content Security Policy (CSP) violations on GitHub Pages.

async function initPage(page) {
  // Wire up the Google Form link wherever it appears
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
      Open <code>assets/js/papers.js</code> and fill in <code>CONFIG.sheetCsvUrl</code>
      and <code>CONFIG.formUrl</code>. See the README for instructions.
    </div>`;
    return;
  }

  try {
    const res = await fetch(CONFIG.sheetCsvUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();

    const rows = parseCsv(text);
    // Row 0 is the header; skip it
    const papers = rows.slice(1).filter(r => r.length > COL.timestamp && r[COL.timestamp]);

    if (page === "index")   renderThisWeek(papers, container);
    if (page === "archive") renderArchive(papers, container);

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="error">
      ⚠️ Could not load papers. Make sure the Google Sheet is published as CSV and the URL is correct.<br>
      <small>${err.message}</small>
    </div>`;
  }
}

// Detect page from URL and self-start — no inline script required.
const _page = window.location.pathname.includes("archive") ? "archive" : "index";
initPage(_page);
