/**
 * index.mjs — Local dev server for jc-ppi.
 *
 * Serves the site/ directory as static files and intercepts the three
 * external URLs the site normally talks to:
 *
 *   Google Sheets CSV  →  /mock/sheet.csv       (submissions fixture)
 *   Trending CSV       →  /mock/trending.csv     (trending fixture)
 *   INSPIRE-HEP API    →  /mock/inspire          (INSPIRE response fixture)
 *   Apps Script mutate →  /mock/mutate           (in-memory state)
 *
 * Config injection:
 *   When serving any HTML page the server appends a small <script> block
 *   that overwrites CONFIG.sheetCsvUrl, CONFIG.trendingCsvUrl,
 *   CONFIG.mutateUrl, and the INSPIRE base URL with local equivalents.
 *   The real config.js on disk is never modified.
 *
 * Usage:
 *   node tests/server/index.mjs [--port N] [--refresh]
 *
 *   --port N     Listen on port N (default: 3000)
 *   --refresh    Re-generate fixture files from live INSPIRE data before
 *                starting (runs generate-fixtures.mjs).
 *
 * npm scripts (package.json):
 *   npm run dev           Start server with committed fixtures
 *   npm run refresh       Re-generate fixtures then start server
 */

import { createServer }         from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath }        from 'node:url';
import { dirname, join, extname } from 'node:path';
import { execSync }             from 'node:child_process';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = join(__dirname, '..', '..');
const SITE_DIR   = join(ROOT, 'site');
const FIXTURES   = join(ROOT, 'tests', 'fixtures');

// ── CLI args ──────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const PORT    = Number(args[args.indexOf('--port') + 1] || 0) || 3000;
const REFRESH = args.includes('--refresh');

// ── Optionally regenerate fixtures ───────────────────────────────

if (REFRESH) {
  console.log('⟳  Refreshing fixtures from INSPIRE-HEP…\n');
  execSync(`node ${join(__dirname, 'generate-fixtures.mjs')}`, { stdio: 'inherit' });
  console.log('');
}

// ── Fixture loader — prefers .fresh. variants if present ─────────

function loadFixture(base) {
  const fresh = join(FIXTURES, base.replace('.', '.fresh.'));
  const committed = join(FIXTURES, base);
  if (existsSync(fresh)) {
    console.log(`  Using fresh fixture: tests/fixtures/${base.replace('.', '.fresh.')}`);
    return readFileSync(fresh, 'utf8');
  }
  return readFileSync(committed, 'utf8');
}

const SUBMISSIONS_CSV  = loadFixture('submissions.csv');
const INSPIRE_JSON_STR = loadFixture('inspire-response.json');
const INSPIRE_DATA     = JSON.parse(INSPIRE_JSON_STR);

// Trending CSV — optional (gracefully absent until generated)
let TRENDING_CSV = '';
const trendingFresh     = join(FIXTURES, 'trending.fresh.csv');
const trendingCommitted = join(FIXTURES, 'trending.csv');
if (existsSync(trendingFresh)) {
  TRENDING_CSV = readFileSync(trendingFresh, 'utf8');
  console.log('  Using fresh fixture: tests/fixtures/trending.fresh.csv');
} else if (existsSync(trendingCommitted)) {
  TRENDING_CSV = readFileSync(trendingCommitted, 'utf8');
} else {
  console.log('  No trending fixture found — trending section will show "empty" state.');
}

// ── In-memory mutation store ─────────────────────────────────────
// Mirrors what Apps Script does: vote counts, removed flags, edited comments.

const mutationStore = new Map(); // arxivId → { votes, removed, edited, discussed }

function getEntry(id) {
  if (!mutationStore.has(id)) mutationStore.set(id, { votes: 0, removed: false, edited: '', discussed: false });
  return mutationStore.get(id);
}

// ── INSPIRE mock handler ─────────────────────────────────────────
//
// The real site calls:
//   https://inspirehep.net/api/literature?q=arxiv:ID1 or arxiv:ID2…&fields=…
//
// We parse the `q` param, extract the requested arXiv IDs, filter the
// fixture JSON to only the matching hits, and return that subset.
// Unknown IDs are silently omitted (gives the same behaviour as INSPIRE
// when a paper isn't indexed yet).

function handleInspireMock(req, res) {
  const urlObj   = new URL(req.url, `http://localhost:${PORT}`);
  const q        = urlObj.searchParams.get('q') ?? '';

  // Extract arXiv IDs: "arxiv:2101.03729 or arxiv:2102.05719 …"
  const requested = new Set(
    [...q.matchAll(/arxiv:(\S+)/gi)].map((m) => m[1].replace(/v\d+$/, ''))
  );

  const hits = requested.size === 0
    ? INSPIRE_DATA.hits.hits
    : INSPIRE_DATA.hits.hits.filter((hit) => {
        const id = (hit.metadata?.arxiv_eprints?.[0]?.value ?? '').replace(/v\d+$/, '');
        return requested.has(id);
      });

  const body = JSON.stringify({ hits: { total: hits.length, hits } });
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

// ── Mutate mock handler ──────────────────────────────────────────

function handleMutateMock(req, res) {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try {
      const data    = JSON.parse(body);
      const action  = data.action ?? '';
      const arxivId = (data.arxivId ?? '').trim();

      if (action === 'triggerTrendingRefresh') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (!arxivId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Missing arxivId' }));
        return;
      }

      const entry = getEntry(arxivId);

      if (action === 'vote') {
        entry.votes += 1;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, votes: entry.votes }));

      } else if (action === 'remove') {
        entry.removed = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));

      } else if (action === 'edit') {
        entry.edited = (data.comment ?? '').trim();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));

      } else if (action === 'discuss') {
        entry.discussed = !entry.discussed;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, discussed: entry.discussed }));

      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }));
      }
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
}

