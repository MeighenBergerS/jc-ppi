/**
 * roundup-html.test.js — Tests for the HTML roundup email in scripts/papers/roundup-html.js.
 * Run with: node --test tests/roundup-html.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CONFIG } from '../site/assets/js/config.js';
import { escapeHtml, renderRoundupHtml } from '../scripts/papers/roundup-html.js';

const paper = (over = {}) => ({
  number: 85,
  url: 'https://github.com/o/r/issues/85',
  arxivId: '2609.00001',
  discussed: false,
  votes: 0,
  ...over,
});

const roundup = (over = {}) => ({
  month: '2026-09',
  papers: [
    paper(),
    paper({
      number: 88,
      url: 'https://github.com/o/r/issues/88',
      arxivId: '2609.00002',
      discussed: true,
      votes: 3,
    }),
  ],
  suggested: 2,
  discussed: 1,
  votes: 3,
  subfields: ['Pheno'],
  streak: { current: 3, best: 5 },
  previous: { suggested: 1, discussed: 0 },
  total: 24,
  reached: [{ emoji: '🗣️', name: 'papers discussed', tier: 10 }],
  next: [{ emoji: '📚', name: 'papers suggested', tier: 25, count: 24, toGo: 1 }],
  ...over,
});

describe('escapeHtml', () => {
  it('escapes the characters that matter in content and attributes', () => {
    assert.equal(
      escapeHtml(`<a href="x">'&'</a>`),
      '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;'
    );
    assert.equal(escapeHtml(null), '');
  });
});

describe('renderRoundupHtml', () => {
  const meta = new Map([['2609.00001', { title: 'Neutrinos <b>& friends</b>' }]]);

  it('names the month and the club', () => {
    const html = renderRoundupHtml(roundup(), meta);
    assert.match(html, /Your September/);
    assert.match(html, /2026 roundup/);
    assert.ok(html.includes(escapeHtml(CONFIG.clubName)));
  });

  it('escapes titles from INSPIRE', () => {
    const html = renderRoundupHtml(roundup(), meta);
    assert.ok(html.includes('Neutrinos &lt;b&gt;&amp; friends&lt;/b&gt;'));
    assert.ok(!html.includes('<b>& friends'));
  });

  it('links each paper to arXiv and its issue, and marks the discussed one', () => {
    const html = renderRoundupHtml(roundup(), meta);
    assert.ok(html.includes('href="https://arxiv.org/abs/2609.00001"'));
    assert.ok(html.includes('href="https://github.com/o/r/issues/88"'));
    assert.equal(html.match(/✓ Discussed/g).length, 1);
    assert.equal(html.match(/Not discussed yet/g).length, 1);
  });

  it('shows milestones reached and progress towards the next', () => {
    const html = renderRoundupHtml(roundup(), meta);
    assert.match(html, /Milestones reached this month/);
    assert.match(html, /<strong>10<\/strong> papers discussed/);
    assert.match(html, /24 \/ 25 · 1 to go/);
    assert.match(html, /width="96%"/);
  });

  it('compares with last month and links to the form', () => {
    const html = renderRoundupHtml(roundup(), meta);
    assert.match(html, /1 in August/);
    assert.ok(html.includes(`href="${escapeHtml(CONFIG.formUrl)}"`));
  });

  it('handles a month without papers or milestones', () => {
    const html = renderRoundupHtml(
      roundup({ papers: [], suggested: 0, discussed: 0, votes: 0, subfields: [], reached: [] }),
      meta
    );
    assert.match(html, /No papers this month/);
    assert.doesNotMatch(html, /Milestones reached/);
    assert.doesNotMatch(html, /Subfields/);
  });

  it('says only the member gets it and how to stop', () => {
    const html = renderRoundupHtml(roundup(), meta);
    assert.match(html, /Only you get this email/);
    assert.match(html, /To stop getting it/);
  });
});
