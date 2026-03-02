/* ============================================================
   inspire.js — INSPIRE-HEP API metadata fetcher
   ============================================================
   Fetches paper title, authors, abstract, citation count,
   INSPIRE record ID, broad subfield categories, and topic
   keywords for a list of arXiv IDs.

   Uses the INSPIRE-HEP REST API (https://inspirehep.net/api),
   which supports browser CORS with no authentication required.

   Requests are batched (one query per ≤25 papers) and results
   are cached in sessionStorage for CACHE_TTL_MS milliseconds
   so repeat visits and archive expansions are near-instant.
   ============================================================ */

import { normalizeArxivId, stripVersion } from "./utils.js";

// ── Cache ────────────────────────────────────────────────────

const CACHE_KEY   = "inspire_meta_v2";
const CACHE_TTL_MS = 15 * 60 * 1000;   // 15 minutes
const BATCH_SIZE  = 25;                 // INSPIRE API page limit

function _loadCache() {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}"); }
  catch { return {}; }
}
function _saveCache(cache) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
}

// ── Category label map ───────────────────────────────────────
// Maps INSPIRE's inspire_categories.term to a short display label.

const CATEGORY_LABELS = {
  "Phenomenology-HEP":       "Pheno",
  "Theory-HEP":              "Theory",
  "Experiment-HEP":          "Experiment",
  "Lattice":                 "Lattice",
  "Astrophysics":            "Astrophysics",
  "Gravitation and Cosmology": "Gravity/Cosmo",
  "Nuclear Experiment":      "Nuclear Exp",
  "Nuclear Theory":          "Nuclear Th",
  "Instrumentation":         "Instrumentation",
  "Computing":               "Computing",
  "Math and Math Physics":   "Math-Phys",
  "General Physics":         "General",
  "High Energy Physics":     "HEP",
};

// ── Public API ───────────────────────────────────────────────

/**
 * Fetches INSPIRE metadata for each arXiv ID in `ids`.
 * Results are batched (≤25 per request) and cached in sessionStorage.
 *
 * @param {string[]} ids - Array of raw arXiv IDs or URLs.
 * @returns {Promise<Map>} Map of cleanId → metadata object
 *   { title, authors, abstract, citations, inspireId, categories, keywords }
 *   or cleanId → { notFound: true } if not yet indexed.
 */
export async function fetchPaperMetadata(ids) {
  const meta     = new Map();
  const cleanIds = [...new Set(
    ids.map(id => stripVersion(normalizeArxivId(id))).filter(Boolean)
  )];
  if (cleanIds.length === 0) return meta;

  const cache   = _loadCache();
  const now     = Date.now();
  const toFetch = [];

  cleanIds.forEach(id => {
    const entry = cache[id];
    if (entry && (now - entry.ts) < CACHE_TTL_MS) {
      meta.set(id, entry.data);
    } else {
      toFetch.push(id);
    }
  });

  // Batch remaining IDs into chunks of BATCH_SIZE
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const chunk = toFetch.slice(i, i + BATCH_SIZE);
    const q     = chunk.map(id => `arxiv:${id}`).join(" or ");
    const url   = "https://inspirehep.net/api/literature?"
      + `q=${encodeURIComponent(q)}`
      + "&fields=titles,authors,abstracts,citation_count"
      + ",arxiv_eprints,control_number,inspire_categories,keywords"
      + `&size=${BATCH_SIZE}`;

    try {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      const found = new Set();
      (data.hits?.hits ?? []).forEach(hit => {
        const m      = hit.metadata;
        const eprint = (m.arxiv_eprints ?? [])[0]?.value ?? "";
        const arxivId = stripVersion(eprint);
        if (!arxivId) return;
        found.add(arxivId);
        const parsed = _parseHit(m);
        meta.set(arxivId, parsed);
        cache[arxivId] = { ts: now, data: parsed };
      });

      // Flag anything the API didn't return (too new to be indexed)
      chunk.forEach(id => {
        if (!found.has(id)) {
          const notFound = { notFound: true };
          meta.set(id, notFound);
          cache[id] = { ts: now, data: notFound };
        }
      });
    } catch (e) {
      console.error("INSPIRE fetch error:", e);
      chunk.forEach(id => { if (!meta.has(id)) meta.set(id, { notFound: true }); });
    }
  }

  _saveCache(cache);
  return meta;
}

// ── Helpers ───────────────────────────────────────────────────

function _parseHit(m) {
  const title      = m.titles?.[0]?.title?.trim() ?? "";
  const abstract   = m.abstracts?.[0]?.value?.trim() ?? "";
  const allAuthors = m.authors ?? [];
  const authors    = allAuthors.slice(0, 4).map(a => a.full_name).join(", ")
    + (allAuthors.length > 4 ? " et al." : "");
  const citations = m.citation_count ?? null;
  const inspireId = m.control_number ?? null;

  // Broad subfield categories (e.g. "Pheno", "Theory", "Experiment")
  const categories = (m.inspire_categories ?? [])
    .map(c => CATEGORY_LABELS[c.term] ?? c.term)
    .filter((v, i, a) => a.indexOf(v) === i);   // deduplicate

  // Specific topic keywords — prefer INSPIRE-curated, then author-supplied
  const keywords = (m.keywords ?? [])
    .filter(k => ["INSPIRE", "author"].includes(k.schema))
    .map(k => k.value?.toLowerCase())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5);

  return { title, authors, abstract, citations, inspireId, categories, keywords };
}
