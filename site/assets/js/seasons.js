/* ============================================================
   seasons.js — Seasonal decorations
   ============================================================
   Picks today's theme from CONFIG.seasons (a physics day's few
   days win over the season), marks the page with
   <html data-season="…">, and adds the theme's art (themes.js):
   a pixel strip along the bottom of the black header, a scene in
   the header behind the text (corner pieces; sprites falling,
   floating or twinkling), and sprites in the window's side
   margins on wide screens (fixed, so they never cover content). Decoration only: hidden from
   screen readers, never clickable, still for reduced motion, and
   the data, charts and colour meanings stay as they are.

   ?season=<theme> on any page previews a theme; ?season=none
   shows none. Loaded on every page as its own module.
   ============================================================ */

import { CONFIG } from './config.js';
import { THEMES } from './themes.js';
import { spriteDataUrl, spriteSize, mirrorSprite } from './pixelart.js';

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
 * The theme for a date: a physics day's theme within its `window` (or
 * `dayWindow`) days of it, else the season's, else null.
 * @param {Date} date - In the visitor's local time.
 * @param {object} [seasons] - CONFIG.seasons.
 * @returns {string|null}
 */
export function themeFor(date, seasons = CONFIG.seasons) {
  if (!seasons?.enabled) return null;
  const day = (seasons.days ?? []).find(
    (d) => daysFrom(date, d.date) <= (d.window ?? seasons.dayWindow)
  );
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

const CONTENT_WIDTH = 860; // --max-width in style.css
const GUTTER_MIN = 90; // margin sprites only where the side margin is this wide

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * `n` sprites for a scene, each one once (shuffled) before any repeats.
 * One-of-a-kind sprites (`once`, or 'still' ones, like a building) appear
 * at most once; their repeats become other sprites.
 */
function _picks(sprites, n, motion) {
  const single = (s) => s.once || (s.motion ?? motion) === 'still';
  const others = sprites.filter((s) => !single(s));
  const seen = new Set();
  const out = [];
  while (out.length < n) out.push(...[...sprites].sort(() => Math.random() - 0.5));
  return out.slice(0, n).map((s) => {
    if (!single(s)) return s;
    if (seen.has(s) && others.length) return pick(others);
    seen.add(s);
    return s;
  });
}

/**
 * An <img> of a sprite, hidden from screen readers. A sprite with a
 * `label` shows it as a tooltip on hover.
 */
function _img(sprite, scale, className) {
  const img = document.createElement('img');
  img.className = className;
  img.src = spriteDataUrl(sprite, scale);
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  if (sprite.label) {
    img.title = sprite.label;
    img.classList.add('season-labelled');
  }
  return img;
}

const MOVES_DOWN = new Set(['fall', 'zip']);

/**
 * Sets a sprite moving: falling or zipping down (on a loop, `seconds` per
 * pass), floating or twinkling; 'still' sprites stay put.
 */
function _animate(img, motion, seconds) {
  if (motion === 'still') return;
  img.classList.add(`season--${motion}`);
  const duration = MOVES_DOWN.has(motion) ? rand(...seconds) : rand(4, 7);
  img.style.setProperty('--season-duration', `${duration.toFixed(1)}s`);
  img.style.animationDelay = `${(-rand(0, duration)).toFixed(1)}s`;
}

/**
 * The header's clear space beside its text, as [from, to] in px from the
 * header's left edge, so the scene never sits behind the title. Empty when
 * neither side has room (phones).
 */
function _clearZones(header) {
  const box = header.getBoundingClientRect();
  const text = header.querySelector('.header-text')?.getBoundingClientRect();
  if (!text) return [[0, box.width - 32]];
  const zones = [];
  const leftEnd = text.left - box.left - 28;
  const rightStart = text.right - box.left + 16;
  if (leftEnd > 40) zones.push([0, leftEnd]);
  if (box.width - 32 - rightStart > 40) zones.push([rightStart, box.width - 32]);
  return zones;
}

/**
 * A random x in the zones for something `width` px wide, so all of it stays
 * inside (the wider zones more likely), or null when it fits in none.
 */
function _inZones(zones, width) {
  const fits = zones.map(([a, b]) => [a, b - width]).filter(([a, b]) => b > a);
  const total = fits.reduce((sum, [a, b]) => sum + (b - a), 0);
  let x = Math.random() * total;
  for (const [a, b] of fits) {
    if (x <= b - a) return a + x;
    x -= b - a;
  }
  return null;
}

function _decorate(name) {
  const theme = THEMES[name];
  if (!theme) return;
  document.documentElement.dataset.season = name;
  const header = document.querySelector('header');

  // A theme can swap the tagline for the day
  if (theme.tagline) {
    document.querySelectorAll('.tagline').forEach((el) => (el.textContent = theme.tagline));
  }

  // The pixel strip along the bottom of the black header
  if (header && theme.strip) {
    const scale = theme.stripScale ?? 3;
    const { width, height } = spriteSize(theme.strip);
    const strip = document.createElement('div');
    strip.className = 'season-strip';
    strip.setAttribute('aria-hidden', 'true');
    strip.style.backgroundImage = `url("${spriteDataUrl(theme.strip, scale)}")`;
    strip.style.backgroundSize = `${width * scale}px ${height * scale}px`;
    strip.style.height = `${height * scale}px`;
    header.appendChild(strip);
  }

  // A scene inside the header, behind the text: corner pieces, and sprites
  // falling, floating or twinkling. Fewer on narrow screens.
  if (header && (theme.banner || theme.corners)) {
    const scene = document.createElement('div');
    scene.className = 'season-scene';
    scene.setAttribute('aria-hidden', 'true');
    if (theme.corners) {
      const { sprite, scale } = theme.corners;
      scene.appendChild(_img(sprite, scale, 'season-corner season-corner--left'));
      scene.appendChild(_img(mirrorSprite(sprite), scale, 'season-corner season-corner--right'));
    }
    if (theme.banner) {
      const { sprites, count, motion, scales } = theme.banner;
      const n = Math.max(3, Math.round(count * Math.min(1, header.clientWidth / 1200)));
      const zones = _clearZones(header);
      for (const sprite of _picks(sprites, n, motion)) {
        const scale = pick(scales);
        const img = _img(sprite, scale, 'season-banner');
        const x = _inZones(zones, spriteSize(sprite).width * scale);
        if (x !== null) {
          img.style.left = `${Math.round(x)}px`;
        } else {
          img.style.left = `${rand(1, 95).toFixed(1)}%`;
          img.classList.add('season-banner--faint'); // no clear space: keep the text readable
        }
        img.style.top = `${rand(4, 80).toFixed(1)}%`;
        img.style.setProperty('--season-rest', img.style.top);
        _animate(img, sprite.motion ?? motion, theme.banner.seconds ?? [9, 16]);
        scene.appendChild(img);
      }
    }
    header.prepend(scene);
  }

  // Sprites in the window's side margins, on wide screens
  const gutter = (document.documentElement.clientWidth - CONTENT_WIDTH) / 2;
  if (gutter < GUTTER_MIN || !theme.margin) return;
  const { sprites, count, motion, scales, seconds = [14, 26] } = theme.margin;
  _picks(sprites, count, motion).forEach((sprite, i) => {
    const scale = pick(scales);
    const { width } = spriteSize(sprite);
    const img = _img(sprite, scale, 'season-sprite');
    // Alternate sides; where it rests if it doesn't move (or for reduced
    // motion). Still sprites, like buildings, stand near the bottom.
    const still = (sprite.motion ?? motion) === 'still';
    const rest = `${(still ? rand(78, 86) : rand(25, 92)).toFixed(1)}vh`;
    img.style.setProperty('--season-rest', rest);
    img.style.top = MOVES_DOWN.has(sprite.motion ?? motion) ? '-48px' : rest;
    const inset = 12 + Math.random() * Math.max(0, gutter - width * scale - 40);
    img.style[i % 2 ? 'right' : 'left'] = `${Math.round(inset)}px`;
    _animate(img, sprite.motion ?? motion, seconds);
    document.body.appendChild(img);
  });
}

if (typeof window !== 'undefined') {
  const preview = previewTheme(window.location.search);
  const name = preview ?? themeFor(new Date());
  if (name && name !== 'none') _decorate(name);
}
