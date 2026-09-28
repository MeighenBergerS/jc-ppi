# Deploying your own instance

This guide sets up your own copy of the journal club site. Everything runs on GitHub: papers are
issues, a bot fills in their details, and GitHub Actions builds the site and posts to Slack. You
need a GitHub account and, for the Slack reminder, a Slack workspace where you can add an app.
Day-to-day running is described in [MAINTAINING.md](MAINTAINING.md).

---

## Step 1 — Copy the repository

Fork the repository, or use it as a template, into a **public** repository. GitHub Pages on the
free plan needs a public repository, and so do free Actions minutes.

In a fork, open the **Actions** tab and enable workflows; GitHub turns them off in new forks.

## Step 2 — Point the code at your repository

`site/assets/js/config.js` holds the club's settings; the site and every script read them from
there.

| File                                | Change                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `site/assets/js/config.js`          | `REPO` (your `owner/repo`), `clubName`, the time zone, `meeting`, and the other settings |
| `site/index.html`                   | The static meeting text in `#meeting-when`, and the club name wherever it appears        |
| `.github/workflows/*.yml`           | The crons in `slack-reminder.yml` and `trending.yml`, if you changed their days or hour  |
| `.github/paper-maintainers.txt`     | Your GitHub username                                                                     |
| `.github/paper-members.txt`         | Your members' GitHub usernames, one per line                                             |
| `.github/workflows/check-links.yml` | The site URL (`BASE`)                                                                    |

`npm test` fails if the static meeting text or the crons disagree with `config.js`.

## Step 3 — Create the labels

Run **Actions → Labels → Run workflow**. It creates the labels in `.github/labels.yml` (`paper`,
`needs approval`, `discussed`, `Trending`, and the rest). Afterwards it runs whenever that file
changes on `main`.

## Step 4 — Enable GitHub Pages

In **Settings → Pages**, set **Source** to **GitHub Actions**. Then run **Actions → Deploy to
GitHub Pages → Run workflow**. The site appears at `https://<owner>.github.io/<repo>/`.

## Step 5 — Add the first trending list

Run **Actions → Trending → Run workflow**. It opens the first `Trending` issue and redeploys the
site; after that it runs every Monday and Wednesday morning.

## Step 6 — Set up the Slack reminder (optional)

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**.
2. Under **Features → Incoming Webhooks**, turn it on, click **Add New Webhook to Workspace**,
   and choose your channel. Copy the webhook URL.
3. Store it as a repository secret and turn on the Thursday reminder:

   ```sh
   gh secret set SLACK_WEBHOOK_URL   # paste the webhook URL when asked
   gh variable set SLACK_REMINDER --body on
   ```

4. Check the message with **Actions → Slack reminder → Run workflow**. Leave "post" unticked to
   only print it in the log, or tick it to send it now.

## Step 7 — Try it

Open a paper with the **Suggest a paper** issue form. Within a few minutes the bot comments with
the paper's details, and the paper shows on the site's This Week page.
