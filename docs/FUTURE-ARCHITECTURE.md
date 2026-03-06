# Future Architecture — Migration Plan

This document describes a planned migration path to make the project easier to
maintain and hand over to future leads. **The current codebase is not changed
yet.** This plan should be revisited when the next handover approaches.

---

## Why change anything?

The current architecture works, but it has one structural problem: **Google
Apps Script is the single largest barrier to handover.** It currently handles
five distinct jobs, all of which require the maintainer to have Editor access to
the spreadsheet and to understand how to manage App Script deployments. In
practice this means only one person can maintain the full system at any time.

---

## Current architecture (as of early 2026)

```
Google Form → Google Sheet (private tab, includes email)
  │
  ├── onFormSubmit (Apps Script trigger)
  │     └── Auto-approves members from the Members tab
  │
  ├── doPost (Apps Script web app)
  │     └── Handles vote / edit / remove / discuss mutations
  │
  ├── weeklySlackReminder (time-driven trigger)
  │     └── Posts a Slack message before the Friday meeting
  │
  ├── refreshTrendingPapers (Mon/Wed trigger)
  │     └── Queries INSPIRE-HEP, writes to the Trending tab
  │
  └── Public tab CSV (published, no auth required)
        └── Fetched live by every visitor's browser
              └── Each browser independently queries INSPIRE-HEP
                    (title, authors, abstract, citations, BibTeX)
```

**Consequence:** Every single feature depends on one person having a Google
account with Editor access to the spreadsheet and knowing how to manage App
Script re-deployments.

---

## Proposed architecture

The core question for each feature is: _does this absolutely need to write to a
Google Sheet?_

| Feature                            | Needs Google write access?                           | Conclusion                   |
| ---------------------------------- | ---------------------------------------------------- | ---------------------------- |
| Auto-approve form submissions      | Yes — must run as a Google Form trigger              | **Keep in Apps Script**      |
| Vote / edit / remove / discuss     | Yes — writes vote counts and flags back to the sheet | **Keep in Apps Script**      |
| Query INSPIRE-HEP                  | No                                                   | **Move to Python**           |
| Trending paper discovery           | No                                                   | **Move to Python**           |
| Slack notifications for new papers | No                                                   | **Move to Python**           |
| Deployment to GitHub Pages         | No                                                   | **GitHub Actions (already)** |

Reduced to its core, Apps Script only needs to do **two things**: approve
members on form submit, and handle mutation requests from the website. That is
roughly 80 lines of the current `appscript.gs`. Everything else moves to a
Python build script that runs in GitHub Actions.

### New data flow

```
Google Form → Google Sheet
  │
  ├── onFormSubmit (Apps Script) ──── auto-approves known members
  │
  └── Public tab CSV (published, no auth)
        │
        └── GitHub Actions (runs hourly)
              ├── build_site.py reads CSV
              ├── Queries INSPIRE-HEP → site/data/papers.json
              ├── Queries INSPIRE-HEP for trending → site/data/trending.json
              ├── Sends Slack for new submissions
              │     (tracks state on a separate `state` branch — no PAT needed)
              └── Deploys site/ to GitHub Pages
                    │
                    └── Browser loads papers.json / trending.json directly
                          └── Mutations still POST to Apps Script doPost
```

---

## Benefits

**For the handover:**
The next maintainer needs Google Editor access only to handle the form and
the mutation web app — two things that require a brief one-time deploy. The
complex logic (INSPIRE queries, Slack, data shaping) is in a Python file they
can read and edit without a Google account.

**For visitors:**
INSPIRE-HEP data is pre-fetched once per hour instead of by every browser
separately. Page loads become instant; there is no risk of hitting INSPIRE rate
limits from distributed requests; the localStorage cache management in the
frontend can be removed entirely.

**For the codebase:**
`app.js` shrinks significantly — it no longer needs to parse CSV, call INSPIRE,
or manage cache TTLs. It just fetches a pre-built JSON file.

---

## Implementation order

When the time comes, the recommended implementation order is:

1. **Write `build_site.py`** — reads the published CSV, queries INSPIRE-HEP,
   generates `site/data/papers.json` and `site/data/trending.json`, sends Slack
   notifications for rows not yet seen (state tracked on the `state` branch).

2. **Update `.github/workflows/deploy-pages.yml`** — add a scheduled trigger
   (e.g. `cron: '0 * * * *'`), a Python setup step, and run `build_site.py`
   before the existing Pages upload step.

3. **Simplify `app.js`** — replace `fetchPapers()` + INSPIRE calls with a
   single `fetch('data/papers.json')`. The CSV parser, INSPIRE module, and
   localStorage cache become unused and can be removed.

4. **Strip `appscript.gs`** — delete `refreshTrendingPapers()` and
   `weeklySlackReminder()`. Keep only `onFormSubmit()`, `doPost()`, and their
   helpers.

5. **Update `config.js`** — remove `sheetCsvUrl` and `trendingCsvUrl`; replace
   with `papersJsonUrl` and `trendingJsonUrl` pointing to the pre-built files.

Steps 1–2 can be done and tested independently before any frontend changes are
made. During the transition period, both paths (direct CSV fetch and JSON fetch)
can coexist.

---

## Notes on Slack notification state

The proposed plan avoids a Personal Access Token (PAT) for updating a
repository variable. Instead, the Python script reads and writes a small
`state/notified.json` file on a dedicated `state` branch. The Actions workflow
already has `contents: write` permission by default and can push this branch
cleanly without any additional secrets. This means:

- No annual token rotation when the PAT expires.
- The `main` branch commit history stays clean.
- State survives across runs reliably.
- The `state` branch is a low-stakes throwaway — it can be reset or deleted
  without affecting the site.

---

## What does not change

- The Google Form and Sheet structure — no changes needed there.
- The `doPost` mutation endpoint in Apps Script — votes and discussion stars
  still write directly to the sheet.
- The published CSV URL — it is still the data source, just read by the build
  script rather than by each browser.
- The overall site look and feel — this is a backend change only.
