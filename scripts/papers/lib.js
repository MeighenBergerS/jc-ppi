/* ============================================================
   scripts/papers/lib.js — Helpers for paper-submission issues
   ============================================================
   Shared by enrich.js (the bot that fills in paper metadata),
   build-csv.js (the site preview data) and import-sheet.js
   (the one-time Google Sheet import). Runs in Node >= 18.
   ============================================================ */

import { normalizeArxivId, stripVersion, isValidArxivId } from '../../site/assets/js/utils.js';
import { parseHit } from '../../site/assets/js/inspire.js';

export const LABELS = {
  paper: 'paper',
  needsApproval: 'needs approval',
  discussed: 'discussed',
  awaiting: 'awaiting INSPIRE',
  invalidId: 'invalid arXiv ID',
  imported: 'imported',
};

// Field labels of .github/ISSUE_TEMPLATE/paper.yml. Change both together.
export const FIELDS = {
  arxiv: 'arXiv ID or link',
  why: 'Why this paper?',
  name: 'Name to show on the site',
};

export const METADATA_MARKER = '<!-- jc-ppi:paper-metadata -->';
const IMPORT_RE = /<!-- jc-ppi:imported (\{.*?\}) -->/;
export const TIMEZONE = 'America/Chicago';

const INSPIRE_BATCH = 25;
const INSPIRE_FIELDS =
  'titles,authors,abstracts,citation_count,arxiv_eprints,control_number,inspire_categories,keywords';

// ── Issue bodies ─────────────────────────────────────────────

/**
 * Parses an issue-form body into { label: value }.
 * Empty optional fields ("_No response_") become ''.
 * Text before the first "### " heading is ignored.
 */
export function parseIssueForm(body) {
  const fields = {};
  const parts = (body ?? '').replace(/\r\n/g, '\n').split(/^### +/m);
  for (const part of parts.slice(1)) {
    const nl = part.indexOf('\n');
    const label = (nl === -1 ? part : part.slice(0, nl)).trim();
    let value = nl === -1 ? '' : part.slice(nl + 1);
    value = value.replace(/<!--[\s\S]*?-->/g, '').trim();
    fields[label] = value === '_No response_' ? '' : value;
  }
  return fields;
}

/** Returns { timestamp, votes } for an issue imported from the Google Sheet, else null. */
export function parseImported(body) {
  const m = (body ?? '').match(IMPORT_RE);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

/** Builds the hidden marker that records an imported row's original data. */
export function importedMarker(data) {
  return `<!-- jc-ppi:imported ${JSON.stringify(data)} -->`;
}

/**
 * Returns the clean arXiv ID (no URL, no version) for raw user input, or null.
 * A three-digit prefix (708.1137) is zero-padded (0708.1137).
 */
export function cleanArxivId(raw) {
  const id = stripVersion(normalizeArxivId(raw));
  if (isValidArxivId(id)) return id;
  if (/^\d{3}\.\d{4,5}$/.test(id)) return '0' + id;
  return null;
}

// ── Weeks ────────────────────────────────────────────────────

/**
 * Day number (days since 1970-01-01) of the Monday that starts the week
 * containing `date`, with weeks running Monday to Sunday in `timeZone`.
 */
export function weekStartDay(date, timeZone = TIMEZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const day = Date.UTC(+parts.year, +parts.month - 1, +parts.day) / 86400000;
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday);
  return day - dow;
}

// ── Markdown safety ──────────────────────────────────────────

/**
 * Makes external text safe to post in a GitHub comment: stops "<" from
 * opening HTML tags and "@name" from pinging GitHub users.
 */
export function safeText(text) {
  return (text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/@/g, '@​');
}

// ── Metadata sources ─────────────────────────────────────────

/**
 * Looks up clean arXiv IDs on INSPIRE-HEP.
 * @returns {Promise<Map>} id → parseHit() result, for the IDs INSPIRE knows.
 * Throws on a network or HTTP error, so callers can leave issues unchanged.
 */
export async function fetchInspire(ids, fetchFn = fetch) {
  const found = new Map();
  for (let i = 0; i < ids.length; i += INSPIRE_BATCH) {
    const chunk = ids.slice(i, i + INSPIRE_BATCH);
    const q = chunk.map((id) => `arxiv:${id}`).join(' or ');
    const url =
      'https://inspirehep.net/api/literature?' +
      `q=${encodeURIComponent(q)}&fields=${INSPIRE_FIELDS}&size=${INSPIRE_BATCH}`;
    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`INSPIRE search: HTTP ${res.status}`);
    const data = await res.json();
    for (const hit of data.hits?.hits ?? []) {
      const eprint = stripVersion(hit.metadata.arxiv_eprints?.[0]?.value ?? '');
      if (eprint) found.set(eprint, parseHit(hit.metadata));
    }
  }
  return found;
}

