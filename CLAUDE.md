# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

The project overview, data pipeline, column maps, arXiv conventions and code style are shared with
GitHub Copilot and live in one place:

@.github/copilot-instructions.md

This file adds only what the shared file does not cover.

## Commands

```sh
npm install        # first time only; wires up the pre-commit hook
npm test           # node:test suite, no dependencies
npm run dev        # local site on http://localhost:3000 against fixture data
npm run refresh    # fetch fresh INSPIRE papers into *.fresh.* fixtures, then serve
npm run roundup -- <login> [YYYY-MM]   # print a member's monthly roundup; sends nothing
python3 -m venv .venv && .venv/bin/pip install -r docs/requirements.txt   # first time only
.venv/bin/mkdocs serve             # docs site on http://127.0.0.1:8000/jc-ppi/docs/
.venv/bin/mkdocs build --strict    # what CI checks for the docs
prettier --check "site/**/*.{html,css,js}" "scripts/**/*.js" "tests/**/*.{js,html}" "**/*.md"   # what CI lints
```

The pre-commit hook (`.githooks/pre-commit`) formats staged `.html`, `.css`, `.js` and `.md` files
with Prettier, re-stages them, and aborts the commit if `npm test` fails.

## Deploying

- `deploy-pages.yml` builds `site/data/papers.csv` and `trending.csv` from the issues
  (`scripts/papers/build-csv.js`) and the docs site from `docs/` into `site/docs/` (MkDocs,
  `mkdocs.yml`), then deploys `site/` to GitHub Pages. It runs on pushes to
  `main` that touch `site/`, `scripts/papers/` or the docs, on paper-issue changes, and hourly
  (for 👍 votes). If the data or docs build fails, nothing deploys. `site/data/` and `site/docs/`
  are not committed; locally, `npm run dev` serves the fixtures as `site/data/`, and serves
  `site/docs/` once `mkdocs build` has run.
- The docs pages in `docs/` are both the docs site and Markdown read on GitHub. Keep lists free of
  indented blocks (tables, code): Prettier indents them by 3 spaces, and MkDocs' Markdown needs 4,
  so they fall out of the list.
- Workflow actions taken with the workflow token don't start other workflows; `trending.yml`
  dispatches the deploy explicitly for that reason.
- Pages serves with `Cache-Control: max-age=600`. After a deploy, the old page can show for up to
  ten minutes; check the live file with `curl` before assuming a deploy failed.

## Papers as issues

`docs/MAINTAINING.md` describes the bot, labels and workflows. The code is in `scripts/papers/`,
with tests in `tests/papers.test.js`, `tests/trending.test.js`, `tests/slack.test.js`,
`tests/roundup.test.js`, `tests/roundup-html.test.js` and `tests/smtp.test.js`. Field
labels in `.github/ISSUE_TEMPLATE/1-paper.yml` and `FIELDS` in `scripts/papers/lib.js` must match.
Labels are defined in `.github/labels.yml`, never on GitHub. Issues labelled `imported` hold the
Google Sheet history; keep `parseImported()` and the Sheet timestamp handling working for them.

## Settings

Club settings (repository, time zone, meeting, Slack reminder, roundup, Trending, Iowa page) live in
`CONFIG` in `site/assets/js/config.js`. It sits under `site/` because only `site/` is deployed;
the scripts import it from there. Read settings from `CONFIG` and derive text from them (see the
meeting helpers in `utils.js`); never repeat a value in another file. The static `#meeting-when`
text in `site/index.html` and the crons in `slack-reminder.yml`, `trending.yml` and `roundup.yml` can't import
it, so `tests/config.test.js` checks they match.

`chicagoWallTime()` in `lib.js` stays on `America/Chicago` whatever `CONFIG.timezone` says: the
imported Google Sheet timestamps were recorded in Central Time.

## Conventions

- Commits and PRs follow the `workflow-commits` and `workflow-pull-requests` skills.
- Claude is never an author, co-author or signer of a commit or PR (`workflow-ai-disclosure`).
  `attribution` in `.claude/settings.json` is empty so the harness adds nothing.
- The monthly roundups are private. Their workflow log is public, so `roundup-email.js` prints
  counts only, never a login, an address or a roundup; keep it that way.
- Treat every string from issues or INSPIRE as untrusted. On the site, insert it with
  `textContent` or DOM building, never `innerHTML`; titles and abstracts go through `setRichText()`
  (`mathtext.js`), which renders MathML and `$…$` LaTeX from a whitelist. In bot comments, pass it
  through `safeText()`.
