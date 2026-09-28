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
  reached: [{ emoji: '🗣️', label: '10 papers discussed', tier: 10 }],
  next: [
    { emoji: '📚', label: '25 papers suggested', unit: 'paper', tier: 25, count: 24, toGo: 1 },
  ],
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
  const html = renderRoundupHtml(roundup(), meta);

  it('names the month and the club', () => {
    assert.match(html, /Your September 2026/);
    assert.ok(html.includes(`📚 ${escapeHtml(CONFIG.shortName)}`));
    assert.match(html, /A little monthly recap of your journal-club activity/);
  });

  it('opens with the scorecard', () => {
    assert.match(html, />2 papers suggested · 1 discussed · 3 votes</); // the inbox preview
    assert.match(html, />papers suggested</);
  });

  it('turns markup in titles into plain, escaped text', () => {
    assert.ok(html.includes('Neutrinos &amp; friends'));
    assert.ok(!html.includes('<b>'));
    const risky = renderRoundupHtml(
      roundup(),
      new Map([['2609.00001', { title: 'A <script>alert(1)</script> and $m_\\nu$' }]])
    );
    assert.ok(risky.includes('A &lt;script&gt;alert(1)&lt;/script&gt; and mν'));
    assert.ok(!risky.includes('<script>'));
  });

  it('links each paper to arXiv and its issue, and marks the discussed one', () => {
    assert.ok(html.includes('href="https://arxiv.org/abs/2609.00001"'));
    assert.ok(html.includes('href="https://github.com/o/r/issues/88"'));
    assert.equal(html.match(/⭐ Discussed/g).length, 1);
    assert.equal(html.match(/📄 Suggested/g).length, 1);
    assert.equal(html.match(/View discussion →/g).length, 2);
  });

  it('celebrates milestones and shows progress towards the next', () => {
    assert.match(html, /🏆 This month you unlocked/);
    assert.match(html, />10 papers discussed</);
    assert.match(html, /One milestone down\. One more within reach…/);
    assert.match(html, /1 more to go · 24 of 25/);
    assert.match(html, /width="96%"/);
  });

  it('shows the personal stats and links to the form', () => {
    assert.match(html, /🔥 Your journal-club stats/);
    assert.match(html, />Suggested in August</);
    assert.ok(html.includes(`href="${escapeHtml(CONFIG.formUrl)}"`));
  });

  it('handles a month without papers or milestones', () => {
    const empty = renderRoundupHtml(
      roundup({ papers: [], suggested: 0, discussed: 0, votes: 0, subfields: [], reached: [] }),
      meta
    );
    assert.match(empty, /No papers this month/);
    assert.doesNotMatch(empty, /This month you unlocked/);
    assert.doesNotMatch(empty, /mix/);
  });

  it('says only the member gets it and how to stop', () => {
    assert.match(html, /only you receive these numbers/);
    assert.match(html, /Want to stop receiving this email\?/);
  });
});
