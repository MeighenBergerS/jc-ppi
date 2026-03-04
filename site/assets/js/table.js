/* ============================================================
   table.js — DOM table builder
   ============================================================
   Turns an array of CSV paper rows + an INSPIRE metadata map
   into a fully populated <table> element ready to insert into
   the page.
   ============================================================ */

import { COL } from './config.js';
import { normalizeArxivId, stripVersion, arxivLink } from './utils.js';

/**
 * Builds a <table> element from paper rows and INSPIRE metadata.
 *
 * @param {string[][]} papers  - Array of CSV row arrays.
 * @param {Map}        metaMap - Result of fetchPaperMetadata().
 * @returns {HTMLTableElement}
 */
export function buildTable(papers, metaMap = new Map()) {
  const table = document.createElement('table');
  table.className = 'papers-table';

  // ── Header ──────────────────────────────────────────────
  const thead = table.createTHead();
  const hRow = thead.insertRow();
  ['Submitted by', 'Paper', 'Why they suggest it'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    hRow.appendChild(th);
  });

  // ── Body ─────────────────────────────────────────────────
  const tbody = table.createTBody();
  papers.forEach((paper) => {
    const tr = tbody.insertRow();
    const id = stripVersion(normalizeArxivId(paper[COL.arxivId]));
    const meta = metaMap.get(id) || {};

    // Column 1 — Submitter name
    const tdName = tr.insertCell();
    tdName.textContent = (paper[COL.name] || '').trim() || '—';

    // Attach categories as a data attribute for the subfield filter
    tr.dataset.categories = (meta.categories ?? []).join(',');

    // Column 2 — Paper (title, authors, abstract, badge row, keyword pills)
    const tdPaper = tr.insertCell();
    _appendText(tdPaper, meta.title, 'paper-title');
    _appendText(tdPaper, meta.authors, 'paper-comment');
    _appendText(tdPaper, meta.abstract, 'paper-abstract');
    tdPaper.appendChild(_buildBadgeRow(paper[COL.arxivId], meta));
    _appendKeywordPills(tdPaper, meta);

    // Column 3 — Reason for suggestion
    const tdComment = tr.insertCell();
    const comment = (paper[COL.comment] || '').trim();
    tdComment.textContent = comment || '—';
    if (!comment) tdComment.style.color = 'var(--muted)';
  });

  return table;
}

// ── Helpers ───────────────────────────────────────────────────

/** Appends keyword and category pills to a cell, if available. */
function _appendKeywordPills(parent, meta) {
  const cats = meta.categories ?? [];
  const keywords = meta.keywords ?? [];
  if (!cats.length && !keywords.length) return;
  const container = document.createElement('div');
  container.className = 'keyword-pills';
  cats.forEach((label) => {
    const span = document.createElement('span');
    span.className = 'kpill kpill--cat';
    span.textContent = label;
    container.appendChild(span);
  });
  keywords.forEach((kw) => {
    const span = document.createElement('span');
    span.className = 'kpill kpill--topic';
    span.textContent = kw;
    container.appendChild(span);
  });
  parent.appendChild(container);
}

/** Appends a <div class=className> with text, only if text is non-empty. */
function _appendText(parent, text, className) {
  if (!text) return;
  const div = document.createElement('div');
  div.className = className;
  div.textContent = text;
  parent.appendChild(div);
}

/**
 * Builds the badge row: arXiv link, optional INSPIRE-HEP link,
 * optional citation count, optional not-found warning.
 */
function _buildBadgeRow(rawArxivId, meta) {
  const row = document.createElement('div');
  row.style.cssText =
    'margin-top:0.4rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;';

  // arXiv badge (always present)
  row.appendChild(arxivLink(rawArxivId));

  // INSPIRE-HEP link (only when indexed)
  if (meta.inspireId) {
    const a = document.createElement('a');
    a.href = `https://inspirehep.net/literature/${meta.inspireId}`;
    a.textContent = 'iNSPIRE-HEP';
    a.className = 'inspire-link';
    a.target = '_blank';
    a.rel = 'noopener';
    row.appendChild(a);
  }

  // Citation count
  if (meta.citations != null) {
    const span = document.createElement('span');
    span.className = 'cite-count';
    span.textContent = `${meta.citations.toLocaleString()} citation${meta.citations !== 1 ? 's' : ''}`;
    row.appendChild(span);
  }

  // BibTeX copy button — only when the paper is indexed on INSPIRE
  if (meta.inspireId) {
    const btn = document.createElement('button');
    btn.className = 'bibtex-btn';
    btn.textContent = 'Cite BibTeX';
    btn.title = 'Copy BibTeX citation to clipboard';
    btn.addEventListener('click', async () => {
      try {
        const r = await fetch(
          `https://inspirehep.net/api/literature/${meta.inspireId}?format=bibtex`,
          { cache: 'force-cache' }
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const bib = await r.text();
        await navigator.clipboard.writeText(bib);
        btn.textContent = 'Copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Cite BibTeX';
          btn.classList.remove('copied');
        }, 2000);
      } catch {
        btn.textContent = 'Error — try again';
        setTimeout(() => {
          btn.textContent = 'Cite BibTeX';
        }, 2000);
      }
    });
    row.appendChild(btn);
  }

  // Not-yet-indexed warning
  if (meta.notFound) {
    const warn = document.createElement('div');
    warn.className = 'inspire-not-found';
    warn.textContent = '⚠ Not yet indexed on iNSPIRE-HEP — title and abstract unavailable';
    row.appendChild(warn);
  }

  return row;
}
