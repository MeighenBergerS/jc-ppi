# GitHub Copilot Instructions — jc-ppi

## Project overview

Static website for the Iowa Particles & Plots HEP journal club.
Members suggest papers as GitHub issues (label `paper`); a bot fills in each paper's details; the
deploy workflow turns the issues into CSV files that the site renders.
No framework, no build step for the site, no npm dependencies (test runner is `node:test`, built
into Node ≥ 18). The documentation site (Documentation tab, `/docs/`) is built from `docs/` with
MkDocs (`mkdocs.yml`, readthedocs theme) at deploy time.

---

## Tech stack

- **Vanilla ES modules** — all JS uses `import`/`export`; loaded via `<script type="module">` in HTML.
- **No framework** — no React, Vue, TypeScript, Webpack, Vite, or any third-party library.
- **Node ≥ 18** — for the test suite (`node --test`) and the scripts in `scripts/papers/`, which run
  in GitHub Actions with Node 20. The scripts import the site's modules (`utils.js`, `inspire.js`,
  `config.js`), so those must keep working in Node (no DOM access at module top level).

---

## Key source files

| File                                | Purpose                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `site/assets/js/config.js`          | **All club settings** (repo, time zone, meeting, reminder, trending), columns  |
| `site/assets/js/app.js`             | Entry point; fetches `data/papers.csv`, renders This Week / Archive / Trending |
| `site/assets/js/inspire.js`         | INSPIRE-HEP API client with localStorage cache                                 |
| `site/assets/js/table.js`           | DOM builder; turns CSV rows + metadata into `<table>`                          |
| `site/assets/js/utils.js`           | Pure helpers: week math, CSV parser, arXiv IDs, meeting text and `.ics`        |
| `site/assets/js/trending.js`        | Trending section renderer                                                      |
| `site/assets/js/stats.js`           | Stats page charts                                                              |
| `scripts/papers/lib.js`             | Issue-form parsing, labels, weeks, names, site data rows, GitHub REST client   |
| `scripts/papers/enrich.js`          | The paper bot (`.github/workflows/papers.yml`)                                 |
| `scripts/papers/build-csv.js`       | Writes `site/data/papers.csv` and `trending.csv` (`deploy-pages.yml`)          |
| `scripts/papers/trending.js`        | Trending papers from INSPIRE; the Trending issue body                          |
| `scripts/papers/trending-issue.js`  | Opens the twice-weekly Trending issue (`trending.yml`)                         |
| `scripts/papers/slack.js`           | The weekly Slack reminder message                                              |
| `scripts/papers/slack-reminder.js`  | Posts it (`slack-reminder.yml`)                                                |
| `scripts/papers/roundup.js`         | A member's private monthly roundup: papers, streak, milestones, email text     |
| `scripts/papers/roundup-preview.js` | Prints one member's roundup (`npm run roundup`)                                |

---

## Data pipeline

```
"Suggest a paper" issue form (.github/ISSUE_TEMPLATE/1-paper.yml)
  → paper bot: approval (paper-members.txt, paper-maintainers.txt, collaborators),
    INSPIRE/arXiv metadata comment, "Updated By Bot", "Submitted Before"
  → deploy workflow: build-csv.js writes site/data/papers.csv
    (approved, not closed as "not planned"; votes = 👍 reactions)
  → site fetches data/papers.csv
  → INSPIRE-HEP API fills title / authors / abstract / citations in the browser
```

Trending pipeline:

```
trending.yml (Monday & Wednesday) → Trending issue (labels Trending, paper, Updated By Bot)
  → build-csv.js writes site/data/trending.csv from the newest Trending issue
  → site renders the Trending section
```

Issues labelled `Trending` also carry `paper` but are never submissions: use `isSubmission()` /
`isVisiblePaper()` in `lib.js`, never the `paper` label alone.

---

## papers.csv column indices (0-based)

The layout matches the retired Google Sheet's Public tab.

```
COL.timestamp     = 0  Submission time (ISO for issues; "M/D/YYYY H:MM:SS" Central for imported)
COL.name          = 1  GitHub profile name, or the Sheet name for imported issues
COL.arxivId       = 2  arXiv ID as submitted (may be URL or bare ID)
COL.comment       = 3  "Why this paper?"
COL.approved      = 4  always "TRUE"
COL.removed       = 5  always empty
COL.editedComment = 6  always empty
COL.votes         = 7  👍 reactions (+ imported votes)
COL.discussed     = 8  "TRUE" when labelled "discussed"
COL.issueUrl      = 9  the paper's issue
```

`COL` (exported from `config.js`) is the single source of truth — never hardcode column indices.

trending.csv (`COL_TREND`, also in `config.js`):

```
COL_TREND.category       = 0
COL_TREND.rank           = 1
COL_TREND.arxivId        = 2
COL_TREND.title          = 3
COL_TREND.abstract       = 4
COL_TREND.authors        = 5
COL_TREND.affiliation    = 6
COL_TREND.citations      = 7
COL_TREND.citationsNoSelf = 8
```

---

## arXiv ID conventions

- **Modern format**: `YYMM.NNNN` or `YYMM.NNNNN` (exactly 4-digit prefix, 4–5 digit suffix).
- **Old format**: `category/YYMMNNN`, e.g. `hep-ph/9901123`.
- Always strip the version suffix before comparisons: `stripVersion()` in `utils.js`.
- Extract a bare ID from URLs or raw input: `normalizeArxivId()` in `utils.js`.
- **3-digit prefix auto-correction**: `708.1137` → `0708.1137` (in `inspire.js` and `cleanArxivId()`).
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

## Week boundary

Weeks run **Monday 00:00:00 → Sunday 23:59:59**: in the visitor's local time on the site
(`weekStart()` in `utils.js`), and in `CONFIG.timezone` in the scripts (`weekStartDay()` in `lib.js`).
"This Week" is the current window; papers roll into the Archive automatically after Sunday.

---

## Testing

```bash
npm test
```

- Uses `node:test` and `node:assert/strict` — no external test framework.
- Test fixtures live in `tests/fixtures/`.
- Run tests after any change to `site/assets/js/` or `scripts/papers/`.

---

## Security

- Issue bodies, names and INSPIRE text are untrusted. On the site, insert them with
  `textContent` or DOM building, never `innerHTML`. In bot comments, pass them through `safeText()`
  (escapes HTML and stops `@` mentions).
- Workflows read issue content from the event payload file, never by interpolating
  `${{ github.event.issue.body }}` into a `run:` script.

---

## Style conventions

- Semicolons are always used.
- Single quotes for strings.
- JSDoc comments on all exported functions.
- Every JS file starts with a file-level block comment header (see existing files for format).
- No TypeScript — keep plain `.js`.
