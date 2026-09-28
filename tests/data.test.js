/**
 * data.test.js — Tests for data transforms (deduplication, aggregation).
 * Run with: node --test tests/data.test.js
 *
 * Uses the synthetic fixture in tests/fixtures/submissions.csv which contains:
 *   - 40 data rows spanning 2025–2026
 *   - 3 duplicate arXiv IDs: 2602.24253 (×3) and 2602.10215 (×2)
 *   - Columns: Timestamp(0), Name(1), arXiv ID(2), Comment(3), Approved(4),
 *              Removed(5), EditedComment(6), Votes(7), Discussed(8)
 *
 * Inline row fixtures (year 2099) are used for edge-case duplicate patterns
 * and specific column-layout scenarios.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseCsv, normalizeArxivId, stripVersion } from '../site/assets/js/utils.js';
import { deduplicatePapers, weekHash } from '../site/assets/js/app.js';
import { computeSubmissionStats, yearWeeks, clubStreak, niceMax } from '../site/assets/js/stats.js';
import { voteLeader } from '../site/assets/js/cards.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV = readFileSync(join(__dirname, 'fixtures', 'submissions.csv'), 'utf8');

// Parse fixture once; allRows matches what stats.js init() produces.
const allRows = parseCsv(CSV)
  .slice(1)
  .filter((r) => r.length > 0 && r[0]);

// ── Fixture sanity ────────────────────────────────────────────

describe('fixture CSV', () => {
  it('contains exactly 40 data rows (after slicing header)', () => {
    assert.equal(allRows.length, 40);
  });

  it('every row has Approved = TRUE', () => {
    for (const r of allRows) {
      assert.equal(r[4]?.trim(), 'TRUE', `row missing TRUE: ${r}`);
    }
  });

  it('timestamps span 2025–2026', () => {
    const years = new Set(allRows.map((r) => new Date(r[0]).getFullYear()));
    assert.ok(years.has(2025));
    assert.ok(years.has(2026));
  });

  it('contains the 10 expected submitters', () => {
    const names = new Set(allRows.map((r) => r[1].trim()));
    for (const name of [
      'Alice Chen',
      'Bob Martinez',
      'Carol Liu',
      'David Osei',
      'Emma Walsh',
      'Frank Nguyen',
      'Grace Park',
      'Hector Reyes',
      'Ivan Petrov',
      'Judy Kim',
    ]) {
      assert.ok(names.has(name), `missing submitter "${name}"`);
    }
  });
});

// ── deduplicatePapers ─────────────────────────────────────────

describe('deduplicatePapers', () => {
  it('returns all rows when there are no duplicates', () => {
    const input = [
      ['2024-01-01', 'Alice', '2401.00001', '', 'TRUE'],
      ['2024-01-02', 'Bob', '2401.00002', '', 'TRUE'],
      ['2024-01-03', 'Carol', '2401.00003', '', 'TRUE'],
    ];
    assert.equal(deduplicatePapers(input).length, 3);
  });

  it('removes later duplicate, keeping the earliest submission', () => {
    const input = [
      ['2024-01-01 09:00:00', 'Alice', '2401.12345', 'first', 'TRUE'],
      ['2024-01-08 10:00:00', 'Bob', '2401.12345', 'second', 'TRUE'],
    ];
    const result = deduplicatePapers(input);
    assert.equal(result.length, 1);
    assert.equal(result[0][1], 'Alice'); // earliest submitter kept
  });

  it('treats a versioned ID (2410.00841v2) and its clean form as the same paper', () => {
    const input = [
      ['2024-10-01', 'Alice', '2410.00841v2', '', 'TRUE'],
      ['2024-10-08', 'Bob', '2410.00841', '', 'TRUE'],
    ];
    const result = deduplicatePapers(input);
    assert.equal(result.length, 1);
    assert.equal(result[0][1], 'Alice');
  });

  it('keeps rows with unrecognisable arXiv IDs (no false removal)', () => {
    const input = [
      ['2024-01-01', 'Alice', '', '', 'TRUE'],
      ['2024-01-02', 'Bob', 'not-an-id', '', 'TRUE'],
      ['2024-01-03', 'Carol', '2401.99999', '', 'TRUE'],
    ];
    // Rows without a recognised ID are passed through as-is
    const result = deduplicatePapers(input);
    assert.ok(result.length >= 1); // Carol's valid paper at minimum
  });

  it('handles empty input', () => {
    assert.deepEqual(deduplicatePapers([]), []);
  });

  it('removes exactly 3 duplicates from the full fixture', () => {
    // The fixture has 2602.24253 (×3) and 2602.10215 (×2).
    // Global dedup removes 2 + 1 = 3 later submissions.
    const result = deduplicatePapers(allRows);
    assert.equal(result.length, 37);
  });

  it('the duplicate IDs each appear exactly once in the deduplicated list', () => {
    const result = deduplicatePapers(allRows);
    const cleanIds = result.map((r) => stripVersion(normalizeArxivId(r[2])));
    const duplicatedIDs = ['2602.24253', '2602.10215'];
    for (const id of duplicatedIDs) {
      const count = cleanIds.filter((x) => x === id).length;
      assert.equal(count, 1, `expected exactly 1 occurrence of ${id}, got ${count}`);
    }
  });
});

// ── computeSubmissionStats — per-year paper counts ────────────

describe('computeSubmissionStats — paper counts per year', () => {
  it('2025: 10 raw rows, 10 unique papers (no intra-year dups)', () => {
    const { papers } = computeSubmissionStats(2025, allRows);
    assert.equal(papers.length, 10);
  });

  it('2026: 30 raw rows, 27 unique papers (3 intra-year dups)', () => {
    // 2602.24253 appears 3× (2 extras) and 2602.10215 appears 2× (1 extra).
    const { papers } = computeSubmissionStats(2026, allRows);
    assert.equal(papers.length, 27);
  });

  it('returns zero papers for a year with no submissions', () => {
    const { papers } = computeSubmissionStats(2019, allRows);
    assert.equal(papers.length, 0);
  });
});

// ── computeSubmissionStats — member counts ────────────────────

describe('computeSubmissionStats — member counts', () => {
  it('2025: all 10 submitters have exactly 1 paper each (no intra-year dups)', () => {
    const { memberCounts } = computeSubmissionStats(2025, allRows);
    assert.equal(memberCounts.size, 10);
    for (const [name, count] of memberCounts) {
      assert.equal(count, 1, `${name} should have 1 paper in 2025`);
    }
  });

  it('2025: member counts sum to 10', () => {
    const { memberCounts } = computeSubmissionStats(2025, allRows);
    const total = [...memberCounts.values()].reduce((a, b) => a + b, 0);
    assert.equal(total, 10);
  });

  it('2026: Bob Martinez keeps 2602.24253 (first submitter); Carol Liu and Frank Nguyen deduped away', () => {
    const { memberCounts } = computeSubmissionStats(2026, allRows);
    assert.equal(memberCounts.get('Bob Martinez'), 3); // retains 2602.24253
    assert.equal(memberCounts.get('Carol Liu'), 2); // loses 2602.24253 dup
    assert.equal(memberCounts.get('Frank Nguyen'), 2); // loses 2602.24253 dup
  });

  it('2026: Alice Chen keeps 2602.10215 (first submitter); Hector Reyes deduped away', () => {
    const { memberCounts } = computeSubmissionStats(2026, allRows);
    assert.equal(memberCounts.get('Alice Chen'), 3); // retains 2602.10215
    assert.equal(memberCounts.get('Hector Reyes'), 2); // loses 2602.10215 dup
  });

  it('2026: member counts sum to 27', () => {
    const { memberCounts } = computeSubmissionStats(2026, allRows);
    const total = [...memberCounts.values()].reduce((a, b) => a + b, 0);
    assert.equal(total, 27);
  });

  it('empty year: memberCounts is an empty Map', () => {
    const { memberCounts } = computeSubmissionStats(2019, allRows);
    assert.equal(memberCounts.size, 0);
  });
});

// ── computeSubmissionStats — week counts ──────────────────────

describe('computeSubmissionStats — week aggregation', () => {
  it('weekCounts is non-empty for years with submissions', () => {
    const { weekCounts } = computeSubmissionStats(2025, allRows);
    assert.ok(weekCounts.size > 0);
  });

  it('week sums equal unique paper count for each year', () => {
    for (const year of [2025, 2026]) {
      const { papers, weekCounts } = computeSubmissionStats(year, allRows);
      const sumFromWeeks = [...weekCounts.values()].reduce((a, b) => a + b, 0);
      assert.equal(
        sumFromWeeks,
        papers.length,
        `week sum mismatch for ${year}: ${sumFromWeeks} vs ${papers.length}`
      );
    }
  });
});

// ── weekHash ──────────────────────────────────────────────────

// Helper: build a minimal paper row for weekHash.
// Indices: 0=ts, 1=name, 2=arxivId, 3=comment, 4=approved,
//          5=removed, 6=editedComment, 7=votes, 8=discussed
const mkRow = (arxivId, votes = '', discussed = '') => [
  'ts',
  'name',
  arxivId,
  'comment',
  'TRUE',
  '',
  '',
  votes,
  discussed,
];

describe('weekHash', () => {
  it('returns a string', () => {
    assert.equal(typeof weekHash([mkRow('2401.00001', '5', 'TRUE')]), 'string');
  });

  it('returns an empty string for an empty array', () => {
    assert.equal(weekHash([]), '');
  });

  it('same inputs produce the same hash', () => {
    const papers = [mkRow('2401.00001', '3', 'TRUE'), mkRow('2401.00002', '0', '')];
    assert.equal(weekHash(papers), weekHash(papers));
  });

  it('incrementing a vote count changes the hash', () => {
    const before = [mkRow('2401.00001', '3', ''), mkRow('2401.00002', '1', '')];
    const after = [mkRow('2401.00001', '4', ''), mkRow('2401.00002', '1', '')];
    assert.notEqual(weekHash(before), weekHash(after));
  });

  it('toggling discussed on a paper changes the hash', () => {
    const before = [mkRow('2401.00001', '0', '')];
    const after = [mkRow('2401.00001', '0', 'TRUE')];
    assert.notEqual(weekHash(before), weekHash(after));
  });

  it('adding a paper changes the hash', () => {
    const before = [mkRow('2401.00001', '0', '')];
    const after = [mkRow('2401.00001', '0', ''), mkRow('2401.00002', '0', '')];
    assert.notEqual(weekHash(before), weekHash(after));
  });

  it('removing a paper changes the hash', () => {
    const before = [mkRow('2401.00001', '0', ''), mkRow('2401.00002', '0', '')];
    const after = [mkRow('2401.00001', '0', '')];
    assert.notEqual(weekHash(before), weekHash(after));
  });

  it('changing only a comment (untracked field) does not change the hash', () => {
    // weekHash only tracks arxivId, votes, and discussed—not the comment
    const before = [['ts', 'name', '2401.00001', 'Old comment', 'TRUE', '', '', '0', '']];
    const after = [['ts', 'name', '2401.00001', 'New comment', 'TRUE', '', '', '0', '']];
    assert.equal(weekHash(before), weekHash(after));
  });
});

// ── computeSubmissionStats — monthCounts ────────────────────────────────

// Inline rows in year 2099 to avoid collisions with the fixture.
// Full column set: [ts(0), name(1), arxivId(2), comment(3), approved(4),
//                   removed(5), editedComment(6), votes(7), discussed(8)]
const mkDisc = (name, arxivId, discussed) => [
  '2099-01-07 10:00:00',
  name,
  arxivId,
  '',
  'TRUE',
  '',
  '',
  '0',
  discussed,
];

// Six rows: 5 unique arXiv IDs + one duplicate of the first.
// After dedup: 5 papers remain.
const DISC_ROWS = [
  mkDisc('Alice Chen', '9901.00001', 'TRUE'), // Alice: discussed
  mkDisc('Alice Chen', '9901.00002', 'TRUE'), // Alice: discussed (2 total)
  mkDisc('Bob Martinez', '9901.00003', 'TRUE'), // Bob: discussed
  mkDisc('Bob Martinez', '9901.00004', ''), // Bob: NOT discussed
  mkDisc('Carol Liu', '9901.00005', 'FALSE'), // Carol: explicitly FALSE
  mkDisc('Alice Chen', '9901.00001', 'TRUE'), // duplicate — dropped by dedup
];

describe('computeSubmissionStats — monthCounts', () => {
  it('has twelve months', () => {
    const { monthCounts } = computeSubmissionStats(2099, DISC_ROWS);
    assert.equal(monthCounts.length, 12);
  });

  it('counts suggested and discussed papers per month, after dedup', () => {
    // All DISC_ROWS are in January; 5 unique papers, 3 discussed.
    const { monthCounts } = computeSubmissionStats(2099, DISC_ROWS);
    assert.deepEqual(monthCounts[0], { suggested: 5, discussed: 3, people: 3 });
    assert.ok(monthCounts.slice(1).every((m) => m.suggested === 0 && m.people === 0));
  });

  it('puts each paper in the month it was suggested', () => {
    const rows = [
      ['2099-03-15 10:00:00', 'Alice', '9903.00001', '', 'TRUE', '', '', '0', 'TRUE'],
      ['2099-12-31 23:00:00', 'Bob', '9912.00001', '', 'TRUE', '', '', '0', ''],
    ];
    const { monthCounts } = computeSubmissionStats(2099, rows);
    assert.deepEqual(monthCounts[2], { suggested: 1, discussed: 1, people: 1 });
    assert.deepEqual(monthCounts[11], { suggested: 1, discussed: 0, people: 1 });
  });

  it('month totals add up to the year total in the fixture', () => {
    for (const year of [2025, 2026]) {
      const { papers, monthCounts } = computeSubmissionStats(year, allRows);
      const sum = monthCounts.reduce((a, m) => a + m.suggested, 0);
      assert.equal(sum, papers.length, `month totals mismatch for ${year}`);
    }
  });

  it('rows without col 8 count as not discussed', () => {
    const shortRows = [['2099-06-01 10:00:00', 'Alice', '9901.88001', '', 'TRUE']];
    const { monthCounts } = computeSubmissionStats(2099, shortRows);
    assert.deepEqual(monthCounts[5], { suggested: 1, discussed: 0, people: 1 });
  });
});

// ── yearWeeks ───────────────────────────────────────────────

describe('yearWeeks', () => {
  it('starts on the Monday of the week holding January 1', () => {
    // 1 January 2025 is a Wednesday.
    const [first] = yearWeeks(2025);
    assert.equal(first.getDay(), 1);
    assert.deepEqual([first.getFullYear(), first.getMonth(), first.getDate()], [2024, 11, 30]);
  });

  it('gives consecutive Mondays through the last one in the year', () => {
    const weeks = yearWeeks(2025);
    assert.equal(weeks.length, 53);
    const last = weeks.at(-1);
    assert.deepEqual([last.getFullYear(), last.getMonth(), last.getDate()], [2025, 11, 29]);
    for (const monday of weeks) assert.equal(monday.getDay(), 1);
  });

  it('matches the keys in weekCounts', () => {
    const keys = new Set(yearWeeks(2025).map((d) => d.toISOString()));
    const { weekCounts } = computeSubmissionStats(2025, allRows);
    for (const key of weekCounts.keys()) assert.ok(keys.has(key), `${key} not a week of 2025`);
  });
});

// ── voteLeader ──────────────────────────────────────────────

describe('voteLeader', () => {
  const row = (id, votes, discussed = '') => [
    'ts',
    'n',
    id,
    '',
    'TRUE',
    '',
    '',
    String(votes),
    discussed,
  ];

  it('is the paper with the most votes', () => {
    const lead = row('b', 3);
    assert.equal(voteLeader([row('a', 1), lead, row('c', 0)]), lead);
  });

  it('is null on a tie for the most votes', () => {
    assert.equal(voteLeader([row('a', 2), row('b', 2)]), null);
  });

  it('is null without votes or papers', () => {
    assert.equal(voteLeader([row('a', 0)]), null);
    assert.equal(voteLeader([]), null);
  });

  it('is null once a paper has been discussed', () => {
    assert.equal(voteLeader([row('a', 5), row('b', 1, 'TRUE')]), null);
  });
});

// ── computeSubmissionStats — discussed and growth ─────────────

describe('computeSubmissionStats — discussed and growth', () => {
  it('discussed is the year total, after dedup', () => {
    assert.equal(computeSubmissionStats(2099, DISC_ROWS).discussed, 3);
  });

  it('growth has running totals, one entry per week up to now', () => {
    const rows = [
      ['2099-01-05 10:00:00', 'Alice', '9901.00011', '', 'TRUE', '', '', '0', 'TRUE'],
      ['2099-01-06 10:00:00', 'Bob', '9901.00012', '', 'TRUE', '', '', '0', ''],
      ['2099-01-20 10:00:00', 'alice', '9901.00013', '', 'TRUE', '', '', '0', ''],
    ];
    const now = new Date(2099, 0, 22);
    const { growth } = computeSubmissionStats(2099, rows, now);
    assert.ok(growth.every((g) => g.monday <= now));
    const last = growth.at(-1);
    assert.deepEqual([last.papers, last.discussed, last.people], [3, 1, 2]);
    const totals = growth.map((g) => g.papers);
    assert.ok(
      totals.every((t, i) => i === 0 || t >= totals[i - 1]),
      'never decreases'
    );
  });

  it('growth stops at the week holding now', () => {
    const now = new Date(2099, 1, 1);
    const { growth } = computeSubmissionStats(2099, DISC_ROWS, now);
    assert.ok(growth.length >= 5 && growth.length <= 6);
  });
});

// ── clubStreak ──────────────────────────────────────────────

describe('clubStreak', () => {
  const at = (d) => [d, 'A', '9901.00001', '', 'TRUE', '', '', '0', ''];
  // Mondays: 2099-01-05, 01-12, 01-19, 01-26
  const rows = ['2099-01-06 10:00:00', '2099-01-13 10:00:00', '2099-01-21 10:00:00'].map(at);

  it('counts consecutive weeks with a paper', () => {
    assert.equal(clubStreak(rows, new Date(2099, 0, 22)), 3);
  });

  it('lets the week in progress be empty', () => {
    assert.equal(clubStreak(rows, new Date(2099, 0, 27)), 3);
  });

  it('ends after a whole week without a paper', () => {
    assert.equal(clubStreak(rows, new Date(2099, 1, 3)), 0);
  });

  it('is zero without papers', () => {
    assert.equal(clubStreak([], new Date(2099, 0, 22)), 0);
  });
});

describe('niceMax', () => {
  it('rounds up to 5, 10, 20, 25, 50, 100, …', () => {
    assert.deepEqual([0, 3, 7, 12, 21, 26, 60, 101].map(niceMax), [5, 5, 10, 20, 25, 50, 100, 200]);
  });
});
