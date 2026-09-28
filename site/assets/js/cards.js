/* ============================================================
   cards.js — This Week's papers as cards
   ============================================================
   Turns this week's CSV paper rows + the INSPIRE metadata map
   into a list of cards: title, authors, subfields, why it was
   brought and by whom, the abstract on request, links and the
   vote. A discussed paper gets a highlighted card; before the
   meeting, a clear vote leader gets a "Leading the vote" tag.
   The Archive keeps the table (table.js), whose pieces these
   cards share.
   ============================================================ */

import { COL } from './config.js';
import { normalizeArxivId, stripVersion } from './utils.js';
import {
  appendText,
  appendKeywordPills,
  buildBadgeRow,
  buildVoteLink,
  buildPreviousNote,
} from './table.js';

const isTrue = (v) => (v ?? '').trim().toUpperCase() === 'TRUE';
const votesOf = (paper) => Number(paper[COL.votes] ?? 0);

/**
 * The paper leading the vote: the most-voted one, if it has votes and more
 * than any other, and no paper this week has been discussed yet. Else null.
 * @param {string[][]} papers - This week's rows.
 * @returns {string[]|null}
 */
export function voteLeader(papers) {
  if (papers.some((p) => isTrue(p[COL.discussed]))) return null;
  const sorted = [...papers].sort((a, b) => votesOf(b) - votesOf(a));
  const [first, second] = sorted;
  if (!first || votesOf(first) === 0) return null;
  if (second && votesOf(second) === votesOf(first)) return null;
  return first;
}

/**
 * Builds the list of paper cards for This Week.
 *
 * @param {string[][]} papers  - This week's rows, in display order.
 * @param {Map}        metaMap - Result of fetchPaperMetadata().
 * @param {object}     [options]
 * @param {Map}        [options.previousSubmissions] - arXiv ID → earlier submission date.
 * @param {Function}   [options.shortName] - Full name → name to show (shortNamer()).
 * @returns {HTMLDivElement}
 */
export function buildCards(
  papers,
  metaMap = new Map(),
  { previousSubmissions = new Map(), shortName = (n) => n } = {}
) {
  const list = document.createElement('div');
  list.className = 'paper-cards';
  const leader = voteLeader(papers);

  for (const paper of papers) {
    const id = stripVersion(normalizeArxivId(paper[COL.arxivId]));
    const meta = metaMap.get(id) || {};
    const discussed = isTrue(paper[COL.discussed]);

    const card = document.createElement('article');
    card.className = 'paper-card';
    card.dataset.categories = (meta.categories ?? []).join(',');
    card.dataset.discussed = discussed ? 'true' : 'false';

    // Status tag: discussed after the meeting, or leading the vote before it
    if (discussed || paper === leader) {
      card.classList.add(discussed ? 'paper-card--discussed' : 'paper-card--leading');
      const tag = document.createElement('div');
      tag.className = `card-tag card-tag--${discussed ? 'discussed' : 'leading'}`;
      tag.textContent = discussed ? '⭐ Discussed' : '▲ Leading the vote';
      card.appendChild(tag);
    }

    // Title, linked to arXiv; the ID stands in until INSPIRE has a title
    const title = document.createElement('h3');
    title.className = 'card-title';
    if (id) {
      const a = document.createElement('a');
      a.href = `https://arxiv.org/abs/${meta.correctedId ?? id}`;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = meta.title || `arXiv:${id}`;
      title.appendChild(a);
    } else {
      title.textContent = meta.title || (paper[COL.arxivId] ?? '').trim() || 'Untitled';
    }
    card.appendChild(title);
    appendText(card, meta.authors, 'card-authors');
    appendKeywordPills(card, meta);

    // Why it was brought, and by whom
    const name = shortName((paper[COL.name] || '').trim());
    const why = ((paper[COL.editedComment] || paper[COL.comment]) ?? '').trim();
    const whyEl = document.createElement(why ? 'blockquote' : 'p');
    whyEl.className = 'card-why';
    if (why) {
      const q = document.createElement('span');
      q.textContent = `“${why}”`;
      whyEl.appendChild(q);
    }
    if (name) {
      const who = document.createElement('span');
      who.className = 'card-who';
      who.textContent = why ? ` — ${name}` : `Brought by ${name}`;
      whyEl.appendChild(who);
    }
    if (why || name) card.appendChild(whyEl);

    // The abstract, folded
    if (meta.abstract) {
      const details = document.createElement('details');
      details.className = 'card-abstract';
      const summary = document.createElement('summary');
      summary.textContent = 'Abstract';
      details.appendChild(summary);
      appendText(details, meta.abstract, 'paper-abstract');
      card.appendChild(details);
    }

    if (id && previousSubmissions.has(id)) {
      const note = buildPreviousNote(previousSubmissions.get(id));
      if (note) card.appendChild(note);
    }

    // Links, citations and BibTeX on the left; the vote on the right
    const footer = document.createElement('div');
    footer.className = 'card-footer';
    footer.appendChild(buildBadgeRow(paper[COL.arxivId], id, meta));
    footer.appendChild(buildVoteLink(paper[COL.issueUrl], votesOf(paper)));
    card.appendChild(footer);

    list.appendChild(card);
  }
  return list;
}
