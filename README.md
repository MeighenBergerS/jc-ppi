# jc-ppi — Iowa Particles & Plots Journal Club

> _From arXiv to argument — every week._

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Site](https://img.shields.io/badge/site-live-brightgreen)](https://meighenbergers.github.io/jc-ppi/)
[![Deploy](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/deploy-pages.yml)
[![Tests](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/test.yml/badge.svg)](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/test.yml)
[![Lint](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/lint.yml/badge.svg)](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/lint.yml)

Live site: **https://meighenbergers.github.io/jc-ppi/**

A minimal website for a high-energy physics journal club. Members suggest papers as GitHub issues;
a bot fills in each paper's details from INSPIRE-HEP, and the site shows them bucketed by week.
Everything runs in this repository on GitHub Actions, with nothing to host.

**To suggest a paper:** [open a "Suggest a paper" issue](https://github.com/MeighenBergerS/jc-ppi/issues/new?template=1-paper.yml).
**To vote:** add a 👍 to the paper's issue.

---

## Table of contents

- [How it works](#how-it-works)
- [Features](#features)
- [Local preview](#local-preview)
- [Running tests](#running-tests)
- [File structure](#file-structure)
- [Documentation](#documentation)

---

## How it works

```
Member opens a "Suggest a paper" issue
        ↓
Paper bot: approves members, looks the paper up on INSPIRE-HEP (or arXiv),
           comments with title, authors, abstract and BibTeX
        ↓
Deploy workflow: turns the paper issues into data/papers.csv, deploys the site
        ↓
Site shows this week's papers, the archive and stats; votes are 👍 reactions
```

Papers submitted during the current Monday–Sunday week (Central Time) appear on the **This Week**
page. After Sunday they move to the **Archive**, and the bot closes their issues.

Every Monday and Wednesday morning a workflow opens a **Trending** issue with the most-cited
recent hep-ph papers per category, which the home page shows. Every Thursday afternoon a workflow
posts a reminder to the group's Slack channel. [docs/MAINTAINING.md](docs/MAINTAINING.md) covers
each piece.

---

## Features

| Feature               | Details                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| **Issue submissions** | A GitHub issue form; members are approved automatically, others wait for a maintainer        |
| **Paper bot**         | Adds title, authors, abstract, links and BibTeX to each issue; flags papers suggested before |
| **Voting**            | 👍 reactions on the paper's issue, one per person; the site shows the counts                 |
| **Discussed star**    | The `discussed` label marks papers discussed at a meeting                                    |
| **Auto metadata**     | Title, authors, abstract, citation count fetched from INSPIRE-HEP on the site                |
| **BibTeX copy**       | One-click copy of the INSPIRE BibTeX entry                                                   |
| **arXiv validation**  | Invalid IDs shown in red; IDs not yet on INSPIRE shown in amber                              |
| **Subfield filter**   | Archive can be filtered by broad HEP category (Pheno, Theory, Experiment, …)                 |
| **Year selector**     | Stats page can be scoped to a specific year                                                  |
| **Trending papers**   | Top-cited recent hep-ph papers per category, refreshed Monday and Wednesday                  |
| **Slack reminder**    | Thursday reminder with this week's submitters, the top-voted paper and trending papers       |
| **Monthly roundup**   | A private email to each member about their month: papers, streak, milestones                 |
| **Calendar export**   | One-click `.ics` download for the weekly meeting                                             |

---

## Local preview

```bash
npm run dev      # the site with committed test data, on http://localhost:3000
npm run refresh  # the same, with fresh papers from INSPIRE-HEP
```

The dev server serves the test fixtures where the site expects its data and stands in for
INSPIRE-HEP. See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#local-dev-server).

---

## Running tests

The JavaScript logic (week math, CSV parser, arXiv ID helpers, INSPIRE parsing, the paper bot,
trending papers and the Slack reminder) has a test suite using Node's built-in `node:test`, with
no external dependencies.

```bash
npm install   # first time only (sets up the pre-commit hook)
npm test
```

The pre-commit hook formats staged files with Prettier and runs the tests before every commit.
See [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#tests) for details.

---

## File structure

```
site/                          ← everything GitHub Pages serves
  index.html                   ← This Week page
  archive.html                 ← Past submissions grouped by week
  stats.html                   ← What the club has been curious about, by year
  iowa.html                    ← Recent papers with University of Iowa authors
  about.html                   ← About the club; links to the guide and the docs
  resources.html               ← arXiv & INSPIRE-HEP guide for members
  data/                        ← papers.csv and trending.csv, built at deploy (not committed)
  docs/                        ← The documentation site, built from docs/ at deploy (not committed)
  assets/
    css/style.css              ← All styling
    js/
      config.js                ← ✏️  All settings: repository, meeting, reminder, trending
      utils.js                 ← Week math, CSV parser, arXiv ID helpers
      inspire.js               ← INSPIRE-HEP API client + arXiv validation
      table.js                 ← Archive table builder
      cards.js                 ← This Week paper cards
      mathtext.js              ← MathML and LaTeX in titles and abstracts
      topics.js                ← Which club topics (CONFIG.topics) a paper is about
      app.js                   ← This Week / Archive renderers and entry point
      stats.js                 ← Stats page
      iowa.js                  ← Iowa Research page
      trending.js              ← Trending papers section renderer
scripts/papers/
  enrich.js                    ← The paper bot
  build-csv.js                 ← Builds site/data/ from the issues
  trending-issue.js            ← Opens the Trending issue
  slack-reminder.js            ← Posts the weekly Slack reminder
  roundup-email.js             ← Emails the monthly roundups
  roundup-preview.js           ← Prints a member's monthly roundup
  lib.js, trending.js, slack.js,
  roundup.js, roundup-html.js,
  smtp.js                      ← Shared helpers
.github/
  ISSUE_TEMPLATE/              ← Suggest a paper, bug report, feature request, documentation
  workflows/                   ← papers, deploy, trending, Slack reminder, keep-alive, labels, checks
  labels.yml                   ← The repository's labels
  paper-members.txt            ← Members whose papers are approved automatically
  paper-maintainers.txt        ← Maintainers, told about papers waiting for approval
docs/                          ← The documentation site's pages (MkDocs, see mkdocs.yml)
  index.md                     ← Documentation home
  members.md                   ← Suggesting and voting
  ARXIV-GUIDE.md               ← Guide to arXiv and INSPIRE-HEP for members
  MAINTAINING.md               ← Running the journal club, and how each piece works
  SETUP.md                     ← Deploying your own instance
  CONTRIBUTING.md              ← Contributing code; docs site; test guide
docs_theme/                    ← MkDocs theme override (logo and site name)
mkdocs.yml                     ← Documentation site configuration
tests/                         ← node:test suites, fixtures and the local dev server
```

---

## Development with AI assistance

This site was developed with the help of Claude, Anthropic's AI assistant, used through Claude Code for code, tests and documentation. The maintainer directed the work and is responsible for its content.

---

## Documentation

The documentation site is at <https://meighenbergers.github.io/jc-ppi/docs/> (linked
from the site's About page and footer), built from these files:

| Document                                     | Contents                                            |
| -------------------------------------------- | --------------------------------------------------- |
| [docs/members.md](docs/members.md)           | Suggesting a paper, voting, editing and withdrawing |
| [docs/ARXIV-GUIDE.md](docs/ARXIV-GUIDE.md)   | Member guide to arXiv IDs and INSPIRE-HEP           |
| [docs/MAINTAINING.md](docs/MAINTAINING.md)   | Approving, settings; how the bot and workflows run  |
| [docs/SETUP.md](docs/SETUP.md)               | Deploying your own instance                         |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Contributing code; the docs site; test guide        |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)     | Contributor Covenant                                |
