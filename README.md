# jc-ppi — Iowa Particles & Plots Journal Club

> _From arXiv to argument — every week._

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Site](https://img.shields.io/badge/site-live-brightgreen)](https://meighenbergers.github.io/jc-ppi/)
[![Deploy](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/deploy-pages.yml)
[![Tests](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/test.yml/badge.svg)](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/test.yml)
[![Lint](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/lint.yml/badge.svg)](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/lint.yml)

Live site: **https://meighenbergers.github.io/jc-ppi/**

A minimal static website for a high-energy physics journal club. Members submit paper suggestions via a Google Form; submissions appear on the site automatically, bucketed by week, with full metadata fetched live from INSPIRE-HEP. No manual curation required.

---

## Table of contents

- [How it works](#how-it-works)
- [Features](#features)
- [Weekly workflow](#weekly-workflow)
- [Local preview](#local-preview)
- [Running tests](#running-tests)
- [File structure](#file-structure)
- [Documentation](#documentation)

---

## How it works

```
Member fills out Google Form
        ↓
Response appends to private Google Sheet (includes email)
        ↓
Apps Script checks email → ticks Approved if known member
        ↓
Public sheet tab mirrors all columns except email
        ↓
Site fetches Public tab as CSV → shows only approved, non-removed rows
        ↓
INSPIRE-HEP API fills in title, authors, abstract, citations, BibTeX
```

Papers submitted during the current Monday–Sunday window appear on the **This Week** page.
After Sunday they roll automatically into the **Archive** — no manual action required.

---

## Features

| Feature                | Details                                                                         |
| ---------------------- | ------------------------------------------------------------------------------- |
| **Auto metadata**      | Title, authors, abstract, citation count fetched from INSPIRE-HEP               |
| **BibTeX copy**        | One-click copy of the INSPIRE BibTeX entry                                      |
| **arXiv validation**   | Invalid IDs shown in red; IDs not yet on INSPIRE shown in amber                 |
| **ID auto-correction** | Three-digit-prefix IDs (e.g. `708.1137`) are automatically tried as `0708.1137` |
| **Subfield filter**    | Archive can be filtered by broad HEP category (Pheno, Theory, Experiment, …)    |
| **Year selector**      | Stats page can be scoped to a specific year                                     |
| **This-week voting**   | Visitors can upvote papers on the current week's list                           |
| **Inline editing**     | Submitters (or anyone) can update the suggestion comment for this week's papers |
| **Remove entry**       | Entries can be removed from the live list (this week only, with confirmation)   |
| **Calendar export**    | One-click `.ics` download for the next meeting                                  |
| **Meeting info**       | Slack link, time, student guide, and calendar button on the home page           |

---

## Weekly workflow

**For members in the approved list:** submit a paper via the form — it appears on the site automatically (the Apps Script ticks Approved instantly).

**For anyone not yet in the list:** their submission is held until you open the private Google Sheet and manually tick the **Approved** checkbox in column F for that row. Changes appear on the site within about a minute.

To add a recurring member permanently, add their email address (one per row) to the **Members** tab of your Google Sheet. No code changes are needed.

---

## Local preview

Any static file server works:

```bash
python -m http.server 8000 --directory site
# open http://localhost:8000
```

> **Note:** fetching the Google Sheets CSV is blocked by CORS in some browsers during local development. Push to GitHub Pages to test the live data flow end-to-end.

---

## Running tests

The JavaScript logic (week math, CSV parser, arXiv ID helpers, INSPIRE metadata parsing) has a built-in test suite using Node's `node:test` module — no external dependencies required.

```bash
npm install   # first time only (sets up the pre-commit hook)
npm test
```

The pre-commit hook runs the test suite automatically before every commit, so broken code cannot be merged accidentally. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#tests) for details.

---

## File structure

```
site/                        ← everything GitHub Pages serves
  index.html                 ← This Week page
  archive.html               ← Past submissions grouped by week
  stats.html                 ← Submission statistics by year
  resources.html             ← arXiv & INSPIRE-HEP guide for members
  assets/
    css/style.css            ← All styling
    js/
      config.js              ← ✏️  Your Google URLs live here
      utils.js               ← Week math, CSV parser, arXiv ID helpers
      inspire.js             ← INSPIRE-HEP API client + arXiv validation
      sheet.js               ← Apps Script mutation wrapper (vote/edit/remove)
      table.js               ← DOM table builder
      app.js                 ← Page renderers and entry point
docs/
  SETUP.md                   ← Full deployment guide for your own instance
  CONTRIBUTING.md            ← How to suggest a paper / contribute to the site
  INTERACTIVITY.md           ← Vote / edit / remove feature and Apps Script setup
  ARXIV-GUIDE.md             ← Guide to arXiv and INSPIRE-HEP for members
  appscript.gs               ← Paste into Google Apps Script (both scripts)
.githooks/
  pre-commit                 ← Prettier format + npm test
.github/workflows/
  deploy-pages.yml           ← Deploys to GitHub Pages on site-file changes
  check-links.yml            ← Monthly check that URLs are still reachable
tests/
  utils.test.js              ← Week math, CSV, arXiv ID validator tests
  data.test.js               ← Deduplication and stats tests
  inspire.test.js            ← INSPIRE parseHit tests
  runner.html                ← Browser-side DOM tests for buildTable
  fixtures/                  ← CSV and JSON test fixtures
package.json                 ← Test runner config (node:test, no external deps)
```

---

## Known limitations

| Limitation                       | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sheets CSV propagation delay** | Google's "Publish to web" CSV endpoint is cached on Google's side and can lag **1–5 minutes** behind the actual sheet data. Actions that write to the sheet via the Apps Script (votes, edits, the discussed ★ toggle) take effect in the sheet instantly but may not be reflected in the CSV on the next page load. The site works around this for the ★ flag by storing the user's last-known discussed state in `localStorage` for 10 minutes, so the star badge survives a reload while the CSV catches up. Other mutations (votes, comment edits) are rendered optimistically in the DOM without waiting for the CSV to sync. |

---

## Documentation

| Document                                       | Contents                                                      |
| ---------------------------------------------- | ------------------------------------------------------------- |
| [docs/SETUP.md](docs/SETUP.md)                 | One-time setup: Google Sheet, Form, Apps Script, GitHub Pages |
| [docs/INTERACTIVITY.md](docs/INTERACTIVITY.md) | Vote / edit / remove feature, Apps Script doPost, date guard  |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)   | Suggesting a paper; contributing code; test guide             |
| [docs/ARXIV-GUIDE.md](docs/ARXIV-GUIDE.md)     | Member guide to arXiv IDs and INSPIRE-HEP                     |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)       | Contributor Covenant                                          |
