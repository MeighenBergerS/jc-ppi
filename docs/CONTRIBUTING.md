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

No build step is required. Any static file server works for local development:

```bash
python -m http.server 8000 --directory site
# open http://localhost:8000
```

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

| File                        | What it does                                                       |
| --------------------------- | ------------------------------------------------------------------ |
| `site/assets/js/config.js`  | Google Sheet / Form URLs and column map — **start here for setup** |
| `site/assets/js/utils.js`   | Week math, CSV parser, arXiv ID helpers, `isValidArxivId`          |
| `site/assets/js/inspire.js` | INSPIRE-HEP API client, arXiv validation, ID auto-correction       |
| `site/assets/js/sheet.js`   | Apps Script mutation wrapper (vote / edit / remove)                |
| `site/assets/js/table.js`   | DOM table builder                                                  |
| `site/assets/js/app.js`     | Page renderers and entry point                                     |
| `site/assets/css/style.css` | All styling                                                        |
| `site/index.html`           | This Week page                                                     |
| `site/archive.html`         | Archive page (with subfield filter)                                |
| `site/stats.html`           | Submission statistics by year                                      |
| `site/resources.html`       | arXiv & INSPIRE-HEP guide                                          |

### Making changes

1. Fork the repository and create a branch.
2. Make your changes locally and test with `python -m http.server 8000`.
3. Run `npm test` to make sure all tests pass.
4. Open a pull request against `main`.

The site redeploys automatically whenever site files change (HTML, CSS, JS assets).

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
