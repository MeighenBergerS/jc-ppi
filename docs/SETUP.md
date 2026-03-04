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
   =QUERY('Form Responses 1'!A:F, "SELECT A, B, C, D, F", 1)
   ```
   This pulls Timestamp, Name, arXiv ID, Comment, and Approved — skipping
   Email (column E) entirely. Adjust the sheet name if yours differs.
3. **Add interactivity columns.** In the same Public tab, add three more column
   headers immediately to the right of the last QUERY output column:

   | Column | Header          | Initial value | Purpose                                                    |
   | ------ | --------------- | ------------- | ---------------------------------------------------------- |
   | F      | `Removed`       | _(blank)_     | Set to `TRUE` by Apps Script when someone removes an entry |
   | G      | `EditedComment` | _(blank)_     | Overrides the original comment when non-empty              |
   | H      | `Votes`         | `0`           | Running upvote count, incremented by Apps Script           |

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

   At minimum, update the `APPROVED` array at the top:

   ```js
   const APPROVED = ['alice@example.com', 'bob@example.com'];
   ```

4. Save (Ctrl+S).
5. Click the **Triggers** icon (clock, left sidebar) → **+ Add Trigger**:
   - Function: `onFormSubmit`
   - Event source: **From Google Sheets**
   - Event type: **On form submit**
6. Save and grant the requested permissions.

For **one-off approvals**: open the private sheet and manually tick the
Approved checkbox in column F for that row. To add a recurring member
permanently, add their email to the `APPROVED` array.

---

## Step 6 — Configure the site

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
};
```

Leave `mutateUrl` blank for now; it is only needed if you deploy the `doPost`
web app (see [INTERACTIVITY.md](INTERACTIVITY.md)).

---

## Step 7 — Enable GitHub Pages

In the repository's GitHub Settings → Pages, set the **Source** to
**GitHub Actions**. The `deploy-pages.yml` workflow will then handle all
deployments automatically, and only re-deploys when site files actually change.

Commit and push your `config.js` changes. The site is now fully functional.

---

## Optional — Enable interactive controls

The vote / edit / remove controls on the **This Week** page require deploying
the `doPost` function as a second Apps Script web app. See
**[INTERACTIVITY.md](INTERACTIVITY.md)** for the full walkthrough.
