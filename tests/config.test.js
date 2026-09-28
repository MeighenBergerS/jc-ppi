/**
 * config.test.js — Tests for config.js exported values.
 * Run with: node --test tests/config.test.js
 *
 * Checks that the files which can't import CONFIG (the workflow crons and
 * the static meeting text in site/index.html) agree with it, and the shape
 * and content of TITLE_STOP_WORDS.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CONFIG, TITLE_STOP_WORDS } from '../site/assets/js/config.js';
import { weekdayIndex, meetingTime } from '../site/assets/js/utils.js';
import { isReminderSchedule } from '../scripts/papers/slack.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const crons = (workflow) =>
  [...read(`.github/workflows/${workflow}`).matchAll(/- cron: "([^"]+)"/g)].map((m) => m[1]);
/** Cron day-of-week number (Sunday = 0) of a weekday name. */
const cronDay = (day) => (weekdayIndex(day) + 1) % 7;
/** The first date on or after `from` (UTC) that falls on `day`. */
function nextWeekday(from, day) {
  const d = new Date(from);
  while (d.getUTCDay() !== cronDay(day)) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

// ── CONFIG ────────────────────────────────────────────────────

describe('CONFIG', () => {
  it('names real weekdays', () => {
    for (const day of [
      CONFIG.meeting.day,
      CONFIG.slackReminder.day,
      ...CONFIG.trending.refreshDays,
    ]) {
      assert.doesNotThrow(() => weekdayIndex(day), day);
    }
  });

  it('has 24-hour meeting times, ending after they start', () => {
    const { start, end } = CONFIG.meeting;
    assert.match(start, /^([01]\d|2[0-3]):[0-5]\d$/);
    assert.match(end, /^([01]\d|2[0-3]):[0-5]\d$/);
    assert.ok(end > start);
  });

  it('matches the static meeting text in site/index.html', () => {
    const html = read('site/index.html').match(/<span id="meeting-when"\s*>([\s\S]*?)<\/span/)[1];
    const text = html
      .replace(/<[^>]+>/g, '')
      .replace(/&mdash;/g, '\u2014')
      .replace(/\s+/g, ' ')
      .trim();
    const { meeting, timezoneLabel, timezone } = CONFIG;
    assert.equal(
      text,
      `Every ${meeting.day} at ${meetingTime(CONFIG)} (${timezoneLabel} \u2014 ${timezone})`
    );
  });

  it('matches the Slack reminder crons in slack-reminder.yml', () => {
    const { day } = CONFIG.slackReminder;
    const schedules = crons('slack-reminder.yml');
    for (const cron of schedules) {
      assert.equal(cron.split(/\s+/)[4], String(cronDay(day)), `"${cron}" runs on ${day}`);
    }
    // Exactly one schedule posts, in summer and in winter.
    for (const from of ['2026-07-01', '2027-01-01']) {
      const now = nextWeekday(from, day);
      const posting = schedules.filter((c) => isReminderSchedule(c, now));
      assert.equal(posting.length, 1, `one schedule posts on ${now.toISOString().slice(0, 10)}`);
    }
  });

  it('matches the roundup cron in roundup.yml', () => {
    const schedules = crons('roundup.yml');
    assert.equal(schedules.length, 1);
    assert.equal(schedules[0].split(/\s+/)[2], String(CONFIG.roundup.dayOfMonth));
  });

  it('matches the Trending cron in trending.yml', () => {
    const want = CONFIG.trending.refreshDays.map(cronDay).sort().join(',');
    for (const cron of crons('trending.yml')) {
      assert.equal(cron.split(/\s+/)[4], want, `"${cron}" runs on the refresh days`);
    }
  });
});

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
