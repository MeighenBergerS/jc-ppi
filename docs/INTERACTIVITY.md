# Interactive controls — vote, edit, remove

The **This Week** page can display per-paper action controls that let any
visitor upvote a paper, update the suggestion comment, or remove their
submission. These controls are only visible for the **current week's papers**
and are disabled for anything in the Archive.

This feature is entirely optional. The site works without it — simply leave
`mutateUrl` blank in `config.js`.

---

## How it works

```
Visitor clicks a control (vote / edit / remove)
        ↓
sheet.js sends an HTTP POST to the Apps Script /exec URL
        ↓
doPost() validates the request and checks the paper is this week's
        ↓
Apps Script writes to the Public tab (votes / edited comment / removed flag)
        ↓
Next page load reflects the change (CSV re-fetched)
```

Mutations are **scoped to the current week** by a date guard inside the Apps
Script: any request for a paper whose submission timestamp falls outside
Monday 00:00 – Sunday 23:59 is rejected with an error.

---

## Sheet setup

Add three columns to the right of column E on the **Public** tab:

| Column | Header          | Initial value | Written by                                         |
| ------ | --------------- | ------------- | -------------------------------------------------- |
| F      | `Removed`       | _(blank)_     | Apps Script — set to `TRUE` to hide a row          |
| G      | `EditedComment` | _(blank)_     | Apps Script — overrides the original comment       |
| H      | `Votes`         | `0`           | Apps Script — incremented on each upvote           |
| I      | `Discussed`     | _(blank)_     | Apps Script — toggled `TRUE`/blank by the ★ button |

For existing rows set `Votes` to `0` (select H2:H1000, type `0`, Ctrl+Enter).
New rows from the QUERY formula will be blank, which the Apps Script treats as `0`.

> The client column map in `config.js` (`COL.removed=5`, `COL.editedComment=6`,
> `COL.votes=7`, `COL.discussed=8`) reflects these zero-indexed positions. Do not reorder these
> columns without updating `config.js` and the `COL_*` constants in the Apps
> Script.

---

## Deploying the Apps Script web app

The `doPost` handler lives in **`docs/appscript.gs`** alongside the existing
`onFormSubmit` function. Paste the entire file into your Apps Script project
(Extensions → Apps Script), replacing any existing code, then deploy it as a
web app:

1. **Extensions → Apps Script** → open your project.
2. Replace the existing code with the contents of `docs/appscript.gs`.
3. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy** and authorise the requested permissions.
5. Copy the `/exec` URL shown after deployment.

> **"Anyone" means HTTP access only** — it does not give anyone access to edit
> your script or spreadsheet. The Apps Script runs as your account, but only
> executes the specific `doPost` logic you have written.

---

## Configuring the site

Paste the `/exec` URL into `config.js`:

```js
export const CONFIG = {
  sheetCsvUrl: '...',
  formUrl: '...',
  mutateUrl: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
};
```

With `mutateUrl` set, the **This Week** table gains a fourth "Actions" column
with the ▲ vote, ✏ edit, and ✕ remove buttons. These controls do not appear
on the Archive page.

---

## What each action does

### ▲ Vote

Increments the vote count for the paper in column H of the Public tab.
The button is disabled for one second after clicking to prevent accidental
double-votes. The updated count is shown immediately in the UI.

### ✏ Edit

Opens an inline textarea pre-filled with the current comment. Clicking **Save**
writes the new text to column G (`EditedComment`). The site displays
`EditedComment` (column G) in preference to the original comment (column D)
whenever it is non-empty.

### ✕ Remove

Shows a confirmation dialog. On confirmation, sets column F (`Removed`) to
`TRUE`. The row is filtered out the next time the CSV is loaded.
Removed entries do not appear in the Archive either.

---

### ★ Mark discussed

Toggles the `Discussed` flag (column I) for a paper. Clicking once sets it to
`TRUE` — the button turns gold and shows **★ Discussed**; a **★ Discussed at JC**
badge also appears at the top of the paper cell. Clicking again clears the
flag (un-stars). Multiple papers in the same week can be starred.

The badge is read-only in the Archive — the action button only appears on
the current-week page. To correct a star in the Archive, edit the
`Discussed` column directly in the Public sheet.

---

### Trending refresh (automatic)

When the **Trending Papers** section on the home page detects that the
Trending CSV is empty (e.g. on a brand-new deployment before the first
scheduled trigger fires), the site automatically sends a silent background
POST to `doPost` with `{ action: "triggerTrendingRefresh" }`. This invokes
`refreshTrendingPapers()` in the Apps Script, which fetches the latest data
from INSPIRE-HEP and writes it to the Trending tab — the section will be
populated on the next page load.

No `arxivId` is required for this action. Under normal operation the refresh
is handled by the Monday/Wednesday time-driven triggers described in
[SETUP.md](SETUP.md#step-6b--set-up-the-trending-papers-section-optional).

---

## Date guard

The Apps Script `_findRow` function will only match a paper if its timestamp
(column A) falls within the current Monday–Sunday window. Requests for papers
outside this window return `{ ok: false, error: "Paper not found" }` and no
mutation is performed. This prevents stale Archive entries from being mutated
even if someone crafts a manual POST request.

The week boundary calculation in the Apps Script mirrors `weekStart()` in
`utils.js` on the client: Monday 00:00:00 in the spreadsheet's local timezone.

---

## Re-deploying after code changes

Apps Script web app URLs are tied to a specific **deployment**, not the live
code. After editing the script you must create a **new deployment** (Deploy →
New deployment) and update `mutateUrl` in `config.js` with the new `/exec` URL.
Alternatively choose **Manage deployments → edit → use latest code** to update
an existing deployment in place.
