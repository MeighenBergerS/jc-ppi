# Deploying your own instance

This guide walks through the one-time setup needed to run your own copy of the
jc-ppi journal club site on GitHub Pages.

For the optional vote/edit/remove interactivity feature, see
**[INTERACTIVITY.md](INTERACTIVITY.md)** after completing the steps here.

---

## Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it something like **jc-ppi submissions**.
3. Leave it empty for now — Google Forms will populate it.

---

## Step 2 — Create the Google Form

1. Go to [forms.google.com](https://forms.google.com) and create a new form.
2. Title it e.g. **Iowa Particles & Plots — Paper Submission**.
3. In **Settings → Responses**, enable **Collect email addresses** (set to
   "Responder input" so submitters type their address) and enable
   **Limit to 1 response** (requires sign-in, deters spam).
4. Add the following questions **in this exact order**:

   | #   | Question text                           | Type         |
   | --- | --------------------------------------- | ------------ |
   | 1   | Your name                               | Short answer |
   | 2   | arXiv ID or URL (e.g. 2301.12345)       | Short answer |
   | 3   | Why are you suggesting this? (optional) | Paragraph    |
   | 4   | Email Address                           | Short answer |

   > **That's it — only 4 fields.** The site fetches the paper title and
   > authors automatically from the INSPIRE-HEP API using the ID, so submitters
   > never have to type the title.

   > **Important:** Do not change the order later — the site maps columns by
   > position, not by name. The resulting sheet columns will be:
   > A=Timestamp, B=Name, C=arXiv ID, D=Comment, E=Email, F=Approved.

---

## Step 3 — Create a Public sheet tab (hides email addresses)

The raw response sheet contains email addresses. To avoid exposing them in the
publicly readable CSV, create a second tab that mirrors everything except email:

1. At the bottom of the sheet, click **+** to add a new tab. Name it `Public`.
2. In cell **A1** of the Public tab, paste this formula:

   ```
   =QUERY(ARRAYFORMULA(TO_TEXT('Form Responses 1'!A:F)), "SELECT Col1, Col2, Col3, Col4, Col6", 1)
   ```

   This pulls Timestamp, Name, arXiv ID, Comment, and Approved — skipping
   Email (column E) entirely. Adjust the sheet name if yours differs.

   > **Why `TO_TEXT`?** When a submitter pastes a full arXiv URL (e.g.
   > `https://arxiv.org/abs/2301.12345`), Google Sheets auto-formats the cell
   > as a hyperlink. Plain `QUERY` returns an empty string for hyperlink cells;
   > wrapping the range in `ARRAYFORMULA(TO_TEXT(...))` forces every cell to
   > plain text first so URLs are preserved. Column references change from
   > letter-based (`A`, `C`, …) to positional (`Col1`, `Col3`, …) because the
   > input is no longer a direct named range.

3. **Add interactivity columns.** In the same Public tab, add three more column
   headers immediately to the right of the last QUERY output column:

   | Column | Header          | Initial value | Purpose                                                                                    |
   | ------ | --------------- | ------------- | ------------------------------------------------------------------------------------------ |
   | F      | `Removed`       | _(blank)_     | Set to `TRUE` by Apps Script when someone removes an entry                                 |
   | G      | `EditedComment` | _(blank)_     | Overrides the original comment when non-empty                                              |
   | H      | `Votes`         | `0`           | Running upvote count, incremented by Apps Script                                           |
   | I      | `Discussed`     | _(blank)_     | Set to `TRUE` by Apps Script when a paper is starred as discussed; cleared when un-starred |

   For the `Votes` column, set the initial value to `0` for any existing rows
   (select the cells → type `0` → Ctrl+Enter). New rows added by the QUERY
   formula will leave it blank, which the Apps Script treats as `0`.

   > These columns are only written by the Apps Script web app
   > (see [INTERACTIVITY.md](INTERACTIVITY.md)). If you do not plan to enable
   > interactivity, you can skip adding them.

---

## Step 4 — Publish the Public tab as CSV

1. Click **File → Share → Publish to web**.
2. In the first dropdown choose the **Public** tab. In the second choose
   **Comma-separated values (.csv)**.
3. Click **Publish** and confirm.
4. Copy the URL — it looks like:
   ```
   https://docs.google.com/spreadsheets/d/LONG_ID/pub?gid=XXXXXXXX&single=true&output=csv
   ```
   Keep this URL; paste it into `sheetCsvUrl` in `config.js` next.

---

## Step 5 — Add the auto-approval Apps Script

This script automatically ticks the Approved checkbox for known members when
they submit, so their papers appear on the site without manual action.

1. Open the **private response sheet** (not the Public tab).
2. **Extensions → Apps Script**.
3. Replace any existing code with the contents of **`docs/appscript.gs`** from
   this repository. The file contains two parts:
   - `onFormSubmit` — auto-approves known members on form submission
   - `doPost` — handles vote/edit/remove mutations from the site (optional;
     see [INTERACTIVITY.md](INTERACTIVITY.md) for setup)

   The script reads the approved member list from a **Members** sheet tab
   (see Step 5a below) — no code editing needed to add or remove members.

4. Save (Ctrl+S).
5. Click the **Triggers** icon (clock, left sidebar) → **+ Add Trigger**:
   - Function: `onFormSubmit`
   - Event source: **From Google Sheets**
   - Event type: **On form submit**
6. Save and grant the requested permissions.

For **one-off approvals**: open the private sheet and manually tick the
Approved checkbox in column F for that row.

### Step 5a — Create the Members tab

The `onFormSubmit` script looks for a sheet tab called **Members** to find the
approved member list. Create it once:

1. In the spreadsheet (either the private response sheet or the same workbook),
   click **+** to add a new tab and name it `Members`.
2. In column A, add one email address per row — no header needed.
3. To add or remove a member in future, just edit this tab. No code changes required.

---

## Step 6 — Set up the weekly Slack reminder (optional)

The Apps Script can post a Thursday afternoon reminder to your Slack channel
that lists who has submitted papers and highlights the top-voted paper.

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App → From scratch**.
2. Under **Features → Incoming Webhooks**, toggle it on, then click
   **Add New Webhook to Workspace** and pick your channel.
3. Copy the webhook URL (looks like `https://hooks.slack.com/services/T.../B.../...`).
4. In your Apps Script project, paste the URL as the value of `SLACK_WEBHOOK_URL`
   near the top of the Slack section in `docs/appscript.gs`:
   ```js
   var SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL';
   ```
5. Set up the recurring trigger:
   - **Triggers** (clock icon, left sidebar) → **+ Add Trigger**
   - Function: `weeklySlackReminder`
   - Event source: **Time-driven**
   - Type of time-based trigger: **Week timer**
   - Day of week: **Thursday**
   - Time of day: **1pm – 2pm**
6. Save and grant the requested permissions.

The reminder posts every Thursday between 1 and 2 pm in the Apps Script
environment's timezone. It thanks submitters by name and links the top-voted
paper (or nudges people to submit if none have been posted yet).

---

## Step 7 — Configure the site

Open `site/assets/js/config.js` and fill in the URLs:

```js
export const CONFIG = {
  // Published CSV URL for the Public tab (from Step 4)
  sheetCsvUrl:
    'https://docs.google.com/spreadsheets/d/YOUR_ID/pub?gid=XXXXXXXX&single=true&output=csv',
  // Google Form share link (from Step 2)
  formUrl: 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform',
  // Apps Script /exec URL for vote/edit/remove (from INTERACTIVITY.md — leave blank to disable)
  mutateUrl: '',
  // Meeting schedule — shown in the "When" block and used for the calendar download
  meeting: {
    day: 'Friday',
    time: '2:30 PM CT',
    timezoneLabel: 'Central Time',
    timezone: 'America/Chicago',
    icsAnchor: '20260306T143000', // DTSTART of a known occurrence
    icsDurationEnd: '20260306T160000', // DTEND of that same occurrence
    icsDayCode: 'FR', // RRULE BYDAY (FR=Friday, TH=Thursday, …)
    slackUrl: '', // Slack channel URL — leave '' for plain text
  },
};
```

To update the meeting time in future, change only the `meeting` fields — the
home page "When" block and the calendar download will both update automatically.

---

## Step 8 — Enable GitHub Pages

In the repository's GitHub Settings → Pages, set the **Source** to
**GitHub Actions**. The `deploy-pages.yml` workflow will then handle all
deployments automatically, and only re-deploys when site files actually change.

Commit and push your `config.js` changes. The site is now fully functional.

---

## Optional — Enable interactive controls

The vote / edit / remove controls on the **This Week** page require deploying
the `doPost` function as a second Apps Script web app. See
**[INTERACTIVITY.md](INTERACTIVITY.md)** for the full walkthrough.
