# Contributing to Iowa Particles & Plots Journal Club

Welcome! This document explains how to suggest a paper for the journal club,
and how to contribute to the website itself.

---

## Suggesting a paper for discussion

The easiest way to contribute is to suggest a paper for an upcoming meeting.

1. **Find a paper** you'd like the group to discuss. Papers are usually found
   on [arXiv](https://arxiv.org) — see the [arXiv guide in the README](../README.md#guide-to-arxiv)
   if you're new to it.

2. **Submit it** using the link on the [journal club website](https://meighenbergers.github.io/jc-ppi/).
   You'll be asked for:

   | Field                            | What to enter                                                              |
   | -------------------------------- | -------------------------------------------------------------------------- |
   | **Your name**                    | Your first name, or however you'd like to be listed                        |
   | **arXiv ID or URL**              | e.g. `2301.12345` or `https://arxiv.org/abs/2301.12345`                    |
   | **Why are you suggesting this?** | A sentence or two is great. "General interest" is a perfectly fine answer. |

3. Your submission will appear automatically on the website under **This Week**.
   After Sunday it moves to the **Archive** — no action needed from you.

### Tips for a good submission

- Any HEP-adjacent topic is fair game: theory, experiment, phenomenology,
  instrumentation, or even a review/methods paper you found useful.
- Recent papers (posted this week or last) tend to generate the best discussion,
  but older papers are welcome too.
- If the paper is very long, mentioning which sections are most relevant in the
  "why" field helps people prepare.

---

## Contributing to the website

The site is a static GitHub Pages site. All source files are in this repository.

### Setup

No build step is required. Node ≥ 18 is the only requirement (needed for the
test suite and the local dev server).

To enable automatic code formatting before each commit, run this once after
cloning:

```bash
git config core.hooksPath .githooks
npm install --global prettier   # if not already installed
```

The pre-commit hook will then auto-format any staged `.html`, `.css`, `.js`,
or `.md` files with Prettier before the commit is recorded, so the CI lint
check always passes.

### File map

| File                                   | What it does                                                       |
| -------------------------------------- | ------------------------------------------------------------------ |
| `site/assets/js/config.js`             | Google Sheet / Form URLs and column map — **start here for setup** |
| `site/assets/js/utils.js`              | Week math, CSV parser, arXiv ID helpers, `isValidArxivId`          |
| `site/assets/js/inspire.js`            | INSPIRE-HEP API client, arXiv validation, ID auto-correction       |
| `site/assets/js/sheet.js`              | Apps Script mutation wrapper (vote / edit / remove)                |
| `site/assets/js/table.js`              | DOM table builder                                                  |
| `site/assets/js/app.js`                | Page renderers and entry point                                     |
| `site/assets/js/trending.js`           | Trending papers section renderer (display-only)                    |
| `site/assets/css/style.css`            | All styling                                                        |
| `site/index.html`                      | This Week page                                                     |
| `site/archive.html`                    | Archive page (with subfield filter)                                |
| `site/stats.html`                      | Submission statistics by year                                      |
| `site/resources.html`                  | arXiv & INSPIRE-HEP guide                                          |
| `tests/server/index.mjs`               | Local dev server (mock endpoints, config URL injection)            |
| `tests/server/generate-fixtures.mjs`   | Fetches real papers from INSPIRE and writes fresh fixture files    |
| `tests/server/scenario.json`           | User/round config for fixture generation — edit freely             |
| `tests/fixtures/submissions.csv`       | Committed fixture: baseline submission data                        |
| `tests/fixtures/inspire-response.json` | Committed fixture: baseline INSPIRE API response                   |

### Making changes

1. Fork the repository and create a branch.
2. Make your changes locally and test with `npm run dev` (see below).
3. Run `npm test` to make sure all tests pass.
4. Open a pull request against `main`.

The site redeploys automatically whenever site files change (HTML, CSS, JS assets).

---

### Local dev server

The dev server lets you run the full site locally against realistic fake data,
with no access to Google Sheets or the live INSPIRE API required.

```
npm run dev      # start the server with committed fixture data
npm run refresh  # fetch fresh papers from INSPIRE, then start the server
```

Then open **http://localhost:3000** in your browser.

#### How it works

The server (`tests/server/index.mjs`) intercepts the three external URLs the
site normally talks to and routes them to local mock endpoints:

| External URL                    | Mock endpoint            | Source                                         |
| ------------------------------- | ------------------------ | ---------------------------------------------- |
| Google Sheets CSV (submissions) | `GET /mock/sheet.csv`    | `tests/fixtures/submissions[.fresh].csv`       |
| Google Sheets CSV (trending)    | `GET /mock/trending.csv` | `tests/fixtures/trending[.fresh].csv`          |
| `inspirehep.net/api/literature` | `GET /mock/inspire`      | `tests/fixtures/inspire-response[.fresh].json` |
| Apps Script mutate URL          | `POST /mock/mutate`      | In-memory store (votes, edits, removals)       |

URL substitution happens by serving a patched version of `config.js` and
`inspire.js` at request time — the source files on disk are never modified.

#### Fixture files

Two sets of fixtures can exist side by side:

- **Committed** (`submissions.csv`, `inspire-response.json`) — checked into
  the repo, always present, used by default. Safe to edit by hand for
  targeted test scenarios.
- **Fresh** (`*.fresh.*`) — generated by `npm run refresh`, gitignored.
  The server automatically prefers these over the committed files when present.

#### Regenerating fixtures (`--refresh`)

`npm run refresh` runs `tests/server/generate-fixtures.mjs`, which:

1. Fetches ~500 hep-ph papers from the live INSPIRE-HEP API.
2. Synthesises a submission CSV using the users and week schedule defined in
   `tests/server/scenario.json` — 10 users each submitting papers across
   four time windows (current week, last week, 2 weeks ago, ~1 year ago).
3. Writes `tests/fixtures/submissions.fresh.csv`,
   `inspire-response.fresh.json`, and `trending.fresh.csv`.

To change the simulated users, round structure, or paper counts, edit
`tests/server/scenario.json`. No code changes are needed.

#### Health check

`GET /mock/status` returns a JSON summary of what the server loaded:

```json
{ "ok": true, "submissions": 40, "inspireHits": 40, "trending": 12, "mutations": 0 }
```

---

### Tests

The core JavaScript logic is covered by a built-in test suite using Node's
`node:test` module — no external packages required.

```bash
npm install   # first time only; also wires up the pre-commit hook
npm test
```

Test files live in `tests/`:

| File              | Covers                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `utils.test.js`   | `weekStart`, `fmtWeekRange`, `parseCsv`, `normalizeArxivId`, `stripVersion`, `isValidArxivId` |
| `data.test.js`    | `deduplicatePapers`, `computeSubmissionStats`                                                 |
| `inspire.test.js` | `parseHit`                                                                                    |
| `runner.html`     | Browser-side DOM tests for `buildTable`                                                       |

The **pre-commit hook** (installed by `npm install` via the `prepare` script)
runs `npm test` automatically before every commit, so the suite must be green
before any code reaches the repository.

When adding new utility functions or changing existing ones, add or update the
corresponding test in `tests/utils.test.js`. For INSPIRE metadata parsing
changes, update `tests/inspire.test.js` and, if needed, the JSON fixture in
`tests/fixtures/inspire-response.json`.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](../CODE_OF_CONDUCT.md).
By participating, you are expected to uphold it.
