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
3. Add the following questions **in this exact order**:

   | #   | Question text                           | Type         |
   | --- | --------------------------------------- | ------------ |
   | 1   | Your name                               | Short answer |
   | 2   | arXiv ID or URL (e.g. 2301.12345)       | Short answer |
   | 3   | Why are you suggesting this? (optional) | Paragraph    |

   > **That's it — only 3 fields.** The site fetches the paper title and
   > authors automatically from the INSPIRE-HEP API using the ID, so submitters
   > never have to type the title.

   > **Important:** Do not change the order later — the site maps columns by position, not by name.

4. Click the **Responses** tab → click the green Sheets icon **"Link to Sheets"** → **Create a new spreadsheet** (or link to the one from Step 1). Google will create a sheet with a **Timestamp** column (A), an **Email Address** column (B, because you enabled sign-in collection), followed by your three questions (C–E).

   > **Important:** Do not change the order later — the site maps columns by position, not by name.

5. **Add an Approved column.** In the sheet, click the header of column F and type `Approved`. Then select the cells below it and add checkboxes via **Insert → Checkbox**. Ticking a box sets it to `TRUE`, which lets you manually approve submissions from anyone not on the email allowlist.

6. Click **Publish** (top right) → click the **link icon** in the dialog that appears → copy the URL. This is your `formUrl`.

---

## Step 3 — Publish the sheet as CSV

1. Open the linked Google Sheet.
2. Click **File → Share → Publish to web**.
3. In the first dropdown choose **Sheet1** (the sheet holding responses). In the second dropdown choose **Comma-separated values (.csv)**.
4. Click **Publish** and confirm.
5. Copy the URL that appears — it looks like:
   ```
   https://docs.google.com/spreadsheets/d/LONG_ID_HERE/pub?gid=0&single=true&output=csv
   ```
   Keep this URL; you will paste it into the site config next.

---

## Step 4 — Configure the site

Open `site/assets/js/config.js` and fill in the placeholders:

```js
const CONFIG = {
  sheetCsvUrl: 'https://docs.google.com/spreadsheets/d/YOUR_ID/pub?gid=0&single=true&output=csv',
  formUrl: 'https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform',

  // Add member emails here — their submissions appear automatically.
  // Anyone not listed needs to be manually approved in the sheet.
  approvedEmails: ['alice@example.com', 'bob@example.com'],
};
```

---

## Step 5 — Enable GitHub Pages

In the repository's GitHub Settings → Pages, set the **Source** to
**GitHub Actions**. The `deploy-pages.yml` workflow will then handle all
deployments automatically, and only re-deploys when site files actually change.

Commit and push your `config.js` changes. The site is now fully functional.
