/* ============================================================
   scripts/papers/roundup-html.js — The roundup email as HTML
   ============================================================
   The HTML part of the monthly roundup email; renderRoundup() in
   roundup.js writes the same content as plain text. Email clients
   support little CSS, so this is built from tables with inline
   styles, 600px wide, in the site's colors. Titles and subfields
   come from INSPIRE and are escaped.
   ============================================================ */

import { CONFIG } from '../../site/assets/js/config.js';
import { plainText } from '../../site/assets/js/mathtext.js';
import { monthName, scorecard, toGoText, unlockedNote, personalStats } from './roundup.js';

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
  gold: '#fff7e0',
  goldDark: '#8a5a00',
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
const table = (style, rows) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${style}">${rows}</table>`;

function _section(title, content) {
  return `
<tr><td style="padding:30px 32px 0">
  <div style="font-size:18px;font-weight:700;color:${C.ink};padding-bottom:14px">${esc(title)}</div>
  ${content}
</td></tr>`;
}

function _scorecard(r) {
  const cells = scorecard(r)
    .map(
      ([n, label]) => `
<td width="33%" align="center" style="padding:18px 4px">
  <div style="font-size:32px;font-weight:800;line-height:1;color:${C.tealDark}">${esc(n)}</div>
  <div style="font-size:13px;color:${C.tealDark};padding-top:6px">${esc(label)}</div>
</td>`
    )
    .join('');
  return `<tr><td style="background:${C.tealDim}">${table('', `<tr>${cells}</tr>`)}</td></tr>`;
}

function _paper(p, meta) {
  // Mail clients don't render MathML reliably, so formulas become plain text
  const title = plainText(meta.get(p.arxivId)?.title ?? '') || p.arxivId || 'Untitled';
  const abs = p.arxivId ? `https://arxiv.org/abs/${p.arxivId}` : p.url;
  const status = p.discussed
    ? `<span style="display:inline-block;background:${C.tealDim};color:${C.tealDark};font-weight:700;border-radius:999px;padding:2px 10px">⭐ Discussed</span>`
    : `<span style="color:${C.muted}">📄 Suggested</span>`;
  const votes = p.votes ? ` &nbsp;·&nbsp; 👍 ${esc(p.votes)}` : '';
  return table(
    `margin-bottom:12px;border:1px solid ${p.discussed ? C.tealLight : C.border};border-radius:10px`,
    `<tr><td style="padding:14px 16px">
  ${p.arxivId ? `<div style="font-size:12px;font-weight:700;letter-spacing:.02em;color:${C.badge};padding-bottom:4px">${esc(p.arxivId)}</div>` : ''}
  <a href="${esc(abs)}" style="font-size:15px;font-weight:600;line-height:1.4;color:${C.ink};text-decoration:none">${esc(title)}</a>
  <div style="font-size:13px;padding-top:10px">
    ${status}${votes} &nbsp;·&nbsp; <a href="${esc(p.url)}" style="color:${C.teal};font-weight:600;text-decoration:none">View discussion →</a>
  </div>
</td></tr>`
  );
}

function _pills(items) {
  return items
    .map(
      (s) =>
        `<span style="display:inline-block;background:${C.tealDim};color:${C.tealDark};font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:999px;padding:5px 12px;margin:0 6px 8px 0">${esc(s)}</span>`
    )
    .join('');
}

function _unlocked(r) {
  const rows = r.reached
    .map(
      (m) => `
<tr>
  <td width="44" style="font-size:26px;padding:6px 0">${m.emoji}</td>
  <td style="font-size:16px;font-weight:600;color:${C.ink};padding:6px 0">${esc(m.label)}</td>
</tr>`
    )
    .join('');
  return `
<tr><td style="padding:30px 32px 0">
  ${table(
    `background:${C.gold};border-radius:12px`,
    `<tr><td style="padding:18px 22px">
      <div style="font-size:18px;font-weight:700;color:${C.goldDark};padding-bottom:8px">🏆 This month you unlocked</div>
      ${table('', rows)}
      <div style="font-size:14px;font-style:italic;color:${C.goldDark};padding-top:10px">${esc(unlockedNote(r))}</div>
    </td></tr>`
  )}
</td></tr>`;
}

