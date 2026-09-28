/**
 * trending.test.js — Tests for the trending papers (scripts/papers/trending.js)
 * and for keeping Trending issues apart from paper submissions.
 * Run with: node --test tests/trending.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  TRENDING_CATEGORIES,
  parseTrendingHit,
  fetchTrending,
  renderTrendingIssue,
  parseTrendingIssue,
  trendingToRows,
  trendingIssueTitle,
} from '../scripts/papers/trending.js';
import {
  LABELS,
  FIELDS,
  isSubmission,
  isVisiblePaper,
  issuesToRows,
} from '../scripts/papers/lib.js';
import { parseCsv } from '../site/assets/js/utils.js';
import { toCsv } from '../scripts/papers/lib.js';

const paper = (over = {}) => ({
  arxivId: '2609.01583',
  title: 'Higgsino [dark] matter',
  abstract: 'We find m < 1 GeV --> surprising. Thanks @someone.',
  authors: 'Freese, Katherine',
  affiliation: 'Texas U.',
  citations: 82,
  citationsNoSelf: 80,
  ...over,
});

describe('parseTrendingHit', () => {
  it('prefers the collaboration name', () => {
    const t = parseTrendingHit({
      collaborations: [{ value: 'IceCube' }],
      authors: [{ full_name: 'A' }],
      arxiv_eprints: [{ value: '2609.1' }],
      citation_count: 9,
      citation_count_without_self_citations: 4,
    });
    assert.equal(t.authors, 'IceCube Collaboration');
    assert.equal(t.affiliation, '');
    assert.equal(t.citationsNoSelf, 4);
  });

  it('shortens more than ten authors to "et al." and takes the first affiliation', () => {
    const authors = Array.from({ length: 11 }, (_, i) => ({
      full_name: `Author ${i}`,
      affiliations: [{ value: `Uni ${i}` }],
    }));
    const t = parseTrendingHit({ authors });
    assert.equal(t.authors, 'Author 0 et al.');
    assert.equal(t.affiliation, 'Uni 0');
  });

  it('cuts long abstracts to 500 characters', () => {
    const t = parseTrendingHit({ abstracts: [{ value: 'x'.repeat(900) }] });
    assert.equal(t.abstract.length, 500);
    assert.ok(t.abstract.endsWith('…'));
  });
});

describe('fetchTrending', () => {
  const hit = { metadata: { arxiv_eprints: [{ value: '2609.1' }], titles: [{ title: 'T' }] } };

  it('returns one list per category, and null where INSPIRE failed', async () => {
    const urls = [];
    const fetchFn = async (url) => {
      urls.push(url);
      if (urls.length === 2) return { ok: false, status: 500 };
      return { ok: true, status: 200, json: async () => ({ hits: { hits: [hit, hit] } }) };
    };
    const out = await fetchTrending({ size: 2, fetchFn, pause: 0 });
    assert.equal(out.length, TRENDING_CATEGORIES.length);
    assert.equal(out[0].length, 2);
    assert.equal(out[1], null);
    assert.match(decodeURIComponent(urls[1]), /and neutrino/);
    assert.match(urls[0], /size=2/);
  });

  it('survives a network error', async () => {
    const fetchFn = async () => {
      throw new Error('offline');
    };
    assert.deepEqual(await fetchTrending({ fetchFn, pause: 0 }), [null, null, null]);
  });
});

describe('the Trending issue', () => {
  const now = new Date('2026-09-28T12:17:00Z');
  const trending = [[paper(), paper({ arxivId: '2609.2', title: 'Second' })], [], null];

  it('is titled with the date', () => {
    assert.equal(trendingIssueTitle(now), 'Trending in hep-ph: Sep 28, 2026');
  });

  it('round-trips its data through the hidden marker, even with "-->" in an abstract', () => {
    assert.deepEqual(parseTrendingIssue(renderTrendingIssue(trending, now)), trending);
  });

  it('shows ranked, linked, escaped entries and marks empty categories', () => {
    const body = renderTrendingIssue(trending, now);
    assert.match(
      body,
      /1\. \*\*\[Higgsino \\\[dark\\\] matter\]\(https:\/\/arxiv.org\/abs\/2609.01583\)\*\*/
    );
    assert.match(body, /2\. \*\*\[Second\]/);
    assert.match(body, /80 citations excluding self-citations, 82 total/);
    assert.match(body, /m &lt; 1 GeV/);
    assert.ok(!/@someone/.test(body), 'no @mentions');
    assert.equal(body.match(/_No data available\._/g).length, 2);
  });

  it('returns null for a body without the marker', () => {
    assert.equal(parseTrendingIssue('just text'), null);
  });
});

describe('trendingToRows', () => {
  it("matches the site's Trending tab columns and survives the CSV round trip", () => {
    const rows = trendingToRows([[paper()], [paper({ arxivId: '2609.9' })], null]);
    assert.deepEqual(rows[0], [
      'Overall hep-ph',
      '1',
      '2609.01583',
      'Higgsino [dark] matter',
      'We find m < 1 GeV --> surprising. Thanks @someone.',
      'Freese, Katherine',
      'Texas U.',
      '82',
      '80',
    ]);
    assert.equal(rows[1][0], 'Neutrinos');
    assert.deepEqual(parseCsv(toCsv(rows, ['h'])).slice(1), rows);
  });

  it('gives no rows without data', () => {
    assert.deepEqual(trendingToRows(null), []);
  });
});

describe('Trending issues are not submissions', () => {
  const trendingIssue = {
    number: 99,
    state: 'open',
    created_at: '2026-09-28T12:17:00Z',
    user: { login: 'github-actions[bot]' },
    labels: [{ name: LABELS.trending }, { name: LABELS.paper }, { name: LABELS.updatedByBot }],
    body: renderTrendingIssue([[paper()], [], []]),
    reactions: { '+1': 0 },
    html_url: 'https://github.com/o/r/issues/99',
  };
  const submission = {
    ...trendingIssue,
    number: 1,
    labels: [{ name: LABELS.paper }],
    body: `### ${FIELDS.arxiv}\n\n2609.01583\n\n### ${FIELDS.why}\n\nWhy.`,
  };

  it('isSubmission and isVisiblePaper leave them out', () => {
    assert.equal(isSubmission(trendingIssue), false);
    assert.equal(isVisiblePaper(trendingIssue), false);
    assert.equal(isSubmission(submission), true);
  });

  it('the site papers data leaves them out', () => {
    assert.equal(issuesToRows([trendingIssue, submission]).length, 1);
  });
});
