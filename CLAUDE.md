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
prettier --check "site/**/*.{html,css,js}" "docs/**/*.md" README.md   # what CI lints
```

The pre-commit hook (`.githooks/pre-commit`) formats staged `.html`, `.css`, `.js` and `.md` files
with Prettier, re-stages them, and aborts the commit if `npm test` fails.

## Deploying

- `deploy-pages.yml` builds `site/data/papers.csv` and `trending.csv` from the issues
  (`scripts/papers/build-csv.js`), then deploys `site/` to GitHub Pages. It runs on pushes to
  `main` that touch `site/` or `scripts/papers/`, on paper-issue changes, and hourly (for 👍
  votes). If the data build fails, nothing deploys. `site/data/` is not committed; locally, use
  `npm run dev`, which serves the fixtures there.
- Workflow actions taken with the workflow token don't start other workflows; `trending.yml`
  dispatches the deploy explicitly for that reason.
- Pages serves with `Cache-Control: max-age=600`. After a deploy, the old page can show for up to
  ten minutes; check the live file with `curl` before assuming a deploy failed.

## Papers as issues

`docs/MAINTAINING.md` describes the bot, labels and workflows. The code is in `scripts/papers/`,
with tests in `tests/papers.test.js`, `tests/trending.test.js` and `tests/slack.test.js`. Field
labels in `.github/ISSUE_TEMPLATE/1-paper.yml` and `FIELDS` in `scripts/papers/lib.js` must match.
Labels are defined in `.github/labels.yml`, never on GitHub. Issues labelled `imported` hold the
Google Sheet history; keep `parseImported()` and the Sheet timestamp handling working for them.

## Settings that live in more than one place

- **Meeting day and time:** `site/index.html` (static fallback text in `#meeting-when`),
  `site/assets/js/config.js` (`meeting.time`, plus `icsAnchor` and `icsDurationEnd`, which encode
  the start and end in local time) and the fallback defaults in `_downloadCalendar` in
  `site/assets/js/app.js`. Change them together. The Slack reminder reads `config.js`.
- **Trending lookback and schedule:** `TRENDING_LOOKBACK_WEEKS` in `scripts/papers/trending.js`
  and the cron in `.github/workflows/trending.yml`; `site/assets/js/trending.js` repeats both in
  its display text.

## Conventions

- Commits and PRs follow the `workflow-commits` and `workflow-pull-requests` skills.
- Claude is never an author, co-author or signer of a commit or PR (`workflow-ai-disclosure`).
  `attribution` in `.claude/settings.json` is empty so the harness adds nothing.
- Treat every string from issues or INSPIRE as untrusted. On the site, insert it with
  `textContent` or DOM building, never `innerHTML`; in bot comments, pass it through `safeText()`.
