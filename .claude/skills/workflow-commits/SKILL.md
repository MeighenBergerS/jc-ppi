---
name: workflow-commits
description: How to split and write git commits in jc-ppi. Load before staging or committing anything.
---

# Commits

C1. One logical change per commit, and the tests pass at each one. Changes to `CLAUDE.md`,
`.claude/` or `.github/copilot-instructions.md` get a commit of their own.

C2. Subject: imperative, capitalized, no period, at most 50 characters (72 at most), saying what
changes. Do: `Fix Sunday submissions missing from This Week`, `Add trending lookback to config`.
Not: `update`, `fixed stuff`, `More changes`.

C3. Add a body when the why isn't obvious: a blank line after the subject, wrapped at 72, covering
why and what, not how. End with `Closes #N` where one applies.

C4. No AI attribution in the message (`workflow-ai-disclosure`).

C5. Commit only when the user asks, and push only when the user asks. Stage files by name, never
`git add -A`. Check `git diff --cached --stat` in a command of its own, read it, and only then
commit. Never amend or rewrite published history.

C6. The pre-commit hook runs Prettier and `npm test`. If it fails, fix the cause and make a new
commit; never bypass it with `--no-verify`. The hook re-stages formatted files, so review
`git show --stat HEAD` after committing.
