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
index.html             ← This Week page
archive.html           ← Past submissions grouped by week
assets/
  css/style.css        ← All styling
  js/
    config.js          ← ✏️  Your Google URLs live here (only file to edit)
    utils.js           ← Week math, CSV parser, arXiv ID helpers
    inspire.js         ← INSPIRE-HEP API fetcher
    table.js           ← DOM table builder
    app.js             ← Page renderers and entry point
README.md
```

---

## Guide to arXiv

[arXiv](https://arxiv.org) is a free, open-access repository where physicists
post papers *before* (and sometimes instead of) formal journal publication.
These are called **preprints**. Almost all HEP papers appear on arXiv first,
often months before the journal version.

### Finding a paper

- **Search** at [arxiv.org](https://arxiv.org) by title, author, or keyword.
- The most relevant categories for this JC are:
  - `hep-ph` — High Energy Physics – Phenomenology
  - `hep-ex` — High Energy Physics – Experiment
  - `hep-th` — High Energy Physics – Theory
  - `nucl-th`, `nucl-ex` — Nuclear Theory / Experiment
  - `astro-ph.HE` — High Energy Astrophysical Phenomena

### The arXiv ID

Every paper has a unique ID like `2301.12345`. It encodes the submission date:
`2301` = January 2023. A URL like `https://arxiv.org/abs/2301.12345` takes you
directly to the abstract page.

When submitting a paper to this journal club, you can paste either:
- The bare ID: `2301.12345`
- The full URL: `https://arxiv.org/abs/2301.12345`

The site will normalise both formats automatically.

### Reading the abstract page

| Field | What it means |
|---|---|
| **Submitted** | Date the authors posted it |
| **Authors** | Click a name to see all their arXiv papers |
| **Subjects** | Primary and cross-listed categories |
| **Abstract** | Short summary written by the authors |
| **[pdf]** | Direct link to the paper PDF |
| **[v2], [v3]…** | Revised versions; the site always links to the latest |

---

## Guide to iNSPIRE-HEP

[INSPIRE-HEP](https://inspirehep.net) is the community database for high energy
physics literature. Unlike arXiv (which just hosts preprints), INSPIRE links
papers to their citations, experiments, authors, and institutions, and indexes
both preprints and published journal articles.

### What the site shows from INSPIRE

| Field | Where it comes from |
|---|---|
| **Title** | INSPIRE record (same as arXiv) |
| **Authors** | INSPIRE — often more complete than arXiv |
| **Abstract** | INSPIRE record |
| **Citation count** | How many other papers cite this one |
| **iNSPIRE-HEP button** | Direct link to the full INSPIRE record |

### The INSPIRE record page

The INSPIRE record for a paper contains much more than the site shows:

- Full author list with affiliations and ORCID links
- **BibTeX / LaTeX citation key** — useful for citing in your own work
- List of papers this paper cites, and papers that cite it
- Links to the DOI (journal version) and arXiv page
- Experiment and collaboration tags

To get a BibTeX entry for any paper: open its INSPIRE record → click
**Cite** → copy the BibTeX.

### Citation counts as a rough guide

For a new paper (< 1 year old), citation counts are low by default — this
does *not* mean the paper is unimportant. For older papers, a rough HEP scale:

| Citations | Rough impression |
|---|---|
| < 10 | Recent or niche |
| 10 – 100 | Solid, community-relevant |
| 100 – 500 | Influential |
| 500+ | Landmark paper |

### Paper not showing on INSPIRE?

INSPIRE typically indexes new arXiv papers within **1–3 days** of posting.
If the site shows the warning *"Not yet indexed on iNSPIRE-HEP"*, the paper
was submitted very recently — the arXiv link still works and you can read it
immediately. The INSPIRE record will appear within a few days.
