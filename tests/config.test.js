/**
 * config.test.js — Tests for config.js exported values.
 * Run with: node --test tests/config.test.js
 *
 * Verifies the shape and content of TITLE_STOP_WORDS now that it lives in
 * config.js and is part of the project's public configuration surface.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TITLE_STOP_WORDS } from '../site/assets/js/config.js';

// ── TITLE_STOP_WORDS ──────────────────────────────────────────

describe('TITLE_STOP_WORDS', () => {
  it('is a Set', () => {
    assert.ok(TITLE_STOP_WORDS instanceof Set, 'expected TITLE_STOP_WORDS to be a Set');
  });

  it('is non-empty', () => {
    assert.ok(TITLE_STOP_WORDS.size > 0, 'expected TITLE_STOP_WORDS to have entries');
  });

  // ── Group 1: standard English words ──────────────────────

  it('contains common English articles and prepositions', () => {
    for (const word of ['a', 'an', 'the', 'of', 'in', 'for', 'and', 'or']) {
      assert.ok(TITLE_STOP_WORDS.has(word), `expected "${word}" to be a stop word`);
    }
  });

  // ── Group 2: academic paper filler ───────────────────────

  it('contains academic filler verbs and nouns', () => {
    for (const word of ['probing', 'search', 'measurement', 'analysis', 'constraints']) {
      assert.ok(TITLE_STOP_WORDS.has(word), `expected "${word}" to be a stop word`);
    }
  });

  // ── Group 3: HEP-specific boilerplate ────────────────────

  it('contains HEP boilerplate terms', () => {
    for (const word of ['physics', 'particle', 'quantum', 'lhc', 'theory', 'model']) {
      assert.ok(TITLE_STOP_WORDS.has(word), `expected "${word}" to be a stop word`);
    }
  });

  // ── Regression guard: science-specific terms should NOT be blocked ────────

  it('does not block specific physics terms that carry topic signal', () => {
    // These should appear in the top-words chart when present in paper titles.
    for (const word of ['wimp', 'axion', 'susy', 'higgs', 'supersymmetry', 'dark']) {
      assert.ok(
        !TITLE_STOP_WORDS.has(word),
        `"${word}" should not be a stop word — it has topic signal`
      );
    }
  });

  it('all entries are lower-case strings', () => {
    for (const word of TITLE_STOP_WORDS) {
      assert.equal(typeof word, 'string', `expected string, got ${typeof word}`);
      assert.equal(word, word.toLowerCase(), `"${word}" is not lower-case`);
    }
  });

  it('all entries are non-empty', () => {
    for (const word of TITLE_STOP_WORDS) {
      assert.ok(word.length > 0, 'found empty string in TITLE_STOP_WORDS');
    }
  });
});
