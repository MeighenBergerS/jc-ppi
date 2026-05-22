/* ============================================================
   iowa.js — Iowa Research tab renderer
   ============================================================
   Queries INSPIRE-HEP directly for recent papers from authors
   affiliated with the University of Iowa, filters out large
   collaboration papers (> MAX_AUTHORS authors), and renders
   cards into the provided container.

   Results are cached in localStorage with a 6-hour TTL so
   repeat visits are near-instant without hammering INSPIRE.
   ============================================================ */

import { CONFIG } from './config.js';
import { normalizeArxivId, stripVersion } from './utils.js';

const CACHE_KEY = 'iowa_highlights_v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MAX_AUTHORS = 10;
const PAGE_SIZE = 50;

// INSPIRE affiliation query terms for University of Iowa
const AFF_QUERY = 'aff "University of Iowa" or aff "Iowa U." or aff "U. Iowa"';

// ── Cache ────────────────────────────────────────────────────

function _loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!raw || Date.now() - raw.ts >= CACHE_TTL_MS) return null;
    return raw.papers;
  } catch {
    return null;
  }
}

function _saveCache(papers) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), papers }));
  } catch {}
}

// ── INSPIRE fetch ────────────────────────────────────────────

/**
 * Fetches recent Iowa-affiliated papers from INSPIRE-HEP.
 * Returns an array of paper objects sorted by date descending.
 */
async function fetchIowaPapers() {
  const cached = _loadCache();
  if (cached) return cached;

  const weeks = CONFIG.iowaLookbackWeeks ?? 8;
  const since = new Date();
  since.setDate(since.getDate() - weeks * 7);
  const sinceStr = since.toISOString().slice(0, 10); // YYYY-MM-DD

  const q = `(${AFF_QUERY}) and de ${sinceStr}+`;
  const url =
    'https://inspirehep.net/api/literature?' +
    `q=${encodeURIComponent(q)}` +
    '&sort=mostrecent' +
    '&fields=titles,authors,abstracts,arxiv_eprints,control_number,inspire_categories,earliest_date' +
    `&size=${PAGE_SIZE}`;

  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`INSPIRE HTTP ${res.status}`);
  const data = await res.json();

  const papers = (data.hits?.hits ?? [])
    .map((hit) => _parseHit(hit.metadata))
    .filter((p) => p !== null && p.authorCount <= MAX_AUTHORS);

  _saveCache(papers);
  return papers;
}

// ── Parsing ──────────────────────────────────────────────────

const CATEGORY_LABELS = {
  'Phenomenology-HEP': 'Pheno',
  'Theory-HEP': 'Theory',
  'Experiment-HEP': 'Experiment',
  Lattice: 'Lattice',
  Astrophysics: 'Astrophysics',
  'Gravitation and Cosmology': 'Gravity/Cosmo',
  'Nuclear Experiment': 'Nuclear Exp',
  'Nuclear Theory': 'Nuclear Th',
  Instrumentation: 'Instrumentation',
  Computing: 'Computing',
  'Math and Math Physics': 'Math-Phys',
  'General Physics': 'General',
  'High Energy Physics': 'HEP',
};

function _parseHit(m) {
  const eprint = (m.arxiv_eprints ?? [])[0]?.value ?? '';
  const arxivId = stripVersion(normalizeArxivId(eprint));
  if (!arxivId) return null;

  const title = m.titles?.[0]?.title?.trim() ?? '';
  const abstract = m.abstracts?.[0]?.value?.trim() ?? '';
  const allAuthors = m.authors ?? [];
  const authorCount = allAuthors.length;
  const authors =
    allAuthors
      .slice(0, 5)
      .map((a) => a.full_name)
      .join(', ') + (allAuthors.length > 5 ? ' et al.' : '');

  // Iowa-affiliated authors for display
  const iowaAuthors = allAuthors
    .filter((a) =>
      (a.affiliations ?? []).some((aff) => {
        const v = (aff.value ?? '').toLowerCase();
        return v.includes('iowa');
      })
    )
    .map((a) => a.full_name);

  const categories = (m.inspire_categories ?? [])
    .map((c) => CATEGORY_LABELS[c.term] ?? c.term)
    .filter((v, i, a) => a.indexOf(v) === i);

  const date = m.earliest_date ?? '';

  return { arxivId, title, abstract, authors, authorCount, iowaAuthors, categories, date };
}

