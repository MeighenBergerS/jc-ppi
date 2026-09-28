# Running the journal club

Papers are GitHub issues labelled `paper`. A bot fills in each paper's details, the site is
rebuilt from the issues, and a weekly reminder goes to Slack. Everything runs in this repository
on GitHub Actions; there is nothing to host or pay for.

- **Site:** <https://meighenbergers.github.io/jc-ppi/>
- **Papers:** <https://github.com/MeighenBergerS/jc-ppi/issues?q=label%3Apaper>

## For members

Suggesting, voting, editing and withdrawing papers are covered in
[Suggesting and voting](members.md).

## For maintainers

- **Approving.** Repository collaborators and the usernames in `.github/paper-members.txt` and
  `.github/paper-maintainers.txt` are approved automatically. Anyone else's issue gets the
  `needs approval` label and stays off the site; remove the label to approve it, and add their
  username to `paper-members.txt` to approve their future papers too.
- **Getting told about new submitters.** For a paper from a non-member, the bot mentions and
  assigns everyone in `.github/paper-maintainers.txt`. GitHub emails them, as long as email is on
  for "Participating, @mentions and custom" in their
  [notification settings](https://github.com/settings/notifications). That is GitHub's default.
- **Marking discussed.** Add the `discussed` label. Only people with triage or write access can.
- **Removing.** Close the issue as "not planned".
- **Weeks.** Weeks run Monday to Sunday, in the club's time zone (`timezone` in
  `site/assets/js/config.js`). Issues are closed as completed on the
  first daily bot run after their week ends, so the open issues are this week's papers.
- **Changing a setting.** The meeting day and time, the Slack reminder, the Trending categories
  and lookback, and the rest live in `site/assets/js/config.js`; the site, the calendar download,
  the bot and the Slack reminder read them from there. Two copies can't read it: the static
  text in `#meeting-when` in `site/index.html`, and the crons in `slack-reminder.yml` and
  `trending.yml`. `npm test` fails until they match.
- **Handing over.** Put the new lead in `.github/paper-maintainers.txt`, give them write access to
  the repository, and have them set up the Slack webhook secret if it changes.

## How it works

| Piece                                                                       | Does                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/ISSUE_TEMPLATE/1-paper.yml`                                        | The submission form.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.github/workflows/papers.yml` + `scripts/papers/enrich.js`                 | The bot. On a new or edited paper issue it checks approval, looks the paper up on INSPIRE-HEP (or on arXiv if INSPIRE doesn't have it yet), posts one metadata comment, renames the issue and adds `Updated By Bot`. If an earlier approved, not-removed issue has the same paper, it posts a second comment linking it and adds `Submitted Before`. Daily, it refreshes open issues and those `awaiting INSPIRE`, and closes last week's issues. |
| `.github/workflows/deploy-pages.yml` + `scripts/papers/build-csv.js`        | Before every deploy, writes the approved paper issues to `site/data/papers.csv` and the newest `Trending` issue to `site/data/trending.csv`. Runs on pushes to the site, on paper-issue changes and hourly. If building the data fails, nothing is deployed and the previous site stays up.                                                                                                                                                       |
| `.github/workflows/trending.yml` + `scripts/papers/trending-issue.js`       | On the days in `CONFIG.trending` (Monday and Wednesday mornings), opens a `Trending` issue with the most-cited recent hep-ph papers per category (INSPIRE-HEP), labelled `Trending`, `paper` and `Updated By Bot`, closes the previous one, and redeploys the site. The bot and the site data ignore `Trending` issues as submissions.                                                                                                            |
| `.github/workflows/slack-reminder.yml` + `scripts/papers/slack-reminder.js` | Thursday 1 PM Central, posts the weekly reminder to Slack: who submitted this week, the most-voted paper, and the top trending paper per category.                                                                                                                                                                                                                                                                                                |
| `.github/workflows/keepalive.yml`                                           | Weekly, checks the last commit; at 25 days old it re-enables any paused workflow and pushes an empty commit, so GitHub doesn't pause the schedules (it does after 60 days without commits).                                                                                                                                                                                                                                                       |
| `.github/workflows/check-links.yml`                                         | Weekly, checks that the live pages load and the data files have rows.                                                                                                                                                                                                                                                                                                                                                                             |
| `.github/labels.yml` + `.github/workflows/labels.yml`                       | The labels. Edit the file, not the labels on GitHub.                                                                                                                                                                                                                                                                                                                                                                                              |

To rerun the bot by hand, use **Actions → Papers → Run workflow**. Scope `all` also refreshes
closed issues.

## Slack reminder

| Setting                                  | Where                                 | Values                                                         |
| ---------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| Webhook URL                              | Repository secret `SLACK_WEBHOOK_URL` | Set with `gh secret set SLACK_WEBHOOK_URL`                     |
| Post on schedule (Thursday 1 PM Central) | Repository variable `SLACK_REMINDER`  | `on` to post; anything else only prints the message in the log |

To see this week's message without posting, use **Actions → Slack reminder → Run workflow**; tick
"post" to send it.

## History from the Google Sheet

Until September 2026 papers came in through a Google Form into a Google Sheet, with a Google Apps
Script for approval, votes, trending papers and the Slack reminder. The 75 approved rows of the
Sheet were imported as closed issues labelled `imported`. Their original submission time, name
and vote count live in the issue body (the time and votes in a hidden marker); new 👍 votes are
added to the imported count. The import script and the Apps Script are in the git history
(`scripts/papers/import-sheet.js`, `docs/appscript.gs`).
