---
name: workflow-pull-requests
description: How to scope and describe a jc-ppi pull request. Load before opening, updating or describing a PR.
---

# Pull requests

PR1. One concern per PR, and small. Keep refactors apart from behaviour changes.

PR2. The title follows C2 in `workflow-commits`. The description fills in every section of
`.github/pull_request_template.md`: the summary, the type of change, the checklist (ticking only
what was actually done), and related issues.

PR3. Review your own diff first. CI (Tests, Lint) is green, and no unrelated changes ride along.

PR4. A PR that changes the paper form, `.github/labels.yml` or a workflow says in its summary what
maintainers must do after merging, if anything (e.g. rerun the Papers workflow with scope `all`).

PR5. No AI attribution in the title, the body or the commits (`workflow-ai-disclosure`).

PR6. Open, push or merge only when the user asks. Merging to `main` deploys the site when `site/` or
`scripts/papers/` changed.
