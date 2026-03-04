/* ============================================================
   inspire.js — INSPIRE-HEP API metadata fetcher
   ============================================================
   Fetches paper title, authors, abstract, citation count,
   INSPIRE record ID, broad subfield categories, and topic
   keywords for a list of arXiv IDs.

   Uses the INSPIRE-HEP REST API (https://inspirehep.net/api),
   which supports browser CORS with no authentication required.

   Requests are batched (one query per ≤25 papers) and results
   are cached in localStorage with tiered TTLs per entry type
   so repeat visits and archive expansions are near-instant.
   ============================================================ */

import { normalizeArxivId, stripVersion, isValidArxivId } from './utils.js';

// ── Cache ────────────────────────────────────────────────────

const CACHE_KEY = 'inspire_meta_v5'; // bumped: switched to localStorage with per-entry tiered TTL
const TTL_RESOLVED_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — fully indexed papers rarely change
const TTL_NOT_FOUND_MS = 15 * 60 * 1000; //        15 min  — paper may appear on INSPIRE any time
const TTL_INVALID_MS = 24 * 60 * 60 * 1000; //    24 h    — invalid IDs are stable
const BATCH_SIZE = 25; // INSPIRE API page limit

/** Returns the appropriate TTL for a cached metadata value. */
function _ttlFor(data) {
  if (data.invalidId) return TTL_INVALID_MS;
  if (data.notFound) return TTL_NOT_FOUND_MS;
  return TTL_RESOLVED_MS;
}

function _loadCache() {
  try {
    // Remove stale cache from earlier key versions (one-time cleanup per browser)
    ['inspire_meta_v1', 'inspire_meta_v2', 'inspire_meta_v3', 'inspire_meta_v4'].forEach((old) =>
      localStorage.removeItem(old)
    );
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    // Prune expired entries so the cache doesn't grow indefinitely
    const now = Date.now();
    let pruned = false;
    Object.keys(raw).forEach((key) => {
      const entry = raw[key];
      if (entry && now - entry.ts >= (entry.ttl ?? TTL_NOT_FOUND_MS)) {
        delete raw[key];
        pruned = true;
      }
    });
    if (pruned) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
      } catch {}
    }
    return raw;
  } catch {
    return {};
  }
}
function _saveCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

// ── Category label map ───────────────────────────────────────
// Maps INSPIRE's inspire_categories.term to a short display label.

const CATEGORY_LABELS = {
  'Phenomenology-HEP': 'Pheno',
  'Theory-HEP': 'Theory',
  'Experiment-HEP': 'Experiment',
  Lattice: 'Lattice',
  Astrophysics: 'Astrophysics',
  'Gravitation and Cosmology': 'Gravity/Cosmo',
  'Nuclear Experiment': 'Nuclear Exp',
  'Nuclear Theory': 'Nuclear Th',
  Instrumentation: 'Instrumentation',
  Computing: 'Computing',
  'Math and Math Physics': 'Math-Phys',
  'General Physics': 'General',
  'High Energy Physics': 'HEP',
};

// ── Public API ───────────────────────────────────────────────

/**
 * Fetches INSPIRE metadata for each arXiv ID in `ids`.
 * Results are batched (≤25 per request) and cached in sessionStorage.
 *
 * @param {string[]} ids - Array of raw arXiv IDs or URLs.
 * @returns {Promise<Map>} Map of cleanId → metadata object
 *   { title, authors, abstract, citations, inspireId, categories, keywords }
 *   or cleanId → { notFound: true }  if valid on arXiv but not yet in INSPIRE
 *   or cleanId → { invalidId: true } if arXiv itself does not recognise the ID
 */