// ── Config injection snippet ──────────────────────────────────────
//
// When serving config.js we replace the three external URLs with local
// mock equivalents.  The file on disk is never modified.
// Using exact URL strings from config.js ensures the replacement is robust.

const MOCK_BASE = `http://localhost:${PORT}`;

// Read real config.js once and patch it
const REAL_CONFIG_JS = readFileSync(join(SITE_DIR, 'assets', 'js', 'config.js'), 'utf8');
const PATCHED_CONFIG_JS = REAL_CONFIG_JS
  .replace(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSV30CUvQZhLXFlvt0HqGmGsMZqaapy4S_xIQAxYiJp1IBkkW515MNIdBvSnEaYRu9NQ1rOvCANW2ua/pub?gid=620589092&single=true&output=csv',
    `${MOCK_BASE}/mock/sheet.csv`
  )
  .replace(
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vSV30CUvQZhLXFlvt0HqGmGsMZqaapy4S_xIQAxYiJp1IBkkW515MNIdBvSnEaYRu9NQ1rOvCANW2ua/pub?gid=1574674238&single=true&output=csv',
    `${MOCK_BASE}/mock/trending.csv`
  )
  .replace(
    'https://script.google.com/macros/s/AKfycbw6pJRxEQOXgLGLL3f0ih6HL05aSkwiKLipp0sB2o7Ec906WPxxVQ4ZmKlX742Aedix/exec',
    `${MOCK_BASE}/mock/mutate`
  );

// ── MIME types ────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.mjs':  'application/javascript',
  '.json': 'application/json',
  '.csv':  'text/csv',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.woff2':'font/woff2',
};

// ── Static file helper ────────────────────────────────────────────

function serveStatic(filePath, res) {
  const ext  = extname(filePath).toLowerCase();
  const mime = MIME[ext] ?? 'application/octet-stream';
  let   body;

  try {
    body = readFileSync(filePath);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  if (ext === '.html') {
    // No injection needed — config.js is patched at the JS level
    res.writeHead(200, { 'Content-Type': mime });
    res.end(body);
  } else {
    res.writeHead(200, { 'Content-Type': mime });
    res.end(body);
  }
}

// ── INSPIRE URL patching in inspire.js ───────────────────────────
//
// inspire.js hardcodes 'https://inspirehep.net/api/literature'.
// When serving inspire.js we rewrite that URL to our mock endpoint
// so no changes to production code are needed.

function serveInspireJs(res) {
  let src;
  try {
    src = readFileSync(join(SITE_DIR, 'assets', 'js', 'inspire.js'), 'utf8');
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('inspire.js not found');
    return;
  }
  // Patch the INSPIRE base URL (the string in inspire.js includes the trailing ?)
  const patched = src.replace(
    "'https://inspirehep.net/api/literature?'",
    `'${MOCK_BASE}/mock/inspire?'`
  );
  res.writeHead(200, { 'Content-Type': 'application/javascript' });
  res.end(patched);
}

// ── Request router ────────────────────────────────────────────────

const server = createServer((req, res) => {
  // Strip query string for routing
  const path = new URL(req.url, `http://localhost:${PORT}`).pathname;

  // ── Mock endpoints ──────────────────────────────────────────

  if (path === '/mock/sheet.csv') {
    res.writeHead(200, { 'Content-Type': 'text/csv', 'Access-Control-Allow-Origin': '*' });
    res.end(SUBMISSIONS_CSV);
    return;
  }

  if (path === '/mock/trending.csv') {
    res.writeHead(200, { 'Content-Type': 'text/csv', 'Access-Control-Allow-Origin': '*' });
    res.end(TRENDING_CSV);
    return;
  }

  if (path === '/mock/inspire') {
    handleInspireMock(req, res);
    return;
  }

  if (path === '/mock/mutate') {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }
    handleMutateMock(req, res);
    return;
  }

  // ── Special case: patch config.js and inspire.js before serving ──

  if (path === '/assets/js/config.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(PATCHED_CONFIG_JS);
    return;
  }

  if (path === '/assets/js/inspire.js') {
    serveInspireJs(res);
    return;
  }

  // ── Status endpoint (useful for quick health check) ─────────

  if (path === '/mock/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      submissions: SUBMISSIONS_CSV.split('\n').length - 2, // minus header + trailing newline
      inspireHits: INSPIRE_DATA.hits.total,
      trending:    TRENDING_CSV ? TRENDING_CSV.split('\n').length - 2 : 0,
      mutations:   mutationStore.size,
    }));
    return;
  }

  // ── Static file serving ─────────────────────────────────────

  // Map / and /index.html to site/index.html
  let fsPath;
  if (path === '/' || path === '/index.html') {
    fsPath = join(SITE_DIR, 'index.html');
  } else if (path.endsWith('/')) {
    fsPath = join(SITE_DIR, path, 'index.html');
  } else {
    fsPath = join(SITE_DIR, path);
  }

  serveStatic(fsPath, res);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log(`│  jc-ppi local dev server                            │`);
  console.log(`│  ${url.padEnd(51)}│`);
  console.log('│                                                     │');
  console.log('│  Mock endpoints:                                    │');
  console.log(`│    GET  /mock/sheet.csv     submissions fixture     │`);
  console.log(`│    GET  /mock/trending.csv  trending fixture        │`);
  console.log(`│    GET  /mock/inspire       INSPIRE API mock        │`);
  console.log(`│    POST /mock/mutate        vote/edit/remove/discuss│`);
  console.log(`│    GET  /mock/status        health check            │`);
  console.log('│                                                     │');
  console.log('│  Press Ctrl+C to stop.                              │');
  console.log('└─────────────────────────────────────────────────────┘');
  console.log('');
});
