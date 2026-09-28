/* ============================================================
   preview.js — Page chrome for the GitHub issues preview
   ============================================================
   When a page is opened with ?source=issues (see config.js),
   keeps that flag on every navigation link and shows a banner
   saying where the papers come from. Does nothing otherwise.
   ============================================================ */

import { CONFIG } from './config.js';

if (CONFIG.issuesPreview) {
  // Only the site's own pages (./page.html), not the submit link that shares the nav.
  document.querySelectorAll('nav a[href^="./"]').forEach((a) => {
    const url = new URL(a.getAttribute('href'), location.href);
    url.searchParams.set('source', 'issues');
    a.href = url.href;
  });

  const banner = document.createElement('p');
  banner.className = 'preview-banner';
  const issues = document.createElement('a');
  issues.href = `https://github.com/${CONFIG.issuesRepo}/issues?q=label%3Apaper`;
  issues.textContent = 'GitHub issues';
  const live = document.createElement('a');
  live.href = location.pathname;
  live.textContent = 'Back to the live site';
  banner.append('Preview: papers come from ', issues, ', not the Google Sheet. ', live);
  document.querySelector('header')?.after(banner);
}
