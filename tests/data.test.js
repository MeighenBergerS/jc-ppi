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
import { computeSubmissionStats } from '../site/assets/js/stats.js';

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

// ── computeSubmissionStats — week counts & busiest week ───────

describe('computeSubmissionStats — week aggregation', () => {
  it('weekCounts is non-empty for years with submissions', () => {
    const { weekCounts } = computeSubmissionStats(2025, allRows);
    assert.ok(weekCounts.size > 0);
  });

  it('busiestKey is null for a year with no submissions', () => {
    const { busiestKey } = computeSubmissionStats(2019, allRows);
    assert.equal(busiestKey, null);
  });

  it('busiestKey is non-null for years with submissions', () => {
    for (const year of [2025, 2026]) {
      const { busiestKey } = computeSubmissionStats(year, allRows);
      assert.notEqual(busiestKey, null, `busiestKey should not be null for ${year}`);
    }
  });

  it('busiestKey points to the week with the highest paper count', () => {
    for (const year of [2025, 2026]) {
      const { weekCounts, busiestKey } = computeSubmissionStats(year, allRows);
      const maxCount = Math.max(...weekCounts.values());
      assert.equal(weekCounts.get(busiestKey), maxCount, `busiestKey mismatch for ${year}`);
    }
  });

  it('busiestKey is a parseable ISO date string', () => {
    const { busiestKey } = computeSubmissionStats(2025, allRows);
    const parsed = new Date(busiestKey);
    assert.ok(!isNaN(parsed.getTime()), `busiestKey "${busiestKey}" is not parseable`);
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

// ── computeSubmissionStats — discussedCounts ────────────────────────────

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

describe('computeSubmissionStats — discussedCounts', () => {
  it('counts discussed papers correctly per submitter', () => {
    const { discussedCounts } = computeSubmissionStats(2099, DISC_ROWS);
    assert.equal(discussedCounts.get('Alice Chen'), 2);
    assert.equal(discussedCounts.get('Bob Martinez'), 1);
  });

  it('does not include submitters with no discussed papers', () => {
    const { discussedCounts } = computeSubmissionStats(2099, DISC_ROWS);
    assert.ok(!discussedCounts.has('Carol Liu'), 'Carol had no discussed papers');
  });

  it('undiscussed paper by the same submitter does not inflate their count', () => {
    // Bob has one discussed and one undiscussed paper; count should be 1, not 2
    const { discussedCounts } = computeSubmissionStats(2099, DISC_ROWS);
    assert.equal(discussedCounts.get('Bob Martinez'), 1);
  });

  it('dedup runs before counting: duplicate discussed paper counts once', () => {
    // 9901.00001 appears twice in DISC_ROWS (both discussed=TRUE, both Alice).
    // After dedup only one row survives, so Alice’s count is 2, not 3.
    const { discussedCounts } = computeSubmissionStats(2099, DISC_ROWS);
    assert.equal(discussedCounts.get('Alice Chen'), 2);
  });

  it('returns an empty Map when no rows have Discussed = TRUE', () => {
    const { discussedCounts } = computeSubmissionStats(2099, [
      mkDisc('Alice Chen', '9901.99001', ''),
      mkDisc('Bob Martinez', '9901.99002', 'FALSE'),
    ]);
    assert.equal(discussedCounts.size, 0);
  });

  it('rows without col 8 produce empty discussedCounts', () => {
    // Rows with only columns 0–4 should not crash; none are treated as discussed.
    const shortRows = [['2099-06-01 10:00:00', 'Alice', '9901.88001', '', 'TRUE']];
    const { discussedCounts } = computeSubmissionStats(2099, shortRows);
    assert.equal(discussedCounts.size, 0);
  });
});
