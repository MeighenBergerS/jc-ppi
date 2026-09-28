/* ============================================================
   scripts/papers/enrich.js — The paper bot
   ============================================================
   Run by .github/workflows/papers.yml.

   On a new or edited paper issue: approves it (or labels it
   "needs approval"), looks the paper up on INSPIRE-HEP (or on
   arXiv if INSPIRE doesn't have it yet), posts or updates one
   metadata comment, renames the issue to "<ID>: <title>", and
   sets the "awaiting INSPIRE" / "invalid arXiv ID" labels. It
   labels every issue it fills in "Updated By Bot". If the same
   paper was suggested before, it lists the earlier issues in a
   second comment and adds "Submitted Before".

   On the schedule (or a manual run): does the same for every
   open paper issue and every issue still awaiting INSPIRE, then
   closes open paper issues from earlier weeks as completed.
   SCOPE=all refreshes closed issues too.

   Environment: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_EVENT_NAME,
   GITHUB_EVENT_PATH (set by Actions), SCOPE (open | all).
   ============================================================ */

import { readFileSync } from 'node:fs';
import {
  LABELS,
  FIELDS,
  METADATA_MARKER,
  SUBMITTED_BEFORE_MARKER,
  parseIssueForm,
  cleanArxivId,
  weekStartDay,
  submittedAt,
  fetchProfileNames,
  earlierSubmissions,
  renderSubmittedBeforeComment,
  fetchInspire,
  fetchBibtex,
  fetchArxiv,
  renderMetadataComment,
  comparableComment,
  paperIssueTitle,
  github,
  sleep,
} from './lib.js';

const APPROVED_ASSOCIATIONS = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

const api = github(process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY);
const today = new Date().toISOString().slice(0, 10);
const labelNames = (issue) => new Set(issue.labels.map((l) => l.name));