// ── Rendering ────────────────────────────────────────────────

/**
 * Fetches Iowa papers and renders them into `container`.
 * Handles loading, empty, and error states.
 */
export async function renderIowa(container) {
  container.innerHTML = '<div class="loading">Fetching Iowa papers from INSPIRE-HEP…</div>';

  let papers;
  try {
    papers = await fetchIowaPapers();
  } catch (e) {
    console.error('Iowa fetch error:', e);
    container.innerHTML = '';
    const section = _makeSection();
    const msg = document.createElement('div');
    msg.className = 'iowa-message iowa-message--error';
    msg.textContent =
      'Could not load papers from INSPIRE-HEP. If this persists, please let the organiser know.';
    section.appendChild(msg);
    container.appendChild(section);
    return;
  }

  container.innerHTML = '';
  const section = _makeSection();

  if (papers.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'iowa-message iowa-message--empty';
    const weeks = CONFIG.iowaLookbackWeeks ?? 8;
    msg.textContent = `No papers with University of Iowa affiliations found in the past ${weeks} weeks on INSPIRE-HEP.`;
    section.appendChild(msg);
    container.appendChild(section);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'iowa-grid';

  papers.forEach((paper) => {
    grid.appendChild(_makeCard(paper));
  });

  section.appendChild(grid);
  container.appendChild(section);
}

function _makeSection() {
  const section = document.createElement('section');
  section.className = 'iowa-section';

  const heading = document.createElement('h2');
  heading.className = 'iowa-heading';
  heading.textContent = 'Iowa Research';
  section.appendChild(heading);

  const weeks = CONFIG.iowaLookbackWeeks ?? 8;
  const subheading = document.createElement('p');
  subheading.className = 'iowa-subheading';
  subheading.textContent =
    `Recent papers from University of Iowa authors on INSPIRE-HEP (past ${weeks} weeks). ` +
    'Collaboration papers with more than 10 authors are excluded.';
  section.appendChild(subheading);

  return section;
}

function _makeCard(paper) {
  const card = document.createElement('div');
  card.className = 'iowa-card';

  // ── Date badge ────────────────────────────────────────────
  if (paper.date) {
    const dateBadge = document.createElement('span');
    dateBadge.className = 'iowa-date';
    dateBadge.textContent = paper.date;
    card.appendChild(dateBadge);
  }

  // ── Title ─────────────────────────────────────────────────
  if (paper.title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'paper-title iowa-card-title';
    titleEl.textContent = paper.title;
    card.appendChild(titleEl);
  }

  // ── Authors ───────────────────────────────────────────────
  if (paper.authors) {
    const authEl = document.createElement('div');
    authEl.className = 'paper-comment';
    authEl.textContent = paper.authors;
    card.appendChild(authEl);
  }

  // ── Iowa authors callout ──────────────────────────────────
  if (paper.iowaAuthors.length > 0) {
    const iowaEl = document.createElement('div');
    iowaEl.className = 'iowa-authors-callout';
    iowaEl.textContent = `Iowa: ${paper.iowaAuthors.join(', ')}`;
    card.appendChild(iowaEl);
  }

  // ── Abstract ──────────────────────────────────────────────
  if (paper.abstract) {
    const absEl = document.createElement('div');
    absEl.className = 'paper-abstract';
    absEl.textContent = paper.abstract;
    card.appendChild(absEl);
  }

  // ── Badge row: category chips + arXiv link ─────────────────
  const badgeRow = document.createElement('div');
  badgeRow.className = 'iowa-badge-row';

  paper.categories.forEach((cat) => {
    const chip = document.createElement('span');
    chip.className = 'cat-chip';
    chip.textContent = cat;
    badgeRow.appendChild(chip);
  });

  if (paper.arxivId) {
    const arxivLink = document.createElement('a');
    arxivLink.className = 'arxiv-link';
    arxivLink.href = `https://arxiv.org/abs/${paper.arxivId}`;
    arxivLink.target = '_blank';
    arxivLink.rel = 'noopener';
    arxivLink.textContent = paper.arxivId;
    badgeRow.appendChild(arxivLink);
  }

  card.appendChild(badgeRow);
  return card;
}
