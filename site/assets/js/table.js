/* ============================================================
   table.js — DOM table builder
   ============================================================
   Turns an array of CSV paper rows + an INSPIRE metadata map
   into a fully populated <table> element ready to insert into
   the page.
   ============================================================ */

import { COL, CONFIG } from './config.js';
import { normalizeArxivId, stripVersion, arxivLink } from './utils.js';
import { vote, removeEntry, editComment } from './sheet.js';

/**
 * Builds a <table> element from paper rows and INSPIRE metadata.
 *
 * @param {string[][]} papers  - Array of CSV row arrays.
 * @param {Map}        metaMap - Result of fetchPaperMetadata().
 * @returns {HTMLTableElement}
 */
export function buildTable(papers, metaMap = new Map(), { thisWeek = false } = {}) {
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

    // Attach categories as a data attribute for the subfield filter
    tr.dataset.categories = (meta.categories ?? []).join(',');

    // Column 2 — Paper (title, authors, abstract, badge row, keyword pills)
    const tdPaper = tr.insertCell();
    _appendText(tdPaper, meta.title, 'paper-title');
    _appendText(tdPaper, meta.authors, 'paper-comment');
    _appendText(tdPaper, meta.abstract, 'paper-abstract');
    tdPaper.appendChild(_buildBadgeRow(paper[COL.arxivId], id, meta));
    _appendKeywordPills(tdPaper, meta);

    // Column 3 — Reason for suggestion
    // Prefer the edited comment (col G) when present; fall back to original.
    const tdComment = tr.insertCell();
    const commentText = ((paper[COL.editedComment] || paper[COL.comment]) ?? '').trim();
    const commentSpan = document.createElement('span');
    commentSpan.className = 'comment-text';
    commentSpan.textContent = commentText || '—';
    if (!commentText) commentSpan.style.color = 'var(--muted)';
    tdComment.appendChild(commentSpan);

    // Column 4 — Actions (this week with mutateUrl configured only)
    if (thisWeek) {
      const tdActions = tr.insertCell();
      tdActions.className = 'actions-cell';
      tdActions.appendChild(
        _buildActionsCell(id, Number(paper[COL.votes] ?? 0), commentSpan, tdComment)
      );
    }
  });

  return table;
}

// ── Action controls ───────────────────────────────────────────

/**
 * Builds the vote / edit / remove control group for a this-week row.
 * @param {string}      cleanId      - Normalised arXiv ID.
 * @param {number}      initialVotes - Vote count from the CSV.
 * @param {HTMLElement} commentSpan  - The <span> holding the comment text.
 * @param {HTMLElement} tdComment    - The parent <td> (swapped during editing).
 */
function _buildActionsCell(cleanId, initialVotes, commentSpan, tdComment) {
  const container = document.createElement('div');
  container.className = 'actions-container';

  // ── Upvote ─────────────────────────────────────────────
  let voteCount = initialVotes;
  const voteBtn = document.createElement('button');
  voteBtn.className = 'action-btn action-btn--vote';
  const _updateVote = () => {
    voteBtn.textContent = `▲ ${voteCount}`;
  };
  _updateVote();
  voteBtn.addEventListener('click', async () => {
    voteBtn.disabled = true;
    try {
      const res = await vote(cleanId);
      if (res.ok) {
        voteCount = res.votes ?? voteCount + 1;
        _updateVote();
      }
    } catch (err) {
      console.warn('Vote failed:', err);
    }
    setTimeout(() => {
      voteBtn.disabled = false;
    }, 1000);
  });

  // ── Edit ───────────────────────────────────────────────
  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn action-btn--edit';
  editBtn.textContent = '✏ Edit';
  editBtn.addEventListener('click', () => {
    const current = commentSpan.textContent === '—' ? '' : commentSpan.textContent;
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = current;
    textarea.rows = 3;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'action-btn action-btn--save';
    saveBtn.textContent = 'Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'action-btn action-btn--cancel';
    cancelBtn.textContent = 'Cancel';

    const btnRow = document.createElement('div');
    btnRow.className = 'edit-btn-row';
    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);

    tdComment.innerHTML = '';
    tdComment.appendChild(textarea);
    tdComment.appendChild(btnRow);
    textarea.focus();

    const _restore = () => {
      tdComment.innerHTML = '';
      tdComment.appendChild(commentSpan);
    };

    saveBtn.addEventListener('click', async () => {
      const newText = textarea.value.trim();
      saveBtn.disabled = cancelBtn.disabled = true;
      try {
        const res = await editComment(cleanId, newText);
        if (res.ok) {
          commentSpan.textContent = newText || '—';
          commentSpan.style.color = newText ? '' : 'var(--muted)';
        }
      } catch (err) {
        console.warn('Edit failed:', err);
      }
      _restore();
    });

    cancelBtn.addEventListener('click', _restore);
  });

  // ── Remove ─────────────────────────────────────────────
  const removeBtn = document.createElement('button');
  removeBtn.className = 'action-btn action-btn--remove';
  removeBtn.textContent = '✕ Remove';
  removeBtn.addEventListener('click', async () => {
    if (!confirm("Remove this paper from this week's list?")) return;
    removeBtn.disabled = editBtn.disabled = voteBtn.disabled = true;
    try {
      const res = await removeEntry(cleanId);
      if (res.ok) {
        removeBtn.closest('tr')?.remove();
        return;
      }
    } catch (err) {
      console.warn('Remove failed:', err);
    }
    removeBtn.disabled = editBtn.disabled = voteBtn.disabled = false;
  });

  container.append(voteBtn, editBtn, removeBtn);
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
