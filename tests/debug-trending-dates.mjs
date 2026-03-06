/**
 * Debug script for refreshTrendingPapers date filtering.
 *
 * Replicates the INSPIRE query from appscript.gs and prints per-paper
 * date metadata so we can see:
 *   1. Which dates INSPIRE returns for each paper
 *   2. Whether `date > YYYY-MM-DD` matches preprint date or publication date
 *   3. Why old papers (e.g. 2101.00308, 2207.09632) are passing the filter
 *
 * Usage:
 *   node tests/debug-trending-dates.mjs [lookbackWeeks]
 *
 *   lookbackWeeks defaults to 4 (same as INSPIRE_LOOKBACK_WEEKS in appscript.gs)
 */

const INSPIRE_LOOKBACK_WEEKS     = parseInt(process.argv[2] ?? '4', 10);
const INSPIRE_RESULTS_PER_CATEGORY = 5; // fetch a few extra for inspection

// Mirror of INSPIRE_CATEGORIES in appscript.gs
const INSPIRE_CATEGORIES = [
  { label: 'Overall hep-ph', extra: '' },
  { label: 'Neutrinos',      extra: 'neutrino' },
  { label: 'Dark Matter',    extra: '"dark matter"' },
];

// Request date metadata fields in addition to the usual fields
const DATE_FIELDS = [
  'arxiv_eprints',
  'preprint_date',     // arXiv submission date (YYYY-MM-DD)
  'earliest_date',     // earliest of all known dates
  'publication_info',  // journal publication info including year
  'imprints',          // another source of publication dates
  'titles',
  'citation_count',
  'citation_count_without_self_citations',
].join(',');

const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - INSPIRE_LOOKBACK_WEEKS * 7);
const dateStr = cutoff.toISOString().slice(0, 10); // YYYY-MM-DD

console.log(`Current date    : ${new Date().toISOString().slice(0, 10)}`);
console.log(`Lookback weeks  : ${INSPIRE_LOOKBACK_WEEKS}`);
console.log(`Cutoff date     : ${dateStr}`);
console.log('─'.repeat(80));

for (const cat of INSPIRE_CATEGORIES) {
  const query = `arxiv_eprints.categories:hep-ph and de > ${dateStr}${cat.extra ? ' and ' + cat.extra : ''}`;  // fixed: was `date >`, which also matched journal pub dates; `de` = INSPIRE date-earliest (arXiv submission date)

  const url = 'https://inspirehep.net/api/literature'
    + '?sort=mostcited'
    + `&size=${INSPIRE_RESULTS_PER_CATEGORY}`
    + `&fields=${DATE_FIELDS}`
    + '&q=' + encodeURIComponent(query);

  console.log(`\nCategory: ${cat.label}`);
  console.log(`Query   : ${query}`);
  console.log(`URL     : ${url}`);

  let json;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  HTTP ${res.status}: ${await res.text()}`);
      continue;
    }
    json = await res.json();
  } catch (err) {
    console.error(`  Fetch error: ${err.message}`);
    continue;
  }

  const total = json.hits?.total ?? 'unknown';
  console.log(`Total hits: ${total}`);

  const hits = json.hits?.hits ?? [];
  if (hits.length === 0) {
    console.log('  (no results)');
    continue;
  }

  for (const [i, hit] of hits.entries()) {
    const meta = hit.metadata;

    // arXiv ID (submitted date is encoded in the ID itself)
    const arxivId = meta.arxiv_eprints?.[0]?.value ?? '(none)';

    // Date fields that INSPIRE stores
    const preprintDate  = meta.preprint_date  ?? '(missing)';
    const earliestDate  = meta.earliest_date  ?? '(missing)';

    // Journal publication info
    const pubInfos = (meta.publication_info ?? []).map(p =>
      [p.journal_title, p.year, p.pubinfo_freetext].filter(Boolean).join(' ')
    );
    const pubInfoStr = pubInfos.length ? pubInfos.join('; ') : '(none)';

    // Imprints (another publication-date source)
    const imprintDates = (meta.imprints ?? []).map(im => im.date ?? '').filter(Boolean);
    const imprintStr   = imprintDates.length ? imprintDates.join(', ') : '(none)';

    const citations    = meta.citation_count ?? 0;
    const title        = meta.titles?.[0]?.title ?? '(no title)';

    // Derive arXiv submission month from the ID (YYMM.XXXXX format)
    const arxivSubmitMonth = /^(\d{4})\./.test(arxivId)
      ? `20${arxivId.slice(0, 2)}-${arxivId.slice(2, 4)}`
      : '(old format or none)';

    console.log(`\n  [${i + 1}] ${arxivId}`);
    console.log(`       Title          : ${title.slice(0, 72)}`);
    console.log(`       arXiv month    : ${arxivSubmitMonth}   (from ID)`);
    console.log(`       preprint_date  : ${preprintDate}`);
    console.log(`       earliest_date  : ${earliestDate}`);
    console.log(`       publication_info: ${pubInfoStr}`);
    console.log(`       imprints.date  : ${imprintStr}`);
    console.log(`       citations      : ${citations}`);

    // Flag papers whose preprint_date predates the cutoff (should not happen with de > query)
    if (preprintDate !== '(missing)') {
      if (new Date(preprintDate) < cutoff) {
        console.log(`       *** PREPRINT DATE ${preprintDate} IS OLDER THAN CUTOFF (${dateStr}) — unexpected, check query ***`);
      }
    }
  }

  // Polite delay between categories
  await new Promise(r => setTimeout(r, 1200));
}

console.log('\n' + '─'.repeat(80));
console.log('Done.');
