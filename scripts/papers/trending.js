/* ============================================================
   scripts/papers/trending.js — Trending hep-ph papers
   ============================================================
   Looks up the most-cited recent hep-ph papers per category on
   INSPIRE-HEP (a port of refreshTrendingPapers in the Apps
   Script), renders them as a "Trending" issue, and reads that
   issue back into rows for the site. Used by trending-issue.js,
   build-csv.js and the Slack reminder.
   ============================================================ */

import { safeText, formatDate } from './lib.js';

export const TRENDING_CATEGORIES = [
  { label: 'Overall hep-ph', emoji: '🔬', extra: '' },
  { label: 'Neutrinos', emoji: '⚛️', extra: 'neutrino' },
  { label: 'Dark Matter', emoji: '🌑', extra: '"dark matter"' },
];
export const TRENDING_LOOKBACK_WEEKS = 4;
export const TRENDING_PER_CATEGORY = 3;
const ABSTRACT_MAX_CHARS = 500;

export const TRENDING_MARKER = 'jc-ppi:trending';
const TRENDING_RE = /<!-- jc-ppi:trending (\{[\s\S]*?\}) -->/;

/** Shapes an INSPIRE record like the Apps Script's Trending tab rows. */
export function parseTrendingHit(m) {
  let authors = '';
  let affiliation = '';
  if (m.collaborations?.length) {
    authors = `${m.collaborations[0].value} Collaboration`;
  } else if (m.authors?.length) {
    const names = m.authors.map((a) => (a.full_name ?? '').trim()).filter(Boolean);
    authors = names.length <= 10 ? names.join(', ') : `${names[0]} et al.`;
    affiliation = m.authors[0].affiliations?.[0]?.value ?? '';
  }
  let abstract = (m.abstracts?.[0]?.value ?? '').trim();
  if (abstract.length > ABSTRACT_MAX_CHARS) {
    abstract = abstract.slice(0, ABSTRACT_MAX_CHARS - 1) + '…';
  }
  return {
    arxivId: m.arxiv_eprints?.[0]?.value ?? '',
    title: m.titles?.[0]?.title?.trim() ?? '',
    abstract,
    authors,
    affiliation,
    citations: Number(m.citation_count) || 0,
    citationsNoSelf: Number(m.citation_count_without_self_citations) || 0,
  };
}

/**
 * The most-cited hep-ph papers of the last TRENDING_LOOKBACK_WEEKS, per category.
 * @returns {Promise<(object[]|null)[]>} one list per category (most cited first),
 *   or null for a category INSPIRE couldn't answer.
 */
export async function fetchTrending({
  size = TRENDING_PER_CATEGORY,
  now = new Date(),
  fetchFn = fetch,
  pause = 1000,
} = {}) {
  const since = new Date(now.getTime() - TRENDING_LOOKBACK_WEEKS * 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const out = [];
  for (const cat of TRENDING_CATEGORIES) {
    // `de` is the arXiv (preprint) date, so papers only recently published in a
    // journal don't count as new.
    let q = `arxiv_eprints.categories:hep-ph and de > ${since}`;
    if (cat.extra) q += ` and ${cat.extra}`;
    const url =
      `https://inspirehep.net/api/literature?sort=mostcited&size=${size}` +
      '&fields=arxiv_eprints,titles,abstracts,authors.full_name,authors.affiliations,' +
      'collaborations,citation_count,citation_count_without_self_citations' +
      `&q=${encodeURIComponent(q)}`;
    try {
      let res = await fetchFn(url);
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 6000));
        res = await fetchFn(url);
      }
      out.push(
        res.ok
          ? ((await res.json()).hits?.hits ?? []).map((h) => parseTrendingHit(h.metadata))
          : null
      );
    } catch {
      out.push(null);
    }
    if (pause) await new Promise((r) => setTimeout(r, pause)); // INSPIRE rate limit
  }
  return out;
}

/** Title of the Trending issue for a given day. */
export function trendingIssueTitle(now = new Date()) {
  return `Trending in hep-ph: ${formatDate(now)}`;
}

/**
 * Renders the Trending issue body: a readable list per category, plus the data
 * in a hidden marker that build-csv.js turns into the site's trending rows.
 */
export function renderTrendingIssue(trending, now = new Date()) {
  const lines = [
    `The most-cited hep-ph papers first posted to arXiv in the last ${TRENDING_LOOKBACK_WEEKS} ` +
      'weeks, per category, ranked by citation count (via INSPIRE-HEP). ' +
      `Opened automatically on ${formatDate(now)}; the next list replaces this one.`,
    '',
  ];
  TRENDING_CATEGORIES.forEach((cat, i) => {
    lines.push(`## ${cat.emoji} ${cat.label}`, '');
    const papers = trending[i];
    if (!papers?.length) {
      lines.push('_No data available._', '');
      return;
    }
    papers.forEach((p, rank) => {
      const title = safeText(p.title).replace(/[[\]]/g, '\\$&') || p.arxivId;
      const link = p.arxivId ? `[${title}](https://arxiv.org/abs/${p.arxivId})` : title;
      lines.push(`${rank + 1}. **${link}**  `);
      const who = [safeText(p.authors), safeText(p.affiliation)].filter(Boolean).join(' · ');
      if (who) lines.push(`   ${who}  `);
      lines.push(
        `   ${p.citationsNoSelf} citations excluding self-citations, ${p.citations} total`
      );
      if (p.abstract) {
        lines.push(
          '',
          '   <details><summary>Abstract</summary>',
          '',
          `   ${safeText(p.abstract)}`,
          '',
          '   </details>'
        );
      }
      lines.push('');
    });
  });
  // Escaping ">" keeps the data from ending the HTML comment early, and "@" from
  // mentioning anyone. JSON.parse turns both back.
  const data = JSON.stringify({ trending }).replace(/>/g, '\\u003e').replace(/@/g, '\\u0040');
  lines.push(`<!-- ${TRENDING_MARKER} ${data} -->`);
  return lines.join('\n');
}

/** Reads the data back out of a Trending issue body, or null. */
export function parseTrendingIssue(body) {
  const m = (body ?? '').match(TRENDING_RE);
  if (!m) return null;
  try {
    return JSON.parse(m[1]).trending;
  } catch {
    return null;
  }
}

/**
 * Rows in the Apps Script's Trending tab format (COL_TREND in config.js):
 * category, rank, arXiv ID, title, abstract, authors, affiliation,
 * citations, citations excluding self-citations.
 */
export function trendingToRows(trending) {
  const rows = [];
  TRENDING_CATEGORIES.forEach((cat, i) => {
    (trending?.[i] ?? []).forEach((p, rank) => {
      rows.push([
        cat.label,
        String(rank + 1),
        p.arxivId,
        p.title,
        p.abstract ?? '',
        p.authors,
        p.affiliation,
        String(p.citations),
        String(p.citationsNoSelf),
      ]);
    });
  });
  return rows;
}
