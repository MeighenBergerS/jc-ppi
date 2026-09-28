/**
 * papers.test.js — Tests for the paper-issue helpers in scripts/papers/lib.js.
 * Run with: node --test tests/papers.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  FIELDS,
  LABELS,
  METADATA_MARKER,
  parseIssueForm,
  parseImported,
  importedMarker,
  cleanArxivId,
  weekStartDay,
  safeText,
  parseArxivAtom,
  renderMetadataComment,
  comparableComment,
  paperIssueTitle,
  issuesToRows,
  toCsv,
  chicagoWallTime,
  submittedAt,
  formatDate,
  isVisiblePaper,
  displayName,
  earlierSubmissions,
  renderSubmittedBeforeComment,
  SUBMITTED_BEFORE_MARKER,
} from '../scripts/papers/lib.js';
import { parseCsv } from '../site/assets/js/utils.js';

const formBody = (arxiv, why, name) =>
  [
    `### ${FIELDS.arxiv}`,
    '',
    arxiv,
    '',
    `### ${FIELDS.why}`,
    '',
    why,
    '',
    `### ${FIELDS.name}`,
    '',
    name,
  ].join('\n');

// The current form has no name field.
const newFormBody = (arxiv, why) =>
  [`### ${FIELDS.arxiv}`, '', arxiv, '', `### ${FIELDS.why}`, '', why].join('\n');

const paperIssue = (over = {}) => ({
  number: 1,
  state: 'open',
  state_reason: null,
  created_at: '2026-09-29T15:00:00Z',
  html_url: 'https://github.com/o/r/issues/1',
  user: { login: 'alice' },
  labels: [{ name: LABELS.paper }],
  reactions: { '+1': 0 },
  body: newFormBody('2301.12345', 'Why.'),
  ...over,
});

const importedBody = (timestamp, arxiv, name) =>
  importedMarker({ timestamp, votes: 0, arxiv }) + '\n' + formBody(arxiv, 'Why.', name);

// ── parseIssueForm ────────────────────────────────────────────

describe('parseIssueForm', () => {
  it('reads each field by its label', () => {
    const f = parseIssueForm(formBody('2301.12345', 'Neat result.', 'Alice'));
    assert.equal(f[FIELDS.arxiv], '2301.12345');
    assert.equal(f[FIELDS.why], 'Neat result.');
    assert.equal(f[FIELDS.name], 'Alice');
  });

  it('keeps multi-line answers', () => {
    const f = parseIssueForm(formBody('2301.12345', 'Line one.\n\nLine two.', 'Alice'));
    assert.equal(f[FIELDS.why], 'Line one.\n\nLine two.');
  });

  it('turns "_No response_" into an empty string', () => {
    assert.equal(parseIssueForm(formBody('x', '_No response_', 'A'))[FIELDS.why], '');
  });

  it('handles CRLF line endings', () => {
    const f = parseIssueForm(formBody('2301.12345', 'Why.', 'Bob').replace(/\n/g, '\r\n'));
    assert.equal(f[FIELDS.name], 'Bob');
  });

  it('ignores text and markers before the first heading', () => {
    const body = `_Imported._\n${importedMarker({ votes: 2 })}\n\n` + formBody('1', '2', '3');
    assert.deepEqual(Object.keys(parseIssueForm(body)), [FIELDS.arxiv, FIELDS.why, FIELDS.name]);
  });

  it('returns an empty object for an empty body', () => {
    assert.deepEqual(parseIssueForm(null), {});
  });
});

// ── imported marker ───────────────────────────────────────────

describe('parseImported', () => {
  it('round-trips the marker data', () => {
    const data = { timestamp: '3/2/2026 15:44:26', votes: 3, arxiv: '2503.01234' };
    assert.deepEqual(parseImported(`text\n${importedMarker(data)}\nmore`), data);
  });

  it('returns null without a marker', () => {
    assert.equal(parseImported(formBody('a', 'b', 'c')), null);
  });
});

// ── cleanArxivId ──────────────────────────────────────────────

describe('cleanArxivId', () => {
  it('accepts a bare modern ID', () => assert.equal(cleanArxivId('2301.12345'), '2301.12345'));
  it('strips a URL and version', () =>
    assert.equal(cleanArxivId('https://arxiv.org/pdf/2301.12345v3.pdf'), '2301.12345'));
  it('accepts an arXiv: prefix', () => assert.equal(cleanArxivId('arXiv:2301.1234'), '2301.1234'));
  it('accepts old-style IDs', () => assert.equal(cleanArxivId('hep-ph/9901123'), 'hep-ph/9901123'));
  it('zero-pads a three-digit prefix', () => assert.equal(cleanArxivId('708.1137'), '0708.1137'));
  it('rejects junk', () => assert.equal(cleanArxivId('not a paper'), null));
  it('rejects empty input', () => assert.equal(cleanArxivId(''), null));
});

// ── weekStartDay ──────────────────────────────────────────────

describe('weekStartDay', () => {
  const day = (iso) => Date.UTC(...iso.split('-').map((v, i) => +v - (i === 1))) / 86400000;

  it('maps a Wednesday to its Monday', () => {
    assert.equal(weekStartDay(new Date('2026-09-30T18:00:00Z')), day('2026-09-28'));
  });

  it('keeps late Sunday evening in Iowa in the same week, though it is Monday in UTC', () => {
    // 2026-10-05T03:00Z is Sunday 22:00 in Chicago (CDT, UTC-5).
    assert.equal(weekStartDay(new Date('2026-10-05T03:00:00Z')), day('2026-09-28'));
  });

  it('starts a new week at Monday 00:00 in Iowa', () => {
    // 2026-10-05T05:00Z is Monday 00:00 in Chicago.
    assert.equal(weekStartDay(new Date('2026-10-05T05:00:00Z')), day('2026-10-05'));
  });

  it('works across the end of daylight saving time', () => {
    // Sunday 2026-11-01 is the DST change; 2026-11-02T05:30Z is Sunday 23:30 CST.
    assert.equal(weekStartDay(new Date('2026-11-02T05:30:00Z')), day('2026-10-26'));
  });
});

// ── safeText and the metadata comment ─────────────────────────

describe('safeText', () => {
  it('escapes angle brackets and ampersands', () => {
    assert.equal(safeText('m < 1 & x > 2'), 'm &lt; 1 &amp; x &gt; 2');
  });
  it('stops @mentions from pinging', () => {
    assert.ok(!/@[a-z]/i.test(safeText('thanks @octocat')));
  });
});

describe('renderMetadataComment', () => {
  const meta = {
    title: 'A [bracketed] title',
    authors: 'A. One, B. Two',
    abstract: 'We find m < 1 GeV. Contact @someone.',
    citations: 7,
    inspireId: 123,
    categories: ['Pheno'],
    keywords: ['neutrino'],
  };

  it('starts with the marker the bot looks for', () => {
    const body = renderMetadataComment({ source: 'inspire', id: '2301.12345', meta, date: 'd' });
    assert.ok(body.startsWith(METADATA_MARKER));
  });

  it('links the paper and escapes external text', () => {
    const body = renderMetadataComment({
      source: 'inspire',
      id: '2301.12345',
      meta,
      bibtex: '@article{x}',
      date: '2026-09-28',
    });
    assert.ok(body.includes('(https://arxiv.org/abs/2301.12345)'));
    assert.ok(body.includes('\\[bracketed\\]'));
    assert.ok(body.includes('m &lt; 1 GeV'));
    assert.ok(!body.includes('@someone'));
    assert.ok(body.includes('```bibtex\n@article{x}\n```'), 'BibTeX is kept verbatim');
    assert.ok(body.includes('https://inspirehep.net/literature/123'));
  });

  it('says when a paper is only on arXiv', () => {
    const body = renderMetadataComment({ source: 'arxiv', id: '2301.12345', meta: {}, date: 'd' });
    assert.match(body, /not on INSPIRE-HEP yet/);
  });

  it('asks for a fix when the ID is invalid', () => {
    const body = renderMetadataComment({ source: 'invalid', id: '', raw: 'oops', date: 'd' });
    assert.match(body, /couldn't find \*\*oops\*\*/);
  });

  it('ignores only the date when comparing', () => {
    const a = renderMetadataComment({ source: 'inspire', id: '1', meta, date: '2026-01-01' });
    const b = renderMetadataComment({ source: 'inspire', id: '1', meta, date: '2026-02-02' });
    const c = renderMetadataComment({
      source: 'inspire',
      id: '1',
      meta: { ...meta, citations: 8 },
      date: '2026-01-01',
    });
    assert.equal(comparableComment(a), comparableComment(b));
    assert.notEqual(comparableComment(a), comparableComment(c));
  });
});

