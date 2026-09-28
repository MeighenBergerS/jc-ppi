# Paper submissions through GitHub issues (trial)

The journal club is trying out GitHub issues as a replacement for the Google Form, Sheet and Apps
Script. Both run side by side during the trial. The live site still reads the Google Sheet; the
preview reads the issues.

- **Preview:** <https://meighenbergers.github.io/jc-ppi/?source=issues>
- **Papers:** <https://github.com/MeighenBergerS/jc-ppi/issues?q=label%3Apaper>

## For members

| To…                  | Do this                                                                                                                                                                                                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suggest a paper      | [Open a "Suggest a paper" issue](https://github.com/MeighenBergerS/jc-ppi/issues/new?template=paper.yml). You need a GitHub account. The site shows the name on your GitHub profile, or your username if the profile has no name.               |
| Vote                 | Add a 👍 reaction to the paper's issue. One vote per person.                                                                                                                                                                                    |
| Change your comment  | Edit the issue.                                                                                                                                                                                                                                 |
| Withdraw a paper     | Close the issue as "not planned".                                                                                                                                                                                                               |
| Read title, abstract | A bot comments on the issue with the title, authors, abstract, links and BibTeX, usually within a few minutes, and labels it `Updated By Bot`. If the paper was suggested before, it also lists the earlier issues and adds `Submitted Before`. |

## For maintainers

- **Approving.** Repository collaborators and the usernames in `.github/paper-members.txt` and
  `.github/paper-maintainers.txt` are approved automatically. Anyone else's issue gets the
  `needs approval` label and stays off the site; remove the label to approve it.
- **Getting told about new submitters.** For a paper from a non-member, the bot mentions and
  assigns everyone in `.github/paper-maintainers.txt`. GitHub emails them, as long as email is on
  for "Participating, @mentions and custom" in their
  [notification settings](https://github.com/settings/notifications). That is GitHub's default.
- **Handing over.** Put the new lead in `.github/paper-maintainers.txt` and give them write access
  to the repository.
- **Marking discussed.** Add the `discussed` label.
- **Weeks.** Issues are closed as completed on the first daily run after their week ends
  (Monday to Sunday, Central Time), so the open issues are this week's papers.
- **Removing.** Close the issue as "not planned".

## How it works

| Piece                                                                | Does                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/ISSUE_TEMPLATE/paper.yml`                                   | The submission form.                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `.github/workflows/papers.yml` + `scripts/papers/enrich.js`          | The bot. On a new or edited paper issue it checks approval, looks the paper up on INSPIRE-HEP (or on arXiv if INSPIRE doesn't have it yet), posts one metadata comment, renames the issue and adds `Updated By Bot`. If an earlier approved, not-removed issue has the same paper, it posts a second comment linking it and adds `Submitted Before`. Daily, it refreshes open issues and those `awaiting INSPIRE`, and closes last week's issues. |
| `.github/workflows/deploy-pages.yml` + `scripts/papers/build-csv.js` | Before every deploy, writes the approved paper issues to `site/data/papers-from-issues.csv` in the Google Sheet's format. Runs on paper-issue changes and hourly, because 👍 reactions don't trigger workflows.                                                                                                                                                                                                                                   |
| `?source=issues` in `site/assets/js/config.js`                       | Points every page at that CSV, sends "Submit a paper" to the issue form, and swaps the vote buttons for links to the issues.                                                                                                                                                                                                                                                                                                                      |
| `.github/labels.yml` + `.github/workflows/labels.yml`                | The labels. Edit the file, not the labels on GitHub.                                                                                                                                                                                                                                                                                                                                                                                              |

The 75 approved rows of the Google Sheet were imported once with
`scripts/papers/import-sheet.js` as closed issues labelled `imported`. Their original submission
time and vote count live in a hidden marker in the issue body; the preview adds any new 👍 votes to
the imported count.

To rerun the bot by hand, use **Actions → Papers → Run workflow**. Scope `all` also refreshes
closed issues.

## Ending the trial

- **Keeping issues:** point `sheetCsvUrl` at the issues CSV permanently, then retire the Google
  Form, Sheet and Apps Script.
- **Dropping issues:** delete `?source=issues` from `config.js`, `preview.js`, the preview step and
  issue triggers in `deploy-pages.yml`, `papers.yml`, `scripts/papers/` and the `paper` issue form.
  The imported issues can stay closed.