export async function fetchPaperMetadata(ids) {
  const meta = new Map();
  const cleanIds = [
    ...new Set(ids.map((id) => stripVersion(normalizeArxivId(id))).filter(Boolean)),
  ];
  if (cleanIds.length === 0) return meta;

  const cache = _loadCache();
  const now = Date.now();
  const toFetch = [];
  // Maps paddedId → originalId for IDs where we auto-prepend '0'
  const idRemap = new Map();

  cleanIds.forEach((id) => {
    const entry = cache[id];
    if (entry && now - entry.ts < (entry.ttl ?? TTL_NOT_FOUND_MS)) {
      // Serve from cache
      meta.set(id, entry.data);
    } else if (!isValidArxivId(id)) {
      // Format is wrong — try zero-padding a 3-digit prefix (e.g. 708.1137 → 0708.1137)
      const paddedId = /^\d{3}\./.test(id) ? '0' + id : null;
      if (paddedId && isValidArxivId(paddedId)) {
        idRemap.set(paddedId, id); // remember: paddedId is the fetchable form
        toFetch.push(paddedId);
      } else {
        const data = { invalidId: true };
        meta.set(id, data);
        cache[id] = { ts: now, data, ttl: _ttlFor(data) };
      }
    } else {
      toFetch.push(id);
    }
  });

  // IDs that INSPIRE doesn't know — will be validated against arXiv below
  const notFoundIds = [];

  // Batch remaining IDs into chunks of BATCH_SIZE
  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const chunk = toFetch.slice(i, i + BATCH_SIZE);
    const q = chunk.map((id) => `arxiv:${id}`).join(' or ');
    const url =
      'https://inspirehep.net/api/literature?' +
      `q=${encodeURIComponent(q)}` +
      '&fields=titles,authors,abstracts,citation_count' +
      ',arxiv_eprints,control_number,inspire_categories,keywords' +
      `&size=${BATCH_SIZE}`;

    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();

      const found = new Set();
      (data.hits?.hits ?? []).forEach((hit) => {
        const m = hit.metadata;
        const eprint = (m.arxiv_eprints ?? [])[0]?.value ?? '';
        const arxivId = stripVersion(eprint);
        if (!arxivId) return;
        found.add(arxivId);
        const parsed = _parseHit(m);
        meta.set(arxivId, parsed);
        cache[arxivId] = { ts: now, data: parsed, ttl: _ttlFor(parsed) };
      });

      // Collect anything INSPIRE missed for arXiv validation
      chunk.forEach((id) => {
        if (!found.has(id)) {
          notFoundIds.push(id);
          meta.set(id, { notFound: true }); // provisional — may be upgraded below
        }
      });
    } catch (e) {
      console.error('INSPIRE fetch error:', e);
      // Fail open: mark as notFound (not invalid) so we don't falsely flag papers
      chunk.forEach((id) => {
        if (!meta.has(id)) {
          notFoundIds.push(id);
          meta.set(id, { notFound: true });
        }
      });
    }
  }

  // ── arXiv validation ────────────────────────────────────────
  // For every ID INSPIRE missed, ask arXiv whether the ID even exists.
  // Papers arXiv doesn't recognise are flagged { invalidId: true } instead
  // of the generic { notFound: true } so the UI can show a clearer message.
  if (notFoundIds.length > 0) {
    const validOnArxiv = await _checkArxivIds(notFoundIds);
    notFoundIds.forEach((id) => {
      const data = validOnArxiv.has(id) ? { notFound: true } : { invalidId: true };
      meta.set(id, data);
      cache[id] = { ts: now, data, ttl: _ttlFor(data) };
    });
  }

  // ── Zero-padding remap ──────────────────────────────────────
  // For any ID queued under its padded form (e.g. 0708.1137 for input 708.1137),
  // find the right data and store it under the original key with correctedId.
  //
  // INSPIRE may have returned the hit under *either* the padded or original key:
  //   - Padded  (0708.1137): data is in meta.get(paddedId) — happy path
  //   - Original (708.1137): INSPIRE stored eprint without leading zero;
  //     data landed in meta.get(originalId) already, padded key got { notFound }
  idRemap.forEach((originalId, paddedId) => {
    const paddedData = meta.get(paddedId);
    const origData = meta.get(originalId);

    // A result is "real" if it has actual paper data (not just a status flag)
    const isReal = (d) => d && !d.notFound && !d.invalidId;

    const realData = isReal(paddedData) ? paddedData : isReal(origData) ? origData : paddedData; // fall back to padded (notFound or invalidId)

    if (realData && !realData.invalidId) {
      const remapped = { ...realData, correctedId: paddedId };
      meta.set(originalId, remapped);
      cache[originalId] = { ts: now, data: remapped, ttl: _ttlFor(remapped) };
    } else {
      const d = { invalidId: true };
      meta.set(originalId, d);
      cache[originalId] = { ts: now, data: d, ttl: _ttlFor(d) };
    }
    // Always clean up the temporary padded key
    meta.delete(paddedId);
  });

  _saveCache(cache);
  return meta;
}

/**
 * Checks a list of clean arXiv IDs against the arXiv Atom API.
 * Returns a Set of IDs that arXiv recognises (i.e. the paper exists).
 * Fails open: on any network / parse error the ID is treated as valid so
 * we never falsely flag a legitimate-but-temporarily-unreachable paper.
 *
 * @param {string[]} ids - Clean arXiv IDs (no version suffix, no URL).
 * @returns {Promise<Set<string>>}
 */
async function _checkArxivIds(ids) {
  const valid = new Set();
  if (ids.length === 0) return valid;

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const chunk = ids.slice(i, i + BATCH_SIZE);
    const url =
      'https://export.arxiv.org/api/query?' +
      `id_list=${chunk.join(',')}&max_results=${chunk.length}`;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        chunk.forEach((id) => valid.add(id)); // fail open
        continue;
      }
      const text = await r.text();
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      doc.querySelectorAll('entry').forEach((entry) => {
        // arXiv returns <title>Error</title> for unrecognised IDs
        const title = entry.querySelector('title')?.textContent?.trim();
        if (title && title !== 'Error') {
          // The <id> element contains a URL like http://arxiv.org/abs/2301.12345v1
          const idUrl = entry.querySelector('id')?.textContent ?? '';
          const clean = stripVersion(normalizeArxivId(idUrl));
          if (clean) valid.add(clean);
        }
      });
    } catch {
      chunk.forEach((id) => valid.add(id)); // fail open on network errors
    }
  }
  return valid;
}

// ── Helpers ───────────────────────────────────────────────────

/** Exported for unit testing. */
export function parseHit(m) {
  return _parseHit(m);
}

function _parseHit(m) {
  const title = m.titles?.[0]?.title?.trim() ?? '';
  const abstract = m.abstracts?.[0]?.value?.trim() ?? '';
  const allAuthors = m.authors ?? [];
  const authors =
    allAuthors
      .slice(0, 4)
      .map((a) => a.full_name)
      .join(', ') + (allAuthors.length > 4 ? ' et al.' : '');
  const citations = m.citation_count ?? null;
  const inspireId = m.control_number ?? null;

  // Broad subfield categories (e.g. "Pheno", "Theory", "Experiment")
  const categories = (m.inspire_categories ?? [])
    .map((c) => CATEGORY_LABELS[c.term] ?? c.term)
    .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

  // Specific topic keywords — prefer INSPIRE-curated, then author-supplied
  const keywords = (m.keywords ?? [])
    .filter((k) => ['INSPIRE', 'author'].includes(k.schema))
    .map((k) => k.value?.toLowerCase())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5);

  return { title, authors, abstract, citations, inspireId, categories, keywords };
}
