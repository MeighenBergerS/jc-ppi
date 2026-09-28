/* ============================================================
   scripts/papers/roundup-html.js — The roundup email as HTML
   ============================================================
   The HTML part of the monthly roundup email; renderRoundup() in
   roundup.js writes the plain-text part. Email clients support
   little CSS, so this is built from tables with inline styles,
   600px wide, in the site's colors. Titles and subfields come from
   INSPIRE and are escaped.
   ============================================================ */

import { CONFIG } from '../../site/assets/js/config.js';
import { monthLabel, previousMonth } from './roundup.js';

const C = {
  page: '#f4f5f7',
  card: '#ffffff',
  ink: '#1a1a2e',
  muted: '#6b7280',
  border: '#e5e7eb',
  tile: '#f9fafb',
  header: '#111111',
  headerMuted: '#9ca3af',
  tealLight: '#72c2a5',
  teal: '#1b8a68',
  tealDark: '#0f5c45',
  tealDim: '#e0f5f0',
  badge: '#e7298a',
  cta: '#d95f02',
};
const FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/** Escapes text for HTML content and attribute values. */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const esc = escapeHtml;
const _plural = (n, word) => `${n} ${word}${n !== 1 ? 's' : ''}`;
const monthName = (key) => monthLabel(key).split(' ')[0];

function _section(title, content) {
  return `
<tr><td style="padding:28px 32px 0">
  <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};padding-bottom:8px;border-bottom:2px solid ${C.border};margin-bottom:14px">${esc(title)}</div>
  ${content}
</td></tr>`;
}

function _tile(value, label, note = '') {
  return `
<td width="25%" valign="top" style="padding:0 4px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.tile};border:1px solid ${C.border};border-radius:8px">
    <tr><td align="center" style="padding:14px 6px">
      <div style="font-size:28px;font-weight:700;line-height:1.1;color:${C.ink}">${esc(value)}</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${C.muted};padding-top:4px">${esc(label)}</div>
      ${note ? `<div style="font-size:11px;color:${C.muted};padding-top:3px">${esc(note)}</div>` : ''}
    </td></tr>
  </table>
</td>`;
}

function _paper(p, meta) {
  const title = meta.get(p.arxivId)?.title || p.arxivId || 'Untitled';
  const abs = p.arxivId
    ? `https://arxiv.org/abs/${encodeURIComponent(p.arxivId).replace(/%2F/g, '/')}`
    : p.url;
  const status = p.discussed
    ? `<span style="display:inline-block;background:${C.tealDim};color:${C.tealDark};font-weight:600;border-radius:999px;padding:2px 9px">✓ Discussed</span>`
    : `<span style="color:${C.muted}">Not discussed yet</span>`;
  const votes = p.votes ? ` &nbsp;·&nbsp; 👍 ${p.votes}` : '';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;border:1px solid ${C.border};border-radius:8px">
  <tr>
    <td width="4" style="background:${p.discussed ? C.teal : C.border};border-radius:8px 0 0 8px">&nbsp;</td>
    <td style="padding:12px 14px">
      ${p.arxivId ? `<div style="font-size:12px;font-weight:700;color:${C.badge};padding-bottom:3px">arXiv:${esc(p.arxivId)}</div>` : ''}
      <a href="${esc(abs)}" style="font-size:15px;font-weight:600;line-height:1.35;color:${C.ink};text-decoration:none">${esc(title)}</a>
      <div style="font-size:12px;color:${C.muted};padding-top:8px">
        ${status}${votes} &nbsp;·&nbsp; <a href="${esc(p.url)}" style="color:${C.muted}">Issue #${esc(p.number)}</a>
      </div>
    </td>
  </tr>
</table>`;
}

function _chips(items) {
  return items
    .map(
      (s) =>
        `<span style="display:inline-block;background:${C.tealDim};color:${C.tealDark};font-size:12px;font-weight:600;border-radius:999px;padding:4px 11px;margin:0 6px 6px 0">${esc(s)}</span>`
    )
    .join('');
}

function _reached(list) {
  const rows = list
    .map(
      (m) => `
<tr>
  <td width="40" style="font-size:24px;padding:6px 0">${m.emoji}</td>
  <td style="font-size:15px;color:${C.ink};padding:6px 0"><strong>${esc(m.tier)}</strong> ${esc(m.name)}</td>
</tr>`
    )
    .join('');
  return `
<tr><td style="padding:28px 32px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.tealDim};border-radius:10px">
    <tr><td style="padding:16px 20px">
      <div style="font-size:16px;font-weight:700;color:${C.tealDark};padding-bottom:6px">🎉 Milestones reached this month</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
    </td></tr>
  </table>
</td></tr>`;
}

function _progress(m) {
  const pct = Math.max(2, Math.min(100, Math.round((m.count / m.tier) * 100)));
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px">
  <tr>
    <td style="font-size:14px;color:${C.ink};padding-bottom:6px">${m.emoji} &nbsp;${esc(m.tier)} ${esc(m.name)}</td>
    <td align="right" style="font-size:12px;color:${C.muted};padding-bottom:6px;white-space:nowrap">${esc(m.count)} / ${esc(m.tier)} · ${esc(m.toGo)} to go</td>
  </tr>
  <tr><td colspan="2">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.border};border-radius:999px">
      <tr><td width="${pct}%" height="8" style="background:${C.teal};border-radius:999px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr>
    </table>
  </td></tr>
</table>`;
}

