/* ============================================================
   scripts/papers/lib.js — Helpers for paper-submission issues
   ============================================================
   Shared by enrich.js (the bot that fills in paper metadata),
   build-csv.js (the site data) and the Slack reminder. Issues
   labelled "imported" hold the Google Sheet history (imported once
   in September 2026). Runs in Node >= 18.
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
  updatedByBot: 'Updated By Bot',
  submittedBefore: 'Submitted Before',
  // The bot's twice-weekly trending list. Also labelled `paper`, but never a submission.
  trending: 'Trending',
};

// Field labels of .github/ISSUE_TEMPLATE/1-paper.yml. Change both together.
// `name` is no longer in the form (names come from GitHub profiles); only
// issues imported from the Google Sheet carry it.
export const FIELDS = {
  arxiv: 'arXiv ID or link',
  why: 'Why this paper?',
  name: 'Name to show on the site',
};

export const METADATA_MARKER = '<!-- jc-ppi:paper-metadata -->';
export const SUBMITTED_BEFORE_MARKER = '<!-- jc-ppi:submitted-before -->';
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

/**
 * Reads a Google Sheet timestamp ("9/4/2026 15:44:26", Central Time wall
 * clock) as a Date. Returns an invalid Date if the string doesn't match.
 */
export function chicagoWallTime(text, timeZone = TIMEZONE) {
  const m = (text ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (!m) return new Date(NaN);
  const [, mo, d, y, h, mi, s] = m.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  // Shift by the zone's offset at that moment (twice, in case it crosses a DST change).
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      })
        .formatToParts(new Date(t))
        .map((x) => [x.type, +x.value])
    );
    t += guess - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  }
  return new Date(t);
}

/** When a paper issue was submitted: the Sheet time for imported issues, else creation. */
export function submittedAt(issue) {
  const stamp = parseImported(issue.body)?.timestamp;
  return stamp ? chicagoWallTime(stamp) : new Date(issue.created_at);
}

/** "Sep 4, 2026", in Central Time. */
export function formatDate(date, timeZone = TIMEZONE) {
  return date.toLocaleDateString('en-US', {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Paper issues ─────────────────────────────────────────────

const labelSet = (issue) => new Set(issue.labels.map((l) => (typeof l === 'string' ? l : l.name)));

/** True for issues that are paper submissions (not Trending lists or pull requests). */
export function isSubmission(issue) {
  const labels = labelSet(issue);
  return !issue.pull_request && labels.has(LABELS.paper) && !labels.has(LABELS.trending);
}

/** True for approved paper submissions that were not removed (closed as not planned). */
export function isVisiblePaper(issue) {
  const labels = labelSet(issue);
  return (
    isSubmission(issue) &&
    !labels.has(LABELS.needsApproval) &&
    !(issue.state === 'closed' && issue.state_reason === 'not_planned')
  );
}

/**
 * The name shown for a submitter: the name typed into the Google Sheet for
 * imported issues, else the GitHub profile name, else the username.
 * @param {Map<string,string>} names - login → profile name, from fetchProfileNames().
 */
export function displayName(issue, names = new Map()) {
  const login = issue.user?.login ?? '';
  return parseIssueForm(issue.body)[FIELDS.name] || names.get(login) || login;
}

/** Looks up GitHub profile names for the authors of non-imported issues. */
export async function fetchProfileNames(api, issues) {
  const logins = new Set(
    issues.filter((i) => !parseImported(i.body) && i.user?.login).map((i) => i.user.login)
  );
  const names = new Map();
  for (const login of logins) {
    try {
      const user = await api.request('GET', `https://api.github.com/users/${login}`);
      if (user.name?.trim()) names.set(login, user.name.trim());
    } catch (err) {
      console.error(`Profile of ${login} unavailable: ${err.message}`);
    }
  }
  return names;
}

/**
 * Earlier visible submissions of the same paper, oldest first.
 * @returns {{number, date: Date, name: string, discussed: boolean}[]}
 */
export function earlierSubmissions(issue, allIssues, names = new Map()) {
  const id = cleanArxivId(parseIssueForm(issue.body)[FIELDS.arxiv]);
  if (!id) return [];
  const when = submittedAt(issue).getTime();
  return allIssues
    .filter((other) => other.number !== issue.number && isVisiblePaper(other))
    .filter((other) => cleanArxivId(parseIssueForm(other.body)[FIELDS.arxiv]) === id)
    .map((other) => ({ other, date: submittedAt(other) }))
    .filter(
      ({ other, date }) =>
        date.getTime() < when || (date.getTime() === when && other.number < issue.number)
    )
    .sort((a, b) => a.date - b.date)
    .map(({ other, date }) => ({
      number: other.number,
      date,
      name: displayName(other, names),
      discussed: labelSet(other).has(LABELS.discussed),
    }));
}

/** The bot's comment listing earlier submissions of the same paper. */
export function renderSubmittedBeforeComment(earlier) {
  const lines = earlier.map(
    (e) =>
      `- #${e.number}, ${formatDate(e.date)}, by ${safeText(e.name)}` +
      (e.discussed ? ' (discussed)' : '')
  );
  return [SUBMITTED_BEFORE_MARKER, `This paper was suggested before:`, '', ...lines].join('\n');
}

// ── Approval ─────────────────────────────────────────────────

/** Reads a list of GitHub usernames, one per line, "#" comments allowed. */
export function parseLoginList(text) {
  return (text ?? '')
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean);
}

/**
 * The bot's reply to a paper from a non-member. It @mentions the maintainers,
 * which makes GitHub email them.
 */
export function renderApprovalRequest(login, maintainers) {
  const who = maintainers.map((m) => `@${m}`).join(' ');
  return [
    `Thanks for the suggestion, @${login}! It shows on the website once a maintainer approves it.`,
    '',
    `${who}: this paper is from someone not on the members list. To approve it, remove the ` +
      '`needs approval` label. To approve their future papers too, add ' +
      `\`${login}\` to \`.github/paper-members.txt\`.`,
  ].join('\n');
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

// ── Site data ────────────────────────────────────────

/**
 * Converts paper issues into rows for data/papers.csv, laid out like the retired Google Sheet's Public tab
 * (see COL in site/assets/js/config.js), plus the issue URL in column 9.
 * Unapproved and removed (closed as not planned) issues are left out.
 * `names` maps logins to profile names (fetchProfileNames).
 * Rows are sorted oldest first, which the site's deduplication relies on.
 */
export function issuesToRows(issues, names = new Map()) {
  const rows = [];
  for (const issue of issues) {
    if (!isVisiblePaper(issue)) continue;
    const labels = labelSet(issue);
    const fields = parseIssueForm(issue.body);
    const imported = parseImported(issue.body);
    const votes = (imported?.votes ?? 0) + (issue.reactions?.['+1'] ?? 0);
    rows.push({
      sortKey: submittedAt(issue).getTime(),
      row: [
        imported?.timestamp ?? issue.created_at,
        displayName(issue, names),
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

const PAPERS_HEADER = [
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

/** Serialises rows as RFC 4180 CSV with a header row (the papers header by default). */
export function toCsv(rows, header = PAPERS_HEADER) {
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
