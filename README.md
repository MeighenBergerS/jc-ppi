# jc-ppi — Iowa Particles & Plots Journal Club

> *From arXiv to argument — every week.*

Live site: **https://meighenbergers.github.io/jc-ppi/**

A minimal static website for the journal club. Members submit paper suggestions via a Google Form; submissions appear on the site automatically, bucketed by week. No manual curation required.

---

## How it works

```
Member fills out Google Form
        ↓
Response auto-appends to Google Sheet (with timestamp)
        ↓
Sheet is published as a public CSV URL
        ↓
Site fetches CSV on page load → renders "This Week" or archive
```

Papers submitted during the current Monday–Sunday window appear on the **This Week** page. After Sunday they roll automatically into the **Archive**.

---

## One-time setup

### Step 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it something like **jc-ppi submissions**.
3. Leave it empty for now — Google Forms will populate it.

### Step 2 — Create the Google Form

1. Go to [forms.google.com](https://forms.google.com) and create a new form.
2. Title it e.g. **Iowa Particles & Plots — Paper Submission**.
3. Add the following questions **in this exact order**:

   | # | Question text | Type |
   |---|---|---|
   | 1 | Your name | Short answer |
   | 2 | arXiv ID or URL (e.g. 2301.12345) | Short answer |
   | 3 | Why are you suggesting this? (optional) | Paragraph |

   > **That's it — only 3 fields.** The site fetches the paper title and
   > authors automatically from the arXiv API using the ID, so submitters
   > never have to type the title.

   > **Important:** Do not change the order later — the site maps columns by position, not by name.

4. Click the **Responses** tab → click the green Sheets icon **"Link to Sheets"** → **Create a new spreadsheet** (or link to the one from Step 1). Google will create a sheet with a **Timestamp** column (A) followed by your three questions (B–D).

5. Click **Publish** (top right) → click the **link icon** in the dialog that appears → copy the URL. This is your `formUrl`.

### Step 3 — Publish the sheet as CSV

1. Open the linked Google Sheet.
2. Click **File → Share → Publish to web**.
3. In the first dropdown choose **Sheet1** (the sheet holding responses). In the second dropdown choose **Comma-separated values (.csv)**.
4. Click **Publish** and confirm.
5. Copy the URL that appears — it looks like:
   ```
   https://docs.google.com/spreadsheets/d/LONG_ID_HERE/pub?gid=0&single=true&output=csv
   ```
   Keep this URL; you will paste it into the site config next.

### Step 4 — Configure the site

Open `assets/js/papers.js` and fill in the two placeholders near the top:

```js
const CONFIG = {
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/YOUR_ID/pub?gid=0&single=true&output=csv",
  formUrl:     "https://docs.google.com/forms/d/e/YOUR_FORM_ID/viewform",
};
```

Commit and push. The site is now fully functional.

---

## Weekly workflow

**Nothing.** Members submit papers via the form link on the site. Papers appear automatically under "This Week" and roll to the Archive after Sunday midnight (based on the visitor's local time).

The only optional manual action is deleting spam rows directly in the Google Sheet — changes are reflected on the site within about a minute.

---

## Local preview

Any static file server works:

```bash
python -m http.server 8000
# open http://localhost:8000
```

> Note: fetching the Google Sheets CSV may be blocked by CORS in some browsers during local development. Push to GitHub Pages to test the live data flow.

---

## File structure

```
index.html          ← This Week page
archive.html        ← Past submissions grouped by week
assets/
  css/style.css     ← All styling
  js/papers.js      ← CSV fetch, week bucketing, table rendering
README.md
```
