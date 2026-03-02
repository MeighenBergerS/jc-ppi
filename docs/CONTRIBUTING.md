# Contributing to Iowa Particles & Plots Journal Club

Welcome! This document explains how to suggest a paper for the journal club,
and how to contribute to the website itself.

---

## Suggesting a paper for discussion

The easiest way to contribute is to suggest a paper for an upcoming meeting.

1. **Find a paper** you'd like the group to discuss. Papers are usually found
   on [arXiv](https://arxiv.org) — see the [arXiv guide in the README](../README.md#guide-to-arxiv)
   if you're new to it.

2. **Submit it** using the link on the [journal club website](https://meighenbergers.github.io/jc-ppi/).
   You'll be asked for:

   | Field | What to enter |
   |---|---|
   | **Your name** | Your first name, or however you'd like to be listed |
   | **arXiv ID or URL** | e.g. `2301.12345` or `https://arxiv.org/abs/2301.12345` |
   | **Why are you suggesting this?** | A sentence or two is great. "General interest" is a perfectly fine answer. |

3. Your submission will appear automatically on the website under **This Week**.
   After Sunday it moves to the **Archive** — no action needed from you.

### Tips for a good submission

- Any HEP-adjacent topic is fair game: theory, experiment, phenomenology,
  instrumentation, or even a review/methods paper you found useful.
- Recent papers (posted this week or last) tend to generate the best discussion,
  but older papers are welcome too.
- If the paper is very long, mentioning which sections are most relevant in the
  "why" field helps people prepare.

---

## Contributing to the website

The site is a static GitHub Pages site. All source files are in this repository.

### Setup

No build step is required. Any static file server works for local development:

```bash
python -m http.server 8000
# open http://localhost:8000
```

### File map

| File | What it does |
|---|---|
| `assets/js/config.js` | Google Sheet and Form URLs — **only file needed for initial setup** |
| `assets/js/utils.js` | Week math, CSV parser, arXiv ID helpers |
| `assets/js/inspire.js` | INSPIRE-HEP API client |
| `assets/js/table.js` | DOM table builder |
| `assets/js/app.js` | Page renderers and entry point |
| `assets/css/style.css` | All styling |
| `index.html` | This Week page |
| `archive.html` | Archive page |

### Making changes

1. Fork the repository and create a branch.
2. Make your changes locally and test with `python -m http.server 8000`.
3. Open a pull request against `main`.

The site redeploys automatically whenever site files change (HTML, CSS, JS assets).
