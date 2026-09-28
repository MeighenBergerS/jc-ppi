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
export function buildTable(
  papers,
  metaMap = new Map(),
  { thisWeek = false, previousSubmissions = new Map() } = {}
) {
  const table = document.createElement('table');
  table.className = 'papers-table';

  // ── Header ──────────────────────────────────────────────
  const thead = table.createTHead();
  const hRow = thead.insertRow();
  const headers = ['Submitted by', 'Paper', 'Why they suggest it'];
  if (thisWeek) headers.push('');
  headers.forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    if (!label) th.className = 'actions-col';
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

    // Attach filter data attributes
    tr.dataset.categories = (meta.categories ?? []).join(',');
    const discussed = (paper[COL.discussed] ?? '').trim().toUpperCase() === 'TRUE';
    tr.dataset.discussed = discussed ? 'true' : 'false';

    // Column 2 — Paper (title, authors, abstract, badge row, keyword pills)
    const tdPaper = tr.insertCell();
    // Discussed star badge — visible in both This Week and Archive
    if (discussed) {
      const star = document.createElement('div');
      star.className = 'paper-discussed';
      star.textContent = '\u2605 Discussed at JC';
      tdPaper.appendChild(star);
    }
    _appendText(tdPaper, meta.title, 'paper-title');
    _appendText(tdPaper, meta.authors, 'paper-comment');
    _appendText(tdPaper, meta.abstract, 'paper-abstract');
    tdPaper.appendChild(_buildBadgeRow(paper[COL.arxivId], id, meta));
    _appendKeywordPills(tdPaper, meta);

    // If this is the This Week view and there was a previous submission
    // of the same paper in an earlier week, show a short note with the
    // most-recent previous submission date.
    if (thisWeek && previousSubmissions && previousSubmissions.has(id)) {
      const prev = previousSubmissions.get(id);
      try {
        const prevDate = prev instanceof Date ? prev : new Date(prev);
        if (!isNaN(prevDate)) {
          const note = document.createElement('div');
          note.className = 'previous-submission';
          note.innerHTML =
            `<span class="note-icon">!</span>` +
            `<span class="note-text"><strong>Note:</strong> Previously submitted on ${prevDate.toLocaleDateString(
              'en-US',
              {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }
            )}</span>`;
          tdPaper.appendChild(note);
        }
      } catch (e) {
        // ignore formatting errors — do not block rendering
      }
    }

    // Column 3 — Reason for suggestion
    // Prefer the edited comment (col G) when present; fall back to original.
    const tdComment = tr.insertCell();
    const commentText = ((paper[COL.editedComment] || paper[COL.comment]) ?? '').trim();
    const commentSpan = document.createElement('span');
    commentSpan.className = 'comment-text';
    commentSpan.textContent = commentText || '—';
    if (!commentText) commentSpan.style.color = 'var(--muted)';
    tdComment.appendChild(commentSpan);

    // Column 4 — This week only: a link to the paper's issue, where people
    // vote with a 👍 reaction.
    if (thisWeek) {
      const tdActions = tr.insertCell();
      tdActions.className = 'actions-cell';
      tdActions.appendChild(
        _buildIssueLinkCell(paper[COL.issueUrl], Number(paper[COL.votes] ?? 0))
      );
    }
  });

  return table;
}

// ── Action controls ───────────────────────────────────────────

/**
 * Builds the vote link for a this-week row.
 * @param {string} issueUrl - The paper's GitHub issue.
 * @param {number} votes    - 👍 count when the site data was last built.
 */
function _buildIssueLinkCell(issueUrl, votes) {
  const container = document.createElement('div');
  container.className = 'actions-container';
  if (!/^https:\/\/github\.com\//.test(issueUrl ?? '')) return container;
  const link = document.createElement('a');
  link.className = 'action-btn action-btn--vote';
  link.href = issueUrl;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = `▲ ${votes} · Vote`;
  link.title = 'Vote with a 👍 reaction on the GitHub issue';
  container.appendChild(link);
  return container;
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
 * optional citation count, and status warnings.
 *
 * @param {string} rawArxivId - The raw value from the CSV (used for the link).
 * @param {string} cleanId    - The normalised, version-stripped ID (empty if unparseable).
 * @param {object} meta       - Metadata from fetchPaperMetadata(), or {}.
 */
function _buildBadgeRow(rawArxivId, cleanId, meta) {
  const row = document.createElement('div');
  row.style.cssText =
    'margin-top:0.4rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;';

  // arXiv badge — use the corrected (zero-padded) ID if the original was auto-fixed
  const displayArxivId = meta.correctedId ?? rawArxivId;
  row.appendChild(arxivLink(displayArxivId));

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

  // Auto-correction note
  if (meta.correctedId) {
    const note = document.createElement('div');
    note.className = 'inspire-corrected';
    note.textContent = `ℹ ID auto-corrected: ${rawArxivId} → ${meta.correctedId}`;
    row.appendChild(note);
  }

  // Status warnings — mutually exclusive, in descending severity
  if (!cleanId || meta.invalidId) {
    // The ID could not be resolved to a real arXiv paper
    const warn = document.createElement('div');
    warn.className = 'inspire-invalid';
    warn.textContent = '⚠ Invalid arXiv ID — this paper could not be found on arXiv';
    row.appendChild(warn);
  } else if (meta.notFound) {
    // Valid arXiv paper but not yet indexed on INSPIRE
    const warn = document.createElement('div');
    warn.className = 'inspire-not-found';
    warn.textContent = '⚠ Not yet indexed on iNSPIRE-HEP — title and abstract unavailable';
    row.appendChild(warn);
  }

  return row;
}
