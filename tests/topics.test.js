/**
 * topics.test.js — Tests for the club topics (CONFIG.topics, site/assets/js/topics.js).
 * Run with: node --test tests/topics.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../site/assets/js/config.js';
import { paperTopics, MAX_TOPICS } from '../site/assets/js/topics.js';

describe('CONFIG.topics', () => {
  it('has unique labels and a pattern each', () => {
    const labels = CONFIG.topics.map((t) => t.label);
    assert.equal(new Set(labels).size, labels.length);
    for (const t of CONFIG.topics) {
      assert.ok(t.label.trim(), 'label');
      assert.ok(t.match instanceof RegExp, `${t.label} has a RegExp`);
      assert.ok(!t.match.test(''), `${t.label} does not match empty text`);
    }
  });
});

describe('paperTopics', () => {
  it('finds a topic in the title', () => {
    assert.deepEqual(
      paperTopics({ title: 'Constraints on non-standard neutrino interactions from Borexino' }),
      ['Neutrinos']
    );
  });

  it('finds a topic in the INSPIRE keywords', () => {
    assert.deepEqual(paperTopics({ title: 'A study', keywords: ['dark matter: relic density'] }), [
      'Dark matter',
    ]);
  });

  it('needs two mentions in the abstract', () => {
    const once = { title: 'A study', abstract: 'We also comment on the LHC.' };
    const twice = { title: 'A study', abstract: 'At the LHC, and at a future collider, we …' };
    assert.deepEqual(paperTopics(once), []);
    assert.deepEqual(paperTopics(twice), ['Colliders']);
  });

  it('puts the best matches first and keeps at most three', () => {
    const meta = {
      title: 'Dark matter, neutrinos and axions at colliders',
      abstract: 'Cosmology and inflation, the CMB, and cosmological constraints.',
    };
    const topics = paperTopics(meta);
    assert.equal(topics.length, MAX_TOPICS);
    assert.deepEqual(topics, ['Neutrinos', 'Dark matter', 'Axions & light particles']);
  });

  it('reads maths in titles', () => {
    assert.deepEqual(paperTopics({ title: 'Oscillations of $\\nu_\\mu$ to $\\nu_e$' }), [
      'Neutrinos',
    ]);
  });

  it('matches whole words where the list asks for them', () => {
    assert.deepEqual(paperTopics({ title: 'Clamps and ALPACAs' }), []);
    assert.deepEqual(paperTopics({ title: 'Searches for ALPs' }), ['Axions & light particles']);
  });

  it('is empty without metadata', () => {
    assert.deepEqual(paperTopics({}), []);
    assert.deepEqual(paperTopics(undefined), []);
  });
});
