# Guide to arXiv and INSPIRE-HEP

This guide is for journal club members who are new to the tools the physics
community uses to find and share papers.

---

## arXiv

[arXiv](https://arxiv.org) is a free, open-access repository where physicists
post papers _before_ (and sometimes instead of) formal journal publication.
These are called **preprints**. The vast majority of HEP papers appear on arXiv
first, often months before the journal version.

### Finding a paper

- **Search** at [arxiv.org](https://arxiv.org) by title, author, or keyword.
- The most relevant categories for this journal club are:

  | Category      | Description                         |
  | ------------- | ----------------------------------- |
  | `hep-ph`      | High Energy Physics – Phenomenology |
  | `hep-ex`      | High Energy Physics – Experiment    |
  | `hep-th`      | High Energy Physics – Theory        |
  | `nucl-th`     | Nuclear Theory                      |
  | `nucl-ex`     | Nuclear Experiment                  |
  | `astro-ph.HE` | High Energy Astrophysical Phenomena |

### The arXiv ID

Every paper has a unique ID like `2301.12345`. It encodes the submission date:
`2301` = January 2023. A URL like `https://arxiv.org/abs/2301.12345` takes you
directly to the abstract page.

When submitting a paper to this journal club, you can paste either:

- The bare ID: `2301.12345`
- The full URL: `https://arxiv.org/abs/2301.12345`

The site will normalise both formats automatically, and handles older-style IDs
like `hep-ph/9901123` as well.

> **Tip:** if you accidentally enter an ID with a three-digit year prefix (e.g.
> `708.1137` instead of `0708.1137`), the site will detect and correct this
> automatically, and show a small blue note confirming the correction.

### Reading the abstract page

| Field           | What it means                                         |
| --------------- | ----------------------------------------------------- |
| **Submitted**   | Date the authors posted it                            |
| **Authors**     | Click a name to see all their arXiv papers            |
| **Subjects**    | Primary and cross-listed categories                   |
| **Abstract**    | Short summary written by the authors                  |
| **[pdf]**       | Direct link to the paper PDF                          |
| **[v2], [v3]…** | Revised versions; the site always links to the latest |

### arXiv ID status badges

The journal club site shows a coloured badge next to papers where the ID could
not be fully resolved:

| Badge colour | Meaning                                                         |
| ------------ | --------------------------------------------------------------- |
| Blue ℹ       | ID was auto-corrected (e.g. `708.1137` → `0708.1137`)           |
| Amber ⚠      | Valid arXiv ID, but the paper is not yet indexed on INSPIRE-HEP |
| Red ⚠        | ID could not be found on arXiv — double-check the submission    |

---

## INSPIRE-HEP

[INSPIRE-HEP](https://inspirehep.net) is the community database for high energy
physics literature. Unlike arXiv (which just hosts preprints), INSPIRE links
papers to their citations, experiments, authors, and institutions, and indexes
both preprints and published journal articles.

### What the site shows from INSPIRE

| Field                  | Source                                             |
| ---------------------- | -------------------------------------------------- |
| **Title**              | INSPIRE record (same as arXiv)                     |
| **Authors**            | INSPIRE — often more complete than arXiv           |
| **Abstract**           | INSPIRE record                                     |
| **Citation count**     | How many other papers have cited this one          |
| **iNSPIRE-HEP button** | Direct link to the full INSPIRE record             |
| **Cite BibTeX button** | Copies the INSPIRE BibTeX entry to your clipboard  |
| **Subfield tags**      | Broad HEP category (Pheno, Theory, Experiment, …)  |
| **Keywords**           | INSPIRE-curated and author-supplied topic keywords |

### The INSPIRE record page

The INSPIRE record for a paper contains much more than the site shows:

- Full author list with affiliations and ORCID links
- **BibTeX / LaTeX citation key** — useful for citing in your own work
- List of papers this paper cites, and papers that cite it
- Links to the DOI (journal version) and arXiv page
- Experiment and collaboration tags

To get a BibTeX entry manually: open the INSPIRE record → click **Cite** →
copy the BibTeX block. Or use the **Cite BibTeX** button on the journal club
site to copy it directly to your clipboard.

### Citation counts as a rough guide

For a new paper (< 1 year old), citation counts are inherently low — this does
_not_ mean the paper is unimportant. For older papers, a rough HEP scale:

| Citations | Rough impression          |
| --------- | ------------------------- |
| < 10      | Recent or niche           |
| 10 – 100  | Solid, community-relevant |
| 100 – 500 | Influential               |
| 500+      | Landmark paper            |

### Paper not showing on INSPIRE?

INSPIRE typically indexes new arXiv papers within **1–3 days** of posting.
If the site shows the amber warning _"Not yet indexed on iNSPIRE-HEP"_, the
paper was submitted very recently — the arXiv link still works and you can read
the PDF immediately. The INSPIRE record (and with it the title, authors, and
abstract on this site) will appear within a few days.
