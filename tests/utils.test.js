/**
 * utils.test.js — Tests for utils.js pure functions.
 * Run with: node --test tests/utils.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  weekStart,
  fmtWeekRange,
  parseCsv,
  normalizeArxivId,
  stripVersion,
  isValidArxivId,
} from '../site/assets/js/utils.js';

// ── weekStart ─────────────────────────────────────────────────

describe('weekStart', () => {
  it('returns a Monday (getDay() === 1)', () => {
    const dates = [
      '2024-03-11', // Monday
      '2024-03-12', // Tuesday
      '2024-03-13', // Wednesday
      '2024-03-14', // Thursday
      '2024-03-15', // Friday
      '2024-03-16', // Saturday
      '2024-03-17', // Sunday
    ];
    for (const d of dates) {
      assert.equal(weekStart(new Date(d)).getDay(), 1, `failed for ${d}`);
    }
  });

  it('returns local midnight (hours/minutes/seconds all zero)', () => {
    const w = weekStart(new Date('2024-03-15 14:32:00'));
    assert.equal(w.getHours(), 0);
    assert.equal(w.getMinutes(), 0);
    assert.equal(w.getSeconds(), 0);
    assert.equal(w.getMilliseconds(), 0);
  });

  it('Monday returns the same day', () => {
    const monday = new Date(2024, 2, 11); // local midnight Mon Mar 11 2024
    const result = weekStart(monday);
    assert.equal(result.getDate(), 11);
    assert.equal(result.getMonth(), 2); // 0-indexed March
    assert.equal(result.getFullYear(), 2024);
  });

  it('Sunday returns the previous Monday (not the next)', () => {
    // 2024-03-17 is a Sunday; previous Monday is 2024-03-11
    const sunday = new Date(2024, 2, 17); // local midnight Sun Mar 17 2024
    const result = weekStart(sunday);
    assert.equal(result.getDate(), 11);
    assert.equal(result.getMonth(), 2);
  });

  it('handles cross-month boundary (Thursday Mar 2 → Monday Feb 27)', () => {
    const date = new Date(2023, 2, 2); // local midnight Thu Mar 2 2023
    const result = weekStart(date);
    assert.equal(result.getDate(), 27);
    assert.equal(result.getMonth(), 1); // February
  });

  it('handles cross-year boundary (Wednesday Jan 1 2025 → Monday Dec 30 2024)', () => {
    const date = new Date(2025, 0, 1); // local midnight Wed Jan 1 2025
    const result = weekStart(date);
    assert.equal(result.getDate(), 30);
    assert.equal(result.getMonth(), 11); // December
    assert.equal(result.getFullYear(), 2024);
  });

  it('two dates in the same week return the same ISO key', () => {
    const tuesday = new Date(2024, 6, 9); // Tue Jul 9 2024
    const thursday = new Date(2024, 6, 11); // Thu Jul 11 2024
    assert.equal(weekStart(tuesday).toISOString(), weekStart(thursday).toISOString());
  });

  it('dates in adjacent weeks return different ISO keys', () => {
    const friday = new Date(2024, 6, 12); // Fri Jul 12 2024
    const monday = new Date(2024, 6, 15); // Mon Jul 15 2024
    assert.notEqual(weekStart(friday).toISOString(), weekStart(monday).toISOString());
  });
});

// ── fmtWeekRange ──────────────────────────────────────────────

describe('fmtWeekRange', () => {
  it('includes the year in the output', () => {
    const monday = new Date(2024, 2, 11); // Mon Mar 11 2024
    assert.ok(fmtWeekRange(monday).includes('2024'));
  });

  it('includes the month names of start and end', () => {
    const monday = new Date(2024, 2, 11); // Mon Mar 11 2024 → Mar 11 – Mar 17
    const result = fmtWeekRange(monday);
    assert.ok(result.includes('Mar'), `expected "Mar" in "${result}"`);
  });

  it('cross-month range includes both month names', () => {
    // Mon Mar 25 2024: week runs Mar 25 – Mar 31
    const monday = new Date(2024, 2, 25);
    const result = fmtWeekRange(monday);
    assert.ok(result.includes('Mar'), `expected "Mar" in "${result}"`);
    assert.ok(result.includes('31') || result.includes('Mar 31'), `expected "31" in "${result}"`);
  });

  it('contains an en-dash separator', () => {
    const result = fmtWeekRange(new Date(2024, 0, 8)); // Mon Jan 8 2024
    assert.ok(result.includes('\u2013'), `expected en-dash in "${result}"`);
  });

  it('Sunday is 6 days after the supplied Monday', () => {
    // Mon May 12 2025 → week ends Sun May 18 2025
    const monday = new Date(2025, 4, 12);
    const result = fmtWeekRange(monday);
    assert.ok(result.includes('12'), `expected "12" in "${result}"`);
    assert.ok(result.includes('18'), `expected "18" in "${result}"`);
  });
});

// ── parseCsv ─────────────────────────────────────────────────

describe('parseCsv', () => {
  it('parses a single row', () => {
    const rows = parseCsv('a,b,c\n');
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], ['a', 'b', 'c']);
  });

  it('parses multiple rows', () => {
    const rows = parseCsv('a,b\nc,d\n');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[1], ['c', 'd']);
  });

  it('handles a quoted field containing a comma', () => {
    const rows = parseCsv('Alice,"hello, world",TRUE\n');
    assert.equal(rows[0][1], 'hello, world');
  });

  it('handles escaped double-quotes inside a quoted field', () => {
    const rows = parseCsv('"say ""hello""",b\n');
    assert.equal(rows[0][0], 'say "hello"');
  });

  it('handles CRLF line endings', () => {
    const rows = parseCsv('a,b\r\nc,d\r\n');
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], ['a', 'b']);
    assert.deepEqual(rows[1], ['c', 'd']);
  });

  it('handles file with no trailing newline', () => {
    const rows = parseCsv('a,b,c');
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], ['a', 'b', 'c']);
  });

  it('preserves empty fields', () => {
    const rows = parseCsv('a,,c\n');
    assert.equal(rows[0][1], '');
    assert.equal(rows[0][2], 'c');
  });

  it('returns an empty array for empty input', () => {
    assert.deepEqual(parseCsv(''), []);
  });

  it('parses the real fixture header correctly', () => {
    const header = 'Timestamp,Name,arXiv ID,Comment,Approved\n';
    const rows = parseCsv(header);
    assert.deepEqual(rows[0], ['Timestamp', 'Name', 'arXiv ID', 'Comment', 'Approved']);
  });
});

// ── normalizeArxivId ──────────────────────────────────────────

describe('normalizeArxivId', () => {
  it('returns a plain YYMM.NNNNN ID as-is', () => {
    assert.equal(normalizeArxivId('2301.12345'), '2301.12345');
  });

  it('extracts the ID from a full arXiv abstract URL', () => {
    assert.equal(normalizeArxivId('https://arxiv.org/abs/2301.12345'), '2301.12345');
  });

  it('preserves the version suffix from a URL', () => {
    assert.equal(normalizeArxivId('https://arxiv.org/abs/2301.12345v2'), '2301.12345v2');
  });

  it('preserves the version suffix on a bare ID', () => {
    assert.equal(normalizeArxivId('2301.12345v3'), '2301.12345v3');
  });

  it('handles old-style hep-ph/XXXXXXX IDs', () => {
    assert.equal(normalizeArxivId('hep-ph/9901001'), 'hep-ph/9901001');
  });

  it('handles old-style IDs in a URL', () => {
    assert.equal(normalizeArxivId('https://arxiv.org/abs/hep-ph/9901001'), 'hep-ph/9901001');
  });

  it('returns empty string for null/undefined', () => {
    assert.equal(normalizeArxivId(null), '');
    assert.equal(normalizeArxivId(undefined), '');
  });

  it('trims surrounding whitespace', () => {
    assert.equal(normalizeArxivId('  2301.12345  '), '2301.12345');
  });
});

// ── stripVersion ─────────────────────────────────────────────

describe('stripVersion', () => {
  it('removes a v1 suffix', () => {
    assert.equal(stripVersion('2301.12345v1'), '2301.12345');
  });

  it('removes a v3 suffix', () => {
    assert.equal(stripVersion('2301.12345v3'), '2301.12345');
  });

  it('leaves a clean ID unchanged', () => {
    assert.equal(stripVersion('2301.12345'), '2301.12345');
  });

  it('is null-safe (undefined)', () => {
    assert.equal(stripVersion(undefined), '');
  });

  it('is null-safe (null)', () => {
    assert.equal(stripVersion(null), '');
  });

  it('is null-safe (empty string)', () => {
    assert.equal(stripVersion(''), '');
  });

  it('stripVersion ∘ normalizeArxivId yields a clean bare ID from a versioned URL', () => {
    const raw = 'https://arxiv.org/abs/2410.00841v2';
    assert.equal(stripVersion(normalizeArxivId(raw)), '2410.00841');
  });
});

// ── isValidArxivId ──────────────────────────────────────────

describe('isValidArxivId', () => {
  // ─ Valid modern IDs ─────────────────────────────────
  it('accepts a standard 5-digit modern ID', () => {
    assert.ok(isValidArxivId('2301.12345'));
  });

  it('accepts a 4-digit modern ID', () => {
    assert.ok(isValidArxivId('0708.1137')); // valid: August 2007, paper 1137
  });

  it('accepts an early 4-digit modern ID (2007 era)', () => {
    assert.ok(isValidArxivId('0704.0001'));
  });

  // ─ Valid old-style IDs ─────────────────────────────
  it('accepts an old-style hep-ph ID', () => {
    assert.ok(isValidArxivId('hep-ph/9901123'));
  });

  it('accepts an old-style astro-ph ID', () => {
    assert.ok(isValidArxivId('astro-ph/0503354'));
  });

  // ─ Invalid IDs that should be caught ─────────────────
  it('rejects 3-digit prefix (708.1137 — the real-world bug)', () => {
    assert.ok(!isValidArxivId('708.1137'));
  });

  it('rejects 5-digit prefix', () => {
    assert.ok(!isValidArxivId('23011.2345'));
  });

  it('rejects too-short suffix (3 digits)', () => {
    assert.ok(!isValidArxivId('2301.123'));
  });

  it('rejects too-long suffix (6 digits)', () => {
    assert.ok(!isValidArxivId('2301.123456'));
  });

  it('rejects a bare word', () => {
    assert.ok(!isValidArxivId('notanid'));
  });

  it('rejects a URL (must be pre-normalised)', () => {
    assert.ok(!isValidArxivId('https://arxiv.org/abs/2301.12345'));
  });

  it('rejects a versioned ID (must be pre-stripped)', () => {
    assert.ok(!isValidArxivId('2301.12345v2'));
  });

  it('rejects null', () => {
    assert.ok(!isValidArxivId(null));
  });

  it('rejects undefined', () => {
    assert.ok(!isValidArxivId(undefined));
  });

  it('rejects empty string', () => {
    assert.ok(!isValidArxivId(''));
  });

  it('composition: stripVersion ∘ normalizeArxivId passes isValidArxivId for a real ID', () => {
    const clean = stripVersion(normalizeArxivId('https://arxiv.org/abs/2301.12345v2'));
    assert.ok(isValidArxivId(clean));
  });

  it('composition: stripVersion ∘ normalizeArxivId fails isValidArxivId for 708.1137', () => {
    const clean = stripVersion(normalizeArxivId('708.1137'));
    assert.ok(!isValidArxivId(clean));
  });

  // Zero-padding fallback — the logic inspire.js uses to auto-correct 3-digit prefixes
  it('zero-padding 708.1137 produces a valid ID', () => {
    const original = '708.1137';
    assert.ok(!isValidArxivId(original), 'original should be invalid');
    const padded = /^\d{3}\./.test(original) ? '0' + original : null;
    assert.equal(padded, '0708.1137');
    assert.ok(isValidArxivId(padded), 'padded form should be valid');
  });

  it('zero-padding does not apply to a 2-digit prefix (8.1137)', () => {
    const original = '8.1137';
    assert.ok(!isValidArxivId(original), 'original should be invalid');
    const padded = /^\d{3}\./.test(original) ? '0' + original : null;
    assert.equal(padded, null, 'should not attempt padding for non-3-digit prefix');
  });
});