function _button(href, label) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
  <td style="background:${C.cta};border-radius:6px">
    <a href="${esc(href)}" style="display:inline-block;padding:12px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none">${esc(label)}</a>
  </td>
</tr></table>`;
}

/**
 * The roundup as an HTML email body.
 * @param {object} r - From buildRoundup().
 * @param {Map} meta - arXiv ID → INSPIRE metadata, for titles.
 */
export function renderRoundupHtml(r, meta = new Map()) {
  const month = monthName(r.month);
  const year = r.month.slice(0, 4);
  const last = monthName(previousMonth(r.month));

  const preheader = r.suggested
    ? `${_plural(r.suggested, 'paper')}, ${r.discussed} discussed` +
      (r.reached.length ? `, ${_plural(r.reached.length, 'milestone')} reached` : '')
    : "A quiet month. There's always next week!";

  const parts = [];

  parts.push(`
<tr><td style="padding:24px 28px 0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${_tile(r.suggested, 'Suggested', `${r.previous.suggested} in ${last}`)}
    ${_tile(r.discussed, 'Discussed', `${r.previous.discussed} in ${last}`)}
    ${_tile(r.votes, 'Votes', 'on these papers')}
    ${_tile(r.streak.current, 'Week streak', `best ${r.streak.best}`)}
  </tr></table>
  <div style="font-size:13px;color:${C.muted};text-align:center;padding-top:12px">${esc(_plural(r.total, 'paper'))} suggested all time</div>
</td></tr>`);

  if (r.suggested) {
    parts.push(_section(`Your papers in ${month}`, r.papers.map((p) => _paper(p, meta)).join('')));
    if (r.subfields.length) parts.push(_section('Subfields', _chips(r.subfields)));
  } else {
    parts.push(
      _section(
        `Your papers in ${month}`,
        `<p style="font-size:15px;color:${C.ink};margin:0">No papers this month. There's always next week!</p>`
      )
    );
  }

  if (r.reached.length) parts.push(_reached(r.reached));
  if (r.next.length) parts.push(_section('Coming up', r.next.map(_progress).join('')));

  parts.push(`
<tr><td style="padding:30px 32px 32px">
  <p style="font-size:14px;color:${C.muted};text-align:center;margin:0 0 14px">Seen something worth discussing?</p>
  ${_button(CONFIG.formUrl, 'Suggest a paper')}
</td></tr>`);

  const site = CONFIG.siteUrl
    ? `<br><a href="${esc(CONFIG.siteUrl)}" style="color:${C.muted}">${esc(CONFIG.siteUrl)}</a>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>Your ${esc(month)} ${esc(year)} at journal club</title>
</head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.card};border-radius:12px;overflow:hidden;font-family:${FONT};color:${C.ink}">
    <tr><td style="background:${C.header};padding:28px 32px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.headerMuted}">${esc(CONFIG.clubName)}</div>
      <div style="font-size:30px;font-weight:800;line-height:1.15;color:#ffffff;padding-top:10px">Your ${esc(month)}</div>
      <div style="font-size:15px;color:${C.tealLight};padding-top:4px">${esc(year)} roundup</div>
    </td></tr>
    ${parts.join('')}
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:${FONT}">
    <tr><td style="padding:18px 24px;font-size:12px;line-height:1.6;color:${C.muted};text-align:center">
      Only you get this email; nobody else sees your numbers.<br>
      To stop getting it, reply and say so.${site}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>
`;
}
