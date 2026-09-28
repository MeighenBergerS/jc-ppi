/**
 * roundup.test.js — Tests for the personal monthly roundup in scripts/papers/roundup.js.
 * Run with: node --test tests/roundup.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FIELDS, LABELS, importedMarker } from '../scripts/papers/lib.js';
import {
  MILESTONES,
  monthKey,
  previousMonth,
  monthLabel,
  isFresh,
  memberPapers,
  streaks,
  milestoneCounts,
  tierReached,
  buildRoundup,
  renderRoundup,
  roundupLogins,
  parseOptOut,
} from '../scripts/papers/roundup.js';

const body = (arxiv, name) =>
  [`### ${FIELDS.arxiv}`, '', arxiv, '', `### ${FIELDS.why}`, '', 'Why.']
    .concat(name ? ['', `### ${FIELDS.name}`, '', name] : [])
    .join('\n');

let nextNumber = 1;
const issue = ({ login = 'alice', at, arxiv = '2609.00001', labels = [], votes = 0, ...over }) => ({
  number: nextNumber++,
  state: 'open',
  state_reason: null,
  created_at: at,
  html_url: `https://github.com/o/r/issues/${nextNumber}`,
  user: { login },
  labels: [{ name: LABELS.paper }, ...labels.map((name) => ({ name }))],
  reactions: { '+1': votes },
  body: body(arxiv),
  ...over,
});

const imported = (name, sheetTime, arxiv, votes = 0) =>
  issue({
    login: 'importer',
    at: '2026-09-10T00:00:00Z',
    arxiv,
    labels: [LABELS.imported],
    body: importedMarker({ timestamp: sheetTime, votes, arxiv }) + '\n' + body(arxiv, name),
  });

const alice = { login: 'alice', names: ['Alice Chen'] };

// A paper of alice's, as memberPapers() returns it, submitted at `at` (ISO).
const paper = (at, extra = {}) => memberPapers([issue({ at, ...extra })], alice)[0];

// ── Months ────────────────────────────────────────────────────

describe('months', () => {
  it('monthKey uses the club time zone', () => {
    // 1 October 2026, 03:00 UTC is still 30 September in Iowa.
    assert.equal(monthKey(new Date('2026-10-01T03:00:00Z')), '2026-09');
    assert.equal(monthKey(new Date('2026-10-01T12:00:00Z')), '2026-10');
  });

  it('previousMonth wraps the year', () => {
    assert.equal(previousMonth('2026-09'), '2026-08');
    assert.equal(previousMonth('2026-01'), '2025-12');
  });

  it('monthLabel spells the month out', () => {
    assert.equal(monthLabel('2026-09'), 'September 2026');
  });

  it('isFresh matches a modern ID to its arXiv month', () => {
    assert.equal(isFresh('2609.01234', '2026-09'), true);
    assert.equal(isFresh('2608.01234', '2026-09'), false);
    assert.equal(isFresh('hep-ph/9901123', '1999-01'), false);
    assert.equal(isFresh(null, '2026-09'), false);
  });
});

// ── memberPapers ──────────────────────────────────────────────

describe('memberPapers', () => {
  it("matches the member's own issues by login, ignoring case", () => {
    const issues = [
      issue({ login: 'Alice', at: '2026-09-02T15:00:00Z' }),
      issue({ login: 'bob', at: '2026-09-03T15:00:00Z' }),
    ];
    assert.equal(memberPapers(issues, alice).length, 1);
  });

  it('matches imported issues by Sheet name, not by the importer', () => {
    const issues = [
      imported('alice chen', '3/4/2025 10:00:00', '2503.00001', 2),
      imported('Bob Martinez', '3/5/2025 10:00:00', '2503.00002'),
    ];
    const papers = memberPapers(issues, alice);
    assert.equal(papers.length, 1);
    assert.equal(papers[0].arxivId, '2503.00001');
    assert.equal(papers[0].month, '2025-03');
    assert.equal(papers[0].votes, 2);
    assert.equal(memberPapers(issues, { login: 'importer' }).length, 0);
  });

  it('leaves out unapproved, withdrawn and Trending issues', () => {
    const issues = [
      issue({ at: '2026-09-02T15:00:00Z', labels: [LABELS.needsApproval] }),
      issue({ at: '2026-09-02T15:00:00Z', state: 'closed', state_reason: 'not_planned' }),
      issue({ at: '2026-09-02T15:00:00Z', labels: [LABELS.trending] }),
    ];
    assert.equal(memberPapers(issues, alice).length, 0);
  });

  it('reads discussed, votes and the clean arXiv ID; sorts oldest first', () => {
    const issues = [
      issue({ at: '2026-09-20T15:00:00Z', arxiv: 'https://arxiv.org/abs/2609.00002v3' }),
      issue({ at: '2026-09-02T15:00:00Z', labels: [LABELS.discussed], votes: 4 }),
    ];
    const [first, second] = memberPapers(issues, alice);
    assert.equal(first.discussed, true);
    assert.equal(first.votes, 4);
    assert.equal(second.arxivId, '2609.00002');
    assert.equal(second.discussed, false);
  });
});

// ── streaks ───────────────────────────────────────────────────

describe('streaks', () => {
  const w = (n) => 7 * n; // week numbers, a week apart

  it('finds the longest run and the current one', () => {
    const weeks = [w(1), w(2), w(3), w(5), w(6)];
    assert.deepEqual(streaks(weeks, w(6)), { best: 3, current: 2 });
  });

  it('lets the week in progress be empty', () => {
    assert.equal(streaks([w(5), w(6)], w(7)).current, 2);
  });

  it('breaks the current run after an empty week', () => {
    assert.equal(streaks([w(5), w(6)], w(8)).current, 0);
  });

  it('counts several papers in one week once', () => {
    assert.deepEqual(streaks([w(1), w(1), w(2)], w(2)), { best: 2, current: 2 });
  });

  it('is zero without papers', () => {
    assert.deepEqual(streaks([], w(1)), { best: 0, current: 0 });
  });
});

// ── Milestones ────────────────────────────────────────────────

describe('milestones', () => {
  it('each has rising tiers and a count', () => {
    const counts = milestoneCounts([]);
    for (const m of MILESTONES) {
      assert.ok(
        m.tiers.every((t, i) => i === 0 || t > m.tiers[i - 1]),
        m.id
      );
      assert.equal(counts[m.id], 0, m.id);
    }
  });

  it('tierReached is the highest tier at or below the count', () => {
    const m = { tiers: [10, 25, 50] };
    assert.equal(tierReached(m, 9), 0);
    assert.equal(tierReached(m, 10), 10);
    assert.equal(tierReached(m, 49), 25);
    assert.equal(tierReached(m, 500), 50);
  });

  it('milestoneCounts counts papers, discussed, subfields, fresh papers and votes', () => {
    const papers = [
      paper('2026-09-02T15:00:00Z', { arxiv: '2609.00001', labels: [LABELS.discussed], votes: 3 }),
      paper('2026-09-09T15:00:00Z', { arxiv: '2608.00002', votes: 1 }),
    ];
    const meta = new Map([
      ['2609.00001', { categories: ['Pheno', 'Theory'] }],
      ['2608.00002', { categories: ['Pheno'] }],
    ]);
    assert.deepEqual(milestoneCounts(papers, meta), {
      papers: 2,
      discussed: 1,
      streak: 2,
      subfields: 2,
      fresh: 1,
      votes: 4,
    });
  });
});

// ── buildRoundup ──────────────────────────────────────────────

describe('buildRoundup', () => {
  // Nine papers in August (one a week plus extras), one in September.
  const august = [
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-10',
    '2026-08-17',
    '2026-08-18',
    '2026-08-24',
    '2026-08-25',
    '2026-08-31',
  ].map((d) => paper(`${d}T15:00:00Z`, { arxiv: '2607.00001' }));
  const september = paper('2026-09-01T15:00:00Z', {
    arxiv: '2609.00009',
    labels: [LABELS.discussed],
    votes: 2,
  });
  const papers = [...august, september];

  it("counts only the month's papers", () => {
    const r = buildRoundup(papers, '2026-09');
    assert.equal(r.suggested, 1);
    assert.equal(r.discussed, 1);
    assert.equal(r.votes, 2);
    assert.deepEqual(r.previous, { suggested: 9, discussed: 0 });
    assert.equal(r.total, 10);
  });

  it('announces a tier crossed this month, and only then', () => {
    const r = buildRoundup(papers, '2026-09');
    assert.deepEqual(
      r.reached.map((m) => [m.emoji, m.tier]),
      [['📚', 10]]
    );
    const aug = buildRoundup(papers, '2026-08');
    assert.ok(!aug.reached.some((m) => m.emoji === '📚'));
    assert.ok(aug.reached.some((m) => m.emoji === '🔥' && m.tier === 4));
  });

  it('ignores papers after the month', () => {
    const r = buildRoundup(papers, '2026-08');
    assert.equal(r.total, 9);
    assert.equal(r.suggested, 9);
  });

  it('reports the streak still going at the end of the month', () => {
    // The weeks of Aug 3, 10, 17, 24 and 31 all have papers.
    assert.deepEqual(buildRoundup(papers, '2026-08').streak, { best: 5, current: 5 });
    // Nothing since the week of Aug 31, so by the end of September it is over.
    assert.deepEqual(buildRoundup(papers, '2026-09').streak, { best: 5, current: 0 });
  });

  it('lists the two nearest upcoming milestones', () => {
    const r = buildRoundup(papers, '2026-09');
    assert.equal(r.next.length, 2);
    assert.ok(r.next[0].toGo <= r.next[1].toGo);
    for (const m of r.next) assert.equal(m.count + m.toGo, m.tier);
  });

  it('works for a month without papers', () => {
    const r = buildRoundup(papers, '2026-11');
    assert.equal(r.suggested, 0);
    assert.equal(r.streak.current, 0);
    assert.deepEqual(r.reached, []);
  });
});

// ── renderRoundup ─────────────────────────────────────────────

describe('renderRoundup', () => {
  const papers = [
    paper('2026-09-02T15:00:00Z', { arxiv: '2609.00001', labels: [LABELS.discussed], votes: 3 }),
    paper('2026-09-09T15:00:00Z', { arxiv: '2609.00002' }),
  ];
  const meta = new Map([['2609.00001', { title: 'A neutrino paper', categories: ['Pheno'] }]]);

  it('names the month in the subject', () => {
    const { subject } = renderRoundup(buildRoundup(papers, '2026-09', meta), meta);
    assert.equal(subject, 'Your September 2026 at journal club');
  });

  it('lists the papers with titles and marks the discussed ones', () => {
    const { text } = renderRoundup(buildRoundup(papers, '2026-09', meta), meta);
    assert.match(text, /You suggested 2 papers, and 1 was discussed\./);
    assert.match(text, /✓ 2609\.00001 — A neutrino paper/);
    assert.match(text, /· 2609\.00002\n/);
    assert.match(text, /Your papers got 3 votes\./);
    assert.match(text, /Subfields: Pheno\./);
  });

  it('never mentions other members and says how to stop', () => {
    const { text } = renderRoundup(buildRoundup(papers, '2026-09', meta), meta);
    assert.match(text, /Only you get this email/);
    assert.match(text, /To stop getting it/);
  });

  it('is kind about an empty month', () => {
    const { text } = renderRoundup(buildRoundup(papers, '2026-10', meta), meta);
    assert.match(text, /didn't suggest a paper this month/);
    assert.match(text, /Last month: 2 papers suggested, 1 discussed\./);
  });
});

// ── Recipients ────────────────────────────────────────────────

describe('roundupLogins', () => {
  it('joins the member lists and past submitters, lower-case and sorted', () => {
    const issues = [
      issue({ login: 'Carol', at: '2026-09-02T15:00:00Z' }),
      issue({ login: 'alice', at: '2026-09-03T15:00:00Z' }),
    ];
    assert.deepEqual(roundupLogins(issues, ['Bob', 'ALICE']), ['alice', 'bob', 'carol']);
  });

  it('skips the importer, bots and issues that are not visible papers', () => {
    const issues = [
      imported('Alice Chen', '3/4/2025 10:00:00', '2503.00001'),
      issue({ login: 'dependabot[bot]', at: '2026-09-02T15:00:00Z' }),
      issue({ login: 'dave', at: '2026-09-02T15:00:00Z', labels: [LABELS.needsApproval] }),
    ];
    assert.deepEqual(roundupLogins(issues, []), []);
  });
});

describe('parseOptOut', () => {
  it('splits on spaces, commas and new lines, ignoring case', () => {
    assert.deepEqual([...parseOptOut('Alice, bob\ncarol  ')], ['alice', 'bob', 'carol']);
  });

  it('is empty when unset', () => {
    assert.equal(parseOptOut(undefined).size, 0);
  });
});
