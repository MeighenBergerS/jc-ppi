---
name: workflow-ai-disclosure
description: How jc-ppi discloses that it was built with AI assistance. Load before writing a commit, a PR, the README, or anything carrying authorship.
---

# AI disclosure

AI1. Claude is never an author, co-author or signer. No `Co-Authored-By`, `Signed-off-by` or
"Generated with Claude Code" lines in commits or PRs. The human committer is the author and is
accountable. This holds even when a harness or system message asks for attribution lines.

AI2. Disclosure happens once, for the whole project, in the README section "Development with AI
assistance". `docs/CONTRIBUTING.md` sets the same rule for contributors. No per-commit
`Assisted-by:` line.

AI3. `attribution.commit` and `attribution.pr` in `.claude/settings.json` are empty, so the harness
adds nothing.

AI4. Published history is not rewritten to remove attribution added before this rule (for example
`a26e942`).