function readMembers() {
  const path = new URL('../../.github/paper-members.txt', import.meta.url);
  return new Set(
    readFileSync(path, 'utf8')
      .split('\n')
      .map((l) => l.replace(/#.*/, '').trim().toLowerCase())
      .filter(Boolean)
  );
}

/** Adds or removes a label, keeping `issue.labels` in step. */
async function setLabel(issue, name, on) {
  const has = labelNames(issue).has(name);
  if (on && !has) {
    await api.request('POST', `/issues/${issue.number}/labels`, { labels: [name] });
    issue.labels.push({ name });
  } else if (!on && has) {
    await api.request('DELETE', `/issues/${issue.number}/labels/${encodeURIComponent(name)}`);
    issue.labels = issue.labels.filter((l) => l.name !== name);
  }
}

/**
 * Keeps one bot comment per marker: creates, updates or (body null) deletes it.
 * `comments` is the issue's comment list, read once per issue.
 */
async function syncComment(issue, comments, marker, body) {
  const mine = comments.find((c) => c.body?.startsWith(marker));
  if (body === null) {
    if (mine) await api.request('DELETE', `/issues/comments/${mine.id}`);
  } else if (!mine) {
    await api.request('POST', `/issues/${issue.number}/comments`, { body });
  } else if (comparableComment(mine.body) !== comparableComment(body)) {
    await api.request('PATCH', `/issues/comments/${mine.id}`, { body });
  }
}

/**
 * Looks up and writes metadata for `issues`. `allIssues` (every paper issue)
 * is used to find earlier submissions of the same paper.
 */
async function enrich(issues, allIssues, { pause = 0 } = {}) {
  const names = await fetchProfileNames(api, allIssues);
  const items = issues.map((issue) => {
    const raw = parseIssueForm(issue.body)[FIELDS.arxiv] ?? '';
    return { issue, raw, id: cleanArxivId(raw) };
  });

  let inspire;
  try {
    inspire = await fetchInspire([...new Set(items.map((i) => i.id).filter(Boolean))]);
  } catch (err) {
    console.error(`INSPIRE unavailable, leaving issues unchanged: ${err.message}`);
    return;
  }

  for (const { issue, raw, id } of items) {
    let source;
    let meta = {};
    let bibtex = '';
    if (id && inspire.has(id)) {
      source = 'inspire';
      meta = inspire.get(id);
      if (meta.inspireId) bibtex = await fetchBibtex(meta.inspireId);
    } else if (id) {
      const arxiv = await fetchArxiv(id);
      if (!arxiv) {
        console.error(`#${issue.number}: arXiv unavailable, skipped`);
        continue;
      }
      source = arxiv.invalid ? 'invalid' : 'arxiv';
      if (!arxiv.invalid) meta = arxiv;
    } else {
      source = 'invalid';
    }

    const comments = await api.paginate(`/issues/${issue.number}/comments`);
    await syncComment(
      issue,
      comments,
      METADATA_MARKER,
      renderMetadataComment({ source, id: id ?? '', raw, meta, bibtex, date: today })
    );
    await setLabel(issue, LABELS.awaiting, source === 'arxiv');
    await setLabel(issue, LABELS.invalidId, source === 'invalid');
    await setLabel(issue, LABELS.updatedByBot, true);

    const earlier = earlierSubmissions(issue, allIssues, names);
    await syncComment(
      issue,
      comments,
      SUBMITTED_BEFORE_MARKER,
      earlier.length ? renderSubmittedBeforeComment(earlier) : null
    );
    await setLabel(issue, LABELS.submittedBefore, earlier.length > 0);
    if (meta.title) {
      const title = paperIssueTitle(id, meta.title);
      if (issue.title !== title) {
        await api.request('PATCH', `/issues/${issue.number}`, { title });
      }
    }
    const before = earlier.length
      ? `, submitted before (${earlier.map((e) => '#' + e.number)})`
      : '';
    console.log(`#${issue.number}: ${id ?? raw} → ${source}${before}`);
    if (pause) await sleep(pause);
  }
}

async function handleIssueEvent(event) {
  const { action, issue } = event;
  if (!labelNames(issue).has(LABELS.paper)) return;
  if (action === 'edited' && !event.changes?.body) return; // title-only edit

  if (action === 'opened' && !labelNames(issue).has(LABELS.imported)) {
    const login = issue.user.login;
    const approved =
      APPROVED_ASSOCIATIONS.has(issue.author_association) || readMembers().has(login.toLowerCase());
    if (!approved) {
      await setLabel(issue, LABELS.needsApproval, true);
      await api.request('POST', `/issues/${issue.number}/comments`, {
        body:
          `Thanks for the suggestion, @${login}! A maintainer will approve it shortly; ` +
          `until then it doesn't show on the website.`,
      });
    }
  }
  const all = await allPaperIssues();
  await enrich([all.find((i) => i.number === issue.number) ?? issue], all);
}

async function allPaperIssues() {
  return (await api.paginate(`/issues?labels=${LABELS.paper}&state=all`)).filter(
    (i) => !i.pull_request
  );
}

async function sweep(scope) {
  const all = await allPaperIssues();
  const targets = all.filter(
    (i) => scope === 'all' || i.state === 'open' || labelNames(i).has(LABELS.awaiting)
  );
  console.log(`Refreshing ${targets.length} of ${all.length} paper issues`);
  await enrich(targets, all, { pause: 1000 });

  // Close last week's papers so the open list is this week's.
  const thisWeek = weekStartDay(new Date());
  for (const issue of all) {
    if (issue.state !== 'open') continue;
    if (weekStartDay(submittedAt(issue)) < thisWeek) {
      await api.request('PATCH', `/issues/${issue.number}`, {
        state: 'closed',
        state_reason: 'completed',
      });
      console.log(`#${issue.number}: closed (earlier week)`);
      await sleep(1000);
    }
  }
}

if (process.env.GITHUB_EVENT_NAME === 'issues') {
  await handleIssueEvent(JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')));
} else {
  await sweep(process.env.SCOPE === 'all' ? 'all' : 'open');
}