describe('paperIssueTitle', () => {
  it('prefixes the ID and collapses whitespace', () => {
    assert.equal(paperIssueTitle('2301.12345', 'A\n  title'), '2301.12345: A title');
  });
  it('stays within GitHub title limits', () => {
    assert.ok(paperIssueTitle('1', 'x'.repeat(400)).length <= 250);
  });
});

// ── parseArxivAtom ───────────────────────────────────────────

describe('parseArxivAtom', () => {
  it('reads title, authors and abstract', () => {
    const xml = `<feed><entry><id>http://arxiv.org/abs/2301.12345v1</id>
      <title>Neutrinos &amp; friends</title><summary>  An
      abstract. </summary>
      ${['A', 'B', 'C', 'D', 'E'].map((n) => `<author><name>${n}</name></author>`).join('')}
      </entry></feed>`;
    assert.deepEqual(parseArxivAtom(xml), {
      title: 'Neutrinos & friends',
      authors: 'A, B, C, D et al.',
      abstract: 'An abstract.',
    });
  });

  it('flags the Error entry arXiv returns for unknown IDs', () => {
    const xml = '<feed><entry><title>Error</title><summary>incorrect id</summary></entry></feed>';
    assert.deepEqual(parseArxivAtom(xml), { invalid: true });
  });

  it('flags a feed with no entry', () => {
    assert.deepEqual(parseArxivAtom('<feed></feed>'), { invalid: true });
  });
});

