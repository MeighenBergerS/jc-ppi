---
name: appscript-changes
description: Checklist for changing docs/appscript.gs, the reference copy of the live Google Apps Script. Load before editing that file, or when a change to the site depends on the Apps Script (mutations, Slack reminder, trending refresh, member approval).
---

# Apps Script changes

The live script runs inside the Google Sheet. Editing `docs/appscript.gs` changes nothing live;
the user must paste it in. Claude cannot reach the live script, so every change ends with steps for
the user.

AS1. Never commit a real Slack webhook, sheet ID or member email. `SLACK_WEBHOOK_URL` stays the
placeholder in the repo. Tell the user to keep the live value when pasting the new code over the
old.

AS2. The runtime is Apps Script V8, not Node: `var`, no `import`, `require` or npm. Sheet columns
are 1-indexed here and 0-indexed in `config.js`; a column change updates both, plus the
`COL`/`COL_TREND` maps and the copilot instructions.

AS3. Anything written to the sheet from a request (`doPost`) is untrusted. Never pass it to
`setValue` unescaped: a leading `=`, `+`, `-` or `@` makes it a formula, which can read the Members
tab into the public CSV.

AS4. Say which kind of change it is, since each needs different live steps:

- Only a constant or a time-driven function (`weeklySlackReminder`, `refreshTrendingPapers`,
  `onFormSubmit`): paste the code and save. No redeploy.
- `doPost` or anything it calls: paste, save, then **Deploy → Manage deployments → edit → Version:
  New version → Deploy**. This keeps the `/exec` URL. A **New deployment** changes the URL, and
  then `mutateUrl` in `config.js` must change too.
- A new or changed schedule: update the trigger in the **Triggers** panel, and the schedule text in
  `docs/SETUP.md` and `site/assets/js/trending.js`.

AS5. End the turn with the user's steps as a short numbered list, and state which live values
(webhook, trigger times) they must keep or change.
