/* ============================================================
   pixelart.js — Pixel-art sprites as code
   ============================================================
   A sprite is a few rows of characters and a palette, in the
   style of the generalquest project: each character is a pixel,
   "." is transparent, any other character is a key in the
   palette ("#rrggbb"). spriteDataUrl() draws one as an SVG data
   URL at a whole-number scale, merging each row's runs of one
   colour into a rectangle, with crisp edges.

   Sprites are the site's own data (themes.js), never text from
   outside, and colours are checked against #rrggbb before use.
   Pure; runs in Node and the browser.
   ============================================================ */

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Everything wrong with a sprite, or [] when it is valid.
 * @param {string} name - For the messages.
 * @param {{rows: string[], palette: Record<string, string>}} sprite
 * @returns {string[]}
 */
export function spriteProblems(name, sprite) {
  const out = [];
  const rows = sprite?.rows ?? [];
  if (!rows.length) return [`${name}: no rows`];
  const width = rows[0].length;
  rows.forEach((row, y) => {
    if (row.length !== width) out.push(`${name} row ${y}: ${row.length} px, expected ${width}`);
    for (const key of new Set(row)) {
      if (key !== '.' && !(key in (sprite.palette ?? {})))
        out.push(`${name} row ${y}: key "${key}" not in palette`);
    }
  });
  for (const [key, colour] of Object.entries(sprite.palette ?? {})) {
    if (key.length !== 1 || key === '.') out.push(`${name}: bad palette key "${key}"`);
    if (!HEX.test(colour)) out.push(`${name}: colour ${key} = "${colour}" is not #rrggbb`);
  }
  return out;
}

/** The sprite's size in pixels: { width, height }. */
export function spriteSize(sprite) {
  return { width: sprite.rows[0].length, height: sprite.rows.length };
}

/**
 * The sprite flipped left to right.
 * @param {{rows: string[], palette: Record<string, string>}} sprite
 */
export function mirrorSprite(sprite) {
  return { ...sprite, rows: sprite.rows.map((row) => [...row].reverse().join('')) };
}

/**
 * Each row's runs of one colour: [{ x, y, w, colour }].
 * @param {{rows: string[], palette: Record<string, string>}} sprite
 */
export function spriteRuns(sprite) {
  const runs = [];
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === key) end++;
      if (key !== '.') runs.push({ x, y, w: end - x, colour: sprite.palette[key] });
      x = end;
    }
  });
  return runs;
}

/**
 * The sprite as an SVG data URL, `scale` screen pixels per sprite pixel.
 * Throws on an invalid sprite, so a broken one fails loudly in the tests.
 * @param {{rows: string[], palette: Record<string, string>}} sprite
 * @param {number} [scale]
 * @returns {string}
 */
export function spriteDataUrl(sprite, scale = 3) {
  const problems = spriteProblems('sprite', sprite);
  if (problems.length) throw new Error(problems.join('; '));
  const { width, height } = spriteSize(sprite);
  const rects = spriteRuns(sprite)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.colour}"/>`)
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}" height="${height * scale}" ` +
    `viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">${rects}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
