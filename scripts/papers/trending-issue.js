/* ============================================================
   scripts/papers/trending-issue.js — Open this week's Trending issue
   ============================================================
   Run by .github/workflows/trending.yml (Monday and Wednesday
   mornings). Fetches the trending papers from INSPIRE-HEP, opens
   an issue labelled "Trending", "paper" and "Updated By Bot",
   and closes the previous Trending issue. The site reads the
   newest Trending issue (build-csv.js). If INSPIRE returns
   nothing at all, the previous issue stays open and the run fails.

   Environment: GITHUB_TOKEN, GITHUB_REPOSITORY.
   ============================================================ */

import { LABELS, github } from './lib.js';
import { fetchTrending, renderTrendingIssue, trendingIssueTitle } from './trending.js';

const api = github(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY);
const now = new Date();

const trending = await fetchTrending({ now });
if (!trending.some((list) => list?.length)) {
  console.error('INSPIRE returned no trending papers; keeping the previous Trending issue.');
  process.exit(1);
}

const previous = await api.paginate(
  `/issues?labels=${encodeURIComponent(LABELS.trending)}&state=open`
);
const issue = await api.request('POST', '/issues', {
  title: trendingIssueTitle(now),
  body: renderTrendingIssue(trending, now),
  labels: [LABELS.trending, LABELS.paper, LABELS.updatedByBot],
});
console.log(`Opened #${issue.number}: ${issue.title}`);

for (const old of previous) {
  if (old.pull_request) continue;
  await api.request('PATCH', `/issues/${old.number}`, {
    state: 'closed',
    state_reason: 'completed',
  });
  console.log(`Closed #${old.number} (replaced by #${issue.number})`);
}
