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

| Piece                                                                             | Does                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/ISSUE_TEMPLATE/1-paper.yml`                                              | The submission form.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.github/workflows/papers.yml` + `scripts/papers/enrich.js`                       | The bot. On a new or edited paper issue it checks approval, looks the paper up on INSPIRE-HEP (or on arXiv if INSPIRE doesn't have it yet), posts one metadata comment, renames the issue and adds `Updated By Bot`. If an earlier approved, not-removed issue has the same paper, it posts a second comment linking it and adds `Submitted Before`. Daily, it refreshes open issues and those `awaiting INSPIRE`, and closes last week's issues. |
| `.github/workflows/deploy-pages.yml` + `scripts/papers/build-csv.js`              | Before every deploy, writes the approved paper issues to `site/data/papers.csv` and the newest `Trending` issue to `site/data/trending.csv`. Runs on pushes to the site, on paper-issue changes and hourly. If building the data fails, nothing is deployed and the previous site stays up.                                                                                                                                                       |
| `.github/workflows/trending.yml` + `scripts/papers/trending-issue.js`             | On the days in `CONFIG.trending` (Monday and Wednesday mornings), opens a `Trending` issue with the most-cited recent hep-ph papers per category (INSPIRE-HEP), labelled `Trending`, `paper` and `Updated By Bot`, closes the previous one, and redeploys the site. The bot and the site data ignore `Trending` issues as submissions.                                                                                                            |
| `.github/workflows/slack-reminder.yml` + `scripts/papers/slack-reminder.js`       | Thursday 1 PM Central, posts the weekly reminder to Slack: who submitted this week, the most-voted paper, and the top trending paper per category.                                                                                                                                                                                                                                                                                                |
| `.github/workflows/email-submissions.yml` + `scripts/papers/email_submissions.py` | Every 10 minutes, turns papers emailed to the club Gmail into paper issues that wait for approval (see [Email submissions](#email-submissions)).                                                                                                                                                                                                                                                                                                  |
| `.github/workflows/roundup.yml` + `scripts/papers/roundup-email.js`               | The 1st of each month, emails each member their private roundup of the month before (see [Monthly roundups](#monthly-roundups)).                                                                                                                                                                                                                                                                                                                  |
| `.github/workflows/keepalive.yml`                                                 | Weekly, checks the last commit; at 25 days old it re-enables any paused workflow and pushes an empty commit, so GitHub doesn't pause the schedules (it does after 60 days without commits).                                                                                                                                                                                                                                                       |
| `.github/workflows/check-links.yml`                                               | Every 6 hours, checks that the live pages load, the data files have rows, and a deploy ran in the last 6 hours (deploys run hourly). If it fails on that last check, look for a stuck run under **Actions → Deploy to GitHub Pages** and cancel it.                                                                                                                                                                                               |
| `.github/labels.yml` + `.github/workflows/labels.yml`                             | The labels. Edit the file, not the labels on GitHub.                                                                                                                                                                                                                                                                                                                                                                                              |

To rerun the bot by hand, use **Actions → Papers → Run workflow**. Scope `all` also refreshes
closed issues.

## Topics

Papers get up to three club topics (Neutrinos, Dark matter, Cosmology, …), shown as purple pills
on This Week and the Archive, as a filter in the Archive, and in the Stats page's "What we've been
reading" grid. The list is `topics` in `CONFIG` (`site/assets/js/config.js`): a label and a
pattern each, in display order. A paper gets a topic when the pattern matches its title or
INSPIRE keywords, or matches its abstract twice. Add, rename or remove topics freely; the site
picks them up on the next deploy.

## Slack reminder

| Setting                                  | Where                                 | Values                                                         |
| ---------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| Webhook URL                              | Repository secret `SLACK_WEBHOOK_URL` | Set with `gh secret set SLACK_WEBHOOK_URL`                     |
| Post on schedule (Thursday 1 PM Central) | Repository variable `SLACK_REMINDER`  | `on` to post; anything else only prints the message in the log |

To see this week's message without posting, use **Actions → Slack reminder → Run workflow**; tick
"post" to send it.

## Email submissions

People without a GitHub account can email a paper to the club Gmail: the arXiv ID or link as the
subject, why in the body. Every 10 minutes a workflow reads new mail over IMAP and opens a paper
issue for each such email. The issue uses the sender's display name (never their address), is
labelled `needs approval` and assigned to the maintainers, so GitHub emails you. Remove the label
to approve it, as for any non-member's paper. The sender gets a reply with the issue link, and
the workflow starts the paper bot to fill in the details.

Mail that isn't a paper (no arXiv ID in the subject, replies such as "Re: …", auto-replies and
mailing lists) gets no reply and no issue; it is labelled `jc-ppi/skipped` in Gmail for you to
read. Handled mail is labelled `jc-ppi/processed`.

To turn it on:

1. In the club Gmail, **Settings → Forwarding and POP/IMAP → Enable IMAP**. It uses the same
   `GMAIL_ADDRESS` and `GMAIL_APP_PASSWORD` secrets as the roundups.
2. **Actions → Email submissions → Run workflow** counts new papers without changing anything;
   tick "process" to open issues and reply.
3. Set the repository variable `EMAIL_SUBMISSIONS` to `on` for the 10-minute schedule.
4. To show the address on This Week and About, set `submissionEmail` in `CONFIG`
   (`site/assets/js/config.js`).

The Actions log is public, so it shows counts and issue numbers only.

## Monthly roundups

On the 1st of each month, each member gets a private email about the month before: the papers
they suggested, which were discussed, their weekly streak and the milestones they reached (📚
papers suggested, 🗣️ discussed, 🔥 weeks in a row, 🧭 subfields, ⚡ suggested the month they hit
arXiv, 👍 votes). It compares a member only with their own earlier months; no one else sees it,
and nothing personal is on the site. The milestone tiers are `MILESTONES` in
`scripts/papers/roundup.js`.

Members are everyone in `paper-members.txt` and `paper-maintainers.txt`, and everyone who has
suggested a paper. A member gets the email only if their GitHub profile shows a public email
(Settings → Public profile → Public email); without one they are skipped. Their papers from the
Google Sheet count when the name typed into the Sheet matches their GitHub profile name.

| Setting                    | Where                                  | Values                                                                |
| -------------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| Club Gmail address         | Repository secret `GMAIL_ADDRESS`      | Set with `gh secret set GMAIL_ADDRESS`                                |
| Gmail app password         | Repository secret `GMAIL_APP_PASSWORD` | A Google App Password (not the account password); `gh secret set ...` |
| Send on schedule (the 1st) | Repository variable `ROUNDUP_EMAILS`   | `on` to send; anything else only counts                               |
| Opted out                  | Repository variable `ROUNDUP_OPTOUT`   | GitHub usernames, separated by spaces, commas or new lines            |

The email says to reply to stop getting it. Replies go to the club Gmail; add the sender's GitHub
username to `ROUNDUP_OPTOUT`. Repository variables are visible to collaborators only, not to the
public.

**Actions → Monthly roundup → Run workflow** counts who would get an email; tick "send" to send
them, and give a month (`2026-09`) to send an earlier one. The Actions log is public, so it shows
only counts, never names, addresses or roundups.

To see a member's roundup without sending anything:

```sh
npm run roundup -- <github-login> [YYYY-MM] [--name "Name in the Google Sheet"] [--html roundup.html]
```

The month defaults to last month. `--name` counts the member's papers from the Google Sheet era,
which are matched by the name typed into the Sheet; repeat it for each spelling they used.
`--html` also writes the HTML email to a file, to open in a browser. The email carries both: the
HTML (`scripts/papers/roundup-html.js`) and the plain text, for mail programs that don't show
HTML.

## History from the Google Sheet

Until September 2026 papers came in through a Google Form into a Google Sheet, with a Google Apps
Script for approval, votes, trending papers and the Slack reminder. The 75 approved rows of the
Sheet were imported as closed issues labelled `imported`. Their original submission time, name
and vote count live in the issue body (the time and votes in a hidden marker); new 👍 votes are
added to the imported count. The import script and the Apps Script are in the git history
(`scripts/papers/import-sheet.js`, `docs/appscript.gs`).
