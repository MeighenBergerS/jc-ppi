/* ============================================================
   themes.js — The seasonal themes' pixel art
   ============================================================
   One entry per theme named in CONFIG.seasons (seasons.js picks
   which, by date). Each theme has:
     strip    a sprite tiled along the bottom of the black header
     sprites  small sprites, a few of which are scattered in the
              page margins on wide screens
     count    how many margin sprites to show
     motion   'sway' or 'float' (off for reduced motion)
   Sprites are rows of characters plus a palette (pixelart.js):
   "." is transparent; "o" is usually the dark outline.
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

const AUTUMN = {
  strip: {
    rows: [
      '...r.........y..........',
      '..rrr...o...yyy.....r...',
      '.rrrrr.ooo.yyyyy...rrr..',
      'rrdrrrooooyyyyyyyrrrrrro',
    ],
    palette: { r: '#c2410c', d: '#7c2d12', o: '#ea580c', y: '#f59e0b' },
  },
  sprites: [
    { rows: LEAF_ROWS, palette: { o: '#3b2414', r: '#c2410c', d: '#7c2d12' } },
    { rows: LEAF_ROWS, palette: { o: '#3b2414', r: '#f59e0b', d: '#b45309' } },
    {
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
      palette: { o: '#3b2414', b: '#8b5a2b', B: '#5a3412', a: '#d6a461', A: '#a8743a' },
    },
  ],
  count: 4,
  motion: 'sway',
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

const DARK_MATTER = {
  // Faint halo particles and a few stars
  strip: {
    rows: [
      '....s.........H.........',
      '.H........a........H....',
      '........H.......s.......',
      '..a..........H......a...',
    ],
    palette: { s: '#e0e7ff', H: '#6d5bd0', a: '#818cf8' },
  },
  sprites: [
    // A WIMP, mostly harmless
    { rows: WIMP_ROWS, palette: { o: '#2e1065', g: '#c4b5fd', G: '#a78bfa', k: '#1e1b4b' } },
    // A galaxy in its dark halo
    {
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
    },
    // The same WIMP, nearly invisible: you can't see it, but it's there
    { rows: WIMP_ROWS, palette: { o: '#ddd6fe', g: '#f5f3ff', G: '#ede9fe', k: '#c4b5fd' } },
  ],
  count: 4,
  motion: 'float',
};

/** The themes by name, as used in CONFIG.seasons. */
export const THEMES = {
  autumn: AUTUMN,
  'dark-matter': DARK_MATTER,
};