function _stats(r) {
  const cells = personalStats(r)
    .map(
      ([value, unit, label]) => `
<td width="33%" valign="top" style="padding:0 4px">
  ${table(
    `background:${C.tile};border:1px solid ${C.border};border-radius:10px`,
    `<tr><td align="center" style="padding:16px 6px">
      <div style="font-size:28px;font-weight:800;line-height:1.1;color:${C.ink}">${esc(value)}</div>
      <div style="font-size:13px;font-weight:600;color:${C.ink}">${esc(unit)}</div>
      <div style="font-size:12px;color:${C.muted};padding-top:6px">${esc(label)}</div>
    </td></tr>`
  )}
</td>`
    )
    .join('');
  return table('', `<tr>${cells}</tr>`);
}

function _progress(m) {
  const pct = Math.max(2, Math.min(100, Math.round((m.count / m.tier) * 100)));
  return table(
    'margin-bottom:16px',
    `<tr><td style="font-size:15px;font-weight:600;color:${C.ink};padding-bottom:4px">${m.emoji} &nbsp;${esc(m.label)}</td></tr>
  <tr><td style="font-size:13px;color:${C.muted};padding-bottom:7px">${esc(toGoText(m))} · ${esc(m.count)} of ${esc(m.tier)}</td></tr>
  <tr><td>
    ${table(
      `background:${C.border};border-radius:999px`,
      `<tr><td width="${pct}%" height="8" style="background:${C.teal};border-radius:999px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr>`
    )}
  </td></tr>`
  );
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
  const preheader = r.suggested
    ? scorecard(r)
        .map(([n, label]) => `${n} ${label}`)
        .join(' · ')
    : "A quiet month. There's always next week!";

  const parts = [];
  if (r.suggested) {
    parts.push(_scorecard(r));
    parts.push(_section('📄 Your papers', r.papers.map((p) => _paper(p, meta)).join('')));
    if (r.subfields.length) parts.push(_section(`🧭 Your ${month} mix`, _pills(r.subfields)));
  } else {
    parts.push(
      _section(
        '📄 Your papers',
        `<p style="font-size:15px;color:${C.ink};margin:0">No papers this month. There's always next week!</p>`
      )
    );
  }
  if (r.reached.length) parts.push(_unlocked(r));
  parts.push(_section('🔥 Your journal-club stats', _stats(r)));
  if (r.next.length) parts.push(_section('🎯 Almost there…', r.next.map(_progress).join('')));
  parts.push(`
<tr><td style="padding:30px 32px 34px">
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
<title>Your ${esc(month)} at ${esc(CONFIG.shortName)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
${table(
  `background:${C.page}`,
  `<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:${C.card};border-radius:14px;overflow:hidden;font-family:${FONT};color:${C.ink}">
    <tr><td style="background:${C.header};padding:30px 32px">
      <div style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.headerMuted}">📚 ${esc(CONFIG.shortName)}</div>
      <div style="font-size:32px;font-weight:800;line-height:1.15;color:#ffffff;padding-top:10px">Your ${esc(month)} ${esc(year)}</div>
      <div style="font-size:15px;color:${C.tealLight};padding-top:6px">A little monthly recap of your journal-club activity</div>
    </td></tr>
    ${parts.join('')}
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:${FONT}">
    <tr><td style="padding:18px 24px;font-size:12px;line-height:1.7;color:${C.muted};text-align:center">
      Your journal-club activity is private — only you receive these numbers.<br>
      Want to stop receiving this email? Just reply and let us know.${site}
    </td></tr>
  </table>
</td></tr>`
)}
</body>
</html>
`;
}
