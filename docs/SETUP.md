# Deploying your own instance

This guide walks through the one-time setup needed to run your own copy of the
jc-ppi journal club site on GitHub Pages.

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

5. Click the **Responses** tab → click the green Sheets icon **"Link to
   Sheets"** → **Create a new spreadsheet** (or link to the one from Step 1).

6. **Add an Approved column.** In the sheet, click the column F header and
   type `Approved`. Select F2:F1000 and add checkboxes via
   **Insert → Checkbox** — this covers all future rows automatically.

7. Click **Publish** (top right) → click the **link icon** → copy the URL.
   This is your `formUrl`.

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
3. Replace any existing code with:

   ```js
   const APPROVED = ['alice@example.com', 'bob@example.com'];

   function onFormSubmit(e) {
     const sheet = e.range.getSheet();
     const row = e.range.getRow();
     // e.values indices: [0] Timestamp [1] Name [2] arXiv [3] Comment [4] Email
     const email = (e.values[4] ?? '').trim().toLowerCase();
     const approved = APPROVED.map((a) => a.toLowerCase()).includes(email);
     sheet.getRange(row, 6).setValue(approved); // column F = Approved
   }
   ```

4. Save (Ctrl+S).
5. Click the **Triggers** icon (clock, left sidebar) → **+ Add Trigger**:
   - Function: `onFormSubmit`
   - Event source: **From Google Sheets**
   - Event type: **On form submit**
6. Save and grant the requested permissions.

For **one-off approvals** (guests, new members not yet in the script): open the
private sheet and manually tick the Approved checkbox in column F for that row.
Dropping a member? Remove their email from the `APPROVED` array.

---

## Step 6 — Configure the site

Open `site/assets/js/config.js` and fill in the two URLs:

```js
export const CONFIG = {
  // URL of the *Public* tab published as CSV (from Step 4)
  sheetCsvUrl:
    'https://docs.google.com/spreadsheets/d/YOUR_ID/pub?gid=XXXXXXXX&single=true&output=csv',
  // Google Form share link (from Step 2)
  formUrl: 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform',
};
```

---

## Step 7 — Enable GitHub Pages

In the repository's GitHub Settings → Pages, set the **Source** to
**GitHub Actions**. The `deploy-pages.yml` workflow will then handle all
deployments automatically, and only re-deploys when site files actually change.

Commit and push your `config.js` changes. The site is now fully functional.