/** Returns the INSPIRE BibTeX entry for a record, or '' if it can't be fetched. */
export async function fetchBibtex(inspireId, fetchFn = fetch) {
  try {
    const res = await fetchFn(`https://inspirehep.net/api/literature/${inspireId}?format=bibtex`);
    return res.ok ? (await res.text()).trim() : '';
  } catch {
    return '';
  }
}

function _decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses an arXiv Atom API response for one ID.
 * @returns {{title, authors, abstract} | {invalid: true}}
 */
export function parseArxivAtom(xml) {
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];
  const title = entry && _decodeXml(entry.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1] ?? '');
  if (!entry || !title || title === 'Error') return { invalid: true };
  const names = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => _decodeXml(m[1]));
  const authors = names.slice(0, 4).join(', ') + (names.length > 4 ? ' et al.' : '');
  const abstract = _decodeXml(entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1] ?? '');
  return { title, authors, abstract };
}

/**
 * Looks up one clean arXiv ID on arXiv.
 * @returns {Promise<{title, authors, abstract} | {invalid: true} | null>}
 *   null when arXiv could not be reached, so the caller changes nothing.
 */
export async function fetchArxiv(id, fetchFn = fetch) {
  try {
    const res = await fetchFn(`https://export.arxiv.org/api/query?id_list=${id}&max_results=1`);
    if (!res.ok) return null;
    return parseArxivAtom(await res.text());
  } catch {
    return null;
  }
}

// ── The bot's metadata comment ───────────────────────────────

/**
 * Renders the bot's metadata comment for a paper issue.
 * @param {object} p
 * @param {'inspire'|'arxiv'|'invalid'} p.source
 * @param {string} p.id      Clean arXiv ID ('' when invalid).
 * @param {string} p.raw     The submitted value (for the invalid message).
 * @param {object} [p.meta]  parseHit() or parseArxivAtom() result.
 * @param {string} [p.bibtex]
 * @param {string} p.date    YYYY-MM-DD shown as the update date.
 */
export function renderMetadataComment({ source, id, raw, meta = {}, bibtex = '', date }) {
  if (source === 'invalid') {
    return [
      METADATA_MARKER,
      `I couldn't find **${safeText(raw) || '(empty)'}** on arXiv.`,
      '',
      'Edit this issue and put a bare arXiv ID, like `2301.12345`, or an arXiv link in the first ' +
        'field. I check again automatically after every edit.',
    ].join('\n');
  }

  const abs = `https://arxiv.org/abs/${id}`;
  const title = safeText(meta.title).replace(/[[\]]/g, '\\$&') || id;
  const lines = [METADATA_MARKER, `**[${title}](${abs})**`, ''];
  if (meta.authors) lines.push(safeText(meta.authors), '');

  const facts = [];
  if (meta.categories?.length) facts.push(`**Subfields:** ${meta.categories.join(' · ')}`);
  if (meta.keywords?.length) facts.push(`**Keywords:** ${safeText(meta.keywords.join(', '))}`);
  if (meta.citations != null) facts.push(`**Citations:** ${meta.citations}`);
  if (facts.length) lines.push(facts.join('  \n'), '');

  const links = [`[arXiv](${abs})`, `[PDF](https://arxiv.org/pdf/${id})`];
  if (meta.inspireId) links.push(`[INSPIRE](https://inspirehep.net/literature/${meta.inspireId})`);
  lines.push(links.join(' · '), '');

  if (meta.abstract) {
    lines.push(
      '<details><summary>Abstract</summary>',
      '',
      safeText(meta.abstract),
      '',
      '</details>'
    );
    lines.push('');
  }
  if (bibtex) {
    lines.push(
      '<details><summary>BibTeX</summary>',
      '',
      '```bibtex',
      bibtex,
      '```',
      '',
      '</details>'
    );
    lines.push('');
  }

  lines.push(
    source === 'inspire'
      ? `<sub>Added automatically from INSPIRE-HEP. Last updated ${date}.</sub>`
      : `<sub>From arXiv. This paper is not on INSPIRE-HEP yet; citations and BibTeX are ` +
          `added once it appears, checked daily. Last updated ${date}.</sub>`
  );
  return lines.join('\n');
}

