/**
 * inspire.test.js — Tests for parseHit() in inspire.js.
 * Run with: node --test tests/inspire.test.js
 *
 * Uses the synthetic fixture in tests/fixtures/inspire-response.json which
 * contains 5 INSPIRE API hit objects with various edge cases:
 *   hits[0] 2207.03764 — LZ first results (6 authors → et al., dup categories, CERN keyword)
 *   hits[1] 2107.14476 — Glashow resonance (4 authors → no et al.)
 *   hits[2] 2103.00685 — LHAASO PeVatrons (3 authors, Astrophysics)
 *   hits[3] 2301.03086 — IceCube Galactic Plane (5 authors → et al.)
 *   hits[4] 2101.03729 — XENONnT stub (null citations, empty titles/authors)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseHit } from '../site/assets/js/inspire.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'inspire-response.json'), 'utf8')
);

const hits = fixture.hits.hits;

// Each hit's `.metadata` is what _parseHit / parseHit actually receives.
const lz = hits[0].metadata; // 2207.03764
const glashow = hits[1].metadata; // 2107.14476
const lhaaso = hits[2].metadata; // 2103.00685
const icecube = hits[3].metadata; // 2301.03086
const xenon = hits[4].metadata; // 2101.03729 – stub / null fields

// ── Basic extraction ──────────────────────────────────────────

describe('parseHit — basic field extraction', () => {
  it('extracts INSPIRE record ID', () => {
    const result = parseHit(lz);
    assert.equal(result.inspireId, 2118654);
  });

  it('extracts the paper title', () => {
    const result = parseHit(lz);
    assert.ok(result.title.includes('LZ'), `expected LZ in title, got: "${result.title}"`);
  });

  it('extracts citation count', () => {
    const result = parseHit(lz);
    assert.equal(result.citations, 412);
  });

  it('extracts citation count for Glashow paper', () => {
    const result = parseHit(glashow);
    assert.equal(result.citations, 287);
  });

  it('extracts abstract', () => {
    const result = parseHit(lz);
    assert.ok(typeof result.abstract === 'string');
    assert.ok(result.abstract.length > 0);
  });
});

// ── Author formatting ─────────────────────────────────────────

describe('parseHit — author truncation', () => {
  it('truncates 6-author paper to "A, B, C, D et al."', () => {
    const result = parseHit(lz);
    assert.ok(
      result.authors.endsWith('et al.'),
      `expected "et al." suffix, got: "${result.authors}"`
    );
    // The first fixture author should appear in the truncated string
    assert.ok(result.authors.includes('Aalbers'), `expected first author "Aalbers" to be present`);
    // The 5th author (Abreu) should NOT appear — sliced off
    assert.ok(
      !result.authors.includes('Abreu'),
      `5th author "Abreu" should be absent (sliced to 4)`
    );
  });

  it('does not append et al. to 4-author paper', () => {
    const result = parseHit(glashow);
    assert.ok(!result.authors.includes('et al.'), `unexpected et al. in: "${result.authors}"`);
    // All 4 fixture authors should appear
    assert.ok(result.authors.includes('Abbasi'), 'expected Abbasi');
    assert.ok(result.authors.includes('Aguilar'), 'expected Aguilar (last author)');
  });

  it('does not append et al. to 3-author paper', () => {
    const result = parseHit(lhaaso);
    assert.ok(!result.authors.includes('et al.'));
  });

  it('truncates 5-author paper to et al.', () => {
    const result = parseHit(icecube);
    assert.ok(result.authors.endsWith('et al.'));
  });
});

// ── Category deduplication ────────────────────────────────────

describe('parseHit — inspire_categories deduplication', () => {
  it('LZ paper: duplicate "Experiment-HEP" entries result in a single entry', () => {
    // The fixture has Experiment-HEP listed twice; _parseHit maps it to the
    // display label ("Experiment" via CATEGORY_LABELS) and deduplicates.
    const result = parseHit(lz);
    const expHep = result.categories.filter((c) => c === 'Experiment');
    assert.equal(expHep.length, 1, `"Experiment" should appear once, got ${expHep.length}`);
  });

  it('categories array contains no duplicate entries', () => {
    for (const hit of hits) {
      const result = parseHit(hit.metadata);
      const unique = new Set(result.categories);
      assert.equal(
        unique.size,
        result.categories.length,
        `duplicate in categories for inspireId ${result.inspireId}`
      );
    }
  });
});

// ── Keyword extraction & filtering ───────────────────────────

describe('parseHit — keyword extraction', () => {
  it('filters out keywords from the CERN schema', () => {
    // The LZ fixture contains a keyword with schema="CERN", value="should be filtered out"
    const result = parseHit(lz);
    assert.ok(
      !result.keywords.includes('should be filtered out'),
      `CERN-schema keyword should have been filtered out; got: ${result.keywords}`
    );
  });

  it('keeps keywords from INSPIRE and author schemas', () => {
    const result = parseHit(lz);
    assert.ok(result.keywords.length > 0, 'should have at least one keyword');
  });

  it('deduplicates keywords that appear in both INSPIRE and author schemas', () => {
    // The fixture has "dark matter" in both the INSPIRE and author keyword lists
    const result = parseHit(lz);
    const dmCount = result.keywords.filter((k) => k === 'dark matter').length;
    assert.equal(dmCount, 1, `"dark matter" should appear once, got ${dmCount}`);
  });

  it('keywords array has no duplicates', () => {
    for (const hit of hits) {
      const result = parseHit(hit.metadata);
      const unique = new Set(result.keywords);
      assert.equal(
        unique.size,
        result.keywords.length,
        `duplicate keywords for inspireId ${result.inspireId}`
      );
    }
  });

  it('keywords are capped at 5', () => {
    const result = parseHit(lz); // fixture has 6+ keywords to trigger cap
    assert.ok(result.keywords.length <= 5, `expected ≤5 keywords, got ${result.keywords.length}`);
  });
});

// ── Graceful fallback for missing / null fields ───────────────

describe('parseHit — graceful fallback', () => {
  it('title falls back to empty string when metadata is absent', () => {
    const result = parseHit(xenon);
    assert.equal(typeof result.title, 'string');
    // May be empty string — must not be null/undefined/throw
    assert.ok(result.title !== undefined && result.title !== null);
  });

  it('authors falls back gracefully when author list is empty', () => {
    const result = parseHit(xenon);
    assert.equal(typeof result.authors, 'string');
    assert.ok(result.authors !== undefined && result.authors !== null);
  });

  it('abstract falls back to empty string', () => {
    const result = parseHit(xenon);
    assert.equal(typeof result.abstract, 'string');
  });

  it('citations is null when citation count is missing', () => {
    const result = parseHit(xenon);
    // Either null or 0 or undefined are acceptable — what matters is no crash
    assert.ok(
      result.citations === null || result.citations === 0 || result.citations === undefined,
      `expected citations to be null/0/undefined, got ${result.citations}`
    );
  });

  it('categories falls back to empty array', () => {
    const result = parseHit(xenon);
    assert.ok(Array.isArray(result.categories));
  });

  it('keywords falls back to empty array', () => {
    const result = parseHit(xenon);
    assert.ok(Array.isArray(result.keywords));
  });

  it('inspireId is present even for stub record', () => {
    const result = parseHit(xenon);
    assert.ok(result.inspireId != null, 'inspireId should always be present');
  });
});

// ── Return shape ──────────────────────────────────────────────

describe('parseHit — return shape', () => {
  const REQUIRED_FIELDS = [
    'inspireId',
    'title',
    'authors',
    'abstract',
    'citations',
    'categories',
    'keywords',
  ];

  for (const hit of hits) {
    it(`has all required fields for inspireId ${hit.id ?? hit.metadata?.control_number}`, () => {
      const result = parseHit(hit.metadata);
      for (const field of REQUIRED_FIELDS) {
        assert.ok(Object.hasOwn(result, field), `missing field "${field}"`);
      }
    });
  }
});
