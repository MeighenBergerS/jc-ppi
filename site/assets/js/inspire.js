/* ============================================================
   inspire.js — INSPIRE-HEP API metadata fetcher
   ============================================================
   Fetches paper title, authors, abstract, citation count, and
   INSPIRE record ID for a list of arXiv IDs.

   Uses the INSPIRE-HEP REST API (https://inspirehep.net/api),
   which supports browser CORS with no authentication required.
   ============================================================ */

import { normalizeArxivId, stripVersion } from "./utils.js";

/**
 * Fetches INSPIRE metadata for each arXiv ID in `ids`.
 * Fires requests in parallel (one per paper — fine for typical JC sizes).
 *
 * @param {string[]} ids - Array of raw arXiv IDs or URLs.
 * @returns {Promise<Map>} Map of cleanId → { title, authors, abstract, citations, inspireId }
 *                         or cleanId → { notFound: true } if not yet indexed.
 */
export async function fetchPaperMetadata(ids) {
  const meta     = new Map();
  const cleanIds = ids.map(id => stripVersion(normalizeArxivId(id))).filter(Boolean);
  if (cleanIds.length === 0) return meta;

  const requests = cleanIds.map(id =>
    fetch(`https://inspirehep.net/api/arxiv/${id}?fields=titles,authors,abstracts,citation_count`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null)
  );

  const results = await Promise.all(requests);

  results.forEach((data, i) => {
    const id = cleanIds[i];
    if (!data?.metadata) return;   // null → not found; handled below
    const m = data.metadata;

    const title    = m.titles?.[0]?.title?.trim()    ?? "";
    const abstract = m.abstracts?.[0]?.value?.trim() ?? "";
    const allAuthors = m.authors ?? [];
    const authors  = allAuthors
      .slice(0, 4)
      .map(a => a.full_name)
      .join(", ") + (allAuthors.length > 4 ? " et al." : "");
    const citations = m.citation_count ?? null;
    const inspireId = m.control_number ?? null;   // numeric record ID → /literature/{id}

    meta.set(id, { title, authors, abstract, citations, inspireId });
  });

  // Flag any IDs the API didn't return (paper too new to be indexed)
  cleanIds.forEach(id => {
    if (!meta.has(id)) meta.set(id, { notFound: true });
  });

  return meta;
}
