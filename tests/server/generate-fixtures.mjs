/**
 * generate-fixtures.mjs — Fixture generator for the local dev server.
 *
 * Fetches real paper IDs from the INSPIRE-HEP API, then synthesises a
 * realistic submissions CSV using the users and round schedule defined in
 * scenario.json.  Writes two files that the dev server prefers over the
 * committed baseline fixtures:
 *
 *   tests/fixtures/submissions.fresh.csv
 *   tests/fixtures/inspire-response.fresh.json
 *   tests/fixtures/trending.fresh.csv
 *
 * Those files are .gitignored so they never pollute the repo.
 *
 * Usage:
 *   node tests/server/generate-fixtures.mjs
 *
 * The dev server (tests/server/index.mjs) runs this automatically when
 * started with --refresh.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..', '..');
const FIXTURES  = join(ROOT, 'tests', 'fixtures');

// ── Load scenario ─────────────────────────────────────────────────
const scenario = JSON.parse(readFileSync(join(__dirname, 'scenario.json'), 'utf8'));

const {
  users,
  rounds,
  totalPapers,
  recentPapers,
  recentWeeks,
} = scenario;

const INSPIRE_BASE = 'https://inspirehep.net/api/literature';
const LOOKBACK_WEEKS = 4; // mirrors INSPIRE_LOOKBACK_WEEKS in appscript.gs

// ── Date helpers ──────────────────────────────────────────────────

function weekStart(date) {
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns a random timestamp (as Date) somewhere during `weeksAgo` weeks back. */
function randomTimestampInWeek(weeksAgo) {
  const monday = weekStart(new Date());
  monday.setDate(monday.getDate() - weeksAgo * 7);
  // Random offset: 1–5 days into the week, random hour 8–17
  const dayOffset  = 1 + Math.floor(Math.random() * 5);
  const hourOffset = 8  + Math.floor(Math.random() * 10);
  const minOffset  = Math.floor(Math.random() * 60);
  const d = new Date(monday);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hourOffset, minOffset, 0, 0);
  return d;
}