// ── issuesToRows and toCsv ───────────────────────────────────

describe('issuesToRows', () => {
  const issue = (over = {}) => ({
    number: 1,
    state: 'open',
    state_reason: null,
    created_at: '2026-09-29T15:00:00Z',
    html_url: 'https://github.com/o/r/issues/1',
    user: { login: 'alice' },
    labels: [{ name: LABELS.paper }],
    reactions: { '+1': 2 },
    body: formBody('2301.12345', 'Why.', 'Alice'),
    ...over,
  });

  it('maps an issue onto the Public tab columns plus the issue URL', () => {
    assert.deepEqual(issuesToRows([issue()]), [
      [
        '2026-09-29T15:00:00Z',
        'Alice',
        '2301.12345',
        'Why.',
        'TRUE',
        '',
        '',
        '2',
        '',
        'https://github.com/o/r/issues/1',
      ],
    ]);
  });

  it('leaves out unapproved, removed, non-paper issues and pull requests', () => {
    const rows = issuesToRows([
      issue({ labels: [{ name: LABELS.paper }, { name: LABELS.needsApproval }] }),
      issue({ state: 'closed', state_reason: 'not_planned' }),
      issue({ labels: [{ name: 'bug' }] }),
      issue({ pull_request: {} }),
    ]);
    assert.equal(rows.length, 0);
  });

  it('keeps issues closed as completed (past weeks)', () => {
    assert.equal(issuesToRows([issue({ state: 'closed', state_reason: 'completed' })]).length, 1);
  });

  it('marks discussed papers', () => {
    const [row] = issuesToRows([
      issue({ labels: [{ name: LABELS.paper }, { name: LABELS.discussed }] }),
    ]);
    assert.equal(row[8], 'TRUE');
  });

  it('uses the imported timestamp and adds imported votes to new 👍 votes', () => {
    const body =
      importedMarker({ timestamp: '3/2/2026 15:44:26', votes: 3, arxiv: '1' }) +
      '\n' +
      formBody('2301.12345', 'Why.', 'Alice');
    const [row] = issuesToRows([issue({ body, reactions: { '+1': 1 } })]);
    assert.equal(row[0], '3/2/2026 15:44:26');
    assert.equal(row[7], '4');
  });

  it('falls back to the GitHub login when no name is given', () => {
    const [row] = issuesToRows([issue({ body: formBody('2301.12345', 'Why.', '_No response_') })]);
    assert.equal(row[1], 'alice');
  });

  it('uses the GitHub profile name for issues from the current form', () => {
    const [row] = issuesToRows(
      [issue({ body: newFormBody('2301.12345', 'Why.') })],
      new Map([['alice', 'Alice Liddell']])
    );
    assert.equal(row[1], 'Alice Liddell');
    assert.equal(row[2], '2301.12345');
    assert.equal(row[3], 'Why.');
  });

  it('sorts oldest first so deduplication keeps the earliest submission', () => {
    const rows = issuesToRows([
      issue({ number: 2, created_at: '2026-09-30T00:00:00Z' }),
      issue({ number: 1, created_at: '2026-09-29T00:00:00Z' }),
    ]);
    assert.deepEqual(
      rows.map((r) => r[0]),
      ['2026-09-29T00:00:00Z', '2026-09-30T00:00:00Z']
    );
  });
});

describe('toCsv', () => {
  it('round-trips through the site CSV parser, including quotes, commas and newlines', () => {
    const rows = [['t', 'Name, Jr.', '2301.12345', 'He said "wow"\nthen left', 'TRUE']];
    const parsed = parseCsv(toCsv(rows));
    assert.equal(parsed[0][0], 'Timestamp');
    assert.deepEqual(parsed[1], rows[0]);
  });
});

// ── Submission times ─────────────────────────────────────────

