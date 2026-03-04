/**
 * data.test.js — Tests for data transforms (deduplication, aggregation).
 * Run with: node --test tests/data.test.js
 *
 * Uses the synthetic fixture in tests/fixtures/submissions.csv which contains:
 *   - 102 data rows spanning 2021–2025
 *   - 7 intentional duplicate arXiv ID pairs (same paper, different submitters)
 *   - 1 versioned arXiv ID (2410.00841v2) to exercise stripVersion
 *   - Columns: Timestamp(0), Name(1), arXiv ID(2), Comment(3), Approved(4)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseCsv, normalizeArxivId, stripVersion } from '../site/assets/js/utils.js';
import { deduplicatePapers } from '../site/assets/js/app.js';
import { computeSubmissionStats } from '../site/assets/js/stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV = readFileSync(join(__dirname, 'fixtures', 'submissions.csv'), 'utf8');

// Parse fixture once; allRows matches what stats.js init() produces.
const allRows = parseCsv(CSV)
  .slice(1)
  .filter((r) => r.length > 0 && r[0]);

// ── Fixture sanity ────────────────────────────────────────────

describe('fixture CSV', () => {
  it('contains exactly 102 data rows (after slicing header)', () => {
    assert.equal(allRows.length, 102);
  });

  it('every row has Approved = TRUE', () => {
    for (const r of allRows) {
      assert.equal(r[4]?.trim(), 'TRUE', `row missing TRUE: ${r}`);
    }
  });

  it('timestamps span 2021–2025', () => {
    const years = new Set(allRows.map((r) => new Date(r[0]).getFullYear()));
    assert.ok(years.has(2021));
    assert.ok(years.has(2022));
    assert.ok(years.has(2023));
    assert.ok(years.has(2024));
    assert.ok(years.has(2025));
  });

  it('contains the 8 expected submitters', () => {
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

  it('removes exactly 7 duplicates from the full fixture', () => {
    // The fixture has 7 arXiv IDs submitted by two different people.
    // Global dedup should remove the 7 later submissions.
    const result = deduplicatePapers(allRows);
    assert.equal(result.length, 95);
  });

  it('the version-suffix row (2410.00841v2) survives as a unique paper globally', () => {
    const result = deduplicatePapers(allRows);
    const ids = result.map((r) => r[2].trim());
    // The v-suffix ID has no plain-version counterpart in the fixture
    assert.ok(ids.includes('2410.00841v2'));
  });

  it('the duplicate IDs each appear exactly once in the deduplicated list', () => {
    const result = deduplicatePapers(allRows);
    const cleanIds = result.map((r) => stripVersion(normalizeArxivId(r[2])));
    const duplicatedIDs = [
      '2104.07421',
      '2109.05433',
      '2207.03764',
      '2301.03086',
      '2309.08679',
      '2402.07987',
      '2403.14059',
    ];
    for (const id of duplicatedIDs) {
      const count = cleanIds.filter((x) => x === id).length;
      assert.equal(count, 1, `expected exactly 1 occurrence of ${id}, got ${count}`);
    }
  });
});

// ── computeSubmissionStats — per-year paper counts ────────────

describe('computeSubmissionStats — paper counts per year', () => {
  it('2021: 30 raw rows, 29 unique papers (one intra-year dup)', () => {
    const { papers } = computeSubmissionStats(2021, allRows);
    assert.equal(papers.length, 29);
  });

  it('2022: 30 raw rows, 29 unique papers (one intra-year dup)', () => {
    const { papers } = computeSubmissionStats(2022, allRows);
    assert.equal(papers.length, 29);
  });

  it('2023: 22 raw rows, 20 unique papers (two intra-year dups)', () => {
    const { papers } = computeSubmissionStats(2023, allRows);
    assert.equal(papers.length, 20);
  });

  it('2024: 15 raw rows, 13 unique papers (two intra-year dups)', () => {
    const { papers } = computeSubmissionStats(2024, allRows);
    assert.equal(papers.length, 13);
  });

  it('2025: 5 raw rows, 5 unique papers (no dups)', () => {
    const { papers } = computeSubmissionStats(2025, allRows);
    assert.equal(papers.length, 5);
  });

  it('returns zero papers for a year with no submissions', () => {
    const { papers } = computeSubmissionStats(2019, allRows);
    assert.equal(papers.length, 0);
  });

  it('cross-year duplicate (2109.05433) appears in both 2021 and 2022', () => {
    // David submitted in 2021; Bob submitted the same ID in 2022.
    // Each year's stats counts it independently (year filter runs before dedup).
    const { papers: p21 } = computeSubmissionStats(2021, allRows);
    const { papers: p22 } = computeSubmissionStats(2022, allRows);
    const ids21 = p21.map((r) => r[2].trim());
    const ids22 = p22.map((r) => r[2].trim());
    assert.ok(ids21.includes('2109.05433'), '2109.05433 should appear in 2021 stats');
    assert.ok(ids22.includes('2109.05433'), '2109.05433 should appear in 2022 stats');
  });
});

// ── computeSubmissionStats — member counts ────────────────────

describe('computeSubmissionStats — member counts', () => {
  it('2021: Alice Chen submitted 3 papers', () => {
    const { memberCounts } = computeSubmissionStats(2021, allRows);
    assert.equal(memberCounts.get('Alice Chen'), 3);
  });

  it('2021: 8 distinct submitters', () => {
    const { memberCounts } = computeSubmissionStats(2021, allRows);
    assert.equal(memberCounts.size, 8);
  });

  it('2021: member counts sum to the unique paper count (29)', () => {
    const { memberCounts } = computeSubmissionStats(2021, allRows);
    const total = [...memberCounts.values()].reduce((a, b) => a + b, 0);
    assert.equal(total, 29);
  });

  it('2022: Grace Park has 2 papers (one deduped as she submitted the same as Carol)', () => {
    const { memberCounts } = computeSubmissionStats(2022, allRows);
    assert.equal(memberCounts.get('Grace Park'), 2);
  });

  it('2022: member counts sum to 29', () => {
    const { memberCounts } = computeSubmissionStats(2022, allRows);
    const total = [...memberCounts.values()].reduce((a, b) => a + b, 0);
    assert.equal(total, 29);
  });

  it('2024: uses Frank Nguyen count of 1 (row 92 deduped; row 84 kept)', () => {
    const { memberCounts } = computeSubmissionStats(2024, allRows);
    assert.equal(memberCounts.get('Frank Nguyen'), 1);
  });

  it('2024: member counts sum to 13', () => {
    const { memberCounts } = computeSubmissionStats(2024, allRows);
    const total = [...memberCounts.values()].reduce((a, b) => a + b, 0);
    assert.equal(total, 13);
  });

  it('2025: each of the 5 submitters has exactly 1 paper', () => {
    const { memberCounts } = computeSubmissionStats(2025, allRows);
    assert.equal(memberCounts.size, 5);
    for (const [name, count] of memberCounts) {
      assert.equal(count, 1, `${name} should have 1 paper in 2025`);
    }
  });

  it('empty year: memberCounts is an empty Map', () => {
    const { memberCounts } = computeSubmissionStats(2019, allRows);
    assert.equal(memberCounts.size, 0);
  });
});

// ── computeSubmissionStats — week counts & busiest week ───────

describe('computeSubmissionStats — week aggregation', () => {
  it('weekCounts is non-empty for years with submissions', () => {
    const { weekCounts } = computeSubmissionStats(2021, allRows);
    assert.ok(weekCounts.size > 0);
  });

  it('busiestKey is null for a year with no submissions', () => {
    const { busiestKey } = computeSubmissionStats(2019, allRows);
    assert.equal(busiestKey, null);
  });

  it('busiestKey is non-null for years with submissions', () => {
    for (const year of [2021, 2022, 2023, 2024, 2025]) {
      const { busiestKey } = computeSubmissionStats(year, allRows);
      assert.notEqual(busiestKey, null, `busiestKey should not be null for ${year}`);
    }
  });

  it('busiestKey points to the week with the highest paper count', () => {
    for (const year of [2021, 2022, 2023, 2024]) {
      const { weekCounts, busiestKey } = computeSubmissionStats(year, allRows);
      const maxCount = Math.max(...weekCounts.values());
      assert.equal(weekCounts.get(busiestKey), maxCount, `busiestKey mismatch for ${year}`);
    }
  });

  it('busiestKey is a parseable ISO date string', () => {
    const { busiestKey } = computeSubmissionStats(2021, allRows);
    const parsed = new Date(busiestKey);
    assert.ok(!isNaN(parsed.getTime()), `busiestKey "${busiestKey}" is not parseable`);
  });

  it('week sums equal unique paper count for each year', () => {
    for (const year of [2021, 2022, 2023, 2024, 2025]) {
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
