/* ============================================================
   sheet.js — Client-side mutation wrapper for the Google Sheet
   ============================================================
   Sends vote / edit / remove actions to the Apps Script web app
   deployed from docs/appscript.gs.

   Requires CONFIG.mutateUrl to be set in config.js.
   All functions return the parsed JSON response from the script:
     { ok: true, ... }  — on success
     { ok: false, error: '...' }  — on a handled server error
   Network errors are rethrown so callers can handle them.
   ============================================================ */

import { CONFIG } from './config.js';

/**
 * POSTs a mutation to the Apps Script endpoint.
 * @param {object} body - Must include at least { action, arxivId }.
 */
async function _post(body) {
  if (!CONFIG.mutateUrl) throw new Error('mutateUrl is not configured in config.js');
  const r = await fetch(CONFIG.mutateUrl, {
    method: 'POST',
    // Apps Script doPost requires text/plain or no explicit Content-Type
    // for the payload to arrive in e.postData.contents.
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Apps Script returned HTTP ${r.status}`);
  return r.json();
}

/**
 * Increments the vote count for a paper by one.
 * @param {string} arxivId - Clean arXiv ID (no version suffix, no URL).
 * @returns {Promise<{ ok: boolean, votes?: number }>}
 */
export async function vote(arxivId) {
  return _post({ action: 'vote', arxivId });
}

/**
 * Marks a paper as removed (sets Removed = "TRUE" in the sheet).
 * @param {string} arxivId - Clean arXiv ID.
 * @returns {Promise<{ ok: boolean }>}
 */
export async function removeEntry(arxivId) {
  return _post({ action: 'remove', arxivId });
}

/**
 * Overwrites the comment for a paper (writes to EditedComment column).
 * @param {string} arxivId  - Clean arXiv ID.
 * @param {string} comment  - New comment text.
 * @returns {Promise<{ ok: boolean }>}
 */
export async function editComment(arxivId, comment) {
  return _post({ action: 'edit', arxivId, comment });
}