describe('chicagoWallTime', () => {
  it('reads a Sheet timestamp as Central Daylight Time', () => {
    assert.equal(chicagoWallTime('9/4/2026 15:44:26').toISOString(), '2026-09-04T20:44:26.000Z');
  });
  it('reads a winter timestamp as Central Standard Time', () => {
    assert.equal(chicagoWallTime('3/2/2026 9:05:00').toISOString(), '2026-03-02T15:05:00.000Z');
  });
  it('returns an invalid date for other formats', () => {
    assert.ok(isNaN(chicagoWallTime('2026-09-04')));
  });
});

describe('submittedAt and formatDate', () => {
  it('uses the Sheet time for imported issues', () => {
    const issue = paperIssue({ body: importedBody('9/4/2026 23:30:00', '2301.12345', 'A') });
    // 23:30 in Iowa is already Sep 5 in UTC; the date shown must stay Sep 4.
    assert.equal(formatDate(submittedAt(issue)), 'Sep 4, 2026');
  });
  it('uses the creation time otherwise', () => {
    assert.equal(submittedAt(paperIssue()).toISOString(), '2026-09-29T15:00:00.000Z');
  });
});

// ── Visibility and names ─────────────────────────────────────

describe('isVisiblePaper', () => {
  it('accepts an approved open paper', () => assert.ok(isVisiblePaper(paperIssue())));
  it('rejects papers awaiting approval', () =>
    assert.ok(
      !isVisiblePaper(
        paperIssue({ labels: [{ name: LABELS.paper }, { name: LABELS.needsApproval }] })
      )
    ));
  it('rejects removed papers', () =>
    assert.ok(!isVisiblePaper(paperIssue({ state: 'closed', state_reason: 'not_planned' }))));
  it('rejects non-paper issues', () =>
    assert.ok(!isVisiblePaper(paperIssue({ labels: [{ name: 'bug' }] }))));
});

describe('displayName', () => {
  it('prefers the imported name', () => {
    const issue = paperIssue({ body: importedBody('9/4/2026 12:00:00', '1', 'Hallsie') });
    assert.equal(displayName(issue, new Map([['alice', 'Alice']])), 'Hallsie');
  });
  it('then the profile name, then the login', () => {
    assert.equal(displayName(paperIssue(), new Map([['alice', 'Alice L.']])), 'Alice L.');
    assert.equal(displayName(paperIssue()), 'alice');
  });
});

// ── Earlier submissions ──────────────────────────────────────

describe('earlierSubmissions', () => {
  const old = paperIssue({
    number: 5,
    state: 'closed',
    state_reason: 'completed',
    labels: [{ name: LABELS.paper }, { name: LABELS.discussed }],
    body: importedBody('9/4/2026 12:00:00', 'https://arxiv.org/abs/2301.12345v2', 'Sudipta'),
  });
  const now = paperIssue({ number: 9, created_at: '2026-09-29T15:00:00Z' });

  it('finds an earlier issue for the same paper, whatever form the ID took', () => {
    assert.deepEqual(
      earlierSubmissions(now, [old, now]).map((e) => [e.number, e.name, e.discussed]),
      [[5, 'Sudipta', true]]
    );
  });

  it('ignores later submissions', () => {
    assert.deepEqual(earlierSubmissions(old, [old, now]), []);
  });

  it('ignores other papers, removed issues and unapproved issues', () => {
    const others = [
      paperIssue({
        number: 2,
        created_at: '2026-01-01T00:00:00Z',
        body: newFormBody('2301.99999', 'x'),
      }),
      paperIssue({
        number: 3,
        created_at: '2026-01-01T00:00:00Z',
        state: 'closed',
        state_reason: 'not_planned',
      }),
      paperIssue({
        number: 4,
        created_at: '2026-01-01T00:00:00Z',
        labels: [{ name: LABELS.paper }, { name: LABELS.needsApproval }],
      }),
    ];
    assert.deepEqual(earlierSubmissions(now, [...others, now]), []);
  });

  it('breaks exact ties by issue number', () => {
    const twin = paperIssue({ number: 10 });
    assert.deepEqual(
      earlierSubmissions(twin, [now, twin]).map((e) => e.number),
      [9]
    );
    assert.deepEqual(earlierSubmissions(now, [now, twin]), []);
  });

  it('returns nothing for an invalid ID', () => {
    assert.deepEqual(earlierSubmissions(paperIssue({ body: newFormBody('oops', 'x') }), [old]), []);
  });
});

describe('renderSubmittedBeforeComment', () => {
  it('lists each earlier issue with its date and submitter', () => {
    const body = renderSubmittedBeforeComment([
      { number: 5, date: new Date('2026-09-04T17:00:00Z'), name: 'Sudipta', discussed: true },
    ]);
    assert.ok(body.startsWith(SUBMITTED_BEFORE_MARKER));
    assert.match(body, /- #5, Sep 4, 2026, by Sudipta \(discussed\)/);
  });
});