/** The comment without its "Last updated" date, to tell real changes from reruns. */
export function comparableComment(body) {
  return (body ?? '').replace(/Last updated \d{4}-\d{2}-\d{2}\./, '').trim();
}

/** The issue title the bot sets once it knows the paper title. */
export function paperIssueTitle(id, title) {
  return `${id}: ${title.replace(/\s+/g, ' ').trim()}`.slice(0, 250);
}

// ── Site preview data ────────────────────────────────────────

/**
 * Converts paper issues into rows shaped like the Google Sheet's Public tab
 * (see COL in site/assets/js/config.js), plus the issue URL in column 9.
 * Unapproved and removed (closed as not planned) issues are left out.
 * Rows are sorted oldest first, which the site's deduplication relies on.
 */
export function issuesToRows(issues) {
  const rows = [];
  for (const issue of issues) {
    if (issue.pull_request) continue;
    const labels = new Set(issue.labels.map((l) => (typeof l === 'string' ? l : l.name)));
    if (!labels.has(LABELS.paper) || labels.has(LABELS.needsApproval)) continue;
    if (issue.state === 'closed' && issue.state_reason === 'not_planned') continue;

    const fields = parseIssueForm(issue.body);
    const imported = parseImported(issue.body);
    const votes = (imported?.votes ?? 0) + (issue.reactions?.['+1'] ?? 0);
    rows.push({
      sortKey: new Date(imported?.timestamp ?? issue.created_at).getTime(),
      row: [
        imported?.timestamp ?? issue.created_at,
        fields[FIELDS.name] || issue.user?.login || '',
        fields[FIELDS.arxiv] ?? '',
        fields[FIELDS.why] ?? '',
        'TRUE',
        '',
        '',
        String(votes),
        labels.has(LABELS.discussed) ? 'TRUE' : '',
        issue.html_url,
      ],
    });
  }
  rows.sort((a, b) => a.sortKey - b.sortKey);
  return rows.map((r) => r.row);
}

/** Serialises rows as RFC 4180 CSV with a header row. */
export function toCsv(rows) {
  const header = [
    'Timestamp',
    'Name',
    'arXiv ID',
    'Comment',
    'Approved',
    'Removed',
    'EditedComment',
    'Votes',
    'Discussed',
    'Issue',
  ];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n') + '\n';
}

// ── GitHub REST API ──────────────────────────────────────────

/** Minimal GitHub REST client for one repository ("owner/name"). */
export function github(token, repo) {
  const base = `https://api.github.com/repos/${repo}`;
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  async function request(method, path, body) {
    const res = await fetch(path.startsWith('http') ? path : base + path, {
      method,
      headers: body ? { ...headers, 'Content-Type': 'application/json' } : headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }

  async function paginate(path) {
    let url = `${base}${path}${path.includes('?') ? '&' : '?'}per_page=100`;
    const out = [];
    while (url) {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status} ${await res.text()}`);
      out.push(...(await res.json()));
      url = res.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }
    return out;
  }

  return { request, paginate };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
