/* ============================================================
   themes.js — The seasonal themes' pixel art
   ============================================================
   One entry per theme named in CONFIG.seasons (seasons.js picks
   which, by date, and places the art). Each theme can have:
     strip       a sprite tiled along the bottom of the black
                 header, at stripScale
     corners     { sprite, scale }: hung in the header's top-left
                 corner and, mirrored, the top-right
     banner      { sprites, count, motion, scales }: a scene in the
                 header, behind the text
     margin      { sprites, count, motion, scales }: in the
                 window's side margins, on wide screens
   motion is 'fall', 'float' or 'twinkle' (a sprite's own motion
   wins); all of it stops for reduced motion. scales are picked
   at random per sprite, for a little depth. Sprites are rows of
   characters plus a palette (pixelart.js): "." is transparent;
   "o" is usually the dark outline.
   ============================================================ */

// ── Autumn ────────────────────────────────────────────────────

// A leaf, tip at the top right, stem at the bottom left
const LEAF_ROWS = [
  '.....oo.',
  '...oorro',
  '..orrrdo',
  '.orrrdro',
  '.orrdrro',
  'orrdrro.',
  'ordrro..',
  'odoo....',
  'o.......',
];
const OUTLINE = '#3b2414';
const leaf = (r, d) => ({ rows: LEAF_ROWS, palette: { o: OUTLINE, r, d } });
const RED_LEAF = leaf('#c2410c', '#7c2d12');
const AMBER_LEAF = leaf('#f59e0b', '#b45309');
const BROWN_LEAF = leaf('#a16207', '#713f12');
const SMALL_LEAF = {
  rows: ['...oo', '.ooro', 'orrdo', 'ordo.', 'oo...'],
  palette: { o: OUTLINE, r: '#ea580c', d: '#9a3412' },
};
const ACORN = {
  rows: [
    '...o...',
    '..obo..',
    '.oBBBo.',
    'oBbBbBo',
    'ooooooo',
    '.oaaao.',
    '.oaAao.',
    '..oAo..',
    '...o...',
  ],
  palette: { o: OUTLINE, b: '#8b5a2b', B: '#5a3412', a: '#d6a461', A: '#a8743a' },
};

const AUTUMN = {
  // A pile of fallen leaves on dark soil
  strip: {
    rows: [
      '........y...............r.......',
      '.......yyy.....o.......rrr......',
      '..r...yyyyy...ooo.....rrrrr...y.',
      '.rrr.yyyyyyy.ooooo...rrrdrrr.yyy',
      'rrrrryyydyyyoooooooyyrrrrrrrryyy',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ],
    palette: { r: '#c2410c', d: '#7c2d12', o: '#ea580c', y: '#f59e0b', b: '#3b2414' },
  },
  stripScale: 4,
  // A branch with leaves, reaching in from the corner
  corners: {
    sprite: {
      rows: [
        'bbbbbbbbbbbbbbbbbbbbbbbb........',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbb....',
        '..bbb....bbb......bbb....bbbbb..',
        '..rrr.....r.......yy.......b....',
        '.rrrrr...rrr.....yyyy......rr...',
        '.rrdrr..rrdrr...yyyyyy....rrrr..',
        '..rrr....rrr.....yydy......rr...',
        '...r......r.......yy............',
      ],
      palette: { b: '#5a3412', r: '#c2410c', d: '#7c2d12', y: '#f59e0b' },
    },
    scale: 4,
  },
  banner: {
    sprites: [RED_LEAF, AMBER_LEAF, BROWN_LEAF, SMALL_LEAF],
    count: 16,
    motion: 'fall',
    scales: [2, 3],
  },
  margin: {
    sprites: [RED_LEAF, AMBER_LEAF, BROWN_LEAF, SMALL_LEAF, ACORN],
    count: 10,
    motion: 'fall',
    scales: [3, 4],
  },
};

// ── Dark Matter Day (Oct 31) ──────────────────────────────────

const WIMP_ROWS = [
  '...ooo...',
  '.oogggoo.',
  '.ogggggo.',
  'oggkgkggo',
  'oggkgkggo',
  'ogggggggo',
  'oGgggggGo',
  'oGGgGgGGo',
  'ogoogoogo',
  '.o..o..o.',
];
// A WIMP, mostly harmless
const WIMP = {
  rows: WIMP_ROWS,
  palette: { o: '#2e1065', g: '#c4b5fd', G: '#a78bfa', k: '#1e1b4b' },
};
// The same WIMP, nearly invisible: you can't see it, but it's there
const PALE_WIMP = {
  rows: WIMP_ROWS,
  palette: { o: '#ddd6fe', g: '#f5f3ff', G: '#ede9fe', k: '#c4b5fd' },
};
// A galaxy in its dark halo
const GALAXY = {
  rows: [
    '..H...H...H..',
    'H...........H',
    '....aaaaa....',
    '..aaasccsaaa.',
    '.aasccccccsaa',
    '..aaasccsaaa.',
    '....aaaaa....',
    'H...........H',
    '..H...H...H..',
  ],
  palette: { H: '#6d5bd0', a: '#818cf8', s: '#e0e7ff', c: '#fde68a' },
};
const STAR = {
  rows: ['.s.', 'sws', '.s.'],
  palette: { s: '#a5b4fc', w: '#ffffff' },
  motion: 'twinkle',
};

const DARK_MATTER = {
  // Halo particles and stars
  strip: {
    rows: [
      '....s.........H.......a...H.....',
      '.H........a........H.......s....',
      '........H.......s.......H.....a.',
      '..a..........H......a.....H.....',
      'H.....s...a......H.....a.....H..',
    ],
    palette: { s: '#e0e7ff', H: '#6d5bd0', a: '#818cf8' },
  },
  stripScale: 4,
  banner: {
    sprites: [STAR, STAR, STAR, STAR, WIMP, PALE_WIMP, GALAXY],
    count: 18,
    motion: 'float',
    scales: [2, 3],
  },
  margin: {
    sprites: [WIMP, PALE_WIMP, GALAXY, STAR],
    count: 8,
    motion: 'float',
    scales: [3, 4],
  },
};

/** The themes by name, as used in CONFIG.seasons. */
export const THEMES = {
  autumn: AUTUMN,
  'dark-matter': DARK_MATTER,
};
