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

- Pushing to `main` deploys `site/` to GitHub Pages, but only when files under `site/` change
  (`deploy-pages.yml`). Changes to `docs/`, tests or the README do not redeploy.
- Pages serves with `Cache-Control: max-age=600`. After a deploy, the old page can show for up to
  ten minutes; check the live file with `curl` before assuming a deploy failed.
- `docs/appscript.gs` is a reference copy. The live Apps Script runs inside the Google Sheet and
  changes only when someone pastes the code in and redeploys. Load the `appscript-changes` skill
  before editing that file.

## Settings that live in more than one place

- **Meeting day and time:** `site/index.html` (static fallback text in `#meeting-when`),
  `site/assets/js/config.js` (`meeting.time`, plus `icsAnchor` and `icsDurationEnd`, which encode
  the start and end in local time), the fallback defaults in `_downloadCalendar` in
  `site/assets/js/app.js`, the example in `docs/SETUP.md`, and `MEETING_TIME` in
  `docs/appscript.gs` (Slack reminder text). Change all of them together, and remind the user to
  update the live Apps Script.
- **Trending lookback and schedule:** `INSPIRE_LOOKBACK_WEEKS` and the trigger days are set in the
  Apps Script; `site/assets/js/trending.js` repeats them in its display text.

## Conventions

- Commits and PRs follow the `workflow-commits` and `workflow-pull-requests` skills.
- Claude is never an author, co-author or signer of a commit or PR (`workflow-ai-disclosure`).
  `attribution` in `.claude/settings.json` is empty so the harness adds nothing.
- Treat every string from the Google Sheet or INSPIRE as untrusted. Insert it with `textContent` or
  DOM building, never `innerHTML`.
