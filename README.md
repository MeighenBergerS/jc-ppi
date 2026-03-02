# jc-ppi — Iowa Particles & Plots Journal Club

> _From arXiv to argument — every week._

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Site](https://img.shields.io/badge/site-live-brightgreen)](https://meighenbergers.github.io/jc-ppi/)
[![Deploy](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/deploy-pages.yml)
[![Lint](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/lint.yml/badge.svg)](https://github.com/MeighenBergerS/jc-ppi/actions/workflows/lint.yml)

Live site: **https://meighenbergers.github.io/jc-ppi/**

A minimal static website for the journal club. Members submit paper suggestions via a Google Form; submissions appear on the site automatically, bucketed by week. No manual curation required.

---

## Table of contents

- [How it works](#how-it-works)
- [Weekly workflow](#weekly-workflow)
- [Local preview](#local-preview)
- [File structure](#file-structure)
- [Guide to arXiv](#guide-to-arxiv)
  - [Finding a paper](#finding-a-paper)
  - [The arXiv ID](#the-arxiv-id)
  - [Reading the abstract page](#reading-the-abstract-page)
- [Guide to iNSPIRE-HEP](#guide-to-inspire-hep)
  - [What the site shows from INSPIRE](#what-the-site-shows-from-inspire)
  - [The INSPIRE record page](#the-inspire-record-page)
  - [Citation counts as a rough guide](#citation-counts-as-a-rough-guide)
  - [Paper not showing on INSPIRE?](#paper-not-showing-on-inspire)
- [Contributing](docs/CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Deploying your own instance](#deploying-your-own-instance)

---

## How it works

```
Member fills out Google Form
        ↓
Response auto-appends to Google Sheet (with timestamp)
        ↓
Sheet is published as a public CSV URL
        ↓
Site fetches CSV on page load → renders "This Week" or archive
```

Papers submitted during the current Monday–Sunday window appear on the **This Week** page. After Sunday they roll automatically into the **Archive**.

---

## Weekly workflow

**Nothing.** Members submit papers via the form link on the site. Papers appear automatically under "This Week" and roll to the Archive after Sunday midnight (based on the visitor's local time).

The only optional manual action is deleting spam rows directly in the Google Sheet — changes are reflected on the site within about a minute.

---

## Local preview

Any static file server works:

```bash
python -m http.server 8000 --directory site
# open http://localhost:8000
```

> Note: fetching the Google Sheets CSV may be blocked by CORS in some browsers during local development. Push to GitHub Pages to test the live data flow.

---

## File structure

```
site/                  ← everything GitHub Pages serves
  index.html           ← This Week page
  archive.html         ← Past submissions grouped by week
  resources.html       ← arXiv & INSPIRE-HEP guide for members
  assets/
    css/style.css      ← All styling
    js/
      config.js        ← ✏️  Your Google URLs live here (only file to edit)
      utils.js         ← Week math, CSV parser, arXiv ID helpers
      inspire.js       ← INSPIRE-HEP API fetcher
      table.js         ← DOM table builder
      app.js           ← Page renderers and entry point
docs/
  CONTRIBUTING.md      ← How to suggest a paper / contribute to the site
  SETUP.md             ← Full setup guide for deploying your own instance
.github/workflows/
  deploy-pages.yml     ← Deploys to GitHub Pages (only on site-file changes)
  check-links.yml      ← Monthly check that URLs are still reachable
README.md
```

---

## Guide to arXiv

[arXiv](https://arxiv.org) is a free, open-access repository where physicists
post papers _before_ (and sometimes instead of) formal journal publication.
These are called **preprints**. Almost all HEP papers appear on arXiv first,
often months before the journal version.

### Finding a paper

- **Search** at [arxiv.org](https://arxiv.org) by title, author, or keyword.
- The most relevant categories for this JC are:
  - `hep-ph` — High Energy Physics – Phenomenology
  - `hep-ex` — High Energy Physics – Experiment
  - `hep-th` — High Energy Physics – Theory
  - `nucl-th`, `nucl-ex` — Nuclear Theory / Experiment
  - `astro-ph.HE` — High Energy Astrophysical Phenomena

### The arXiv ID

Every paper has a unique ID like `2301.12345`. It encodes the submission date:
`2301` = January 2023. A URL like `https://arxiv.org/abs/2301.12345` takes you
directly to the abstract page.

When submitting a paper to this journal club, you can paste either:

- The bare ID: `2301.12345`
- The full URL: `https://arxiv.org/abs/2301.12345`

The site will normalise both formats automatically.

### Reading the abstract page

| Field           | What it means                                         |
| --------------- | ----------------------------------------------------- |
| **Submitted**   | Date the authors posted it                            |
| **Authors**     | Click a name to see all their arXiv papers            |
| **Subjects**    | Primary and cross-listed categories                   |
| **Abstract**    | Short summary written by the authors                  |
| **[pdf]**       | Direct link to the paper PDF                          |
| **[v2], [v3]…** | Revised versions; the site always links to the latest |

---

## Guide to iNSPIRE-HEP

[INSPIRE-HEP](https://inspirehep.net) is the community database for high energy
physics literature. Unlike arXiv (which just hosts preprints), INSPIRE links
papers to their citations, experiments, authors, and institutions, and indexes
both preprints and published journal articles.

### What the site shows from INSPIRE

| Field                  | Where it comes from                      |
| ---------------------- | ---------------------------------------- |
| **Title**              | INSPIRE record (same as arXiv)           |
| **Authors**            | INSPIRE — often more complete than arXiv |
| **Abstract**           | INSPIRE record                           |
| **Citation count**     | How many other papers cite this one      |
| **iNSPIRE-HEP button** | Direct link to the full INSPIRE record   |

### The INSPIRE record page

The INSPIRE record for a paper contains much more than the site shows:

- Full author list with affiliations and ORCID links
- **BibTeX / LaTeX citation key** — useful for citing in your own work
- List of papers this paper cites, and papers that cite it
- Links to the DOI (journal version) and arXiv page
- Experiment and collaboration tags

To get a BibTeX entry for any paper: open its INSPIRE record → click
**Cite** → copy the BibTeX.

### Citation counts as a rough guide

For a new paper (< 1 year old), citation counts are low by default — this
does _not_ mean the paper is unimportant. For older papers, a rough HEP scale:

| Citations | Rough impression          |
| --------- | ------------------------- |
| < 10      | Recent or niche           |
| 10 – 100  | Solid, community-relevant |
| 100 – 500 | Influential               |
| 500+      | Landmark paper            |

### Paper not showing on INSPIRE?

INSPIRE typically indexes new arXiv papers within **1–3 days** of posting.
If the site shows the warning _"Not yet indexed on iNSPIRE-HEP"_, the paper
was submitted very recently — the arXiv link still works and you can read it
immediately. The INSPIRE record will appear within a few days.

---

## Deploying your own instance

Want to run this site for your own journal club? See **[docs/SETUP.md](docs/SETUP.md)**
for the step-by-step guide covering Google Forms, Google Sheets, and GitHub Pages configuration.
