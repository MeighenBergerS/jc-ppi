/* ============================================================
   scripts/papers/slack.js — The weekly Slack reminder, as functions
   ============================================================
   Used by slack-reminder.js. A port of weeklySlackReminder and
   refreshTrendingPapers from docs/appscript.gs, reading papers
   from the published Google Sheet or from GitHub issues.
   ============================================================ */

import { COL } from '../../site/assets/js/config.js';
import { normalizeArxivId, stripVersion } from '../../site/assets/js/utils.js';
import { TIMEZONE, chicagoWallTime, weekStartDay } from './lib.js';
import { TRENDING_CATEGORIES, TRENDING_LOOKBACK_WEEKS } from './trending.js';

// The reminder goes out at this local hour (Central Time) on the scheduled day.
export const REMINDER_HOUR = 13;

const isTrue = (v) => (v ?? '').trim().toUpperCase() === 'TRUE';

/** A row timestamp as a Date: Sheet format (Central wall clock) or ISO. */
export function rowTime(text) {
  const sheet = chicagoWallTime(text);
  return isNaN(sheet) ? new Date(text) : sheet;
}

/**
 * This week's approved, not-removed papers from rows in the Public tab format
 * (the Sheet CSV, or issuesToRows()). Oldest first.
 * @returns {{name, arxivId, votes}[]}
 */
export function thisWeekPapers(rows, now = new Date()) {
  const week = weekStartDay(now);
  return rows
    .filter((r) => r[COL.timestamp] && isTrue(r[COL.approved]) && !isTrue(r[COL.removed]))
    .map((r) => ({ r, t: rowTime(r[COL.timestamp].trim()) }))
    .filter(({ t }) => !isNaN(t) && weekStartDay(t) === week)
    .sort((a, b) => a.t - b.t)
    .map(({ r }) => ({
      name: (r[COL.name] ?? '').trim(),
      arxivId: stripVersion(normalizeArxivId(r[COL.arxivId])),
      votes: Number(r[COL.votes]) || 0,
    }));
}

/** Escapes text for Slack mrkdwn. */
export function slackEscape(text) {
  return (text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * True when a run started by `cron` should post: of the two UTC schedules
 * (one per daylight-saving state), only the one landing on REMINDER_HOUR in
 * Central Time posts. Scheduled runs can start late; this uses the cron's
 * hour, not the start time, so a delay can't cause a skip or a double post.
 */
export function isReminderSchedule(cron, now = new Date()) {
  const utcHour = Number(cron.trim().split(/\s+/)[1]);
  const at = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), utcHour));
  const localHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(at)
  );
  return localHour === REMINDER_HOUR;
}

/**
 * Builds the reminder text (Slack mrkdwn).
 * @param {object} p
 * @param {{name, arxivId, votes}[]} p.papers  thisWeekPapers()
 * @param {(object[]|null)[]} p.trending        fetchTrending(); the first paper per category is shown
 * @param {{day, time}} p.meeting               CONFIG.meeting
 * @param {string} p.submitUrl
 * @param {object} [p.titles]                   arXiv ID → paper title, if known
 */
export function buildReminder({ papers, trending, meeting, submitUrl, titles = {} }) {
  const lines = [];
  lines.push(
    `*📄 Journal Club — weekly paper reminder* (meeting ${meeting.day} at ${meeting.time}!)`,
    ''
  );

  const submitters = [...new Set(papers.map((p) => p.name).filter(Boolean))].map(
    (n) => `*${slackEscape(n)}*`
  );
  if (submitters.length === 0) {
    lines.push('No papers submitted yet this week — be the first! 🚀');
  } else if (submitters.length === 1) {
    lines.push(`Thank you ${submitters[0]} for submitting! 🎉`);
  } else {
    const last = submitters.pop();
    lines.push(`Thank you ${submitters.join(', ')}, and ${last} for submitting! 🎉`);
  }
  lines.push('');

  // Most votes wins; ties go to the earliest submission.
  const top = papers.reduce((best, p) => (!best || p.votes > best.votes ? p : best), null);
  if (top?.arxivId) {
    const title = titles[top.arxivId];
    const link =
      `<https://arxiv.org/abs/${top.arxivId}|${top.arxivId}>` +
      (title ? ` _${slackEscape(title)}_` : '');
    lines.push(
      top.votes > 0
        ? `🏆 *Top paper this week:* ${link} — ${top.votes} ${top.votes === 1 ? 'vote' : 'votes'}`
        : `📌 *This week's paper:* ${link} (no votes yet — go cast yours!)`
    );
    lines.push('');
  }

  lines.push(
    papers.length < 3
      ? "👀 Haven't submitted yet? There's still time — browse arXiv and share something interesting!"
      : "💡 Haven't submitted yet? You can still add a paper before the meeting.",
    `➡️  Submit here: ${submitUrl}`
  );

  const tops = TRENDING_CATEGORIES.map((_, i) => trending[i]?.[0] ?? null);
  if (tops.some(Boolean)) {
    lines.push(
      '',
      '─────────────────────────────────',
      `*📡 Trending in hep-ph — past ${TRENDING_LOOKBACK_WEEKS} weeks* (full list on the site ↗)`,
      '_Ranked by citation count (via INSPIRE-HEP)_',
      ''
    );
    TRENDING_CATEGORIES.forEach((cat, i) => {
      const t = tops[i];
      lines.push(`${cat.emoji} *${cat.label}*`);
      if (!t) {
        lines.push('  _No data available._');
      } else {
        const link = t.arxivId
          ? `<https://arxiv.org/abs/${t.arxivId}|${t.arxivId}>`
          : '_(no arXiv ID)_';
        lines.push(
          `  ${link} — *${t.citationsNoSelf}* citations excl. self / ${t.citations} total`
        );
        if (t.title) lines.push(`  _${slackEscape(t.title)}_`);
        if (t.authors) {
          lines.push(
            `  ${slackEscape(t.authors)}${t.affiliation ? ` · ${slackEscape(t.affiliation)}` : ''}`
          );
        }
      }
      lines.push('');
    });
  }
  return lines.join('\n').trimEnd();
}
