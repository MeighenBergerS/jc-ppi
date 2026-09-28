/* ============================================================
   topics.js — Which club topics a paper is about
   ============================================================
   Matches a paper's INSPIRE title, keywords and abstract against
   CONFIG.topics. A match in the title or keywords counts 2, each
   mention in the abstract 1 (up to 2); a topic needs 2 points.
   Pure, so it runs in Node and in the browser.
   ============================================================ */

import { CONFIG } from './config.js';
import { plainText } from './mathtext.js';

/** At most this many topics per paper. */
export const MAX_TOPICS = 3;

const count = (re, text) => (text ? (text.match(new RegExp(re.source, 'gi')) ?? []).length : 0);

/**
 * The topics a paper is about, best match first.
 * @param {{title?: string, abstract?: string, keywords?: string[]}} meta - INSPIRE metadata.
 * @param {{label: string, match: RegExp}[]} [topics]
 * @returns {string[]} Topic labels, at most MAX_TOPICS.
 */
export function paperTopics(meta, topics = CONFIG.topics) {
  const head = `${plainText(meta?.title ?? '')} ${(meta?.keywords ?? []).join(' ; ')}`;
  const abstract = plainText(meta?.abstract ?? '');
  return topics
    .map((t, order) => ({
      label: t.label,
      order,
      score: (count(t.match, head) ? 2 : 0) + Math.min(2, count(t.match, abstract)),
    }))
    .filter((t) => t.score >= 2)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, MAX_TOPICS)
    .map((t) => t.label);
}
