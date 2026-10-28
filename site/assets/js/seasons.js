/* ============================================================
   seasons.js — Seasonal decorations
   ============================================================
   Picks today's theme from CONFIG.seasons (a physics day's few
   days win over the season), marks the page with
   <html data-season="…">, tiles the theme's pixel strip along the
   bottom of the black header, and pins a few small sprites in the
   window's side margins on wide screens (fixed, so they never move
   over the content as the page loads or scrolls). Decoration only: hidden from
   screen readers, never clickable, still for reduced motion, and
   the data, charts and colour meanings stay as they are.

   ?season=<theme> on any page previews a theme; ?season=none
   shows none. Loaded on every page as its own module.
   ============================================================ */

import { CONFIG } from './config.js';
import { THEMES } from './themes.js';
import { spriteDataUrl, spriteSize } from './pixelart.js';

const DAY_MS = 86400000;

/** 'MM-DD' → [month (1–12), day]. */
const monthDay = (md) => md.split('-').map(Number);

/** True when `date` falls in a 'MM-DD'…'MM-DD' range, which may wrap past New Year. */
function inRange(date, from, to) {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  const [fm, fd] = monthDay(from);
  const [tm, td] = monthDay(to);
  const a = fm * 100 + fd;
  const b = tm * 100 + td;
  return a <= b ? md >= a && md <= b : md >= a || md <= b;
}

/** Days from `date` to the nearest occurrence of 'MM-DD', in either direction. */
function daysFrom(date, md) {
  const [m, d] = monthDay(md);
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const y = date.getFullYear();
  return Math.min(
    ...[y - 1, y, y + 1].map((year) =>
      Math.abs(Math.round((new Date(year, m - 1, d) - today) / DAY_MS))
    )
  );
}

/**
 * The theme for a date: a physics day's theme within `dayWindow` days of
 * it, else the season's, else null.
 * @param {Date} date - In the visitor's local time.
 * @param {object} [seasons] - CONFIG.seasons.
 * @returns {string|null}
 */
export function themeFor(date, seasons = CONFIG.seasons) {
  if (!seasons?.enabled) return null;
  const day = (seasons.days ?? []).find((d) => daysFrom(date, d.date) <= seasons.dayWindow);
  if (day) return day.theme;
  return (seasons.base ?? []).find((s) => inRange(date, s.from, s.to))?.theme ?? null;
}

/**
 * The theme asked for with ?season= in a URL's query string: a known theme,
 * 'none', or null when the query doesn't ask (or asks for an unknown theme).
 * @param {string} search - location.search.
 */
export function previewTheme(search) {
  const asked = new URLSearchParams(search).get('season');
  if (asked === 'none') return 'none';
  return asked && Object.hasOwn(THEMES, asked) ? asked : null;
}

// ── Decorating the page ───────────────────────────────────────

const STRIP_SCALE = 3;
const SPRITE_SCALE = 3;
const CONTENT_WIDTH = 860; // --max-width in style.css
const GUTTER_MIN = 90; // margin sprites only where the side margin is this wide

function _decorate(name) {
  const theme = THEMES[name];
  if (!theme) return;
  document.documentElement.dataset.season = name;

  const header = document.querySelector('header');
  if (header && theme.strip) {
    const { width, height } = spriteSize(theme.strip);
    const strip = document.createElement('div');
    strip.className = 'season-strip';
    strip.setAttribute('aria-hidden', 'true');
    strip.style.backgroundImage = `url("${spriteDataUrl(theme.strip, STRIP_SCALE)}")`;
    strip.style.backgroundSize = `${width * STRIP_SCALE}px ${height * STRIP_SCALE}px`;
    strip.style.height = `${height * STRIP_SCALE}px`;
    header.appendChild(strip);
  }

  const gutter = (document.documentElement.clientWidth - CONTENT_WIDTH) / 2;
  if (gutter < GUTTER_MIN || !theme.sprites?.length) return;
  // Spread down the window, from below the header to near the bottom (vh)
  const top = 30;
  const bottom = 90;
  const band = (bottom - top) / theme.count;
  // Each sprite once (shuffled) before any repeats
  const picks = [];
  while (picks.length < theme.count) {
    picks.push(...[...theme.sprites].sort(() => Math.random() - 0.5));
  }
  for (let i = 0; i < theme.count; i++) {
    const sprite = picks[i];
    const { width } = spriteSize(sprite);
    const img = document.createElement('img');
    img.className = `season-sprite season-sprite--${theme.motion}`;
    img.src = spriteDataUrl(sprite, SPRITE_SCALE);
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    // Alternate sides, one per band so they don't bunch up
    img.style.top = `${(top + band * i + Math.random() * band * 0.6).toFixed(1)}vh`;
    const inset = 16 + Math.random() * Math.max(0, gutter - width * SPRITE_SCALE - 48);
    img.style[i % 2 ? 'right' : 'left'] = `${Math.round(inset)}px`;
    img.style.animationDelay = `${(-Math.random() * 6).toFixed(1)}s`;
    document.body.appendChild(img);
  }
}

if (typeof window !== 'undefined') {
  const preview = previewTheme(window.location.search);
  const name = preview ?? themeFor(new Date());
  if (name && name !== 'none') _decorate(name);
}
