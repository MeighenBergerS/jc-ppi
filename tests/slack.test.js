/**
 * slack.test.js — Tests for the weekly Slack reminder (scripts/papers/slack.js).
 * Run with: node --test tests/slack.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  rowTime,
  thisWeekPapers,
  slackEscape,
  isReminderSchedule,
  buildReminder,
} from '../scripts/papers/slack.js';
import { CONFIG } from '../site/assets/js/config.js';

// Thursday 2026-10-01, 1 PM in Iowa (CDT).
const NOW = new Date('2026-10-01T18:00:00Z');

// Public tab format: timestamp, name, arXiv, comment, approved, removed, edited, votes, discussed
const row = (timestamp, name, arxiv, { votes = 0, approved = 'TRUE', removed = '' } = {}) => [
  timestamp,
  name,
  arxiv,
  'why',
  approved,
  removed,
  '',
  String(votes),
  '',
];

describe('rowTime', () => {
  it('reads Sheet timestamps as Central Time', () => {
    assert.equal(rowTime('9/28/2026 0:30:00').toISOString(), '2026-09-28T05:30:00.000Z');
  });
  it('reads ISO timestamps from issues', () => {
    assert.equal(rowTime('2026-09-28T05:30:00Z').toISOString(), '2026-09-28T05:30:00.000Z');
  });
});

describe('thisWeekPapers', () => {
  const rows = [
    row('9/27/2026 23:59:00', 'Last week', '2609.00001'), // Sunday night: previous week
    row('9/28/2026 0:01:00', 'Alice', 'https://arxiv.org/abs/2609.00002v2', { votes: 2 }),
    row('2026-09-30T15:00:00Z', 'Bob', '2609.00003'),
    row('9/29/2026 10:00:00', 'Pending', '2609.00004', { approved: 'FALSE' }),
    row('9/29/2026 11:00:00', 'Removed', '2609.00005', { removed: 'TRUE' }),
    ['', '', ''],
  ];

  it("keeps only this week's approved, not-removed papers, oldest first", () => {
    assert.deepEqual(thisWeekPapers(rows, NOW), [
      { name: 'Alice', arxivId: '2609.00002', votes: 2 },
      { name: 'Bob', arxivId: '2609.00003', votes: 0 },
    ]);
  });
});

describe('isReminderSchedule', () => {
  it('posts from the 18:00 UTC schedule in summer', () => {
    assert.equal(isReminderSchedule('0 18 * * 4', NOW), true);
    assert.equal(isReminderSchedule('0 19 * * 4', NOW), false);
  });
  it('posts from the 19:00 UTC schedule in winter', () => {
    const winter = new Date('2026-12-03T19:25:00Z'); // a late start still counts
    assert.equal(isReminderSchedule('0 18 * * 4', winter), false);
    assert.equal(isReminderSchedule('0 19 * * 4', winter), true);
  });
});

describe('slackEscape', () => {
  it('escapes the characters Slack treats as markup', () => {
    assert.equal(slackEscape('a < b & c > d'), 'a &lt; b &amp; c &gt; d');
  });
});

describe('buildReminder', () => {
  const meeting = { day: 'Friday', time: '3:30 PM CT' };
  const base = { trending: [], meeting, submitUrl: 'https://example.org/' };

  it('names the meeting from the site config', () => {
    assert.match(buildReminder({ ...base, papers: [] }), /meeting Friday at 3:30 PM CT!/);
  });

  it('asks for papers when there are none', () => {
    const text = buildReminder({ ...base, papers: [] });
    assert.match(text, /No papers submitted yet/);
    assert.doesNotMatch(text, /Top paper|This week's paper/);
  });

  it('thanks each submitter once, joining names with "and"', () => {
    const papers = [
      { name: 'Alice', arxivId: '1', votes: 0 },
      { name: 'Bob', arxivId: '2', votes: 0 },
      { name: 'Alice', arxivId: '3', votes: 0 },
      { name: 'Carol', arxivId: '4', votes: 0 },
    ];
    assert.match(
      buildReminder({ ...base, papers }),
      /Thank you \*Alice\*, \*Bob\*, and \*Carol\* for submitting/
    );
  });

  it('names the most-voted paper, earliest first on ties, with its title', () => {
    const papers = [
      { name: 'A', arxivId: '2609.00001', votes: 3 },
      { name: 'B', arxivId: '2609.00002', votes: 3 },
    ];
    const text = buildReminder({ ...base, papers, titles: { 2609.00001: 'Neutrinos & <you>' } });
    assert.match(
      text,
      /Top paper this week:\* <https:\/\/arxiv.org\/abs\/2609.00001\|2609.00001> _Neutrinos &amp; &lt;you&gt;_ — 3 votes/
    );
  });

  it('says when no one has voted yet', () => {
    const text = buildReminder({ ...base, papers: [{ name: 'A', arxivId: '1', votes: 0 }] });
    assert.match(text, /This week's paper:.*no votes yet/);
  });

  it('lists the top trending paper per category, and marks missing data', () => {
    const top = {
      arxivId: '2609.1',
      title: 'T',
      authors: 'X',
      affiliation: 'Iowa',
      citations: 9,
      citationsNoSelf: 4,
    };
    const second = { ...top, arxivId: '2609.2', authors: 'Second' };
    const trending = [[top, second], [], null];
    const text = buildReminder({ ...base, papers: [], trending });
    assert.match(text, /\*4\* citations excl. self \/ 9 total/);
    assert.match(text, /X · Iowa/);
    assert.doesNotMatch(text, /Second/, 'only the first paper per category is shown');
    assert.equal(text.match(/No data available/g).length, CONFIG.trending.categories.length - 1);
  });

  it('leaves out the trending section when INSPIRE returned nothing', () => {
    const text = buildReminder({ ...base, papers: [], trending: [null, null, null] });
    assert.doesNotMatch(text, /Trending/);
  });
});
