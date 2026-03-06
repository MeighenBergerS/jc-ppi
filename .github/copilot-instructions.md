# GitHub Copilot Instructions — jc-ppi

## Project overview

Static website for the Iowa Particles & Plots HEP journal club.
Members submit papers via Google Form → Google Sheet → site renders them live.
No framework, no build step, no npm dependencies (test runner is `node:test`, built-in to Node ≥ 18).

---

## Tech stack

- **Vanilla ES modules** — all JS uses `import`/`export`; loaded via `<script type="module">` in HTML.
- **No framework** — no React, Vue, TypeScript, Webpack, Vite, or any third-party library.
- **Node ≥ 18** — only for the test suite (`node --test`).
- **Google Apps Script** (`docs/appscript.gs`) — server-side GAS code; uses `var`, not Node.js.

---

## Key source files

| File                         | Purpose                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `site/assets/js/config.js`   | **Only file to edit for setup.** All URLs, column indices, meeting config |
| `site/assets/js/app.js`      | Entry point; fetches CSV, renders This Week / Archive / Trending          |
| `site/assets/js/inspire.js`  | INSPIRE-HEP API client with localStorage cache                            |
| `site/assets/js/table.js`    | DOM builder; turns CSV rows + metadata into `<table>`                     |
| `site/assets/js/sheet.js`    | Mutation wrapper (vote, edit, remove, discuss → Apps Script)              |
| `site/assets/js/utils.js`    | Pure helpers: week math, CSV parser, arXiv ID utilities                   |
| `site/assets/js/trending.js` | Trending section renderer                                                 |
| `site/assets/js/stats.js`    | Stats page charts                                                         |
| `docs/appscript.gs`          | Google Apps Script: approval, mutations, trending refresh, Slack          |

---

## Data pipeline

```
Google Form → Google Sheet (private tab, includes email)
  → Apps Script auto-approves known members (Members tab)
  → Public tab mirrors all columns except email
  → Site fetches Public tab as CSV
  → filters: Approved = "TRUE", Removed ≠ "TRUE"
  → INSPIRE-HEP API fills title / authors / abstract / citations / BibTeX
```

Trending pipeline:

```
Apps Script triggers Monday & Wednesday
  → refreshTrendingPapers() queries INSPIRE-HEP
  → writes to Trending tab
  → site fetches Trending tab CSV → renders Trending section
```

---

## Google Sheet — Public tab column indices (0-based, from CSV)

```
COL.timestamp     = 0  (A) Submission timestamp
COL.name          = 1  (B) Submitter name
COL.arxivId       = 2  (C) arXiv ID as submitted (may be URL or bare ID)
COL.comment       = 3  (D) Original suggestion comment
COL.approved      = 4  (E) "TRUE" when approved
COL.removed       = 5  (F) "TRUE" when removed by a visitor
COL.editedComment = 6  (G) Edited comment (overrides COL.comment when non-empty)
COL.votes         = 7  (H) Running upvote count
COL.discussed     = 8  (I) "TRUE" when starred as discussed at the meeting
```

`COL` (exported from `config.js`) is the single source of truth — never hardcode column indices.

Trending tab (`COL_TREND`, also in `config.js`):

```
COL_TREND.category       = 0  (A)
COL_TREND.rank           = 1  (B)
COL_TREND.arxivId        = 2  (C)
COL_TREND.title          = 3  (D)
COL_TREND.abstract       = 4  (E)
COL_TREND.authors        = 5  (F)
COL_TREND.affiliation    = 6  (G)
COL_TREND.citations      = 7  (H)
COL_TREND.citationsNoSelf = 8 (I)
```

---

## arXiv ID conventions

- **Modern format**: `YYMM.NNNN` or `YYMM.NNNNN` (exactly 4-digit prefix, 4–5 digit suffix).
- **Old format**: `category/YYMMNNN`, e.g. `hep-ph/9901123`.
- Always strip the version suffix before comparisons: `stripVersion()` in `utils.js`.
- Extract a bare ID from URLs or raw input: `normalizeArxivId()` in `utils.js`.
- **3-digit prefix auto-correction**: `708.1137` → `0708.1137` (handled in `inspire.js`).
- Validity check: `isValidArxivId()` in `utils.js`.

---

## INSPIRE-HEP API

- Base URL: `https://inspirehep.net/api/literature`
- Browser CORS is supported; no authentication required.
- Requests are batched: ≤ 25 IDs per query (`BATCH_SIZE = 25` in `inspire.js`).
- Results are cached in `localStorage` under key `inspire_meta_v5`.
- TTLs: 7 days (resolved record), 15 min (not yet on INSPIRE), 24 h (invalid arXiv ID).
- When bumping the cache key version, add the old key to the cleanup list inside `_loadCache()`.

---

## Mutation endpoint (Apps Script web app)

- URL set at `CONFIG.mutateUrl` in `config.js`; interactive controls are hidden when it is empty.
- All mutations are POSTed from `sheet.js` with `Content-Type: text/plain` and a JSON body.
- Request body shape: `{ action, arxivId, ...extras }`.
- Actions: `vote`, `remove`, `edit` (requires `comment`), `discuss`.
- Response: `{ ok: true, ... }` on success, `{ ok: false, error: '...' }` on handled error.
- Network errors are rethrown; callers are responsible for user-facing error handling.

---

## Week boundary

Weeks run **Monday 00:00:00 local time → Sunday 23:59:59 local time**.
`weekStart(date)` in `utils.js` returns the Monday `Date` for the week containing `date`.
"This Week" is the current window; papers roll into the Archive automatically after Sunday.

---

## Testing

```bash
npm test
# or directly:
node --test tests/utils.test.js tests/data.test.js tests/inspire.test.js tests/config.test.js
```

- Uses `node:test` and `node:assert/strict` — no external test framework.
- Test fixtures live in `tests/fixtures/`.
- Run tests after any change to `utils.js`, `config.js`, or `inspire.js`.

---

## Apps Script (`docs/appscript.gs`)

- Google Apps Script **V8 runtime** — use `var` declarations to match the existing style.
- Not Node.js: do not suggest `import`, `require`, or npm packages.
- Column positions here are **1-indexed** (`COL_TIMESTAMP = 1`, etc.), unlike the JS (0-indexed).
- Deployed as a web app: Execute as owner, accessible by anyone (unauthenticated).
- `doPost(e)` handles all mutation actions forwarded from the site.
- `onFormSubmit(e)` is a form-submit trigger for automatic member approval.
- `weeklySlackReminder()` and `refreshTrendingPapers()` are time-driven triggers.

---

## Style conventions

- Semicolons are always used.
- Single quotes for strings.
- JSDoc comments on all exported functions.
- Every JS file starts with a file-level block comment header (see existing files for format).
- No TypeScript — keep plain `.js`.