function fmtTimestamp(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ── INSPIRE fetch helpers ─────────────────────────────────────────

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetches a page of INSPIRE results, returns the hits array.
 * Retries once on 429.
 */
async function fetchInspirePage(url) {
  let res = await fetch(url);
  if (res.status === 429) {
    console.log('  Rate limited — waiting 6s…');
    await sleep(6000);
    res = await fetch(url);
  }
  if (!res.ok) throw new Error(`INSPIRE HTTP ${res.status} for ${url}`);
  return res.json();
}

// ── Step 1: fetch paper pool from INSPIRE ─────────────────────────

console.log('── Step 1: Fetching paper pool from INSPIRE-HEP ──────────────');

const allPapers = []; // { arxivId, title, authors, abstract, citations, citationsNoSelf, affiliation }

// Fetch recent papers (last recentWeeks weeks)
const recentCutoff = new Date();
recentCutoff.setDate(recentCutoff.getDate() - recentWeeks * 7);
const recentDateStr = recentCutoff.toISOString().slice(0, 10);

console.log(`Fetching ${recentPapers} recent papers (de > ${recentDateStr})…`);
{
  // Fetch in pages of 25 (INSPIRE max) until we have recentPapers results.
  let page = 1;
  while (allPapers.length < recentPapers) {
    if (page > 1) await sleep(700);
    const url = INSPIRE_BASE
      + `?q=${encodeURIComponent(`arxiv_eprints.categories:hep-ph and de > ${recentDateStr}`)}`
      + `&sort=mostcited&size=25&page=${page}`
      + '&fields=arxiv_eprints,titles,abstracts,authors,collaborations,citation_count,citation_count_without_self_citations';

    const json = await fetchInspirePage(url);
    const hits  = json.hits?.hits ?? [];
    if (hits.length === 0) break; // INSPIRE has no more results
    for (const hit of hits) {
      const m       = hit.metadata;
      const arxivId = m.arxiv_eprints?.[0]?.value ?? '';
      if (!arxivId) continue;
      allPapers.push(_extractPaper(m, arxivId));
      if (allPapers.length >= recentPapers) break;
    }
    page++;
  }
  console.log(`  Got ${allPapers.length} recent papers.`);
}

// Fetch additional older papers to reach totalPapers
const needed   = totalPapers - allPapers.length;
const batches  = Math.ceil(needed / 25);
const seenIds  = new Set(allPapers.map((p) => p.arxivId));

console.log(`Fetching ~${needed} older papers in ${batches} batch(es) of 25…`);
for (let i = 0; i < batches && allPapers.length < totalPapers; i++) {
  await sleep(600);
  // Stagger the year range so we get variety across the archive
  const yearOffset = 1 + Math.floor(i / 2);
  const yearCutoff = new Date();
  yearCutoff.setFullYear(yearCutoff.getFullYear() - yearOffset - 1);
  const yearMax = new Date(yearCutoff);
  yearMax.setFullYear(yearMax.getFullYear() + 1);
  const fromStr = yearCutoff.toISOString().slice(0, 10);
  const toStr   = yearMax.toISOString().slice(0, 10);

  const url = INSPIRE_BASE
    + `?q=${encodeURIComponent(`arxiv_eprints.categories:hep-ph and de > ${fromStr} and de < ${toStr}`)}`
    + `&sort=mostcited&size=25&page=${(i % 4) + 1}`
    + '&fields=arxiv_eprints,titles,abstracts,authors,collaborations,citation_count,citation_count_without_self_citations';

  try {
    const json = await fetchInspirePage(url);
    for (const hit of json.hits?.hits ?? []) {
      const m       = hit.metadata;
      const arxivId = m.arxiv_eprints?.[0]?.value ?? '';
      if (!arxivId || seenIds.has(arxivId)) continue;
      seenIds.add(arxivId);
      allPapers.push(_extractPaper(m, arxivId));
    }
  } catch (err) {
    console.warn(`  Batch ${i + 1} failed: ${err.message} — skipping`);
  }
}

console.log(`Total papers in pool: ${allPapers.length}`);

// ── Step 2: Synthesise submissions CSV ───────────────────────────

console.log('\n── Step 2: Synthesising submissions CSV ──────────────────────');

// Split papers: first `recentPapers` are eligible for current/recent weeks,
// the rest are used for the distant-past rounds.
const recentPool = allPapers.slice(0, recentPapers);
const oldPool    = allPapers.slice(recentPapers);

// Each round randomly assigns a paper to each user
const rows = []; // { timestamp, name, arxivId, comment, approved, votes, discussed }

for (const round of rounds) {
  const isDistant = round.weeksAgo >= 10;
  const pool      = isDistant ? oldPool : recentPool;

  // Shuffle a copy so each user gets a distinct paper
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  for (let u = 0; u < users.length && u < shuffled.length; u++) {
    for (let p = 0; p < round.papersPerUser; p++) {
      const paperIdx = (u * round.papersPerUser + p) % shuffled.length;
      const paper    = shuffled[paperIdx];
      const ts       = randomTimestampInWeek(round.weeksAgo);

      rows.push({
        timestamp:  fmtTimestamp(ts),
        name:       users[u],
        arxivId:    paper.arxivId,
        comment:    _sampleComment(paper),
        approved:   'TRUE',
        removed:    '',
        edited:     '',
        votes:      String(Math.floor(Math.random() * 8)),
        discussed:  round.weeksAgo > 0 && Math.random() < 0.4 ? 'TRUE' : '',
      });
    }
  }
}

// Sort by timestamp ascending (oldest first)
rows.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

// Build CSV
const CSV_HEADER = 'Timestamp,Name,arXiv ID,Comment,Approved,Removed,EditedComment,Votes,Discussed';
const csvLines   = [CSV_HEADER];
for (const r of rows) {
  csvLines.push([
    r.timestamp,
    csvField(r.name),
    r.arxivId,
    csvField(r.comment),
    r.approved,
    r.removed,
    csvField(r.edited),
    r.votes,
    r.discussed,
  ].join(','));
}
const csvContent = csvLines.join('\n') + '\n';

// ── Step 3: Build INSPIRE response JSON fixture ───────────────────

console.log('\n── Step 3: Building INSPIRE response fixture ─────────────────');

// Collect all unique IDs referenced in the CSV
const usedIds = [...new Set(rows.map((r) => r.arxivId))];
const hits    = usedIds.map((id) => {
  const paper = allPapers.find((p) => p.arxivId === id);
  if (!paper) return null;
  return {
    metadata: {
      arxiv_eprints: [{ value: id }],
      titles:        [{ title: paper.title }],
      abstracts:     [{ value: paper.abstract }],
      authors:       paper.authorObjects,
      citation_count: paper.citations,
      citation_count_without_self_citations: paper.citationsNoSelf,
      inspire_categories: [{ term: 'Phenomenology-HEP' }],
      keywords: [],
    },
  };
}).filter(Boolean);

const inspireFixture = { hits: { total: hits.length, hits } };

// ── Step 4: Build trending CSV fixture ───────────────────────────
//
// Mirrors what refreshTrendingPapers() does in appscript.gs:
// one INSPIRE query per category, using `de > cutoff` (preprint date)
// and the category-specific `extra` search term.

console.log('\n── Step 4: Building trending CSV fixture ─────────────────────');

const TREND_CATEGORIES    = scenario.trendingCategories ?? [{ label: 'Overall hep-ph', extra: '' }];
const PER_CAT             = scenario.trendingResultsPerCategory ?? 3;
const TREND_LOOKBACK_WEEKS = scenario.trendingLookbackWeeks ?? 4;

const trendCutoff  = new Date();
trendCutoff.setDate(trendCutoff.getDate() - TREND_LOOKBACK_WEEKS * 7);
const trendDateStr = trendCutoff.toISOString().slice(0, 10);

const trendRows = ['Category,Rank,ArxivId,Title,Abstract,Authors,Affiliation,Citations,CitationsNoSelf'];

for (let ci = 0; ci < TREND_CATEGORIES.length; ci++) {
  const cat = TREND_CATEGORIES[ci];
  if (ci > 0) await sleep(1000);

  let query = `arxiv_eprints.categories:hep-ph and de > ${trendDateStr}`;
  if (cat.extra) query += ` and ${cat.extra}`;

  const url = INSPIRE_BASE
    + `?q=${encodeURIComponent(query)}`
    + `&sort=mostcited&size=${PER_CAT}`
    + '&fields=arxiv_eprints,titles,abstracts,authors,collaborations,citation_count,citation_count_without_self_citations';

  try {
    const json = await fetchInspirePage(url);
    const hits = json.hits?.hits ?? [];
    console.log(`  ${cat.label}: ${hits.length} result(s) (total: ${json.hits?.total ?? '?'})`);

    hits.forEach((hit, rank) => {
      const p = _extractPaper(hit.metadata, hit.metadata.arxiv_eprints?.[0]?.value ?? '');
      if (!p.arxivId) return;
      trendRows.push([
        csvField(cat.label),
        rank + 1,
        p.arxivId,
        csvField(p.title),
        csvField(p.abstract.slice(0, 500)),
        csvField(p.authors),
        csvField(p.affiliation),
        p.citations,
        p.citationsNoSelf,
      ].join(','));
    });
  } catch (err) {
    console.warn(`  ${cat.label}: fetch failed — ${err.message}`);
  }
}

const trendContent = trendRows.join('\n') + '\n';

// ── Write files ───────────────────────────────────────────────────

console.log('\n── Writing fixture files ────────────────────────────────────');

writeFileSync(join(FIXTURES, 'submissions.fresh.csv'),        csvContent,                   'utf8');
writeFileSync(join(FIXTURES, 'inspire-response.fresh.json'), JSON.stringify(inspireFixture, null, 2), 'utf8');
writeFileSync(join(FIXTURES, 'trending.fresh.csv'),           trendContent,                 'utf8');

console.log(`  Written: tests/fixtures/submissions.fresh.csv      (${rows.length} rows)`);
console.log(`  Written: tests/fixtures/inspire-response.fresh.json (${hits.length} entries)`);
console.log(`  Written: tests/fixtures/trending.fresh.csv`);
console.log('\nDone. Run `npm run dev` to start the local server with fresh data.');

// ── Internal helpers ──────────────────────────────────────────────

function _extractPaper(m, arxivId) {
  let authors     = '';
  let affiliation = '';
  const authorObjects = [];

  if (m.collaborations?.length) {
    authors = (m.collaborations[0].value ?? '') + ' Collaboration';
    authorObjects.push({ full_name: authors });
  } else if (m.authors?.length) {
    const names = m.authors.slice(0, 20).map((a) => a.full_name ?? '').filter(Boolean);
    authors     = names.length <= 10 ? names.join(', ') : names[0] + ' et al.';
    affiliation = m.authors[0]?.affiliations?.[0]?.value ?? '';
    for (const a of m.authors.slice(0, 20)) {
      authorObjects.push({
        full_name:    a.full_name ?? '',
        affiliations: a.affiliations ?? [],
      });
    }
  }

  return {
    arxivId,
    title:         m.titles?.[0]?.title ?? '',
    abstract:      m.abstracts?.[0]?.value ?? '',
    authors,
    affiliation,
    authorObjects,
    citations:        Number(m.citation_count) || 0,
    citationsNoSelf:  Number(m.citation_count_without_self_citations) || 0,
  };
}

function _sampleComment(paper) {
  const templates = [
    `Interesting recent result — ${paper.authors.split(',')[0].trim()} et al.`,
    `Worth discussing at the next meeting.`,
    `Related to our recent discussion on this topic.`,
    `Highly cited already — ${paper.citations} citations.`,
    `Relevant to current experiments.`,
    `New constraints from latest data.`,
    `Potential implications for our research.`,
    `Saw this on arXiv this morning.`,
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

/** Wraps a field in double-quotes and escapes internal quotes. */
function csvField(v) {
  const s = String(v ?? '').replace(/"/g, '""');
  return `"${s}"`;
}
