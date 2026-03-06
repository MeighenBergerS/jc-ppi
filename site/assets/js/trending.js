/* ============================================================
   trending.js — Trending papers section renderer
   ============================================================
   Renders the Trending section from rows fetched from the
   Trending Google Sheet tab (published as CSV).

   Called from app.js with one of three states:
     'ok'    — rows present, render normally
     'empty' — no rows yet (refresh scheduled; show static message)
     'error' — fetch failed (show error message)
   ============================================================ */

import { CONFIG, COL_TREND } from './config.js';
import { normalizeArxivId, stripVersion } from './utils.js';

/**
 * Renders the trending section into `container`.
 *
 * @param {'ok'|'empty'|'error'} state
 * @param {string[][]}           rows   - Parsed CSV rows (no header).
 * @param {HTMLElement}          container
 */
export function renderTrending(state, rows, container) {
  container.innerHTML = '';

  const section = document.createElement('section');
  section.className = 'trending-section';

  const heading = document.createElement('h2');
  heading.className = 'trending-heading';
  heading.textContent = '📡 Trending in hep-ph';
  section.appendChild(heading);

  const subheading = document.createElement('p');
  subheading.className = 'trending-subheading';
  subheading.textContent =
    `Most-cited papers over the past ${CONFIG.inspireLookbackWeeks ?? 4} weeks, ` +
    'ranked by citation count excluding self-citations (via INSPIRE-HEP). ' +
    'Refreshed Monday & Wednesday mornings.';
  section.appendChild(subheading);

  if (state === 'error') {
    const msg = document.createElement('div');
    msg.className = 'trending-message trending-message--error';
    msg.textContent =
      'Could not load trending papers. If this persists, please let the organiser know.';
    section.appendChild(msg);
    container.appendChild(section);
    return;
  }

  if (state === 'empty') {
    const msg = document.createElement('div');
    msg.className = 'trending-message trending-message--empty';
    msg.textContent =
      'Trending papers are refreshed Monday and Wednesday mornings — check back soon.';
    section.appendChild(msg);
    container.appendChild(section);
    return;
  }

  // Group rows by category, preserving INSPIRE_CATEGORIES order via order of appearance
  const categoryOrder = [];
  const byCategory = new Map();
  rows.forEach((row) => {
    const cat = (row[COL_TREND.category] ?? '').trim();
    if (!cat) return;
    if (!byCategory.has(cat)) {
      byCategory.set(cat, []);
      categoryOrder.push(cat);
    }
    byCategory.get(cat).push(row);
  });

  // Sort each category's papers by rank ascending
  byCategory.forEach((papers) => {
    papers.sort((a, b) => Number(a[COL_TREND.rank] ?? 0) - Number(b[COL_TREND.rank] ?? 0));
  });

  if (categoryOrder.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'trending-message trending-message--empty';
    msg.textContent =
      'Trending papers are refreshed Monday and Wednesday mornings — check back soon.';
    section.appendChild(msg);
    container.appendChild(section);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'trending-grid';

  categoryOrder.forEach((cat) => {
    const papers = byCategory.get(cat);

    const catBlock = document.createElement('div');
    catBlock.className = 'trending-category';

    const catHeading = document.createElement('h3');
    catHeading.className = 'trending-cat-heading';
    catHeading.textContent = cat;
    catBlock.appendChild(catHeading);

    papers.forEach((row) => {
      const rank = Number(row[COL_TREND.rank] ?? 0);
      const rawArxivId = (row[COL_TREND.arxivId] ?? '').trim();
      const title = (row[COL_TREND.title] ?? '').trim();
      const abstract = (row[COL_TREND.abstract] ?? '').trim();
      const authors = (row[COL_TREND.authors] ?? '').trim();
      const affiliation = (row[COL_TREND.affiliation] ?? '').trim();
      const citations = Number(row[COL_TREND.citations] ?? 0);
      const citationsNoSelf = Number(row[COL_TREND.citationsNoSelf] ?? 0);

      const cleanId = rawArxivId ? stripVersion(normalizeArxivId(rawArxivId)) : '';

      const card = document.createElement('div');
      card.className = 'trending-card';

      // ── Rank badge ────────────────────────────────────────
      const rankBadge = document.createElement('span');
      rankBadge.className = 'trending-rank';
      rankBadge.textContent = `#${rank}`;
      card.appendChild(rankBadge);

      // ── Title ─────────────────────────────────────────────
      if (title) {
        const titleEl = document.createElement('div');
        titleEl.className = 'paper-title trending-card-title';
        titleEl.textContent = title;
        card.appendChild(titleEl);
      }

      // ── Authors + affiliation ──────────────────────────────
      if (authors) {
        const authEl = document.createElement('div');
        authEl.className = 'paper-comment';
        authEl.textContent = affiliation ? `${authors} · ${affiliation}` : authors;
        card.appendChild(authEl);
      }

      // ── Abstract ──────────────────────────────────────────
      if (abstract) {
        const absEl = document.createElement('div');
        absEl.className = 'paper-abstract';
        absEl.textContent = abstract;
        card.appendChild(absEl);
      }

      // ── Badge row: arXiv link + citation count ─────────────
      const badgeRow = document.createElement('div');
      badgeRow.className = 'trending-badge-row';

      if (cleanId) {
        const arxivLink = document.createElement('a');
        arxivLink.className = 'arxiv-link';
        arxivLink.href = `https://arxiv.org/abs/${cleanId}`;
        arxivLink.target = '_blank';
        arxivLink.rel = 'noopener';
        arxivLink.textContent = cleanId;
        badgeRow.appendChild(arxivLink);
      }

      if (citations > 0 || citationsNoSelf > 0) {
        const citeEl = document.createElement('span');
        citeEl.className = 'cite-count';
        citeEl.textContent = `${citationsNoSelf} citations (excl. self) / ${citations} total`;
        badgeRow.appendChild(citeEl);
      }

      card.appendChild(badgeRow);
      catBlock.appendChild(card);
    });

    grid.appendChild(catBlock);
  });

  section.appendChild(grid);
  container.appendChild(section);
}
